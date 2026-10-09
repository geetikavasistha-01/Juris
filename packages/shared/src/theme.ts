import { z } from 'zod';

/**
 * Exactly 4 canonical themes for Juris Design System:
 * 1. Matcha Light: Earthy, modern sage and matcha green accents on clean cream/paper backgrounds.
 * 2. Matcha Dark: Deep moss and dark forest tones with soft sage highlights.
 * 3. Mono Light: Minimalist, editorial monochrome with stark ink contrasts.
 * 4. Mono Dark: Sleek carbon and slate monochrome with crisp white typography.
 *
 * (High Contrast and Civic/Slate are retired per ADR and PRD-v2 specifications).
 */
export const ThemeIdSchema = z.enum(['matcha-light', 'matcha-dark', 'mono-light', 'mono-dark']);

export type ThemeId = z.infer<typeof ThemeIdSchema>;

export const ThemePreferenceSchema = z.enum([
  'system',
  'matcha-light',
  'matcha-dark',
  'mono-light',
  'mono-dark',
]);

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const ThemeModeSchema = z.enum(['light', 'dark']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const ThemeFamilySchema = z.enum(['matcha', 'mono']);
export type ThemeFamily = z.infer<typeof ThemeFamilySchema>;

export interface ThemeMetadata {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  family: ThemeFamily;
  description: string;
}

export const THEMES: Record<ThemeId, ThemeMetadata> = {
  'matcha-light': {
    id: 'matcha-light',
    label: 'Matcha Light',
    mode: 'light',
    family: 'matcha',
    description: 'Earthy, modern sage and matcha green accents on clean cream/paper backgrounds.',
  },
  'matcha-dark': {
    id: 'matcha-dark',
    label: 'Matcha Dark',
    mode: 'dark',
    family: 'matcha',
    description: 'Deep moss and dark forest tones with soft sage highlights.',
  },
  'mono-light': {
    id: 'mono-light',
    label: 'Mono Light',
    mode: 'light',
    family: 'mono',
    description: 'Minimalist, editorial monochrome with stark ink contrasts.',
  },
  'mono-dark': {
    id: 'mono-dark',
    label: 'Mono Dark',
    mode: 'dark',
    family: 'mono',
    description: 'Sleek carbon and slate monochrome with crisp white typography.',
  },
};

/**
 * Resolves user preference against system dark mode detection.
 * Defaults system preference to the primary Matcha family ('matcha-dark' or 'matcha-light').
 */
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ThemeId {
  if (preference === 'system') {
    return systemIsDark ? 'matcha-dark' : 'matcha-light';
  }
  return preference;
}

/**
 * Retrieves metadata for a theme.
 */
export function getThemeMetadata(themeId: ThemeId): ThemeMetadata {
  const meta = THEMES[themeId];
  if (!meta) {
    throw new Error(`Unknown theme: ${themeId}`);
  }
  return meta;
}
