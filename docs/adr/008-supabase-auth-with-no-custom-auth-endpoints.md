# ADR-008: Supabase Auth with No Custom Auth Endpoints

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

User identity, authentication, and session management are essential for document tenancy, personal libraries, and quota enforcement. Writing custom authentication endpoints frequently introduces security vulnerabilities, session leakage, and unnecessary code maintenance.

## Options Considered

- **Direct Supabase Auth (Email + Google OAuth):** Client communicates directly with Supabase Auth; backend verifies incoming JWTs cryptographically; database enforces Row-Level Security (RLS) on `auth.uid()`.
- **Custom Backend Auth Endpoints:** Proxying auth requests through Fastify API. Adds attack surface and maintenance overhead.
- **NextAuth / Auth.js / Custom JWT Provider:** Extra infrastructure with separate token management.

## Decision

Use Supabase Auth directly from the web client for email/password and OAuth sign-in, with Row-Level Security (RLS) enforced at the Postgres database layer on every table. The backend serves NO custom authentication endpoints.

## Consequences

- **Positive:** Zero custom auth vulnerabilities; RLS guarantees two-account isolation directly in SQL; backend remains stateless.
- **Negative / Trade-offs:** Development requires local Supabase stack; integration tests must simulate or issue valid Supabase JWTs.

## Evidence Links

- PRD Section 1 (Rule R10), Section 5 (AUTH-01), Section 10a
