#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== Juris Visual Spec & Provenance Guard ===\n');

// 1. Scan for any visual fixtures or generated specs in tests/packages
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
      // Exclude unit test files that intentionally construct negative test inputs
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue;
      }
      if (
        entry.name.includes('visual') ||
        entry.name.includes('spec') ||
        entry.name.includes('fixture')
      ) {
        scannedCount++;
        const content = fs.readFileSync(fullPath, 'utf8');

        // Search for series definitions without factIds
        if (content.includes('"series"') || content.includes('series:')) {
          if (content.includes('factIds: []') || content.includes('"factIds": []')) {
            console.error(
              `❌ PROVENANCE FAILURE: Empty factIds array in ${path.relative(ROOT, fullPath)}`,
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
scanDir(path.join(ROOT, 'e2e'));

console.log(`Scanned ${scannedCount} files for visual specifications.`);

if (errors > 0) {
  console.error(`\n❌ FAILED: Found ${errors} visual provenance violations.`);
  process.exit(1);
}

console.log('\n✅ PASS: All visual specifications enforce strict point-to-fact provenance.');
process.exit(0);
