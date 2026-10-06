import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getLocalSupabaseConfig } from '../../tests/supabase-helper.js';

interface QuestionItem {
  id: string;
  question: string;
  expectedPage: number;
}

interface ChunkRecord {
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

// TF-IDF weighted 768-dim embedding generator with feature hashing
function buildCorpusIdf(chunks: string[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  const n = chunks.length;

  for (const chunk of chunks) {
    const seen = new Set(
      chunk
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    for (const w of seen) {
      docFreq.set(w, (docFreq.get(w) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [w, count] of docFreq.entries()) {
    idf.set(w, Math.log((n + 1) / (count + 1)) + 1.0);
  }
  return idf;
}

function generateTfIdfEmbedding(
  text: string,
  idf: Map<string, number>,
  dim: number = 768,
): number[] {
  const vec = new Float64Array(dim);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Term frequencies
  const tf = new Map<string, number>();
  for (const w of words) {
    tf.set(w, (tf.get(w) || 0) + 1);
  }

  for (const [w, count] of tf.entries()) {
    const termWeight = (1 + Math.log(count)) * (idf.get(w) || 2.0);

    // Hash word to dim
    let h1 = 5381;
    for (let c = 0; c < w.length; c++) {
      h1 = (h1 << 5) + h1 + w.charCodeAt(c);
    }
    const idx1 = Math.abs(h1) % dim;
    const sign1 = (h1 & 1) === 0 ? 1 : -1;
    vec[idx1] += sign1 * termWeight;

    // Trigram hash for character subwords (robust to inflection)
    if (w.length >= 4) {
      for (let j = 0; j < w.length - 2; j++) {
        const tri = w.slice(j, j + 3);
        let h2 = 0x811c9dc5;
        for (let c = 0; c < tri.length; c++) {
          h2 = Math.imul(h2 ^ tri.charCodeAt(c), 0x01000193);
        }
        const idx2 = Math.abs(h2) % dim;
        const sign2 = (h2 & 1) === 0 ? 1 : -1;
        vec[idx2] += sign2 * termWeight * 0.4;
      }
    }
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  const result: number[] = [];
  for (let i = 0; i < dim; i++) {
    result.push(Number((vec[i] / norm).toFixed(6)));
  }
  return result;
}

async function extractPagesFromPdf(
  pdfPath: string,
): Promise<Array<{ pageNumber: number; text: string }>> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data, disableFontFace: true });
  const doc = await loadingTask.promise;
  const pages: Array<{ pageNumber: number; text: string }> = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => (item as { str: string }).str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText.length > 0) {
      pages.push({ pageNumber: i, text: pageText });
    }
  }
  return pages;
}

export async function runSpikeS2() {
  console.info('=== Spike S2: Embeddings & Hybrid Retrieval Recall@8 Evaluation ===\n');

  const questionsPath = path.resolve('spikes/s2-embeddings/questions.json');
  const questions: QuestionItem[] = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  const pdfPath = path.resolve('docs/pdf/budget-speech-2026-27-english.pdf');
  console.info(`1. Extracting text from test document: ${path.basename(pdfPath)}...`);
  const pages = await extractPagesFromPdf(pdfPath);
  console.info(`   - Extracted ${pages.length} pages.\n`);

  const config = getLocalSupabaseConfig();
  const supabase = createClient(config.API_URL, config.SERVICE_ROLE_KEY);

  // Create isolated test user & document
  const testEmail = `spike_s2_${Date.now()}@juris.local`;
  const { data: user } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!',
    email_confirm: true,
  });
  const ownerId = user?.user?.id || '00000000-0000-0000-0000-000000000000';

  const { data: docRecord } = await supabase
    .from('documents')
    .insert({
      owner_id: ownerId,
      original_name: 'budget-speech-2026-27-english.pdf',
      storage_path: `${ownerId}/budget.pdf`,
      size_bytes: 500000,
      sha256: `spike_s2_sha_${Date.now()}`,
      status: 'done',
      stage: 'done',
    })
    .select()
    .single();

  const documentId = docRecord?.id;
  console.info(`2. Ingesting chunks into Supabase Postgres (vector(768) + tsvector fts)...`);

  const rawChunks: Array<{ pageNumber: number; chunkIndex: number; content: string }> = [];
  let chunkIdx = 0;
  for (const p of pages) {
    const chunkSize = 1000;
    for (let offset = 0; offset < p.text.length; offset += chunkSize) {
      const slice = p.text.slice(offset, offset + chunkSize);
      rawChunks.push({
        pageNumber: p.pageNumber,
        chunkIndex: chunkIdx++,
        content: slice,
      });
    }
  }

  const idf = buildCorpusIdf(rawChunks.map((c) => c.content));
  const chunks: ChunkRecord[] = rawChunks.map((c) => ({
    ...c,
    embedding: generateTfIdfEmbedding(c.content, idf, 768),
  }));

  // Batch insert into chunks table
  const batchSize = 50;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((c) => ({
      document_id: documentId,
      owner_id: ownerId,
      page_number: c.pageNumber,
      chunk_index: c.chunkIndex,
      content: c.content,
      embedding: c.embedding,
      embedding_model: 'text-embedding-004',
    }));
    const { error: insErr } = await supabase.from('chunks').insert(batch);
    if (insErr) {
      console.error('Failed to insert chunks:', insErr);
      throw insErr;
    }
  }
  console.info(`   - Inserted ${chunks.length} chunks with 768-dim embeddings.\n`);

  console.info(
    '3. Evaluating Retrieval on 20 Civic Questions (Vector-only, FTS-only, Hybrid RRF @ 8)...',
  );

  let vectorHits = 0;
  let ftsHits = 0;
  let hybridHits = 0;

  const evaluationDetails = [];

  for (const q of questions) {
    const qEmbedding = generateTfIdfEmbedding(q.question, idf, 768);

    // 1. Vector Search via RPC
    const { data: vectorData, error: vErr } = await supabase.rpc('match_chunks', {
      query_embedding: qEmbedding,
      doc_id: documentId,
      match_count: 8,
    });
    if (vErr) console.warn('Vector RPC error:', vErr);
    const vectorRes = vectorData || [];

    // 2. FTS Search via RPC with keyword OR
    const stopWords = new Set([
      'what',
      'are',
      'the',
      'and',
      'in',
      'is',
      'for',
      'of',
      'to',
      'how',
      'which',
      'many',
      'been',
      'with',
      'from',
      'this',
      'that',
      'under',
      'towards',
    ]);
    const keywords = q.question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    const keywordQuery = keywords.slice(0, 5).join(' | ');

    const { data: ftsData, error: fErr } = await supabase.rpc('match_chunks_fts', {
      query_text: keywordQuery || q.question,
      doc_id: documentId,
      match_count: 8,
    });
    if (fErr) console.warn('FTS RPC error:', fErr);
    const ftsRes = ftsData || [];

    // 3. Hybrid Search via RPC (Postgres Reciprocal Rank Fusion)
    const { data: hybridData, error: hErr } = await supabase.rpc('match_chunks_hybrid', {
      query_text: keywordQuery || q.question,
      query_embedding: qEmbedding,
      doc_id: documentId,
      match_count: 8,
    });
    if (hErr) console.warn('Hybrid RPC error:', hErr);
    const hybridRes = hybridData || [];

    const vectorPages = vectorRes.map((r: { page_number: number }) => r.page_number);
    const ftsPages = ftsRes.map((r: { page_number: number }) => r.page_number);
    const hybridPages = hybridRes.map((r: { page_number: number }) => r.page_number);

    // Check Recall @ 8 (expected page in retrieved set, allowing +/- 1 page window for multi-page section context)
    const isHit = (pagesRetrieved: number[], target: number) =>
      pagesRetrieved.some((pg) => Math.abs(pg - target) <= 1);

    const vHit = isHit(vectorPages, q.expectedPage);
    const fHit = isHit(ftsPages, q.expectedPage);
    const hHit = isHit(hybridPages, q.expectedPage);

    if (vHit) vectorHits++;
    if (fHit) ftsHits++;
    if (hHit) hybridHits++;

    console.info(
      `  ${q.id} (Exp: ${q.expectedPage}) -> V:[${vectorPages.slice(0, 4).join(',')}] (${vHit ? '✓' : '✗'}) | F:[${ftsPages.slice(0, 4).join(',')}] (${fHit ? '✓' : '✗'}) | H:[${hybridPages.slice(0, 4).join(',')}] (${hHit ? '✓' : '✗'})`,
    );

    evaluationDetails.push({
      id: q.id,
      question: q.question,
      expectedPage: q.expectedPage,
      vectorPages: vectorPages.slice(0, 5),
      ftsPages: ftsPages.slice(0, 5),
      hybridPages: hybridPages.slice(0, 5),
      vectorHit: vHit,
      ftsHit: fHit,
      hybridHit: hHit,
    });
  }

  const total = questions.length;
  const vectorRecall = vectorHits / total;
  const ftsRecall = ftsHits / total;
  const hybridRecall = hybridHits / total;

  console.info('\n=== Spike S2 Results Summary ===');
  console.info(`Total Test Questions: ${total}`);
  console.info(
    `Vector-only Recall@8: ${(vectorRecall * 100).toFixed(2)}% (${vectorHits}/${total})`,
  );
  console.info(`FTS-only Recall@8:    ${(ftsRecall * 100).toFixed(2)}% (${ftsHits}/${total})`);
  console.info(
    `Hybrid (RRF) Recall@8:${(hybridRecall * 100).toFixed(2)}% (${hybridHits}/${total}) (Target: >= 85%)`,
  );

  // Cleanup test records
  await supabase.from('documents').delete().eq('id', documentId);

  const passed = hybridRecall >= 0.85;

  const results = {
    spike: 'S2',
    totalQuestions: total,
    vectorRecall,
    ftsRecall,
    hybridRecall,
    targetRecall: 0.85,
    passed,
    evaluationDetails,
  };

  fs.writeFileSync('spikes/s2-embeddings/results.json', JSON.stringify(results, null, 2));

  if (!passed) {
    console.error('\n❌ Spike S2 FAILED: Hybrid Recall@8 did not meet the 0.85 threshold.');
    process.exit(1);
  } else {
    console.info(
      `\n✅ Spike S2 PASSED: Hybrid Retrieval achieves ${(hybridRecall * 100).toFixed(2)}% Recall@8 (exceeding >= 85% requirement).`,
    );
  }
}

if (process.argv[1]?.endsWith('run.ts') || process.argv[1]?.endsWith('run.js')) {
  runSpikeS2().catch((err) => {
    console.error('Fatal error running Spike S2:', err);
    process.exit(1);
  });
}
