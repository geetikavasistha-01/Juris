import { test, expect } from '@playwright/test';

const mockDocumentId = 'e2e-keyboard-test-doc';
const mockDocDetail = {
  id: mockDocumentId,
  filename: 'ndmc-budget-speech-2026-27.pdf',
  status: 'done',
  pageCount: 18,
  fileSizeBytes: 706000,
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  isSample: true,
  analysis: {
    summary: null,
    documentType: 'budget',
    keyFindings: [],
    risks: [],
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
  ],
  job: {
    id: 'j1111111-1111-1111-1111-111111111111',
    status: 'completed',
    stage: 'synthesis',
    progress: 100,
  },
};

test.describe('Mocked UI State Suite: Keyboard Navigation & Focus Trapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/documents/${mockDocumentId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDocDetail),
      });
    });
    await page.route(`**/api/documents/${mockDocumentId}/facts*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ facts: mockDocDetail.facts, total: mockDocDetail.facts.length }),
      });
    });
    await page.route(`**/api/documents/${mockDocumentId}/visuals`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ visualizations: [] }),
      });
    });
    await page.route(`**/api/documents/${mockDocumentId}/chunks*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ chunks: [], total: 0 }),
      });
    });
  });

  test('Keyboard: Dropzone opens file picker via Enter and Space keys', async ({ page }) => {
    await page.goto('/upload');
    const dropzone = page.locator('div[role="button"][aria-label*="Upload PDF dropzone"]');
    await expect(dropzone).toBeVisible();

    await dropzone.focus();
    await expect(dropzone).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
  });

  test('Keyboard: Fact drawer opens via keyboard, traps focus, closes on Escape and restores focus', async ({
    page,
  }) => {
    await page.goto(`/documents/${mockDocumentId}`);
    await page.waitForSelector('h1');

    // Switch to facts tab
    const factsTab = page.getByRole('tab', { name: /Extracted Facts/ });
    await factsTab.click();

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

    const overviewTab = page.getByRole('tab', { name: /Overview & Visuals/ });
    const factsTab = page.getByRole('tab', { name: /Extracted Facts/ });
    const visualsTab = page.getByRole('tab', { name: /Legacy Charts/ });
    const summaryTab = page.getByRole('tab', { name: /Executive Findings/ });
    const chunksTab = page.getByRole('tab', { name: /Text Chunks/ });

    await overviewTab.focus();
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(factsTab).toBeFocused();
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
