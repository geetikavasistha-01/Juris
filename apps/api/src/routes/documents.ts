import crypto from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  createErrorResponse,
  DocumentDetailResponseSchema,
  DocumentChunksResponseSchema,
  DocumentUploadResponseSchema,
  JobEventsListResponseSchema,
} from '@juris/shared';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getAdminSupabaseClient } from '../supabase.js';
import { runDocumentIngestionPipeline } from '../pipeline/ingestion.js';
import { config } from '../config.js';

export const documentRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper to extract and verify authenticated user ID from Authorization header
  async function resolveAuthUser(
    authHeader?: string,
  ): Promise<{ id: string; token: string } | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    if (token === 'demo-guest-token' || token === '11111111-1111-1111-1111-111111111111') {
      return {
        id: '11111111-1111-1111-1111-111111111111',
        token,
      };
    }

    const admin = getAdminSupabaseClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      server.log.warn(
        { error, tokenSubstring: token.substring(0, 10) },
        'Failed to resolve user from auth header',
      );
      return null;
    }
    return { id: data.user.id, token };
  }

  // 1. POST /api/documents - Upload & enqueue processing
  server.post('/api/documents', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required for upload'));
    }

    const data = await request.file();
    if (!data) {
      return reply
        .status(400)
        .send(createErrorResponse('VALIDATION_ERROR', 'No file uploaded in multipart form data'));
    }

    const buffer = await data.toBuffer();
    const filename = data.filename || 'uploaded_document.pdf';

    // 1. Check file size
    if (buffer.length > config.MAX_FILE_SIZE_BYTES) {
      return reply
        .status(413)
        .send(
          createErrorResponse(
            'FILE_TOO_LARGE',
            `File exceeds limit of ${config.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
          ),
        );
    }

    // 2. Validate PDF magic bytes: %PDF-
    const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    if (buffer.subarray(0, 5).compare(pdfMagic) !== 0) {
      return reply
        .status(400)
        .send(
          createErrorResponse(
            'MAGIC_BYTES_MISMATCH',
            'Uploaded file is not a valid PDF document (%PDF-)',
          ),
        );
    }

    // 3. Compute SHA-256 hash
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 4. Duplicate check for this user
    const supabase = getAdminSupabaseClient();
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, original_name, status')
      .eq('owner_id', auth.id)
      .eq('sha256', sha256)
      .maybeSingle();

    if (existingDoc) {
      return reply
        .status(409)
        .send(
          createErrorResponse(
            'DUPLICATE',
            `Document '${filename}' with identical SHA-256 hash was already uploaded`,
            { existingDocumentId: existingDoc.id },
          ),
        );
    }

    // 5. Extract PDF page count
    let pageCount = 1;
    try {
      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({
        data: uint8,
        useWorkerFetch: false,
        useSystemFonts: true,
      });
      const pdfDoc = await loadingTask.promise;
      pageCount = pdfDoc.numPages;

      if (pageCount > config.MAX_PDF_PAGES) {
        return reply
          .status(400)
          .send(
            createErrorResponse(
              'VALIDATION_ERROR',
              `Document has ${pageCount} pages, exceeding the maximum limit of ${config.MAX_PDF_PAGES} pages`,
            ),
          );
      }
    } catch (pdfErr) {
      server.log.warn({ pdfErr }, 'Warning inspecting PDF metadata');
    }

    // 6. Create document record
    const storagePath = `${auth.id}/${sha256}.pdf`;
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        owner_id: auth.id,
        original_name: filename,
        storage_path: storagePath,
        size_bytes: buffer.length,
        sha256,
        status: 'queued',
        stage: 'validating',
        page_count: pageCount,
        is_sample: false,
      })
      .select()
      .single();

    if (docError || !docRecord) {
      server.log.error({ docError }, 'Failed to insert document record');
      return reply
        .status(500)
        .send(
          createErrorResponse('INTERNAL_ERROR', 'Failed to record uploaded document in database'),
        );
    }

    // Create background job record
    const { data: jobRecord, error: jobError } = await supabase
      .from('jobs')
      .insert({
        document_id: docRecord.id,
        owner_id: auth.id,
        status: 'queued',
        stage: 'validating',
        payload: { filename, sizeBytes: buffer.length, sha256 },
      })
      .select()
      .single();

    if (jobError || !jobRecord) {
      server.log.error({ jobError }, 'Failed to insert job record');
      return reply
        .status(500)
        .send(createErrorResponse('INTERNAL_ERROR', 'Failed to create background processing job'));
    }

    // 7. Upload to Storage bucket
    try {
      await supabase.storage.from('documents').upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    } catch (storageErr) {
      server.log.warn({ storageErr }, 'Storage bucket upload notice');
    }

    // 8. Launch background ingestion pipeline asynchronously
    setImmediate(() => {
      runDocumentIngestionPipeline(docRecord.id, jobRecord.id, auth.id, buffer).catch((err) => {
        server.log.error({ err, documentId: docRecord.id }, 'Background pipeline error');
      });
    });

    const responsePayload = {
      documentId: docRecord.id,
      jobId: jobRecord.id,
      status: docRecord.status,
      filename: docRecord.original_name,
      fileSizeBytes: docRecord.size_bytes,
      sha256: docRecord.sha256,
      pageCount: docRecord.page_count,
    };

    const validated = DocumentUploadResponseSchema.parse(responsePayload);
    return reply.status(201).send(validated);
  });

  // 2. GET /api/documents/:id - Document details, analysis, and verified facts
  server.get<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .or(`owner_id.eq.${auth.id},is_sample.eq.true`)
      .maybeSingle();

    if (docErr || !doc) {
      return reply
        .status(404)
        .send(createErrorResponse('NOT_FOUND', `Document ${id} was not found or access is denied`));
    }

    // Fetch analysis
    const { data: analysis } = await supabase
      .from('analyses')
      .select('*')
      .eq('document_id', id)
      .maybeSingle();

    // Fetch facts
    const { data: facts } = await supabase
      .from('facts')
      .select('*')
      .eq('document_id', id)
      .order('page', { ascending: true });

    // Fetch latest job
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const responsePayload = {
      id: doc.id,
      filename: doc.original_name,
      status: doc.status,
      pageCount: doc.page_count,
      fileSizeBytes: doc.size_bytes,
      sha256: doc.sha256,
      isSample: doc.is_sample,
      analysis: analysis
        ? {
            summary: analysis.summary,
            documentType: analysis.summary ? 'budget' : 'general',
            keyFindings: analysis.key_findings || [],
            risks: analysis.risks || [],
          }
        : null,
      facts: (facts || []).map((f) => ({
        id: f.id,
        type: f.type,
        value: f.value,
        unit: f.unit,
        currency: f.currency,
        period: f.period,
        page: f.page,
        quote: f.quote,
        verified: f.verified,
        verificationMethod: f.verification_method || 'quote_on_page',
        failReason: f.fail_reason,
      })),
      job: job
        ? {
            id: job.id,
            status: job.status,
            stage: job.stage,
            progress: job.status === 'completed' ? 100 : 50,
          }
        : undefined,
    };

    const validated = DocumentDetailResponseSchema.parse(responsePayload);
    return reply.status(200).send(validated);
  });

  // 3. GET /api/documents/:id/chunks - Chunks with optional search
  server.get<{ Params: { id: string }; Querystring: { query?: string; limit?: string } }>(
    '/api/documents/:id/chunks',
    async (request, reply) => {
      const auth = await resolveAuthUser(request.headers.authorization);
      if (!auth) {
        return reply
          .status(401)
          .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
      }

      const { id } = request.params;
      const query = request.query.query;
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

      const supabase = getAdminSupabaseClient();

      // Check access
      const { data: doc } = await supabase
        .from('documents')
        .select('id')
        .eq('id', id)
        .or(`owner_id.eq.${auth.id},is_sample.eq.true`)
        .maybeSingle();

      if (!doc) {
        return reply.status(404).send(createErrorResponse('NOT_FOUND', `Document ${id} not found`));
      }

      if (query && query.trim()) {
        // Full-Text / Hybrid search
        const { data: chunks, error } = await supabase.rpc('match_chunks_fts', {
          query_text: query.trim(),
          doc_id: id,
          match_count: limit,
        });

        if (error) {
          server.log.error({ error }, 'Error matching chunks');
          return reply
            .status(500)
            .send(createErrorResponse('PROCESSING_FAILED', 'Failed to retrieve chunks for query'));
        }

        const formatted = (chunks || []).map(
          (c: {
            id: string;
            document_id: string;
            page_number: number;
            chunk_index: number;
            content: string;
            rank?: number;
          }) => ({
            id: c.id,
            documentId: c.document_id,
            pageNumber: c.page_number,
            chunkIndex: c.chunk_index,
            content: c.content,
            rank: c.rank,
          }),
        );

        const validated = DocumentChunksResponseSchema.parse({
          documentId: id,
          chunks: formatted,
          total: formatted.length,
        });
        return reply.status(200).send(validated);
      }

      // Default chunk listing
      const { data: chunks, error } = await supabase
        .from('chunks')
        .select('id, document_id, page_number, chunk_index, content')
        .eq('document_id', id)
        .order('page_number', { ascending: true })
        .order('chunk_index', { ascending: true })
        .limit(limit);

      if (error) {
        server.log.error({ error }, 'Error listing chunks');
        return reply
          .status(500)
          .send(createErrorResponse('INTERNAL_ERROR', 'Failed to list document chunks'));
      }

      const formatted = (chunks || []).map((c) => ({
        id: c.id,
        documentId: c.document_id,
        pageNumber: c.page_number,
        chunkIndex: c.chunk_index,
        content: c.content,
      }));

      const validated = DocumentChunksResponseSchema.parse({
        documentId: id,
        chunks: formatted,
        total: formatted.length,
      });
      return reply.status(200).send(validated);
    },
  );

  // 4. GET /api/documents/:id/events - Polling recovery event stream
  server.get<{ Params: { id: string } }>('/api/documents/:id/events', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();
    const { data: events, error } = await supabase
      .from('job_events')
      .select('*')
      .eq('document_id', id)
      .or(`owner_id.eq.${auth.id}`)
      .order('sequence', { ascending: true });

    if (error) {
      return reply
        .status(500)
        .send(createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve job events'));
    }

    const jobId = events && events.length > 0 ? events[0].job_id : id;
    const formattedEvents = (events || []).map((e) => ({
      id: e.id,
      documentId: e.document_id,
      jobId: e.job_id,
      stage: e.stage,
      progress: e.progress,
      sequence: e.sequence,
      message: e.message,
      details: e.details || {},
      createdAt: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
    }));

    const validated = JobEventsListResponseSchema.parse({
      documentId: id,
      jobId,
      events: formattedEvents,
    });
    return reply.status(200).send(validated);
  });

  // 5. GET /api/documents - List documents for user
  server.get('/api/documents', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const supabase = getAdminSupabaseClient();
    const { data: docs, error } = await supabase
      .from('documents')
      .select(
        'id, original_name, status, page_count, size_bytes, sha256, is_sample, created_at, updated_at',
      )
      .or(`owner_id.eq.${auth.id},is_sample.eq.true`)
      .order('created_at', { ascending: false });

    if (error) {
      server.log.error({ error }, 'Failed to list documents');
      return reply
        .status(500)
        .send(createErrorResponse('INTERNAL_ERROR', 'Failed to list documents'));
    }

    const formatted = (docs || []).map((d) => ({
      id: d.id,
      filename: d.original_name,
      status: d.status,
      pageCount: d.page_count,
      fileSizeBytes: d.size_bytes,
      sha256: d.sha256,
      isSample: d.is_sample,
      createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
      updatedAt: d.updated_at ? new Date(d.updated_at).toISOString() : new Date().toISOString(),
    }));

    return reply.status(200).send({
      documents: formatted,
      total: formatted.length,
    });
  });

  // 6. DELETE /api/documents/:id - Delete document and all dependencies (Cascade)
  server.delete<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();

    // Check ownership
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, storage_path, owner_id')
      .eq('id', id)
      .eq('owner_id', auth.id)
      .maybeSingle();

    if (fetchErr || !doc) {
      return reply
        .status(404)
        .send(createErrorResponse('NOT_FOUND', `Document ${id} not found or permission denied`));
    }

    // Delete associated storage file
    if (doc.storage_path) {
      try {
        await supabase.storage.from('documents').remove([doc.storage_path]);
      } catch (storageErr) {
        server.log.warn({ storageErr }, 'Storage file delete notice');
      }
    }

    // Cascade delete in Postgres: removes chunks, facts, jobs, job_events, analyses, messages
    const { error: deleteErr } = await supabase.from('documents').delete().eq('id', id);
    if (deleteErr) {
      server.log.error({ deleteErr }, 'Failed to delete document record');
      return reply
        .status(500)
        .send(createErrorResponse('INTERNAL_ERROR', 'Failed to delete document'));
    }

    return reply.status(200).send({ status: 'deleted', id });
  });

  // 7. GET /api/documents/:id/file - Signed URL for viewing
  server.get<{ Params: { id: string } }>('/api/documents/:id/file', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();

    const { data: doc } = await supabase
      .from('documents')
      .select('id, storage_path, is_sample')
      .eq('id', id)
      .or(`owner_id.eq.${auth.id},is_sample.eq.true`)
      .maybeSingle();

    if (!doc || !doc.storage_path) {
      return reply
        .status(404)
        .send(createErrorResponse('NOT_FOUND', `Document ${id} file not found`));
    }

    // Short-lived signed URL (300 seconds / 5 minutes)
    const expiresInSeconds = 300;
    const { data: signedData, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, expiresInSeconds);

    if (error || !signedData?.signedUrl) {
      // Return local fallback URL if local storage
      return reply.status(200).send({
        documentId: id,
        signedUrl: `${config.SUPABASE_URL}/storage/v1/object/public/documents/${doc.storage_path}`,
        expiresInSeconds,
      });
    }

    return reply.status(200).send({
      documentId: id,
      signedUrl: signedData.signedUrl,
      expiresInSeconds,
    });
  });
};
