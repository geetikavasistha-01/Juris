# ADR-026: Gemini Proposal Step with In-Code Quote Verification

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

The initial pipeline implementation in `apps/api/src/pipeline/ingestion.ts` relied on heuristic regular expressions over text lines to extract numerical facts (`GAP-08` in `docs/known-gaps.md`). While deterministic, regex extraction could not handle complex tabular contexts, non-standard punctuation, semantic entities, obligations, definitions, or diverse civic document layouts across the 9 canonical fact types defined in PRD Section 4 (`money`, `measure`, `date`, `place`, `entity`, `obligation`, `definition`, `relation`, `identifier`).

Juris requires comprehensive fact extraction without compromising on the non-negotiable core tenet: **"model proposes, code verifies"** (PRD Section 3, ADR-011). Under no circumstances may an unverified LLM output enter the visual engine, storyboard, or civic dashboard.

## Options Considered

- **Option 1: Retain regex-only extraction.**
  - _Pros:_ Fully local, fast, zero token cost, zero network dependencies.
  - _Cons:_ Extremely brittle, misses semantic relationships, cannot scale to non-standard civic formats, leaves GAP-08 unresolved.
- **Option 2: Direct unverified LLM extraction.**
  - _Pros:_ High recall, flexible extraction across varied document formats.
  - _Cons:_ Vulnerable to hallucinated quantities, modified dates, and fabricated context. Directly violates The Evidence Rule (ADR-011) and Rule 7 of `AGENTS.md`.
- **Option 3: Gemini Proposal Step with Deterministic Code Verification (Chosen).**
  - _Pros:_ Combines the semantic extraction breadth of Gemini 2.5 Flash with the cryptographic/grounding rigor of deterministic code verification. The model proposes candidates (each paired with an exact verbatim quote and page number); code independently verifies `findQuoteInPage` and checks that numerical quantities appear within the quote. Unverified candidates are relegated to audit status (`proof_type: 'REJECTED'`) and omitted from user-facing analysis.
  - _Cons:_ Requires network calls and API key in live mode; requires page chunking, rate limiting, and replay fixtures for offline CI.

## Decision

We adopt **Option 3**:

1. **Model & Provider:** Gemini 2.5 Flash via `@google/genai` with `responseMimeType: 'application/json'` and structured JSON response schemas (`ProposedFactsResponseSchema`).
2. **Untrusted Input Perimeter:** Document text is injected into clearly marked boundaries (`=== UNTRUSTED DOCUMENT CHUNK (PAGE X) ===`) with explicit instructions to ignore prompt injection attempts and return only facts explicitly stated in the source text.
3. **Execution Controls:**
   - Chunking into groups of 3–5 pages bounded by `MAX_TEXT_CHARS`.
   - Concurrency limit of 2–3 simultaneous requests.
   - Per-call timeout (30s) and exponential backoff retries on HTTP 429 and 5xx errors.
4. **Deterministic Code Verification:**
   - Every candidate is verified in `ingestion.ts` via `findQuoteInPage` on the cited page.
   - For numeric facts, deterministic string matching verifies the value is present inside the quote.
   - Verified facts are tagged `proof_type: 'VERIFIED'`, `verified: true`.
   - Failing facts are tagged `proof_type: 'REJECTED'`, `verified: false`, recorded with rejection reasons exclusively for the audit trail.
5. **No Silent Fallback:** If Gemini fails after all retries, the ingestion job transitions cleanly to `failed`. Silent fallbacks to regex heuristics are prohibited.
6. **LLM Modes (`LLM_MODE`):**
   - `live`: Invokes the Gemini API. Startup in production (`NODE_ENV=production`) strictly validates the presence and length of `GEMINI_API_KEY`.
   - `record`: Executes live calls and records raw responses into fixtures keyed by SHA-256 hash.
   - `replay`: Reads deterministically from recorded fixtures with zero network calls. All CI tests run in `LLM_MODE=replay`.

## Consequences

- **Positive:**
  - `GAP-08` is completely resolved.
  - Full support for all 9 canonical fact types across diverse civic PDF documents.
  - End-to-end auditability: every rejected proposal is captured with failure rationale.
  - Fast, reliable, deterministic CI test execution without requiring API secrets or network access.
- **Negative / Trade-offs:**
  - Live ingestion depends on external Gemini API availability and rate quotas (mitigated by exponential backoff and concurrency throttling).
  - Storage overhead for retaining rejected fact audit records in the evidence graph.

## Evidence Links

- `docs/known-gaps.md` (GAP-08 resolution)
- `docs/evidence/phase-13-live-extraction.md`
- `packages/shared/src/evidence.ts` (`ProposedFactSchema`, `ProposedFactsResponseSchema`)
- `apps/api/src/pipeline/proposal.ts` (Proposal engine, concurrency, chunking, retries)
- `apps/api/src/pipeline/proposal.test.ts` (Unit and replay test suites)
- `apps/api/src/pipeline/ingestion.ts` (Pipeline wire-up and verification gate)
