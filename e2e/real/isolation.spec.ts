import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createRealTestUser, loginTestUser } from './real-helper.js';

test.describe('Real-Path E2E Suite: Cross-Tenant Isolation (AUTH-01, API-01)', () => {
  test('user B cannot open user A document URL or access private data', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);

    // 1. Create User A and User B
    const userA = await createRealTestUser('user_a_isolation');
    const userB = await createRealTestUser('user_b_isolation');

    // 2. Context A: User A logs in and uploads document
    await loginTestUser(page, userA);

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

    const docAUrl = page.url();
    const docAId = docAUrl.split('/').pop();

    // 3. Context B: User B in a separate browser context logs in
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await loginTestUser(pageB, userB);

    // User B's documents list should NOT contain User A's document
    await expect(pageB.locator(`a[href="/documents/${docAId}"]`)).toHaveCount(0);

    // 4. User B directly navigates to User A's document URL
    await pageB.goto(`/documents/${docAId}`);

    // Expect Document Not Found error state
    await expect(pageB.locator('text=Document Not Found')).toBeVisible({ timeout: 15000 });

    await contextB.close();
  });
});
