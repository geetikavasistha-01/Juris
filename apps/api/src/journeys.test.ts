import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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

describe('Phase 4: Core User Journeys & App Shell End-to-End', { timeout: 60000 }, () => {
  const app = buildApp();
  const supabase = getAdminSupabaseClient();
  const testUserEmail = `journey_test_${Date.now()}@juris.local`;
  const password = 'Password123!Secure';
  let _testUserId = '';
  let authToken = '';

  beforeAll(async () => {
    let createdUser: { id: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data: userAuth, error: createErr } = await supabase.auth.admin.createUser({
          email: testUserEmail,
          password,
          email_confirm: true,
        });
        if (!createErr && userAuth?.user) {
          createdUser = userAuth.user;
          break;
        }
      } catch {
        // Retry after delay
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    if (!createdUser) throw new Error('Failed to create test user in beforeAll');
    _testUserId = createdUser.id;

    const { data: session, error: signErr } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password,
    });
    if (signErr) throw signErr;
    authToken = session.session!.access_token;
  }, 30000);

  function getTestPdfBuffer(): Buffer {
    const candidatePaths = [
      path.resolve('docs/pdf/test_upload.pdf'),
      path.resolve(process.cwd(), 'docs/pdf/test_upload.pdf'),
      path.resolve(import.meta.dirname, '../../../docs/pdf/test_upload.pdf'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    throw new Error('test_upload.pdf not found in candidate paths');
  }

  it('verifies honest empty state before any uploads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.documents).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('completes the full end-to-end lifecycle: upload -> live progress -> library inspection -> document view', async () => {
    // 1. Upload valid document
    const pdfBuffer = getTestPdfBuffer();
    const mp = createMultipartPayload('phase4_journey_test.pdf', 'application/pdf', pdfBuffer);

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        ...mp.headers,
        authorization: `Bearer ${authToken}`,
      },
      payload: mp.payload,
    });

    expect(uploadRes.statusCode).toBe(201);
    const uploadBody = uploadRes.json();
    const docId = uploadBody.documentId;
    expect(docId).toBeDefined();
    expect(uploadBody.status).toBe('queued');

    // 2. Watch live progress events and polling fallback
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/events`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    expect(eventsRes.statusCode).toBe(200);
    const eventsBody = eventsRes.json();
    expect(eventsBody.documentId).toBe(docId);
    expect(eventsBody.events.length).toBeGreaterThan(0);

    // Verify monotonic sequencing of progress events
    for (let i = 1; i < eventsBody.events.length; i++) {
      expect(eventsBody.events[i].sequence).toBeGreaterThan(eventsBody.events[i - 1].sequence);
    }

    // 3. Inspect library
    const libRes = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    expect(libRes.statusCode).toBe(200);
    const libBody = libRes.json();
    expect(libBody.documents.length).toBeGreaterThanOrEqual(1);
    const found = libBody.documents.find((d: { id: string }) => d.id === docId);
    expect(found).toBeDefined();
    expect(found.filename).toBe('phase4_journey_test.pdf');

    // 4. View document details and chunks
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json();
    expect(detailBody.id).toBe(docId);
    expect(detailBody.filename).toBe('phase4_journey_test.pdf');

    const chunksRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/chunks`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    expect(chunksRes.statusCode).toBe(200);
    const chunksBody = chunksRes.json();
    expect(chunksBody.documentId).toBe(docId);
    expect(Array.isArray(chunksBody.chunks)).toBe(true);

    // Clean up
    await app.inject({
      method: 'DELETE',
      url: `/api/documents/${docId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
  });
});
