# Bawa

> **Security first:** Never share mnemonics, private keys or data keys. xpubs/zpubs are privacy-sensitive. Generate secrets in a trusted offline environment; keep online work watch-only. Keep `secrets/` at `0700`, and `seed.enc.json` and `.env` at `0600`.

## 1. What Bawa is

Bawa (`Pr3eve6ti2o/bawa`) is a practical open-source reference for HD-wallet workflows and an **AI Wallet Builder**. A human or AI agent starts with one plain request—such as “Create an HD wallet” or “Create a Bitcoin watch-only wallet”—and uses the repository’s tools and blueprints to build a real, buildable project.

It helps organise wallet development, separate secret handling from public-root derivation, and independently check the covered results. Project targets include:

- HD wallets and Bitcoin watch-only wallets.
- Web or Android crypto wallets.
- Cryptocurrency payment tracking, monitoring and reconciliation tools.
- Wallet recovery utilities.

**Bawa is a guide and blueprint first**, not a hosted wallet, custodian, exchange, node client or security audit. An AI agent must implement, build and test capabilities that are documentation-only.

### Implemented on main

- **Wallet generation:** `tools/make_wallet.py` is an interactive terminal tool using Trust Wallet Core **4.8.4 WASM**. It generates a **24-word BIP-39 mnemonic with an empty BIP-39 passphrase** and writes encrypted `seed.enc.json` using **AES-256-GCM**, AAD `nova-shop-seed-v1` and file mode `0600`.
- **Watch-only derivation:** `derive.js`, `derive_daemon.js` and `compare.js` in `tools/hdwallet-gen` operate from **public roots only**.
- **Decryption/recovery check:** `tools/decrypt_seed.py` defaults to `secrets/seed.enc.json`. This executable check is not a completed recovery rehearsal.
- **Verification tools:** derivation/comparison checks and a limited independent BTC/ETH comparison are available; their scope is recorded below.

### Pinned derivation scope

All paths use **account 0**; indexed receiving paths use **branch 0 only**.

| Chain | Pinned path |
|---|---|
| BTC — zpub | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` |
| TRX | `m/44'/195'/0'/0/i` |
| TON — address only | `m/44'/607'/0'` |

TON has **no xpub**, and the derivation tools have **no TON mode**.

### What still needs development

Web/Android applications, payment tracking, monitoring, reconciliation and broader recovery utilities require new implementation and testing. **Web and Android starters exist only on the feature branch, not on main.**

Main contains **no transaction construction, signing or broadcast code**, and **no balance retriever**. Documentation must not be mistaken for implemented or tested functionality.

## 2. Getting started

### Prerequisites

- Node.js **`>=22 <23`**
- Python **`>=3.11`**

Observed verification environment: **Node `v22.23.4`** and **Python `3.12.3`**.

### Clone and install

```sh
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
npm --prefix tools/hdwallet-gen install
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Launch Bawa

From the repository root:

```sh
python3 tools/bawa_cli.py
```

The interactive launcher welcomes you with:

> Welcome to Bawa! Your AI-powered cryptocurrency development guide. What would you like to create or work on?

It routes each choice to an existing executable tool or, when the capability is documentation-only, to the **exact documents an AI agent must follow**. A documentation route is not a finished application.

## 3. The five-option launcher

| Option | Status on main |
|---|---|
| **1. Create an HD wallet** | **Existing executable tool:** the interactive wallet generator writes an encrypted seed file; it does not construct, sign or broadcast transactions. |
| **2. Create/configure a watch-only wallet** | **Existing executable tool** for public-root derivation; **AI-guided implementation** for application/configuration work beyond those tools. No balance retriever or TON derivation mode is provided. |
| **3. Build a wallet application (Web/Android)** | **AI-guided implementation:** follow the respective guides. Starters are **unavailable on main**; Android build and on-device validation are **unverified**. |
| **4. Build cryptocurrency tools (payment tracking, monitoring, reconciliation)** | **AI-guided implementation:** develop and test the required application and integrations; these are not implemented trackers or monitoring services on main. |
| **5. Security, recovery and development** | **Existing executable tools** for decryption and limited verification; **AI-guided implementation** for further work. The recovery rehearsal is **unverified and its gate is FAIL**. |

## 4. AI routing summary

Start with [AGENTS.md](AGENTS.md) for the full routing table, then **read only the documents relevant to the request**.

- **HD-wallet, watch-only or cryptocurrency-tool work:** select the relevant numbered guides through the [documentation map](docs/README.md).
- **Web application:** follow the [Web guide](docs/web-wallet/WEB-GUIDE.md).
- **Android application:** follow the [Android guide](docs/android-wallet/ANDROID-GUIDE.md).
- **Security, recovery or verification:** use the routed [security guidance](docs/SECURITY.md), [recovery documentation](docs/RECOVERY.md) and [testing documentation](docs/TESTING.md), as relevant.
- **Mainnet work:** apply the separate-change requirement below; do not infer readiness from a document or a derivation result.

Reuse existing executable tools where appropriate. Write, build and test missing code, and report anything not executed as **unverified**. Never present a blueprint as implemented or an untested feature as working.

## 5. Mainnet-first direction

The owner’s direction is **mainnet-first**; testnet is a secondary/testing concern. That direction is not yet delivered: **mainnet is absent from the current main guide set**.

Any mainnet work is a **separate, reviewed change**. The linked mainnet document does not establish implemented support or readiness. Bawa makes **no mainnet or production-readiness claim**.

## 6. Documentation map

| Topic | Documents |
|---|---|
| **Map and numbered guides 01–16** | [Documentation map](docs/README.md), covering the sequence from [01: Fundamentals](docs/01-fundamentals/README.md) through [16: Security decision guide](docs/16-security-decision-guide/README.md). Use the map to reach the intermediate guides. |
| **Wallet application blueprints** | [Web guide](docs/web-wallet/WEB-GUIDE.md) · [Android guide](docs/android-wallet/ANDROID-GUIDE.md) |
| **Mainnet document** | [Mainnet guide](docs/mainnet/MAINNET-GUIDE.md) — not evidence of mainnet support or readiness |
| **Security and recovery** | [Security guidance](docs/SECURITY.md) · [Recovery](docs/RECOVERY.md) · [Repository security](SECURITY.md) |
| **Testing** | [Testing and verification](docs/TESTING.md) |
| **Reference and help** | [References](docs/REFERENCES.md) · [Glossary](docs/GLOSSARY.md) · [FAQ](docs/FAQ.md) |
| **Changes** | [Changelog](CHANGELOG.md) |

## 7. Essential commands

Run from the repository root with the virtual environment active, except where noted.

1. `python3 tools/bawa_cli.py` — Launch the five-option interactive Bawa guide.
2. `python3 tools/make_wallet.py` — Run the interactive 24-word wallet generator and write encrypted `seed.enc.json`.
3. `echo "<zpub>" | node derive.js btc 1` — Run from `tools/hdwallet-gen` to derive BTC receiving index 1 from a public zpub only.
4. `python3 tools/decrypt_seed.py` — Run the seed decryption/recovery check, using `secrets/seed.enc.json` by default.
5. `python3 test/differential_test.py` — Independently compare BTC and ETH derivation at **index 0 only** against `bip-utils`.

## 8. Gates and status

**Partially verified: 2026-11-08.** Verification pin: `e3b65fb8`; main at `16c074e`.

| Area | Recorded status |
|---|---|
| **Derivation and comparison** | Derive **9/9**; compare **9/9**. |
| **Independent verification** | BTC/ETH **index 0 only** versus `bip-utils`; not full published-vector coverage. |
| **Root checks** | `npm test` and `npm run check` delegate to `tools/hdwallet-gen`; these checks are not a security audit. |
| **Recovery rehearsal** | **FAIL gate — never executed.** The decryption tool’s existence does not satisfy this gate. |
| **Live testnet spend** | No live testnet spend has ever been made. |
| **Android validation** | No debug APK has ever been built; the on-device Android gate has never been run. |
| **Release gates** | **5 of 6 unmet:** root lockfile, full published-vector coverage, secret/dependency scanning, reproducible releases and external security review. |
| **Readiness** | Mainnet and production readiness are **not established**. |

The full current README is preserved at [docs/README-FULL.md](docs/README-FULL.md).