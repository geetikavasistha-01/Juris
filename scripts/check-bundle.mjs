#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST_DIR = path.resolve(process.cwd(), 'apps/web/dist');
const ASSETS_DIR = path.resolve(DIST_DIR, 'assets');
const INDEX_HTML = path.resolve(DIST_DIR, 'index.html');

const INITIAL_JS_LIMIT_KB = 300; // 300 KB gzip budget

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

export function analyzeBundle(options = {}) {
  const maxInitialKb =
    options.thresholdKb !== undefined ? options.thresholdKb : INITIAL_JS_LIMIT_KB;

  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Assets directory not found at ${ASSETS_DIR}. Please run 'pnpm run build' first.`,
    );
  }

  // Determine initial scripts from index.html
  let initialJsFiles = [];
  if (fs.existsSync(INDEX_HTML)) {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const scriptMatches = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+)"/g)];
    initialJsFiles = scriptMatches.map((m) => m[1]);
  }

  const allFiles = fs.readdirSync(ASSETS_DIR);
  const jsFiles = allFiles.filter((f) => f.endsWith('.js'));
  const cssFiles = allFiles.filter((f) => f.endsWith('.css'));

  const chunks = jsFiles.map((filename) => {
    const filePath = path.join(ASSETS_DIR, filename);
    const stat = fs.statSync(filePath);
    const rawBytes = stat.size;
    const gzBytes = getGzipSize(filePath);
    const isInitial =
      initialJsFiles.length > 0 ? initialJsFiles.includes(filename) : filename.startsWith('index-'); // fallback

    return {
      filename,
      rawBytes,
      rawKb: (rawBytes / 1024).toFixed(2),
      gzBytes,
      gzKb: (gzBytes / 1024).toFixed(2),
      isInitial,
    };
  });

  const initialChunks = chunks.filter((c) => c.isInitial);
  const lazyChunks = chunks.filter((c) => !c.isInitial);

  const _totalInitialRaw = initialChunks.reduce((acc, c) => acc + c.rawBytes, 0);
  const totalInitialGz = initialChunks.reduce((acc, c) => acc + c.gzBytes, 0);
  const totalInitialGzKb = (totalInitialGz / 1024).toFixed(2);

  const _totalLazyRaw = lazyChunks.reduce((acc, c) => acc + c.rawBytes, 0);
  const totalLazyGz = lazyChunks.reduce((acc, c) => acc + c.gzBytes, 0);
  const totalLazyGzKb = (totalLazyGz / 1024).toFixed(2);

  return {
    initialChunks,
    lazyChunks,
    cssFiles: cssFiles.map((filename) => {
      const filePath = path.join(ASSETS_DIR, filename);
      const stat = fs.statSync(filePath);
      return {
        filename,
        rawKb: (stat.size / 1024).toFixed(2),
        gzKb: (getGzipSize(filePath) / 1024).toFixed(2),
      };
    }),
    totalInitialGz,
    totalInitialGzKb: parseFloat(totalInitialGzKb),
    totalLazyGzKb: parseFloat(totalLazyGzKb),
    maxInitialKb,
    passed: parseFloat(totalInitialGzKb) <= maxInitialKb,
  };
}

if (process.argv[1] === import.meta.filename) {
  const isNegativeTest = process.argv.includes('--test-negative');
  const thresholdKb = isNegativeTest ? 50 : INITIAL_JS_LIMIT_KB; // 50 KB forces failure as negative control

  console.log('=== Juris Bundle Size Guard ===');
  try {
    const result = analyzeBundle({ thresholdKb });

    console.log('\n--- Initial JS Chunks (Loaded on App Shell) ---');
    for (const chunk of result.initialChunks) {
      console.log(
        `  ${chunk.filename.padEnd(35)} Raw: ${chunk.rawKb.padStart(7)} KB | Gzip: ${chunk.gzKb.padStart(6)} KB`,
      );
    }
    console.log(
      `  Total Initial JS Gzip: ${result.totalInitialGzKb} KB (Budget: ${result.maxInitialKb} KB)`,
    );

    console.log('\n--- Lazy-Loaded JS Chunks ---');
    for (const chunk of result.lazyChunks) {
      console.log(
        `  ${chunk.filename.padEnd(35)} Raw: ${chunk.rawKb.padStart(7)} KB | Gzip: ${chunk.gzKb.padStart(6)} KB`,
      );
    }
    console.log(`  Total Lazy JS Gzip: ${result.totalLazyGzKb} KB`);

    console.log('\n--- CSS Chunks ---');
    for (const file of result.cssFiles) {
      console.log(
        `  ${file.filename.padEnd(35)} Raw: ${file.rawKb.padStart(7)} KB | Gzip: ${file.gzKb.padStart(6)} KB`,
      );
    }

    if (!result.passed) {
      console.error(
        `\n❌ BUNDLE GUARD FAILED: Initial JS Gzip (${result.totalInitialGzKb} KB) exceeds budget (${result.maxInitialKb} KB).`,
      );
      process.exit(1);
    }

    console.log('\n✅ BUNDLE GUARD PASSED: Initial JS Gzip is within budget.');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error running bundle guard: ${err.message}`);
    process.exit(1);
  }
}
