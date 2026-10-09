-- Migration: 20261009000002_phase1_facts_constraints.sql
-- Description: Phase 1 Task 2 (P1-T2) - Semantic fact_type, proof_type CHECK constraints, numeric_value scale normalization (GAP-01, GAP-02, GAP-03, GAP-06, GAP-07)

-- 1. Remove legacy image_dimension facts (GAP-03)
-- Image dimensions are structural source metadata and were migrated to sources.width/height in P1-T1.
DELETE FROM public.facts WHERE type = 'image_dimension';

-- 2. Add fact_type column to facts
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS fact_type TEXT;

-- 3. Backfill fact_type from legacy type values
UPDATE public.facts
SET fact_type = CASE
  WHEN type IN ('financial_allocation', 'financial_total', 'allocation', 'expenditure', 'receipt', 'tax_collection', 'financial', 'money') THEN 'money'
  WHEN type IN ('statistic', 'percentage', 'count', 'physical_quantity', 'measure') THEN 'measure'
  WHEN type IN ('date', 'date_span') THEN 'date'
  WHEN type = 'place' THEN 'place'
  WHEN type = 'entity' THEN 'entity'
  WHEN type = 'obligation' THEN 'obligation'
  WHEN type = 'definition' THEN 'definition'
  WHEN type = 'relation' THEN 'relation'
  WHEN type = 'identifier' THEN 'identifier'
  WHEN currency IS NOT NULL THEN 'money'
  ELSE 'measure'
END
WHERE fact_type IS NULL;

-- 4. Enforce NOT NULL and CHECK constraint for the 9 canonical semantic fact types
ALTER TABLE public.facts
  ALTER COLUMN fact_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facts_fact_type_check'
  ) THEN
    ALTER TABLE public.facts
      ADD CONSTRAINT facts_fact_type_check
      CHECK (fact_type IN ('money', 'measure', 'date', 'place', 'entity', 'obligation', 'definition', 'relation', 'identifier'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facts_fact_type ON public.facts(fact_type);

-- Ensure backwards-compatibility for existing writers: auto-populate fact_type from type if not supplied
CREATE OR REPLACE FUNCTION public.trg_facts_sync_fact_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fact_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.fact_type := CASE
      WHEN NEW.type IN ('financial_allocation', 'financial_total', 'allocation', 'expenditure', 'receipt', 'tax_collection', 'financial', 'money') THEN 'money'
      WHEN NEW.type IN ('statistic', 'percentage', 'count', 'physical_quantity', 'measure') THEN 'measure'
      WHEN NEW.type IN ('date', 'date_span') THEN 'date'
      WHEN NEW.type = 'place' THEN 'place'
      WHEN NEW.type = 'entity' THEN 'entity'
      WHEN NEW.type = 'obligation' THEN 'obligation'
      WHEN NEW.type = 'definition' THEN 'definition'
      WHEN NEW.type = 'relation' THEN 'relation'
      WHEN NEW.type = 'identifier' THEN 'identifier'
      WHEN NEW.currency IS NOT NULL THEN 'money'
      ELSE 'measure'
    END;
  END IF;
  IF NEW.verified = true AND NEW.proof_type IS NULL THEN
    NEW.proof_type := 'VERIFIED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facts_sync_fact_type_before ON public.facts;
CREATE TRIGGER trg_facts_sync_fact_type_before
  BEFORE INSERT ON public.facts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_facts_sync_fact_type();

-- 5. Add numeric_value NUMERIC(18,4) with scale normalization documentation
-- Stores canonical scaled quantities: e.g. 52,000 Crore stored as 520000000000.0000, 18% as 0.1800.
-- NUMERIC(18,4) accommodates up to 99,999,999,999,999.9999 (~100 trillion), sufficient for national union budgets.
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(18,4);

COMMENT ON COLUMN public.facts.numeric_value IS 'Canonical scale-normalized numerical value (e.g. 52,000 Crore stored as 520000000000.0000, 18% stored as 0.1800)';

UPDATE public.facts
SET numeric_value = ROUND(COALESCE(normalized_value, value), 4)
WHERE numeric_value IS NULL AND (normalized_value IS NOT NULL OR value IS NOT NULL);

-- 6. Canonicalize proof_type and enforce 9 PRD proof types (GAP-01, GAP-02, GAP-07)
-- Non-canonical proof strings (computed_from_table, geo_parsed, ocr_crosscheck) were never verified by dual-computation or OCR.
UPDATE public.facts
SET verified = false, proof_type = NULL
WHERE proof_type IN ('computed_from_table', 'geo_parsed', 'ocr_crosscheck');

-- Standardize case if lowercase verified exists
UPDATE public.facts
SET proof_type = 'VERIFIED'
WHERE proof_type = 'verified';

-- Quarantine any remaining non-canonical strings
UPDATE public.facts
SET verified = false, proof_type = NULL
WHERE proof_type IS NOT NULL
  AND proof_type NOT IN ('VERIFIED', 'VERIFIED_OCR', 'COMPUTED', 'DERIVED', 'USER_CONFIRMED', 'ESTIMATED', 'CONFLICT', 'UNVERIFIABLE', 'REJECTED');

-- Remove default 'VERIFIED' to prevent unverified facts from silently inheriting verified status
ALTER TABLE public.facts ALTER COLUMN proof_type DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facts_proof_type_check'
  ) THEN
    ALTER TABLE public.facts
      ADD CONSTRAINT facts_proof_type_check
      CHECK (proof_type IS NULL OR proof_type IN ('VERIFIED', 'VERIFIED_OCR', 'COMPUTED', 'DERIVED', 'USER_CONFIRMED', 'ESTIMATED', 'CONFLICT', 'UNVERIFIABLE', 'REJECTED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facts_verified_proof_type_check'
  ) THEN
    ALTER TABLE public.facts
      ADD CONSTRAINT facts_verified_proof_type_check
      CHECK (verified = false OR (verified = true AND proof_type IS NOT NULL));
  END IF;
END $$;

-- 7. Refresh document_facts compatibility view
CREATE OR REPLACE VIEW public.document_facts AS SELECT * FROM public.facts;
