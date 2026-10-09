# Evidence: Phase 5 Insight Panel, Grounding Checker & Haptics

- **Slice:** `phase-5-insights-grounding`
- **Branch:** `phase-5-insights-grounding`
- **Date:** 2026-10-09
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 5 delivers interactive deep dives into visual insights with mathematically grounded summaries:

1. **Mechanical Grounding Checker (`packages/shared/src/grounding.ts`):**
   - Exact numerical matching (`tolerance = 0` for integers) guarding against single-digit tampering.
   - Mathematical comparative predicate validation (`validateComparativeTerms`).
   - Mechanical filtering (`filterGroundedSentences`) dropping non-compliant sentences.
2. **Multi-Level Deterministic Template Generator:**
   - 3 reading levels: `simple`, `standard`, and `expert`.
   - 100% mechanical derivation from `VisualSpec` and verified facts.
3. **Insight Panel UI (`apps/web/src/components/insights/InsightPanel.tsx`):**
   - Level switcher, evidence badge display, and citation link pills.
4. **Progressive Haptic Feedback (`apps/web/src/lib/haptics.ts`):**
   - Progressive Vibration API + Web Audio clicks respecting `prefers-reduced-motion`.

---

## 2. Commands Run and Observed Results

### 1. Insights & Grounding Test Suite (`pnpm vitest run packages/shared/src/insights.test.ts`)

```bash
pnpm vitest run packages/shared/src/insights.test.ts
```

**Observed Output:**

```text
 ✓ packages/shared/src/insights.test.ts (10 tests) 68ms
   ✓ Grounding Verifier & Insight Engine > extracts numbers accurately from complex text strings
   ✓ Grounding Verifier & Insight Engine > matches numbers within acceptable numerical tolerance
   ✓ Grounding Verifier & Insight Engine > computes lexical token overlap against reference strings
   ✓ Grounding Verifier & Insight Engine > mechanically verifies a grounded claim with exact matching numbers
   ✓ Grounding Verifier & Insight Engine > mechanically rejects an ungrounded hallucinated claim with fabricated numbers
   ✓ Grounding Verifier & Insight Engine > generates 100% deterministic, citation-backed insights from VisualSpec
   ✓ Grounding Verifier & Insight Engine > generates grounded insights across all 3 reading levels: simple, standard, and expert
   ✓ Grounding Verifier & Insight Engine > adversarially catches and rejects altered numbers by even a single digit
   ✓ Grounding Verifier & Insight Engine > adversarially catches and rejects mathematically inverted comparative claims
   ✓ Grounding Verifier & Insight Engine > automatically drops failing and ungrounded sentences via filterGroundedSentences

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### 2. Monorepo Quality Gates (`pnpm lint && pnpm typecheck && pnpm test && pnpm check:contrast && pnpm check:tokens`)

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `packages/shared/src/insights.ts`: Added `ReadingLevel` type and options.
  - `packages/shared/src/grounding.ts`: Added comparative validation, exact tolerance, filterGroundedSentences, and 3 reading levels.
  - `packages/shared/src/insights.test.ts`: Added tests for reading levels, adversarial tampering, comparative checks, and dropping failing claims.
  - `apps/web/src/components/insights/InsightPanel.tsx`: Added reading level switcher with haptic feedback.
  - `docs/adr/018-phase-5-insight-panel-grounding-checker-and-haptics.md`: Added ADR-018.
  - `docs/evidence/phase-5-insights-grounding.md`: Added Phase 5 evidence report.
  - `docs/roadmap.md`: Updated Phase 5 status to COMPLETED.

---

## 4. Not Verified List

- Physical vibration on desktop browser environments lacking the Vibration API (gracefully no-ops with audio fallback or silent fallback).
