import { z } from 'zod';

export const WebConfigSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
  VITE_SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).default('placeholder_anon_key'),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;

export const FORBIDDEN_VITE_PATTERNS = ['SECRET', 'SERVICE', 'PRIVATE', 'GEMINI', 'API_KEY'];

export function assertNoForbiddenViteVariables(env: Record<string, unknown>): void {
  const violations: string[] = [];

  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_')) {
      const upper = key.toUpperCase();
      for (const pattern of FORBIDDEN_VITE_PATTERNS) {
        if (upper.includes(pattern)) {
          violations.push(`${key} matches forbidden pattern "${pattern}"`);
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `SECURITY VIOLATION: Forbidden client-exposed variable(s) detected in VITE_ environment:\n` +
        violations.map((v) => `  - ${v}`).join('\n') +
        `\nClient environments must never expose secrets, service keys, private keys, or API tokens.`,
    );
  }
}

export function parseWebConfig(
  rawEnv: Record<string, unknown> = (typeof import.meta !== 'undefined' && import.meta.env) || {},
): WebConfig {
  assertNoForbiddenViteVariables(rawEnv);
  return WebConfigSchema.parse(rawEnv);
}
