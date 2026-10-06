import { chromium, type Page } from '@playwright/test';
import { createViewerServer } from './viewer-server.js';
import { extractPdfPages, sampleQuotesFromPages } from './extractor.js';
import fs from 'node:fs';

interface TestResult {
  id: string;
  category: string;
  pageNumber: number;
  quote: string;
  success: boolean;
  highlightedSpanCount?: number;
  reason?: string;
}

async function runForPdf(pdfPath: string, maxPages: number, page: Page) {
  console.info(`\n--- Testing PDF: ${pdfPath} ---`);
  const pages = await extractPdfPages(pdfPath, maxPages);
  console.info(`   Extracted ${pages.length} pages server-side.`);

  const quotes = sampleQuotesFromPages(pages);
  console.info(`   Sampled ${quotes.length} total test quotes.`);

  // Load PDF in browser viewer
  await page.evaluate(async (pdfUrl) => {
    await window.pdfMatcher.loadDocument(pdfUrl);
  }, `/${pdfPath}`);

  const results: TestResult[] = [];
  const failures: TestResult[] = [];

  for (const q of quotes) {
    const evalResult = await page.evaluate(
      async ({ pageNum, quoteText }) => {
        return await window.pdfMatcher.highlightQuote(pageNum, quoteText);
      },
      { pageNum: q.pageNumber, quoteText: q.quote },
    );

    const domHighlightCount = await page.locator('.textLayer span.highlight').count();
    const passed = evalResult.success && domHighlightCount > 0;
    const res: TestResult = {
      id: q.id,
      category: q.category,
      pageNumber: q.pageNumber,
      quote: q.quote,
      success: passed,
      highlightedSpanCount: domHighlightCount,
      reason: passed ? undefined : evalResult.reason || 'DOM_HIGHLIGHT_NOT_VISIBLE',
    };

    results.push(res);
    if (!passed) failures.push(res);
  }

  const total = results.length;
  const passedCount = results.filter((r) => r.success).length;
  const passRate = (passedCount / total) * 100;

  console.info(`   Results for ${pdfPath}: ${passedCount}/${total} (${passRate.toFixed(2)}%)`);
  return { pdfPath, total, passedCount, passRate, failures, results };
}

async function runS3Spike() {
  console.info('=== Spike S3: PDF Extraction + Playwright Viewer Text Layer Match ===\n');
  console.info('Starting local viewer test server on port 3456...');
  const server = await createViewerServer(3456);

  console.info('Launching Playwright Chromium to test real DOM text layer matching...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3456/index.html');
  await page.waitForFunction(() => window.pdfMatcher !== undefined);

  const budgetReport = await runForPdf('docs/pdf/budget-speech-2026-27-english.pdf', 25, page);
  const uploadReport = await runForPdf('docs/pdf/test_upload.pdf', 18, page);

  await browser.close();
  server.close();

  const total = budgetReport.total + uploadReport.total;
  const passedCount = budgetReport.passedCount + uploadReport.passedCount;
  const passRate = (passedCount / total) * 100;

  const allResults = [...budgetReport.results, ...uploadReport.results];
  const allFailures = [...budgetReport.failures, ...uploadReport.failures];

  const categoryBreakdown: Record<string, { total: number; passed: number; rate: number }> = {};
  for (const cat of ['single-line', 'multi-line', 'hyphenated', 'numeric', 'ligature']) {
    const catTotal = allResults.filter((r) => r.category === cat).length;
    const catPassed = allResults.filter((r) => r.category === cat && r.success).length;
    categoryBreakdown[cat] = {
      total: catTotal,
      passed: catPassed,
      rate: catTotal > 0 ? (catPassed / catTotal) * 100 : 100,
    };
  }

  console.info('\n=== Spike S3 Final Consolidated Results ===');
  console.info(`Total Programmatic Quotes Tested Across 2 Documents: ${total}`);
  console.info(`Strict Matches (Exact & Canonical): ${passedCount} / ${total}`);
  console.info(`Strict Pass Rate: ${passRate.toFixed(2)}% (Target: >= 95%)`);
  console.info('\nCategory Breakdown:');
  for (const [cat, data] of Object.entries(categoryBreakdown)) {
    console.info(`  - ${cat}: ${data.passed}/${data.total} (${data.rate.toFixed(1)}%)`);
  }

  if (allFailures.length > 0) {
    console.warn(`\nFailures Reported (${allFailures.length}):`);
    for (const f of allFailures) {
      console.warn(`  [${f.id}] Cat: ${f.category} | Page ${f.pageNumber} | Reason: ${f.reason}`);
      console.warn(`    Quote: "${f.quote}"`);
    }
  } else {
    console.info('\nZero failures detected across all sampled categories.');
  }

  // Save report
  fs.writeFileSync(
    'spikes/s3-pdf-extraction/results.json',
    JSON.stringify(
      {
        documents: [budgetReport.pdfPath, uploadReport.pdfPath],
        totalQuotes: total,
        passedCount,
        passRate: Number(passRate.toFixed(2)),
        targetPassRate: 95,
        passedThreshold: passRate >= 95,
        categoryBreakdown,
        failures: allFailures,
        results: allResults,
      },
      null,
      2,
    ),
  );

  if (passRate < 95) {
    console.error(`\n❌ Spike S3 FAILED to meet the >= 95% threshold (${passRate.toFixed(2)}%)`);
    process.exit(1);
  } else {
    console.info(`\n✅ Spike S3 PASSED threshold (>= 95%)`);
  }
}

runS3Spike().catch((err) => {
  console.error('Fatal error running Spike S3:', err);
  process.exit(1);
});
