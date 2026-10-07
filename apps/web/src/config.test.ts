import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseWebConfig,
  assertNoForbiddenViteVariables,
  FORBIDDEN_VITE_PATTERNS,
} from './config.js';

describe('apps/web config and env safety', () => {
  it('parses valid web configuration successfully', () => {
    const config = parseWebConfig({
      VITE_API_URL: 'http://localhost:3001',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    });

    expect(config.VITE_API_URL).toBe('http://localhost:3001');
    expect(config.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(config.VITE_SUPABASE_ANON_KEY).toBe('test-anon-key');
  });

  it('guarantees web limits match @juris/shared contract', async () => {
    const { DEFAULT_MAX_FILE_SIZE_BYTES } = await import('@juris/shared');
    expect(DEFAULT_MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it.each([
    'VITE_GEMINI_KEY',
    'VITE_GEMINI_API_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_APP_SECRET',
    'VITE_PRIVATE_KEY',
    'VITE_SERVICE_ACCOUNT',
    'VITE_BACKEND_API_KEY',
  ])('fails if any VITE_ variable contains forbidden pattern (%s)', (forbiddenVar) => {
    expect(() => {
      assertNoForbiddenViteVariables({
        [forbiddenVar]: 'should-not-exist',
      });
    }).toThrow(/SECURITY VIOLATION: Forbidden client-exposed variable/);
  });

  it('scans .env.example to ensure no forbidden VITE_ variables are defined', () => {
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [varName] = trimmed.split('=');
        if (varName && varName.startsWith('VITE_')) {
          const upper = varName.toUpperCase();
          for (const pattern of FORBIDDEN_VITE_PATTERNS) {
            expect(
              upper.includes(pattern),
              `.env.example contains forbidden VITE variable: ${varName}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
