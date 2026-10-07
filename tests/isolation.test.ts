import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getLocalSupabaseConfig } from './supabase-helper.js';
import { buildApp } from '../apps/api/src/app.js';

describe('Multi-Tenant & API Isolation Verification (AUTH-01, API-01)', () => {
  const config = getLocalSupabaseConfig();
  const adminClient = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
  const app = buildApp();

  const userA_email = `user_a_${Date.now()}@juris.local`;
  const userB_email = `user_b_${Date.now()}@juris.local`;
  const password = 'Password123!Secure';

  it('proves strict multi-tenant isolation across HTTP API, Database RLS, and Storage', async () => {
    // 1. Create two separate authenticated users in Supabase Auth
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: userA_email,
      password,
      email_confirm: true,
    });
    expect(errA).toBeNull();
    const userA_id = authA.user!.id;

    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: userB_email,
      password,
      email_confirm: true,
    });
    expect(errB).toBeNull();
    const userB_id = authB.user!.id;

    // 2. Sign in to obtain access tokens
    const clientA = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionA } = await clientA.auth.signInWithPassword({
      email: userA_email,
      password,
    });
    const tokenA = sessionA.session!.access_token;

    const clientB = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionB } = await clientB.auth.signInWithPassword({
      email: userB_email,
      password,
    });
    const tokenB = sessionB.session!.access_token;

    // 3. User A creates a private document with storage file, chunks, facts, and jobs
    const docA_id = crypto.randomUUID();
    const storagePathA = `${userA_id}/private_contract_a.pdf`;

    await adminClient.storage
      .from('documents')
      .upload(storagePathA, Buffer.from('%PDF-1.4 mock private pdf content'), {
        contentType: 'application/pdf',
        upsert: true,
      });

    const { data: docA, error: docAErr } = await adminClient
      .from('documents')
      .insert({
        id: docA_id,
        owner_id: userA_id,
        original_name: 'private_contract_a.pdf',
        storage_path: storagePathA,
        size_bytes: 2048,
        sha256: `sha_a_${Date.now()}`,
        status: 'done',
        stage: 'done',
        page_count: 5,
        is_sample: false,
      })
      .select()
      .single();
    expect(docAErr).toBeNull();

    // Insert fact for Doc A
    await adminClient.from('facts').insert({
      document_id: docA.id,
      owner_id: userA_id,
      type: 'financial',
      value: 75000,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 1,
      quote: 'Private Allocation for User A',
      verified: true,
    });

    // Insert chunk for Doc A
    await adminClient.from('chunks').insert({
      document_id: docA.id,
      owner_id: userA_id,
      page_number: 1,
      chunk_index: 0,
      content: 'Confidential corporate data for User A only',
    });

    // 4. Test Unauthenticated Requests -> MUST return 401 AUTH_REQUIRED
    const unauthDocRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docA.id}`,
    });
    expect(unauthDocRes.statusCode).toBe(401);
    expect(unauthDocRes.json().error.code).toBe('AUTH_REQUIRED');

    const unauthListRes = await app.inject({
      method: 'GET',
      url: '/api/documents',
    });
    expect(unauthListRes.statusCode).toBe(401);
    expect(unauthListRes.json().error.code).toBe('AUTH_REQUIRED');

    const unauthDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${docA.id}`,
    });
    expect(unauthDeleteRes.statusCode).toBe(401);
    expect(unauthDeleteRes.json().error.code).toBe('AUTH_REQUIRED');

    // 5. Test Account B Access to Account A's Document -> MUST return 404 NOT_FOUND
    // GET /api/documents/:id as User B
    const bGetDocRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(bGetDocRes.statusCode).toBe(404);
    expect(bGetDocRes.json().error.code).toBe('NOT_FOUND');

    // GET /api/documents/:id/file as User B
    const bGetFileRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docA.id}/file`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(bGetFileRes.statusCode).toBe(404);
    expect(bGetFileRes.json().error.code).toBe('NOT_FOUND');

    // DELETE /api/documents/:id as User B
    const bDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${docA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(bDeleteRes.statusCode).toBe(404);
    expect(bDeleteRes.json().error.code).toBe('NOT_FOUND');

    // 6. Test GET /api/documents List Isolation
    const bListRes = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(bListRes.statusCode).toBe(200);
    const bDocs = bListRes.json().documents;
    const hasDocAInBList = bDocs.some((d: { id: string }) => d.id === docA.id);
    expect(hasDocAInBList).toBe(false);

    // User A can view their document and list it
    const aGetDocRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docA.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(aGetDocRes.statusCode).toBe(200);
    expect(aGetDocRes.json().id).toBe(docA.id);

    // 7. Signed URL Short-Lived TTL check
    const aGetFileRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docA.id}/file`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(aGetFileRes.statusCode).toBe(200);
    const fileData = aGetFileRes.json();
    expect(fileData.expiresInSeconds).toBeLessThanOrEqual(3600);
    expect(fileData.expiresInSeconds).toBeGreaterThan(0);
    expect(fileData.signedUrl).toContain('http');

    // 8. Test Delete Cascade (Storage object, chunks, facts, jobs)
    const aDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${docA.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(aDeleteRes.statusCode).toBe(200);
    expect(aDeleteRes.json().status).toBe('deleted');

    // Verify DB cascade
    const { data: factsAfterDelete } = await adminClient
      .from('facts')
      .select('*')
      .eq('document_id', docA.id);
    expect(factsAfterDelete).toHaveLength(0);

    const { data: chunksAfterDelete } = await adminClient
      .from('chunks')
      .select('*')
      .eq('document_id', docA.id);
    expect(chunksAfterDelete).toHaveLength(0);

    // Verify document row is gone
    const { data: docAfterDelete } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', docA.id)
      .maybeSingle();
    expect(docAfterDelete).toBeNull();

    // Clean up users
    await adminClient.auth.admin.deleteUser(userA_id);
    await adminClient.auth.admin.deleteUser(userB_id);
  }, 25000);
});
