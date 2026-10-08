# Branching and Integration Strategy

## 1. Protected Main Branch

- The `main` branch is protected. Direct commits and force-pushes to `main` are strictly prohibited.
- All changes enter `main` exclusively through pull requests that pass all automated CI checks and receive human review approval.

## 2. Short-Lived Branches per Phase Step

- Development branches must be short-lived, dedicated to a single phase step or slice.
- Long-running feature branches spanning multiple phases or slices are prohibited.
- Branches must branch from the latest `main` and be rebased onto `main` before merging.

## 3. Branch Naming Prefixes

Branches must use area prefixes reflecting the subsystem being modified:

- `web/<slice-or-step-name>`: Web frontend application (`apps/web`)
- `api/<slice-or-step-name>`: Backend API service (`apps/api`)
- `model/<slice-or-step-name>`: Model pipeline, prompts, and evaluation (`packages/model`, `packages/evals`)
- `db/<slice-or-step-name>`: Database migrations and Supabase schemas (`supabase/migrations`)

Phase branches covering foundation or multi-component phases follow the convention `phase-<number>-<description>` (e.g., `phase-0-cleanup`, `phase-1-contracts-db`).

## 4. Contracts and Migrations Merge First

- Architecture Rule: Contracts first.
- When a change crosses boundaries between packages or tiers, changes to `packages/shared` and `supabase/migrations` must be specified, reviewed, and merged before or alongside the dependent API, web, or model implementations.
- No code in `apps/api` or `apps/web` may duplicate types or run migrations ahead of shared contract definitions.

## 5. Commit Scopes and Standards

Commits must follow Conventional Commits formatting:

- `feat(web): ...`
- `feat(api): ...`
- `feat(model): ...`
- `feat(db): ...`
- `fix(web): ...`
- `fix(api): ...`
- `fix(model): ...`
- `fix(db): ...`
- `docs(...): ...`
- `test(...): ...`
- `chore(...): ...`

Commit history must be clean, atomic, and descriptive. Never rewrite git history on shared branches without explicit approval.

## 6. Continuous Integration Rules

- CI must not use path-filtering.
- Every pull request runs the full verification pipeline regardless of which files changed, ensuring changes to contracts or configurations never introduce silent regressions in unmonitored downstream suites.
