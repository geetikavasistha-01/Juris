# ADR-022: Phase 9 Images & Scanned PDFs Modality Pipeline

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 9 (Images & Scanned PDFs Modality)

---

## 1. Context and Problem Statement

Scanned municipal budgets, legislative gazettes, and civic notices frequently contain degraded typography, photocopy skew, coffee stains, low-contrast ink, and embedded chart screenshots. Without strict confidence gating:

1. Low-confidence OCR creates hallucinated or mistranscribed numbers (e.g. reading 1,000 as 10,000).
2. Chart image estimates are presented as verified facts without distinction.
3. Personal geographic/camera data (EXIF/GPS metadata) is leaked into system databases.

Phase 9 gate requirement:
"Scanned budget page gold set passes OCR threshold; low-quality scans produce review items instead of unverified facts."

---

## 2. Decision Drivers

- **Strict OCR Confidence Floor (`OCR_CONFIDENCE_FLOOR = 80`):**
  - Facts matching OCR token bounding boxes with average confidence >= 80% receive `proofType: 'VERIFIED_OCR'` and `verified: true`.
  - Facts with confidence < 80% are NEVER marked verified; they receive `proofType: 'ESTIMATED'`, `dashedStyling: true`, and are automatically routed to the human `ReviewQueueItem` audit table.
- **Estimated Chart Values Distinction:**
  - Values visually estimated from chart images without explicit OCR data labels receive `proofType: 'ESTIMATED'`, `dashedStyling: true`, and generate a review item.
- **Image Preprocessing & Security Limits:**
  - PNG, JPEG, WebP, and TIFF format verification via magic byte inspection.
  - Automatic EXIF/GPS metadata stripping on ingestion.
  - Max dimension limit: 8000x8000 px (`IMAGE_DIMENSIONS_EXCEEDED`).
  - Max file size limit: 25 MB (`FILE_TOO_LARGE`).

---

## 3. Decisions & Implementation

1. **OCR Image Pipeline (`packages/shared/src/parsers/ocr-image-pipeline.ts`):**
   - Implements `preprocessImage` with magic bytes detection, EXIF stripping, dimension bounding, and deskew estimation.
   - Implements `evaluateOcrConfidence` across token streams with bounding boxes.
   - Implements `processVisionFactCandidate` and `processScannedPageFacts` separating verified facts from pending review queue items.
   - Integrates with `ReviewQueueItem` from `evidence.ts` without type duplication (`AGENTS.md` Rule 3).

2. **Visual Differentiation (`dashedStyling`):**
   - Unverified and estimated chart facts receive `dashedStyling: true`, rendering with dashed borders in UI charts and visual cards.

---

## 4. Consequences

- Degraded scans produce audit items for human review rather than corrupted unverified facts.
- The scanned budget page gold set partitions high-confidence vs degraded items deterministically.
- All 10 unit tests pass in `packages/shared/src/parsers/ocr-image-pipeline.test.ts`.
