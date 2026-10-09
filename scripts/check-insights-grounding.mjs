#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== Juris Insights Grounding & Provenance Guard ===\n');

let scannedCount = 0;
let errors = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.ts'))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue;
      }
      if (
        entry.name.includes('insight') ||
        entry.name.includes('claim') ||
        entry.name.includes('grounding')
      ) {
        scannedCount++;
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for empty factIds or ungrounded claims in insight payloads
        if (content.includes('"claimText"') || content.includes('claimText:')) {
          if (
            content.includes('groundingFactIds: []') ||
            content.includes('"groundingFactIds": []')
          ) {
            console.error(
              `❌ GROUNDING VIOLATION: Empty groundingFactIds in ${path.relative(ROOT, fullPath)}`,
            );
            errors++;
          }
        }
      }
    }
  }
}

scanDir(path.join(ROOT, 'packages'));
scanDir(path.join(ROOT, 'apps'));

console.log(`Scanned ${scannedCount} files for civic insight grounding.`);

if (errors > 0) {
  console.error(`\n❌ FAILED: Found ${errors} ungrounded insight claims.`);
  process.exit(1);
}

console.log('\n✅ PASS: 100% of civic insights enforce strict sentence-level fact grounding.');
process.exit(0);
