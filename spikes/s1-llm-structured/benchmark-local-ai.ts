import fs from 'node:fs';
import path from 'node:path';
import { extractPdfPages, type ExtractedPage } from '../s3-pdf-extraction/extractor.js';
import {
  findQuoteInPage,
  verifyFactQuoteAndValue,
} from '../../packages/shared/src/text-normalization.js';
import {
  type ModelProvider,
  GeminiProvider,
  OllamaProvider,
  ReplayProvider,
} from '../../packages/model/src/index.js';

interface BenchmarkDocument {
  name: string;
  path: string;
  maxPages: number;
}

interface DocumentBenchmarkResult {
  document: string;
  pagesEvaluated: number;
  coldStartTimeMs: number;
  totalTimeMs: number;
  latencyPerPageMs: number;
  memoryFootprintMb: number;
  factsExtracted: number;
  quoteMatchCount: number;
  numberMatchCount: number;
  unitMatchCount: number;
  periodMatchCount: number;
  verificationRate: number;
}

interface ProviderBenchmarkSummary {
  provider: string;
  modelId: string;
  documents: DocumentBenchmarkResult[];
  averageLatencyPerPageMs: number;
  averageVerificationRate: number;
  hardwareBaseline: string;
}

const GOLDEN_DOCUMENTS: BenchmarkDocument[] = [
  {
    name: 'NDMC Budget Speech 2026-27',
    path: 'docs/pdf/budget-speech-2026-27-english.pdf',
    maxPages: 10,
  },
  {
    name: 'Civil Lens Civic Dataset Report',
    path: 'docs/pdf/Civil lens csv.pdf',
    maxPages: 5,
  },
  {
    name: 'Standard Municipal Summary',
    path: 'docs/pdf/test_upload.pdf',
    maxPages: 5,
  },
];

async function evaluateDocumentOnProvider(
  provider: ModelProvider,
  doc: BenchmarkDocument,
  pages: ExtractedPage[],
): Promise<DocumentBenchmarkResult> {
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  const formattedPages = pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.rawText,
  }));

  const coldStartMark = performance.now();
  const coldStartTimeMs = Math.round(coldStartMark - start);

  const result = await provider.generateFacts({
    pages: formattedPages,
    documentTitle: doc.name,
  });

  const durationMs = Math.round(performance.now() - start);
  const latencyPerPageMs = Math.round(durationMs / Math.max(pages.length, 1));
  const memAfter = process.memoryUsage().heapUsed;
  const memoryFootprintMb = Number(((memAfter - memBefore) / (1024 * 1024)).toFixed(2));

  let quoteMatches = 0;
  let numberMatches = 0;
  let unitMatches = 0;
  let periodMatches = 0;
  let verifiedCount = 0;

  for (const fact of result.facts) {
    const pageObj = pages.find((p) => p.pageNumber === fact.page);
    if (!pageObj) continue;

    // 1. Quote match test
    const quoteResult = findQuoteInPage(pageObj.rawText, fact.quote);
    if (quoteResult.matched) {
      quoteMatches++;
    }

    // 2. Deterministic in-code fact verification
    const verification = verifyFactQuoteAndValue(pageObj.rawText, {
      quote: fact.quote,
      value: fact.value,
      unit: fact.unit,
      period: fact.period,
      page: fact.page,
      type: fact.type,
    });

    if (verification.verified) {
      verifiedCount++;
    }
    if (verification.valueMatched) {
      numberMatches++;
    }
    if (verification.unitMatched) {
      unitMatches++;
    }
    if (verification.periodMatched) {
      periodMatches++;
    }
  }

  const verificationRate =
    result.facts.length > 0 ? Number(((verifiedCount / result.facts.length) * 100).toFixed(2)) : 0;

  return {
    document: doc.name,
    pagesEvaluated: pages.length,
    coldStartTimeMs,
    totalTimeMs: durationMs,
    latencyPerPageMs,
    memoryFootprintMb,
    factsExtracted: result.facts.length,
    quoteMatchCount: quoteMatches,
    numberMatchCount: numberMatches,
    unitMatchCount: unitMatches,
    periodMatchCount: periodMatches,
    verificationRate,
  };
}

export async function runLocalAiBenchmark(): Promise<ProviderBenchmarkSummary[]> {
  console.info('=== Juris Local AI & Model Provider Evaluation Benchmark ===\n');
  console.info('Hardware Baseline: MacBook Air (Apple Silicon, 16GB Unified Memory)');

  const summaries: ProviderBenchmarkSummary[] = [];

  // Extract pages for all 3 documents once
  const docPages: Map<string, ExtractedPage[]> = new Map();
  for (const doc of GOLDEN_DOCUMENTS) {
    if (fs.existsSync(doc.path)) {
      console.info(`Extracting pages from ${doc.name} (${doc.path})...`);
      const pages = await extractPdfPages(doc.path, doc.maxPages);
      docPages.set(doc.name, pages);
    } else {
      console.warn(`File not found: ${doc.path}`);
    }
  }

  // 1. Evaluate Replay Provider (Deterministic baseline)
  console.info('\n--- Evaluating Recorded Replay Provider ---');
  const replayProvider = new ReplayProvider();
  const replayResults: DocumentBenchmarkResult[] = [];
  for (const doc of GOLDEN_DOCUMENTS) {
    const pages = docPages.get(doc.name);
    if (pages) {
      const res = await evaluateDocumentOnProvider(replayProvider, doc, pages);
      replayResults.push(res);
      console.info(
        `[Replay] ${doc.name}: ${res.factsExtracted} facts, verification rate: ${res.verificationRate}%, latency/page: ${res.latencyPerPageMs}ms`,
      );
    }
  }
  summaries.push({
    provider: 'Recorded Replay',
    modelId: replayProvider.metadata.modelId,
    documents: replayResults,
    averageLatencyPerPageMs: Math.round(
      replayResults.reduce((acc, r) => acc + r.latencyPerPageMs, 0) / replayResults.length,
    ),
    averageVerificationRate: Number(
      (
        replayResults.reduce((acc, r) => acc + r.verificationRate, 0) / replayResults.length
      ).toFixed(2),
    ),
    hardwareBaseline: 'MacBook Air M-series 16GB',
  });

  // 2. Check for Ollama Local Availability
  let ollamaAvailable = false;
  try {
    const ping = await fetch('http://127.0.0.1:11434/api/tags');
    if (ping.ok) ollamaAvailable = true;
  } catch {
    ollamaAvailable = false;
  }

  if (ollamaAvailable) {
    console.info('\n--- Ollama Local Daemon Detected (127.0.0.1:11434) ---');
    // Test locally available model (smollm:latest) to measure real Mac inference metrics
    const localModelId = 'smollm:latest';
    const ollamaLocal = new OllamaProvider({ modelId: localModelId });
    const localResults: DocumentBenchmarkResult[] = [];
    try {
      for (const doc of GOLDEN_DOCUMENTS) {
        const pages = docPages.get(doc.name);
        if (pages) {
          const res = await evaluateDocumentOnProvider(ollamaLocal, doc, pages.slice(0, 1));
          localResults.push(res);
          console.info(
            `[Ollama ${localModelId}] ${doc.name}: ${res.factsExtracted} facts, rate: ${res.verificationRate}%, latency: ${res.latencyPerPageMs}ms/page, coldStart: ${res.coldStartTimeMs}ms`,
          );
        }
      }
      summaries.push({
        provider: 'Ollama (Local Apple Silicon)',
        modelId: localModelId,
        documents: localResults,
        averageLatencyPerPageMs: Math.round(
          localResults.reduce((acc, r) => acc + r.latencyPerPageMs, 0) /
            Math.max(localResults.length, 1),
        ),
        averageVerificationRate: Number(
          (
            localResults.reduce((acc, r) => acc + r.verificationRate, 0) /
            Math.max(localResults.length, 1)
          ).toFixed(2),
        ),
        hardwareBaseline: 'MacBook Air M-series 16GB (Local Inference)',
      });
    } catch (ollamaErr) {
      console.warn('Ollama local model invocation failed:', (ollamaErr as Error).message);
    }
  } else {
    console.info(
      '\nNote: Local Ollama daemon not running at 127.0.0.1:11434. Profiling recorded performance characteristics.',
    );
  }

  // 3. Evaluate Gemini Provider (if live API key available)
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (apiKey) {
    console.info('\n--- Evaluating Google Gemini 2.5 Flash Provider ---');
    try {
      const geminiProvider = new GeminiProvider({ apiKey });
      const geminiResults: DocumentBenchmarkResult[] = [];
      for (const doc of GOLDEN_DOCUMENTS) {
        const pages = docPages.get(doc.name);
        if (pages) {
          const res = await evaluateDocumentOnProvider(geminiProvider, doc, pages.slice(0, 3));
          geminiResults.push(res);
          console.info(
            `[Gemini] ${doc.name}: ${res.factsExtracted} facts, verification rate: ${res.verificationRate}%, latency/page: ${res.latencyPerPageMs}ms`,
          );
        }
      }
      summaries.push({
        provider: 'Google Gemini',
        modelId: 'gemini-2.5-flash',
        documents: geminiResults,
        averageLatencyPerPageMs: Math.round(
          geminiResults.reduce((acc, r) => acc + r.latencyPerPageMs, 0) / geminiResults.length,
        ),
        averageVerificationRate: Number(
          (
            geminiResults.reduce((acc, r) => acc + r.verificationRate, 0) / geminiResults.length
          ).toFixed(2),
        ),
        hardwareBaseline: 'Cloud API + MacBook Air M-series 16GB',
      });
    } catch (geminiErr) {
      console.warn('Gemini live evaluation failed:', (geminiErr as Error).message);
    }
  }

  const outputPath = path.resolve(process.cwd(), 'spikes/s1-llm-structured/benchmark-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(summaries, null, 2));
  console.info(`\nBenchmark results saved to ${outputPath}`);

  return summaries;
}

// Execute CLI entry
if (process.argv[1]?.endsWith('benchmark-local-ai.ts')) {
  runLocalAiBenchmark().catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
}
