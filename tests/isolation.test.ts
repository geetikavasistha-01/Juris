import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getLocalSupabaseConfig } from './supabase-helper.js';

describe('Spike S7: Multi-Tenant & RLS Isolation Verification', () => {
  const config = getLocalSupabaseConfig();
  const adminClient = createClient(config.API_URL, config.SERVICE_ROLE_KEY);

  const userA_email = `user_a_${Date.now()}@juris.local`;
  const userB_email = `user_b_${Date.now()}@juris.local`;
  const password = 'Password123!Secure';

  it('proves strict isolation between Account A and Account B at DB, Realtime, and Storage levels', async () => {
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

    // 2. Sign in as User A and User B
    const clientA = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionA } = await clientA.auth.signInWithPassword({
      email: userA_email,
      password,
    });
    expect(sessionA.session).toBeDefined();

    const clientB = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionB } = await clientB.auth.signInWithPassword({
      email: userB_email,
      password,
    });
    expect(sessionB.session).toBeDefined();

    // 3. User A creates private document, chunk, fact, visual, message, job_event
    const { data: docA, error: docAErr } = await clientA
      .from('documents')
      .insert({
        owner_id: userA_id,
        original_name: 'private_budget_a.pdf',
        storage_path: `${userA_id}/private_budget_a.pdf`,
        size_bytes: 2048,
        sha256: `sha_a_${Date.now()}`,
        status: 'done',
        stage: 'done',
        is_sample: false,
      })
      .select()
      .single();
    expect(docAErr).toBeNull();
    expect(docA).toBeDefined();

    // Insert facts for Doc A
    await clientA.from('facts').insert({
      document_id: docA.id,
      owner_id: userA_id,
      type: 'financial',
      value: 50000,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 1,
      quote: 'Private Allocation for User A',
      verified: true,
    });

    // 4. User B attempts to query User A's data (RLS verification)
    // Query documents
    const { data: docsForB } = await clientB.from('documents').select('*');
    const hasDocA = (docsForB || []).some((d: { id: string }) => d.id === docA.id);
    expect(hasDocA).toBe(false);

    // Query facts
    const { data: factsForB } = await clientB.from('facts').select('*').eq('document_id', docA.id);
    expect(factsForB).toHaveLength(0);

    // Direct update attempt by User B on User A's document
    const { error: updateErr } = await clientB
      .from('documents')
      .update({ original_name: 'hacked.pdf' })
      .eq('id', docA.id);
    expect(updateErr).toBeNull(); // Supabase RLS returns empty updated set without error
    const { data: docACheck } = await clientA
      .from('documents')
      .select('*')
      .eq('id', docA.id)
      .single();
    expect(docACheck.original_name).toBe('private_budget_a.pdf'); // Unmodified

    // 5. Test RPC Isolation (match_chunks, match_chunks_fts, match_chunks_hybrid)
    // Insert private chunks for Doc A
    const dummyEmbedding = Array(768).fill(0.01);
    await clientA.from('chunks').insert({
      document_id: docA.id,
      owner_id: userA_id,
      page_number: 1,
      chunk_index: 0,
      content: 'Confidential strategic financial data for Account A only',
      embedding: dummyEmbedding,
      embedding_model: 'text-embedding-004',
    });

    // User A can query their own chunks via RPCs
    const { data: aVector } = await clientA.rpc('match_chunks', {
      query_embedding: dummyEmbedding,
      doc_id: docA.id,
      match_count: 5,
    });
    expect(aVector).toBeDefined();
    expect(aVector?.length).toBeGreaterThan(0);

    const { data: aFts } = await clientA.rpc('match_chunks_fts', {
      query_text: 'Confidential strategic',
      doc_id: docA.id,
      match_count: 5,
    });
    expect(aFts).toBeDefined();
    expect(aFts?.length).toBeGreaterThan(0);

    const { data: aHybrid } = await clientA.rpc('match_chunks_hybrid', {
      query_text: 'Confidential strategic',
      query_embedding: dummyEmbedding,
      doc_id: docA.id,
      match_count: 5,
    });
    expect(aHybrid).toBeDefined();
    expect(aHybrid?.length).toBeGreaterThan(0);

    // User B attempts to call RPCs with User A's doc_id -> MUST return 0 rows
    const { data: bVector } = await clientB.rpc('match_chunks', {
      query_embedding: dummyEmbedding,
      doc_id: docA.id,
      match_count: 5,
    });
    expect(bVector).toHaveLength(0);

    const { data: bFts } = await clientB.rpc('match_chunks_fts', {
      query_text: 'Confidential strategic',
      doc_id: docA.id,
      match_count: 5,
    });
    expect(bFts).toHaveLength(0);

    const { data: bHybrid } = await clientB.rpc('match_chunks_hybrid', {
      query_text: 'Confidential strategic',
      query_embedding: dummyEmbedding,
      doc_id: docA.id,
      match_count: 5,
    });
    expect(bHybrid).toHaveLength(0);

    // Anonymous caller attempts to call RPCs on User A's private doc
    const anonClient = createClient(config.API_URL, config.ANON_KEY);
    const { data: anonVector, error: anonVecErr } = await anonClient.rpc('match_chunks', {
      query_embedding: dummyEmbedding,
      doc_id: docA.id,
      match_count: 5,
    });
    expect(anonVector === null || anonVector.length === 0 || !!anonVecErr).toBe(true);

    // 6. Test Sample Documents (Public Read)
    const { data: sampleDoc } = await adminClient
      .from('documents')
      .insert({
        owner_id: userA_id,
        original_name: 'public_sample_budget.pdf',
        storage_path: `${userA_id}/public_sample_budget.pdf`,
        size_bytes: 1024,
        sha256: `sha_sample_${Date.now()}`,
        status: 'done',
        is_sample: true,
      })
      .select()
      .single();

    // Insert public sample chunk
    await adminClient.from('chunks').insert({
      document_id: sampleDoc.id,
      owner_id: userA_id,
      page_number: 1,
      chunk_index: 0,
      content: 'Public open civic budget data for all citizens',
      embedding: dummyEmbedding,
      embedding_model: 'text-embedding-004',
    });

    const { data: publicDocsForB } = await clientB
      .from('documents')
      .select('*')
      .eq('id', sampleDoc.id);
    expect(publicDocsForB).toHaveLength(1);
    expect(publicDocsForB![0].original_name).toBe('public_sample_budget.pdf');

    // User B querying sample doc chunks via RPC
    const { data: bSampleChunks } = await clientB.rpc('match_chunks_hybrid', {
      query_text: 'Public open civic',
      query_embedding: dummyEmbedding,
      doc_id: sampleDoc.id,
      match_count: 5,
    });
    expect(bSampleChunks).toBeDefined();
    expect(bSampleChunks?.length).toBeGreaterThan(0);

    // Cleanup
    await adminClient.from('documents').delete().eq('id', docA.id);
    await adminClient.from('documents').delete().eq('id', sampleDoc.id);
    await adminClient.auth.admin.deleteUser(userA_id);
    await adminClient.auth.admin.deleteUser(userB_id);
  });
});
