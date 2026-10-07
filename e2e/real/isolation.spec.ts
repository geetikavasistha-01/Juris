import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createRealTestUser } from './real-helper.js';

test.describe('Real-Path E2E Suite: Cross-Tenant Isolation (AUTH-01, API-01)', () => {
  test('user B cannot open user A document URL or access private data', async ({
    page,
    browser,
  }) => {
    // 1. Create User A and User B
    const userA = await createRealTestUser('user_a_isolation');
    const userB = await createRealTestUser('user_b_isolation');

    // 2. Context A: User A logs in and uploads document
    await page.goto('/login');
    await page.fill('input[type="email"]', userA.email);
    await page.fill('input[type="password"]', userA.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/documents/, { timeout: 15000 });

    test.setTimeout(90000);

    await page.goto('/upload');
    const testPdfPath = path.resolve('docs/pdf/test_upload.pdf');
    await page.setInputFiles('input[type="file"]', testPdfPath);

    const uploadBtn = page.locator('button:has-text("Start Ingestion")');
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\/progress/, { timeout: 15000 });

    const inspectBtn = page.locator('a:has-text("Inspect Extracted Facts")');
    await expect(inspectBtn).toBeVisible({ timeout: 45000 });
    await inspectBtn.click();
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);

    const docAUrl = page.url();
    const docAId = docAUrl.split('/').pop();

    // 3. Context B: User B in a separate browser context logs in
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto('/login');
    await pageB.fill('input[type="email"]', userB.email);
    await pageB.fill('input[type="password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await expect(pageB).toHaveURL(/\/documents/, { timeout: 15000 });

    // User B's documents list should NOT contain User A's document
    await expect(pageB.locator(`a[href="/documents/${docAId}"]`)).toHaveCount(0);

    // 4. User B directly navigates to User A's document URL
    await pageB.goto(`/documents/${docAId}`);

    // Expect Document Not Found error state
    await expect(pageB.locator('text=Document Not Found')).toBeVisible();

    await contextB.close();
  });
});
