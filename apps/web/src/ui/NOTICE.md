# Vendored UI — token-ui (MIT)

Source: consenlabs/token-ui, commit `6380d5d4dfeebf89704c0527e3c552be6ee2d231` (2026-05-14), MIT licence (see LICENSE-token-ui in this directory).

Copied: `packages/ui/src/*` — 65 components, `hooks/use-mobile.ts`, `lib/utils.ts`, `styles/globals.css`.

Change made: `@repo/ui/...` import paths rewritten to relative paths. No behaviour changed.

Not copied: the demo app, mock data, and any engine, derivation, signing or RPC code (none exists upstream).

Removed 2026-11-23 (Lane 4, reverify-pro): 12 vendored files nothing in
the app imported (import-graph evidence, zero non-test importers) —
components/avatar, checklist-card, form, popover, progress, radio-group,
select, separator, sheet, table, toggle, and hooks/use-mobile. They are
still upstream; re-copy from token-ui if a screen needs one.

Current state (2026-11-28 docs-audit-b, HEAD `ceade79`): `src/ui/components/`
holds 21 components and `hooks/` is gone entirely. The 65-component copy
count above is the Phase 6 event, not the current tree — later lanes
removed further vendored files without itemising them here; the
21-component count is the counted current state.
