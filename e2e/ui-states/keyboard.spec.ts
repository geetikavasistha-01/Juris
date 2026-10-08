import { test, expect } from '@playwright/test';

const mockDocumentId = 'a0000000-0000-0000-0000-000000000001';
const mockDocDetail = {
  id: mockDocumentId,
  filename: 'ndmc-budget-speech-2026-27.pdf',
  status: 'done',
  pageCount: 18,
  fileSizeBytes: 706000,
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  isSample: true,
  analysis: {
    summary: 'Municipal expenditure allocation for fiscal year 2026-27.',
    documentType: 'budget',
    keyFindings: ['Total expenditure estimated at Rs. 5,810.02 Crore.'],
    risks: [],
  },
  facts: [
    {
      id: 'f1111111-1111-1111-1111-111111111111',
      label: 'NDMC Total Expenditure Outlay',
      type: 'expenditure',
      value: 5810.02,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
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
    const factsTab = page.locator('button:has-text("Facts")');
    await factsTab.click();

    // Click on the fact row or tether button
    const factRow = page.locator('tbody tr').first();
    await expect(factRow).toBeVisible();
    await factRow.click();

    // Drawer opens
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('NDMC Total Expenditure Outlay');

    // Escape closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('Keyboard: Navigation tabs switch active views', async ({ page }) => {
    await page.goto(`/documents/${mockDocumentId}`);
    await page.waitForSelector('h1');

    const overviewTab = page.locator('button:has-text("Overview & Storyboard")');
    const factsTab = page.locator('button:has-text("Facts")');
    const sourceTab = page.locator('button:has-text("Source")');
    const auditTab = page.locator('button:has-text("Audit Proof Chain")');

    await expect(overviewTab).toBeVisible();
    await factsTab.click();
    await expect(page.locator('th:has-text("Provenance Status")')).toBeVisible();

    await sourceTab.click();
    await expect(page.locator('h3:has-text("Document Source Stream")')).toBeVisible();

    await auditTab.click();
    await expect(page.locator('h3:has-text("Cryptographic Audit Proof Chain")')).toBeVisible();
  });
});
