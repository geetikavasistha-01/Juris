import pino from 'pino';

// Regex patterns for sensitive key-shaped strings
export const KEY_PATTERNS = {
  jwt: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  aiza: /AIza[0-9A-Za-z_-]{20,}/g,
  sbSecret: /sb_secret[0-9A-Za-z_-]*/g,
  gsk: /gsk_[0-9A-Za-z_-]*/g,
};

/**
 * Scrubs key-shaped tokens (JWTs, Google AIza, Supabase secret, Groq gsk) from any string.
 */
export function scrubKeyShapedStrings(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(KEY_PATTERNS.jwt, '[REDACTED_JWT]')
    .replace(KEY_PATTERNS.aiza, '[REDACTED_AIZA]')
    .replace(KEY_PATTERNS.sbSecret, '[REDACTED_SB_SECRET]')
    .replace(KEY_PATTERNS.gsk, '[REDACTED_GSK]');
}

/**
 * Deeply scrubs key-shaped strings across any object or array.
 */
export function scrubObject<T>(input: T): T {
  if (typeof input === 'string') {
    return scrubKeyShapedStrings(input) as unknown as T;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => scrubObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = scrubObject(value);
  }
  return result as T;
}

export const REDACTED_PATHS = [
  'authorization',
  'cookie',
  'x-goog-api-key',
  'apikey',
  '*.authorization',
  '*.cookie',
  '*.x-goog-api-key',
  '*.apikey',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.apikey',
  'req.headers["x-goog-api-key"]',
  'password',
  'token',
  'secret',
  '*.password',
  '*.token',
  '*.secret',
  '*.*.password',
  '*.*.token',
  '*.*.secret',
];

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: process.env['LOG_LEVEL'] || 'info',
      redact: {
        paths: REDACTED_PATHS,
        censor: '[REDACTED]',
      },
      hooks: {
        logMethod(inputArgs, method) {
          const scrubbedArgs = inputArgs.map((arg) => {
            if (typeof arg === 'string') {
              return scrubKeyShapedStrings(arg);
            }
            if (typeof arg === 'object' && arg !== null) {
              return scrubObject(arg);
            }
            return arg;
          });
          return (method as (...args: unknown[]) => void).apply(this, scrubbedArgs);
        },
      },
      formatters: {
        log(obj) {
          return scrubObject(obj);
        },
      },
    },
    destination,
  );
}

export const logger = createLogger();
