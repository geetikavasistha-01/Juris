-- Enable pgvector extension for semantic chunk embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL DEFAULT 'pdf',
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  stage TEXT NOT NULL DEFAULT 'validating',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_code TEXT,
  error_message TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_owner_sha256 UNIQUE (owner_id, sha256)
);

-- 2. CHUNKS TABLE (Hybrid Search: pgvector + tsvector)
CREATE TABLE IF NOT EXISTS public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-004',
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON public.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON public.chunks USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.chunks USING hnsw (embedding vector_cosine_ops);

-- 3. FACTS TABLE (Evidence-backed extracted facts)
CREATE TABLE IF NOT EXISTS public.facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value NUMERIC,
  unit TEXT,
  currency TEXT,
  period TEXT,
  page INT NOT NULL,
  quote TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  fail_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facts_doc_id ON public.facts(document_id);
CREATE INDEX IF NOT EXISTS idx_facts_verified ON public.facts(document_id, verified);

-- 4. ANALYSES TABLE (Document summary, key findings, verification stats)
CREATE TABLE IF NOT EXISTS public.analyses (
  document_id UUID PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'general',
  summary TEXT NOT NULL DEFAULT '',
  key_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_rate NUMERIC NOT NULL DEFAULT 0.0,
  prompt_version TEXT NOT NULL DEFAULT 'v1.0',
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  timings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. VISUALIZATIONS TABLE (Honest charts generated strictly from verified facts)
CREATE TABLE IF NOT EXISTS public.visualizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_pages INT[] NOT NULL DEFAULT '{}',
  fact_ids UUID[] NOT NULL DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visualizations_doc_id ON public.visualizations(document_id);

-- 6. CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON public.messages(conversation_id);

-- 7. JOBS & JOB_EVENTS TABLE (Postgres-backed resilient job queue)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  stage TEXT NOT NULL DEFAULT 'validating',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  sequence INT NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_events_doc_seq ON public.job_events(document_id, sequence);

-- 8. JOB CLAIM FUNCTION (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_next_job(worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  document_id UUID,
  owner_id UUID,
  stage TEXT,
  payload JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.jobs j
  SET
    status = 'running',
    locked_at = now(),
    locked_by = worker_id,
    attempts = j.attempts + 1,
    updated_at = now()
  WHERE j.id = (
    SELECT id
    FROM public.jobs
    WHERE status = 'queued'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.id, j.document_id, j.owner_id, j.stage, j.payload;
END;
$$;

-- 9. ROW-LEVEL SECURITY (RLS) POLICIES ON EVERY TABLE
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visualizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- Documents RLS
CREATE POLICY "Users can manage their own documents"
  ON public.documents
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public read for sample documents"
  ON public.documents
  FOR SELECT
  USING (is_sample = true);

-- Chunks RLS
CREATE POLICY "Users can access their own document chunks"
  ON public.chunks
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public read for sample document chunks"
  ON public.chunks
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = chunks.document_id AND d.is_sample = true));

-- Facts RLS
CREATE POLICY "Users can access their own document facts"
  ON public.facts
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public read for sample document facts"
  ON public.facts
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = facts.document_id AND d.is_sample = true));

-- Analyses RLS
CREATE POLICY "Users can access their own document analyses"
  ON public.analyses
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public read for sample document analyses"
  ON public.analyses
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = analyses.document_id AND d.is_sample = true));

-- Visualizations RLS
CREATE POLICY "Users can access their own document visualizations"
  ON public.visualizations
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public read for sample document visualizations"
  ON public.visualizations
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = visualizations.document_id AND d.is_sample = true));

-- Conversations & Messages RLS
CREATE POLICY "Users can access their own conversations"
  ON public.conversations
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can access their own messages"
  ON public.messages
  FOR ALL
  USING (auth.uid() = owner_id);

-- Jobs & Job Events RLS
CREATE POLICY "Users can view their own jobs"
  ON public.jobs
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view their own job events"
  ON public.job_events
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Enable Supabase Realtime broadcast for job_events
ALTER TABLE public.job_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_events;

-- 10. VECTOR MATCH FUNCTION (pgvector cosine similarity)
CREATE OR REPLACE FUNCTION public.match_chunks (
  query_embedding vector(768),
  doc_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  page_number INT,
  chunk_index INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.page_number,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.chunks c
  WHERE c.document_id = doc_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 11. FULL-TEXT SEARCH MATCH FUNCTION (ts_rank ranking)
CREATE OR REPLACE FUNCTION public.match_chunks_fts (
  query_text TEXT,
  doc_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  page_number INT,
  chunk_index INT,
  content TEXT,
  rank FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.page_number,
    c.chunk_index,
    c.content,
    ts_rank(c.fts, plainto_tsquery('english', query_text))::FLOAT AS rank
  FROM public.chunks c
  WHERE c.document_id = doc_id
    AND c.fts @@ plainto_tsquery('english', query_text)
  ORDER BY ts_rank(c.fts, plainto_tsquery('english', query_text)) DESC
  LIMIT match_count;
END;
$$;

-- 12. HYBRID MATCH FUNCTION (Reciprocal Rank Fusion k=60)
CREATE OR REPLACE FUNCTION public.match_chunks_hybrid (
  query_text TEXT,
  query_embedding vector(768),
  doc_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  page_number INT,
  chunk_index INT,
  content TEXT,
  vector_score FLOAT,
  fts_score FLOAT,
  rrf_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH vector_ranks AS (
    SELECT
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.content,
      (1 - (c.embedding <=> query_embedding))::FLOAT AS v_score,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding ASC) AS v_rank
    FROM public.chunks c
    WHERE c.document_id = doc_id
    LIMIT 20
  ),
  fts_ranks AS (
    SELECT
      c.id,
      c.document_id,
      c.page_number,
      c.chunk_index,
      c.content,
      ts_rank(c.fts, plainto_tsquery('english', query_text))::FLOAT AS f_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(c.fts, plainto_tsquery('english', query_text)) DESC) AS f_rank
    FROM public.chunks c
    WHERE c.document_id = doc_id
      AND c.fts @@ plainto_tsquery('english', query_text)
    LIMIT 20
  )
  SELECT
    COALESCE(v.id, f.id) AS id,
    COALESCE(v.document_id, f.document_id) AS document_id,
    COALESCE(v.page_number, f.page_number) AS page_number,
    COALESCE(v.chunk_index, f.chunk_index) AS chunk_index,
    COALESCE(v.content, f.content) AS content,
    COALESCE(v.v_score, 0.0) AS vector_score,
    COALESCE(f.f_score, 0.0) AS fts_score,
    (COALESCE(1.0 / (60.0 + v.v_rank), 0.0) + COALESCE(1.0 / (60.0 + f.f_rank), 0.0))::FLOAT AS rrf_score
  FROM vector_ranks v
  FULL OUTER JOIN fts_ranks f ON v.id = f.id
  ORDER BY rrf_score DESC
  LIMIT match_count;
END;
$$;

