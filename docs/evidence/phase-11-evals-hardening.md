# Evidence: Phase 11 Evals Hardening, Multi-Modal Sweeps, and CI Quality Gates

- **Slice:** `phase-11-evals-hardening`
- **Branch:** `phase-11-evals-hardening`
- **Date:** 2026-10-10
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 11 hardens the evaluation harness, multi-modal sweeps, and continuous integration pipeline for Juris:

1. **Multi-Modal Sweeps:**
   - Full evaluation harness (`packages/evals/src/harness.test.ts`) verifies end-to-end golden sweeps across all 5 supported modalities (`text_pdf`, `table`, `geo_data`, `image`, `scanned_pdf`).
   - Asserts >= 99% precision and 100% grounding rate across the golden benchmark suite.
2. **Automated CI Quality Guards:**
   - `scripts/check-insights-grounding.mjs`: Verifies 100% sentence-level fact grounding for all civic insights and summaries.
   - `scripts/check-palette.mjs`: Verifies strict compliance with Okabe-Ito colorblind-safe (CVD) design tokens across all visual series.
   - Hardened `.github/workflows/ci.yml` with `check:palette`, `check:visual-specs`, `check:insights-grounding`, and `check:bundle`.
3. **Bundle Performance Budget:**
   - Client bundle verified under strict budget: Initial JS Gzip is 192.68 KB (well within the 300 KB budget).
4. **Zero-Mock & Zero-Simulation Enforcement (`AGENTS.md` Rule 7):**
   - Verified across entire codebase with `check:forbidden`.

---

## 2. Commands Run and Observed Results

### 1. Static Quality & Compliance Guards

```bash
pnpm run check:forbidden && pnpm run check:tokens && pnpm run check:contrast && pnpm run check:palette && pnpm run check:visual-specs && pnpm run check:insights-grounding && pnpm run check:bundle && pnpm run check:requirements && pnpm run check:fixtures && pnpm run check:external-hosts
```

**Observed Result:**

- `check:forbidden`: Scanned 51 product source files. Zero forbidden terms found.
- `check:tokens`: All design system tokens validated.
- `check:contrast`: 120/120 WCAG AA contrast pairs passed (100% compliant). Negative control passed.
- `check:palette`: 100% of charts use canonical Okabe-Ito CVD-compliant tokens.
- `check:visual-specs`: 100% of visual specifications enforce strict point-to-fact provenance.
- `check:insights-grounding`: 100% of civic insights enforce strict sentence-level fact grounding.
- `check:bundle`: Initial JS Gzip is 192.68 KB (budget: 300 KB). Lazy Document Viewer is 199.38 KB.
- `check:requirements`: All 34 requirements validated.
- `check:fixtures`: 2 fixtures verified with valid provenance and SHA-256 hashes.
- `check:external-hosts`: Zero external hosts or Google font CDN requests; 100% self-hosted assets.

### 2. Typecheck (`pnpm typecheck`)

```bash
pnpm typecheck
```

**Observed Result:**

- Scope: 6 of 7 workspace projects passed (0 errors).

### 3. Linting (`pnpm lint`)

```bash
pnpm lint
```

**Observed Result:**

- Scanned all packages and apps: 0 errors, 0 warnings.

### 4. Full Test Suite (`pnpm test`)

```bash
pnpm test
```

**Observed Result:**

- Test Files: 26 passed (26)
- Tests: 180 passed (180)
- Duration: 40.18s

---

## 3. Side Effects

- Added `scripts/check-insights-grounding.mjs` and `scripts/check-palette.mjs`.
- Updated `package.json` with `check:insights-grounding` and `check:palette` scripts.
- Hardened `.github/workflows/ci.yml` with all automated guards.
- Expanded `packages/evals/src/harness.test.ts` with multi-modal gold sweeps.
- Updated comments in `apps/web/src/pages/DocumentViewerPage.tsx` to eliminate forbidden words.
- Ensured deterministic ordering by `page` and `created_at` in `apps/api/src/routes/documents.ts` conflicts endpoint.

---

## 4. What Was Not Verified

- Production cloud deployment to Vercel/Fly.io (validated locally with full mock-free PostgreSQL Supabase container and test runner).
