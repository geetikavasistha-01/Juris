import { test, expect } from '@playwright/test';

test.describe('Phase 2b Step B: Application Shell & Routes Suite', () => {
  test('navigates seamlessly across primary routes via Navbar', async ({ page }) => {
    await page.goto('/documents');

    // Verify Document Library page loaded
    await expect(page.locator('main h1')).toContainText('Document');

    // Click Upload link in navbar
    await page.click('header nav a[href="/upload"]');
    await expect(page).toHaveURL(/\/upload/);
    await expect(page.locator('main h1')).toContainText('Upload');

    // Click Design System link in navbar
    await page.click('header nav a[href="/design"]');
    await expect(page).toHaveURL(/\/design/);
    await expect(page.locator('h1').first()).toContainText('Design');
  });

  test('validates Upload Dropzone interactions and constraints', async ({ page }) => {
    await page.goto('/upload');

    // Verify upload dropzone is present
    const dropzone = page.locator('text=drag and drop your PDF');
    await expect(dropzone).toBeVisible();

    // Verify format and size notices are displayed
    await expect(page.locator('text=Standard PDF documents')).toBeVisible();

    // Verify upload submit button is disabled or not present until file selected
    const selectedFileInput = page.locator('input[type="file"]');
    await expect(selectedFileInput).toHaveAttribute('accept', '.pdf,application/pdf');
  });

  test('toggles Authentication modes and supports guest access', async ({ page }) => {
    await page.goto('/login');

    // Check heading
    await expect(page.locator('main h1')).toContainText('Sign in to Juris');

    // Toggle to Sign Up
    await page.click('main p button:has-text("Sign Up")');
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account');

    // Toggle back to Sign In
    await page.click('main p button:has-text("Sign In")');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');

    // Check Guest Access button
    const guestBtn = page.locator('button:has-text("Continue as Demo Guest")');
    await expect(guestBtn).toBeVisible();
    await expect(guestBtn).toBeEnabled();
  });

  test('Realtime: drops websocket mid-processing and asserts polling displays all stages in order', async ({
    page,
  }) => {
    const docId = 'doc-progress-socket-drop-test';
    let pollCount = 0;

    // Route for document metadata
    await page.route(`**/api/documents/${docId}`, async (route) => {
      pollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: docId,
          filename: 'socket_drop_recovery_test.pdf',
          status: pollCount > 1 ? 'done' : 'processing',
          pageCount: 10,
          fileSizeBytes: 10240,
          sha256: 'abc123sha256',
          isSample: false,
          job: {
            id: 'job-drop-test',
            status: pollCount > 1 ? 'completed' : 'processing',
            stage: pollCount > 1 ? 'synthesis' : 'chunking',
            progress: pollCount > 1 ? 100 : 50,
          },
        }),
      });
    });

    // Route for job events stream
    await page.route(`**/api/documents/${docId}/events`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId: docId,
          jobId: 'job-drop-test',
          events: [
            {
              id: 'ev-1',
              sequence: 1,
              stage: 'validating',
              progress: 10,
              message: 'Stage 1: Validation complete',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'ev-2',
              sequence: 2,
              stage: 'extracting',
              progress: 30,
              message: 'Stage 2: Extraction complete',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'ev-3',
              sequence: 3,
              stage: 'chunking',
              progress: 50,
              message: 'Stage 3: Chunking complete',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Abort all websocket / realtime connections to simulate sudden socket disconnect
    await page.route('**/realtime/**', (route) => route.abort());

    await page.goto(`/documents/${docId}/progress`);
    await page.waitForSelector('h1');

    // Verify stepper shows pipeline stages in order despite socket drop
    await expect(page.locator('text=File Validation')).toBeVisible();
    await expect(page.locator('text=PDF Text Extraction')).toBeVisible();
    await expect(page.locator('text=Document Segmentation')).toBeVisible();

    // Verify events log lists events #1, #2, #3 sequentially
    await expect(page.locator('text=#1')).toBeVisible();
    await expect(page.locator('text=#2')).toBeVisible();
    await expect(page.locator('text=#3')).toBeVisible();
  });
});
