# ADR-004: PDF Extraction Library (Spike S3)

- **Status:** Accepted
- **Date:** 2026-10-06

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

**Adopt `pdfjs-dist`** for server-side text extraction paired with the canonical normalization algorithm in `@juris/shared` (`packages/shared/src/text-normalization.ts`).

In Spike S3, `pdfjs-dist` was tested against a real Chromium browser running the PDF.js viewer text layer via Playwright. 177 programmatic test quotes across 43 pages of authentic multi-page PDFs (`budget-speech-2026-27-english.pdf` and `test_upload.pdf`) were tested across 5 categories (single-line, multi-line line-wrapped, hyphenated across lines, numeric/financial figures, typographic quotes/ligatures).

**Observed Metric:** 177 / 177 (100.0% strict match rate; zero fuzzy matching counted).

## Consequences

- Server ingestion worker (`ING-01`) and in-code verification engine (`EVD-02`) will use `pdfjs-dist` with `@juris/shared` text normalization.
- Client-side PDF viewer (`CHT-04`) will use the same shared normalization logic to locate and highlight quotation spans in the DOM text layer.

## Evidence Links

- PRD Section 11 (Spike S3)
- `spikes/s3-pdf-extraction/results.json`
