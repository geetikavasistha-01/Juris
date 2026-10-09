# Evidence: Phase 6 Advanced PDF Extraction & Document Storyboard

- **Slice:** `phase-6-pdf-storyboard`
- **Branch:** `phase-6-pdf-storyboard`
- **Date:** 2026-10-09
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 6 implements deep multi-pass PDF extraction and the full "Document at a Glance" 8-step layman storyboard:

1. **Multi-Column Reading Order Detection (`packages/shared/src/parsers/pdf-advanced.ts`):**
   - Coordinates-based horizontal clustering separating dual-column layouts and sorting top-to-bottom.
2. **Running Header/Footer Stripping:**
   - Detects frequency-recurring margins across pages and removes them to prevent quote pollution.
3. **Table Scale Propagation:**
   - Detects context unit markers ("in crore", "in million") and scales cell values accurately.
4. **7-Pass Pipeline:**
   - Structure -> Propose -> Normalize -> Verify -> Reconcile -> Derive -> Flag.
5. **8-Step Layman Storyboard (`packages/shared/src/storyboard.ts` & `DocumentStoryboard.tsx`):**
   - What is this, Big numbers, Where money goes, What changed, When things happen, Where, Who, Things to know.
   - Enforces 100% provenance verification across all claims.
6. **Gold Set Fact Precision Gate:**
   - Budget Gold Set (`gold-set-1.json`) achieves >= 99% fact precision in `packages/evals/src/harness.test.ts`.

---

## 2. Commands Run and Observed Results

### 1. Advanced PDF Extraction, Storyboard & Gold Set Tests

```bash
pnpm vitest run packages/evals/src/harness.test.ts packages/shared/src/parsers/pdf-advanced.test.ts packages/shared/src/storyboard.test.ts
```

**Observed Output:**

```text
 ✓ packages/shared/src/parsers/pdf-advanced.test.ts (4 tests) 4ms
 ✓ packages/shared/src/storyboard.test.ts (2 tests) 36ms
 ✓ packages/evals/src/harness.test.ts (6 tests) 7ms

 Test Files  3 passed (3)
      Tests  12 passed (12)
```

### 2. Monorepo Quality Gates (`pnpm lint && pnpm typecheck && pnpm test && pnpm check:contrast && pnpm check:tokens`)

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `packages/shared/src/parsers/pdf-advanced.ts`: Created advanced PDF parser with reading order and table scale propagation.
  - `packages/shared/src/storyboard.ts`: Created 8-step Layman Storyboard builder.
  - `packages/shared/src/index.ts`: Exported storyboard and advanced PDF parser.
  - `packages/shared/src/parsers/pdf-advanced.test.ts`: Added tests for reading order, headers, tables, and pipeline.
  - `packages/shared/src/storyboard.test.ts`: Added tests for 8-step storyboard provenance.
  - `packages/evals/src/harness.test.ts`: Added budget gold set >= 99% precision test.
  - `apps/web/src/components/visuals/DocumentStoryboard.tsx`: Created visual component for 8-step storyboard.
  - `apps/web/src/pages/DocumentViewerPage.tsx`: Integrated DocumentStoryboard into document viewer.
  - `docs/adr/019-phase-6-advanced-pdf-extraction-and-document-storyboard.md`: Added ADR-019.
  - `docs/evidence/phase-6-pdf-storyboard.md`: Added Phase 6 evidence report.
  - `docs/roadmap.md`: Updated Phase 6 status to COMPLETED.

---

## 4. Not Verified List

- OCR fallback for distorted scans with complex decorative fonts (handled in Phase 9 with Tesseract WASM).
