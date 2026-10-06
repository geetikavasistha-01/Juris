import { execSync } from 'node:child_process';

interface SupabaseStatus {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  DB_URL: string;
}

let cachedStatus: SupabaseStatus | null = null;

export function getLocalSupabaseConfig(): SupabaseStatus {
  if (cachedStatus) return cachedStatus;

  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    cachedStatus = {
      API_URL: process.env.SUPABASE_URL,
      ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DB_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    };
    return cachedStatus;
  }

  try {
    const raw = execSync('supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(raw);
    cachedStatus = {
      API_URL: parsed.API_URL || 'http://127.0.0.1:54321',
      ANON_KEY: parsed.ANON_KEY,
      SERVICE_ROLE_KEY: parsed.SERVICE_ROLE_KEY,
      DB_URL: parsed.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    };
    return cachedStatus;
  } catch {
    return {
      API_URL: 'http://127.0.0.1:54321',
      ANON_KEY: '',
      SERVICE_ROLE_KEY: '',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    };
  }
}
