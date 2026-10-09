-- Migration: 20261009000003_phase1_analyses_integrity.sql
-- Description: Phase 1 Task 3 (P1-T3) - Analyses integrity constraint (A-integrity, ADR-011)

-- 1. Add source_fact_ids array to analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS source_fact_ids UUID[] NOT NULL DEFAULT '{}';

-- 2. Backfill source_fact_ids from verified facts where any exist
UPDATE public.analyses a
SET source_fact_ids = COALESCE(
  (
    SELECT array_agg(f.id)
    FROM public.facts f
    WHERE f.document_id = a.document_id AND f.verified = true
  ),
  '{}'::uuid[]
);

-- 3. For any analyses row where no verified facts exist but summary or findings/risks are present,
-- null out summary and set empty arrays so the integrity CHECK can be applied (honoring Evidence Rule)
UPDATE public.analyses
SET
  summary = NULL,
  key_findings = '[]'::jsonb,
  risks = '[]'::jsonb
WHERE cardinality(source_fact_ids) = 0
  AND (summary IS NOT NULL OR key_findings <> '[]'::jsonb OR risks <> '[]'::jsonb);

-- 4. Apply strict integrity CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analyses_grounded_integrity_check'
  ) THEN
    ALTER TABLE public.analyses
      ADD CONSTRAINT analyses_grounded_integrity_check
      CHECK ((summary IS NULL AND key_findings = '[]'::jsonb AND risks = '[]'::jsonb) OR cardinality(source_fact_ids) > 0);
  END IF;
END $$;
