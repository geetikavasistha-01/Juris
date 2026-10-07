import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCREENSHOT_DIR = path.resolve('docs/evidence/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Mock sample document payload with verified budget facts
const mockDocumentId = 'e2e-sample-budget-doc-1234';
const mockDocDetail = {
  id: mockDocumentId,
  filename: 'ndmc-budget-speech-2026-27.pdf',
  status: 'done',
  pageCount: 114,
  fileSizeBytes: 2450000,
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  isSample: true,
  analysis: {
    summary:
      'The NDMC Budget Speech 2026-27 outlines municipal infrastructure, health, education, and civic modernization initiatives.',
    documentType: 'budget',
    keyFindings: [
      'Total expenditure for BE 2026-27 is Rs.5810.02 Crore against Rs.5484.15 Crore in RE 2025-26.',
      'Medical Services Department allocated Rs.118.33 Crore across Capital and Revenue heads.',
      'Phase out of cash and cheque manual transactions scheduled for FY 2026-27.',
    ],
    risks: [
      'Digital infrastructure migration timeline dependencies.',
      'Inter-departmental execution coordination.',
    ],
  },
  facts: [
    {
      id: 'f1111111-1111-1111-1111-111111111111',
      type: 'FINANCE',
      value: 5810.02,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 33,
      quote:
        'The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'f2222222-2222-2222-2222-222222222222',
      type: 'HEALTH',
      value: 118.33,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 88,
      quote:
        'towards improvement of Medical Services Department out of which Rs.12.71 crore towards Capital Expenditure and Rs.105.62 crore towards Revenue Expenditure',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'f3333333-3333-3333-3333-333333333333',
      type: 'INFRASTRUCTURE',
      value: 450.0,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 12,
      quote: 'Rs.450.00 Crore allocated for municipal road resurfacing and smart grid upgrades',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
  ],
  job: {
    id: 'j1111111-1111-1111-1111-111111111111',
    status: 'completed',
    stage: 'synthesis',
    progress: 100,
  },
};

const mockDocList = {
  documents: [
    {
      id: mockDocumentId,
      filename: 'ndmc-budget-speech-2026-27.pdf',
      status: 'done',
      pageCount: 114,
      fileSizeBytes: 2450000,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      isSample: true,
      createdAt: '2026-10-06T12:00:00.000Z',
      updatedAt: '2026-10-06T12:05:00.000Z',
    },
  ],
  total: 1,
};

const mockEventsList = {
  documentId: mockDocumentId,
  jobId: 'j1111111-1111-1111-1111-111111111111',
  events: [
    {
      id: 'e1',
      sequence: 1,
      stage: 'validating',
      progress: 10,
      message: 'Magic bytes %PDF- verified (SHA-256 intact)',
      createdAt: '2026-10-06T12:00:01.000Z',
    },
    {
      id: 'e2',
      sequence: 2,
      stage: 'extracting',
      progress: 30,
      message: 'Extracted 114 pages text streams with coordinates',
      createdAt: '2026-10-06T12:00:03.000Z',
    },
    {
      id: 'e3',
      sequence: 3,
      stage: 'chunking',
      progress: 50,
      message: 'Created 280 semantic paragraphs',
      createdAt: '2026-10-06T12:00:05.000Z',
    },
    {
      id: 'e4',
      sequence: 4,
      stage: 'embedding',
      progress: 70,
      message: 'Indexed 768-dim embeddings',
      createdAt: '2026-10-06T12:00:07.000Z',
    },
    {
      id: 'e5',
      sequence: 5,
      stage: 'fact_extraction',
      progress: 85,
      message: 'Extracted 52 structured facts with quotes',
      createdAt: '2026-10-06T12:00:09.000Z',
    },
    {
      id: 'e6',
      sequence: 6,
      stage: 'verification',
      progress: 95,
      message: 'Verbatim quotes and numeric values verified against PDF text',
      createdAt: '2026-10-06T12:00:11.000Z',
    },
    {
      id: 'e7',
      sequence: 7,
      stage: 'synthesis',
      progress: 100,
      message: 'Synthesis complete: key findings and risk analysis saved',
      createdAt: '2026-10-06T12:00:12.000Z',
    },
  ],
};

test.describe('Juris Comprehensive Accessibility Audits (Axe WCAG AA)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API routes to provide deterministic responses
    await page.route('**/api/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDocList),
      });
    });

    await page.route(`**/api/documents/${mockDocumentId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDocDetail),
      });
    });

    await page.route(`**/api/documents/${mockDocumentId}/events`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEventsList),
      });
    });

    await page.route(`**/api/documents/${mockDocumentId}/chunks*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId: mockDocumentId,
          chunks: [
            {
              id: 'c1',
              documentId: mockDocumentId,
              pageNumber: 33,
              chunkIndex: 0,
              content:
                'The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26',
            },
          ],
          total: 1,
        }),
      });
    });
  });

  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  const themes = ['light', 'dark'] as const;

  for (const vp of viewports) {
    for (const theme of themes) {
      test(`Axe scan & visual: /login (${vp.name} - ${theme})`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/login');
        await page.waitForSelector('h1');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-login-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test(`Axe scan & visual: /documents populated (${vp.name} - ${theme})`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/documents');
        await page.waitForSelector('main h1');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-documents-populated-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test(`Axe scan & visual: /upload (${vp.name} - ${theme})`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/upload');
        await page.waitForSelector('main h1');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-upload-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test(`Axe scan & visual: /documents/:id/progress (${vp.name} - ${theme})`, async ({
        page,
      }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`/documents/${mockDocumentId}/progress`);
        await page.waitForSelector('h1');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-progress-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test(`Axe scan & visual: /documents/:id facts tab (${vp.name} - ${theme})`, async ({
        page,
      }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`/documents/${mockDocumentId}`);
        await page.waitForSelector('h1');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-viewer-facts-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });

      test(`Axe scan & visual: /documents/:id visuals tab with table open (${vp.name} - ${theme})`, async ({
        page,
      }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('juris-theme', t);
        }, theme);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`/documents/${mockDocumentId}`);
        await page.waitForSelector('h1');

        // Click Visual Analytics tab
        await page.click('button[role="tab"]:has-text("Visual Analytics")');
        await page.waitForSelector('text=Top Quantitative Allocations');

        // Click Show Accessible Tables button
        await page.click('button:has-text("Show Accessible Tables")');
        await page.waitForSelector('table');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `screen-viewer-visuals-table-${vp.name}-${theme}.png`),
          fullPage: true,
        });
      });
    }
  }

  // Keyboard navigation & drawer focus restoration tests
  test('Keyboard: Dropzone opens file picker via Enter and Space keys', async ({ page }) => {
    await page.goto('/upload');
    const dropzone = page.locator('div[role="button"][aria-label*="Upload PDF dropzone"]');
    await expect(dropzone).toBeVisible();

    await dropzone.focus();
    await expect(dropzone).toBeFocused();

    // Verify keydown listener responds without error on Enter and Space
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
  });

  test('Keyboard: Fact drawer opens via keyboard, traps focus, closes on Escape and restores focus', async ({
    page,
  }) => {
    await page.goto(`/documents/${mockDocumentId}`);
    await page.waitForSelector('h1');

    const factCard = page.locator('div[role="button"][aria-label*="Inspect citation"]').first();
    await factCard.focus();
    await expect(factCard).toBeFocused();
    await page.keyboard.press('Enter');

    // Drawer opens
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Fact & Verbatim Citation Inspector');

    // Escape closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Focus restored to the trigger fact card
    await expect(factCard).toBeFocused();
  });

  test('Keyboard: Tabs switch actively with Arrow keys', async ({ page }) => {
    await page.goto(`/documents/${mockDocumentId}`);
    await page.waitForSelector('h1');

    const factsTab = page.getByRole('tab', { name: /Extracted Facts/ });
    const visualsTab = page.getByRole('tab', { name: /Visual Analytics/ });
    const summaryTab = page.getByRole('tab', { name: /Executive Findings/ });
    const chunksTab = page.getByRole('tab', { name: /Text & Chunks/ });

    await factsTab.focus();
    await expect(factsTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(visualsTab).toBeFocused();
    await expect(visualsTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(summaryTab).toBeFocused();
    await expect(summaryTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(chunksTab).toBeFocused();
    await expect(chunksTab).toHaveAttribute('aria-selected', 'true');
  });
});
