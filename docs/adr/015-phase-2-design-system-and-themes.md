# ADR-015: Phase 2 Design System Foundations, 4 Exact Themes, and Evaluation Harness

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 2 (Design System, Foundations & 4 Themes)

---

## 1. Context and Problem Statement

Juris v1 previously supported basic light/dark modes and had experimental exploratory themes (such as High Contrast and Civic/Slate) that lacked rigorous proof-chain semantics and had uneven contrast ratios. Juris v2 requires a calm, precise, document-like editorial aesthetic with four canonical themes:

1. **Matcha Light:** Earthy, modern sage and matcha green accents on clean cream/paper backgrounds (`#e8edd6` bg, `#f7f9ef` surface).
2. **Matcha Dark:** Deep moss and dark forest night tones with soft sage highlights (`#0f1d12` bg, `#182b1c` surface).
3. **Mono Light:** Minimalist, editorial monochrome with stark ink contrasts (`#f8f9fa` bg, `#ffffff` surface).
4. **Mono Dark:** Sleek carbon and slate monochrome with crisp white typography (`#0d1117` bg, `#161b22` surface).

Per user specifications and `docs/system-context.md`, High Contrast and Civic/Slate are formally retired. Furthermore, `packages/evals` needed a concrete evaluation harness skeleton with standard PRD threshold constants (Fact Precision >= 99%, Grounding Pass Rate 100%) to support subsequent multimodal modality evaluation sweeps.

---

## 2. Decision Drivers

- **Zero Duplicated Types & Contracts First (`AGENTS.md` Rule 3):** Theme identifiers and preferences must be strictly typed in `@juris/shared` and validated with Zod schemas.
- **Strict Accessibility Standards:** Every theme must achieve at least 3:1 contrast for all UI/chart components and 4.5:1 for body and muted text against backgrounds and surfaces, verified by `scripts/check-contrast.mjs`.
- **Zero External Fonts or Assets at Runtime (`scripts/check-tokens.mjs`):** Fonts are self-hosted via `@fontsource` (Inter Variable, Source Serif 4 Variable, IBM Plex Mono).
- **Persistent Theme Switching with Zero FOUC:** The user's selection must persist in `localStorage` and apply synchronously prior to React hydration via inline script in `index.html`.
- **Evaluation Skeleton (`packages/evals`):** Modality gold-set evaluation harness with precision, recall, and grounding metrics.

---

## 3. Considered Options

- **Option A (Accepted): Four Canonical Themes with CSS Custom Properties and Shared Contracts.**
  Define `ThemeId` (`matcha-light`, `matcha-dark`, `mono-light`, `mono-dark`) and `ThemePreference` (`system` + the 4 themes) in `@juris/shared/src/theme.ts`. Define exact color palettes in `apps/web/src/styles/tokens.css` with data attributes (`data-theme`, `data-theme-mode`, `data-theme-family`) and class `.dark` for backwards compatibility. Extend `scripts/check-contrast.mjs` to automatically verify all 120 pairwise text and UI contrast checks.
- **Option B: CSS-in-JS or Tailwind Dark Mode Only.**
  Rejected because CSS custom properties (`tokens.css`) provide zero runtime overhead, instant CSS variable cascade without React re-renders, and strict compliance with the no-mock and no-Tailwind styling rules.

---

## 4. Architectural Amendments

1. **Contracts (`packages/shared/src/theme.ts`):**
   - Export `ThemeIdSchema`, `ThemePreferenceSchema`, `ThemeModeSchema`, `ThemeFamilySchema`, and `THEMES` metadata dictionary.
   - `resolveTheme(pref, systemIsDark)` resolves `'system'` to `matcha-dark` (if dark) or `matcha-light` (if light).

2. **Design Tokens (`apps/web/src/styles/tokens.css`):**
   - Clean `:root` (Matcha Light), `.dark` / `[data-theme='matcha-dark']`, `[data-theme='mono-light']`, and `[data-theme='mono-dark']`.
   - Wong / Okabe-Ito color-blind safe 6-series chart palettes.
   - 100% WCAG AA compliance (120/120 checks passed).

3. **UI Primitives (`apps/web/src/components/ui/`):**
   - Added accessible `Toggle` switch primitive with full ARIA switch semantics, keyboard and focus support.
   - Added accessible `Sheet` slide-over primitive with focus trap containment.

4. **Web Theme Provider (`apps/web/src/theme.tsx`):**
   - Synchronizes `data-theme`, `data-theme-mode`, `data-theme-family`, and `.dark` class.
   - Automatically migrates legacy storage values (`light` -> `matcha-light`, `dark` -> `matcha-dark`).
   - Prevents flash of wrong theme in `apps/web/index.html`.

5. **Evaluation Harness (`packages/evals/`):**
   - Scaffolded `EvaluationHarness` in `packages/evals/src/harness.ts`.
   - Constants: `FACT_PRECISION_THRESHOLD = 0.99`, `GROUNDING_PASS_RATE_THRESHOLD = 1.0`, `OCR_MATCH_THRESHOLD = 0.95`.
   - Vitest suite in `packages/evals/src/harness.test.ts` verifying precision, recall, grounding pass rate, and modality sweep runners.

---

## 5. Consequences

- Full backwards compatibility with existing tests and UI components targeting `.dark` or `data-theme="dark"`.
- Instant switching between all 4 themes without layout shifts.
- Complete 120-check WCAG AA contrast compliance verified in CI.
