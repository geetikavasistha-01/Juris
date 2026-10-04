# Phase 0 Evidence: Foundation Setup & Verification

- **Date:** 2026-10-04
- **Branch:** `main`
- **Artifact:** `docs/evidence/phase-0.md`
- **Status:** Complete & Verified

---

## 1. Summary of Executed Commands and Observed Results

All commands executed locally with zero credentials printed, echoed, or passed in commands or environment logs.

### 1.1 Dependency Installation

- **Command:** `pnpm install`
- **Observation:**
  - Resolved 529 dependencies across 6 workspace packages (`juris` root, `@juris/shared`, `@juris/api`, `@juris/web`, `@juris/evals`, `@juris/e2e`).
  - Successfully installed Husky v9 pre-commit hooks.
  - Zero vulnerability warnings, lockfile generated deterministically (`pnpm-lock.yaml`).

### 1.2 Typecheck

- **Command:** `pnpm run typecheck`
- **Observation:**
  - Ran `tsc --noEmit` across all workspace projects.
  - `@juris/shared`, `@juris/api`, `@juris/web`, and `@juris/e2e` typechecked cleanly with strict TypeScript compiler options (`tsconfig.base.json`).

### 1.3 Linting

- **Command:** `pnpm run lint`
- **Observation:**
  - Ran ESLint v9 (`typescript-eslint` flat configuration).
  - All source and configuration files passed with 0 errors and 0 warnings (`--max-warnings=0`).

### 1.4 Automated Unit & Contract Tests

- **Command:** `pnpm run test`
- **Observation:**
  - Vitest executed 4 test suites across workspace:
    - `apps/api/src/config.test.ts`: 4 passed (parses config, fails fast in production on missing secrets, coerces limits).
    - `apps/api/src/logger.test.ts`: 3 passed (redacts sensitive headers, scrubs synthetic tokens, protects against circular objects).
    - `apps/api/src/app.test.ts`: 1 passed (tests `GET /health` contract matching `@juris/shared` schema).
    - `apps/web/src/config.test.ts`: 9 passed (validates safe client env, rejects forbidden variables containing `SECRET`, `SERVICE`, `PRIVATE`, `GEMINI`, `API_KEY`).
  - Total: 17 passed (17 total).

### 1.5 Workspace Build

- **Command:** `pnpm run build`
- **Observation:**
  - Built `@juris/shared` declaration and JS modules.
  - Built `@juris/api` via `tsc`.
  - Built `@juris/web` via Vite:
    - Production bundle produced in `apps/web/dist/`.
    - Total bundle gzipped size: `70.74 kB` JS, `2.43 kB` CSS. Well within the strict `< 300 kB` performance budget from PRD Section 10a.

### 1.6 Traceability Gate: Requirements Check

- **Command:** `pnpm run check:requirements`
- **Observation:**
  - Read `requirements.yaml` containing all 34 requirements from PRD Section 5.
  - Verified that no requirement marked `implemented` lacks existing test files.
  - Transparently output warning table listing 25 P0 requirements currently `not_started` pending implementation slices.
  - Exited with code 0.

### 1.7 Guard Script: Forbidden Words Scanner

- **Command:** `pnpm run check:forbidden`
- **Observation:**
  - Scanned 10 product source files in `apps/*/src` and `packages/*/src`.
  - Excluded test and fixture files.
  - Scanned for forbidden words: `simulate`, `simulated`, `mock`, `fake`, `dummy`, `lorem ipsum`.
  - Result: 0 forbidden terms found. Exited with code 0.

### 1.8 Security: Local Secret Scanner

- **Command:** `pnpm run scan:secrets`
- **Observation:**
  - Executed `secretlint "**/*"` using `@secretlint/secretlint-rule-preset-recommend`.
  - Scanned entire repository against AWS, GCP, Slack, GitHub, OpenAI, and private key patterns.
  - Result: 0 secret violations found.

### 1.9 Live API Runtime & `/health` Verification

- **Commands:**
  ```bash
  node apps/api/dist/index.js &
  API_PID=$!
  sleep 2
  curl -i http://localhost:3001/health
  kill $API_PID
  ```
- **Observation:**
  - Fastify API initialized and listened on `http://127.0.0.1:3001` with `ROLE=all`.
  - HTTP Request: `GET /health`
  - HTTP Response:
    ```http
    HTTP/1.1 200 OK
    vary: Origin
    access-control-allow-credentials: true
    content-type: application/json; charset=utf-8
    content-length: 65

    {"status":"ok","role":"all","version":"0.1.0","gitSha":"70b1f2a"}
    ```
  - Response perfectly conforms to `HealthResponseSchema` in `@juris/shared`.

### 1.10 Playwright Smoke Test

- **Command:** `pnpm --filter=@juris/e2e test`
- **Observation:**
  - Playwright launched Chromium and connected to Vite dev server on `http://localhost:5173`.
  - Verified document `<title>` is `Juris`.
  - Verified header brand `Juris` and card heading `Juris`.
  - Verified version display (`0.1.0`) and Git SHA.
  - Tested theme switching between Light and Dark modes (`html.dark` class toggled).
  - Listened to page console and runtime errors: 0 console errors, 0 uncaught page exceptions.
  - Result: 1 passed (2.2s).

### 1.11 Pre-Commit Secret Blocking Proof

- **Commands:**
  ```bash
  git checkout -b test-secret-block
  echo "GITHUB_TOKEN=[SYNTHETIC_GH_TOKEN]" > test-leak.txt
  git add test-leak.txt
  git commit -m "test: commit synthetic secret"
  ```
- **Observed Pre-Commit Failure:**
  ```text
  [STARTED] Running tasks for staged files...
  [STARTED] secretlint
  [FAILED] secretlint [FAILED]

  ✖ secretlint:
  /Users/geetikavasistha/Juris/test-leak.txt
    1:13  error  [GITHUB_TOKEN] found GitHub Token: ****************************************

  ✖ 1 problem (1 error, 0 warnings, 0 infos)
  husky - pre-commit script failed (code 1)
  ```
- **Cleanup Commands:**
  ```bash
  rm -f test-leak.txt
  git reset HEAD --hard
  git checkout main
  git branch -D test-secret-block
  ```
- **Observation:**
  - Pre-commit hook actively blocked commit of key-shaped credential.
  - Branch and temporary leak file were deleted cleanly without touching repository history.

---

## 2. "Not Verified" List

As required by PRD Section 3 (Principle 4) and Phase 0 specification, the following items were not verified in this local phase and will be validated in subsequent milestones:

1. **Remote CI Workflow on GitHub:**
   - `.github/workflows/ci.yml` is committed locally; live execution on GitHub runners is pending push to remote repository.
2. **Local Supabase Stack (`supabase start` / `supabase stop`):**
   - Supabase CLI (`v2.118.0`) and Docker (`v29.8.1`) are installed on the system; local Postgres containers (`supabase start`) were not started as the Docker Desktop daemon was not running during Phase 0 foundations.
3. **Database Tables, Schemas, & Migrations:**
   - Strictly out of scope for Phase 0 (no database tables or migrations created).
4. **Live LLM & Embedding Integrations:**
   - Strictly out of scope for Phase 0 (no live LLM calls created; reserved for Day-0 spikes S1/S2 in Phase 1).

---

## 3. Git History (Commits 1 to 10)

```text
87e36db docs(evidence): record Phase 0 verification, runtime checks, and not verified list
70b1f2a ci: add GitHub Actions workflow for lint, test, security, build, and smoke gates
a76d739 docs: establish ADRs, threat model, AGENTS rules, and README status matrix
0edb12d feat(apps): implement GET /health, minimal Juris web with theme tokens, and smoke test
69ead30 feat(guards): add check-forbidden scanner and check-requirements traceability gate
20a9452 feat(logger): implement structured pino logger with redaction and key scrubber
4a43374 feat(config): implement env validation, production fail-fast, and VITE safety guard
d13a6e0 feat(tooling): configure eslint, prettier, vitest, and husky with lint-staged
5bea0cd feat(workspace): configure pnpm monorepo structure, shared contracts, and tooling
f74091d feat(security): establish secrets policy and scanner configuration
```
