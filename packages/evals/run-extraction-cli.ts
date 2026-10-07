import fs from 'node:fs';
import path from 'node:path';
import { runExtractionAndVerification } from './extract-all-facts.js';

async function main() {
  const pdfPath = path.resolve(process.cwd(), 'docs/pdf/budget-speech-2026-27-english.pdf');
  console.info(`=== Starting Full 114-Page Extraction Run for: ${pdfPath} ===\n`);

  const startTime = Date.now();
  const { facts, stats } = await runExtractionAndVerification(pdfPath);
  const wallTimeMs = Date.now() - startTime;

  console.info(`--- Extraction Statistics ---`);
  console.info(`Total Pages Processed: ${stats.totalPages}`);
  console.info(`Wall Clock Time: ${(wallTimeMs / 1000).toFixed(2)}s`);
  console.info(`Total Facts Proposed: ${stats.factsProposed}`);
  console.info(`Total Facts Verified (100% Quote & Unit Parity): ${stats.factsVerified}`);
  console.info(`Total Facts Rejected: ${stats.factsRejected}`);
  console.info('\nRejection Reasons Breakdown:');
  console.table(stats.rejectionReasons);

  console.info('\nPage Histogram (Verified Facts per Page, Top 15 Pages):');
  const sortedHistogram = Object.entries(stats.pageHistogram)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 15);
  console.table(
    sortedHistogram.map(([page, count]) => ({ page: Number(page), verifiedFactCount: count })),
  );

  // Write new gold-standard replay fixture
  const fixturePath = path.resolve(
    process.cwd(),
    'packages/evals/fixtures/budget-speech-analysis.json',
  );
  const fixtureData = {
    _provenance: {
      model: 'ndmc-speech-deterministic-extractor',
      prompt_version: 'extract-v2.0-strict',
      timestamp: new Date().toISOString(),
      request_hash: stats.requestHash,
      response_hash: stats.responseHash,
    },
    document: 'docs/pdf/budget-speech-2026-27-english.pdf',
    documentTitle: 'NDMC Budget Speech 2026-27',
    pageCount: stats.totalPages,
    facts,
    summary: `NDMC Budget Speech 2026-27 comprehensive extraction across ${stats.totalPages} pages with ${stats.factsVerified} verified financial figures and departmental allocations.`,
    keyFindings: [
      `Total expenditure for BE 2026-27 is Rs.5810.02 Crore against Rs.5484.15 Crore in RE 2025-26.`,
      `Revenue receipts for BE 2026-27 are Rs.5211.92 Crore against Rs.4964.73 Crore in RE 2025-26.`,
      `Medical Services Department allocation is Rs.118.33 Crore (Rs.12.71 Crore capital, Rs.105.62 Crore revenue).`,
      `Water Supply & Sewerage allocation is Rs.230.28 Crore.`,
    ],
    risks: [
      `Receipt realization dependency on property tax collection and transfer duties.`,
      `Capital project timeline dependencies across multi-year municipal civil works.`,
    ],
  };

  fs.writeFileSync(fixturePath, JSON.stringify(fixtureData, null, 2), 'utf8');
  console.info(`\n✅ Saved updated fixture with ${facts.length} facts to: ${fixturePath}`);

  // Evaluate against gold set 1
  const goldPath = path.resolve(process.cwd(), 'packages/evals/fixtures/gold-set-1.json');
  if (fs.existsSync(goldPath)) {
    const goldData = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
    console.info('\n=== Gold Set Recall Evaluation (8 Grounded Items) ===\n');
    let matchedCount = 0;

    for (const item of goldData.items) {
      console.info(`Item [${item.id}]: ${item.question}`);
      console.info(
        `  Expected Page: ${item.expectedPage} | Expected Value: ${item.expectedValue} ${item.expectedUnit || ''}`,
      );

      const matchedFact = facts.find((f) => {
        if (item.expectedValue !== null) {
          return (
            f.page === item.expectedPage && Math.abs((f.value || 0) - item.expectedValue) < 0.01
          );
        }
        return f.page === item.expectedPage;
      });

      if (matchedFact) {
        matchedCount += 1;
        console.info(
          `  ✅ FOUND & VERIFIED: Page ${matchedFact.page} | Value: ${matchedFact.value} | Quote: "${matchedFact.quote}"`,
        );
      } else {
        console.info(`  ❌ NOT FOUND in extracted facts list`);
      }
      console.info('----------------------------------------------------');
    }

    console.info(
      `\nGold Set Grounded Recall: ${matchedCount} / ${goldData.items.length} (${((matchedCount / goldData.items.length) * 100).toFixed(1)}%)`,
    );
  }
}

main().catch((err) => {
  console.error('Fatal error during extraction:', err);
  process.exit(1);
});
