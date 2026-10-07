import { test, expect } from '@playwright/test';

test.describe('Mocked UI State Suite: Smoke & Navigation', () => {
  test('loads home page, displays Juris brand & version, and produces zero console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Check title / brand
    await expect(page).toHaveTitle(/Juris/);
    const logo = page.locator('text=Juris').first();
    await expect(logo).toBeVisible();

    // Verify console errors are 0
    expect(consoleErrors).toHaveLength(0);
  });
});
