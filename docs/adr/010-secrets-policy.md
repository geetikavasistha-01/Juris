# ADR-010: Secrets Policy

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Accidental commitment or logging of API keys and credentials compromised security in v1. A strict, automated secrets policy must exist prior to the first commit and be enforced across local workflows and CI.

## Options Considered

- **Multi-Layered Automated Secrets Defense (ADR-010):**
  1. `.gitignore` strictly excluding all environment files except `.env.example`.
  2. Local pre-commit scanner via `secretlint` on staged files.
  3. CI scanner via `gitleaks` on every pull request and push.
  4. Structured logging redaction and key-shaped string scrubber in Pino.
  5. Local Supabase development stack so production service keys never exist on developer laptops.
  6. Client bundle guard tests preventing forbidden variables (`SECRET`, `SERVICE`, `PRIVATE`, `GEMINI`, `API_KEY`) from entering `VITE_` environments.
- **Manual / Convention-Only Vigilance:** Proven to fail under pressure.

## Decision

Enforce the multi-layered automated secrets policy outlined above from Day 0 across the entire repository.

## Consequences

- **Positive:** Zero repository secrets; zero credentials in application logs or client bundles; clean git commit history.
- **Negative / Trade-offs:** Developers must run local Supabase or provide synthetic keys in local test environments.

## Evidence Links

- PRD Section 1 (Rule R3), Section 9.4, Section 5 (PLT-03)
