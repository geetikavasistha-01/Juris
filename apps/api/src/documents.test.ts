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

describe('Document API & Ingestion Pipeline', { timeout: 60000 }, () => {
  const app = buildApp();
  const supabase = getAdminSupabaseClient();
  const testUserEmail = `doc_test_${Date.now()}@juris.local`;
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
  }, 30000);

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

    const { data: insertedFact } = await supabase
      .from('facts')
      .insert({
        document_id: docId,
        owner_id: _testUserId,
        type: 'financial_allocation',
        fact_type: 'money',
        value: 100,
        numeric_value: 100,
        unit: 'crore',
        page: 1,
        quote: 'Sample quote 100 crore',
        verified: true,
        proof_type: 'VERIFIED',
      })
      .select()
      .single();

    await supabase.from('analyses').insert({
      document_id: docId,
      owner_id: _testUserId,
      summary: 'Analysis summary for cascade test',
      verification_rate: 100,
      source_fact_ids: insertedFact?.id ? [insertedFact.id] : [],
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
  }, 30000);

  it('successfully uploads and processes CSV tabular dataset', async () => {
    const supabase = getAdminSupabaseClient();
    const csvContent =
      'Sector,Budget_Cr,Expenditure_Cr\nHealthcare,52000,48000\nEducation,75000,72000\nTransport,35000,34000';
    const mp = createMultipartPayload(
      'civic_budget_sample.csv',
      'text/csv',
      Buffer.from(csvContent, 'utf-8'),
    );

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
    const body = uploadRes.json();
    const docId = body.documentId;
    expect(docId).toBeDefined();

    // Poll until completed
    let status = 'queued';
    for (let attempt = 0; attempt < 30; attempt++) {
      const docRes = await app.inject({
        method: 'GET',
        url: `/api/documents/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (docRes.statusCode === 200) {
        status = docRes.json().status;
        if (status === 'done' || status === 'failed') break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(status).toBe('done');

    // Verify source modality and datasets record
    const { data: sources } = await supabase.from('sources').select('*').eq('document_id', docId);

    expect(sources && sources.length).toBeGreaterThan(0);
    expect(sources?.[0]?.modality).toBe('tabular');

    const { data: dataset } = await supabase
      .from('datasets')
      .select('*')
      .eq('document_id', docId)
      .single();
    expect(dataset?.row_count).toBe(3);

    // Verify facts computed from table (quarantined in Phase 1 per GAP-01)
    const { data: facts } = await supabase.from('facts').select('*').eq('document_id', docId);
    expect(facts && facts.length).toBeGreaterThan(0);
    expect(facts?.every((f) => f.verified === false && f.proof_type === null)).toBe(true);
  }, 30000);

  it('successfully uploads and processes GeoJSON spatial dataset', async () => {
    const supabase = getAdminSupabaseClient();
    const geoJsonContent = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ward: 'Central', population: 150000 },
          geometry: {
            type: 'Point',
            coordinates: [77.209, 28.6139],
          },
        },
        {
          type: 'Feature',
          properties: { ward: 'North', population: 210000 },
          geometry: {
            type: 'Point',
            coordinates: [77.215, 28.65],
          },
        },
      ],
    });

    const mp = createMultipartPayload(
      'wards.geojson',
      'application/geo+json',
      Buffer.from(geoJsonContent, 'utf-8'),
    );

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
    const body = uploadRes.json();
    const docId = body.documentId;
    expect(docId).toBeDefined();

    // Poll until completed
    let status = 'queued';
    for (let attempt = 0; attempt < 30; attempt++) {
      const docRes = await app.inject({
        method: 'GET',
        url: `/api/documents/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (docRes.statusCode === 200) {
        status = docRes.json().status;
        if (status === 'done' || status === 'failed') break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(status).toBe('done');

    // Verify source modality and geo_layers record
    const { data: sources } = await supabase.from('sources').select('*').eq('document_id', docId);

    expect(sources && sources.length).toBeGreaterThan(0);
    expect(sources?.[0]?.modality).toBe('spatial');

    const { data: geoLayer } = await supabase
      .from('geo_layers')
      .select('*')
      .eq('document_id', docId)
      .single();
    expect(geoLayer?.feature_count).toBe(2);

    // Verify spatial facts (quarantined in Phase 1 per GAP-02)
    const { data: facts } = await supabase.from('facts').select('*').eq('document_id', docId);
    expect(facts && facts.length).toBeGreaterThan(0);
    expect(facts?.every((f) => f.verified === false && f.proof_type === null)).toBe(true);
  }, 30000);

  it('successfully uploads and processes KML spatial dataset', async () => {
    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Civic Centre North</name>
      <description>Capital works budget 8500000</description>
      <Point>
        <coordinates>77.2090,28.6139,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

    const mp = createMultipartPayload(
      'civic_zones.kml',
      'application/vnd.google-earth.kml+xml',
      Buffer.from(kmlContent, 'utf-8'),
    );

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
    const body = uploadRes.json();
    const docId = body.documentId;
    expect(docId).toBeDefined();

    let status = 'queued';
    for (let attempt = 0; attempt < 30; attempt++) {
      const docRes = await app.inject({
        method: 'GET',
        url: `/api/documents/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (docRes.statusCode === 200) {
        status = docRes.json().status;
        if (status === 'done' || status === 'failed') break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(status).toBe('done');

    const { data: sources } = await supabase.from('sources').select('*').eq('document_id', docId);
    expect(sources?.[0]?.modality).toBe('spatial');

    // Verify spatial facts (quarantined in Phase 1 per GAP-02)
    const { data: facts } = await supabase.from('facts').select('*').eq('document_id', docId);
    expect(facts && facts.length).toBeGreaterThan(0);
    expect(facts?.every((f) => f.verified === false && f.proof_type === null)).toBe(true);
  }, 30000);

  it('successfully uploads and processes PNG image document', async () => {
    // 1x1 valid PNG buffer
    const pngBuffer = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG header
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR length
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
      0x00,
      0x00,
      0x01,
      0x00, // Width: 256
      0x00,
      0x00,
      0x01,
      0x00, // Height: 256
      0x08,
      0x02,
      0x00,
      0x00,
      0x00,
      0x90,
      0x77,
      0x53,
      0xde,
      0x00,
      0x00,
      0x00,
      0x00, // IEND length
      0x49,
      0x45,
      0x4e,
      0x44, // IEND
      0xae,
      0x42,
      0x60,
      0x82,
    ]);

    const mp = createMultipartPayload('scan_record.png', 'image/png', pngBuffer);

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
    const body = uploadRes.json();
    const docId = body.documentId;
    expect(docId).toBeDefined();

    let status = 'queued';
    for (let attempt = 0; attempt < 30; attempt++) {
      const docRes = await app.inject({
        method: 'GET',
        url: `/api/documents/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (docRes.statusCode === 200) {
        status = docRes.json().status;
        if (status === 'done' || status === 'failed') break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(status).toBe('done');

    const { data: sources } = await supabase.from('sources').select('*').eq('document_id', docId);
    expect(sources?.[0]?.modality).toBe('image');
    expect(sources?.[0]?.width).toBe(256);
    expect(sources?.[0]?.height).toBe(256);

    // GAP-03: Image dimensions now set sources.width and height directly; no synthetic facts
    const { data: facts } = await supabase.from('facts').select('*').eq('document_id', docId);
    expect(facts?.length).toBe(0);
  }, 30000);

  it('handles Review Queue, Human Approval (Rule 8), Conflicts, and Glossary endpoints', async () => {
    // 1. Create a document record
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        owner_id: _testUserId,
        original_name: 'statutory_audit_test.pdf',
        storage_path: `${_testUserId}/statutory_audit_test.pdf`,
        size_bytes: 1024,
        sha256: 'a'.repeat(64),
        status: 'done',
        page_count: 5,
        is_sample: false,
      })
      .select()
      .single();
    expect(docErr).toBeNull();
    const docId = doc!.id;

    // 2. Insert test facts:
    // Fact 1: low-confidence OCR fact
    const { data: fact1, error: fact1Err } = await supabase
      .from('facts')
      .insert({
        document_id: docId,
        owner_id: _testUserId,
        type: 'receipt',
        fact_type: 'money',
        value: 4500,
        unit: 'crore',
        period: '2025-26',
        page: 1,
        quote: 'Highway toll collection reached approx 4,500 crore',
        verified: false,
        proof_type: 'ESTIMATED',
        fail_reason: 'LOW_OCR_CONFIDENCE',
      })
      .select()
      .single();
    if (fact1Err) console.error('FACT1 ERROR:', fact1Err);
    expect(fact1Err).toBeNull();

    // Fact 2 & Fact 3: Conflicting facts with same type and period
    const { data: _fact2 } = await supabase
      .from('facts')
      .insert({
        document_id: docId,
        owner_id: _testUserId,
        type: 'allocation',
        fact_type: 'money',
        value: 10000,
        unit: 'crore',
        period: '2025-26',
        page: 2,
        quote: 'Table 2: Capital Outlay stands at Rs 10,000 crore',
        verified: true,
        proof_type: 'VERIFIED',
      })
      .select()
      .single();

    const { data: _fact3 } = await supabase
      .from('facts')
      .insert({
        document_id: docId,
        owner_id: _testUserId,
        type: 'allocation',
        fact_type: 'money',
        value: 10500,
        unit: 'crore',
        period: '2025-26',
        page: 4,
        quote: 'Statement 4: Capital Outlay revised to Rs 10,500 crore',
        verified: true,
        proof_type: 'VERIFIED',
      })
      .select()
      .single();

    // Fact 4: Definition fact for glossary
    const { data: fact4 } = await supabase
      .from('facts')
      .insert({
        document_id: docId,
        owner_id: _testUserId,
        type: 'definition',
        fact_type: 'definition',
        value: null,
        unit: null,
        period: null,
        page: 3,
        quote:
          'Concessionaire means the private entity executing the public-private partnership contract.',
        verified: true,
        proof_type: 'VERIFIED',
      })
      .select()
      .single();

    // Insert review_queue item for fact 1
    const { data: reviewItem } = await supabase
      .from('review_queue')
      .insert({
        document_id: docId,
        fact_id: fact1!.id,
        reason: 'OCR token confidence 72% below 80% threshold',
        ocr_confidence: 72,
        status: 'pending',
      })
      .select()
      .single();

    // 3. Test GET /api/documents/:id/review-queue
    const getQueueRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/review-queue`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(getQueueRes.statusCode).toBe(200);
    const queueBody = getQueueRes.json();
    expect(queueBody.items).toHaveLength(1);
    expect(queueBody.items[0].id).toBe(reviewItem!.id);
    expect(queueBody.items[0].label).toBe('receipt (4500 crore)');
    expect(queueBody.items[0].ocrConfidence).toBe(72);

    // 4. Test POST /api/documents/:id/review-queue/:itemId/approve (Human Review Gate - AGENTS.md Rule 8)
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/documents/${docId}/review-queue/${reviewItem!.id}/approve`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = approveRes.json();
    expect(approveBody.success).toBe(true);
    expect(approveBody.item.status).toBe('approved');

    // Verify fact transitioned in database to USER_CONFIRMED and verified: true
    const { data: updatedFact } = await supabase
      .from('facts')
      .select('*')
      .eq('id', fact1!.id)
      .single();
    expect(updatedFact?.proof_type).toBe('USER_CONFIRMED');
    expect(updatedFact?.verified).toBe(true);

    // 5. Test GET /api/documents/:id/conflicts
    const conflictsRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/conflicts`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(conflictsRes.statusCode).toBe(200);
    const conflictsBody = conflictsRes.json();
    expect(conflictsBody.conflicts).toHaveLength(1);
    expect(conflictsBody.conflicts[0].subject).toBe('allocation');
    expect(conflictsBody.conflicts[0].difference).toBe(500);
    expect(conflictsBody.conflicts[0].sourceA.value).toBe(10000);
    expect(conflictsBody.conflicts[0].sourceB.value).toBe(10500);

    // 6. Test GET /api/documents/:id/glossary
    const glossaryRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/glossary`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(glossaryRes.statusCode).toBe(200);
    const glossaryBody = glossaryRes.json();
    expect(glossaryBody.terms).toHaveLength(1);
    expect(glossaryBody.terms[0].term).toBe('Concessionaire');
    expect(glossaryBody.terms[0].page).toBe(3);
    expect(glossaryBody.terms[0].factId).toBe(fact4!.id);
  }, 30000);
});
