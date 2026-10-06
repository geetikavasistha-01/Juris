import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const SCREENSHOT_DIR = path.resolve('docs/evidence/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log('Starting dev server for design system screenshots...');
  const server = spawn('npx', ['vite', 'dev', '--port', '4173'], {
    cwd: path.resolve('apps/web'),
    stdio: 'pipe',
  });

  // Wait 2s for server
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const browser = await chromium.launch();
  try {
    // 1. Desktop Light (1280x900)
    const contextDesktop = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
    });
    const pageDesktop = await contextDesktop.newPage();
    await pageDesktop.goto('http://localhost:4173/design', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(500);

    const lightDesktopPath = path.join(SCREENSHOT_DIR, 'design-desktop-light.png');
    await pageDesktop.screenshot({ path: lightDesktopPath, fullPage: true });
    console.log(`Saved: ${lightDesktopPath}`);

    // 2. Desktop Dark (1280x900)
    await pageDesktop.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await pageDesktop.waitForTimeout(500);
    const darkDesktopPath = path.join(SCREENSHOT_DIR, 'design-desktop-dark.png');
    await pageDesktop.screenshot({ path: darkDesktopPath, fullPage: true });
    console.log(`Saved: ${darkDesktopPath}`);

    // 3. Mobile Light (390x844)
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
      isMobile: true,
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto('http://localhost:4173/design', { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(500);
    const lightMobilePath = path.join(SCREENSHOT_DIR, 'design-mobile-light.png');
    await pageMobile.screenshot({ path: lightMobilePath, fullPage: true });
    console.log(`Saved: ${lightMobilePath}`);

    // 4. Mobile Dark (390x844)
    await pageMobile.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await pageMobile.waitForTimeout(500);
    const darkMobilePath = path.join(SCREENSHOT_DIR, 'design-mobile-dark.png');
    await pageMobile.screenshot({ path: darkMobilePath, fullPage: true });
    console.log(`Saved: ${darkMobilePath}`);

    // 5. Grayscale Proof for Verification Badges (Desktop)
    await pageDesktop.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.style.filter = 'grayscale(100%)';
    });
    await pageDesktop.waitForTimeout(500);
    const grayscalePath = path.join(SCREENSHOT_DIR, 'design-grayscale-badges.png');
    await pageDesktop.screenshot({ path: grayscalePath, fullPage: true });
    console.log(`Saved: ${grayscalePath}`);
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
