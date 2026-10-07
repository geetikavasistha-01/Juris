import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { createRealTestUser } from './real-helper.js';

test.describe('Real-Path E2E Suite: WebSocket Drop & Polling Fallback Recovery', () => {
  test('drops websocket mid-job with real worker and asserts all stages complete via polling', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 1. Create a real local Supabase user
    const user = await createRealTestUser('socket_drop_user');

    // 2. Sign in via UI
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/documents/);

    // 3. Upload 18-page excerpt PDF
    await page.goto('/upload');
    const testPdfPath = path.resolve('docs/pdf/test_upload.pdf');
    await page.setInputFiles('input[type="file"]', testPdfPath);

    const uploadBtn = page.locator('button:has-text("Start Ingestion")');
    await uploadBtn.click();

    // 4. On progress page, drop WebSocket connection mid-processing
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\/progress/);

    // Disable WebSocket in browser to simulate network disconnection / drop
    await page.evaluate(() => {
      interface CustomWindow extends Window {
        _supabaseRealtimeSocket?: { close: () => void };
      }
      const win = window as unknown as CustomWindow;
      // Force WebSocket close and prevent new connections
      if (win._supabaseRealtimeSocket) {
        win._supabaseRealtimeSocket.close();
      }
      (window as unknown as { WebSocket: unknown }).WebSocket = class MockClosedWebSocket {
        onerror?: (event: Event) => void;
        constructor() {
          setTimeout(() => {
            if (typeof this.onerror === 'function') {
              this.onerror(new Event('error'));
            }
          }, 50);
        }
        send() {}
        close() {}
      };
    });

    // 5. Assert that polling fallback picks up and completes all stages
    const inspectBtn = page.locator('a:has-text("Inspect Extracted Facts")');
    await expect(inspectBtn).toBeVisible({ timeout: 45000 });
    await inspectBtn.click();
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);
    await expect(page.locator('h1')).toBeVisible();
  });
});
