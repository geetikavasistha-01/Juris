import { describe, it, expect } from 'vitest';
import { parseConfig, ApiConfigSchema } from './config.js';
import {
  FAKE_GEMINI_KEY,
  FAKE_SUPABASE_ANON_KEY,
  FAKE_SUPABASE_SERVICE_ROLE_KEY,
} from './test-fixtures.js';

describe('apps/api config', () => {
  it('parses valid environment configuration with defaults', () => {
    const parsed = parseConfig({
      NODE_ENV: 'test',
      PORT: '4000',
      ROLE: 'api',
    });

    expect(parsed.PORT).toBe(4000);
    expect(parsed.ROLE).toBe('api');
    expect(parsed.MAX_PDF_PAGES).toBe(50);
    expect(parsed.MAX_FILE_SIZE_BYTES).toBe(10485760);
    expect(parsed.GEMINI_MODEL).toBe('gemini-2.5-flash');
  });

  it('guarantees API default limits match @juris/shared contract', async () => {
    const { DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_MAX_PDF_PAGES } = await import('@juris/shared');
    const defaults = parseConfig({});
    expect(defaults.MAX_FILE_SIZE_BYTES).toBe(DEFAULT_MAX_FILE_SIZE_BYTES);
    expect(defaults.MAX_PDF_PAGES).toBe(DEFAULT_MAX_PDF_PAGES);
    expect(defaults.GEMINI_MODEL).toBe('gemini-2.5-flash');
  });

  it('fails fast in production if required secrets/urls are missing or placeholder', () => {
    expect(() => {
      parseConfig({
        NODE_ENV: 'production',
        PORT: '3001',
      });
    }).toThrow(/FATAL: Invalid environment configuration/);
  });

  it('fails in production if LLM_MODE is live and GEMINI_API_KEY is placeholder', () => {
    expect(() => {
      parseConfig({
        NODE_ENV: 'production',
        PORT: '3001',
        SUPABASE_URL: 'https://xyzcompany.supabase.co',
        SUPABASE_ANON_KEY: FAKE_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: FAKE_SUPABASE_SERVICE_ROLE_KEY,
        GEMINI_API_KEY: 'placeholder_gemini_api_key',
        LLM_MODE: 'live',
      });
    }).toThrow(
      /In production mode with LLM_MODE=live, GEMINI_API_KEY must not be empty or a placeholder/,
    );
  });

  it('validates production config when all keys meet production criteria', () => {
    const prodConfig = parseConfig({
      NODE_ENV: 'production',
      PORT: '3001',
      ROLE: 'all',
      SUPABASE_URL: 'https://xyzcompany.supabase.co',
      SUPABASE_ANON_KEY: FAKE_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_API_KEY: FAKE_GEMINI_KEY,
      GEMINI_MODEL: 'gemini-2.5-flash',
      LLM_MODE: 'live',
      EMBEDDING_PROVIDER: 'hosted',
      CORS_ORIGINS: 'https://juris.example.com',
      MAX_FILE_SIZE_BYTES: '10485760',
      MAX_PDF_PAGES: '50',
      MAX_TEXT_CHARS: '100000',
      MAX_UPLOADS_PER_USER_PER_DAY: '10',
      MAX_QUESTIONS_PER_USER_PER_DAY: '50',
      MAX_CONCURRENT_JOBS_PER_USER: '2',
    });

    expect(prodConfig.NODE_ENV).toBe('production');
    expect(prodConfig.PORT).toBe(3001);
    expect(prodConfig.GEMINI_MODEL).toBe('gemini-2.5-flash');
  });

  it('validates schema keys strictly', () => {
    const keys = Object.keys(ApiConfigSchema.shape);
    const expectedKeys = [
      'NODE_ENV',
      'PORT',
      'ROLE',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY',
      'GEMINI_MODEL',
      'LLM_MODE',
      'EMBEDDING_PROVIDER',
      'CORS_ORIGINS',
      'MAX_FILE_SIZE_BYTES',
      'MAX_PDF_PAGES',
      'MAX_TEXT_CHARS',
      'MAX_UPLOADS_PER_USER_PER_DAY',
      'MAX_QUESTIONS_PER_USER_PER_DAY',
      'MAX_CONCURRENT_JOBS_PER_USER',
    ];

    expect(keys.sort()).toEqual(expectedKeys.sort());
  });
});
