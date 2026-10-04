# ADR-002: Postgres-Backed Job Queue

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Document processing (PDF validation, text extraction, fact extraction, verification, synthesis) is an asynchronous multi-stage pipeline. The queue mechanism must survive worker crashes and server restarts without losing job state or creating orphaned work.

## Options Considered

- **Postgres Queue via `FOR UPDATE SKIP LOCKED`:** Native Postgres transactional locking, zero extra infrastructure, survives restarts, fully auditable in the database.
- **External Broker (Redis / BullMQ / RabbitMQ):** Additional stateful service to provision, configure, and monitor.
- **In-Memory Queue:** Violates ING-03 and PRD Rule R7; loses in-flight jobs on server restart or redeploy.

## Decision

Use a Postgres-backed queue with a `jobs` and `job_events` table using `FOR UPDATE SKIP LOCKED` (`claim_job` function).

## Consequences

- **Positive:** No secondary broker required; job updates and stage transitions are fully transactional; jobs automatically survive server restarts (ING-03).
- **Negative / Trade-offs:** Requires polling or Postgres notification triggers; requires explicit job claiming heartbeat to handle crashed workers.

## Evidence Links

- PRD Section 6 (Stack: Jobs)
- PRD Section 5 (ING-03)
