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
