---
title: Wallet App Implementation
description: Implement the wallet app module by module, key, derivation, storage, network, signing and UI, with a fixture gate, typed errors and a build-from-scratch checklist; testnet only, with published vectors.
last-updated: 2026-11-08
---

# Wallet app implementation

How-to guide.

## Contents

- [Project structure and key module](#project-structure-and-key-module)
- [Derivation module](#derivation-module)
- [Storage module](#storage-module)
- [Network and signing modules](#network-and-signing-modules)
- [UI module and app-wide error handling](#ui-module-and-app-wide-error-handling)
- [Testing, release security and build checklist](#testing-release-security-and-build-checklist)

## Project structure and key module

Keep `bawa-hd-wallet-core-tools` private, pin `@trustwallet/wallet-core` to `4.8.4`, matching the repository tools at base commit `754721cd` (the Web draft pins `4.9.2` (WEB-GUIDE pins table; D21 work copy); Android's AAR procedure (C.1) checks out tag `4.9.2`, so the drafts do not uniformly pin `4.8.4`), and require Node.js `>=22 <23` for the repository tools and Web app. Upgrading the pin to 4.9.3 (the current latest stable) is a separate, uncompleted step; do not present 4.9.2 or 4.9.3 as the installed pin until the manifests change. At base commit `754721cd`, the tools declare the Node range `>=22 <23`, but the Web draft declares `>=20`.

Treat the paths below as a conceptual layout. Use testnet configuration and endpoints for connected exercises; keep published vectors and mainnet-format export checks offline.

### Project structure

**App shell (`src/app/`).** Initialise Wallet Core, enforce the platform's fixture gate and coordinate creation, import and wallet sessions. Keep secrets out of application-wide state.

**Key (`src/key/`).** Own creation, import and short-lived native wallet objects. Seal secret material before storage. Expose public results or opaque wallet IDs through general application interfaces, never native handles or recovery material. Confine mnemonic visibility to the one-time offline backup screen.

**Derivation (`src/derivation/`).** Own coin, account and path policy. Derive non-hardened children from account public descriptors under [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Keep hardened derivation inside a key operation.

**Storage (`src/storage/`).** Persist authenticated ciphertext and public metadata, with encryption material protected by platform facilities. Never persist plaintext secrets. Treat authentication or decryption failure as an error, not permission to create another wallet.

**Network (`src/network/`).** Fetch testnet chain data and broadcast signed transactions. Accept only necessary public addresses and transaction payloads, never vault contents or key handles. Treat remote responses as untrusted.

**Signing (`src/signing/`).** Build and check transaction intent locally, check chain selection and approval, then request scoped signing from the key boundary. Return signed payloads, not signing keys.

**UI (`src/ui/`).** Render public addresses, balances, confirmations and sanitised failures. Keep recovery material out of the general UI, subject only to the one-time offline mnemonic backup screen. Keep import text out of analytics, crash reports and previews, and apply the masked-entry and retention restrictions below.

### Fixture gate

Keep gate status specific to the platform:

**Web:** Fixture gate enforced in-engine and covered by offline engine tests; no live-network gate run exists.

**Android:** Fixture gate defined (section I.4) and pure-logic half checked (7 checks, part of 55/55); the on-device gate has never run.

The on-device gate has never run: no Core AAR has been built and no device run has happened. The gate's requirements are acceptance criteria, not results.

Do not substitute the pure-module fixture checks for the Android on-device gate.

Before any fresh-wallet creation, require the published fixture self-checks to pass against the loaded Core build. For Web, run the public fixture suite after Wallet Core WASM initialisation at startup and again before the first user-wallet operation. Do not treat a loaded WASM module as proof that the bundled Core matches Bawa's coin mappings, address encodings and derivation rules.

Tie each result to that Core instance and build. Rerun the checks after reinitialisation or an upgrade. Keep wallet actions disabled until the required checks pass and the ownership contract below is satisfied.

Require the numeric coin values and fixture derivations to match these offline expectations:

> **Expected result:**
>
> - TRON numeric coin value: 195.
> - TON numeric coin value: 607.
> - BTC fixture address: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
> - ETH fixture address: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`
> - TON fixture address (non-bounceable, mainnet presentation of the Core return): `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`, contract Wallet V4 R2, wallet ID 698983191, path `m/44'/607'/0'`, workchain 0. Testnet forms: `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo` (bounceable) and `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt` (non-bounceable). Full record and verification: docs/11.

Treat the addresses as offline fixture expectations, not payment destinations or expected fresh-wallet outputs. Stop on any mismatch; never fall back to fresh generation. Refer to the companion fixture section for the implementation.

### Creation and import

Create and import wallets through Wallet Core. For creation, follow `generate.js` and use Wallet Core's HDWallet.create operation with 256 bits of entropy and an empty BIP-39 passphrase. For this [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) entropy size, require a 24-word mnemonic.

Read the mnemonic internally, check the 24-word count and validate it with Wallet Core's Mnemonic.isValid operation. Seal the recovery material before reporting success.

Enforce Bawa's empty BIP-39 passphrase policy. Treat a changed passphrase as selecting a different wallet, not merely changing an encryption password.

Accept both mnemonic and passphrase for import. Validate the mnemonic with Mnemonic.isValid and enforce the passphrase policy before using Wallet Core's HDWallet.createWithMnemonic operation. Reject non-empty passphrase input rather than silently replacing it with an empty value. Make an explicit policy change before supporting a non-empty passphrase. Do not treat mnemonic validation as proof of the passphrase or the intended wallet.

Show a mnemonic only on the one-time offline backup screen. Keep import entry masked throughout, and never retain import text in persisted forms or navigation state.

### Native-object ownership and disposal

Apply this ownership contract to every native object: assign one explicit owner, identify an explicit release point and establish destruction on every exit path through the ownership-contract review.

Require each native owner to be reviewed against the ownership contract in this section, with the review recorded. Require source-level ownership and destruction findings to be source-verified against the Trust Wallet Core 4.9.2 tag. Do not treat source evidence as device evidence.

Until the recorded ownership-contract review establishes explicit ownership and destruction on every exit path, do not claim "native objects deleted on every exit path", and do not allow the fixture gate to report READY.

### Open signing proof

Treat the Trust Wallet Core 4.8.4 demonstration as evidence for that release only. D21 (8 November 2026) completed the EIP-1559 construction/signing demonstration with txMode: 1 against Trust Wallet Core 4.9.2 in a work copy of the Web draft upgraded to @trustwallet/wallet-core@4.9.2. The full suite recorded 31 pass / 0 fail; the dedicated demonstration produced a 0x02 envelope with exactly 12 RLP fields, and independent Python sender recovery matched the published fixture address exactly. The in-browser proof, send, sign and broadcast remain open.

## Derivation module

Keep derivation watch-only. Turn an account extended public key and receiving index into a validated address, without importing secrets or signing transactions. Reject private material at the boundary so that the public-only flow never receives it.

Expose the asynchronous `deriveAddress` interface with chain, account xpub and receiving index inputs. Return a promise of a result containing an address string on success, or a stable `DerivationError` kind and a safe message on failure. Keep key objects and the input xpub out of both results.

### Account, receiving branch and index

Apply `bawa-derivation-policy-v1`. This policy covers Bawa-generated wallets; the watch-both-branches rule in `docs/09` is for external hardware signers only, whose exports use their own origin.

For BTC, ETH and TRX, fix account `0'` and use only receiving branch `0`. Vary only the final non-hardened index `i`. Follow the [BIP44 account/change/index layout](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), with [BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) for BTC.

For BTC (`btc`), use account xpub origin `m/84'/0'/0'` and pass the full path `m/84'/0'/0'/0/i` to `core.HDWallet.getPublicKeyFromExtended`. This API derives from the supplied xpub using only the trailing change/index components (`0/i`); it ignores the purpose, coin type and account components of the supplied path. Passing the full path therefore does not verify the xpub's account origin. Independently establish that the supplied xpub has the required account origin before deriving, and reject mismatched or unverified origins. Otherwise, a path/xpub disagreement can silently return a valid-looking address from the wrong account branch. Do not treat address validation as proof that the key belongs to the intended account.

Bawa retains coin type `0'` on testnet4. This differs from SLIP-0044's testnet coin type `1` and SLIP-0132's association of `vpub` with `m/84'/1'`. The testnet derivation taught in docs/09 is therefore not the Bawa derivation used here. A standard testnet wallet using `m/84'/1'` will derive a different account from the same mnemonic and must not be assumed to reproduce Bawa's account or addresses.
- For ETH (`eth`), use account xpub origin `m/44'/60'/0'` and pass the full path `m/44'/60'/0'/0/i` to Wallet Core.
- For TRX (`trx`), use account xpub origin `m/44'/195'/0'` and pass the full path `m/44'/195'/0'/0/i` to Wallet Core.

For TON, use generation-only derivation from `m/44'/607'/0'`. Keep TON outside this public-only API: use one configured deposit address, with no xpub flow.

Treat the hardened prefix as the account xpub’s recorded export origin. Derive only `/0/i` from that xpub, because [BIP32 public derivation](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) cannot cross hardened steps. Reject hardened children below an account public key.

Keep chain and account-origin metadata alongside the xpub. Do not treat address validation as proof that the key belongs to the intended account.

### Public-only flow

Mirror the Wallet Core API sequence in `derive.js`. Apply input bounds and private-version checks before initialising WASM. Keep WASM initialisation behind the module boundary, then select the Bitcoin, Ethereum or Tron `CoinType` and matching full path for the allow-listed chain.

Obtain the temporary public-key object through `HDWallet.getPublicKeyFromExtended`. Convert it to an address through `CoinTypeExt.deriveAddressFromPublicKey`, then validate the address through `CoinTypeExt.validate`. Return a typed error at every failed step instead of an address.

Call the temporary public-key object’s `delete` method from a `finally` block, including when address conversion fails.

Do not print or exit from the library. In the CLI adapter, print only the successful, validated address.

### Validation and failures

Reject invalid paths, wrong networks, out-of-range indices and private material at a public-only boundary with typed errors. Never use a fallback derivation. Do not silently derive a different account after rejecting an import.

- **Inputs:** Accept exactly `btc`, `eth` or `trx`. Enforce the 200-character xpub limit before trimming, including while reading standard input, and reject empty trimmed input. Require a numeric integer index from `0` to `2147483647` inclusive. Treat both endpoints as non-hardened. Use distinct error kinds such as `UnsupportedChain`, `InvalidIndex`, `EmptyXpub` and `XpubTooLong`.
- **Private extended keys:** Base58Check-decode the input, check its double-SHA-256 checksum, then compare the four-byte version against the eight-entry private-version set in `derive.js`, including recognised [SLIP-132 versions](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) and testnet forms. Do not decide from a textual prefix alone. Return `PrivateExtendedKey` for recognised private extended keys, and never convert private input into public form. Keep address allocation from becoming a route for handling signing material.
- **Malformed keys:** Do not treat passing the private-version guard as confirmation of a valid xpub. Require Wallet Core to parse it, and reject invalid encoding, checksum or key structure with a typed failure rather than an address.
- **Runtime failures:** Distinguish `CoreInitialisationFailed`, `PublicDerivationFailed`, `AddressDerivationFailed` and `AddressValidationFailed`. Treat an empty address or a false validation result as a failure.

Apply the extended-key-prefix and long-Base58 redaction from `derive.js` to retained native error text. Do not attach raw input to errors or telemetry, because an xpub still exposes an account’s address family.

Keep standard-input read failures in the CLI adapter. Match `derive.js`: exit with `2` for read errors, usage errors and private-key rejection, and with `1` for runtime failures.

### Regression checks

Use each published vector’s matching public fixture and documented index from the [Trust Wallet Core repository](https://github.com/trustwallet/wallet-core) and the [HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/) (links checked live on 8 November 2026), rather than an arbitrary xpub. Treat these as conceptual regression assertions, not payment destinations. Treat the BTC path and `bc1` vector as mainnet-formatted references, and use separate configuration for testnet integration.

Record source-check results as “source-verified against the Trust Wallet Core 4.9.2 tag” only when the checks were made against that tag. Reserve “device-proven” for results backed by a device run.

> **Expected result:**
>
> - Confirm that BTC returns `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` and passes Bitcoin validation.
> - Confirm that ETH returns `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`, preserves its checksum casing and passes Ethereum validation.
> - Repeat the same chain, xpub and index, and confirm that the address remains identical.
> - Confirm that `0` and `2147483647` pass the index gate, while negative, fractional and larger indices fail with typed errors.
> - Confirm that invalid paths, wrong networks and hardened children below an account public key fail with typed errors, without a fallback derivation or a silently substituted account.
> - Confirm that synthetic private-version fixtures are rejected before public-key derivation.
> - Confirm that empty, overlong or malformed input and `ton` return typed errors, without key material or a successful address on standard output.

## Storage module

Keep storage behind one module. Give payment code public records or signing results, never recovery material. Develop and exercise this flow on testnet.

### 3.1 Storage boundary

- **Encrypted seed bundle:** Store ciphertext, nonce, authentication tag and non-secret format metadata.
- **Data key:** Store the separate 32-byte data key in platform-protected credential storage, never in a neighbouring file. Keep its offline recovery copy apart from bundle backups.
- **Public wallet data:** Treat xpubs, addresses, derivation paths and network identifiers as records that cannot authorise spending but can expose wallet history. Keep them out of analytics.
- **App records:** Store transaction references, settings and labels separately from secrets. Encrypt privacy-sensitive records and exclude secrets from the app database.

Never persist a plaintext mnemonic or private key. Never place the data key in the seed bundle, app database, `.env` or ciphertext backup archive.

Keep `make_wallet.py` as an orchestrator without payment-module imports. Have it run `generate.js`, read public JSON only, reject seed-like stdout containing 12 or more lowercase words and require every self-check to pass. Limit its `.env` output to `XPUB_BTC`, `XPUB_ETH`, `XPUB_TRX` and `TON_DEPOSIT_ADDRESS`, using `0600` permissions and temporary-file, fsync and rename writes.

An existing `seed.enc.json` causes refusal unless `generate.js --force` is passed. When that flag is set and the file exists, the generator copies it to `seed.enc.json.bak.<timestamp>` and proceeds to replace it. `make_wallet.py` accepts `--force` or `--regenerate` and passes `--force` to `generate.js`.

### 3.2 Envelope and commit

Retain Bawa’s repository envelope: AES-256-GCM, a random 32-byte data key, a fresh 12-byte nonce and fixed AAD `nova-shop-seed-v1`. Use no password KDF for this envelope. Never reuse a key/nonce pair.

Store the nonce in `nonce_b64`. Store the ciphertext followed by the 16-byte authentication tag in `ciphertext_b64`. Preserve algorithm, KDF, AAD and provenance metadata. Release plaintext only after successful authentication, and fail closed on tampering or GCM authentication failure.

Create the mnemonic and random data key in memory only, then assemble the encrypted bundle in memory. Replace the controlling-terminal display with a protected, short-lived recovery view. Show the mnemonic and recovery data key once. Require the first mnemonic word followed by literal `SAVED`, confirming that the data key was saved separately, before writing the bundle. Leave no new bundle on cancellation.

Keep the bundle inside the configured secrets directory. Use `0700` directories and `0600` files on POSIX, with equivalent app-private sandbox controls on mobile. Refuse symlinks throughout the path. Verify location and permissions when opening existing bundles.

Create an exclusive temporary file in the destination directory, write, fsync, close and rename it, then fsync the directory. Persist the separate secure-store credential before publishing the bundle. Clean up newly created orphan credentials if creation fails.

Use versioned migrations for storage changes, preserving authenticated encryption and atomic writes. Back up and restore through the encrypted seed bundle with its separate 32-byte data key, never through a plaintext export.

### 3.3 Platform protection and memory

Set the shared application inactivity timeout to 10 minutes. This explicitly adopts the Web validation draft's ten-minute auto-lock interval as shared policy. At 754721cd, that interval is evidenced for the Web draft, and no inactivity timeout was found in the Android draft. Both platforms must meet the shared timeout; this policy statement does not establish that both drafts already comply. Never present a value as repository-defined. Treat the Web validation draft’s use of 10 minutes as draft evidence of its own implementation choice, not as a repository rule. Provide immediate locking as well as timeout-based locking.

Include an acceptance test that leaves an unlocked session inactive and verifies locking at the chosen timeout. Exercise immediate locking separately.

> **Expected result:** The application locks at the chosen, recorded inactivity timeout. Immediate locking locks it without waiting for that timeout.

Implement lock-time clearing within this bound: buffers are cleared on lock where the platform allows it, and clearing is best-effort, not guaranteed. Do not promise erasure of garbage-collected strings or native copies.

### 3.4 Backup, restore and failures

Ask users to record the mnemonic offline on paper or metal, never in photographs or cloud notes. Keep the recovery data key separately from ciphertext.

Bawa copies the bundle, `decrypt_seed.py` and `RECOVERY.md` into a `0700` backup directory, with each file at `0600`. The app’s offline export should preserve that separation: encrypted bundle and recovery instructions, no data key.

Hardware wrapping keys do not migrate. Restore either from the mnemonic or from the bundle plus its separately recovered data key, then establish protection on the new device. Test restoration on a clean testnet installation and compare public xpubs, addresses and derivation settings **before funding**. First-word and `SAVED` acknowledgements are not restore tests.

- **Corrupt bundle or failed authentication:** reject malformed fields, unexpected algorithms or AAD, and invalid tags. Return no partial plaintext; preserve the original and offer backup recovery.
- **Missing data key:** offer the separate key backup or mnemonic recovery. A newly generated key cannot decrypt the existing bundle.
- **Wrong permissions, unexpected location or symlink:** refuse access or writing. Explain how to choose a private location; never weaken controls to continue.

### 3.5 Shared clipboard rule

Apply one clipboard policy throughout the application. Prohibit copying the mnemonic, and provide no clipboard controls for either the mnemonic or the recovery data key in the recovery view. Do not access the clipboard at import. Do not automatically paste from the clipboard into any input.

Provide one-tap copy for the receive address, with automatic clipboard clearing after a successful paste or after 60 seconds, whichever occurs first. On the web, make clear that the browser cannot guarantee erasure. This is a requirement, not a statement of completed implementation: at 754721cd, both drafts contain receive-address copy code, but neither implements automatic clipboard clearing.

### 3.6 Vault passphrase policy and Web draft evidence

Set the shared minimum vault unlock passphrase length to 8 characters. This explicitly adopts the minimum enforced by the Web validation draft in `main.js` as shared policy. Enforcement outside the Web draft is not established by the supplied evidence. Reject weak passphrases under the recorded policy.

Keep the Web validation draft’s vault distinct from the repository envelope. Treat its PBKDF2-600k with AES-256-GCM and its own AAD `bawa-web-vault-v1` as draft implementation choices. Preserve the distinction that this AAD is deliberately not the repository’s AAD. Do not claim `seed.enc.json` compatibility.

Treat 600,000 PBKDF2-HMAC-SHA-256 iterations as a defensible floor for the FIPS-140 branch, matching the OWASP Password Storage Cheat Sheet’s FIPS-140 option (verified live 2026-11-08). Do not present this figure as OWASP’s top recommendation; recognise Argon2id as OWASP’s primary recommendation.

## Network and signing modules

This flow is conceptual; run broadcast tests only on explicitly configured testnets. Wallet Core does not communicate with nodes, retrieve balances or broadcast transactions ([Vultisig Wallet Core repository](https://github.com/vultisig/wallet-core)). The app owns those responsibilities.

### 4.1 Network module

Keep this module an RPC/indexer adapter. It reads balances, history, UTXOs, nonce and fee estimates, tracks transaction status, and submits signed bytes. Pass only public addresses and transaction fields; keep xpubs local. Seeds, mnemonics, private keys and data keys never cross this interface. Do not use node-managed signing APIs.

Validate chain/network and addresses locally. Check response schemas, numeric bounds, network identifiers, transaction references and freshness. Match broadcast responses against the locally calculated transaction ID.

An indexer provides observations, never signing authority. Recipients, amounts, change destinations and approval remain under app control. Before constructing signing inputs, the app must verify spend ownership, cross-check input values against funding transactions from a trusted node, and recompute fees.

Use deadlines, bounded read retries with backoff and jitter, and per-endpoint rate limits; honour `Retry-After`. A failed request must not silently become a zero balance or empty history.

**Local derivation stays separate.** `derive_daemon.js` is a persistent public-only service, not a signer or RPC client:

- Transport is JSONL over stdin/stdout. Wait for `{"ready":true}` before sending requests.
- A conceptual request is `{"chain":"btc","xpub":"<XPUB>","index":5}`. Allowed chains are `btc`, `eth` and `trx`.
- Replies are `{"ok":true,"address":"<ADDRESS>"}` or `{"ok":false,"error":"<ERROR>"}`.
- Limits are 4,096 characters per line, 200 per xpub, and integer indices `0..2147483647`.
- It rejects recognised checksummed private extended keys and redacts extended-key-like strings from request errors. Success includes Wallet Core address validation, not spend authorisation.
- EOF/SIGTERM exits with status 0. Treat unresolved requests as interrupted; await readiness after restarting.

The daemon has fixed derivation paths and no network selector. Its chain labels do not establish testnet compatibility.

### 4.2 Signing module

Build the public transaction fields of a chain-specific protobuf `SigningInput` from validated app data. `AnySigner` provides one signing entry point, returning the chain’s `SigningOutput`. Bitcoin input carries UTXOs, outputs, fee and change; Ethereum input carries chain ID, nonce, gas and data ([Trust Wallet Core AnySigner interface](https://github.com/trustwallet/wallet-core/blob/master/include/TrustWalletCore/TWAnySigner.h)).

The signing coordinator holds no private keys. Only the key module adds signing secrets and invokes `AnySigner`; secret-bearing messages never leave that boundary. The key module must bind approval to the exact input. Check `SigningOutput` errors before accepting bytes.

For offline/hardware signing, `TransactionCompiler` provides pre-image hashes for the device to sign and compiles the returned signatures into a transaction. Keys remain on the device; bind signatures to the reviewed input ([Vultisig Wallet Core repository](https://github.com/vultisig/wallet-core)).

Obtain approval for recipients, amounts, change, fees and contract calls before signing. Decode the actual signed bytes with a chain-specific decoder, compare them against that approved intent, including chain/network, nonce, gas and data where applicable, and display the decoded transaction before an explicit broadcast action. A mismatch or decoding failure blocks submission.

Signing and network code exchange public transaction data and signed bytes, never key material. Broadcast only signed transaction bytes, never `SigningInput` or an unsigned transaction.

```text
Approved, validated unsigned transaction
  ↓
Key module or hardware signer
  ↓
Signed transaction bytes
  ↓
Decode, compare and display
  ↓
Network module
  ↓
Testnet RPC broadcast
```

### 4.3 Error handling

Return stable error codes and sanitised messages. Never dump secret-bearing protobufs, raw requests or exception payloads into logs. Redaction is defence in depth, not permission to log key material.

- **Bad chain/address:** reject locally; do not sign or submit.
- **Insufficient funds:** include fees in balance and UTXO checks. Refresh state and ask the user to adjust the transaction; never silently reduce the payment.
- **Nonce/gas errors:** refresh network state, rebuild, and obtain fresh approval for changed fields. Never silently re-sign.
- **Broadcast rejection:** retain the locally calculated transaction ID and show a sanitised reason. A timeout means submission status is unknown: query by transaction ID before retrying identical signed bytes. Do not automatically create a replacement transaction.

## UI module and app-wide error handling

Keep the UI a presentation and intent layer. Follow Bawa’s docs/03 boundary: leave keys, derivation and signing to Wallet Core, network state to RPC/indexer, and records to the application. Send no secret material to metadata calls. Use testnets for UI and send exercises, and public vectors for offline derivation checks.

### 5.1 Screens and permitted data

Use the following as the single canonical screen list. Allow ordinary screens to show addresses, public keys, balances and transaction records. Never display private keys. Show a mnemonic only on the one-time offline Mnemonic backup screen; keep import entry masked.

- **Welcome:** Show the create-or-import choices, explain recovery responsibility and introduce network choice.
- **Create wallet:** Show recovery guidance and the selected network. Create the wallet through Wallet Core without displaying the mnemonic here.
- **Import wallet:** Show network choice and masked import entry. Import through Wallet Core, and never retain import text in persisted forms or navigation state.
- **Mnemonic backup:** Display the mnemonic once, offline. Require the user to re-enter all 24 mnemonic words from their saved copy, in their original order, using protected entry. Accept backup confirmation only when the complete ordered entry matches the mnemonic, then clear temporary buffers. Do not accept selected words, a partial match or a tick-box acknowledgement. Prohibit copying, sharing, QR export and analytics.
- **Portfolio dashboard:** Show account and chain context, balances and transaction records. Include balance freshness information.
- **Asset list:** Show assets and their balances for the selected account and chain, with freshness information.
- **Asset detail:** Show the selected asset, account, chain, full account address, optional public key, balance and related transaction records. Include balance freshness information.
- **Receive:** Receive must show the selected address, an explicit network label and an actual QR using the Receive QR payloads table in docs/07. Generate and verify the QR through `P.renderAndVerifyQr`, with error correction explicitly set to M. Display request information not carried by the QR separately.
- **Send:** Collect the recipient, asset and amount. Show sender, chain/network and fee information, and prepare a reviewable action, not a signature.
- **Transaction history:** Show application transaction records joined to RPC/indexer status. Distinguish pending, included, confirmed, failed and replaced transactions.
- **Transaction details:** Show the selected transaction record, transaction hash and RPC/indexer status, including inclusion and confirmations.
- **Network selection:** Show the selected chain/network and available network choices, identifying testnets explicitly.
- **Wallet management:** Show accounts, chains, full addresses and optional public keys. Require explicit confirmation for local-wallet deletion, and never offer private-key export.
- **Security and backup settings:** Show privacy, authentication, auto-lock and backup controls. Provide immediate locking, but do not display the mnemonic here.

Implement **Review** as a required state of the **Send** flow, not as a separate screen. Implement **Lock** as a required app state, not as a separate screen.

Receive-QR and scanning both stay in scope (user decision, 8 November 2026). The Android draft Receive screen currently encodes the bare derived address as a QR using ZXing core 3.5.3 with default error correction L, not the required M. It has no decode-verification step or payment-request fields. The Web draft states that QR codes are not offered: no QR image service is used and no QR encoder is bundled. The Web guide contains a testnet QR payment-request scanning specification under "QR payment-request scanning — testnet only" (Section F, line 442), naming qr-scanner@1.4.2 as the decoder. Scanning is implemented in neither draft. Add the web encoder and the Android verification half before treating either half as implemented.

### 5.2 Confirmation and send flow

Take Send through Compose, Review, the platform-appropriate authentication or vault-session unlock gate, Sign, Broadcast and Confirm, in that order. In the Web draft, `approveAndSign()` calls `S.session.requireMnemonic()` before signing. On Android, use the biometric/device-credential gate. This is the required flow; it is not a claim that the complete sequence has been verified in both drafts.

Before any signature, show the sender, **full recipient address**, amount and asset, chain/network, fee estimate and maximum authorised fee.

Copy public data only, using the complete address. Warn that other apps may read or replace clipboard contents. Never read the clipboard automatically. Validate explicit paste/scan against the chosen chain, review QR destination and amount, and reject unsupported payloads. Require comparison of the **full address** with a trusted recipient source. Scanning never authorises payment or silently changes networks. QR generation and actual-output decode-verification are required Receive behaviour. The decoded output must pass `E.parsePaymentRequest` and `E.verifyPaymentRequest` against the selected context and associated request.

Explain the decoded contract call in plain language from the actual payload, never from untrusted descriptive text. Identify the contract and function, explain the changes and transfers, and state the approval spender and allowance, including unlimited approvals. Block unknown or undecodable actions; never blind-sign. Require understandable intent for message signatures as well.

Bind authorisation to the reviewed payload. Restart Review and the platform-appropriate authentication or vault-session unlock gate after any edit, chain change or fee change. Have Wallet Core sign only that payload, and have RPC broadcast the signed transaction.

Do not treat broadcast acknowledgement as confirmation. Track inclusion, confirmations and reorgs.

### 5.3 Accessibility, clipboard and capture

Follow [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessibility across screens and required states (verified live 8 November 2026; w3.org blocks automated checks).

Apply the shared clipboard rule from section 3:

- Prohibit copying the mnemonic.
- Prohibit all clipboard access during import.
- Provide one-tap copying of the Receive address with automatic clearing.
- Never automatically paste from the clipboard into any input.
- Clear the clipboard after a successful paste or after 60 seconds.
- On the web, make clear that the browser cannot guarantee clipboard erasure.

Block screenshots and screen recording on sensitive screens where supported. Hide app-switcher previews, and clear sensitive UI state whenever the app is backgrounded or locked.

### 5.4 Typed errors and safe diagnostics

Use typed errors for app-wide handling, and map them to safe, actionable UI messages rather than exposing raw exceptions. Keep mnemonics, import text, private keys and other secret material out of error messages, logs, analytics and diagnostics. Follow the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Before displaying or recording derive.js output, replace each entire extended-key-like string whose prefix is xprv, xpub, yprv, ypub, zprv, zpub, Yprv, Ypub, Zprv, Zpub, tprv, tpub, uprv, upub, vprv or vpub, followed by Base58 characters, with [REDACTED]. Replace the whole string, not merely its prefix or suffix. Also replace every run of 100 or more Base58 characters with [REDACTED].

Treat a timeout after broadcast as **status unknown**, not **failed**. Reconcile by transaction hash before rebroadcasting identical signed bytes. Never automatically re-sign.

## Testing, release security and build checklist

### 6.1 Testing strategy

Keep offline tests separate from disposable local-node and testnet runs. Never use customer wallet material.

- **Unit tests by module.** Use published vectors only for cryptographic assertions, with mocks for failure paths. Test key generation and validation, randomness failure and handle cleanup; derivation paths, networks and index bounds; storage authentication, tampering, wrong credentials and atomic migrations; signing serialisation, signature verification, chain IDs, fees and amounts. Require public-import interfaces to reject private material.

  This layer has no runnable procedure in this guide yet.

- **Differential tests.** Pin Trust Wallet Core to `4.8.4`, matching the repository tools at base commit `754721cd` (the Web draft pins `4.9.2` (WEB-GUIDE pins table; D21 work copy); Android's AAR procedure (C.1) checks out tag `4.9.2`, so the drafts do not uniformly pin `4.8.4`), and compare public derivation against independently pinned `bip_utils`. Supply `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX` through the root `.env` read by `compare.js`, or through the path selected by `NOVA_ENV`. Retain `NOVA_ENV` as a frozen legacy identifier for compatibility with existing seed bundles. Require a code change and a migration note before renaming it.

  Use `test/differential_test.py` to independently check these published index-zero fixtures:

  - BTC `m/84'/0'/0'/0/0`: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - ETH `m/44'/60'/0'/0/0`: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`

  > **Expected result:**
  >
  > `compare.js` prints only public addresses at indices `0`, `1` and `2`.
  >
  > `test/differential_test.py` independently checks the BTC and ETH fixtures above and prints `PASS`.

  Exception at 754721cd: unlike `derive.js` and `derive_daemon.js`, `compare.js` does not reject private extended keys; given a private extended key it prints silently wrong addresses with exit 0 (D06 F1). Do not feed `compare.js` anything but a verified account public root.

  Assert exact equality in CI. Track the extension of independent coverage to TRX and indices `1` and `2` as an open item. Treat these checks as public-derivation coverage, not custody or signing coverage. Treat the addresses as fixtures, not payment destinations, and label the BTC vector as mainnet-formatted.

  This layer has no runnable procedure in this guide yet.

- **Integration tests.** Exercise balance, UTXO/nonce handling, fees, signing, broadcasting and receipts against a local node or explicitly selected testnet. Include reorgs and duplicate requests. Verify chain identity before signing, and prevent a timeout from creating a second payment.

  This layer has no runnable procedure in this guide yet.

- **UI tests.** Match the confirmation’s network, asset, destination, amount and fees to the transaction actually signed. Ensure that cancellation prevents signing. Exercise backup verification and restore with test-only inputs, and exclude sensitive screens from snapshots.

  This layer has no runnable procedure in this guide yet.

- **Negative tests.** Reject private keys at xpub imports, corrupt bundles, invalid indices, hardened children below an account xpub, malformed addresses and unsupported networks. Simulate timeouts, stale responses and dropped broadcasts. Fail closed without losing the vault, switching networks or silently re-signing.

  This layer has no runnable procedure in this guide yet.

Keep the reported test results separate and retain their stated limits:

- 31 offline unit tests pass (mocked transport; no live-network coverage), run by the author against the validation draft, not shipped in any repo.
- 55 pure-module checks passed in the author's kotlinc 2.1.0 harness run; the harness was not re-run for this guide and covers pure Kotlin logic only - no JNI binding, signing, UI or Gradle build.
- The repository at 754721cd contains 28 smoke tests in test/smoke.test.js, and CI runs npm test. The recorded phase-1 repair result was 28 ok, 0 fail, exit 0.

Do not combine these counts or use them as evidence of a build, device run or live-network validation.

### 6.2 Release and update security

Apply OWASP MASVS L1 as the floor, with L2/R coverage for apps storing sensitive data. Maintain a threat model and commission an external penetration test. Automate dependency and secret scanning. Require signed, reproducible builds and use a staged rollout.

Block release for any of the following:

- Failing tests or MASVS controls.
- Missing threat-model or penetration-test sign-off.
- Unresolved critical/high findings.
- Unresolved secret-scan alerts.
- Secrets in the repository or binary.
- Unsigned or non-reproducible builds.
- Unsafe updates or migration failures.

Treat the result as a testnet app. Never use it to hold real funds on mainnet without an independent security review. Enforce that review as a gate, not an optional extra.

### 6.3 Build-from-scratch checklist

Treat the install steps as an unexecuted procedure, not a verified path: no debug APK has ever been built.

Keep the on-device fixture gate marked as never run: no Core AAR has been built and no device run has happened, so the gate has never run.

Live validation so far: wallet creation and recovery were verified end to end in a live run on 8 November 2026 (V1; pushed head at the time: 082f7915): generation under a real pty, decrypt round trip byte-identical, differential test PASS. V1's watch-only checks — derive 9/9, compare 9/9 and smoke 28/28 — ran on the repaired working copy, byte-identical to the phase-1 repair later pushed as e3b65fb832db287fdc8d54794980dd0b3456cc12. The subsequent professional rewrite was pushed as 754721cd. No live testnet spend has been made from this wallet.

Use this nine-step checklist as work to complete, not as evidence of completion. Do not pass any release gate without its own evidence.

1. **Establish the security scope.** Keep the app scoped to testnet. Apply the MASVS requirements, maintain the threat model and commission the external penetration test.

2. **Pin dependencies and commit lockfiles.** Pin Trust Wallet Core to `4.8.4`, matching the repository tools at base commit `754721cd` (the Web draft pins `4.9.2` (WEB-GUIDE pins table; D21 work copy); Android's AAR procedure (C.1) checks out tag `4.9.2`, so the drafts do not uniformly pin `4.8.4`), and independently pin `bip_utils` for comparison. Commit lockfiles before making any release claim.

3. **Prepare public test inputs.** Supply the xpub inputs for `compare.js` through the root `.env` or the path selected by `NOVA_ENV`. Preserve the frozen identifier and use published fixtures, never customer wallet material.

4. **Check offline logic and public derivation.** Work through the unit, negative and differential requirements in Section 6.1. Assert exact differential equality in CI, and retain the open items for independent TRX and index `1` and `2` coverage.

5. **Build the Core AAR.** Obtain evidence for the AAR build itself. Do not substitute the pure Kotlin harness results for AAR, JNI binding or signing evidence.

6. **Build and install the debug APK.** Build the APK, carry out the install steps and run the on-device fixture gate. Record separate evidence for the build and device run before describing either as verified.

7. **Exercise integration, UI and live wallet flows.** Use a disposable local node or explicitly selected testnet for integration checks. Exercise creation, backup verification and recovery with test-only inputs, and obtain evidence of end-to-end live creation and recovery and a live testnet spend. Complete the confirmation, cancellation and negative-path checks from Section 6.1.

8. **Collect CI and security evidence.** Automate dependency and secret scans, obtain threat-model and penetration-test sign-off, and retain evidence for each gate. Do not infer a CI pass from local test reports or transfer evidence from one gate to another.

9. **Gate the testnet rollout.** Require signed, reproducible builds and safe updates and migrations. Apply every release blocker in Section 6.2 before a staged rollout. Keep independent security review mandatory before any use with real funds on mainnet.

