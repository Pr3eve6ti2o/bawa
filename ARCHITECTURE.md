# Architecture

Bawa on `main` contains local wallet-generation and recovery tools, public-root derivation tools, and documentation. This file maps the code and the boundaries you must preserve when changing it.

Start with `README.md` for project orientation, `CONTRIBUTING.md` for contribution instructions and `AGENTS.md` for agent instructions. `docs/README.md` is the documentation map.

## Executable code

The executable tools live under `tools/`. There are three distinct responsibilities.

### Request routing: `tools/bawa_cli.py`

The five-option interactive launcher routes a request either to an existing executable tool or to the exact documents an AI agent must follow — or to a target absent on `main`, which must be labelled unavailable.

**Warning:** documents and tools referenced by launcher routes may be absent on `main`.

The launcher is a routing layer, not an implementation of every capability described in the guides. It routes requests to existing tools and documents, but also to targets absent on `main`: 3 absent executables and 1 absent registry data file (`registry/profiles.json`); no documents are absent. Absent targets must be labelled unavailable, and routing must preserve the distinction between executable workflows and instructions for work not implemented on `main`.

### Secret handling: `tools/make_wallet.py`, `tools/decrypt_seed.py`, and `tools/hdwallet-gen/generate.js`

`make_wallet.py` is the interactive 24-word wallet generator. It writes the encrypted seed file, `seed.enc.json`.

`decrypt_seed.py` provides seed decryption and a recovery check. Its default input is `secrets/seed.enc.json`.

`tools/hdwallet-gen/generate.js`, invoked by `make_wallet.py`, is also a secret-handling tool: it creates the 24-word mnemonic, encrypts it, and displays it with the warning "SEED PHRASE (24 words) — write down OFFLINE, never share".

These are the secret-handling tools. Their local, trusted offline execution environment is part of the boundary, not an optional deployment detail.

### Watch-only tooling: `tools/hdwallet-gen/`

This directory contains the Node tools:

- `derive.js`
- `derive_daemon.js`
- `compare.js`
- `extended-key.js`
- `generate.js`

`derive.js`, `derive_daemon.js`, `compare.js`, and `extended-key.js` operate from public roots only. `generate.js` is a secret-handling tool: it creates, encrypts, and displays the 24-word mnemonic. A filename alone does not determine whether a tool handles secrets; its behavior does.

The directory has its own `package.json` and `package-lock.json`. Keep that dependency boundary distinct from the root `package.json`; the root also contains `requirements.txt` for Python dependencies.

Public data is the hand-off between wallet generation and watch-only tooling. `tools/hdwallet-gen/` is a mixed directory: the mnemonic originates in `generate.js`, which creates, encrypts and displays it. `generate.js`, `make_wallet.py` and `decrypt_seed.py` handle secrets. A mnemonic, decrypted seed or other secret must not enter the public-roots-only `derive.js`, `derive_daemon.js`, `compare.js` or `extended-key.js` in `tools/hdwallet-gen/`.

## Protected contracts

- The public-roots-only boundary in `tools/hdwallet-gen/` applies to `derive.js`, `derive_daemon.js`, `compare.js` and `extended-key.js`, not the whole directory: no secret ever enters those tools. The directory is mixed: it also contains secret-handling `generate.js`, where the mnemonic originates. Wallet generation and decryption — handled by `generate.js`, `make_wallet.py` and `decrypt_seed.py` — run locally in a trusted offline environment.
- Pinned derivation: account 0, branch 0 only. BTC zpub m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i; TON m/44'/607'/0' (address only, no xpub). Trust Wallet Core 4.9.3 WASM. BIP-39 24 words, empty passphrase. AES-256-GCM, AAD `nova-shop-seed-v1`. `secrets/` mode 0700, `seed.enc.json` and `.env` mode 0600.
- What deliberately does NOT happen on main: no transaction construction, signing or broadcast; no balance retriever; no live network spend; Web and Android starters exist only on the feature branch, not on main. Documentation is not implementation.
- Boundaries that must hold: `tools/hdwallet-gen/` is a mixed directory, with the mnemonic originating in `generate.js`; secret handling stays in `tools/hdwallet-gen/generate.js`, `make_wallet.py` and `decrypt_seed.py` and never leaks into the public-roots-only `derive.js`, `derive_daemon.js`, `compare.js` or `extended-key.js` in that directory; the launcher never logs secrets; README/docs changes ship with the behaviour changes they describe.

## Documentation

`docs/` contains guides 01–16, covering fundamentals, chains, wallet generation, watch-only use, tracking, security and recovery, signing and hardware, operations and testing, verification, and wallet-app design. Reference, glossary, FAQ, recovery, security and testing documents sit alongside them.

`docs/web-wallet/`, `docs/android-wallet/` and `docs/mainnet/` contain guides. They are documentation areas, not application implementations on `main`.

Use `docs/README.md` to find the relevant guide and `IMPLEMENTATION.md` for implementation context. A capability described in a guide is not evidence that executable code for it exists on this branch.

## Tests and CI

`test/` separates several checks:

| File | Responsibility |
| --- | --- |
| `differential_test.py` | Compares BTC and ETH index 0 against `bip-utils`. |
| `smoke.test.js` | Node smoke tests. |
| `test_bawa_cli.py` | Launcher unit tests. |
| `test_make_wallet.py` | Seed-bundle validation tests only (`assertBundleVerified`, `assert_bundle_decrypts`, and `_parse_seed_bundle`); no generation, /dev/tty prompts, or encryption round trip. |

`.github/workflows/ci.yml` runs on pushes and pull requests using Node 22 and Python 3.13. It runs `npm install` in `tools/hdwallet-gen/`, checks JavaScript syntax, runs the smoke tests, installs Python reference-test dependencies and runs the differential test.

That CI sequence does not run the launcher or wallet-generator unit tests. Do not treat it as coverage of every test under `test/`.

## Making changes

Put routing changes in `tools/bawa_cli.py`, secret-handling changes in `tools/make_wallet.py`, `tools/decrypt_seed.py`, and `tools/hdwallet-gen/generate.js`, and public-root tooling changes in `tools/hdwallet-gen/`. For new code, do not introduce secret handling into the launcher or the watch-only tools.

Update the relevant tests and ship the README/docs changes with the behaviour they describe. Keep documentation-only work distinguishable from executable functionality.