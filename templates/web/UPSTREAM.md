# Web foundation adoption record

## 1. Source, pin and licence

- **Foundation:** imToken token-ui (`WEB-01`) — **SELECTED** Web foundation.
- **Source:** `consenlabs/token-ui`.
- **Pinned commit:** `6380d5d4dfeebf89704c0527e3c552be6ee2d231`.
- **Approval:** pre-approved by the owner on 2026-11-10; confirmed by first-hand inspection on 2026-11-10.
- **Licence:** MIT, recorded in upstream `LICENSE`, with copyright attributed to Consenlabs.

The full upstream licence text must be preserved with any vendored code. A `NOTICE` must credit Consenlabs.

**Vendoring status: NOT VENDORED.** No token-ui code is in Bawa's repository at Phase 5. Phase 6 performs the adoption; this file records the source, pin, licence and boundaries that adoption must respect.

## 2. What was inspected

The inspection on 2026-11-10 covered the pinned source:

- **Commit:** existence confirmed by a GitHub API 200 response.
- **Commit date:** 2026-05-14.
- **Commit message:** “Align design docs and demo theme preview (#4)”.
- **Tree:** 107 files.
- **Stack:** pnpm 10.33.0, Node `>=22.12.0`, React, react-router, Vite, Tailwind CSS, TypeScript, Vitest and Biome.
- **Layout:**
  - `apps/web`: demo app.
  - `packages/ui`: 62 components, including `asset-row`, `holding-card`, `bottom-sheet-modal`, `action-bar` and `checklist-card`.
  - `tooling/tsconfig`.

The demo app contains a wallet dashboard (`wallet-dashboard.tsx` and its test), a home page and a UI-kit page. Its `mock-data.ts` contains fake asset amounts only.

Demo scripts inspected:

- `dev`: `vite`.
- `build`: `tsc --noEmit && vite build`.
- `test`: `vitest run`.
- `typecheck`.
- `verify`: `check && test && typecheck`.

### Exclusion check

Across the pinned tree:

- No mnemonic, private-key, seed or keystore code was found anywhere.
- No fetch, axios, RPC or WalletConnect code was found anywhere.
- `localStorage` is used only for the theme preference in `theme-toggle.tsx`.

token-ui provides no engine, derivation, vault, custody, signing, RPC or indexing implementation.

## 3. What is adopted / what is not adopted

These lists define the Phase 6 adoption scope, not work already completed.

### Adopted scope

- The `packages/ui` component library.
- The demo app's structure as the starting point for Bawa's `apps/web`.

### Not adopted

- The demo's mock data. Phase 6 replaces it through the Bawa engine boundary.
- Engine, derivation, vault, custody, signing, RPC or indexing code. None is supplied by token-ui; no engine, vault or signing code is inherited.

## 4. Compatibility notes

- Bawa pins Node `>=22 <23`.
- token-ui requires Node `>=22.12.0`.
- The requirements are compatible: the shared range is `>=22.12.0 <23`.

token-ui's package manager is pnpm 10.33.0; Bawa's tools use npm. **Phase 6 must decide and record which package manager the Web starter uses.** This record does not select either manager for the starter.

## 5. What Phase 6 must do

- Perform the adoption from the recorded pin within the scope above.
- Preserve the full upstream MIT licence text with vendored code and provide a `NOTICE` crediting Consenlabs.
- Replace the demo's mock data and wire the Bawa engine boundary.
- Build the 14 screens specified in `docs/14`, section 5.1.
- Keep secrets out of UI state, logs and telemetry.
- Use the compatible Node range and record the Web starter's chosen package manager.

## 6. What would invalidate this selection

Do not proceed on the strength of this record without reassessment if:

- The upstream licence changes, requiring the recorded licence basis to be reviewed.
- The pinned commit disappears or can no longer be retrieved and verified.
- An exclusion violation is found in the pinned source during adoption, contradicting the checks in section 2.
- The adoption cannot preserve the full upstream licence text or provide the required `NOTICE` crediting Consenlabs.


## 7. Adoption (Phase 6 — done 2026-11-10)

- Vendored: `packages/ui/src` from the pinned commit into
  `apps/web/src/ui/` — 67 files (65 components, `hooks/use-mobile.ts`,
  `lib/utils.ts`, `styles/globals.css`, `LICENSE-token-ui`, `NOTICE.md`).
  Change made: `@repo/ui/...` import paths rewritten to relative paths
  (59 files). No behaviour changed. No upstream code was modified beyond
  the import rewrite.
- Package manager: **npm** (consistent with the repo's tooling). Upstream
  pnpm 10.33.0 is recorded, not adopted.
- Exact pins (apps/web/package.json, per-app lockfile
  apps/web/package-lock.json, 295 packages): react/react-dom 19.2.5,
  react-router 7.14.0, vite 8.0.7, typescript 5.9.3, tailwindcss 4.2.4,
  vitest 4.1.3, jsdom 31.0.0, qrcode.react 4.2.0, @trustwallet/wallet-core
  4.9.3 (the repo pin, upgraded 2026-11-13; the former pin 4.9.1 is superseded).
- WASM loading: the wallet-core 4.9.3 Emscripten build rejects both
  `locateFile` and `wasmBinary` (not in INCOMING_MODULE_JS_API —
  verified first-hand: both abort, no-args `initWasm()` works in Node).
  The loader resolves `wallet-core.wasm` relative to the page URL in the
  browser, so the binary is served from `public/` via
  `scripts/copy-wasm.mjs` (runs on `predev`/`prebuild`). The wasm is a
  build artifact, never committed (`apps/web/.gitignore`). Verified:
  `vite preview` serves `/` HTTP 200 and `/wallet-core.wasm` HTTP 200
  (10,386,536 bytes).
- Delivered: the 14 screens (docs/14 §5.1), the engine boundary
  (apps/web/src/engine/boundary.ts — validation before WASM, R-01 point
  validation mirrored in pure BigInt), shared contracts
  (packages/contracts), 25 tests, apps/web/README.md. Verified first-hand:
  `tsc --noEmit` exit 0; `vitest run` 25/25; `vite build` exit 0.
