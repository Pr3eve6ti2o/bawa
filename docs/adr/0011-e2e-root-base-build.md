# ADR-0011 — E2E harness runs against a root-base build

## Context

The E2E specs navigate by root-absolute routes: every spec starts with
`page.goto('/create-wallet')` (via `createTestWallet` in `e2e/helpers.ts`),
and `gotoInApp` uses `page.goto('/')`. The production build sets Vite
`base: '/bawa/'` for GitHub Pages, so `dist/index.html` carries
`<base href="/bawa/">` and asset URLs under `/bawa/assets/`.

Against that build, `vite preview` on the harness port answers:

- `GET /` → 302 to `/bawa/` (works by luck)
- `GET /create-wallet` → 404 (no SPA fallback outside the base)
- `GET /bawa/create-wallet` → 200
- `GET /bawa/assets/index-*.js` → 200

So the suite fails at boot: each spec waits 30 seconds for the vault
password field on a 404 page and times out. Reproduced first-hand on
`panel-rebuild/deep-audit-devnet` at `9fa1df6` (3 specs confirmed failing
identically, 30.1 s each; all 13 of 14 spec files share the same entry
point through `createTestWallet`).

Two earlier records of this failure were wrong about the mechanism. The
Round 2 record said vite preview 404s `/bawa/assets/*.js`; the assets
load fine. The failure is the route, not the assets. The config comment
also said the webServer block means a test "never runs against a stale or
hand-started server"; with `reuseExistingServer` that is not true. On the
shared machine a preview from another worktree already held port 4193,
and this lane's runs silently attached to that lane's build before the
port was noticed. That is a second, separate harness defect.

The app itself already supports a root build: `app.tsx` reads
`import.meta.env.BASE_URL` at render time for the `BrowserRouter`
basename, so with base `/` the basename is empty and routing works at
the root (pinned by `app-routing.test.tsx`). The WASM loader fetches
`wallet-core.wasm` relative to the `<base>` element, which the build
plugin rewrites to the resolved base — `/` for a root build, served from
`dist/wallet-core.wasm`.

## Decision

The harness runs against a root-base build, and the port is overridable:

- `apps/web/package.json` gains `build:e2e`: the same steps as `build`,
  with `vite build --base /` in place of `vite build`. It also gains
  `preview:e2e` (`vite preview --base /`): the preview server takes its
  base from the Vite config, not from `dist/`, so a plain `preview`
  would still mount a root-base dist under `/bawa/` and the routes
  would 404 again. The harness webServer command runs `preview:e2e`.
- The CI `e2e` job builds with `npm run build:e2e`. The `web` job and
  the Pages deploy still use the `/bawa/` build; nothing about the
  shipped site changes.
- `e2e/manifest.json` records the harness command as
  `npm run build:e2e, then npm run test:e2e`, and states that the dist
  must be the root-base build.
- `playwright.config.ts` reads an `E2E_PORT` environment variable
  (default 4193) for the base URL and the preview port, so runs on a
  shared machine can move off a port another lane holds instead of
  silently testing that lane's build.

## Status

Accepted. Implemented on this branch; verified by a full suite run
against the root-base build — 24 tests, 18 passed, 6 failed — with
all seven failing tests (six spec files) diagnosed from the
Playwright error-context snapshots and re-run individually to
green: the Ethereum failover, refresh-failure, unlock-lock and the
Jetton NOT price test in the first re-run; the devnet toggle, the
QR-share PNG and the Jetton MY price test in the final re-run
(item2 3.5 s, item4 2.5 s, MY 3.1 s). Three of the six were
live-network pressure (TonAPI / backup-RPC reads timing out late
in a long run); three were stale spec strings exposed by the
re-runs, fixed in place in the specs (hardcoded 4193 origin in
refresh-failure, Security copy in unlock-lock, per-step Receive
button names in item2/item4). No fresh full-suite run after the
last spec fix was done; see `docs/GAP-ANALYSIS.md` gap 4 for why.

## Consequences

- `dist/` is now build-variant dependent: a `/bawa/` dist and a `/`
  dist are not interchangeable for E2E. The config comment and the
  manifest state this where a reader will see it before running the
  suite.
- A local `npm run build` followed by `npm run test:e2e` still fails
  at boot. That is the documented order now, not a surprise: the
  manifest names `build:e2e` first.
- The static-server alternative (serve the `/bawa/` dist under `/bawa/`
  and rewrite routes) was not built: specs use origin-absolute gotos,
  so the server would need per-route rewrites, and the root build is
  already a supported app configuration. If the Pages base ever changes,
  this decision needs revisiting, not the specs.
- The `E2E_PORT` override does not change CI, where the default port
  is free by construction.
