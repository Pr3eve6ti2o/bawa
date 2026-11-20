# Bawa

[![CI (static-checks)](https://github.com/Pr3eve6ti2o/bawa/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Pr3eve6ti2o/bawa/actions/workflows/ci.yml?query=branch%3Amain)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

Bawa is an HD-wallet reference and command-line launcher for generating encrypted seed files, deriving watch-only addresses, and security and recovery checks, with AI-guided build routes.

## Quickstart

Run this route check from the repository root:

```bash
python3 tools/bawa_cli.py --route "create an HD wallet"
```

Expected output:

```text
Route: Create an HD Cryptocurrency Wallet
Kind: [EXISTING TOOL]
Details: python3 tools/make_wallet.py
Command (shown, not executed): python3 tools/make_wallet.py
```

`--route` prints a route and never executes it. If no route matches, it prints `No route matched for: <request>`, then the main menu, and exits with status `2`.

## Installation

- Node.js `>=22 <23`, tested with `v22.23.4`.
- Python `>=3.11`, tested with `3.12.3`; CI uses `3.13`.

Requirements: `cryptography 50.0.2`, `bip-utils 2.12.3`, and `mnemonic 0.21`.

Clone `main`, install the Node.js dependencies, then create and activate a Python virtual environment and install the Python requirements:

```bash
git clone --branch main https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
npm --prefix tools/hdwallet-gen install

python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Usage

| Option | Purpose | Tools or route |
| --- | --- | --- |
| 1 | HD wallet | Existing tool: `tools/make_wallet.py` |
| 2 | Watch-only wallet | Existing tools: `tools/hdwallet-gen/derive.js`, `tools/hdwallet-gen/derive_daemon.js`, `tools/hdwallet-gen/compare.js` |
| 3 | Wallet application (Web/Android) | AI-guided; starters unavailable on `main` |
| 4 | Cryptocurrency tools | AI-guided |
| 5 | Security, recovery and development | Existing tools plus AI-guided work |

**Verified results:** At `667527e`, smoke tests reported `SMOKE TESTS PASSED`, with 136 checks and 0 failures; the launcher suite ran 48 tests, `OK`; the `make_wallet` suite ran 26 tests, `OK`; the differential test reported `bip_utils reference checks: PASS`. At index 0, BTC was `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` and ETH was `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the `bip-utils` version caveat.

Do not treat these checks as a mainnet or production-readiness claim.

## Architecture

On `main` at HEAD `667527e` (verified 2026-11-20), Bawa's launcher prints routes and never executes them. Secret-handling tools sit inside a trust boundary; public-roots-only tools, documentation routes and unavailable printed routes sit outside it.

```mermaid
flowchart TB
  accTitle: Bawa main at 667527e: route-only architecture
  accDescr: The CLI prints routes without executing them; secret-handling tools sit inside a trust boundary: M uses Trust Wallet Core 4.9.3 WASM and writes encrypted seed.enc.json using AES-256-GCM with AAD nova-shop-seed-v1 and file mode 0600; G exports verifySeedBundle and readDataKeyFromFd; D defaults to secrets/seed.enc.json. Outside the boundary, H lives in tools/hdwallet-gen/ and holds public-roots-only tools: derive_daemon.js is a JSONL daemon; compare.js compares addresses from public roots; the paths are BTC m/84'/0'/0'/0'/i, ETH m/44'/60'/0'/0'/i and TRX m/44'/195'/0'/0'/i; extended-key.js validates extended keys before WASM. Also outside the boundary, the AI-guided documentation route covers guides 01 to 16, and three launcher targets are unavailable.

  U1["Executable tool route: UNAVAILABLE<br/>scripts/build-wallet.mjs<br/>Missing on main; not working"]
  U2["Executable tool route: UNAVAILABLE<br/>scripts/generate-project.mjs<br/>Missing on main; not working"]
  U3["Executable tool route: UNAVAILABLE<br/>tools/hdwallet-gen/derive-ton.js<br/>Missing on main; not working"]

  R["CLI tool<br/>tools/bawa_cli.py<br/>5 menu options<br/>--route: one match<br/>Prints routes only<br/>Never runs routes"]

  H["Opt 2: public roots only<br/>derive.js: BTC/ETH/TRX<br/>derive_daemon.js: JSONL<br/>compare.js: addr<br/>extended-key.js"]

  A["Docs 3/4: AI build guides 01-16<br/>Main: no wallet/apps/web<br/>No WALLET_BUILDER.md<br/>No sign/broadcast/balance fetch"]

  subgraph secrets["Trust boundary<br/>Secret-handling tools"]
    M["Executable tool<br/>Option 1: make_wallet.py<br/>24-word BIP-39<br/>Interactive generator<br/>AES-256-GCM seed.enc.json"]
    G["Executable tool<br/>Option 2: generate.js<br/>TON m/44'/607'/0'<br/>Single address; no xpub"]
    D["Executable tool<br/>Option 5: decrypt_seed.py<br/>Decrypt check<br/>Not a completed<br/>recovery rehearsal"]
  end

  %% Invisible layout constraints; the eight architecture edges remain below.
  U1 ~~~ U2
  U2 ~~~ U3
  U3 ~~~ R
  H ~~~ A
  A ~~~ D
  D ~~~ M

  R -.->|"1: printed route"| M
  R -.->|"2: printed route"| H
  R -.->|"3 and 4: printed routes"| A
  R -.->|"5: printed route"| D
  R -.->|"unavailable printed route"| U1
  R -.->|"unavailable printed route"| U2
  R -.->|"unavailable printed route"| U3
  M -->|"Data key over inherited pipe<br/>BAWA_DATA_KEY_FD"| G
```

### Inside the trust boundary

- **Option 1, `tools/make_wallet.py`:** an interactive 24-word BIP-39 generator using Trust Wallet Core 4.9.3 WASM. It writes encrypted `seed.enc.json` using AES-256-GCM, AAD `nova-shop-seed-v1` and file mode `0600`. It passes the data key to `generate.js` over the inherited pipe `BAWA_DATA_KEY_FD`, not through the environment. At `667527e`, `tools/make_wallet.py` calls `assert_bundle_decrypts` in its main flow.
- **`tools/hdwallet-gen/generate.js`:** reports the TON path `m/44'/607'/0'` for a single address, with no xpub. It exports `verifySeedBundle` and `readDataKeyFromFd`.
- **Option 5, `tools/decrypt_seed.py`:** a decryption check, not a completed recovery rehearsal.

### Outside the trust boundary

- **Public-roots-only tools:** `derive.js`, `derive_daemon.js`, `compare.js` and `extended-key.js`. The paths are BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i` and TRX `m/44'/195'/0'/0/i`.
- **Documentation routes, options 3 and 4:** guides 01 to 16. The `main` branch has no wallet app code, no `apps/web`, no `WALLET_BUILDER.md`, no signing or broadcast code, and no balance retriever.
- **Unavailable printed routes:** `scripts/build-wallet.mjs`, `scripts/generate-project.mjs` and `tools/hdwallet-gen/derive-ton.js`.

For the detailed design, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Repository structure

### Overview

```mermaid
flowchart RL
  accTitle: Bawa main structure at commit 667527e
  accDescr: Layout verified at commit 667527e, with grouped documentation.

  repo["Bawa main: 667527e"]
  repo --> root["Root files"]
  repo --> github[".github/"]
  repo --> tools["tools/"]
  repo --> tests["test/"]
  repo --> docs["docs/"]
  repo --> captcha["captcha/<br/>Vendored third-party reference code<br/>Not Bawa code or a feature"]
```

### Root files (1 of 2)

```mermaid
flowchart RL
  accTitle: Bawa Root files at commit 667527e, part 1 of 2
  accDescr: These seven files are direct children of Root files in the overview. The remaining seven files are shown in part 2.

  root["Root files"]
  root --> r1["AGENTS.md"]
  root --> r2["ARCHITECTURE.md"]
  root --> r3["CHANGELOG.md"]
  root --> r4["CONTRIBUTING.md"]
  root --> r5["IMPLEMENTATION.md"]
  root --> r6["LICENSE"]
  root --> r7["README.md"]
```

### Root files (2 of 2)

```mermaid
flowchart RL
  accTitle: Bawa Root files at commit 667527e, part 2 of 2
  accDescr: Six of these seven files continue part 1 as the remaining direct children of Root files in the overview. The seventh file, ci.yml, lives under .github/ and is shown there in the overview.

  root["Root files"]
  root --> r8["SECURITY.md"]
  root --> r9["package.json"]
  root --> r10["requirements.txt"]
  root --> r11[".env.example"]
  root --> r12[".editorconfig"]
  root --> r13[".gitignore"]
  root --> r14[".github/workflows/ci.yml"]
```

### tools/ - files

```mermaid
flowchart RL
  accTitle: Bawa tools/ files at commit 667527e
  accDescr: These three files are direct children of tools/ in the overview. Its fourth direct child, hdwallet-gen/, is shown in the next diagram.

  tools["tools/"]
  tools --> t1["bawa_cli.py"]
  tools --> t2["make_wallet.py"]
  tools --> t3["decrypt_seed.py"]
```

### tools/ - hdwallet-gen/

```mermaid
flowchart RL
  accTitle: Bawa tools/ hdwallet-gen/ at commit 667527e
  accDescr: hdwallet-gen/ is a direct child of tools/ in the overview. Arrows show its seven direct child files.

  hd["hdwallet-gen/"]
  hd --> h1["derive.js"]
  hd --> h2["derive_daemon.js"]
  hd --> h3["compare.js"]
  hd --> h4["generate.js"]
  hd --> h5["extended-key.js"]
  hd --> h6["package.json"]
  hd --> h7["package-lock.json"]
```

### test/

```mermaid
flowchart RL
  accTitle: Bawa main structure at commit 667527e - test/
  accDescr: Layout of test/ verified at commit 667527e.

  tests["test/"]
  tests --> s1["differential_test.py"]
  tests --> s2["test_bawa_cli.py"]
  tests --> s3["test_make_wallet.py"]
  tests --> s4["smoke.test.js"]
  tests --> s5["fixture-oracle-vectors.json"]
```

### docs/

```mermaid
flowchart RL
  accTitle: Bawa main structure at commit 667527e - docs/
  accDescr: Layout verified at commit 667527e, with grouped documentation under docs/.

  docs["docs/"]
  docs --> guides["Numbered guides<br/>docs/01 to docs/16<br/>README.md in each<br/>docs/06-tracking/providers.json"]
  docs --> loose["Loose docs files<br/>FAQ.md<br/>GLOSSARY.md<br/>REFERENCES.md<br/>RECOVERY.md<br/>SECURITY.md<br/>TESTING.md<br/>FURTHER-READING.md<br/>README.md<br/>README-FULL.md"]
  docs --> web["web-wallet/WEB-GUIDE.md"]
  docs --> android["android-wallet/ANDROID-GUIDE.md"]
  docs --> mainnet["mainnet/MAINNET-GUIDE.md"]
```

### captcha/

```mermaid
flowchart RL
  accTitle: Bawa main structure at commit 667527e - captcha/
  accDescr: Layout verified at commit 667527e. captcha is vendored third-party reference code, not Bawa code or a feature.

  captcha["captcha/<br/>Vendored third-party reference code<br/>Not Bawa code or a feature"]
  captcha --> c1["README.md"]
  captcha --> c2["run-tronscan-check"]
  captcha --> c3["vendors"]
  captcha --> c4["package.json"]
  captcha --> c5["licenses"]
  captcha --> c6["package-lock.json"]
```


## Why this exists

Bawa separates mnemonic generation and encrypted storage from public-root derivation, with executable checks for the covered results. It is a guide and blueprint first, not a hosted wallet, custodian, exchange or security audit, and provides no node client.

Use a wallet application instead for balances, signing or broadcast. The `main` branch has no signing, broadcast or balance-retrieval code. Do not mistake documentation for implemented functionality.

## Features and status

**Existing tools:** Bawa includes `tools/make_wallet.py`; `derive.js`, `derive_daemon.js` and `compare.js` in `tools/hdwallet-gen`; and `tools/decrypt_seed.py`.

**AI-guided build routes:** Options 3 and 4 provide AI-guided build routes following guides 01 to 16 and the web-wallet and android-wallet guides. Starters are unavailable on `main`.

**Recorded test results:** All at `667527e`: smoke, 136 checks with 0 failures; launcher, 48 tests OK; `make_wallet`, 26 tests OK; differential `bip_utils` reference checks, PASS. See the [full records](docs/10-operations-and-testing/README.md). Passing tests do not establish production readiness.

**Mainnet-first direction:** The owner’s direction is mainnet-first, with testnet secondary. This has not yet been delivered. The [mainnet guide](docs/mainnet/MAINNET-GUIDE.md) exists but does not establish mainnet readiness.

## Security

Never share mnemonics, private keys or data keys; xpubs and zpubs are privacy-sensitive. Generate secrets in a trusted offline environment and keep online work watch-only. Keep `secrets/` at `0700` and `seed.enc.json` and `.env` at `0600`. See [SECURITY.md](SECURITY.md) and [docs/SECURITY.md](docs/SECURITY.md) for guidance.

## Documentation map

Use the full catalogue for individual document links rather than duplicating it here.

| Documentation | Where to find it |
| --- | --- |
| Tutorials, How-to, Reference and Explanation | [Full catalogue](docs/README.md) |
| Guides 01 to 16 | [Full catalogue](docs/README.md) |
| FAQ, GLOSSARY, REFERENCES, RECOVERY, SECURITY and TESTING | [Full catalogue](docs/README.md) |
| web-wallet, android-wallet and mainnet guides | [Full catalogue](docs/README.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security | [SECURITY.md](SECURITY.md) |

## Contributing

- Open an issue first.
- Fork the repository and submit a pull request to `main`.
- Run the checks in the [canonical command list in CONTRIBUTING.md](CONTRIBUTING.md) before requesting review.
- Link the issue in your pull request.

## Help

For troubleshooting answers and terminology, find the FAQ and GLOSSARY through the [documentation index](docs/README.md).

## Licence

Bawa is licensed under the MIT licence.

## Maintainers

Owner: `Pr3eve6ti2o`.

## Verification

Verified at commit `667527e` on 2026-11-20:

- Smoke: `136 checks 0 failures`
- Launcher: `48 tests OK`
- `make_wallet`: `26 tests OK`
- Differential: `bip_utils reference checks: PASS`

See the [full verification records](docs/10-operations-and-testing/README.md).

[`docs/README-FULL.md`](docs/README-FULL.md) is the frozen 2026-11-08 archive, with 1,285 lines and 81,316 bytes, whose header names the `e3b65fb8` snapshot. It is not a verbatim copy of that commit’s root README, which has 1,019 lines and 55,192 bytes, and it is not the file of the same name at tag `archive/hd-wallet-professional`.
