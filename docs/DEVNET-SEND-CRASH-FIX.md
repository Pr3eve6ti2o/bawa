# Devnet-mode Send crash fix (2026-11-24)

Owner order 2026-11-24 ~13:17 IST ("Fix the devnet crash too"). The crash
was found by the BSC-send agent while fixing native BSC sending.

Agent: hands-on Muse, **0 Sol calls**. Branch
`panel-rebuild/devnet-send-crash`, commit `89a5804` (on token-gaps
`047232e`). Merged into `panel-rebuild/token-gaps` (fast-forward) and
pushed — token-gaps `89a5804`, verified by fresh ls-remote. Orion reviewed
the diff and the CDP screenshots first-hand, ran tsc 0 + send.test.tsx
(27 passed) on the branch tree.

## The bug

In devnet mode, the Send chain picker offered all 22 chains. Picking a
non-devnet chain (e.g. BSC) advanced to the token step, and picking a
token advanced to the details step — where the banner renders
`devnetChainConfig(chain).devnetName`. `devnetChainConfig` throws
`No devnet configuration for chain: bsc.` for the 18 chains without a
test network, React unmounted the screen, and the user saw the app's
error boundary ("Unable to show your wallet"). Reproduced first-hand
in CDP on the unfixed tree (047232e): 22 chips offered, BSC picked,
`<main>` gone, console error `No devnet configuration for chain: bsc.`

A second path to the same crash: a shared Bawa send link
(`/send?chain=bsc&to=...`) opened in devnet mode. `applyPrefill` sets
the chain and jumps straight to the details step, so the banner threw
on render even without the picker.

## The fix (apps/web/src/screens/send.tsx only, 2 files, +116/−9)

1. **Picker (primary):** the chain step offers only the chains that can
   send in the current mode — `DEVNET_CHAINS` (`btc`, `eth`, `trx`,
   `ton`) in devnet mode, `SUPPORTED_CHAINS` on mainnet. The
   impossible choice cannot be picked.
2. **Starting chain:** `chainsWithWallet` follows the same offered
   list, so the starting chain is always a devnet chain in devnet
   mode (previously `selectedChain` could start the flow on BSC and
   the chain-step banner threw at mount).
3. **Guard (defence in depth, and required for the deep-link path):**
   one `devnetName` computed with the non-throwing
   `devnetChainConfigOrUndefined` (the pattern receive.tsx and
   asset-detail.tsx already use). It replaces all three throwing
   `devnetChainConfig(chain)` render calls (banner, review prop,
   result text). A non-devnet chain forced by a link now shows the
   honest banner "Devnet test mode. BNB Smart Chain has no test
   network — pick a chain with one." instead of unmounting.

No mainnet behaviour changed (mainnet still offers all 22 chains).
Broadcast untouched (mainnet stays disabled). The BSC native-send
fix untouched.

## Tests (3 new, in apps/web/src/screens/send.test.tsx)

- Devnet picker offers only the four devnet chains.
- A non-devnet starting chain falls back to a devnet chain.
- A devnet-mode send link for a non-devnet chain shows the honest
  message, not a crash.

Proven to catch the bug: with the send.tsx fix stashed, all 3 fail
(picker: 22 chips vs 4; deep link: `No devnet configuration for
chain: bsc.`). With the fix, all 3 pass.

## Gates (Node 22)

tsc 0 · build 0 · vitest **1,947 passed / 5 skipped / 0 failed
(94 files)** — baseline 1,944 + 3 new · eslint 0 · npm audit 0.

## CDP verification (fixed build, served statically on :4295,
hash-verified: served JS index-CZvSOqIF.js sha256 a9e11c55…
matches dist)

- Devnet chain picker: exactly 4 chips (Bitcoin, Ethereum, TRON,
  TON) at 390 and 1440; BSC not offered — the crash path is closed.
- Devnet ETH details: renders normally with the Sepolia banner
  (390 + 1440).
- Devnet BSC deep link: lands on the details step with the honest
  "has no test network" banner, recipient prefilled, balance
  "unavailable", fee estimate unavailable — no unmount (390 + 1440).
- Mainnet unchanged: 22 chips, BSC offered, BSC details renders
  (From = vault BSC address, Balance 0 BNB, no "isn't available yet").
- Console: no "No devnet configuration" error anywhere; only the
  known CSP meta warning and one TonCenter 429.

Not re-verified: a devnet send carried all the way to review/sign for
a devnet chain — the ETH details step renders and the preview runs the
live Sepolia adapter (Balance 0 ETH, honest "Max is unavailable"), but
the review/sign steps need a funded devnet wallet, which the earlier
devnet programme already proved for TON and which this fix does not
touch. The existing devnet broadcast test still passes in the suite.

## Skills read

- `cdp-visual-verification` (full) and `order-traceability-checklist`
  (head; the single-fix scope meant the CDP skill carried the
  verification).
