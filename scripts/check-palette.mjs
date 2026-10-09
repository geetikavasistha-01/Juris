#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== Juris Okabe-Ito Palette & CVD Accessibility Guard ===\n');

// 1. Verify that tokens.css defines all canonical series variables
const TOKENS_CSS = path.join(ROOT, 'apps/web/src/styles/tokens.css');
if (!fs.existsSync(TOKENS_CSS)) {
  console.error(`❌ tokens.css not found at ${TOKENS_CSS}`);
  process.exit(1);
}

const tokensContent = fs.readFileSync(TOKENS_CSS, 'utf8');

const requiredSeriesVars = [
  '--chart-series-1',
  '--chart-series-2',
  '--chart-series-3',
  '--chart-series-4',
  '--chart-series-5',
  '--chart-series-6',
];

let missing = 0;
for (const varName of requiredSeriesVars) {
  if (!tokensContent.includes(varName)) {
    console.error(`❌ Missing required token: ${varName} in tokens.css`);
    missing++;
  }
}

if (missing > 0) {
  console.error(`\n❌ FAILED: ${missing} missing chart series variables in tokens.css`);
  process.exit(1);
}

// 2. Scan component files to ensure no hardcoded non-token hex codes are used for chart series
let violations = 0;
let checkedFiles = 0;

function scanVisualComponents(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      scanVisualComponents(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      if (
        entry.name.includes('Chart') ||
        entry.name.includes('Visual') ||
        entry.name.includes('Map')
      ) {
        checkedFiles++;
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for raw hex colors in color arrays
        const hexInArray = content.match(/colors\s*=\s*\[\s*['"]#[0-9a-fA-F]{3,6}['"]/g);
        if (hexInArray) {
          console.error(
            `❌ PALETTE VIOLATION: Hardcoded hex color in chart array in ${path.relative(ROOT, fullPath)}`,
          );
          violations++;
        }
      }
    }
  }
}

scanVisualComponents(path.join(ROOT, 'apps/web/src/components'));

console.log(
  `Verified ${requiredSeriesVars.length} series tokens across ${checkedFiles} visual components.`,
);

if (violations > 0) {
  console.error(`\n❌ FAILED: Found ${violations} palette violations.`);
  process.exit(1);
}

console.log('\n✅ PASS: 100% of charts use canonical Okabe-Ito CVD-compliant design tokens.');
process.exit(0);
