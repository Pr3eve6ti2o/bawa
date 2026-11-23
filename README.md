# Bawa

[![CI build status for panel-rebuild/token-gaps](https://github.com/Pr3eve6ti2o/bawa/actions/workflows/ci.yml/badge.svg?branch=panel-rebuild%2Ftoken-gaps)](https://github.com/Pr3eve6ti2o/bawa/actions/workflows/ci.yml?query=branch%3Apanel-rebuild%2Ftoken-gaps)
[![MIT licence](https://img.shields.io/github/license/Pr3eve6ti2o/bawa)](LICENSE)

**One plain request in, a real, buildable wallet project out.**

## Showcase

Real screenshots of the example web wallet running from this branch, taken with a fresh unfunded test wallet (zero balances, live prices). Desktop is 1440 px, mobile is 390 px. Both shots show the dashboard, the wallet homepage.

<!-- To extend this grid, add a row to the table below: one image per cell, height="360" on every image so all shots render at the same height. -->

| Dashboard (desktop) | Dashboard (mobile) |
| --- | --- |
| <img src="docs/images/web-wallet-dashboard-desktop.png" alt="Dashboard of the Bawa web wallet on desktop" height="360"> | <img src="docs/images/web-wallet-dashboard-mobile.png" alt="Dashboard of the Bawa web wallet on mobile" height="360"> |
| Portfolio, assets and recent activity. | The same wallet on mobile. |

### Create your own

Prefer to build one yourself? Follow [Create the example web wallet](docs/CREATE-EXAMPLE-WALLET.md) — or run it straight from a terminal:

```sh
git clone --branch panel-rebuild/readme-marketing https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
cd apps/web
npm ci
npm run build
npm run preview
```

Then open <http://localhost:4173>. No account, no API key, no funds needed — everything runs locally, and broadcast stays disabled so the wallet cannot send funds.

![Bawa architecture: guide, HD core, vault, providers, flows and storage](docs/diagrams/architecture.svg)

![One phrase, one account, 22 chains](docs/diagrams/explainer.svg)

How it fits together — the full box-by-box trace is in [How Bawa works](docs/HOW-IT-WORKS.md).

Bawa is an open-source reference for HD-wallet workflows and an AI Wallet Builder. Give it one plain request — "Create a Web wallet" — and it produces a real project from resources that actually exist: real derivation, real balances and prices from public endpoints, no invented figures, no fake money. The example wallet cannot send funds: broadcast stays disabled.

- **Self-custodial by construction.** Keys are generated and held locally in the browser; your recovery phrase never leaves your machine.
- **Real data only.** Balances and prices come from public read-only endpoints. When a provider cannot be reached, a balance shows as unavailable — never as an invented figure.
- **22 chains out of the box, 168 in the guide.** The example wallet ships with 22 chains enabled. The guide covers the full Trust Wallet Core registry of 168 chains.
- **Open source, MIT.** The guide, the registries, the starters, and the example wallet.

If you arrived looking for a wallet to hold funds, read [If you want a wallet to use](#if-you-want-a-wallet-to-use) first. Bawa is builder material, not a wallet product.

## Quickstart

Install Node **22** (`22.23.4` verified) and Python **3.12+**. For the Android starter, also install **JDK 17** and **Android SDK 35**.

```sh
git clone --branch panel-rebuild/token-gaps https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

Start the one-prompt workflow from the repo root:

```sh
node scripts/build-wallet.mjs "Create a Web wallet"
```

Replace the Web request with an Android or multi-chain request for those targets. Or use the menu launcher:

```sh
python3 tools/bawa_cli.py
```

To run the example web wallet directly, follow [Create the example web wallet](docs/CREATE-EXAMPLE-WALLET.md): `cd apps/web && npm ci && npm run build && npm run preview`.

Check the generator from the repo root:

```sh
cd tools/hdwallet-gen && npm ci && npm test
```

**Verified expected result:** in a clean clone of this branch, exit `0`, `217` checks pass, `0` fail. The output includes:

```text
All register-links checks passed
```

## The example web wallet

The web wallet in `apps/web` is a fully functional example wallet built using this guide. It runs entirely in the browser: create or import a wallet, add a watch-only wallet, and see real balances. Broadcast stays disabled, so it cannot send funds.

- Create, import (24/25 words) and watch-only wallets; multiple accounts from one phrase; bulk account creation.
- 22 native assets plus 21 default tokens (43 rows), with live prices.
- Receive with a QR card and three templates — address, payment request, share link — plus copy and share.
- Add Token adds a token by contract address, and can enable any of the 22 chains.
- Send walks through a stepped flow, but broadcast stays disabled, so nothing is ever sent.

To run it, follow [docs/CREATE-EXAMPLE-WALLET.md](docs/CREATE-EXAMPLE-WALLET.md). To understand how it fits together, read [How Bawa works](docs/HOW-IT-WORKS.md) — two Mermaid diagrams (how it starts, what it can do), each box traced to a real file.

## Chain support

The example wallet enables **22 chains** by default: btc, eth, trx, ton, sol, bsc, matic, arb, op, base, avax, ltc, doge, gnosis, celo, linea, mantle, scroll, opbnb, metis, aurora, fantom. The list is `SUPPORTED_CHAINS` in `apps/web/src/wallet/chains.ts` and `chainSupport` in `registry/capabilities.json`.

Do not confuse that number with the guide's number. The guide covers the full Trust Wallet Core registry of **168 chains**. The example wallet enables 22 of them. Add Token adds more tokens by contract address and can enable any of the 22 chains; a chain outside the 22 cannot be added from the wallet, it needs a change to the registry first.

Network operations are verified for btc, eth, trx, ton only. The 18 additional chains are scoped to the multichain-extended-wallet profile. See the [docs index](docs/index.md) for the per-chain status.

## How it works

The guide (`docs/`, sixteen sections, plus the machine-readable `registry/`) tells a person — or an AI agent — how to build a complete wallet from resources that actually exist. The example web wallet (`apps/web/`) is the working proof of that guide. The builder (`scripts/build-wallet.mjs`, `tools/bawa_cli.py`) routes one plain request to the right starter and build steps.

[How Bawa works](docs/HOW-IT-WORKS.md) explains it in plain terms, with two Mermaid diagrams kept as text in the Markdown file — not images — so they stay in step with the code. The full step-by-step version is [Create the example web wallet](docs/CREATE-EXAMPLE-WALLET.md).

## Documentation

The single entry point for Bawa documentation is [docs/index.md](docs/index.md).

| You need | Read |
| --- | --- |
| Full manual | [docs/README-FULL.md](docs/README-FULL.md) — the previous 1,308-line README, preserved with only its link paths adjusted |
| Guide map | [docs/README.md](docs/README.md) |
| Docs index | [docs/index.md](docs/index.md) |
| How it works | [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) |
| Create the example wallet | [docs/CREATE-EXAMPLE-WALLET.md](docs/CREATE-EXAMPLE-WALLET.md) |
| Builder routing | [WALLET_BUILDER.md](WALLET_BUILDER.md) |
| Repository instructions | [AGENTS.md](AGENTS.md) |
| Capability map | [docs/CAPABILITY-MAP.md](docs/CAPABILITY-MAP.md) |
| Wallet lifecycle | [docs/wallet-lifecycle.md](docs/wallet-lifecycle.md) |
| Security | [SECURITY.md](SECURITY.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Licence | [LICENSE](LICENSE) |

## Configuration

| Item | Value or command |
| --- | --- |
| Builder request | `"Create a Web wallet"`; use an Android or multi-chain request for those targets |
| Menu launcher | `python3 tools/bawa_cli.py` |
| Routed launcher | `python3 tools/bawa_cli.py --route "Create a Web wallet"` |
| Wallet engine | `@trustwallet/wallet-core` `4.9.3` |
| Web starter libraries | Dependencies: `@scure/bip39` `2.4.0`, `decimal.js` `10.6.0`, `dinero.js` `2.0.2`, `mnemonic-words` `2.0.0`; devDependency (test oracle): `bip39` `3.1.2` (bitcoinjs/bip39); Python requirement: `mnemonic==0.21` (trezor/python-mnemonic). See ADR-0005. |

Use the starters:

- [Web starter](WALLET_BUILDER.md): `apps/web` — React 19 + Vite + Tailwind; MIT.
- [Android starter](WALLET_BUILDER.md): `apps/android` — Kotlin + Compose + Material 3; Apache-2.0.

![Bawa Balanced UI direction for builder output](docs/ui-ux-assets/direction-04-bawa-balanced.png)

*Bawa Balanced UI direction for builder output — not a screenshot of the running starter.*

## Security and honest limits

Use Bawa as a reference for [HD-wallet workflows](docs/README-FULL.md) and as a [builder](WALLET_BUILDER.md) that turns one plain request into a real, buildable project. It is **not** a hosted wallet, custody service, or exchange.

- Mainnet send/broadcast is not implemented; broadcast stays disabled. The repository is mainnet-first in direction but testnet-safe in behaviour; read the [mainnet gap assessment](docs/archive/mainnet-gap-assessment.md).
- The example wallet has never sent a transaction on any network, has no backup store for the vault, and recovery rehearsal has never been executed. If you want a ready-made wallet to hold funds, use a production wallet instead.

### Passphrase policy

Bawa uses BIP-39, 24 words, with an empty BIP-39 passphrase. Record the passphrase policy alongside the mnemonic: the same mnemonic with a different passphrase is a different wallet.

If a restored wallet looks empty, re-derive your recorded first address with the recorded path and recorded BIP-39 passphrase policy. If it matches, the restore used the recorded inputs — that alone does not prove funds exist. If the recorded first address itself shows no funds on the recorded network, do not conclude the funds were never sent to that address: the address may have received and subsequently spent funds. Never re-fund a guess. See the [full manual](docs/README-FULL.md) for the troubleshooting table.

Found a security issue? Report it through [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues), and never include a mnemonic, private key or other recovery material — in an issue, a screenshot, or a support message.

## If you want a wallet to use

Bawa is builder material: a reference and a starter kit, not a wallet product. If you arrived looking for a wallet to hold funds:

1. **Do not use this repository as your wallet.** The web starter is a reference implementation.
2. **Use a production wallet** (for example Trust Wallet, whose engine this repo's starter is built on) for real funds.
3. **If you want to try the starter**, cold-test it with a disposable wallet: create a fresh wallet in `apps/web`, write the phrase down on paper, lock and unlock it, import it watch-only, and delete the vault afterwards. Never fund it, and never import a phrase that holds real funds. The lifecycle is documented in [docs/wallet-lifecycle.md](docs/wallet-lifecycle.md).

## Contributing

Follow [CONTRIBUTING.md](CONTRIBUTING.md) when you contribute. Report bugs through [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues) using the bug report template there.

## Licence

MIT — see [LICENSE](LICENSE).

## Maintainers

The repository owner, **Pr3eve6ti2o**, maintains Bawa.

## Project history

Recent programmes, each with its full record, gates and branch state in `docs/`:

- **UI/UX Fixes programme (2026-11-23)** — 21 items, merged into `panel-rebuild/token-gaps` (merge commit `4eb0242`). Record: [docs/UI-UX-FIXES-PROGRAMME.md](docs/UI-UX-FIXES-PROGRAMME.md).
- **UI/UX Round 2 programme (2026-11-23)** — 10 items, merged into `panel-rebuild/token-gaps` (merge commit `6147b74`). Record: [docs/UI-UX-ROUND2-PROGRAMME.md](docs/UI-UX-ROUND2-PROGRAMME.md).
- **Reverify + Professional Polish programme (2026-11-23)** — five lanes, merged into `panel-rebuild/token-gaps` (fast-forward to `ccb8195`). Record: [docs/REVERIFY-PROGRAMME.md](docs/REVERIFY-PROGRAMME.md).
- **Marketing Fix + Found-Bugs programme (2026-11-23)** — first-impression defects, found bugs, value proposition, README rewrite, architecture diagrams, branch cleanup, QR templates, browser-first re-verification; merged into `panel-rebuild/token-gaps` (merge commit `571f0fb`). Record: [docs/MARKETING-FIX-PROGRAMME.md](docs/MARKETING-FIX-PROGRAMME.md).

No code from these programmes was merged into `adopt-proper` or `main`. The durable preview (GitHub Pages) still serves the saved adopt-proper-based build; to preview this branch, check out `panel-rebuild/token-gaps` and run the web starter locally.
