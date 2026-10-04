# ADR-001: LLM Provider and Structured Output (Spike S1)

- **Status:** Proposed
- **Date:** 2026-10-04

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

Pending results of Spike S1.

## Consequences

Will establish the default LLM provider interface implementation and capacity limits.

## Evidence Links

- PRD Section 11 (Spike S1)
