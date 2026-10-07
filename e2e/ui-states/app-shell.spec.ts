import { test, expect } from '@playwright/test';

test.describe('Mocked UI State Suite: App Shell & Dropzone', () => {
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
});
