import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runSecretLint } from 'secretlint';

describe('Secretlint Custom Pattern Rules & Node API Verification', () => {
  let tempDir: string;
  const configPath = path.resolve(process.cwd(), '.secretlintrc.json');
  const envExamplePath = path.resolve(process.cwd(), '.env.example');

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juris-secretlint-test-'));
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function lintFile(filePath: string) {
    return runSecretLint({
      cliOptions: {
        cwd: process.cwd(),
        filePathOrGlobList: [filePath],
      },
      engineOptions: {
        formatter: 'json',
        configFilePath: configPath,
      },
    });
  }

  it('detects runtime-constructed Google API Key (AIza + 35 chars)', async () => {
    // Constructed at runtime from fragments so no literal key exists in tracked code
    const syntheticGoogleKey = ['AI', 'za', 'Sy', '123456789012345678901234567890123'].join('');
    const targetFile = path.join(tempDir, 'google.env');
    fs.writeFileSync(targetFile, `GOOGLE_KEY=${syntheticGoogleKey}\n`);

    const result = await lintFile(targetFile);
    expect(result.exitStatus).toBe(1);
    expect(result.stdout).toContain('Google API Key');
  });

  it('detects runtime-constructed Supabase secret key (sb_secret_ prefix)', async () => {
    const syntheticSbKey = ['sb_', 'secret_', 'synthetic_service_role_key_12345'].join('');
    const targetFile = path.join(tempDir, 'supabase.env');
    fs.writeFileSync(targetFile, `SUPABASE_KEY=${syntheticSbKey}\n`);

    const result = await lintFile(targetFile);
    expect(result.exitStatus).toBe(1);
    expect(result.stdout).toContain('Supabase Secret Key');
  });

  it('detects runtime-constructed JWT token (3 base64url segments, starting eyJ)', async () => {
    const syntheticJwt = [
      'eyJ',
      'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      '.',
      'eyJ',
      'zdWIiOiIxMjM0NTY3ODkwIn0',
      '.',
      'synthetic_sig_segment_1234567890',
    ].join('');
    const targetFile = path.join(tempDir, 'jwt.env');
    fs.writeFileSync(targetFile, `AUTH_TOKEN=${syntheticJwt}\n`);

    const result = await lintFile(targetFile);
    expect(result.exitStatus).toBe(1);
    expect(result.stdout).toContain('JSON Web Token');
  });

  it('detects runtime-constructed Groq key (gsk_ prefix)', async () => {
    const syntheticGsk = ['gsk_', 'synthetic_groq_api_token_1234567890'].join('');
    const targetFile = path.join(tempDir, 'groq.env');
    fs.writeFileSync(targetFile, `GROQ_KEY=${syntheticGsk}\n`);

    const result = await lintFile(targetFile);
    expect(result.exitStatus).toBe(1);
    expect(result.stdout).toContain('Groq API Key');
  });

  it('confirms .env.example has zero findings', async () => {
    const result = await lintFile(envExamplePath);
    expect(result.exitStatus).toBe(0);
    const parsed = JSON.parse(result.stdout || '[]');
    const totalMessages = parsed.reduce(
      (acc: number, item: { messages?: unknown[] }) => acc + (item.messages?.length || 0),
      0,
    );
    expect(totalMessages).toBe(0);
  });
});
