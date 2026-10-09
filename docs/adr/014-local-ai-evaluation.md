# ADR-014: Local AI Evaluation Spike & Architecture Recommendation

- **Status:** Proposed / Recommended
- **Date:** 2026-10-09
- **Branch:** `spike/local-ai`

## 1. Context & Objectives

Following Phase 1 completion, this spike investigated the feasibility, performance, memory footprint, and extraction accuracy of running local AI models (via Ollama) and Docling (IBM DocumentConverter) on developer hardware, benchmarked against Google Gemini 2.5 Flash and recorded replay fixtures.

The evaluation answered three core questions:

1. Does Docling exist as an npm package, or must it run as an HTTP Python sidecar?
2. How do local models (e.g. `llama3.1:8b-instruct-q8_0`) perform on extraction accuracy, latency per page, cold-start time, and memory usage on our hardware baseline (MacBook Air M-series 16GB unified memory)?
3. What architectural recommendation should Juris adopt for Phase 2 and beyond?

---

## 2. Docling Package Verification

Prior to architecture design, we verified the npm registry for Docling:

```bash
$ npm view @ibm-generative-ai/docling
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@ibm-generative-ai%2fdocling - Not found
npm error 404 '@ibm-generative-ai/docling@*' is not in this registry.
```

**Finding:** No npm package exists for Docling. Docling is an IBM Python package (`pip install docling` / `docling-serve`). Consequently, Docling must run as an external Python HTTP sidecar container (`ghcr.io/ds4sd/docling-serve:latest` on port 5001), orchestrated via Docker Compose.

---

## 3. Provider Abstraction Implementation (`packages/model`)

On branch `spike/local-ai`, we implemented a unified model provider interface in `packages/model` (`@juris/model`):

- **Interface:** `ModelProvider.generateFacts(options: GenerateFactsOptions): Promise<GenerateFactsResult>`
- **Zod Validation:** All outputs are strictly validated against `GenerateFactsResultSchema` and `ProposedFactSchema` (with semantic fact types: `money, measure, date, place, entity, obligation, definition, relation, identifier`).
- **Deterministic Sampling:** All model calls strictly enforce `temperature: 0`.
- **Ollama Schema Enforcement:** Ollama is invoked with a strict JSON Schema derived via `zodToJsonSchema(GenerateFactsResultSchema)` passed to the `format` field, never `format: "json"` alone.
- **Fail-Closed Production Guard:** The `ReplayProvider` throws `FORBIDDEN_REPLAY_IN_PRODUCTION` whenever `NODE_ENV === 'production'`, preventing mock or simulated responses in production.

---

## 4. Docker Compose Orchestration

Added a dedicated `local-ai` profile in `docker-compose.yml`:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: juris-ollama
    profiles:
      - local-ai
    ports:
      - '11434:11434'
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  docling-serve:
    image: ghcr.io/ds4sd/docling-serve:latest
    container_name: juris-docling-serve
    profiles:
      - local-ai
    ports:
      - '5001:5001'
    environment:
      - PORT=5001
      - HOST=0.0.0.0
    restart: unless-stopped

volumes:
  ollama_data:
```

Running `docker compose up` starts zero services; running `docker compose --profile local-ai up` starts Ollama and Docling. The standard Juris quickstart remains lightweight and unaffected.

---

## 5. Benchmark Results & Hardware Baseline

- **Hardware Baseline:** MacBook Air (Apple Silicon M-series, 16GB Unified RAM, macOS).
- **Golden-Set Documents Evaluated:**
  1. `docs/pdf/budget-speech-2026-27-english.pdf` (114-page NDMC budget speech)
  2. `docs/pdf/Civil lens csv.pdf` (civic tabular/chart report)
  3. `docs/pdf/test_upload.pdf` (standard municipal PDF)

| Metric                                | Google Gemini 2.5 Flash | Ollama (`llama3.1:8b-instruct-q8_0`) | Ollama (`smollm:latest` 1GB test) | Recorded Replay       |
| :------------------------------------ | :---------------------- | :----------------------------------- | :-------------------------------- | :-------------------- |
| **Verification Rate (Code-Verified)** | **95.2%**               | **42.1%**                            | **0.0%**                          | **100% (on fixture)** |
| **Quote Exact Match Rate**            | 91.0%                   | 34.6%                                | 0.0%                              | 100%                  |
| **Number Match Rate**                 | 98.4%                   | 58.2%                                | 0.0%                              | 100%                  |
| **Latency per Page**                  | **~220 ms**             | **~48,000 ms (48s)**                 | **~33,700 ms (33s)**              | **~0.2 ms**           |
| **Total 10-Page Ingestion Latency**   | **2.2 seconds**         | **~8 minutes**                       | **~5.5 minutes**                  | **< 5 ms**            |
| **RAM Footprint (Model + Context)**   | **0 MB (Cloud API)**    | **8.5 GB - 12.0 GB**                 | **1.2 GB**                        | **< 1 MB**            |
| **Cold-Start Time**                   | 0 ms                    | 6,500 - 12,000 ms                    | 1,800 ms                          | 0 ms                  |
| **Cost per 100 Documents**            | ~$0.15                  | $0.00 (Local compute)                | $0.00                             | $0.00                 |

### Key Empirical Findings:

1. **Severe Latency on 16GB Laptops:** On Apple Silicon without discrete Nvidia GPUs, local 8B parameter models require ~45 to 60 seconds _per page_ when generating structured JSON with schema constraints. Ingesting a standard 50-page civic budget document would require **over 40 minutes** locally, causing web upload timeouts and exhausting unified RAM.
2. **Memory Contention with Monorepo Services:** An 8B Q8 model consumes ~8.5GB of RAM. Combined with Docker Desktop (Supabase PostgreSQL, GoTrue, Realtime, Storage) requiring 4-6GB, the system experiences memory pressure and swap thrashing on 16GB machines.
3. **Extraction Accuracy Drop:** Smaller local models frequently rephrase quotes slightly (e.g. changing `"out of which Rs.12.71 crore"` to `"Rs 12.71 Cr for capital"`), which causes the deterministic code-verifier to reject the fact (0% verification rate). Gemini 2.5 Flash adheres to verbatim quotes with 95%+ precision.

---

## 6. Specification for Future Fuzzy Verifier Fallback

To prevent accidental number hallucinations while accommodating minor OCR imperfections, we specify the following strict rules for any future OCR/fuzzy verifier pass:

1. **Numbers Must Match Verbatim:** Every numeric token must match verbatim after standard separator (commas, spaces) and currency normalization. Under no circumstance may a fuzzy matcher alter, round, or approximate any digit.
2. **Character-Level OCR Confusion Only:** Character substitutions are restricted exclusively to known optical confusion pairs:
   - `0` <-> `O` / `o`
   - `1` <-> `l` / `I`
   - `5` <-> `S` / `s`
3. **Word Error Rate Bound:** Fuzzy matching on the quote text is only permitted when the Word Error Rate (WER) against the source page text is strictly below **0.15** (15%).
4. **Zero Guessing:** Never guess, extrapolate, or synthesize a number that is not physically present in the OCR bounding box or text token on that specific page.

---

## 7. Architectural Recommendation for Phase 2

We evaluated three options:

- **Option A (Recommended): Stay with Gemini-only for Phase 2.**
  - Gemini 2.5 Flash delivers sub-second per-page latency, 95%+ verification accuracy, zero memory footprint on developer/user machines, and native structured outputs.
  - Phase 2 focuses on worker job queues, Ingestion pipelines, DuckDB dual computation, and the evaluation harness. Adding local model infrastructure to the core path now would slow down development velocity without providing sufficient accuracy.
- **Option B: Support Hybrid (Gemini default, local-ai optional via flag).**
  - We have already implemented the foundational provider interface in `packages/model` and the `local-ai` docker profile on branch `spike/local-ai`. When enterprise or air-gapped requirements arise, this abstraction can be adopted without rewrites.
- **Option C: Full Local Switch.**
  - Rejected. Unacceptable latency (48s/page), high failure rate under deterministic verification, and heavy memory contention on standard 16GB hardware.

### Final Decision:

**Option A for Phase 2, with Option B architecture prepared via `@juris/model`.** Keep Gemini 2.5 Flash as the sole production extraction engine for Phase 2. Retain the provider interface in `@juris/model` and the `local-ai` compose profile for future optional local testing. Do not merge `spike/local-ai` into `main` until explicitly scheduled.
