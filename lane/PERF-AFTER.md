# PERF-AFTER — Lane A (Performance), Bawa wallet-panel fix

Measured first-hand in headless Chromium (Playwright), same harness as
BEFORE (`lane/perf-measure.cjs`, `vite preview` on port 8931, Node 22).
BEFORE numbers are from `lane/PERF-BEFORE.md` / `lane/perf-before.json`
(2026-11-19 ~10:02–10:08 IST, 3 localhost runs). AFTER numbers are from
`lane/perf-after2.json` (2026-11-19 ~11:00 IST, after the warm-up fix;
`perf-after.json` 10:48 is the pre-warm-fix run — see the Slow 4G note).

## Localhost (fast CPU/LAN)

| Step | BEFORE | AFTER | Change |
|---|---|---|---|
| Initial load, first paint | 76–112 ms | 112 ms | — |
| Initial load, first contentful paint | 324–432 ms | 156 ms | ~2.5x faster |
| Time to interactive | 399–488 ms | 196 ms | ~2.3x faster |
| Create, password submit → phrase shown | 196–292 ms | 78 ms | ~3x faster |
| Create, confirm submit → wallet ready (step 4) | 847–1,360 ms | 224 ms | ~4–6x faster |
| Dashboard after create, rows settled | 53–80 ms | 326 ms | slower — see note |
| Reload → "Vault locked" box | 184–357 ms | 81 ms | ~2–4x faster |
| Unlock → dashboard shown | 335–1,076 ms | 225 ms | ~1.5–4.8x faster |

Dashboard note: the wallet itself now appears at confirm+224 ms (was
847–1,360 ms) and balances load in the background; the dashboard step
measures until all rows settle (326 ms). Total time to settled balances
after confirm is 224 + 326 = 550 ms, vs 847 + 80 = 927 ms before — better
overall, and the wallet is visible ~4x sooner. The user never waits on a
provider before seeing their wallet.

First-paint JS: 3,772 KB single chunk → 257 KB `index` chunk (gzip 79 KB);
`boundary` (wallet-core glue) 2,900 KB, `adapters` 296 KB, screens each
their own chunk, all loaded on demand. CSS unchanged (478 KB / 173 KB
gzip). WASM unchanged, 10,422,325 bytes, pinned 4.9.3.

PBKDF2 600,000 iterations untouched: 72–165 ms per derivation in this
Chromium (BEFORE 80–87 ms; the 165 ms first sample is warm-up noise).
Vault encryption unchanged (AES-GCM-256).

## Slow 4G — the owner's phone (1.6 Mbps down / 750 Kbps up / 150 ms RTT, fresh browser, cold cache)

| Step | BEFORE | AFTER | Change |
|---|---|---|---|
| Initial load, first paint | 2,028–2,188 ms | 1,792 ms | ~1.2x faster |
| Initial load, first contentful paint | 4,164–4,712 ms | 1,856 ms | ~2.4x faster |
| Time to interactive | 4,630–5,218 ms | 2,000 ms | ~2.4x faster |
| Create, password submit → phrase shown | 53,092 ms (WASM 52,423 ms) | 52,528 ms (WASM 52,650 ms) | same — see note |

Slow 4G Generate note: the harness fills the passwords immediately, so
the idle warm-up gets ~0 head start and Generate still pays the one
10.4 MB download at line rate (~52 s at 1.6 Mbps — physics, not code).
With any human dwell time (reading the screen, typing a password) the
download overlaps it and Generate is shorter. The intermediate AFTER run
(`perf-after.json`, 10:48) measured 104,731 ms here: the first warm-up
implementation (`warmCore`, its own `fetch()`) raced `loadCore`'s fetch
of the same URL, so TWO 10.4 MB downloads shared the pipe. That was
caught by this measurement and fixed the same day: the warm-up now calls
`loadCore()`, whose promise is cached, so warm-up, mount preload and
Generate share ONE download — the re-measured 52,528 ms proves it.

## What changed (all on branch `panel-rebuild/fix-perf-ui-a`, local only)

- Route code-splitting: 13 screens `React.lazy()` + Suspense; Dashboard
  and Welcome stay static (Sol P1).
- Adapters lazy: `ensureAdapters()` cached dynamic import, single
  registration point; send awaits it (Sol P2a). `registerAllAdapters()`
  is now non-clobbering — first registration wins (hands-on fix: it was
  overwriting test stubs with the real adapters).
- Engine lazy: `loadVaultCore()` cached dynamic import; `refreshChain`,
  `addXpub`, hydration use it (Sol P2b).
- Wallet shows before balances: `refreshVaultAccounts` returns after the
  addresses are in state; balances/history load in the background
  (Sol P2c).
- `createVault` leaves the vault unlocked (same in-memory state `unlock()`
  produces; envelope on disk byte-identical; PBKDF2/AES-GCM-256 untouched)
  so confirm no longer pays a second PBKDF2 derivation (Sol P3).
  `import-wallet` uses the same path. Tests that assumed "create locks"
  now call `lock()` explicitly in setup.
- Staged progress: Generate shows "Loading wallet engine…" →
  "Generating recovery phrase…", confirm shows "Encrypting vault…" →
  "Deriving addresses…", with a macrotask yield between stages so the
  label commits before the next stage (Sol P4a/P4b; yield is a
  `setTimeout(0)`, not `requestAnimationFrame`, which never fires in a
  background tab or jsdom and stalled the flow).
- WASM warm-up on idle now shares `loadCore()`'s cached promise (see the
  Slow 4G note); the separate-fetch `warmCore()` is deleted.
- Locked-state copy: asset rows with no address and a locked vault say
  "Unlock your wallet to see balances" instead of the misleading
  "Balance unavailable", Retry hidden.

## Verification (worktree, Node 22)

- `npm ci` exit 0; `tsc --noEmit` exit 0; `npm run build` exit 0
  (2.46 s); vitest full suite 351/351 pass (36 files);
  `npm audit` 0 vulnerabilities.
- 8 Sol calls on API 1 (gpt-6.1-sol, max reasoning, 32k cap): P1 47,865 ms;
  P2a 68,606 ms; P2b 67,271 ms; P2c 18,449 ms; P3 65,618 ms; P4a 60,206 ms;
  P4b 44,182 ms; P2a follow-ups + warm-up + test fixes hands-on, 0 calls.
- Sol has no filesystem access in this runner; every Sol output was
  applied as targeted hands-on edits and verified by diff, tsc and tests.

## Still slow / open (honest)

- First-visit cold Generate on a slow link still pays the one WASM
  download (~52 s on Slow 4G when clicked immediately). Only prefetch
  (done) + progress (done) mitigate it; the bytes are the bytes.
- WASM served with `Cache-Control: no-cache` + ETag by `vite preview`
  (304 revalidation on repeat visits). Serving it compressed / immutable
  is a host-config follow-up outside this lane.
- Provider 429s remain (TON/TronGrid/Blockscout on the shared egress IP);
  they are now non-blocking — rows show the honest error/unavailable
  state and Retry, never a fake zero.
- `npm run build` still warns one chunk > 500 KB (`boundary`, 2,900 KB):
  that is the wallet-core glue and cannot split further without
  splitting the engine itself.
