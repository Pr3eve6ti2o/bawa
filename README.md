# Bawa
Bawa is an HD-wallet reference and command-line launcher for developers and AI agents to generate encrypted seed files and derive watch-only addresses. [Try it](#try-the-launcher).

On `main`, Bawa (`Pr3eve6ti2o/bawa`) is an HD-wallet reference and command-line launcher for developers and AI agents to generate encrypted seed files and derive watch-only addresses. The one-prompt **AI Wallet Builder** capability exists only as feature-branch work and is not available on `main`.

> **Security first:** Never share mnemonics, private keys or data keys. xpubs/zpubs are privacy-sensitive. Generate secrets in a trusted offline environment; keep online work watch-only. Keep `secrets/` at `0700`, and `seed.enc.json` and `.env` at `0600`.

> **Archive notice:** [docs/README-FULL.md](docs/README-FULL.md) is the preserved 2026-11-08 record (e3b65fb8 snapshot), not the current README. For current verification, see section 8 of this README ("Current verification: 2026-11-15").

Never claim "secure", "safe", "secure because encrypted", "production-ready", "ready" or "ready for real money" about anything unverified. Never claim "audited" or "reviewed" without scope, reviewer, date and evidence.

## 1. What Bawa is

### Try the launcher

After [cloning and installing](#clone-and-install), run this route check from the repository root:

```sh
python3 tools/bawa_cli.py --route "create an HD wallet"
```

Expected output:

```text
Route: Create an HD Cryptocurrency Wallet
Kind: [EXISTING TOOL]
Details: python3 tools/make_wallet.py
Runs with inherited stdio; exact YES confirmation is required.
Command (shown, not executed): python3 tools/make_wallet.py
```

`--route` selects and prints a route without executing its command. If no route matches, the launcher prints `No route matched for: <request>`, then the main menu, and exits with status 2.

### Why this exists — and when not to use it

Bawa (`Pr3eve6ti2o/bawa`) separates mnemonic generation and encrypted storage from public-root derivation, with executable checks for the covered results.

**Bawa is a guide and blueprint first**, not a hosted wallet, custodian, exchange or security audit; this repository provides no node client. You or your AI agent must implement, build and test documentation-only capabilities.

Use a wallet application instead if you need to check balances or construct, sign or broadcast transactions.

### Implemented on main

- [Generate an encrypted seed file](#launch-bawa) with `tools/make_wallet.py`, an interactive terminal tool using Trust Wallet Core `4.8.4` WASM. It generates a **24-word BIP-39 mnemonic with an empty BIP-39 passphrase** and writes encrypted `seed.enc.json` using AES-256-GCM, AAD `nova-shop-seed-v1` and file mode `0600`.
- [Derive and compare watch-only addresses](#pinned-derivation-scope) with `derive.js`, `derive_daemon.js` and `compare.js` in `tools/hdwallet-gen`. These tools operate from **public roots only**.
- [Check decryption](#check-decryption) with `tools/decrypt_seed.py`, which defaults to `secrets/seed.enc.json`. This executable check is **not a completed recovery rehearsal**.
- [Verify derivation results](#verify-the-tools) with derivation/comparison checks and a limited independent BTC/ETH comparison. The recorded results and scope are below.

### Pinned derivation scope

All paths use **account 0**; indexed receiving paths use **branch 0 only**.

| Chain | Pinned path |
|---|---|
| BTC — zpub | `m/84'/0'/0'/0/i` |
| ETH | `m/44'/60'/0'/0/i` — path structure: [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki); SLIP-0044 registers only the hardened coin-type number, 60. |
| TRX | `m/44'/195'/0'/0/i` — path structure: [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki); SLIP-0044 registers only the hardened coin-type number, 195. |
| TON — address only | `m/44'/607'/0'` — Trust Wallet Core-provided path, reported as `ton_path` by `generate.js` (coin type 607). |

`generate.js` reports `ton_path` from Trust Wallet Core's `CoinTypeExt.derivationPath(CoinType.ton)` and checks `CoinType.ton.value === 607`. This implementation does not export or support BIP32-style xpub derivation for TON; the derivation tools have **no TON mode**.

### What still needs development

Web/Android applications, payment tracking, monitoring, reconciliation and broader recovery utilities require new implementation and testing. **Web and Android starters exist only on the feature branch, not on main.**

Main contains **no transaction construction, signing or broadcast code**, and **no balance retriever**. Documentation must not be mistaken for implemented or tested functionality.

**Qualifications (OI-062–OI-065)**

- **Supported-capabilities contract: not established.** Record support per surface and operation with cited verification; the V3 TON fixture alone does not establish application support. No supported-capabilities claim is made meanwhile.
- **Lifecycle contract: not established from the supplied evidence.** Guarantees and limits must be specified and verified before being claimed; none are claimed meanwhile.
- **Accessibility criteria and conformance: not established by the supplied evidence.** Define acceptance criteria and obtain Web and Android verification; no conformance claim is made meanwhile.
- **Operational/security ownership and vulnerability-disclosure procedure: not established by the supplied evidence.** Obtain maintainer-approved responsibilities, a reporting channel, and handling/escalation instructions, and publish them in `docs/10`. No ownership, disclosure procedure, reporting channel, or response commitment is claimed meanwhile.

## 2. Getting started

### Prerequisites

- Node.js **`>=22 <23`**
- Python **`>=3.11`**

Tested environment: **Node `v22.23.4`** and **Python `3.12.3`**.

### Clone and install

Clone `main` and install the Node dependencies:

```sh
git clone --branch main https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
npm --prefix tools/hdwallet-gen install
```

Verified install re-run output (a fresh install reports `added 14 packages` instead of `up to date`):

```text
up to date, audited 15 packages
found 0 vulnerabilities
```

Create and activate a Python environment, then install its dependencies:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Launch Bawa

From the repository root, run the interactive launcher:

```sh
python3 tools/bawa_cli.py
```

The interactive launcher welcomes you with:

> Welcome to Bawa! Your AI-powered cryptocurrency development guide. What would you like to create or work on?

It routes each choice to an existing executable tool or to the exact documents you or an AI agent must follow. A documentation route is not a finished application.

To generate a wallet, run the tool printed by the route check in a trusted offline environment:

```sh
python3 tools/make_wallet.py
```

### Verify the tools

Run the smoke tests from the repository root:

```sh
npm --prefix tools/hdwallet-gen test
```

Expected output:

```text
SMOKE TESTS PASSED
```

The smoke-test layer (`npm --prefix tools/hdwallet-gen test`) completed **130 checks with 0 failures**. The launcher unit-test layer (`python3 -m unittest discover -s test -p test_bawa_cli.py`) completed **25 tests**, with result `OK`.

The limited independent BTC/ETH differential test reported:

```text
bip_utils reference checks: PASS
```

The differential test that reported PASS ran with bip-utils 2.12.2, while the repository's `requirements.txt` pins `bip-utils==2.12.3`.

Recorded address results:

| Chain | Checked path | Address |
|---|---|---|
| BTC | `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |

Do not treat these checks as a mainnet or production-readiness claim.

### Check decryption

Run the executable decryption check in a trusted offline environment:

```sh
python3 tools/decrypt_seed.py
```

The default input is `secrets/seed.enc.json`. This checks decryption; it is not a completed recovery rehearsal.

## 3. The five-option launcher

Run the launcher:

```bash
python3 tools/bawa_cli.py
```

| Option | Status on main |
|---|---|
| 1. Create an HD wallet | **Existing executable tool:** [`tools/make_wallet.py`](tools/make_wallet.py) writes an encrypted seed file; it does not construct, sign or broadcast transactions. Find the relevant numbered guides in the [documentation map](docs/README.md). |
| 2. Create/configure a watch-only wallet | **Existing executable tools** for public-root derivation: [`derive.js`](tools/hdwallet-gen/derive.js), [`derive_daemon.js`](tools/hdwallet-gen/derive_daemon.js) and [`compare.js`](tools/hdwallet-gen/compare.js). **AI-guided implementation** for application and configuration work beyond those tools, using the relevant numbered guides in the [documentation map](docs/README.md). No balance retriever or TON derivation mode is provided. |
| 3. Build a wallet application (Web/Android) | **AI-guided implementation:** follow the [Web guide](docs/web-wallet/WEB-GUIDE.md) or [Android guide](docs/android-wallet/ANDROID-GUIDE.md). Starters are **unavailable on main**; Android build and on-device validation are **unverified**. |
| 4. Build cryptocurrency tools (payment tracking, monitoring, reconciliation) | **AI-guided implementation:** select the relevant numbered guides through the [documentation map](docs/README.md), then develop and test the required application and integrations. This option does not provide implemented trackers or monitoring services on main. |
| 5. Security, recovery and development | **Existing executable tools** for decryption and limited verification; **AI-guided implementation** for further work. Follow the [security guidance](docs/SECURITY.md), [recovery documentation](docs/RECOVERY.md) and [testing documentation](docs/TESTING.md), as relevant. The recovery rehearsal is **unverified and its gate is FAIL**. |

## 4. AI routing summary

Start with [AGENTS.md](AGENTS.md) for the full routing table, then **read only the documents relevant to the request**.

The launcher routes a request to an existing executable tool or to documents an AI agent must follow.

```mermaid
flowchart TD
    request["Request"] --> launcher["python3 tools/bawa_cli.py"]

    launcher -->|"1: HD wallet"| seed["Existing tool<br/>tools/make_wallet.py"]
    launcher -->|"2: public-root derivation"| derive["Existing tools<br/>tools/hdwallet-gen/derive.js<br/>tools/hdwallet-gen/derive_daemon.js<br/>tools/hdwallet-gen/compare.js"]
    launcher -->|"5: decryption and limited verification"| verify["Existing decryption and limited verification tools"]

    launcher -->|"2–5: AI-guided implementation"| agents["Documentation route<br/>Start with AGENTS.md"]
    agents -->|"2 or 4: relevant numbered guides"| guides["docs/README.md<br/>Select the relevant guides 01–16"]
    agents -->|"3: Web"| web["docs/web-wallet/WEB-GUIDE.md"]
    agents -->|"3: Android"| android["docs/android-wallet/ANDROID-GUIDE.md"]
    agents -->|"5: select the relevant documents"| security["docs/SECURITY.md<br/>docs/RECOVERY.md<br/>docs/TESTING.md"]
```

**A documentation route is not a finished application.**

- For HD-wallet, watch-only or cryptocurrency-tool work, select the relevant numbered guides through the [documentation map](docs/README.md).
- For a Web application, follow the [Web guide](docs/web-wallet/WEB-GUIDE.md).
- For an Android application, follow the [Android guide](docs/android-wallet/ANDROID-GUIDE.md).
- For security, recovery or verification, use the routed [security guidance](docs/SECURITY.md), [recovery documentation](docs/RECOVERY.md) and [testing documentation](docs/TESTING.md), as relevant.
- For mainnet work, apply the separate-change requirement below. Do not infer readiness from a document or a derivation result.

Reuse existing executable tools where appropriate. Write, build and test missing code, and report anything not executed as **unverified**. Never present a blueprint as implemented or an untested feature as working.

## 5. Mainnet-first direction

The owner’s direction is **mainnet-first**; testnet is secondary, for testing. That direction is not yet delivered: **mainnet is absent from the current main guide set**.

Treat any mainnet work as a **separate, reviewed change**. The [mainnet guide](docs/mainnet/MAINNET-GUIDE.md) does not establish implemented support or readiness. Bawa makes **no mainnet or production-readiness claim**.

## 6. Documentation map

| Topic | Documents |
|---|---|
| Map and numbered guides 01–16 | [Documentation map](docs/README.md), covering the sequence from [01: Fundamentals](docs/01-fundamentals/README.md) through [16: Security decision guide](docs/16-security-decision-guide/README.md). Use the map to reach the intermediate guides. |
| Wallet application blueprints | [Web guide](docs/web-wallet/WEB-GUIDE.md) · [Android guide](docs/android-wallet/ANDROID-GUIDE.md) |
| Mainnet document | [Mainnet guide](docs/mainnet/MAINNET-GUIDE.md) — not evidence of mainnet support or readiness |
| Security and recovery | [Security guidance](docs/SECURITY.md) · [Recovery](docs/RECOVERY.md) · [Repository security](SECURITY.md) |
| Testing | [Testing and verification](docs/TESTING.md) |
| Reference and help | [References](docs/REFERENCES.md) · [Glossary](docs/GLOSSARY.md) · [FAQ](docs/FAQ.md) |
| Architecture | [Architecture](ARCHITECTURE.md) |
| Changes | [Changelog](CHANGELOG.md) |
| Preserved README | [Full preserved README](docs/README-FULL.md) |

## 7. Essential commands

These instructions describe the `main` worktree based on `3019b02` (staging commit `2bb9a98`), not a released version.

Run from the repository root with your virtual environment active, except where noted.

1. `python3 tools/bawa_cli.py` — Launch the five-option interactive Bawa guide.
2. `python3 tools/make_wallet.py` — Run the interactive 24-word wallet generator and write encrypted `seed.enc.json`.
3. `echo "<zpub>" | node derive.js btc 1` — Run from `tools/hdwallet-gen` to derive BTC receiving index 1 from a public zpub only. Replace `<zpub>` with your public zpub.
4. `python3 tools/decrypt_seed.py` — Run the seed decryption check, using `secrets/seed.enc.json` by default. This does not establish that a recovery rehearsal has been completed.
5. `python3 test/differential_test.py` — Independently compare BTC and ETH derivation at **index 0 only** against `bip-utils`.

## 8. Gates and status

**Current verification: 2026-11-15.** Checks ran in the main worktree identified above, using Node `v22.23.4` and Python `3.12.3`.

A gate that has not passed is **FAIL** by default — not "pending", not "in progress". Passing a gate does not prove the guide is safe, production-ready, or authorised for mainnet.

- `npm --prefix tools/hdwallet-gen install` — `up to date, audited 15 packages`; `found 0 vulnerabilities`.
- `npm --prefix tools/hdwallet-gen test` — `SMOKE TESTS PASSED`: **130 checks, 0 failures**.
- `python3 test/differential_test.py` — `bip_utils reference checks: PASS`, for **BTC and ETH at index 0 only**:
  - BTC: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - ETH: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`
- `python3 -m unittest discover -s test -p test_bawa_cli.py` — **25 tests, OK**.
- `python3 -m unittest discover -s test -p test_make_wallet.py` — **14 tests, OK**.

| Area | Recorded status |
|---|---|
| **Derivation and comparison** | Derive **9/9**; compare **9/9** — recorded under the **2026-11-08** verification (pin `e3b65fb8`) and reproduced hands-on on **2026-11-15** at `a5bc56e` using the published BTC/ETH/TRX fixture xpubs at indices **0–2**. These are fixture derivation/comparison counts, not test-suite totals. |
| **Independent verification** | BTC/ETH **index 0 only** versus `bip-utils`; not full published-vector coverage. |
| **Root checks** | `npm test` and `npm run check` delegate to `tools/hdwallet-gen`; these checks are not a security audit. |
| **Recovery rehearsal** | **Gate remains FAIL.** No recovery rehearsal is documented in the verification rounds. The decryption tool's existence does not satisfy this gate. |
| **Live testnet spend** | No testnet spend is documented in the repo. |
| **Android validation** | No Android APK build or on-device Android gate run is documented in the repo. |
| **Release gates** | **5 of 6 unmet:** root lockfile, full published-vector coverage, secret/dependency scanning, reproducible releases and external security review. **Met:** Chain-specific fixtures, including TON — **PASS** at `e3b65fb8` (README-FULL section 17). |
| **Readiness** | Mainnet and production readiness are **not established**. |

The historical 2026-11-08 README snapshot (e3b65fb8) is preserved at [docs/README-FULL.md](docs/README-FULL.md).
