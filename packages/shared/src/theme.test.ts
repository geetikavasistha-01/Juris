import { describe, it, expect } from 'vitest';
import {
  ThemeIdSchema,
  ThemePreferenceSchema,
  THEMES,
  resolveTheme,
  getThemeMetadata,
  type ThemeId,
  type ThemePreference,
} from './theme.js';

describe('Design System Theme Contracts', () => {
  it('validates exactly the 4 canonical themes', () => {
    const validThemes: ThemeId[] = ['matcha-light', 'matcha-dark', 'mono-light', 'mono-dark'];

    for (const theme of validThemes) {
      expect(ThemeIdSchema.parse(theme)).toBe(theme);
    }

    // Rejects retired and invalid themes
    const invalidThemes = ['civic', 'slate', 'high-contrast', 'default', 'dark', 'light', 'neon'];
    for (const invalid of invalidThemes) {
      expect(() => ThemeIdSchema.parse(invalid)).toThrow();
    }
  });

  it('validates theme preferences including system', () => {
    const validPreferences: ThemePreference[] = [
      'system',
      'matcha-light',
      'matcha-dark',
      'mono-light',
      'mono-dark',
    ];

    for (const pref of validPreferences) {
      expect(ThemePreferenceSchema.parse(pref)).toBe(pref);
    }

    expect(() => ThemePreferenceSchema.parse('auto')).toThrow();
    expect(() => ThemePreferenceSchema.parse('high-contrast')).toThrow();
  });

  it('contains metadata for all 4 themes with proper mode and family', () => {
    expect(Object.keys(THEMES)).toHaveLength(4);

    expect(THEMES['matcha-light']).toEqual({
      id: 'matcha-light',
      label: 'Matcha Light',
      mode: 'light',
      family: 'matcha',
      description: 'Earthy, modern sage and matcha green accents on clean cream/paper backgrounds.',
    });

    expect(THEMES['matcha-dark']).toEqual({
      id: 'matcha-dark',
      label: 'Matcha Dark',
      mode: 'dark',
      family: 'matcha',
      description: 'Deep moss and dark forest tones with soft sage highlights.',
    });

    expect(THEMES['mono-light']).toEqual({
      id: 'mono-light',
      label: 'Mono Light',
      mode: 'light',
      family: 'mono',
      description: 'Minimalist, editorial monochrome with stark ink contrasts.',
    });

    expect(THEMES['mono-dark']).toEqual({
      id: 'mono-dark',
      label: 'Mono Dark',
      mode: 'dark',
      family: 'mono',
      description: 'Sleek carbon and slate monochrome with crisp white typography.',
    });
  });

  it('resolves explicit preferences directly', () => {
    expect(resolveTheme('matcha-light', false)).toBe('matcha-light');
    expect(resolveTheme('matcha-light', true)).toBe('matcha-light');
    expect(resolveTheme('mono-dark', false)).toBe('mono-dark');
    expect(resolveTheme('mono-dark', true)).toBe('mono-dark');
  });

  it('resolves system preference to matcha-light or matcha-dark based on media query', () => {
    expect(resolveTheme('system', false)).toBe('matcha-light');
    expect(resolveTheme('system', true)).toBe('matcha-dark');
  });

  it('retrieves theme metadata safely', () => {
    const meta = getThemeMetadata('mono-light');
    expect(meta.label).toBe('Mono Light');
    expect(meta.mode).toBe('light');
    expect(meta.family).toBe('mono');
  });
});
