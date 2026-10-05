# bawa

**bawa generates an HD wallet once, on an interactive terminal, and never touches the seed again.** It runs Trust Wallet's official `wallet-core` (WASM) in Node.js, validates the freshly installed engine against known test vectors before it generates anything, produces a 24-word BIP39 wallet with 256 bits of entropy, and exports only the watch-only account keys the bot needs — BTC `zpub`, ETH `xpub`, TRX `xpub`, one TON address. The mnemonic is encrypted in-process with AES-256-GCM and written as `seed.enc.json` (mode 0600); the seed phrase and the 32-byte data key are printed only to `/dev/tty`, never to stdout, never to a pipe, never to disk.

The runtime half is a persistent derivation daemon. The bot sends it an `xpub` and a child index over stdin and gets back a deposit address in milliseconds — addresses produced by Trust Wallet's own code, not a reimplementation of it.

---

## Architecture

Two phases with a hard boundary between them: seed material exists in exactly one short-lived interactive process, and the long-running process only ever handles extended public keys.

```
 PHASE 1 — ONE-TIME, INTERACTIVE, /dev/tty REQUIRED
 ┌────────────────────────────────────────────────────────────────────┐
 │  make_wallet.py                                                    │
 │    └── node hdwallet-gen/generate.js                               │
 │          ├─ open /dev/tty  ...... refuse to run without a terminal │
 │          ├─ 20 wallet-core self-checks vs. official test vectors   │
 │          ├─ HDWallet.create(256, "") ...... 24 words, empty pass   │
 │          ├─ export zpub / xpub / xpub / TON address                │
 │          ├─ AES-256-GCM encrypt mnemonic, atomic 0600 write        │
 │          └─ print seed + data key to /dev/tty ONLY                 │
 │    └── cross-verify against the bot's own derive_address()         │
 │    └── write XPUB_BTC / XPUB_ETH / XPUB_TRX / TON_DEPOSIT_ADDRESS  │
 └────────────────────────────────────────────────────────────────────┘
                                │ xpubs → .env   (public material only)
                                ▼
 PHASE 2 — RUNTIME, WATCH-ONLY, NO SEED IN MEMORY
 ┌────────────────────────────────────────────────────────────────────┐
 │  derive_daemon.js  —  wallet-core WASM loaded ONCE per process     │
 │                                                                    │
 │   stdin   {"chain":"btc","xpub":"zpub6...","index":5}\n            │
 │   stdout  {"ok":true,"address":"bc1q..."}\n                        │
 │                                                                    │
 │   ~700 ms (cold node + WASM compile per call) → a few ms           │
 └────────────────────────────────────────────────────────────────────┘
```

`derive.js` is the one-shot variant of the same derivation, for scripts and `stdin` pipelines where the daemon isn't running.

---

## Chain support

All account keys are exported at the account level; deposit addresses are derived at `.../0/{index}` on the external chain. Coin IDs are checked at startup (`coin_tron_195`, `coin_ton_607`).

| Chain | SLIP-0044 | Account key path | Exported key | Deposit path | Address form |
|---|---|---|---|---|---|
| Bitcoin | 0 | `m/84'/0'/0'` | `zpub` (BIP84, segwit) | `m/84'/0'/0'/0/{i}` | `bc1q…` |
| Ethereum | 60 | `m/44'/60'/0'` | `xpub` (BIP44) | `m/44'/60'/0'/0/{i}` | `0x…` |
| TRON | 195 | `m/44'/195'/0'` | `xpub` (BIP44) | `m/44'/195'/0'/0/{i}` | `T…` |
| TON | 607 | wallet-core `CoinTypeExt.derivationPath(ton)` | none | single address per wallet | reported at generation |

Every exported account key is round-tripped at generation time: `getPublicKeyFromExtended(key, coin, path)` → `deriveAddressFromPublicKey` must equal `wallet.getAddressForCoin(coin)`, or the run aborts. Index `0` is reserved by the bot; the sample set covers index `1`.

TON uses `getAddressForCoin(CoinType.ton)` directly. No `xpub` is exported for it, and wallet-core exposes one address per TON wallet, not a per-index sequence.

---

## Security model

**Validate the engine before trusting it.** `generate.js` runs 20 assertions against fixed test vectors with an empty BIP39 passphrase before generating a wallet: known BTC and ETH addresses, `zpub`/`xpub` version prefixes, extended-key → address round-trips on the vector wallet, and coin-ID constants (`tron === 195`, `ton === 607`). A mismatched or tampered `wallet-core` build fails the run instead of producing a wallet.

**Entropy and mnemonic.** `HDWallet.create(256, "")` — 256-bit entropy, 24 words, empty passphrase. Word count and BIP39 checksum are both verified before the mnemonic is used.

**Encryption at rest.** The mnemonic is encrypted in-process with AES-256-GCM. The 32-byte data key is `crypto.randomBytes(32)`, generated in the same process; the 12-byte nonce is random per bundle. AAD is `nova-shop-seed-v1`. On-disk layout: `nonce_b64` holds the nonce, `ciphertext_b64` holds `ciphertext || 16-byte GCM tag` — the same shape `AESGCM.decrypt()` expects.

**Seed display.** The mnemonic and data key are written to a file descriptor opened on `/dev/tty`, which is the controlling terminal and not a pipe. stdout carries public material only (`zpub`, `xpub`s, TON address, sample addresses, check results, wallet-core version). `make_wallet.py` sweeps the parsed stdout for seed keys (case- and separator-insensitive), 12+ word lowercase runs, arrays of seed words, base64 blobs that decode to either, and 64-hex data keys — and aborts on a hit.

**The terminal check runs first.** `/dev/tty` is opened before the engine is initialised and before any key material exists. In a non-interactive environment the process exits without generating a wallet and without writing anything. The encrypted bundle is also written *after* the operator confirms, so a failed confirmation never leaves an undecryptable seed file behind.

**Operator confirmation gates.** Two prompts, both read byte-by-byte from `/dev/tty`: type the first word of the seed phrase, then type `SAVED` to confirm the data key was stored. Either mismatch aborts before `seed.enc.json` exists.

**Atomic, permissioned writes.** The bundle is written to `seed.enc.json.tmp` with mode 0600, `fsync`ed, renamed over the target, and the containing directory is `fsync`ed. The secrets directory is `chmod 0700` on every run — `mkdir` mode is not applied to a directory that already exists. In Python, `.env` and the backup bundle use `O_CREAT|O_EXCL|O_NOFOLLOW` with mode 0600 followed by `os.replace`; the bundle directory refuses to be a symlink.

**Keys never appear in a process listing.** `derive.js` reads the `xpub` from stdin, not `argv` — command lines are world-readable in `/proc/<pid>/cmdline` for the lifetime of the process. The daemon carries the `xpub` in the JSON request body on stdin.

**Extended private keys are rejected by version bytes.** Both `derive.js` and `derive_daemon.js` base58-decode the input, verify the 4-byte double-SHA256 checksum, and compare the version prefix against `xprv`, `yprv`, `zprv`, `Yprv`, `Zprv`, `tprv`, `uprv`, `vprv`. A private key is refused before it can reach wallet-core and surface in an error message. Any extended key echoed in an error is passed through a `redact()` filter first.

**Derivation index cap.** Indices are validated as integers in `[0, 2147483647]`. At `2^31` the BIP32 hardened bit would be set and the derivation would silently come from a different keychain — addresses that the `xpub` cannot reproduce.

**Prototype-pollution-resistant lookups.** The chain → coin and chain → path tables in the daemon use `Object.create(null)`, so inherited properties like `__proto__` and `toString` are not truthy. An explicit `Set` allowlist (`btc`, `eth`, `trx`) is checked before any table access.

**The daemon does not die.** Every protocol line is handled inside a `try`/`catch` that always answers with a JSON object. Requests are capped at 4096 bytes and xpubs at 200 characters.

---

## Components

| File | Role |
|---|---|
| `hdwallet-gen/generate.js` | One-time generator. Opens `/dev/tty` first, runs 20 wallet-core self-checks, creates the 256-bit wallet, exports `zpub`/`xpub`/`xpub`/TON, encrypts the mnemonic with AES-256-GCM, gates on two operator confirmations, writes the bundle atomically. Public stdout only. |
## Components

| File | Role |
| --- | --- |
| `derive.js` | One-shot CLI that reads the account xpub from stdin (never argv, so it stays out of `/proc/<pid>/cmdline`), validates chain and index, rejects extended private keys by base58 version bytes, and prints the derived address for `btc`/`eth`/`trx` on stdout. |
| `make_wallet.py` | Orchestrator: runs `generate.js`, sweeps its parsed stdout recursively for seed material, cross-checks the bot's own `crypto_payments.derive_address` against wallet-core for indices 0 and 1, verifies the AES-256-GCM bundle and its 0600 mode, writes the 0700 download bundle, and atomically updates `XPUB_BTC` / `XPUB_ETH` / `XPUB_TRX` / `TON_DEPOSIT_ADDRESS` in `.env`. |
| `decrypt_seed.py` | Recovers the mnemonic from `seed.enc.json` using the 64-hex data key read from stdin (or `getpass` when stdin is a TTY), validating `alg`, 12-byte nonce length, and the GCM auth tag before printing plaintext to stdout. |
| `compare.js` | Diagnostic that derives indices 0-2 for BTC/ETH/TRX from the xpubs in `.env` (path overridable via `NOVA_ENV`) and prints them, for diffing against the bot's Python derivation. |

## Derivation daemon protocol

One JSON object per line, max 4096 bytes per line, over stdin/stdout.

- **Startup:** the daemon prints `{"ready":true}` after the wallet-core WASM engine is loaded. Wait for this line before sending work.
- **Request:** `{"chain":"btc"|"eth"|"trx","xpub":"<extended public key>","index":N}` — chain is checked against an explicit allowlist before any lookup, xpub must be a string under 200 chars, index must be an integer in `[0, 2147483647]`.
- **Response:** `{"ok":true,"address":"<address>"}` or `{"ok":false,"error":"<redacted message>"}`. Every code path answers with a JSON line; no exception kills the daemon.

```
{"ready":true}
{"chain":"btc","xpub":"zpub6q...","index":5}
{"ok":true,"address":"bc1q..."}
{"chain":"btc","xpub":"xprv9s...","index":5}
{"ok":false,"error":"extended public key required"}
{"chain":"doge","xpub":"xpub6...","index":0}
{"ok":false,"error":"bad request"}
```

## Usage

### Prerequisites

- **Node.js 18+** — the tooling uses `BigInt` base58 math, optional catch binding, `fs.rmSync`, and `fs.fsyncSync`.
- **`@trustwallet/wallet-core`** — install once: `cd tools/hdwallet-gen && npm install` (pulls `^4.8.4`; `initWasm()` loads the WASM engine once per process).
- **Python 3.8+** for `make_wallet.py`, with `cryptography` installed for `decrypt_seed.py` (`pip install cryptography`).

### 1. Generate a wallet

```
python3 make_wallet.py          # refuses if a seed bundle or .env keys already exist
python3 make_wallet.py --force  # regenerate; generate.js writes a timestamped .bak first
```

`generate.js` opens `/dev/tty` **before any key material exists**. With no controlling terminal it exits 1 immediately — no seed generated, nothing written to disk. Run it interactively.

On your terminal (`/dev/tty`, not a pipe) you see: the 24-word seed phrase, the 64-hex data key, then two prompts — type the **first seed word**, then type **`SAVED`**. Fail either prompt and `seed.enc.json` is never written.

stdout carries public material only, as one JSON object: `btc_zpub`, `eth_xpub`, `trx_xpub`, `ton_address`, `ton_path`, `ton_note`, `samples` (external index 1 — index 0 is reserved by the bot), `checks`, `seed_encrypted_to`, `wallet_core_version`.

`make_wallet.py` writes `XPUB_BTC`, `XPUB_ETH`, `XPUB_TRX`, and `TON_DEPOSIT_ADDRESS` into `.env` via temp-file-plus-`os.replace`.

### 2. Derive deposit addresses

Long-running daemon (one WASM load, milliseconds per derivation):

```
echo '{"chain":"eth","xpub":"'"$XPUB_ETH"'","index":5}' | node derive_daemon.js
{"ready":true}
{"ok":true,"address":"0x..."}
```

One-shot (spawns a fresh Node process and recompiles the WASM, roughly 700ms):

```
echo "$XPUB_BTC" | node derive.js btc 5
```

Cross-check the bot against wallet-core:

```
node compare.js   # btc/eth/trx addresses for indices 0, 1, 2
```

### 3. Recover the seed

```
printf '%s' "$DATA_KEY" | python3 decrypt_seed.py seed.enc.json
python3 decrypt_seed.py seed.enc.json    # prompts via getpass when stdin is a TTY
```

The plaintext mnemonic goes to stdout. Redirect it to a secure channel, keep it out of shell history, and clear scrollback afterwards.

## Backup strategy

Any one of these fully recovers the wallet:

1. **The 24-word seed phrase**, written down offline.
2. **`seed.enc.json` + the 64-hex data key.** Both are required — the bundle alone is ciphertext (AES-256-GCM, no KDF, the key is random), and the key alone decrypts nothing.

The xpubs are **not** a backup. They recover deposit-address derivation only; they cannot spend.

`make_wallet.py` copies `seed.enc.json`, `decrypt_seed.py`, and `README.txt` to `~/workspace/your_files/nova-shop-seed-backup/` at 0600. Because the ciphertext and its decryptor travel together, **the data key is the one secret that must not be in that bundle** — store it in a password manager.

## Threat model

| Threat | Mitigation |
| --- | --- |
| Compromised derivation server (bot host) | The host holds xpubs only. `derive.js` and `derive_daemon.js` reject extended private keys by base58 version bytes before wallet-core sees them, so host compromise yields no spendable key. |
| Log / stdout scraping | Mnemonic and data key go to `/dev/tty` only. `make_wallet.py` recursively scans `generate.js` stdout for seed keys (case- and separator-insensitive), ≥12-word lowercase runs, word arrays, base64-encoded seed, and 64-hex data keys, and aborts on a hit. |
| Crash between generation and encryption | The mnemonic never crosses a pipe, so it cannot land in pipe buffers; it is encrypted in-process before any file is written. (Partial — see limitations.) |
| Malicious or oversized index | Indices above 2^31-1 are rejected; at or above that value the hardened bit would be set and derivation would target the wrong keychain, making funds unrecoverable from the xpub. |
| Private key smuggled to the daemon | Version-byte rejection plus `redact()`, which scrubs extended-key patterns and any base58 run of 100+ characters from every error message. |
| Partial-file reads / torn writes | `seed.enc.json` is written to a 0600 temp file, fsynced, renamed, and the directory fsynced. `.env` uses `O_EXCL|O_NOFOLLOW` plus `os.replace`. |
| World-readable artifacts | `secrets/` is chmod 0700 after `mkdir` (mode is not reapplied on an existing dir), the bundle is 0600, and backups are `COPYFILE_EXCL` + chmod 0600. |
| Symlink redirection | The download bundle directory is refused if it is a symlink; backup copies and the `.env` temp use `O_NOFOLLOW`. |
| Path traversal via bundle path | `seed_encrypted_to` from subprocess stdout is resolved with `realpath` and must fall inside `secrets/`. |
| xpub exposed in process listings | xpubs are read from stdin and carried in JSON request bodies, never in argv; the daemon caps xpub length at 200 chars. |
| Key material lingering in memory | `w.delete()` memzeros the WASM heap seed/mnemonic and `dataKey.fill(0)` zeroes the key buffer after display. |
| Error messages echoing secrets | Every failure path in both `derive.js` and `derive_daemon.js` passes through `redact()`; `make_wallet.py` suppresses `generate.js` stderr entirely. |

## Known limitations

- **Process memory is not protected.** During generation the mnemonic and data key exist in plaintext inside the Node process. Core dumps, swap, or an attached debugger can capture them — the `/dev/tty` channel only keeps them out of pipes, logs, and crash output.
- **The data key is shown once.** There is no KDF and no passphrase. Lose it and `seed.enc.json` is permanently undecryptable; lose the bundle and the keyalone is useless. Store them separately.
- **No passphrase (BIP39).** The wallet is created with an empty passphrase. Anyone with the 24 words controls the funds — there is no second factor.
- **TON is single-address.** wallet-core exposes one TON address per wallet; there is no per-index TON derivation sequence.

## License

MIT
