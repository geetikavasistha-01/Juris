-- Migration: 20261008000001_v2_evidence_graph.sql
-- Description: Juris v2 Evidence Graph, Relational Entities, Reconciliations, Flags, and Visual Specifications

-- 1. Extend facts table with v2 attributes
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS proof_type TEXT DEFAULT 'VERIFIED',
  ADD COLUMN IF NOT EXISTS span_id UUID,
  ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS normalized_value NUMERIC,
  ADD COLUMN IF NOT EXISTS original_text TEXT;

-- Compatibility view
CREATE OR REPLACE VIEW public.document_facts AS SELECT * FROM public.facts;

-- 2. Sources table
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  page_or_sheet INTEGER DEFAULT 1,
  width NUMERIC,
  height NUMERIC,
  sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sources_doc ON public.sources(document_id);

-- 3. Evidence Spans table
CREATE TABLE IF NOT EXISTS public.evidence_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  locator JSONB NOT NULL DEFAULT '{}'::jsonb,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_spans_doc ON public.evidence_spans(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_spans_source ON public.evidence_spans(source_id);

-- 4. Tables (Reconstructed tabular structures)
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  caption TEXT,
  unit TEXT,
  header JSONB NOT NULL DEFAULT '[]'::jsonb,
  cells JSONB NOT NULL DEFAULT '[]'::jsonb,
  structure_confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_doc ON public.tables(document_id);

-- 5. Datasets (CSV Profiling data)
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_datasets_doc ON public.datasets(document_id);

-- 6. Geo Layers (Geospatial datasets)
CREATE TABLE IF NOT EXISTS public.geo_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  crs TEXT DEFAULT 'WGS84',
  feature_count INTEGER NOT NULL DEFAULT 0,
  simplified JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geo_layers_doc ON public.geo_layers(document_id);

-- 7. Entities & Relations
CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  gazetteer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entities_doc ON public.entities(document_id);

CREATE TABLE IF NOT EXISTS public.relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  fact_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_relations_doc ON public.relations(document_id);

-- 8. Derived Facts, Reconciliations & Flags
CREATE TABLE IF NOT EXISTS public.derived_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  formula TEXT NOT NULL,
  source_fact_ids UUID[] NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  proof_type TEXT DEFAULT 'DERIVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_derived_facts_doc ON public.derived_facts(document_id);

CREATE TABLE IF NOT EXISTS public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  source_fact_ids UUID[] NOT NULL,
  stated_total NUMERIC,
  computed_total NUMERIC,
  delta NUMERIC,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reconciliations_doc ON public.reconciliations(document_id);

CREATE TABLE IF NOT EXISTS public.flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_fact_ids UUID[] NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flags_doc ON public.flags(document_id);

-- 9. Visual Specifications & Grounded Insights
CREATE TABLE IF NOT EXISTS public.visual_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  spec JSONB NOT NULL,
  fact_set_hash TEXT,
  rank INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visual_specs_doc ON public.visual_specs(document_id);

CREATE TABLE IF NOT EXISTS public.visual_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visual_id UUID NOT NULL REFERENCES public.visual_specs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'standard',
  element_key TEXT,
  sentences JSONB NOT NULL DEFAULT '[]'::jsonb,
  generator TEXT NOT NULL DEFAULT 'template',
  fact_set_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visual_insights_vis ON public.visual_insights(visual_id);
CREATE INDEX IF NOT EXISTS idx_visual_insights_doc ON public.visual_insights(document_id);

-- 10. Review Queue
CREATE TABLE IF NOT EXISTS public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  ocr_confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_queue_doc ON public.review_queue(document_id);

-- 11. Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derived_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

-- Apply RLS policies
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'sources', 'evidence_spans', 'tables', 'datasets', 'geo_layers',
    'entities', 'relations', 'derived_facts', 'reconciliations',
    'flags', 'visual_specs', 'visual_insights', 'review_queue'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Users can read own %1$I" ON public.%1$I;
      CREATE POLICY "Users can read own %1$I" ON public.%1$I
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = %1$I.document_id AND (d.owner_id = auth.uid() OR d.is_sample = true)
          )
        );

      DROP POLICY IF EXISTS "Service role full access on %1$I" ON public.%1$I;
      CREATE POLICY "Service role full access on %1$I" ON public.%1$I
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
    ', tbl);
  END LOOP;
END $$;
