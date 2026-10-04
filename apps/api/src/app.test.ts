import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('GET /health', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok, role, version, and gitSha', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(['api', 'worker', 'all']).toContain(body.role);
    expect(typeof body.version).toBe('string');
    expect(typeof body.gitSha).toBe('string');
    expect(body.gitSha.length).toBeGreaterThan(0);
  });
});
