import fs from 'node:fs';
import path from 'node:path';
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

  let apiUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  let anonKey = process.env.SUPABASE_ANON_KEY || '';
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!anonKey || !serviceKey) {
    const envPath = path.resolve('apps/api/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          const value = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
          if (key === 'SUPABASE_URL' && !process.env.SUPABASE_URL) apiUrl = value;
          if (key === 'SUPABASE_ANON_KEY' && !anonKey) anonKey = value;
          if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceKey) serviceKey = value;
        }
      }
    }
  }

  cachedConfig = {
    apiUrl,
    anonKey,
    serviceKey,
  };
  return cachedConfig;
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
