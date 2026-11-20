# Lane F layout evidence archive — 2026-11-20

Archived working records from the desktop-layout lane (Lane F,
2026-11-20). Moved here from `lane-f/` during the Phase 4 layout-makeover
rename lane; nothing was deleted or rewritten. `RUN-LOG.jsonl` keeps the
old `lane-f/` paths as the historical record of the run.

## The `sol-prompt-*` / `sol-output-*` naming

The six `o*`/`p*` files were renamed to drop the cryptic prefixes:

- `sol-prompt-*.md` (formerly `p01`/`p02`/`p03`) — the brief sent to
  gpt-6.1-sol for that step.
- `sol-output-*.md` (formerly `o01`/`o02`/`o03`) — what Sol returned.

Note the exception: `sol-output-app-layout.md` (formerly `o03`) is not
finished output. Sol asked for the current `AppLayout`/tabs paste instead
of emitting (`failed-no-emit` in `RUN-LOG.jsonl`); the AppLayout was
assembled hands-on from the spec plus the exact current file.

## Other contents

- `DESIGN-SPEC.md` — the desktop layout design spec (the finished spec;
  distinct from `sol-output-design-spec.md`, the Sol output of the same
  step).
- `after-*.png` / `after-*.json`, `baseline-*.png` / `baseline-*.json` —
  before/after screenshots and probe results at 390 px and 1440 px.
- `*.log` — run artefacts, not repo content: numbered build logs
  (`build-2.log` … `build-6.log`), `chrome2.log`, `pinggy.log`,
  `baseline-npm-ci.log`, `baseline-home-390.log`, plus `baseline-build.log`,
  `serve-baseline.log`, `typecheck-*.log`, `vitest-*.log`, `sol-p*.log`.
  Kept on the coordinator decision to archive, not delete.
- `cdp-check.mjs`, `probe-create.mjs`, `serve.mjs` — probe/serve scripts.
