import fs from 'node:fs';
import { DocumentAnalysisSchema, type DocumentAnalysis } from './schema.js';
import { extractPdfPages } from '../s3-pdf-extraction/extractor.js';
import { findQuoteInPage } from '../../packages/shared/src/text-normalization.js';

async function runS1Spike() {
  console.info('=== Spike S1: LLM Structured Output & Evidence Verification ===\n');

  const pdfPath = 'docs/pdf/budget-speech-2026-27-english.pdf';
  console.info(`1. Extracting text layers from ${pdfPath}...`);
  const pages = await extractPdfPages(pdfPath, 70);
  console.info(`   Extracted ${pages.length} pages.`);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const isLive = Boolean(apiKey && process.env.LLM_MODE !== 'replay');

  let rawAnalysis: DocumentAnalysis;

  if (isLive) {
    console.info(
      '2. Executing LIVE Gemini 2.5 Flash structured extraction call with Google Gen AI SDK...',
    );
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze this government budget document and extract key findings and numeric facts. Output valid JSON strictly following the schema.
Document Text:
${pages
  .slice(0, 5)
  .map((p) => `--- Page ${p.pageNumber} ---\n${p.rawText}`)
  .join('\n\n')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    rawAnalysis = JSON.parse(text);
  } else {
    console.info(
      '2. Executing in REPLAY mode against recorded gold response fixture (LLM_MODE=replay)...',
    );
    const fixturePath = 'packages/evals/fixtures/budget-speech-analysis.json';
    rawAnalysis = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }

  console.info('3. Validating LLM output strictly against DocumentAnalysisSchema (Zod)...');
  const parseResult = DocumentAnalysisSchema.safeParse(rawAnalysis);
  if (!parseResult.success) {
    console.error('Schema validation failed:', parseResult.error.format());
    process.exit(1);
  }
  const analysis = parseResult.data;
  console.info(
    `   - Schema validation PASSED (Type: ${analysis.documentType}, Findings: ${analysis.keyFindings.length}, Facts: ${analysis.facts.length})`,
  );

  console.info(
    '4. Executing In-Code Verification on every extracted fact (quote match on source page)...',
  );
  let verifiedCount = 0;
  const verifiedFacts = [];
  const rejectedFacts = [];

  for (const fact of analysis.facts) {
    const pageObj = pages.find((p) => p.pageNumber === fact.page);
    if (!pageObj) {
      rejectedFacts.push({ fact, reason: `Page ${fact.page} out of extracted range` });
      continue;
    }

    const matchResult = findQuoteInPage(pageObj.rawText, fact.quote);
    if (matchResult.matched) {
      verifiedCount++;
      verifiedFacts.push({
        fact,
        exactMatch: matchResult.exactMatch,
      });
    } else {
      rejectedFacts.push({
        fact,
        reason: `Verbatim quote "${fact.quote}" not found on Page ${fact.page}`,
      });
    }
  }

  const verificationRate =
    analysis.facts.length > 0 ? (verifiedCount / analysis.facts.length) * 100 : 0;
  console.info(`\n=== Spike S1 Results Summary ===`);
  console.info(`Total Facts Extracted: ${analysis.facts.length}`);
  console.info(`Facts Verified in Code: ${verifiedCount} / ${analysis.facts.length}`);
  console.info(`Verification Rate: ${verificationRate.toFixed(2)}% (Target: >= 95%)`);

  if (rejectedFacts.length > 0) {
    console.warn(`Rejected Facts (${rejectedFacts.length}):`);
    for (const r of rejectedFacts) {
      console.warn(`  - [Page ${r.fact.page}] ${r.reason}`);
    }
  } else {
    console.info('Zero fact verification failures detected.');
  }

  const results = {
    spike: 'S1',
    mode: isLive ? 'live' : 'replay',
    schemaValid: true,
    totalFacts: analysis.facts.length,
    verifiedCount,
    verificationRate: Number(verificationRate.toFixed(2)),
    passed: verificationRate >= 95,
    analysis,
  };

  fs.writeFileSync('spikes/s1-llm-structured/results.json', JSON.stringify(results, null, 2));

  if (verificationRate < 95) {
    console.error(
      `\n❌ Spike S1 FAILED verification rate threshold (${verificationRate.toFixed(2)}%)`,
    );
    process.exit(1);
  } else {
    console.info(
      `\n✅ Spike S1 PASSED: Structured extraction output successfully conforms to Zod schema and satisfies in-code fact verification (>= 95%).`,
    );
  }
}

runS1Spike().catch((err) => {
  console.error('Fatal error running Spike S1:', err);
  process.exit(1);
});
