import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger, scrubKeyShapedStrings } from './logger.js';

describe('Logger security and redaction', () => {
  it('scrubs key-shaped tokens from arbitrary text strings', () => {
    const rawJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.synthetic_sig';
    const rawAiza = 'AIzaSyA_SYNTHETIC_API_KEY_STRING_1234567890';
    const rawSbSecret = 'sb_secret_synthetic_service_role_key_value';
    const rawGsk = 'gsk_synthetic_groq_key_value_12345';

    const scrubbed = scrubKeyShapedStrings(
      `Found token: ${rawJwt}, api: ${rawAiza}, supabase: ${rawSbSecret}, groq: ${rawGsk}`,
    );

    expect(scrubbed).not.toContain(rawJwt);
    expect(scrubbed).not.toContain(rawAiza);
    expect(scrubbed).not.toContain(rawSbSecret);
    expect(scrubbed).not.toContain(rawGsk);
    expect(scrubbed).toContain('[REDACTED_JWT]');
    expect(scrubbed).toContain('[REDACTED_AIZA]');
    expect(scrubbed).toContain('[REDACTED_SB_SECRET]');
    expect(scrubbed).toContain('[REDACTED_GSK]');
  });

  it('safely handles circular references without infinite recursion', () => {
    const circular: Record<string, unknown> = {
      name: 'test',
      secretMsg: 'contains AIzaSy_1234567890123456789012345',
    };
    circular['self'] = circular;

    expect(() => {
      createLogger().info(circular, 'circular log');
    }).not.toThrow();
  });

  it('redacts sensitive field names and scrubs message contents in actual logger output', async () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });

    const testLogger = createLogger(stream);

    testLogger.info(
      {
        authorization: 'Bearer synthetic_super_secret_auth_token',
        cookie: 'session_id=synthetic_session_secret_cookie',
        'x-goog-api-key': 'synthetic_google_key_header',
        apikey: 'synthetic_supabase_anon_key_header',
        password: 'synthetic_user_password_plaintext',
        token: 'synthetic_oauth_bearer_token',
        secret: 'synthetic_app_master_secret',
        nested: {
          password: 'synthetic_nested_password',
          secret: 'synthetic_nested_secret',
        },
      },
      'User login event with key AIzaSy_SYNTHETIC_KEY_IN_LOG_MSG and JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIifQ.synthetic_signature',
    );

    expect(logs.length).toBe(1);
    const parsed = JSON.parse(logs[0]!);

    // Redacted fields should equal [REDACTED]
    expect(parsed.authorization).toBe('[REDACTED]');
    expect(parsed.cookie).toBe('[REDACTED]');
    expect(parsed['x-goog-api-key']).toBe('[REDACTED]');
    expect(parsed.apikey).toBe('[REDACTED]');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.secret).toBe('[REDACTED]');

    // Message should have scrubbed synthetic tokens
    expect(parsed.msg).toContain('[REDACTED_AIZA]');
    expect(parsed.msg).toContain('[REDACTED_JWT]');
    expect(parsed.msg).not.toContain('AIzaSy_SYNTHETIC_KEY_IN_LOG_MSG');
    expect(parsed.msg).not.toContain('eyJhbGciOiJIUzI1Ni');
  });
});
