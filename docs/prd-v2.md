# Juris v2 - Multimodal Extraction and Interactive Visual Intelligence

Version 2.0 PRD | Owner: Geetika Vasistha | Builds on: Juris v1 (PDF ingestion, Gemini proposal, mechanical verifier, library, progress tracker, viewer, citation drawer)

Scope note: this is based on the capability summary you shared, not on the source files. File paths for new modules are proposals; align them with your existing layout.

## 1. Vision

v1 proves facts from PDFs and shows two charts. v2 turns Juris into a tool where a layman can open any civic or data file (PDF, image, CSV, map) and understand the whole thing in under a minute, then tap any visual to read a plain-language explanation that is itself proven against the source.

Three upgrades:

1. **Deeper extraction**: tables, hierarchies, flows, dates, places, entities, relations, obligations, and arithmetic checks across pages.
2. **More inputs**: PDFs (including scanned), images, CSV, and geospatial files, all feeding one common evidence model.
3. **A visual layer for humans**: a "Document at a Glance" storyboard, 20+ chart types chosen automatically, cross-linked interaction, haptic feedback, and a written, cited summary behind every visual.

The v1 promise stays absolute: **nothing is displayed that cannot be proven from the source.** v2 extends proof beyond quotes to OCR matches, recomputation and geometry checks, and labels every fact with how it was proven.

## 2. Principles

Carried over from v1: provenance or silence; server is authoritative; shared Zod contracts; real tests for real behavior; no placeholder content; no emojis; no external hosts or CDNs.

New in v2:

1. **Code chooses charts, the LLM does not.** A deterministic chart selector maps data shape to chart type. The LLM never emits chart specs or numbers.
2. **Every sentence is cited.** Written summaries are either templated by code or LLM-written and then number-checked against cited facts. Failing sentences are dropped.
3. **Show how it was proven.** Every fact and chart element carries its proof type (quote match, OCR match, recomputed, derived, user-confirmed, estimated).
4. **Estimates are never silent.** Anything read from a picture of a chart or otherwise approximate is styled differently and excluded from overview visuals unless the user opts in.
5. **Layman first, expert on demand.** Every visual and summary has Simple, Standard and Expert levels.

## 3. Architecture: The Evidence Graph

All modalities normalize into one model so that verification, charts and summaries are written once.

```text
Upload -> Modality Router -> Extractor (per modality) -> Evidence Graph
   PDF text | scanned PDF page | image | CSV | GeoJSON/KML/GPX/Shapefile

Evidence Graph = Sources -> Evidence Spans -> Facts -> Relations -> Derived Facts

Evidence Graph -> Verifier (per span kind) -> Verified Graph
Verified Graph -> Chart Selector -> Visual Specs (declarative JSON)
Visual Specs -> Insight Service (templates + checked LLM) -> Insight text per visual and level
Visual Specs + Insights -> Web renderer (ECharts, map) + Haptics + Citation Drawer
```

### Evidence span kinds and their verifiers

| Span kind    | Points to                         | Verifier                                                                  |
| :----------- | :-------------------------------- | :------------------------------------------------------------------------ |
| text_span    | page, bbox, char range            | Existing verifier.ts: verbatim or normalized quote, numbers, units, dates |
| table_cell   | table id, row, column, page, bbox | Cell text match, header and unit linkage, row/column sum checks           |
| image_region | image, bbox, OCR tokens           | Fuzzy match against OCR tokens inside the region above a confidence floor |
| csv_range    | column, row range                 | Dual computation: second independent implementation must agree exactly    |
| geo_feature  | layer, feature id, property key   | Direct attribute read, geometry validity, reprojection and area checks    |

### Proof types (replaces the three v1 statuses)

| Status                  | Meaning                                                  | Shown in overview visuals          |
| :---------------------- | :------------------------------------------------------- | :--------------------------------- |
| VERIFIED                | Quote and numbers found in source text                   | Yes                                |
| VERIFIED_OCR            | Matched in OCR tokens at or above the confidence floor   | Yes, with OCR badge                |
| COMPUTED                | Recomputed by two independent code paths (CSV, geo)      | Yes                                |
| DERIVED                 | Arithmetic from verified facts (growth rate, share, sum) | Yes, with formula on hover         |
| USER_CONFIRMED          | Low-confidence item a human approved                     | Only with toggle, distinct style   |
| ESTIMATED               | Read from a chart image or low-quality scan              | Only with toggle, dashed style     |
| CONFLICT                | Two verified sources disagree                            | Flagged, both values shown         |
| UNVERIFIABLE / REJECTED | Not provable                                             | Never in visuals; visible in audit |

## 4. Modality Support

### 4.1 PDF (upgrade)

- **Layout analysis**: reading order for multi-column pages; headers and footers removed by repetition detection; footnotes linked to their markers.
- **Table reconstruction**: ruled tables from pdf.js operator lines; unruled tables by word-coordinate clustering; header inference; multi-page table stitching; units from captions ("in crore", "in millions") applied to cells.
- **Scanned pages**: pages with no text layer are routed to the image pipeline instead of being rejected (this retires the v1 NO_TEXT_LAYER rejection).
- **Limits**: configurable page cap (default 50 pages; raise to 150 for v2), 30 MB.

### 4.2 Images (new)

- **Accepted**: PNG, JPEG, WebP, single-page TIFF. Max 25 MB and 8000 px on the long side. SVG and animated formats are rejected.
- **Pipeline**: magic-byte check, decode and re-encode with sharp (strips EXIF and GPS), deskew and denoise, OCR with a self-hosted engine (tesseract.js WASM) producing tokens with bboxes and confidence, then a vision LLM call (Gemini, temperature 0) for structure: title, tables, legend, labelled regions, proposed facts with quote and region.
- **Verification**: each proposed quote must fuzzy-match OCR tokens within its region at or above the confidence floor (default 80). Pass gives VERIFIED_OCR. Below the floor, the fact is held in a Review queue; a user can approve it, which sets USER_CONFIRMED.
- **Charts inside images** (a screenshot of a bar chart): values read by the vision model are ESTIMATED unless the data labels are legible in OCR, in which case they verify normally.
- **Printed maps as images**: extract title, legend, labels and place names; show as an annotated image. No georeferencing in v1 of this feature (see risks).

### 4.3 CSV (new)

- **Accepted**: CSV and TSV, UTF-8 and common encodings (detected), max 50 MB and 500,000 rows in this release.
- **Parsing**: delimiter and header detection, type inference (number, currency, percent, date, category, boolean, free text, place name, latitude, longitude), missing-value handling.
- **Profile (all computed in code)**: row and column counts, null rate, distinct counts, min, max, mean, median, quartiles, outliers (IQR rule), date range and gaps, top categories, correlations between numeric columns, geographic column detection.
- **Verification**: every number is a COMPUTED fact whose provenance is column, row range and formula. A second implementation (SQL through DuckDB versus the JavaScript path) must agree exactly or the fact is rejected.
- **LLM role**: only to suggest which columns are the label, measure and time axes, validated against the profile. It never writes numbers. Narrative text is templated.
- **Safety**: cells beginning with =, +, -, @ are neutralized in any export (CSV injection).

### 4.4 Maps and geospatial (new)

- **Accepted vector inputs**: GeoJSON, TopoJSON, KML, GPX, zipped Shapefile (.shp, .dbf, .prj required), and CSV with latitude and longitude. Zip bombs and oversized archives are rejected.
- **Processing**: reproject to WGS84 with proj4, validate and repair geometry, simplify for display, compute area, length and centroids with turf, read attribute tables as facts (provenance: layer, feature id, property).
- **Place names from PDFs and CSVs**: matched against a bundled offline gazetteer (country, state and district boundaries) by exact name or alias. Ambiguous names are flagged, not guessed. Matched values power choropleth maps.
- **Boundary data**: store simplified boundary files under packages/geodata, lazy loaded, total under 3 MB. Confirm licences and required attribution for the sources you choose, and show a neutral boundary disclaimer in the map footer.
- **No external tile servers.** The map draws vector shapes on a plain background. An optional local PMTiles basemap can be added later.

## 5. Advanced Extraction

### 5.1 Fact types

| Type          | Examples                                             | Key fields                                                                      |
| :------------ | :--------------------------------------------------- | :------------------------------------------------------------------------------ |
| Money         | Allocation, expenditure, revenue, tax rate           | amount, currency, scale, period, label, estimate type (budget, revised, actual) |
| Measure       | Percentage, count, ratio, growth rate                | value, unit, subject, period                                                    |
| Date and span | Effective date, deadline, fiscal year, tenure        | start, end, kind                                                                |
| Place         | State, district, city, site                          | name, gazetteer id, confidence                                                  |
| Entity        | Ministry, department, company, act, scheme           | name, kind, aliases                                                             |
| Obligation    | Who must do what by when (bills, tenders)            | actor, action, object, deadline, penalty                                        |
| Definition    | Defined terms                                        | term, definition quote (feeds the glossary)                                     |
| Relation      | allocates_to, amends, funds, part_of, effective_from | subject, predicate, object                                                      |

### 5.2 Multi-pass pipeline

1. **Structure (code)**: layout, tables, captions, units, reading order, section tree.
2. **Propose (LLM, temperature 0)**: per section with its tables attached as structured context; strict JSON schema per fact type; required verbatim quote and location.
3. **Normalize (code)**: currency and scale (thousand, lakh, crore, million, billion) to a canonical value while keeping the original string; fiscal-year parser for forms like 2025-26 and FY25; estimate-type parser for BE, RE and actuals; date and percentage canonicalization.
4. **Verify**: per span kind (section 3). Failed items are retained for audit only.
5. **Reconcile (code)**: merge duplicates repeated across pages; detect conflicting values for the same subject and period (CONFLICT, both shown); check that parts sum to the stated total within rounding tolerance and record each check as a verified or failed reconciliation.
6. **Derive (code)**: share of total, year-over-year change, rank, cumulative sums, utilization (actual over budget). Each derived fact stores its formula and source fact IDs and is DERIVED only if every source is verified.
7. **Flag (code rules, not LLM)**: examples are allocation fell more than a threshold, parts do not sum to total, deadline within a set number of days, a figure is an estimate not an actual. Flags are templated and cited.

### 5.3 Confidence

No LLM self-reported confidence. Display three levels (High, Medium, Review) computed from proof type, OCR confidence, and table-structure confidence.

## 6. Visualization System

### 6.1 Chart selector (deterministic)

The selector scans verified facts and returns ranked chart candidates with the reason for each. Each candidate has minimum data-coverage rules so thin charts are never shown.

| Chart                                     | Chosen when                                                           | Question it answers for a layman              |
| :---------------------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------- |
| Key figures strip with sparklines         | Always                                                                | What are the headline numbers?                |
| Donut or pie                              | 2 to 6 parts of one verified total; more parts are grouped into Other | How is the whole split?                       |
| Treemap                                   | Hierarchy or more than 6 parts                                        | Which items take up most of the money?        |
| Sunburst                                  | Hierarchy of depth 3 or more                                          | What sits inside each department?             |
| Sankey                                    | Source-to-target flows                                                | Where does the money come from and go?        |
| Waterfall                                 | Opening value, components, closing value                              | What changed between last year and this year? |
| Slope chart                               | Two time points per item                                              | Which items rose or fell?                     |
| Line or area                              | Series of 4 or more periods                                           | How has it moved over time?                   |
| Horizontal ranked bar                     | Ranking of categories                                                 | Who is biggest and smallest?                  |
| Grouped or stacked bar                    | Categories across periods                                             | How do items compare over years?              |
| Heatmap                                   | Category by period matrix                                             | Where are the hot spots?                      |
| Bullet chart or gauge                     | Target versus actual                                                  | Did they spend what they planned?             |
| Waffle or unit chart                      | A ratio expressible as 1 in N                                         | How big is this, really?                      |
| Funnel                                    | Ordered stages with counts                                            | Where do people drop off?                     |
| Timeline or Gantt                         | Dates, deadlines, spans                                               | What happens when?                            |
| Choropleth map                            | Values by region matched to gazetteer                                 | Which regions get more or less?               |
| Bubble or point map                       | Point locations with values                                           | Where exactly?                                |
| Network graph                             | Entity relations                                                      | Who is connected to whom?                     |
| Calendar heatmap                          | Dated records (CSV)                                                   | When does activity happen?                    |
| Histogram, box plot, violin               | Numeric distribution (CSV)                                            | What is typical and what is unusual?          |
| Scatter with trend line                   | Two numeric columns                                                   | Do these move together?                       |
| Correlation heatmap, parallel coordinates | Many numeric columns                                                  | Which columns are related?                    |

Box plots and histograms are used where they fit (mostly CSV). Budget and legal documents lean on treemaps, flows, waterfalls and timelines because those are the shapes the data actually has.

### 6.2 Visual Spec (declarative)

Every visual is a JSON spec validated by a shared Zod schema:

`{ id, kind, title, encodings, series[{ label, value, factIds[] }], proofSummary, filters, a11yTable }`

Rules: every series point lists its source fact IDs; the renderer cannot draw a value that has no fact ID; a spec check (check-visual-specs.mjs) fails the build if any fixture spec violates this.

### 6.3 Document at a Glance (the layman view)

One scrolling storyboard, generated per document, ordered as a story:

1. **What is this**: title, document type, issuer, period, page or row count, verification rate.
2. **The big numbers**: key figures strip with sparklines.
3. **Where the money goes**: treemap or Sankey.
4. **What changed**: waterfall or slope chart.
5. **When things happen**: timeline of dates and deadlines.
6. **Where**: choropleth or point map (only if geographic facts exist).
7. **Who is involved**: network graph (only if relations exist).
8. **Things to know**: the code-generated flags, each cited.

Steps with insufficient data are hidden, not faked. A one-paragraph "in one minute" summary at the top is built from the cited sentences of the panels below.

### 6.4 Interaction model

- Hover and tap highlight with a tooltip that shows value, share, period and proof badge.
- **Click or tap opens the Insight Panel** (slide-over; bottom sheet on mobile) for that element or the whole chart.
- **Cross-filtering**: selecting a ministry, region, year or category filters every other visual, the facts table, and the timeline. Selection state lives in the URL so views are shareable.
- Drill down and up (treemap to sunburst to facts), with breadcrumbs.
- Compare mode: pin two items and see the difference with a derived, cited delta.
- "Show the data" toggle on every chart reveals the accessible table.
- Include-estimates toggle (default off).
- Reading level switch: Simple, Standard, Expert.
- Glossary: jargon terms are underlined; tapping shows the document's own definition (cited) or a curated glossary entry labelled as general knowledge.

### 6.5 Insight Panel and written summaries

Panel sections:

1. **Headline**: one sentence.
2. **From the document**: 2 to 5 sentences, each with citation chips that open the Citation Drawer.
3. **How to read this chart**: static, templated help text, clearly separated because it makes no claims about the document.
4. **Related**: links to other visuals and facts that share the selection.

Generation and checking:

- Default path is deterministic templates driven by the visual spec (for example: largest share, smallest share, change versus prior period), so a summary always exists.
- Optional LLM path (Gemini, temperature 0) receives only the visual spec and its verified facts and must return sentences with fact IDs.
- **Grounding checker** (new shared module): every number in a sentence must equal a cited fact or a derived fact within rounding; every comparative word (largest, rose, fell, majority) must hold when recomputed from the cited facts; every entity must appear in cited facts. Sentences that fail are dropped. If none survive, the template path is used.
- Cached per visual, level and fact-set hash; invalidated when facts change.
- The existing assertAnalysisDerivedFromVerifiedFacts guard is extended to cover insight rows.

### 6.6 Haptics and feedback

| Event                              | Pattern (ms)       |
| :--------------------------------- | :----------------- |
| Hover or selection change on touch | 8                  |
| Open Insight Panel                 | 15                 |
| Drill down                         | 12, 30, 12         |
| Reached top or bottom of hierarchy | 25                 |
| Flag or conflict revealed          | 30, 40, 30         |
| Ingestion completed                | 10, 30, 10, 30, 20 |

Implementation (apps/web/src/lib/haptics.ts):

- Uses the Vibration API with feature detection. As far as I know it works on Android Chrome and Firefox but not on iOS Safari or most desktop browsers, so haptics are a progressive enhancement, never the only feedback.
- Always paired with a visual pulse on the selected element, and an optional soft audio tick (opt-in, off by default).
- Disabled when prefers-reduced-motion is set; user toggle in settings; throttled to one event per 80 ms; no haptics during page scroll.
- Pure function pattern table plus a thin adapter so tests can mock navigator.vibrate.

### 6.7 Accessibility and design for charts

- Colour-blind-safe categorical palette defined in tokens.css for light and dark, checked by check-contrast.mjs for 3:1 against backgrounds; patterns or direct labels in addition to colour; pie slices have labels, not just a legend.
- Every chart has an ECharts aria description, a keyboard path to every element (arrow keys to move, Enter to open the Insight Panel), and a data table alternative.
- Motion is minimal and respects prefers-reduced-motion.
- Each chart module is lazy loaded; the overview loads charts as they scroll into view.

## 7. Data Model Additions

| Table                   | Purpose and key columns                                                                                          |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------- |
| sources                 | id, document_id, modality, page_or_sheet, width, height, sha256                                                  |
| evidence_spans          | id, source_id, kind, locator jsonb (bbox, char range, cell range, feature id), text                              |
| tables                  | id, source_id, caption, unit, header jsonb, cells jsonb, structure_confidence                                    |
| datasets                | document_id, columns jsonb, profile jsonb, row_count                                                             |
| geo_layers              | id, document_id, crs, feature_count, simplified jsonb                                                            |
| entities                | id, document_id, kind, name, aliases[], gazetteer_id                                                             |
| relations               | id, subject_id, predicate, object_id, fact_ids[]                                                                 |
| document_facts (extend) | add type, proof_type, span_id, confidence_level, normalized_value, original_text                                 |
| derived_facts           | id, document_id, formula, source_fact_ids[], value, unit                                                         |
| reconciliations         | id, document_id, kind, status, source_fact_ids[], detail                                                         |
| flags                   | id, document_id, rule, severity, source_fact_ids[], text                                                         |
| visual_specs            | id, document_id, kind, spec jsonb, fact_set_hash, rank                                                           |
| visual_insights         | id, visual_id, level, element_key, sentences jsonb (text + fact_ids), generator (template or llm), fact_set_hash |
| review_queue            | id, fact_id, reason, status                                                                                      |

All tables get row level security through documents.owner_id. Constraints: visual_specs and visual_insights require non-empty fact id arrays; no insight row may be written without passing the grounding checker.

## 8. API Additions

| Method and path                                                       | Purpose                                                                |
| :-------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| GET /api/documents/:id/overview                                       | Storyboard: ordered panels with visual specs and in-one-minute summary |
| GET /api/documents/:id/visuals                                        | All ranked visual specs (gallery)                                      |
| GET /api/documents/:id/visuals/:vid/insight?level=&element=           | Cited summary for a visual or element                                  |
| GET /api/documents/:id/entities and /relations                        | Network and glossary data                                              |
| GET /api/documents/:id/tables                                         | Reconstructed tables                                                   |
| GET /api/documents/:id/dataset                                        | CSV profile                                                            |
| GET /api/documents/:id/geo                                            | Simplified geometry plus matched regions                               |
| GET /api/documents/:id/review and POST /api/documents/:id/review/:fid | Review queue and user confirmation                                     |
| GET /api/documents/:id/flags                                          | Code-generated flags                                                   |

Upload endpoint accepts the new types via the modality module; errors add UNSUPPORTED_GEO_CRS, CSV_TOO_LARGE, IMAGE_TOO_LARGE, ARCHIVE_REJECTED, OCR_LOW_QUALITY.

## 9. Code Layout (proposed)

```text
packages/shared/src/
  evidence.ts        span kinds, proof types, status enums
  verifiers/         text.ts, table.ts, ocr.ts, csv-dual.ts, geo.ts   (verifier.ts becomes verifiers/text.ts)
  normalize/         money.ts, period.ts, units.ts
  chart-selector.ts  rules, candidates, reasons
  visual-spec.ts     Zod schemas
  grounding.ts       sentence checker for insights
  insight-templates.ts
apps/api/src/pipeline/
  router.ts          modality routing
  pdf/ layout.ts, tables.ts
  image/ preprocess.ts, ocr.ts, vision.ts
  csv/ parse.ts, profile.ts
  geo/ parse.ts, gazetteer.ts
  reconcile.ts, derive.ts, flags.ts, insights.ts
packages/geodata/    simplified boundaries + gazetteer (lazy loaded)
apps/web/src/components/visuals/
  OverviewStoryboard.tsx, VisualCard.tsx, InsightPanel.tsx, ProofBadge.tsx
  charts/ (one lazy module per chart family: parts, flow, time, map, network, distribution)
apps/web/src/lib/haptics.ts, selection-store.ts (URL-synced cross-filter state)
```

Remove or fold in: the two v1 chart components in DocumentVisuals.tsx (replaced by the VisualCard system), and the Gemini prompt for generating chart data if any exists.

## 10. Security, Privacy and Limits

- Parse untrusted files in the worker only, with timeouts and memory caps; archives are size and entry-count limited; no path traversal on zip entries.
- Images are re-encoded and stripped of metadata; SVG and HTML-like uploads are rejected.
- CSV exports neutralize formula prefixes.
- Only extracted text and image crops needed for the call are sent to Gemini; document this in the README and show a notice on upload. Provide a setting to disable vision calls for sensitive files (CSV and vector map paths need no LLM for facts).
- Per-user rate limits on upload and insight generation; LLM spend cap per document.

## 11. Testing and Evaluation

- **Gold sets per modality** in packages/evals: PDF with tables, scanned page, chart screenshot, CSV, GeoJSON. Metrics: fact precision after verification (target at least 99 percent of displayed facts correct), recall of gold facts, table cell accuracy, OCR match rate, insight grounding pass rate (target 100 percent of displayed sentences).
- **Unit**: each verifier with adversarial inputs (altered digits, swapped units, near-miss quotes), normalizers, chart selector golden tests (data shape in, ranked charts out), grounding checker (sentences with wrong numbers and false comparatives must fail), haptics pattern gating.
- **Contract**: every new endpoint parsed against shared schemas.
- **E2E real**: upload each modality; overview renders; click a chart element and see an Insight Panel whose citations open the drawer; cross-filter changes other visuals; cross-tenant isolation for new tables; socket-drop still works.
- **A11y**: Axe on Overview and Insight Panel in both themes; keyboard-only run through every chart type.
- **Performance budgets**: initial bundle unchanged from v1 budget; each chart family under its own size limit (enforced by check-bundle.mjs); overview first paint with skeletons under 2 seconds on the 18-page sample.
- **New checks**: check-visual-specs.mjs, check-insights-grounding.mjs, check-palette.mjs (colour-blind simulation plus contrast).

## 12. Build Plan

Each phase ends with a gate; do not start the next until it passes.

1. **Phase 1 - Evidence Graph refactor**: introduce evidence.ts, move verifier.ts to verifiers/text.ts, extend document_facts, add proof types. Gate: all v1 tests green, no behavior change.
2. **Phase 2 - Visual engine on existing PDF data**: visual-spec, chart-selector, VisualCard, ECharts families (parts, time, flow), ProofBadge, selection store, URL state. Gate: v1 sample shows at least 5 chart types chosen automatically, all point-to-fact traceable.
3. **Phase 3 - Insights and haptics**: templates, grounding checker, Insight Panel, optional LLM path, haptics module, glossary. Gate: grounding tests pass; no unproven sentence can be stored.
4. **Phase 4 - Advanced PDF extraction**: layout, tables, normalization, relations, reconcile, derive, flags, Overview storyboard. Gate: gold PDF metrics met; storyboard renders for the budget sample.
5. **Phase 5 - CSV**: parser, profiler, dual-compute verifier, distribution and correlation charts, calendar heatmap. Gate: dual-compute disagreement is detected in a seeded-bug test.
6. **Phase 6 - Maps**: geo parsers, gazetteer, choropleth and point maps, place matching from PDFs and CSVs. Gate: shapefile, KML and GeoJSON fixtures verified; ambiguous names flagged.
7. **Phase 7 - Images and scanned PDFs**: preprocess, OCR, vision, VERIFIED_OCR, review queue, ESTIMATED styling. Gate: scan gold set meets OCR match target; low-quality image yields review items, not facts.
8. **Phase 8 - Hardening**: accessibility sweep, performance budgets, security tests (zip bomb, malformed files), README and ADRs for the evidence graph, chart selector and grounding checker.

## 13. Localhost Additions

Base setup is unchanged from the v1 PRD (Docker, Supabase CLI, pnpm, API, worker, web).

New dependencies (verify current versions and licences when installing):

```bash
pnpm --filter api add sharp tesseract.js papaparse duckdb shpjs @tmcw/togeojson proj4 @turf/turf
pnpm --filter web add echarts
# MapLibre only if you later add a vector basemap: pnpm --filter web add maplibre-gl
```

New API env values:

```bash
GEMINI_API_KEY=<your key>
VISION_ENABLED=true
OCR_CONFIDENCE_FLOOR=80
MAX_CSV_MB=50
MAX_CSV_ROWS=500000
MAX_IMAGE_MB=25
MAX_PDF_PAGES=150
```

Sample inputs to keep in the repo under samples/ (use only files you have the right to include): the 18-page budget PDF, a small CSV, a small GeoJSON, a photographed or scanned budget page. Run the three processes as before, open http://localhost:5173, upload each sample, then open the Overview, click a treemap block, and confirm the Insight Panel shows cited sentences. On an Android phone on the same network, open the dev server by LAN address to feel the haptics.

## 14. Definition of Done

1. Every modality (PDF, scanned PDF page, image, CSV, vector map) uploads and produces a verified Overview.
2. At least 15 chart kinds are implemented and selected automatically by data shape; box plots and histograms appear only where data fits.
3. Clicking any chart element opens an Insight Panel with cited sentences; zero sentences without a passing grounding check.
4. Cross-filtering works across all visuals and survives page reload through the URL.
5. Haptics fire on supporting devices, are silent when unsupported or when reduced motion is set, and never replace visual feedback.
6. Displayed-fact precision and grounding targets in section 11 are met on the gold sets.
7. Axe reports zero violations on Overview and Insight Panel in light and dark themes; every chart is fully keyboard operable.
8. All v1 and v2 check scripts, unit, contract and e2e suites pass twice consecutively.

## 15. Risks and Open Questions

| Risk                                               | Mitigation                                                                                   |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| Poor scans produce wrong OCR                       | Confidence floor, Review queue, ESTIMATED styling, OCR_LOW_QUALITY error for hopeless images |
| Table reconstruction errors                        | Reconciliation sums catch many; low structure confidence lowers the fact's confidence level  |
| Map images cannot be georeferenced reliably        | Treat as annotated images; offer a manual three-point georeference later                     |
| Boundary data is politically sensitive or licensed | Pick sources with clear licences, show attribution and a neutral disclaimer                  |
| Too many charts overwhelm a layman                 | Overview limited to 8 story steps; the full gallery is a separate tab                        |
| LLM cost and latency rise with vision              | Template-first summaries, caching, per-document spend cap, vision opt-out                    |
| iOS has no web haptics                             | Visual pulse and optional audio tick; revisit if browser support changes                     |

Open questions:

1. Which document types matter most for the first release (municipal budgets, bills, tenders) so the flag rules and glossary can be tuned?
2. Should the LLM insight path ship on by default, or should templates be the default with LLM as an opt-in "richer explanation"?
3. Are regional-language documents in scope? If so, OCR language packs and bilingual glossary need their own phase.
