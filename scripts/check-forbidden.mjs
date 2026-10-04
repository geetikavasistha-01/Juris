#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FORBIDDEN_PATTERNS = [
  { term: 'simulate', regex: /\bsimulate\b/i },
  { term: 'simulated', regex: /\bsimulated\b/i },
  { term: 'mock', regex: /\bmock\b/i },
  { term: 'fake', regex: /\bfake\b/i },
  { term: 'dummy', regex: /\bdummy\b/i },
  { term: 'lorem ipsum', regex: /\blorem\s+ipsum\b/i },
];

const ALLOWLIST_PATH = path.resolve(process.cwd(), 'scripts/forbidden-allowlist.json');

let allowlist = [];
if (fs.existsSync(ALLOWLIST_PATH)) {
  try {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8'));
    allowlist = raw.allowed || [];
  } catch (err) {
    console.error(`Failed to parse allowlist at ${ALLOWLIST_PATH}:`, err);
    process.exit(1);
  }
}

function isAllowlisted(relPath, lineNum, term) {
  return allowlist.some((item) => {
    const pathMatch = item.file === relPath || relPath.endsWith(item.file);
    const lineMatch = !item.line || item.line === lineNum;
    const termMatch = !item.term || item.term.toLowerCase() === term.toLowerCase();
    return pathMatch && lineMatch && termMatch;
  });
}

function isTestOrFixture(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/fixtures/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.')
  );
}

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'build') {
        scanDir(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name) && !isTestOrFixture(fullPath)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const targetRoots = ['apps', 'packages'];
const filesToScan = [];

for (const root of targetRoots) {
  const rootPath = path.resolve(process.cwd(), root);
  if (!fs.existsSync(rootPath)) continue;
  const subdirs = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const sub of subdirs) {
    if (sub.isDirectory()) {
      const srcDir = path.join(rootPath, sub.name, 'src');
      if (fs.existsSync(srcDir)) {
        scanDir(srcDir, filesToScan);
      }
    }
  }
}

const violations = [];

for (const filePath of filesToScan) {
  const relPath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    for (const { term, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(line)) {
        if (!isAllowlisted(relPath, lineNum, term)) {
          violations.push({
            file: relPath,
            line: lineNum,
            term,
            snippet: line.trim(),
          });
        }
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n❌ FORBIDDEN WORDS DETECTED IN PRODUCT CODE:');
  console.error(
    'The PRD strictly forbids simulate, simulated, mock, fake, dummy, or lorem ipsum in product code.\n',
  );
  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line} -> Found "${v.term}": "${v.snippet}"`);
  });
  console.error(`\nTotal violations: ${violations.length}`);
  console.error(
    'If this is a legitimate non-product usage, document it in scripts/forbidden-allowlist.json with rationale.\n',
  );
  process.exit(1);
} else {
  console.log(
    `✅ check-forbidden: Scanned ${filesToScan.length} product source files. Zero forbidden terms found.`,
  );
  process.exit(0);
}
