# ADR-017: Phase 4 Core User Journeys and App Shell Architecture

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 4 (Core User Journeys & App Shell)

---

## 1. Context and Problem Statement

The core user experience of Juris relies on a unified, reliable application shell that navigates the civic analyst through the complete lifecycle:

1. Authentication & Session handling (Supabase Auth, password & demo guest pathways).
2. Document Upload with client-side preflight format validation and server-authoritative MIME/magic bytes enforcement.
3. Live Ingestion Progress view with dual-channel status tracking: Supabase Realtime WebSocket events coupled with a resilient 1000ms polling fallback.
4. Repository Document Library with search, status and format filtering, sorting, catalog export, and honest empty states.
5. Interactive Document Viewer and verified extraction inspector.

Phase 4 gate requirement:
"Real user journey passes end-to-end: upload PDF -> watch live progress -> inspect library -> view document."

---

## 2. Decision Drivers

- **Zero Silent Failures / Honest States (`AGENTS.md` Rule 9 & PRD 4.1):** Empty, unverified, or failing states must provide transparent explanations and clear recovery actions.
- **Resilient Realtime Tracking:** WebSocket connections can drop in hostile network environments; a continuous polling fallback ensures the user is never stuck in a blind processing loop.
- **Strict Server Authority:** Client file pickers validate file extensions and size limits, but the API remains the authoritative boundary verifying binary magic bytes (`%PDF-`, `0x25 0x50 0x44 0x46`), file quotas, and content hash duplicates.
- **End-to-End Testability:** The entire path from unauthenticated visit through upload, ingestion progression, catalog filtering, and document inspection must be verified against real local services without mocks.

---

## 3. Decisions & Implementation

1. **Application Shell & Layout (`apps/web/src/components/layout/AppLayout.tsx` & `App.tsx`):**
   - Implements semantic header, responsive mobile navigation, theme switcher, and civic audit status footer.
   - Houses route transitions across `/documents`, `/upload`, `/documents/:id`, `/documents/:id/progress`, and `/login`.

2. **Upload Preflight & Ingestion Gate (`apps/web/src/pages/UploadPage.tsx` & `apps/api/src/routes/documents.ts`):**
   - Validates supported extensions (`.pdf`, `.csv`, `.tsv`, `.geojson`, `.kml`, `.png`, `.jpg`, `.tiff`, `.xlsx`) and file size limit (`DEFAULT_MAX_FILE_SIZE_BYTES` = 50 MB).
   - Fastify multipart streaming handler inspects magic bytes, calculates SHA-256 hash, stores raw file in Supabase Storage, and registers queued ingestion job.

3. **Live Progress Dual-Channel Monitor (`apps/web/src/pages/LiveProgressPage.tsx`):**
   - Subscribes to Supabase Realtime channel `doc-progress-${id}` on `job_events`.
   - Concurrently polls `/api/documents/:id/events` at 1000ms intervals until terminal status (`done` or `failed`).
   - Merges and deduplicates events maintaining strict sequence monotonicity.

4. **Document Library & Honest States (`apps/web/src/pages/DocumentLibraryPage.tsx`):**
   - Provides table and grid views with search, format filters, and status tabs (`all`, `ready`, `processing`, `failed`).
   - Honest empty states: distinct cards for unauthenticated users, empty repository, zero search results, and ingestion errors with retry triggers.

5. **End-to-End Test Suite (`apps/api/src/journeys.test.ts`):**
   - Validates empty state responses prior to uploads.
   - Executes real PDF upload, awaits pipeline events, verifies monotonic sequence numbering, inspects catalog listings, checks chunked extracts, and verifies cascade deletion.

---

## 4. Consequences

- The core user journey passes end-to-end against the local Supabase backend.
- Both WebSocket events and HTTP polling keep progress state synchronized.
- Zero mock data exists in the user journey flows.
