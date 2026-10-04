# Juris

Civic document intelligence with verified facts, citations, and interactive visualizations.

## Product Overview

Juris extracts facts from government budgets, ordinances, and civic records, verifies every number in code against source pages, and renders interactive, trustworthy visualizations. Every claim and chart links directly to an audited page and quote.

## Requirements Status

Every capability is tracked against [requirements.yaml](requirements.yaml) and verified by CI test gates.

| Area      | Requirement ID               | Priority | Status      | Description                                                 |
| --------- | ---------------------------- | -------- | ----------- | ----------------------------------------------------------- |
| Ingestion | [ING-01](requirements.yaml)  | P0       | not_started | PDF upload, magic bytes, SHA-256, deduplication             |
| Ingestion | [ING-02](requirements.yaml)  | P0       | not_started | Pasted text input handling                                  |
| Ingestion | [ING-03](requirements.yaml)  | P0       | not_started | Async processing, live stages, restart survivability        |
| Ingestion | [ING-04](requirements.yaml)  | P0       | not_started | Machine failure codes and immediate non-retryable fail      |
| Ingestion | [ING-05](requirements.yaml)  | P1       | not_started | CSV/XLSX parsing and profiling                              |
| Ingestion | [ING-06](requirements.yaml)  | P2       | not_started | Scanned PDF and image vision pipeline (gated S4)            |
| Evidence  | [EVD-01](requirements.yaml)  | P0       | not_started | Fact extraction with verbatim quotes and pages              |
| Evidence  | [EVD-02](requirements.yaml)  | P0       | not_started | Deterministic fact verification in code                     |
| Evidence  | [EVD-03](requirements.yaml)  | P0       | not_started | Synthesis summary generated exclusively from verified facts |
| Evidence  | [EVD-04](requirements.yaml)  | P0       | not_started | Per-document verification rate display                      |
| Evidence  | [EVD-05](requirements.yaml)  | P1       | not_started | Cross-checks and page deduplication                         |
| Visuals   | [VIZ-01](requirements.yaml)  | P0       | not_started | Visuals constructed only from verified facts                |
| Visuals   | [VIZ-02](requirements.yaml)  | P0       | not_started | Initial visual trio (figures strip, allocation, trend)      |
| Visuals   | [VIZ-03](requirements.yaml)  | P1       | not_started | Extended visual catalog (revenue vs expenditure, etc.)      |
| Visuals   | [VIZ-04](requirements.yaml)  | P0       | not_started | Interactions: hover, filter, drill-down, export             |
| Visuals   | [VIZ-05](requirements.yaml)  | P1       | not_started | Period comparisons and URL view state                       |
| Visuals   | [VIZ-06](requirements.yaml)  | P0       | not_started | Honest empty states with diagnostic reasons                 |
| Chat      | [CHT-01](requirements.yaml)  | P0       | not_started | Hybrid retrieval with server-verified citations             |
| Chat      | [CHT-02](requirements.yaml)  | P0       | not_started | Honest abstention when context is absent                    |
| Chat      | [CHT-03](requirements.yaml)  | P0       | not_started | Streaming SSE and persisted conversation history            |
| Chat      | [CHT-04](requirements.yaml)  | P0       | not_started | Docked composer with citation chips linking to viewer       |
| Chat      | [CHT-05](requirements.yaml)  | P1       | not_started | Table query plan generation and execution                   |
| Chat      | [CHT-06](requirements.yaml)  | P1       | not_started | Quota enforcement and transparent limits                    |
| Chat      | [CHT-07](requirements.yaml)  | P2       | not_started | Cross-document retrieval and chat                           |
| Platform  | [AUTH-01](requirements.yaml) | P0       | not_started | Supabase Auth with Row-Level Security                       |
| Platform  | [AUTH-02](requirements.yaml) | P0       | not_started | Account and document complete deletion                      |
| Platform  | [LIB-01](requirements.yaml)  | P0       | not_started | Document library with computed statistics                   |
| Platform  | [LIB-02](requirements.yaml)  | P0       | not_started | Seeded public sample documents                              |
| Platform  | [PLT-01](requirements.yaml)  | P0       | not_started | Health endpoint verifying subsystem status                  |
| Platform  | [PLT-02](requirements.yaml)  | P0       | not_started | Per-route rate limiting and tenant quotas                   |
| Platform  | [PLT-03](requirements.yaml)  | P0       | not_started | Automated secrets policy enforcement                        |
| Platform  | [PLT-04](requirements.yaml)  | P0       | not_started | Structured JSON logging with trace correlation              |
| Platform  | [PLT-05](requirements.yaml)  | P0       | not_started | Comprehensive CI verification gates                         |
| Platform  | [PLT-06](requirements.yaml)  | P1       | not_started | Automated retention and artifact cleanup jobs               |

## Workspace Architecture

- `apps/web`: Vite + React + TypeScript web client with Tailwind design tokens.
- `apps/api`: Fastify + Zod API and background worker service.
- `packages/shared`: Shared contracts, Zod schemas, and error envelopes.
- `packages/evals`: Evaluation harness, gold sets, and accuracy metrics.
- `supabase`: Local migrations, seed data, and Supabase config.
- `e2e`: Playwright end-to-end and smoke tests.
- `docs`: Product Requirements Document (PRD), Architecture Decision Records (ADRs), threat model, and slice evidence.

## Local Development

```bash
# Install dependencies
pnpm install

# Run static checks and tests
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run check:forbidden
pnpm run check:requirements
pnpm run scan:secrets

# Run web app
pnpm --filter=@juris/web run dev

# Run API server
pnpm --filter=@juris/api run dev
```
