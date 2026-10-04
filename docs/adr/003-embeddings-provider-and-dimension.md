# ADR-003: Embeddings Provider and Dimension (Spike S2)

- **Status:** Proposed
- **Date:** 2026-10-04

## Context

Document chunks must be vectorized for hybrid retrieval in the Juris chat engine. The vector dimension impacts storage, index speed in pgvector, and hosting memory limits.

## Question to Answer (Spike S2)

Which embeddings provider and dimension should be used?

- **Pass criteria:** Recall at 8 of at least 0.85 on 20 test civic questions; memory usage fits within the target host limits (free tier).
- **Fallback:** Alternative hosted embedding API or reduced dimension model.

## Options Considered

- **Google Gemini Embeddings (text-embedding-004):** 768 dimensions, hosted API, consistent with LLM provider.
- **Local Transformers / Xenova/Transformers.js:** Self-hosted on Node worker, eliminates external API calls but consumes local memory.
- **Alternative Hosted Embeddings (e.g. OpenAI / Voyage / Cohere):** Additional API dependency.

## Decision

Pending results of Spike S2.

## Consequences

Determines column definition `embedding vector(N)` in Postgres migrations and chunking pipeline.

## Evidence Links

- PRD Section 11 (Spike S2)
