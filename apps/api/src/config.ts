import { z } from 'zod';

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
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),
  LLM_MODE: z.enum(['live', 'record', 'replay']).default('replay'),
  EMBEDDING_PROVIDER: z.string().default('local'),

  // Security
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Limit variables from PRD (Section 10a)
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10485760), // 10MB
  MAX_PDF_PAGES: z.coerce.number().int().positive().default(50),
  MAX_TEXT_CHARS: z.coerce.number().int().positive().default(100000),
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
  GEMINI_API_KEY: z.string().min(10),
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
