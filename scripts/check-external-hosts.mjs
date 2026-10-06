#!/usr/bin/env node

/**
 * External Host Guard for Juris Production Build
 *
 * Scans `apps/web/dist` (.html, .css, .js) for:
 * 1. fonts.googleapis.com / fonts.gstatic.com (strict ban on external font CDNs)
 * 2. Any http:// or https:// URLs not on the explicit domain allowlist.
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('apps/web/dist');

// Explicitly allowed hostnames / namespaces
const ALLOWED_HOSTS = new Set([
  'www.w3.org', // XML namespaces in SVGs (http://www.w3.org/2000/svg)
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'react.dev', // React error message URL decoder links in react-dom bundle
  'reactjs.org',
  'tailwindcss.com', // Tailwind CSS header comment
]);

// Read additional allowed hosts from environment if configured
if (process.env.VITE_SUPABASE_URL) {
  try {
    const url = new URL(process.env.VITE_SUPABASE_URL);
    ALLOWED_HOSTS.add(url.hostname);
  } catch {
    // ignore invalid URL format in env
  }
}
if (process.env.SUPABASE_URL) {
  try {
    const url = new URL(process.env.SUPABASE_URL);
    ALLOWED_HOSTS.add(url.hostname);
  } catch {
    // ignore invalid URL format in env
  }
}

export function checkExternalHosts(distPath = DIST_DIR) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Dist directory not found at ${distPath}. Run "pnpm --filter @juris/web build" first.`,
    );
  }

  const filesToScan = [];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(html|css|js)$/i.test(entry.name)) {
        filesToScan.push(fullPath);
      }
    }
  }
  scanDir(distPath);

  const violations = [];

  // Match URLs starting with http:// or https://
  const urlRegex = /https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^\s"')`<>}\]]*)?/g;

  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(process.cwd(), file);

    // 1. Strict check for Google fonts
    if (content.includes('fonts.googleapis.com') || content.includes('fonts.gstatic.com')) {
      violations.push({
        file: relativePath,
        reason:
          'External Google Fonts CDN reference detected (all fonts must be self-hosted woff2)',
        match: 'fonts.googleapis.com / fonts.gstatic.com',
      });
    }

    // 2. Scan all HTTP/HTTPS URLs
    const matches = content.match(urlRegex) || [];
    for (const match of matches) {
      try {
        const parsed = new URL(match);
        const hostname = parsed.hostname;

        if (!ALLOWED_HOSTS.has(hostname)) {
          violations.push({
            file: relativePath,
            reason: `Unauthorized external host: "${hostname}" (full url: ${match})`,
            match,
          });
        }
      } catch {
        // Ignore unparseable fragments
      }
    }
  }

  return { scannedCount: filesToScan.length, violations };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('check-external-hosts.mjs')) {
  try {
    const { scannedCount, violations } = checkExternalHosts();

    console.log('='.repeat(78));
    console.log('  JURIS EXTERNAL HOST GUARD REPORT');
    console.log('='.repeat(78));
    console.log(`Scanned ${scannedCount} files in apps/web/dist\n`);

    if (violations.length > 0) {
      console.error(`❌ Found ${violations.length} external host violation(s):`);
      for (const v of violations) {
        console.error(`  - [${v.file}] ${v.reason}`);
      }
      console.error('\nBuild contains unauthorized external dependencies. Exiting.\n');
      process.exit(1);
    } else {
      console.log('✅ PASS: Zero unauthorized external hosts or Google font CDN links found.');
      console.log('All typography and assets are 100% self-hosted.\n');
      process.exit(0);
    }
  } catch (err) {
    console.error(`❌ Error running external host check: ${err.message}`);
    process.exit(1);
  }
}
