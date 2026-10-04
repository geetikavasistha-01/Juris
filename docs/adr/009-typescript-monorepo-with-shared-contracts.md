# ADR-009: TypeScript Monorepo with Shared Contracts

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

In v1 (CivilLens), data shapes drifted between frontend and backend, resulting in empty visualizations and runtime deserialization failures. Juris requires guaranteed end-to-end contract alignment across all apps and services.

## Options Considered

- **pnpm Workspace Monorepo with Shared Contracts Package (`@juris/shared`):** Single repository with Zod schemas as the single source of truth for API inputs, outputs, error envelopes, and events.
- **Independent Repositories with Published npm Package:** Slow iteration cycle; version mismatch risk between API and Web.
- **OpenAPI / Swagger Generation Pipeline:** Additional tooling and generation steps required to achieve type parity.

## Decision

Adopt a TypeScript pnpm monorepo structure with `@juris/shared` exporting validated Zod schemas. Both `apps/api` and `apps/web` import directly from `@juris/shared`.

## Consequences

- **Positive:** Compile-time and runtime type safety; instant refactoring feedback; shared error envelope (`{ error: { code, message, details? } }`).
- **Negative / Trade-offs:** Requires monorepo build orchestration (handled cleanly via pnpm workspaces).

## Evidence Links

- PRD Section 1 (Rule R4), Section 6, Section 8
