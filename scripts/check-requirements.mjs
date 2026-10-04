#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

const REQ_FILE = path.resolve(process.cwd(), 'requirements.yaml');

if (!fs.existsSync(REQ_FILE)) {
  console.error(`❌ Missing requirements file at ${REQ_FILE}`);
  process.exit(1);
}

let doc;
try {
  const content = fs.readFileSync(REQ_FILE, 'utf-8');
  doc = yaml.load(content);
} catch (err) {
  console.error(`❌ Failed to parse requirements.yaml:`, err);
  process.exit(1);
}

const requirements = doc?.requirements || [];
if (!Array.isArray(requirements) || requirements.length === 0) {
  console.error('❌ requirements.yaml must define a non-empty "requirements" list.');
  process.exit(1);
}

const implementedWithoutTests = [];
const p0WithoutTests = [];

for (const req of requirements) {
  const tests = Array.isArray(req.tests) ? req.tests : [];
  const existingTests = tests.filter((testPath) => {
    const fullPath = path.resolve(process.cwd(), testPath);
    return fs.existsSync(fullPath);
  });

  const isImplemented = req.status === 'implemented';
  const hasValidTests = existingTests.length > 0;

  if (isImplemented && !hasValidTests) {
    implementedWithoutTests.push({
      id: req.id,
      priority: req.priority,
      title: req.title,
      tests: tests,
    });
  }

  if (req.priority === 'P0' && !hasValidTests) {
    p0WithoutTests.push({
      id: req.id,
      status: req.status || 'not_started',
      title: (req.title || '').slice(0, 50) + ((req.title || '').length > 50 ? '...' : ''),
    });
  }
}

// Print table of P0 requirements still without tests (warning for now)
if (p0WithoutTests.length > 0) {
  console.warn('\n⚠️  WARNING: P0 requirements currently without tests:');
  console.table(p0WithoutTests);
  console.warn(`Total P0 requirements pending test implementation: ${p0WithoutTests.length}\n`);
}

// Fail if any requirement marked "implemented" has no valid existing test files
if (implementedWithoutTests.length > 0) {
  console.error('\n❌ VIOLATION: The following implemented requirements lack existing test files:');
  for (const item of implementedWithoutTests) {
    console.error(`  - [${item.priority}] ${item.id}: "${item.title}"`);
    console.error(`    Declared tests: ${JSON.stringify(item.tests)}`);
  }
  console.error(
    '\nEvery requirement with status "implemented" MUST reference at least one existing test file.\n',
  );
  process.exit(1);
}

console.log(`✅ check-requirements: All ${requirements.length} requirements validated.`);
process.exit(0);
