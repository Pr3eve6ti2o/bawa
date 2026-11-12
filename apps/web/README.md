# Bawa Web starter

This is the strictly watch-only Web starter for Bawa AI Wallet Builder, built on the vendored
token-ui foundation. It derives addresses from extended public keys only; it never generates,
stores or displays a mnemonic, seed, private key, private extended key, vault key or data key.

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

- Import one extended public key (xpub) per supported chain: BTC, ETH and TRX.
  Keys are validated before storage.
- Derive the first five addresses per chain, at indices 0–4, in the browser.
  The engine is `@trustwallet/wallet-core` 4.9.1, loaded as WASM.
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

## Mock or unavailable

- **Balances, prices and transaction history:** mock or unavailable, not live data.
  No provider has been selected.
- **Sending:** not implemented. There is no signing or broadcast code.
- **Wallet creation in the browser:** unavailable. Use the repository tools
  [`tools/make_wallet.py`](../../tools/make_wallet.py) or
  [`tools/hdwallet-gen/generate.js`](../../tools/hdwallet-gen/generate.js) outside the browser.
  Import only the resulting extended public keys into this app, never secret output.
  The creation and mnemonic-backup screens do not generate or reveal secret material.
- **TON:** not supported by this starter.

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
- Testnet only by policy; mainnet is out of scope. The derivation paths are not a
  network-enforcement mechanism.
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
  whose SHA-256 differs from the published @trustwallet/wallet-core@4.8.4 pin in
  `scripts/wasm-integrity.mjs`. Bump the pin from the new published tarball only.

## File map

Paths are relative to `apps/web/` unless marked otherwise.

- `src/ui/` — vendored `consenlabs/token-ui`, commit `6380d5d4`, MIT; see [`NOTICE.md`](src/ui/NOTICE.md).
- `src/engine/` — public-key validation boundary and browser wallet-core WASM address derivation.
- `src/state/` — wallet context, xpub persistence, in-memory addresses and UI lock state.
- `src/screens/` — the 14 screens and their available, mock or unavailable states.
- `src/app/` — application shell and routing.
- [`packages/contracts/`](../../packages/contracts/) (repository root) — shared types, imported as `@bawa/contracts` via a `file:` dependency.

## Evidence

The boundary tests derive the published fixture addresses exactly for BTC, ETH and TRX at
indices 0 and 1. They also reject private extended keys and keys with bad checksums, wrong
versions or invalid secp256k1 points. Run `npm test` to see them pass.
