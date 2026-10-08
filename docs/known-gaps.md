# Juris Known Gaps & Implementation Roadmap

This document tracks known capabilities, test boundaries, and gaps scheduled for implementation across subsequent phases.

---

## 1. Multimodal Fact Extraction Gaps

| Modality / Area            | Current State                                                                                                      | Target Phase                 | Implementation Scope                                                                                            |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **CSV & Tabular Datasets** | Ingestion pipeline extracts tabular metadata, stores datasets, and produces summary facts (`computed_from_table`). | **Phase 7 (CSV)**            | DuckDB dual-compute engine, streaming CSV parser, distribution/correlation metrics, CSV-injection-safe exports. |
| **GeoJSON & KML Spatial**  | Ingestion validates geometry, extracts feature layers, and stores spatial layer records.                           | **Phase 8 (Maps)**           | Shapefile/TopoJSON support, gazetteer place-name matching, choropleth geo-filtering, spatial ambiguity flags.   |
| **Images & Scans**         | Validates magic bytes/dimensions and stores image source records.                                                  | **Phase 9 (Images & Scans)** | Self-hosted OCR pipeline, vision-model structure extraction, verified-from-scan review queue routing.           |

---

## 2. LLM Engine & Evaluation

- **Replay / Mock Mode in CI:** Live Gemini extraction is active in production/live mode, while automated CI and gate test suites run against recorded deterministic fixtures to maintain reproducibility and zero secret exposure.
- **Evaluation Gold Set:** Gold Evaluation Set 1 (`packages/evals/fixtures/gold-set-1.json`) is drafted with verified SHA-256 hashes and awaits human review before Phase 6.
