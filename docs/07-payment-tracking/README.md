# Payment Tracking

Wallet tracking asks what an address owns. Payment tracking asks whether an observed blockchain event satisfies a particular payment request.

# A real payment-tracking example: how this maps to a Telegram bot

The wallet part and the payment part are different layers. A useful real-world example is the Telegram bot code in [Pr3eve6ti2o/nova-shop-assets](https://github.com/Pr3eve6ti2o/nova-shop-assets), especially [`bot/crypto_watcher.py`](https://github.com/Pr3eve6ti2o/nova-shop-assets/blob/main/bot/crypto_watcher.py) and [`bot/crypto_payments.py`](https://github.com/Pr3eve6ti2o/nova-shop-assets/blob/main/bot/crypto_payments.py).

That code is **not a dependency of Bawa** and it does not turn Bawa into a service. It is simply a concrete example of what someone might build on top of the wallet/derivation layer.

The important architecture is:

```text
Bawa
  │
  ├── creates/derives wallet material
  └── exposes watch-only public roots
              │
              ▼
        application backend
              │
      ┌───────┴────────┐
      ▼                ▼
address allocation   blockchain data
      │                │
      └───────┬────────┘
              ▼
        payment matcher
              │
              ▼
        confirmation policy
              │
              ▼
      idempotent finalization
              │
              ▼
       application/database
```

The current Telegram example runs a periodic watcher and separates several payment states instead of treating “transaction seen” as equivalent to “order paid”.

It handles direct chain payments, underpayment/top-ups, expiry and late-payment review, CryptoBot invoice recovery, and a TON Connect slow path. That is exactly the sort of application-level logic that belongs **above** wallet derivation.

## What the watcher is doing

The current watcher is a 60-second background loop. Each cycle has separate error boundaries so a failure while checking one deposit does not terminate the whole watcher.

The broad flow is:

```text
every 60 seconds
      │
      ├── pending / underpaid direct deposits
      │       ↓
      │   fetch chain data
      │       ↓
      │   match expected payment
      │       ↓
      │   total matching payments
      │       ↓
      │   confirmation check
      │       ↓
      │   atomic claim
      │       ↓
      │   fulfill order
      │
      ├── expired deposits
      │       ↓
      │   short late-payment scan
      │       ↓
      │   manual-review state
      │
      ├── CryptoBot recovery
      │       ↓
      │   query paid invoices
      │       ↓
      │   idempotent finalization
      │
      └── TON Connect pending payments
              ↓
          slow-path lookup
```

This is more realistic than a simple:

```text
address → get transactions → if transaction exists, paid
```

## Underpayments and top-ups

The watcher sums matching payments to a deposit instead of assuming the customer will always send exactly one transaction.

For example:

```text
expected = 100
payment #1 = 60
payment #2 = 40
-----------------
total     = 100
```

The application can remain in an `underpaid` state until the total reaches its configured acceptance threshold.

That threshold is an application policy. It is not part of BIP-32, BIP-44, Ethereum JSON-RPC, Bitcoin Core or any other wallet standard.

## Expiry and late payments

A payment deadline belongs to the application, not the blockchain.

The example therefore distinguishes:

```text
pending
   ↓
expired
   ↓
late payment found
   ↓
manual review
```

This is much safer than deleting an expired payment record and pretending an on-chain payment cannot appear afterward.

## Idempotency

A payment watcher must assume it can observe the same event more than once.

This happens because of:

- polling;
- retries;
- process restarts;
- duplicated webhook deliveries;
- rescans;
- multiple workers;
- indexer replays.

A proper finalization pipeline therefore looks like:

```text
observe
  ↓
identify event/payment uniquely
  ↓
store/claim atomically
  ↓
fulfill once
  ↓
record final state
```

The Telegram example uses a database-backed payment record and a claim/finalization path to prevent a duplicate observation from delivering an order twice.

For a generic application, a useful uniqueness key might resemble:

```text
chain + txid + output
```

for UTXO payments, or:

```text
chain_id + tx_hash + log_index
```

for EVM token events.

The right key is chain-specific.

## Chain-specific matching

### Bitcoin

Match a payment to a UTXO/output paying the assigned address.

Bitcoin's developer guide recommends using a unique address for each payment request because the application can then associate the address with the payment request and scan for transactions involving that address.

For free/manual tracking, Bawa should point readers to Mempool.space and Blockstream Esplora, while making clear that a hosted explorer is a convenience rather than your application's canonical database.

### EVM tokens

For an ERC-20 payment, an application normally cares about:

```text
network / chain ID
token contract
Transfer event
sender
recipient
amount
transaction hash
log index
block number
```

The ERC-20 `Transfer` event is the normal low-level primitive for this kind of tracking.

Ethereum JSON-RPC provides `eth_getLogs` for querying logs, and modern block queries can distinguish `latest`, `safe` and `finalized` views.

### TRON

TRON's hosted ecosystem provides indexed transaction and event data, which is why a small application can often avoid running a full TRON indexer itself.

The general model remains:

```text
network
contract
transaction/event
recipient
amount
block/finality state
```

### TON

TON needs its own model.

A payment can use:

```text
unique address
```

or:

```text
shared address
+
unique comment/memo
```

The second model makes the memo/comment part of the payment-matching key.

TON's wallet address itself is also configuration-dependent: wallet contract type and wallet ID affect the resulting address, so the tracker must retain the exact wallet configuration rather than treating a TON address as the result of a generic Bitcoin-like path alone.

## Confirmation is not one universal number

The Telegram bot has chain-specific confirmation settings. That is fine as an application decision, but another application should not blindly copy those numbers.

Ethereum exposes different chain-head/finality views, while Solana uses explicit commitment levels such as `processed`, `confirmed`, and `finalized`. TRON's event APIs also expose solidification/reorganization information.

A payment database should therefore support richer states such as:

```text
seen
included
confirmed
finalized
reorged
expired
late
manual_review
paid
```

instead of forcing every blockchain into one integer called `confirmations`.

## Price quotes are also part of payment state

The Telegram example has a separate price-feed subsystem and caches recent prices.

That is the correct separation:

```text
market-data provider
      ↓
quote snapshot
      ↓
expected payment amount
      ↓
payment request
      ↓
blockchain watcher
```

For an auditable payment system, preserve at least:

```text
quote timestamp
price source
quoted price
quoted atomic amount
expiry
rounding rule
acceptance/tolerance rule
```

Do not re-price an order at payment-check time unless the business rules explicitly say to do so.

## Atomic units, not floats

The bot's payment layer also demonstrates a good rule:

```text
BTC   → satoshis
EVM   → token base units
TRON  → token/base units
TON   → nanotons
```

Use integers for stored monetary state.

Convert to human-readable decimal strings only at the presentation boundary.

---

# A second thing the guide should teach: reconciliation

A watcher tells you what it currently sees.

A reconciler checks whether your database still agrees with the chain.

Use both.

```text
frequent watcher
     ↓
new activity
     ↓
database

periodic reconciler
     ↓
re-scan a known range
     ↓
compare with database
     ↓
repair missing / stale records
```

A serious tracker should retain a chain-native cursor such as:

```text
Bitcoin      → last relevant block / transaction cursor
EVM          → last processed block
Solana       → last processed slot/signature cursor
XRPL         → ledger index / transaction cursor
Cosmos       → block height / pagination cursor
```

The exact cursor depends on the chain.

Do not rely only on wall-clock timestamps.

After an outage, the application should be able to say:

```text
Last successfully reconciled height = H
```

and resume from a safe boundary.

---

# A second Bitcoin topic that belongs in a complete guide: descriptors and PSBT

For Bitcoin, an xpub-to-address script is useful for learning, but serious watch-only systems should also understand output descriptors.

Bitcoin Core descriptors can preserve derivation origin, script policy and ranged public-key derivation. This is particularly useful for watch-only wallets and external signers.

For offline/hardware signing, study PSBT:

- [BIP-174](https://bips.dev/174/) for the PSBT format;
- [BIP-371](https://bips.dev/371/) for Taproot-related PSBT fields.

The architecture is:

```text
WATCH-ONLY
   ↓
known UTXOs
   ↓
unsigned transaction / PSBT
   ↓
OFFLINE OR HARDWARE SIGNER
   ↓
signed transaction
   ↓
broadcast
```

The online tracker never needs the spending key merely to build or monitor the transaction.

---

# Payment requests are not payments

A professional guide should also distinguish the object you give the payer from the transaction you later observe.

```text
payment request
      ≠
on-chain settlement
```

Bitcoin uses BIP-321 for payment URIs. Ethereum has ERC-681 for payment-request URLs and can represent chain/token information.

The useful design is:

```text
asset
network
recipient
amount
expiry
memo/tag when required
```

as an explicit payment request, followed later by independent blockchain verification.

---

# Wallet tracking vs payment tracking

These are different problems.

### Wallet tracking

You ask:

```text
What does this address/account own?
What happened to it?
What is its balance?
What tokens/NFTs are associated with it?
```

### Payment tracking

You ask:

```text
What payment did I ask for?
Where did I ask it to be sent?
What asset/network did I expect?
When did the request expire?
What on-chain event matched it?
Was the amount sufficient?
Did it reach the required finality?
Have I already fulfilled the order?
```

The second problem includes the first, but adds an application state machine around it.

---

# The current Telegram bot is also a useful warning about source-of-truth drift

The Telegram bot repository currently contains copies of wallet tooling under its own `tools/hdwallet-gen/` directory.

That creates a maintenance question:

```text
Bawa copy
      vs
bot copy
```

If both copies are edited independently, they can eventually derive or validate addresses differently.

Choose one source of truth for wallet-generation/derivation code and treat copied deployment artifacts as generated outputs where practical.

For example:

```text
Bawa
  └── canonical wallet/derivation reference
          │
          └── packaged/deployed into application

nova-shop-assets
  └── application-specific payment tracking
```

The bot should own:

```text
orders
payment records
quoting
allocation
matching
confirmations
reconciliation
fulfillment
```

while Bawa can own the reusable explanation and reference derivation implementation.

---

# What this means for the whole architecture

The complete mental model is:

```text
                 WALLET / KEY LAYER

 entropy
    ↓
 mnemonic
    ↓
 deterministic key tree
    ↓
 account-level public root

                 APPLICATION LAYER

 public root
    ↓
 address allocation
    ↓
 payment request
    ↓
 blockchain observation
    ↓
 payment matching
    ↓
 confirmation/finality
    ↓
 idempotent claim
    ↓
 fulfillment
    ↓
 reconciliation
```

That is the separation a professional HD-wallet guide should teach.

## Real application reference

[`crypto_watcher.py`](https://github.com/Pr3eve6ti2o/nova-shop-assets/blob/main/bot/crypto_watcher.py) and [`crypto_payments.py`](https://github.com/Pr3eve6ti2o/nova-shop-assets/blob/main/bot/crypto_payments.py) are application examples above the wallet layer, not Bawa dependencies.

The current watcher demonstrates a 60-second background loop, pending/underpaid deposits, multiple payment top-ups, chain-specific confirmation policies, atomic claiming/idempotent finalization, expiry and late-payment review, CryptoBot paid-invoice recovery, TON Connect recovery, chain-specific transaction retrieval and price-feed fallbacks.

## Minimum payment state

```
requested → address/memo assigned → observed → matched → underpaid/sufficient → confirmation/finality → claimed → fulfilled → reconciled
```

An on-chain observation is evidence to validate. It is not automatically authorization to fulfill an application order.

# Asset identity and Trust Wallet metadata

For token payments, a symbol alone is not an identity.

Persist at least:

~~~
network / chain ID
asset type
token contract / chain-specific address
expected decimals
recipient
amount in atomic units
memo/tag where required
~~~

Trust Wallet Assets can be a useful metadata source for presentation, token lists and logos, but it is not the source of truth for observed payment settlement. The payment matcher must verify the actual chain event against the application's requested network and asset identity.

See [Chain Registry & Asset Metadata](../12-chain-registry-and-assets/README.md).
## From payment request to allocation

Wallet tracking asks what an address owns. Payment tracking asks whether an observed blockchain event satisfies a particular request. **Holdings are not payments, and allocation is not payment evidence.**

```text
request
  ↓
allocation
  ↓
observation
  ↓
confirmation
  ↓
reconciliation
```

```text
Bawa wallet/derivation layer
           │
watch-only public roots
           │
           ▼
Application backend
  address allocation
  blockchain data
           │
           ▼
payment matcher
           │
           ▼
confirmation policy
           │
           ▼
idempotent finalisation
           │
           ▼
application/database
```

The [Telegram bot example](https://github.com/Pr3eve6ti2o/nova-shop-assets) illustrates an application above the wallet layer. It is **not a Bawa dependency** and does not turn Bawa into a service.

### Required request information

The payment-tracking design rules require your application to represent all six fields before allocation. These are conceptual fields, **not documented Bawa API keys**. Bawa does not define a payment API.

| Field | Information to represent |
|---|---|
| Network | The request’s network |
| Asset | The requested asset |
| Recipient | The intended recipient |
| Amount | The requested amount **in atomic units** |
| Memo/tag | The request’s memo or tag information, where the chain supports one |
| Expiry | The request’s expiry |

**You should see:** all six represented in the request design, with the amount expressed in atomic units.

**Request schema:** Bawa does not document field types, network/asset identifier formats, amount validation or conversion, memo/tag optionality or how to represent its absence, or expiry format and exact boundary rules. Define these in your application before accepting payments. Represent the memo/tag field explicitly even when it does not apply.

**Recipient selection:** Bawa does not document whether the caller provides the recipient or the application assigns it. Define who selects it and how selection relates to address allocation. The recipient must be represented unambiguously in the request before allocation.

### Allocation decision table

The payment-tracking design rules below are application policy, not Bawa features. Put these policies in place before accepting payments.

| Situation | Decision or unresolved rule |
|---|---|
| Request information is represented | Validate the request using the application’s schema, then allocate. Allocation is the next application stage, not a payment conclusion. |
| A field is missing or ambiguous | Reject the request rather than choosing a default. Bawa does not document correction behaviour; define how callers can correct and resubmit requests. |
| The recipient already has holdings | Holdings alone do not establish that an event satisfies this request. |
| A recipient is shared or previously allocated | Use one address per request where possible. If a recipient is shared, distinguish requests with a memo/tag or use a unique address; never use holdings alone. Define any further address-reuse and exclusivity rules in the application. |
| Allocation is retried or attempted concurrently | Make allocation idempotent with a request/allocation identifier and an atomic reservation, so a retry reuses the same allocation. |
| Expiry has been reached | Treat events after expiry as late payments for manual review, not automatic finalisation. Bawa does not document an allocation cut-off; define it in the application. |
| A blockchain event is observed | Match the event to the request and apply the chain’s confirmation policy before idempotent finalisation. Configure that policy for each chain before accepting payments. Allocation alone cannot replace matching or confirmation. |
| An event is duplicated or a temporary outage occurs | Count each distinct matched event once, not each watcher delivery. Reconciliation must not double-count or lose a payment. Bawa does not document persistence, replay or recovery mechanics; define these in the application. |
| The confirmed amount differs from the request | Treat the difference as a discrepancy. Accumulate top-ups only if the application’s own policy allows it. |
| A payment is ready for finalisation | Compare the request terms, distinct accepted events and stored outcome under the chain’s confirmation policy. Do not silently overwrite a stored outcome that disagrees with the evidence. |

**You should see:** allocation owned by the application backend, followed by event matching, confirmation and idempotent finalisation. These policies and implementation choices must be defined in the application before accepting payments; they are not implied Bawa features.

---
## Observation → confirmation → reconciliation

Holdings are not payments. We need evidence that satisfies a particular request, not merely a balance change.

The Telegram bot is an external example, **not a Bawa dependency**; it does not turn Bawa into a service.

```text
observation
↓
match request + allocation
↓
confirmation policy
```

```text
confirmed evidence
↓
reconciliation
↓
idempotent finalisation

reconciliation
↕
application/database
```

### Decision gate

These are **proposed application checks**, not software output or claims about the bot’s implementation.

The payment-tracking rules are application policy, not Bawa features. Bawa does not define a payment API. Define the application’s policy before accepting payments.

| Situation | You should see: |
|---|---|
| Only holdings are known | No payment conclusion from the balance alone. |
| Event does not match, or allocation is ambiguous | No automatic attachment to a request. |
| Match established; confirmation policy not satisfied | Evidence retained, but no finalisation. |
| The same event arrives again | At most one contribution from that event. |
| Confirmed amount differs, or timing is unresolved | A discrepancy, not automatic acceptance. Events after expiry are late payments for manual review, not automatic finalisation. Top-ups accumulate only if the application’s own policy allows them. |
| Match, confirmation and amount agree | Comparison with the stored outcome before any new finalisation effect. |
| Chain data is unavailable | Uncertainty, not proof of non-payment; recovery must account for the missing interval. |

### What reconciliation compares

The proposed comparison has three sides:

```text
request terms
↕
distinct, matched events accepted by the confirmation policy
↕
stored finalisation outcome
```

The confirmed amount comes from distinct accepted events, in atomic units—not from counting watcher deliveries. Repeating reconciliation must not add another credit. A stored outcome that disagrees with the evidence remains a discrepancy rather than being silently overwritten.

### Worked example — placeholders only

Conceptual only; no signing or funds. Assume `<EVENT>` is the only distinct matching event and meets an explicitly defined application timing rule.

```text
<REQUEST>:
  network     <NETWORK>
  asset       <ASSET>
  recipient   <RECIPIENT>
  amount      <AMOUNT_ATOMIC>
  memo/tag    <MEMO_OR_TAG>
  expiry      <EXPIRY>

<REQUEST>
↓
<ALLOCATION>
↓
<RECIPIENT>

<EVENT>
↓
matching transfer of <AMOUNT_ATOMIC>
```

| Review step | You should see: |
|---|---|
| Observe `<EVENT>` for `<REQUEST>`. | Matching evidence, not yet a finalised payment. |
| Receive `<EVENT>` again before confirmation. | One evidence item; the duplicate adds no amount. |
| Lose the chain feed, then resume observation. | Recovery accounts for the unavailable interval, including missed observations; the outage alone does not discard the payment. |
| Recheck `<EVENT>` against `<CONFIRMATION_POLICY>`; reconcile only if satisfied. | One accepted contribution of `<AMOUNT_ATOMIC>`, agreeing with the request and checked against the stored outcome. |
| Finalise, lose the response, then retry. | The stored outcome is resolved first; no second credit or repeated finalisation effect. |

This covers two different uncertainties: missing chain evidence during an outage, and not knowing whether an application update completed after a lost response. Neither should be treated as a fresh payment.

### Gaps before implementation

The application payment-tracking design rules also require the following before accepting payments:

- Every request must carry network, asset, recipient, amount in atomic units, memo/tag where the chain supports one, and expiry. Represent all six fields before allocation. Reject requests with missing or ambiguous fields rather than using defaults.
- Use one address per request where possible. When requests share a recipient, distinguish them with a memo/tag where supported or assign a unique address. Never rely on holdings alone.
- Make allocation idempotent with a request/allocation identifier and an atomic reservation, so a retry reuses the same allocation.
- Configure a confirmation policy for each chain before finalising.

Bawa does not document stable event identity, confirmation thresholds, reversal handling, durable storage, atomic finalisation or replay interfaces. Define and document these choices in your application, including how to recover missed observations, before turning these checks into an executable recovery runbook. No commands or implementation guarantees are implied here.
