// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import rupai from './eslint-rules/index.js';

const MONEY =
  'Never floats for money or quantities (Spec P9 §2.1): use the decimal helpers in src/lib/money.';
const NO_FETCH = "Pages never fetch. Use the feature's api/ hooks.";

/** Only the component library talks to the headless layer and the icon package (decision O-22). */
const UI_ONLY_IMPORTS = {
  group: ['react-aria-components', 'react-aria', 'react-stately', 'lucide-react'],
  message: 'Import components and icons from `@/ui`. Only src/ui uses React Aria and Lucide directly.',
};
/** Decimal arithmetic goes through src/lib/money, which mirrors the backend rules. */
const DECIMAL_IMPORTS = {
  group: ['decimal.js'],
  message: 'Use the helpers in `@/lib/money` (Dec, formatDecimal, toApiDecimal), never decimal.js directly.',
};
const API_CLIENT_IMPORTS = {
  group: ['@/lib/api', '@/lib/api/*', 'axios', 'ky'],
  message: "Pages never call the API client directly. Use the feature's api/ hooks.",
};

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'public/',
      'storybook-static/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js', 'eslint-rules/*.js', 'scripts/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Floats must never touch money or quantities: forbid the usual escape hatches. A genuine
      // non-money use (a page number, a pixel size) needs an eslint-disable comment that says why.
      'no-restricted-globals': ['error', { name: 'parseFloat', message: MONEY }],
      'no-restricted-properties': ['error', { object: 'Number', property: 'parseFloat', message: MONEY }],
      'no-restricted-syntax': ['error', { selector: "CallExpression[callee.name='Number']", message: MONEY }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },

  // ---- Browser code ---------------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '.storybook/preview.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, rupai },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'rupai/import-boundaries': 'error',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    ignores: ['src/lib/money.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [UI_ONLY_IMPORTS, DECIMAL_IMPORTS] }] },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [DECIMAL_IMPORTS] }] },
  },
  {
    // Route modules export `Component`/`loader` by name for React Router's lazy(), which is fine for HMR.
    files: ['src/features/*/pages/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': ['error', { allowExportNames: ['Component', 'loader'] }],
    },
  },
  {
    // No page component contains a fetch call: data comes through the feature's api/ hooks (Spec P5 §3.1).
    files: ['src/features/*/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: MONEY },
        { name: 'fetch', message: NO_FETCH },
        { name: 'XMLHttpRequest', message: NO_FETCH },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Number', property: 'parseFloat', message: MONEY },
        { object: 'window', property: 'fetch', message: NO_FETCH },
        { object: 'globalThis', property: 'fetch', message: NO_FETCH },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [API_CLIENT_IMPORTS, UI_ONLY_IMPORTS, DECIMAL_IMPORTS] },
      ],
    },
  },

  // ---- Component workspace ----------------------------------------------------------------------------
  ...storybook.configs['flat/recommended'],
  {
    // Stories export story objects, not components.
    files: ['**/*.stories.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ---- Node code (config, scripts, lint rules, end-to-end tests) ------------------------------------
  {
    files: ['*.{js,ts}', '.storybook/main.ts', 'scripts/**', 'eslint-rules/**', 'e2e/**', 'e2e-storybook/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Command-line scripts report to the terminal.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'e2e-storybook/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
