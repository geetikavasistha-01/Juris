# ADR-023: Phase 10 Review Queue & Document Inspector Architecture

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 10 (Review Queue & Document Inspector)

---

## 1. Context and Problem Statement

Civic documents and budget notices processed through automated OCR, vision extraction, and multi-modal parsers inevitably contain edge cases:

1. Low-confidence OCR transcriptions (< 80% confidence floor) and estimated chart values.
2. Contradictory source passages where two verified tables or text sections disagree on the same figure for the same period.
3. Complex statutory terminology that requires defined citations.
4. Analysts require full inspection capability: spatial bounding box overlays, multi-dimensional filtering, and explicit human confirmation before figures become verified totals.

Per **`AGENTS.md` Rule 8**: "Never mark evaluation items approved; only the human review tool can." Automated agents must never mark review queue items approved; human reviewer actions alone transition review status to `USER_CONFIRMED`.

---

## 2. Decision Drivers

- **Human-in-the-Loop Confirmation Gate (Rule 8):**
  - Items in the review queue remain `pending` with `proofType: 'ESTIMATED'` and `verified: false`.
  - Only explicit human action (`POST /api/documents/:id/review-queue/:itemId/approve`) transitions the fact to `proofType: 'USER_CONFIRMED'`, setting `verified: true` and adding it to verified overview aggregates.
  - Rejection (`POST /api/documents/:id/review-queue/:itemId/reject`) sets `proofType: 'REJECTED'` and `verified: false`.
- **Side-by-Side Contradiction Resolution (CONFLICT):**
  - When verified facts have identical subject and period but divergent numerical values (> 0.01 delta), Juris presents both source passages side-by-side (`GET /api/documents/:id/conflicts`) rather than guessing or averaging.
- **Statutory Defined Terms (Glossary):**
  - Terms defined in statutory sections are indexed with page and verbatim quote citations (`GET /api/documents/:id/glossary`).
- **Spatial Bounding Box Visualization:**
  - Citation Drawer visualizes normalized coordinate bounding boxes `[x, y, w, h]` with simulated page canvas and direct tethering to source chunks.
- **Contract Integrity (Rule 3):**
  - Canonical contracts in `packages/shared/src/evidence.ts` (`ReviewQueueItemSchema`, `ConflictDetailSchema`, `GlossaryItemSchema`). No duplicated types across web and API.

---

## 3. Decisions & Implementation

1. **Contracts (`packages/shared/src/evidence.ts`):**
   - Added `ReviewQueueListResponseSchema`, `ReviewActionResponseSchema`, `ConflictDetailSchema`, `ConflictsResponseSchema`, `GlossaryItemSchema`, `GlossaryResponseSchema`.
2. **Backend Endpoints (`apps/api/src/routes/documents.ts`):**
   - `GET /api/documents/:id/review-queue`: Fetches pending review items enriched with source facts.
   - `POST /api/documents/:id/review-queue/:itemId/approve`: Transitions status to `approved`, updates fact to `USER_CONFIRMED` and `verified: true`.
   - `POST /api/documents/:id/review-queue/:itemId/reject`: Transitions status to `rejected`, updates fact to `REJECTED` and `verified: false`.
   - `GET /api/documents/:id/conflicts`: Detects and groups discrepancies across conflicting primary sources.
   - `GET /api/documents/:id/glossary`: Extracts definitions and terms with page locations.
3. **Inspector UI Components (`apps/web/src/components/inspector/` & `DocumentViewerPage.tsx`):**
   - `ReviewQueuePanel.tsx`: Interactive audit workspace with confirm/reject actions.
   - `ConflictPanel.tsx`: Side-by-side comparison of conflicting passages.
   - `DocumentGlossary.tsx`: Searchable statutory glossary.
   - `DocumentViewerPage.tsx`: Tabs for Overview, Facts, Review Queue, Conflicts, Glossary, Source, and Audit. Multi-dimensional filtering by search, semantic type, proof type, and page number. Citation drawer with bounding box spatial visualizer and ProofBadge.

---

## 4. Consequences

- All human review flows enforce Rule 8 with auditable database timestamps and reviewer IDs.
- Contradictory civic data is surfaced transparently with zero silent fallbacks.
- 100% token compliance and WCAG AA contrast compliance maintained.
- All 26 test suites and 179 tests passing in monorepo CI.
