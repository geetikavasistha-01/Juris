-- Migration: 20261019000001_add_facts_label.sql
-- Description: Add nullable label column to facts table for human-readable fact titles

ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS label TEXT;

CREATE OR REPLACE VIEW public.document_facts AS SELECT * FROM public.facts;

COMMENT ON COLUMN public.facts.label IS 'Human-readable descriptive label or fact title proposed by extraction';
