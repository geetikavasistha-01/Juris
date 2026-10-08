# Evidence: Phase 1 (Frontend-Critical Spikes & Eval Groundwork)

**Date:** 2026-10-06  
**Repository:** `Juris` (`main` branch)  
**Evaluator:** Antigravity AI Assistant  
**Remediation Pass:** Pass #2 Complete

---

## 1. Summary of Spikes & Audit Status

| Spike     | Title                                 | Target Metric                                          | Observed Metric                                       | Status                       | Caveats / Notes                                                                                                                                |
| :-------- | :------------------------------------ | :----------------------------------------------------- | :---------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1**    | LLM Structured Output & Evidence      | $\ge 95\%$ verification over real LLM responses        | Script-generated synthetic fixture (52 facts)         | **INVALID / REPLAY ONLY**    | Old 100% metric invalidated: facts came from PDF extraction script, not live Gemini. Live extraction requires `GEMINI_API_KEY` in environment. |
| **S2**    | Embeddings & Hybrid Retrieval         | Recall@8 $\ge 85\%$ on 20 questions                    | Vector: **95.0%**, FTS: **100.0%**, Hybrid: **95.0%** | **PASSED**                   | FTS upgraded to tokenized OR tsquery with `ts_rank_cd`. Note: Held-out set has now been evaluated.                                             |
| **S3**    | PDF Extraction & Viewer Matching      | $\ge 95\%$ quote match (0% fuzzy) + negative controls  | **100.0%** (177/177 quotes in Chromium DOM)           | **PASSED**                   | Tested in real PDF.js viewer across 43 distinct pages. 100% of negative controls (fake/wrong page) rejected.                                   |
| **S5**    | ECharts Bundle & Civic Visualizations | Initial $< 300\text{ KB}$, Lazy $< 120\text{ KB}$ gzip | Initial: **2.55 KB**, Lazy: **222.16 KB**             | **FAIL / IN REVIEW**         | Fails $< 120\text{ KB}$ lazy chunk budget. ADR-006 marked In Review pending threshold decision.                                                |
| **S6**    | Realtime Pub/Sub & Polling Recovery   | 10 stages, monotonic dedupe, dropout recovery          | 10/10 stages, 3-4 recovered via polling               | **PASSED**                   | 3 consecutive full runs executed cleanly with zero assertion/timeout loosening.                                                                |
| **S7**    | Multi-Tenant RLS & RPC Security       | Zero cross-tenant data leaks across tables & RPCs      | 100% isolated (0 rows leaked to Account B or anon)    | **PASSED**                   | RPCs use `SECURITY INVOKER`, public access revoked, CTEs ordered.                                                                              |
| **Evals** | Gold Evaluation Set 1                 | 10 items (8 grounded, 2 near-miss abstentions)         | Rebuilt from scratch with 0 S1 overlap                | **DRAFTED (PENDING REVIEW)** | Must be reviewed and approved by human.                                                                                                        |

---

## 2. Detailed Remediation Pass #2 Results

### Item 1: S1 Status & Provenance

- **Status:** **INVALID / DEPRECATED SYNTHETIC**
- **Root Cause & History:**
  - In commit `1b0b73d`, 52 facts were extracted using a programmatic script (`generate-50-facts.ts`) that read the raw PDF text layers rather than live Gemini API outputs.
  - The previous 100% verification score is marked **INVALID**.
  - `packages/evals/fixtures/budget-speech-analysis.json` has been updated with `_provenance` metadata and explicitly labeled as `synthetic: true, status: "deprecated_synthetic"`.
  - All hand-authored summary, finding, and risk text has been removed or clearly tagged as synthetic.

### Item 2: Verifier Hardening & Negative Controls

- **Implementation:** Added `verifyFactQuoteAndValue` in [`packages/shared/src/text-normalization.ts`](../../packages/shared/src/text-normalization.ts).
- **Verification Logic:**
  1. Checks that the verbatim quote exists on the source page (exact or canonical normalized substring).
  2. For numeric facts (`fact.value !== null`), strips formatting/commas and asserts that the normalized numeric representation appears directly inside the quote text.
- **Negative Control Test Results (`packages/shared/src/text-normalization.test.ts`):**
  - **Negative Control 1 (Quote altered by 1 character):** Rejected (`verified: false, quoteMatched: false`).
  - **Negative Control 2 (Wrong numeric value `9999.99`):** Rejected (`verified: false, quoteMatched: true, valueMatched: false`).
  - **Negative Control 3 (Wrong page text):** Rejected (`verified: false, quoteMatched: false`).

### Item 3: Fixture Provenance & CI Enforcement

- **Implementation:** Added [`scripts/check-fixtures.mjs`](../../scripts/check-fixtures.mjs) and `pnpm run check:fixtures`.
- **Enforced Fields:** Every `.json` fixture in `packages/evals/fixtures/` must contain non-empty string fields:
  - `model` (e.g. `human-curated-gold-set` or `gemini-2.5-flash`)
  - `prompt_version`
  - `timestamp` (ISO 8601)
  - `request_hash` (SHA-256)
- **CI Output:** Both fixtures (`budget-speech-analysis.json`, `gold-set-1.json`) validated cleanly.

### Item 4: Gold Evaluation Set Rebuild

- **File:** [`packages/evals/fixtures/gold-set-1.json`](../../packages/evals/fixtures/gold-set-1.json)
- **Status:** `"drafted, pending human review"`
- **Overlap Check:** 0 shared items with S1 fact list.
- **Item Breakdown (10 Items):**
  - `GOLD-01`: Period comparison (BE 2026-27 vs RE 2025-26 expenditure increase of Rs. 325.87 crore on page 33).
  - `GOLD-02`: Value needing sum (Medical Services Capital Rs. 12.71 crore + Revenue Rs. 105.62 crore = Rs. 118.33 crore on page 88).
  - `GOLD-03`: Paraphrased citizen authentication initiative (Single Sign On on page 15).
  - `GOLD-04`: Phasing out manual/cash/cheque payments in FY 2026-27 (page 25).
  - `GOLD-05`: Water supply and sewerage allocation of Rs. 230.28 crore (page 64).
  - `GOLD-06`: Navyug School Pandara Park model upgradation project (page 75).
  - `GOLD-07`: Multi-page spanning item (Timeline for 100% mechanized street cleaning on page 95).
  - `GOLD-08`: Local Area Plan pilot location (Lodhi Road / Lodhi Colony on page 108).
  - `GOLD-09`: Near-miss unanswerable question (Residential rooftop wind turbine subsidies in NDMC — `abstention`).
  - `GOLD-10`: Near-miss unanswerable question (Commercial drone delivery landing pads in Connaught Place — `abstention`).

### Item 5: S2 FTS Diagnosis & Retrieval Results

- **Diagnosis:** Natural language conversational questions previously scored 0% on FTS because `websearch_to_tsquery` generated conjunctive `&` queries requiring every query token to be present in the chunk.
- **Tuning on Dev Questions:** Refactored `match_chunks_fts` and `match_chunks_hybrid` to parse meaningful tokens (>2 chars) and join via disjunctive `|` (OR) ranked by `ts_rank_cd`.
- **Observed Recall@8 on Clean Database:**
  - **Dev Set (20 Questions):** Vector: **90.00%** (18/20), FTS: **95.00%** (19/20), Hybrid: **95.00%** (19/20).
  - **Held-Out Set (20 Questions):** Vector: **95.00%** (19/20), FTS: **100.00%** (20/20), Hybrid: **95.00%** (19/20).
  - _Note:_ The held-out set has now been evaluated and should be treated as part of the known test evaluation.

### Item 6: Secrets Policy & `.secretlintignore`

- **Full Diff:**
  - Removed `**/results.json` and `**/fixtures/**` broad globs.
  - Replaced test fake keys with non-matching strings in `apps/api/src/config.test.ts`.
  - Tightened `.secretlintignore` to exact paths:
    ```text
    node_modules/
    dist/
    coverage/
    pnpm-lock.yaml
    packages/evals/fixtures/
    apps/api/src/logger.test.ts
    tests/secretlint.test.ts
    supabase/.temp/
    ```
  - `pnpm run scan:secrets` passes 100% clean.

### Item 7: S3 Sampling Breakdown & 5 Examples Per Category

- **Sampling Methodology:** Programmatically extracted lines from 43 pages of PDF text layers. Quotes are classified into categories based on lexical characteristics:
  - `single-line`: Single unbroken line (<80 chars).
  - `multi-line`: Spanning 2+ lines with whitespace normalization.
  - `hyphenated`: Words split across line breaks with soft/hard hyphens.
  - `numeric`: Containing financial/statistical numbers (e.g. `Rs.`, `%`, crores).
  - `ligature`: Containing typographic ligatures (`fi`, `fl`, `ff`, `oe`).
- **5 Examples Per Category:**
  1. _Single-line:_
     - Page 1: `"Palika Kendra, New Delhi-110001"`
     - Page 9: `"14 markets having 150 km"`
     - Page 15: `"Single Sign on (SSO)"`
     - Page 48: `"Single Sign On App for education department"`
     - Page 91: `"Night Cleaning: Maximum Efficiency, Minimum Disruption"`
  2. _Multi-line:_
     - Page 15: `"Single sign on is an authentication method letting users log in once with one set of credentials"`
     - Page 25: `"All transactions, including taxes, utility bills, fines and vendor payments will be made through secure digital platforms."`
     - Page 33: `"The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26"`
     - Page 58: `"After the successful completion of the cycle track around Nehru Park and the positive appreciation"`
     - Page 95: `"deployment of 30 Gobbler Machines, 12 Mechanical Road Sweepers, and 4 battery-operated push-back sweepers"`
  3. _Hyphenated:_
     - Page 42: `"Up-gradation of schools and educational infrastructure"`
     - Page 42: `"inter-state excursions to institutions like IITs, IIMs"`
     - Page 58: `"Theme Based Parks and green corridor-development"`
     - Page 95: `"battery-operated push-back sweepers"`
     - Page 108: `"energy-efficient civic buildings and digitized planning"`
  4. _Numeric:_
     - Page 9: `"556 Crore under the Urban Development Fund"`
     - Page 21: `"procure 5.53 lakhs tulip bulbs"`
     - Page 33: `"BE 2026-27 for the revenue receipts are Rs.5211.92 Crore"`
     - Page 64: `"allocate Rs.230.28 crore for Water Supply"`
     - Page 88: `"Rs.12.71 crore towards Capital Expenditure"`
  5. _Ligatures / Special Typography:_
     - Page 1: `"ﬁnancial statements and budget estimates"`
     - Page 15: `"eﬃcient and transparent delivery services"`
     - Page 33: `"RE 2025–2026 budget—revised −10%"`
     - Page 42: `"speciﬁc learning experiences and skill workshops"`
     - Page 91: `"“Night Cleaning: Maximum Eﬃciency”"`

### Item 8: S6 Realtime Verification (3 Consecutive Full Runs)

- **Git Diff & Assertions:** Zero assertions or timeouts loosened.
- **Run 1:** 10/10 stages received, 4 recovered via polling during dropout, final status `done`.
- **Run 2:** 10/10 stages received, 4 recovered via polling during dropout, final status `done`.
- **Run 3:** 10/10 stages received, 3 recovered via polling during dropout, 1 duplicate dropped (`Seq: 5`), final status `done`.

### Item 9: Isolation Test Output

```text
 ✓ tests/isolation.test.ts (1 test) 800ms
   ✓ Spike S7: Multi-Tenant & RLS Isolation Verification > proves strict isolation between Account A and Account B at DB, Realtime, and Storage levels (800ms)
 Test Files  1 passed (1)
 Tests       1 passed (1)
```

- Account B invoking `match_chunks`, `match_chunks_fts`, or `match_chunks_hybrid` with Account A's `doc_id` returns 0 rows.
- Anonymous requests are rejected by PostgreSQL security policy.

### Item 10: S5 Status & Route-Level Splitting Plan

- **Status:** **FAIL** against the $< 120\text{ KB}$ lazy chunk budget (measured 222.16 KB gzipped for all 6 civic charts).
- **Proposed Route-Level Splitting Plan:**
  1. _Route `/documents/:id/overview`:_ Load lightweight summary charts (Bar & Key Figures strip) ~85 KB gzipped.
  2. _Route `/documents/:id/visuals/treemap`:_ Lazy-load Treemap module ~45 KB gzipped on demand.
  3. _Route `/documents/:id/visuals/deep-dive`:_ Lazy-load Sunburst and Heatmap modules ~90 KB gzipped on demand.
- Full production bundle will be measured during Phase 2b frontend assembly.

---

## 3. Side Effects

- **Installed Packages:** `@playwright/test`, `echarts`, `pdfjs-dist`, `zod`, `@supabase/supabase-js`, `dotenv`, `pg`, `vitest`.
- **Database Catalog Updates:**
  - `supabase/migrations/20261006000001_initial_schema.sql` completely updated with `SECURITY INVOKER` and tokenized OR tsquery.
  - Tables: `documents`, `chunks`, `facts`, `analyses`, `visualizations`, `conversations`, `messages`, `jobs`, `job_events`.
  - All RLS policies active.
- **CI Scripts Added:**
  - `scripts/check-fixtures.mjs` (`pnpm run check:fixtures`).
  - `scripts/check-forbidden.mjs` (`pnpm run check:forbidden`).
  - `scripts/check-requirements.mjs` (`pnpm run check:requirements`).
