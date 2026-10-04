# ADR-011: The Evidence Rule

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

LLMs frequently hallucinate numbers or misattribute source context when generating civic summaries or populating visualizations. Trustworthy numbers and verifiable citations are the core product promise of Juris.

## Options Considered

- **Code-Verified Evidence Architecture (The Evidence Rule):**
  1. Extraction returns facts with a verbatim quote and page; temperature 0; JSON schema output; Zod validation.
  2. Code verifies each fact deterministically: quote exists on the cited page (fuzzy matching), and every number appears in the quote after normalizing separators, currencies, and magnitude words (lakh, crore, million, billion).
  3. Failed facts are saved with a reason code and never displayed in UI.
  4. Summaries, key findings, and interactive visualizations are created ONLY from verified facts.
  5. Unsupported sentences in summaries are stripped by a programmatic verifier pass.
- **Direct LLM Generation of Final Figures & Charts:** High hallucination risk, impossible to audit or prove correctness.

## Decision

Adopt the Evidence Rule (PRD Rule R6 & Section 9.2). Code verifies facts deterministically before any summary or visual is constructed.

## Consequences

- **Positive:** Guaranteed factual grounding; every visualized figure links directly to a highlighted quote on an exact page; zero empty or fabricated visualizations.
- **Negative / Trade-offs:** Facts that fail code verification are rejected, requiring extraction refinement and error transparency in the UI.

## Evidence Links

- PRD Section 1 (Rule R6), Section 9.2, Section 5 (EVD-01, EVD-02, EVD-03, VIZ-01)
