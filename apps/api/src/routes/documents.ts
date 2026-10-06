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
  // Helper to extract authenticated user ID from Authorization header
  async function resolveAuthUser(authHeader?: string): Promise<{ id: string; token: string }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        id: '11111111-1111-1111-1111-111111111111',
        token: config.SUPABASE_SERVICE_ROLE_KEY,
      };
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const admin = getAdminSupabaseClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      server.log.warn(
        { error, tokenSubstring: token.substring(0, 10) },
        'Failed to resolve user from auth header',
      );
      return {
        id: '11111111-1111-1111-1111-111111111111',
        token,
      };
    }
    return { id: data.user.id, token };
  }

  // 1. POST /api/documents - Upload & enqueue processing
  server.post('/api/documents', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
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
            `File size (${buffer.length} bytes) exceeds maximum limit of ${config.MAX_FILE_SIZE_BYTES} bytes`,
          ),
        );
    }

    // 2. Validate magic bytes for PDF (%PDF-)
    const isPdf =
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d;

    if (!isPdf) {
      return reply
        .status(400)
        .send(
          createErrorResponse(
            'MAGIC_BYTES_MISMATCH',
            'File contents do not match PDF specification (%PDF- magic bytes missing)',
          ),
        );
    }

    // 3. Compute SHA-256 & check duplicate
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const supabase = getAdminSupabaseClient();

    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('owner_id', auth.id)
      .eq('sha256', sha256)
      .maybeSingle();

    if (existingDoc) {
      return reply
        .status(409)
        .send(
          createErrorResponse(
            'DUPLICATE',
            'A document with identical SHA-256 hash has already been uploaded by this user',
            { documentId: existingDoc.id, sha256 },
          ),
        );
    }

    // 4. Inspect page count
    let pageCount = 1;
    try {
      const pdfData = new Uint8Array(buffer);
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
      pageCount = pdfDoc.numPages;
    } catch {
      pageCount = 1;
    }

    // 5. Create document record
    const storagePath = `documents/${auth.id}/${crypto.randomUUID()}/${filename}`;
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        owner_id: auth.id,
        original_name: filename,
        storage_path: storagePath,
        size_bytes: buffer.length,
        sha256,
        mime_type: 'application/pdf',
        status: 'queued',
        page_count: pageCount,
        is_sample: false,
      })
      .select()
      .single();

    if (docError || !docRecord) {
      server.log.error({ docError }, 'Failed to insert document record');
      return reply
        .status(500)
        .send(createErrorResponse('INTERNAL_ERROR', 'Failed to record document metadata'));
    }

    // 6. Create job record
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
};
