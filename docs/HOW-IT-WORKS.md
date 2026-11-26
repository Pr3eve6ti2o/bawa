# How Bawa works

This page explains, in plain terms, how this repository works, how it
starts, and what it can do. The same architecture is drawn as
hand-crafted SVG at the top of the [README](../README.md) — those
diagrams render everywhere, including the GitHub mobile app. This page
carries the same content as Mermaid text: editable, diffable, and
rendered by github.com in a browser. The diagrams are kept small on
purpose: nine nodes at most per diagram, so they stay readable and
inside GitHub's rendering limits.

> **Known trade-off, stated plainly:** the GitHub **mobile app** shows
> Mermaid blocks as raw code, not as a rendered diagram. The diagrams
> render on github.com in a browser (desktop and mobile web). That is
> why both formats exist: the SVG in the README is what renders
> everywhere, and the Mermaid here is the editable source of the same
> architecture. The owner ordered both formats (2026-11-23).

Every box in every diagram is traced to a real file in this repository
in the [accuracy trace](#accuracy-trace--every-box--a-real-file) below.
Nothing here is invented: if a box has no file behind it, it does not
belong in the diagram.

## The repository in one paragraph

The **guide** (`docs/`, sixteen sections, plus the machine-readable
`registry/`) tells a person — or an AI agent — how to build a complete
professional wallet from resources that actually exist. The **example
web wallet** (`apps/web/`) is the working proof of that guide: a fully
functional example wallet built using it. It creates a real HD wallet in
the browser, derives addresses on 87 chains, reads real balances and
prices from public endpoints, and lets you receive, track, and add
tokens. It never invents a balance or a price, and it cannot send funds
on mainnet: broadcast stays disabled.

## Diagram 1 — System map

```mermaid
flowchart TB
    accTitle: Bawa system map
    accDescr: The guide and registry build the example web wallet, which runs on Trust Wallet Core and opens on a dashboard with 22 chains enabled by default.

    guide["Guide — docs/ 01–16"] --> builder["Builder — scripts/build-wallet.mjs"]
    registry["Registry — capabilities, engines, profiles, ui"] --> builder
    builder --> webwallet["Example web wallet — apps/web"]
    core["Wallet Core 4.9.3 — WASM"] --> webwallet
    webwallet --> dashboard["Dashboard — 22 chains enabled, 43 rows"]

    classDef guide fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef sun fill:#FFD93B,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef plain fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B

    class guide,registry guide
    class builder,core sun
    class webwallet,dashboard plain
```

## Diagram 2 — Keys and vault

```mermaid
flowchart TB
    accTitle: Keys and vault
    accDescr: One 24-word phrase opens one HD wallet; the vault encrypts it on the device and the core derives one address per chain.

    phrase["24-word phrase — createWallet()"] --> hd["HDWallet.createWithMnemonic"]
    hd --> addrs["87 addresses — getAddressForCoin"]
    phrase --> vault["Vault — bawa-vault"]
    vault --> kdf["PBKDF2 600,000 → AES-GCM-256"]
    addrs --> evm["57 chains — one shared key"]
    addrs --> other["BTC · TRX · TON · SOL · LTC · DOGE"]
    watch["Watch-only — xpubs only, no secret"] --> addrs

    classDef guide fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef sun fill:#FFD93B,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef plain fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B

    class phrase,vault guide
    class hd,kdf sun
    class addrs,evm,other,watch plain
```

## Diagram 3 — Balances, prices and flows

```mermaid
flowchart TB
    accTitle: Balances, prices and flows
    accDescr: Addresses feed public RPC balances and cached prices; Receive, Track and Add Token read them, and Send stops at a disabled broadcast.

    addrs2["Addresses on 87 chains"] --> balances["Balances — public RPCs, up to 3 per chain"]
    balances --> prices["Prices — CoinGecko, CoinLore, Coinbase, DexScreener, TonAPI"]
    balances --> receive["Receive — address + QR"]
    balances --> track["Track — by transaction hash"]
    balances --> addtoken["Add Token — by contract address"]
    addrs2 --> send["Send — build + sign offline"]
    send --> guard{"Broadcast allowed?"}
    guard -->|No — mainnet| blocked["Blocked — broadcast disabled"]

    classDef guide fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef sun fill:#FFD93B,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef coral fill:#FF6B4A,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B
    classDef plain fill:#FFFDF7,stroke:#2B2B2B,stroke-width:2px,color:#2B2B2B

    class addrs2 guide
    class balances,prices sun
    class guard,blocked coral
    class receive,track,addtoken,send plain
```

There is no Yes edge out of the guard on mainnet — the only Yes lives
in devnet mode (`bawa-devnet-enabled`), a temporary test-only switch
that re-points the wallet at test networks with valueless tokens. It is
removable without touching mainnet behaviour.

What each part means, in the wallet's own terms:

- **Guide and registry** — sixteen sections (`docs/01-fundamentals/`
  through `docs/16-security-decision-guide/`) plus four machine-readable
  registries (`capabilities.json`, `engines.json`, `profiles.json`,
  `ui.json`). The builder (`scripts/build-wallet.mjs`, or the menu
  launcher `tools/bawa_cli.py`) turns one plain request — "Create a Web
  wallet" — into a real project from those resources. The guide covers
  the full Trust Wallet Core registry of 168 chains; the example wallet
  ships with 87 in the registry, 22 enabled by default.
- **Wallet Core 4.9.3** — Trust Wallet Core as WASM, loaded by
  `loadCore`. It owns the mnemonic, the derivation and the address
  checks; the app never implements cryptography itself.
- **24-word phrase** — `createWallet` takes 32 random bytes from the
  browser's secure random source and opens one HD wallet from them; the
  mnemonic is exactly 24 words. One phrase, one account, one wallet
  identity: there is no keypair per token and no single address that
  works on every chain.
- **87 addresses** — `deriveAddresses` opens the one HD wallet and
  derives one address per chain. 57 chains share the
  `m/44'/60'/0'/0/0` key — 56 EVM chains, which render it as the same
  0x address, plus Injective (Cosmos, same key, bech32 address).
  Ronin shares the key with a `ronin:` prefix. The rest have their own
  paths: Bitcoin `m/84'/0'/0'/0/0`, Litecoin `m/84'/2'/0'/0/0`, TRON
  `m/44'/195'/0'/0/0`, Dogecoin `m/44'/3'/0'/0/0`, TON `m/44'/607'/0'`
  (Wallet V4 R2, workchain 0), Solana `m/44'/501'/0'`. Both are
  account-0 paths: per-account derivation rotates them — Solana to a
  fresh address per account, TON to a second address — while the phrase
  stays the same (`deriveAddressesAt`, `core.ts:523`; `pathFor`,
  `chains.ts:1757`).
- **Vault** — the phrase is stored in `bawa-vault` as an envelope
  (`version`, `kdf`, `saltB64`, `ivB64`, `ciphertextB64`) encrypted with
  AES-GCM-256 under a key derived by PBKDF2 with 600,000 iterations
  (SHA-256). No plaintext secret is stored anywhere. Auto-unlock keeps
  the raw derived key in `bawa-vault-key` next to the ciphertext it
  decrypts; backups live in `bawa-vault-backup`, accounts in
  `bawa-vault-accounts:v1`.
- **Watch-only** — instead of a phrase, the wallet stores only public
  extended keys (`bawa-watch-only-xpubs`) and derives addresses from
  them, so it can show balances without ever holding a secret.
  Watch-only is mainnet-only.
- **9 adapter modules** — one per family (Bitcoin, Ethereum, TRON,
  TON, Solana, Litecoin, Dogecoin) plus the generic EVM adapter
  (`evm.ts`), which serves all 60 EVM chains, and `token-balances`
  for token reads — each talking to public RPC endpoints
  (up to two per chain in the registry, with fallbacks; a custom
  endpoint can be added per chain, at most three in total). The full
  per-chain endpoint table, the history indexers and the rate limits the
  app enforces on itself are in [docs/13](13-wallet-app-architecture/README.md#live-services-the-app-is-built-from)
  and [docs/06](06-tracking/README.md#3-rpc-is-not-an-indexer).
- **Balances from public RPCs** — the dashboard refreshes every enabled
  chain's balance from its adapter. A failed fetch shows as unavailable,
  never as zero or as a made-up number.
- **Prices** — CoinGecko first for listed assets, with a 10-minute
  cache. When a CoinGecko quote is stale or missing, native assets fall
  back to CoinLore and Coinbase (LTC only); unlisted tokens fall back to
  DexScreener (EVM, Solana, TRON) and TonAPI rates (TON Jettons). When
  no source has a price, the wallet says the price is unavailable. The
  full per-provider entries, with free and paid tiers, are in
  [ADR-0007](adr/0007-price-feed-provider.md).
- **Receive and Send** — Receive shows the address and QR code for any
  chain. Send builds the transaction offline and signs it
  (`createTransactionIntent`) — but mainnet broadcast stays **disabled**
  (`isBroadcastAllowedFor`), so the wallet cannot move real funds.
  (Test-only sending lives in devnet mode, above.)
- **Track transactions** — look up a transaction by hash on Bitcoin,
  Ethereum, TRON, and TON (and other chains through their adapters) and
  see its confirmations and status.
- **Add Token by contract address** — add any token, listed or not: the
  wallet reads its real name, symbol, and balance from the chain, and
  its price where a source has one. Custom tokens are stored in
  `bawa:custom-tokens:v1`.
- **Networks — connections** — the Networks screen (`/networks`) is the
  one place to see and change how the wallet connects: every chain's
  RPC endpoints, the price sources, and the history source per chain.
  See "Networks: connections, prices and history" below.

### Networks: connections, prices and history

The Networks screen is where the wallet's connections live — not the
Security screen, which is about the vault and the recovery phrase.
Everything here is plain language, one screen, no jargon.

- **RPC endpoints** — for each chain, the addresses the wallet asks for
  balances, in the order it tries them. The first one is labelled
  Primary, the next ones Backup. When one is down the wallet tries the
  next on its own. Dogecoin keeps its built-in pair and takes no custom
  address.
- **Use backup** — switches one chain to its backup address, and
  refreshes the balance straight away so you can see it work. **Switch
  all to backup** does the same for every chain that has a backup.
- **Use this one** — makes any listed address the one the wallet tries
  first. This is how a custom address you added becomes the one in use.
- **Add RPC** — add your own address for the chosen chain. It must be
  `https`, with no key or password in it. Only addresses on the wallet's
  built-in allowed list can be used — the browser blocks any other
  address, so the screen says so instead of storing an entry that could
  never work. The well-known public addresses that are allowed
  (Flashbots and dRPC for Ethereum) are offered as one-tap buttons.
- **Check / Check all connections** — asks each address, live from this
  browser, whether it answers for the right chain, and shows the answer
  next to it: "Working · block 26,480,090 · 74 ms", or "Not answering"
  with the reason. A dead backup shows up here honestly instead of
  hiding behind its Backup label.
- **Last balance from …** — under each chain, the address that actually
  answered the last balance, with the time. This is the proof a switch
  worked, not just the label.
- **History** — under each chain, the source the wallet reads past
  transactions from, or "no working source — history unavailable for
  this chain" where none is wired. Five chains have no working history
  source (BNB Chain, Gnosis, opBNB, Metis, Fantom); their
  history stays unavailable, never faked.
- **Prices** — the order the wallet tries for prices: CoinGecko first
  for every chain, then CoinLore (75 chains), DexScreener (13 chains,
  from the on-chain price of the wrapped coin), Coinbase (47 chains)
  and TonAPI for TON (`priceFallbackSourcesFor`,
  `apps/web/src/wallet/price-fallbacks.ts:372`). Twelve chains have no
  CoinLore id — fraxtal, ltc, matic, monad, pulsechain, rootstock,
  songbird, telos, ton, velas, xdc, zetachain — and are covered by the
  other legs; seven chains (fraxtal, pulsechain, rootstock, songbird,
  telos, velas, xdc) are CoinGecko-only, with no fallback source, so
  their price shows unavailable when CoinGecko fails. Pulsechain and
  telos declare a DexScreener chain id in their chain records but have
  no wrapped-token entry, so their DexScreener leg cannot run as
  written. The card also counts, from the prices already on this device,
  which source is pricing each chain right now; each asset row names the
  source that priced it.
- **Reset all to defaults** — puts every chain back to the addresses the
  wallet ships with. Changes are stored on this device only
  (`bawa-rpc-overrides:v1`).

## Running it

The full step-by-step version, verified from a clean checkout, is
[Create the example web wallet](CREATE-EXAMPLE-WALLET.md). In short:

1. **Clone** — `git clone https://github.com/Pr3eve6ti2o/bawa.git`.
2. **Install** — `cd apps/web && npm ci`. Node 22 is required
   (`apps/web/.npmrc` sets `engine-strict=true`, so any other Node
   fails here).
3. **Build** — `npm run build`. This type-checks, builds with Vite,
   copies the wallet-core WASM file, and checks its SHA-256 against the
   pinned `@trustwallet/wallet-core` 4.9.3 release.
4. **Run** — `npm run preview` serves the built app at
   `http://localhost:4173` (`npm run dev` instead for hot reload on
   `http://localhost:5173`).
5. **Welcome screen** — create a wallet, import one, or add a
   watch-only wallet.
6. **Dashboard** — a fresh wallet opens on 22 native assets plus 21
   default tokens: 43 rows. A balance shows as unavailable when its
   provider cannot be reached; it is never shown as an invented figure.

No account, no API key, and no funds are needed. Everything runs
locally; balances come from public read-only endpoints.

## Accuracy trace — every box → a real file

| Diagram box | Real file(s) in this repo | What the file does |
| --- | --- | --- |
| Guide | `docs/01-fundamentals/` … `docs/16-security-decision-guide/`, `WALLET_BUILDER.md` | The sixteen-section guide the wallet is built from |
| Registry | `registry/capabilities.json`, `registry/engines.json`, `registry/profiles.json`, `registry/ui.json` | Machine-readable registries the builder reads |
| Builder | `scripts/build-wallet.mjs`, `tools/bawa_cli.py` | One prompt in, a real project out |
| Example web wallet | `apps/web/`, `apps/web/package.json` | The working proof of the guide |
| Wallet Core 4.9.3 | `apps/web/package.json:36` (`@trustwallet/wallet-core: 4.9.3`), `apps/web/src/engine/boundary.ts:256` (`loadCore`) | WASM core: mnemonic, derivation, address checks |
| Dashboard — 22 chains enabled by default, 43 rows | `apps/web/src/screens/dashboard.tsx`, `apps/web/src/wallet/chains.ts:1681` (`SUPPORTED_CHAINS`, 87 entries), `apps/web/src/wallet/tokens.ts:182` (`DEFAULT_TOKENS`, 21 entries) | 22 native assets + 21 default tokens |
| 24-word phrase | `apps/web/src/wallet/core.ts:216` (`createWallet`), `core.ts:232` (`HDWallet.createWithEntropy`, 32 bytes) | 24-word BIP-39 phrase from secure entropy |
| HDWallet.createWithMnemonic | `apps/web/src/wallet/core.ts:303` (`deriveAddresses`), `apps/web/src/engine/boundary.ts:937` (`deriveAddresses`) | Opens the one HD wallet from the phrase |
| 87 addresses | `apps/web/src/wallet/core.ts:303` (`deriveAddresses`), `core.ts:319` (the `getAddressForCoin`-path comment, pinned by the wiring test), `core.ts:40-128` (`DEFAULT_PATHS`, 87 entries), `core.ts:523` (`deriveAddressesAt`, per-account SOL/TON), `apps/web/src/wallet/chains.ts:583` (`CHAINS`), `chains.ts:1757` (`pathFor`) | One address per chain from one phrase; SOL/TON rotate per account |
| Vault — bawa-vault | `apps/web/src/wallet/vault.ts:79` (`VAULT_STORAGE_KEY`), `vault.ts:80` (`bawa-vault-backup`), `vault.ts:82` (`bawa-vault-key`), `vault.ts:739` (`bawa-vault-accounts:v1`) | Encrypted on-device vault; localStorage keys |
| PBKDF2 600,000 → AES-GCM-256 | `apps/web/src/wallet/vault.ts:84` (`PBKDF2_ITERATIONS = 600_000`), `vault.ts:85` (`SHA-256`), `vault.ts:88` (`AES-GCM`), `vault.ts:97-109` (`VaultEnvelope`) | Key derivation and envelope fields |
| 57 chains — one shared key | `apps/web/src/wallet/core.ts:40-128` (`DEFAULT_PATHS`: 57 chains at `m/44'/60'/0'/0/0` — 56 EVM chains plus Injective, which uses the same path but is Cosmos, not EVM) | One key across the 57 chains; the 56 EVM chains render it as the same 0x address (Ronin shares the key with a `ronin:` prefix); Injective renders it bech32 |
| BTC · TRX · TON · SOL · LTC · DOGE | `apps/web/src/wallet/core.ts:40-128` (`DEFAULT_PATHS`), `apps/web/src/wallet/chains.ts:1757` (`pathFor` per chain; TON V4 R2, workchain 0 — `chains.ts:620`) | Per-chain derivation paths |
| Watch-only — xpubs only, no secret | `apps/web/src/engine/boundary.ts:780` (`validateWatchOnlyImport`), `apps/web/src/state/wallet-context.tsx:76` (`bawa-watch-only-xpubs`) | Public extended keys only; mainnet-only |
| Addresses on 87 chains | As "87 addresses" above | The addresses every flow starts from |
| Balances — public RPCs, up to 3 per chain | `apps/web/src/wallet/chains.ts:1874` (`MAX_RPC_ENDPOINTS_PER_CHAIN = 3`), `chains.ts:1955` (`resolveRpcEndpoints`), `apps/web/src/wallet/adapters/index.ts:89` (`registerAllAdapters`), `apps/web/src/state/wallet-context.tsx:855` (`refreshBalances`) | Balance refresh across enabled chains; failures show as unavailable |
| Networks — connections, prices, history | `apps/web/src/screens/network-selection.tsx` (`RpcEndpointManager`, `PriceSourcesCard`), `apps/web/src/wallet/chains.ts` (`makePrimaryEndpoint`, `isCustomRpcOriginUsable`, `SUGGESTED_CUSTOM_RPCS`), `apps/web/src/wallet/rpc-probe.ts` (`probeRpcEndpoint`), `apps/web/src/wallet/price-fallbacks.ts` (`priceFallbackSourcesFor`), `apps/web/src/state/wallet-context.tsx` (`BalanceState.source`) | One screen to see and switch RPCs, check them live, and see price and history sources; every switch refreshes balances at once |
| Prices — CoinGecko, CoinLore, Coinbase, DexScreener, TonAPI | `apps/web/src/wallet/prices.ts:254` (`MAX_QUOTE_AGE_MS`, 10 minutes), `prices.ts:258` (`PriceSource`), `prices.ts:559` (`PRICE_CACHE_KEY`), `prices.ts:782` (`fetchPrices`), `prices.ts:1250` (`usePrices`), `apps/web/src/wallet/price-fallbacks.ts:371` (`priceFallbackSourcesFor`), `price-fallbacks.ts:639` (`applyPriceFallbacks`, CoinLore + Coinbase native fallbacks), `apps/web/src/wallet/dex-prices.ts:254` (`fetchDexScreenerPrices`), `apps/web/src/wallet/token-prices.ts:174` (fallback-order comment), `token-prices.ts:404` (`useTokenPrices`) | Live prices; honest "unavailable" when no source has one |
| Receive — address + QR | `apps/web/src/screens/receive.tsx` | Address + QR card for any chain |
| Track — by transaction hash | `apps/web/src/screens/track-transaction.tsx`, `apps/web/src/wallet/tracker.ts:101` (`parseBtcTx`), `tracker.ts:170` (`parseEthTx`), `tracker.ts:227` (`parseTrxTx`), `tracker.ts:290` (`parseTonTxEntry`) | Transaction lookup and confirmation status per chain |
| Add Token — by contract address | `apps/web/src/screens/add-token.tsx`, `apps/web/src/wallet/tokens.ts:761` (`CUSTOM_TOKENS_KEY`) | Any token by contract address; real name, symbol, balance |
| Send — build + sign offline | `apps/web/src/screens/send.tsx`, `apps/web/src/wallet/send.ts`, `apps/web/src/wallet/signing-intent.ts` (`createTransactionIntent`) | Offline signing; nothing leaves the device unsigned |
| Broadcast allowed? | `apps/web/src/wallet/send.ts:1161` (`isBroadcastAllowedFor`) | The guard: mainnet broadcast is not allowed |
| Blocked — broadcast disabled | `apps/web/src/wallet/send.ts:1193` (status `disabled`, `BROADCAST_DISABLED_MESSAGE`) | Send stops here on mainnet |
| Devnet mode (prose) | `apps/web/src/wallet/devnet.ts:30` (`DEVNET_ENABLED_KEY`), `apps/web/src/wallet/devnet-endpoints.ts`, `apps/web/src/screens/devnet-setting.tsx` | Temporary test-only switch to test networks; devnet-only broadcast |

Supporting pieces named above: shared types in
`packages/contracts/src/index.ts` (including `WatchOnlyWallet`), the
offline derivation CLI in `tools/hdwallet-gen/`, and the guide's
architecture sections `docs/13-wallet-app-architecture/` and
`docs/14-wallet-app-implementation/`.

## How this page was verified

- All three Mermaid blocks were rendered to SVG with
  `@mermaid-js/mermaid-cli` on the development VM (Node v22.23.4,
  headless Chromium) — a successful render proves the syntax is valid
  Mermaid that GitHub's renderer can also parse. The rendered SVGs
  contain every node label from all three diagrams.
- Both hand-crafted SVGs in `docs/diagrams/` were rendered in headless
  Chromium and viewed as screenshots at README width (900 px) and at
  mobile width (390 px). The architecture SVG is legible at README
  width; the explainer SVG stays legible at mobile width.
- Every box was checked against the file listed for it in the trace
  table above, in the `panel-rebuild/finish-product` tree at the time of
  writing. No module or flow in any diagram is invented.
- The README embeds both SVGs at the top, right after the one-line
  description; this page is linked from there.
