# Bawa Web starter

This is the Web starter for Bawa AI Wallet Builder, built on the vendored token-ui
foundation. It supports in-browser wallet generation and recovery, watch-only import,
offline signing with broadcast disabled, and read-only balances and transaction history
via chain adapters. Prices come from CoinGecko, with DexScreener and TonAPI as fallback for tokens CoinGecko does not list, so there is a portfolio fiat total.
Secrets never leave the browser.

It ships with 87 chains (22 enabled by default); the list is `SUPPORTED_CHAINS` in `src/wallet/chains.ts`. The guide covers the full Trust Wallet Core registry of 168 chains, and this wallet supports 87 of them.

## Install, develop, build and test

Use Node.js `>=22 <23`. The range is enforced: `apps/web/.npmrc` sets `engine-strict=true`, so `npm ci` fails with `EBADENGINE` on any other Node release. The package is `@bawa/web` and is private. Run these commands from the
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
- Navigate all 15 screens, with mock data and unavailable actions labelled as such.

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
- **WalletConnect:** removed in the providers programme (2026-11-26). Connecting Bawa to dApps needs a free Reown Cloud project ID, which has not been set up — without one the relay never connects, so the screen, its client modules and the `@walletconnect/*` dependencies were removed rather than shipped dead. No keys or funds are affected. To bring it back later: create a free account at https://cloud.reown.com, create a project, copy the project ID into `VITE_WALLETCONNECT_PROJECT_ID`, and restore the WalletConnect files from git history. The Security screen carries the same note in the app.
- **Buying with fiat (Coinbase Onramp, Lane D 2026-11-25):** the dashboard Buy tile and the Receive Buy panel (`/receive?buy=1`, the `/send?scan=1` precedent) wire Coinbase Onramp: the widget opens as a pop-up for the wallet's addresses on the ten Coinbase destination networks (Bitcoin, Ethereum, Solana, Base, Optimism, Arbitrum, Polygon, Avalanche, BNB Chain, TRON); Coinbase sets the price, fees, payment methods and regional availability. The panel shows the first deliverable address the purchase lands on by default — the widget itself is the network picker. There is deliberately no in-app success/exit feedback: a message listener plus its outcome states cost ~1 KB against 1,542,717 B of headroom (2026-11-27), and the purchase is completed and confirmed inside the Coinbase pop-up, with the delivery showing up as a normal incoming transaction. The widget URL is built in [`src/wallet/onramp.ts`](src/wallet/onramp.ts) as a faithful port of the SDK's `generateOnRampURL` (`@coinbase/cbpay-js` 2.4.0, MIT) — the SDK itself is NOT bundled, because its whole 7.3 KB survives the build (no `sideEffects: false`, and Vite's per-module override defeats both a treeshake rule and a `resolveId` plugin; three builds proved it) against 1,542,717 B of headroom, and a separate `/buy` route is not built — the Buy UI lives in the Receive screen reusing its components. A second entry point on the Receive details step was cut — the dashboard tile is the one entry point. Parity tests mirror the SDK's own URL vectors. **Not live yet:** buying needs Coinbase Onramp onboarding and the public project ID as `VITE_COINBASE_ONRAMP_APP_ID` at build time — without it the Buy panel says so plainly and offers no purchase. A live purchase has not been verified (no onboarding/keys exist yet). The Buy panel now also offers a provider picker (Ramp, MoonPay, Onramper, Banxa Referral, Transak, Mercuryo), each row stating which keys it needs and where they live; providers whose keys the owner has not provided show as not set up yet.

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
  source-level meta tag would break `npm run dev`. The meta carries the same
  policy minus `frame-ancestors 'none'`, which a `<meta>` tag cannot set
  (browsers ignore it and log a console error). Any production host serving
  `dist/` must send the same `Content-Security-Policy` header (plus
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`); GitHub Pages
  sends no custom headers, so the Pages deployment has no enforceable
  `frame-ancestors`.
- WASM integrity (T47): `scripts/copy-wasm.mjs` refuses to copy a wallet-core.wasm
  whose SHA-256 differs from the published @trustwallet/wallet-core@4.9.3 pin in
  `scripts/wasm-integrity.mjs`. Bump the pin from the new published tarball only.

## File map

Paths are relative to `apps/web/` unless marked otherwise.

- `src/ui/` — vendored `consenlabs/token-ui`, commit `6380d5d4`, MIT; see [`NOTICE.md`](src/ui/NOTICE.md).
- `src/assets/chains/` — native chain logos; see [Chain logos](#chain-logos).
- `src/engine/` — public-key validation boundary and browser wallet-core WASM address derivation.
- `src/state/` — wallet context, xpub persistence, in-memory addresses and UI lock state.
- `src/screens/` — the 15 screens and their available, mock or unavailable states.
- `src/app/` — application shell and routing.
- [`packages/contracts/`](../../packages/contracts/) (repository root) — shared types, imported as `@bawa/contracts` via a `file:` dependency.

### Chain logos

The native chain logos in `src/assets/chains/` are copied from
[`trustwallet/assets`](https://github.com/trustwallet/assets), MIT licence,
Copyright (c) 2019-2023 Trust Wallet, pinned at commit
`e8f61783ac6451fa8b7b1b4f72bf4a9607f6872e`. The four original logos
(Bitcoin, Ethereum, TRON, TON) live under `blockchains/<chain>/info/logo.png`.
The nine token-discovery logos (Solana, BNB Smart Chain, Polygon, Arbitrum,
Optimism, Base, Avalanche C-Chain, Litecoin, Dogecoin) use the same source
with one directory correction each: BNB Smart Chain is
`blockchains/smartchain` (not `blockchains/binance`, which is the BNB
Beacon Chain mark), Avalanche C-Chain is `blockchains/avalanchec` (not
`avalanche`), and Dogecoin is `blockchains/doge` (not `dogecoin`). Each
logo's upstream `info.json` name was verified at fetch time. They are
rendered by the chain-keyed `chainLogoFor` map in
`src/screens/token-logo.tsx` (so Arbitrum, Optimism and Base no longer
all fall back to the Ethereum logo) and by the `ChainLogo` component
(`src/screens/token-logo.tsx`) in place of ticker-letter chips.
Each logo is stored twice: the original PNG (canonical source, 833,053
bytes total) and a 96 px WebP at quality 85 (97,446 bytes total, -88%),
matching the existing chain-logo convention. Lane G (2026-11-23) adds
the nine late-registry chain logos from the same source and pinned
commit (Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis, Aurora,
Fantom), with one directory correction: Gnosis is `blockchains/xdai`
(not `blockchains/gnosis`, which does not exist). Each logo's upstream
`info.json` name was verified at fetch time. Lane 80-APP (2026-11-24)
adds the thirty-four expanded-chain logos from the same source and
pinned commit (56 chain logos, 112 files in total), with directory
corrections where the Bawa key differs from the Trust Wallet directory
(Kava `kavaevm`, Sei EVM `seievm` vs Sei Cosmos `sei`, IoTeX
`iotexevm`, Conflux `cfxevm`, Ethereum Classic `classic`, ZetaChain
`zetaevm`, XRP `ripple`, Injective `nativeinjective`). Each logo's
upstream `info.json` name was verified at fetch time. The chain strip and the
receive/send pickers use `ChainLogo` now too — the hand-drawn blob
with the ticker text inside rendered as a crossed-out logo, so it is
gone from every screen. Lane E (token-verify programme, 2026-11-24)
adds the twenty-eight remaining chain logos — the ones with no Trust
Wallet Assets directory at the pin, or at HEAD (checked 2026-11-24).
Their real marks come from DefiLlama chain icons (22: Zora, Mode,
Fraxtal, Berachain, Arbitrum Nova, Unichain, Ink, Abstract, Soneium,
ApeChain, Immutable zkEVM, Fuse, X Layer, Taiko, Telos, Core,
PulseChain, Chiliz, Flare, Hemi, BOB, dYdX), CoinGecko coin images (5:
Astar, Songbird, Velas, World Chain via the Worldcoin mark, Celestia
via the TIA mark) and the Tatum chain-logo CDN (1: Flow EVM, SVG
rendered to PNG). Each was viewed by eye before bundling; the
per-chain source is recorded in the canonical dataset
`chains-expanded.ts` (iconPath / iconUrl); the production chain data
lives in `chains.ts`. Same convention as the rest: original PNG plus 96 px WebP at
quality 85 (28 logos, 56 files, 1,146,342 bytes PNG, 50,208 bytes
WebP). All 87 registry chains now have a real logo. The Flare source
had a checkerboard baked into its corners; the bundled PNG has those
corners made transparent instead. The fallback for a logo that fails
to load is no longer the faded empty ring: it is a paper disc with an
ink ring and a centred chain-link mark, clearly intentional and never
yellow, never a ticker square. The Add chain rows show each chain's
real logo too (ChainLogo, Lane E).

### Token logos

Token logos live in `src/assets/tokens/` and are rendered by the `TokenLogo`
component (`src/screens/token-logo.tsx`); `ChainLogo` in the same file
is a thin wrapper over `TokenLogo`, so the asset rows, asset detail and
wallet management all share one logo path.
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
its upstream `info.json` name at fetch time. Lane G (2026-11-23) adds
WETH (`blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`,
upstream name WETH) and USDT0 (`blockchains/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png`,
upstream name Tether USD, symbol USDT — the USDT0 contract on Arbitrum),
plus a symbol-alias map for the on-chain spellings the registry reports
(`USD₮` → USDT, `USD₮0` → USDT0; `USDt` already uppercases to USDT).
Trust Wallet resolves logos by contract address, not by symbol; the
symbol map plus aliases is this wallet's simplification of that. The seven default tokens
(USDC, USDT, DAI, LINK, UNI, WBTC on Ethereum; USDT on TRON) are
displayed in the asset rows with real balances from
`src/wallet/adapters/token-balances.ts` (ERC-20 `balanceOf` via viem,
TRC-20 `balanceOf` via TronGrid) and real prices from the CoinGecko
token feed (`src/wallet/token-prices.ts`); they must never be shown with
a fabricated balance. A token with no registered logo renders an
honest empty state (a plain ring, no fill, no ticker text), never a
broken image and never a yellow text square (Lane B, 2026-11-24 —
the yellow ticker badge read as a broken logo).

Lane A (token-verify, 2026-11-24): a user-added token's icon is
resolved at add time, in order — Trust Wallet Assets at the pinned
commit (`blockchains/<dir>/assets/<contract>/logo.png`, HEAD-checked;
only 30 chains have an Assets directory, the rest fall through),
the CoinGecko token image (`image.small` from the contract
endpoint), then the verifying list's `logoURI` — but only when its
host is an allowed image origin (`raw.githubusercontent.com`,
`assets.coingecko.com`, `coin-images.coingecko.com`,
`tokens.1inch.io`, `tokens.pancakeswap.finance`). The URL and its
source are stored on the token record (`iconUrl`, `iconSource`) and
shown on the asset detail ("Icon from …"). A token with no icon from
any source keeps the empty ring. The bundled symbol logo is shown
for a user-added token only when it is a curated default — a custom
token that shares a symbol with a known token must not wear that
token's mark. Verification itself is membership in a trusted list
checked by exact chain + contract (`src/wallet/token-verification.ts`):
curated defaults, a CoinGecko listing, Jupiter Strict (Solana),
1inch, Uniswap Default, or PancakeSwap Extended. A memecoin with a
real listing is Verified; a copycat contract with the same
name/symbol is not. The verified mark names its source ("✓ Verified
(CoinGecko)") on the asset detail and in the row detail, and the
Add Token result does the same. Raydium and DexScreener are NOT
verification sources (any token with a pool is listable; pair
existence proves a pool, not the real token) — they stay price /
existence sources only. Lane A also fixed the SPL metadata read
that blocked every Solana add: `fetchSplTokenMetadata` used
`getProgramAccounts`, which the wallet's primary Solana RPC
(PublicNode) refuses ("Indexed requests require a personal token",
-32602), so no SPL token could ever be added by contract — real
BONK included. It now reads the Metaplex metadata account by its
program-derived address with a plain `getAccountInfo` (the same
pure-PDA math as the ATA derivation, `deriveMetaplexMetadataAddress`
in `src/wallet/adapters/token-balances.ts`, verified against the
live chain for BONK). The CoinGecko platform map
(`COINGECKO_PLATFORM_FOR_CHAIN` in `src/wallet/tokens.ts`) covers
all 87 chains — 60 EVM platforms + Solana + TRON + TON; Bob has no
CoinGecko platform — and corrects the old Metis slug
(`metis-andromeda`, not `metis`).

### Design tokens and UI patterns (Lane G research, 2026-11-23)

Sources: `~/workspace/bawa-uiux-sources/RESEARCH.md` (13 sources, all
fetched and read). What Lane G applied, and where:

- **Card treatment** — instalanding.ai `systems/oishi` (cream paper, ink
  borders, hard offset shadows) and `systems/linework` (dot-grid paper,
  66 tokens; the closest match to Bawa's drawing-illustration style).
  Bawa's tokens are formalised on Linework's roles in
  `src/ui/styles/globals.css` (paper / ink / coral + sun accents / mono
  for technical annotations) with a new `--bawa-shadow` token
  (`4px 4px 0 var(--bawa-ink)`, Tailwind `shadow-bawa`). The Popular
  chains cards use it, with a press state (translate + shadow off, the
  OJO 8-state active state). No new colours: the 4-colour cap holds. [Superseded 2026-11-27: the owner picked style B (polished financial style), which restores semantic colours and retires the 4-colour cap — see docs/DECISIONS.md §34.]
- **Row anatomy** — Ivy Wallet `feature/accounts` (patterns only;
  Kotlin/Compose, GPL-3.0, no code copied): icon + name + balance, no
  Retry. Bawa's no-wallet rows follow it (zero balance, real logo, real
  price state). Ivy `feature/exchange-rates` (price with source +
  freshness) is the strip's price + "per BTC" + CoinGecko attribution.
- **Hero number** — Magic UI Number Ticker (MIT; re-implemented, not
  copied) in `src/ui/components/number-ticker.tsx`: the dashboard hero
  total counts to its value on load and ticks to a new value on change.
  Number Flow (UI Vault registry) was the alternative; one was picked,
  not both. Static under `prefers-reduced-motion` and when no
  `matchMedia` API exists.
- **Empty state** — Aceternity Empty States (structure only, re-skinned
  to ink): illustration + one plain line + one action. The no-vault
  asset list shows it above the zero rows; locked and unlocked vaults
  never see it.
- **Gate** — ui-ux-pro-max-skill pre-delivery checklist (Fintech/Crypto
  rule): SVG icons only (token logos are real imagery, not icons —
  OJO-Design-Skills real-imagery rule, which is what kills the yellow
  text-square badges), 4.5:1 text contrast (ink on paper measures
  13.92:1), `prefers-reduced-motion` respected, responsive check at
  375 / 390 / 1440 px.
- **Not used** — Aureon Wealth Dashboard sparklines/allocation card
  (dashboard rework, out of this lane); shop-app (5 years stale);
  liquid-glass/aurora/neon styling and OJO pixel-paper-editorial
  (clash with the hand-drawn ink look); Ivy Wallet code (GPL-3.0).

## Evidence

The boundary tests derive the published fixture addresses exactly for BTC, ETH and TRX at
indices 0 and 1. They also reject private extended keys and keys with bad checksums, wrong
versions or invalid secp256k1 points. Run `npm test` to see them pass.

Verified on this tree on 2026-11-20: Vitest passed all 40 test files and all 457 tests
(exit 0).
