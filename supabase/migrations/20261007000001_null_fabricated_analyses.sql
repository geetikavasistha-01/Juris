-- Migration: Null out fabricated/template analysis text columns while preserving verification_rate and stats
ALTER TABLE public.analyses ALTER COLUMN summary DROP NOT NULL;
ALTER TABLE public.analyses ALTER COLUMN summary SET DEFAULT NULL;

UPDATE public.analyses
SET summary = NULL,
    key_findings = '[]'::jsonb,
    risks = '[]'::jsonb;
