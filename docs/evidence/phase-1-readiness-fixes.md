# Evidence: Phase 1 Pre-Deployment Readiness Fixes

## Scope

Implemented Phase 1 of `docs/READINESS_AUDIT.md`:

1. Migration for `facts.label` (nullable `TEXT`), applying cleanly to both remote and local Supabase databases.
2. In `ingestion.ts`, explicit error handling on every database write operation (no swallowed errors anywhere in the pipeline; errors fail the job, store a human-readable message in `documents.error_message` and `jobs.payload`, and surface via job events and UI banners).
3. Fixed page filter `<select>` accessible name (with `id="fact-page-filter"`, `aria-label="Filter facts by page"`, and `<label htmlFor="fact-page-filter">`) and fixed `e2e/ui-states/keyboard.spec.ts` selector for the Overview tab.
4. Hid provenance badge and corrected copy when verified facts equal 0 in `DocumentStoryboard.tsx` and `DocumentViewerPage.tsx`.
5. Verified and enforced `temperature: 0` in `proposal.ts` `generateContent` configuration.

## Commands Run

- `pnpm --filter=@juris/shared run build`
- `/opt/homebrew/bin/supabase db push` (applied `20261019000001_add_facts_label.sql` to remote database)
- `/opt/homebrew/bin/supabase migration up` (applied `20261019000001_add_facts_label.sql` to local database)
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test` (all 27 test files, 194 unit tests passing)
- `pnpm run build` (full production build across all packages)
- `pnpm --filter=@juris/e2e test ui-states` (7/7 passed)
- `pnpm --filter=@juris/e2e test real` (16/16 passed, including all 12 Axe Core WCAG 2.1 AA scans)

## Observed Results

- **Typecheck:** 0 errors across all 6 workspace projects.
- **Lint:** ESLint passed with 0 errors/warnings.
- **Unit Tests:** 27 test files passed (194 tests passed, 0 failed).
- **Production Build:** Vite + TypeScript build succeeded in 7.5s.
- **Playwright ui-states:** 7 passed in 2.6s.
- **Playwright real:** 16 passed in 31.8s (including all 12 Axe Core a11y tests across desktop/mobile and light/dark modes).

## Every Place Changed in Ingestion Pipeline Error Handling

1. **Initial Job Status Update:** Checked `initJobErr` on `supabase.from('jobs').update(...)`; throws `JOB_UPDATE_FAILED`.
2. **CSV Datasets Insert:** Checked `dsErr` on `supabase.from('datasets').insert(...)`; throws `DATASET_INSERT_FAILED`.
3. **CSV Tables Insert:** Checked `tblErr` on `supabase.from('tables').insert(...)`; throws `TABLE_INSERT_FAILED`.
4. **CSV Document Update (Processing):** Checked `docErr` on `supabase.from('documents').update(...)`; throws `DOC_UPDATE_FAILED`.
5. **CSV Chunks Insert:** Checked `chunkErr` on `supabase.from('chunks').insert(...)`; throws `CHUNK_INSERT_FAILED`.
6. **CSV Evidence Spans Insert:** Checked `spanErr` on `supabase.from('evidence_spans').insert(...)`; throws `SPAN_INSERT_FAILED`.
7. **CSV Facts Insert:** Checked `factsErr` on `supabase.from('facts').insert(...)`; throws `FACTS_INSERT_FAILED`.
8. **CSV Analysis Insert:** Checked `anaErr` on `supabase.from('analyses').insert(...)`; throws `ANALYSIS_INSERT_FAILED`.
9. **CSV Visualizations Insert:** Checked `visErr` on `supabase.from('visualizations').insert(...)`; throws `VISUAL_INSERT_FAILED`.
10. **CSV Document & Job Completion:** Checked `docDoneErr` and `jobDoneErr`; throws `DOC_UPDATE_FAILED` / `JOB_UPDATE_FAILED`.
11. **GeoJSON Geo Layers Insert:** Checked `geoErr` on `supabase.from('geo_layers').insert(...)`; throws `GEO_LAYER_INSERT_FAILED`.
12. **GeoJSON Document Update (Processing):** Checked `docProcErr` on `supabase.from('documents').update(...)`; throws `DOC_UPDATE_FAILED`.
13. **GeoJSON Chunks Insert:** Checked `chunkErr` on `supabase.from('chunks').insert(...)`; throws `CHUNK_INSERT_FAILED`.
14. **GeoJSON Evidence Spans Insert:** Checked `spanErr` on `supabase.from('evidence_spans').insert(...)`; throws `SPAN_INSERT_FAILED`.
15. **GeoJSON Facts Insert:** Checked `factsErr` on `supabase.from('facts').insert(...)`; throws `FACTS_INSERT_FAILED`.
16. **GeoJSON Analysis Insert:** Checked `anaErr` on `supabase.from('analyses').insert(...)`; throws `ANALYSIS_INSERT_FAILED`.
17. **GeoJSON Visualizations Insert:** Checked `visErr` on `supabase.from('visualizations').insert(...)`; throws `VISUAL_INSERT_FAILED`.
18. **GeoJSON Document & Job Completion:** Checked `docDoneErr` and `jobDoneErr`; throws `DOC_UPDATE_FAILED` / `JOB_UPDATE_FAILED`.
19. **Image Document Update (Processing):** Checked `docProcErr` on `supabase.from('documents').update(...)`; throws `DOC_UPDATE_FAILED`.
20. **Image Chunks Insert:** Checked `chunkErr` on `supabase.from('chunks').insert(...)`; throws `CHUNK_INSERT_FAILED`.
21. **Image Analysis Insert:** Checked `anaErr` on `supabase.from('analyses').insert(...)`; throws `ANALYSIS_INSERT_FAILED`.
22. **Image Visualizations Insert:** Checked `visErr` on `supabase.from('visualizations').insert(...)`; throws `VISUAL_INSERT_FAILED`.
23. **Image Document & Job Completion:** Checked `docDoneErr` and `jobDoneErr`; throws `DOC_UPDATE_FAILED` / `JOB_UPDATE_FAILED`.
24. **PDF Sources Insert:** Checked `srcErr` on `supabase.from('sources').insert(...)`; throws `SOURCE_INSERT_FAILED`.
25. **PDF Document Update (Processing):** Checked `docProcErr` on `supabase.from('documents').update(...)`; throws `DOC_UPDATE_FAILED`.
26. **PDF Chunks Batch Insert:** Checked `chunkErr` on `supabase.from('chunks').insert(batch)`; throws `CHUNK_INSERT_FAILED`.
27. **PDF Facts Insert:** Checked `factsErr` on `supabase.from('facts').insert(factRecordsToInsert)`; throws `FACTS_INSERT_FAILED`.
28. **PDF Analysis Insert:** Checked `anaErr` on `supabase.from('analyses').insert(...)`; throws `ANALYSIS_INSERT_FAILED`.
29. **PDF Visualizations Insert:** Checked `visErr` on `supabase.from('visualizations').insert(...)`; throws `VISUAL_INSERT_FAILED`.
30. **PDF Document & Job Completion:** Checked `docDoneErr` and `jobDoneErr`; throws `DOC_UPDATE_FAILED` / `JOB_UPDATE_FAILED`.
31. **Pipeline Catch Block:** Set `status: 'failed'`, `error_code: 'PROCESSING_FAILED'`, `error_message: errorMsg` on `documents`, and updated `jobs` table with `status: 'failed'`, `stage: 'failed'`, `payload: { error: errorMsg }`.
32. **UI Error Surfacing:** Added failure banner in `DocumentViewerPage.tsx` and `LiveProgressPage.tsx` displaying the exact error message.

## Side Effects

- Restarted API server process so it picked up the new `facts.label` column on the local database.
- Created `supabase/migrations/20261019000001_add_facts_label.sql` and updated `document_facts` view.

## Not Verified

- Excel (.xls / .xlsx) ingestion (scoped out of Phase 1 as requested).
- Persistent worker queue / BullMQ (scoped out of Phase 1 as requested).
- Landing / Home page at `/` (scoped out of Phase 1 as requested).
