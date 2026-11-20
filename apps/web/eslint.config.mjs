// ESLint flat config for the web wallet (repo-study Phase 3, item 26).
//
// Minimal on purpose: the recommended JS + TypeScript rule sets, no
// framework plugins. The lint gate in CI (`npm run lint`) fails on any
// error from this config. A rule that cannot be satisfied is fixed in
// the code or routed through a CONSTRAINTS.md exception — never silenced
// with an inline disable (the floor guard flags new suppressions).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'public/wallet-core.wasm'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // React 19 with the automatic JSX runtime: React need not be in
      // scope. The TS rule set already covers unused imports.
      'no-unused-vars': 'off',
      // A leading underscore marks an intentionally unused parameter:
      // the adapter broadcast() implementations name their (never used,
      // broadcast is disabled) argument `_signedTx`. That convention is
      // enforced here, not silenced per file.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },
);
