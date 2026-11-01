# Watch-Only Derivation

Use this when a server needs to create receiving addresses without becoming a spending wallet.

# BIP-32, hardened derivation and watch-only wallets

BIP-32 divides derivation into two important families.

```text
normal / non-hardened
0 .. 2^31-1

hardened
2^31 .. 2^32-1
```

The hardened boundary is crucial for watch-only design.

Suppose the wallet policy is:

```text
m/44'/60'/0'/0/i
```

The first three levels are hardened and the final levels are non-hardened.

The application can export the account public node corresponding to:

```text
m/44'/60'/0'
```

and later derive:

```text
/0/0
/0/1
/0/2
...
```

from the public side.

That is why account-level xpubs work so well for deposit-address generation.

The runtime should not be given an xprv “just because deriving the address was inconvenient”. That destroys the boundary you were trying to create.

---

# Running the watch-only derivation tools

## One-shot mode

Suppose you already have a public extended key in an environment variable.

```bash
echo "$XPUB_ETH" | node tools/hdwallet-gen/derive.js eth 5
```

The important part is not the exact shell syntax; it is the architecture:

```text
xpub from stdin
     ↓
validate chain
     ↓
validate index
     ↓
reject private extended-key versions
     ↓
derive approved path
     ↓
return address
```

## Daemon mode

Start:

```bash
node tools/hdwallet-gen/derive_daemon.js
```

Wait for:

```json
{"ready":true}
```

Then send lines such as:

```json
{"chain":"eth","xpub":"<ETH_XPUB>","index":5}
```

and expect:

```json
{"ok":true,"address":"<DERIVED_ADDRESS>"}
```

The exact public key and address values should come from your own wallet and never be copied from this README.

### Why stdin instead of argv?

Arguments can show up in process listings and diagnostic interfaces. Feeding the xpub over stdin is a cleaner boundary and costs almost nothing.

---

# Address allocation: the part Bawa cannot solve for you

This is an application problem, not an HD-derivation problem.

Bawa can calculate:

```text
account public root + branch + index
                    ↓
                 address
```

It cannot know:

```text
order #12345 → index 582
```

unless your application stores that mapping.

A proper payment database should at least retain:

```text
wallet/root identifier
chain
network
path template
branch
index
address
order/customer reference
status
created timestamp
first observed block
confirmation state
```

### Never do this under concurrency

```text
read max(index)
add 1
save
```

Two workers can race.

Instead use a database transaction/sequence/atomic counter and a uniqueness constraint such as:

```text
UNIQUE(wallet_root, chain, branch, index)
```

Then allocate and record the address in one transaction.

### Do not reuse indexes casually

If an address was shown to someone or associated with an order, keep the mapping permanently unless your wallet policy explicitly defines safe reuse.

The cost of another HD address is tiny. The cost of ambiguous payment history is not.

---

# Privacy: xpubs are not spending keys, but they are sensitive

An xpub does not normally let an attacker spend from the wallet.

It may still allow them to derive many receiving/change addresses below that public node.

For a merchant or personal wallet this can reveal:

- account structure;
- address reuse patterns;
- payment history;
- balances;
- customer relationships when payments are observable.

Treat xpubs as **watch-only secrets** rather than as ordinary public configuration.

Do not paste them into:

- public issue trackers;
- analytics dashboards you do not trust;
- random “xpub checkers”;
- browser extensions you have not reviewed;
- chat messages that are not necessary.

For a multi-account application, consider whether each subsystem really needs the account-level xpub or whether a narrower public node is sufficient.

---

## Minimum database record

wallet/root identifier, chain, network, path template, branch/role, index, address, allocation time, business reference, payment state and chain-native cursor.

## Allocation rule

Use a transactional sequence/atomic counter and a uniqueness constraint. Never allocate an index by reading the current maximum in application code when multiple workers can run concurrently.

---

## 05 Watch-only — account scope and discovery

### Export after the hardened boundary

Under BIP44, the account node is `m/purpose'/coin'/account'`. Export the account xpub at this node, after the hardened boundary. In Bawa’s **example ETH policy**, the export point is `m/44'/60'/0'`. The public runtime derives the remaining non-hardened levels; it does not traverse the hardened levels itself.

```text
m
└─ 44'                    hardened
   └─ 60'                 hardened
      └─ 0'               hardened · export account xpub here
         └─ 0             non-hardened · receiving branch here
            ├─ 0          non-hardened
            ├─ 1          non-hardened
            └─ 2 …
```

```text
account xpub via stdin
          ↓
validate chain and index
          ↓
reject private extended-key versions
          ↓
derive approved path
          ↓
return address
```

A difficult derivation is **not** a reason to give the runtime an xprv.

Do not assume that every wallet or chain uses this ETH policy. Bawa does not document an origin-verification procedure, wallet export instructions or support details for other policies. Check the exporting wallet’s documentation and export details to verify the xpub’s account, chain and derivation path before trusting it for derivation. For a different policy, confirm that Bawa’s derivation code supports it.

### Receiving, change and gap limits

| Item | Supported scope and remaining gaps |
|---|---|
| Receiving | In this ETH example, `/0/i` follows the account node: `/0/0`, `/0/1`, `/0/2`, and so on. |
| Change | Follow Bawa’s web guidance: scan **receiving and change** branches where they are used. Under BIP44, `/1/i` is used for change where a change branch exists. Bawa does not document whether this ETH policy uses one or what its path is; check the wallet’s documented derivation policy. |
| Gap limit | Wallets stop scanning after a configured number of **consecutive unused** addresses. The BIP44 gap limit is **20**, a common stopping rule also described by Bitcoin Optech. Check the receiving wallet’s configured scan limit. Bawa does not document configuration commands or a rescan procedure; follow the receiving wallet’s documentation for those steps. |

Deriving an address and finding it during a recovery scan are different jobs. A run of unused addresses can stop a scan before it reaches later allocated addresses. Successful address generation does not guarantee that a wallet’s recovery scan will find every generated address.

Do not assume that the general change-scanning guidance makes `/1/i` a change path for this ETH policy.

### An xpub is still sensitive

An xpub is not a spending key, but anyone holding it can see every address and balance on the branch it exposes. Treat it as privacy-sensitive: sharing it reveals more than sharing one receiving address.

**Never store an xpub alongside a child private key.** Keep xprvs out of the public runtime altogether.

### Source-backed usage check

Precondition: `$XPUB_ETH` already contains a **test-wallet account xpub** for Bawa’s documented ETH example. No key material is included here.

Run this command from the repository root. Bawa’s documented one-shot derivation accepts `btc`, `eth` or `trx` as the chain selector and an index from `0` to `2147483647`, inclusive.

```bash
echo "$XPUB_ETH" | node tools/hdwallet-gen/derive.js eth 5
```

**You should see:** the ETH receiving address derived from that account xpub at index `5`, when the input is valid.

Bawa does not document a public test fixture, a fixed expected address or the exact output format for this example. Check the returned address against an independent implementation using the same account xpub, chain and derivation path.

This is a documented usage example, not a recorded test run or a fixed test-vector check.

---
## Daemon JSONL

`tools/hdwallet-gen/derive_daemon.js` is a persistent Trust Wallet Core address-derivation worker. It reads JSONL from stdin and writes its readiness record and per-request results to stdout.

### Startup and message formats

After Wallet Core’s WASM initialisation succeeds and the input interface is created, the daemon writes:

```json
{"ready":true}
```

This is a startup record, separate from request results.

Send one JSON object per line, with `chain`, `xpub` and `index` fields. Additional fields are ignored. Responses use these formats, with placeholders shown for returned values:

- Success: `{"ok":true,"address":"<DERIVED_ADDRESS>"}`
- Failure: `{"ok":false,"error":"<ERROR_MESSAGE>"}`

Responses contain no request ID.

### Request validation and derivation

| Field | Requirement |
|---|---|
| `chain` | Exactly `"btc"`, `"eth"` or `"trx"`; case-sensitive. |
| `xpub` | A string, non-empty after trimming, with an original length of at most `200`. |
| `index` | A JSON number whose parsed value is an integer from `0` to `2147483647`, inclusive. Numeric strings are rejected. |

All three fields are required; there are no defaults. Whitespace surrounding `xpub` counts towards its length limit, but is removed before private-key detection and derivation.

For requests that pass validation and the private-key check, the daemon calls `HDWallet.getPublicKeyFromExtended` with the trimmed key, the selected coin and the corresponding path:

| Chain | Path passed to Wallet Core |
|---|---|
| `btc` | `m/84'/0'/0'/0/{index}` |
| `eth` | `m/44'/60'/0'/0/{index}` |
| `trx` | `m/44'/195'/0'/0/{index}` |

`{index}` is replaced with the requested index. The daemon then derives an address from the returned public key and validates that address with Wallet Core before returning success.

Here is an out-of-range request and its response. `<XPUB>` is a placeholder; the index check rejects this request before key derivation:

```text
stdin: one request line
{"chain":"btc","xpub":"<XPUB>","index":2147483648}
        |
        v
daemon: request validation
        |
        v
stdout: one response line
{"ok":false,"error":"bad request"}
```

### Private-key rejection

Before calling Wallet Core, the daemon Base58-decodes the trimmed key, verifies its four-byte double-SHA-256 checksum and checks the first four decoded bytes against these private-key versions:

`0488ade4`, `049d7878`, `04b2430c`, `0295b005`, `02aa7a99`, `04358394`, `044a4e28`, `045f18bc`.

A checksum-valid value with one of those versions receives:

```json
{"ok":false,"error":"extended public key required"}
```

This is not a prefix-only check or a complete public-key format check. Other strings that pass the field checks proceed to Wallet Core; passing this detector does not establish that a value is a usable extended public key.

### Error redaction

Every per-request error string passes through a pattern-based filter. It replaces the following matches with `[REDACTED]`:

- Any of `xprv`/`xpub`, `yprv`/`ypub`, `zprv`/`zpub`, `Yprv`/`Ypub`, `Zprv`/`Zpub`, `tprv`/`tpub`, `uprv`/`upub` or `vprv`/`vpub`, followed by one or more Base58 characters.
- Any run of at least `100` Base58 characters.

Redaction does not verify checksums and is not a general secret filter. It applies to per-request error messages, not the fatal stderr path described below.

### Bad input and line handling

The maximum input-line length is `4096`. Both this limit and the `xpub` limit use JavaScript string length—UTF-16 code units, not bytes.

The line-length check runs **before** whitespace handling or JSON parsing:

- Empty or whitespace-only lines of at most `4096` are ignored, with no response.
- Longer lines receive `{"ok":false,"error":"request too large"}`, even if they contain only whitespace.
- The size check happens after `readline` delivers the completed line; it is not a streaming input-buffer limit.

Other failures return the following error values. `<message>` represents exception text, subject to redaction.

| Failure | Error |
|---|---|
| JSON parsing fails | `bad json` |
| Required fields are missing or invalid | `bad request` |
| A recognised private-key version passes the checksum check | `extended public key required` |
| Public-key derivation throws | `getPublicKeyFromExtended failed: <message>` |
| Address derivation throws | `deriveAddressFromPublicKey failed: <message>` |
| No address is returned, or address validation returns false | `derived address failed validation` |
| Another exception occurs in the line handler | `internal error: <message>` |

These are per-line failures: the daemon returns an error response and continues accepting later input.

### EOF and SIGTERM

On stdin EOF, the `readline` interface closes and its close handler sets `process.exitCode = 0`.

On `SIGTERM`, the daemon sets the same exit code and calls `rl.close()`. Neither handler writes a shutdown JSON record or forces an immediate exit with `process.exit(0)`.

Failures caught by the async startup handler instead write `FATAL: <message>` to stderr and call `process.exit(1)`. That fatal output is neither JSON nor redacted.

### Keep the public-only boundary

This **ETH policy example** shows a public-only layout, not confirmed daemon support:

```text
wallet-side hardened account
m/44'/60'/0'
└── export account xpub
    ↓
    watch-only server
    ├── /0/0
    ├── /0/1
    └── /0/2
```

Keep xprvs out of the server runtime. Do not assume that every xpub will work. Bawa does not document the accepted chains, key versions or daemon-approved paths; confirm these with the maintainers before using this layout.

## Address allocation: application policy, not daemon behaviour

Bawa does not document allocator code or database details. This **proposed application checklist** sets out application design requirements, not claims about Bawa’s implementation. Use your schema, policies and test results to check each requirement.

### Minimum database record — proposed

Record an account/public-node reference, chain/network, branch, index, assignment/request reference, allocation state and derived address. Bawa does not specify a database schema, so design one in your application to hold these fields.

```text
durable index reservation
          ↓
public derivation through a verified interface
          ↓
persist address and assignment
          ↓
return the recorded address
```

### 3. Reserve before deriving

Reserve the index atomically within the chosen account/chain/branch scope, with a uniqueness guard on scope plus index so two workers cannot claim the same index. Never rely on separate workers independently reading and incrementing a counter.

**You should see:** schema constraints and concurrency tests demonstrating exclusive reservations. Bawa does not document these; add them to your application and test concurrent allocations.

### 4. Make retries recover the reservation

Bind each retry to its saved assignment rather than allocating afresh. Persist the derived address before returning it. Never silently recycle failed, abandoned or previously assigned indexes.

**You should see:** a documented retry/recovery policy and tests covering interrupted allocations. Bawa does not document this behaviour; define the policy and test recovery in your application.

### 5. Check wallet discovery before allocating ahead

Wallets commonly stop scanning after **20 consecutive unused addresses**, the discovery limit defined by BIP44. Check the receiving wallet’s configured scan limit rather than assuming it uses 20. Recovery needs to cover both receiving and change branches.

**You should see:** the receiving wallet’s configured scan limit and recovery evidence covering both branches. Bawa does not document these wallet-specific details; check the wallet’s documentation and test recovery. Do not assume every generated address will be discovered.

### Privacy boundary

An xpub exposes the addresses and balances on its branch. Never store it alongside a child private key. Use references rather than copying the xpub into every allocation record. Apply these storage rules in your application; Bawa does not specify a database schema.

# D-04A — The watch-only model

## Keep receiving separate from spending

A receiving server should not need spending authority just to tell someone where to pay. A watch-only setup gives it public derivation material while the seed and private keys stay elsewhere.

An extended public key, or xpub, contains a public key and a chain code. It can derive non-hardened child public keys, from which an application constructs receiving addresses. It cannot derive private keys ([BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)). It cannot recover the spending wallet, recreate its seed or sign a spend. Rebuilding an address list is not restoring spending access.

Watch-only software can also monitor public activity ([background overview](https://btc-pulse.com/learn/watch-only-wallet/)), but an xpub contains no transaction state. A balance requires a **separate chain-data source**, such as a node or indexer. Without that source, the balance is unknown, not zero. The one-shot tool described below returns an address; it does not fetch a balance.

Treat the xpub as privacy-sensitive. Someone who obtains it can reproduce its non-hardened address subtree and link activity, even though they cannot spend from it.

## Why the export belongs after the hardened boundary

BIP-32 divides child indices into two ranges:

```text
Non-hardened child indices
0 through 2^31 - 1

Hardened child indices
2^31 through 2^32 - 1
```

Non-hardened derivation is also called normal derivation. A child public key can be calculated using the parent’s extended public key. Hardened derivation requires parent private-key material, so an xpub cannot perform that step.

An apostrophe marks a hardened child. For example, `0'` represents the hardened child encoded as index `2^31`, not ordinary index `0`.

[BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) puts purpose, coin type and account in hardened levels, followed by the non-hardened change branch and address index. For the Ethereum example policy, `m/44'/60'/0'/0/i`:

```text
m — wallet root
↓
44' — purpose, hardened
↓
60' — coin type, hardened
↓
0' — account, hardened; export <XPUB> here
↓
0 — external receiving branch, non-hardened
↓
i — address index, non-hardened
```

The export must represent a node **already reached through the last required hardened step**. The key-holding wallet performs those steps before exporting the account public node.

A root xpub cannot traverse `44'`, `60'` or `0'`. The account xpub can, however, derive `/0/0`, `/0/1` and subsequent non-hardened receiving children. It cannot move sideways into another hardened account.

Do not fix derivation trouble by giving the service an xprv. Correct the export or policy instead.

## Procedure 1 — Check the account export

1. Confirm the originating wallet’s chain and receiving policy. Use `m/44'/60'/0'/0/i` only where that is the intended Ethereum policy.
2. Obtain the **public** export corresponding to `m/44'/60'/0'`. Keep the seed and all private extended keys outside the receiving service.
3. Record the chain, account origin and permitted `/0/i` suffix alongside the service configuration. An xpub does not encode its complete ancestry or uniquely identify the application chain; its prefix is not proof of either.

**You should see:** a public-only `<XPUB>` associated with the recorded account path and receiving suffix. No seed or private extended key should appear in the service configuration.

## Procedure 2 — Run one derivation

The xpub belongs on **stdin, never in argv**. Process listings and diagnostic interfaces can expose command arguments. Only the chain selector and address index belong in this command’s argument list.

The one-shot flow keeps validation ahead of address generation:

```text
Read account <XPUB> from stdin
↓
Check the requested chain is recognised
↓
Check the requested address index
↓
Refuse private extended-key versions
↓
Apply the approved receiving path
↓
Return the chain-specific address
```

For `/0/i`, the index must be a whole number in the non-hardened range. Chain validation selects an approved policy; it does not prove that the export came from the intended wallet. Private input must be rejected, not quietly converted into public form. The caller supplies an index, not an arbitrary path.

The complete chain list, any tighter index limits, and exact one-shot output and error formats are not documented.

1. Use the account export checked above. Select `eth` and index `5` for this example; under this policy, that requests the relative receiving path `/0/5`.
2. Send the export through stdin. This here-document is a template with a placeholder:

   ```bash
   node tools/hdwallet-gen/derive.js eth 5 <<'XPUB_INPUT'
   <XPUB>
   XPUB_INPUT
   ```

   A here-document keeps the xpub out of the Node process’s arguments, but shell history can still retain its contents. For unattended operation, connect a controlled input source directly to stdin and prevent key material entering logs.
3. Compare the returned address with the originating wallet’s address at `m/44'/60'/0'/0/5`. If validation fails or the addresses disagree, stop and check the policy and export. Do not retry with private material.

**You should see:** a receiving address matching the originating wallet at that exact path. This checks receiving-path agreement for index `5`; it establishes neither a balance nor spending authority.

## D-04B — Extended-key formats and privacy

An extended public key gives a watcher derivation capability, not signing authority. Treat import correctness and privacy as separate checks: a wallet can accept a key successfully while watching the wrong addresses.

### Match the format and address policy

These are **Bitcoin mainnet, single-signature** conventions. Other networks and chains need their own checks. Public version bytes are registered in [SLIP-132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md).

| Extended-key prefix | Standard and address type | Address prefix | Public version bytes |
|---|---|---|---|
| `xpub` | [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) encoding; [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) legacy P2PKH policy | `1` | `0x0488b21e` |
| `ypub` | [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki), wrapped SegWit: P2SH-P2WPKH | `3` | `0x049d7cb2` |
| `zpub` | [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), native SegWit: P2WPKH | `bc1q` | `0x04b24746` |

`xpub` is BIP-32’s general public-key serialisation, not proof of legacy addresses. [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) Taproot accounts also use `xpub`, but produce P2TR addresses beginning `bc1p`. Wallets with explicit script policies may use `xpub` for SegWit too.

Match both the exported format and the wallet’s address policy. In prefix-led imports, `ypub` selects wrapped SegWit and `zpub` selects native SegWit. A wrong script wrapper or derivation path can still generate valid, checksummed addresses; they are simply not the addresses the signing wallet expects. Changing version bytes only re-encodes the same node; it does not move it onto another derivation path.

Before using the import, compare receiving addresses at several identical indices in both wallets; compare change where supported.

**You should see:** complete address matches, not merely familiar initial characters. Stop if they differ.

### Export the least you need

For BIP-44-style accounts, export at `m/<purpose>'/<coin_type>'/<account>'`, after the hardened boundary. The watcher derives only non-hardened descendants. Check and record the chain, network, account, full origin path and script policy from the signer’s export details; the prefix cannot establish these.

```text
Signing wallet: <ACCOUNT_NODE_AFTER_HARDENED_BOUNDARY>
        |
        | public-only export
        v
<ACCOUNT_EXTENDED_PUBLIC_KEY>
        |
        | non-hardened branch and index
        v
<DERIVED_ADDRESS>
```

An invoice service may need only a receiving-branch key, where the wallet supports it. That export cannot monitor change, so do not label its total as the whole account balance.

**You should see:** the intended scope recorded and no private key material in the watch-only export.

### Privacy checklist

The privacy rules apply equally to `xpub`, `ypub` and `zpub`.

An extended public key alone cannot spend. For the standard non-hardened branch it exposes, however, its holder can derive **every past, present and future address**. An account export normally exposes both receiving and change branches.

Someone can scan those addresses, total their on-chain balances, reconstruct payment history and keep watching new activity without contacting you again. Outside information can connect those payments to invoices, recurring customers or personal relationships. This is much wider disclosure than sharing one receiving address. Hardened boundaries limit this reach; wallet gap limits do not.

Calling a service “watch-only” describes its spending permissions, not its confidentiality. Check which operators can read its saved exports, databases and backups.

- [ ] Export per account, or a narrower supported branch; give each subsystem only what it needs.
- [ ] Restrict access and copies as privacy-sensitive data, not ordinary public configuration.
- [ ] Never paste xpubs into issue trackers, untrusted analytics, random checkers, unreviewed extensions or unnecessary chats.
- [ ] Review logs, screenshots, backups and support attachments for accidental inclusion.

**You should see:** no extended keys in telemetry or diagnostic bundles.

### One leaked child key changes everything

**A parent extended public key plus any one matching non-hardened child private key can expose the parent extended private key.** This is the [BIP-32 leak warning](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki): the damage can cover the parent’s subtree, not just that child.

```text
<PARENT_EXTENDED_PUBLIC_KEY>
        +
<MATCHING_NON_HARDENED_CHILD_PRIVATE_KEY>
        |
        v
<RECOVERABLE_PARENT_EXTENDED_PRIVATE_KEY>
```

Recovery can propagate upwards along an entirely non-hardened path. A hardened edge stops that upward recovery, but does not protect ordinary receiving/change children beneath the compromised account.

Never put a child private key in the same storage as an xpub. Never send one to a watch-only system, even for testing, recovery or a temporary signing task. Keep xprvs, seeds and recovery material outside its runtime entirely.

### Exposure has no revocation switch

An exposed xpub cannot be un-shared. Deleting an import, changing a password or issuing another address on that branch will not revoke someone else’s copy.

The remedy is to create a **fresh hardened account**, restrict its export, move funds using the signing wallet and retire the exposed branch for receipts and change. Keep monitoring for late payments, but stop issuing its addresses.

Historical activity remains visible, and migration transactions may link old funds to the new account. If a child private key leaked too, treat this as a spending-key compromise, not merely a privacy incident.

**You should see:** a different hardened account origin in the signer, with no new addresses issued from the retired branch.

**Background reading:** [BitBox](https://support.bitbox.swiss/extended-public-key/what-is-an-extended-public-key), [Learn Me A Bitcoin](https://learnmeabitcoin.com/technical/keys/hd-wallets/derivation-paths/), and [DeepWiki](https://deepwiki.com/dathonohm/bips/4.2-derivation-paths-and-schemes). Privacy introductions: [BTC Pulse](https://btc-pulse.com/learn/watch-only-wallet/) and [The Crypto App](https://thecrypto.app/guides/track-bitcoin-wallet).

## D-04C — Gap limits, branches and address-mismatch diagnosis

An address can be correctly derived yet missing from a recovered wallet. Keep three jobs separate: calculating an address, assigning it to a payment, and finding its history during a scan.

### Receiving and change are separate coverage

The [BIP-44 specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) uses `m/44'/<COIN_TYPE>'/<ACCOUNT>'/<BRANCH>/<INDEX>`. Below the account node, `/0/i` is the external, receiving branch; `/1/i` is the internal, change branch where the wallet uses change. Both branches have their own zero-based indices.

**Bawa’s daemon and one-shot tools derive only receiving addresses**, using the fixed paths in **D-04D**. They do not derive change addresses. A tracker restricted to `/0/i` will miss change outputs sent to `/1/i` in a wallet using that branch.

General advice to monitor both branches is not a statement of tool support. Nor does it make `/1/i` a change path for the ETH policy. Use the wallet’s actual chain-specific policy, rather than importing UTXO change assumptions.

### What the gap limit stops

BIP-44 sets the address gap limit to **20 consecutive unused addresses**. For an account’s receiving-chain scan, start at index 0, derive successive addresses and examine their transaction history. Start the unused counter at zero: an unused address increments it; a used address resets it. Stop on the twentieth consecutive unused address.

“Unused” means no transaction history, not a zero current balance. A used address remains used after its balance returns to zero. The [Cardano Foundation notes](https://cardano-foundation.github.io/cardano-wallet/design/concepts/Notes-about-BIP-44.html) and [IOHK/Adrestia notes](https://input-output-hk.github.io/adrestia/cardano-wallet/design/Notes-about-BIP-44) give background on this rule; check the recovering wallet’s actual scan settings.

The following are separate receiving-branch histories.

**A — the scan stops before a later payment.**

```text
i = 0: <A_ADDRESS_0> used
unused run = 0
    |
    v
i = 1..20: <A_ADDRESS_1> ... <A_ADDRESS_20> unused
unused run reaches 20 at i = 20
    |
    v
STOP

i = 21: <A_ADDRESS_21> used, but not scanned
```

The payment at index 21 exists, but ordinary discovery never reaches it. A tracker explicitly watching `<A_ADDRESS_21>` can still see it.

**B — a used address breaks the run.**

```text
i = 0: <B_ADDRESS_0> used
unused run = 0
    |
    v
i = 1..19: <B_ADDRESS_1> ... <B_ADDRESS_19> unused
unused run = 19
    |
    v
i = 20: <B_ADDRESS_20> used
unused run resets to 0
    |
    v
i = 21: <B_ADDRESS_21> unused
unused run = 1
    |
    v
i = 22: <B_ADDRESS_22> used
unused run resets to 0; scanning continues
```

By index 21, this scan has seen 20 unused addresses in total, but only one consecutively. It therefore reaches used index 22. The rule is not “inspect only 20 addresses”.

Address derivation has no usage-history requirement: `<ACCOUNT_XPUB>` can produce the non-hardened child at a later index without scanning earlier ones. Recovery is different: its stopping rule may prevent that index being examined. Successful generation is not proof of recoverability under default settings.

[Cube’s overview](https://dev.cube.exchange/what-is/key-derivation-bip32-39-44) discusses later addresses missed on recovery, while [Learn Bitcoin](https://www.learnbitcoin.com/rabbit-hole/address-reuse) describes the unpaid-invoice problem. Allocating a fresh receiving address for every invoice can build a long unused run before a later invoice is paid.

Treat allocation records as recovery metadata, not evidence of use. Showing an address to a customer does not reset the scan counter. Monitor unused runs and retain the issued range so a range-capable recovery tool can scan it. BIP-44 also calls for warning users before address generation exceeds the receiving-chain gap limit.

### Keep allocation durable

Reserve each index atomically, using a transaction with a sequence, locked counter or equivalent, and enforce `UNIQUE(scope, index)`. Scope must identify the wallet/root, chain/network, path template and branch. Commit the address and invoice/customer mapping in the same transaction.

Reading the current maximum and adding one is unsafe under concurrency: workers can choose the same index. Once an index is assigned, or its address displayed, do not quietly recycle it. Keep the mapping: even an expired invoice can receive a late payment.

### Address-mismatch checklist

Work through these checks in order. The last two explain missing visibility rather than different derivation.

1. **Confirm the chain selector.** Verify `<CHAIN_SELECTOR>` resolves to the intended chain and network in the generator, tracker and comparison wallet. A familiar-looking address is not proof of the correct network.

2. **Confirm the account xpub and its export node.** Compare `<ACCOUNT_XPUB>` with the wallet export and its documented origin path/depth. Account-, master- and branch-level exports are not interchangeable.

3. **Confirm the derivation path template, including purpose and branch.** Check purpose, coin type, account and branch against D-04D. Derive only the suffix below the exported node; do not append the account path twice.

4. **Confirm the index.** Match the stored zero-based index, not an invoice count or a UI’s position. Use the permanent allocation record.

5. **Confirm the address type/format matches the xpub prefix.** Verify chain-specific prefix conventions, network encoding and address policy together. A generic xpub prefix alone does not fully specify the address format.

6. **Confirm against an independent implementation with the same xpub, chain and path.** Include the same index, network and format. Prefer a trusted local tool; an xpub reveals linked public activity.

7. **Check whether the address sits beyond the wallet’s gap limit on recovery.** Check actual transaction history and the wallet’s configured look-ahead. A gap affects discovery, not the derived address; extend the scan where supported.

8. **Check whether the payment went to a change address the tracker does not watch.** Compare the transaction’s actual destination with the wallet’s internal branch where applicable. Bawa’s receive-only tools cannot cover that branch; use change-aware tracking.

## D-04D1 — Daemon startup, requests and private-key rejection

`tools/hdwallet-gen/derive_daemon.js` belongs on the public side of a watch-only setup. Send extended public keys, never signing material. Keep three checkpoints distinct: the daemon becoming ready, a request passing its input checks, and a derived address passing Wallet Core validation.

### Startup and line handling

Wait for the startup record before submitting work. The daemon prints it only after WASM initialisation has completed and the standard-input interface exists. It is not an address response.

```text
initWasm() completes
        |
        v
readline input interface created
        |
        v
{"ready":true}
```

Each request is one JSON object per line, for example `{"chain":"btc","xpub":"<XPUB>","index":5}`. Supply all three fields every time: there are no defaults. Extra fields are ignored, and responses contain no request ID, even when an extra request field carries one. A client must not depend on an ID being echoed.

The daemon first checks the line length. Above `4096`, it returns `{"ok":false,"error":"request too large"}`. Blank or whitespace-only lines are ignored without a response, but only after that size check. Invalid JSON returns `{"ok":false,"error":"bad json"}`. Both length limits use JavaScript string length, measured in UTF-16 code units, rather than encoded byte length.

### Field validation and fixed paths

Any failure in this field gate returns `{"ok":false,"error":"bad request"}`:

```text
Field   Required value
-----   ---------------------------------------------------------------
chain   String exactly "btc", "eth" or "trx"; case-sensitive.
xpub    String; non-empty after trimming; original length at most 200.
index   Integer JSON number from 0 to 2147483647 inclusive;
        numeric strings rejected.
```

The `xpub` limit applies to the original string, so surrounding whitespace still counts towards `200`. Trimming supplies the value used by both the private-key detector and public-key derivation; it does not relax the length limit. There is no chain normalisation or conversion of numeric strings.

Path selection is fixed, not caller-configurable. The validated `index` fills `{index}` in exactly one of these paths:

```text
chain   Approved path
-----   ----------------------------
btc     m/84'/0'/0'/0/{index}
eth     m/44'/60'/0'/0/{index}
trx     m/44'/195'/0'/0/{index}
```

The daemon selects the corresponding Wallet Core coin from `chain`. An extra path field cannot override the configured path.

### Private-key rejection and address validation

The detector does not rely on the visible lettering at the start of a key. It trims `xpub`, Base58-decodes it, and separates the final four decoded bytes as the checksum. The preceding payload is hashed twice with SHA-256. Those checksum bytes must equal the first four bytes of the second hash before a listed private version can trigger rejection.

These are the eight recognised private version prefixes, read from the first four decoded bytes as hexadecimal. Rejection requires both the checksum match and a listed version:

```text
Checksum matches
        |
        v
Version matches one of:
  "0488ade4"
  "049d7878"
  "04b2430c"
  "0295b005"
  "02aa7a99"
  "04358394"
  "044a4e28"
  "045f18bc"
        |
        v
{"ok":false,"error":"extended public key required"}
```

**Passing this detector does not establish that a value is a usable extended public key.** A checksum mismatch returns false from this test, not a public-key approval. The detector is a private-version rejection check, not complete extended-public-key validation.

After that check, the daemon derives the public key using the trimmed input, selected coin and approved path, then derives an address:

```text
HDWallet.getPublicKeyFromExtended
        |
        v
CoinTypeExt.deriveAddressFromPublicKey
        |
        v
Address present and CoinTypeExt.validate passes
        |
        v
{"ok":true,"address":"<ADDRESS>"}
```

If there is no address, or Wallet Core rejects it for the selected coin, the result is `{"ok":false,"error":"derived address failed validation"}`. Only a present address that passes that validation is reported as successful. Keep that check before reporting success; deriving a string alone is not enough.

## D-04D2 — Daemon error handling and boundaries

Keep the daemon’s two failure paths separate when wiring up a caller. Per-line failures return a JSON error on stdout and do not kill the daemon: it keeps accepting later input. Startup failure follows a different stderr path.

### Line handling

`line.length` is checked against 4096 before whitespace handling or JSON parsing. This is JavaScript string length—UTF-16 code units—not a byte count. Empty or whitespace-only lines up to 4096 are ignored with no response. A longer line returns `{"ok":false,"error":"request too large"}`, even when it contains only whitespace.

The check runs after `readline` delivers the completed line. It is therefore not a streaming buffer limit; do not rely on it to bound input buffered before that event.

### Per-line error table

`bad request` means the chain is not in `ALLOWED_CHAINS`, `xpub` is not a string, its trimmed value is empty, its untrimmed length exceeds 200, or `index` is not an integer from 0 to 2147483647 inclusive. These checks happen before private-key rejection. Public-key derivation receives `xpub.trim()`.

Each error message below is followed by its trigger.

```text
request too large
    line.length > 4096

bad json
    JSON parsing fails

bad request
    One or more request-field checks above fail

extended public key required
    isPrivateExtendedKey(xpub) recognises a private extended key

getPublicKeyFromExtended failed: <message>
    getPublicKeyFromExtended throws

deriveAddressFromPublicKey failed: <message>
    deriveAddressFromPublicKey throws

derived address failed validation
    The address is falsy, or validation returns a falsy result

internal error: <message>
    An exception reaches the outer per-line handler
```

The derivation errors include the caught exception’s message. A validation exception reaches the outer handler; it is not the same case as validation returning a falsy result.

### Error redaction

All per-request error messages pass through redaction before JSON serialisation. The case-sensitive prefixes are `xprv`/`xpub`, `yprv`/`ypub`, `zprv`/`zpub`, `Yprv`/`Ypub`, `Zprv`/`Zpub`, `tprv`/`tpub`, `uprv`/`upub`, and `vprv`/`vpub`. Each prefix must be followed by one or more Base58 characters matching `[1-9A-HJ-NP-Za-km-z]`. The matched text is replaced with `[REDACTED]`.

Any run of at least 100 Base58 characters is also replaced with `[REDACTED]`, without needing a recognised prefix.

This does not verify checksums and is not a general secret filter. Public extended keys can be redacted too, while other kinds of secret may remain visible. The filter applies to per-request error messages, not the fatal stderr path.

### Shutdown and scope

EOF sets exit code 0 with no shutdown JSON record. SIGTERM sets the same exit code and closes the readline input interface, without forcing an immediate exit.

Startup failures write `FATAL: <message>` to stderr and exit 1. That output is neither JSON nor redacted. Do not assume that collecting stderr gives you the same protection as collecting per-request errors.

The daemon does no balance lookup, signing, address/index allocation, network access or change-branch derivation. A returned address does not mean an index has been reserved.

### Worked JSONL session

Here, `<CHAIN>` stands for an allowed chain, `<XPUB>` for an accepted public extended key, `<XPRV>` for a recognised private extended key, and `<ADDRESS>` for the derived address. The private-key case is illustrative; keep live private material out of watch-only input.

Start the process, then send each stdin entry as a separate completed line. Stream labels and arrows are annotations, not protocol data.

```text
startup
    node tools/hdwallet-gen/derive_daemon.js
    |
    v
stdin
{"chain":"<CHAIN>","xpub":"<XPUB>","index":0}
stdout
{"ok":true,"address":"<ADDRESS>"}
    |
    v
stdin
{"chain":"<CHAIN>","xpub":"<XPUB>","index":2147483648}
stdout
{"ok":false,"error":"bad request"}
    |
    v
stdin
{"chain":
stdout
{"ok":false,"error":"bad json"}
    |
    v
stdin
{"chain":"<CHAIN>","xpub":"<XPRV>","index":0}
stdout
{"ok":false,"error":"extended public key required"}
```

## D-04E — Service operation, one-shot derivation and comparison

Keep allocation state with the calling application, not with the worker process. The daemon is replaceable; the record linking a request to its chain, xpub and index is not.

### One-shot derivation

From `tools/hdwallet-gen`, use:

```sh
echo "<xpub>" | node derive.js <chain> <index>
```

Choose `btc`, `eth` or `trx` for `<chain>`, and an integer in `0..2147483647` for `<index>`. The xpub comes from stdin and is trimmed. Input over 200 characters is rejected while reading, before derivation. Private-key material is rejected: this is a public derivation tool, not a private-key converter.

Check the exit status before accepting stdout:

- `2`: usage or read errors.
- `1`: derivation or validation failures.
- `0`: success, with the bare address on stdout, without a JSON wrapper.

The placeholder `echo` command illustrates the interface. In operation, stream the xpub from protected storage into stdin rather than constructing a shell command containing it.

The one-shot tool uses the same three approved receiving paths as the daemon. Here, `${i}` represents the requested index:

```text
btc
  m/84'/0'/0'/0/${i}

eth
  m/44'/60'/0'/0/${i}

trx
  m/44'/195'/0'/0/${i}
```

### Comparing public addresses

From the repository root, run:

```sh
node tools/hdwallet-gen/compare.js
```

`compare.js` reads the repository-root `.env`, or the file selected by `NOVA_ENV`. It takes `XPUB_BTC`, `XPUB_ETH` and `XPUB_TRX` from that file and prints the first three receiving addresses for `btc`, `eth` and `trx`: indexes `0`, `1` and `2`, using the paths above.

Its address output is public-only: each line contains a chain label followed by three addresses, not xpubs or private material. A missing chain xpub throws; the top-level handler reports the failure and exits `1`.

Check that status even when output looks plausible. Earlier chains may already have printed before a later chain fails. Use this helper for a spot-check, not as an allocation mechanism.

### Reader pattern: supervised, application-owned pipes

Bawa does not document a service-manager unit or launch script for the daemon; here is a pattern readers commonly use. **This is a reader pattern, not a Bawa file.**

The worker command, run from the repository root, is:

```sh
node tools/hdwallet-gen/derive_daemon.js
```

Supervise the calling application that owns the pipes, rather than connecting the daemon’s stdout directly to the journal:

```text
systemd
    |
unprivileged calling application
    |
private stdin/stdout JSONL pipes
    |
node tools/hdwallet-gen/derive_daemon.js
```

An adaptable systemd unit is:

```ini
[Unit]
Description=Reader pattern for watch-only derivation

[Service]
Type=simple
User=<unprivileged-user>
WorkingDirectory=<repository-root>
ExecStart=<env-binary> -i PATH=<minimal-path> <pipe-owning-caller> -- node tools/hdwallet-gen/derive_daemon.js
Restart=on-failure
RestartSec=<restart-delay>
NoNewPrivileges=yes
StandardInput=null
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Replace the placeholders before use. `<env-binary>` is the absolute path to `env`; `<pipe-owning-caller>` is your own application or launcher, not a Bawa executable. `<minimal-path>` must let it find `node`.

This unit depends on that caller doing the pipe management. It must launch the command after `--`, create and own the child’s stdin/stdout JSONL pipes, capture and drain stderr, and emit only redacted diagnostics through its own stdout/stderr. The daemon must not inherit the unit’s standard streams. The journal settings therefore apply to the caller’s sanitised logs, not to raw requests or replies.

`env -i` clears the launch environment apart from the explicit `PATH`. Keep both caller and child seed-free; do not import `.env` into the unit. On unexpected child exit or broken pipes, the caller must stop accepting derivation work and exit non-zero so `Restart=on-failure` can act. A launcher that remains alive beside a dead worker defeats this policy.

#### Supervision-pitfalls checklist

- [ ] **No unauthenticated network bridge.** The daemon accepts any xpub it is given and returns addresses for it. That is not authentication or proof of ownership. This pattern uses pipes, not a network socket.
- [ ] **No xpubs in unit files or command-line arguments.** Deliver them through the caller-owned input pipe.
- [ ] **No raw JSONL in logs.** Redact errors as well as routine diagnostics; systemd does not perform that redaction for you.
- [ ] **A crash is a derivation outage, not data loss.** Addresses are re-derivable from the same chain, xpub and index. Allocation records still need durable storage and backups.

#### Caller-side retry and recovery

Before dispatch, durably save an allocation record binding the request identifier to the chain, immutable xpub reference and index. Retain access to that exact xpub if the application later rotates its configuration.

Bind every retry to this saved record. A timeout or lost reply must not allocate another index. Once derivation succeeds, persist the address against the record **before returning it**. If persistence fails, do not report success. Repeat requests should receive the saved address or resume that same derivation.

Record failures and abandonment explicitly. Never silently recycle a failed or abandoned index: a missing reply does not establish that the corresponding address was never used.
