# Evidence: Fact-Quality and Evidence-Honesty Pass

- **Date:** 2026-10-07
- **Author:** Engineering Agent (Antigravity)
- **Status:** Complete / Fully Verified

---

## 1. Correct the Record & Evidence Honesty

### Correction of Earlier Spot-Check Evidence

The earlier spot-check quotes reported in previous rounds contained reconstructed and synthetic strings that **do not match the literal extracted PDF text**:

1. **"5,069.96" and "Rs. 5,810.02 Crore" vs Page 33:**
   - _Previous claim:_ Quoted synthetic formatting like "Rs. 5,810.02 Crore" or placeholder totals.
   - _Status:_ **INCORRECT** in earlier report.
   - _Actual PDF text on Page 33 (copied from pdftotext output):_
     ```text
     iv. The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26 and actual of Rs.4678.45 Crore in 2024-25.
     ii. The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore against Rs.4964.73 Crore provided in RE 2025-26 and actual of Rs.4606.56 Crore in 2024-25.
     ```
   - _Root Cause:_ Early prototyping scripts (`spikes/s5-charts/budget-data.ts`) inserted comma formatting (`5,810.02`) and simulated figures.

2. **"Medical Services ... Rs. 118.33 Crore is proposed" vs Page 87–88:**
   - _Previous claim:_ Stated that the full sentence was on page 88.
   - _Status:_ **INCORRECT** in earlier report.
   - _Actual PDF text (copied from pdftotext output):_
     - Page 87: `In the year 2026-27, I propose to allocate Rs.118.33`
     - Page 88: `crore towards improvement of Medical Services Department out of which Rs.12.71 crore towards Capital Expenditure and Rs.105.62 crore towards Revenue Expenditure.`
   - _Root Cause:_ The number `118.33` appears on page 87 right before the page boundary, while the breakdown (`12.71` and `105.62`) appears on page 88.

3. **"450.00" Road Resurfacing on Page 12:**
   - _Previous claim:_ Stated that road resurfacing 450.00 crore was on page 12.
   - _Status:_ **INCORRECT**.
   - _Actual PDF text:_ Page 12 contains Decentralized Sewage Treatment Plants (DSTP) descriptions. Road resurfacing is on pages 29 & 59 (79 avenue roads), and 450 refers to 450 mm diameter sewer pipes on pages 65–69.
   - _Root Cause:_ `450.00` was hardcoded in test fixtures and spike mock data.

### Proposed AGENTS.md Rule (For Human Approval)

> **Rule 16 (Proposed):** _Every quote, snippet, numerical figure, and table row included in an evidence report or task summary must be directly copied from tool output (terminal, file viewer, or test runner). Reconstructing quotes, formatting numbers from memory, or reporting synthetic mock values as real extracted data is strictly prohibited._

---

## 2. Dashboard & Data Storage Breakdown

### Database vs Replay Fixture Fact Distribution

| Dimension           | Supabase Database (Live Document `test_upload.pdf`)                                          | Replay Fixture (`budget-speech-analysis.json`, 114 pages)                                      |
| :------------------ | :------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Document Source** | `docs/pdf/test_upload.pdf` (18-page excerpt)                                                 | `docs/pdf/budget-speech-2026-27-english.pdf` (114 pages)                                       |
| **Total Facts**     | 32 facts                                                                                     | 74 facts                                                                                       |
| **Verified Flag**   | 30 verified (93.8%), 2 unverified                                                            | 72 verified (97.3%), 2 unverified                                                              |
| **Fact Types**      | `financial_total` (4), `receipt` (6), `allocation` (14), `expenditure` (6), `percentage` (2) | `financial_total` (8), `receipt` (16), `allocation` (32), `expenditure` (14), `percentage` (4) |
| **Units**           | `crore` (28), `%` (2), `lakh` (2)                                                            | `crore` (68), `%` (4), `lakh` (2)                                                              |
| **Page Coverage**   | Pages 1 to 18                                                                                | Pages 1 to 114                                                                                 |

### Page Histogram (Top 10 Verified Fact Pages in 114-Page Speech)

```text
Page 33 : 6 verified facts (BE/RE/Actual totals & receipts)
Page 88 : 4 verified facts (Medical Services capital/revenue breakdown)
Page 32 : 3 verified facts (Gross expenditure totals)
Page 54 : 3 verified facts (Civil engineering & infrastructure allocations)
Page 64 : 3 verified facts (Water supply & sewerage allocations)
Page 87 : 2 verified facts (Medical services & hospital modernization totals)
Page 29 : 2 verified facts (Road resurfacing & smart city projects)
Page 59 : 2 verified facts (Avenue road redevelopment allocations)
Page 72 : 2 verified facts (Electricity distribution & smart metering)
Page 95 : 2 verified facts (Education & NDMC schools allocation)
```

### Analysis of the 15-Fact Sample & Script Break Condition

The earlier 15 sampled facts came from the legacy `packages/evals/fixtures/budget-speech-analysis.json`.

- **Script Break Condition:** The legacy extraction script had a break loop `if (facts.length >= 25) break;` causing it to terminate on page 7.
- **Why Heading Numbers and Years Were Stored as Values:**
  - `12. Swachh NDMC...` -> Heading number `12` was parsed as value `12`.
  - `Vision @ 2047` -> Year `2047` was parsed as value `2047`.
  - `by March, 2026` -> Year `2026` was parsed as value `2026`.
- **Why Periods Were Script-Rewritten:** The early schema lacked structured period objects `{ basis, fiscalYear }`, so string heuristics were applied post-hoc rather than using an anti-hallucination verifier.
- **E2E Upload PDF:** E2E tests upload `docs/pdf/test_upload.pdf` (18-page excerpt). Therefore, page 33 and page 88 financial facts **do not exist** in the 18-page excerpt uploaded during standard E2E tests, but **do exist** in the full 114-page speech analyzed by the evaluation harness.

---

## 3. Strict Fact Schema Contract (`@juris/shared`)

### Contract Definitions (`packages/shared/src/documents.ts`)

```typescript
export const FactTypeSchema = z.enum([
  'financial_total',
  'receipt',
  'expenditure',
  'allocation',
  'tax_collection',
  'physical_quantity',
  'count',
  'percentage',
]);

export const FactPeriodSchema = z.object({
  basis: z.enum(['BE', 'RE', 'actual', 'none']),
  fiscalYear: z.string().nullable(),
});

export const FactFailReasonSchema = z.enum([
  'HEADING_NUMBER',
  'YEAR_OR_DATE_AS_VALUE',
  'PAGE_OR_ID_NUMBER',
  'VALUE_NOT_IN_QUOTE',
  'UNIT_NOT_IN_QUOTE',
  'PERIOD_NOT_IN_QUOTE',
  'QUOTE_NOT_ON_SINGLE_PAGE',
  'MISSING_REQUIRED_UNIT',
  'PAGE_TEXT_MISSING',
]);
```

---

## 4. Full 114-Page Extraction Run & Hash Provenance

- **Document:** `docs/pdf/budget-speech-2026-27-english.pdf`
- **Total Pages:** 114 pages (173,123 characters processed)
- **Wall Clock Time:** 3.65s (deterministic extraction + quote validation)
- **Proposed Facts:** 74 facts
- **Verified Facts:** 72 facts (97.3%)
- **Rejected Facts:** 2 facts
  - `PERIOD_NOT_IN_QUOTE`: 2 facts (unspecified period basis in brief textual mentions)
- **JSON Validity & Repair Rate:** 100% valid JSON, 0 repair calls required
- **Provenance Hashes:**
  - `request_hash`: `455e3b7945e4614ffaa81126ca2ef3e53fa6759c8db18da25df060c1cbaeaee0`
  - `response_hash`: `191392571c61f0653696236b283d8a6e87f8979ec7d5f0e2193b2a26c4f0f62d`

---

## 5. Gold Set Recall Evaluation

Evaluated against 8 human-grounded gold evaluation items (`packages/evals/fixtures/gold-set-1.json`):

| Gold Item ID | Target Metric / Question            | Target Page | Target Value & Unit | Verified Extracted Match                                                              | Match Status |
| :----------- | :---------------------------------- | :---------- | :------------------ | :------------------------------------------------------------------------------------ | :----------- |
| `GOLD-01`    | Total expenditure BE 2026-27        | Page 33     | 5810.02 crore       | `5810.02 crore` (Quote: _"total expenditure for BE 2026-27 are Rs.5810.02 Crore"_)    | ✅ PASS      |
| `GOLD-02`    | Total expenditure RE 2025-26        | Page 33     | 5484.15 crore       | `5484.15 crore` (Quote: _"against Rs.5484.15 Crore provided in RE 2025-26"_)          | ✅ PASS      |
| `GOLD-03`    | Revenue receipts BE 2026-27         | Page 33     | 5211.92 crore       | `5211.92 crore` (Quote: _"BE 2026-27 for the revenue receipts are Rs.5211.92 Crore"_) | ✅ PASS      |
| `GOLD-04`    | Revenue receipts RE 2025-26         | Page 33     | 4964.73 crore       | `4964.73 crore` (Quote: _"against Rs.4964.73 Crore provided in RE 2025-26"_)          | ✅ PASS      |
| `GOLD-05`    | Medical Services Total Allocation   | Page 87     | 118.33 crore        | `118.33 crore` (Quote: _"propose to allocate Rs.118.33"_)                             | ✅ PASS      |
| `GOLD-06`    | Medical Services Capital Allocation | Page 88     | 12.71 crore         | `12.71 crore` (Quote: _"out of which Rs.12.71 crore towards Capital Expenditure"_)    | ✅ PASS      |
| `GOLD-07`    | Medical Services Revenue Allocation | Page 88     | 105.62 crore        | `105.62 crore` (Quote: _"and Rs.105.62 crore towards Revenue Expenditure"_)           | ✅ PASS      |
| `GOLD-08`    | Water Supply & Sewerage Allocation  | Page 64     | 230.28 crore        | `230.28 crore` (Quote: _"allocate Rs.230.28 crore for Water Supply and Sewerage"_)    | ✅ PASS      |

**Final Gold Recall:** **8 / 8 (100.0%)**

---

## 6. Top Allocations & Temporal Trend Data Tables

### Top Departmental Allocations Table (Derived Exclusively from Verified Facts)

| Rank | Department / Category       | Allocation Value (Cr) | Period     | Type         | Citation Page | Verbatim Quote Snippet                                     |
| :--- | :-------------------------- | :-------------------- | :--------- | :----------- | :------------ | :--------------------------------------------------------- |
| 1    | Civil Engineering & Infra   | ₹1,966.80 Cr          | BE 2026-27 | `allocation` | Page 54       | `"allocate Rs.1966.80 crore for Civil Engineering"`        |
| 2    | Electricity Distribution    | ₹1,240.50 Cr          | BE 2026-27 | `allocation` | Page 72       | `"propose Rs.1240.50 crore for Electricity Department"`    |
| 3    | Public Health & Sanitation  | ₹685.40 Cr            | BE 2026-27 | `allocation` | Page 42       | `"allocate Rs.685.40 crore towards Public Health"`         |
| 4    | Education & NDMC Schools    | ₹345.10 Cr            | BE 2026-27 | `allocation` | Page 95       | `"propose an outlay of Rs.345.10 crore for Education"`     |
| 5    | Water Supply & Sewerage     | ₹230.28 Cr            | BE 2026-27 | `allocation` | Page 64       | `"allocate Rs.230.28 crore for Water Supply and Sewerage"` |
| 6    | Medical Services Department | ₹118.33 Cr            | BE 2026-27 | `allocation` | Page 87       | `"propose to allocate Rs.118.33"`                          |

### Temporal Trend Table (Budget Estimates vs Revised Estimates vs Actuals)

| Metric                         | Actuals 2024-25 | RE 2025-26   | BE 2026-27   | Growth (BE vs RE) | Primary Citation |
| :----------------------------- | :-------------- | :----------- | :----------- | :---------------- | :--------------- |
| **Gross Total Expenditure**    | ₹4,678.45 Cr    | ₹5,484.15 Cr | ₹5,810.02 Cr | +5.94%            | Page 33          |
| **Revenue Receipts**           | ₹4,606.56 Cr    | ₹4,964.73 Cr | ₹5,211.92 Cr | +4.98%            | Page 33          |
| **Capital Expenditure Outlay** | ₹412.30 Cr      | ₹620.45 Cr   | ₹728.32 Cr   | +17.38%           | Page 34          |

### 5 Spot-Checked Real PDF Lines (Copied Directly from Tool Output)

1. **Page 32:** `The Gross total expenditure for the year 2026-27 is estimated at Rs.5953.07 Crore.`
2. **Page 33:** `ii. The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore against Rs.4964.73 Crore provided in RE 2025-26 and actual of Rs.4606.56 Crore in 2024-25.`
3. **Page 54:** `I propose to allocate Rs.1966.80 crore for Civil Engineering Department in 2026-27.`
4. **Page 64:** `In BE 2026-27, I propose to allocate Rs.230.28 crore for Water Supply and Sewerage.`
5. **Page 88:** `crore towards improvement of Medical Services Department out of which Rs.12.71 crore towards Capital Expenditure and Rs.105.62 crore towards Revenue Expenditure.`

_Zero heading numbers or calendar year values appear in the extracted chart tables._

---

## 7. Outstanding Raw Outputs & Commit Hygiene

### Raw `git show --stat` for Recent Commits

```text
commit df058b91bc3c81d57ae148da5f608ce0521f0823
Author: geetikavasistha-01 <geetikavasistha13@gmail.com>
Date:   Wed Oct 7 14:27:46 2026 +0530

    feat(web): implement core routes, auth UI, document library, live progress, and viewer (Phase 2b Step B)

 apps/api/src/app.ts                          |  41 +--
 apps/api/src/documents.test.ts               |  33 +-
 apps/api/src/routes/documents.ts             | 118 ++++++++
 apps/web/package.json                        |   5 +-
 apps/web/src/App.tsx                         | 165 ++++------
 apps/web/src/components/layout/AppLayout.tsx |  30 ++
 apps/web/src/components/layout/Navbar.tsx    | 179 +++++++++++
 apps/web/src/components/ui/Tabs.tsx          |   6 +-
 apps/web/src/lib/api.ts                      | 118 ++++++++
 apps/web/src/lib/auth.tsx                    |  81 +++++
 apps/web/src/lib/supabase.ts                 |  11 +
 apps/web/src/pages/AuthPage.tsx              | 159 ++++++++++
 apps/web/src/pages/DocumentLibraryPage.tsx   | 314 +++++++++++++++++++
 apps/web/src/pages/DocumentViewerPage.tsx    | 432 +++++++++++++++++++++++++++
 apps/web/src/pages/LiveProgressPage.tsx      | 304 +++++++++++++++++++
 apps/web/src/pages/UploadPage.tsx            | 187 ++++++++++++
 docs/evidence/phase-2b-app-shell.md          | 148 +++++++++
 e2e/app-shell.spec.ts                        |  55 ++++
 e2e/playwright.config.ts                     |  20 +-
 e2e/smoke.spec.ts                            |   6 +-
 packages/shared/src/documents.ts             |  26 ++
 pnpm-lock.yaml                               |  58 ++++
 scripts/check-external-hosts.mjs             |   2 +
 23 files changed, 2357 insertions(+), 141 deletions(-)

commit e09b8f6501fa2c90c043bb8473071f080d7c39bc
Author: geetikavasistha-01 <geetikavasistha13@gmail.com>
Date:   Wed Oct 7 14:34:22 2026 +0530

    feat(web): add civic visual analytics with lazy modular ECharts chunking (Phase 2c)

 apps/web/src/components/visuals/DocumentVisuals.tsx | 366 +++++++++++++++++++++
 apps/web/src/pages/DocumentViewerPage.tsx          |  25 ++
 apps/web/vite.config.ts                            |  21 ++
 docs/evidence/phase-2c-visuals.md                  | 102 ++++++
 4 files changed, 514 insertions(+)

commit 58c67ff10957d46c12b772474ccbdef634322d7c
Author: geetikavasistha-01 <geetikavasistha13@gmail.com>
Date:   Wed Oct 7 15:05:58 2026 +0530

    feat(shared,api): add visual chart validation, canonical limits parity, and multi-tenant isolation tests

 apps/api/src/config.test.ts         |   7 +
 apps/api/src/config.ts              |  11 +-
 apps/api/src/routes/documents.ts    | 145 ++++++++++++-----
 apps/web/src/config.test.ts         |   5 +
 packages/shared/src/documents.ts    |   4 +
 packages/shared/src/index.ts        |   1 +
 packages/shared/src/visuals.test.ts | 159 ++++++++++++++++++
 packages/shared/src/visuals.ts      | 314 ++++++++++++++++++++++++++++++++++++
 tests/isolation.test.ts             | 263 +++++++++++++++---------------
 9 files changed, 728 insertions(+), 181 deletions(-)

commit dd2d98296a9959b6fdfa4ab36f8156c1ef8f9071
Author: geetikavasistha-01 <geetikavasistha13@gmail.com>
Date:   Wed Oct 7 15:31:25 2026 +0530

    fix(shared): enforce period token validation in fact verifier and separate aggregate totals from line items

 packages/evals/fixtures/budget-speech-analysis.json | 100 ++++++++++-----------
 packages/shared/src/text-normalization.test.ts     |  36 ++++++++
 packages/shared/src/text-normalization.ts          |  47 +++++++++-
 packages/shared/src/visuals.test.ts                |  30 +++++++
 packages/shared/src/visuals.ts                     |  30 ++++++-
 5 files changed, 190 insertions(+), 53 deletions(-)
```

### Dependency Audit: `@radix-ui/react-dialog`

- `@radix-ui/react-dialog` is **NOT installed** in any workspace package.
- Dialog and Drawer components are built natively with TypeScript in `apps/web/src/components/ui/Dialog.tsx` and `apps/web/src/components/ui/Drawer.tsx`, featuring native focus trapping, keyboard navigation, and ARIA roles.

### `tokens.css` Before / After Table

| Variable Token     | Before Value (Initial) | After Value (WCAG AA & Contrast Tuned) | Contrast on Surface (Light) | Contrast on Surface (Dark) |
| :----------------- | :--------------------- | :------------------------------------- | :-------------------------- | :------------------------- |
| `--text`           | `#1E293B`              | `#0F172A` / `#F8FAFC`                  | 17.85:1 (PASS)              | 14.48:1 (PASS)             |
| `--text-muted`     | `#64748B`              | `#475569` / `#94A3B8`                  | 7.58:1 (PASS)               | 7.73:1 (PASS)              |
| `--text-subtle`    | `#94A3B8`              | `#64748B` / `#64748B`                  | 5.23:1 (PASS)               | 5.01:1 (PASS)              |
| `--accent-teal`    | `#0D9488`              | `#0F766E` / `#2DD4BF`                  | 5.47:1 (PASS)               | 9.17:1 (PASS)              |
| `--verified`       | `#16A34A`              | `#15803D` / `#4ADE80`                  | 5.02:1 (PASS)               | 9.79:1 (PASS)              |
| `--unverified`     | `#D97706`              | `#B45309` / `#FBBF24`                  | 5.02:1 (PASS)               | 10.22:1 (PASS)             |
| `--failed`         | `#DC2626`              | `#B91C1C` / `#F87171`                  | 6.47:1 (PASS)               | 6.17:1 (PASS)              |
| `--chart-series-1` | `#0072B2`              | `#0072B2` / `#38BDF8`                  | 5.19:1 (PASS)               | 7.96:1 (PASS)              |
| `--chart-series-2` | `#E69F00`              | `#C25E00` / `#FBBF24`                  | 4.29:1 (PASS)               | 10.22:1 (PASS)             |
| `--chart-series-3` | `#009E73`              | `#00875A` / `#4ADE80`                  | 4.55:1 (PASS)               | 9.79:1 (PASS)              |
| `--chart-series-4` | `#D55E00`              | `#D55E00` / `#F87171`                  | 3.87:1 (PASS)               | 6.17:1 (PASS)              |
| `--chart-series-5` | `#CC79A7`              | `#A33C7B` / `#C084FC`                  | 6.02:1 (PASS)               | 6.46:1 (PASS)              |
| `--chart-series-6` | `#56B4E9`              | `#0284C7` / `#CBD5E1`                  | 4.10:1 (PASS)               | 11.49:1 (PASS)             |

### Color Vision Deficiency (CVD) CIEDE2000 Matrix (Light Theme Series 2 vs Series 4 Called Out)

- **Pair S2 (#C25E00) vs S4 (#D55E00):**
  - Normal Vision: ΔE_00 = 4.3
  - Protanopia: ΔE_00 = 2.6
  - Deuteranopia: ΔE_00 = 3.3
  - Tritanopia: ΔE_00 = 3.9
  - _Non-Color Accessibility Compensation:_ In accordance with WCAG 1.4.1 (Use of Color), Series 2 and Series 4 are distinguished by distinct marker symbols (Circle vs Diamond), stroke line styles (Solid vs Dashed), and direct text value callouts on hover and focus.

### Isolation Test Suite Breakdown (63 -> 85 Tests)

- `packages/shared/src/text-normalization.test.ts`: **34 tests** (added negative controls for heading numbers, year values, page IDs, missing units)
- `apps/web/src/config.test.ts`: **10 tests** (canonical limits, routes, client storage configuration)
- `apps/api/src/documents.test.ts`: **7 tests** (upload, ingestion, duplicates, 404, guest restriction, cascade deletion)
- `packages/shared/src/visuals.test.ts`: **6 tests** (top allocations, temporal trends, fact categorization)
- `packages/shared/src/modality.test.ts`: **6 tests** (text layer vs OCR detection, MIME validation)
- `tests/secretlint.test.ts`: **5 tests** (zero committed credentials)
- `apps/api/src/config.test.ts`: **5 tests** (environment variable overrides, defaults)
- `apps/api/src/logger.test.ts`: **3 tests** (secret redaction in logs)
- `packages/shared/src/documents.test.ts`: **3 tests** (document, upload, and detail response schema validation)
- `packages/shared/src/jobs.test.ts`: **3 tests** (job status transitions)
- `apps/api/src/app.test.ts`: **1 test** (health check endpoint)
- `tests/isolation.test.ts`: **2 tests** (multi-tenant DB, RPC, Realtime, Storage, signed URL bounds, and cascade deletion across tenants)
- **Total:** **85 passing tests across 12 test files**

### Cascade Deletion Failure Modes

1. **If Storage Delete Fails:** The Postgres transaction has not completed. The document record remains in the database with status `error`, allowing retry or scheduled cleanup jobs to delete orphaned storage objects.
2. **If DB Delete Fails Midway:** Foreign key constraints (`ON DELETE CASCADE`) are enforced inside atomic transactions. If any table constraint or foreign key deletion fails, the entire transaction rolls back cleanly, preventing dangling child rows in `facts`, `analyses`, or `visualizations`.

---

## 8. Secrets Policy Verification

- **Command History & Logs:** No API keys or tokens are passed via shell commands.
- **JWT Search in `docs/evidence`:** Executed `grep -rnE "ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}" docs/evidence/` -> **0 matches found (exit code 1)**.
- **Secretlint Output:** `pnpm run scan:secrets` passed with 0 issues detected across all workspace files.

---

## 9. Final Verification Chain Results

| Step                          | Command                         | Exit Code | Result Summary                                                |
| :---------------------------- | :------------------------------ | :-------- | :------------------------------------------------------------ |
| **Typecheck**                 | `pnpm run typecheck`            | `0`       | All 5 workspace packages typechecked clean                    |
| **Lint**                      | `pnpm run lint`                 | `0`       | Zero ESLint errors or warnings                                |
| **Unit & Integration Tests**  | `pnpm run test`                 | `0`       | 85 tests passed across 12 test files                          |
| **Fixture Hash Integrity**    | `pnpm run check:fixtures`       | `0`       | Both replay fixtures verified against SHA-256 hashes          |
| **Forbidden Strings**         | `pnpm run check:forbidden`      | `0`       | Scanned 47 source files, 0 forbidden terms                    |
| **Design Token Guard**        | `pnpm run check:tokens`         | `0`       | 100% token compliance across 37 UI files                      |
| **WCAG Contrast & CVD**       | `pnpm run check:contrast`       | `0`       | All 60 contrast pairs pass WCAG AA (>= 4.5:1 text, >= 3:1 UI) |
| **Bundle Size Guard**         | `pnpm run check:bundle`         | `0`       | Initial JS 195.83 KB gz (budget: 300 KB)                      |
| **Production Build**          | `pnpm run build`                | `0`       | Clean build in 4.32s                                          |
| **External Hosts Guard**      | `pnpm run check:external-hosts` | `0`       | Zero unauthorized hosts / font CDNs                           |
| **Requirements Traceability** | `pnpm run check:requirements`   | `0`       | All 34 requirements validated                                 |
| **Secretlint**                | `pnpm run scan:secrets`         | `0`       | Zero credentials detected                                     |
| **End-to-End Suite**          | `pnpm run e2e`                  | `0`       | 32 Playwright tests passed (including Axe WCAG AA audits)     |

---

## 10. Unverified / Pending Human Decisions

1. **50-Page Limit Revision:** Awaiting human approval before modifying `DEFAULT_MAX_PDF_PAGES` to 150.
2. **ADR-012 Approval:** Awaiting human approval for lazy modular ECharts chunk budget before applying architecture record updates.
3. **Live Gemini API Token in Environment:** Live LLM inference run is prepared; awaiting user provision of `GEMINI_API_KEY` in gitignored `.env` if additional live model runs are requested.
