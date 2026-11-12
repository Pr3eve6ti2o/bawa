# Security & Threat Model

Bawa's intended deployment trust boundary is:

~~~
trusted/offline generation
        │
        ├── mnemonic / seed / private material
        │
        └── account-level public roots
                    │
                    ▼
             online watch-only
                    │
                    ▼
             RPC / indexer
~~~

Trusted/offline generation is an operating requirement. A controlling terminal and a public-only hand-off do not themselves establish host trust or network isolation.

## Assets to protect

Highest sensitivity:

1. BIP-39 mnemonic and passphrase;
2. private keys / private extended keys;
3. recovery data key;
4. encrypted recovery artifacts before controlled backup.

Privacy-sensitive:

- account xpub/zpub;
- derived address inventories;
- payment/order associations.

## Threat model

Bawa assumes the online application may be monitored, logged, restarted or compromised. The architecture therefore avoids sending seed material to the watch-only runtime.

Generation requires a controlling terminal. At startup, `generate.js` opens `/dev/tty` and exits with a fatal error and status 1 if no controlling terminal is available. The generator writes the mnemonic and data key only to that terminal's file descriptor, keeping them out of normal stdout/stderr. This reduces accidental logging through stdout/stderr, but terminal output can still be captured or recorded, for example by `script` or through `tmux` capture or logging. Writing to the controlling terminal does not guarantee protection from a compromised OS, debugger, core dump, swap, memory capture or malicious terminal.

## Filesystem rules

`generate.js` sets its secrets directory to mode 0700, and `make_wallet.py` uses mode 0700 for its secrets and backup directories. Recovery output is separate: `decrypt_seed.py` writes the recovered mnemonic to `/dev/tty` by default, to standard output with `--stdout`, or as plaintext to the file specified by `--output`. The `--output` file is written using a mode-0600 temporary file followed by `os.replace` and chmod to 0600. The primary encrypted seed bundle in `generate.js` is written to a mode-0600 temporary file and installed atomically with `fs.renameSync`. Backups made by `generate.js --force` and `make_wallet.py`'s `_copy_0600` are non-atomic copies followed by chmod to 0600. Symlink checks differ by tool. `make_wallet.py` checks the secrets directory, `.env`, backup directory and `_copy_0600` source/destination paths. `decrypt_seed.py` checks the encrypted artefact and `--output` paths. `generate.js` does not check `secretsDir`, `encPath`, `tmpPath` or the `--force` `.bak` path, and `compare.js` does not check `.env` before reading it.

`.env` must not be used to store mnemonics or private keys. `make_wallet.py` writes public xpub values into `.env` using mode 0600. Treat extended public keys as privacy-sensitive.

Recovery encryption uses AES-256-GCM with the additional authenticated data (AAD) string `nova-shop-seed-v1`. This is a legacy Nova Shop identifier used by the current code. `generate.js` and `decrypt_seed.py` use the same AAD bytes, and the recovery bundle records the value in its `aad` field. AAD is authenticated context, not an encryption secret; recovery must use the AAD used for encryption.

## Dependency and supply chain

- Trust Wallet Core is pinned to an exact tested package version.
- bip_utils is pinned and used only for independent verification.
- Do not treat a version range as a tested dependency graph.
- The tools lockfile is committed and records Core `4.9.1` exactly. No root lockfile is committed; the root `package.json` has no dependencies. Before a production release, verify and document the tools lockfile's clean-install origin and reproducibility.
- The current `ci.yml` contains no dependency- or secret-scanning steps, and scanning evidence is recorded as `blocked-unverified`. Add and verify both kinds of scanning in CI/release workflows, and record the results.
- Prefer signed/tagged releases. No release checksums or provenance are recorded in the repository. Record checksums and provenance where practical.

## Known limitations

JavaScript/WebAssembly memory cannot provide a cryptographic guarantee of perfect zeroization. Encryption at rest protects stored ciphertext but does not eliminate plaintext exposure while a mnemonic is being generated or recovered. (A-7: the `generate.js` mnemonic is held as a JS string and cannot be zeroed; best-effort wiping only. Record only; no code change.)

An external security review is required before treating this as production custody infrastructure.

A vulnerability-disclosure procedure is documented in the Vulnerability disclosure procedure section below. No private email contact is published; publishing one remains an open maintainer action. Do not post exploit details publicly.

No session or inactivity timeout is implemented in the repository code. The 10-minute auto-lock is specified only in the Web draft. The 120-second subprocess timeout in `make_wallet.py` applies to generation, not inactivity; the daemon has no timeout.

## Vulnerability disclosure procedure

1. Report security issues privately. Never post exploit details, proof-of-concept code, mnemonics, private keys or recovery material in a public issue, discussion, pull request or chat.
2. Include the affected component and the repository commit where you found the issue; a plain description of the issue; steps to reproduce it; the impact (what an attacker could do and what they could not); and whether the issue is already publicly known.
3. Submit the report privately through GitHub's private vulnerability reporting for the `Pr3eve6ti2o/bawa` repository. If that channel is unavailable, contact the maintainer privately and do not post details publicly.
4. The maintainer confirms receipt, assesses the report, prepares a fix, and coordinates disclosure of the fix.
5. No private email contact is published in this procedure; publishing one remains an open maintainer action. This procedure does not authorise testing against any live service or funded wallet, and it does not change the real-funds gates.
