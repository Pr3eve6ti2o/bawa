# Testing Strategy

Bawa uses layered testing because a wallet implementation can be internally consistent and still be wrong.

## Deterministic standards vectors

Test:

- BIP-39 mnemonic validation and mnemonic-to-seed vectors;
- BIP-32 master and child vectors, including hardened and leading-zero cases;
- BIP-84 Bitcoin native-SegWit outputs;
- BIP-44 Ethereum outputs;
- extended-key serialization and checksum behavior.

The current Trust Wallet Core generator contains public regression fixtures. Full official BIP-32/BIP-39 vector coverage remains a release gate.

## Independent differential verification

Bawa uses bip_utils only as an independent reference implementation for overlapping standards and paths.

~~~
official vector
      ↓
Trust Wallet Core ──────┐
                        ├── compare public outputs
bip_utils ──────────────┘
~~~

The pinned bip-utils==2.12.2 dependency is not imported by runtime wallet-generation code.

Run:

~~~
python3 test/differential_test.py
~~~

Never put a real mnemonic, seed, xprv, hardware-wallet secret or production backup in tests.

## Negative/security tests

Explicitly test:

- malformed JSON;
- oversized JSON lines;
- invalid chain names;
- negative indexes;
- indexes at or above 2^31;
- malformed Base58/checksums;
- private extended keys supplied where public keys are required;
- corrupted AES-GCM ciphertext;
- wrong data keys;
- truncated recovery artifacts;
- symlinked secret paths;
- unexpected existing outputs;
- missing .env.

## TON-specific coverage

TON needs explicit fixtures for:

- mnemonic scheme;
- derivation path;
- wallet contract/version;
- workchain;
- mainnet/testnet presentation;
- wallet/subwallet ID;
- bounceable/non-bounceable address forms.

A syntactically valid TON address is not enough evidence of derivation correctness.

## Application integration tests

Payment tracking must be tested separately from wallet derivation:

~~~
address allocation
      ↓
known funding event
      ↓
chain observation
      ↓
payment match
      ↓
confirmation/finality
      ↓
atomic claim
      ↓
fulfillment
      ↓
reconciliation
~~~

Exercise duplicate observations, provider failures, restarts, reorgs and late payments.
