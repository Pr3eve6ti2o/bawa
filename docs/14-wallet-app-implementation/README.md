# Wallet app implementation

## 1. Project structure and key module

`bawa-hd-wallet-core-tools` is private (`private: true`), pins `@trustwallet/wallet-core` to `4.8.4` and requires Node `>=22 <23`. The paths below are a conceptual layout. Connected exercises use testnet configuration and endpoints; published vectors and mainnet-format export checks remain offline.

### Project structure

**App shell — `src/app/`.** Initialise Wallet Core, enforce the fixture gate and coordinate creation, import and wallet sessions. Keep secrets out of application-wide state.

**Key — `src/key/`.** Own creation, import and short-lived native wallet objects. Seal secret material before storage; expose public results or opaque wallet IDs, never native handles or recovery material.

**Derivation — `src/derivation/`.** Own coin, account and path policy. Derive non-hardened children from account public descriptors under [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Hardened derivation must stay inside a key operation.

**Storage — `src/storage/`.** Persist authenticated ciphertext and public metadata, with encryption material protected by platform facilities. Never persist plaintext secrets; treat authentication or decryption failure as an error, not permission to create another wallet.

**Network — `src/network/`.** Fetch testnet chain data and broadcast signed transactions. Accept only necessary public addresses and transaction payloads, never vault contents or key handles. Treat remote responses as untrusted.

**Signing — `src/signing/`.** Build and verify transaction intent locally, check chain selection and approval, then request scoped signing from the key boundary. Return signed payloads, not signing keys.

**UI — `src/ui/`.** Render public addresses, balances, confirmations and sanitised failures. Keep import text out of persistent state, analytics, crash reports and previews; receive no secret material from the key module.

### Key module

#### Fixture gate

Before any fresh-wallet creation, require the published fixture self-checks to pass against the loaded Core build. Check the numeric coin values: TRON `195`, TON `607`. Fixture derivations must match:

- BTC: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
- ETH: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`

These are offline expectations, not payment destinations or expected fresh-wallet outputs. Stop on any mismatch; never fall back to fresh generation. The companion fixture section covers the code.

#### Creation and import

Follow `generate.js`: `HDWallet.create(256, "")`. Under [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), 256 bits of entropy produce 24 words. Read `mnemonic()` internally, check the 24-word count and `Mnemonic.isValid(mnemonic)`, then seal the recovery material before reporting success.

Bawa’s application policy uses an **empty BIP-39 passphrase**. Changing the passphrase creates a different wallet; it does not merely change an encryption password.

Import takes both mnemonic and passphrase. Validate with `Mnemonic.isValid(mnemonic)` and enforce the passphrase policy before calling `HDWallet.createWithMnemonic(mnemonic, passphrase)`. Under the current empty-passphrase policy, reject non-empty input rather than silently replacing it with `""`. Supporting a non-empty passphrase requires an explicit policy change. Mnemonic validation cannot verify a passphrase or identify the intended wallet.

### Fixture self-checks and native-object disposal

A loaded WASM module does not prove that the bundled Wallet Core matches Bawa’s coin mappings, address encodings and derivation rules. Run the public fixture suite after `initWasm()` at startup and again before the first user-wallet operation. Tie the result to that core instance and build; rerun after reinitialisation or an upgrade. Keep wallet actions disabled until the checks pass.

Use Bawa’s fixed published test mnemonic with an empty passphrase, never a user’s seed. Run offline and never fund the fixture. Interactive testing belongs on testnet.

**Required checks**

Use the [Trust Wallet Core HD wallet API](https://github.com/trustwallet/wallet-core/blob/master/include/TrustWalletCore/TWHDWallet.h) and [Trust Wallet Core coin API](https://github.com/trustwallet/wallet-core/blob/master/include/TrustWalletCore/TWCoinType.h). Export all extended public keys below with `getExtendedPublicKeyAccount`, account `0`.

- **Coin values:** `CoinType.tron.value === 195` and `CoinType.ton.value === 607`. TON has an enum check here, not an address fixture.
- **Published addresses:** the fixture wallet’s `getAddressForCoin` results must match exactly, including case:
  - BTC: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - ETH: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`
- **BTC extended key:** use `Purpose.bip84`, `CoinType.bitcoin`, `Derivation.bitcoinSegwit` and `HDVersion.zpub`. Require the `zpub` prefix. Deriving `m/84'/0'/0'/0/0` must reproduce the direct BTC address above; deriving `m/84'/0'/0'/0/1` must produce a valid Bitcoin address.
- **ETH extended key:** use `Purpose.bip44`, `CoinType.ethereum`, `Derivation.default` and `HDVersion.xpub`. Require the `xpub` prefix. Deriving `m/44'/60'/0'/0/0` must reproduce the direct ETH address above.
- **TRX extended key:** use `Purpose.bip44`, `CoinType.tron`, `Derivation.default` and `HDVersion.xpub`. Require the `xpub` prefix. Deriving `m/44'/195'/0'/0/0` must equal the fixture wallet’s `getAddressForCoin(CoinType.tron)`.
- **Validation:** require `CoinTypeExt.validate(coin, address)` to return true for every derived address, including all direct wallet results and extended-key results. Prefix and equality checks do not replace validation.

For each extended-key address, obtain the public key with `HDWallet.getPublicKeyFromExtended`, then call `CoinTypeExt.deriveAddressFromPublicKey`, using the matching coin throughout.

**On any failure**

A mismatch, initialisation failure or exception must block creating, importing or using a wallet. Show a plain error: “Wallet self-check failed. Wallet operations are disabled.” Do not offer a bypass. Log only the check identifier and non-secret core version/build information—not secrets, addresses, extended keys or raw exception payloads.

**Dispose native objects on every exit path**

Wallet Core objects own native/WASM resources; do not rely on JavaScript garbage collection. Follow Bawa’s public-key helper: call `pubkey.delete()` in a `finally` block. Give every wallet—including fixture, newly created and imported wallets—the same protection with `wallet.delete()` in `finally`, even when an assertion throws.

Keep ownership local. Never retain wallet or public-key objects in UI stores or network state; pass required public strings instead. Disposal does not guarantee erasure of JavaScript strings. See [Emscripten Embind memory management](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-management).

**You should see:**

- [ ] Startup and first-use checks pass, including every address validation.
- [ ] A forced mismatch disables wallet actions and shows the plain error.
- [ ] Acquired native objects are deleted on success and failure.
- [ ] No native handles in UI/network state, and no secrets in logs.

#### Public outputs

Use `getExtendedPublicKeyAccount(purpose, coin, derivation, version, account)` with account `0`:

- BTC: [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), Bitcoin SegWit derivation, `zpub`.
- ETH and TRON: [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), default derivation, `xpub`.
- TON: obtain an address through `getAddressForCoin(CoinType.ton)`; do not assume an xpub export.

Check the extended-key prefixes and validate TON with `CoinTypeExt.validate`. Require each BTC/ETH/TRON account-relative `0/0` address to match `getAddressForCoin(coin)`; also exercise `0/1`. These checks belong to the offline baseline, not testnet address configuration.

#### Native lifetime and hard boundaries

Use `getKeyForCoin` or `getKey` with a derivation path only inside a scoped signing operation. Use `try/finally` to call `delete()` on owned native key objects and the wallet after use, including failure paths. **Never hold a wallet object longer than the operation**, cache it in application state or return it. Native disposal does not guarantee erasure of JavaScript strings; minimise their lifetime too.

The operation and lifecycle references are the [Trust Wallet Core HDWallet API](https://pub.dev/documentation/trust_wallet_core/latest/flutter_trust_wallet_core/HDWallet-class.html) and [DeepWiki: HD Wallet Implementation](https://deepwiki.com/trustwallet/wallet-core/4.1-hd-wallet-implementation). The linked BIPs are the scheme authorities.

**Never log, print or return a mnemonic or private key**, including through errors, telemetry or test output. **Never hand a raw key to the network or UI module.** Return only opaque wallet IDs, public data or signed payloads.

**You should see:**

- [ ] Seven modules with explicit ownership boundaries.
- [ ] Fixture addresses and coin values checked before fresh creation.
- [ ] Valid 24-word creation with the empty-passphrase policy.
- [ ] Validated imports without silent passphrase substitution.
- [ ] Public round trips passing; connected exercises staying on testnets.
- [ ] Native objects deleted on success and failure.
- [ ] No mnemonic or private key in logs or results; no raw keys reaching network or UI.

## 2. Derivation module

Keep derivation watch-only. Its job is to turn an account extended public key and receiving index into a validated address, not to import secrets or sign transactions. TON stays outside this API: Bawa uses one configured deposit address, with no xpub flow.

Expose `deriveAddress(chain, xpub, index)` returning `Promise<Result<Address, DerivationError>>`. Success contains an address string; failure contains a stable error kind and a safe message. Neither result contains a key object or the input xpub.

### Account, change and index

Bawa fixes account `0'` and the external/receiving branch `0`. Only the final index varies. This follows the [BIP44 account/change/index layout](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), with [BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) for BTC.

| Chain | Account xpub origin | Full path passed to Wallet Core |
|---|---|---|
| BTC (`btc`) | `m/84'/0'/0'` | `m/84'/0'/0'/0/<index>` |
| ETH (`eth`) | `m/44'/60'/0'` | `m/44'/60'/0'/0/<index>` |
| TRX (`trx`) | `m/44'/195'/0'` | `m/44'/195'/0'/0/<index>` |

The hardened prefix records where the account xpub was exported. Derivation from that xpub covers only `/0/<index>`: [BIP32 public derivation](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) cannot cross hardened steps.

Keep chain and account-origin metadata alongside the xpub. Address validation cannot establish that the key belongs to the intended account.

### Public-only flow

Mirror `derive.js` and its Wallet Core API sequence:

```text
<XPUB>, chain, index
    ↓
Input bounds and private-version checks
    ↓
Initialise WASM; select CoinType and full path
    ↓
HDWallet.getPublicKeyFromExtended
    ↓
CoinTypeExt.deriveAddressFromPublicKey
    ↓
CoinTypeExt.validate
    ↓
Validated address string
```

Every failed step returns a typed error instead of an address.

Use Bitcoin, Ethereum or Tron `CoinType` according to the allow-listed chain. Keep WASM initialisation behind the module boundary. The derived public-key object is temporary: call `pubkey.delete()` in `finally`, including when address conversion fails.

The library neither prints nor exits. The CLI adapter prints only the successful, validated address.

### Validation and failures

- **Inputs:** accept exactly `btc`, `eth` or `trx`. Enforce the 200-character xpub limit before trimming, including while reading stdin; reject empty trimmed input. Require `Number.isInteger(index)` and `0 <= index <= 2147483647` (2³¹ − 1). Both endpoints are non-hardened. Use distinct kinds such as `UnsupportedChain`, `InvalidIndex`, `EmptyXpub` and `XpubTooLong`.
- **Private extended keys:** Base58Check-decode the input, verify its double-SHA-256 checksum, then compare the four-byte version against `derive.js`’s eight-entry private-version set. This includes recognised [SLIP-132 versions](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) and testnet forms. Do not decide from a textual prefix alone. Return `PrivateExtendedKey`; never convert private input into public form. Address allocation must not become a route for handling signing material.
- **Malformed keys:** passing the private-version guard does not certify a valid xpub. Wallet Core must still parse it; invalid encoding, checksum or key structure must produce a typed failure, not an address.
- **Runtime failures:** distinguish `CoreInitialisationFailed`, `PublicDerivationFailed`, `AddressDerivationFailed` and `AddressValidationFailed`. An empty address or a false validation result is a failure.

Apply `derive.js`’s extended-key-prefix and long-Base58 redaction to retained native error text. Do not attach raw input to errors or telemetry: an xpub still exposes an account’s address family.

Keep stdin read failures in the CLI adapter. Match `derive.js`: read, usage and private-key rejection exit with `2`; runtime failures exit with `1`.

### You should see:

Use each published vector’s matching public fixture and documented index from the [Trust Wallet Core usage guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage), not an arbitrary `<XPUB>`. These are conceptual regression assertions, not payment destinations. The BTC path and `bc1` vector are mainnet-formatted references; testnet integration needs separate configuration.

- [ ] BTC returns `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` and passes Bitcoin validation.
- [ ] ETH returns `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`, preserving its checksum casing, and passes Ethereum validation.
- [ ] Repeating the same chain, xpub and index returns the same address.
- [ ] `0` and `2147483647` pass the index gate; negative, fractional and larger indices fail.
- [ ] Synthetic private-version fixtures are rejected before public-key derivation. Empty, overlong or malformed input and `ton` return typed errors, without key material or a successful address on stdout.

## 3. Storage module

Keep storage behind one module. Payment code receives public records or signing results, not recovery material. Develop and exercise this flow on testnet.

### 3.1 Storage boundary

- **Encrypted seed bundle:** ciphertext, nonce, authentication tag and non-secret format metadata.
- **Data key:** separately in platform-protected credential storage, never in a neighbouring file. Keep its offline recovery copy apart from bundle backups.
- **Public wallet data:** xpubs, addresses, derivation paths and network identifiers. These cannot authorise spending, but expose wallet history; keep them out of analytics.
- **App records:** transaction references, settings and labels. Encrypt privacy-sensitive records and exclude secrets from the app database.

Never persist a plaintext mnemonic or private key. Never place the data key in the seed bundle, app database, `.env` or ciphertext backup archive.

`make_wallet.py` remains an orchestrator without payment-module imports. It runs `generate.js`, reads public JSON only, rejects seed-like stdout containing 12+ lowercase words, and requires every self-check to pass. It writes only `XPUB_BTC`, `XPUB_ETH`, `XPUB_TRX` and `TON_DEPOSIT_ADDRESS` to `.env`, using `0600` permissions and temp-file, fsync and rename writes.

### 3.2 Envelope and commit

Retain Bawa’s envelope: AES-256-GCM, a random 32-byte data key, a fresh 12-byte nonce and fixed AAD `nova-shop-seed-v1`. There is no password KDF. Never reuse a key/nonce pair.

`nonce_b64` holds the nonce; `ciphertext_b64` holds ciphertext followed by the 16-byte authentication tag. Preserve algorithm, KDF, AAD and provenance metadata. Decryption must authenticate successfully before releasing plaintext.

```text
Create — mnemonic and random data key, memory only
↓
Encrypt — assemble the AES-256-GCM bundle in memory
↓
Confirm — first seed word, then SAVED
↓
Write — restrictive, atomic commit
↓
Backup — ciphertext package; recovery key kept elsewhere
```

Replace the controlling-terminal display with a protected, short-lived recovery view. Show the mnemonic and recovery data key once, without clipboard controls. Require the first mnemonic word and literal `SAVED`, confirming that the data key was saved separately, **before writing the bundle**. Cancellation leaves no new bundle.

Keep the bundle inside the configured secrets directory. Use `0700` directories and `0600` files on POSIX, with equivalent app-private sandbox controls on mobile. Refuse symlinks throughout the path.

Create an exclusive temporary file in the destination directory, write, fsync, close, rename, then fsync the directory. Verify location and permissions when opening existing bundles. Persist the separate secure-store credential before publishing the bundle; clean up newly created orphan credentials if creation fails.

### 3.3 Platform protection and memory

Distinguish the portable recovery data key from the device’s non-exportable hardware wrapping key.

- **iOS:** keep the data key in a device-only, non-synchronising Keychain item with user-presence access controls. Use Secure Enclave-backed key agreement or wrapping protection where supported; do not assume arbitrary AES keys reside directly in the enclave.
- **Android:** protect the data key with a hardware-backed, non-exportable Keystore/KeyMint wrapping key. Keep the wrapped-key record in separate native credential storage.

Require biometric or device-passcode/PIN authorisation. Verify hardware backing and platform-supported attestation; refuse storage when required protection is unavailable. Never fall back to plain AsyncStorage or SharedPreferences for secrets. See [Crypture’s mobile and desktop wallet security comparison](https://crypture.org/how-secure-are-mobile-and-desktop-wallets-compared-to-hardware-wallets/).

Apply OWASP MASVS/MASTG guidance: hardware-backed keystores are the strongest local option; encrypt sensitive material at rest, decrypt only in memory, and keep secrets out of plaintext files, screenshots, cloud backups and logs. See [Cryptomathic’s MASVS/MASTG guidance overview](https://www.cryptomathic.com/blog/resources-to-assist-in-developing-and-testing-the-security-of-your-eudi-wallet-app) and [AMELA’s enterprise wallet development guide](https://amela.tech/the-ultimate-guide-to-crypto-wallet-development-for-enterprises/).

Use short-lived native buffers and wipe keys after use, including errors and cancellation. Never keep a mnemonic in a long-lived variable, UI store or cache: garbage-collected strings cannot guarantee erasure. Exclude secret storage from automatic OS/cloud backups, analytics and crash attachments. Blank background previews and block screen capture where supported.

### 3.4 Backup, restore and failures

Ask users to record the mnemonic offline on paper or metal, never in photographs or cloud notes. Keep the recovery data key separately from ciphertext.

Bawa copies the bundle, `decrypt_seed.py` and `RECOVERY.md` into a `0700` backup directory, with each file at `0600`. The app’s offline export should preserve that separation: encrypted bundle and recovery instructions, no data key.

Hardware wrapping keys do not migrate. Restore either from the mnemonic or from the bundle plus its separately recovered data key, then establish protection on the new device. Test restoration on a clean testnet installation and compare public xpubs, addresses and derivation settings **before funding**. First-word and `SAVED` acknowledgements are not restore tests.

- **Corrupt bundle or failed authentication:** reject malformed fields, unexpected algorithms or AAD, and invalid tags. Return no partial plaintext; preserve the original and offer backup recovery.
- **Missing data key:** offer the separate key backup or mnemonic recovery. A newly generated key cannot decrypt the existing bundle.
- **Wrong permissions, unexpected location or symlink:** refuse access or writing. Explain how to choose a private location; never weaken controls to continue.

## 4. Network and signing modules

This flow is conceptual; run broadcast tests only on explicitly configured testnets. Wallet Core does not communicate with nodes, retrieve balances or broadcast transactions ([Vultisig Wallet Core — Integration Guides](https://deepwiki.com/vultisig/wallet-core/6-integration-guides)). The app owns those responsibilities.

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

Build the public transaction fields of a chain-specific protobuf `SigningInput` from validated app data. `AnySigner` provides one signing entry point, returning the chain’s `SigningOutput`. Bitcoin input carries UTXOs, outputs, fee and change; Ethereum input carries chain ID, nonce, gas and data ([Trust Wallet Core — AnySigner Interface](https://deepwiki.com/trustwallet/wallet-core/3.1-anysigner-interface)).

The signing coordinator holds no private keys. Only the key module adds signing secrets and invokes `AnySigner`; secret-bearing messages never leave that boundary. The key module must bind approval to the exact input. Check `SigningOutput` errors before accepting bytes.

For offline/hardware signing, `TransactionCompiler` provides pre-image hashes for the device to sign and compiles the returned signatures into a transaction. Keys remain on the device; bind signatures to the reviewed input ([Vultisig Wallet Core — Integration Guides](https://deepwiki.com/vultisig/wallet-core/6-integration-guides)).

Obtain approval for recipients, amounts, change, fees and contract calls before signing. Decode the actual signed bytes with a chain-specific decoder, compare them against that approved intent—including chain/network, nonce, gas and data where applicable—and display the decoded transaction before an explicit broadcast action. A mismatch or decoding failure blocks submission.

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

## 5. UI module and app-wide error handling

Keep the UI a presentation and intent layer. Follow Bawa’s `docs/03` boundary: Wallet Core owns keys, derivation and signing; RPC/indexer owns network state; the application owns records. Metadata calls receive no secret material. Use testnets for UI/send exercises and public vectors for offline derivation checks.

### 5.1 Screens and permitted data

Ordinary screens may show addresses, public keys, balances and transaction records. Never display private keys. A mnemonic is visible only on the one-time offline backup screen; import entry stays masked.

- **Onboarding/create-or-import:** explain recovery responsibility and network choice; create/import through Wallet Core. Never retain import text in persisted forms or navigation state.
- **Backup confirmation:** display the mnemonic offline, verify selected words using protected entry, then clear temporary buffers. No copying, sharing, QR export or analytics.
- **Accounts/addresses:** show account, chain, full address, optional public key and balance with freshness information.
- **Receive:** show the full address and chain/testnet beside a matching QR. Make any requested amount explicit.
- **Send:** collect recipient, asset and amount; estimate fees and prepare a reviewable action, not a signature.
- **Activity/history:** join application records to RPC/indexer status. Distinguish pending, included, confirmed, failed and replaced transactions.
- **Settings/lock:** control network, privacy, authentication and auto-lock. Provide immediate locking and explicit confirmation for local-wallet deletion, never private-key export.

### 5.2 Confirmation and send flow

Before any signature, show the sender, **full recipient address**, amount and asset, chain/network, fee estimate and maximum authorised fee. Explain the decoded contract call in plain language: which contract and function, what changes, transfers, approval spender and allowance, including unlimited approvals. Derive this explanation from the actual payload, not untrusted descriptive text. Block unknown or undecodable actions; never blind-sign. Message signatures also need understandable intent.

```text
Compose
↓
Review
↓
Biometric/PIN gate
↓
Sign
↓
Broadcast
↓
Confirm
```

Bind authorisation to the reviewed payload. Edits, chain changes or fee changes restart review and the gate. Wallet Core signs only that payload; RPC broadcasts the signed transaction. Broadcast acknowledgement is not confirmation: track inclusion, confirmations and reorgs.

### 5.3 Accessibility, clipboard and capture

Follow [WCAG 2.2](https://www.w3.org/TR/WCAG22/): scalable text, labelled controls, generous touch targets, logical focus, screen-reader announcements and errors that do not rely on colour. Keep full addresses accessible, not available only as shortened labels.

Copy public data only, using the complete address. Warn that other apps may read or replace clipboard contents. Never read the clipboard automatically. Validate explicit paste/scan against the chosen chain, review QR destination and amount, and reject unsupported payloads. Require comparison of the **full address** with a trusted recipient source. Scanning never authorises payment or silently changes networks.

Block screenshots and recording on sensitive screens where supported, especially import, backup and authorisation. Hide app-switcher previews. Clear sensitive UI state on backgrounding or lock.

### 5.4 Typed errors and safe diagnostics

Define module-specific types, for example `UiValidationError`, `AuthError`, `CoreKeyError`, `CoreDerivationError`, `CoreSigningError`, `RpcError`, `IndexerError`, `RecordStoreError` and `MetadataError`. Carry a stable code, stage, retryability and safe, localised recovery text—not raw exceptions. Missing metadata must never lead to guessed decimals or contract meaning.

Authentication cancellation returns to review. A timeout after broadcast means “status unknown”, not “failed”: reconcile by transaction hash before rebroadcasting identical bytes. Never automatically re-sign. Record-write failures must remain visible without misreporting network status.

Centralise sanitisation before errors cross module boundaries and before every UI, log or crash-report sink, including nested causes, breadcrumbs and SDK diagnostics. Apply the [`derive.js`](../../tools/hdwallet-gen/derive.js) rule: replace each entire extended-key-like string whose prefix is `xprv`, `xpub`, `yprv`, `ypub`, `zprv`, `zpub`, `Yprv`, `Ypub`, `Zprv`, `Zpub`, `tprv`, `tpub`, `uprv`, `upub`, `vprv` or `vpub`, followed by Base58 characters, with `[REDACTED]`. Also replace every run of **100+ Base58 characters** with `[REDACTED]`.

This rule cannot recognise mnemonic phrases or all shorter secrets. Prevent collection: no secret material in analytics, no input/state snapshots or memory dumps, and allowlisted diagnostic fields only. Follow the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Disable SDK collection paths that cannot honour these controls.

Use synthetic/public fixtures to test every redaction prefix, the 99/100-character boundary, nested failures, cancellation, stale fees, duplicate taps and ambiguous broadcasts. [`test/differential_test.py`](../../test/differential_test.py) independently verifies BTC BIP84 and ETH BIP44 address derivation with [bip_utils](https://github.com/ebellocchia/bip_utils); it does not verify UI safety or transaction delivery.

## 6. Testing, release security and build checklist

### 6.1 Testing strategy

Keep offline tests separate from disposable local-node and testnet runs. Never use customer wallet material.

- **Unit tests by module.** Use published vectors only for cryptographic assertions, with mocks for failure paths. Test key generation/validation, randomness failure and handle cleanup; derivation paths, networks and index bounds; storage authentication, tampering, wrong credentials and atomic migrations; signing serialisation, signature verification, chain IDs, fees and amounts. Public-import interfaces must reject private material.

- **Differential tests.** Pin Wallet Core to `4.8.4`, as Bawa does. `compare.js` reads `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX` from the root `.env`, or the path selected by `NOVA_ENV`, and prints only public addresses at indices `0`, `1`, `2`. This checks public derivation, not custody or signing. Compare Wallet Core against independently pinned `bip_utils` on the same vectors. Bawa’s `test/differential_test.py` independently checks the published BTC/ETH index-zero results and prints `PASS`:
  - BTC `m/84'/0'/0'/0/0`: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - ETH `m/44'/60'/0'/0/0`: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`

  Assert exact equality in CI; extend independent coverage to TRX and indices 1 and 2. These addresses are fixtures, not payment destinations; the BTC vector is mainnet-formatted.

- **Integration tests.** Exercise balance, UTXO/nonce handling, fees, signing, broadcasting and receipts against a local node or explicitly selected testnet. Include reorgs and duplicate requests. Verify chain identity before signing; a timeout must not create a second payment.

- **UI tests.** Match the confirmation’s network, asset, destination, amount and fees to the transaction actually signed. Cancellation must prevent signing. Exercise backup verification and restore with test-only inputs; exclude sensitive screens from snapshots.

- **Negative tests.** Reject private keys at xpub imports, corrupt bundles, invalid indices, hardened children below an account xpub, malformed addresses and unsupported networks. Simulate timeouts, stale responses and dropped broadcasts. Fail closed without losing the vault, switching networks or silently re-signing.

### 6.2 Release and update security

Use **OWASP MASVS L1 as the floor**, with **L2/R** coverage for apps storing sensitive data ([Cryptomathic](https://www.cryptomathic.com/blog/resources-to-assist-in-developing-and-testing-the-security-of-your-eudi-wallet-app)). Maintain a threat model and commission an external penetration test ([AMELA](https://amela.tech/the-ultimate-guide-to-crypto-wallet-development-for-enterprises/)); automate dependency and secret scanning ([fasthedeveloper on DEV Community](https://dev.to/fasthedeveloper/owasp-mobile-top-10-for-react-native-fintech-apps-a-practical-implementation-checklist-3hle)).

- **Pin and audit.** Lock Wallet Core `4.8.4`, dependencies, toolchains and native/WASM artefacts. Audit transitive dependencies, review upgrades and rerun vectors. Pinning is not a reason to retain a vulnerable version.

- **Build and update trust.** Require signed, reproducible builds. Compare unsigned artefacts from an independent clean rebuild, then verify the release signature. Protect release-signing credentials outside the repository and app binary. Verify signatures on update metadata and packages, reject unauthorised downgrades and use trusted distribution channels over TLS. TLS alone does not authenticate an artefact; any downloaded JavaScript/WASM must follow the same policy.

- **Staged rollout.** Release to small cohorts first, monitor redacted crash and migration failures, and rehearse signed recovery compatible with vault formats. Pause a failing rollout. Never collect keys, recovery phrases or vault contents.

- **Block release** on failing tests or MASVS controls, missing threat-model or penetration-test sign-off, unresolved critical/high findings, unresolved secret-scan alerts, secrets in the repository or binary, unsigned or non-reproducible builds, unsafe updates or migration failures.

### 6.3 Build-from-scratch checklist

1. **Set up.** Create the project shell, CI, lockfiles and initial threat model. Enforce testnet-only configuration. Commit placeholder settings such as `<XPUB>`, never local `.env` files or vaults.
2. **Key module.** Separate public-only imports from local testnet key creation. Use platform randomness and minimise secret lifetime; keep secrets outside comparison tooling.
3. **Derivation module.** Define chain, network and account paths; enforce index bounds. Separate offline vector fixtures from testnet address generation.
4. **Storage module.** Build an authenticated encrypted vault with platform-protected keys, atomic writes, explicit recovery and versioned migrations.
5. **Network module.** Add validated node clients, explicit chain checks, bounded retries and transaction-status tracking. Treat responses as untrusted; nodes never receive secrets.
6. **Signing module.** Validate transaction intent independently, check the chosen chain and fee bounds, require authorisation and sign locally.
7. **UI module.** Implement receive, backup/restore and confirmation flows. Show testnet status, destination, amount and total fees clearly.
8. **Tests.** Run unit, differential, integration, UI and negative suites in CI. Keep sensitive data out of logs, traces and snapshots.
9. **Review.** Refresh the threat model and complete audits, external penetration testing and release/update checks. The result is a testnet app; it must never hold real funds on mainnet without an independent security review. That review is a gate, not an optional extra.
