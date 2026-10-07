import { describe, it, expect } from 'vitest';
import { parseConfig, ApiConfigSchema } from './config.js';

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
  });

  it('guarantees API default limits match @juris/shared contract', async () => {
    const { DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_MAX_PDF_PAGES } = await import('@juris/shared');
    const defaults = parseConfig({});
    expect(defaults.MAX_FILE_SIZE_BYTES).toBe(DEFAULT_MAX_FILE_SIZE_BYTES);
    expect(defaults.MAX_PDF_PAGES).toBe(DEFAULT_MAX_PDF_PAGES);
  });

  it('fails fast in production if required secrets/urls are missing or placeholder', () => {
    expect(() => {
      parseConfig({
        NODE_ENV: 'production',
        PORT: '3001',
      });
    }).toThrow(/FATAL: Invalid environment configuration/);
  });

  it('validates production config when all keys meet production criteria', () => {
    const prodConfig = parseConfig({
      NODE_ENV: 'production',
      PORT: '3001',
      ROLE: 'all',
      SUPABASE_URL: 'https://xyzcompany.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_test',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key_for_test',
      GEMINI_API_KEY: 'test_gemini_api_key_for_production_min_len',
      GEMINI_MODEL: 'gemini-1.5-pro',
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
