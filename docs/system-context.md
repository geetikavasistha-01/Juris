# Juris System Context & Architecture Manual

Authoritative context and architectural guide for AI coding agents and engineers working on the Juris codebase.

---

## 1. System Vision & Core Invariants

Juris is an evidence-first document intelligence platform for dense civic, financial, and legal files (budgets, legislative bills, tenders, datasets, and geospatial maps).

### The Defining Promise

**Juris never displays text or numbers that cannot be proven from the source document.**

Every fact, metric, chart series point, and narrative sentence presented to the user must carry a machine-verifiable chain of custody back to raw document coordinates, cells, or features. If a fact cannot be proven, the system stays silent or quarantines the item to an audit trail.

### Non-Negotiable Invariants

1. **Provenance or Silence:** Zero unverified facts appear in overview visuals or summaries. Every visual data point must link to source fact IDs.
2. **Server is Authoritative:** File validation, size caps, rate limits, and verification logic live on the server. The web client never implements independent validation rules.
3. **Contracts First:** All data shapes, request/response bodies, and domain models are defined in `packages/shared` using Zod. No duplicated types exist between backend and frontend.
4. **No Fabricated Data in Product Code:** Mock data, simulated stats, and invented summaries are strictly forbidden in product code. Fixtures and recorded replays are permitted only in automated test suites.
5. **Zero Emojis:** Never use emojis in UI copy, documentation, commit messages, or generated code.
6. **Strict Secret Hygiene:** Secrets (such as `GEMINI_API_KEY`) must only be read from process environment variables. Never print, log, or expose secrets. Never use `VITE_` variables for secrets.
7. **Fail-Closed Replay Mode:** In `LLM_MODE=replay`, if a recording is missing or invalid, the system must throw an explicit error; it must never silently fall back to live APIs or invented data.
8. **Human Approval Authority:** The AI model never marks review queue items as approved. Only human users via the review tool may set `USER_CONFIRMED`.

---

## 2. Monorepo Topology & Boundaries

Juris is organized as a pnpm workspace monorepo. Changes must strictly respect package boundaries.

```text
juris/
├── packages/
│   ├── shared/         # Authoritative Zod schemas, domain models, verifiers, normalizers
│   ├── model/          # Encapsulated LLM provider interface (Gemini, Ollama, replay store)
│   ├── geodata/        # Bundled offline boundary and gazetteer assets (< 3 MB)
│   └── evals/          # Multi-modality evaluation gold sets and benchmark runners
├── apps/
│   ├── api/            # Fastify backend, REST routes, pipeline router, Supabase clients
│   ├── worker/         # Background job processor (claims jobs from Postgres queue)
│   └── web/            # React + Vite frontend, design tokens, ECharts, storyboard
├── supabase/
│   └── migrations/     # Postgres 15+ DDL, pgvector, and Row Level Security policies
├── docs/
│   ├── prd.md          # Version 1.0 Product Requirements Document
│   ├── prd-v2.md       # Version 2.0 Multimodal Extraction & Visual Intelligence PRD
│   ├── roadmap.md      # 12-Phase Unified Roadmap and gating criteria
│   ├── system-context.md # This architecture manual
│   ├── known-gaps.md   # Technical debt and schema discrepancies registry
│   ├── adr/            # Architecture Decision Records
│   └── evidence/       # Phase-by-phase execution and verification reports
└── samples/            # Real-world verification documents (budget PDFs, CSV, GeoJSON)
```

### Slice Discipline (`AGENTS.md` Rule 2 & 3)

- Never modify files outside the active slice scope.
- Always change `packages/shared` before changing `apps/api` or `apps/web`.
- Never duplicate interfaces across packages.

---

## 3. The Evidence Graph Data Model

All incoming modalities (PDF, image, CSV, GeoJSON) normalize into a unified Evidence Graph:

```text
Source -> Evidence Span -> Fact -> Relation -> Derived Fact
                           ├── Reconciliation
                           └── Flag
```

### 3.1 Evidence Span Kinds & Verifiers

| Span Kind      | Pointer / Locator                        | Verifier Implementation                                                                        |
| :------------- | :--------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `text_span`    | `page`, `bbox`, `char_range`             | `verifiers/text.ts`: Verbatim or whitespace-normalized quote, numbers, units, and dates.       |
| `table_cell`   | `table_id`, `row`, `col`, `page`, `bbox` | `verifiers/table.ts`: Cell text match, header hierarchy, and row/column sum checks.            |
| `image_region` | `image_id`, `bbox`, `ocr_tokens`         | `verifiers/ocr.ts`: Fuzzy token match against OCR tokens inside bbox above floor (80).         |
| `csv_range`    | `column`, `row_range`                    | `verifiers/csv-dual.ts`: Dual computation agreement between JavaScript and DuckDB SQL.         |
| `geo_feature`  | `layer`, `feature_id`, `property_key`    | `verifiers/geo.ts`: Direct attribute read, geometry validation, reprojection, and turf checks. |

### 3.2 Semantic Fact Types (9 PRD Types)

1. `money`: Allocations, expenditures, revenue, tax collections (amount, currency, scale, fiscal period, estimate type: BE, RE, Actual).
2. `measure`: Physical quantities, percentages, ratios, growth rates, counts.
3. `date`: Effective dates, deadlines, fiscal periods, tenures.
4. `place`: Administrative regions, states, districts, cities (linked to gazetteer).
5. `entity`: Government ministries, departments, public authorities, acts, schemes.
6. `obligation`: Statutory duties (actor, action, object, deadline, penalty).
7. `definition`: Defined legal and financial terms with quoted definitions (feeds glossary).
8. `relation`: Directed relationships (`allocates_to`, `funds`, `amends`, `part_of`).
9. `identifier`: Official scheme codes, budget line items, gazetteer IDs.

### 3.3 Proof Types (9 PRD Statuses)

| Proof Type       | Meaning                                                     | Overview Visibility                    |
| :--------------- | :---------------------------------------------------------- | :------------------------------------- |
| `VERIFIED`       | Quote and numbers verified against source text.             | Visible                                |
| `VERIFIED_OCR`   | Matched against OCR tokens at or above confidence floor.    | Visible (OCR badge)                    |
| `COMPUTED`       | Recomputed and verified by two independent implementations. | Visible                                |
| `DERIVED`        | Calculated via arithmetic formula from verified facts.      | Visible (formula hover)                |
| `USER_CONFIRMED` | Low-confidence item reviewed and approved by human user.    | Visible (user badge)                   |
| `ESTIMATED`      | Extracted from chart graphics or approximate visuals.       | Hidden by default (toggleable, dashed) |
| `CONFLICT`       | Two verified sources state contradictory values.            | Visible (flagged, both shown)          |
| `UNVERIFIABLE`   | Insufficient source evidence or failed checks.              | Excluded from visuals (audit only)     |
| `REJECTED`       | Mathematically or syntactically falsified.                  | Excluded from visuals (audit only)     |

---

## 4. Database Schema & Security Architecture

### Postgres Engine & Extensions

- **Postgres 15+** managed via Supabase CLI.
- **pgvector:** Used for chunk semantic embeddings (`vector(1536)`).
- **Full-Text Search:** Generated tsvector columns for lexical search.

### Multi-Tenant Isolation (RLS)

- Every user-facing table (`documents`, `chunks`, `facts`, `analyses`, `visual_specs`, `visual_insights`, `tables`, `datasets`, `geo_layers`, `review_queue`) enforces Postgres **Row Level Security (RLS)**.
- Tenancy is anchored to `documents.owner_id = auth.uid()`.
- Child tables link via `document_id` with foreign key cascade delete.
- Search RPCs (`match_chunks`, `match_chunks_fts`, `match_chunks_hybrid`) run as `SECURITY INVOKER`, ensuring queries cannot leak chunks across tenant boundaries.

### Analyses Integrity Constraint

To prevent ungrounded or hallucinated executive summaries, `public.analyses` enforces:

```sql
CHECK (
  (summary IS NULL AND (key_findings IS NULL OR key_findings = '[]'::jsonb) AND (risks IS NULL OR risks = '[]'::jsonb))
  OR cardinality(source_fact_ids) > 0
)
```

---

## 5. Ingestion Pipeline & Execution Paths

```text
Upload -> Pipeline Router -> Extraction -> Verification -> Reconciliation -> Derivation -> Flagging -> Visual Selection -> Grounded Insights
```

### Multi-Pass Pipeline Architecture

1. **Structure (Deterministic Code):** Layout analysis, reading order, table geometry, bounding box extraction, column typing.
2. **Propose (LLM, Temperature 0):** Invokes model with structured context and strict Zod output schemas. Requires verbatim quote and bounding box.
3. **Normalize (Deterministic Code):** Normalizes currency, scale (lakh, crore, million, billion) into `numeric_value`, standardizes fiscal periods and dates.
4. **Verify (Modular Verifiers):** Executes appropriate verifier per span kind.
5. **Reconcile (Deterministic Code):** Deduplicates repeated mentions, detects conflicts, verifies that component parts sum to reported totals.
6. **Derive (Deterministic Code):** Calculates shares of total, year-over-year deltas, utilization rates. Stored in `derived_facts` with source lineage.
7. **Flag (Deterministic Code Rules):** Identifies fiscal anomalies (large budget drops, unspent balances, impending deadlines).
8. **Visual Selection (Deterministic Code):** Evaluates verified fact distribution and emits declarative JSON visual specifications.
9. **Grounded Insights:** Generates plain-language descriptions via deterministic templates or LLM, strictly checked by `grounding.ts`.

### Grounding Checker (`packages/shared/src/grounding.ts`)

The grounding checker is a zero-tolerance gatekeeper:

- Every number in a summary sentence must match a cited fact or verified derived fact.
- Every comparative word (_largest_, _fell_, _majority_, _growth_) must mathematically hold across the cited facts.
- Every named entity must be present in the cited facts.
- Any sentence that fails is dropped. If no sentences survive, the deterministic template is used.

---

## 6. Frontend Architecture & Design System

### Technology Stack

- **Framework:** React 18+ with TypeScript, Vite, React Router 6.
- **Styling:** Pure Vanilla CSS with CSS custom properties (`tokens.css`). TailwindCSS is strictly forbidden unless explicitly requested.
- **Charts:** Apache ECharts loaded dynamically in separate chunk bundles per chart family (parts, time, flow, distribution).
- **Haptics:** Progressive enhancement via the Web Vibration API (`apps/web/src/lib/haptics.ts`), throttled and respecting `prefers-reduced-motion`.

### The 4 Exact Themes

Juris supports exactly 4 themes:

1. **Matcha Light:** Earthy, modern sage and matcha green accents on clean cream/paper backgrounds.
2. **Matcha Dark:** Deep moss and dark forest tones with soft sage highlights.
3. **Mono Light:** Minimalist, editorial monochrome with stark ink contrasts.
4. **Mono Dark:** Sleek carbon and slate monochrome with crisp white typography.

_Note: High Contrast and Civic/Slate themes have been retired._

### Accessibility Standards

- Minimum 3:1 contrast ratio for all categorical palette tokens against surface backgrounds (enforced by `check-contrast.mjs`).
- Complete keyboard navigation across every chart element (arrow navigation, Enter to open Insight Panel).
- Every visual specification includes an accessible data table alternative (`a11yTable`).
- Zero Axe accessibility violations on populated views.

---

## 7. Testing, Evaluation & Quality Gates

### Test Pyramid

1. **Unit Tests (Vitest):** Adversarial verifier tests (altered digits, transposed characters, invalid dates), normalizers, and grounding checker edge cases.
2. **Contract Tests:** Fastify route endpoints validated against shared Zod schemas.
3. **Integration & Isolation Tests:** Dual-computation verification tests, cross-tenant RLS leak tests, and socket-disconnect resilience.
4. **Evaluation Gold Sets (`packages/evals`):**
   - Fact Precision: >= 99% of displayed facts verified.
   - Grounding Pass Rate: 100% of displayed insight sentences grounded.
   - Table cell accuracy, OCR match rate, and recall targets.

### Guard and Quality Scripts

- `pnpm lint`: ESLint check with zero warnings allowed.
- `pnpm test`: Fast unit and integration tests.
- `pnpm typecheck`: Monorepo TypeScript typecheck.
- `pnpm check:requirements`: Validates node/pnpm engines and environment variables.
- `pnpm check:forbidden`: Scans for forbidden patterns, unapproved packages, and mock leaks.
- `pnpm check:fixtures`: Validates integrity and checksums of test fixtures.
- `pnpm check:contrast`: Verifies >= 3:1 WCAG contrast ratios across palette tokens.
- `pnpm check:tokens`: Validates consistency of design tokens.
- `pnpm check:bundle`: Enforces bundle size limits per chunk.
- `pnpm check:external-hosts`: Enforces no unauthorized external CDNs or network calls.
- `pnpm check:visual-specs`: Validates that visual specifications conform to shared schemas.
- `pnpm build`: Monorepo compilation.

---

## 8. Development & Workflow Rules for AI Models

1. **Check Documentation Before Modification:** Read `docs/prd.md`, `docs/prd-v2.md`, `docs/system-context.md`, `docs/roadmap.md`, `docs/known-gaps.md`, and `docs/adr/`.
2. **One Slice at a Time:** Focus only on files assigned to the active phase.
3. **Contracts First:** Edit `packages/shared` before editing API or web code.
4. **Tests First:** Write tests verifying the expected behavior before writing product code.
5. **No Hallucinated Data:** Never add dummy facts or synthetic charts to make a page look complete.
6. **Report Observed Realities:** Do not assume a passing build means the feature works. Test against real files and report what you ran, what you saw, and what you could not verify.
7. **Document Every Slice:** Conclude tasks by writing `docs/evidence/<slice>.md` with commands, observed outputs, side effects, and unverified items.
