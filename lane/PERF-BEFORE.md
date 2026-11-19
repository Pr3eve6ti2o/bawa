# Lane A (Performance) — BEFORE numbers

Measured first-hand 2026-11-19 in headless Chromium (Playwright, viewport
430x932) against `vite preview` of the `panel-rebuild/fix-perf-ui-a` build
(`f9512b4`, single JS chunk 3,772,332 bytes / 561 KB gzip, CSS 478,070 bytes /
173 KB gzip, WASM 10,422,325 bytes). Harness: `lane/perf-measure.cjs`,
output `lane/perf-before.json`. Disposable test wallet only; no secrets logged.

## Localhost (fast CPU, LAN) — 3 runs agree

| Step | Time |
|---|---|
| Initial load: first paint / first contentful paint | 76–112 ms / 324–432 ms |
| Initial load: time to interactive (Create button usable) | 399–488 ms |
| Create: password submit -> 24-word phrase shown | 196–292 ms (WASM fetch 34–90 ms on localhost) |
| Create: confirm submit -> step 4 "Your wallet is ready" | 847–1,360 ms |
| Dashboard after create (data pre-fetched during confirm) | 53–80 ms |
| Reload -> "Vault locked" box | 184–357 ms |
| Unlock (lock screen) -> dashboard shown | 335–1,076 ms (varies with provider latency) |
| PBKDF2 600,000 iterations, standalone (this VM Chromium) | 77–99 ms per derivation |

## Slow 4G (1.6 Mbps down / 750 Kbps up / 150 ms RTT) — the owner's phone

| Step | Time |
|---|---|
| Initial load: first paint / first contentful paint | 2,028–2,188 ms / 4,164–4,712 ms |
| Initial load: time to interactive | 4,630–5,218 ms |
| Create: password submit -> phrase shown | **53,092 ms** (WASM download 52,423 ms of it) |

## Bottleneck verdict (proven by the numbers)

1. **The 10.4 MB WASM, downloaded on demand at Generate time, is the
   dominant bottleneck: 52.4 s of a 53.1 s Generate step on Slow 4G.**
   On localhost it hides (34–90 ms), which is why it was never felt in
   dev. The fix is to fetch it in the background after first paint (and
   from create-wallet step 1, while the user types the password), so
   Generate only pays WASM compile, not download.
2. **The 3.77 MB single JS chunk delays first paint to ~4.2 s on Slow 4G**
   (all screens + wallet-core glue + viem + adapters in one chunk).
   Code-split by route and dynamic-import the wallet engine.
3. **Confirm blocks step 4 on work the user does not need yet:** PBKDF2
   runs twice (createVault, then unlockVault re-derives), then
   `refreshVaultAccounts` awaits balances (up to 10 s timeout per chain)
   AND history (another up to 10 s) sequentially before `setStep(4)`.
   Localhost: 0.85–1.36 s. On a phone CPU (PBKDF2 several times slower
   than this VM) + slow/flaky providers, several seconds; worst case
   ~20 s+ of provider timeouts. Fix: create leaves the vault unlocked
   (removes PBKDF2 #2, no security change — the key is already in memory
   during creation, exactly as `unlock()` holds it); step 4 shows as soon
   as addresses are derived; balances/history refresh in the background.
4. **Ruled out as the bottleneck:** PBKDF2 alone (77–99 ms here),
   provider fetches on a good connection (all ~100 ms; TON 429s are
   fast failures), dashboard rendering (53–80 ms once data exists).
   Provider slowness only bites via the blocking awaits in (3).
5. **Display bug found while measuring:** after a reload the vault is
   locked and every asset row reads "Balance unavailable" — misleading;
   the rows should say the wallet is locked, not that balances failed.

## Hard limits (owner order)

PBKDF2 stays 600,000 iterations. Vault stays AES-GCM-256. No demo/fake
data, no invented prices/balances. No broadcast changes; send stays
offline-signing only; TON stays receive-only in-app. Disposable test
credentials only.
