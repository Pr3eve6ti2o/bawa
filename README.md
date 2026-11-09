# Bawa — How to run it

**Verified on**

| Field | Record |
|---|---|
| Verification status | Partially verified — see §18 |
| Verified on | 2026-11-08 |
| Verification scope | Differential test; live wallet creation and restore; TON fixture derivation; integrated browser flow |
| Repository commit | `e3b65fb832db287fdc8d54794980dd0b3456cc12` |
| Tool versions (full observed versions) | Python 3.12.3, `cryptography==50.0.2`, `bip-utils==2.12.2`, Node v24.22.2 (outside the declared Node `>=22 <23` range) |
| Environment/runner | muse-vm |
| Actually run | Differential test (bip-utils reference, BTC/ETH index 0 only); live wallet creation and restore under a real pty; TON fixture derivation with independent verification; integrated browser flow (14 PASS, 0 FAIL, 3 INFO) |
| Not run/unresolved | live testnet spend; recovery rehearsal; on-device Android gate; Core side of the differential comparison |
| Evidence | Recorded in §11, §18 and docs/08 |
| Sources fetched on | 2026-11-08 |

## 1. Scope and non-goals

Use Bawa as a practical open-source reference for HD-wallet workflows:

- Perform one-time wallet creation with `make_wallet.py` and `generate.js`, using `@trustwallet/wallet-core`.
- Run watch-only public derivation with `derive.js`, `derive_daemon.js` and `compare.js`.
- Run controlled recovery with `decrypt_seed.py`.
- Run independent verification with `test/differential_test.py`.
- Use these workflows as a basis for tracking and payment reconciliation; take responsibility for both in your application.

Distinguish the **mnemonic** (the words), the **seed** (the 64-byte BIP-39-derived value) and the **seed bundle** (the encrypted file `seed.enc.json`). Use **wallet** for the application and **vault** for an encrypted store. Leave the **BIP-39 passphrase** empty by policy; do not confuse it with a **vault unlock passphrase**, **app PIN** or **device credential**.

Do not treat Bawa as:

- a hosted wallet or custody service;
- an exchange or commercial product;
- a node client, balance retriever or transaction broadcaster — these are outside Trust Wallet Core’s scope;
- a security audit.

Read each **Warning** in this guide set in this order: **consequence → safe action → check or recovery**.

> **Warning**
>
> Five of the six release gates are unmet, so you cannot use this guide as evidence of readiness. Keep your work within the reference scope above. Check the security posture in §17 and use §18 to assess the evidence required for every gate:
>
> - **Unmet** — clean dependency install and lockfile.
> - **Unmet** — full independent differential coverage.
> - **Pass** — chain-specific fixtures (see §18).
> - **Unmet** — secret and dependency scanning.
> - **Unmet** — reproducible release checksums and provenance.
> - **Unmet** — external security review.

Mainnet is absent from this guide set; any mainnet work is a separate, reviewed change outside this set, and passing the gates does not authorise it.

Version pins live in §5.4 (Compatibility, provenance, and version pins).

### Architecture and responsibilities

Standards lead to chain-specific policy, which the Trust Wallet Core reference implementation follows. Watch-only public derivation turns public roots into addresses; RPC, node or indexer reads chain state; wallet and payment tracking observe payments; the application database reconciles them against orders:

Standards → Chain-specific policy → Trust Wallet Core reference implementation → Watch-only public derivation → RPC / node / indexer → Wallet + payment tracking → Application database / reconciliation

| Component | Owns | Does NOT own |
|---|---|---|
| Standards | The base rules on which chain-specific policy rests. | Chain-state access or order reconciliation. |
| Chain-specific policy | The chain-specific rules used by the reference implementation. | Reading chain state or deciding whether a payment satisfies an order. |
| Trust Wallet Core | The reference wallet implementation: derivation and signing. | Reading chain state, making history searchable or deciding whether an order is paid. |
| Trusted generator | Creating wallet material and account-level public roots on the trusted machine, with no online chain connection needed. | Online payment tracking or reconciliation. |
| Watch-only public derivation | Address derivation from an xpub or zpub (sensitive public material), or use of a public address. | Signing or handling seed and private material — the tools do not accept a private extended key. |
| RPC / node | Reading chain state. | Wallet derivation, signing or order-payment decisions. |
| Indexer | Making chain history searchable. | Wallet derivation, signing or order-payment decisions. |
| Wallet + payment tracking | Tracking wallets and observed payments. | Wallet generation or signing. |
| Application database / reconciliation | Recording tracked payments and deciding whether an observed payment satisfies an order. | Wallet derivation, signing or providing chain state. |

The online application may be monitored, logged, restarted or compromised, so never allow the mnemonic, seed or private material to reach the watch-only runtime. Trusted generation keeps private material out of the online application, while chain observation supplies the evidence the application uses to reconcile payments.

Use this section as the shared authority for the whole guide set. The Web guide and Android guide link here for scope, derivation policy and gates. Follow the “Learn from scratch” path in §19.

## 2. Choose your task

| Task | Go to | Before you start |
|---|---|---|
| First run | §3 Prerequisites | No prior Bawa setup is required. Check the prerequisites before installing. |
| Generate a wallet | §8 | Use a trusted, interactive machine and complete §3, §4, §6 and §7 first. |
| Derive an address without the seed | §9 | Use only sensitive public material (xpubs) — never the seed. |
| Check public outputs | §10 | Have public outputs from generation or watch-only derivation to compare and verify. |
| Run the independent differential test | §11 | Complete §3, §4, §6 and §7, including the Python venv and requirements. |
| Recover a wallet | §12 | Have the seed bundle (`seed.enc.json`) and the decryption inputs specified in §12. |
| Fix a failed step | §13 | Identify the failed step and its error message or symptom. |
| Check whether Bawa is ready for real money | §18 | Review the security posture in §17 and the evidence needed to assess the readiness gates. |
| Build a Web wallet | Web guide, sections A–K | Complete §3, §4, §6 and §7 first; Node 22, Core 4.9.2 WASM. |
| Build an Android wallet | Android guide, sections A–K | Complete §3 and §4 first; JDK 21, Android SDK 34, Core 4.9.2. |

Learn from scratch — reading order:

| Step | Document | Entry gate | Outcome |
|---|---|---|---|
| 1 | docs/01-fundamentals | None | HD wallet fundamentals: entropy, BIP-39, BIP-32, derivation paths, extended keys |
| 2 | docs/02-chains | Step 1 | Chain guides: Bitcoin, EVM, TRON, TON, Solana and reference chains |
| 3 | docs/03-tools-and-repositories | Step 2 | Repository and tool map: which tool for which job |
| 4 | docs/04-wallet-generation | Steps 1–3, README §§3–4 and 6–7 installed | Generate a wallet on a trusted offline session |
| 5 | docs/05-watch-only | Step 4 | Derive watch-only addresses from public roots |
| 6 | docs/06-tracking | Step 5 | Track balances and transactions from public sources |
| 7 | docs/07-payment-tracking | Step 6 | Reconcile payments against requests |
| 8 | docs/08-security-recovery | Steps 1–7 | Security posture, backups, incident response, paid-security reference |

Deep-dive guides: docs/09-signing-and-hardware, docs/10-operations-and-testing, docs/11-trust-wallet-and-independent-verification, docs/12-chain-registry-and-assets, docs/13-wallet-app-architecture, docs/14-wallet-app-implementation, docs/15-threat-model-and-theft-prevention, docs/16-security-decision-guide, docs/RECOVERY.md, docs/GLOSSARY.md, docs/FAQ.md, docs/FURTHER-READING.md. Troubleshooting and the FAQ pointer live in §13 and §14 of this README.

Supporting documentation: the [docs map](docs/README.md) lists every guide in reading order, with [References](docs/REFERENCES.md), [Security](docs/SECURITY.md) and [Testing](docs/TESTING.md) alongside. Platform guides: [Web wallet guide](docs/web-wallet/WEB-GUIDE.md) and [Android wallet guide](docs/android-wallet/ANDROID-GUIDE.md).


## 3. Prerequisites

Use §§3–4 and 6–7 as the single canonical installation procedure for the whole guide set. `docs/04` and `docs/10` link here rather than repeating these procedures.

| Prerequisite | Requirement |
| --- | --- |
| Node | `v22.x` (`>=22 <23`) |
| npm | Required; no version specified. The unresolved npm version is a release blocker. |
| Python | `>=3.11` |
| Python virtual environment | Required; create `.venv` in §7. |
| Git | Required |
| `cryptography` | `cryptography==50.0.2` |
| `bip-utils` | `bip-utils==2.12.2` |

Live verification in this guide used Node v24.22.2, outside the declared `>=22 <23` range — the suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22) (see §18).
| `@trustwallet/wallet-core` | `4.8.4`, published 2026-09-24 |

The live EIP-1559 proof was demonstrated on `4.8.4`, and the construction/signing demonstration was re-run in a work copy upgraded to `@trustwallet/wallet-core@4.9.2` (D21, 2026-11-08): with `txMode: 1` it produced a `0x02` envelope, and independent Python verification recovered the published fixture sender. Browser send/sign was not exercised and nothing was broadcast.

**Check your machine before installing**

Use a Unix-like shell. Check the executables and virtual-environment support first, then query the dependency releases without installing them. Do not pre-install the Python packages globally.

Run each **Expected result — check** block immediately after its preceding command, in the same shell, and require exit status `0`.

```sh
node --version
```

**Expected result — check**
```sh
node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 ? 0 : 1)'
```

Record your installed npm version without treating it as a resolved project requirement.

```sh
npm --version
```

**Expected result — check**
```sh
npm --version >/dev/null
```

```sh
python3 --version
```

**Expected result — check**
```sh
python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))'
```

```sh
python3 -c 'import venv, ensurepip; print("venv support available")'
```

**Expected result**
```text
venv support available
```

```sh
git --version
```

**Expected result — check**
```sh
git --version >/dev/null
```

Confirm that PyPI advertises both Python pins without requiring a system-wide pip installation.

```sh
python3 - <<'PY'
import json
from urllib.request import urlopen

for package, version in (("cryptography", "50.0.2"), ("bip-utils", "2.12.2")):
    with urlopen(f"https://pypi.org/pypi/{package}/{version}/json", timeout=30) as response:
        actual = json.load(response)["info"]["version"]
    if actual != version:
        raise SystemExit(f"Version mismatch for {package}: {actual}")
    print(f"{package}=={actual}")
PY
```

**Expected result**
```text
cryptography==50.0.2
bip-utils==2.12.2
```

Confirm the Wallet Core release in the npm registry.

```sh
npm view @trustwallet/wallet-core@4.9.2 version
```

**Expected result**
```text
4.9.2
```

Treat these registry queries as availability checks, not verification of installed dependencies. Confirm the installed pins in §§6–7.

## 4. Clone and verify the commit

Clone the repository and enter its root directory.

```sh
git clone https://github.com/Pr3eve6ti2o/bawa.git
```

**Expected result — check**
```sh
test -d bawa/.git
```

```sh
cd bawa
```

**Expected result — check**
```sh
test -d .git
```

Record the initial commit line, then check the working tree.

```sh
git log --oneline -1
```

**Expected result — check**
```sh
git cat-file -e 'HEAD^{commit}'
```

```sh
git status --short
```

**Expected result — check**
```sh
test -z "$(git status --short)"
```

Require a clean tree before installing. Stop and resolve any reported changes; do not discard files merely to force the check through.

Create a separate detached worktree at the repair commit. Do not check the
repair commit out in this working directory: doing so would replace the
corrected README you are reading with the older README from that commit.

```sh
git worktree add --detach ../bawa-pinned e3b65fb832db287fdc8d54794980dd0b3456cc12
```

Enter the pinned worktree and run the same checks there.

```sh
cd ../bawa-pinned
```

**Expected result — check**
```sh
test "$(git rev-parse --abbrev-ref HEAD)" = HEAD
```

Record the full commit ID and compare it with the commit named by `e3b65fb832db287fdc8d54794980dd0b3456cc12`. Confirm that the tree remains clean.

```sh
git rev-parse HEAD
```

**Expected result — check**
```sh
test "$(git rev-parse HEAD)" = "$(git rev-parse 'e3b65fb832db287fdc8d54794980dd0b3456cc12^{commit}')" &&
test -z "$(git status --short)"
```

Return to the original directory and prove the corrected guide survived: the
commit is still the one you cloned, the README is still 1243 lines, and the
tree is still clean.

```sh
cd ../bawa
```

**Expected result — check**
```sh
test "$(git rev-parse HEAD)" = "56396a2010c150b2aa9ea70102194127048e905b"
test "$(wc -l < README.md | tr -d ' ')" = 1243
test -z "$(git status --short)"
```

All commands from §6 onward run inside `../bawa-pinned`. The original
directory stays at the commit you cloned so you can keep reading the corrected
guide.

Once testing is complete, remove the pinned worktree from the original
directory (do not run this from inside the worktree itself).

```sh
cd ../bawa
git worktree remove ../bawa-pinned
```

No signed-release verification procedure exists. Treat recording the commit as the minimum check, not proof of authenticity.

## 5. Shared contracts

The contracts below are defined once, in their home sections, and used everywhere in this guide set. This section states each contract and names its home section; if this section and a home section disagree, the home section governs. The derivation policy lives in §9, the test taxonomy in §11 and docs/10, and the gate catalogue in §18.

### 5.1 Shared security baseline

No signing in the repo. Filesystem rules: `secrets/` 0700, `seed.enc.json` 0600, `.env` 0600. Never-claim rules apply throughout. The derivation policy (`bawa-derivation-policy-v1`) is part of this baseline: account 0, receiving branch 0 only; paths BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i`, TRX `m/44'/195'/0'/0/i`, TON `m/44'/607'/0'` (account node, one deposit address, no xpub); BIP-39 passphrase empty by policy. The testnet4 mainnet-derivation deviation is documented in §9: Bawa pins Core's mainnet segwit derivation (`m/84'/0'/0'/0/i`, zpub) on testnet4 — the standards-conformant testnet pair is `m/84'/1'/0'/0/i` with vpub `0x045f1cf6`. A standard testnet wallet will not find Bawa funds; the implementation is not changed. Home: §9 (derivation policy) and §17 (security posture).

### 5.2 Supported capabilities

What Bawa owns and does not own; mainnet is absent; no production-ready claims. Home: §1.

**OI-062 — Supported-capabilities contract not established.** Supported-capabilities contract not established. Record support per surface and operation with cited verification; the V3 TON fixture alone does not establish application support. Owner: W1; evidence contributors: W3, W4 and W5.

### 5.3 Fixture boundary

Fixtures are published test vectors; runtime work is testnet only. The published ripple fixture (15 words, empty passphrase) and the account-0 public nodes; the TON fixture (Wallet V4 R2, wallet ID 698983191). A 15-word test phrase is never mixed into a 24-word wallet flow. The test taxonomy is part of this boundary: differential test (bip-utils reference, BTC/ETH index 0 only), smoke tests, pure-module tests — counts are never combined across layers. Home: §11 (fixtures) and docs/10 (test taxonomy). Fixture verification does not establish application support or production readiness; docs/11 is the canonical fixture home.

### 5.4 Compatibility, provenance, and version pins

Compatibility is not established by these provenance records alone. Do not infer a compatibility matrix from them, do not attribute V3 to an unspecified execution commit.

Provenance: the clone pin e3b65fb832db287fdc8d54794980dd0b3456cc12 is sourced to the Android guide's A.6 pin check (Doc 3, section A.6). `tools/hdwallet-gen/package-lock.json` exists at e3b65fb832db287fdc8d54794980dd0b3456cc12 (Core 4.8.4 exact), dated 2026-11-08. V3's dated fixture verification is linked to docs/11, "TON fixture (V3, 2026-11-08)".

**Version pins**

Record full observed tool versions separately from these declared values.

| Component | Scope | Declared value | Required release-verification pin | Status |
|---|---|---|---|---|
| Node | JavaScript runtime | `>=22 <23` | An exact full version within `>=22 <23` | Open — exact pin not recorded; live verification used Node v24.22.2, outside the declared range; the repository suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). |
| Python | Python runtime | `>=3.11` | An exact full version satisfying `>=3.11` | Open — exact pin not recorded. |
| cryptography | Python dependency | `cryptography==50.0.2` | `cryptography==50.0.2` | Release verification not recorded. |
| bip-utils | Python dependency | `bip-utils==2.12.2` | `bip-utils==2.12.2` | Release verification not recorded. |
| Trust Wallet Core | Reference implementation through `@trustwallet/wallet-core` | `4.8.4` (published 2026-09-24) | `4.8.4` | Demonstrated on `4.9.2` for the construction/signing demonstration scope (D21, 2026-11-08); the in-browser proof, send, sign and broadcast remain open. |
| npm | JavaScript dependency installation | No version specified | An exact full npm version | **Release blocker** — no version specified. |


### 5.5 Lifecycle

Updating, changelog rules, release tags; no documented migration or rollback procedure. Home: §15.

**OI-063 — Lifecycle contract not established from the supplied evidence.** Lifecycle guarantees and limits must be specified and verified before they are claimed. Owner: W1.

### 5.6 Accessibility

**OI-064 — Accessibility criteria and conformance are not established by the supplied evidence.** Define acceptance criteria and obtain Web and Android verification; make no conformance claim meanwhile. Owner: W1; verification contributors: W3, W4 and W5.

### 5.7 Ownership

One home per subject: tool selection in docs/03, chain registry in docs/12, Wallet Core verification in docs/11, chain guidance in docs/02.

**OI-065 — Operational/security ownership and a vulnerability-disclosure procedure are not established by the supplied evidence.** Obtain maintainer-approved responsibilities, a reporting channel, and handling/escalation instructions, and publish them in docs/10. No reporting channel or response commitment is claimed meanwhile. Owner: W2 (documentation closure).

## 6. Node install

Start at the repository root. Stop if either install fails; the tools command returns to the root only if its install completes.

**Step 1 — root install**

The repository root has no dependencies: `npm install` at the root installs nothing, and `npm ls --depth=0` cannot check a lockfile's selected package and version against the root because no root lockfile exists. Skip this step and proceed to Step 2.

**Step 2 — tools install**

```sh
npm --prefix tools/hdwallet-gen install
```

**Expected result — check**
```sh
npm --prefix tools/hdwallet-gen ls @trustwallet/wallet-core@4.8.4 --depth=0
```

**Step 3 — syntax check**

Use `npm run check` for syntax ONLY. It checks `generate.js`, `derive.js`, `derive_daemon.js` and `compare.js` in `tools/hdwallet-gen`; it does not validate runtime behaviour.

At e3b65fb832db287fdc8d54794980dd0b3456cc12, the syntax check passes on all four files (verified 2026-11-08). The repository has no root dependency lockfile; the tools lockfile exists at `tools/hdwallet-gen/package-lock.json` (Core 4.8.4 exact). The missing root lockfile is an acknowledged release blocker.

```sh
npm run check
```

**Expected result — check immediately in the same shell**
```sh
test "$?" -eq 0
```

**Step 4 — lockfile status**

Read the following as the status of the supplied commit, not any uncommitted lockfiles created by your local installs.

The repository root has no lockfile; the tools lockfile exists at `tools/hdwallet-gen/package-lock.json` (Core 4.8.4 exact). The missing root lockfile is a release blocker.

Version pins are not a lockfile; until a lockfile generated from a clean install is committed, no install reproduces the exact dependency graph that was tested.

To close this release blocker, resolve the npm version and commit `package-lock.json` generated from a clean install. Choose `package-lock.json`, not `npm-shrinkwrap.json`: they are alternatives, not a pair to commit together.

## 7. Python venv and requirements

Start at the repository root. Use a Unix-like shell that supports `source`, such as Bash or Zsh. Generation is Unix-like only.

Keep `.venv` active for the remaining Python commands. Stop if a Python command or its check fails.

**Step 1 — create the virtual environment**

```sh
python3 -m venv .venv
```

**Expected result — check**
```sh
test -x .venv/bin/python && test -f .venv/pyvenv.cfg
```

**Step 2 — activate it**

Use this activation command in Unix-like shells only.

```sh
source .venv/bin/activate
```

**Expected result — check**
```sh
python -c 'import os, sys; sys.exit(not os.path.samefile(sys.prefix, ".venv"))'
```

**Step 3 — install pip and the requirements**

```sh
python -m pip install --upgrade pip
```

**Expected result — check**
```sh
python -m pip --version
```

```sh
python -m pip install -r requirements.txt
```

**Expected result — check**
```sh
python -m pip check
```

**Step 4 — confirm the pins**

```sh
python -m pip show cryptography bip-utils
```

**Expected result — exact version fields**

For `cryptography`:
```text
Version: 50.0.2
```

For `bip-utils`:
```text
Version: 2.12.2
```

Keep `bip-utils==2.12.2` pinned for verification only; the runtime generation code does not import it.

## 8. Wallet generation

### Step 1 — Prepare.

Work from the repository root in a Unix-like shell on an interactive terminal, with the virtual environment from §7 active. Use an isolated working copy on a trusted machine. The generator refuses to run without a controlling terminal.

### Step 2 — Run the generation command.

From the repository root, run this command with no flags for a first wallet:

```sh
python3 tools/make_wallet.py
```

### Step 3 — Answer the two confirmations on the terminal.

The mnemonic and the data key are shown only on the controlling terminal (`/dev/tty`), never in subprocess stdout. Do not record the terminal session.

The first prompt is `Type the first word of the seed phrase to confirm you wrote it down: `. After writing down the seed phrase, enter its first word. A wrong word stops the run with `Seed phrase confirmation failed — not writing seed.enc.json`, and no seed bundle is written.

The second prompt is `Type SAVED to confirm you stored the data key: `. After storing the data key, enter `SAVED`. Anything other than `SAVED` stops the run with `Data key confirmation failed — not writing seed.enc.json`, and no seed bundle is written.

### Step 4 — Read the completion output.

A successful run prints:

```text
Wallet generation and public configuration update completed.
```

The four public values follow: BTC zpub, ETH xpub, TRX xpub and TON address. These are followed by:

```text
Encrypted recovery artifact: <path> (0600)
Backup bundle: <dir>
```

Step 6 checks these lines. Do not treat any earlier message as completion.

The `--force` and `--regenerate` flags are only for regenerating an existing wallet; a first wallet uses neither. Step 7 covers regeneration.

**Step 5 — Check permissions**

After generation, check these paths relative to the repository root:

| Path | Required mode |
|---|---:|
| `secrets/` | `0700` |
| `secrets/seed.enc.json` | `0600` |
| `seed-backup/` | `0700` |
| `seed-backup/seed.enc.json` | `0600` |
| `.env` | `0600` |

Check the **full mode, including special bits**: no group or other access, and no special bits. Stop if anything differs.

If you used overrides, check those paths instead: `NOVA_SECRETS_DIR` selects the secrets directory, `BAWA_BACKUP_DIR` the backup directory, and `BAWA_ENV_FILE` the environment file.

Run this check from the repository root:

```sh
python3 - <<'PY'
import os
import stat
from pathlib import Path

secrets = Path(os.environ.get("NOVA_SECRETS_DIR", "secrets"))
backup = Path(os.environ.get("BAWA_BACKUP_DIR", "seed-backup"))
env_file = Path(os.environ.get("BAWA_ENV_FILE", ".env"))

paths = (
    (secrets, 0o700, True),
    (secrets / "seed.enc.json", 0o600, False),
    (backup, 0o700, True),
    (backup / "seed.enc.json", 0o600, False),
    (env_file, 0o600, False),
)

for path, required, directory in paths:
    try:
        info = path.lstat()
    except OSError:
        raise SystemExit(f"STOP: cannot inspect {path}")

    if stat.S_ISLNK(info.st_mode):
        raise SystemExit(f"STOP: symlink refused: {path}")

    correct_type = (
        stat.S_ISDIR(info.st_mode)
        if directory
        else stat.S_ISREG(info.st_mode)
    )
    if not correct_type:
        raise SystemExit(f"STOP: wrong file type: {path}")

    mode = stat.S_IMODE(info.st_mode)
    label = str(path) + ("/" if directory else "")
    print(f"{label} {mode:04o}")

    if mode != required:
        raise SystemExit(f"STOP: {path} must be exactly {required:04o}")
PY
```

> **Expected result**
>
> With the default paths:
>
> ```text
> secrets/ 0700
> secrets/seed.enc.json 0600
> seed-backup/ 0700
> seed-backup/seed.enc.json 0600
> .env 0600
> ```
>
> With overrides, the paths change but the required modes do not. A failed check prints `STOP:` and exits with status 1. Do not continue.

Never put mnemonics, passphrases—including your vault unlock passphrase—seed bytes, xprv/zprv, or the AES recovery data key in `.env`.

**Step 6 — Check completion output**

Your run prints:

- `Wallet generation and public configuration update completed.`
- The four public values: BTC zpub, ETH xpub, TRX xpub and TON address.
- `Encrypted recovery artifact: <path> (0600)`
- `Backup bundle: <dir>`

The paths must match Step 5, including any overrides. Compare all four public values with `.env`; they must match.

`Encrypted recovery artifact: <path>` is program output. Keep it verbatim when recording that output.

stdout JSON contains public material only: `btc_zpub`, `eth_xpub`, `trx_xpub`, `ton_address`, `ton_path`, `ton_note`, samples, checks, `seed_encrypted_to` and `wallet_core_version`. The `ton_note` value is `single address per wallet; no xpub exported`. Do not expect a TON xpub.

**Step 7 — Regenerate only after a verified backup**

Before regenerating, verify your backup on a trusted machine with `tools/decrypt_seed.py` and the separate offline data key. Follow [docs/RECOVERY.md](docs/RECOVERY.md) and §12. Leave no decrypted copy behind.

Without `--force` or `--regenerate`, an existing seed bundle stops the run. Only after verifying the backup should you repeat the generation command from Steps 1–4 with `--force`.

For direct `generate.js` invocation, use `--force` to replace an existing seed bundle. If an existing `seed.enc.json` blocks generation because `--force` was not supplied, the outer handler prints `FATAL: wallet generation failed — details redacted` on stderr and exits with status `1`. The launcher `tools/make_wallet.py` accepts either `--force` or `--regenerate`.

The old seed bundle is backed up as `seed.enc.json.bak.<timestamp>` at `0600`. That file is not a substitute for your verified backup.

**If it stops**

| Stop | What you do |
|---|---|
| `existing wallet found` | Rerun with `--force`/`--regenerate` only after a verified backup. |
| `wallet-core generation failed` / `FATAL details redacted` | Exit status is 1. Investigate on a trusted machine and keep diagnostics redacted. |
| Unexpected seed material in generation stdout | Treat stdout as secret. Do not share it or put it in `.env`. |
| `wallet-core self-checks failed <names>` | Do not use the public values until you have resolved the failures. |
| Seed-bundle validation stops: missing, outside the secrets directory, or not exactly `0600` | Correct the cause. Do not bypass validation. |
| Symlink refused | Use non-symlinked paths. |

The mnemonic and data key now exist in exactly three places — your offline record, the encrypted artefact, and the backup.

## 9. Watch-only derivation

**At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, both `derive.js` and `derive_daemon.js` pass `node --check`, and the derivation tools run at this pin (verified 2026-11-08).** The interfaces below describe their behaviour; at the former pin `082f7915` they failed `node --check` and could not run.

Run this section’s commands from `tools/hdwallet-gen`.

```sh
node --check derive.js
```

> **Expected result**
>
> The syntax check passes with exit status 0 (verified 2026-11-08).

```sh
node --check derive_daemon.js
```

> **Expected result**
>
> The syntax check passes with exit status 0 (verified 2026-11-08).

Use the BTC **zpub** from `XPUB_BTC`, and the xpubs from `XPUB_ETH` and `XPUB_TRX`. Supply the key on stdin, followed by the chain and index as arguments:

- Chain: `btc`, `eth` or `trx`.
- Index: an integer from `0` to `2147483647`, inclusive.
- stdin: trimmed before use, with a maximum raw length of 200 bytes checked before trimming. Whitespace, including a trailing newline, counts towards this limit.
- Successful output: exactly one address.

This command uses the supplied published BIP-84 zpub and receiving index 1:

```sh
echo "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs" | node derive.js btc 1
```

> **Expected result**
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, the command runs with exit status 0 and produces the address; the published reference address for this input is recorded in §11 (Core-confirmed 2026-11-08, D31). At the former pin `082f7915` the command failed during parsing with exit status 1 and produced no address.

**Derivation policy**

BIP-44 defines the coin-type level; the values live in the [SLIP-0044 registry](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).

| Chain | Coin type | Public input | Path or policy |
|---|---:|---|---|
| BTC | `0` | zpub, `XPUB_BTC` | `m/84'/0'/0'/0/<index>` |
| ETH | `60` | xpub, `XPUB_ETH` | `m/44'/60'/0'/0/<index>` |
| TRX | `195` | xpub, `XPUB_TRX` | `m/44'/195'/0'/0/<index>` |
| TON | `607` | TON address; no xpub | Preserve the returned `ton_path` and TON configuration. These tools have no TON mode. |

Account 0 and receiving branch 0 only are Bawa’s pinned policy, not a BIP-44 requirement.

> **Derivation deviation**
>
> Bawa pins Core’s mainnet SegWit derivation `m/84'/0'/0'/0/i` with `HDVersion.zpub` and applies it to testnet4. This is Core’s default, selected explicitly in `generate.js`, not the BIP-44/SLIP-44 testnet convention.
>
> The standards-conformant testnet pair is `m/84'/1'/0'/0/i` with `vpub` version `0x045f1cf6` ([SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md), [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)). Core ships that derivation too.
>
> If you import a Bawa mnemonic into a standard testnet wallet, you derive a different account and do not see Bawa funds. Preserve Bawa’s recorded derivation policy for recovery; do not silently substitute the standard testnet path.
>
> Core’s derivation layer produces a `bc1q` address in mainnet form. The wallet-facing layer re-encodes it with HRP `tb`, producing `tb1q`. The witness program is identical: witness version 0, a 20-byte program. Only the Bech32 HRP changes.

For derivation, Core runs `getPublicKeyFromExtended` and then `deriveAddressFromPublicKey`.

The path's purpose, coin and account levels are the caller's responsibility: Core derives from the supplied key using only the trailing change/index levels. Supply the correct account public key for the requested chain. `derive.js` can return a valid-looking wrong-branch address with exit status 0 and no warning when given a mismatched-chain key; successful address validation does not establish the key's chain or account provenance. Core errors are redacted; derivation failures exit with status 1.

Do not feed BTC testnet `vpub` or `tpub` keys to this `derive.js` workflow. With the tested Core 4.8.4 build, both inputs produced no address and exited with status 1 with an opaque WASM-abort error. The error does not identify the input format as unsupported.

| Failure | Result |
|---|---|
| Bad chain, empty key, or non-integer/out-of-range index | Usage line; exit 2. |
| Private extended key | `usage: extended public key required (private extended keys are rejected)`; exit 2. |
| Raw stdin longer than 200 bytes | `failed to read xpub from stdin: xpub too long` on stderr; exit 2. |
| Core call fails | Redacted error; exit 1. |
| Final validation fails | Exit 1. |

**Daemon protocol**

`derive_daemon.js` uses JSONL and stays in the foreground. From the repository root, run `node tools/hdwallet-gen/derive_daemon.js`.

Its startup JSONL record is `{"ready":true}`. Send one JSON request per stdin line; a successful request returns `{"ok":true,"address":"..."}`.

Wait for `{"ready": true}` before sending requests. The request shape is `{"chain":"btc","xpub":"<xpub>","index":5}`; a successful response has the shape `{"ok":true,"address":"<address>"}`. Replace the public-value placeholders when constructing a request.

The limits are 200 characters for the original, untrimmed xpub string and 4096 characters per line. Whitespace counts towards the xpub limit and is removed before private-key detection and derivation.

Error replies have the form `{"ok":false,"error":"<message>"}`. Input/request error messages are:

- `request too large`
- `bad json`
- `bad request`
- `extended public key required`

Core, validation and internal error forms are:

- `getPublicKeyFromExtended failed: <message>`
- `deriveAddressFromPublicKey failed: <message>`
- `derived address failed validation`
- `internal error: <message>`

A fatal error writes `FATAL` to stderr and exits with status 1. Close stdin or send SIGTERM to stop the daemon with status 0. None of this protocol is available while the pinned file fails parsing.

## 10. Compare public derivation

Use `compare.js` for a quick public-only cross-check, not as a tracker. It gives you no balances, transactions or live chain data.

**At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, `compare.js` passes `node --check`, and its comparison output is available at this pin (verified 2026-11-08).**

Your `.env` needs `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX`. The default file is the repository-root `.env`, at `tools/hdwallet-gen/../../.env`. Set `NOVA_ENV` to select another file.

The parser matches `^([A-Z_]+)=(.*)$`. Use plain `KEY=VALUE` entries, without `export` or quoted values.

Run from `tools/hdwallet-gen`:

```sh
node compare.js
```

> **Expected result**
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, the command runs with exit status 0 and prints the three comparison lines (verified 2026-11-08: compare.js 9/9 against an independent bip_utils re-derivation). At the former pin `082f7915` parsing failed with exit status 1.
>
> The intended successful output is three lines—BTC, ETH and TRX—with addresses at indexes 0, 1 and 2 in that order on each line. Compare those addresses with §9 using the same keys and paths.

Runtime failures write `FATAL: ...` to stderr and exit with status 1. If you see `FATAL: missing <chain> xpub in <envPath>`, check the corresponding XPUB entry and confirm that you selected the intended environment file. At the former pin 082f7915, the parsing failure occurred before these runtime checks.

## 11. Differential test

Use `bip-utils` as an independent reference: Core is implementation A, and `bip-utils` is implementation B. A self-check can repeat the same wrong assumption on both sides.

Pin `bip-utils==2.12.2`. It is verification-only and is not imported by runtime code. The reference test uses `Bip39SeedGenerator`, `Bip44` and `Bip84` with a published test vector. Never put a real wallet mnemonic or seed in CI fixtures.

**Reported reference capture**

- Date: `2026-11-08`
- Machine: `muse-vm`
- Repository version: `082f7915`
- Reference version: `bip-utils==2.12.2`

The captured command, run from the repository root with the virtual environment active, is:

```sh
python3 test/differential_test.py
```

> **Expected result**
>
> Captured output, verbatim:
>
> ```text
> bip_utils reference checks: PASS
> BTC m/84'/0'/0'/0/0: bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd
> ETH m/44'/60'/0'/0/0: 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7
> ```
>
> At 082f7915, the reported published-vector reference check passed against bip-utils==2.12.2 for BTC BIP-84 index 0 and ETH BIP-44 index 0 only; no repository test covers TRX or indices 1–2.

Keep that scope statement with the PASS whenever you reproduce the result.

On a mismatch, stop and do not fund the wallet. Check the vector first, then the path, then the `bip-utils` pin.

**Published BIP-84 reference**

Keep these published reference values alongside the check; they are not additional coverage in the captured run.

Account-0 zpub ([SLIP-0132, line 166](https://github.com/satoshilabs/slips/blob/master/slip-0132.md#L166)):

`zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs`

- Second receiving address, `m/84'/0'/0'/0/1`: `bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g` (verified live with `derive.js` from the account-0 zpub above, 2026-11-09)
- First change address, `m/84'/0'/0'/1/0`: `bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el` (unverified — no repository tool derives the change branch)

The change address is a published reference, not a change to Bawa’s receiving-branch-only policy.

**Published ripple fixture**

The fixture mnemonic is the published Trust Wallet Core HDWallet test example (Core `swift/Tests/HDWalletTests.swift`):

`ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal`

- Passphrase: empty (`""`).
- Entropy: `ba5821e8c356c05ba5f025d9532fe0f21f65d594`.
- Core's own test table uses the passphrase `TREZOR`, which gives a different seed and different addresses — Bawa uses the empty passphrase. Do not mix the two.
- The fixture phrase is 15 words because it is a published test vector; real wallets created by this guide are 24 words. The word count changes the seed; never mix a 15-word test phrase into a 24-word wallet flow.

Account-0 public nodes, derived with bip-utils 2.12.2 and Core-confirmed on both 4.8.4 and 4.9.2 (D31, 2026-11-08):

- BTC `m/84'/0'/0'`: `zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9`
- ETH `m/44'/60'/0'`: `xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc`
- TRX `m/44'/195'/0'`: `xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF`

TRX anchor, independently derived with bip-utils 2.12.2 and Core-confirmed on 2026-11-08: `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` (`m/44'/195'/0'/0/0`).

TON fixture, derived and independently verified on 2026-11-08 two ways — Trust Wallet Core 4.8.4 (`getAddressForCoin(ton)`) and an independent SLIP-0010 derivation (pure-stdlib Python + PyNaCl) cross-checked with @ton/ton (Core-confirmed on both 4.8.4 and 4.9.2 — D31, 2026-11-08):

- Mnemonic: the ripple fixture above; passphrase empty.
- ed25519 public key (`m/44'/607'/0'`): `c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9`.
- `ton_path`: `m/44'/607'/0'`; coin 607; curve ed25519.
- Contract: Wallet V4 R2; wallet ID / subwallet `698983191` (0x29A9A317); workchain 0; seqno at derivation 0.
- Raw address: `0:bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f`.
- Non-bounceable (mainnet presentation): `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`.
- Bounceable (mainnet presentation): `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi`.
- Bounceable testnet: `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo`; non-bounceable testnet: `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt`.
- The wallet ID was the missing configuration: V4R2 with wallet ID 0 gives a different address. Only V4R2 with wallet ID 698983191 matches.

**Core side: OPEN**

Do not treat the reference PASS as a completed Core-versus-reference comparison. You still need to capture Core’s self-checks on a TTY and its public derivation from the matching published fixture xpubs.

Run both capture blocks below from the repository root. For generation, use the setup from §8 Steps 1–4 in an isolated working copy on a trusted machine, not against your wallet files. Do not record the terminal session.

```sh
(
    set -eu
    test -t 0 || {
        printf '%s\n' 'Run this from a trusted TTY.' >&2
        exit 1
    }
    umask 077
    capture_dir=$(mktemp -d)
    printf 'Capture directory: %s\n' "$capture_dir"
    cd tools/hdwallet-gen
    node generate.js </dev/tty \
        >"$capture_dir/generate.stdout.json" \
        2>"$capture_dir/generate.stderr"
)
```

> **Expected result**
>
> The block prints the capture directory and runs generation with input from your controlling TTY.
>
> If generation completes, inspect `checks` and record `wallet_core_version` from the public stdout JSON. Keep diagnostics redacted. If stdout contains seed material, treat the capture as secret and stop.
>
> This is the capture procedure, not a recorded Core PASS. The Core side remains OPEN.

For comparison, enter the public keys from the **same published fixture** you are checking: BTC as a zpub, ETH and TRX as xpubs. Do not use your wallet’s keys or mix keys from different vectors. If you cannot supply the matching fixture keys, stop and leave the Core side OPEN.

This block creates a separate `.env`; it does not overwrite your wallet’s file.

```sh
(
    set -eu
    umask 077
    capture_dir=$(mktemp -d)
    printf 'Capture directory: %s\n' "$capture_dir"

    printf 'Published fixture BTC zpub: ' >&2
    IFS= read -r fixture_btc
    printf 'Published fixture ETH xpub: ' >&2
    IFS= read -r fixture_eth
    printf 'Published fixture TRX xpub: ' >&2
    IFS= read -r fixture_trx

    printf 'XPUB_BTC=%s\nXPUB_ETH=%s\nXPUB_TRX=%s\n' \
        "$fixture_btc" "$fixture_eth" "$fixture_trx" \
        >"$capture_dir/.env"

    cd tools/hdwallet-gen
    NOVA_ENV="$capture_dir/.env" node compare.js \
        >"$capture_dir/compare.stdout" \
        2>"$capture_dir/compare.stderr"
)
```

> **Expected result**
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, the command exits with status 0 and `compare.stdout` contains the three address lines (verified 2026-11-08: compare.js 9/9). At the former pin `082f7915` it exited with status 1 and `compare.stderr` captured the parsing failure. Keep the Core side OPEN.

Keep each capture’s command, versions, public output, date and machine name together. Compare only corresponding public outputs from the same vector and paths. **Do not mark the fixture eligible until both sides have been captured and diffed.** Core self-checks alone do not complete that comparison.

## 12. Recovery

Never paste a recovered mnemonic into chat, source control, issues or CI logs.

**Step 1 — Preserve the recovery material**

Keep either:

- Your mnemonic, with the BIP-39 passphrase policy recorded as **empty**; or
- The encrypted seed bundle, `seed.enc.json`, with its separate 32-byte data key.

In either case, preserve the chain paths, address policy, network/chain configuration and TON configuration. Keep the empty BIP-39 passphrase policy distinct from your vault unlock passphrase.

The seed bundle’s JSON uses:

- `alg`: `AES-256-GCM`
- `nonce_b64`: decodes to exactly 12 bytes
- `ciphertext_b64`: decodes to at least 16 bytes
- AAD: `nova-shop-seed-v1`

`nova-shop-seed-v1` is a frozen legacy identifier. Do not rename it.

An xpub or zpub cannot recover the wallet. It gives you public descendants only.

**Step 2 — Decrypt on a trusted machine**

Run the script through Python: `tools/decrypt_seed.py` is mode `0644`, not executable.

The default seed bundle is `secrets/seed.enc.json`. Symlinked artefacts are refused. Supply the data key through `BAWA_DATA_KEY` as hex decoding to exactly 32 bytes, or enter it at the prompt `Bawa data key (hex): `. Do not put the key in `.env`.

Run from the repository root:

```sh
python3 tools/decrypt_seed.py
```

> **Expected result**
>
> If `BAWA_DATA_KEY` is not set, you get the prompt `Bawa data key (hex): `.
>
> On successful recovery, `/dev/tty` receives:
>
> ```text
> Recovered BIP-39 mnemonic (do not copy into chat or source control):
> ```
>
> Your mnemonic follows on `/dev/tty` only, not stdout. No plaintext file is written by default.
>
> Without a controlling terminal, the script stops with:
>
> ```text
> no controlling terminal; use --stdout or --output explicitly
> ```

**Step 3 — Choose explicit plaintext output only when required**

`--stdout` and `--output` are mutually exclusive.

- Use `--stdout` only for an explicit, controlled pipeline. The mnemonic must not end up in CI logs.
- Use `--output` only when you explicitly require a plaintext file. The script writes it atomically at `0600` and refuses symlinked outputs. Its completion message is `recovered mnemonic written to <path> (0600)`.

Remove any temporary decrypted copy after verification.

**Step 4 — Verify before funding**

A Bawa-generated wallet recovers as exactly 24 words. On import, `decrypt_seed.py` also accepts the other valid BIP-39 word counts: 12, 15, 18 and 21.

Derive known public addresses using the recorded paths, address policy and configuration, including TON. Compare them with your recorded originals. Follow §§9–10 for the BTC/ETH/TRX derivation and comparison policy, including the `bc1q`/`tb1q` distinction.

The §9–§10 commands run at `e3b65fb832db287fdc8d54794980dd0b3456cc12` (verified 2026-11-08); use them to complete that verification at the pin. **Do not fund the wallet until the public outputs match.**

## 13. Troubleshooting

This is the canonical home for repo-level troubleshooting; the Web and Android guides link here rather than duplicating it. First, isolate the problem: is it a build problem, a stdio/TTY problem, or an upstream/derivation problem?

| Symptom | What to check or do |
| --- | --- |
| `npm install` fails | Check your Node and npm versions against §3. No root lockfile exists, so the check of the lockfile’s selected package/version cannot run against the repository root; the tools lockfile exists at `tools/hdwallet-gen/package-lock.json`. |
| No-TTY refusal | `FATAL: no controlling terminal — refusing to run; generate the wallet interactively`, exit 1. This is expected. Run from a real interactive terminal; never defeat the check. |
| Derived address mismatch | Follow the ordered comparison below. |

Both Node packages require Node `>=22 <23`, and CI uses Node 22. Use Node 22 for the documented setup. An operator-verified installation under Node v24.22.2 emitted EBADENGINE because that runtime is outside the declared range, but installation completed and the syntax check and smoke suite passed with Wallet Core 4.8.4. This observation does not extend the declared Node support range.

For an address mismatch, compare these in order:

1. Same mnemonic?
2. Same passphrase?
3. Same curve?
4. Same coin type?
5. Same purpose?
6. Same account?
7. Same branch?
8. Same index?
9. Same network/address encoding?
10. Same wallet implementation and configuration? For TON, compare the contract/version plus wallet-ID/subwallet configuration; for Cardano, the exact CIP plus role model; for Solana, the exact derivation convention.

Re-derive with the corrected item. Do not fund a mismatched address.

For balances and tracking:

| Symptom | What to check or do |
| --- | --- |
| EVM address matches but balance is zero | Check the chain ID, RPC endpoint, network name, native currency and explorer. The same address can exist on multiple EVM networks. |
| Tracker misses a payment | Check for a wrong index, index allocation DB issues, a gap-window issue, a wrong branch, indexer lag, an RPC error, a reorg, a token contract mismatch or the wrong network. This is why an address allocation table is so important. |
| Wallet looks empty after restore | Re-derive your recorded first address with the recorded path and empty passphrase. If it matches, the funds are on the recorded path and your restore used a different path or passphrase — re-check each item in the ordered comparison above. If the recorded first address itself shows no funds on the recorded network, the funds were never sent to that address. Never re-fund a guess. |

For negative and security cases:

| Case | Check or behaviour |
| --- | --- |
| Malformed JSON | Check your JSON syntax. |
| Invalid chain names | Check that you supplied a supported chain name. |
| Malformed Base58 or bad checksums | Check the Base58 input and its checksum. |
| Oversized JSON lines or xpubs | The daemon caps lines at 4096 characters and xpubs at 200 characters. |
| Negative indexes or indexes `>= 2^31` | These indexes are rejected. |
| Private extended keys | These are rejected and redacted. |
| Corrupted AES-GCM, wrong data keys or truncated artefacts | Check the seed bundle’s integrity, your data key and whether any artefact is truncated. |
| Symlinked secret/artefact paths | `decrypt_seed.py` refuses symlinked artefact paths; `make_wallet.py` refuses symlinked secret, `.env` and backup paths. |
| Unexpected existing outputs | `make_wallet.py` refuses an existing seed bundle (`seed.enc.json`) without `--force`. |
| Missing `.env` | Check that your `.env` file is present. |

If a published link fails, first check whether it moved: try the owning project’s current documentation home or repository. Do not guess a replacement URL. The canonical copy of this guide is in the repository at the pinned commit (§4); a copy elsewhere may be out of date. If a link in this guide fails, report it against the repository so the next revision can correct it.

Known gaps:

- Live wallet creation and restore were performed on the pushed head under a real pty on 2026-11-08 (completion message, four public values, seed.enc.json 0600, dirs 0700, backup byte-identical; decrypt round trip byte-identical, 24 words). That run used Node v24.22.2, outside the repository's declared Node `>=22 <23` range — the suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). No live testnet spend has been made from this wallet.
- The Core side of the differential comparison is open (§11).
- No root dependency lockfile exists (the tools lockfile exists at `tools/hdwallet-gen/package-lock.json`).
- No secret or dependency scanning has run.
- No reproducible-build procedure exists.
- No external security review has run.
- No vulnerability-disclosure channel exists; this is an open item owned by the maintainers.

## 14. Short FAQ

Read [`docs/FAQ.md`](docs/FAQ.md) for the FAQ.

- **Scoped numerical note.** A 24-word mnemonic encodes 256 random bits plus 8 checksum bits. The checksum adds no independent randomness. The empty passphrase contributes no additional secret. Seed-guessing resistance is separate from randomness quality, implementation security and device compromise.

- **Per-asset recovery checklist.** For each asset, record: BIP-39 support; empty passphrase; exact derivation path; account 0; receiving branch 0; address format; network. Label each item **tested** or **theoretical**. TON is generation-only. The documented policy version is `bawa-derivation-policy-v1`. Record this identifier so you can detect a future policy change; it labels the policy without changing any seed or path.

For the other FAQ topics, see [`docs/FAQ.md`](docs/FAQ.md): why Bawa is not a wallet to hold money; why you should generate only on a trusted offline interactive machine; first-word plus `SAVED` confirmations; why an xpub cannot recover a wallet; why a differential pass is not production readiness; and why a quiet terminal or a refused run is normal.

## 15. Updating and rebuilding

There is no documented update, migration or rollback procedure.

Do not casually overwrite your seed bundle (the encrypted `seed.enc.json` file) or `.env`. Use `--force` only after you have verified a backup of the seed bundle with `tools/decrypt_seed.py` and the separate offline data key. It backs up the old file to `seed.enc.json.bak.<timestamp>` with permissions `0600`.

**Warning:** Regeneration creates a different wallet unless you use the same mnemonic and the same passphrase policy. The same mnemonic with a different passphrase does not preserve the wallet.

**Step 1 — Fetch and record the new commit (§4).**

From the original directory (the one you cloned into), fetch and update it. That directory was never detached — §4 pins the code in a separate worktree — so `git pull` applies here. Require a clean tree in both directories first (`git status --short` prints nothing in each); stop and resolve any reported changes.

```sh
git fetch origin
git pull
git rev-parse HEAD
```

> **Expected result**
>
> Git updates the original directory to the new commit without errors and prints the full commit ID of the new head. Save it with your update records; it is the `<commit>` for the worktree below. The README you are reading is still the corrected guide.

Then replace the pinned worktree with one at the new commit. Run this from the original directory (do not run it from inside the worktree itself):

```sh
git worktree remove ../bawa-pinned
git worktree add --detach ../bawa-pinned <commit>
```

> **Expected result**
>
> Git removes the old pinned worktree and creates a new one at the new commit. The original directory still reads the corrected guide.

After the worktree is created, confirm the pinned commit and record the result:

```sh
cd ../bawa-pinned
git rev-parse HEAD
```

> **Expected result**
>
> Git prints the full commit ID. Save it with your update records.

**Step 2 — Reinstall dependencies (§6).**

Repeat both Node installs from §6, inside the pinned worktree (`../bawa-pinned`). If the Python requirements changed, run this from the pinned worktree root with your venv active:

```sh
pip install -r requirements.txt
```

> **Expected result**
>
> pip installs the requirements into your active venv without errors, or reports that they are already satisfied.

**Step 3 — Re-run the checks.**

From inside the pinned worktree (`../bawa-pinned`), at the new commit, run:

```sh
npm --prefix tools/hdwallet-gen run check
```

> **Expected result**
>
> The baseline at `e3b65fb832db287fdc8d54794980dd0b3456cc12` is that the syntax check passes on all four files (see §6); record the result at the new commit and compare it with your pre-update records. At the former pin `082f7915` it failed on `derive.js`, `derive_daemon.js` and `compare.js`. A check that newly passes or newly fails after an update is a stop signal — follow §13.

Follow §10 to re-run the `compare.js` comparison inside the pinned worktree — at `e3b65fb832db287fdc8d54794980dd0b3456cc12` it runs (see §6); record its output and compare with your pre-update records — then §11 to re-run the differential test. Compare the results with your pre-update records.

The tools package's test script targets test/smoke.test.js, which exists in the pinned tree at `e3b65fb832db287fdc8d54794980dd0b3456cc12` and passes 28/28 (verified 2026-11-08). Use that script as an update check.

**Step 4 — Stop on failure (§13).**

If a check fails, stop and follow §13. Do not fund the wallet. Do not regenerate to “fix” a mismatch.

**Changelog rules**

Keep `Unreleased` at the top. `1.2.0` was never released: the CHANGELOG says `1.2.0` while `package.json` says `1.1.0`, with no tags and no dates. Move `1.2.0`’s genuine changes under `Unreleased`.

Give every released entry its ISO date. If you cannot establish the date, write “date not evidenced”.

Do not claim SemVer adherence: it is not established by the available evidence, and there is no declared public API.

**Release tags**

There are zero tags as of this rewrite.

For each release, create an annotated tag in the form `vX.Y.Z`. In the annotation, record what was built from that tag and where the checksums are recorded. A tag is the immutable record of a release; do not move or replace it.

## 16. Primary references

**Standards**

- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP-43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki)
- [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [BIP-174 — PSBT](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
- [BIP-371 — Taproot PSBT](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki)
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)
- [TON TEP-3 — the wallets standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md)
- [Cardano CIP-1852](https://cips.cardano.org/cip/CIP-1852)

**Trust Wallet ecosystem**

Use the [Trust Wallet developer documentation home](https://developer.trustwallet.com/) and the [wallet-core repository](https://github.com/trustwallet/wallet-core). Avoid the Wallet Core Usage Guide deep links: they land on the marketing homepage.

Use Core’s `registry-fields.md` and `registry.json` as compatibility references for coin IDs, paths, curves, key formats, HRPs and chain IDs. They do not replace the protocol specification.

Keep network identity, derivation policy, address encoding and asset identity separate. Treat Trust Wallet Assets as presentation metadata, not settlement evidence.

**Independent verification**

Use the [`bip_utils` repository](https://github.com/ebellocchia/bip_utils) and [`bip-utils` on PyPI](https://pypi.org/project/bip-utils/) for independent verification.

Keep `@hdwallet/core` as a research-only reference. An automated check on npm returned 403 on 8 November 2026; the registry API confirmed that the package exists. It is not production-ready and is not used by the runtime.

## 17. Security posture

Bawa is a wallet reference project. It is not a hosted wallet, a custodian, an exchange, or a production-ready wallet. Bawa contains no transaction construction or signing implementation. Signing exists only in the built apps, via Trust Wallet Core 4.9.2 — the dedicated EIP-1559 construction/signing demonstration was verified on Core 4.9.2 (D21, 2026-11-08); browser send/sign was not exercised and nothing was broadcast.

What Bawa protects, and what it does not: Bawa's trusted, offline side creates the mnemonic, seed, private material and account-level public roots. The online RPC and indexer receive only the public information needed to watch accounts. Treat that online environment as something an attacker might inspect, collect logs from, repeatedly restart or take over; it must not receive seed material. The generator sends the mnemonic and data-encryption key to its controlling terminal rather than ordinary subprocess stdout/stderr — this reduces incidental logging; it does not defeat a hostile OS or terminal, a debugger, crash dumps, swap or memory snapshots. JavaScript and WebAssembly cannot promise that every secret copy has been securely erased; encrypting saved material also leaves plaintext exposed while a mnemonic is created or recovered.

Assets: the mnemonic (24 words, BIP-39), the seed (64 bytes), the data key (256-bit random), private keys and account-level public roots, the encrypted seed bundle (seed.enc.json), the .env file with public roots, and the vault unlock passphrase. Highest sensitivity: the mnemonic, the seed, the data key, private keys. Privacy-sensitive public material: account-level public roots (xpubs/zpubs) — they reveal addresses and balances, so keep them out of public commits, issues, screenshots and support logs; use placeholders in examples and redact diagnostic material.

Filesystem rules: secrets/ 0700; seed.enc.json 0600; seed-backup/ 0700; backup copy 0600; .env 0600. The seed bundle is verified with tools/decrypt_seed.py plus the separate offline data key — never with a vault unlock passphrase. Keep seed words, private signing keys and their extended forms out of public commits, issues, screenshots and support logs; the same applies to keys used to decrypt recovery data, .env files used in production, wallet-backup artefacts, account/service credentials.

Dependency rules: every dependency is pinned exactly — @trustwallet/wallet-core 4.8.4, cryptography==50.0.2, bip-utils==2.12.2, Node >=22 <23, Python >=3.11. Wallet Core 4.9.2 was demonstrated (D21, 2026-11-08) but the repository has not been re-pinned. Live verification in this guide used Node v24.22.2, outside the declared `>=22 <23` range — the suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). Version pins are not a lockfile; until a lockfile generated from a clean install is committed, no install reproduces the exact dependency graph that was tested. The Node lockfile is a release blocker (see §18). Review every dependency change; do not add a dependency without a stated reason and a pinned version.

Limitations, stated plainly: no zeroisation guarantee; no protection from a compromised OS, debugger, core dump, swap or memory capture, or a malicious terminal; no claim that the Android vault, Keystore or signing flows are verified on device (only 55 pure-module tests); no claim that any pinned dependency graph or lockfile exists that the repo does not have; never describe a value, timeout or policy as "repository-defined" without a cited file:line — the Web vault's 10-minute auto-lock comes from the validation draft (`app-web/src/vault.js:110`, local unpushed draft — not part of this repository), not the repo; never claim the repo signs, constructs or broadcasts transactions; never claim TON compatibility with any specific wallet; never claim recovery is tested until a rehearsal has been executed on a clean install and recorded (see §18 — the rehearsal is still open).

Never publish: seed words, private keys, data keys, vault unlock passphrases, .env files used in production, wallet-backup artefacts, account/service credentials. Never claim "secure", "safe", "secure because encrypted", "production-ready", "ready" or "ready for real money" about anything unverified. Never claim "audited" or "reviewed" without scope, reviewer, date and evidence. Never claim mainnet: mainnet is absent from this guide set; any mainnet work is a separate, reviewed change outside this set, and passing the gates does not authorise it.

Incident response (per-scenario playbook): lost or stolen device — revoke the device's access, change the vault unlock passphrase, and move funds to a fresh wallet if the device held signing ability; a changed vault password cannot secure an exposed phrase — only a fresh seed and migration can. Compromised vault — treat the phrase as exposed: create a fresh wallet, move everything, retire the old wallet. Disclosed phrase — the same: fresh wallet, move everything, retire the old wallet. In every case, record what happened, what was moved, and what was retired, without recording secrets.

Disclosure: OPEN ITEM, owned by the maintainers — no vulnerability-disclosure channel is documented. Send vulnerability reports to the repository maintainers through a private reporting route; do not invent one here, and keep exploit-enabling details out of public issues.

Network-identity verification: verify the network identity for EVERY chain, not only Ethereum (chainId 11155111 for Sepolia). Before trusting a balance or address, confirm the chain, network and endpoint you are actually connected to.

Builder verifiability: a builder who ships an app from this guide must make the genuine app verifiable — official origin, publisher identity, release signing, key continuity. A user must be able to tell the genuine app from a copy.

Review gate: the "external security review" gate has a defined scope — seed handling, derivation paths, signing, recovery, dependencies; named components at a stated revision; exclusions recorded; follow-up review of fixes. The gate shows FAIL until that review is defined and executed (see §18).

Docs/08 is the security reference for this guide set: it carries the full posture, the incident playbook, the paid-security costs reference (vendor prices re-checked live on 8 November 2026), and the sources. Read it before relying on any security claim in this README.

## 18. Gates

A gate is a check that must pass before the guide set can claim the thing it guards. A gate that has not passed is FAIL — not "pending", not "in progress". Passing a gate does not prove the guide is safe, production-ready, or authorised for mainnet: mainnet is absent from this guide set; any mainnet work is a separate, reviewed change outside this set, and passing the gates does not authorise it.

Readiness gates (repo):

| Gate | Status | Evidence |
|---|---|---|
| Prerequisites | PASS | Repository suite re-run on Node v22.23.4 on 2026-11-08 with identical results (D22); Python 3.12.3, cryptography==50.0.2, bip-utils==2.12.2 observed during verification (see §19). No separate reader's-machine prerequisites check was run. |
| Python setup | PASS | venv + pip install -r requirements.txt; cryptography==50.0.2 and bip-utils==2.12.2 verified (see §7) |
| Differential test | PASS, with a boundary | Published-vector reference check passed against bip-utils==2.12.2 for BTC BIP-84 index 0 and ETH BIP-44 index 0 only; the smoke suite asserts BTC/ETH/TRX indices 0–1, and only index 2 is uncovered (see §11) |
| Node setup | PASS at e3b65fb832db287fdc8d54794980dd0b3456cc12 (verified 2026-11-08) | The syntax check passes on all four files; `npm run check` exits 0 (Node v22.23.4 re-run, D22). At the former pin 082f7915 it failed on derive.js, derive_daemon.js and compare.js (backslash-escaped template literals); only generate.js passed |
| Generation | DEMONSTRATED 2026-11-08, Node 22 re-run complete (D22) | Live wallet creation and restore were performed on the pushed head under a real pty on 2026-11-08 (completion message, four public values, seed.enc.json 0600, dirs 0700, backup byte-identical; decrypt round trip byte-identical, 24 words). That run used Node v24.22.2, outside the repository's declared Node >=22 <23 range — the suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). No live testnet spend has been made from this wallet. |
| Public derivations | PASS at e3b65fb832db287fdc8d54794980dd0b3456cc12 (verified 2026-11-08) | derive.js 9/9 and compare.js 9/9 against an independent bip_utils re-derivation; daemon BTC index-5 match (see Node setup above). At the former pin 082f7915 compare.js could not run at the pin |
| Recovery rehearsal | FAIL | No rehearsal has been executed on a clean install with disposable test fixtures, expected addresses, a testnet signing check, pass criteria and a sanitised record. A decrypt round trip is not the rehearsal. Unexecuted = FAIL. |

Release gates (five of six unmet):

| Gate | Status | What it needs |
|---|---|---|
| Lockfile | FAIL (Node side resolved at e3b65fb832db287fdc8d54794980dd0b3456cc12 — see note below) | A lockfile generated from a clean install, committed with package.json; until then, no install reproduces the exact dependency graph that was tested; `npm ci` runs in `tools/hdwallet-gen` (lockfile present) but not at the repository root (no lockfile) |
| Full published-vector coverage | FAIL | Vectors covering TRX and indices 1–2, not only BTC/ETH index 0 |
| Chain-specific fixtures, including TON | PASS at e3b65fb832db287fdc8d54794980dd0b3456cc12 | A TON fixture was derived and independently verified on 2026-11-08 (see §11) and is written into docs/11 and Android D.7 |
| Secret and dependency scanning | FAIL | Named scanners, an owner, and redacted reports retained alongside ci-evidence.json; a missing or erroring scan must never be read as "clean" |
| Reproducible releases | FAIL | A reproducible-build procedure: source and submodule SHAs, dependency locks, checksums, toolchain and image identities, two independent builders, same SHA, separate clean environments, whole-file SHA-256 comparison of agreed unsigned artefacts |
| External security review | FAIL | A review with defined scope (seed handling, derivation paths, signing, recovery, dependencies), named components at a stated revision, recorded exclusions, and a follow-up review of fixes |

Pin note: this rewrite is pinned to e3b65fb832db287fdc8d54794980dd0b3456cc12. The phase-1 repair has since been pushed as e3b65fb832db287fdc8d54794980dd0b3456cc12 (2026-11-08): on that head, the Node setup gate and the Public derivations gate pass (the three JavaScript files pass node --check; compare.js runs), and the Node lockfile gate passes (tools/hdwallet-gen/package-lock.json now exists, Core 4.8.4 exactly). The watch-only results were verified live on the repaired copy before the push: derive 9/9, compare 9/9, smoke 28/28 — all three FAIL on the pushed head 082f7915. The Python side still has no lockfile; the root still has none. CI's single job now passes on e3b65fb832db287fdc8d54794980dd0b3456cc12: the workflow runs `npm run check`, `npm test` and the differential test, and CI run 28 at e3b65fb832db287fdc8d54794980dd0b3456cc12 completed with success on 8 November 2026 (D09). This guide set re-pinned to e3b65fb832db287fdc8d54794980dd0b3456cc12 on 2026-11-09 (user decision); the gate statuses above are the statuses at e3b65fb832db287fdc8d54794980dd0b3456cc12, verified 2026-11-08; the former-pin statuses are retained in the merge record.

What passing does NOT prove: passing the readiness gates does not prove the guide is safe; passing the release gates does not prove it is production-ready; passing any gate does not authorise mainnet use; a successful build or testnet send does not replace the release gates. No gate may be marked passed on the basis of a check that was not run, a file that does not exist in the pinned tree, or a count that combines test layers (never combine counts — no "86/86").

Platform gates (mapped from the Web and Android guides): Web fixture gate — enforced in-engine plus offline engine tests; no live-network gate run (the integrated browser flow was run end to end on 2026-11-08: 14 PASS, 0 FAIL, 3 INFO across 17 steps; send, sign and broadcast were not exercised — no testnet funds). Android fixture gate — defined, pure-logic half checked (55 pure-module tests); the on-device gate has never run: no Core 4.8.4 AAR has been built and no device run has happened. Android debug APK — no debug APK has ever been built; the build steps are an unexecuted procedure, not a verified path.

## 19. About this guide

This guide explains how to build a non-custodial HD wallet from the Bawa reference project: generate a wallet, derive watch-only addresses, compare derivations against independent references, recover from a backup, and track balances — on testnets only. It is a guide, not a product: Bawa itself is the explaining guide, powerful enough to make a wallet, a web wallet and an Android wallet from it alone. The app drafts used to validate the guides are local, unpushed drafts; they are not Bawa deliverables.

What this guide does not do: it does not hold your keys; it does not sign, construct or broadcast transactions (the repo contains no transaction construction or signing code); it does not cover mainnet; it does not claim to be production-ready, secure, or audited; it does not provide a UI template — UI comes from a pre-existing template only, and if none is available, no UI is created here (see the Web and Android guides' UI-template appendices).

Verified on: this rewrite was verified against the repair commit e3b65fb832db287fdc8d54794980dd0b3456cc12 on 8 November 2026, with live checks recorded in the section notes (differential test, live wallet creation and restore, TON fixture derivation, integrated browser flow). Tool versions observed during verification: Python 3.12.3, cryptography==50.0.2, bip-utils==2.12.2, Node v24.22.2 — outside the repository's declared Node >=22 <23 range; the repository suite was re-run on Node v22.23.4 on 2026-11-08 with identical results (D22). Repository commit: e3b65fb832db287fdc8d54794980dd0b3456cc12. Sources fetched on 8 November 2026. The former pin 082f7915 is retained only as history.

---

## Prose credit

Prose author: GPT-6-Astra.

Implementation checks, security decisions and release sign-off remain the responsibility of the Bawa maintainers.

