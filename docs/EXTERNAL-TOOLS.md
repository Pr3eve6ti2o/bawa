# External Tools — Bawa Repo Guide (Lane D4)

**Purpose.** The external tools Bawa's AI-ready guide recommends: libraries,
frameworks, SDKs and UI sources for building a real cryptocurrency wallet
(Web + Android), with the exact version verified, the source repository, the
licence, and the limitations that matter.

**Verification.** Every repository in this document was checked first-hand by
lane D4 on 2026-11-13 (UTC) via the GitHub REST API (HTTP 200 = exists, with
`pushed_at`, licence and star count recorded) and, for package versions, the
public npm / PyPI registries. 54 repositories returned HTTP 200; 26 npm
packages were checked against the registry. Versions are the latest verified
on 2026-11-13/14. "Unknown" means the field was not verified in this lane —
never a guess. Full method, searches, rejections and unverified candidates:
`EXTERNAL-TOOLS-RESEARCH-NOTES.md` in this directory.

**Reading notes.**
- For monorepos, GitHub's `/releases/latest` returns the latest tagged
  *sub-package*, not the main package (wagmi, RainbowKit, AppKit, Ledger
  Live, OpenZeppelin UIKit). Where that happens, the npm version is used and
  the quirk is stated in the row.
- Licence "NOASSERTION" is what the GitHub API returns when the repo has no
  machine-readable SPDX licence — read the row's note before reusing code.
- The Bawa repo already pins `@trustwallet/wallet-core` 4.9.3; the
  verification below confirms 4.9.3 is the current release (11 Nov 2026).

## A. HD-wallet / key-derivation libraries

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| `bip39` | npm `bip39` 3.1.2 | JS BIP39 mnemonics | `bitcoinjs/bip39` | ISC | BTC | 1,183 stars; pushed 2026-10-26; LFX health "Concerning", 49/100 | — |
| `bip32` | npm `bip32` 5.0.1 | JS BIP32 derivation | `bitcoinjs/bip32` | MIT | BTC | 196 stars; pushed 2026-02-19 | — |
| `bip_utils` | PyPI `bip_utils` 2.12.1 (2 Mar 2026) | Python BIP39/32/44/49/84 | `ebellocchia/bip_utils` | MIT | Many coins, including TON via `pytoniq-core-fork` | 391 stars; pushed 2026-10-26 | Needs `coincurve` or `ecdsa`; Rust is needed for `py-sr25519-bindings` |
| `wallet-core` | GitHub release 4.9.3 (11 Nov 2026) | C++/multi-platform key derivation, address generation and signing | `trustwallet/wallet-core` | Apache-2.0 in the repository; npm package metadata says MIT | 130+ chains | 3,592 stars; pushed 2026-11-11 | — |

Bawa already pins `wallet-core` 4.9.3; retain the distinction between its repository licence and npm metadata. For `bip_utils`, account for the `coincurve` or `ecdsa` dependency and the Rust requirement for `py-sr25519-bindings`.

## B. Transaction-construction libraries

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| `bitcoinjs-lib` | npm `bitcoinjs-lib` 7.0.5; no GitHub release | JS BTC transactions, PSBT and addresses; legacy, SegWit and Taproot | `bitcoinjs/bitcoinjs-lib` | MIT | BTC | 6,008 stars; pushed 2026-10-26 | No formal audit published; community-reviewed |
| `bdk_wallet` | GitHub release v3.2.0 (22 Sep 2026) | Rust descriptor wallet, PSBT, coin selection and RBF | `bitcoindevkit/bdk_wallet` | NOASSERTION on API; dual MIT/Apache-2.0 per npm metadata for `bdk-wasm` packages | BTC | 62 stars on the split repo; created 2025-04-03; pushed 2026-11-12; predecessor monorepo `bitcoindevkit/bdk` | — |
| `bdk-wasm` | npm `@bitcoindevkit/bdk-wallet-web` 0.4.0 | WASM bindings of BDK for browser/Node | `bitcoindevkit/bdk-wasm` | MIT OR Apache-2.0 | BTC | 13 stars; pushed 2026-10-29; tests: browser unit (`wasm-pack`), Node Jest, Esplora regtest integration and Signet smoke test | Esplora client only in the web build |
| Bitcoin Core | Unknown (no GitHub release checked) | Reference implementation; reference and test vectors | `bitcoin/bitcoin` | MIT | BTC | 90,672 stars; pushed 2026-11-13 | Not a library dependency |
| `bitcore` | Unknown (no GitHub release checked) | Full-stack BTC libraries: lib + insight API | `bitpay/bitcore` | MIT | BTC | 4,979 stars; pushed 2026-11-11 | Large but older ecosystem |
| `rust-lightning` | Unknown (no GitHub release checked) | Rust Lightning implementation | `lightningdevkit/rust-lightning` is a GitHub mirror; active development is on `git.rust-bitcoin.org` | NOASSERTION on API | BTC Lightning | 1,373 stars; pushed 2026-11-13 | GitHub is a mirror only |

Use Bitcoin Core as a reference and for test vectors, not as a library dependency. For `rust-lightning`, use `git.rust-bitcoin.org` for active development rather than the GitHub mirror.

## C. Blockchain RPC clients

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| `ethers.js` | npm `ethers` 6.17.0 = GitHub release v6.17.0 (18 Jun 2026) | Complete ETH library: providers, wallets, contracts and signing | `ethers-io/ethers.js` | MIT | ETH | 8,736 stars; pushed 2026-06-18, five months before verification; only 2 active maintainers with merge rights, per LFX | — |
| `viem` | npm `viem` 2.57.19 = GitHub release `viem@2.57.19` (12 Nov 2026) | TS-first, tree-shakeable ETH client; underpins wagmi | `wevm/viem` | NOASSERTION on API; MIT on npm | ETH | 3,638 stars; pushed 2026-11-13 | — |
| `go-ethereum` | GitHub release v1.17.10 (23 Oct 2026) | Go ETH protocol implementation, `ethclient` RPC client and `abigen` | `ethereum/go-ethereum` | LGPL-3.0 | ETH | 51,478 stars; pushed 2026-11-13 | — |
| `web3.py` | PyPI `web3` 8.0.0 | Python ETH library: `web3.py`, `eth-account` and `eth-abi` | Current home: `ApeWorX/web3.py`; moved out of the ethereum organisation; old path `ethereum/web3.py` redirects | MIT | ETH | 5,546 stars; pushed 2026-10-30; pytest + eth-tester | — |
| `web3.js` | npm `web3` 4.16.0, the last line | Blockchain RPC client; sunset | Current home: `web3/web3.js` | NOASSERTION on API; LGPL-3.0 on npm | ETH | Sunset by ChainSafe; repository archived; last push 2025-03-05 | **Do not use for new work; migrate to `ethers.js` or `viem`** |

Do not use `web3.js` for new work; migrate to `ethers.js` or `viem`. Use `ApeWorX/web3.py` as the current repository home for `web3.py`; the old `ethereum/web3.py` path redirects there.

## D. Chain-specific SDKs (BTC, ETH, TRX, TON)

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| `tronweb` | GitHub release v6.5.2 = npm `tronweb` 6.5.2 (11 Nov 2026) | Official TRON JS SDK: accounts, transactions, contracts, TRC20/TRC10 | `tronprotocol/tronweb` | MIT | TRX (TRON) | 578 stars; pushed 2026-11-11 | — |
| `@ton/ton` | npm `@ton/ton` 16.3.0 | Live TON TS SDK | `ton-org/ton` | MIT | TON | 244 stars; pushed 2026-06-21 | Not `ton-core/ton`, which is stale; its last push was 2024-07-16 |
| `@ton/core` | npm `@ton/core` 0.63.1 | Low-level TON primitives: Cell, Address and Contract | `ton-org/ton-core` | MIT | TON | 78 stars; pushed 2026-07-03 | — |
| `@ton/crypto` | npm `@ton/crypto` 3.3.0 | TON cryptography primitives | `ton-org/ton-crypto` | MIT | TON | 33 stars; pushed 2024-08-09 | Stale |
| `tonweb` | npm `tonweb` 0.0.66; no GitHub release | Older TON JS SDK | `toncenter/tonweb` | MIT | TON | 768 stars; pushed 2024-08-20; stale, 2+ years | Defaults to `toncenter.com` HTTP API; prefer `@ton/ton` for new work |
| `@tonconnect/sdk` | npm `@tonconnect/sdk` 5.0.1; no GitHub release; UI package `@tonconnect/ui` 2.3.1 (ui-react version unknown) | TON Connect 2.0 wallet-connection protocol: bridge + injected | `ton-connect/sdk` | Apache-2.0 | TON | 562 stars; pushed 2026-11-13 | — |
| `ton-http-api` | Unknown (no GitHub release checked) | Self-hostable TON HTTP API server; the backend TonWeb defaults to | `toncenter/ton-http-api` | GPL-3.0 | TON | 299 stars; pushed 2026-07-27 | — |
| `bitcoinj` | GitHub release v0.17.1 (4 May 2026) | Java BTC library: SPV wallet, HD keychain and BIP32/39; includes `wallet-tool` CLI and JavaFX wallet template | `bitcoinj/bitcoinj` | Apache-2.0 | BTC | 5,236 stars; pushed 2026-11-13 | Android 8.0+ |

Use `ton-org/ton` for the live TON SDK, and prefer `@ton/ton` over `tonweb` for new work. `ton-core/ton` and `ton-org/ton-crypto` are marked stale.

## E. Web wallet frameworks and starter kits

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| wagmi | npm `wagmi` **3.7.11**; GitHub latest tag is a sub-package, so npm supplies the version | React hooks built on viem for wallet connection, contracts and account state | GitHub: `wevm/wagmi`; npm: `wagmi` | MIT | Ethereum | 6,776 stars; pushed 2026-11-12 | — |
| RainbowKit | npm `@rainbow-me/rainbowkit` **2.2.11**; GitHub latest tag is a SIWE sub-package | React wallet-connection UI built on wagmi | GitHub: `rainbow-me/rainbowkit`; npm: `@rainbow-me/rainbowkit` | MIT | EVM | 2,839 stars; pushed 2026-10-01; 218k weekly npm downloads | — |
| Reown AppKit | npm `@reown/appkit` **1.8.24** | Full-stack onchain app UX kit: wallet modal, 500+ wallets, email/social login, swaps and on-ramp | GitHub: `reown-com/appkit`; npm: `@reown/appkit` | API: NOASSERTION; npm: `SEE LICENSE IN LICENSE.md` | Multi-chain | 5,455 stars; pushed 2026-11-11 | Requires a Reown project ID from `dashboard.reown.com`. |
| Coinbase Wallet SDK | npm `@coinbase/wallet-sdk` **4.4.0**; older GitHub latest tag: **v4.3.4**, 9 Jun 2025 | Connect dApps to Coinbase Wallet through its extension and mobile WalletLink | GitHub: `coinbase/coinbase-wallet-sdk`; npm: `@coinbase/wallet-sdk`; ethereum.org listing; Coinbase docs (2026-09-10) | Apache-2.0 on npm; MIT per ethereum.org listing | EVM | 1,770 stars; pushed 2026-11-10 | Licence sources differ. Coinbase docs recommend Base Account SDK (`@base-org/account`) until the next-generation SDK is ready. |
| Trust Wallet connection SDK | **Unknown** — no GitHub release found | Trust Wallet's first-party wallet-connection library | GitHub: `trustwallet/trust-connect-sdk`, found through the `trustwallet` organisation repository list | Apache-2.0 | EVM, Bitcoin and Solana at launch | 13 stars; pushed 2026-11-07 | The guessed `trustwallet/trust-connect` path returns 404. |
| Turnkey React Wallet Kit | npm `@turnkey/react-wallet-kit` **2.8.1** | Embedded wallets with passkey/email/OAuth login and built-in UI modals | GitHub: `tkhq/sdk`; npm: `@turnkey/react-wallet-kit` | Apache-2.0 | Multi-chain | 104 stars; pushed 2026-11-13 | Requires Turnkey's hosted infrastructure: organisation and Auth Proxy. Keys are managed through Turnkey's service; it is not fully self-hosted. |
| AnyWalletKit | npm `@anywalletkit/wallet-zcash` **0.5.3** — version of this package | Open multichain wallet SDK for React Native, web and Node, with swaps, bridges and DeFi modules | GitHub: `ultratestbro/anywalletkit`; npm: `@anywalletkit/wallet-zcash` | Apache-2.0 | Multichain; specific chains unknown | 4 stars; pushed 2026-11-13 | Very small and new; niche candidate only. |
| RIF Wallet | **Unknown** — no GitHub release checked | React Native account-abstraction wallet; pay fees in ERC20 tokens | GitHub: `rsksmart/rif-wallet` | MIT | Rootstock / RIF-specific | 29 stars; pushed 2026-08-03 | Small and Rootstock/RIF-specific. |

For React wallet connections, wagmi provides hooks and RainbowKit provides UI built on wagmi. AppKit needs a Reown project ID, Turnkey is not fully self-hosted, and AnyWalletKit is a niche candidate only.

## F. Android wallet implementations / starters

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| Electrum | **4.8.4**, 6 Nov 2026, per electrum.org; no GitHub release object | Desktop and Android Bitcoin wallet with Lightning, PSBT and hardware-wallet support | GitHub: `spesmilo/electrum`; `electrum.org` | MIT | Bitcoin only; Lightning support | 8,660 stars; pushed 2026-11-13 | **Security:** 4.8.3 fixed GHSA-6jp4-8v48-cc5v (high): a malicious server could replace a just-broadcast transaction; exploited in the wild. 4.8.4 fixed a Lightning onion-message flaw. Minimum sane version: **4.8.4**. |
| BlueWallet | GitHub release **v8.0.2**, 6 Oct 2026 | React Native wallet for iOS, Android and macOS; watch-only wallets, multisig vaults and PSBT hardware support | GitHub: `BlueWallet/BlueWallet` | MIT | Bitcoin; Lightning | 3,357 stars; pushed 2026-11-13 | — |
| Gem Wallet | GitHub release **2.114.94**, 13 Nov 2026 | Open-source iOS/Android wallet with a Rust core | GitHub: `gemwalletcom/wallet` | GPL-3.0 | 100+ chains; individual chains unknown | 412 stars; pushed 2026-11-13; CertiK audit Apr 2026; reproducible F-Droid Android builds Jul 2026 | — |
| Blockstream app (ex-Green), Android | GitHub release **release_5.7.1**, 6 Nov 2026 | Blockstream Android wallet app | GitHub: `Blockstream/green_android` | GPL-3.0 | Bitcoin; Liquid; Lightning | 276 stars; pushed 2026-11-06 | Uses a 2-of-2 multisig model with a Blockstream server key. |
| Bitcoin Wallet | **Unknown** — no GitHub release | Android Bitcoin wallet operating as a standalone SPV node, with no central backend | GitHub: `bitcoin-wallet/bitcoin-wallet` | **Unknown** — no licence field on API | Bitcoin | 4,174 stars; pushed 2025-03-05; 20 months stale | Staleness warning. |
| Mycelium Bitcoin Wallet | **Unknown** | Bitcoin wallet for Android | GitHub: `mycelium-com/wallet-android` | NOASSERTION on API | Bitcoin | 717 stars; pushed 2026-05-15 | Repository moved: the old `mycelium-com/wallet` path redirects to `mycelium-com/wallet-android`. |

Use Electrum 4.8.4 as the minimum sane version, and treat Bitcoin Wallet's 20-month staleness as a warning. Blockstream's 2-of-2 multisig model includes a Blockstream server key.

## G. Cryptocurrency payment libraries

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| BTCPay Server | GitHub release **v2.4.7**, 29 Oct 2026 | Self-hosted payment processor with invoices, checkout and webhooks; 0% fee | GitHub: `btcpayserver/btcpayserver` | MIT | Bitcoin; Lightning; altcoins via plugins | 7,920 stars; pushed 2026-11-12 | **Security:** CVE-2026-119757 (CVSS 9.8), LND macaroon disclosure via the Docker Nginx template, was exploited in the wild and fixed in **2.4.2** on 7 Aug 2026. A second wave on **1 Nov 2026** drained on-chain hot wallets on versions **<2.4.2**. **Run 2.4.7+ only; never expose a hot wallet unpatched.** |
| Bitcart | GitHub release **0.11.1.0**, 7 Nov 2026 | Self-hosted Python/FastAPI payment processor with admin panel, checkout and Python SDK | GitHub: `bitcart/bitcart`; organisation renamed from `bitcartcc` to `bitcart` | MIT | BTC / LTC / BCH / XMR / ETH / TRX / USDT+ | 1,009 stars; pushed 2026-11-13 | — |

Run BTCPay Server **2.4.7+ only**, and never expose a hot wallet unpatched.

OpenReceive — **candidate needing a repo-URL check**; no GitHub repository URL surfaced (`openreceive.org`; reported MIT; Lightning/NWC receive-only library), so it is not listed as verified.

## H. Hardware-wallet integrations

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| Ledger Live / Ledger JS SDKs | Latest tag: **live-mobile@4.28.0**, 12 Nov 2026; npm `@ledgerhq/hw-app-eth` **7.13.0** and `@ledgerhq/hw-app-btc` **12.2.0** | Monorepo containing the Ledger JS SDKs | GitHub: `LedgerHQ/ledger-live`; both listed npm packages point at this monorepo | Monorepo: MIT; both listed npm packages: Apache-2.0 | Multi-chain | 628 stars; pushed 2026-11-13 | Ledger secure-element firmware is closed; only the app/SDK layer is open. |
| Trezor Suite | GitHub release **v26.10.3**, 29 Oct 2026 | Monorepo containing the desktop/web app and Trezor Connect JS SDK | GitHub: `trezor/trezor-suite` | NOASSERTION on API | Multi-chain | 1,100 stars; pushed 2026-11-13 | — |
| Trezor firmware | **Unknown** (no GitHub release checked) | Open, auditable and reproducible firmware monorepo | GitHub: `trezor/trezor-firmware` | NOASSERTION on API | Multi-chain | 1,866 stars; pushed 2026-11-13 | — |

Use the Ledger monorepo for the open app/SDK layer, not as a source of open secure-element firmware. Trezor Connect is inside Trezor Suite, while Trezor's separate firmware monorepo is open, auditable and reproducible.

## I. UI templates / kits for crypto wallets

| Tool | Version (verified) | Purpose | Source | Licence | Chains | Maintenance | Limitations |
|---|---|---|---|---|---|---|---|
| **OpenZeppelin UIKit** | npm: `@openzeppelin/ui-components` **3.13.0**; `@openzeppelin/ui-types` **3.5.2**. Latest GitHub tag: `@openzeppelin/ui-styles@1.2.0` (21 Sep 2026), a **sub-package** tag. | Modular React components for blockchain transaction interfaces; shadcn/ui-based, Tailwind v4. | [OpenZeppelin/openzeppelin-ui](https://github.com/OpenZeppelin/openzeppelin-ui) | **AGPL-3.0 — strong copyleft** | Chain-agnostic; EVM, Stellar and Polkadot adapters. | 7 stars; created 2026-01-01; pushed 2026-11-13. Very new and small. | Closest purpose-built wallet-UI kit found, but covers transaction forms rather than a complete wallet shell. |
| **Bitcoin UI** | npm `bitcoin-ui` **1.1.4** | React components for Bitcoin apps: `Secret` (seed display with blur), `PasswordInput`, `CurrencyInput`, `ExpandableText`, `QRCode`. | [bitcoin-ui-kit/bitcoin-ui](https://github.com/bitcoin-ui-kit/bitcoin-ui) | MIT | Bitcoin | 2 stars; pushed 2025-06-23; stale (17 months). Site claims 64+ tests. | Only five components: a component set, not a wallet UI. |
| **Composer Kit** | npm `@composer-kit/ui` **0.0.3**; no GitHub release. | React components for Celo apps: wallet connection, balances, payments and NFTs. | [celo-org/composer-kit](https://github.com/celo-org/composer-kit) | **Unknown** — no licence field on the API. | Celo | 7 stars; pushed 2026-11-07. | Very early; Celo-specific. |
| **w3-kit/ui** | **Unknown** | Web3 React component library for wallets, networks, balances and transactions. | [w3-kit/ui](https://github.com/w3-kit/ui) | MIT | Multi-chain | 17 stars; pushed 2026-08-07. One-person revival project seeking contributors. | Weak candidate. |
| **MeshJS (`@meshsdk/react`)** | **Unknown** | React `CardanoWallet` connect button/modal. | `@meshsdk/react`; GitHub repo: **unknown**. | **Unknown** | Cardano only | **Unknown** | **Cardano-only, not verified here** — not verified via the GitHub API in this lane. |

OpenZeppelin UIKit is the closest purpose-built match, but account for its AGPL-3.0 strong copyleft and transaction-form scope rather than treating it as a complete wallet shell. Treat Bitcoin UI as a small component set, Composer Kit as a very early Celo-specific option with an unknown licence, and w3-kit/ui as a weak candidate.

## J. Top-wallet / extension UI source repos (for cloning the UI)

| Wallet | UI source repo | Open/closed | Licence | Notes |
|---|---|---|---|---|
| **MetaMask** | [MetaMask/metamask-extension](https://github.com/MetaMask/metamask-extension) | **Source-available; NOT open source** | API: `NOASSERTION`. Custom ConsenSys licence since 2020; restricts commercial use above 10k MAU. | GitHub release **v13.57.0** (13 Nov 2026); 13,255 stars; pushed 2026-11-13. Reference browser-extension wallet UI. Code is readable, but redistribution/commercial reuse is restricted. |
| **Rabby extension** | [RabbyHub/Rabby](https://github.com/RabbyHub/Rabby) | Fully readable; MIT text with brand reservation. | API: `NOASSERTION`. MIT text plus brand-name/logo reservation. | GitHub release **v0.94.16** (13 Nov 2026); 1,935 stars; pushed 2026-11-13. Ethereum and all EVM chains; nine audit/pen-test files in-repo (2021–2026). Best fully readable top-wallet extension UI. |
| **Rabby mobile** | [RabbyHub/rabby-mobile](https://github.com/RabbyHub/rabby-mobile) | Readable; reuse rights unstated. | **Unknown** at repo level — no repo-level licence file; only sub-packages are MIT. | 81 stars; pushed 2026-11-13. Readable code does not come with stated repo-level reuse rights. |
| **Phantom** | `phantom/wallet` — private; GitHub API 404. | **Closed** | **Unknown** | Client code is not public. Only the blocklist, SDKs and two audit reports — Kudelski (2021), Least Authority (2024) — are public. **Not clonable**; study only its public UI/behaviour. |
| **Exodus** | **Unknown** | **Closed by design**, per vendor statement. | **Unknown** | No clonable wallet repo. |
| **Trust Wallet apps + extension** | **Unknown** | **Closed** | **Unknown** | Only Wallet Core is open; see Part A. |
| **Tonkeeper** | [tonkeeper/tonkeeper-web](https://github.com/tonkeeper/tonkeeper-web) | **Open source** | Apache-2.0 | GitHub release **v26.11.3** (12 Nov 2026); 448 stars; pushed 2026-11-13. Non-custodial TON wallet web app; best open multi-platform wallet UI in the TON ecosystem. |
| **Electrum** | [spesmilo/electrum](https://github.com/spesmilo/electrum) | Open | MIT | **4.8.4**; 8,660 stars; pushed 2026-11-13. Usable UI reference, verified in this lane. |
| **Sparrow** | [sparrowwallet/sparrow](https://github.com/sparrowwallet/sparrow) | Open | Apache-2.0 | GitHub release **2.5.6** (29 Oct 2026); 2,183 stars; pushed 2026-11-13. Usable UI reference, verified in this lane. |
| **BlueWallet** | [BlueWallet/BlueWallet](https://github.com/BlueWallet/BlueWallet) | Open | MIT | **v8.0.2**; 3,357 stars; pushed 2026-11-13. Usable UI reference, verified in this lane. |
| **Gem Wallet** | [gemwalletcom/wallet](https://github.com/gemwalletcom/wallet) | Open | GPL-3.0 | **2.114.94**; 412 stars; pushed 2026-11-13. Usable UI reference, verified in this lane. |
| **Trezor Suite** | [trezor/trezor-suite](https://github.com/trezor/trezor-suite) | Open | NOASSERTION on API | **v26.10.3**; 1,100 stars; pushed 2026-11-13. Usable UI reference, verified in this lane. |

For an extension shell, start with Rabby while respecting its brand-name/logo reservation; use MetaMask second within its licence limits. Tonkeeper is the best open TON UI reference, while Phantom, Exodus and Trust Wallet's closed clients must not be treated as clonable UI sources.

## K. UI-specific repo verdict

> [!IMPORTANT]
> **YES, with qualification — [OpenZeppelin UIKit](https://github.com/OpenZeppelin/openzeppelin-ui) is the closest purpose-built match for Bawa.** It provides React components for blockchain transaction interfaces, wallet hooks and theming, **but** is brand-new (created **2026-01-01**), tiny (**7 stars**), and **AGPL-3.0 licensed — strong copyleft**. It covers transaction forms rather than a complete wallet shell.
>
> **No mature, full wallet-UI template — a complete Phantom/MetaMask-style shell to clone — was found in the open.** Search evidence: UI-kit searches run **7, 18, 22 and 30** in `EXTERNAL-TOOLS-RESEARCH-NOTES.md`.
>
> **Practical route:** OpenZeppelin UIKit components + RainbowKit/Reown AppKit connection modals + Bitcoin UI's five small components, with the overall shell cloned from readable top-wallet codebases: **Rabby extension first, MetaMask second within its licence limits**.

## L. Testing / verification tools (recorded per tool)

No standalone testing framework was separately verified as a category in
this lane; the testing evidence found is attached to the tools above:

| Tool | Testing evidence (verified) | Source |
|---|---|---|
| `bdk-wasm` | Browser unit tests (`wasm-pack`), Node Jest, Esplora regtest integration, Signet smoke test | `bitcoindevkit/bdk-wasm` |
| `web3.py` | pytest suite + eth-tester local chain | `ApeWorX/web3.py` |
| Bitcoin UI | 64+ tests claimed on the project site (not independently run in this lane) | `bitcoin-ui-kit/bitcoin-ui` |
| Bitcoin Core | Reference test vectors (use as the ground truth for BTC behaviour) | `bitcoin/bitcoin` |
| Electrum / Sparrow / BlueWallet | Mature projects with in-repo test suites; specific coverage was not enumerated in this lane | `spesmilo/electrum`, `sparrowwallet/sparrow`, `BlueWallet/BlueWallet` |

Do not claim a test suite was run in this lane unless it appears above.
