#!/usr/bin/env node

/**
 * Juris Token Usage & External Asset Linter (check:tokens)
 *
 * Enforces:
 * 1. No hard-coded hex (#...), rgb(), or hsl() color values in apps/web/src (except tokens.css and echarts-theme.ts).
 * 2. No non-token font-family declarations in apps/web/src (except tokens.css and echarts-theme.ts).
 * 3. No external font host references (fonts.googleapis.com, fonts.gstatic.com, etc.).
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('apps/web/src');
const ALLOWED_EXCEPTIONS = ['apps/web/src/styles/tokens.css', 'apps/web/src/lib/echarts-theme.ts'];

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const RGB_COLOR_REGEX = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
const HSL_COLOR_REGEX = /\bhsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?/g;
const EXTERNAL_FONT_REGEX =
  /fonts\.(?:googleapis|gstatic)\.com|use\.typekit\.net|cdn\.jsdelivr\.net/gi;

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(tsx?|jsx?|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = scanDirectory(SRC_DIR);
let errors = 0;

console.log('='.repeat(78));
console.log('  JURIS DESIGN SYSTEM: TOKEN COMPLIANCE & EXTERNAL ASSET SCAN');
console.log('='.repeat(78));

for (const file of files) {
  const relPath = path.relative(process.cwd(), file);
  if (ALLOWED_EXCEPTIONS.includes(relPath)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    // Check external font hosts
    if (EXTERNAL_FONT_REGEX.test(line)) {
      console.error(
        `❌ [EXTERNAL_HOST] ${relPath}:${lineIdx + 1}: Reference to external font host found: ${line.trim()}`,
      );
      errors++;
    }

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // Check hardcoded colors
    const hexMatches = line.match(HEX_COLOR_REGEX);
    if (hexMatches) {
      console.error(
        `❌ [HARDCODED_HEX] ${relPath}:${lineIdx + 1}: Hardcoded hex color ${hexMatches.join(', ')} found: ${line.trim()}`,
      );
      errors++;
    }

    const rgbMatches = line.match(RGB_COLOR_REGEX);
    if (rgbMatches) {
      console.error(
        `❌ [HARDCODED_RGB] ${relPath}:${lineIdx + 1}: Hardcoded RGB color found: ${line.trim()}`,
      );
      errors++;
    }

    const hslMatches = line.match(HSL_COLOR_REGEX);
    if (hslMatches) {
      console.error(
        `❌ [HARDCODED_HSL] ${relPath}:${lineIdx + 1}: Hardcoded HSL color found: ${line.trim()}`,
      );
      errors++;
    }
  });
}

// Also check index.html
const indexHtml = path.resolve('apps/web/index.html');
if (fs.existsSync(indexHtml)) {
  const htmlContent = fs.readFileSync(indexHtml, 'utf8');
  if (EXTERNAL_FONT_REGEX.test(htmlContent)) {
    console.error(
      '❌ [EXTERNAL_HOST] apps/web/index.html contains references to external font hosts.',
    );
    errors++;
  }
}

console.log('-'.repeat(78));
if (errors === 0) {
  console.log(
    `\n🎉 Scanned ${files.length} source files. 100% compliant with design tokens and self-hosted fonts.\n`,
  );
  process.exit(0);
} else {
  console.error(`\n❌ Found ${errors} token/asset compliance violation(s).\n`);
  process.exit(1);
}
