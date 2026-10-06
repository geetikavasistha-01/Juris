/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',

        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        'text-inverse': 'var(--text-inverse)',

        'brand-navy': 'var(--brand-navy)',
        'brand-navy-hover': 'var(--brand-navy-hover)',
        'accent-teal': 'var(--accent-teal)',
        'accent-teal-hover': 'var(--accent-teal-hover)',
        'accent-teal-subtle': 'var(--accent-teal-subtle)',
        'accent-teal-border': 'var(--accent-teal-border)',

        verified: 'var(--verified)',
        'verified-bg': 'var(--verified-bg)',
        'verified-border': 'var(--verified-border)',

        unverified: 'var(--unverified)',
        'unverified-bg': 'var(--unverified-bg)',
        'unverified-border': 'var(--unverified-border)',

        failed: 'var(--failed)',
        'failed-bg': 'var(--failed-bg)',
        'failed-border': 'var(--failed-border)',

        'quote-highlight': 'var(--quote-highlight)',
        'quote-highlight-solid': 'var(--quote-highlight-solid)',
        'quote-border': 'var(--quote-border)',

        'focus-ring': 'var(--focus-ring)',
        'disabled-bg': 'var(--disabled-bg)',
        'disabled-text': 'var(--disabled-text)',
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        serif: ['Source Serif 4 Variable', 'Source Serif 4', 'Georgia', 'Times New Roman', 'serif'],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }], // 36px
        h1: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }], // 30px
        h2: ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }], // 24px
        h3: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }], // 20px
        body: ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }], // 16px
        small: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }], // 14px
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }], // 12px
        'mono-code': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
      },
      minHeight: {
        touch: 'var(--min-touch-target)',
      },
      minWidth: {
        touch: 'var(--min-touch-target)',
      },
    },
  },
  plugins: [],
};
