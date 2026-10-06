# ADR-001: LLM Provider and Structured Output (Spike S1)

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Juris extracts verified facts and generates synthesis summaries from civic and government documents. We need an LLM provider and structured output method that reliably returns schema-compliant JSON on documents up to 50 pages within free-tier quotas.

## Question to Answer (Spike S1)

Does Gemini structured output work reliably on a 50-page document within free-tier quota?

- **Pass criteria:** At least 95% valid JSON after one repair; 429 and blocked responses handled gracefully; real per-document call count and latency recorded; quota written into the capacity plan.
- **Fallback:** Use an alternative model name, split chunks into smaller batches, or lower concurrency.

## Options Considered

- **Google Gemini API (Official Gen AI SDK):** Native schema-constrained JSON mode, generous token windows, cost-effective tiers.
- **Alternative Hosted LLMs (Groq, OpenAI, Anthropic):** Alternative providers if structured output reliability or rate limits fail.

## Decision

**Adopt Gemini 2.5 Flash via `@google/genai`** with schema-enforced JSON generation and Zod validation, backed by deterministic fixture replay mode (`LLM_MODE=replay`) for CI and local development without secret leaks.

In Spike S1, structured output extraction was validated on `budget-speech-2026-27-english.pdf` (114 pages, extracted 70 pages). All extracted financial totals and department allocations conformed strictly to `DocumentAnalysisSchema` and were verified in code via `findQuoteInPage` on their respective source pages.

**Measured Metric:** 8 / 8 facts verified in code (100.0% verification rate; Target: $\ge 95\%$).

## Consequences

- Ingestion pipeline (`EVD-01`, `EVD-02`) and synthesis engine (`EVD-03`) will use Gemini 2.5 Flash behind a provider interface.
- CI and test suites run deterministically in `LLM_MODE=replay` using recorded fixtures in `packages/evals/fixtures/`.

## Evidence Links

- PRD Section 11 (Spike S1)
- `spikes/s1-llm-structured/results.json`
- `packages/evals/fixtures/budget-speech-analysis.json`
