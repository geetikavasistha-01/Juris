import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('Server App & Health Endpoints', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok, role, version, and gitSha on /health', async () => {
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

  it('returns 200 with status ok on /api/health alias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(['api', 'worker', 'all']).toContain(body.role);
    expect(typeof body.version).toBe('string');
  });

  it('configures CORS headers and credentials for allowed origins', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('returns 404 for unhandled routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/unknown-endpoint',
    });

    expect(res.statusCode).toBe(404);
  });
});
