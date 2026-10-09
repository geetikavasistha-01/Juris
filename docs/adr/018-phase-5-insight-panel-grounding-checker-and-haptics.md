# ADR-018: Phase 5 Insight Panel, Grounding Checker and Tactile Haptics

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 5 (Insight Panel, Grounding Checker & Haptics)

---

## 1. Context and Problem Statement

Civic analytics dashboards often provide automated text summaries that hallucinate numerical totals, invert comparative directions (e.g. claiming an expenditure increased when it actually decreased), or attribute numbers to non-existent departments.

Phase 5 requires:

1. **Mechanical Grounding Checker (`packages/shared/src/grounding.ts`):**
   - Verifies that every number mentioned in an insight sentence matches cited facts (exact match for integers, bounded tolerance for relative percentages).
   - Validates that comparative predicates ("greater than", "exceeded", "less than") hold mathematically against referenced fact values.
   - Filters and drops any unverified, altered, or ungrounded sentences via `filterGroundedSentences`.
2. **Deterministic Template Generator:**
   - 100% reliable fallback summaries across 3 distinct reading levels: Simple, Standard, Expert.
3. **Interactive Slide-over Insight Panel (`apps/web/src/components/insights/InsightPanel.tsx`):**
   - Interactive reading level switcher (Simple, Standard, Expert) with tactile feedback.
4. **Progressive Haptics (`apps/web/src/lib/haptics.ts`):**
   - Progressive hardware vibration and subtle Web Audio micro-feedback respecting `prefers-reduced-motion`.

---

## 2. Decision Drivers

- **Zero Hallucination Tolerance (PRD Section 6.3):** 100% of displayed insight sentences must pass mechanical grounding. Adversarial sentences with altered numbers must be rejected.
- **Reading Level Inclusivity:** Complex civic budgets must be accessible to lay citizens (`simple`), civic journalists (`standard`), and forensic accountants (`expert`).
- **Accessible Progressive Enhancement:** Haptics and audio feedback must never trigger for users with reduced motion preferences or in headless/unsupported environments.

---

## 3. Decisions & Implementation

1. **Exact-Tolerance Grounding Guard (`verifyInsightClaim`):**
   - Enforces `tolerance = 0` for all integer comparisons, instantly catching adversarial single-digit tampering (e.g. `45000000` vs `45000001`).
   - Uses `validateComparativeTerms` to check the sign of comparative relationships between entities.
   - Implements `filterGroundedSentences` which strips unverified claims from final summaries.

2. **Multi-Tier Reading Level Templates (`generateDeterministicInsights`):**
   - `simple`: Conversational, direct phrasing highlighting principal items and totals.
   - `standard`: Balanced civic summary with percentages and comparative figures.
   - `expert`: Analytical ledger breakdown with concentration ratios (CR3) and formal citations.

3. **Slide-Over Panel & Micro-Feedback (`InsightPanel.tsx` & `haptics.ts`):**
   - Integrates level toggles triggering `haptics.trigger('selection')`.
   - Links each claim directly to source facts with citation pills and page jump links.

---

## 4. Consequences

- 100% of displayed insight sentences pass the grounding checker.
- Unit tests verify rejection of single-digit number alterations and inverted comparative statements.
- All 3 reading levels render deterministically without LLM hallucination risk.
