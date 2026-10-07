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

  it('uploads a valid PDF, starts background processing, and returns 201 Created', async () => {
    const pdfBuffer = getTestPdfBuffer();
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
  }, 15000);

  it('rejects duplicate upload with 409 DUPLICATE', async () => {
    const pdfBuffer = getTestPdfBuffer();
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

  it('lists documents for user via GET /api/documents', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.documents).toBeDefined();
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.total).toBe(body.documents.length);
  });

  it('restricts anonymous guest uploads with 403 FORBIDDEN', async () => {
    const pdfBuffer = getTestPdfBuffer();
    const mp = createMultipartPayload('guest_upload.pdf', 'application/pdf', pdfBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        ...mp.headers,
        authorization: 'Bearer demo-guest-token',
      },
      payload: mp.payload,
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('cascades deletion across chunks, facts, analyses, visualizations, conversations, and jobs', async () => {
    const supabase = getAdminSupabaseClient();
    const docId = crypto.randomUUID();

    // 1. Insert parent document
    const { error: dErr } = await supabase.from('documents').insert({
      id: docId,
      owner_id: _testUserId,
      original_name: 'cascade_test.pdf',
      storage_path: `documents/${_testUserId}/${docId}.pdf`,
      size_bytes: 1024,
      sha256: `sha256_${Date.now()}`,
      status: 'done',
      page_count: 1,
    });
    expect(dErr).toBeNull();

    // 2. Insert related records into chunks, facts, analyses, visualizations, conversations, messages, jobs, job_events
    const convId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    await supabase.from('chunks').insert({
      document_id: docId,
      owner_id: _testUserId,
      page_number: 1,
      chunk_index: 0,
      content: 'Sample chunk content for cascade test',
    });

    await supabase.from('facts').insert({
      document_id: docId,
      owner_id: _testUserId,
      type: 'financial_allocation',
      value: 100,
      unit: 'crore',
      page: 1,
      quote: 'Sample quote 100 crore',
      verified: true,
    });

    await supabase.from('analyses').insert({
      document_id: docId,
      owner_id: _testUserId,
      summary: 'Analysis summary for cascade test',
      verification_rate: 100,
    });

    await supabase.from('visualizations').insert({
      document_id: docId,
      owner_id: _testUserId,
      kind: 'bar',
      title: 'Cascade Chart',
      spec: {},
    });

    await supabase.from('conversations').insert({
      id: convId,
      document_id: docId,
      owner_id: _testUserId,
    });

    await supabase.from('messages').insert({
      conversation_id: convId,
      owner_id: _testUserId,
      role: 'user',
      content: 'Hello document',
    });

    await supabase.from('jobs').insert({
      id: jobId,
      document_id: docId,
      owner_id: _testUserId,
      status: 'completed',
    });

    await supabase.from('job_events').insert({
      job_id: jobId,
      document_id: docId,
      owner_id: _testUserId,
      stage: 'completed',
      progress: 100,
      sequence: 1,
      message: 'Done',
    });

    // Verify all related records exist before deletion
    const { count: chunkCountBefore } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(chunkCountBefore).toBe(1);

    const { count: factCountBefore } = await supabase
      .from('facts')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(factCountBefore).toBe(1);

    const { count: vizCountBefore } = await supabase
      .from('visualizations')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(vizCountBefore).toBe(1);

    const { count: msgCountBefore } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', convId);
    expect(msgCountBefore).toBe(1);

    // 3. Delete document via DELETE /api/documents/:id
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${docId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(delRes.statusCode).toBe(200);
    expect(delRes.json()).toEqual({ status: 'deleted', id: docId });

    // 4. Verify all cascading tables are empty for docId
    const { count: chunkCountAfter } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(chunkCountAfter).toBe(0);

    const { count: factCountAfter } = await supabase
      .from('facts')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(factCountAfter).toBe(0);

    const { count: analysisCountAfter } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(analysisCountAfter).toBe(0);

    const { count: vizCountAfter } = await supabase
      .from('visualizations')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(vizCountAfter).toBe(0);

    const { count: convCountAfter } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(convCountAfter).toBe(0);

    const { count: msgCountAfter } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', convId);
    expect(msgCountAfter).toBe(0);

    const { count: jobCountAfter } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(jobCountAfter).toBe(0);

    const { count: eventCountAfter } = await supabase
      .from('job_events')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);
    expect(eventCountAfter).toBe(0);
  });
});
