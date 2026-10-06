import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { config } from './config.js';

let adminClientInstance: SupabaseClient | null = null;
let resolvedServiceRoleKey: string | null = null;
let resolvedAnonKey: string | null = null;

function getResolvedKeys(): { serviceRoleKey: string; anonKey: string; url: string } {
  if (resolvedServiceRoleKey && resolvedAnonKey) {
    return {
      serviceRoleKey: resolvedServiceRoleKey,
      anonKey: resolvedAnonKey,
      url: config.SUPABASE_URL,
    };
  }

  if (
    config.SUPABASE_SERVICE_ROLE_KEY &&
    !config.SUPABASE_SERVICE_ROLE_KEY.startsWith('placeholder_')
  ) {
    resolvedServiceRoleKey = config.SUPABASE_SERVICE_ROLE_KEY;
    resolvedAnonKey = config.SUPABASE_ANON_KEY;
    return {
      serviceRoleKey: resolvedServiceRoleKey,
      anonKey: resolvedAnonKey,
      url: config.SUPABASE_URL,
    };
  }

  try {
    const raw = execSync('supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = raw.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      resolvedServiceRoleKey = parsed.SERVICE_ROLE_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
      resolvedAnonKey = parsed.ANON_KEY || config.SUPABASE_ANON_KEY;
      return {
        serviceRoleKey: resolvedServiceRoleKey!,
        anonKey: resolvedAnonKey!,
        url: parsed.API_URL || config.SUPABASE_URL,
      };
    }
  } catch {
    // ignore
  }

  resolvedServiceRoleKey = config.SUPABASE_SERVICE_ROLE_KEY;
  resolvedAnonKey = config.SUPABASE_ANON_KEY;
  return {
    serviceRoleKey: resolvedServiceRoleKey,
    anonKey: resolvedAnonKey,
    url: config.SUPABASE_URL,
  };
}

export function getAdminSupabaseClient(): SupabaseClient {
  if (!adminClientInstance) {
    const { url, serviceRoleKey } = getResolvedKeys();
    adminClientInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClientInstance;
}

export function getUserSupabaseClient(jwtToken: string): SupabaseClient {
  const { url, anonKey } = getResolvedKeys();
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
