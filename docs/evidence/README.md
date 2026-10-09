# Slice Evidence Files

This directory records the empirical evidence files produced at the conclusion of each development slice, as mandated by PRD Section 3 (Engineering Principle 4) and Section 12.

## Protocol for Evidence Files

Every slice concludes with `docs/evidence/<slice>.md` detailing:

1. Exact commands executed (with all secrets strictly redacted).
2. Observed outputs, test logs, and runtime behavior.
3. Screenshots or recordings of user interfaces and visual interactions.
4. A clear, explicit "Not Verified" section documenting items deferred or dependent on external staging infrastructure.

---

## Roadmap Phases Evidence Index

| Phase        | Slice / Evidence File                                               | Description                                               | Status   |
| :----------- | :------------------------------------------------------------------ | :-------------------------------------------------------- | :------- |
| **Phase 0**  | [phase-0.md](phase-0.md) / [phase-0-cleanup.md](phase-0-cleanup.md) | Workspace cleanup, hygiene, quality scripts               | Complete |
| **Phase 1**  | [phase-1-contracts-db.md](phase-1-contracts-db.md)                  | Evidence graph Zod contracts, RLS policies, migrations    | Complete |
| **Phase 2**  | [phase-2-design-system.md](phase-2-design-system.md)                | Token system, WCAG AA contrast (120 pairs), themes        | Complete |
| **Phase 3**  | [phase-3-visual-engine.md](phase-3-visual-engine.md)                | ECharts integration, lazy chunks, point-to-fact specs     | Complete |
| **Phase 4**  | [phase-4-core-journeys.md](phase-4-core-journeys.md)                | App Shell, Document Library, real-time progress           | Complete |
| **Phase 5**  | [phase-5-insights-grounding.md](phase-5-insights-grounding.md)      | Civic Insights, 100% sentence grounding, haptics          | Complete |
| **Phase 6**  | [phase-6-pdf-storyboard.md](phase-6-pdf-storyboard.md)              | Advanced PDF extraction, layout detection, Storyboard     | Complete |
| **Phase 7**  | [phase-7-csv-duckdb.md](phase-7-csv-duckdb.md)                      | CSV parser, tabular metrics, dual computation validator   | Complete |
| **Phase 8**  | [phase-8-maps-geospatial.md](phase-8-maps-geospatial.md)            | GeoJSON/KML parser, offline Indian gazetteer              | Complete |
| **Phase 9**  | [phase-9-images-scans.md](phase-9-images-scans.md)                  | OCR pipeline, 80% confidence floor, EXIF sanitization     | Complete |
| **Phase 10** | [phase-10-review-inspector.md](phase-10-review-inspector.md)        | Review Queue (Rule 8 gate), Document Inspector, Conflicts | Complete |
| **Phase 11** | [phase-11-evals-hardening.md](phase-11-evals-hardening.md)          | Multi-modal sweeps, palette guard, CI workflow matrix     | Complete |
| **Phase 12** | [phase-12-release-readiness.md](phase-12-release-readiness.md)      | Release packaging, threat model, complete verification    | Complete |
