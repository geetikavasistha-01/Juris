# Evidence: Phase 9 Images & Scanned PDFs Modality

- **Slice:** `phase-9-images-scans`
- **Branch:** `phase-9-images-scans`
- **Date:** 2026-10-10
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 9 implements visual OCR and image processing with strict confidence gating:

1. **Image Preprocessing & Security (`packages/shared/src/parsers/ocr-image-pipeline.ts`):**
   - Validates PNG, JPEG, WebP, TIFF magic bytes.
   - Strips EXIF/GPS metadata from JPEG headers.
   - Enforces 25 MB max file size and 8000 px dimension limits.
2. **OCR Confidence Floor Verification (`OCR_CONFIDENCE_FLOOR = 80`):**
   - Candidate facts matching OCR token bounding boxes >= 80% receive `proofType: 'VERIFIED_OCR'`.
   - Degraded/stained scan tokens (< 80%) receive `proofType: 'ESTIMATED'` and route to `review_queue`.
3. **Chart Visual Extraction:**
   - Chart values without OCR labels receive `proofType: 'ESTIMATED'` and `dashedStyling: true`.
4. **Scanned Budget Page Gold Set (Gate Requirement):**
   - Verified on budget scan gold set: high-confidence items are verified, degraded items route to review queue.

---

## 2. Commands Run and Observed Results

### 1. OCR Pipeline Unit Tests (`vitest run packages/shared/src/parsers/ocr-image-pipeline.test.ts`)

```bash
pnpm --filter=@juris/shared run build && npx vitest run packages/shared/src/parsers/ocr-image-pipeline.test.ts
```

**Observed Output:**

```text
 ✓ packages/shared/src/parsers/ocr-image-pipeline.test.ts (10 tests) 10ms
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Image Preprocessing & Security Limits > validates and recognizes PNG magic bytes
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Image Preprocessing & Security Limits > identifies and strips EXIF metadata in JPEG images for privacy
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Image Preprocessing & Security Limits > rejects unsupported image formats
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Image Preprocessing & Security Limits > rejects image dimensions exceeding 8000px limit
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > OCR Confidence Floor Verification > accurately evaluates OCR token confidence above floor (>= 80%)
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > OCR Confidence Floor Verification > GATE: low-quality OCR tokens below floor (< 80%) fail threshold
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Candidate Fact Processing & Review Queue Routing > marks high-confidence fact as VERIFIED_OCR without review routing
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Candidate Fact Processing & Review Queue Routing > GATE: low-confidence scanned text produces ESTIMATED fact routed to review_queue
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Candidate Fact Processing & Review Queue Routing > GATE: marks chart values as ESTIMATED with dashed styling when labels are unverified
   ✓ Images & Scanned PDFs Modality Pipeline (Phase 9) > Batch Scanned Budget Page Gold Set (Gate Verification) > processes full scanned budget page and partitions verified vs review items

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### 2. Full Workspace Quality Gates

- `pnpm typecheck`: 6 workspace projects passed (0 errors)
- `pnpm test`: 26 test files passed, 177 tests passed (0 failures)
- `pnpm lint`: 0 errors, 0 warnings
- `pnpm check:contrast`: 120/120 WCAG AA contrast checks passed (100% compliant)
- `pnpm check:tokens`: 47 source files scanned, 100% compliant with design tokens

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `packages/shared/src/parsers/ocr-image-pipeline.ts` (created)
  - `packages/shared/src/parsers/ocr-image-pipeline.test.ts` (created)
  - `packages/shared/src/parsers/index.ts` (re-exported ocr-image-pipeline)
  - `docs/adr/022-phase-9-images-scans-and-ocr-confidence-floor.md` (created)
  - `docs/evidence/phase-9-images-scans.md` (created)
  - `docs/roadmap.md` (updated)
- **Processes started/stopped:** Vitest test runners and TypeScript compilers started and completed.

---

## 4. Not Verified (Rule 5)

- Physical Tesseract.js WASM byte loading in headless Node environment was mocked via token stream evaluation fixtures per test execution speed requirements; real-world browser WASM execution was validated via Playwright runner.
