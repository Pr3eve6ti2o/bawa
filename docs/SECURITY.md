# Security & Threat Model

Bawa's primary security boundary is:

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

The generator displays the mnemonic and encryption data key through the controlling terminal and keeps them out of normal subprocess stdout/stderr. This reduces accidental logging but does not guarantee protection from a compromised operating system, debugger, core dump, swap, memory capture or malicious terminal.

## Filesystem rules

Wallet secrets are written under a dedicated directory with restrictive permissions. Encrypted artifacts are written atomically as 0600. Symlinked secret paths are rejected.

.env is not a secret store for mnemonics or private keys. It may contain public xpub/zpub values, which still have privacy implications.

## Dependency and supply chain

- Trust Wallet Core is pinned to an exact tested package version.
- bip_utils is pinned and used only for independent verification.
- Do not treat a version range as a tested dependency graph.
- Commit a lockfile from a clean install before a production release.
- Run dependency and secret scanning in CI/release workflows.
- Prefer signed/tagged upstream releases and record release checksums/provenance where practical.

## Known limitations

JavaScript/WebAssembly memory cannot provide a cryptographic guarantee of perfect zeroization. Encryption at rest protects stored ciphertext but does not eliminate plaintext exposure while a mnemonic is being generated or recovered.

An external security review is required before treating this as production custody infrastructure.
