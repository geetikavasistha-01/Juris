-- Migration: 20261009000001_phase1_documents_sources.sql
-- Description: Phase 1 Task 1 (P1-T1) - Add document_type to documents, integer width/height with CHECK to sources, backfill

-- 1. Add document_type to documents table
-- Allowed document types strictly: budget, notification, tender, dataset, map, generic
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'generic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_document_type_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_document_type_check
      CHECK (document_type IN ('budget', 'notification', 'tender', 'dataset', 'map', 'generic'));
  END IF;
END $$;

-- 2. Backfill document_type from analyses.doc_type where it maps directly, else default generic
-- Note: analyses.doc_type is kept for backwards compatibility; documents.document_type is authoritative.
UPDATE public.documents d
SET document_type = CASE
  WHEN a.doc_type IN ('budget', 'notification', 'tender', 'dataset', 'map', 'generic') THEN a.doc_type
  ELSE 'generic'
END
FROM public.analyses a
WHERE d.id = a.document_id;

-- 3. Ensure sources.width and sources.height are INTEGER with CHECK > 0 when not null
ALTER TABLE public.sources
  ALTER COLUMN width TYPE INTEGER USING ROUND(width)::INTEGER,
  ALTER COLUMN height TYPE INTEGER USING ROUND(height)::INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sources_width'
  ) THEN
    ALTER TABLE public.sources
      ADD CONSTRAINT chk_sources_width
      CHECK (width IS NULL OR width > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sources_height'
  ) THEN
    ALTER TABLE public.sources
      ADD CONSTRAINT chk_sources_height
      CHECK (height IS NULL OR height > 0);
  END IF;
END $$;

-- 4. Copy existing image dimensions from image_dimension facts into sources before removal in P1-T2
UPDATE public.sources s
SET
  width = COALESCE(s.width, f.value::INTEGER, (regexp_match(f.quote, '(\d+)\s*x\s*(\d+)'))[1]::INTEGER),
  height = COALESCE(s.height, (regexp_match(f.quote, '(\d+)\s*x\s*(\d+)'))[2]::INTEGER)
FROM public.facts f
WHERE s.document_id = f.document_id
  AND f.type = 'image_dimension'
  AND (s.width IS NULL OR s.height IS NULL);
