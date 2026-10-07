import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/build/**',
      '**/coverage/**',
      '**/supabase/.temp/**',
      '**/supabase/.branches/**',
      '**/.system_generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'table'] }],
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'scripts/**/*.js',
      'scripts/**/*.ts',
      'spikes/**/*.ts',
      'spikes/**/*.js',
      'spikes/**/*.mjs',
    ],
    rules: {
      'no-console': 'off',
    },
  },
);
