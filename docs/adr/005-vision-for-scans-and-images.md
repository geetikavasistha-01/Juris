# ADR-005: Vision for Scans and Images (Spike S4)

- **Status:** Proposed
- **Date:** 2026-10-04

## Context

Civic documents occasionally consist of scanned pages, low-quality photocopies, or embedded chart images without native text layers.

## Question to Answer (Spike S4)

Can images and scanned pages be transcribed accurately via multimodal vision models?

- **Pass criteria:** Two independent passes agree on at least 90% of figures on 10 test pages.
- **Fallback:** Ship Phase 3 as transcript-only with no charts, labelled experimental.

## Options Considered

- **Gemini Flash Vision:** Native OCR and document understanding via multimodal input.
- **Tesseract OCR:** Open source local OCR library.
- **Reject Non-Text PDFs:** Reject scanned PDFs gracefully with clear error code `FILE_TYPE` in v1.

## Decision

Pending results of Spike S4 (P2 scope, gated).

## Consequences

Determines whether ING-06 is implemented or deferred to v2.

## Evidence Links

- PRD Section 11 (Spike S4)
