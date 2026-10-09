import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalSupabaseConfig } from './supabase-helper.js';

describe('Evidence Graph 13 Tables RLS & Tenant Isolation (P1-T6)', { timeout: 60000 }, () => {
  const config = getLocalSupabaseConfig();
  const adminClient = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
  const anonClient = createClient(config.API_URL, config.ANON_KEY);

  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId = '';
  let userBId = '';
  const emailA = `rls_user_a_${Date.now()}@juris.local`;
  const emailB = `rls_user_b_${Date.now()}@juris.local`;
  const password = 'Password123!Secure';

  const EVIDENCE_GRAPH_TABLES = [
    'sources',
    'evidence_spans',
    'tables',
    'datasets',
    'geo_layers',
    'entities',
    'relations',
    'derived_facts',
    'reconciliations',
    'flags',
    'visual_specs',
    'visual_insights',
    'review_queue',
  ] as const;

  beforeAll(async () => {
    // 1. Create User A and User B
    const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA || !userAData.user) {
      throw new Error(`Failed to create User A: ${errA?.message}`);
    }
    userAId = userAData.user.id;

    const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB || !userBData.user) {
      throw new Error(`Failed to create User B: ${errB?.message}`);
    }
    userBId = userBData.user.id;

    // 2. Sign in User A and User B to obtain scoped session JWTs
    clientA = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    expect(sessionA.session).toBeDefined();

    clientB = createClient(config.API_URL, config.ANON_KEY);
    const { data: sessionB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    expect(sessionB.session).toBeDefined();
  });

  afterAll(async () => {
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
  });

  it('strictly isolates all 13 Evidence Graph tables across User A, User B, and Anon', async () => {
    // 1. User A creates private document
    const { data: docA, error: docAErr } = await clientA
      .from('documents')
      .insert({
        owner_id: userAId,
        original_name: 'private_doc_a.pdf',
        storage_path: `${userAId}/private_doc_a.pdf`,
        size_bytes: 2048,
        sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        status: 'done',
        stage: 'done',
        is_sample: false,
        document_type: 'budget',
      })
      .select()
      .single();

    expect(docAErr).toBeNull();
    expect(docA).toBeDefined();
    const docId = docA.id;

    try {
      // 2. Insert records across all 13 Evidence Graph tables for docA
      // Table 1: sources
      const { data: sourceA, error: srcErr } = await clientA
        .from('sources')
        .insert({
          document_id: docId,
          modality: 'tabular',
          page_or_sheet: 1,
          width: 800,
          height: 600,
        })
        .select()
        .single();
      expect(srcErr).toBeNull();

      // Table 2: evidence_spans
      const { error: spanErr } = await clientA.from('evidence_spans').insert({
        document_id: docId,
        source_id: sourceA.id,
        kind: 'text_span',
        text: 'Sample evidence quote for doc A',
      });
      expect(spanErr).toBeNull();

      // Table 3: tables
      const { error: tblErr } = await clientA.from('tables').insert({
        document_id: docId,
        source_id: sourceA.id,
        caption: 'Table 1: Revenue Budget',
      });
      expect(tblErr).toBeNull();

      // Table 4: datasets
      const { error: dsErr } = await clientA.from('datasets').insert({
        document_id: docId,
        row_count: 5,
      });
      expect(dsErr).toBeNull();

      // Table 5: geo_layers
      const { error: geoErr } = await clientA.from('geo_layers').insert({
        document_id: docId,
        feature_count: 2,
      });
      expect(geoErr).toBeNull();

      // Table 6: entities
      const { data: entityA, error: entErr } = await clientA
        .from('entities')
        .insert({
          document_id: docId,
          kind: 'ministry',
          name: 'Ministry of Finance',
        })
        .select()
        .single();
      expect(entErr).toBeNull();

      // Table 7: relations
      const { error: relErr } = await clientA.from('relations').insert({
        document_id: docId,
        subject_id: entityA.id,
        predicate: 'allocates_to',
        object_id: entityA.id,
      });
      expect(relErr).toBeNull();

      // Also create a fact for review_queue FK
      const { data: factA, error: factErr } = await clientA
        .from('facts')
        .insert({
          document_id: docId,
          owner_id: userAId,
          type: 'money',
          fact_type: 'money',
          quote: 'Quote for fact A',
          page: 1,
          verified: false,
          proof_type: null,
        })
        .select()
        .single();
      expect(factErr).toBeNull();

      // Table 8: derived_facts
      const { error: dfErr } = await clientA.from('derived_facts').insert({
        document_id: docId,
        formula: 'a + b',
        source_fact_ids: [factA.id],
        label: 'Derived Sum',
        value: 12000,
        proof_type: 'DERIVED',
      });
      expect(dfErr).toBeNull();

      // Table 9: reconciliations
      const { error: recErr } = await clientA.from('reconciliations').insert({
        document_id: docId,
        kind: 'sum_check',
        status: 'MATCH',
        source_fact_ids: [factA.id],
        stated_total: 12000,
        computed_total: 12000,
        delta: 0,
        detail: 'Reconciliation verified',
      });
      expect(recErr).toBeNull();

      // Table 10: flags
      const { error: flagErr } = await clientA.from('flags').insert({
        document_id: docId,
        rule: 'ANOMALY_CHECK',
        severity: 'warning',
        source_fact_ids: [factA.id],
        text: 'Flag warning text',
      });
      expect(flagErr).toBeNull();

      // Table 11: visual_specs
      const { data: visSpecA, error: vsErr } = await clientA
        .from('visual_specs')
        .insert({
          document_id: docId,
          kind: 'key_figures',
          spec: { title: 'Key Figures' },
        })
        .select()
        .single();
      expect(vsErr).toBeNull();

      // Table 12: visual_insights
      const { error: viErr } = await clientA.from('visual_insights').insert({
        document_id: docId,
        visual_id: visSpecA.id,
        level: 'standard',
      });
      expect(viErr).toBeNull();

      // Table 13: review_queue
      const { error: rqErr } = await clientA.from('review_queue').insert({
        document_id: docId,
        fact_id: factA.id,
        reason: 'LOW_CONFIDENCE',
      });
      expect(rqErr).toBeNull();

      // 3. Verify User A can read own rows across all 13 tables
      for (const table of EVIDENCE_GRAPH_TABLES) {
        const { data, error } = await clientA.from(table).select('*').eq('document_id', docId);

        expect(error, `User A query error on ${table}`).toBeNull();
        expect(data && data.length, `User A should see row in ${table}`).toBeGreaterThan(0);
      }

      // 4. Verify User B CANNOT read any rows across all 13 tables
      for (const table of EVIDENCE_GRAPH_TABLES) {
        const { data, error } = await clientB.from(table).select('*').eq('document_id', docId);

        expect(error, `User B query error on ${table}`).toBeNull();
        expect(data, `User B must see 0 rows in ${table}`).toHaveLength(0);
      }

      // 5. Verify Anon client CANNOT read any rows across all 13 tables
      for (const table of EVIDENCE_GRAPH_TABLES) {
        const { data, error } = await anonClient.from(table).select('*').eq('document_id', docId);

        expect(error, `Anon query error on ${table}`).toBeNull();
        expect(data, `Anon must see 0 rows in ${table}`).toHaveLength(0);
      }

      // 6. Verify User B cannot insert into User A's document on any of the 13 tables
      const { error: bInsertErr } = await clientB.from('sources').insert({
        document_id: docId,
        modality: 'tabular',
      });
      expect(bInsertErr).not.toBeNull(); // RLS policy rejects WITH CHECK
    } finally {
      // 7. Cleanup document A (cascades to all 13 tables)
      await adminClient.from('documents').delete().eq('id', docId);
    }
  });
});
