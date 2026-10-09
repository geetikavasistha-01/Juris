# ADR-019: Phase 6 Advanced PDF Extraction and Layman Document Storyboard

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 6 (Advanced PDF Extraction & Document Storyboard)

---

## 1. Context and Problem Statement

Civic documents such as municipal budgets, statutory gazettes, and legislative whitepapers present complex multi-column layouts, running headers/footers that pollute extraction quotes, and multi-tier scaled tables (e.g. "Rs in Crore"). Furthermore, lay citizens often find raw multi-page data tables impenetrable.

Phase 6 addresses these core challenges:

1. **Multi-Column Reading Order Detection (`detectReadingOrder`):** Clusters bounding box coordinates across columns to preserve syntactic narrative flow.
2. **Running Header and Footer Stripping (`stripHeadersAndFooters`):** Identifies and strips recurring headers/footers across pages to prevent quote corruption.
3. **Table Scale Propagation (`reconstructTableWithScale`):** Detects column/context scale headers ("in crore", "in million", "lakh") and propagates scalar factors to cell values.
4. **7-Pass Pipeline (`runMultiPassPdfPipeline`):** Structure -> Propose -> Normalize -> Verify -> Reconcile -> Derive -> Flag.
5. **"Document at a Glance" 8-Step Layman Storyboard (`buildDocumentStoryboard` & `DocumentStoryboard.tsx`):**
   1. _What is this?_ (Statutory identity)
   2. _The Big Numbers_ (Macro totals)
   3. _Where the Money Goes_ (Functional expenditure allocations)
   4. _What Changed?_ (Period-over-period delta)
   5. _When Things Happen_ (Implementation timelines)
   6. _Where It Applies_ (Geographic scope)
   7. _Who Is Responsible_ (Agencies and beneficiaries)
   8. _Things to Know & Caveats_ (Conditions and audit flags)

---

## 2. Decision Drivers

- **Zero Unproven Claims:** Every single claim across all 8 storyboard steps must link directly to verified Evidence Graph fact IDs.
- **Budget Gold Set Accuracy (PRD Section 10):** Must achieve >= 99% fact precision on curated budget items.
- **Cognitive Accessibility:** Complex 100+ page budgets must instantly present a structured, plain-language 8-step breakdown.

---

## 3. Decisions & Implementation

1. **Deterministic Layout Reconstruction (`packages/shared/src/parsers/pdf-advanced.ts`):**
   - Implements horizontal midpoint clustering for 2-column detection.
   - Frequency-based top/bottom line stripping removing running headers/footers.
   - Indian number scale propagation converting currency units (`crore` = 10^7, `lakh` = 10^5).

2. **Layman Storyboard Architecture (`packages/shared/src/storyboard.ts`):**
   - Implements `buildDocumentStoryboard` with strict schema validation (`DocumentStoryboardSchema`).
   - Ensures 100% provenance pass rate; unverified facts are dropped.

3. **Evaluation Gate (`packages/evals/src/harness.test.ts`):**
   - Evaluates gold budget items from `packages/evals/fixtures/gold-set-1.json` confirming >= 99% precision.

---

## 4. Consequences

- 8-step storyboard renders verified narrative summaries directly above chart visualizations.
- Multi-column PDFs maintain cohesive reading order without intermingled text.
- 100% provenance verification across all storyboard assertions.
