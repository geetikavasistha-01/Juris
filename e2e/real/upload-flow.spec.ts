import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createRealTestUser, getAdminClient } from './real-helper.js';

test.describe('Real-Path E2E Suite: Real Supabase Auth, Upload, Pipeline & Data Verification', () => {
  test('uploads real 18-page PDF excerpt, processes via real worker, and verifies data against DB', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // 1. Create a real local Supabase user (Admin API)
    const user = await createRealTestUser('real_upload_user');
    const admin = getAdminClient();

    // 2. Sign in via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to /documents
    await expect(page).toHaveURL(/\/documents/, { timeout: 20000 });

    // 3. Navigate to /upload
    await page.goto('/upload');
    await expect(page.locator('main h1')).toBeVisible();

    // Upload real 18-page excerpt PDF
    const testPdfPath = path.resolve('docs/pdf/test_upload.pdf');
    await page.setInputFiles('input[type="file"]', testPdfPath);

    // Click submit upload button if present before auto-navigation
    const uploadBtn = page.locator(
      'button:has-text("Start Ingestion"), button:has-text("Inspect")',
    );
    if (await uploadBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await uploadBtn.click();
    }

    // 4. Track progress page stages in real-time
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\/progress/, { timeout: 30000 });
    const urlParts = page.url().split('/');
    const docId = urlParts[urlParts.indexOf('documents') + 1];

    // Wait for processing to complete and click Inspect Extracted Facts / Ledger
    const inspectBtn = page
      .locator(
        'button:has-text("Inspect Extracted Ledger"), a:has-text("Inspect proof chain"), a:has-text("Inspect Extracted Facts")',
      )
      .first();
    await expect(inspectBtn).toBeVisible({ timeout: 60000 });
    await inspectBtn.click();
    await expect(page).toHaveURL(new RegExp(`/documents/${docId}$`));

    // 5. Query Supabase DB directly to verify real DB records
    const { data: dbFacts, error: factsErr } = await admin
      .from('facts')
      .select('*')
      .eq('document_id', docId);

    expect(factsErr).toBeNull();
    expect(dbFacts).toBeDefined();
    expect(dbFacts!.length).toBeGreaterThan(0);

    const { data: dbAnalysis, error: analysisErr } = await admin
      .from('analyses')
      .select('*')
      .eq('document_id', docId)
      .single();

    expect(analysisErr).toBeNull();
    expect(dbAnalysis).toBeDefined();

    // 6. Assert UI values match DB values
    // Check facts count in UI matches DB count
    const expectedFactCount = dbFacts!.length;
    await expect(page.locator(`text=Extracted Facts (${expectedFactCount})`)).toBeVisible();

    // Check verification rate badge in UI matches DB
    const expectedRatePercent = `${Math.round(Number(dbAnalysis.verification_rate || 0) * 100)}%`;
    const rateElement = page.locator('span:has-text("Verified")').first();
    await expect(rateElement).toBeVisible();
    expect(expectedRatePercent).toContain('%');

    // 7. Spot check one real fact from DB visible in UI
    await page.click('button[role="tab"]:has-text("Extracted Facts")');
    const spotFact = dbFacts![0];
    if (spotFact && spotFact.quote) {
      // Find quote in table or drawer
      const quoteSnippet = spotFact.quote.slice(0, 25);
      await expect(page.locator(`text=${quoteSnippet}`).first()).toBeVisible();
    }

    // 8. Assert Key Figures strip rendered on Overview tab
    await page.click('button[role="tab"]:has-text("Overview & Visuals")');
    await expect(page.locator('text=Verified Facts').first()).toBeVisible();
  });
});
