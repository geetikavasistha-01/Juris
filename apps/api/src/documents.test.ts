import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildApp } from './app.js';
import { getAdminSupabaseClient } from './supabase.js';

function createMultipartPayload(filename: string, contentType: string, buffer: Buffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const payload = Buffer.concat([Buffer.from(head), buffer, Buffer.from(tail)]);
  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  };
}

describe('Document API & Ingestion Pipeline', () => {
  const app = buildApp();
  const testUserEmail = `doc_test_${Date.now()}@juris.local`;
  const password = 'Password123!Secure';
  let _testUserId = '';
  let authToken = '';

  beforeAll(async () => {
    const supabase = getAdminSupabaseClient();
    const { data: userAuth, error: createErr } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    _testUserId = userAuth.user!.id;

    const { data: session, error: signErr } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password,
    });
    if (signErr) throw signErr;
    authToken = session.session!.access_token;
  });

  it('rejects uploads with invalid magic bytes', async () => {
    const mp = createMultipartPayload(
      'invalid.txt',
      'text/plain',
      Buffer.from('NOT A PDF FILE CONTENT'),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        ...mp.headers,
        authorization: `Bearer ${authToken}`,
      },
      payload: mp.payload,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('MAGIC_BYTES_MISMATCH');
  });

  it('uploads a valid PDF, starts background processing, and returns 201 Created', async () => {
    const pdfBuffer = fs.readFileSync('docs/pdf/test_upload.pdf');
    const mp = createMultipartPayload('test_upload.pdf', 'application/pdf', pdfBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        ...mp.headers,
        authorization: `Bearer ${authToken}`,
      },
      payload: mp.payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.documentId).toBeDefined();
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe('queued');
    expect(body.filename).toBe('test_upload.pdf');
    expect(body.fileSizeBytes).toBe(pdfBuffer.length);
    expect(body.sha256).toBeDefined();

    const documentId = body.documentId;

    // Wait 2.5 seconds for worker pipeline stages to progress
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Test GET /api/documents/:id
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.id).toBe(documentId);
    expect(detail.filename).toBe('test_upload.pdf');
    expect(detail.pageCount).toBeGreaterThan(0);

    // Test GET /api/documents/:id/chunks
    const chunksRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}/chunks`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(chunksRes.statusCode).toBe(200);
    const chunksBody = chunksRes.json();
    expect(chunksBody.documentId).toBe(documentId);
    expect(chunksBody.chunks).toBeDefined();

    // Test GET /api/documents/:id/events
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}/events`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(eventsRes.statusCode).toBe(200);
    const eventsBody = eventsRes.json();
    expect(eventsBody.documentId).toBe(documentId);
    expect(eventsBody.events.length).toBeGreaterThan(0);
    // Verify sequence monotonicity
    for (let i = 1; i < eventsBody.events.length; i++) {
      expect(eventsBody.events[i].sequence).toBeGreaterThan(eventsBody.events[i - 1].sequence);
    }
  });

  it('rejects duplicate upload with 409 DUPLICATE', async () => {
    const pdfBuffer = fs.readFileSync('docs/pdf/test_upload.pdf');
    const mp = createMultipartPayload('test_upload_duplicate.pdf', 'application/pdf', pdfBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        ...mp.headers,
        authorization: `Bearer ${authToken}`,
      },
      payload: mp.payload,
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error.code).toBe('DUPLICATE');
  });

  it('returns 404 NOT_FOUND for non-existent document ID', async () => {
    const fakeId = '99999999-9999-9999-9999-999999999999';
    const response = await app.inject({
      method: 'GET',
      url: `/api/documents/${fakeId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
