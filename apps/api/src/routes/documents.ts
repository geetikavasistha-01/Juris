import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
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

const require = createRequire(import.meta.url);
const pdfjsPkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
const standardFontDataUrl = path.join(pdfjsPkgDir, 'standard_fonts/');
const cMapUrl = path.join(pdfjsPkgDir, 'cmaps/');

export const documentRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Helper to extract and verify authenticated user ID from Authorization header
  async function resolveAuthUser(
    authHeader?: string,
  ): Promise<{ id: string; token: string; isAnonymous?: boolean } | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    if (token === 'demo-guest-token' || token === '11111111-1111-1111-1111-111111111111') {
      return {
        id: '11111111-1111-1111-1111-111111111111',
        token,
        isAnonymous: true,
      };
    }

    const admin = getAdminSupabaseClient();
    let user = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await admin.auth.getUser(token);
      if (data?.user) {
        user = data.user;
        break;
      }
      if (error && attempt === 2) {
        server.log.warn(
          { error, tokenSubstring: token.substring(0, 10) },
          'Failed to resolve user from auth header after retries',
        );
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }

    if (!user) return null;
    return { id: user.id, token, isAnonymous: false };
  }

  // 1. POST /api/documents - Upload & enqueue processing
  server.post('/api/documents', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required for upload'));
    }

    if (auth.isAnonymous) {
      return reply
        .status(403)
        .send(
          createErrorResponse(
            'FORBIDDEN',
            'Anonymous uploads are restricted. Please sign in to upload documents.',
          ),
        );
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

    // 2. Validate file format by extension and magic bytes (ING-01, ING-05, ING-06, ING-07)
    const lowerFilename = filename.toLowerCase();
    const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff]);
    const tiffLeMagic = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
    const tiffBeMagic = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);

    const hasPdfMagic = buffer.length >= 5 && buffer.subarray(0, 5).compare(pdfMagic) === 0;
    const isPdf = hasPdfMagic || lowerFilename.endsWith('.pdf');

    const hasPngMagic = buffer.length >= 8 && buffer.subarray(0, 8).compare(pngMagic) === 0;
    const hasJpegMagic = buffer.length >= 3 && buffer.subarray(0, 3).compare(jpegMagic) === 0;
    const hasTiffMagic =
      buffer.length >= 4 &&
      (buffer.subarray(0, 4).compare(tiffLeMagic) === 0 ||
        buffer.subarray(0, 4).compare(tiffBeMagic) === 0);
    const hasWebpMagic =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP';

    const isImage =
      hasPngMagic ||
      hasJpegMagic ||
      hasTiffMagic ||
      hasWebpMagic ||
      lowerFilename.endsWith('.png') ||
      lowerFilename.endsWith('.jpg') ||
      lowerFilename.endsWith('.jpeg') ||
      lowerFilename.endsWith('.webp') ||
      lowerFilename.endsWith('.tiff') ||
      data.mimetype.startsWith('image/');

    const isCsv =
      lowerFilename.endsWith('.csv') ||
      lowerFilename.endsWith('.tsv') ||
      data.mimetype === 'text/csv' ||
      data.mimetype === 'text/tab-separated-values';

    const isKml = lowerFilename.endsWith('.kml') || lowerFilename.endsWith('.gpx');
    const isGeoJson =
      isKml ||
      lowerFilename.endsWith('.geojson') ||
      lowerFilename.endsWith('.geo.json') ||
      data.mimetype === 'application/geo+json' ||
      data.mimetype === 'application/vnd.google-earth.kml+xml';

    if (!isPdf && !isCsv && !isGeoJson && !isImage) {
      return reply
        .status(400)
        .send(
          createErrorResponse(
            'MAGIC_BYTES_MISMATCH',
            'Uploaded file is not a supported format (PDF, CSV, TSV, GeoJSON, KML, PNG, JPG, TIFF, WEBP)',
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

    // 5. Extract page / row count
    let pageCount = 1;
    if (isPdf) {
      try {
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({
          data: uint8,
          standardFontDataUrl,
          cMapUrl,
          cMapPacked: true,
          useWorkerFetch: false,
          useSystemFonts: false,
          disableFontFace: true,
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
    }

    // 6. Create document record
    const ext = isPdf
      ? 'pdf'
      : isCsv
        ? lowerFilename.endsWith('.tsv')
          ? 'tsv'
          : 'csv'
        : isGeoJson
          ? isKml
            ? 'kml'
            : 'geojson'
          : isImage
            ? hasPngMagic || lowerFilename.endsWith('.png')
              ? 'png'
              : hasJpegMagic || lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg')
                ? 'jpg'
                : 'png'
            : 'pdf';

    const contentType = isPdf
      ? 'application/pdf'
      : isCsv
        ? 'text/csv'
        : isGeoJson
          ? isKml
            ? 'application/vnd.google-earth.kml+xml'
            : 'application/geo+json'
          : isImage
            ? hasJpegMagic || lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg')
              ? 'image/jpeg'
              : 'image/png'
            : 'application/octet-stream';

    const storagePath = `${auth.id}/${sha256}.${ext}`;
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
        contentType,
        upsert: true,
      });
    } catch (storageErr) {
      server.log.warn({ storageErr }, 'Storage bucket upload notice');
    }

    // 8. Launch background ingestion pipeline asynchronously
    setImmediate(() => {
      runDocumentIngestionPipeline(docRecord.id, jobRecord.id, auth.id, buffer, filename).catch(
        (err) => {
          server.log.error({ err, documentId: docRecord.id }, 'Background pipeline error');
        },
      );
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
      documentType: doc.document_type || 'generic',
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
      facts: (facts || []).map((f) => {
        let periodObj = null;
        if (f.period) {
          if (typeof f.period === 'object') {
            periodObj = f.period;
          } else {
            const str = String(f.period);
            const basis = /BE/i.test(str)
              ? 'BE'
              : /RE/i.test(str)
                ? 'RE'
                : /actual/i.test(str)
                  ? 'actual'
                  : 'none';
            periodObj = { basis, fiscalYear: str };
          }
        }

        const validTypes = [
          'financial_total',
          'receipt',
          'expenditure',
          'allocation',
          'tax_collection',
          'physical_quantity',
          'count',
          'percentage',
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
        const factType = validTypes.includes(f.type) ? f.type : 'allocation';

        return {
          id: f.id,
          label: f.label || `${factType} (${f.value ?? ''} ${f.unit ?? ''})`.trim() || 'Fact',
          type: factType,
          factType: f.fact_type || undefined,
          numericValue:
            f.numeric_value !== null && f.numeric_value !== undefined
              ? Number(f.numeric_value)
              : null,
          value: f.value !== null && f.value !== undefined ? Number(f.value) : null,
          unit: f.unit || null,
          currency: f.currency || null,
          period: periodObj,
          page: Number(f.page) || 1,
          quote: f.quote || '',
          verified: Boolean(f.verified),
          proofType: f.proof_type || null,
          verificationMethod: 'quote_on_page',
          failReason: f.fail_reason || null,
        };
      }),
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

  // 8. GET /api/documents/:id/review-queue
  server.get<{ Params: { id: string } }>(
    '/api/documents/:id/review-queue',
    async (request, reply) => {
      const auth = await resolveAuthUser(request.headers.authorization);
      if (!auth) {
        return reply
          .status(401)
          .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
      }

      const { id } = request.params;
      const supabase = getAdminSupabaseClient();

      const { data: items, error } = await supabase
        .from('review_queue')
        .select('*')
        .eq('document_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        server.log.error({ error }, 'Failed to fetch review queue');
        return reply
          .status(500)
          .send(createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve review queue'));
      }

      interface ReviewQueueDbRow {
        id: string;
        document_id: string;
        fact_id: string;
        reason: string;
        ocr_confidence?: number | null;
        status: 'pending' | 'approved' | 'rejected';
        reviewed_by?: string | null;
        reviewed_at?: string | null;
      }

      interface FactDbRow {
        id: string;
        type: string;
        quote: string;
        value: number | null;
        unit: string | null;
      }

      const rowItems = (items || []) as ReviewQueueDbRow[];
      const factIds = rowItems.map((r) => r.fact_id);
      const factMap = new Map<string, { label: string; quote: string }>();
      if (factIds.length > 0) {
        const { data: facts } = await supabase
          .from('facts')
          .select('id, type, quote, value, unit')
          .in('id', factIds);
        for (const f of (facts || []) as FactDbRow[]) {
          const label = `${f.type} (${f.value ?? ''} ${f.unit ?? ''})`.trim() || 'Fact';
          factMap.set(f.id, { label, quote: f.quote });
        }
      }

      return reply.status(200).send({
        items: rowItems.map((row) => {
          const fact = factMap.get(row.fact_id);
          return {
            id: row.id,
            documentId: row.document_id,
            factId: row.fact_id,
            reason: row.reason,
            ocrConfidence: row.ocr_confidence ? Number(row.ocr_confidence) : undefined,
            status: row.status,
            reviewedBy: row.reviewed_by,
            reviewedAt: row.reviewed_at,
            label: fact?.label || 'Extracted Fact',
            rawQuote: fact?.quote || undefined,
          };
        }),
      });
    },
  );

  // 9. POST /api/documents/:id/review-queue/:itemId/approve
  // Human review tool confirmation workflow (AGENTS.md Rule 8)
  server.post<{ Params: { id: string; itemId: string } }>(
    '/api/documents/:id/review-queue/:itemId/approve',
    async (request, reply) => {
      const auth = await resolveAuthUser(request.headers.authorization);
      if (!auth) {
        return reply
          .status(401)
          .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
      }

      const { id, itemId } = request.params;
      const supabase = getAdminSupabaseClient();

      // Fetch review item
      const { data: item, error: fetchErr } = await supabase
        .from('review_queue')
        .select('*')
        .eq('id', itemId)
        .eq('document_id', id)
        .maybeSingle();

      if (fetchErr || !item) {
        return reply
          .status(404)
          .send(createErrorResponse('NOT_FOUND', `Review item ${itemId} not found`));
      }

      const now = new Date().toISOString();

      // Update review queue item status
      const { data: updatedItem, error: updateErr } = await supabase
        .from('review_queue')
        .update({
          status: 'approved',
          reviewed_by: auth.id,
          reviewed_at: now,
        })
        .eq('id', itemId)
        .select()
        .single();

      if (updateErr) {
        server.log.error({ updateErr }, 'Failed to approve review queue item');
        return reply
          .status(500)
          .send(createErrorResponse('INTERNAL_ERROR', 'Failed to approve review item'));
      }

      // Transition corresponding fact to USER_CONFIRMED and verified: true
      await supabase
        .from('facts')
        .update({
          proof_type: 'USER_CONFIRMED',
          verified: true,
          fail_reason: null,
        })
        .eq('id', item.fact_id);

      return reply.status(200).send({
        success: true,
        item: {
          id: updatedItem.id,
          documentId: updatedItem.document_id,
          factId: updatedItem.fact_id,
          reason: updatedItem.reason,
          ocrConfidence: updatedItem.ocr_confidence
            ? Number(updatedItem.ocr_confidence)
            : undefined,
          status: updatedItem.status,
          reviewedBy: updatedItem.reviewed_by,
          reviewedAt: updatedItem.reviewed_at,
        },
      });
    },
  );

  // 10. POST /api/documents/:id/review-queue/:itemId/reject
  server.post<{ Params: { id: string; itemId: string } }>(
    '/api/documents/:id/review-queue/:itemId/reject',
    async (request, reply) => {
      const auth = await resolveAuthUser(request.headers.authorization);
      if (!auth) {
        return reply
          .status(401)
          .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
      }

      const { id, itemId } = request.params;
      const supabase = getAdminSupabaseClient();

      const { data: item, error: fetchErr } = await supabase
        .from('review_queue')
        .select('*')
        .eq('id', itemId)
        .eq('document_id', id)
        .maybeSingle();

      if (fetchErr || !item) {
        return reply
          .status(404)
          .send(createErrorResponse('NOT_FOUND', `Review item ${itemId} not found`));
      }

      const now = new Date().toISOString();

      const { data: updatedItem, error: updateErr } = await supabase
        .from('review_queue')
        .update({
          status: 'rejected',
          reviewed_by: auth.id,
          reviewed_at: now,
        })
        .eq('id', itemId)
        .select()
        .single();

      if (updateErr) {
        server.log.error({ updateErr }, 'Failed to reject review queue item');
        return reply
          .status(500)
          .send(createErrorResponse('INTERNAL_ERROR', 'Failed to reject review item'));
      }

      // Transition corresponding fact to REJECTED and verified: false
      await supabase
        .from('facts')
        .update({
          proof_type: 'REJECTED',
          verified: false,
          fail_reason: 'Rejected by human reviewer in review queue',
        })
        .eq('id', item.fact_id);

      return reply.status(200).send({
        success: true,
        item: {
          id: updatedItem.id,
          documentId: updatedItem.document_id,
          factId: updatedItem.fact_id,
          reason: updatedItem.reason,
          ocrConfidence: updatedItem.ocr_confidence
            ? Number(updatedItem.ocr_confidence)
            : undefined,
          status: updatedItem.status,
          reviewedBy: updatedItem.reviewed_by,
          reviewedAt: updatedItem.reviewed_at,
        },
      });
    },
  );

  // 11. GET /api/documents/:id/conflicts
  server.get<{ Params: { id: string } }>('/api/documents/:id/conflicts', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();

    const { data: facts } = await supabase.from('facts').select('*').eq('document_id', id);

    interface FactRecord {
      id: string;
      type: string;
      value: number | null;
      period?: string | null;
      page: number;
      quote: string;
      unit?: string | null;
    }

    const factList = (facts || []) as FactRecord[];
    const conflicts: Array<{
      id: string;
      subject: string;
      period: string | null;
      sourceA: {
        factId: string;
        page: number;
        value: number;
        quote: string;
      };
      sourceB: {
        factId: string;
        page: number;
        value: number;
        quote: string;
      };
      difference: number;
    }> = [];

    const grouped = new Map<string, FactRecord[]>();
    for (const f of factList) {
      const key = `${(f.type || '').toLowerCase()}_${f.period || 'all'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(f);
    }

    let conflictIndex = 0;
    for (const [, group] of grouped.entries()) {
      if (group.length >= 2) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            if (
              a.value !== null &&
              b.value !== null &&
              Math.abs(Number(a.value) - Number(b.value)) > 0.01
            ) {
              conflictIndex++;
              conflicts.push({
                id: `conflict_${conflictIndex}`,
                subject: a.type,
                period: a.period || null,
                sourceA: {
                  factId: a.id,
                  page: a.page || 1,
                  value: Number(a.value),
                  quote: a.quote || '',
                },
                sourceB: {
                  factId: b.id,
                  page: b.page || 1,
                  value: Number(b.value),
                  quote: b.quote || '',
                },
                difference: Math.abs(Number(a.value) - Number(b.value)),
              });
            }
          }
        }
      }
    }

    return reply.status(200).send({ conflicts });
  });

  // 12. GET /api/documents/:id/glossary
  server.get<{ Params: { id: string } }>('/api/documents/:id/glossary', async (request, reply) => {
    const auth = await resolveAuthUser(request.headers.authorization);
    if (!auth) {
      return reply
        .status(401)
        .send(createErrorResponse('AUTH_REQUIRED', 'Valid bearer token is required'));
    }

    const { id } = request.params;
    const supabase = getAdminSupabaseClient();

    const { data: defFacts } = await supabase
      .from('facts')
      .select('*')
      .eq('document_id', id)
      .eq('type', 'definition');

    interface DefinitionFactRecord {
      id: string;
      quote: string;
      page: number;
    }

    const terms = ((defFacts || []) as DefinitionFactRecord[]).map((f) => {
      const firstColon = f.quote.indexOf(':');
      const firstMeans = f.quote.toLowerCase().indexOf('means');
      let term = 'Statutory Term';
      if (firstColon > 0 && firstColon < 40) {
        term = f.quote.slice(0, firstColon).trim();
      } else if (firstMeans > 0 && firstMeans < 40) {
        term = f.quote.slice(0, firstMeans).trim();
      } else {
        term = f.quote.slice(0, 30).trim();
      }
      return {
        id: f.id,
        term,
        definition: f.quote,
        page: f.page || 1,
        quote: f.quote || '',
        factId: f.id,
      };
    });

    return reply.status(200).send({ terms });
  });
};
