import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getLocalSupabaseConfig } from './supabase-helper.js';
import {
  DocumentTypeSchema,
  SemanticFactTypeSchema,
  ProofTypeSchema,
} from '../packages/shared/src/index.js';

describe('Schema Drift & DB Constraint Verification (P1-T5)', { timeout: 30000 }, () => {
  const config = getLocalSupabaseConfig();
  const adminClient = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
  let testUserId = '';

  beforeAll(async () => {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: `schema_drift_${Date.now()}@juris.local`,
      password: 'Password123!Secure',
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Failed to create test user for schema drift: ${error?.message}`);
    }
    testUserId = data.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  it('guarantees shared DocumentTypeSchema matches documents.document_type DB constraint', async () => {
    const expectedDocumentTypes = ['budget', 'notification', 'tender', 'dataset', 'map', 'generic'];

    expect([...DocumentTypeSchema.options].sort()).toEqual([...expectedDocumentTypes].sort());

    // 1. Verify every valid DocumentType is accepted by DB
    for (const docType of DocumentTypeSchema.options) {
      const docId = crypto.randomUUID();
      const { error } = await adminClient.from('documents').insert({
        id: docId,
        owner_id: testUserId,
        original_name: `test_${docType}.pdf`,
        storage_path: `${testUserId}/test_${docType}.pdf`,
        size_bytes: 1024,
        sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        status: 'done',
        stage: 'done',
        document_type: docType,
      });
      expect(error, `Failed to insert valid document_type: ${docType}`).toBeNull();

      // Clean up test document
      await adminClient.from('documents').delete().eq('id', docId);
    }

    // 2. Verify an invalid document_type triggers DB check constraint violation
    const invalidDocId = crypto.randomUUID();
    const { error: invalidErr } = await adminClient.from('documents').insert({
      id: invalidDocId,
      owner_id: testUserId,
      original_name: 'test_invalid.pdf',
      storage_path: `${testUserId}/test_invalid.pdf`,
      size_bytes: 1024,
      sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      status: 'done',
      stage: 'done',
      document_type: 'unsupported_document_type',
    });
    expect(invalidErr).not.toBeNull();
    expect(invalidErr?.message).toMatch(/documents_document_type_check/i);
  });

  it('guarantees shared SemanticFactTypeSchema matches facts.fact_type DB constraint', async () => {
    const expectedFactTypes = [
      'money',
      'measure',
      'date',
      'place',
      'entity',
      'obligation',
      'definition',
      'relation',
      'identifier',
    ];

    expect([...SemanticFactTypeSchema.options].sort()).toEqual([...expectedFactTypes].sort());

    const docId = crypto.randomUUID();
    await adminClient.from('documents').insert({
      id: docId,
      owner_id: testUserId,
      original_name: 'facts_test.pdf',
      storage_path: `${testUserId}/facts_test.pdf`,
      size_bytes: 1024,
      sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      status: 'done',
      stage: 'done',
    });

    try {
      // 1. Verify every valid SemanticFactType is accepted by DB
      for (const factType of SemanticFactTypeSchema.options) {
        const factId = crypto.randomUUID();
        const { error } = await adminClient.from('facts').insert({
          id: factId,
          document_id: docId,
          owner_id: testUserId,
          type: factType,
          fact_type: factType,
          quote: `Sample quote for ${factType}`,
          page: 1,
          verified: false,
          proof_type: null,
        });
        expect(error, `Failed to insert valid fact_type: ${factType}`).toBeNull();
      }

      // 2. Verify invalid fact_type is rejected by DB check constraint
      const { error: invalidErr } = await adminClient.from('facts').insert({
        document_id: docId,
        owner_id: testUserId,
        type: 'invalid_type',
        fact_type: 'invalid_fact_type',
        quote: 'Sample invalid quote',
        page: 1,
        verified: false,
        proof_type: null,
      });
      expect(invalidErr).not.toBeNull();
      expect(invalidErr?.message).toMatch(/facts_fact_type_check/i);
    } finally {
      await adminClient.from('documents').delete().eq('id', docId);
    }
  });

  it('guarantees shared ProofTypeSchema matches facts.proof_type DB constraint', async () => {
    const expectedProofTypes = [
      'VERIFIED',
      'VERIFIED_OCR',
      'COMPUTED',
      'DERIVED',
      'USER_CONFIRMED',
      'ESTIMATED',
      'CONFLICT',
      'UNVERIFIABLE',
      'REJECTED',
    ];

    expect([...ProofTypeSchema.options].sort()).toEqual([...expectedProofTypes].sort());

    const docId = crypto.randomUUID();
    await adminClient.from('documents').insert({
      id: docId,
      owner_id: testUserId,
      original_name: 'proofs_test.pdf',
      storage_path: `${testUserId}/proofs_test.pdf`,
      size_bytes: 1024,
      sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      status: 'done',
      stage: 'done',
    });

    try {
      // 1. Verify all 9 canonical proof types can be inserted
      for (const proofType of ProofTypeSchema.options) {
        const factId = crypto.randomUUID();
        const { error } = await adminClient.from('facts').insert({
          id: factId,
          document_id: docId,
          owner_id: testUserId,
          type: 'money',
          fact_type: 'money',
          quote: `Sample quote for ${proofType}`,
          page: 1,
          verified: proofType === 'VERIFIED',
          proof_type: proofType,
        });
        expect(error, `Failed to insert valid proof_type: ${proofType}`).toBeNull();
      }

      // 2. Verify non-canonical proof_type (e.g. legacy computed_from_table) is rejected
      const { error: invalidErr } = await adminClient.from('facts').insert({
        document_id: docId,
        owner_id: testUserId,
        type: 'money',
        fact_type: 'money',
        quote: 'Sample invalid proof',
        page: 1,
        verified: false,
        proof_type: 'computed_from_table',
      });
      expect(invalidErr).not.toBeNull();
      expect(invalidErr?.message).toMatch(/facts_proof_type_check/i);

      // 3. Verify verified = true without proof_type is rejected by DB constraint
      const factId = crypto.randomUUID();
      await adminClient.from('facts').insert({
        id: factId,
        document_id: docId,
        owner_id: testUserId,
        type: 'money',
        fact_type: 'money',
        quote: 'Valid initial fact',
        page: 1,
        verified: false,
        proof_type: null,
      });

      const { error: verifiedNoProofErr } = await adminClient
        .from('facts')
        .update({ verified: true, proof_type: null })
        .eq('id', factId);
      expect(verifiedNoProofErr).not.toBeNull();
      expect(verifiedNoProofErr?.message).toMatch(/facts_verified_proof_type_check/i);
    } finally {
      await adminClient.from('documents').delete().eq('id', docId);
    }
  });

  it('verifies analyses source_fact_ids grounding constraint in DB', async () => {
    const docId = crypto.randomUUID();
    await adminClient.from('documents').insert({
      id: docId,
      owner_id: testUserId,
      original_name: 'analyses_test.pdf',
      storage_path: `${testUserId}/analyses_test.pdf`,
      size_bytes: 1024,
      sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      status: 'done',
      stage: 'done',
    });

    try {
      // 1. Analysis with summary but empty source_fact_ids MUST fail constraint
      const { error: ungroundedErr } = await adminClient.from('analyses').insert({
        document_id: docId,
        owner_id: testUserId,
        summary: 'Fabricated analysis summary with no source facts',
        source_fact_ids: [],
      });
      expect(ungroundedErr).not.toBeNull();
      expect(ungroundedErr?.message).toMatch(/analyses_grounded_integrity_check/i);

      // 2. Analysis with summary and supporting source_fact_ids MUST succeed
      const fakeFactId = crypto.randomUUID();
      const { error: groundedErr } = await adminClient.from('analyses').insert({
        document_id: docId,
        owner_id: testUserId,
        summary: 'Grounded analysis summary with verified source fact',
        source_fact_ids: [fakeFactId],
      });
      expect(groundedErr).toBeNull();
    } finally {
      await adminClient.from('documents').delete().eq('id', docId);
    }
  });
});
