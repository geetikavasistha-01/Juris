# Architectural Decision Records (ADRs)

This directory documents the foundational architectural, security, and algorithmic decisions for Juris in accordance with PRD Section 3 and `AGENTS.md`.

## Index of Decisions

| ADR                                                                       | Title                                                              | Status   | Date       |
| :------------------------------------------------------------------------ | :----------------------------------------------------------------- | :------- | :--------- |
| [ADR-000](000-template.md)                                                | Architectural Decision Record Template                             | Accepted | 2026-10-09 |
| [ADR-001](001-llm-provider-and-structured-output.md)                      | LLM Provider and Structured Output Strategy                        | Accepted | 2026-10-09 |
| [ADR-002](002-postgres-backed-job-queue.md)                               | Postgres-backed Job Queue with Row Locking                         | Accepted | 2026-10-09 |
| [ADR-003](003-embeddings-provider-and-dimension.md)                       | Embeddings Provider and Vector Dimensions                          | Accepted | 2026-10-09 |
| [ADR-004](004-pdf-extraction-library.md)                                  | PDF Extraction Library and Self-Hosted Fonts                       | Accepted | 2026-10-09 |
| [ADR-005](005-vision-for-scans-and-images.md)                             | Vision and OCR Pipeline for Scans and Images                       | Accepted | 2026-10-09 |
| [ADR-006](006-chart-library.md)                                           | ECharts Library Selection and Dynamic Importing                    | Accepted | 2026-10-09 |
| [ADR-007](007-hosting-topology.md)                                        | Hosting Topology and Network Boundaries                            | Accepted | 2026-10-09 |
| [ADR-008](008-supabase-auth-with-no-custom-auth-endpoints.md)             | Supabase Auth with No Custom Auth Endpoints                        | Accepted | 2026-10-09 |
| [ADR-009](009-typescript-monorepo-with-shared-contracts.md)               | TypeScript Monorepo with Shared Zod Contracts                      | Accepted | 2026-10-09 |
| [ADR-010](010-secrets-policy.md)                                          | Secrets Policy, Secretlint, and Gitleaks Audit                     | Accepted | 2026-10-09 |
| [ADR-011](011-the-evidence-rule.md)                                       | The Evidence Rule: Provenance or Silence                           | Accepted | 2026-10-09 |
| [ADR-012](012-revised-lazy-chart-chunk-budget.md)                         | Revised Lazy Chart Chunk Budget (< 300 KB)                         | Accepted | 2026-10-09 |
| [ADR-013](013-phase-1-evidence-graph-contracts-and-constraints.md)        | Phase 1 Evidence Graph Contracts and Constraints                   | Accepted | 2026-10-09 |
| [ADR-015](015-phase-2-design-system-and-themes.md)                        | Phase 2 Design System, Okabe-Ito Palette, and WCAG AA              | Accepted | 2026-10-09 |
| [ADR-016](016-phase-3-visual-engine-and-chart-selector.md)                | Phase 3 Visual Engine, Deterministic Chart Selector                | Accepted | 2026-10-09 |
| [ADR-017](017-phase-4-core-user-journeys-and-app-shell.md)                | Phase 4 Core User Journeys and App Shell                           | Accepted | 2026-10-09 |
| [ADR-018](018-phase-5-insight-panel-grounding-checker-and-haptics.md)     | Phase 5 Insight Panel, Grounding Checker, and Haptics              | Accepted | 2026-10-09 |
| [ADR-019](019-phase-6-advanced-pdf-extraction-and-document-storyboard.md) | Phase 6 Advanced PDF Extraction and Document Storyboard            | Accepted | 2026-10-09 |
| [ADR-020](020-phase-7-csv-modality-and-dual-computation.md)               | Phase 7 CSV Modality and Dual-Computation Validator                | Accepted | 2026-10-09 |
| [ADR-021](021-phase-8-geospatial-modality-and-offline-gazetteer.md)       | Phase 8 Geospatial Modality and Offline Gazetteer                  | Accepted | 2026-10-09 |
| [ADR-022](022-phase-9-images-scans-and-ocr-confidence-floor.md)           | Phase 9 Images Scans and OCR Confidence Floor (80%)                | Accepted | 2026-10-10 |
| [ADR-023](023-phase-10-review-queue-and-document-inspector.md)            | Phase 10 Review Queue, Human Approval Gate, and Inspector          | Accepted | 2026-10-10 |
| [ADR-024](024-phase-11-evals-hardening-and-ci.md)                         | Phase 11 Evals Hardening, Multi-Modal Sweeps, and CI Quality Gates | Accepted | 2026-10-10 |
| [ADR-025](025-phase-12-release-readiness-and-threat-model.md)             | Phase 12 Release Readiness, Threat Model, and Packaging            | Accepted | 2026-10-10 |
