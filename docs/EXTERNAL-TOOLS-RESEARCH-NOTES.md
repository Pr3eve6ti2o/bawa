# D4 — Research notes (lane D4, Bawa DX re-dispatch, 2026-11-14)

Verification method: every repo in EXTERNAL-TOOLS.md was checked first-hand
against the GitHub REST API (`api.github.com/repos/<owner>/<repo>`) from the
VM on 2026-11-13 ~21:35–21:41 UTC, plus `registry.npmjs.org/<pkg>/latest`
for npm-published versions. Raw API JSON is kept in `raw/` (52 files) and
`raw-npm/`; the compact tables are `verify-summary.tsv` and
`npm-summary.tsv`. Release tags were fetched in a second pass after the
GitHub rate-limit reset (see `releases/`).

## Searches run (browser.search, 2026-11-14 ~03:10–03:45 IST)

1. best HD wallet key derivation library GitHub bitcoinjs-lib ethers.js BIP32 BIP39
2. open source web crypto wallet framework starter kit GitHub
3. open source Android crypto wallet GitHub repository
4. cryptocurrency payment library GitHub BTC ETH USDT payment processing
5. Phantom wallet GitHub source code repository browser extension
6. MetaMask extension GitHub source code repository Rabby wallet GitHub
7. crypto wallet UI template kit design system GitHub React
8. TON blockchain SDK JavaScript GitHub tonweb ton-core TronWeb TRON SDK GitHub
9. Exodus wallet open source GitHub Trust Wallet wallet-core GitHub repository
10. ethers.js viem web3.js blockchain RPC client library GitHub Ethereum
11. Ledger hardware wallet JavaScript SDK GitHub Trezor Suite trezor-suite GitHub
12. Bitcoin Dev Kit BDK GitHub bitcoinjs-lib PSBT transaction builder wallet test vectors
13. github.com trustwallet wallet-core repository
14. github.com ethers-io ethers.js wevm viem wagmi repository
15. github.com bitcoinjs bitcoinjs-lib bitcoindevkit bdk repository
16. RainbowKit Reown AppKit WalletConnect web3 wallet connection UI GitHub
17. BTCPay Server GitHub btcpayserver Bitcart GitHub bitcartcc Sparrow wallet GitHub
18. OpenZeppelin UIKit GitHub repository openzeppelin Bitcoin UI Kit GitHub bitcoin-design
19. Gem Wallet GitHub gemwallet BlueWallet GitHub bluewallet Blockstream Green GitHub
20. RainbowKit GitHub rainbow-me Reown AppKit GitHub reown-com Coinbase wallet SDK GitHub
21. BlueWallet GitHub BlueWallet Sparrow wallet GitHub sparrowwallet Bitcart GitHub bitcartcc
22. "bitcoin-ui" npm GitHub repository Bitcoin UI components
23. bitcoinjs bip32 bip39 GitHub repository bitcoinj android library GitHub
24. TON Connect SDK GitHub ton-connect web3.py GitHub ethereum go-ethereum GitHub Lightning Dev Kit LDK GitHub
25. Bitcart GitHub bitcartcc bitcart crypto payment processor
26. web3.py GitHub ethereum go-ethereum GitHub ethereum Lightning Dev Kit LDK GitHub lightningdevkit
27. Electrum wallet latest release version 2026 spesmilo electrum GitHub releases
28. Coinbase Wallet mobile SDK GitHub coinbase wallet-mobile-sdk onchainkit
29. bip-utils Python library GitHub ebellocchia repository
30. Turnkey react-wallet-kit GitHub repository tkhq
31. TrustConnect SDK GitHub trustwallet repository trust-connect

Pages opened with browser.open: https://bitcoinui.org/ (Bitcoin UI component
library — 5 components, 64+ tests; no GitHub link on the page itself; repo
found later via the npm registry `repository` field).

## Repos checked and REJECTED (with reason)

- **phantom/wallet** — GitHub API 404 (private / not public). Phantom's wallet
  client is CLOSED SOURCE. Only the blocklist, SDKs and two audit reports
  (Kudelski 2021, Least Authority 2024) are public; the Least Authority
  report quotes a private clone. REJECTED as a clonable UI source; kept in
  the UI section only as a "do not expect to clone" warning.
- **Exodus (whole wallet)** — closed source by design (Exodus knowledge base:
  "components of Exodus that are not open-source"; only some libraries on
  GitHub under the Exodus Movement org). No single clonable wallet repo.
  REJECTED as a UI source.
- **Trust Wallet mobile apps + browser extension** — closed source; only
  Wallet Core (Apache-2.0) and some SDKs are open. Wallet Core IS included
  (as a library, not a UI source).
- **bitcoin-design/bitcoin-ui-kit** — GitHub API 404 at that path. The Bitcoin
  UI Kit is a Figma/design-system resource, not a code repo at that address;
  its code implementations are community ports (Swift/Flutter/Etta UI for
  React Native). REJECTED as a code dependency; cited as a design reference.
- **ebellocchia/bip-utils** (hyphen) — GitHub API 404. The real repo is
  `ebellocchia/bip_utils` (underscore) — see corrections. The hyphen guess
  was wrong and is NOT listed.
- **trustwallet/trust-connect** — GitHub API 404. TrustConnect SDK's repo name
  was not found under that path; the trustwallet org repo list was pulled in
  pass 2 to find the real name. NOT listed until confirmed.
- **turnkey/turnkey** — GitHub API 404. The real repo is `tkhq/sdk` (found via
  the npm `repository` field of @turnkey/react-wallet-kit). The `turnkey/`
  guess was wrong and is NOT listed.
- **tronprotocol/tron-web** — GitHub API 404 (old name). The live repo is
  `tronprotocol/tronweb`. The old name is NOT listed.
- **ton-core/ton** and **ton-core/ton-core** — API 200 but STALE: last push
  2024-07-16 and 2024-08-02. The live TON TypeScript repos moved to the
  `ton-org` org (`ton-org/ton` 16.3.0, `ton-org/ton-core` 0.63.1,
  `ton-org/ton-crypto` 3.3.0 per npm). The ton-core paths are listed only as
  a staleness warning, NOT as recommendations.
- **toncenter/tonweb** — API 200 but last push 2024-08-20; npm 0.0.66. Listed
  with a staleness warning; @ton/ton is the current recommendation.
- **ethereum/web3.js** — API 301 (renamed). npm `web3` 4.16.0 points at
  `ChainSafe/web3.js`. ChainSafe sunset the library and archived the repo
  2025-03-04/05; listed as DO NOT USE for new work, with the migration
  pointer to ethers.js/viem.
- **celo-org/composer-kit** — API 200 but only 7 stars, no description, no
  license field, npm package is `@composer-kit/ui` 0.0.3. Too immature to
  recommend as a UI foundation; listed as a weak/early candidate only.
- **w3-kit/ui** — API 200, 17 stars, last push 2026-08-07; a one-person
  revival project ("looking for contributors", Jan 2026). Listed as a weak
  candidate, not a recommendation.
- **coinbase/wallet-mobile-sdk** — API 200 but last push 2025-06-12, 20
  stars, empty description; superseded by Base Account SDK
  (`@base-org/account`) per Coinbase docs (2026-09-10). Listed as
  deprecated/superseded, not recommended.
- **bitcoin-wallet/bitcoin-wallet** — API 200, last push 2025-03-05 (20
  months stale), no license field. Listed with a staleness warning; useful
  as an Android/SPV reference only.
- **rsksmart/rif-wallet** — API 200, 29 stars, last push 2026-08-03. Small,
  Rootstock/RIF-specific (account abstraction, pay fees in ERC-20). Listed
  as a niche reference, not a general Android starter.
- **devdasx/wallet-hd-derivation-kit** (surfaced in search 1) — brand-new
  single-author kit, explicitly "not yet received an independent third-party
  audit". NOT verified via the GitHub API in this lane (no API check run);
  NOT listed in EXTERNAL-TOOLS.md. Mentioned here only so a later lane can
  check it; do not add it without verification.
- **OpenReceive** (openreceive.org, MIT, Lightning+NWC) — surfaced in
  searches 4/17; its GitHub org/repo URL was never surfaced in search
  results and no API check was run. NOT listed; needs a repo-URL check
  before inclusion.
- **XPayLabs / xpay** (yan253319066/XPayLabs, Medium article) — core gateway
  engine is source-available under a proprietary "XPay Enterprise License",
  not open source; single-maintainer project. NOT verified via API; NOT
  listed.
- **Bitcart** note: the org renamed from bitcartcc → bitcart; the live repo
  is `bitcart/bitcart` (verified 200). The old `bitcartcc` org name is not
  listed.

## Candidates that could NOT be verified (do not list as verified)

- **TrustConnect SDK repo name** — Trust Wallet's blog (2026-07-17) says the
  source is "available on GitHub" but gives no repo path; `trustwallet/
  trust-connect` 404s. Pass 2 pulled the trustwallet org repo list to find
  it; if still unfound it stays unverified.
- **Mycelium wallet repo move** — `mycelium-com/wallet` returned API 301
  (renamed). Pass 2 follows the redirect to find the current name.
- **web3.py new home** — `ethereum/web3.py` returned API 301 (renamed).
  Pass 2 follows the redirect; the PyPI `web3` package is the fallback
  reference, but the repo path stays unverified until the redirect resolves.
- **Bitcoin UI (bitcoin-ui-kit/bitcoin-ui)** — repo path came from the npm
  registry `repository` field, NOT from a GitHub page open; pass 2 verifies
  it via the GitHub API. The bitcoinui.org site itself is "Powered by Bolt"
  (AI-generated site builder) with no GitHub link on the page — provenance
  is thin, and the library is only 5 components. Treat as a small, early
  component set, not a full wallet UI.

## Corrections found during verification (important)

- TON TypeScript SDKs live under `ton-org`, not `ton-core`: `ton-org/ton`
  (@ton/ton 16.3.0), `ton-org/ton-core` (@ton/core 0.63.1),
  `ton-org/ton-crypto` (@ton/crypto 3.3.0). The `ton-core/*` repos are
  stale (last push Jul/Aug 2024).
- `wallet-core` npm package `@trustwallet/wallet-core` is 4.9.3 — the same
  version Bawa already pins. Repo license Apache-2.0 (GitHub API); the npm
  package metadata says MIT. Both facts are recorded; the repo license
  (Apache-2.0) governs the code.
- `ethers.js` last push 2026-06-18 (~5 months before verification) and LFX
  reports only 2 active maintainers with merge rights. Still the
  established choice, but the maintenance note belongs in the table.
- `bdk_wallet` is the split repo (created 2025-04-03); the old
  `bitcoindevkit/bdk` monorepo is the predecessor. Release 3.2.0 was
  confirmed via the GitHub releases page in search results.
- `lightningdevkit/rust-lightning` is a MIRROR; active development is on
  git.rust-bitcoin.org. Recorded as such.
- BTCPay Server security history (must stay in the table): CVE-2026-119757
  (CVSS 9.8, LND macaroon disclosure via the Docker Nginx template), fixed
  in 2.4.2 (2026-08-07), exploited in the wild; second incident wave
  2026-11-01 (on-chain hot wallets on <2.4.2); latest release 2.4.7
  (2026-10-29). Source: ThreatAft + BTCPay incident posts, Nov 2026.
- Electrum security history: 4.8.3 (2026-10-23) fixed GHSA-6jp4-8v48-cc5v
  (high; malicious server could replace a just-broadcast tx); 4.8.4
  (2026-11-06) fixed a Lightning onion-message flaw. Both are security
  updates; minimum sane version is 4.8.4.
- MetaMask license is NOASSERTION on the GitHub API (custom ConsenSys
  license since 2020, restricts commercial use above 10k MAU) — it is
  source-available, NOT open source. Same for Rabby (NOASSERTION: MIT text
  + brand-name reservation) and viem/appkit (NOASSERTION). Recorded exactly
  as the API reports them.
- OpenZeppelin UIKit (`OpenZeppelin/openzeppelin-ui`) is AGPL-3.0 — strong
  copyleft. Created 2026-01-01, 7 stars. It is the closest thing to a
  purpose-built crypto-wallet UI kit found, but it is very new, small, and
  AGPL-licensed; that combination must be stated plainly.

## Addendum — verification passes 2 and 3 (2026-11-13 ~22:25–22:28 UTC)

- Renames resolved by following the API 301s: `mycelium-com/wallet` →
  `mycelium-com/wallet-android` (NOASSERTION, 717 stars, pushed 2026-05-15);
  `ethereum/web3.py` → `ApeWorX/web3.py` (MIT, 5546 stars, pushed
  2026-10-30; PyPI web3 8.0.0); `ethereum/web3.js` → `web3/web3.js`
  (NOASSERTION, 19900 stars, last push 2025-03-05 — archived/sunset; npm
  web3 4.16.0's repository field still says ChainSafe/web3.js, which itself
  now 301s).
- Corrected paths verified 200: `ton-org/ton` (MIT, 244 stars, pushed
  2026-06-21), `ton-org/ton-core` (MIT, 78 stars, pushed 2026-07-03),
  `ton-org/ton-crypto` (MIT, 33 stars, pushed 2024-08-09 — stale),
  `bitcoin-ui-kit/bitcoin-ui` (MIT, 2 stars, pushed 2025-06-23 — stale,
  17 months), `tkhq/sdk` (Apache-2.0, 104 stars, pushed 2026-11-13),
  `ebellocchia/bip_utils` (MIT, 391 stars, pushed 2026-10-26),
  `ultratestbro/anywalletkit` (Apache-2.0, 4 stars, pushed 2026-11-13).
- TrustConnect SDK repo FOUND: `trustwallet/trust-connect-sdk` (Apache-2.0,
  13 stars, pushed 2026-11-07, no description, no GitHub release). The
  earlier guess `trustwallet/trust-connect` correctly 404s. No npm package
  found under @trustwallet/trust-connect; version is recorded as unknown.
- GitHub latest-release quirks (monorepos return the latest tagged
  sub-package, not the main package): wagmi → @wagmi/solid@0.0.39,
  rainbowkit → a SIWE sub-package, appkit → @reown/appkit-siwe@1.8.24,
  ledger-live → live-mobile@4.28.0, openzeppelin-ui →
  @openzeppelin/ui-styles@1.2.0. For those, the npm version is used as the
  version and the quirk is noted. No GitHub release object exists for:
  bitcoinjs-lib, electrum, tonweb, ton-connect/sdk, composer-kit,
  bitcoin-wallet, trust-connect-sdk — npm/website versions are used instead.
- Notable release tags confirmed: wallet-core 4.9.3 (11 Nov 2026 — matches
  Bawa's pin), metamask-extension v13.57.0, Rabby v0.94.16, ethers v6.17.0,
  viem viem@2.57.19, bdk_wallet v3.2.0, sparrow 2.5.6, BlueWallet v8.0.2,
  trezor-suite v26.10.3, bitcoinj v0.17.1, gemwallet 2.114.94, green_android
  release_5.7.1, tronweb v6.5.2, btcpayserver v2.4.7, bitcart 0.11.1.0,
  go-ethereum v1.17.10, tonkeeper-web v26.11.3. Coinbase wallet-sdk: GitHub
  latest tag v4.3.4 (9 Jun 2025) is OLDER than npm 4.4.0 — npm wins, noted.
- bitcoin-ui is weaker than first thought: 2 stars, last push 2025-06-23.
  It stays listed (npm 1.1.4, MIT, 5 components) with the staleness stated.
- GitHub API rate limit ended at 4 remaining after pass 3; no further API
  calls were made. All raw JSON is in `raw/` and `releases/`.
