# Bawa Web starter

This is the Web starter for Bawa AI Wallet Builder, built on the vendored token-ui
foundation. It supports in-browser wallet generation and recovery, watch-only import,
offline signing with broadcast disabled, and read-only balances and transaction history
via chain adapters. No price feed is connected, so there is no portfolio fiat total.
Secrets never leave the browser.

## Install, develop, build and test

Use Node.js `>=22 <23`. The range is enforced: `apps/web/.npmrc` sets `engine-strict=true`, so `npm ci` fails with `EBADENGINE` on any other Node release. The package is `bawa-web` and is private. Run these commands from the
repository root:

    cd apps/web
    npm ci
    npm run dev
    npm run build
    npm test

`build` runs `tsc --noEmit && vite build`; `test` runs `vitest run`. Also available:
`npm run preview`, `npm run typecheck` and `npm run clean`.

The stack is React 19, react-router 7, Vite 8, Tailwind 4, TypeScript 5.9 and Vitest 4.
Keep the repository checkout intact: `@bawa/contracts` is a local `file:` dependency.

## What works

- Import one extended public key (xpub) per chain for BTC, ETH and TRX.
  Keys are validated before storage.
- Import a TON public address for watch-only access.
- Derive the first five addresses per chain for BTC, ETH and TRX, at indices 0–4,
  in the browser.
  The engine is `@trustwallet/wallet-core` 4.9.3, loaded as WASM.
  Derivation uses `HDWallet.getPublicKeyFromExtended` and
  `CoinTypeExt.deriveAddressFromPublicKey`.
- Display a derived address on the Receive screen with a QR code using `qrcode.react`.
- Navigate all 14 screens, with mock data and unavailable actions labelled as such.

The screens are `welcome`, `create-wallet`, `import-wallet`, `mnemonic-backup`, `dashboard`,
`asset-list`, `asset-detail`, `receive`, `send`, `transaction-history`, `transaction-detail`,
`network-selection`, `wallet-management` and `security-settings`. A screen's presence does
not mean its underlying wallet operation is implemented.

Derivation policy, where `i` is the address index:

| Chain | Path |
| --- | --- |
| BTC | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` |
| TRX | `m/44'/195'/0'/0/i` |

## What works, what is mock, and what is unavailable

- **Balances and transaction history:** live data from the pinned providers, not mock values; they surface as unavailable or error when a provider cannot be reached, never as invented figures. **Prices:** no price feed is connected, so there is no portfolio fiat total.
- **Sending:** offline signing is implemented for BTC, ETH, TRX and TON using the vault key via Trust Wallet Core `AnySigner.sign`.
  Broadcast is not implemented and remains disabled until separately authorised; no secrets leave the browser.
- **Wallet creation in the browser:** available. The create-wallet screen generates a mnemonic, and the mnemonic-backup screen shows it for write-down.
  The repository tools [`tools/make_wallet.py`](../../tools/make_wallet.py) or [`tools/hdwallet-gen/generate.js`](../../tools/hdwallet-gen/generate.js) remain alternatives outside the browser; import only their extended public keys, never secret output.
  No secrets leave the browser; broadcast remains disabled.
- **TON:** derived at `m/44'/607'/0'` (V4 R2), with balance/history adapters and offline signing; watch-only public-address import remains an option.
  Broadcast remains disabled until separately authorised; no secrets leave the browser.

## Security notes

- The app passes public data only to the engine boundary, never secrets.
- Before any WASM call, [`src/engine/boundary.ts`](src/engine/boundary.ts) validates
  Base58Check encoding and checksum, rejects private extended keys, enforces a per-chain
  version allow-list and validates the secp256k1 point.
- [`src/state/wallet-context.tsx`](src/state/wallet-context.tsx) stores xpubs in `localStorage`:
  public data only. Xpubs can still link addresses, so treat them as privacy-sensitive.
  Derived addresses remain in memory.
- The lock is UI state only, not a security boundary. Do not rely on it to protect stored xpubs.
- No secrets reach telemetry or any provider: there is no telemetry and no provider.
- Mainnet-first in direction (ADR-0003), with read-only mainnet data via adapters.
  Broadcast remains disabled; mainnet use requires separate approval and real-funds gates.
  The derivation paths are not a network-enforcement mechanism.
- Content-Security-Policy (T47): `src/app/security-headers.ts` is the single source
  of truth. The strict policy (`script-src 'self' 'wasm-unsafe-eval'`, no inline
  scripts, `object-src 'none'`, `frame-ancestors 'none'`) is served as an HTTP
  header by `vite preview` and injected as a `<meta>` tag into `dist/index.html`
  at build time only — Vite dev injects an inline react-refresh preamble, so a
  source-level meta tag would break `npm run dev`. Any production host serving
  `dist/` must send the same `Content-Security-Policy` header (plus
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`); the meta tag alone
  cannot enforce `frame-ancestors`.
- WASM integrity (T47): `scripts/copy-wasm.mjs` refuses to copy a wallet-core.wasm
  whose SHA-256 differs from the published @trustwallet/wallet-core@4.9.3 pin in
  `scripts/wasm-integrity.mjs`. Bump the pin from the new published tarball only.

## File map

Paths are relative to `apps/web/` unless marked otherwise.

- `src/ui/` — vendored `consenlabs/token-ui`, commit `6380d5d4`, MIT; see [`NOTICE.md`](src/ui/NOTICE.md).
- `src/assets/chains/` — native chain logos; see [Chain logos](#chain-logos).
- `src/engine/` — public-key validation boundary and browser wallet-core WASM address derivation.
- `src/state/` — wallet context, xpub persistence, in-memory addresses and UI lock state.
- `src/screens/` — the 14 screens and their available, mock or unavailable states.
- `src/app/` — application shell and routing.
- [`packages/contracts/`](../../packages/contracts/) (repository root) — shared types, imported as `@bawa/contracts` via a `file:` dependency.

### Chain logos

The native chain logos in `src/assets/chains/` (Bitcoin, Ethereum, TRON, TON)
are copied from [`trustwallet/assets`](https://github.com/trustwallet/assets),
`blockchains/<chain>/info/logo.png`, MIT licence,
Copyright (c) 2019-2023 Trust Wallet. They are rendered by the `ChainLogo`
component (`src/screens/asset-rows.tsx`) in place of ticker-letter chips.

### Token logos

Token logos live in `src/assets/tokens/` and are rendered by the `TokenLogo`
component (`src/screens/token-logo.tsx`); `ChainLogo` in
`src/screens/asset-rows.tsx` is a thin wrapper over `TokenLogo`, so the
asset rows, asset detail and wallet management all share one logo path.
The four native assets (BTC, ETH, TRX, TON) reuse the chain logos above.
The six ERC-20 logos (USDC, USDT, DAI, LINK, UNI, WBTC) are copied from
[`trustwallet/assets`](https://github.com/trustwallet/assets),
`blockchains/ethereum/assets/<contract>/logo.png`, MIT licence,
Copyright (c) 2019-2023 Trust Wallet. The contracts are the canonical
Ethereum mainnet addresses (USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
USDT 0xdAC17F958D2ee523a2206206994597C13D831ec7,
DAI 0x6B175474E89094C44Da98b954EedeAC495271d0F,
LINK 0x514910771AF9Ca656af840dff83E8264EcF986CA,
UNI 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984,
WBTC 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599), each verified against
its upstream `info.json` name at fetch time. No balance adapter lists
these tokens yet, so they are registered for future token adapters and
are not displayed in asset rows today, and must never be shown with a
fabricated balance. A token with no registered logo renders a readable
ticker badge, never a broken image.

## Evidence

The boundary tests derive the published fixture addresses exactly for BTC, ETH and TRX at
indices 0 and 1. They also reject private extended keys and keys with bad checksums, wrong
versions or invalid secp256k1 points. Run `npm test` to see them pass.

Verified on this tree on 2026-11-20: Vitest passed all 40 test files and all 457 tests
(exit 0).
