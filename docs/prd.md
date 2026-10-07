# Juris - Product Requirements Document

Version 1.0 | Owner: Geetika Vasistha | Status: Ready to build | Target: complete, runnable on localhost

Note: this PRD is derived from the project structure and the problem log. Where a command name is assumed, check it against package.json files.

## 1. Product Summary

Juris is a document intelligence web app for dense public-finance and legal PDFs such as budget speeches. A user uploads a PDF. A background worker extracts text with page coordinates, chunks it, asks an LLM to propose structured facts (figures, allocations, periods), and then mechanically verifies every proposed fact against the source text. Only verified facts are shown as facts, summarized, or charted. Every number on screen is traceable to a quoted passage and a page number.

The defining promise: **Juris never shows text or numbers it cannot prove from the document.** Every previous problem in the log (fabricated summaries, schema drift, unproven analyses) is a violation of that promise, so the PRD is organized around enforcing it in code, in the database, and in tests.

## 2. Goals and Non-Goals

### Goals

1. Upload a text-based PDF (up to 50 pages by default, configurable) and get verified facts, chunks, visuals and an audit trail.
2. Guarantee provenance: each fact has quote, page, verification method and status.
3. Honest empty states: if something was not generated or could not be verified, say so.
4. Strict per-user isolation of documents, files and derived data.
5. WCAG 2.1 AA in light and dark themes, verified by automated scans on real populated pages.
6. One-command local setup and a single verification command that proves the whole system.

### Non-Goals (v1)

- OCR for scanned PDFs (detected and rejected with a clear message).
- Multi-user sharing, teams, billing, or public document links.
- Non-PDF modalities (the modality module detects them and rejects them gracefully).
- Production deployment and CI/CD hosting (local-first; a CI config is optional).
- Legal advice or interpretation. Footer disclaimers state this.

## 3. Users and Core Journeys

| Persona                     | Need                                                                         |
| :-------------------------- | :--------------------------------------------------------------------------- |
| Policy analyst / journalist | Find allocations and fiscal figures fast, with proof of where each came from |
| Student / researcher        | Skim a long document and trust that nothing is invented                      |
| Reviewer / evaluator        | Audit how each fact was extracted and verified                               |

Journeys:

1. **Sign in** with email and password, or as a guest, then land on the Document Library.
2. **Upload** a PDF via drag and drop. Client checks type and size only; the server is authoritative on everything else.
3. **Watch progress** on the Live Progress page (WebSocket primary, polling fallback) through the five stages.
4. **Inspect** the document: facts with verification badges, chunks, visuals, and (if generated) a grounded summary.
5. **Open a citation** in the Drawer to read the exact quote and page.
6. **Audit** what happened via the audit trail endpoint.
7. **Delete** a document and all its derived data.

## 4. Guiding Principles (Non-Negotiable)

1. **Provenance or silence.** No fact, summary, finding, risk or chart value without verified fact IDs behind it.
2. **Server is the single source of truth** for limits and validation. No duplicated client rules.
3. **Shared contracts.** API responses must parse against Zod schemas in packages/shared, in both the API and the web client.
4. **Real tests for real behavior.** Mocked UI-state tests never claim to prove pipeline or security behavior.
5. **No decorative or placeholder content** anywhere in the product or fixtures.
6. **No emojis** in UI copy, docs, or generated files.

## 5. System Architecture

```text
Browser (React 19, Vite, Tailwind, ECharts lazy)
   | REST (Fastify) + Supabase Realtime (WebSocket) + polling fallback
Fastify API  --- Supabase Auth (JWT validation)
   |                 Supabase Postgres (RLS) + private Storage bucket
   +-- enqueues job --> Worker (same package, separate process)
                          Extract -> Chunk -> Propose -> Verify -> Visualize
```

Components:

- **apps/web**: SPA, React Router v6, typed API client, auth provider, theme context (light, dark, system), design tokens in tokens.css.
- **apps/api**: Fastify server, route modules (auth, upload, documents, health), worker process for ingestion.
- **packages/shared**: error codes, document schemas, fact guards, text normalization, job types, modality detection, visual data helpers.
- **packages/evals**: fixtures with provenance hashes and a gold set, plus a run-evals harness.
- **supabase/**: migrations and seed data for local development.
- **e2e/**: Playwright suites split into real/ and ui-states/.

## 6. Functional Requirements

IDs map one-to-one to entries in requirements.yaml, and check-requirements.mjs fails if any ID lacks a test or code reference.

### 6.1 Authentication (JUR-AUTH)

- AUTH-1: Email/password sign-in and sign-up through Supabase Auth.
- AUTH-2: Guest sign-in via Supabase anonymous sign-in, clearly labelled as temporary.
- AUTH-3: API validates the Supabase JWT on every non-health route; invalid or missing token returns 401 with the standard error envelope.
- AUTH-4: Session state is exposed through one hook in lib/auth.tsx; protected routes redirect to the auth page.

### 6.2 Upload (JUR-UP)

- UP-1: Accept multipart PDF only. Verify magic bytes (%PDF-) server-side, not just MIME or extension.
- UP-2: Enforce max file size and DEFAULT_MAX_PDF_PAGES = 50 on the server. Return typed error codes (FILE_TOO_LARGE, TOO_MANY_PAGES, UNSUPPORTED_TYPE, NO_TEXT_LAYER).
- UP-3: Client dropzone validates type and size for fast feedback only; it must not check page count.
- UP-4: Store the file in a private bucket under {user_id}/{document_id}.pdf. Create the document row and a queued job in one transaction.
- UP-5: Reject PDFs with no extractable text layer with NO_TEXT_LAYER (no OCR in v1).

### 6.3 Ingestion Pipeline (JUR-PIPE)

Five stages, each recorded in jobs with status, started_at, finished_at, error.

1. **Extract** (pdf-extractor.ts): PDF.js, deterministic text items with page number and bounding coordinates. Same file must produce identical output (hash recorded).
2. **Chunk** (chunker.ts): semantic chunks preserving heading path and page range; normalized text stored alongside raw text.
3. **Propose** (LLM): for each chunk, request structured facts (label, value, unit, period {basis, fiscalYear}, quote, page, chunk_id). The model is instructed to copy the quote verbatim. Output is schema-validated; invalid items are dropped and counted.
4. **Verify** (verification.ts): normalize with text-normalization.ts, then (a) exact substring match of quote in the cited chunk, (b) fuzzy match above a documented threshold, otherwise failed. Also check that the numeric value appears inside the verified quote. Store verification_method (exact, fuzzy, none) and verified boolean. Failed facts are kept for audit but never rendered as facts.
5. **Visualize**: build visuals only from verified facts using packages/shared/visuals.ts (key figures, top allocations, period trends).

Pipeline requirements:

- PIPE-1: Stages are idempotent. Re-running a stage replaces its outputs inside a transaction.
- PIPE-2: Worker claims jobs with row locking (FOR UPDATE SKIP LOCKED) so two workers never process the same job.
- PIPE-3: Failures set job status to failed with an error code and message; the UI shows it through ErrorState.
- PIPE-4: Retry up to 3 times with backoff for transient LLM or network errors; never retry validation failures.
- PIPE-5: Progress events are published per stage so the UI can render them live.
- PIPE-6: verification_rate (verified / proposed) is stored on the analysis row and shown in the viewer.

### 6.4 Grounded Analysis (JUR-AN)

- AN-1: summary, key findings and risks are nullable and default to null.
- AN-2: Any generated analysis text must come with the IDs of the verified facts it uses. assertAnalysisDerivedFromVerifiedFacts in packages/shared/documents.ts rejects the write otherwise, and the API calls it before every insert.
- AN-3: v1 ships an optional "Generate grounded summary" action. The LLM receives only verified facts (label, value, period, quote) and must cite fact IDs per sentence. Sentences citing unknown or unverified IDs are dropped. If nothing survives, the field stays null.
- AN-4: When null, the viewer shows: "An analysis summary has not been generated for this document".

### 6.5 Document Viewer (JUR-VIEW)

- VIEW-1: Tabs: Facts, Chunks, Visuals, Summary. ARIA tabs with arrow-key navigation.
- VIEW-2: Each fact row shows label, value, unit, period, and a VerificationBadge (Verified, Unverified, Failed) with page citation.
- VIEW-3: Clicking a citation opens the Drawer with the Quote block and page. Focus is trapped; Esc closes and returns focus to the trigger.
- VIEW-4: Visuals include Key Figures, Top Allocations bar chart, fiscal trend line chart, each with an accessible data table alternative.
- VIEW-5: Empty, loading (Skeleton) and error states exist for every tab.

### 6.6 Library, Progress and Misc (JUR-LIB)

- LIB-1: Library lists the user's documents with status badge, page count, fact count, verification rate. Sorted by newest.
- LIB-2: Live Progress uses Realtime; if the socket drops, polling takes over within 5 seconds and continues to completion with no duplicate or lost events.
- LIB-3: Delete document removes the row, chunks, facts, visuals, analyses, jobs, and the storage object.
- LIB-4: GET /api/health reports API, database and worker heartbeat.
- LIB-5: Footer shows version and git SHA plus the legal disclaimer.
- LIB-6: Theme toggle (light, dark, system) persists and applies before first paint to avoid flash.

## 7. Data Model (Supabase Postgres)

| Table           | Key columns                                                                                                                      |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| documents       | id, owner_id, filename, storage_path, page_count, sha256, status, created_at                                                     |
| document_chunks | id, document_id, ordinal, heading_path, page_start, page_end, text, normalized_text                                              |
| document_facts  | id, document_id, chunk_id, label, value, unit, period_basis, fiscal_year, quote, page, verified, verification_method, created_at |
| jobs            | id, document_id, stage, status, attempts, error_code, error_message, locked_at, started_at, finished_at                          |
| analyses        | document_id, summary (null), key_findings (null), risks (null), source_fact_ids uuid[], verification_rate                        |
| visualizations  | id, document_id, kind, spec jsonb, source_fact_ids uuid[]                                                                        |
| audit_log       | id, document_id, actor, event, detail jsonb, created_at                                                                          |

Rules:

- Row Level Security on every table: owner_id = auth.uid() directly or through documents. Storage bucket is private with a matching policy.
- Cross-tenant access returns 404 NOT_FOUND, never 403, so existence is not leaked.
- A CHECK constraint on analyses: if summary, key_findings or risks is not null then cardinality(source_fact_ids) > 0.
- Migrations are forward-only. The existing three migrations stay; the third (null_fabricated_analyses) is the permanent record of the data fix.

## 8. API Contract

All errors use one envelope: { error: { code, message, requestId } }. All success bodies parse against schemas in packages/shared.

| Method and path                  | Purpose                                                                     |
| :------------------------------- | :-------------------------------------------------------------------------- |
| GET /api/health                  | API, DB, worker status                                                      |
| GET /api/me                      | Current user profile                                                        |
| POST /api/upload                 | Multipart PDF upload, returns document id and job id                        |
| GET /api/documents               | Library list                                                                |
| GET /api/documents/:id           | Detail: metadata, facts (shape DocumentFactDetailSchema), analysis, visuals |
| GET /api/documents/:id/chunks    | Chunks                                                                      |
| GET /api/documents/:id/audit     | Audit trail                                                                 |
| GET /api/documents/:id/file      | Raw PDF (owner only)                                                        |
| POST /api/documents/:id/analysis | Generate grounded summary (optional)                                        |
| DELETE /api/documents/:id        | Delete document and derived data                                            |

Fact shape (resolves the schema discrepancy): `{ id, label, quote, value, unit, page, verified, verificationMethod, period: { basis, fiscalYear } }`.

## 9. Non-Functional Requirements

- **Accessibility**: WCAG 2.1 AA, text contrast 4.5:1, non-text 3:1, verified by check-contrast.mjs on token pairs and by Axe on 12 page/theme combinations.
- **Performance**: initial web bundle under 300 KB gzipped (enforced by check-bundle.mjs); ECharts loaded on demand with only Bar, Line, Grid, Tooltip and Canvas renderer registered.
- **Security**: secrets scanning (secretlint), no external hosts in source or build output, service role key only on the server, magic-byte checks, per-user isolation tests.
- **Reliability**: idempotent stages, job locking, polling fallback, health endpoint.
- **Privacy**: no document content sent anywhere except the configured LLM provider; documented in the README.
- **Maintainability**: strict TypeScript, shared base tsconfig, ESLint, ADRs for each major decision.

## 10. Problem Register: Cause, Fix, Proof

| #   | Problem                                                                 | Fix                                                                                                                                                              | Proof that it stays fixed                                               |
| :-- | :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| 1   | Low contrast (2.49:1, 2.75:1) in dark mode; Axe sampling mid-transition | Adjust dark tokens (--text-subtle #A5B6CE, --btn-primary-text #0A1424); bg-surface on table containers; wait for the 250 ms transition to settle before scanning | check-contrast.mjs plus a11y-real.spec.ts (12-matrix)                   |
| 2   | UI rendered fabricated summaries and risks                              | Remove template strings; honest empty state                                                                                                                      | UI test for empty-state text; check-forbidden.mjs                       |
| 3   | Bundle over 800 KB from ECharts                                         | Lazy loader and modular registration                                                                                                                             | check-bundle.mjs threshold                                              |
| 4   | Duplicate client page-limit check                                       | Server authoritative (50 pages)                                                                                                                                  | Upload test asserting TOO_MANY_PAGES from the server                    |
| 5   | Pipeline generated unproven analysis text                               | Delete generation; assertAnalysisDerivedFromVerifiedFacts; nulling migration                                                                                     | Unit test on the guard; DB CHECK constraint; check-fixtures.mjs         |
| 6   | GET /documents/:id failed type validation                               | Map facts to DocumentFactDetailSchema with period { basis, fiscalYear }                                                                                          | Contract test parsing the real response with the shared schema          |
| 7   | Cross-tenant access risk                                                | RLS and 404 responses                                                                                                                                            | isolation.spec.ts (document and raw file)                               |
| 8   | Mocked and real tests mixed                                             | Separate e2e/ui-states and e2e/real                                                                                                                              | Directory rule enforced by check-forbidden.mjs (no page.route in real/) |
| 9   | Supabase auth timeout under parallel workers                            | Docker must be running; single global setup fetches keys once; deterministic local fallback keys                                                                 | real-helper.ts; Playwright globalSetup                                  |
| 10  | WebSocket drop stalls progress                                          | Polling fallback                                                                                                                                                 | socket-drop.spec.ts                                                     |
| 11  | Fixtures could hide authored text                                       | Provenance hashes; fail on authored summary, keyFindings, risks; --test-negative control                                                                         | check-fixtures.mjs --test-negative                                      |

## 11. Cleanup: Files and Parts to Remove or Merge

| Target                                                              | Action                                                                           | Reason                                                     |
| :------------------------------------------------------------------ | :------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| scripts/null-analyses.mjs                                           | Delete after confirming the migration ran                                        | One-off data fix; the SQL migration is the durable record  |
| apps/web/src/pages/DesignSystemPage.tsx and its route               | Remove from production routes; keep only behind import.meta.env.DEV, or delete   | Dev catalog should not ship                                |
| apps/api/src/server.ts vs index.ts                                  | Merge responsibilities: server.ts exports buildServer(), index.ts only starts it | Avoid two overlapping entry points; enables test injection |
| apps/web/src/lib/echarts.ts and echarts-setup.ts                    | Merge into one lazy module                                                       | Two files for one concern                                  |
| Client page-count validation code and its tests                     | Remove                                                                           | Server authoritative                                       |
| Any template summary, risk or finding strings in web, api, fixtures | Remove                                                                           | Violates principle 1                                       |
| Unused components in components/ui (check with a usage scan)        | Remove if no imports                                                             | Dead code                                                  |
| Unused dependencies                                                 | Run `pnpm dlx depcheck` per package and remove                                   | Smaller installs and bundle                                |
| Duplicate or stale ADRs and evidence logs in docs/                  | Keep ADRs; shrink data-integrity-and-review-pass.md to a short errata plus links | Evidence should be regenerated, not hand-maintained        |
| supabase/seed.sql                                                   | Keep only minimal non-document seed (no fake documents or facts)                 | Seeded fake facts conflict with principle 5                |
| Root-level tsconfig.json                                            | Keep as references-only; all options live in tsconfig.base.json                  | Single source of compiler settings                         |
| Build output, .env files, node_modules in git                       | Ensure .gitignore covers them                                                    | Hygiene                                                    |

## 12. Build and Fix Plan (Single Pass, Ordered)

### Phase 0: Baseline and cleanup

1. `git checkout -b finalize-v1` and run `pnpm install`.
2. Apply the cleanup table in section 11.
3. Gate: `pnpm -r typecheck` and `pnpm lint` pass; app still builds.

### Phase 1: Contracts and database

1. Confirm schemas in packages/shared match section 8 exactly (fact shape, error envelope, job stages).
2. Add a migration `20261008000000_integrity_constraints.sql`: RLS review, the analyses CHECK constraint, indexes on documents(owner_id), document_facts(document_id, verified), jobs(status, locked_at), and ON DELETE CASCADE from documents.
3. Gate: `supabase db reset` applies all migrations cleanly; an RLS test confirms user B sees zero of user A's rows.

### Phase 2: Backend completion

1. Refactor server.ts and index.ts as described.
2. Implement upload checks UP-1 to UP-5 with typed errors.
3. Implement job claiming with SKIP LOCKED, stage idempotency, retries and heartbeat.
4. Complete Verify: normalized exact match, fuzzy fallback, numeric-in-quote check; write verification_method.
5. Add DELETE, audit and optional analysis endpoints; every response parsed against shared schemas in a contract test.
6. Gate: API unit and integration tests pass; recorded fixture run reproduces the same verification_rate.

### Phase 3: Frontend completion

1. Wire every page to the typed client; add Skeleton, EmptyState and ErrorState to each data view.
2. Implement protected routes, delete action with confirmation, theme init script in index.html to prevent flash.
3. Merge ECharts loader; confirm chart tabs show data tables.
4. Confirm tokens meet contrast for every foreground and background pair, light and dark.
5. Gate: `pnpm --filter web build` passes check-bundle and check-tokens.

### Phase 4: Tests and evidence

1. ui-states: app shell, keyboard (focus trap, Esc, arrow tabs), smoke with console-error audit.
2. real: upload flow with docs/pdf/test_upload.pdf, socket-drop, isolation, a11y-real with the 250 ms settle wait.
3. Add real tests for: oversized and non-PDF upload rejection, delete cascade, retry on a forced transient failure, summary stays null without generation.
4. Gate: full suite green twice in a row (flakiness check).

### Phase 5: Docs and final audit

1. Update README quickstart to match section 13 exactly; regenerate the evidence log from actual command output.
2. Run the full verification command (section 14). Tag v1.0.0.

## 13. Run Everything on Localhost

### Prerequisites

- Node.js 20 or newer, pnpm 9 or newer
- Docker Desktop running
- Supabase CLI (`brew install supabase/tap/supabase`)
- An LLM provider API key for the Propose stage (optional for browsing fixtures, required for new uploads)

### Steps

```bash
cd /Users/geetikavasistha/Juris
pnpm install

# 1. Start local Supabase (Postgres, Auth, Realtime, Storage)
supabase start
supabase status -o env

# 2. Apply migrations and seed from scratch
supabase db reset
```

## 14. Definition of Done and Verification Commands

```bash
pnpm check:fixtures && pnpm check:fixtures -- --test-negative
pnpm check:tokens && pnpm check:contrast
pnpm check:external-hosts && pnpm check:forbidden
pnpm check:requirements
pnpm typecheck && pnpm lint
pnpm test
pnpm build && pnpm check:bundle
pnpm e2e
```
