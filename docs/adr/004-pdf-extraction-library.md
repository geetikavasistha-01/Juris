# ADR-004: PDF Extraction Library (Spike S3)

- **Status:** Proposed
- **Date:** 2026-10-04

## Context

Extracted text and quotes must align identically with the frontend PDF viewer text layer so that user citation chips highlight the exact text on the exact page.

## Question to Answer (Spike S3)

Which PDF extraction library gives per-page text that matches the viewer's text layer?

- **Pass criteria:** At least 95% of sampled extracted quotes found by the PDF viewer's search; acceptable extraction speed on 50-page documents.
- **Fallback:** Evaluate alternative PDF extractors (pdfjs-dist server-side, pdf-parse, or mupdf).

## Options Considered

- **pdfjs-dist (server extraction matching client viewer):** Uses the exact same rendering engine in both Node and the browser.
- **pdf-parse:** Lightweight wrapper around pdf.js.
- **MuPDF / pdf-lib:** High performance C-bindings or native tools.

## Decision

Pending results of Spike S3.

## Consequences

Defines the extraction engine for ING-01 and verification pipeline in EVD-02.

## Evidence Links

- PRD Section 11 (Spike S3)
