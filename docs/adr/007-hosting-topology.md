# ADR-007: Hosting Topology (Spike S6)

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Juris operates an HTTP API, background processing workers, Supabase Postgres with Realtime, and a client Single Page Application. The processing pipeline emits progressive stage updates across 10 stages (`validating`, `extracting`, `chunking`, `embedding`, `classification`, `fact_extraction`, `verification`, `synthesis`, `building_visuals`, `done`). Clients require real-time updates with robust recovery across transient network dropouts.

## Question to Answer (Spike S6)

Do Supabase Realtime and background workers support reliable stage progression, RLS-isolated event delivery, and resilient client reconnection?

- **Pass criteria:** Real worker publishes real `job_events` through real Supabase Realtime to a real browser client (Playwright); monotonic event sequence enables clean polling deduplication; stage names align with classification and extraction semantics.

## Decision

**Adopt Supabase Realtime pub/sub on Postgres `job_events` with monotonic sequence numbers and REST polling recovery:**

1. **Table RLS & Replica Identity:** `public.job_events` has `REPLICA IDENTITY FULL;` and user-scoped `owner_id = auth.uid()` RLS policies. Supabase Realtime forwards insert events only to authorized user JWTs.
2. **Monotonic Event Sequence:** Each event has an incrementing integer `sequence` (1..10) per document job. The client tracks `lastSequence` and drops any duplicate or stale event (`sequence <= lastSequence`).
3. **Polling Recovery:** On WebSocket disconnection or reconnect, the client polls `SELECT * FROM job_events WHERE document_id = :id AND sequence > :lastSequence ORDER BY sequence ASC`. This seamlessly catches up any missed stages during network partitions.
4. **Stage Naming:** Clarified PRD `typing` stage as `classification` (identifying document type and civic schema).

## Consequences

- Real-time pipeline UI is completely resilient to network disconnects without missing stage transitions.
- Client state transitions are idempotent and monotonic.
- Multi-tenant isolation is enforced at the database RLS layer for both WebSockets and REST.

## Evidence Links

- `spikes/s6-realtime/run-spike.ts`
- `spikes/s6-realtime/results.json`
- `packages/shared/src/jobs.ts`
- `docs/evidence/phase-1-spikes.md`
