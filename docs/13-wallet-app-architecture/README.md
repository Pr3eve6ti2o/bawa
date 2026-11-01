# 13 Wallet app architecture

## 13 Wallet app architecture — overview and layers

A wallet app combines three roles: **key manager, viewer and signer**. It manages access to keys, presents chain activity and authorises transactions. It is neither a custodian nor a node: the key holder retains signing authority, while nodes provide chain state. Assets are recorded on-chain, not held inside the app’s interface or database.

For Bawa’s watch-only deployment, these roles belong in separate environments. Key generation and signing stay on the trusted side; the online application handles public addresses, chain observations and payment records.

The conceptual stack separates responsibilities, rather than describing a single process:

```text
Protocol and key standards
↓
Per-chain wallet policy
↓
Trust Wallet Core primitives
↓
Public-only address handling
↓
Node RPC and searchable chain history
↓
Wallet views and observed payments
↓
Application records and order reconciliation
```

| Layer or component | Responsibility | Boundary — what it must never do |
| --- | --- | --- |
| Standards | Define shared rules for keys, derivation, addresses and transaction formats. | Perform live chain queries or make application-specific payment decisions. |
| Per-chain policy | Select the appropriate key scheme, derivation paths, address encoding and transaction rules for each supported network. | Fetch chain state or determine whether an order has been settled. |
| Trust Wallet Core | Implement wallet primitives, including key operations, address construction, derivation and transaction signing. | Act as a node client, history index or order-reconciliation service. |
| Trusted generator | Create private wallet material and account public roots on a trusted machine, without requiring a chain connection. | Export secrets to the watch-only host or take over online payment tracking. |
| Public-only address handling | Derive receiving addresses from a suitable public root, or use an explicitly provisioned public address. | Sign transactions or accept a mnemonic, seed, private key or private extended key. |
| Node / RPC access | Expose blocks, transactions and other chain-state information. | Derive wallet keys, sign on the application’s behalf or decide that an order is paid. |
| History indexer | Organise chain activity so that relevant transactions and address histories can be found efficiently. | Generate wallets, sign transactions or make order-payment decisions. |
| Wallet and payment tracking | Maintain the public wallet view and track observed transfers and their status. | Create wallets, handle signing secrets or perform signing. |
| Database and reconciliation | Persist observations, associate payments with orders and apply the application’s settlement policy. | Derive keys, sign transactions or substitute local records for chain evidence. |

[Trust Wallet Core](https://github.com/trustwallet/wallet-core) is the low-level, multi-chain library within this architecture, not the whole wallet application. The open-source project reports coverage of over 130 blockchains. Its cross-platform C++ implementation has bindings for iOS, Android and WebAssembly.

Internally, it separates the public API, core wallet types (`HDWallet`, `Mnemonic`, `StoredKey`, `Account`), multi-chain interfaces (`AnyAddress`, `AnySigner`, `CoinType`), cryptographic algorithms and individual chain modules. These implementation layers are described in [DeepWiki — Trust Wallet Core](https://deepwiki.com/trustwallet/wallet-core) and [DeepWiki — Core Wallet Architecture](https://deepwiki.com/vultisig/walletcore-spm/2.1-core-wallet-architecture). They provide key, address and transaction machinery; they do not replace chain observation or application reconciliation.

### Keep private material outside the watch-only runtime

Wallet provisioning has its own trust boundary:

```text
Trusted machine: offline wallet generation
↓
Trust Wallet Core
↓
Mnemonic, seed and private keys retained locally
↓
Export <account-public-root> or <public-address>
↓
Public-only provisioning boundary
↓
Online watch-only application
↓
Public address derivation where supported
↓
Chain observations from nodes and indexers
↓
Payment tracking and reconciliation
```

Use an account-level public root, such as an `xpub` or `zpub`, only where the chain and address policy support public derivation. Otherwise, provision public addresses. The watch-only tools must reject private extended keys rather than accepting them and extracting their public portion. Signing remains a trusted-side operation.

Assume the online host will be monitored, logged, restarted and potentially compromised. Mnemonics, seeds and private material must therefore be absent from its configuration, requests, database, logs and recovery procedures. Encrypting a secret before placing it there does not preserve this separation. Public roots do not confer signing authority on their own, but they can reveal related addresses, so restrict their distribution too.

An observed transfer is evidence, not an automatic “paid” result. Reconciliation must check the network, asset, recipient, amount and applicable confirmation or finality policy before accepting it against an order.

You should see:

- [ ] Key generation and signing confined to the trusted environment.
- [ ] Public-only inputs throughout the watch-only runtime.
- [ ] Wallet Core kept separate from node access and history indexing.
- [ ] Chain observations distinguished from order-settlement decisions.

### Key management layer

Keep recovery material and signing authority inside the key-management component. Parts of Bawa that discover addresses, track balances or allocate deposit addresses should use account-scoped public material instead.

#### From entropy to account keys

```text
<cryptographically secure random entropy>
  ↓ BIP-39 checksum and word encoding
<recovery mnemonic>
  ↓ BIP-39 derivation with <passphrase-or-empty-string>
<64-byte seed>
  ↓ BIP-32 master-node generation
<master extended private key>
  ↓ hardened purpose, coin-type and account derivation
<account extended private key>
  ↓ non-hardened branch and address-index derivation
<individual signing keys>
```

These values have different roles and must not share an ambiguous label such as “wallet key”.

- **Entropy** supplies the initial randomness. [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) accepts 128–256 bits in 32-bit increments. Generate it with a cryptographically secure random generator, not timestamps, user-chosen words or ordinary application randomness. It is recovery-sensitive material, but not a signing key.

- **The mnemonic** represents that entropy together with a checksum, using a prescribed word list. The permitted lengths are 12, 15, 18, 21 and 24 words. The checksum helps detect some transcription errors; it does not conceal the entropy. The phrase is neither a single account’s private key nor the BIP-39 seed itself.

- **The BIP-39 passphrase** is an additional seed-derivation input, with an empty string used when none is configured. Holding the words constant while changing this input produces a different wallet. A mistyped passphrase therefore leads to different keys rather than a “wrong password” result. It is not a device PIN or the password used to decrypt locally stored wallet data.

- **The seed** is the 64-byte output of PBKDF2-HMAC-SHA512 with 2,048 iterations. The mnemonic supplies the password input; the salt combines the literal prefix `mnemonic` with the passphrase. Apply BIP-39’s NFKD normalisation before UTF-8 encoding. This process derives bytes rather than encrypting the phrase. Possession of the resulting seed is sufficient to regenerate the HD tree without knowing the words or passphrase.

- **The master extended private key** is the root of that tree. [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) defines the HMAC-SHA512 procedure that obtains a master private scalar and a 32-byte chain code from the seed. Those values, with the serialisation metadata, form the root extended private key. The chain code supports child derivation; it is not another signing key. A private scalar without its chain code is not a complete extended private node.

- **Account and leaf private keys** have different scope. An account extended private key can derive the private descendants belonging to that account. A leaf private key supplies signatures for its own keypair, not an entire account tree. Where that key alone satisfies the spending policy, its holder can normally spend the associated funds.

Keep storage-encryption keys separate from recovery and signing material. Never record entropy, mnemonics, passphrases, seeds or private keys in documentation, logs, issue reports, repositories or chat. Use placeholders such as `<mnemonic>` and `<account-extended-private-key>`.

#### Paths and the hardened boundary

[BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) assigns meaning to the path components:

```text
m / purpose' / coin_type' / account' / change / address_index
```

Here, `m` denotes the private root. Purpose `44'` selects the BIP-44 convention. The coin type separates coin-specific branches, and the account index separates groups of keys. A BIP-44 account is therefore not necessarily one on-chain address.

The `change` component selects the external receiving branch with `0`, or the internal change branch with `1`. The final index selects a key within that branch. For account-based networks without UTXO change, document the supported branch policy rather than inventing change behaviour.

BIP-32 divides its 32-bit child-index space into:

- **Non-hardened:** `0` through `2^31 − 1`.
- **Hardened:** `2^31` through `2^32 − 1`.

An apostrophe indicates a hardened step: the displayed index is encoded with `2^31` added. Deriving a hardened child requires the parent’s private node, even when only the child’s public key is wanted. Non-hardened public descendants can instead be calculated from a parent extended public node.

For a conceptual Bitcoin testnet policy, a receiving-key template is:

```text
m/44'/1'/0'/0/<address-index>
```

Coin type `1'` is the testnet allocation recorded in [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md). The purpose, coin-type and account steps are hardened. Key management must therefore derive `m/44'/1'/0'` privately before exporting its public counterpart. A root public node cannot substitute for that account export because it cannot traverse those hardened steps.

```text
Key management: <account extended private node>
  ↓ export public key, chain code and node metadata only
Watch-only runtime: <account extended public node>
  ↓ derive non-hardened receiving and change descendants
<public keys and addresses>
```

From the exported account node, the runtime can derive relative paths such as `0/<address-index>` and `1/<address-index>`. These are suffixes beneath the account, not paths starting at `m`.

Only public derivation material crosses this runtime boundary because address generation does not require spending authority. An inconvenient address API is not a reason to export an xprv or a leaf private key. Signing should remain a policy-checked operation inside the secret-holding component, returning a signature or signed transaction rather than a key. Hardened derivation provides a cryptographic limit; component isolation must enforce the operational separation.

#### Public does not mean unrestricted

An **extended public key**, commonly called an xpub, serialises a public key together with its chain code and node metadata. Prefix variants do not change its fundamental role. By itself, it cannot sign, derive hardened children or reconstruct private ancestors.

It can, however, link addresses throughout its non-hardened subtree and reveal activity when combined with network data. Treat account public exports as sensitive wallet metadata, with controlled distribution and logging.

There is also a key-compromise hazard: an account xpub combined with a leaked descendant private key on an entirely non-hardened path can expose the account private node. Hardened ancestors limit upward propagation; they do not protect the exported account’s non-hardened subtree from this combination.

Keep the full account path, network and address-format policy alongside each public export. The xpub’s embedded metadata is not a complete wallet description.

You should see:

- [ ] Recovery tests covering normalisation and empty/non-empty passphrases.
- [ ] Matching public derivations on the signer and watch-only sides.
- [ ] Hardened derivation rejected by public-only interfaces.
- [ ] Account-scoped public exports with explicit network and path policy.
- [ ] No recovery or signing secrets in diagnostics or examples.

### Key lifecycle — generation, storage, backup, recovery, deletion

Generation establishes a new wallet identity. It is a one-time provisioning operation, not an application startup task or a recovery mechanism. Keep the recovery phrase and signing capability outside components that only need public address-derivation data.

#### Generation

Run `tools/hdwallet-gen/generate.js` on a trusted machine with verified dependencies and a private, unrecorded controlling terminal. Prepare dependencies before disconnecting from the network. Do not use CI, a recorded support session, or a terminal with persistent capture enabled. Rehearsals must use disposable testnet material, never an operational wallet or a published example phrase.

An existing `seed.enc.json` must cause refusal, not replacement. Check this before generating another wallet and enforce it when publishing the file: an ordinary rename can overwrite its destination, so it is not itself a no-clobber safeguard. Never delete an established seed file simply to make another generation attempt succeed.

The 24-word recovery phrase and independently generated data key are disclosed once through `/dev/tty`. Neither belongs on stdout, stderr, in application logs, or in clipboard and screenshot workflows. If a controlling terminal is unavailable, stop rather than falling back to ordinary output streams. TTY-only handling prevents ordinary output redirection from collecting secrets; it does not protect against terminal recording or a compromised host.

Before writing the encrypted seed file, the operator must:

1. Record the complete phrase offline, then enter its first word when challenged.
2. Store the displayed hexadecimal data key separately from the encrypted seed, then enter the case-sensitive acknowledgement `SAVED`.

A mismatch or interrupted input must abort without publishing the seed file, and diagnostics must remain redacted. These checks acknowledge the operator’s actions; they do not establish that either backup is complete or readable.

#### Storage

The encrypted payload is the recovery phrase itself. Bawa encrypts it in-process using AES-256-GCM, a fresh 32-byte random data key and a 12-byte nonce. The key is not derived from a password: there is no password KDF or password-reset route.

The JSON envelope retains the nonce, encryption metadata and ciphertext followed by its authentication tag. Preserve the whole envelope. In particular, the AAD value `nova-shop-seed-v1` is an authentication input, not a display label that can be renamed during documentation or branding changes. Recovery must authenticate the payload before using any plaintext; see the [Node.js Crypto documentation](https://nodejs.org/api/crypto.html) for GCM API behaviour.

On the generation host:

- Restrict the secrets directory to its owner with mode `0700`.
- Write the encrypted temporary file with mode `0600`; never create a plaintext seed temporary file.
- Flush the temporary file, publish it under the final name, then flush the directory. This supports durable publication but does not replace no-overwrite enforcement.
- Keep the data key out of that directory, its configuration and its backup archives.

The normal path releases the Wallet Core wallet object after deriving public outputs and later clears the mutable data-key buffer. Require best-effort cleanup on failure as well. Neither operation proves that JavaScript strings, hexadecimal copies, terminal buffers or operating-system copies have been erased.

Normal output contains public wallet metadata, checks, the encrypted-file location and the Wallet Core version. Extended public keys cannot sign by themselves, but they can expose linked addresses and wallet activity; treat them as privacy-sensitive rather than harmless logging material.

#### Backup

Maintain two clearly distinguished recovery routes:

- **Offline phrase:** a complete, ordered copy of the 24 words on a durable medium with controlled physical access. This can recover the wallet without the encrypted JSON or its data key. Background on mnemonic-based recovery is available in [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).
- **Encrypted backup:** an intact copy of `seed.enc.json`, with the data key held in a separate security domain. Do not reunite them in a shared archive, synchronised folder or exported vault backup.

Inventory every copy, its custodian and its retention policy. Include removable media, replicas, snapshots and older backup versions. A backup that cannot be located cannot be reliably retired.

Also retain protected records of coin and derivation settings, expected public identities and the Wallet Core version. Back up application state separately: restoring the phrase does not recreate address-allocation history or other off-chain records.

#### Recovery

Recover in a new trusted, non-recorded session. Either import the offline phrase into a compatible wallet or recover it from the encrypted envelope using the separately held data key. Do not generate another phrase and expect it to recover the original addresses.

`tools/decrypt_seed.py` is the designated decryption helper. Before using it, verify that its input and output handling preserves the same boundary as generation: no key in command-line arguments or shell history, and no recovered phrase in ordinary output, logs or temporary files. Plaintext should remain in-process or be displayed only on a private controlling TTY. Do not assume the generator’s output restrictions automatically apply to another tool.

Reject authentication failure without importing or displaying partial plaintext. A wrong key, changed nonce, altered AAD or damaged ciphertext is a failed recovery, not permission to bypass verification.

Match the original coin, address type, account and derivation settings. Compare recovered public identities with the creation record: BTC `zpub`, ETH and TRX `xpub`, and the TON address and path. The TON export is a single address, not an extended public key. Repeat the public derivation checks before accepting the recovery. Practise the procedure with a separate testnet wallet rather than entering an operational phrase into an online checker.

#### Deletion

First establish whether the aim is **local decommissioning** or **irreversible wallet destruction**. Keeping a usable recovery backup means the wallet remains recoverable. Before destroying the last recovery route, confirm that assets have been moved as required or that loss of access is intentional.

Stop processes and automated jobs that could retain or recreate wallet material, then cover all three categories:

- **Keys and seed material:** plaintext phrases, imported or derived private keys, data-key copies, wallet objects, key-manager entries, encrypted seed files and abandoned `.tmp` files. Physically destroy retired offline phrase and key records using a method appropriate to their medium.
- **Caches and incidental copies:** application and browser storage where used, clipboard contents, terminal scrollback, session recordings, exports, debug artefacts, crash dumps and relevant swap or hibernation data. Remove cached extended public keys and address metadata where privacy requires it.
- **Backups and replicas:** archive copies, snapshots, cloud version history, removable media and retired devices. Ensure restore automation cannot silently reintroduce deleted material.

Unlinking a file is not proof of physical erasure, especially on SSDs, journalled filesystems and snapshot-backed storage. Use the storage platform’s sanitisation or cryptographic-erasure procedure. Destroying every data-key copy can make residual encrypted envelopes unusable, but it does nothing to disable a surviving plaintext phrase or private key.

Record any retained recovery route as an explicit exception, not completed destruction. Local deletion neither removes blockchain history nor revokes credentials already copied by someone else; suspected disclosure requires migration to a newly generated wallet.

**You should see:**

- [ ] Repeat generation leaves an existing seed file untouched.
- [ ] TTY-only disclosure and both confirmations before publication.
- [ ] Owner-only encrypted storage, with the data key held separately.
- [ ] A tested recovery procedure that reproduces recorded public identities.
- [ ] Deletion covering keys, caches and backups, with retention exceptions recorded.

### Watch-only layer

Keep address generation separate from signing. Bawa’s watch-only process receives account extended public keys, usually called xpubs. It must not hold a mnemonic, raw private key or extended private key. Export each account xpub inside the signing boundary, then register it against a stable account identifier, chain, network and trusted derivation origin.

#### Derive below the account boundary

`derive.js` supports three chain selectors. Its configured account origins and receiving suffixes are:

| Selector | Expected account origin | Public receiving suffix |
|---|---|---|
| `btc` | `m/84'/0'/0'` | `0/<index>` |
| `eth` | `m/44'/60'/0'` | `0/<index>` |
| `trx` | `m/44'/195'/0'` | `0/<index>` |

The hardened account prefix must already have been derived by the signer. Although the helper passes a full path to Wallet Core, public derivation below the account uses the non-hardened receiving suffix. An xpub cannot traverse the hardened ancestry described by that prefix; this boundary follows [BIP 32](https://bips.dev/32/).

Each selector needs the corresponding account export. Changing the selector does not transform a Bitcoin account xpub into an Ethereum or TRON account xpub. The wrapper does not check account depth or prove the export’s origin. Establish those properties during enrolment; a correctly formatted address is not proof that the intended account was used.

The Bitcoin configuration follows the native-SegWit hierarchy in [BIP 84](https://bips.dev/84/) and is mainnet-oriented. There is no network argument. Keep demonstrations conceptual or offline; testnet integration requires explicit network configuration, matching exports and separate allocation state. A different extended-key prefix alone is not a network switch.

The helper reads the xpub from standard input, while the chain and index are command-line arguments. It limits input to 200 characters before trimming and requires a non-empty value and an integer index from `0` to `2147483647`, the non-hardened range.

After WebAssembly initialisation, [Trust Wallet Core](https://github.com/trustwallet/wallet-core) derives the child public key through `HDWallet.getPublicKeyFromExtended`. `CoinTypeExt.deriveAddressFromPublicKey` constructs the address, and `CoinTypeExt.validate` checks it before output. The temporary public-key object is released after address conversion, including when conversion fails. Success writes one address to standard output; diagnostics go to standard error.

#### Reject private material and contain diagnostics

Before initialising Wallet Core, the private-key guard decodes Base58, verifies the Base58Check checksum and compares the version bytes against known extended-private-key versions. This covers recognised mainnet, testnet and alternative serialisations rather than relying only on a visible prefix.

That guard is deliberately narrower than complete input validation. Passing it means that a recognised, checksummed private encoding was not detected; it does not establish that the input is a valid account xpub. Wallet Core still has to parse the extended key. Enrolment should accept only supported public serialisations, and there must be no fallback that imports private material to manufacture an xpub inside this process.

Input-read and preflight rejections use exit status `2`; Wallet Core, address-conversion and validation failures use status `1`.

The error redactor masks recognised extended-key strings and uninterrupted Base58 sequences of at least 100 characters. Apply the same boundary to surrounding application diagnostics: never capture stdin, unredacted exception messages or key-bearing request bodies in logs, traces or analytics. Use an opaque account identifier, chain and index when recording operational events.

Redaction is not a general secret detector. It does not reliably remove mnemonic phrases, raw private-key encodings or every fragment of a damaged key. Nor does it remove ordinary addresses. Standard input keeps the xpub out of the child process’s argument list, but pasting a literal value into a shell command can still leave it in shell history.

#### Allocate durably and discover beyond gaps

`derive.js` is stateless. It does not choose the next address, remember deposit requests or search chain history. Those responsibilities belong to the calling service.

Maintain a durable allocation registry scoped by network, chain, account and branch. Reserve indices atomically and monotonically, with a uniqueness constraint on that scope plus the index. Associate each reservation with an idempotent deposit-request identifier, then persist the validated address before returning it. Parallel workers must not allocate the same index to different requests, and retries must retrieve the original reservation rather than consume another index.

Do not recycle an issued address because it remains unpaid: a deposit may arrive later. Back up request mappings and allocation high-water marks. The xpub can reconstruct addresses, but cannot reconstruct which customer or request received each one. Never wrap an exhausted index counter.

Discovery needs a separate, explicit policy. [BIP 44](https://bips.dev/44/) specifies an external-address gap of 20 consecutive unused addresses as a recovery convention. This is neither implemented by the helper nor enforced by a chain. Do not assume that Ethereum or TRON tooling follows it.

For an xpub-only recovery, scan receiving indices in order and reset the unused-address counter whenever history is found. “Used” means historical activity, not a positive current balance. A fully spent Bitcoin address still counts; Ethereum and TRON discovery must include relevant token activity, even where the native balance is zero. Treat failed or incomplete history queries as unknown, not unused.

Known allocations take precedence over an early gap. Scan through the highest reserved or issued index, even across long unused runs, and maintain a configured lookahead beyond the furthest known allocation or observed activity. Continue monitoring older issued addresses for late deposits. Without allocation records, a finite gap can miss funds beyond a long run of abandoned deposit requests; either constrain issuance to the recovery policy or preserve enough allocation state to extend the scan reliably.

#### Treat an xpub as confidential

An xpub contains a public key and chain code, not signing authority. Nevertheless, it enables reconstruction of that account’s non-hardened receiving and change addresses, including addresses this helper has not issued. Disclosure can link payments, balances and future activity to one account.

BIP 32 also describes a more serious combination: an account xpub together with a corresponding descendant private key can expose the account private key when the known intervening path is entirely non-hardened. Keep derived private keys outside the watch-only boundary as well.

Restrict xpub access, encrypt storage and transport, and protect the account-to-xpub mapping against unauthorised replacement. Exclude xpubs from public APIs, URLs and routine telemetry. Moving future deposits to a new account does not undo the visibility created by an earlier leak.

**You should see:**

- [ ] Offline or explicitly testnet-configured fixtures reproduce the expected addresses.
- [ ] Invalid selectors, out-of-range indices and recognised private extended keys are refused.
- [ ] Extended-key diagnostics are redacted, with no captured stdin or key-bearing arguments.
- [ ] Concurrent requests and retries preserve unique, durable address assignments.
- [ ] Recovery crosses known allocation gaps and recognises spent or token-only address history.

### Signing layer and network/indexer layer

Keep address derivation, transaction preparation, signing and chain access as separate responsibilities. A watch-only session should be able to discover addresses and inspect activity without access to signing authority.

`tools/hdwallet-gen/derive_daemon.js` belongs on that watch-only side. It uses Trust Wallet Core to derive and validate addresses; it does not establish ownership, find funds or authorise spending. Handle its startup readiness record separately from derivation replies, and allow only one outstanding request per worker because replies have no request identifier. Keep the request context alongside each returned address.

Do not add signing material to its JSONL channel. Its recognised request fields are `chain`, `xpub` and `index`; additional properties do not select another network or derivation branch. A testnet integration needs explicit, tested network-aware derivation, not an extra property that the worker ignores.

#### The signing boundary

Give the signer an immutable unsigned transaction, an explicit chain/network context and the minimum evidence needed to validate the proposed spend. For Bitcoin, that includes previous-output information sufficient to check input values and scripts. Identify signing keys through a locally authorised key reference, not by passing private keys through application messages.

The signer should not discover accounts, fetch balances, select coins, choose fees, assemble the final transaction or broadcast it.

```text
Transaction preparer: <UNSIGNED_TRANSACTION>
    ↓
Signer: decode, review, obtain approval, sign
    ↓
<SIGNATURE>
    ↓
Transaction assembler: attach signature to the approved payload
    ↓
Network adapter: broadcast
```

The review must come from the payload the signer will actually sign, rather than an application-generated description:

- **Identity and destination:** show the intended chain and network, sending account, complete recipient addresses and asset identity. A friendly address-book or token label is supporting information, not authority.
- **Amounts and costs:** show transferred amounts, fees or maximum fee exposure, and distinguish estimates from limits. For Bitcoin, verify previous-output values before calculating the fee. Recognise change using the signer’s own wallet policy, not a caller-provided “change” label.
- **Signing scope:** check which fields the signature commits to. Bitcoin signature flags can weaken that commitment; ordinary transfer flows should reject unsupported signing modes. Apply chain-specific replay protection where available.
- **Contract effects:** decode supported calls, including spenders and allowances for approvals. Expose the complete encoded payload for inspection. If the signer cannot explain an operation reliably, refuse it rather than asking the maintainer to approve an opaque hash.

Approval belongs to that frozen transaction. Any change to an approved field requires another review. Cancellation, invalid evidence or an unsupported operation must leave no usable signature.

On success, return **signature material only**—including the required input signatures where a transaction needs several. Do not return key material or a completed transaction. The application verifies the signatures against the approved payload, attaches them without changing approved fields, then hands the result to the network adapter.

Keep keys and approval within the chosen signing trust boundary. [Cryptograph’s security model](https://cryptograph.watch/security) illustrates separating the device that prepares a request from the authority that permits signing. Achieving protection against a compromised phone requires an approval path and key boundary the phone cannot control. An in-process module or OS Keychain storage alone does not provide that guarantee.

#### Network access and its assumptions

Put provider-specific behaviour behind chain-aware adapters. Results should carry their network, observation time, block context where available, synchronisation status and any completeness limitations. Network adapters receive public query material and signed transactions, never signing keys.

| Route | Useful capabilities | Trust and privacy trade-offs |
|---|---|---|
| **Own validating node** | Locally checked chain state and transaction submission. | Requires storage, maintenance and synchronisation. A node is not automatically an address-history service: wallet imports, rescans or a separate index may still be needed. It reduces disclosure to wallet-data providers, but hosting arrangements and peer traffic can still reveal metadata. |
| **Hosted RPC** | Chain-native queries and submission without operating a node. | The operator can observe queried accounts, timing and connection metadata, and can return stale or misleading results. RPC access alone does not promise complete wallet history. |
| **Indexer or explorer API** | Searchable activity, token records and convenient wallet summaries. | Its indexing rules, pagination, lag and omissions affect the answer. Summaries are provider assertions, not consensus evidence. Queries can reveal which addresses belong to the same wallet. |
| **Electrum-style server** | Bitcoin script-based history, unspent-output queries, subscriptions and submission. | The server sees queried script hashes and their association with a client; hashing does not make those queries anonymous. Validating headers and inclusion proofs improves inclusion assurance, but does not establish complete history, current unspent status or full block validity. |

A privately operated Electrum index backed by an own node can combine a convenient wallet API with local validation. Transport encryption protects a connection from interception; it does not make the endpoint’s answers correct.

Derive addresses locally rather than uploading an extended public key to a remote service. An xpub cannot sign, but exposing it can disclose an ongoing address catalogue. Individual queries still create links between addresses. Treat fallback providers and multi-provider comparisons as additional disclosures, not invisible implementation details. Agreement between providers can reveal fewer inconsistencies, but is not a substitute for validation.

[WALL-ET](https://github.heygears.com/ThalesMMS/WALL-ET) provides an iOS reference for separating screens and navigation from wallet services through MVVM-C and Clean Architecture, with Electrum-backed chain access, address discovery and Keychain-protected storage. Keep those responsibilities distinct rather than letting a screen controller become the network client and signing authority.

#### Deriving balances and history

An address is a lookup target, not a balance. Build wallet state from discovered addresses and chain observations:

1. **Discover addresses within an explicit scope.** Persist the chain, network, key origin, branch and index associated with each address. For Bitcoin, inspect both receiving and change branches. The current daemon uses a fixed external-branch path for BTC and has no branch selector; increasing `index` cannot discover change. Complete wallet discovery therefore needs separately supported change derivation.
2. **Apply a documented gap policy.** Consecutive addresses with no transaction history can terminate a bounded scan. A previously used address remains used even after its balance reaches zero. Retain known issued indices, extend discovery when activity appears, and provide a wider recovery scan for wallets that may have exceeded the assumed gap. A completed bounded scan is not proof that nothing exists beyond it.
3. **For Bitcoin, account from outputs.** Track received outputs and their spends, then derive balances from the remaining UTXOs. Separate confirmed funds, pending effects and spendable funds. Local input reservations, maturity rules and pending spends matter; a server’s headline balance is insufficient for coin selection.
4. **For account chains, read state and activity separately.** Obtain native and token balances through chain-appropriate state queries. History may require indexed transactions, receipts, logs or traces. Adding transfer rows is not a reliable replacement for account state, especially where fees or contract execution affect value.
5. **Preserve consistency and uncertainty.** Anchor paginated results to a stable block context where supported, remove duplicates and retain scan checkpoints. Label partial, stale or unanchored results. A timeout means “not refreshed”, not “zero balance”.

Treat externally supplied token names, decimals and classifications as untrusted metadata. Asset identity must remain tied to the intended network and contract or native-asset definition.

#### Confirmation handling

Track transaction progress as observations, not as a single success flag. Derive the expected transaction identifier locally using the chain’s rules. A broadcast acknowledgement means that an endpoint accepted the submission; it does not establish propagation, inclusion or finality.

Keep submission state, pending observations, inclusion and execution outcome distinct. Record the containing block’s identity and position, then derive confirmation status against the current canonical chain. Bitcoin confirmation counts express increasing confidence, not absolute finality. Where a chain exposes finality information, use it according to that chain’s rules rather than importing a Bitcoin-style threshold.

Define confirmation policy per chain and network. Do not increase confirmations merely because time has passed, and show when the observing backend is behind or unavailable. An included contract transaction can still have failed execution and incurred fees.

Reorganisations must be reversible application events: invalidate affected inclusions, restore the relevant discovery checkpoint, replay activity and recalculate balances. Previously displayed confirmations may fall. Handle replacement, expiry and dropped transactions explicitly; absence from one server is not sufficient evidence that a transaction has disappeared everywhere.

**You should see:**

- [ ] Watch-only operation works without starting or accessing a signer.
- [ ] Approval matches the frozen payload; success returns only signatures.
- [ ] Backend choice exposes its network, freshness and trust assumptions.
- [ ] Discovery covers receiving and change addresses, with incomplete scans clearly labelled.
- [ ] A conceptual or testnet transaction progresses through distinct states, and a simulated reorganisation rolls them back.

### UI flows — create, import, backup confirmation

Keep wallet actions behind a persisted **backup pending** gate until backup confirmation succeeds. Navigating away or restarting must not bypass it. Never include recovery words in logs, analytics or error reports.

#### Create

```text
Entry: Add wallet / Create
↓
Generate securely; validate the resulting phrase
↓
Show the recovery phrase once
↓
User checks their saved, ordered copy
↓
Continue to backup confirmation; remain locked

Generation/check failure → discard partial state; offer retry
Leave or skip → show warning; remain locked
```

Use a reviewed cryptographic library and the operating system’s secure random source. Display the phrase once per creation attempt; retries must not reveal it again.

Before continuing, the user verifies that their private, offline copy contains every word in the displayed order and is readable. Acknowledging this does **not** confirm the backup or enable wallet actions. If the copy is lost, offer explicit discard-and-restart only for a newly generated, unused wallet.

#### Import

```text
Entry: Add wallet / Import
↓
Enter an existing recovery phrase
↓
Normalise input; check count, wordlist and checksum
↓
Checks pass: review a read-only public-address preview
↓
Confirm import; open backup confirmation; remain locked

Any check fails → keep input editable; disable confirmation
Unexpected address → stop; review recovery settings
```

Apply Unicode normalisation and handle accidental spacing without changing words or their order. Validate the supported wordlist and word count, then the checksum. [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) defines standard lengths of 12, 15, 18, 21 and 24 words; reject lengths the application does not support.

For an unsupported count, unrecognised word or checksum mismatch, identify the failed check without echoing the phrase. Do not commit an imported wallet. Let the user correct the input and run all checks again; never guess replacement words.

Before confirming, the user verifies that the phrase belongs to the intended wallet, its word order is correct, and the selected network and previewed address match their expectations where known. A valid checksum alone does not establish wallet identity.

#### Backup confirmation

```text
Entry: Backup confirmation
↓
Re-enter every word from the saved copy, in order
↓
Compare the complete ordered sequence
↓
Match: enable Confirm backup
↓
Confirm: persist verified state; enable wallet actions

Mismatch → generic error; remain locked; allow edit and retry
Skip → warning; locked screen with Resume backup
```

Compare every word against the generated or imported phrase, not merely against a valid checksum. A different, checksum-valid phrase must fail. After a mismatch, confirmation stays disabled until a complete retry matches.

Before confirming, the user verifies that they recovered the sequence from their saved copy rather than relying on memory.

**Skip warning:** “Without a usable recovery copy, losing this device could mean losing access permanently. Wallet actions stay locked until you confirm the backup.”

The locked screen must retain a clear route back to confirmation. Dismissing the warning must not change backup status.

You should see:
- [ ] One phrase reveal per creation attempt.
- [ ] Invalid imports remain editable and cannot be confirmed.
- [ ] Backup mismatches and skips remain locked, including after restart.
- [ ] Only an exact ordered match followed by confirmation enables wallet actions.

### UI flows — receive, send, history, empty and locked states

#### Receive

```text
Receive → Check app access, wallet policy and selected test network
Allocate → Commit the address reservation before display
Display together → <TESTNET_ADDRESS>, matching QR and <TESTNET_NETWORK> label
Allocation/QR error → Retain mappings; block sharing; offer retry
Before sharing → Verify wallet/order, network and decoded QR/address match
```

Retain an address’s mapping permanently once displayed or assigned to an order; reuse requires an explicit safe-reuse policy. Allocate each new address by advancing a locked per-branch cursor and recording its mapping in one database transaction, protected by `UNIQUE(wallet_root, chain, branch, index)`. Never derive the next allocation from `MAX(index) + 1`.

An xpub normally cannot authorise spending, yet may disclose account layout, reused addresses, payment activity and balances; see [BIP 32: Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Keep these watch-only secrets away from publicly visible trackers, analytics services you cannot trust, arbitrary checking sites and extensions without review. Do not include them in chats unless strictly necessary.

#### Send

```text
Send → Check access; enter <TESTNET_ADDRESS>; validate format/network compatibility
Amount → Enter <AMOUNT>; check spendable funds; display estimated <FEE>
Review → Show full recipient, network, amount, fee and total debit
Confirm → Revalidate funds/fee; route a locked signer to Unlock
Confirmed and unlocked → Sign the reviewed transaction; broadcast
Address/funds/fee error → Preserve edits; explain correction; block signing
Broadcast timeout → Show status unknown; reconcile before retry
```

The user must verify every review field before confirming. Any changed value requires another review and confirmation. An address’s appearance alone does not establish the intended network.

#### History

```text
History → Check wallet, network and synchronisation
Accepted, awaiting inclusion → Pending label; zero confirmations
Included in a block → Confirmed label; confirmation count
Sync error → Mark information stale; offer refresh
Reorganisation → Recalculate status, including possible return to Pending
Details → Verify transaction identity, recipient, amount and network
```

Viewing history needs no signing confirmation. Use text labels rather than colour alone. Retain rejected or conflicted entries with an explanation; never resend merely because an entry remains pending.

#### Empty states

```text
Open wallet → Check wallet/network and completed synchronisation
No transactions → Show “No activity”; offer Receive
No funds → Show zero available balance; offer Receive; disable Send
Sync failure → Show retry, not an empty wallet
```

Explain pending or reserved funds separately from spendable funds. Let users correct wallet/network selection before funding. Verify the receiving wallet and network before continuing; neither empty state requires signing.

#### Locked states

```text
App locked → Hide wallet information; request local authentication
Wallet locked, app open → Allow authorised watch-only views; block signing
Before unlocking → Verify intended wallet and expected local request
Failed/cancelled authentication → Remain locked; offer retry or recovery
Unlocked → Recheck transaction; return to review before signing
```

Offer configured app-authentication recovery for an app lock, and documented local backup restoration for a wallet lock. Recovery requires a usable credential, backup or supported recovery method; do not promise that resetting restores access. Warn before any reset that erases data.

**You should see:**
- Matching address, QR and network label.
- Explicit review before every signature.
- Distinct pending, confirmed and stale labels.
- Clear empty-state actions and lock recovery.
