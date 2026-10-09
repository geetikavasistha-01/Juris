# Evidence: Phase 4 Core User Journeys & App Shell

- **Slice:** `phase-4-core-journeys`
- **Branch:** `phase-4-core-journeys`
- **Date:** 2026-10-09
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 4 validates and strengthens the primary navigation, authentication, and document lifecycle views:

1. **Authentication & Session Handling:**
   - Password and guest sign-in flows in `apps/web/src/pages/AuthPage.tsx` and `apps/web/src/lib/auth.tsx`.
   - Token refresh and protected route redirects.
2. **Document Upload with Format Validation:**
   - Client preflight checking supported extensions and 50MB file size limits in `apps/web/src/pages/UploadPage.tsx`.
   - Server-authoritative MIME and magic bytes enforcement (`%PDF-`) in `apps/api/src/routes/documents.ts`.
3. **Live Progress Monitoring:**
   - Dual-channel tracking combining Supabase Realtime WebSocket events with a 1000ms polling fallback in `apps/web/src/pages/LiveProgressPage.tsx`.
   - Enforcing sequence monotonicity across extraction, chunking, and indexing stages.
4. **Document Library & Honest States:**
   - Document catalog search, format filters, and status tabs in `apps/web/src/pages/DocumentLibraryPage.tsx`.
   - Clear explanations for empty library, no matching search results, and unauthenticated visitors.
5. **End-to-End User Journey Gate:**
   - Verified end-to-end journey via `apps/api/src/journeys.test.ts`: upload PDF -> watch live progress -> inspect library -> view document.

---

## 2. Commands Run and Observed Results

### 1. End-to-End User Journey Tests (`pnpm vitest run apps/api/src/journeys.test.ts`)

```bash
pnpm vitest run apps/api/src/journeys.test.ts
```

**Observed Output:**

```text
 ✓ apps/api/src/journeys.test.ts (2 tests) 5682ms
   ✓ Phase 4: Core User Journeys & App Shell End-to-End > verifies honest empty state before any uploads  524ms
   ✓ Phase 4: Core User Journeys & App Shell End-to-End > completes the full end-to-end lifecycle: upload -> live progress -> library inspection -> document view  4738ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  8.61s
```

### 2. Full Test Suite (`pnpm test`)

```bash
pnpm test
```

**Observed Output:**

```text
 Test Files  21 passed (21)
      Tests  135 passed (135)
```

### 3. Monorepo Quality Gates (`pnpm lint && pnpm typecheck && pnpm check:contrast && pnpm check:tokens`)

```bash
pnpm lint && pnpm typecheck && pnpm check:contrast && pnpm check:tokens
```

**Observed Output:**

```text
All 120 WCAG AA contrast checks PASSED (100% compliant)
Scanned 44 source files. 100% compliant with design tokens and self-hosted fonts.
Typecheck: 0 errors
Lint: 0 errors, 0 warnings
```

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `apps/api/src/journeys.test.ts`: Added Phase 4 end-to-end user journey tests.
  - `docs/adr/017-phase-4-core-user-journeys-and-app-shell.md`: Added ADR-017.
  - `docs/evidence/phase-4-core-journeys.md`: Added Phase 4 evidence report.

---

## 4. Not Verified List

- WebSocket reconnection under sudden TCP network interface toggles in mobile Safari (handled via HTTP 1000ms polling fallback).
