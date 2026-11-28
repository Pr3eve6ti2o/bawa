# Security & Threat Model

Bawa's intended deployment trust boundary is:

~~~
trusted/offline region (signing domain)
        │
        ├── generation
        │       └── mnemonic / seed / private material
        │
        ├── separate offline signer
        │
        └── account-level public roots
                    │
                    │  hand-carried media only (air gap)
                    ▼
             online watch-only
                    │
                    ▼
             RPC / indexer
~~~

Trusted/offline generation and signing are operating requirements. A controlling terminal and a public-only hand-off do not themselves establish host trust or network isolation. Host trust means a machine you control, with verified software provenance, no untrusted code or remote access, and no history of compromise. Network isolation means no live data link between the signing/generation environment and any internet-connected computer (an air gap), with data moving only by hand-carried media. Private keys and seeds must never leave the signing domain.

## Assets to protect

Highest sensitivity:

1. BIP-39 mnemonic and passphrase;
2. private keys / private extended keys;
3. recovery data key;
4. encrypted recovery artifacts before controlled backup. A controlled backup
   is a copy made and stored under recorded physical access controls in a
   location without a shared fire or flood risk with the other copies (per
   docs/08 and docs/15). The "before controlled backup" condition ends once
   such a copy exists and has been checked for completeness and legibility.

Privacy-sensitive:

- account xpub/zpub;
- derived address inventories (lists of addresses derived from an account-level public root);
- payment/order associations (linkages between a derived address or payment and the specific order or payment request it satisfies).

## Threat model

Bawa assumes the online application may be monitored, logged, restarted or compromised. The architecture therefore avoids sending seed material to the watch-only runtime.

Generation requires a controlling terminal. At startup, `generate.js` opens `/dev/tty` and exits with a fatal error and status 1 if no controlling terminal is available. The generator writes the mnemonic and data key only to that terminal's file descriptor, keeping them out of normal stdout/stderr. This reduces accidental logging through stdout/stderr, but terminal output can still be captured or recorded, for example by `script` or through `tmux` capture or logging. Writing to the controlling terminal does not guarantee protection from a compromised OS, debugger, core dump, swap, memory capture or malicious terminal.

## Filesystem rules

`generate.js` sets its secrets directory to mode 0700, and `make_wallet.py` uses mode 0700 for its secrets and backup directories. For recovery output, `decrypt_seed.py` writes the recovered mnemonic to `/dev/tty` by default, to standard output with `--stdout`, or as plaintext to the file specified by `--output`. For `--output`, the script sets the temporary file's mode to 0600 with `os.fchmod` before installing it at the requested path with `os.replace`. The primary encrypted seed bundle in `generate.js` is written to a mode-0600 temporary file and installed atomically with `fs.renameSync`. Backups made by `generate.js --force` and `make_wallet.py`'s `_copy_0600` are non-atomic copies followed by chmod to 0600. Symlink checks differ by tool. `make_wallet.py` checks the secrets directory, `.env`, backup directory and `_copy_0600` source/destination paths. `decrypt_seed.py` checks the encrypted artefact and `--output` paths. `generate.js` does not check `secretsDir`, `encPath`, `tmpPath` or the `--force` `.bak` path, and `compare.js` does not check `.env` before reading it.

`.env` must not be used to store mnemonics or private keys. `make_wallet.py` writes public xpub values into `.env` using mode 0600. Treat extended public keys as privacy-sensitive.

Recovery encryption uses AES-256-GCM with the additional authenticated data (AAD) string `nova-shop-seed-v1`, a Nova Shop identifier used by the current code. `generate.js` and `decrypt_seed.py` use the same AAD bytes. The recovery bundle records the value in its `aad` field, but that field is informational: `decrypt_seed.py` does not read it and instead uses the constant AAD value. AAD is authenticated context, not an encryption secret; recovery must use the same AAD bytes used for encryption.

## Dependency and supply chain

- Trust Wallet Core is pinned to an exact package version.
- bip_utils is pinned and used only for independent verification.
- Do not treat a version range as a tested dependency graph.
- The tools lockfile is committed and records Core `4.9.3` exactly. No root lockfile is committed; the root `package.json` has no dependencies. Before a production release, verify and document the tools lockfile's clean-install origin and reproducibility.
- The current `ci.yml` contains no dependency- or secret-scanning steps, and scanning evidence is recorded as `blocked-unverified`. Add and verify both kinds of scanning in CI/release workflows, and record the results.
- Prefer signed/tagged releases. No release checksums or provenance are recorded in the repository. Record checksums and provenance where practical.

## Known limitations

JavaScript/WebAssembly memory cannot provide a cryptographic guarantee of perfect zeroization. Encryption at rest protects stored ciphertext but does not eliminate plaintext exposure while a mnemonic is being generated or recovered.

An external security review is required before any real funds are involved, whether in production or non-production use.

Vulnerability reports go through [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues) — there is no separate private disclosure channel (maintainer decision, 2026-11-18; OI-065 closed; see [SECURITY.md](../SECURITY.md)). Do not post exploit details publicly; describe the issue at a level that lets the maintainer reproduce it without publishing working exploit material.

No session or inactivity timeout is implemented in the repository code on `main`. The live web wallet (on `panel-rebuild/token-gaps`) implements auto-lock as an optional setting, off by default, with a toggle plus duration on /security (5-minute default when enabled). The 120-second subprocess timeout in `make_wallet.py` applies to generation, not inactivity; the daemon has no timeout.
