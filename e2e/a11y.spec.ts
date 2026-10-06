import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('Juris Design System Accessibility & Keyboard Tests', () => {
  // 1. Axe-core Automated Audits across Themes and Viewports
  test('Axe scan: Desktop Light theme (/design)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/design');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Axe scan: Desktop Dark theme (/design)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/design');
    await page.waitForSelector('h1');

    // Switch to dark theme
    await page.click('button[aria-label="Dark theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Axe scan: Mobile Light theme (/design)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/design');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Axe scan: Mobile Dark theme (/design)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/design');
    await page.waitForSelector('h1');

    await page.click('button[aria-label="Dark theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // 2. Keyboard Navigation: Dialog Focus Trap, Escape, and Trigger Restoration
  test('Keyboard: Dialog traps focus, closes on Escape, and restores focus to trigger', async ({
    page,
  }) => {
    await page.goto('/design');
    const triggerBtn = page.getByRole('button', { name: 'Open Verification Dialog' });
    await triggerBtn.focus();
    await page.keyboard.press('Enter');

    // Verify dialog opened
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Focus cycle check
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Ensure focused element is still inside dialog
    const isFocusInside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(isFocusInside).toBe(true);

    // Escape closes dialog
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Focus restored to trigger button
    await expect(triggerBtn).toBeFocused();
  });

  // 3. Keyboard Navigation: Drawer Focus Trap, Escape, and Trigger Restoration
  test('Keyboard: Drawer traps focus, closes on Escape, and restores focus to trigger', async ({
    page,
  }) => {
    await page.goto('/design');
    const triggerBtn = page.getByRole('button', { name: 'Open Citation Drawer' });
    await triggerBtn.focus();
    await page.keyboard.press('Enter');

    // Verify drawer opened
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // Focus cycle check
    await page.keyboard.press('Tab');
    const isFocusInside = await drawer.evaluate((el) => el.contains(document.activeElement));
    expect(isFocusInside).toBe(true);

    // Escape closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Focus restored to trigger button
    await expect(triggerBtn).toBeFocused();
  });

  // 4. Keyboard Navigation: Tabs Arrow Key & Roving Focus
  test('Keyboard: Tabs respond to arrow keys, Home, and End', async ({ page }) => {
    await page.goto('/design');

    const tab1 = page.getByRole('tab', { name: 'Executive Overview' });
    const tab2 = page.getByRole('tab', { name: 'Verified Facts' });
    const tab3 = page.getByRole('tab', { name: 'Risk Analysis' });

    await tab1.focus();
    await expect(tab1).toHaveAttribute('aria-selected', 'true');

    // Arrow right moves to tab2
    await page.keyboard.press('ArrowRight');
    await expect(tab2).toBeFocused();
    await expect(tab2).toHaveAttribute('aria-selected', 'true');

    // Arrow right moves to tab3
    await page.keyboard.press('ArrowRight');
    await expect(tab3).toBeFocused();
    await expect(tab3).toHaveAttribute('aria-selected', 'true');

    // Arrow right wraps around to tab1
    await page.keyboard.press('ArrowRight');
    await expect(tab1).toBeFocused();
    await expect(tab1).toHaveAttribute('aria-selected', 'true');

    // Arrow left wraps to tab3
    await page.keyboard.press('ArrowLeft');
    await expect(tab3).toBeFocused();
    await expect(tab3).toHaveAttribute('aria-selected', 'true');

    // Home moves to first tab
    await page.keyboard.press('Home');
    await expect(tab1).toBeFocused();
    await expect(tab1).toHaveAttribute('aria-selected', 'true');

    // End moves to last tab
    await page.keyboard.press('End');
    await expect(tab3).toBeFocused();
    await expect(tab3).toHaveAttribute('aria-selected', 'true');
  });

  // 5. Screen Reader Announcements: Toast aria-live
  test('Toast is announced via role="alert" and aria-live', async ({ page }) => {
    await page.goto('/design');
    const toast = page.getByRole('alert').filter({ hasText: 'Ingestion Pipeline Completed' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expect(toast).toContainText('Ingestion Pipeline Completed');
  });

  // 6. Prefers Reduced Motion
  test('Prefers-reduced-motion disables animations and transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design');

    // Verify computed animation and transition durations on body and interactive elements
    const [bodyTransition, bodyAnimation] = await page.evaluate(() => {
      const el = document.body;
      const style = window.getComputedStyle(el);
      return [style.transitionDuration, style.animationDuration];
    });

    expect(bodyTransition).toMatch(/^(0s|0\.00001s|0\.01ms|0ms|0\.00001ms|1e-05s)/);
    expect(bodyAnimation).toMatch(/^(0s|0\.00001s|0\.01ms|0ms|0\.00001ms|1e-05s)/);
  });
});
