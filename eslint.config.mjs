// ESLint flat config for the repo-root tooling (Lane D, gap 11,
// 2026-11-23). The root scripts/*.mjs are Node CLIs and test files —
// they were never linted anywhere, so Node globals (`console`,
// `process`, `URL`, …) were unchecked. This config is node-scoped only;
// the web wallet keeps its own config in apps/web/eslint.config.mjs.
// Root lint: `npm run lint` (does not run in CI yet — CI lints
// apps/web only; wire it in when the root toolchain install is
// added to the workflow).
import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/', 'apps/', 'tools/'],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.{mjs,js}'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
