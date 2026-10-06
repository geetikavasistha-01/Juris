# Evidence: Phase 1 (Frontend-Critical Spikes & Eval Groundwork)

**Date:** 2026-10-06  
**Repository:** `Juris` (`main` branch)  
**Evaluator:** Antigravity AI Assistant  
**Audit & Fix Status:** Phase 1 Complete and Re-Verified on Clean Database

---

## 1. Summary of Spikes & Audit Results

| Spike     | Title                                 | Target Metric                                          | Observed Metric                                     | Status                       | Caveats / Notes                                                                                 |
| :-------- | :------------------------------------ | :----------------------------------------------------- | :-------------------------------------------------- | :--------------------------- | :---------------------------------------------------------------------------------------------- |
| **S1**    | LLM Structured Output & Evidence      | $\ge 95\%$ verification over $\ge 50$ facts            | **100.0%** (52/52 verified across 114 pages)        | **PASSED**                   | 100% JSON validity, 0% repair rate.                                                             |
| **S2**    | Embeddings & Hybrid Retrieval         | Recall@8 $\ge 85\%$ on 20 held-out questions           | Vector: **95.0%**, FTS: **0.0%**, Hybrid: **95.0%** | **PASSED**                   | Held-out set committed prior to execution. Natural language queries require vector/hybrid.      |
| **S3**    | PDF Extraction & Viewer Matching      | $\ge 95\%$ quote match (0% fuzzy)                      | **100.0%** (177/177 quotes in Chromium DOM)         | **PASSED**                   | Tested in real PDF.js viewer across 43 distinct pages.                                          |
| **S5**    | ECharts Bundle & Civic Visualizations | Initial $< 300\text{ KB}$, Lazy $< 120\text{ KB}$ gzip | Initial: **2.55 KB**, Lazy: **222.16 KB**           | **FAIL / IN REVIEW**         | Fails $< 120\text{ KB}$ lazy chunk budget. ADR-006 marked In Review pending threshold decision. |
| **S6**    | Realtime Pub/Sub & Polling Recovery   | 10 stages, monotonic dedupe, dropout recovery          | 10/10 stages, 4 recovered via polling               | **PASSED**                   | Real worker + Postgres `job_events` + Realtime WebSocket channel.                               |
| **S7**    | Multi-Tenant RLS & RPC Security       | Zero cross-tenant data leaks across tables & RPCs      | 100% isolated (0 rows leaked to Account B or anon)  | **PASSED**                   | RPCs use `SECURITY INVOKER`, public access revoked, CTEs ordered.                               |
| **Evals** | Gold Evaluation Set 1                 | 10 items (8 grounded, 2 abstentions)                   | Formatted, all quotes verified                      | **DRAFTED (PENDING REVIEW)** | Must be reviewed and approved by human.                                                         |

---

## 2. Detailed Audit Findings & Implementations

### Item 1: Migration Reproducibility & Database Reset

- **Actions:**
  - Consolidated all schema definitions, tables, RLS policies, `REPLICA IDENTITY FULL` declarations, Realtime publications, and RPC functions into `supabase/migrations/20261006000001_initial_schema.sql`.
  - Executed `npx supabase db reset` cleanly from scratch.
  - Re-ran `tests/isolation.test.ts`, `spikes/s6-realtime/run-spike.ts`, and `spikes/s2-embeddings/run-held-out.ts` against the freshly reset database.
- **Verification:** All tests passed with zero drift between migration files and active Postgres catalog.

### Item 2: RPC Security & RLS Enforcement

- **Actions:**
  - Refactored `match_chunks`, `match_chunks_fts`, and `match_chunks_hybrid` from `SECURITY DEFINER` to `SECURITY INVOKER` so PostgreSQL enforces row-level security policies (`owner_id = auth.uid() OR is_sample = true`) directly on the underlying `chunks` table.
  - Explicitly ran `REVOKE EXECUTE ... FROM PUBLIC, anon;` and granted execute only to `authenticated` and `service_role`.
  - Added `ORDER BY (embedding <=> query_embedding) ASC` and `ORDER BY ts_rank_cd(fts, query) DESC` inside the `LIMIT 20` CTE subqueries of `match_chunks_hybrid`.
  - Added cross-tenant isolation tests in `tests/isolation.test.ts` where Account B invokes each RPC with Account A's `doc_id`.
- **Observed Results:**
  - Account B queries return `0` chunks.
  - Anonymous queries return `401 / 403 Permission Denied`.
  - Account A queries return strictly their own chunks.
  - Public sample queries (`is_sample = true`) return chunks to both accounts.

### Item 3: S2 Retrieval Honesty & Held-Out Set

- **History & Diff:**
  - First run used Union Budget questions on NDMC data: Vector recall was 0% (0/20), Hybrid was 30% (6/20).
  - Dev set questions were aligned to NDMC topics: Vector 90% (18/20), FTS 25% (5/20), Hybrid 90% (18/20).
- **Held-Out Test Set (Committed First in `89ae9d4`):**
  - Evaluated 20 new held-out questions without touching retrieval code.
  - **Vector-only Recall@8:** **95.00%** (19/20)
  - **FTS-only Recall@8:** **0.00%** (0/20) — Conversational/natural language queries fail exact term matching in `plainto_tsquery`.
  - **Hybrid (RRF $k=60$) Recall@8:** **95.00%** (19/20)
  - **Single Miss:** `HELD-14` (solar generation capacity on page 58 retrieved at rank 9 vs target page 58).

### Item 4: S5 Bundle Budget Status

- **Status:** **FAIL / IN REVIEW** against the initial $< 120\text{ KB}$ lazy chunk threshold.
- **Measurements:**
  - Demo initial bundle: **2.55 KB** gzipped.
  - Lazy ECharts chunk: **222.16 KB** gzipped.
  - Projected full app initial bundle (Router + TanStack Query + Supabase): **~85–110 KB** gzipped.
- **Remediation Proposals:**
  1. Route-level code splitting: Load bar/line modules on Overview, defer Heatmap/Sunburst to Deep Analysis route.
  2. Increase lazy threshold to $< 250\text{ KB}$ gzipped for full civic visualization capabilities.

### Item 5: S3 PDF.js Viewer Breakdown

- **Execution:** 177 quotes tested inside Chromium text layer rendered by PDF.js via Playwright.
- **Distinct Pages Sampled:** 43 pages.
- **Category Breakdown:**
  - Single-line quotes: **43 / 43** (100.0%, 0 failures)
  - Multi-line quotes: **43 / 43** (100.0%, 0 failures)
  - Hyphenated words: **40 / 40** (100.0%, 0 failures)
  - Numeric / Financial figures: **18 / 18** (100.0%, 0 failures)
  - Ligatures / Special typography: **33 / 33** (100.0%, 0 failures)
- **Fuzzy Fallback Matches:** 0 (0.0%).

### Item 6: S1 Fact Verification on 50+ Facts

- **Execution:** Evaluated 52 facts sampled across 114 pages of `budget-speech-2026-27-english.pdf`.
- **Metrics:**
  - JSON Schema Validity Rate: **100.00%**
  - JSON Repair Rate: **0.00%**
  - In-Code Quote Verification Rate: **100.00%** (52/52 verified on source pages)
  - Target: $\ge 95\%$.

### Item 7: Gold Evaluation Set 1

- **File:** `packages/evals/fixtures/gold-set-1.json`
- **Status:** `"drafted, pending human review"`
- **Table of 10 Items:**

| ID          | Question                                                                                                                 | Expected Answer Type | Expected Value / Detail                    | Page | Verbatim Quote                                                   |
| :---------- | :----------------------------------------------------------------------------------------------------------------------- | :------------------- | :----------------------------------------- | :--- | :--------------------------------------------------------------- |
| **GOLD-01** | What is the Budget Estimate (BE 2026-27) for revenue receipts in NDMC area?                                              | numeric_currency     | 5211.92 crore INR                          | 33   | `"The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore"` |
| **GOLD-02** | What was the Revised Estimate (RE 2025-26) for revenue receipts?                                                         | numeric_currency     | 4964.73 crore INR                          | 33   | `"against Rs.4964.73 Crore provided in RE 2025-26"`              |
| **GOLD-03** | What digital application initiative is launched for the Education Department?                                            | text_initiative      | Single Sign On App                         | 48   | `"Single Sign On App for education department"`                  |
| **GOLD-04** | What is the primary objective of road restoration works and communication network upgrades?                              | text_initiative      | Reduce costs and minimize road restoration | 54   | `"reduce costs and minimize road restoration works"`             |
| **GOLD-05** | What civic landmark illumination project is scheduled for completion in FY 2026-27?                                      | text_initiative      | Clock tower procurement                    | 62   | `"Clock tower is being procured in the next FY 2026-27"`         |
| **GOLD-06** | What is the main objective of augmenting water storage capacity in NDMC area?                                            | text_initiative      | Maintain potable water consistency         | 64   | `"maintain consistency of potable water distribution"`           |
| **GOLD-07** | What capital outlay is allocated towards improvement of Medical Services Department?                                     | numeric_currency     | 12.71 crore INR                            | 88   | `"Rs.12.71 crore towards Capital Expenditure"`                   |
| **GOLD-08** | What revenue expenditure outlay is allocated for the Medical Services Department?                                        | numeric_currency     | 105.62 crore INR                           | 88   | `"Rs.105.62 crore towards Revenue Expenditure"`                  |
| **GOLD-09** | What is the corporate tax exemption rate for foreign cryptocurrency mining entities operating in special economic zones? | abstention           | `null` (Out of scope / unanswerable)       | N/A  | `null`                                                           |
| **GOLD-10** | What is the budget allocation for orbital deep-space satellite launch facilities in New Delhi?                           | abstention           | `null` (Out of scope / unanswerable)       | N/A  | `null`                                                           |

---

## 3. Not Verified / Limitations List

1. **Production Cloud Environment:** Tested on local macOS host with local Supabase stack and Node v22; production edge deployment (Cloudflare/Netlify + Render backend) remains to be verified in Phase 2.
2. **High-Concurrency Live LLM Rate Limits:** Live Gemini API calls were verified for single-query extraction; high concurrency (50 simultaneous streams) will be load-tested in Phase 3.
3. **Gold Set Human Approval:** Gold set items remain in `"drafted, pending human review"` state until human review sign-off.
4. **Multi-Modal Non-PDF Pipelines:** CSV, Excel, GeoJSON, and raster image modalities are defined in shared contracts (`packages/shared/src/modality.ts`), but full ingestion parsers (S8–S10) will be implemented after the core walking skeleton (Phase 2a).

---

## 4. Side Effects

- **Installed Packages:** `@playwright/test`, `echarts`, `pdfjs-dist`, `zod`, `@supabase/supabase-js`, `dotenv`, `pg`, `vitest`.
- **Database Catalog Updates:**
  - `supabase/migrations/20261006000001_initial_schema.sql` completely updated and reset via `supabase db reset`.
  - Tables: `documents`, `chunks`, `facts`, `analyses`, `visualizations`, `conversations`, `messages`, `jobs`, `job_events`.
  - RLS Policies: Applied across all 9 tables + `SECURITY INVOKER` on RPC functions `match_chunks`, `match_chunks_fts`, `match_chunks_hybrid`.
  - Realtime: `REPLICA IDENTITY FULL` on `job_events` in `supabase_realtime` publication.
