---
title: Bawa Web wallet guide
seoTitle: Bawa Web wallet guide for four testnets
description: Build a non-custodial Web wallet from the Bawa repository for Bitcoin testnet4, Ethereum Sepolia, TRON Nile and TON testnet.
---

# Bawa Web wallet guide

> **Verified on**
>
> - **Verification status:** verified against the sources below, with the open items listed in each section
> - **Verified on:** 2026-11-08
> - **Verification scope:** Web wallet build on Trust Wallet Core, four testnets
> - **Repository commit:** `Pr3eve6ti2o/bawa` main at `e3b65fb832db287fdc8d54794980dd0b3456cc12`
> - **Tool versions observed:** Node v24.22.2 (outside the declared `>=22 <23` range), Trust Wallet Core 4.9.2, esbuild 0.25.5, Python 3.12.3 with bip-utils 2.12.2 and cryptography 50.0.2
> - **Environment:** Ubuntu 24.04 on the research VM
> - **Actually run:** differential test (PASS), endpoint probes of all four testnets, fixture derivations
> - **Not run:** live wallet creation and live restore in a real browser, Core 4.9.2 EIP-1559 re-run (both open items, sections [D](#d-vault-and-backup) and [F](#f-send-and-signing))
> - **Evidence:** repo clone at `082f7915`, validation-draft build logs
> - **Sources fetched on:** 2026-11-08

## A. Scope and starting points

Use this guide to build a non-custodial Web wallet for Bitcoin testnet4, Ethereum Sepolia, TRON Nile and TON testnet from the Bawa repo. Bawa supplies documentation and an engine reference; it is not a hosted wallet, a custody service or an exchange. You build the app by following this guide: fourteen screens, an encrypted local vault and watch-only derivation, using Trust Wallet Core. Follow only Web-specific steps here; use the repo guide for the derivation contract, fixture vectors, test taxonomy, release gates, repo-level troubleshooting and FAQ. Repo guide sections **13 (troubleshooting)** and **14 (FAQ)** are the canonical home for repo-level questions; this guide’s [Section K](#k-troubleshooting-by-symptom) covers only Web-specific recovery. Keep your build testnet-only. Mainnet is absent from this guide set; any mainnet work is a separate, reviewed change outside this set, and passing the gates does not authorise it.

### Contents

- [A. Scope and starting points](#a-scope-and-starting-points) — Confirm the testnet boundary, choose your route and locate the shared repo material.
- [B. Prerequisites and toolchain](#b-prerequisites-and-toolchain) — Clone and pin the repo, pin the toolchain, and set up the single build path.
- [C. Engine integration](#c-engine-integration) — Derive addresses from the fixed policy and pass the fixture gate.
- [D. Vault and backup](#d-vault-and-backup) — Build the encrypted local vault and the backup gate.
- [E. Connectivity](#e-connectivity) — Connect to the four testnets, fund test wallets, and keep freshness honest.
- [F. Send and signing](#f-send-and-signing) — Sign through Trust Wallet Core and track confirmations.
- [G. UI contract](#g-ui-contract) — Build the fourteen screens against the contract.
- [H. Testing](#h-testing) — Run the offline suite and the differential test, and record what is not covered.
- [I. Security documentation](#i-security-documentation) — Apply the never-claim list, incident response, and review scope.
- [J. Deployment, setup, and what is not built yet](#j-deployment-setup-and-what-is-not-built-yet) — Deploy the static files and state what is not built.
- [K. Troubleshooting by symptom](#k-troubleshooting-by-symptom) — Recover from Web-specific problems; repo-level questions go to repo guide sections 13 and 14.
- [Appendix — Optional pre-existing UI templates](#appendix--optional-pre-existing-ui-templates) — Ranked templates and the vetting checklist; using one is optional.

### Pick a starting point

- **New builders:** start at [Section B](#b-prerequisites-and-project-setup).
- **Builders who already have the repo:** start at [Section C](#c-engine-integration).
- **Builders verifying a build:** start at [Section H](#h-testing).

### Quick-start routes

**Node.js route.** Pair the repo’s `tools/hdwallet-gen/` JavaScript engine (Trust Wallet Core) with this guide’s [Section B build](#b-prerequisites-and-project-setup). You build the app from that engine reference and the Web-specific instructions. The Web validation draft (`app-web/`) is **local-only, in no repository**: treat it as validation evidence, not a shipped sample. Your build route is the repository engine plus Section B, not a checkout of the draft.

**Python route.** Use `tools/make_wallet.py`, `tools/decrypt_seed.py` and `test/differential_test.py` in the same Bawa repo, following repo guide sections **04** and **11**. Refer there for the shared workflow, and use this guide for Web-specific app work. The recorded differential-test PASS is evidence for that test only; it is not a live browser creation or restore result.

### Warning convention

Read every warning in this order: **consequence first, then the safe action, then the check or recovery**. Follow the action together with its check or recovery; do not treat the warning itself as evidence that a check passed. This guide assigns no severity levels.

### Terminology

Call the words the **mnemonic**, the 64-byte value the **seed**, and the file the **seed bundle**. Reserve **vault** for the encrypted store only; use **wallet** for the app. Keep those distinctions when you follow instructions or report a problem, so a reference to the file does not become a reference to the words, the encrypted store or the app.

### Sources

- **Bawa repo:** `Pr3eve6ti2o/bawa`, branch `main` at commit `e3b65fb832db287fdc8d54794980dd0b3456cc12`. Use its repo guide for the shared material and repo-level questions.
- **Trust Wallet Core repository:** <https://github.com/trustwallet/wallet-core>.

All links checked: **2026-11-08**.

### Open items

- **Live browser work — Section D:** live wallet creation and live restore in a real browser were performed on 2026-11-08 (V2: 14 PASS / 0 FAIL / 3 INFO across 17 steps, real headless browser). Live spend was not exercised (no testnet funds). See Doc 3, Consolidated open-items register, `OI-039`.
- **Core 4.9.2 EIP-1559 — Section F:** the demonstration was completed on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open. See Doc 3, Consolidated open-items register, `OI-004`.
- **Repo documentation:** docs **03** and **12** of the repo guide received a deep pass (D01–D16, 2026-11-08). The docs/12 findings are folded into the repo guide at merge; the docs/03 findings (D01–D09) are recorded in the merge notes and remain to be folded (OI-089). See Doc 3, Consolidated open-items register, `OI-017`.

## B. Prerequisites and toolchain

1. **Clone the repository and pin the checkout.**

   Clone Bawa first; this guide does not assume that you already have the repository. Use this setup for testnet only. Pin with the canonical procedure in the repository guide (Doc 1, §4): clone, then create a separate detached worktree at the pin — do not check the pin out in the directory you cloned into, or the corrected guide you are reading is replaced by the older text.

   ```sh
   git clone https://github.com/Pr3eve6ti2o/bawa.git
   cd bawa
   git worktree add --detach ../bawa-pinned e3b65fb832db287fdc8d54794980dd0b3456cc12
   cd ../bawa-pinned
   ```

   Every repository reference in this guide is written against `e3b65fb832db287fdc8d54794980dd0b3456cc12`. First-hand verification of this pinned checkout on 2026-11-08 included reading the files cited in the guide. Use those pinned files when following later sections rather than substituting a different checkout.

2. **Apply the runtime and dependency pins.**

   | Component | Declared value | Status |
   |---|---|---|
   | Node | `>=22 <23` | Declared range. The observed verification ran on Node v24.22.2, which is outside this range; the repository suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). |
   | Python | `>=3.11` | Observed version: 3.12.3. |
   | Trust Wallet Core (`@trustwallet/wallet-core`) | `4.9.2` | Exact pin: no `^` or `~`. Published 2026-11-06. |
   | esbuild — dev dependency | `0.25.5` | Exact pin: no `^` or `~`. |
   | http-server — dev dependency | Exact installed version; record during setup | Install it, record the installed version in `package.json` without `^` or `~`, and commit the lockfile with it. No numeric version is supplied here. |

   The repository now pins Trust Wallet Core (`@trustwallet/wallet-core`) to `4.9.3` (upgraded on 2026-11-13 after qualification run R08/E02; see Doc 4, section 21, M-21). The table above records the pins verified on 2026-11-08 at `e3b65fb8` for the demonstrated scope.

   Use the declared Node range for your setup. Do not treat the observed out-of-range run as verification on a runtime within that range.

   Core `4.8.4`, published 2026-09-24, is stale: six versions shipped between it and `4.9.2`. The upgrade matters because `4.8.7` fixed a keystore scrypt validation defect, and `4.9.1`/`4.9.2` added Zcash v5 transactions.

   The Web/WASM integration itself is unchanged: `dist/index.js` and `dist/index.d.ts` are byte-identical between `4.8.4` and `4.9.2`, `Ethereum.proto` is unmodified, and `initWasm()` is still called with no arguments.

   Before adopting any newer Core version, re-run the fixture gate (Section C) and the EIP-1559 signing proof (Section F) against that version, then record the date and version.

3. **Create the app lockfile without overstating the repository’s state.**

   The Bawa repository ships no root `package-lock.json`, and its guide calls that missing lockfile a release blocker. `tools/hdwallet-gen/package-lock.json` exists at e3b65fb832db287fdc8d54794980dd0b3456cc12 (Core 4.8.4 exact); the tools lockfile is present at the documented clone pin e3b65fb832db287fdc8d54794980dd0b3456cc12. `npm ci` requires an existing lockfile and fails without one, so it is not runnable against the repository root today.

   For the Web app itself, generate `package-lock.json` from a clean install using the pins above. Install `http-server` as a development dependency, inspect its installed version, and record that exact value in `package.json` without `^` or `~`. This makes the version a recorded fact rather than a floating install. Pin Core and esbuild exactly as shown in the table, and keep the app’s lockfile consistent with its manifest.

   Commit the app’s `package.json` and `package-lock.json` together. Use `npm ci` only for later app installs against those committed files.

   Keep the app and repository claims separate: the app’s lockfile does not imply that the Bawa repository ships one. Until the repository lockfile is committed and pushed, treat every “reproducible install” statement about that repository as aspirational.

4. **Use the single canonical browser build path.**

   Bundle for the browser with esbuild’s JavaScript API or CLI, using the `iife` output format. Keep this as one build recipe rather than maintaining separate, unconnected paths. Use `src/index.html` as the entry page and place the `.wasm` file beside the bundle.

   Configure browser aliases for `fs`, `fs/promises` and `crypto`. The Core loader requires `fs` and `crypto`. Do not add a `path` alias: nothing in the shipped package imports `path`.

   Call `initWasm()` with no arguments. Upstream provides no URL parameter to pass to that call. When serving under a path prefix, use the loader’s `locateFile` mechanism to point it at the `.wasm` file; do not pass the prefix as an argument to `initWasm()`.

   Serve `.wasm` as `application/wasm`. The loader uses `WebAssembly.instantiateStreaming`, which needs that MIME type, but it also has an ArrayBuffer fallback. A wrong MIME type may therefore make loading slower instead of causing a failure. A successful load alone does not prove that the server sent the correct type: verify it in the deploy checklist (Section J).

   Account for the changed asset size when checking the build: the `.wasm` grew from 10,386,536 bytes in `4.8.4` to 10,419,822 bytes in `4.9.2`.

5. **Make the fixture gate a startup barrier.**

   Run the differential test from the pinned repository, using the commands in Section C. Require the expected result: **`PASS`, exit `0`**.

   Make the app refuse wallet operations until the Section C fixture gate passes. Leave operations blocked if the gate has not run or has failed. Do not treat a successful dependency install, bundle or page load as a substitute for this check. Loading the interface must not, by itself, enable wallet operations.

6. **Serve the built files locally over HTTP.**

   Use a static server for local development. From the directory containing the built files, start the installed, exactly pinned `http-server`:

   ```sh
   http-server
   ```

   This command serves the built files over HTTP. Open the app’s entry page through that server in your browser, using your own server’s local HTTP address. There is no shared localhost link to open on another machine.

   Keep the fixture barrier active during local development. Opening the page does not remove the requirement for the gate to pass before you use wallet operations.

### Sources

All sources checked on 2026-11-08.

- **Bawa repository:** `main` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`, using the pinned checkout and clone URL in step 1.
- **[npm registry metadata for `@trustwallet/wallet-core` 4.9.2](https://registry.npmjs.org/@trustwallet/wallet-core/4.9.2):** use this endpoint as the citable link. The npmjs website’s package page returns `403` to automated checks because of bot protection, not because the package is missing.
- **[Trust Wallet Core repository](https://github.com/trustwallet/wallet-core).**

### Open items

- The Bawa repository still lacks a root `package-lock.json`; its guide treats this as a release blocker. `tools/hdwallet-gen/package-lock.json` exists at e3b65fb832db287fdc8d54794980dd0b3456cc12 (Core 4.8.4 exact). See Doc 3, Consolidated open-items register, `OI-042`.
- The Core `4.9.2` EIP-1559 signing-proof demonstration is complete for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open (Section F). See Doc 3, Consolidated open-items register, `OI-004`.
- The integrated browser flow has had an end-to-end run (Section D): V2, 2026-11-08, 14 PASS / 0 FAIL / 3 INFO across 17 steps in a real headless browser. Live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.

## C. Engine integration

### Fixed derivation policy

| Policy | Fixed value |
|---|---|
| Bitcoin testnet4 | `m/84'/0'/0'/0/i`, account key prefix `zpub`, account 0, receiving branch 0 only. |
| Ethereum Sepolia | `m/44'/60'/0'/0/i`, `xpub`. |
| TRON Nile | `m/44'/195'/0'/0/i`, `xpub`. |
| TON testnet | generation only, from `m/44'/607'/0'`, single deposit address, no extended public key. |
| Creation policy | BIP-39, 256-bit entropy, 24 words, empty passphrase. |

Treat the repo guide’s derivation contract, section 9, as the authority; use this section for Web deltas only. Keep the paths fixed because the repo, differential test and validation draft all derive from the same policy. A different path or a non-empty passphrase derives different addresses. Restore with the wrong path or passphrase and your wallet looks empty: the funds are not lost, but they are unreachable from this policy.

### Account-prefix and coin-type deviations

**Expect `zpub`, not `vpub`.** In `generate.js`, the Bawa tools export the Bitcoin account key by explicitly requesting `HDVersion.zpub` from Trust Wallet Core. The emitted prefix is therefore `zpub` on testnet4 too. The prefix is a serialisation choice; it does not select the network—the endpoint does. When you paste the key into a tool that checks prefixes, expect `zpub`, not `vpub`.

For the network-mismatch check, check the endpoint first: if your configured endpoint is not testnet4, the derived addresses will not match the testnet4 explorer.

**Keep the pinned coin type.** Bawa uses coin type `0` on testnet4. SLIP-0044 reserves coin type `1` for testnet, and SLIP-0132 assigns testnet native-SegWit keys the `vpub` prefix. The repo’s own signing document (`docs/09`) teaches testnet descriptors at `m/84'/1'/0'`; do not substitute that path here. Import a Bawa mnemonic into a standard testnet wallet and you derive a different account, which looks empty. Do not change the pinned implementation. Document the deviation and its consequence, and consult the repo guide for the policy decision.

Offline fixtures verify derivation conformance; they do not imply mainnet connectivity. Keep runtime networks to Bitcoin testnet4, Ethereum Sepolia, TRON Nile and TON testnet only.

### Fixture gate

1. **Check the repo’s canonical ripple pair before creation or import.** The mnemonic below is Trust Wallet Core’s own published HDWallet test example, with entropy `ba5821e8c356c05ba5f025d9532fe0f21f65d594`.

   | Mnemonic | Passphrase | Path | Expected address | Source |
   |---|---|---|---|---|
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | Repo canonical pair; mnemonic from Core’s published HDWallet example. |
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | Repo canonical pair; mnemonic from Core’s published HDWallet example. |

   **Use the empty passphrase.** Core’s own test table uses `TREZOR`, which gives a different seed and, by BIP-39's construction, different addresses; Bawa uses the empty passphrase.

   The fixture phrase is 15 words because it is a published test vector; real wallets you create with this guide are 24 words. The word count changes the seed. Never mix a 15-word test phrase into a 24-word wallet flow.

2. **Round-trip the account-0 public nodes: parse, serialise, compare.** All three were Core-confirmed in a recorded run (D31, 2026-11-08); treat them as canonical.

   | Mnemonic | Passphrase | Path | Expected account-0 public node | Source |
   |---|---|---|---|---|
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/84'/0'/0'` | BTC: `zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9` | derived with bip-utils 2.12.2 from the published fixture mnemonic; Core-confirmed (D31, 2026-11-08) |
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/44'/60'/0'` | ETH: `xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc` | derived with bip-utils 2.12.2 from the published fixture mnemonic; Core-confirmed (D31, 2026-11-08) |
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/44'/195'/0'` | TRX: `xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF` | derived with bip-utils 2.12.2 from the published fixture mnemonic; Core-confirmed (D31, 2026-11-08) |

3. **Check the TRON anchor.** Run Core’s `getAddressForCoin(tron)` on the ripple mnemonic with an empty passphrase and record the result. The anchor is Core-confirmed (D31, 2026-11-08).

   | Mnemonic | Passphrase | Path | Expected address | Source |
   |---|---|---|---|---|
   | `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` | Empty | `m/44'/195'/0'/0/0` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | bip-utils-derived, Core-confirmed (D31, 2026-11-08) |

The TON fixture is recorded in the repo guide, docs/11, "TON fixture (V3, 2026-11-08)": Wallet V4 R2, wallet ID 698983191, workchain 0, `m/44'/607'/0'`. Testnet forms of the same account: bounceable `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo`, non-bounceable `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt`. The upstream WASM parity corpus exists (`wasm/tests/` at tag 4.9.2, 22 files); Node parity was 6/6 MATCH on Core 4.9.2 and 4.8.4 (D30, 2026-11-08), and the in-browser run on 4.9.2 remains open.

The Android guide uses the same repo canonical ripple pair (Android guide, section D.7 fixture gate). Do not pair one fixture’s words with another fixture’s address.

### Reproduce the differential test

1. **Create and activate a Python virtual environment.**

   ```sh
   python3 -m venv .venv
   . .venv/bin/activate
   ```

2. **Install from the repo’s `requirements.txt`.** It pins `cryptography==50.0.2` and `bip-utils==2.12.2`.

   ```sh
   python3 -m pip install -r requirements.txt
   ```

3. **Run the differential test and check its result.**

   ```sh
   python3 test/differential_test.py
   ```

   Expect `bip_utils reference checks: PASS`, BTC `bc1qpsp72…`, ETH `0xA3Dcd…` and exit status `0`.

A bare run without the virtual environment fails with `ModuleNotFoundError: No module named bip_utils`. Treat that as operator error against the documented procedure, not a repo defect.

### Create, import and enforce public-only boundaries

1. **Run the fixture gate first.** For creation, use BIP-39 with 256-bit entropy, 24 words and an empty passphrase.
2. **Validate an imported phrase before any derivation.** Keep the passphrase empty.
3. **Keep public-only derivation public-only.** Let only public keys leave the engine. Reject private extended keys at every public-only boundary. Never log key material.
4. **Use published BIP-32 test-vector private keys as negative fixtures for rejection tests, never for funds.** Include this BIP-32 test vector 1 root, derived from seed `000102030405060708090a0b0c0d0e0f`:

   ```text
   xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi
   ```

The repo’s `derive_daemon.js` chain labels (`btc`, `eth`, `trx`) do not establish testnet compatibility—the endpoint does.

Do not feed BTC testnet `vpub` or `tpub` keys to this `derive.js` workflow: with the tested Core WASM builds these inputs produce no address, only an opaque WASM-abort error. Changing only the derivation path does not fix this; a `zpub` with a testnet-looking path can instead produce a mainnet address. The path's first three levels are the caller's responsibility: Core derives from the key at the trailing change/index levels only. To re-encode a `bc1q…` P2WPKH address as `tb1q…`, keep witness version `0` and the identical 20-byte witness program, change the Bech32 HRP from `bc` to `tb` and recompute the checksum. Worked example: Bawa's `m/84'/0'` index-0 address `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (witness program `0c03e507f38033aca9ac5c32b32dce56051d097b`) re-encodes to `tb1qpsp72plnsqe6e2dvtsetxtww2cz36ztmrqny67`; the standards `m/84'/1'` program encodes to `tb1qq8p994ak933c39d2jaj8n4sg598tnkhnyk5sg5` (D31, 2026-11-08) (encoding arithmetic verified exact; fixture-seed derivation not independently re-derived here).

### Sources

All checked 2026-11-08.

- Repo `main` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`, `tools/hdwallet-gen/`; derivation contract, section 9, and signing document `docs/09`.
- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki).
- [Trust Wallet Core repository](https://github.com/trustwallet/wallet-core).
- SLIP-0044 and SLIP-0132, as cited by the repo guide.

### Open items

- The three account-0 public nodes and the TRX anchor are Core-confirmed (D31, 2026-11-08). See Doc 3, Consolidated open-items register, `OI-043`.
- The TON fixture is recorded in the repo guide, docs/11, "TON fixture (V3, 2026-11-08)". See Doc 3, Consolidated open-items register, `OI-044`.
- The upstream WASM parity corpus exists (`wasm/tests/` at tag 4.9.2); Node parity was 6/6 MATCH on 4.9.2 and 4.8.4 (D30, 2026-11-08). The in-browser run on 4.9.2 remains open. See Doc 3, Consolidated open-items register, `OI-045`.
- The testnet4 coin-type deviation is documented here and decided in the repo guide; do not change the pinned implementation here. See Doc 3, Consolidated open-items register, `OI-032`.

## D. Vault and backup

Use this section for testnet only.

### Vault construction and unlock policy

The Web app combines PBKDF2 with 600,000 iterations and AES-256-GCM. Its application-specific associated data (AAD) value is `"bawa-web-vault-v1"`.

That AAD deliberately differs from the repo’s `"nova-shop-seed-v1"`. A vault file made by this Web app is not compatible with the repo’s `seed.enc.json`. Do not substitute the Web vault file for that file or treat the two as interchangeable backups.

The 600,000-iteration count follows the OWASP 2023 password-hashing guidance cited by the repo guide. Require the app to define a vault unlock passphrase policy. No minimum length is in evidence; the value remains unset in the open items below. Do not infer a length requirement from the PBKDF2 iteration count.

### Session lifetime

Expect a 10-minute auto-lock. On lock, the vault key leaves memory and the app returns you to the locked screen. Treat that as the end of the unlocked session, not proof that every sensitive copy has disappeared. Garbage-collected strings and native copies may remain. Do not interpret the screen change as proof that those copies have gone.

### Complete the backup gate before receiving

The app must block your progress to receiving testnet funds until it has shown the mnemonic once and confirmed your full-phrase re-entry. The at-most-once disclosure rule and the confirmation gate both apply; a display alone does not complete the backup or reveal procedure.

1. Read the backup screen. It must state plainly that the mnemonic is your only recovery path, and identify what the app clears and when.
2. Record the phrase during its one permitted disclosure. Do not depend on a second reveal.
3. Re-enter the entire mnemonic for confirmation. Do not treat a partial re-entry as satisfying the gate.
4. Proceed to receive testnet funds only after the app has shown the phrase once and accepted the full-phrase confirmation. If either condition is missing, stop; the app must keep the gate closed.

The specified lock cleanup removes the vault key on lock. The evidence does not specify clearing events for the displayed phrase or confirmation text. Require those rules explicitly on the backup screen; do not infer them from leaving it.

### Keep the phrase off the clipboard

The app must never write the mnemonic to the clipboard. Do not paste it into any other app or field: copying a phrase through the clipboard exposes it to any app that reads the clipboard. Re-enter the words yourself in the confirmation gate. Needing the full phrase is not an exception to the clipboard rule, and an app-provided clipboard shortcut would contradict it.

### What the numbers mean

The mnemonic’s 24 words encode 256 random bits plus 8 checksum bits. The checksum adds no independent randomness; the empty passphrase contributes no additional secret. Keep that empty BIP-39 passphrase distinct from the vault unlock passphrase policy. Seed-guessing resistance is separate from randomness quality, implementation security and device compromise: do not treat entropy as an end-to-end assurance. This paragraph is the Web summary of the canonical note in the repo guide’s FAQ.

### Recovery compatibility

Use the per-asset recovery checklist in the repo guide's Short FAQ (Doc 1, README section 14); keep that checklist in its canonical location rather than maintaining another copy here.

Treat a recovery wallet whose stated capabilities appear to match the checklist as theoretically compatible, not as a tested recovery route. What was actually tested is derivation conformance via the differential test and the fixture gate in Section C. Do not turn that result into a claim that you have tested recovery in another wallet or completed the integrated Web flow.

### Verification status

Treat this guide as vector-verified and refusal-verified for creation and restore: the integrated browser flow was run on 2026-11-08 (V2) in a real headless browser — 14 PASS / 0 FAIL / 3 INFO across 17 steps, covering the fixture gate, 24-word creation, all four chains showing addresses, and a vault round trip through reload, with 0 console errors. Live spend was not exercised (no testnet funds were available).

> **Recorded run — V2, 2026-11-08**
>
> **Result:** 14 PASS / 0 FAIL / 3 INFO across 17 steps, real headless browser. Live wallet creation and live restore are verified; live spend remains open.
>
> **Check:** Find the recorded run, including its date and browser, in Doc 3, Consolidated open-items register, `OI-039`.

### Signing boundary

Bawa contains no transaction construction or signing implementation; signing exists only in the built apps, via Trust Wallet Core 4.9.2.

### Sources

- Repo `main` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.
- OWASP 2023 password-hashing guidance, as cited by the repo guide.
- WebCrypto references: [`Pbkdf2Params`](https://developer.mozilla.org/en-US/docs/Web/API/Pbkdf2Params) and [`AesGcmParams`](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) — both live, checked 2026-11-08.

### Open items

- **Integrated browser flow:** run on 2026-11-08 (V2: 14 PASS / 0 FAIL / 3 INFO across 17 steps). Live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.
- **Vault unlock passphrase:** minimum length unset; define and document the required policy. See Doc 3, Consolidated open-items register, `OI-046`.
- **Core 4.9.2 EIP-1559:** demonstration complete for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open — Section F. See Doc 3, Consolidated open-items register, `OI-004`.
- **Live creation/restore:** performed in the V2 browser run (2026-11-08). See Doc 3, Consolidated open-items register, `OI-039`.
- **Backup-screen cleanup:** state explicitly what clears the displayed phrase and confirmation text, and when. See Doc 3, Consolidated open-items register, `OI-047`.
- **FAQ link:** resolved — the per-asset recovery checklist lives in the repo guide's Short FAQ (Doc 1, README section 14).

Checked against repo docs 06 (tracking), 07 (payment tracking), 13 (wallet app architecture) and 14 (wallet app implementation) on 2026-11-08 before writing; the rules below are consistent with those docs.

## E. Connectivity

### One contract per chain

Keep each chain’s providers behind one adapter contract covering native balances, token balances, paginated history, address monitoring, unsigned transaction construction, fee estimation, broadcast and confirmation tracking. Normalise responses in the adapter; do not scatter provider calls through UI components. Report unsupported capabilities explicitly, never as a successful empty result.

Keep the engine offline: it must never call the network. Keep wallet keys out of the network layer. Pass adapters only public queries and signed payloads, never mnemonics, seeds, private keys or vault data keys.

Derive addresses locally. Never upload an extended public key (xpub) to a remote service. An xpub cannot sign, but exposing it discloses an ongoing address catalogue. Treat fallback providers and multi-provider comparisons as additional disclosures, not invisible implementation details.

### Testnet configuration

#### Bitcoin testnet4

1. **Enter testnet4 explicitly.** Configure `https://mempool.space/testnet4/api` as your mempool.space testnet4 API endpoint ([REST reference](https://mempool.space/docs/api/rest)). Do not substitute testnet3: it is not interchangeable with testnet4.

2. **Obtain test funds.** Open the [mempool.space testnet4 faucet](https://mempool.space/testnet4/faucet). Create an account and sign in, link your GitHub account, and verify your email address; then submit your locally derived testnet4 address and choose a sats amount within the server-set minimum and maximum. Select "Request Testnet4 Coins". The faucet applies per-address and per-IP limits.

3. **Check the setup.** Confirm that your funded address shows its balance on the testnet4 explorer and that the first derived address matches Section C. Dated successful probe example (2026-11-08): testnet4 tip height `159848`. Use this to recognise the shape of a successful probe, not as a fixed live height: heights change.

#### Ethereum Sepolia

1. **Enter Sepolia.** Use `https://ethereum-sepolia-rpc.publicnode.com`, the public, keyless JSON-RPC endpoint, for state, fees and broadcast. Use `https://eth-sepolia.blockscout.com/api/v2`, the Blockscout indexer, for address history ([API reference](https://docs.blockscout.com/devs/apis)). Before you construct **every signing input**, query `eth_chainId` and require the decoded value `11155111`. Block signing on an error or mismatch. Carry that ID in the input and enforce it again offline; checking only at startup is insufficient.

2. **Obtain test funds.** Use the [Alchemy Sepolia faucet](https://sepoliafaucet.com/). It offers 0.1 ETH per 24 hours under current eligibility rules; limits change often. Eligibility requires at least 0.001 ETH on mainnet, enough real mainnet transactions, and a low testnet balance; a brand-new wallet is not automatically eligible. If you are not eligible, use the [QuickNode Sepolia faucet](https://faucet.quicknode.com/ethereum/sepolia) as a fallback.

3. **Check the setup.** Confirm that `eth_chainId` returns `0xaa36a7` (verified 2026-11-08) and that your funded address shows on the Sepolia explorer. Dated probe example (2026-11-08): chain head `12090390`; Blockscout `total_blocks` `12090067` (a stale cached counter — see item 4 under "Freshness is part of the result").

The Ethereum Foundation announced Sepolia’s retirement, with end of support on 30 September 2026. The timeline is still in flux; the PublicNode endpoint above was verified live on 2026-11-08.

Use the keyless PublicNode endpoint by default; [Alchemy](https://www.alchemy.com/docs/reference/ethereum-api-quickstart) is a keyed alternative. If you use a keyed provider, keep its key in a restricted server-side relay, never in code, committed configuration or a browser bundle. Web build-time environment variables are public, not secret storage.

#### TRON Nile

1. **Enter Nile.** Configure `https://nile.trongrid.io` as your TronGrid Nile endpoint ([network reference](https://developers.tron.network/docs/networks)). Keep Nile separate from Shasta and every other network.

2. **Obtain test funds.** Open the [Nile faucet](https://nileex.io/join/getJoinPage), paste your wallet address and complete the on-page check. The faucet currently advertises 1,000 test TRX per request. Check the faucet page for the current amount. Each wallet and IP address can request once per 24 hours per token.

3. **Check the setup.** Confirm that your funded address shows on the Nile explorer. Dated probe example (2026-11-08): observed tip block `72533195`. Treat this as an example observation, not the block number a live probe must return.

#### TON testnet

1. **Enter TON testnet.** Configure `https://testnet.toncenter.com/api/v2` as your Toncenter testnet API endpoint. Keep its endpoint and cached state separate from those of every other network. Do not use address formatting alone as a network check.

2. **Obtain test funds.** Open the Telegram [Testgiver TON bot, @testgiver_ton_bot](https://t.me/testgiver_ton_bot) and send `/start`, then choose "Get 2 GRAM in testnet". Complete the captcha image, then supply your testnet address, and verify the testnet address when asked. The allowance is 2 testnet GRAM per hour. Alternative: the [Acton testnet faucet](https://ton-blockchain.github.io/acton/docs/wallets#fund-a-wallet-on-testnet).

3. **Check the setup.** Confirm that your funded address shows on the testnet explorer. Dated probe example (2026-11-08): masterchain sequence number `96593997`, `ok:true`. Use this as an example of successful output, not a fixed current sequence number.


### Freshness is part of the result

1. Record the outcome and last-success time for every refresh. Advance the last-success time only when that feed refreshes successfully. Track freshness separately for each balance, each token and each history feed; a successful update to one must not make the others look current.
2. Surface every failed refresh as **Not refreshed** (`NotRefreshed` in code). Retain previous balances and history, visibly marked stale. If a feed has never loaded successfully, show unavailable data for that feed, not an invented balance. Never translate timeouts, rate limits, authentication errors, malformed responses or failed pagination into zero balances or empty history.
3. Make address monitoring cancellable. Treat broadcast acceptance as submitted, not confirmed. Keep submission, pending observation, inclusion and execution outcome as distinct states, rather than a single success flag. Track inclusion and define the confirmation policy, including thresholds, separately for each chain and testnet network. Do not use one universal confirmation number. Allow confirmation state to move backwards after a reorganisation.
4. Never treat Blockscout’s `total_blocks` as the chain head: it is a stale cached counter. Checked 2026-11-08, it lagged the RPC head by 267 blocks at 11:32 and 323 blocks at 11:44. History from the indexer must be reconciled against the RPC. Never present a `total_blocks` figure as the current head.

Repository docs 06, 07 and 13 confirm all of these requirements.

### Token balances without guesswork

1. Identify a token by **network + contract address + verified decimals**. Treat display names and symbols as untrusted metadata, never as identity. For TON jettons, use the master contract, not a holder’s jetton-wallet contract.
2. Verify decimals through chain-appropriate token data or an independently reviewed, network-scoped registry. If decimals are missing or conflicting, leave the asset unresolved: do not guess, format a decimal balance or enable decimal amount entry. Familiar defaults such as 18, 6 or 9 are not verification.
3. Separate token discovery from balance reading. Treat an indexer’s token list as discovery data, not authority. If a token is omitted, do not infer that its balance is zero: the omission is not a balance result.

Token-balance reading is specified here. Token management and token sends are unimplemented; see Section J.

### Operating rules

1. Set a deadline for each request and for the overall operation. Apply per-endpoint rate limits. Bound retries and use backoff and jitter; retry transient failures only. Check the remaining operation time before each retry. Honour `Retry-After` headers; if the required wait exceeds the remaining deadline, stop rather than retry early.
2. Validate API-level errors as well as HTTP status; a successful HTTP status does not by itself establish a successful API result. Limit read-only probes to one retry, subject to the transient-failure and deadline rules. Never retry write operations automatically.
3. After an ambiguous broadcast, check the transaction identifier before you decide whether to resubmit identical signed bytes. Keep that decision outside the automatic retry path. Never rebuild and sign a replacement as an automatic retry.
4. Keep API keys out of code, committed configuration and browser bundles. Include only placeholders in the checked-in `.env.example`. Never put real mnemonics, private keys, seeds or data keys in examples, fixtures, logs or telemetry.

### Discovery limits

Restrict discovery to receiving-branch addresses in the validation draft. Change-branch derivation does not exist; increasing the index cannot discover change addresses. Apply a documented gap policy: use consecutive addresses with no transaction history to terminate a bounded scan. Do not treat a completed bounded scan as proof that nothing exists beyond it. Keep a previously used address marked as used even after its balance reaches zero. Retain known issued indices and extend discovery when activity appears.

### Sources

- The five testnet endpoint URLs listed in part 1 of Section E.
- mempool REST docs.
- Blockscout API docs.
- TRON network docs.
- Alchemy API quickstart.
- [Ethereum JSON-RPC docs](https://ethereum.org/developers/docs/apis/json-rpc/) — canonical URL, checked 2026-11-08.
- [TRON — getting testnet tokens](https://developers.tron.network/docs/getting-testnet-tokens-on-tron), checked 2026-11-08.
- [TON — get coins](https://docs.ton.org/onboarding/wallet-apps/get-coins), checked 2026-11-08.
- Repository docs 06, 07, 13 and 14 at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.

### Open items

- Faucet evidence last re-verified from muse-vm (VM egress) on 8 November 2026. At build time, re-check faucet availability, account and eligibility requirements, amounts, limits and documentation links. See Doc 3, Consolidated open-items register, `OI-048`.
- Do not assume a local regtest/signet stage exists for any chain: none is implemented. Section H states this exclusion. See Doc 3, Consolidated open-items register, `OI-049`.
- Change-branch discovery is unimplemented. See Doc 3, Consolidated open-items register, `OI-050`.

## F. Send and signing

Bawa contains no transaction construction or signing implementation. Signing exists only in the built apps, via Trust Wallet Core 4.9.2. The repo’s engine derives public keys and addresses; the app builds unsigned transaction inputs, Core signs them, and the app broadcasts signed bytes. Use this flow for testnet only.

### QR payment-request scanning — testnet only

Scanning is in scope (user decision, 2026-11-08). This section specifies the
testnet scanning behaviour; the implementation is not yet built.

**Purpose.** Let a sender pay a payment request shown as a QR code, by scanning
it with the device camera, without typing the address. Scanning runs on testnet
only and never touches a mainnet network.

**Entry.** From the Send flow, offer **Scan** next to the address field. The
scanner opens only after the user taps Scan; it never opens automatically.

**Steps.**

1. **Request camera permission and a secure context.** Request `getUserMedia`
   with `{ video: { facingMode: "environment" } }` and require a secure context
   (HTTPS outside local development; loopback development only). If permission
   is denied or no camera is available, show the failure message and return to
   the Send form with the address field unchanged.
2. **Decode with the guarded decoder.** Use `qr-scanner@1.4.2` with its bundled
   worker. Native `BarcodeDetector` is an optimisation only: use it when
   `getSupportedFormats()` includes `qr_code`, and only after the local
   known-QR check passes. Never decode through a server.
3. **Show the parsed request before applying it.** Stop capture, then display
   the full address, asset and amount. Compare the full address against the
   selected chain and network before applying. Apply only after the user
   confirms the displayed request.
4. **Revalidate at signing.** The `signing` step revalidates the canonical
   payload and freezes it; a scanned request is never signed from a stale or
   re-decoded value.

**Guards.** Capture runs in the foreground only, and only after camera
permission is granted. On success, error, timeout, Cancel, navigation, tab
hide, lock, or chain change: stop the tracks and the decoder, discard late
results, and never auto-resume. The scanner never opens an encoded link.

**Failures and Cancel messages.** Use exactly these strings:

- Camera unavailable: `Camera unavailable.`
- Permission denied: `Camera permission denied; check site settings.`
- No code in frame: `No QR code found.`
- Unreadable code: `Cannot read QR code.`
- Not a supported payment request: `Unsupported payment request.`
- Wrong network: `Request does not match selected network.`
- Unsupported amount: `Amount is not supported.`
- More than one code in frame: `Show only one payment QR code.`

**Payload formats (D25).** Parse the decoded text with
`E.parsePaymentRequest`, then verify it with `E.verifyPaymentRequest` against
the selected network, recipient and associated request. Approved forms only:

| Chain | Approved payload form |
|---|---|
| BTC (testnet4) | BIP-321: `bitcoin:?tb=<ADDRESS>&amount=<BTC>` |
| ETH (Sepolia) | ERC-681: `ethereum:pay-<ADDRESS>@11155111?value=<WEI>` (`@11155111` mandatory; `pay-` prefix) |
| TON (testnet) | `ton://transfer/<ADDRESS>?amount=<NANO>&text=<MEMO>` — never `bin`, `jetton` or `exp` |
| TRX (Nile) | Bare address only |

**Out of scope.** Non-payment QR codes, other barcode types, scanning from a
saved image, scanning on the Receive screen, and any server-side decoding.

**Open / build items.** Session timeout duration; the Scan UI, guard and
decoder; a dedicated worker or isolated signing boundary (a camera guard does
not supply that isolation); browser and camera coverage; loopback camera
verification; EIP-681 `@chainId` forms; `ton-test://`; bare BTC/ETH/TON
addresses in a QR; authoritative testnet-context checks; the decoder's
third-party notices inventory. See Doc 3, Consolidated open-items register,
`OI-038`.

### Signing ceremony

1. **Build the public transaction fields from validated app data.** Keep the unsigned input distinct from the signed bytes you intend to broadcast. Use only public fields at this stage; leave signing secrets to the key module.
2. **Obtain approval before signing.** Cover recipients, amounts, change, fees and contract calls. Make each of these part of the approval, not details the sender has to infer after signing.
3. **Bind approval to the exact transaction input.** Do not carry approval over to a different input. Keep the approved input as the reference for the later comparison with the signed result.
4. **Sign through Core’s single signing entry point** in the built app.
5. **Check the signing output for errors before accepting any returned bytes.** Stop on an error; the presence of bytes is not a substitute for checking the result.
6. **Decode the actual signed bytes with a chain-specific decoder.** Compare the decoded transaction against the approved intent, including recipients, amounts, change, fees and contract calls, plus chain/network, nonce, gas and data where applicable. Checking the unsigned input alone does not establish what will be broadcast. Block submission on a mismatch or decoding failure.
7. **Display the decoded transaction before an explicit broadcast action.** Base that display on the bytes you decoded, rather than displaying the unsigned request again. Broadcast only signed transaction bytes, never a signing input or an unsigned transaction. Do not turn a successful signature into an automatic send.

The signing coordinator holds no private keys; only the key module adds signing secrets. Keep secret-bearing messages inside that key-module boundary.

### Fees and recipient checks

1. **Include fees in balance and UTXO checks.** Covering the payment alone is not enough. If funds are insufficient, refresh network state and adjust your transaction before continuing. Do not let the app silently reduce your payment.
2. **Validate recipient addresses locally** before requesting a signature.
3. **Recompute fees when network state changes.** If the transaction changes, obtain fresh approval for the revised input before signing again. Never silently re-sign a changed transaction or reuse its earlier approval.

### Signing traps

> **Warning — EIP-1559:** Leaving `txMode` unset makes Core default to Legacy (`txMode` is `0`), so the signed transaction will not match an EIP-1559 approval.
>
> 1. Explicitly set Core’s `txMode` to protobuf enum value `1` (`Enveloped`). Supply `maxFeePerGas` and `maxInclusionFeePerGas`, mapping the latter from `maxPriorityFeePerGas`.
> 2. Confirm EIP-1559 in the approved payload, then verify that the signed bytes start with the EIP-2718 wire type byte `0x02` (transaction type `2`). Check that the decoded maximum-fee field matches the approved value. The protobuf enum must be `1`; the wire transaction type is `2`.

> **Warning — Bitcoin transaction identity:** An unchecked provider-returned identifier can make you track the wrong transaction.
>
> 1. Derive the expected transaction identifier locally using the chain’s rules. For Bitcoin, the transaction ID is the reversed double-SHA256 of the witness-stripped serialisation.
> 2. Match identifiers in broadcast responses against your locally derived value. Do not trust a provider-returned identifier without that check.

### Per-chain constraints

Apply these constraints alongside the common ceremony. A single signing entry point does not remove chain-specific fields or identifier rules.

| Chain | Constraints |
| --- | --- |
| Bitcoin | Check UTXO inputs, the fee and change outputs; use the witness-stripped txid described above. |
| Ethereum | Enforce chain ID `11155111` before every signing input (Section E), and check nonce, gas and data. |
| TRON | Use the Nile network only; look up transaction identifiers through the TronGrid Nile API. |
| TON | The repo is generation-only. In the app, use a sequence number, `expireAt` set to now plus 60 seconds, wallet version `2` (V4R2) and mode `3` for a TON transfer. Take the destination address from the address object’s data. Compatibility with any specific wallet is unverified. |

### Confirmation tracking

1. **Keep submission state, pending observations, inclusion and execution outcome distinct.** A submission response is not a replacement for checking inclusion or execution.
2. **Record the containing block’s identity and position**, then derive confirmation status against the current canonical chain. Re-evaluate that status as the canonical chain changes.
3. **Treat Bitcoin confirmation counts as increasing confidence, not absolute finality.** Where a chain exposes finality information, use it according to that chain’s rules rather than importing a Bitcoin-style threshold.
4. **Check execution outcome separately from inclusion.** An included contract transaction can still have failed execution and incurred fees. Do not describe inclusion alone as a successful contract call.
5. **Handle reorganisations as reversible application events.** Invalidate affected inclusions, restore the relevant discovery checkpoint, replay activity and recalculate balances. Previously displayed confirmations may fall; keep the displayed state consistent with the recalculation.
6. **Handle replacement, expiry and dropped transactions explicitly.** Absence from one server is not sufficient evidence that a transaction has disappeared everywhere.
7. **Treat a broadcast timeout as unknown submission status.** A timeout establishes neither acceptance nor rejection. Query by transaction ID before retrying identical signed bytes; do not automatically create a replacement transaction.

### Sources

All sources checked 2026-11-08.

- Repo `main` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.
- [Trust Wallet Core repository](https://github.com/trustwallet/wallet-core).
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559).
- [Ethereum JSON-RPC docs](https://ethereum.org/developers/docs/apis/json-rpc/).
- Repo docs 09 and 13.

### Open items

The EIP-1559 demonstration was completed on Core 4.9.2 for the construction/signing demonstration scope (D21, 2026-11-08). The in-browser proof, send, sign and broadcast remain open. See Doc 3, Consolidated open-items register, `OI-004`.

- TON compatibility with any specific wallet is unverified. See Doc 3, Consolidated open-items register, `OI-051`.
- Live creation/restore performed in the V2 browser run (2026-11-08); live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.

## G. UI contract

### Boundaries and guards

Keep your UI at the presentation and intent boundary. Show public data and signed-payload status, never secrets. Keep secret input — the mnemonic, its display and its re-entry — in isolated ceremonies in the key module (Section D), never in a general-purpose form or a template’s state. Route phrase handling from your create, import and backup screens into those ceremonies rather than taking ownership of it.

Do not redefine derivation paths or introduce UI-owned key storage. Preserve transaction review: your UI cannot skip, hide or reorder it. Operate on testnets only and always show testnet status, including when a screen is empty or the vault is locked.

Choose the look, framework and components yourself. This section defines a contract, not a design. Do not illustrate it with screenshots of an imagined interface; include screenshots only once a maintained client example exists.

### Screen obligations

The canonical screen list and permitted-data contract are defined in docs/14 section 5.1. This guide provides platform-specific implementation guidance, not a separate screen inventory. Review is a required state of Send; Lock is a required app state.

**Validation evidence:** the screen list and expected states come from the Web validation draft’s build log. The draft is local-only, in no repository: its fourteen screens were written and its 31 unit tests pass, and the integrated browser flow was run on 2026-11-08 (V2: 14 PASS / 0 FAIL / 3 INFO across 17 steps, real headless browser; Section D). Live spend was not exercised. Treat this as evidence for the screen list and expected states, not for a completed live-spend flow.

Define both states — empty and locked — on each screen.
If you want a starting point for the presentation layer, the UI-template appendix after Section K ranks nine pre-existing templates, gives a five-point vetting checklist and states plainly that using a template is optional.

### QR receive: in scope

Receive-QR and scanning are both in scope, resolved by the user on 2026-11-08. Remaining OPEN items concern specification details, implementation/API integration and verification — not whether to include either feature.

Receive must show the selected address, an explicit network label and an actual QR using the Receive QR payloads table in docs/07. Generate and verify the QR through `P.renderAndVerifyQr`, with error correction explicitly set to M. Display request information not carried by the QR separately.

QR payment-request scanning is specified in Section F. See Doc 3, Consolidated open-items register, `OI-037`.

### Sources

- Web validation draft build log — local-only, in no repository; validation evidence for the Web screen list and expected states (Section D).
- Repo guide, `docs/14`, section 5.1, at `e3b65fb832db287fdc8d54794980dd0b3456cc12` — shared screen contract.

### Open items

- **QR receive:** RESOLVED — keep receive-QR and scanning, user decision 2026-11-08. See Doc 3, Consolidated open-items register, `OI-037`.
- **Browser validation:** the fourteen screens were written in the validation draft, and the integrated browser flow was run on 2026-11-08 (V2: 14 PASS / 0 FAIL / 3 INFO across 17 steps, real headless browser). Live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.
- **Screenshots:** none exist because no maintained client example exists.

## H. Testing

31 offline unit tests pass (mocked transport; no live-network coverage), run by the author against the validation draft, not shipped in any repo. Environment for that run: **Node v24.22.2**, outside the declared `>=22 <23` range. Record that mismatch alongside the result. The integrated browser flow (V2, 2026-11-08) re-ran these 31 tests in a real headless browser: 31/31 pass.

Keep the other counts separate, with their own scopes:

- **Repo engine suite:** 28 passing tests for `tools/hdwallet-gen/`.
- **Android draft suite:** 55 pure-module tests.

Never combine these counts. Neither separate suite establishes live-network coverage for the Web validation draft.

### Runner and npm scripts

1. Use `node --test` as the runner. Once you have the offline test files, merge this `test` entry into the app’s `package.json`:

   ```json
   {
     "scripts": {
       "test": "node --test"
     }
   }
   ```

2. Add `test:fixtures` with the command `npm test`: the draft’s `package.json` defines `"test": "node --test"`, and V2 ran it 31/31 in the browser flow. Do not substitute a guessed command or path.

   | npm script | Scope | Expected result |
   |---|---|---|
   | `test` | Offline unit suite | All passing; exit 0 |
   | `test:fixtures` | Fixture gate from Section C | All passing; exit 0 |

3. Stop if either script fails. Investigate and record the cause; do not weaken an assertion to get the suite green.

### Differential test

1. Use Section C’s virtual-environment setup and dependency-installation commands: `python3 -m venv .venv`, `. .venv/bin/activate`, then `python3 -m pip install -r requirements.txt`. The repo guide’s section 7 gives the same commands.
2. Preserve these pins in `requirements.txt`:

   ```text
   cryptography==50.0.2
   bip-utils==2.12.2
   ```

3. Run the supplied reproduction command inside that environment:

   ```sh
   python3 test/differential_test.py
   ```

4. Require `PASS` and exit 0. Stop and record any other outcome.

The differential test covers **Bitcoin and Ethereum at index 0 only**. Do not infer coverage of other indices, TRON or TON from that result.

### Acceptance checklist

Execute and record this checklist yourself. It is not an executable procedure or a shipped test harness: the runnable suite is not shipped in any repo. Record the observed result for each check rather than copying the author’s reported outcome.

- [ ] **Offline unit suite:** all tests pass; record the Node environment and exit 0.
- [ ] **Differential test:** obtain `PASS`, exit 0, within the index-0 coverage limit.
- [ ] **Import and recovery:** a wrong phrase, wrong path and wrong passphrase each produce the documented empty-wallet symptom, not a crash.
- [ ] **Signing:** verify EIP-1559 `txMode: 1`, wire byte `0x02` and the max-fee match described in Section F.
- [ ] **Network switching:** a wrong chain ID blocks signing.
- [ ] **Invalid addresses:** reject them locally; never sign them.
- [ ] **Interrupted transactions:** treat a broadcast timeout as unknown. Query by transaction ID; never auto-replace.
- [ ] **Watch-only separation:** no signing path exists from a watch-only state.
- [ ] **Testnet-only integration:** cover all four testnets and record dated endpoint probes, following Section E.
- [ ] **Watch-only operation — docs/13:** confirm that watch-only operation works without starting or accessing a signer.
- [ ] **Approval — docs/13:** confirm that approval matches the frozen payload and success returns only signatures.
- [ ] **Backend choice — docs/13:** confirm that the choice exposes its network, freshness and trust assumptions.
- [ ] **Discovery — docs/13: FAIL.** Check receiving and change addresses, with incomplete scans clearly labelled. Change-branch discovery is unimplemented; record this check as failing.
- [ ] **Transaction states — docs/13:** confirm that a testnet transaction progresses through distinct states and that a simulated reorganisation rolls those states back.

### Local-to-public sequence and reset

1. Run the offline unit and fixture stages first, locally and with no network. Require both stages to pass before proceeding.
2. Run the public testnet stage from Section E. Record dated endpoint probes and observed integration results; do not infer them from offline results.

No local chain stage is implemented for any chain in the validation draft. There is **no regtest, signet or local-node mode for Bitcoin, Ethereum, TRON or TON**. A Bitcoin regtest stage would not establish local testing for the other three chains, and none exists here. Do not describe the offline stages as local-chain testing.

Reset a failed public testnet run as follows:

1. Stop and record the failure, then discard the test vault.
2. Re-create the vault from a fresh test phrase before repeating the public stage.

Test funds have no value. Never connect a mainnet wallet to the test app.

Retain the Bitcoin developer docs’ backup precaution:

> always back up mainnet wallets before performing dangerous operations such as deleting.

live wallet creation and live restore were performed in the V2 browser run (2026-11-08); live spend was not exercised — "testnet-only" does not mean "testnet-tested".

### Sources

- Web validation draft build log — local-only.
- Repo docs 10 (operations and testing), 13 and 14 at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.
- Bitcoin developer docs on [testing](https://developer.bitcoin.org/examples/testing.html), checked 2026-11-08.

### Open items

- The runnable suite is not shipped in any repo. See Doc 3, Consolidated open-items register, `OI-052`.
- The differential test covers Bitcoin and Ethereum at index 0 only. See Doc 3, Consolidated open-items register, `OI-053`.
- No local chain stage exists. See Doc 3, Consolidated open-items register, `OI-049`.
- Change-branch discovery is unimplemented. See Doc 3, Consolidated open-items register, `OI-050`.
- Live creation/restore performed in the V2 browser run (2026-11-08); live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.
- The `test:fixtures` command and the virtual-environment setup commands are specified above (`npm test`; `python3 -m venv .venv`, `. .venv/bin/activate`, `python3 -m pip install -r requirements.txt`).

## I. Security documentation

Keep this guide testnet-only. Bound every claim by evidence, and check every line of the closing checklist before making any release claim.

### Keep secrets off the network

Send providers public queries and signed payloads only. Never put real mnemonics, private keys, seeds or data keys in examples, fixtures, logs or telemetry.

QR decoding is local-only: decode with a first-party decoder (`qr-scanner@1.4.2` with its bundled worker; see Section F) and never send a captured frame or a decoded payload to a server. Retain no scan result beyond the displayed request, and keep diagnostics allowlisted and fail-closed — a diagnostics failure must never silently widen what is collected.

The vault unlock passphrase and the BIP-39 passphrase are different things: never use one where the other belongs. Name each explicitly in prompts and documentation so you do not request or use the wrong passphrase.

### Constrain diagnostics

Limit diagnostics to redacted errors and stable error codes only. Never dump secret-bearing protobufs, raw requests or exception payloads into logs. Redaction is defence in depth, not permission to log key material.

Call a value, timeout or policy “repository-defined” only when you cite the repo file and line. Without that citation, leave its repository status unverified rather than giving readers an unsupported source attribution. Diagnostics from the scanner are allowlisted and fail-closed (Section F); a diagnostics failure must never widen what is collected.

### Respect public-key privacy

Treat extended public keys as sensitive public material. Never upload an xpub to a remote service (Section E). Treat fallback providers and multi-provider comparisons as additional disclosures. Make those disclosures explicit whenever you describe fallback or comparison behaviour.

### Protect local storage

Follow Section D for the vault construction. Use the exact verified bound: “GCM authentication fails closed on tampering”. This describes the tampering behaviour, not every property of local storage. Do not broaden it into an authenticity guarantee or claim memory erasure.

### Separate signing from tracking

Follow the signing boundary in Section F. Bawa contains no transaction construction or signing implementation; signing exists only in the built apps, via Trust Wallet Core 4.9.2. Do not attribute transaction construction, signing or broadcast to the Bawa repo.

Apply the Section F validation gates:

1. Validate the recipient, amount, change, fees and contract calls.
2. Require approval of those details before requesting a signature.
3. Decode the signed bytes and compare them against the approved intent before broadcast.

Keep approval and the signed-byte comparison as separate gates: approving an intended transaction does not establish that the signed bytes match it. Signing isolation (a dedicated worker or isolated signing boundary) is still to be built; a camera guard does not supply that isolation.

### Import and rehearse recovery

Validate the imported phrase before derivation (Section C). Recovery is not tested until you execute and record a rehearsal:

1. Start with a clean install.
2. Import the test phrase.
3. Confirm that the derived addresses match Section C.
4. Record the rehearsal date and result.

Do not treat phrase validation or address derivation alone as a recovery test. Until you record that clean-install rehearsal, never claim recovery is tested.

### Handle interruption without guessing

Treat a broadcast timeout as unknown submission status (Section F). It does not tell you whether submission succeeded or failed. Report a failed refresh as “Not refreshed”, never zero (Section E): a refresh failure does not establish a zero balance. Keep that uncertainty visible to the person using the app.

### Respond to suspected compromise

If you suspect compromise of a vault file, phrase or signing key:

1. Stop using the affected wallet.
2. Move test funds to a fresh test wallet created from a new phrase.
3. Record what happened, when and what was exposed.
4. Rotate any provider credentials that were in the same environment.

No incident has been recorded for this guide. Keep this procedure available so you do not invent one under pressure.

The repo has no vulnerability disclosure procedure or contact. Treat this as a gap, and establish your own disclosure contact before any release claim.

### Ship and check the Content Security Policy

Treat the following as a required control, not as a claim about the repository’s current policy.

1. Ship a Content Security Policy that blocks inline scripts and restricts script sources to the app’s own origin:

   ```http
   Content-Security-Policy: script-src 'self'
   ```

2. Check whether the policy blocks WebAssembly compilation, which Trust Wallet Core’s WASM module requires. If it does, allow `wasm-unsafe-eval`:

   ```http
   Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'
   ```

3. Verify the deployed policy against the served build using the Section J deploy checklist. Check what the app actually serves; neither this example nor an undeployed configuration proves that it works.

### Check all four network identities

Apply the per-chain network-identity checks in Section E to all four chains:

1. Check Sepolia `eth_chainId` is `11155111`.
2. Check the testnet4 endpoint.
3. Check the Nile endpoint.
4. Check the TON testnet endpoint.

Do not stop at Ethereum. A hosted provider can return stale or misleading results. These checks catch a wrong network, not a lying provider. State that remaining reliance in the network documentation rather than implying that network selection validates every response.

### Make the genuine app verifiable

Publish the exact commit the build came from, the build commands and the expected output hashes (Section J), so a reader can distinguish the genuine app from a copy. Publish those details for the build you serve, not merely for a similarly named app.

Require the external security review release gate to cover the vault, the signing ceremony, the network layer and the UI’s secret handling. It remains unscoped until a reviewer, date and retained evidence exist. Naming these required areas does not mean a review has been scoped or run. Name the scope, reviewer, date and retained evidence before using review labels.

### Never-claim checklist

Check every line before any release claim:

- [ ] Never “secure”, “safe” or “secure because encrypted” about anything unverified.
- [ ] Never “production-ready”, “ready” or “ready for real money”.
- [ ] Never mainnet.
- [ ] Never “audited” or “reviewed” without naming the scope, reviewer, date and retained evidence.
- [ ] Never “hardware-signed” or “hardware-backed” for the whole wallet.
- [ ] Never “memory erased”, “secure wipe” or “guaranteed erasure”.
- [ ] Never claim recovery is tested until a rehearsal has been executed and recorded.
- [ ] Never claim TON compatibility with any specific wallet.
- [ ] Never claim the Bawa repo signs, constructs or broadcasts transactions.
- [ ] Never claim a pinned dependency graph or lockfile the repo does not have.
- [ ] Never claim live spend is verified (no testnet funds were available for a live spend).
- [ ] Never present a value, timeout or policy as “repository-defined” unless the repo file and line are cited.
- [ ] Never “guaranteed” for any security property.
- [ ] Never claim a backup or reveal procedure is complete without the at-most-once disclosure rule and the full-phrase re-entry confirmation gate.

### Sources

Consult repo docs 08, 13, 14, 15, 16 and `SECURITY.md` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.

### Open items

- No vulnerability disclosure procedure or contact exists in the repo. See Doc 3, Consolidated open-items register, `OI-065`.
- No external security review has been scoped or run. See Doc 3, Consolidated open-items register, `OI-055`.
- No recovery rehearsal has been executed. See Doc 3, Consolidated open-items register, `OI-056`.
- CSP: verify only against the served build (Section J); do not treat a policy example as a deployed-build result. See Doc 3, Consolidated open-items register, `OI-057`.

## J. Deployment, setup, and what is not built yet

### Installation and development setup

1. Clone and pin the repo as described in Section B. Start from a clean tree.
2. Run `npm install` from that clean tree, then commit `package.json` and `package-lock.json` together. Follow Section B’s lockfile precondition: use `npm ci` only for later installs, once the lockfile exists. Do not substitute it for this initial install.
3. Build with the single canonical path from Section B. Use that same path for the files you deploy; do not add an alternative build path.
4. Serve the app locally for development and open it in a browser. Check the local browser load separately from the deployed-build checks below.

### Deploy static files

Deploy the app as static files: the bundle, the `.wasm` beside it, and `src/index.html`. Check every item below, including the pre-publication search in item 5.

1. [ ] Fetch the deployed `.wasm` URL beneath the application prefix. Check both a 200 response and `Content-Type: application/wasm`. Inspect the fetched response rather than relying on the file’s presence in the output.
2. [ ] Check that served responses carry the Content Security Policy from Section I. Load the app in a browser with that policy in place; confirm that it still loads and allows WASM compilation as Section I states.
3. [ ] Run the fixture gate on the deployed build. Check that it passes before any wallet operation is offered.
4. [ ] Run the Section E probes for BTC testnet4, Sepolia, Nile and TON testnet. Check that all four testnet endpoints answer.
5. [ ] Before publishing, search the built output for key material. Check that no API key, mnemonic, private key, seed or data key appears in the deployed files.
6. [ ] Serve over HTTPS outside local development; see Section F's secure-context guard for scanning.

### Environment example

1. Check in `.env.example` with placeholders only.
2. Treat Web build-time environment variables as public, not secret storage. Do not put provider keys into those variables.
3. Route keyed providers through a restricted server-side relay as described in Section E. The relay never handles wallet secrets.

### Implemented versus unimplemented

Do not read the validation-draft row as a list of components available in the repo.

| Status | Scope |
| --- | --- |
| Implemented in the validation draft (local-only, not in any repo) | 14 screens written; vault PBKDF2-600k + AES-256-GCM with AAD `bawa-web-vault-v1`; 10-minute auto-lock; fixture gate as a startup barrier; four testnet adapters (BTC testnet4, Sepolia, Nile, TON testnet); EIP-1559 signing with `txMode: 1` (demonstration completed on Core 4.9.2 for the construction/signing demonstration scope, D21 2026-11-08; the in-browser proof, send, sign and broadcast remain open); token-balance reading; 31 offline unit tests passing. |
| Unimplemented | token management and token sends; QR receive (in scope, user decision 2026-11-08 — the repo guide requires it; Section G records it as in scope and unimplemented); QR payment-request scanning (Section F) is unimplemented until implemented and verified through Section H; the Web Worker demanded by the old guide was never built — the worker is an honest recommendation, not a built component, and main-thread boundaries are as validated; cross-tab atomicity was demanded, not implemented — narrow it to a single-tab registry or list it here as unimplemented; no local regtest/signet stage for any chain (Section H); live wallet creation and live restore performed in the V2 browser run (2026-11-08); live spend was not exercised. |

A successful build or testnet send does not replace the release gates below.

### Release gates

Treat these gates as requirements, not passes. Never mark one passed until it has a procedure and retained evidence. The canonical gate catalogue lives in the repo guide (section 18); use the Web-local execution steps below alongside that catalogue.

1. **Fixture gate green.** Run the Section C fixture gate on the Web build and retain the recorded run.
2. **Full test plan green.** Execute the full Section H checklist, require green results and retain the results for the revision.
3. **Dependency and secret scanning clean.** Name the scanner for each scan, identify who runs it, and specify where redacted reports are retained. Scanner names are pending maintainer validation; none is named here as validated. Run both scans and retain their redacted reports; require clean results.
4. **Reproducible builds verified.** Have two independent builders check out the same commit in separate clean environments and build without sharing outputs. Compare sorted relative-path/SHA-256 manifests of every output file plus whole-archive hashes. Require them to match. Record the source SHA, tool versions, input hashes, artefact hashes, commands, exit codes and test results. Retain both builders’ records and the comparison.
5. **External security review completed.** Complete the review in Section I. Record its scope, reviewer and date, and retain the evidence.
6. **Recovery rehearsal executed and recorded.** Follow the Section I procedure, execute the rehearsal and retain its record.

No independent security review, no chain-specific verification, no tested recovery and no reproducible builds are claimed here — those are release gates.

### Maintenance and upgrade policy

1. Before adopting any newer Core version, re-run the fixture gate and the EIP-1559 proof against it. Record the date and version as described in Section B.
2. Before each release, re-check every external link sequentially, with delays between requests. Record the check date beside any link that blocks automated checks.

A link section that cannot be re-checked is a finding, not a footnote.

### After reading you can

Use this as a reader checklist, not as evidence of performed live operations.

- [ ] Clone and pin the repo.
- [ ] Build the app and pass the fixture gate.
- [ ] Create and import a test wallet.
- [ ] Fund it on all four testnets.
- [ ] Send a test transaction on each.
- [ ] Run the offline suite and the differential test.
- [ ] State what is not built yet from the table above.

### Sources

- Repo `main` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`.
- npm registry metadata: <https://registry.npmjs.org/@trustwallet/wallet-core/4.9.2>, checked 2026-11-08.

### Open items

- No release gate has passed. See Doc 3, Consolidated open-items register, `OI-058`.
- Scanner names pending maintainer validation. See Doc 3, Consolidated open-items register, `OI-059`.
- Core 4.9.2 EIP-1559 demonstration complete for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open. See Doc 3, Consolidated open-items register, `OI-004`.
- QR receive: RESOLVED — in scope, user decision 2026-11-08. See Doc 3, Consolidated open-items register, `OI-037`.
- Live creation/restore performed in the V2 browser run (2026-11-08); live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.

## K. Troubleshooting by symptom

Use these checks for Web-specific recovery on testnet. For repo-level problems, follow the canonical repo guide: section 13 (troubleshooting)[^repo-13] and section 14 (FAQ)[^repo-14].

### K.1. Why does the app refuse every wallet operation at startup?

**Cause:** The fixture gate failed.

1. **Fix:** Follow Section C’s virtual environment setup and install the dependencies from `requirements.txt`.
2. Run `python3 test/differential_test.py` and read its output. Fix the failing vector before touching the app.
3. **Check:** Confirm that the test prints `PASS` and exits `0`, then confirm that the app’s gate passes.

See also Section C.

### K.2. Why does the WASM module fail to load?

**Cause:** The server uses the wrong MIME type for `.wasm`, or the file is not beside the bundle.

The loader has an ArrayBuffer fallback, so a wrong MIME type may cause a slow load rather than a failure. Do not mistake slow loading for a correct setup.

1. **Fix:** Serve `.wasm` as `application/wasm`. Confirm that the file sits beside the bundle and that the `locateFile` path points to it.
2. **Check:** Fetch the deployed `.wasm` URL. Confirm status `200` with `Content-Type: application/wasm`, following Section J’s deploy checklist.

See also Sections B and J.

### K.3. Why does the fixture gate pass while the derived address does not match the explorer?

**Cause:** The endpoint uses the wrong network, or you entered the wrong phrase or passphrase. A passing fixture gate does not establish that you restored the intended account or chose the right endpoint.

1. **Fix:** Confirm that the configured endpoint is the testnet for that chain. Re-enter the phrase exactly and leave the passphrase empty.
2. **Check:** Match the first derived address against Section C. Probe the endpoint for the expected chain: Sepolia’s `eth_chainId` must return `0xaa36a7`.

See also Sections C and E.

### K.4. Why does the wallet look empty after restore?

**Cause:** A different derivation path or non-empty passphrase derives a different account. The gap policy may also stop the scan early, or discovery may miss change addresses. The funds are not lost — they are unreachable from the wrong policy.

1. **Fix:** Confirm the exact path and empty passphrase, then extend discovery with a wider recovery scan.
2. Account for the limitation: change-branch derivation is unimplemented, so a wider scan will not discover change funds.
3. **Check:** Match the restored addresses against Section C’s fixtures. Confirm that a previously used address remains used even after its balance reaches zero. Do not let a zero balance erase its use history or make it count as unused.

See also Sections C and E.

### K.5. Why does a balance show zero after a failed refresh?

**Cause:** The app converted a failed refresh into zero. This guide forbids that conversion.

1. **Fix:** Find where the refresh result becomes a number. Surface “Not refreshed” instead, retaining the previous balance marked stale. Keep a refresh failure distinct from a successfully refreshed zero balance.
2. **Check:** Disconnect the network and refresh. Confirm that the app shows “Not refreshed”, retains the stale balance and never substitutes zero for the failed result.

See also Section E.

### K.6. Why does a broadcast transaction never confirm?

**Cause:** Broadcast acceptance means submitted, not confirmed. The fee may be too low, or a reorganisation may have moved the confirmation state.

1. **Fix:** Query by the locally derived transaction ID. For Bitcoin, use the reversed double-SHA256 of the witness-stripped serialisation.
2. Do not rebuild and sign a replacement automatically.
3. **Check:** Confirm progression through submission, pending observation, inclusion and execution outcome, or an explicit replaced, expired or dropped state. Do not count broadcast acceptance as inclusion or execution.

See also Sections E and F.

### K.7. Why does signing fail on Sepolia?

**Cause:** The chain ID check failed, or you left `txMode` at the Core default.

1. **Fix:** Confirm that `eth_chainId` returns Sepolia’s chain ID: `0xaa36a7` (`11155111`). Complete this check before you construct the signing input.
2. Set `txMode` to `1` (`Enveloped`) and verify that the signed bytes start with `0x02`.
3. **Check:** Decode the signed transaction and confirm that the maximum-fee field matches the approved value.

See also Sections E and F.

### K.8. Why does a link in this guide fail?

**Cause:** The page moved, or the host blocks automated checks.

1. **Fix:** Open the link in a browser. If it still fails, use the replacement in the repo guide’s link notes or the verified source this guide cites.
2. Use the npm registry metadata endpoint instead of the npmjs website page, for example. That page returns `403` to automated checks because of bot protection.
3. If no verified replacement exists, treat the citation as unverified and record it as a finding.
4. **Check:** Confirm that the replacement returns the expected content, not merely HTTP `200`. A URL that loads can still serve the wrong page.

See also Sections D, H, I and J.

### Sources

[^repo-13]: Repo guide at `e3b65fb832db287fdc8d54794980dd0b3456cc12`, section 13 (troubleshooting).
[^repo-14]: Repo guide at `e3b65fb832db287fdc8d54794980dd0b3456cc12`, section 14 (FAQ).

This guide: Sections B, C, D, E, F, H, I and J.

### Open items

- Change-branch discovery is unimplemented, so entry K.4 cannot fully resolve change funds. See Doc 3, Consolidated open-items register, `OI-050`.
- The integrated browser flow was run on 2026-11-08 (V2: 14 PASS / 0 FAIL / 3 INFO across 17 steps, real headless browser), so browser-only symptoms have a recorded fix for creation and restore; live spend was not exercised. See Doc 3, Consolidated open-items register, `OI-039`.

## Appendix — Optional pre-existing UI templates

A UI template is optional: implement section G yourself, or adapt an existing template only if it meets the same screen and security contract. If no template meets the contract, build the UI from section G and do not adopt a template for the sake of having one.

No template assessed on 8 November 2026 covers Bitcoin, Ethereum, TRON and TON together with all 14 screens. A template can supply at most part of the presentation layer; the wallet lifecycle, derivation, signing ceremony and chain-specific transaction review remain the builder's work.

### Ranked candidates

**Check date for the whole table: 8 November 2026.**

| Rank | Candidate | Repository | Licence | Last push | Stars | What it covers |
|---|---|---|---|---|---|---|
| 1 | shadcn/ui | github.com/shadcn-ui/ui | MIT | 2026-11-08 | 127,598 stars | Accessible React components copied into your own project; layouts, forms, dialogs, tables. No wallet behaviour. Practical first pick. |
| 2 | Web3UIKit | github.com/web3ui/web3uikit | MIT | 2025-07-14 | 1,779 stars | Lightweight reusable Web3 UI components for dapps. Maintenance slowing — last release June 2023; check dependency freshness, accessibility and open issues before adopting. |
| 3 | MyEtherWallet | github.com/MyEtherWallet/MyEtherWallet | MIT | 2026-11-06 | 1,589 stars | Full client-side Ethereum web wallet, Vue and SCSS; real wallet screens to study and adapt. Ethereum only. |
| 4 | Web3-Onboard | github.com/thirdweb-dev/web3-onboard | MIT | 2026-05-28 | 922 stars | EVM onboarding library, EIP-1193 providers, Account Center. EVM only. |
| 5 | RainbowKit | github.com/rainbow-me/rainbowkit | MIT | 2026-10-01 | 2,839 stars | React connect-wallet UI on wagmi and viem. EVM only. |
| 6 | ConnectKit | github.com/family/connectkit | BSD-2-Clause | 2026-08-13 | 1,075 stars | React connect-wallet UI on wagmi and viem. EVM only. |
| 7 | thirdweb Connect | github.com/thirdweb-dev/js | Apache-2.0 | 2026-11-06 | 642 stars | ConnectButton and in-app wallets, 500+ external wallets. EVM-centred SDK; extra wallet behaviour to validate against the contract. |
| 8 | Reown AppKit | github.com/reown-com/appkit | unclassified, clarify before use | 2026-11-07 | 5,454 stars | Full-stack onchain app UX; networks EVM, Solana, Bitcoin. No TRON or TON stated. Do not adopt Reown AppKit until you have read its licence in the repository and confirmed it permits your use. Chain overlap alone is not a recommendation. (Its licence is unclassified because the GitHub API returns NOASSERTION and the LICENSE file returns 404.) |
| 9 | Solana Wallet Adapter UI | github.com/anza-xyz/wallet-adapter | Apache-2.0 | 2026-10-06 | 2,032 stars | React wallet-adapter components for Solana only. Wrong chain family; visual reference only. |

### What you still need to build

- **Rank 1 — shadcn/ui.** You still build all 14 screens and navigation, and manage non-secret state. You supply the separate four-chain wallet core, isolated mnemonic screens and chain-specific transaction review. Copied components do not provide wallet behaviour or take over the lifecycle, derivation or signing ceremony.

- **Rank 2 — Web3UIKit.** You still build all 14 screens and navigation, manage non-secret state, and supply the separate four-chain wallet core, isolated mnemonic screens and chain-specific transaction review. Before adoption, you also need to check dependency freshness, accessibility and open issues because maintenance is slowing.

- **Rank 3 — MyEtherWallet.** You separate reusable views from wallet and secret-handling logic before adapting the Ethereum views. You add Bitcoin, TRON and TON views on Bawa's own core. The existing Ethereum screens are material to study and adapt, not a replacement for your four-chain wallet.

- **Ranks 4–7 — Web3-Onboard, RainbowKit, ConnectKit and thirdweb Connect.** You still build all 14 screen flows beyond any account or connect controls you reuse, including create, import, backup and lock. Those controls do not supply the rest of the wallet lifecycle. With thirdweb Connect, you also validate its extra wallet behaviour against the contract.

- **Rank 8 — Reown AppKit.** You need licence clarification first and still build all 14 screens. You cannot treat its stated Bitcoin and EVM support as a recommendation, or assume TRON or TON support. You must read the repository licence and confirm that it permits your use before adopting it.

- **Rank 9 — Solana Wallet Adapter UI.** You still build everything chain-relevant. You can use its presentation only as a visual reference. Its Solana-only components do not remove any of your chain-specific work for this four-chain wallet.

### Vet a template before adoption

You need all five checks to pass, even when you reuse only a few controls.

1. **Exclude secrets.** Confirm that the template holds no secret and no mnemonic at any point. Keep phrase display and re-entry in the isolated ceremony, outside the template.

2. **Preserve derivation and key storage.** Check that the template does not redefine derivation paths or introduce its own key storage. Keep presentation reuse separate from these responsibilities.

3. **Preserve transaction review.** Confirm that the template cannot skip, hide or reorder transaction review. Check any reused account or connect controls against the same requirement.

4. **Check testnet-only operation.** Confirm that the template works testnet-only and shows testnet status. Require both behaviours; network coverage on its own does not satisfy this check.

5. **Read the repository licence.** Confirm that the licence is readable in the candidate's repository and permits your use. Resolve an unclassified licence rather than treating it as permission.

If any check fails, do not use the template. If none passes, build the UI from section G.

Keplr and Taho were checked as possible template sources on 8 November 2026 and could not be verified as public repositories, so they are not listed as template options.

## Improve this guide

If a step fails as written, a link is dead, or a value has changed, report it against the Bawa repository (`Pr3eve6ti2o/bawa`, pinned at `e3b65fb832db287fdc8d54794980dd0b3456cc12` in this guide). Include the section, the exact command or link, and the output you saw. No contribution guide is published yet; do not open reports against a fork.

## Need help?

No help destination is published for this guide yet. Work from the symptom-led recovery in section K and the repository guide’s troubleshooting (README §13–14) first. If the failure is a defect in the guide itself, report it as above.

## Prose credit

Prose author: GPT-6-Astra.

Implementation checks, security decisions and release sign-off remain the responsibility of the Bawa maintainers.
