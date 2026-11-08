---
title: Wallet App Architecture
description: Separate key management, watch-only derivation, signing and the user interface into layers with explicit boundaries; keep private material out of the watch-only runtime and review every spend on the signer.
last-updated: 2026-11-08
---

# Wallet App Architecture

How-to guide.

## Contents

- [Wallet app architecture: overview and layers](#wallet-app-architecture-overview-and-layers)
- [Key management layer](#key-management-layer)
- [Public does not mean unrestricted](#public-does-not-mean-unrestricted)
- [Key lifecycle: generation, storage, backup, recovery, deletion](#key-lifecycle-generation-storage-backup-recovery-deletion)
- [Signing layer and network/indexer layer](#signing-layer-and-networkindexer-layer)
- [UI flows](#ui-flows)

## Wallet app architecture: overview and layers

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

| Layer or component | Responsibility | Boundary, what it must never do |
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

Internally, it separates the public API, core wallet types (`HDWallet`, `Mnemonic`, `StoredKey`, `Account`), multi-chain interfaces (`AnyAddress`, `AnySigner`, `CoinType`), cryptographic algorithms and individual chain modules. These implementation layers are described in [Trust Wallet Core repository](https://github.com/trustwallet/wallet-core) and [Core Wallet Architecture repository](https://github.com/vultisig/walletcore-spm). They provide key, address and transaction machinery; they do not replace chain observation or application reconciliation.

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

Expected result:

- [ ] Key generation and signing confined to the trusted environment.
- [ ] Public-only inputs throughout the watch-only runtime.
- [ ] Wallet Core kept separate from node access and history indexing.
- [ ] Chain observations distinguished from order-settlement decisions.

## Key management layer

Keep recovery material and signing authority inside the key-management component. Use account-scoped public material for address discovery, balance tracking and deposit-address allocation wherever the policy supports public derivation.

### From entropy to account keys

Keep entropy, mnemonics, passphrases, seeds and private keys distinct. Do not give them an ambiguous shared label such as “wallet key”.

Generate BIP-39 entropy with a cryptographically secure random generator, using 128 to 256 bits in 32-bit increments. Do not use timestamps, user-chosen words or ordinary application randomness. Treat entropy as recovery-sensitive material, not as a signing key.

Encode the entropy and its checksum using BIP-39’s prescribed word list. Use a permitted mnemonic length of 12, 15, 18, 21 or 24 words. For a 24-word mnemonic, encode 256 random bits plus 8 checksum bits. Do not treat word count as presentation: changing the word count changes the seed. Use the checksum to detect some transcription errors, not to conceal the entropy. Do not mistake the mnemonic for a single account’s private key or for the seed itself.

Use the BIP-39 passphrase as an additional seed-derivation input, with an empty string when none is configured. Keep it separate from a device PIN and the passphrase used to unlock locally stored wallet data. Treat a change to this input as a change of wallet, even when the mnemonic stays the same. Do not expect a “wrong password” result from a mistyped BIP-39 passphrase; it produces different keys instead.

NFKD-normalise both the BIP-39 mnemonic and passphrase. Encode the normalised mnemonic as UTF-8 for the password input, and encode the literal string "mnemonic" concatenated with the normalised passphrase as UTF-8 for the salt. Apply PBKDF2-HMAC-SHA512 with 2,048 iterations to produce the 64-byte seed. Treat this process as byte derivation, not mnemonic encryption. Protect the seed as sufficient material to regenerate the HD tree without the words or passphrase.

For BIP-32 derivation, use its HMAC-SHA512 master-node procedure to obtain a master private scalar and a 32-byte chain code from the seed. Treat those values, together with the serialisation metadata, as the master extended private key. Use the chain code for child derivation, not as another signing key. Do not treat a private scalar without its chain code as a complete extended private node.

Distinguish account extended private keys from leaf private keys. Use an account extended private key to derive that account’s private descendants, and a leaf private key to sign for its own keypair. Treat possession of a leaf private key as normally sufficient to spend the associated funds where that key alone satisfies the spending policy.

Keep storage-encryption keys separate from recovery and signing material. Never record entropy, mnemonics, passphrases, seeds or private keys in documentation, logs, issue reports, repositories or chat. Use placeholders such as `<mnemonic>` and `<account-extended-private-key>`.

### Paths and the hardened boundary

Read BIP-44 path components in order as the private root, purpose, coin type, account, change branch and address index. Interpret `m` as the private root, `44'` as the BIP-44 purpose and each apostrophe as a hardened step. Use the coin type to separate coin-specific branches and the account index to separate groups of keys. Do not equate an account with a single on-chain address.

Recognise branch 0 as external receiving and branch 1 as internal change. For account-based networks without UTXO change, document the supported branch policy rather than inventing change behaviour.

Keep hardened purpose, coin-type and account derivation inside key management. Never attempt to cross a hardened step with public-only derivation. Use an exported account public key to derive only non-hardened children below it. Restrict non-hardened child indices to 0 through 2³¹ minus 1.

Apply the fixed `bawa-derivation-policy-v1` policy. This policy covers Bawa-generated wallets; external hardware-signer exports follow the signer's own origin.

Use account 0 and receiving branch 0 only for BTC, ETH and TRX, with `i` denoting the address index:

- For BTC, use `m/84'/0'/0'/0/i`.
- For ETH, use `m/44'/60'/0'/0/i`.
- For TRX, use `m/44'/195'/0'/0/i`.

Keep TON generation-only from `m/44'/607'/0'` using ed25519. Provide a single deposit address and no xpub. Treat compatibility with any specific wallet as unverified.

### Vault protection and unlock policy

Keep local vault protection separate from BIP-39 seed construction. Treat the Web validation draft’s PBKDF2-600k vault as a draft implementation choice, not a repo requirement. Do not substitute its work factor for BIP-39’s fixed 2,048 iterations.

Use the OWASP Password Storage Cheat Sheet’s FIPS-140 option as the basis for the 600,000-iteration PBKDF2-HMAC-SHA-256 figure. Match the rationale to its wording: “use PBKDF2 with a work factor of 600,000 or more and set with an internal hash function of HMAC-SHA-256” (verified live 2026-11-08). Treat 600,000 iterations as a defensible floor for that FIPS-140 branch, not as OWASP’s top recommendation. Recognise Argon2id as OWASP’s primary recommendation.

Choose and record a minimum length for the vault unlock passphrase, because the repo specifies none. Enforce weak-passphrase rejection and record the unlock-time measurement. Keep the recorded policy distinct from the secret passphrase itself.

### Adapter network identity and endpoint trust

Verify the configured endpoint’s network identity separately for each adapter. Consult `docs/10` for the endpoint URLs and their verification commands.

- For the BTC adapter, require testnet4.
- For the ETH adapter, require Sepolia with chain ID `11155111`.
- For the TRON adapter, require Nile.
- For the TON adapter, require testnet.

> **Expected result:** The verified network identity matches the adapter’s intended testnet.

Fail closed on any mismatch.

Treat these checks as authenticating the network identity, not the provider. Do not interpret an ETH chain-ID check as authentication of RPC responses generally. Continue to rely on provider honesty for the data itself.

#### Public does not mean unrestricted

An **extended public key**, commonly called an xpub, serialises a public key together with its chain code and node metadata. Prefix variants do not change its fundamental role. By itself, it cannot sign, derive hardened children or reconstruct private ancestors.

It can, however, link addresses throughout its non-hardened subtree and reveal activity when combined with network data. Treat account public exports as sensitive wallet metadata, with controlled distribution and logging.

There is also a key-compromise hazard: an account xpub combined with a leaked descendant private key on an entirely non-hardened path can expose the account private node. Hardened ancestors limit upward propagation; they do not protect the exported account’s non-hardened subtree from this combination.

Keep the full account path, network and address-format policy alongside each public export. The xpub’s embedded metadata is not a complete wallet description.

Expected result:

- [ ] Recovery tests covering normalisation and empty/non-empty passphrases.
- [ ] Matching public derivations on the signer and watch-only sides.
- [ ] Hardened derivation rejected by public-only interfaces.
- [ ] Account-scoped public exports with explicit network and path policy.
- [ ] No recovery or signing secrets in diagnostics or examples.

### Key lifecycle: generation, storage, backup, recovery, deletion

Generation establishes a new wallet identity. It is a one-time provisioning operation, not an application startup task or a recovery mechanism. Keep the mnemonic and signing capability outside components that only need public address-derivation data.

#### Generation

Run `tools/hdwallet-gen/generate.js` on a trusted machine with verified dependencies and a private, unrecorded controlling terminal. Prepare dependencies before disconnecting from the network. Do not use CI, a recorded support session, or a terminal with persistent capture enabled. Rehearsals must use disposable testnet material, never an operational wallet or a published example phrase.

An existing `seed.enc.json` must cause refusal, not replacement. Check this before generating another wallet and enforce it when publishing the file: an ordinary rename can overwrite its destination, so it is not itself a no-clobber safeguard. Never delete an established seed file simply to make another generation attempt succeed.

The 24-word mnemonic and independently generated data key are disclosed once through `/dev/tty`. Neither belongs on stdout, stderr, in application logs, or in clipboard and screenshot workflows. If a controlling terminal is unavailable, stop rather than falling back to ordinary output streams. TTY-only handling prevents ordinary output redirection from collecting secrets; it does not protect against terminal recording or a compromised host.

Before writing the encrypted seed file, the operator must:

1. Record the complete phrase offline, then enter its first word when challenged.
2. Store the displayed hexadecimal data key separately from the encrypted seed, then enter the case-sensitive acknowledgement `SAVED`.

A mismatch or interrupted input must abort without publishing the seed file, and diagnostics must remain redacted. These checks acknowledge the operator’s actions; they do not establish that either backup is complete or readable.

#### Storage

The encrypted payload is the mnemonic itself. Bawa encrypts it in-process using AES-256-GCM, a fresh 32-byte random data key and a 12-byte nonce. The key is not derived from a password: there is no password KDF or password-reset route.

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

**Expected result:**

- [ ] Repeat generation leaves an existing seed file untouched.
- [ ] TTY-only disclosure and both confirmations before publication.
- [ ] Owner-only encrypted storage, with the data key held separately.
- [ ] A tested recovery procedure that reproduces recorded public identities.
- [ ] Deletion covering keys, caches and backups, with retention exceptions recorded.

## Signing layer and network/indexer layer

Keep address derivation, transaction preparation, signing and chain access as separate responsibilities. Keep screens and navigation separate from wallet services; never let a screen controller become the network client and signing authority.

### Watch-only boundary

Restrict the watch-only runtime to public material only (xpubs, zpubs and addresses). Use it to derive and watch addresses; it cannot spend. Use watch-only derivation in Bawa’s `tools/hdwallet-gen` only for its supported chains, `btc`, `eth` and `trx`. Treat TON as generation-only.

Treat xpubs and zpubs as **sensitive public material**: an xpub cannot sign, but exposing it discloses an ongoing address catalogue, balances, payment history and relationships. Never upload an extended public key to a remote service. Treat fallback providers and multi-provider comparisons as additional disclosures.

Reject private material at every public-only boundary, including the derivation worker’s JSONL channel. Contain diagnostics so that no secret reaches logs.

Keep `tools/hdwallet-gen/derive_daemon.js` on the watch-only side: it uses Trust Wallet Core to derive and validate addresses, but does not establish ownership, find funds or authorise spending. Handle its startup readiness record separately from derivation replies. Allow only one outstanding request per worker because replies have no request identifier, and keep the request context alongside each returned address.

Use the worker’s recognised request fields, `chain`, `xpub` and `index`. Do not rely on additional properties to select another network or derivation branch. Require explicit, tested network-aware derivation for a testnet integration, rather than adding a property that the worker ignores.

### Signing boundary

Keep the implementation boundary explicit: Bawa contains no transaction construction or signing implementation; signing exists only in the built apps, via Trust Wallet Core 4.9.2. Allow only the separate signer to create spending signatures. Require review of the destination, amount, change and fee on the signer’s own screen before it signs.

Give the signer an immutable unsigned transaction, an explicit chain/network context and the minimum evidence needed to validate the proposed spend. For Bitcoin, include previous-output information sufficient to check input values and scripts. Identify signing keys through a locally authorised key reference, not by passing private keys through application messages.

Keep account discovery, balance fetching, coin selection, fee selection, final transaction assembly and broadcasting outside the signer.

Build the review from the payload the signer will actually sign, rather than an application-generated description:

- **Identity and destination:** show the intended chain and network, sending account, complete recipient addresses and asset identity. Treat friendly address-book or token labels as supporting information, not authority.
- **Amounts and costs:** show transferred amounts, fees or maximum fee exposure, and distinguish estimates from limits. For Bitcoin, verify previous-output values before calculating the fee. Recognise change using the signer’s own wallet policy, not a caller-provided change label.
- **Signing scope:** check which fields the signature commits to. Account for Bitcoin signature flags that can weaken that commitment, and reject unsupported signing modes in ordinary transfer flows. Apply chain-specific replay protection where available.
- **Contract effects:** decode supported calls, including spenders and allowances for approvals. Expose the complete encoded payload for inspection. Refuse an operation the signer cannot explain reliably, rather than asking for approval of an opaque hash.

Bind approval to the frozen transaction. Require another review after any change to an approved field. Leave no usable signature after cancellation, invalid evidence or an unsupported operation.

Return **signature material only**, including the required input signatures where a transaction needs several. Do not return key material or a completed transaction. Verify the signatures in the application against the approved payload, attach them without changing approved fields, then pass the assembled transaction to the network adapter for broadcast.

Keep keys and approval within the chosen signing trust boundary. Use [Cryptograph’s security model](https://cryptograph.watch/security) to illustrate separating the device that prepares a request from the authority that permits signing. To protect against a compromised phone, require an approval path and key boundary that the phone cannot control. Do not treat an in-process module or OS Keychain storage alone as that guarantee.

### Network/indexer boundary

Derive addresses locally. Treat an address as a lookup target, not a balance. Build wallet state from discovered addresses and chain observations, rather than from derivation results alone.

Inspect both receiving and change branches for Bitcoin, and apply a documented gap policy. Do not treat a completed bounded scan as proof that nothing exists beyond it.

Track confirmations and chain reorganisations (reorgs). Account for the possibility that a transaction which looked confirmed can drop out.

## UI flows

### Canonical screen contract

Adopt the Android guide's 14 numbered screens, H.1 to H.14, as the wallet app's single canonical screen list:

1. **Welcome** (H.1)
2. **Create wallet** (H.2)
3. **Import wallet** (H.3)
4. **Mnemonic backup** (H.4)
5. **Portfolio dashboard** (H.5)
6. **Asset list** (H.6)
7. **Asset detail** (H.7)
8. **Receive** (H.8)
9. **Send** (H.9)
10. **Transaction history** (H.10)
11. **Transaction details** (H.11)
12. **Network selection** (H.12)
13. **Wallet management** (H.13)
14. **Security and backup settings** (H.14)

Reconcile the Web guide's 14-screen inventory and docs/14's seven screen groups against this list, rather than maintaining competing screen lists. Treat **Review** as a required state of the **Send** flow, not a separate screen. Treat **Lock** as a required state, not a separate screen. Interpret the Web guide's **Review** and **Lock screen** entries as descriptions of those states, and align the Web guide's wording with this list during the merger.

Use docs/14 section 5.1 as the shared reference for the full screen list with permitted data. Point both platform guides at that single list, and do not restate it in either platform guide.

### Backup gate and mnemonic handling

Keep wallet actions behind a persisted **backup pending** gate until backup confirmation succeeds. Do not let navigation, skipping or restarting bypass the gate.

Do not offer copying, sharing or QR export of recovery words. Exclude analytics from the create, import and backup-confirmation flows. Never include recovery words in logs or error reports.

### Create wallet

Generate and validate the mnemonic through Wallet Core. Use a reviewed cryptographic library and the operating system's cryptographic random source for generation. On a generation or validation failure, discard partial state and offer a retry.

Continue to Mnemonic backup for the single offline phrase reveal and confirmation. Do not reveal the phrase again when retrying within the same creation attempt.

Ask the user to check that their private, offline copy contains every word in the displayed order and is readable. Do not treat that acknowledgement as backup confirmation or enable wallet actions. If the copy is lost, offer explicit discard-and-restart only for a newly generated, unused wallet. On leaving or skipping before confirmation, warn the user and retain the backup-pending gate.

### Import wallet

Keep mnemonic entry masked throughout entry and correction. Never retain import text in persisted forms or navigation state.

Apply Unicode normalisation and handle accidental spacing without changing words or their order. Validate the supported word count and wordlist, then the checksum, through Wallet Core. Reject unsupported word counts, including any counts the application does not support among the BIP-39 standard lengths of 12, 15, 18, 21 and 24 words.

For an unsupported count, unrecognised word or checksum mismatch, identify the failed check without echoing the phrase. Keep the input editable, disable confirmation and do not commit an imported wallet. Let the user correct the input and run all checks again. Never guess replacement words.

After all checks pass, present a read-only public-address preview. Ask the user to check that the phrase belongs to the intended wallet, that its word order is correct, and that the selected network and previewed address match their expectations where known. Do not treat a valid checksum as proof of wallet identity. On an unexpected address, stop and review the recovery settings.

After explicit confirmation, import the wallet through Wallet Core and open Mnemonic backup without lifting the backup-pending gate.

### Mnemonic backup and confirmation

Show the mnemonic once, offline. For creation, use the single reveal described in the Create wallet flow, not an additional display. Do not redisplay the mnemonic on a confirmation retry.

Verify selected words from the saved copy using protected entry. Ask the user to consult that copy rather than rely on memory. Compare each entered word with the corresponding position in the generated or imported mnemonic. Do not substitute successful checksum validation for backup confirmation.

On a mismatch, show a generic error, keep **Confirm backup** disabled and retain the backup-pending gate. Allow editing and retry through protected entry. Enable **Confirm backup** only after all selected words match their requested positions.

After the user explicitly confirms, persist the confirmed backup status, clear temporary buffers and lift the backup-pending gate.

On a skip, show the following warning and keep wallet actions blocked:

> Without a usable recovery copy, losing this device could mean losing access permanently. Wallet actions stay locked until you confirm the backup.

Do not let dismissing the warning change backup status. Retain a clear **Resume backup** route, subject to the Lock-state restrictions below.

> **Expected result:**
> - One offline phrase reveal per creation attempt, with no repeat reveal on retry.
> - Masked, editable input for invalid imports, with confirmation disabled and no imported wallet committed.
> - Backup-pending status preserved after mismatches, skips, navigation and restarts.
> - Removal of the backup-pending gate only after selected-word verification and explicit confirmation, followed by temporary-buffer clearing.

### Receive

In Receive, show the full address and chain/testnet as text, and display a QR code for the receive address. Follow docs/14 section 5.3 for the shared clipboard rule. Use the Receive QR payloads table in docs/07. Construct the payload for the selected chain and network using only its approved forms. Do not encode a bare address except for TRX Nile. Keep request information not carried by the payload outside the QR. Use `P.renderAndVerifyQr` for generated receive QRs. Decoded generated or scanned requests must pass through `E.parsePaymentRequest` and `E.verifyPaymentRequest`, using the shared and per-chain checks in docs/07.

Receive-QR and scanning both stay in scope (user decision, 8 November 2026). Receive-QR exists today only in the Android draft Receive screen (ZXing core 3.5.3, display-only, never runtime-verified); it still lacks the guide's decode-verification step, payment-request fields and Stale/Error states, and the Web draft has no QR of any kind. Scanning exists nowhere yet in either draft. The Web guide's scanning specification is in its Section F; the Android verification half remains to be built. Add the web encoder and the Android verification half before treating either half as implemented.

### Send and Review

Collect the recipient, asset and amount in Send. Estimate fees and prepare a reviewable action, not a signature. Present the collected values and estimated fees in the required Review state within Send. Do not treat action preparation or entry into Review as signing.

### History, empty and locked states

Distinguish pending, included, confirmed, failed and replaced transactions in Transaction history and Transaction details. Keep included and confirmed visibly distinct.

Provide explicit empty states when there are no assets or transactions to display.

In the required Lock state, reveal no wallet screens until unlocked. Keep Lock separate from the backup-pending gate, and do not let unlocking confirm a backup or enable actions while backup remains pending. Retain a clear Resume backup route for a pending backup, but do not expose the backup screen through that route before unlocking.

> **Expected result:**
> - The full Receive address and chain/testnet displayed as text, with a QR code for the receive address.
> - A reviewable Send action rather than a signature.
> - Distinct transaction statuses and explicit empty states.
> - No wallet screens exposed while locked, and no bypass of backup confirmation through unlocking.

