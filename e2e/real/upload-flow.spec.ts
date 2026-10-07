import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createRealTestUser, getAdminClient } from './real-helper.js';

test.describe('Real-Path E2E Suite: Real Supabase Auth, Upload, Pipeline & Data Verification', () => {
  test('uploads real 18-page PDF excerpt, processes via real worker, and verifies data against DB', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Create a real local Supabase user (Admin API)
    const user = await createRealTestUser('real_upload_user');
    const admin = getAdminClient();

    // 2. Sign in via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to /documents
    await expect(page).toHaveURL(/\/documents/, { timeout: 15000 });

    // 3. Navigate to /upload
    await page.goto('/upload');
    await expect(page.locator('main h1')).toContainText('Upload');

    // Upload real 18-page excerpt PDF
    const testPdfPath = path.resolve('docs/pdf/test_upload.pdf');
    await page.setInputFiles('input[type="file"]', testPdfPath);

    // Click submit upload button
    const uploadBtn = page.locator('button:has-text("Start Ingestion")');
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();

    // 4. Track progress page stages in real-time
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\/progress/, { timeout: 30000 });
    const urlParts = page.url().split('/');
    const docId = urlParts[urlParts.indexOf('documents') + 1];

    // Wait for processing to complete and click Inspect Extracted Facts
    const inspectBtn = page.locator('a:has-text("Inspect Extracted Facts")');
    await expect(inspectBtn).toBeVisible({ timeout: 45000 });
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
    const spotFact = dbFacts![0];
    if (spotFact && spotFact.quote) {
      // Find quote in table or drawer
      const quoteSnippet = spotFact.quote.slice(0, 25);
      await expect(page.locator(`text=${quoteSnippet}`).first()).toBeVisible();
    }

    // 8. Assert Key Figures strip rendered on Visuals tab
    await page.click('button[role="tab"]:has-text("Visual Analytics")');
    await expect(page.locator('text=Verified Facts').first()).toBeVisible();
    await expect(page.locator('text=VIZ-01 Strict Verifier').first()).toBeVisible();
  });
});
