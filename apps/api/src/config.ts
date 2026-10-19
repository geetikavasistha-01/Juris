import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MAX_PDF_PAGES,
  DEFAULT_MAX_TEXT_CHARS,
} from '@juris/shared';

/**
 * Automatically loads .env files using Node 20+ process.loadEnvFile.
 * Resolves apps/api/.env first, then repo-root .env regardless of working directory.
 * Ignores missing files without crashing and never overrides variables already set.
 */
export function loadEnvironmentFiles(): void {
  if (typeof process.loadEnvFile !== 'function') return;

  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const srcDir = path.dirname(currentFilePath);
    const apiDir = path.resolve(srcDir, '..');
    const repoRoot = path.resolve(apiDir, '..');

    const candidatePaths = [path.join(apiDir, '.env'), path.join(repoRoot, '.env')];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        // Snapshot existing env keys to ensure pre-existing variables win
        const existingKeys = new Set(Object.keys(process.env));
        const originalValues = new Map<string, string | undefined>();
        for (const k of existingKeys) {
          originalValues.set(k, process.env[k]);
        }

        process.loadEnvFile(candidate);

        // Restore original values so existing variables are never overridden
        for (const [k, val] of originalValues) {
          if (val !== undefined) {
            process.env[k] = val;
          }
        }
        break; // Loaded highest priority file
      }
    }
  } catch {
    // Ignore any filesystem resolution errors safely
  }
}

// Automatically load environment files on import
loadEnvironmentFiles();

export const ApiConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  ROLE: z.enum(['api', 'worker', 'all']).default('all'),

  // Supabase Services
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  SUPABASE_ANON_KEY: z.string().min(1).default('placeholder_anon_key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder_service_role_key'),

  // LLM & Provider Configuration
  GEMINI_API_KEY: z.string().min(1).default('placeholder_gemini_api_key'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  LLM_MODE: z.enum(['live', 'record', 'replay']).default('replay'),
  EMBEDDING_PROVIDER: z.string().default('local'),

  // Security
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Limit variables from PRD (Section 10a)
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_FILE_SIZE_BYTES),
  MAX_PDF_PAGES: z.coerce.number().int().positive().default(DEFAULT_MAX_PDF_PAGES),
  MAX_TEXT_CHARS: z.coerce.number().int().positive().default(DEFAULT_MAX_TEXT_CHARS),
  MAX_UPLOADS_PER_USER_PER_DAY: z.coerce.number().int().positive().default(10),
  MAX_QUESTIONS_PER_USER_PER_DAY: z.coerce.number().int().positive().default(50),
  MAX_CONCURRENT_JOBS_PER_USER: z.coerce.number().int().positive().default(2),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

/**
 * Strict schema for production environments requiring explicit, real configuration.
 */
export const ProductionConfigSchema = ApiConfigSchema.extend({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  GEMINI_API_KEY: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.LLM_MODE === 'live') {
    if (
      !data.GEMINI_API_KEY ||
      data.GEMINI_API_KEY.length < 10 ||
      data.GEMINI_API_KEY.includes('placeholder')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message:
          'In production mode with LLM_MODE=live, GEMINI_API_KEY must not be empty or a placeholder',
      });
    }
  }
});

export function parseConfig(rawEnv: Record<string, string | undefined> = process.env): ApiConfig {
  const isProd = rawEnv['NODE_ENV'] === 'production';
  const schema = isProd ? ProductionConfigSchema : ApiConfigSchema;
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const errorMessage = `FATAL: Invalid environment configuration:\n${formattedErrors}`;

    if (isProd) {
      throw new Error(errorMessage);
    } else {
      console.warn(`[WARN] Config parsing warnings in non-production mode:\n${formattedErrors}`);
      // Fallback to basic parse or return partial
      return ApiConfigSchema.parse(rawEnv);
    }
  }

  return result.data;
}

export const config: ApiConfig = parseConfig(process.env);
