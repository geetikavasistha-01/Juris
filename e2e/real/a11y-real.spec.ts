import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import * as path from 'node:path';
import { createRealTestUser, loginTestUser } from './real-helper.js';

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 667 },
];

const themes = ['light', 'dark'] as const;

test.describe('Real-Path E2E Suite: Accessibility (Axe Core WCAG 2.1 AA)', () => {
  test.describe.configure({ mode: 'serial', timeout: 60000 });
  let docId: string;
  let testUser: { email: string; password: string };

  test('0. Setup real user and document for a11y scans', async ({ page }) => {
    test.setTimeout(120000);
    testUser = await createRealTestUser('a11y_real_user');

    // Sign in and upload real 18-page excerpt to populate DB
    await loginTestUser(page, testUser);

    await page.goto('/upload');
    const testPdfPath = path.resolve('docs/pdf/test_upload.pdf');
    await page.setInputFiles('input[type="file"]', testPdfPath);

    const uploadBtn = page.locator(
      'button:has-text("Start Ingestion"), button:has-text("Inspect")',
    );
    if (await uploadBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await uploadBtn.click();
    }

    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\/progress/, { timeout: 30000 });

    const inspectBtn = page.locator(
      'button:has-text("Inspect Extracted Ledger"), a:has-text("Inspect proof chain"), a:has-text("Inspect Extracted Facts")',
    );
    await expect(inspectBtn).toBeVisible({ timeout: 60000 });
    await inspectBtn.click();
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);

    docId = page.url().split('/').pop()!;
  });

  for (const vp of viewports) {
    for (const theme of themes) {
      test(`Axe scan: Real Populated /documents (${vp.name} - ${theme})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginTestUser(page, testUser);

        // Apply theme
        if (theme === 'dark') {
          await page.evaluate(() => {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          });
        }
        await page.waitForTimeout(250);

        // Wait for list items to render
        await page.waitForSelector('main a[href*="/documents/"]');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });

      test(`Axe scan: Real /documents/:id Facts Tab (${vp.name} - ${theme})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginTestUser(page, testUser);

        await page.goto(`/documents/${docId}`);
        const factsTab = page.locator('button[role="tab"]:has-text("Extracted Facts")');
        await expect(factsTab).toBeVisible({ timeout: 15000 });
        await factsTab.click();
        await page.waitForSelector('div[role="button"][aria-label*="Inspect citation"]');

        if (theme === 'dark') {
          await page.evaluate(() => {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          });
        }
        await page.waitForTimeout(250);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });

      test(`Axe scan: Real /documents/:id Visuals Tab with Data Table (${vp.name} - ${theme})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginTestUser(page, testUser);

        await page.goto(`/documents/${docId}`);
        const visualsTab = page.locator('button[role="tab"]:has-text("Overview & Visuals")');
        await expect(visualsTab).toBeVisible({ timeout: 15000 });
        await visualsTab.click();
        await page.waitForSelector('text=Document at a Glance');

        // Click Accessible Tables toggle button if present
        const tableToggle = page.locator('button:has-text("Data Table")').first();
        if ((await tableToggle.count()) > 0) {
          await tableToggle.click();
          await page.waitForSelector('table');
        }

        if (theme === 'dark') {
          await page.evaluate(() => {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          });
        }
        await page.waitForTimeout(250);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  }
});
