# ADR-003: Embeddings Provider and Dimension (Spike S2)

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Document chunks must be vectorized for hybrid retrieval in the Juris civic chat engine. The vector dimension impacts storage, index speed in pgvector (HNSW), and hosting memory limits.

## Question to Answer (Spike S2)

Which embeddings provider and dimension should be used?

- **Pass criteria:** Recall at 8 of at least 0.85 on 20 test civic questions; memory usage fits within the target host limits (free tier).

## Decision

**Adopt 768-dimensional embeddings (`text-embedding-004` / pgvector `vector(768)`) with PostgreSQL HNSW indexing and Reciprocal Rank Fusion (RRF with $k=60$) Hybrid Search:**

1. **Schema Definition:** `chunks.embedding vector(768)` with `CREATE INDEX idx_chunks_embedding ON public.chunks USING hnsw (embedding vector_cosine_ops)`.
2. **Hybrid Search RPC:** Combined vector similarity (`<=>`) with full-text search (`tsvector` `ts_rank`) inside Postgres stored procedure `match_chunks_hybrid`.
3. **Observed Performance:**
   - Vector-only Recall@8: **90.00%** (18/20)
   - FTS-only Recall@8: **25.00%** (5/20)
   - Hybrid (RRF) Recall@8: **90.00%** (18/20), meeting the $\ge 85\%$ threshold.

## Consequences

- Chunking pipeline normalizes text to 1000-character windows and computes 768-dim embeddings.
- RAG retrieval uses `match_chunks_hybrid` for sub-50ms civic document search in Postgres.

## Evidence Links

- `spikes/s2-embeddings/run.ts`
- `spikes/s2-embeddings/results.json`
- `docs/evidence/phase-1-spikes.md`
