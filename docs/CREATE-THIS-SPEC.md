# CREATE-THIS-SPEC — the single "create this" specification for Bawa

**Status:** canonical guide entry point, written 2026-11-25 (Lane G, "install all
usable" programme, branch `usable-lane-g-guide`, base `token-gaps 7fea3e4`).
**Read this first, with `WALLET_BUILDER.md` and `AGENTS.md`.** If this spec and
an older guide section disagree, this spec wins for the items it covers, and
the older section is listed as fixed or stale in the trace table (§17).

**How an AI agent must use this document.** Follow the sections in order.
Do not skip a section because a capability sounds familiar. Every section
names the real files, real function names, real numbers and real constraints.
Only resources that actually exist are cited. Anything marked **PENDING**
is not in the code yet: implement it from the survey plus the named lane
plan, and re-check it against the lane's committed code before claiming it
done. Nothing here is implied, assumed, or invented. User-visible content
is en-GB.

**Evidence labels** are exactly those in `AGENTS.md` §5:
`IMPLEMENTED_AND_VERIFIED`, `STARTER_IMPLEMENTED_AND_VERIFIED`,
`DOCUMENTED_NOT_TESTED`, `PROPOSED`, `OPEN`, `EXTERNALLY_DEPENDENT`,
`UNVERIFIED`.

## Part A status at writing time (2026-11-25, verified first-hand)

The six Part A implementation lanes run in parallel with this guide lane.
When this spec was written, **none of the six had committed any code**:
every Part A worktree (`bawa-usable-lane-a-bitget-worktree`,
`bawa-usable-lane-b-okx-chains-worktree`,
`bawa-usable-lane-c-walletconnect-worktree`,
`bawa-usable-lane-d-coinbase-worktree`,
`bawa-usable-lane-e-shamir-worktree`,
`bawa-usable-lane-f-clear-signing-worktree`) was at base `7fea3e4` with a
clean tree. Their sections below are therefore written from the wallet-org
survey (`/home/boxd/workspace/wallet-repos/SURVEY.md`, 2026-11-25, hands-on,
0 Sol calls) plus each lane's stated plan, and are marked **PENDING** with
the exact thing to re-check. The guide must be re-checked against each
lane's committed code when it lands; where implementation differs from the
survey, the guide must match the implementation.

| Lane | Work | Section | Status |
| --- | --- | --- | --- |
| A | Bitget Agent API as an extra token verifier | §6.6 | PENDING — no code committed |
| B | Cardano, Starknet, Kaspa from OKX js-wallet-sdk | §2.5 | PENDING — no code committed |
| C | WalletConnect 2.21.0, lazy-loaded | §11 | PENDING — no code committed |
| D | Coinbase Onramp Buy, lazy-loaded | §12 | PENDING — no code committed |
| E | Shamir backup shares | §13 | PENDING — no code committed |
| F | ERC-7730 clear signing | §14 | PENDING — no code committed |

Lane H (2026-11-26, "install all usable" mining pass) re-checked
§6.6, §11 and §14 against the merged Part A code in the
`usable-lane-h-mining` worktree (base `637c139`, which has Lanes A,
C, D, E, F merged) and updated those sections in place; the rest of
this table is still the at-writing-time record above, and the
coordinator's re-check pass reconciles the remaining PENDING rows
after the rebase. Lane H's own record is §18.

## §0. Hard constraints — these are not negotiable

1. **Broadcast is disabled on mainnet until separately authorised.**
   `apps/web/src/wallet/send.ts:65-66` — "no module broadcasts on mainnet:
   broadcast stays DISABLED until separately authorised". `broadcastSigned`
   throws unconditionally on mainnet. No send has ever run on any network.
   The only exception is the temporary devnet-only broadcast path, §10.
   Never build, enable, or work around a mainnet broadcast path.
2. **Bundle budget: total JS in `dist/assets` ≤ 4,185,000 bytes; largest
   single JS chunk ≤ 3,050,000 bytes** (`CONSTRAINTS.md:40`; CI bundle-size
   step sums `dist/assets/*.js` after `npm run build`; budgets in `PERF.md`).
   The budget is the binding constraint on every new npm dependency (§17
   table). Do not re-baseline it without an owner order recorded in
   `docs/DECISIONS.md`.
3. **Four-colour cap.** The app uses at most four colours. The single
   confined exception is the QR card: exactly ten named `--qr-*` tokens
   (`--qr-teal`, `--qr-teal-deep`, `--qr-teal-band`, `--qr-teal-copy`,
   `--qr-bar`, `--qr-muted`, `--qr-grey`, `--qr-faint`, `--qr-nearblack`,
   `--qr-white-dim`) in `apps/web/src/ui/styles/globals.css`, used ONLY by
   the QR card and its PNG exporter (`docs/DECISIONS.md` §24, line 2015).
   No further literal may be added without a recorded decision there.
4. **No fake balances or prices, no invented data.** A chain with no
   balance source shows no balance (never zero-as-balance, never a
   placeholder). A chain no price source covers keeps its expired/error
   CoinGecko entry — never a guessed price (`apps/web/src/wallet/
   price-fallbacks.ts`, header). Listing a chain never implies it can do
   an operation; a chain is available for an operation only when
   `availableFor(capability)` in `apps/web/src/wallet/chains.ts` returns it.
5. **No secrets in source, logs, fixtures, prompts, or reports.** Never
   print, paste, or copy a secret value anywhere. Test keys are fresh,
   disposable, and never funded with real mainnet funds (`AGENTS.md` §4).
6. **Mainnet is the PRIMARY target; testnet is secondary/testing**
   (ADR-0003). Do not delete testnet code or restrictions. Mainnet use
   needs separate approval plus the real-funds gates.
7. **Self-custody only.** Keys are derived and held locally. Never route
   custody through a third-party service (Privy, hosted wallets, TEE/HSM
   key management). Never store a mnemonic, password, or key outside the
   encrypted vault (§4).

## §1. What Bawa is — build this

Bawa is an AI Wallet Builder plus a self-custodial multi-chain HD wallet.
One plain request must produce a real, buildable project from only
resources that actually exist. The web starter is `apps/web/`; the Android
starter is `apps/android/`; the engine is `tools/hdwallet-gen/` (Trust
Wallet Core 4.9.3 WASM). The builder entry point is
`node scripts/build-wallet.mjs "<request>"`, which classifies, generates
into `generated/<profile-id>`, verifies, and writes a JSON report; or
`node scripts/generate-project.mjs <profile-id>` for an explicit profile.

**Profiles (8, validated, in `registry/profiles.json`).** Do not invent a
ninth profile. Profile selection is routing, not a capability claim.

| Profile | Scope |
| --- | --- |
| `hd-wallet-cli` | CLI generation/derivation under the fixed engine policy |
| `bitcoin-wallet` | Bitcoin-focused; transaction support must not be assumed |
| `evm-wallet` | ETH/EVM-oriented; support beyond the specified ETH policy is OPEN |
| `multichain-wallet` | Combined BTC, ETH, TRX, TON; TON remains generation-only, single-address |
| `multichain-extended-wallet` | As registered, combined 13-chain requests (btc, eth, trx, ton, sol, bsc, matic, arb, op, base, avax, ltc, doge). The web wallet now wires 84 chains (§2); the registry has NOT been re-validated for the 84-chain set, so the wider set is OPEN for this profile until the registry is updated |
| `web-wallet` | Browser wallet; starter scope only, not a complete wallet |
| `android-wallet` | Android wallet; approved starter is UI layer only |
| `watch-only-wallet` | Public-data-only observation; no secret intake, no signing |

**Route every request** through `WALLET_BUILDER.md`: parse → plan →
profile → engine → chains → template → inspect → scaffold → implement →
verify → audit claims → report. Inspection precedes scaffolding. A blocked
step stops the work; it is never silently skipped or faked.

## §2. Chains — 84, not 13, not 22

**The count is 84: 22 curated chains in `apps/web/src/wallet/chains.ts`
plus 62 expansion chains in `apps/web/src/wallet/chains-expanded.ts`
(`EXPANDED_CHAINS`, line 116; `EXPANDED_CHAIN_COUNT = 62`, line 1792).**
The expansion programme wired all 84 into the app (adapters, prices,
icons, explorers; `docs/EXPANSION-PROGRAMME.md`). The 22-row capability
table in `WALLET_BUILDER.md` covers only the curated `chains.ts` set; the
62 expanded chains have their facts in `chains-expanded.ts`, each
cross-checked against at least two sources and each RPC called live on
2026-11-24. `docs/02-chains/README.md` §2 previously said Solana was
reference-only — that is stale and fixed: Solana is a wired chain in the
84-chain set.

**Rule for every chain.** A chain supports an operation only if
`availableFor(capability)` in `chains.ts` returns it. Verified today for
the curated 22: derive/restore/receive/balance verified on all 22;
history verified for BTC, ETH, TRX, TON, SOL, LTC, DOGE only; fee-quote,
unsigned-plan, local-sign and post-sign-verify verified for BTC, ETH, TRX
only (TON fee-quote and post-sign-verify blocked — see §5). For the 62
expanded chains, derivation evidence is the Wallet Core 4.9.3 derivation
probe of 2026-11-24 recorded in `chains.ts:339-351`; do not claim send,
history, or fee behaviour for an expanded chain without its own adapter
evidence.

### §2.1 Derivation paths — fixed, do not invent alternates

BIP-39, 256-bit entropy, 24 words, empty passphrase, account 0, receiving
branch 0 only. Preserve the chain-specific paths; do not invent alternate
paths or index ranges.

| Chain | Path |
| --- | --- |
| BTC | `m/84'/0'/0'/0/i` (native SegWit P2WPKH, `zpub`) |
| ETH and all EVM chains | `m/44'/60'/0'/0/i` (default EVM path, `chains.ts` `EVM_PATH`) |
| TRX | `m/44'/195'/0'/0/i` |
| TON | `m/44'/607'/0'`; generation-only, single address; wallet V4 R2; wallet ID 698983191 |
| SOL | `m/44'/501'/0'` legacy single path; indexed form `m/44'/501'/<account>'/0'` / `m/44'/501'/<account>'/0'/<index>'` (`chains.ts:432-455`) |
| LTC | `m/84'/2'/0'/0/i` |
| DOGE | `m/44'/3'/0'/0/i` |
| Expanded chains | The `derivationTemplate` recorded per chain in `chains-expanded.ts`, generalised with `{account}` and `{index}` placeholders, from Trust Wallet Core registry paths (account-0 path) |

**One phrase, one account, one wallet identity.** Every chain's address
derives from the same 24-word phrase. All EVM chains share one address.
One literal public key across all chains is not how any
standards-compliant wallet works: TON and SOL use Ed25519 while the
others use secp256k1, with different address formats. Show the shared EVM
address once and the one wallet identity clearly; never claim a single
pubkey covers all chains.

### §2.2 Chain data sources (only these)

- Trust Wallet Core registry (168 coins) for derivation paths; Trust
  Wallet Assets pinned at commit
  `e8f61783ac6451fa8b7b1b4f72bf4a9607f6872e`
  (`chains-expanded.ts: TRUST_WALLET_ASSETS_PIN`).
- Chainlist, official chain docs/RPCs, CoinGecko `/coins/list` for the
  expansion cross-checks. Excluded chains are listed in
  `CHAIN-DATA-REPORT.md` — do not re-add an excluded chain without fresh
  evidence meeting the same bar (two sources + live RPC tip).
- Icons: `apps/web/src/assets/chains/` (PNG canonical + 96 px WebP q85),
  wired through `CHAIN_LOGOS` in `apps/web/src/screens/token-logo.tsx`.
  All 84 chains have a real icon; load failure shows only the deliberate
  paper-and-ink link mark, never a yellow ticker square.

### §2.3 RPCs and explorers

Every expanded chain ships at least one RPC verified live on 2026-11-24
(EVM: `eth_chainId` + `eth_blockNumber` + `eth_getBlockByNumber`
freshness sweep; non-EVM: protocol-native status probes) in
`chains-expanded.ts` (`rpcEvidence` per chain). Do not swap in an
unverified RPC. Explorer transaction pages: `explorerTxLive: false`
means the tx page was NOT live-clicked — do not claim it was.

### §2.4 XRP, Stellar, NEAR — already in the registry

The coordinator's first-hand registry check (2026-11-25) found XRP,
Stellar and NEAR already present as derive entries in
`chains-expanded.ts`. They are part of the 84; the OKX SDK adds nothing
for them beyond reference material.

### §2.5 Cardano, Starknet, Kaspa — PENDING Lane B

**Status: PENDING.** These three have zero mentions in `chains.ts` or
`chains-expanded.ts` (verified first-hand 2026-11-25) and are NOT in the
app. The OKX `js-wallet-sdk` (MIT, 20 TS packages, in
`/home/boxd/workspace/wallet-repos/js-wallet-sdk/`) covers address
generation and offline signing for Cardano, Starknet and Kaspa, among
others. The SDK **cannot be bundled as-is**: every coin package pulls
`@okxweb3/crypto-lib` (623 KB unpacked, ~150–250 KB minified est.) plus
`coin-base`, and `coin-cardano` pulls the whole `@cardano-sdk/*` stack.
Lane B must therefore implement these three chains by reference (signing
and address logic studied from the SDK, written into Bawa's own code
under Bawa's own bundle budget), or record that the budget must be
re-baselined by owner order first. **Do not invent derivation paths for
Starknet or Kaspa.** Cardano's reference path is already recorded in
`docs/02-chains/README.md` §2 (CIP-1852 payment `m/1852'/1815'/0'/0/0`,
staking `m/1852'/1815'/0'/2/0`); Starknet and Kaspa paths must come from
the SDK reference or the chain's own standard, cited in the lane's
commit, never guessed. Re-check this section against Lane B's committed
code before claiming any of the three is done.

## §3. HD wallet and engine — fixed pins

- Engine: `tools/hdwallet-gen` pins `@trustwallet/wallet-core` **4.9.3**;
  Node range **>=22 <23**. The 4.9.3 WASM is 10,422,325 bytes, SHA-256
  `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`.
  Verify the hash on every upgrade; never use a version range. The
  prebuild step (`apps/web/scripts/copy-wasm.mjs`, run by `prebuild` /
  `predev` / `build`) copies the pinned WASM into the app; the
  dependency-version check (`scripts/check-pinned-dependencies.js`)
  guards the pin.
- Adopted `apps/web` libraries (ADR-0005): `@scure/bip39` **2.4.0**,
  `decimal.js` **10.6.0**, `dinero.js` **2.0.2**, `mnemonic-words`
  **2.0.0**; `bip39` **3.1.2** as a devDependency used only as a test oracle.
- Python tools: Python **>=3.11**, `cryptography` **50.0.2**,
  `bip-utils` **2.12.3**.
- Verification workflow (from `apps/web`, after `npm ci`):
  `npm run typecheck` (tsc --noEmit, 0 errors), `npm run build`
  (copy-wasm + tsc + vite build, 0 errors), `npm run test` (vitest —
  99 files, 2,799 passed + 5 skipped, verified 2026-11-24,
  `docs/index.md`). Engine smoke suite: 440 checks pass
  (`docs/engine-reproducibility.md`).
- Confirmation policy: BTC 6 confirmations (recommendation, not
  protocol); ETH `finalized`; TRX 19 distinct SRs of 27 via
  `/walletsolidity/*`; TON 1 masterchain seqno after inclusion plus an
  outgoing-message outcome check.
- A successful build and test run prove only their build scope. They do
  not demonstrate transaction handling, mainnet readiness, or a send on
  any network.

## §4. Encrypted local vault and auto-lock — implemented

**Correction to older guide text:** `WALLET_BUILDER.md` and `AGENTS.md`
previously said "Current implementation at 5e7eb1d: no lock exists; the
optional restoration is not yet implemented." That is stale. Auto-lock IS
implemented (owner order 2026-11-20). Implement and describe it as follows.

- Vault: password-protected, AES-GCM-256, PBKDF2 with 600,000 iterations
  (`apps/web/src/wallet/vault.ts:2`). Storage key for the derived key:
  `bawa-vault-key` (`vault.ts:82`, `VAULT_KEY_STORAGE_KEY`).
- Auto-lock is an **optional setting on the /security page, OFF by
  default**: a toggle plus a duration — Immediately / 1 minute / 5 minutes
  / 15 minutes / 1 hour / 1 day (`apps/web/src/wallet/auto-lock.ts`:
  `AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60, 1440]`, `AUTO_LOCK_LABELS`,
  keys `bawa-auto-lock-enabled` / `bawa-auto-lock-minutes`).
- **Key-storage invariant (absolute):** while auto-lock is ON, the raw
  derived key is NOT stored (`bawa-vault-key` must be absent) so the lock
  is real and unlocking needs the password. While auto-lock is OFF, the
  raw derived key IS stored under `bawa-vault-key` so the vault can
  auto-unlock. With auto-lock OFF the vault must never be described as
  locked. Never silently change these settings or boundaries.
- Seed storage on the CLI side: `secrets/` **0700**, `seed.enc.json`
  **0600**, `.env` **0600**; AAD `nova-shop-seed-v1`.
- **Adapter boundary:** chain adapters NEVER receive mnemonics, seeds,
  private keys, xprvs, or vault keys, including in tests.
- **UI boundary:** UI is presentation only — never derivation, storage,
  or signing policy.

## §5. Offline signing — which chains sign, and the broadcast rule

- Offline signing and unsigned-transaction construction exist in the web
  starter (`apps/web/src/wallet/send.ts`); broadcast is disabled (§0.1).
  `send.ts:987` — "Nothing here broadcasts."
- **Sign (local-sign verified): BTC, ETH, TRX.** TON local-sign is
  verified with two blocks: fee-quote is blocked (a TON fee depends on
  the unsigned message, which is Phase 4 work — no fee number is ever
  invented) and post-sign-verify is blocked (the signed BOC is not
  re-parsed; no BOC parser is vendored; verification is no-error +
  32-byte hash + BOC magic only).
- **Solana signs offline via `@solana/web3.js`** (`send.ts:2527-2530`,
  "Solana signing (minimal wire format, Lane C)"): Wallet Core 4.9.3's
  Solana signer returns an `encoded` transaction that is not a valid
  Solana wire transaction, so the app builds and signs with
  `@solana/web3.js` instead. Broadcast stays disabled; native SOL and
  SPL USDC sign offline and verify in the browser.
- **All other chains: local-sign, fee-quote, unsigned-plan and
  post-sign-verify are blocked** — no adapter or send builder exists for
  them yet, and no capability is ever faked. `simulate` is candidate on
  all chains: declared, owned by the send lane in `send.ts`; no
  simulation runs yet, and simulation is a pre-check, never confirmation.
- EVM send builder: generalised EVM signer (chainId 56 for BSC;
  `docs/BSC-SEND-FIX.md`). The Receive/Send QR flow, the 22-button grid
  fix (single "Create wallet" button with a message saying what it is
  and that creating it gives access to 22 chains — the count refers to
  the curated set), and the Scan icon are covered by the finish-product
  programme (`docs/FINISH-PRODUCT-PROGRAMME.md`).

## §6. Token verification by contract address

**Verify by contract address, never by name or symbol.** A fake copycat
with the same name and symbol shows Unverified and never gets the real
logo. A real token shows a verified mark with its real logo and live
price, even down to memecoins. Implementation:
`apps/web/src/wallet/token-verification.ts` (see its header, lines 25-45,
for the full source notes). Add Token works for any token on any chain by
contract address, pulling in icon, ticker and live price.

### §6.1 CoinGecko (first verifier)

CoinGecko contract endpoint first. Only the chains CoinGecko serves are
queried; a token verified here is verified.

### §6.2 Jupiter Strict (Solana)

Jupiter Strict validated-token list for Solana tokens.

### §6.3 1inch (EVM)

The 1inch token list, served address-keyed per chain at
`tokens.1inch.io/v1.2/{chainId}` — one small fetch per chain, no key.
Only the chains 1inch actually serves are queried
(`token-verification.ts:101`).

### §6.4 Uniswap Default

`tokens.uniswap.org`, "Uniswap Labs Default" v22.34.0, 2,176 tokens last
recorded (`token-verification.ts:31`).

### §6.5 PancakeSwap Extended

`tokens.pancakeswap.finance`. The Default list is 13 tokens last recorded
(`token-verification.ts:45`); use the Extended list.

### §6.6 Bitget Agent API — extra verifier — IMPLEMENTED (Lane A) + agent-side deep check (Lane H)

**Status: IMPLEMENTED in the browser leg (Lane A) and verified live;
agent-side deep check added by Lane H, 2026-11-26.** The Bitget Agent
API is a no-key token/security/market API
(`https://copenapi.bgwapi.io`) reached through the MIT
`bitget-wallet-skill` / `bitget-wallet-cli` / `bitget-wallet-mcp`
(Python scripts / MCP server: 21 market tools + smart-money + RWA).
Survey verdict: token info, security audit, dev/rug check, market info,
K-line, holders — an extra token-verification source with **zero bundle
cost** (Python/server-side, never in the browser bundle).

**Browser leg (Lane A, merged).** `apps/web/src/wallet/
token-verification.ts`: `bitgetSignedPost` reproduces the skill's
`_request` signing (BKHmacAuth, unsalted SHA-256 of method + path +
body + timestamp — no secret) with WebCrypto; `bitgetTokenInfoMatches`
requires the exact chain + contract AND a non-empty symbol and name
(a fake answers a zeroed stub); `bitgetSecurityClean` vetoes on a
highRisk audit (a fake answers highRisk false with support 0 — audit
pending — so the audit alone never verifies). **Browser limit,
verified first-hand:** the API's OPTIONS handler demands
X-SIGN/X-TIMESTAMP, which a CORS preflight never carries, so from a
browser the call fails at the preflight and the leg verifies nothing —
it is wired fail-closed and verifies the moment the API allows
browser calls. The leg is therefore NOT the live verification path
today.

**Agent-side leg (Lane H, this programme).** `scripts/
verify-token-bitget.mjs` (Node >= 22, global fetch, zero
dependencies, zero bundle cost) runs the SAME two signed POSTs from
Node, where there is no preflight, and adds the deep fields the
browser leg does not use: top-10 / insider / sniper / dev holder
percents, dev rug percent + counts, LP lock percent, from the
`batchGetBaseInfo` entry. Thresholds are the skill docs' own
(`bitget-wallet-skill/docs/market-data.md`): dev_rug_percent > 20%
red flag; sniper_holder_percent > 10% warning; top10 > 50%
concentration risk; trade tax >= 50% risk, >= 10% warn. Verdicts:
VERIFIED / VERIFIED-WITH-WARNINGS / HIGH-RISK / UNVERIFIED, exit 0
for verified, 1 otherwise, 2 for usage errors. Tests:
`scripts/verify-token-bitget.test.mjs` (plain node:test, mocked
fetch, 9 tests). **Live verification, 2026-11-26, loud-stone:**
USDC (eth) VERIFIED, exit 0 (price 1.001, holders 9,272,568,
top-10 22.5%); PEPE (eth) VERIFIED, exit 0; fake contract
`0x0000…0001` UNVERIFIED, exit 1 (zeroed stub, no symbol/name).
Two live findings recorded in the script: (1) the API sits behind
Cloudflare and returns 403 "error code: 1010" for a bare
Python-urllib User-Agent — Node's fetch and python-requests
User-Agents answer 200; the script sets an explicit User-Agent.
(2) The "percent" fields arrive as FRACTIONS (USDC top-10 0.2248,
PEPE 0.3807), so the script normalises (0, 1] x100 to the docs'
0–100 scale before comparing; the dev_rug_percent scale has no live
non-zero sample and is normalised like its sibling fields — that
inference is stated in the code, not hidden. Usage:
`node scripts/verify-token-bitget.mjs --chain eth --contract 0x...`.
Swap/transfer scripts in those repos are reference only: Bawa
forbids mainnet broadcast (§0.1). The TS SDK
`@bitget-wallet/api` (`tob-api-sdk-ts`) is NOT the route: it needs an API
key + HMAC secret (never in the browser — backend proxy only, which Bawa
has none) and its dist JS is 182,504 B unminified (~34× the headroom).

### §6.7 What is deliberately NOT a verifier

Raydium and DexScreener are deliberately NOT verifiers: any token with a
pool is listable there. DexScreener is a price fallback only (§7).

## §7. Prices — CoinGecko first, never CoinGecko only

Owner order 2026-11-23: "do NOT depend completely on CoinGecko — find
alternatives too." Price stack (`apps/web/src/wallet/prices.ts`,
`price-fallbacks.ts`, ADR-0007 `docs/adr/0007-price-feed-provider.md`):

1. **CoinGecko first** — `usePrices()` fetches its batched
   `/simple/price` call first; only chains whose quote is NOT fresh reach
   the fallbacks (`applyPriceFallbacks`).
2. **CoinLore** (`api.coinlore.net/api/ticker/?id=...`) — one batched call
   for every mapped chain, keyless, CORS open. Verified quotes track
   CoinGecko within 0.7%. Excluded from the map: CoinLore TON and MATIC
   (stale legacy quotes), LTC and FTM (not listed). Mantle MNT, Gnosis
   xDAI (via DAI, 1:1 bridge), and Fantom FTM (via Sonic S, 1:1 upgrade)
   mappings are recorded in the file header — read them before touching
   the map.
3. **DexScreener** (`tokens/v1/<chain>/<wrapped>`) — on-chain price of
   the wrapped native, one call per chain. Quote-side only: the implied
   price `priceUsd / priceNative` — NOT `priceUsd` itself, which is the
   base token's price (the trap documented in `dex-prices.ts`).
4. **TonAPI rates for TON, Coinbase Exchange ticker for LTC** — the two
   chains CoinLore cannot cover.
5. **Rejected live, do not re-add without fresh evidence:** Binance
   (geo-blocked 451; `.us` quotes a frozen pre-delisting FTM ~16× too
   high), CoinPaprika (frozen FTM quote; free tier is personal-use only),
   CoinCodex (returns `not_trading_anymore`), Kraken (no CORS header).
6. The row label shows the quote's real source, never a hardcoded
   provider. A chain no source prices stays on its CoinGecko entry —
   expired, error, or unavailable — never a guessed price.

### §7.1 okx-cex-market — keyless second price source, agent skill only

**This is an agent skill. It does NOT go in the Bawa app. Record it as
such and never bundle it.**

- Skill: `okx-cex-market`, MIT v1.5.2, installed at
  `custom-skills/okx-cex-market/` (SKILL.md + 5 reference files + shared
  `_shared/preflight.md`). Source: OKX `agent-skills` repo
  (`/home/boxd/workspace/wallet-repos/agent-skills/`).
- What it does: public OKX CEX prices, tickers, order books, candles,
  funding, open interest, 70+ indicators — **read-only, no API
  credentials**. Runtime needs only the `okx` CLI binary
  (`npm install -g @okx_ai/okx-trade-cli`; verify with
  `okx market ticker BTC-USDT`).
- Use it when an agent needs a second price source to cross-check
  CoinGecko: `okx market ticker <instId>`, `okx market tickers`,
  `okx market orderbook`, `okx market candles`, `okx market funding-rate`,
  `okx market open-interest`, `okx market indicator <name> <instId>`,
  `okx market filter` (screener). Add `--json` for the raw OKX API v5
  response.
- Do NOT use it for account balances/positions (`okx-cex-portfolio`,
  not installed), placing/cancelling orders (`okx-cex-trade`, not
  installed), or bots (`okx-cex-bot`, not installed). Its siblings were
  NOT installed because every one requires API credentials / a CEX
  account.
- **Not verified first-hand:** end-to-end behaviour needs the `okx` CLI
  binary at runtime; the first live run will confirm it.
- `okx-dex-market` (onchainos) is NOT a verified alternative: its
  keyless operation could not be verified without running OKX's
  installer — do not assume it works without an OKX account.

## §8. QR cards — four templates, PNG parity

Implementation: `apps/web/src/screens/qr-card.tsx`,
`apps/web/src/wallet/payment-links.ts` (from line 700),
`apps/web/src/screens/receive.tsx`. Design record: `docs/DECISIONS.md`
§24 (line 1987).

- **Four templates, original Bawa designs** informed by Bitget/OKX
  patterns only — no competitor logo, colour-as-brand, cyan arrow, or
  "Deposit from Bitget Exchange" link is copied; the brand bar is Bawa's
  own wordmark. `QR_CARD_TEMPLATES` (`payment-links.ts:719-735`):
  A "Dark Teal" (showcase variant, closest to the Bitget bar), B "Paper"
  (default — Bawa's own drawing system, respaced), C "Minimal" (plain
  and quiet, the fallback), D "Poster" (bold, for sharing).
  Default: `DEFAULT_QR_CARD_TEMPLATE = 'b'`.
- **Template picker:** Receive screen, "Card style — tap to switch",
  all four templates, `aria-pressed`, active `bg-sun`, driving both the
  in-app card and the PNG.
- **PNG parity (the rule):** the shared/downloaded PNG must be the same
  card in the picked template. Geometry: every template is laid out in
  390 px design units and scaled by `width/390`, so the 640 px export
  and the 1080 px export are the same card at two sizes — never a
  reflowed one. Layout is measured first, then drawn, on the same
  numbers. Heights are computed from the wrapped subtitle and address,
  so a long non-EVM address grows the card instead of clipping.
  QR code per template (`QR_CARD_TEMPLATE_QR`): A 218 px white on
  `#011F29`, B 200 px, C 216 px, D 210 px; centre-logo caps A 13%,
  B 22%, C 15%, D 20% of the code. Footer on every card:
  "Share the card, keep the keys." Template C adds
  "Scan or share this QR code to receive crypto."
- **Template A centre mark:** the logo is redrawn as a white silhouette
  (pixels brighter than luminance 160 go transparent, then a `source-in`
  white fill) in both the PNG exporter (`buildWhiteSilhouette`) and the
  in-app hook (`useDiscLogoImage`). A plain white fill keeps the whole
  disc; a light glyph degrades to no mark rather than a white circle.
  Template A deliberately has NO white ring in place of the
  bottom-right alignment pattern — the ring alone breaks the repo's own
  jsQR decoder.
- **Known accepted parity gap:** in-app the card is 322 px wide (locked
  `Card padding="sm"` + content column), so template A's footer address
  wraps to 3 lines at 390 px (PNG: 2 lines) and B's address box to 2
  lines (PNG: 1). The full address is shown in-app, nothing truncated
  or overlapping; the shared PNG is exactly per spec. Do not "fix" this
  by shrinking the address font below design size or widening the card
  past the locked layout.
- **Palette:** the ten `--qr-*` tokens (§0.3) are used ONLY by the QR
  card and its PNG exporter. E2E: `e2e/qr-card-templates.spec.ts`
  (every template shares a PNG decoding to the payment URI; viewports
  390/820/1440/1919) and `e2e/png-decode.ts`.
- **No QR/share-card code exists in the Bitget or OKX orgs** (survey):
  the only QR file found is a deprecated WalletConnect v1 QR modal in a
  demo. The four templates are Bawa-original; there is nothing to import.

## §9. Watch-only — mainnet-only

- Watch-only is **mainnet-only** by owner decision (2026-11-23). Devnet
  is not threaded through watch-only, and devnet mode (§10) does not
  change watch-only behaviour.
- One watch-only address must detect balances from all its chains in
  real time. Implementation: `apps/web/src/wallet/watch-only-families.ts`
  and the hydration path in `state/wallet-context.tsx`, which iterates
  `ALL_CHAIN_IDS` (the 2026-11-22 fix for hydration covering only 4 of
  13 chains — a stored watch-only wallet for SOL was persisted but
  dropped on every reload).
- Public data only: no secret intake, no signing. BTC/ETH/TRX via xpub
  deposit derivation (`tools/hdwallet-gen/derive.js`); TON via 64-hex
  Ed25519 public key to one Wallet V4 R2 address, workchain 0, wallet ID
  698983191 (`tools/hdwallet-gen/derive-ton.js`) — no TON xpub, no index.
- Monitoring support still requires evidence; do not claim a monitoring
  UI is verified until it is.

## §10. Devnet mode — temporary, exception E1, expires 2027-02-20

- Devnet mode is a **temporary, test-only switch** (owner order
  2026-11-22), clearly marked, removable without touching mainnet, and
  **never merged** into mainnet behaviour. Implementation:
  `apps/web/src/wallet/devnet.ts` (`DEVNET_ENABLED_KEY =
  'bawa-devnet-enabled'`), `apps/web/src/wallet/devnet-endpoints.ts`.
- It exists to test send and receive on every chain with valueless test
  tokens and report per chain with transaction hashes. The owner extended
  it to cover ALL tokens, not just the four main chains. The picker offers
  only devnet chains in devnet mode (`docs/DEVNET-SEND-CRASH-FIX.md`).
- **Exception E1** (`CONSTRAINTS.md`, owner 2026-11-22, **expires
  2027-02-20**): carves the devnet-only broadcast path out of the "no
  broadcast path" floor. Mainnet broadcast still throws unconditionally.
  If devnet is still needed after 2027-02-20, the owner must renew it.
  Recorded in `docs/DECISIONS.md:399-410` and `:685`, `:770`.
- `AGENTS.md` §8 ("No broadcast path was built or enabled") is read with
  E1: the DoD line states the mainnet rule; E1 is the recorded, expiring
  devnet-only exception. Do not edit the DoD line to weaken it.

## §11. WalletConnect — PENDING Lane C

**Status: PENDING.** No WalletConnect code exists in Bawa today. The
survey's verified facts, which Lane C must implement from:

- **Pin 2.21.0 — the last Apache-2.0 release.** The WalletConnect JS
  SDK is no longer Apache-2.0: 2.22.0+ switched to Reown Inc.'s custom
  WalletConnect Community License Agreement (20 Aug 2025). Key terms:
  §2(b) all use must connect to Reown's proprietary gateway unless
  explicitly approved otherwise; §3 commercial licence above 500 MAU/month
  or 2.5M RPC/month; §1(c) Reown owns all modifications/derivative works
  of the SDK; §10 binding arbitration, Delaware law. Bawa does not accept
  those terms by default. **Do not install 2.22.0 or later without an
  owner decision recorded in `docs/DECISIONS.md`.**
- **Lazy-load only, as a separate chunk.** Measured, not estimated:
  minimal `import { SignClient }`, esbuild bundle + minify: **2.21.0 =
  396,013 B minified / 121,377 B gzip** (~75× the headroom); 2.26.0 =
  455,831 B / 137,742 B gzip. It cannot go in the main bundle under the
  4,185,000-byte budget (§0.2). Load it by dynamic import, only when the
  user opens the WalletConnect flow.
- **A WalletConnect Cloud projectId is required** for sign-client. Bawa
  has none. Obtaining one is an owner step; never invent or hardcode one.
- **Wallet-side API only.** The verified wallet-side surface is
  `approve` / `reject` / `respond` and session authenticate
  (in `walletconnect-monorepo`, `/home/boxd/workspace/wallet-repos/
  walletconnect-monorepo/`). Bawa IS a wallet: dApp-side libraries are
  the wrong side. **ConnectKit is dApp-side** ("a React component library
  for connecting a wallet to your dApp", BSD-2-Clause) — not usable for
  Bawa, not installed. `web3modal`/AppKit is dApp-side under the Reown
  licence — same exclusion.
- **Android route (alternative, not this lane):** `WalletConnectKotlinV2`
  (Apache-2.0, `com.walletconnect:web3wallet`) — the Android-first option,
  where the web bundle budget does not apply. Owner decision (a)–(d) in
  the survey: accept Reown + gateway + projectId and lazy-load; pin
  2.21.0 and accept no further updates; defer until re-baseline; or ship
  Android-first via Kotlin.
- **Android route, verified by Lane H (2026-11-26, mining pass).**
  The Kotlin SDK is live on Maven Central:
  `com.walletconnect:web3wallet`, latest **1.35.2** (verified from
  loud-stone against `repo1.maven.org/maven2/com/walletconnect/
  web3wallet/maven-metadata.xml`). Licence Apache-2.0 (LICENSE file in
  `/home/boxd/workspace/wallet-repos/WalletConnectKotlinV2/`). The
  wallet-side surface is verified in the clone: `Web3Wallet`
  delegate `onSessionProposal` and `approveSession(params, onSuccess,
  onError)` (`product/web3wallet/src/main/kotlin/com/walletconnect/
  web3/wallet/client/Web3Wallet.kt`) — note `approveSession` is marked
  for replacement by `WalletKit.approveSession`; use the WalletKit
  name in new code. The repo ships a BOM; the sample uses
  `implementation("com.walletconnect:web3wallet")` through it. **Not
  added to `apps/android/app/build.gradle.kts` by Lane H:** the
  Android app is watch-only and testnet-only with no signing path
  (`apps/android/app/build.gradle.kts` header), so WalletConnect is a
  future feature needing a scope decision first, and there is no
  Android SDK or JDK on loud-stone to build-verify the dependency.
  A WalletConnect Cloud projectId is still required (owner step;
  never invent or hardcode one).
- Re-check this section against Lane C's committed code.

## §12. Coinbase Onramp Buy — PENDING Lane D

**Status: PENDING.** No onramp code exists in Bawa today. The survey's
verified facts, which Lane D must implement from:

- **SDK:** `@coinbase/cbpay-js` **2.4.0**, MIT, zero dependencies, from
  `cbpay-js` (`/home/boxd/workspace/wallet-repos/cbpay-js/`). It lets
  users top up a self-custody wallet with fiat — the only Coinbase repo
  aimed at self-custody wallets as the destination.
- **Lazy-load only.** Measured via Bundlephobia: **7,473 B minified /
  2,841 B gzip** — 7,473 B alone exceeds the ~5,304 B headroom at survey
  time (1.4× over). It cannot be bundled eagerly; load it by dynamic
  import on the Buy screen only, or re-baseline the budget by owner
  order first. The Bundlephobia figure is not a build inside Bawa's Vite
  bundle — Lane D must measure the real cost in Bawa's build and record it.
- **Requires Coinbase Onramp onboarding + API keys.** Bawa has no
  Coinbase account. Onboarding and keys are owner steps; never invent
  credentials. This is a new "Buy" feature, not a core need.
- **Wrong-side exclusion:** `coinbase-wallet-sdk` and
  `wallet-mobile-sdk` let dApps connect *to* Coinbase Wallet — Bawa *is*
  a wallet, so they do not apply. `onchainkit` is deprecated ("do not use
  them for new projects"). Nothing in the Coinbase org is a self-custodial
  HD-wallet library, BIP-39/32 code, or a QR/share component.
- Re-check this section against Lane D's committed code.

## §13. Shamir backup shares — PENDING Lane E

**Status: PENDING.** No Shamir code exists in Bawa today. The survey's
verified facts, which Lane E must implement from:

- **Library:** `shamir-secret-sharing` (Privy org), Apache-2.0
  (verified three ways: API, LICENSE file, npm), zero-dependency
  TypeScript, GF(2^8), `Uint8Array`, Node + browser, `split` /
  `combine`. Source: `/home/boxd/workspace/wallet-repos/
  shamir-secret-sharing/`.
- **What to split:** the vault's AES-GCM key (or raw seed entropy) into
  N-of-M shares (for example 2-of-3). **Do NOT split raw mnemonic words**
  — they are not uniformly random. **Encrypt first, split the key.**
- **`combine` does NOT verify reconstruction integrity.** Bawa must
  trial-decrypt the vault after combining and error clearly on bad
  shares. Never silently accept a bad reconstruction.
- **Shares are raw bytes, not words.** This is NOT SLIP-39 (shares are
  raw bytes, incompatible with SLIP-39 word-shares). Bawa must add
  user-facing encoding (base64 and/or QR) for the shares.
- **Lazy-load only, or re-baseline.** Cost is an **estimate only,
  ~5–8 KB minified (~2–3 KB gzip), not build-measured** — even this small
  library would likely exceed the headroom if bundled eagerly. Load it by
  dynamic import on the backup screen only, or re-baseline by owner
  order. Lane E must measure the real cost in Bawa's build.
- **Custody boundary:** Privy's model is the opposite of Bawa's
  self-custody — Privy embedded wallets route key material through
  Privy's infrastructure (TEE/HSM) with a Privy App ID/secret. Adopting
  any Privy SDK would be a redesign, not an integration. Only the
  standalone Shamir library is in scope; no Privy service, App ID, or
  dashboard account is used.
- Re-check this section against Lane E's committed code.

## §14. ERC-7730 clear signing — PENDING Lane F

**Status: PENDING.** Bawa has no clear-signing feature today. The
survey's verified facts, which Lane F must implement from:

- **Data:** `clear-signing-erc7730-registry` (okxlabs), **CC0 1.0**,
  ERC-7730 clear-signing metadata (JSON) for human-readable EVM
  contract-call / message display. Source:
  `/home/boxd/workspace/wallet-repos/clear-signing-erc7730-registry/`.
  Zero bundle cost as JSON data.
- **Purpose:** show the user, in plain language, what an EVM
  contract call or signed message actually does — before they approve it.
  This is a signing-safety feature, not a new signing method.
- **Upstream preference:** the okxlabs copy is a fork — **prefer the
  upstream ERC-7730 registry as canonical if ever adopted**. Record
  which registry (upstream or fork) and which commit/pin is vendored.
- **Related dev tool (not shipped):** `sonar` (okxlabs, MIT, Rust CLI)
  for local Solana transaction simulation (LiteSVM), transaction parsing,
  and PDA derivation — a dev tool for verifying Solana behaviour
  off-device, never shipped in the app. **Lane H note (2026-11-26):**
  licence re-verified first-hand (LICENSE: "The MIT License (MIT)",
  Copyright (c) 2022-2026 OKX labs). Concrete use for Bawa: simulate
  a Solana send construction locally before it is ever signed —
  `sonar simulate <BASE58_OR_BASE64_TX> --rpc-url
  https://api.mainnet-beta.solana.com`, or synthesise from instruction
  specs (`sonar simulate --payer <PUBKEY> --ix 'program=... data=...'`).
  Simulation is a pre-check, never confirmation (§5), and `sonar send`
  must never be used on mainnet — broadcast stays disabled (§0.1).
  **Not build-verified:** there is no cargo/rustc on loud-stone, so
  the release build (`cargo build --release`) has not been run here;
  the first build is a follow-up on a machine with a Rust toolchain.
- Re-check this section against Lane F's committed code.

## §15. UI contract

- Follow Doc 14 §5.1's **14-screen contract**. **Review is a Send state;
  Lock is an app state**, not extra screens. Required states: **loading,
  empty, stale, locked, gate-failed, error**.
- Default visual direction: **Bawa Balanced**. Web foundation: **token-ui**
  (`consenlabs/token-ui`), **MIT**, vendored in `apps/web/src/ui/`.
  Android foundation: **Tether WDK Starter Kotlin**, **UI layer only**,
  **Apache-2.0**, in `apps/android`.
- Four-colour cap (§0.3) governs the whole app; the `--qr-*` exception
  is confined to the QR card and its PNG exporter.
- Dead controls in a state where they cannot act are defects: show zero
  where there is no wallet and no amount — never a Retry button with
  nothing to retry. Keep the shop's filter rail in a restyle; restructure
  around it.
- Owner-approved foundations are not proof of integration — the adoption
  evidence is the starter builds, tests, and preview checks.
- A first preview must use the REAL site's assets with only the
  prescribed changes applied, never wireframe-grade placeholders; verify
  design passes visually before reporting.

## §16. Verify and report honestly

- Use exactly the evidence labels in `AGENTS.md` §5. For each scoped
  claim, populate an evidence table: Claim / scope | Evidence label |
  Revision / network | Actual command or artifact and observed result |
  PASS / FAIL / NOT-RUN | Mock / limitation / next gate.
- **PASS** only for a performed check with supporting evidence. **FAIL**
  for a performed check that failed. **NOT-RUN** for anything not
  performed, including blocked checks. **NOT-RUN is never a pass.** Test
  counts and file presence are not proof that tests passed.
- Gates in the repo: `npm run typecheck`, `npm run build`,
  `npm run test` (apps/web); `scripts/quality-gates.mjs`; the bundle-size
  gate (CI); the link check over changed docs (see §17 method).
- Report changed files, demonstrated behaviour, mocked behaviour, and
  unresolved work separately. Redact secrets; missing evidence is OPEN.
- **Fix-review rule:** present the fix and its rationale first; apply
  only on the owner's go-ahead. Nothing is pushed on the strength of a
  guide file alone.

## §17. Section-by-section trace — how this spec was checked

Method (2026-11-25, Lane G, hands-on, 0 Sol calls): for each section, the
claim was traced to the file:line in the `usable-lane-g-guide` worktree
(base `7fea3e4`) or to the wallet-org survey, and the older guide text was
compared. Where the older guide was wrong, it was fixed in place in the
same lane (see the commit). Where a Part A lane had not committed, the
section is marked PENDING with the reason.

| Spec section | Traced to (file:line or survey) | Older guide state | Verdict |
| --- | --- | --- | --- |
| §0.1 broadcast disabled | `apps/web/src/wallet/send.ts:65-66`, `:987` | Correct in `AGENTS.md` §4/§8, `WALLET_BUILDER.md` | Verified |
| §0.2 bundle 4,185,000 | `CONSTRAINTS.md:40` | Correct; `WALLET_BUILDER.md` §"Fixed engine" already cites it | Verified |
| §0.3 4-colour cap + `--qr-*` | `docs/DECISIONS.md` §24 (`:1987`), palette exception `:2015` | Correct in DECISIONS §24; now stated in this spec | Verified |
| §0.4 no fake data | `apps/web/src/wallet/price-fallbacks.ts` header; `chains.ts` `availableFor` | Correct | Verified |
| §1 profiles (8) | `registry/profiles.json`; `WALLET_BUILDER.md` | `multichain-extended-wallet` 13-chain registry scope vs 84-chain app — noted as OPEN, not silently widened | Fixed (note added) |
| §2 84 chains | `apps/web/src/wallet/chains.ts`; `chains-expanded.ts:116`, `:1792` (`EXPANDED_CHAIN_COUNT = 62`); `docs/EXPANSION-PROGRAMME.md` | `WALLET_BUILDER.md` said "Chains: 13" and its generated table covered only 22; `docs/02-chains/README.md` §2 said SOL reference-only | Fixed in place |
| §2.1 derivation paths | `chains.ts:403-455` (EVM_PATH, SOL/TON); `WALLET_BUILDER.md` policy table | Correct; SOL indexed form added from code | Verified |
| §2.2 icons / assets pin | `chains-expanded.ts` header; `TRUST_WALLET_ASSETS_PIN` | Correct | Verified |
| §2.3 RPCs verified live | `chains-expanded.ts` header (`rpcEvidence`) | Correct | Verified |
| §2.4 XRP/Stellar/NEAR | Coordinator first-hand registry check, 2026-11-25 (survey) | Not previously recorded in the guide | Added |
| §2.5 Cardano/Starknet/Kaspa | Zero mentions in `chains.ts` / `chains-expanded.ts` (grep, 2026-11-25); survey OKX section | `docs/02-chains` §2 called Cardano reference-only with the CIP-1852 path (kept); the three are absent from the app | PENDING Lane B |
| §3 engine pins | `WALLET_BUILDER.md` "Verified 4.9.3 workflow"; `apps/web/package.json` pin | Test counts stale (40 files / 460 tests, 2026-11-20); engine smoke 217 stale | Fixed in place (99 files / 2,799 + 5 skipped, 2026-11-24; smoke 440) |
| §4 vault + auto-lock | `apps/web/src/wallet/vault.ts:2`, `:82`; `auto-lock.ts:21-26` | `WALLET_BUILDER.md` + `AGENTS.md` said "no lock exists" (5e7eb1d) | Fixed in place |
| §5 offline signing | `apps/web/src/wallet/send.ts:2527-2530` (Solana); capability table in `WALLET_BUILDER.md` | Correct; SOL `@solana/web3.js` route added from code | Verified |
| §6 token verification | `apps/web/src/wallet/token-verification.ts:25-45`, `:101` | Correct in code; `docs/TOKEN-VERIFY-PROGRAMME.md` records the programme | Verified |
| §6.6 Bitget Agent API | Survey Bitget section; `https://copenapi.bgwapi.io` (live answers NOT verified) | Not in the guide before | PENDING Lane A |
| §6.6 Bitget Agent API (Lane H) | `token-verification.ts` (Lane A browser leg, read first-hand); `scripts/verify-token-bitget.mjs` + test (9 tests); live USDC/PEPE VERIFIED, fake UNVERIFIED, 2026-11-26 | Browser leg wired but fail-closed at the CORS preflight; no agent-side form existed | Implemented (agent-side) + browser leg recorded |
| §11 WalletConnect (Lane H) | `repo1.maven.org/.../com/walletconnect/web3wallet/maven-metadata.xml` (1.35.2, live); `Web3Wallet.kt` `approveSession`; Apache-2.0 LICENSE | Android route named but unversioned | Added (Android record only; no Gradle change — no SDK on loud-stone, app has no signing path) |
| §7 prices + fallbacks | `apps/web/src/wallet/price-fallbacks.ts` header; `dex-prices.ts` trap note | Correct | Verified |
| §7.1 okx-cex-market skill | `custom-skills/okx-cex-market/okx-cex-market/SKILL.md` (MIT v1.5.2; `okx` CLI binary required) | Not in the guide before | Added (agent skill only) |
| §8 QR cards | `apps/web/src/screens/qr-card.tsx:336`; `payment-links.ts:700-760`; `docs/DECISIONS.md` §24 | Correct in DECISIONS §24; now a single spec section | Verified |
| §9 watch-only mainnet-only | Owner decision 2026-11-23 (standing record); `apps/web/src/wallet/watch-only-families.ts`; `state/wallet-context.tsx` `ALL_CHAIN_IDS` hydration fix | `docs/05-watch-only/README.md` predates the 84-chain hydration fix | Verified; §9 states the fix |
| §10 devnet / E1 | `apps/web/src/wallet/devnet.ts:30`; `docs/DECISIONS.md:399-410`; `CONSTRAINTS.md` E1 | Correct; E1 expiry 2027-02-20 stated | Verified |
| §11 WalletConnect | Survey WalletConnect section (2.21.0 = 396,013 B minified, measured) | Not in the guide before | PENDING Lane C |
| §12 Coinbase Onramp | Survey Coinbase section (`@coinbase/cbpay-js@2.4.0`, 7,473 B minified, Bundlephobia) | Not in the guide before | PENDING Lane D |
| §13 Shamir | Survey Privy section (Apache-2.0, ~5–8 KB est., not build-measured) | Not in the guide before | PENDING Lane E |
| §14 ERC-7730 | Survey OKX/okxlabs section (CC0 1.0, fork — prefer upstream) | Not in the guide before | PENDING Lane F |
| §14 sonar (Lane H) | `sonar/LICENSE` (MIT, OKX labs 2022-2026); README simulate commands | Mentioned only as "dev tool" | Added (concrete use; build NOT verified — no cargo on loud-stone) |
| §18 Lane H mining | Wallet-repos survey + agent-repos dirs (sandbox, read-only) + FEC skills (MIT) | Not in the guide before | Added |
| §15 UI contract | `WALLET_BUILDER.md` "UI foundations and contract"; Doc 14 §5.1 | Correct | Verified |
| §16 verify/report | `AGENTS.md` §5/§6 | Correct | Verified |

**Not verified first-hand in this lane:** the Part A lanes' live
behaviour (no code committed yet — see the status table); the Bitget
Agent API's live answers; `okx-cex-market` end-to-end behaviour (needs
the `okx` CLI binary); exact minified costs of the OKX coin packages and
of Shamir (estimates, not builds); `cbpay-js` cost inside Bawa's Vite
bundle (Bundlephobia figure only); WalletConnect cost inside Bawa's
production bundle (standalone esbuild measurement only). Each is marked
where it is used above.

**Not verified first-hand in this lane:** the Part A lanes' live
behaviour (no code committed yet — see the status table); the Bitget
Agent API's live answers; `okx-cex-market` end-to-end behaviour (needs
the `okx` CLI binary); exact minified costs of the OKX coin packages and
of Shamir (estimates, not builds); `cbpay-js` cost inside Bawa's Vite
bundle (Bundlephobia figure only); WalletConnect cost inside Bawa's
production bundle (standalone esbuild measurement only). Each is marked
where it is used above.

## §18. Lane H mining record — "install all usable", 2026-11-26

**Method (Lane H, hands-on, 0 Sol calls).** Base `usable-install`
`637c139` (Part A Lanes A, C, D, E, F merged). Three sources, in
order: (1) wallet-repos (`/home/boxd/workspace/wallet-repos/`,
survey `~/workspace/wallet-repos/SURVEY.md`); (2) agent-repos
(`~/workspace/agent-repos/` in the sandbox — **not on loud-stone**,
and its SURVEY.md never appeared while this lane worked, so the
directories were mined directly, read-only; the installing
coordinator was not disturbed, nothing was installed twice);
(3) skills library (`/home/boxd/workspace/custom-skills/`, 1,906
entries, plus the Front-End-Checklist skill corpus inside
agent-repos, which loud-stone's custom-skills does NOT carry).
Licence checked first for every find; no verbatim copying without a
licence check. Bundle budget in this base is 4,185,000 total JS
(`CONSTRAINTS.md:40`, CI `ci.yml:193`); the 4,215,000 re-baseline
lives on token-gaps only and is NOT in this base — Lane H measured
against 4,185,000 and re-baselined nothing.

### §18.1 Finds applied

| Find | Licence | Useful for | Applied in code | Applied in guide |
| --- | --- | --- | --- | --- |
| Bitget Agent API, agent-side deep check (token-info + security audit + dev/rug + holder concentration) | MIT (`bitget-wallet-skill`) | Wallet: the browser leg cannot fire (CORS preflight); the same calls work from Node, so a dev/CI token check is the useful form | `scripts/verify-token-bitget.mjs` + `scripts/verify-token-bitget.test.mjs` (9 tests); live: USDC VERIFIED, PEPE VERIFIED, fake UNVERIFIED | §6.6 |
| WalletConnect Kotlin SDK, Android route | Apache-2.0 | Wallet (Android): dApp connectivity where the web bundle budget does not apply | Not added to `apps/android/app/build.gradle.kts` — the app is watch-only/testnet-only with no signing path, and no Android SDK/JDK exists on loud-stone to build-verify it | §11 (coordinates `com.walletconnect:web3wallet` 1.35.2, Maven-verified; `approveSession` / WalletKit note; projectId still an owner step) |
| OKX sonar, Solana tx simulation | MIT | Wallet (dev tooling): simulate a Solana send construction locally before signing; never shipped | None — no cargo on loud-stone, build not run | §14 (commands + `sonar send` never on mainnet) |
| Front-End-Checklist `touch-targets` | MIT | Wallet: touch-target floor for the web app | Audit only, no code change: class audit finds no interactive element below 24 px (default 40, sm 32, xs 28 — xs unused, icon-sm 32); WCAG 2.2 AA 24 px floor passes. The 44 px AAA gap is the known, owner-saved-layout state — restyling it is an owner decision, not a lane fix | This section |
| Front-End-Checklist `performance-budget` | MIT | Guide + wallet: budgets enforced in CI | Verified, no code change: the bundle-size gate IS the budget (CI `ci.yml:193`, total + largest chunk). Lighthouse CI and production RUM are not wired — flagged, not added | This section |
| Front-End-Checklist `code-splitting` | MIT | Wallet: heavy Part A modules behind dynamic import | Verified in the built `dist/`: WalletConnect and Shamir ship as separate lazy chunks, not in the main chunk (see the lane's bundle measurement) | This section |
| Front-End-Checklist `leaked-secrets` | MIT | Wallet: secret hygiene | Ran `node scripts/secret-scan.mjs` on the worktree: exit 0, no findings. The new script carries no secrets or keys | This section |
| Front-End-Checklist `token-storage-security` | MIT | Wallet: vault-key storage | Verified in code, no change: the skill's httpOnly-cookie prescription does not apply — Bawa has no server and no session tokens. The mitigation is the auto-lock key-storage invariant (§4): the derived key is stored under `bawa-vault-key` only while auto-lock is OFF, never while it is ON | This section |
| `planning-with-files` (three-file method) + `ponytail` (lazy senior dev) | MIT, MIT | Guide: agent-workflow method for the AI Wallet Builder | None in the app | Recorded here as the standing method this lane followed: user-owned plan/design files agents never edit, findings + progress in files, smallest complete change, fix in place, one small test for non-trivial logic. Bawa already works this way (lane files, PROGRAMME.md); these two sources name the discipline, they do not change it |

### §18.2 Finds read and rejected (with reason)

| Find | Licence | Reason rejected |
| --- | --- | --- |
| `okx-dex-market` (onchainos-skills) as a CoinGecko alternative | MIT | Keyless operation could not be verified — its preflight routes through OKX's installer/account flow. Do not assume it works without an OKX account (same verdict as §7.1). |
| Multi-AI-Workflow (multi-model orchestration: Claude + Codex + Gemini) | MIT | Conflicts with the standing Astra-only / Sol-only model rule for Bawa. Not adopted. |
| `yn`, Firecrawl | AGPL-3.0, AGPL-3.0 | Copyleft: no code copied into Bawa. Firecrawl noted only as a possible self-hosted research tool (needs API key / self-host); not adopted. |
| Wanwu (multi-agent platform), QwenPaw (Qwen desktop agent app) | Apache-2.0, Apache-2.0 | Heavy agent platforms / a different product, not wallet inputs. No Bawa application. |
| DeepSeek Harness | MIT | Developer preview with stated compatibility-breaking changes. Not pinned for the guide. |
| ECC (agent harness conventions: coding-style, git-workflow, TDD, patterns) | MIT | Reference only. Bawa already has its own conventions (`AGENTS.md`); nothing imported. |
| `agent-skills` (90 single-word agents) | MIT | Name-scanned only; no agent read in depth and none applied this lane. A deeper pass may find a review/security agent worth adopting — OPEN, not claimed. |
| Bitget `bitget-wallet-developer-skill` / `bitget-wallet-partner-skill` | MIT (subdirs only for developer-skill; root has no LICENSE) | Reference only. Developer-skill teaches DApps to connect *to* Bitget Wallet (direction inverted); partner-skill needs a partner key + IP whitelist. Nothing applied. |
| OKX `go-wallet-sdk` | MIT | Go signing SDK; cannot run in the TS web app. Reference only (Lane B owns the chain-reference work). |
| Coinbase / Privy / WalletConnect JS beyond Part A | As surveyed | Already covered by Part A (§11–§13) or excluded in the survey (wrong side, custodial, key-gated). Nothing further. |

### §18.3 Skills actually read (Lane H)

From the Front-End-Checklist corpus (MIT, in agent-repos):
`touch-targets`, `performance-budget`, `code-splitting`,
`leaked-secrets`, `token-storage-security` (SKILL.md files read in
full; `color-contrast` NOT re-read — the redesign programme already
ran contrast first-hand, and re-claiming it would be double-counting).
From agent-repos: `planning-with-files` AGENTS.md (three-file
method), `ponytail` AGENTS.md (lazy senior dev). From
loud-stone custom-skills: the library was name-scanned (1,906
entries); no additional SKILL.md was read in full beyond the two
above, which live in agent-repos, not in custom-skills. The
`cdp-visual-verification` skill (already the standing CDP method)
was NOT re-read: Lane H changed nothing user-visible, so no CDP
run was needed.

### §18.4 Known discrepancies for the coordinator's re-check pass

- **QR templates:** §8 says four templates (A–D). The redesign
  added templates E/F/G on token-gaps; this base's spec still says
  four. Lane H did not rewrite the count — reconcile after the
  rebase.
- **Bundle budget:** §0.2 says 4,185,000, which matches this base
  (`CONSTRAINTS.md:40`, CI). The owner-ordered re-baseline to
  4,215,000 lives on token-gaps only. Reconcile after the rebase;
  Lane H measured against 4,185,000.
- **CI comment:** `ci.yml` said "dist/assets <= 4,040,000 bytes"
  while the enforced gate is 4,185,000. Fixed in this lane
  (comment only, to match the enforced number).
- **Agent-repos SURVEY.md never appeared** during this lane, and
  agent-repos is not installed on loud-stone. The mining above is
  from the sandbox copy, read-only.
- **Not verified first-hand by Lane H:** `sonar` release build (no
  cargo on loud-stone); the WalletConnect Kotlin dependency inside
  a Gradle build (no Android SDK/JDK on loud-stone);
  `okx-cex-market` end-to-end (needs the `okx` CLI binary);
  `dev_rug_percent` scale at a non-zero value (normalised like its
  sibling fields — stated in the script, not hidden).
