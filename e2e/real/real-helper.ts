import { execSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface LocalSupabaseConfig {
  apiUrl: string;
  anonKey: string;
  serviceKey: string;
}

let cachedConfig: LocalSupabaseConfig | null = null;

export function getLocalConfig(): LocalSupabaseConfig {
  if (cachedConfig) return cachedConfig;

  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    cachedConfig = {
      apiUrl: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return cachedConfig;
  }

  try {
    const supabaseBin =
      execSync('which supabase || echo "/opt/homebrew/bin/supabase"', {
        encoding: 'utf8',
      }).trim() || '/opt/homebrew/bin/supabase';

    const raw = execSync(`${supabaseBin} status -o json`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}` },
    });
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      if (parsed.SERVICE_ROLE_KEY) {
        cachedConfig = {
          apiUrl: parsed.API_URL || 'http://127.0.0.1:54321',
          anonKey: parsed.ANON_KEY || '',
          serviceKey: parsed.SERVICE_ROLE_KEY,
        };
        return cachedConfig;
      }
    }
    throw new Error('No valid keys in supabase status output');
  } catch (err) {
    throw new Error(
      `Failed to resolve local Supabase configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function getAdminClient(): SupabaseClient {
  const cfg = getLocalConfig();
  return createClient(cfg.apiUrl, cfg.serviceKey);
}

export async function createRealTestUser(prefix = 'real_user') {
  const admin = getAdminClient();
  const timestamp = Date.now();
  const salt = Math.random().toString(36).slice(2, 8);
  const email = `${prefix}_${timestamp}_${salt}@juris.local`;
  const password = 'TestPassword123!Secure';

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (!error && data?.user) {
        return {
          id: data.user.id,
          email,
          password,
        };
      }
      lastError = new Error(error?.message || 'Unknown createUser error');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  throw new Error(`Failed to create real test user: ${lastError?.message || 'unknown'}`);
}

export async function loginTestUser(page: Page, user: { email: string; password: string }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL(/\/documents/, { timeout: 15000 });
      return;
    } catch {
      // Check if error toast is present and retry after brief delay
      const toast = page.locator('div[role="alert"]');
      if (await toast.isVisible()) {
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }
  await page.waitForURL(/\/documents/, { timeout: 15000 });
}
