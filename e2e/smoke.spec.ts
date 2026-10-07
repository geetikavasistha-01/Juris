import { test, expect } from '@playwright/test';

test.describe('Juris Home Page Smoke Test', () => {
  test('loads home page, displays Juris brand & version, and produces zero console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Listen for any console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to root
    await page.goto('/');

    // Verify page title
    await expect(page).toHaveTitle('Juris');

    // Verify header branding
    const headerHeading = page.locator('header h1');
    await expect(headerHeading).toHaveText('Juris');

    // Verify library page heading
    const libraryTitle = page.locator('main h1');
    await expect(libraryTitle).toContainText('Document');

    // Verify version and git sha are rendered
    const versionEl = page.locator('#app-version');
    await expect(versionEl).toBeVisible();
    const versionText = await versionEl.textContent();
    expect(versionText?.trim().length).toBeGreaterThan(0);

    const gitShaEl = page.locator('#app-git-sha');
    await expect(gitShaEl).toBeVisible();
    const gitShaText = await gitShaEl.textContent();
    expect(gitShaText?.trim().length).toBeGreaterThan(0);

    // Test theme selector interaction
    const themeSelect = page.locator('#theme-select');
    await themeSelect.selectOption('dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await themeSelect.selectOption('light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Assert zero console errors or uncaught exceptions
    expect(
      consoleErrors,
      `Expected 0 console errors, but found: ${consoleErrors.join(', ')}`,
    ).toEqual([]);
    expect(pageErrors, `Expected 0 page errors, but found: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
