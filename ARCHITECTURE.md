# Architecture

Bawa on `main` contains local wallet-generation and recovery tools, public-root derivation tools, and documentation. This file maps the code and the boundaries you must preserve when changing it.

Start with `README.md` for project orientation, `CONTRIBUTING.md` for contribution instructions and `AGENTS.md` for agent instructions. `docs/README.md` is the documentation map.

## Executable code

The executable tools live under `tools/`. There are three distinct responsibilities.

### Request routing: `tools/bawa_cli.py`

The five-option interactive launcher routes a request either to an existing executable tool or to the exact documents an AI agent must follow.

The launcher is a routing layer, not an implementation of every capability described in the guides. Its routing must preserve the distinction between an executable workflow and instructions for work that is not implemented on `main`.

### Secret handling: `tools/make_wallet.py` and `tools/decrypt_seed.py`

`make_wallet.py` is the interactive 24-word wallet generator. It writes the encrypted seed file, `seed.enc.json`.

`decrypt_seed.py` provides seed decryption and a recovery check. Its default input is `secrets/seed.enc.json`.

These are the secret-handling tools. Their local, trusted offline execution environment is part of the boundary, not an optional deployment detail.

### Watch-only tooling: `tools/hdwallet-gen/`

This directory contains the Node tools:

- `derive.js`
- `derive_daemon.js`
- `compare.js`
- `extended-key.js`
- `generate.js`

All operate from public roots only. Names such as `generate.js` and `extended-key.js` do not make them secret-handling tools.

The directory has its own `package.json` and `package-lock.json`. Keep that dependency boundary distinct from the root `package.json`; the root also contains `requirements.txt` for Python dependencies.

Public data is the hand-off between wallet generation and watch-only tooling. A mnemonic, decrypted seed or other secret must not cross into `tools/hdwallet-gen/`.

## Protected contracts

- Derivation is public-roots-only in tools/hdwallet-gen: no secret ever enters those tools. Wallet generation and decryption are the only tools that touch secrets, and they run locally in a trusted offline environment.
- Pinned derivation: account 0, branch 0 only. BTC zpub m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i; TON m/44'/607'/0' (address only, no xpub). Trust Wallet Core 4.8.4 WASM. BIP-39 24 words, empty passphrase. AES-256-GCM, AAD `nova-shop-seed-v1`. `secrets/` mode 0700, `seed.enc.json` and `.env` mode 0600.
- What deliberately does NOT happen on main: no transaction construction, signing or broadcast; no balance retriever; no live network spend; Web and Android starters exist only on the feature branch, not on main. Documentation is not implementation.
- Boundaries that must hold: secret handling stays in make_wallet.py/decrypt_seed.py and never leaks into the watch-only derivation tools; the launcher never logs secrets; README/docs changes ship with the behaviour changes they describe.

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
| `test_make_wallet.py` | Wallet-generator tests. |

`.github/workflows/ci.yml` runs on pushes and pull requests using Node 22 and Python 3.13. It runs `npm install` in `tools/hdwallet-gen/`, checks JavaScript syntax, runs the smoke tests, installs Python reference-test dependencies and runs the differential test.

That CI sequence does not run the launcher or wallet-generator unit tests. Do not treat it as coverage of every test under `test/`.

## Making changes

Put routing changes in `tools/bawa_cli.py`, secret-handling changes in the two Python wallet tools, and public-root tooling changes in `tools/hdwallet-gen/`. Do not move secret handling into the launcher or the watch-only tools.

Update the relevant tests and ship the README/docs changes with the behaviour they describe. Keep documentation-only work distinguishable from executable functionality.