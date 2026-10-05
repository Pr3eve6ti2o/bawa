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