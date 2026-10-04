# ADR-007: Hosting Topology (Spike S6)

- **Status:** Proposed
- **Date:** 2026-10-04

## Context

Juris operates an HTTP API, background processing workers, Supabase Postgres with Realtime, and a client Single Page Application. The hosting infrastructure must operate sustainably within targeted hosting tiers.

## Question to Answer (Spike S6)

Do Render, Supabase, and Realtime work reliably together on free/standard tiers?

- **Pass criteria:** Hello-world API plus worker plus browser Realtime works end to end; cold start and memory limits measured; limits and caveats documented.
- **Fallback:** Different host for the background worker service.

## Options Considered

- **Render (API and Worker) + Netlify (Web) + Supabase (Database/Auth/Storage):** Baseline topology outlined in PRD Section 6.
- **Fly.io / Railway / Render Worker:** Alternate container hosts if worker memory requires dedicated background pooling.

## Decision

Pending results of Spike S6.

## Consequences

Defines CI/CD deploy targets and production deployment manifests.

## Evidence Links

- PRD Section 6 & 11 (Spike S6)
