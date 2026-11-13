# Watch-only derivation

> **STATUS (verified 2026-11-08):** `derive.js`, `derive_daemon.js` and `compare.js` **pass `node --check` at `e3b65fb832db287fdc8d54794980dd0b3456cc12`**, so the commands in this document run at the pin. At the former pin `082f7915` they failed `node --check` and could not run. See the README §1 status warning. The interfaces below describe their behaviour.

## 1. What watch-only derivation is

Your server creates receiving addresses without becoming a spending wallet. It holds only public material and cannot sign. Treat xpubs and zpubs as **sensitive public material**.

## 2. BIP-32, hardened derivation and watch-only design

BIP-32 has two families of child indices:

- Normal/non-hardened: `0..2^31-1`.
- Hardened: `2^31..2^32-1`.

The hardened boundary is crucial for watch-only design. In the policy example `m/44'/60'/0'/0/i`, the first three levels are hardened; the final two are non-hardened. Export the account public node at `m/44'/60'/0'`, then derive `/0/0`, `/0/1`, `/0/2`… from the public side.

Never give the runtime an xprv “just because deriving the address was inconvenient” — that destroys the boundary.

The export sits after the last hardened step. With only that public node, your runtime can derive receiving addresses but cannot move sideways into another hardened account or recover a private key. Exporting a root or master public node instead exposes every account reachable from it through non-hardened derivation; it does not make hardened accounts publicly derivable. Exporting a private key destroys the watch-only boundary entirely.

## 3. Running the tools

The tools live in `tools/hdwallet-gen`. Run the commands below from the repository root.

**One-shot interface**

This placeholder command illustrates the stdin interface. `XPUB_ETH` represents your ETH account xpub; the command does not supply an example key.

```sh
echo "$XPUB_ETH" | node tools/hdwallet-gen/derive.js eth 5
```

> **Expected result**
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, the script runs and derives the address (exit status `0`); at the former pin `082f7915` it could not run because `derive.js` failed `node --check`.
>
> Intended success with a valid account xpub: exit status `0`, with the bare ETH address for index `5` on stdout and no JSON wrapper.

The intended flow is:

xpub from stdin → validate chain → validate index → reject private extended-key versions → derive the approved path → return the address.

You deliberately supply the xpub through stdin, not argv. Arguments can appear in process listings and diagnostic interfaces; stdin is a cleaner boundary.

In operation, stream the xpub from protected storage into stdin. Do not construct a shell command containing it: shell history can retain a here-document’s contents. The `echo` example illustrates the interface, not a storage or retrieval procedure.

The intended exit statuses are:

| Status | Meaning |
| --- | --- |
| `2` | Usage or read error |
| `1` | Derivation or validation failure |
| `0` | Success: bare address on stdout, without JSON |

For stdin, the 200-character limit counts all characters read, including any trailing newline. Accumulated input exceeding that total is rejected while reading, before derivation.

Testnet-format extended public keys (`vpub`/`tpub`) are not supported by this workflow. A valid-checksum `vpub` can cause `derive.js` to abort with exit 1 and no address, emitting only an opaque WASM-abort message. See the testnet-format key limitation in docs/11.

The approved receiving paths are:

| Chain | Path |
| --- | --- |
| `btc` | `m/84'/0'/0'/0/${i}` |
| `eth` | `m/44'/60'/0'/0/${i}` |
| `trx` | `m/44'/195'/0'/0/${i}` |

**Daemon interface**

```sh
node tools/hdwallet-gen/derive_daemon.js
```

> **Expected result**
>
> At `e3b65fb832db287fdc8d54794980dd0b3456cc12`, the daemon starts and prints the readiness message (verified 2026-11-08); at the former pin `082f7915` it could not start because `derive_daemon.js` failed `node --check`.
>
> Intended startup sequence: `initWasm()` completes → the readline input interface for stdin is created → the daemon prints:
>
> ```json
> {"ready": true}
> ```
>
> This is a readiness marker, not an address response. It is printed only after WASM initialisation and creation of the stdin interface.

Wait for the readiness marker before sending JSONL requests: one JSON object per line. This illustrative request uses `<ETH_XPUB>` as a placeholder for your ETH account xpub:

```json
{"chain":"eth","xpub":"<ETH_XPUB>","index":5}
```

> **Expected result — intended interface only**
>
> With a valid account xpub in place of `<ETH_XPUB>`, the successful response has this form:
>
> ```json
> {"ok":true,"address":"<DERIVED_ADDRESS>"}
> ```
>
> `<DERIVED_ADDRESS>` is a placeholder, not an example address.

Responses contain no request ID. Extra request fields are ignored; your client must not depend on an ID being echoed.

All three fields are required, with no defaults:

| Field | Validation |
| --- | --- |
| `chain` | Exactly `"btc"`, `"eth"` or `"trx"`, case-sensitive. |
| `xpub` | A string, non-empty after trimming, with an original length of at most `200` characters. Whitespace counts towards that limit but is removed before private-key detection and derivation. |
| `index` | A JSON number that is an integer from `0` to `2147483647` inclusive. Numeric strings are rejected. |

Path selection is fixed, not caller-configurable:

| Chain | Path |
| --- | --- |
| `btc` | `m/84'/0'/0'/0/{index}` |
| `eth` | `m/44'/60'/0'/0/{index}` |
| `trx` | `m/44'/195'/0'/0/{index}` |

On the intended success path, the daemon calls `HDWallet.getPublicKeyFromExtended` with the trimmed key, selected coin and path. It then calls `CoinTypeExt.deriveAddressFromPublicKey` and validates the address with Wallet Core before returning success.

**Bitcoin `tb1q` validation/signing asymmetry**

Core’s [`registry.json`](https://github.com/trustwallet/wallet-core/blob/master/registry.json) records Bitcoin’s HRP as `bc`; [`src/Bitcoin/Entry.cpp`](https://github.com/trustwallet/wallet-core/blob/master/src/Bitcoin/Entry.cpp) implements `validateAddress` using the coin’s address-validation configuration. A `tb1q` address can be accepted by the signing path while being rejected by Bitcoin’s default address-validation path. Do not treat signing acceptance as evidence that the daemon’s validation accepts the address.

## 4. Account scope and discovery

Export after the hardened boundary. The account node is `m/purpose'/coin'/account'`; for the ETH example, export at `m/44'/60'/0'`. Your public runtime derives the remaining non-hardened levels. It does not traverse the hardened levels itself.

Do not assume every wallet or chain uses this ETH policy. Check the exporting wallet’s documentation and export details to verify the xpub’s account, chain and derivation path before trusting it. For a different policy, confirm that Bawa’s derivation code supports it.

**Receiving and change**

Receiving addresses follow `/0/i` after the account node: `/0/0`, `/0/1`, `/0/2`….

For recovery scans of external wallets, scan both receiving and change branches where they are used. Under BIP-44, `/1/i` is change where a change branch exists. See the [Trust Wallet developer documentation](https://developer.trustwallet.com/) for platform details.

Bawa’s tools derive receiving branch `0` only; they do not derive change addresses. A tracker restricted to `/0/i` misses change outputs sent to `/1/i` by a wallet using that branch.

Do not infer from this general change-scanning guidance that `/1/i` is a change path for the ETH policy. The watch-both-branches rule in `docs/09` is for **external hardware signers**. Bawa’s own policy is account `0`, receiving branch `0` only. Keep those policies separate.

**Gap limit**

Wallets stop scanning after a configured number of consecutive unused addresses. The BIP-44 gap limit is `20`; check the receiving wallet’s configured scan limit.

Deriving an address and finding it during a recovery scan are different jobs. A run of unused addresses can stop a scan before later allocated addresses. Successful address generation does not guarantee that a wallet’s recovery scan finds every generated address.
## 5. Address allocation: the part Bawa cannot solve for you

Bawa calculates an address from your account public root, branch and index. It cannot know that order #12345 maps to index 582 unless your application stores that mapping.

Store at least these fields for each allocation:

- Wallet/root identifier and account/public-node reference.
- Chain, network, path template, branch and index.
- Derived address.
- Order/customer reference, business reference and assignment/request reference.
- Status, allocation state, payment state and confirmation state.
- Created timestamp and allocation time.
- First observed block and chain-native cursor.

Never use read-max-plus-one under concurrency: two workers can race. Use a database transaction, sequence or atomic counter together with a uniqueness constraint: `UNIQUE(wallet_root, chain, branch, index)` or `UNIQUE(scope, index)`. Your scope identifies the wallet/root, chain/network, path template and branch.

Reserve the index atomically within the account/chain/branch scope before deriving the address. Never rely on separate workers independently reading and incrementing. Allocate and record the address in one transaction, and persist the derived address before returning it.

On retry, recover the saved reservation and bind the retry to its saved assignment, not a fresh allocation. Never silently recycle failed, abandoned or previously assigned indexes.

Do not reuse indexes casually. If you have shown an address to someone or associated it with an order, keep the mapping permanently unless your wallet policy explicitly defines safe reuse.

Check discovery before allocating ahead. Wallets commonly stop after 20 consecutive unused addresses—the BIP-44 gap limit. Check the receiving wallet’s configured scan limit. Recovery needs both receiving and change branches; do not assume every generated address will be discovered.

An xpub exposes the addresses and balances on its branch. Use references rather than copying the xpub into every allocation record, and never store it alongside a child private key.

## 6. Privacy: xpubs are sensitive public material

An xpub does not normally let an attacker spend, but anyone holding it can derive many receiving and change addresses below that public node. When payments are observable, this can reveal your account structure, address reuse patterns, payment history, balances and customer relationships.

Treat xpubs and zpubs as sensitive public material, not ordinary public configuration. In a multi-account application, consider whether each subsystem really needs the account-level xpub or whether a narrower public node is sufficient.

### Privacy checklist

- Export per account, or use a narrower supported branch.
- Give each subsystem only what it needs.
- Restrict access to exports and their copies as privacy-sensitive data.
- Never paste xpubs or zpubs into issue trackers, untrusted analytics dashboards, random “xpub checkers”, unreviewed browser extensions or unnecessary chat messages.
- Review logs, screenshots, backups and support attachments for accidental inclusion.
- Keep all extended keys out of telemetry and diagnostic bundles.

An account export normally exposes both receiving and change branches. Calling a service “watch-only” describes its spending permissions, not its confidentiality. Check which operators can read its saved exports, databases and backups.

### One leaked child key

A parent extended public key plus any one matching non-hardened child private key can expose the parent extended private key. This is the BIP-32 leak warning: recovery can propagate upwards along an entirely non-hardened path. A hardened edge stops upward recovery, but it does not protect ordinary receiving and change children beneath the compromised account.

Never put a child private key in the same storage as an xpub. Never send one to a watch-only system, even for testing, recovery or a temporary signing task.

### Exposure has no revocation switch

You cannot un-share an exposed xpub. Deleting an import, changing a password or issuing another address on that branch will not revoke someone else’s copy.

If an xpub is exposed:

- Create a **fresh hardened account** and restrict its export.
- Move funds with your signing wallet.
- Retire the exposed branch for receipts and change.
- Keep monitoring it for late payments, but stop issuing its addresses.

Historical activity remains visible, and migration transactions may link old funds to the new account. If a child private key leaked too, treat it as a spending-key compromise, not merely a privacy incident.
## 7. The watch-only model

Your receiving server should not need spending authority to tell someone where to pay. An xpub contains a public key plus chain code. You can use it to derive non-hardened child public keys for receiving addresses, but not to derive private keys, recover your spending wallet, recreate its seed or sign a spend. Rebuilding an address list is not restoring spending access.

Watch-only software can monitor public activity, but an xpub contains no transaction state. A balance needs a **separate chain-data source**, such as a node or indexer. Without it, the balance is unknown, not zero. The one-shot tool returns an address; it does not fetch a balance.

Export after the hardened boundary. A root xpub cannot traverse `44'/60'/0'`. The account xpub can derive `/0/0`, `/0/1` and subsequent receiving children, but cannot move sideways into another hardened account. Your export must represent a node already reached through the last required hardened step.

**Procedure 1 — check the account export**

1. Confirm the originating wallet’s chain and receiving policy. Use `m/44'/60'/0'/0/i` only where that is the intended ETH policy.
2. Obtain the **public** export for `m/44'/60'/0'`. Keep your mnemonic, seed and all private extended keys outside the receiving service.
3. Record the chain, account origin and permitted `/0/i` suffix alongside your service configuration. An xpub does not encode its complete ancestry or uniquely identify the application chain; its prefix is not proof of either.

**Procedure 2 — run one derivation**

Pass the xpub on stdin, **never in argv**. Validate before generating an address:

Read the account xpub → check the chain → check the index → refuse private versions → apply the approved receiving path → return the chain-specific address.

For `/0/i`, supply a whole-number index in the non-hardened range. Chain validation selects an approved policy; it does not prove that the export came from the intended wallet. Reject private input rather than quietly converting it. The caller supplies an index, not an arbitrary path.

For example, select `eth` and index `5`, giving the relative receiving path `/0/5`. Use a here-document:

```sh
node tools/hdwallet-gen/derive.js eth 5 <<'XPUB_INPUT'
<XPUB>
XPUB_INPUT
```

Compare the returned address with the originating wallet’s address at `m/44'/60'/0'/0/5`. If validation fails or the addresses disagree, stop and check the policy and export. Do not retry with private material.

This checks receiving-path agreement for index `5`. It establishes neither a balance nor spending authority.

## 8. Extended-key formats and privacy

For Bitcoin mainnet, single-signature accounts:

| Public format | Encoding and address policy | Address prefix | Public version |
| --- | --- | --- | --- |
| `xpub` | BIP-32 encoding; BIP-44 legacy P2PKH | `1` | `0x0488b21e` |
| `ypub` | BIP-49 wrapped SegWit P2SH-P2WPKH | `3` | `0x049d7cb2` |
| `zpub` | BIP-84 native SegWit P2WPKH | `bc1q` | `0x04b24746` |

An `xpub` is BIP-32’s general public-key serialisation, not proof of legacy addresses. BIP-86 Taproot accounts also use `xpub`, but produce P2TR addresses beginning `bc1p`. Wallets with explicit script policies may use `xpub` for SegWit too.

Match **both the exported format and your wallet’s address policy**. A wrong script wrapper or derivation path can still generate valid, checksummed addresses — simply not the addresses your signing wallet expects. Changing version bytes only re-encodes the same node; it does not move that node onto another derivation path.

Before using the import, compare receiving addresses at several identical indices in both wallets. Compare change addresses where supported. Match complete addresses, not merely familiar initial characters. Stop if they differ.

Treat extended public keys as **sensitive public material**. Export the least you need. For an account export, use `m/<purpose>'/<coin_type>'/<account>'`, after the hardened boundary. Record the chain, network, account, full origin path and script policy from the signer’s export details; the prefix cannot establish these.

Your invoice service may need only a receiving-branch key where the wallet supports it. That export cannot monitor change, so do not label its total as the whole account balance.

## 9. Gap limits, branches and address-mismatch diagnosis

Keep three jobs separate: calculating an address, assigning it to a payment and finding its history during a scan.

Receiving and change need separate coverage. The BIP-44 path is `m/44'/<COIN_TYPE>'/<ACCOUNT>'/<BRANCH>/<INDEX>`. The `/0/i` branch is external receiving; `/1/i` is internal change where your wallet uses change. Each branch has its own zero-based indices.

The BIP-44 gap limit is **20 consecutive unused addresses**. Start at index `0`, derive successive addresses and examine their transaction history. An unused address increments the counter; a used address resets it. Stop on the twentieth consecutive unused address.

“Unused” means no transaction history, not zero current balance. A used address remains used after its balance returns to zero.

**Worked example A**

- `i=0` is used.
- `i=1..20` are unused. The consecutive unused run reaches `20` at `i=20`, so the scan stops.
- `i=21` is used but is not scanned.

The payment at `i=21` exists, but ordinary discovery never reaches it. A tracker explicitly watching that address can still see it.

**Worked example B**

- `i=0` is used.
- `i=1..19` are unused: the run reaches `19`.
- `i=20` is used: the counter resets to `0`.
- `i=21` is unused: the run is `1`.
- `i=22` is used: the counter resets.

By index `21`, the scan has seen `20` unused addresses in total, but only one consecutively. It therefore reaches used index `22`. The rule is not “inspect only 20 addresses”.

Address derivation has no usage-history requirement. You can use an account xpub to produce a later-index child without scanning earlier ones. Recovery is different: its stopping rule may prevent that index from being examined. Successful generation is not proof of recoverability under default settings.

Treat allocation records as recovery metadata, not evidence of use. Showing an address to a customer does not reset the scan counter. Monitor unused runs and retain the issued range so a range-capable recovery tool can scan it. BIP-44 also calls for you to warn users before address generation exceeds the receiving-chain gap limit.
## 10. Daemon JSONL

Start the daemon:

```sh
node tools/hdwallet-gen/derive_daemon.js
```

Wait for `{"ready": true}` before sending requests. Send one JSON request per line:

```json
{"chain":"btc","xpub":"<xpub>","index":5}
```

A successful response has this format:

```json
{"ok":true,"address":"<address>"}
```

Keep your requests within these limits:

- `chain`: exactly `btc`, `eth` or `trx`.
- `xpub`: at most 200 characters.
- `index`: `0` to `2147483647`, inclusive.

### Private-key rejection

The daemon trims your `xpub`, Base58-decodes it and separates the final four decoded bytes as the checksum. It hashes the preceding payload twice with SHA-256. The checksum bytes must equal the first four bytes of the second hash before a listed private version triggers rejection.

The eight recognised private version prefixes—the first four decoded bytes, in hex—are:

- `0488ade4`
- `049d7878`
- `04b2430c`
- `0295b005`
- `02aa7a99`
- `04358394`
- `044a4e28`
- `045f18bc`

With a matching checksum, a listed version gives you:

```json
{"ok":false,"error":"extended public key required"}
```

This is neither a prefix-only check nor a complete public-key format check. Do not assume that passing it means you have a usable extended public key. A checksum mismatch returns `false` from this test; it does not approve the value as a public key.

### Error redaction

Redaction applies only to per-request errors, not the fatal `stderr` path. The daemon replaces either of these matches with `[REDACTED]`:

- Any of `xprv`/`xpub`, `yprv`/`ypub`, `zprv`/`zpub`, `Yprv`/`Ypub`, `Zprv`/`Zpub`, `tprv`/`tpub`, `uprv`/`upub` or `vprv`/`vpub`, followed by one or more Base58 characters.
- Any run of at least 100 Base58 characters.

The prefixes are case-sensitive. Redaction does not verify checksums. Do not treat it as a general secret filter: public extended keys are sensitive public material and can be redacted too, while other kinds of secret may remain visible.

### Bad input and line handling

Keep each input line to at most 4096 characters, measured as JavaScript string length: UTF-16 code units, not bytes.

The length check runs after `readline` delivers the completed line, **before** whitespace handling or JSON parsing. It is not a streaming input-buffer limit.

If you send an empty or whitespace-only line of at most 4096 characters, the daemon ignores it without a response. Any longer line returns the following, even if it contains only whitespace:

```json
{"ok":false,"error":"request too large"}
```

### EOF and SIGTERM

When `readline` closes, the daemon sets `process.exitCode` to `0` and sends no shutdown JSON record. `SIGTERM` sets the same exit code and calls `rl.close()` without forcing an immediate exit.

If startup fails, the daemon writes `FATAL: <message>` to `stderr` and exits with status `1`. That message is neither JSON nor redacted. Do not assume that collecting `stderr` gives you the same protection as collecting per-request errors.

The daemon does not look up balances, sign, allocate addresses or indices, access the network or derive a change branch. A returned address does not mean your index has been reserved.
## 11. Daemon error handling and boundaries

You receive an error response for a per-line error, and the daemon continues with the next line.

| Error | Cause |
| --- | --- |
| `bad json` | JSON parsing fails. |
| `bad request` | Required fields are missing or invalid. |
| `extended public key required` | A recognised private-key version passes the checksum check. |
| `getPublicKeyFromExtended failed: <message>` | The `getPublicKeyFromExtended` call fails. |
| `deriveAddressFromPublicKey failed: <message>` | The `deriveAddressFromPublicKey` call fails. |
| `derived address failed validation` | No address is returned, or validation returns `false`. |
| `internal error: <message>` | Another exception occurs in the line handler. |

A validation exception reaches the outer handler. Do not confuse that with validation returning a falsy result.

**Worked JSONL session**

Start the daemon:

```sh
node tools/hdwallet-gen/derive_daemon.js
```

The values below are placeholders, and `→` marks a response. The private-key case is illustrative: keep live private material out of watch-only input.

```text
{"chain":"<CHAIN>","xpub":"<XPUB>","index":0}
→ {"ok":true,"address":"<ADDRESS>"}

{"chain":"<CHAIN>","xpub":"<XPUB>","index":2147483648}
→ {"ok":false,"error":"bad request"}

{"chain":
→ {"ok":false,"error":"bad json"}

{"chain":"<CHAIN>","xpub":"<XPRV>","index":0}
→ {"ok":false,"error":"extended public key required"}
```

Close stdin or send `SIGTERM` to stop the daemon with exit status `0`.

This is a public-only derivation service. It holds no balances, signs nothing and allocates no indexes.

## 12. Service operation, one-shot derivation and comparison

Keep allocation state with your calling application, not the worker process. The daemon is replaceable; the record linking a request to its chain, xpub and index is not.

**One-shot comparison**

Run `compare.js` from the repository root:

```sh
node tools/hdwallet-gen/compare.js
```

It reads the repository-root `.env`, or the file named by `BAWA_ENV_FILE`. `NOVA_ENV` is a deprecated alias for the same selection. Ensure the selected env file exists before running `compare.js`. If the selected file does not exist, the script exits 1 with a `FATAL` message and no stack trace. This is separate from the documented missing-chain-xpub error.

`tools/make_wallet.py` writes public configuration to `BAWA_ENV_FILE`, defaulting to `<repo>/.env`. `compare.js` selects its input through the same `BAWA_ENV_FILE`, also defaulting to `<repo>/.env`. If generation used a custom `BAWA_ENV_FILE`, `compare.js` reads that same file. `NOVA_ENV` remains as a deprecated alias for the selection. The launcher's other path overrides are `BAWA_SECRETS_DIR` (default `<repo>/secrets`) and `BAWA_BACKUP_DIR` (default `<repo>/seed-backup`). The launcher refuses a symlinked secrets directory, `.env` file or backup directory.

The script takes `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX` and prints the first three receiving addresses per chain, at indexes `0`, `1` and `2`. Output is public-only: a chain label plus three addresses, not xpubs or private material.

A missing chain xpub throws, and the top-level handler exits with status `1`. Check the exit status even when the output looks plausible: earlier chains may already have printed before a later chain fails. Use this for a spot-check, not as an allocation mechanism.

`compare.js` does not perform the private-extended-key rejection used by `derive.js` and `derive_daemon.js`. Supply public extended keys only in the chain xpub settings. An `xprv` can be accepted and produce addresses successfully, so successful output does not prove that the input is public.

**Reader pattern — not a Bawa file**

Supervise the calling application that owns the pipes. Do not send the daemon's stdout directly to the journal.

Use an unprivileged user and fill in the placeholders for your installation. The unit below runs the CALLER (the pipe-owning wrapper), never the daemon directly — `StandardInput`/`StandardOutput` here belong to the wrapper. The daemon's stdin/stdout are the JSONL pipes the wrapper creates and owns; the daemon must never inherit the unit's standard streams. Do NOT put `node tools/hdwallet-gen/derive_daemon.js` as `ExecStart` itself: with `StandardInput=null` it sees stdin EOF at once and exits 0 (not a failure, so `Restart=on-failure` does not act), and its JSONL replies would go to the journal instead of the caller.

```ini
[Service]
Type=simple
User=<unprivileged-user>
WorkingDirectory=<repository-root>
ExecStart=<env-binary> -i PATH=<minimal-path> <pipe-owning-caller> -- node tools/hdwallet-gen/derive_daemon.js
Restart=on-failure
RestartSec=<restart-delay>
NoNewPrivileges=yes
PrivateTmp=yes
PrivateUsers=yes
ProtectSystem=strict
ProtectHome=yes
StandardInput=null
StandardOutput=journal
StandardError=journal
```

Your caller must:

- Launch the command after `--`.
- Create and own the child's stdin/stdout JSONL pipes.
- Capture and drain the child's stderr.
- Emit only redacted diagnostics.

The daemon must not inherit the unit's standard streams. `env -i` clears the launch environment apart from the explicit `PATH`. Keep the caller and child seed-free; do not import `.env` into the unit.

If the child exits unexpectedly or a pipe breaks, your caller must stop accepting derivation work and exit non-zero so that `Restart=on-failure` can act. A launcher that stays alive beside a dead worker defeats this policy.

**Supervision-pitfalls checklist**

- [ ] Do not add an unauthenticated network bridge. The daemon accepts any xpub and returns addresses for it; this is neither authentication nor proof of ownership. This pattern uses pipes, not a network socket.
- [ ] Keep xpubs and zpubs out of unit files and command-line arguments. They are sensitive public material; deliver them through the caller-owned input pipe.
- [ ] Keep raw JSONL out of logs. Redact errors as well as routine diagnostics; systemd does not redact for you.
- [ ] Treat a crash as a derivation outage, not data loss. You can re-derive addresses from the same chain/xpub/index, but allocation records still need durable storage and backups.

**Caller-side retry and recovery**

1. Before dispatch, durably save an allocation record binding the request identifier to the chain, immutable xpub reference and index. Retain access to that exact xpub if you later rotate your application's configuration.
2. Bind every retry to this saved record. A timeout or lost reply must not allocate another index.
3. Once derivation succeeds, persist the address against the record **before** returning it. If persistence fails, do not report success.
4. For repeat requests, return the saved address or resume that same derivation.
5. Record failures and abandonment explicitly. Never silently recycle a failed or abandoned index: a missing reply does not establish that the corresponding address was never used.

## 13. Validation fixtures

**Published positive fixtures**

Use this BIP-84 account-0 zpub for the `abandon` mnemonic as a positive fixture. It is published in SLIP-0132.

```text
zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs
```

Check the corresponding addresses:

| Fixture | Derivation path | Address |
| --- | --- | --- |
| Second receiving address | `m/84'/0'/0'/0/1` | `bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g` |
| First change address | `m/84'/0'/0'/1/0` | `bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el` |

**Published negative fixtures**

Use these published test vectors for rejection tests, never for funds.

- **BIP-84 account-0 zprv** — the private counterpart of the zpub above, published in [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md). Defect: private key where a public key is required.

  ```text
  zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE
  ```

- **BIP-32 test vector 1 root xprv** — published in [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), from seed `000102030405060708090a0b0c0d0e0f`. Defect: private key where a public key is required.

  ```text
  xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi
  ```

- **BIP-32 test vector 5 invalid-checksum key** — published in [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Defect: bad checksum.

  ```text
  xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL
  ```

- **BIP-32 test vector 5 version-mismatch key** — published in [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki). Defect: wrong version prefix.

  ```text
  xpub661MyMwAqRbcEYS8w7XLSVeEsBXy79zSzH1J8vCdxAZningWLdN3zgtU6LBpB85b3D2yc8sfvZU521AAwdZafEz7mnzBBsz4wKY5fTtTQBm
  ```

## 14. Sources

- [BitBox extended-public-key page](https://support.bitbox.swiss/en_US/extended-public-key-bitboxapp)
- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)
- [Trust Wallet Core HDWallet API](https://github.com/trustwallet/wallet-core/blob/master/src/HDWallet.h)
