# BSC native send fix (2026-11-24)

Owner report 2026-11-24 ~04:43 IST: "Sending on BNB Smart Chain isn't
available yet. This wallet signs native BTC, ETH, TRX and TON transfers
offline only."

Agent: hands-on Muse, **0 Sol calls**. Branch `panel-rebuild/bsc-send`,
commit `31012a6` (on token-gaps `f065128`). Merged into
`panel-rebuild/token-gaps` (fast-forward) and pushed — token-gaps
`31012a6`, verified by fresh ls-remote. Orion reviewed the diff and the
CDP screenshots first-hand, ran tsc 0 + the 3 send test files (98 passed /
4 skipped) on the merged tree.

## Fix (5 files, +260/−48)

- `apps/web/src/wallet/send.ts`: `signEthOffline` body generalised to
  `signEvmOffline(chain, ...)`. Chain id from the registry
  (`chainConfig(chain).evmChainId` — 56 for BSC); Sepolia 11155111 for ETH
  + devnet only. From address from `deriveAddresses(...)[chain]`. Signing
  intent names the actual chain. Signing key is always the ETH key —
  all 16 EVM chains share m/44'/60', so the BSC key IS the ETH key.
  Legacy EIP-155 tx, v = sig[64] + 35 + 2*chainId. `signEthOffline` is now
  a thin ETH wrapper (same signature; all existing callers/tests unchanged).
  `simulateSend`: the nonce freshness check now covers BSC as well as ETH.
  Refusals use the existing `invalid-input` code (no new failure code):
  non-EVM chain, or BSC + devnet (no BSC test network).
- `apps/web/src/screens/send.tsx`: `SIGNING_CHAINS` gains `'bsc'`;
  handleSign's ETH branch is now the EVM branch (`eth` or `bsc`) calling
  `signEvmOffline(chain, ...)` with a chain-generic error message; the
  honest unavailable messages now list BTC, ETH, BNB, TRX and TON.
- Tests: `send.test.ts` (+3 BSC unit tests), `send.test.tsx` (+2: BSC flow
  to signed/not-sent; Polygon still shows the unavailable state),
  `send-scan.test.tsx` (mock stubs `signEvmOffline` now).

## Why it is correct

- chainId: 56 comes from the chain registry, not a literal in the signer;
  the unit test parses the real signed tx with viem and asserts
  chainId 56, value/nonce/gas/gasPrice, and the in-module verifier
  accepting chain 56 while rejecting the same tx against chain 1.
- from: `deriveAddresses(...).bsc` — asserted equal to `.eth` in the test.
- nonce/gas: the existing BSC EVM adapter (`createEvmAdapter`, evmChainId
  56) already served `estimateFee` (gasPrice x 21000) and `getTxInputs`
  (nonce); `previewSendAmount` is chain-generic and `simulateSend` now
  checks BSC nonce freshness. The CDP run proved the live preview fetches
  the BSC balance (0 BNB) through that adapter.

## Gates (Node 22)

- tsc 0 · build 0 (palette audit passed) · vitest 1,864 passed / 5 skipped /
  0 failed, 94 files (baseline 1,859 + 5 new) · lint 0 · audit 0.

## CDP verification (static serve, hash-verified)

- Served the dist statically (serve-dir.cjs, 127.0.0.1:4271, stopped after).
  Served JS `index-DIxzKOP7.js` sha256 prefix `c62b179bc8bc80a3` matches dist.
- Fresh disposable 24-word wallet (BSC address
  `0xC734E90829c5AEFcF5E1EA663AcF57bd610E093B`). Send → BSC → native BNB →
  recipient (Vitalik `0xd8dA…6045`) + 0.01 BNB → Review, at 390/820/1440/1919.
- All four viewports: NO "isn't available yet" anywhere; the details step
  shows From = the vault's BSC address, To, Balance 0 BNB, and the honest
  "Amount exceeds available balance." — the preview ran the live BSC
  adapter and refused on funds, not on the chain. All four screenshots
  viewed by eye: clean, nothing clipped.
- Console noise is the known 429 storm + BlockCypher CORS (DOGE) + CSP
  meta warning; no BSC RPC failure appears.
- LIMIT (stated plainly, not hidden): the review/sign steps are NOT
  reachable in CDP — they need a funded vault wallet (amount <= balance;
  a fresh wallet holds 0 BNB). Funding one would need real mainnet BNB
  (forbidden), and watch-only addresses cannot send by design. The review
  render (0.5 BNB / 0.00042 BNB / 0.50042 BNB → 'Send signed, not sent')
  and the signed tx (chainId 56, from) are proven by vitest instead.
  Nothing was broadcast anywhere.

## Enabled / not enabled (native sending, offline signing only)

- Enabled now: BTC, ETH, BSC (BNB), TRX, TON.
- NOT enabled: the other 15 EVM chains (Polygon, Arbitrum, OP, Base,
  Avalanche, Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis, Aurora,
  Fantom + Solana, Litecoin, Dogecoin). The generalisation would technically
  cover the other EVM chains, but only BSC was verified (unit + screen
  tests + CDP); the rest stay gated by SIGNING_CHAINS and show the honest
  unavailable message. Token sending stays unbuilt everywhere.
  Broadcast stays disabled on mainnet (unchanged).

## Observations (not fixed here — out of scope)

1. Devnet-mode Send crash (pre-existing, found during this fix): in devnet
   mode the chain picker still offered non-devnet chains (BSC clickable),
   but the details step calls `devnetChainConfig(chain)`, which throws for
   non-devnet chains — the screen unmounts. **Fixed separately the same
   day — see [DEVNET-SEND-CRASH-FIX.md](DEVNET-SEND-CRASH-FIX.md).**
2. Watch-only wallets are not switchable accounts (by design): the Wallets
   screen lists them separately for balances/history only; Send only ever
   sends from the vault account. That is why the review step cannot be
   reached in CDP without a funded vault wallet.

## Skills read

- `cdp-visual-verification` (full, on the VM) — exact-tree build,
  hash-verify, static serve (not vite preview), 4 viewports, wallet-ready
  state, screenshots viewed by eye.

## Currency note (2026-11-28, token-gaps `734cfef`)

This fix record is from 2026-11-24, retained as written above. Since then, native sending has been extended beyond the five chains listed in "Enabled / not enabled": `SIGNING_CHAINS` in `apps/web/src/screens/send.tsx` now covers all EVM-transaction chains plus BTC, TRX, TON and SOL, and token sends are built (one offline signer per token standard in `apps/web/src/wallet/send.ts`; broadcast stays disabled). The "other 15 EVM chains" and "token sending stays unbuilt" lines above describe the state on 2026-11-24, not today.
