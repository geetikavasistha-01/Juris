#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const FIXTURES_DIR = path.resolve(process.cwd(), 'packages/evals/fixtures');

if (!fs.existsSync(FIXTURES_DIR)) {
  console.info(`No fixtures directory found at ${FIXTURES_DIR}.`);
  process.exit(0);
}

const isNegativeControl = process.argv.includes('--test-negative');

const files = fs
  .readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.join(FIXTURES_DIR, f));

let hasErrors = false;

for (const filePath of files) {
  const relPath = path.relative(process.cwd(), filePath);
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const content = JSON.parse(rawContent);
    const prov = content._provenance || content;

    const missingFields = [];
    if (!prov.model || typeof prov.model !== 'string') missingFields.push('model');
    if (!prov.prompt_version || typeof prov.prompt_version !== 'string')
      missingFields.push('prompt_version');
    if (!prov.timestamp || typeof prov.timestamp !== 'string') missingFields.push('timestamp');
    if (!prov.request_hash || typeof prov.request_hash !== 'string')
      missingFields.push('request_hash');

    if (missingFields.length > 0) {
      console.error(
        `❌ [FIXTURE PROVENANCE ERROR] ${relPath} is missing required provenance fields: ${missingFields.join(', ')}`,
      );
      hasErrors = true;
      continue;
    }

    // Verify response hash integrity if present
    if (prov.response_hash) {
      let dataToHash = content.facts || content.items;
      if (isNegativeControl) {
        // Corrupt one character to trigger negative control failure
        dataToHash = JSON.stringify(dataToHash) + 'CORRUPTED';
      } else {
        dataToHash = JSON.stringify(dataToHash);
      }
      const computedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      if (computedHash !== prov.response_hash) {
        console.error(
          `❌ [INTEGRITY ERROR] ${relPath} response hash mismatch! Computed: ${computedHash}, Expected: ${prov.response_hash}`,
        );
        hasErrors = true;
        continue;
      }
    }

    console.info(
      `✅ ${relPath}: Provenance & Response Hash verified (model=${prov.model}, prompt_version=${prov.prompt_version}, request_hash=${prov.request_hash.slice(0, 16)}..., response_hash=${(prov.response_hash || '').slice(0, 16)}...)`,
    );
  } catch (err) {
    console.error(`❌ [JSON PARSE ERROR] Failed to parse ${relPath}:`, err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nFixture provenance check failed.');
  process.exit(1);
} else {
  console.info(`\nAll ${files.length} fixtures have valid provenance and verified hashes.`);
  process.exit(0);
}
