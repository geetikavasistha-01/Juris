import { execSync } from 'node:child_process';
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
    const raw = execSync('supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(raw);
    cachedConfig = {
      apiUrl: parsed.API_URL || 'http://127.0.0.1:54321',
      anonKey: parsed.ANON_KEY || '',
      serviceKey: parsed.SERVICE_ROLE_KEY || '',
    };
    return cachedConfig;
  } catch {
    cachedConfig = {
      apiUrl: 'http://127.0.0.1:54321',
      anonKey: '',
      serviceKey: '',
    };
    return cachedConfig;
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
