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

# Payment requests describe intent

A request records what your application expects to receive. Creating, displaying or scanning it moves no funds, proves no receipt and fulfils no order.

## Make all six fields explicit

Bawa does not prescribe a payment API. Before accepting payments, your application must define field types, identifier formats, amount validation, memo/tag optionality and exact expiry boundaries. Treat this list as an information checklist, not a serialisation schema.

| Field | What it establishes | When missing |
|---|---|---|
| Network | The chain on which payment is expected. | Reject; do not infer the network from an address or wallet setting. |
| Asset | The native currency or specific token expected. | Reject; do not assume the chain’s native currency. |
| Recipient | The destination that must receive the funds. | Reject; do not substitute a default wallet address. |
| Amount in atomic units | The quantity expressed in the asset’s smallest units. | Reject; do not derive it from a balance or accept an arbitrary amount. |
| Memo/tag, where supported | Chain-specific routing or reference information. | Reject omission. For unsupported chains, represent “not applicable” explicitly in your model. Define whether an explicit empty value is allowed where supported. |
| Expiry | The time limit for satisfying the request. | Reject; do not interpret absence as unlimited validity. |

Ambiguous values also require rejection. Do not turn incomplete instructions into apparently valid requests by guessing.

## Instructions are not receipts

[BIP-321](https://code.sigidli.com/bitcoin/bips/src/branch/master/bip-0321.mediawiki) describes Bitcoin payment instructions using `bitcoin:<RECIPIENT>`, with parameters including `amount`, `label` and `message`. The wallet presents the amount as a suggestion to the payer; the URI cannot enforce settlement.

[ERC-681](https://eips.ethereum.org/EIPS/eip-681) describes Ethereum transaction requests using `ethereum:<TARGET>[@<CHAIN_ID>][/transfer]`. Native-currency requests express `value` in wei. ERC-20 requests use `/transfer`, with `address` for the recipient and `uint256` for the atomic amount. The format has no invoice-reference field, so an ERC-20 `Transfer` log cannot by itself identify the invoice being paid.

These formats can communicate what to send. Neither establishes that the requested transfer happened.

## Keep three objects separate

- **The request** holds the intended terms. Your application may identify it with `<REQUEST_ID>`; that identifier is not automatically carried on-chain.
- **The on-chain event** is evidence to assess and associate with a particular request. Check its network, asset, recipient, atomic amount and applicable memo/tag, then apply your expiry rules. A wallet’s holdings cannot show that a particular event meets those terms.
- **The fulfilled order** records the business outcome after your application has accepted payment evidence and completed fulfilment. A matching transfer does not itself deliver goods, provide a service or update the order.

Keep explicit links between these objects. Do not treat the existence of one as proof that the others exist.

**You should see:** creating a valid `<REQUEST_ID>` leaves it awaiting payment; creation alone records neither receipt of funds nor order fulfilment.

## Address allocation for payment requests

Bawa exposes public roots for watch-only address derivation; it does not assign addresses to payment requests. Choosing an address, recording its reservation and making retries safe are application policy.

### Prefer a separate address

Allocate a separate derived address to each request where practical. Attach the allocation to `<REQUEST_ID>` and keep the network, token, expected amount, expiry time and payer instructions in the request record. A bare recipient address makes reconciliation fragile without that invoice state ([payment architecture guidance](https://coinpayportal.com/blog/freelancing-crypto-payment-architecture)).

### Handle shared recipients explicitly

If requests share `<RECIPIENT>`, allocate a distinct `<MEMO_OR_TAG>` to each request and require it in the payment instructions. This works only when the payment mechanism carries that field and your tracking can read it. Otherwise, use a dedicated address.

For standard ERC-20 transfers, the recipient and amount arrive without an invoice identifier. A note on your invoice does not become a memo in the transfer event, so a shared recipient alone cannot identify the request ([ERC-20 attribution guidance](https://tomcn.uk/news/2026-10-14-usdc-payment-matching-deposit-address-vs-memo)).

### Make allocation idempotent

Use `<REQUEST_ID>` as the stable allocation key:

- Return its stored allocation if one already exists.
- Otherwise, reserve an available target and save the request mapping in one atomic transaction.
- Enforce uniqueness on the request key and allocation target: the address for dedicated allocations, or the recipient/tag pair for shared allocations.
- If concurrent calls for the same request race, return the committed allocation rather than creating another one.

For example, suppose your application commits the reservation but its response is lost:

```text
First attempt: <REQUEST_ID>
Atomic reservation: <REQUEST_ID> -> <RECIPIENT>
Return: <RECIPIENT>
```

```text
Retry: <REQUEST_ID>
Stored allocation: <REQUEST_ID> -> <RECIPIENT>
Return: <RECIPIENT>
```

The retry retrieves the saved address, along with any memo/tag. It must not reserve a second address just because the caller did not receive the first response.

An allocation is not evidence of payment. Funds already held at `<RECIPIENT>` do not prove that a particular event fulfils `<REQUEST_ID>`. Event matching and payment confirmation remain separate requirements.

**You should see:** Retrying allocation for `<REQUEST_ID>` returns the same `<RECIPIENT>` and leaves exactly one stored reservation.

## Payment lifecycle state machine

Your application owns this lifecycle; Bawa does not enforce these transitions. Append each change with its time, reason and evidence reference. A transaction report alone is not permission to fulfil.

Start at `requested`. In `allocated`, the request has its receiving address or memo. `observed` captures a report; `seen` records basic validation. `matched` binds validated network, asset, destination and memo evidence to `<REQUEST_ID>`.

**One progression rule:** no state may be skipped to reach finalisation. Process every applicable stage in order, even when evidence for several stages arrives together.

### Allowed transitions

```text
requested -> allocated
allocated -> observed
observed -> seen
seen -> matched
matched -> sufficient
sufficient -> included
included -> confirmed
confirmed -> finalized
finalized -> paid
paid -> claimed
claimed -> fulfilled
fulfilled -> reconciled
```

```text
matched -> underpaid
underpaid -> observed
allocated -> expired
underpaid -> expired
included -> reorged
confirmed -> reorged
reorged -> observed
expired -> late
late -> manual_review
manual_review -> observed
manual_review -> reconciled
fulfilled -> disputed
disputed -> manual_review
```

The deadline transition to `expired` is also allowed from `observed`, `seen`, `matched`, `sufficient`, `included`, `confirmed` and `reorged`.

Ambiguous or contradictory evidence allows `observed`, `seen`, `matched`, `underpaid`, `sufficient`, `included`, `confirmed`, `reorged`, `finalized`, `paid` or `claimed` to enter `manual_review`.

These routes are exhaustive. Duplicate reports retain the current state.

### Checks and exception handling

- **Normal progression:** At `matched`, compare the validated total with the requested amount: choose `underpaid` or `sufficient`. Top-ups return through `observed` for validation and matching. `included` requires canonical block inclusion; `confirmed` requires the configured confirmation depth; `finalized` requires the chosen chain-finality test to pass. `paid` records application acceptance, `claimed` an exclusive, durable fulfilment reservation, and `fulfilled` completed delivery.

- **`confirmed` to `reorged`:** When the supporting block leaves the canonical chain, invalidate its confirmation credit without deleting its history. Block acceptance and fulfilment. If the transaction reappears, return through `observed`, repeat matching and amount checks, then rebuild inclusion, confirmation and finality evidence.

- **`allocated` to `expired`:** When the acceptance deadline passes, retain the address/memo mapping and record expiry. Stop automatic acceptance, but keep monitoring. A later receipt does not make the request retrospectively timely.

- **`expired` to `late`:** Record newly discovered payment evidence as `late`, then enter `manual_review`; do not finalise automatically. Review may restart only an unfulfilled request at `observed`, following a recorded approval that explicitly covers any deadline exception. The restarted request must traverse the normal checks. Review cannot jump directly to `finalized`, `paid` or `fulfilled`.

- **`fulfilled` to `disputed`:** Append the dispute while preserving the delivery record and original stored result. Keep contrary evidence alongside them and flag the disagreement as a discrepancy. Continue into `manual_review`; do not silently replace the result or repeat delivery. Post-fulfilment review cannot restart the payment route.

- **Into `reconciled`:** Compare the evidence with the recorded outcome and retain the audit decision. From `manual_review`, closure requires either a documented decision not to fulfil or resolution of an already-fulfilled order’s dispute. Unresolved discrepancies remain under review; resolved discrepancies and their original evidence remain recorded. `reconciled` is terminal audit closure, not another word for successful payment. It has no outgoing transitions. Later findings create a linked review case rather than rewriting the closed record.

**You should see:** an ordered history for `<REQUEST_ID>`, with every required check recorded, late payments routed to review, and no fulfilment authorised by observation alone.

# Observation and chain-specific matching

Deduplicate observations using a chain-specific event key, then require an unambiguous link to a payment request. Compare destination, asset and atomic amount with the request, validate the fields below, and apply your confirmation/finality policy before accepting a match.

## Bitcoin

Read transaction outputs from a node or a node-backed address indexer.

**Event key:** `(<CHAIN>, <TXID>, <OUTPUT_INDEX>)`.

Allocate a separate address to each request. Verify the network, transaction ID, output index, destination script/address and atomic amount, then check block inclusion and confirmation depth. The assigned address identifies the request; the output key identifies the payment observation.

A mempool output indicates an attempted payment, not confirmation. Block inclusion can still be reversed by a reorganisation. An address balance cannot replace identification of the particular paying output.

## EVM tokens

Use `eth_getLogs` on the intended network, filtering by the expected token contract and ERC-20 `Transfer` signature.

**Event key:** `(<CHAIN_ID>, <TX_HASH>, <LOG_INDEX>)`.

Verify the node’s chain ID, emitting contract, event signature, sender, recipient, atomic token amount, transaction hash, log index and block number/hash. Enforce any sender restriction. Reject non-canonical logs and logs whose `removed` flag is true. If an accepted log is subsequently removed, invalidate that observation and reassess the request.

`latest` follows the current head without guaranteeing finality. Where supported, `safe` denotes a justified view that remains reorganisable in principle; `finalized` reflects acceptance by over two-thirds of validators. A true `removed` flag reports removal during a reorganisation. [Log states and finality](https://docs.chainstack.com/reference/gnosis-getlogs).

Give each request its own deposit address. A standard token-transfer event contains no invoice reference: a shared recipient and matching amount do not establish unique invoice attribution. [ERC-20 attribution](https://tomcn.uk/news/2026-10-14-usdc-payment-matching-deposit-address-vs-memo).

## TRON

Read indexed transaction records and contract events, including execution results and block/finality state.

**Token-event key:** `(<NETWORK>, <TXID>, <EVENT_INDEX>)`, using a stable transaction-local event position, never a pagination offset.

For native transfers, use `(<NETWORK>, <TXID>, <CONTRACT_INDEX>)` in a separate namespace. The contract index identifies the transfer operation within the transaction.

Check network, transfer contract/type, recipient, atomic amount, successful execution, block number/hash and confirmed or solidified state. For tokens, also verify the expected token contract and decoded transfer event. If several requests fit, do not guess.

An indexed transaction establishes visibility, not successful execution or finality. A latest-block result must not be treated as solidified merely because the indexer returned it.

## TON

Read the receiving account’s transactions and inbound messages through a node/API or indexer.

**Native-receipt key:** `(<NETWORK>, <ACCOUNT_ADDRESS>, <LT>, <TX_HASH>)`, where `<LT>` is the receiving transaction’s logical time.

Check the network, exact recipient, inbound atomic value, transaction identity, execution/bounce outcome and block/finality state. Verify a credited, non-bounced inbound payment; a sender-side transaction alone does not establish receipt.

A dedicated address identifies the request. For a shared address, require the exact assigned comment/memo as part of the request-matching key. The memo does not replace transaction identity.

Retain the wallet contract type and wallet ID used to derive the address. Recreating the wallet with different settings can produce a different destination.

If a chain feed cannot be reached, leave the outcome unknown. Missing observations do not establish that nothing was paid.

**You should see:** repeated polls producing one record per qualifying event, tied to one request, with validated fields and a recorded confirmation/finality state.

## Confirmation thresholds

**Illustrative application policy — not Bawa behaviour.** Choose your own value bands, risk limits and waiting times; never transplant these thresholds blindly. `confirmed` means your policy passed, not that reversal is impossible.

BTC numbers count blocks, including the inclusion block. Elsewhere, **1** means one successful event inclusion satisfying the stated chain condition.

| Chain | Low value | Ordinary value | High value |
|---|---|---|---|
| BTC | **1** — avoids mempool-only acceptance; reversal risk remains. | **3** — lower end of the deposit range, balancing delay and risk. | **6** — more accumulated work protects larger exposure, but remains probabilistic. |
| EVM (Ethereum) | **1 `latest` inclusion** — accepts head-reorg risk for small amounts. | **1 `safe` inclusion** — stronger consensus assurance than the latest head. | **1 `finalized` inclusion** — requires protocol finality for larger exposure. |
| TRX | **1 successful inclusion** — faster, but explicitly provisional. | **1 solidified inclusion** — waits for the protocol’s quorum. | **1 solidified inclusion plus independent verification** — same finality, better protection against faulty node data. |
| TON | **1 verified masterchain anchor** — uses protocol finality rather than arbitrary depth. | **1 verified anchor** — ordinary value does not change the finality rule. | **1 verified anchor plus independent verification** — checks observation errors rather than inventing extra finality. |

[Bitnob’s confirmation guide](https://bitnob.dev/docs/bitcoin/a-practical-guide-for-non-technical-pms/module-5) gives retail a 0–1 range, deposits at exchanges 3–6, and major settlements 6+. More depth reduces reversal probability; a displaced transaction can later return in another block.

Ethereum’s views are gates, not fixed depths: verify that the payment block belongs to the chosen view. Other EVM networks need their own settlement rules, including upstream finality where relevant. A TON anchor means a verified finalised masterchain reference covering the payment’s shard block.

Under [TRON’s confirmation rules](https://developers.tron.network/docs/confirmation-semantics), solidification requires block production by at least 19 different Super Representatives, each at the target height or higher. This usually takes roughly a minute on mainnet. Broadcast `true` acknowledges completion of the call, not inclusion, execution success or solidification. Check that `contractRet` is `SUCCESS` separately.

## Reorg handling

Keep observation status (`seen`, `included`, `confirmed`, `finalized`, `reorged`) separate from business status (`expired`, `late`, `manual_review`, `paid`). Persist event identity, block hash/height, claim linkage and policy version. Compare stored block hashes with the canonical chain; do not rely solely on removal notifications.

When an event is removed:

- **`seen`/`included`:** retain the removed block observation as `reorged` and withhold acceptance. Return to `seen` only after actually observing the transaction pending again.
- **`confirmed`:** mark it `reorged`, revoke eligibility and freeze outstanding fulfilment. Reverse provisional credits through compensating entries, preserving the confirmation history.
- **Claimed or `paid`:** suspend the claim’s chain backing while retaining its allocation and audit trail. Block duplicate settlement. Already delivered goods or irreversible payouts require `manual_review`; changing a database flag cannot undo an external action.

Removal from a `finalized` or solidified view should also pause automated settlement and trigger `manual_review` with independent verification.

For ordinary reorg recovery, find the common ancestor, rewind the scan cursor and replay canonical blocks. Reconcile pending and replacement transactions, then re-match idempotently. If `<TXID>` returns, verify its new block hash and execution, rebuild depth from its new inclusion, and reapply the threshold. Reassess `expired`/`late` against the original deadline before restoring eligibility.

**You should see:** removing a confirmed test event suspends acceptance; its canonical return restores eligibility only after policy checks, without duplicate credit or fulfilment.

## Amounts, top-ups and expiry

**Bawa behaviour.** The watcher tracks the combined value of transfers matching a deposit. `<CONFIRMED_ATOMIC>` includes each accepted event’s atomic-unit amount once, however often its notification arrives.

**Application policy.** Calculate with integers in the requested asset’s atomic unit; convert only for display. Choose and document `<TOLERANCE_ATOMIC>`: non-negative and smaller than `<EXPECTED_ATOMIC>`. Choose zero if no shortfall is acceptable.

```text
<THRESHOLD_ATOMIC> = <EXPECTED_ATOMIC> - <TOLERANCE_ATOMIC>
```

The amount check passes when `<CONFIRMED_ATOMIC> >= <THRESHOLD_ATOMIC>`. Timing and top-up permission still apply. This threshold belongs to your application, not a wallet specification.

Calculate `<SHORTFALL>` as expected minus confirmed, and `<EXCESS>` as confirmed minus expected, clamping each at zero. Keep any tolerated shortfall visible; acceptance does not rewrite the received amount.

### Worked amounts

Assume these events match `<REQUEST_ID>` and are accepted before expiry. These are **Bawa totals with application-policy outcomes**. The two-part example assumes top-ups are enabled.

- **Exact:** One accepted transfer of `<EXPECTED_ATOMIC>` gives `<CONFIRMED_ATOMIC> = <EXPECTED_ATOMIC>`. Shortfall and excess are zero; the amount qualifies.
- **Underpaid:** One transfer of `<EXPECTED_ATOMIC> - <SHORTFALL>`, where `<SHORTFALL> > <TOLERANCE_ATOMIC>`, leaves the total below `<THRESHOLD_ATOMIC>`. Keep the request underpaid while its window remains open.
- **Overpaid:** One transfer of `<EXPECTED_ATOMIC> + <EXCESS>`, with positive `<EXCESS>`, clears the threshold. Record the excess separately.
- **Two-part top-up:** `<PART_A_ATOMIC> = <EXPECTED_ATOMIC> - <SHORTFALL>` remains insufficient when `<SHORTFALL> > <TOLERANCE_ATOMIC>`. A separate accepted event of `<PART_B_ATOMIC> = <SHORTFALL>` completes the amount:

```text
<CONFIRMED_ATOMIC> = <PART_A_ATOMIC> + <PART_B_ATOMIC>
<CONFIRMED_ATOMIC> = <EXPECTED_ATOMIC>
```

**Application policy.** Allow multiple transfers to settle a request only when top-ups are enabled. For these examples, a timely, confirmed overpayment fulfils the request without an automatic excess refund. [Kaspa payment guidance](https://kaspaforge.org/blog/kaspa-payment-confirmations-blockdag-webhooks.html) similarly adds matching transfers and separates excess handling from fulfilment, since on-chain transfers cannot be reversed.

### Expiry and late payments

**Application policy.** Record a deadline for `<REQUEST_ID>` and retain the record after expiry. Your deadline does not stop blockchain transfers.

Distinguish no funds yet, a deposit awaiting confirmation, full payment, excess payment, partial payment while open, and underpayment after closure, following [gateway status guidance](https://medium.com/@speend/crypto-payment-api-what-to-check-before-you-integrate-98bf6aa14c76). Partial, late and excess payments need separate statuses rather than one paid/unpaid flag, as [community payment practice](https://coinpayportal.com/blog/freelancing-crypto-payment-architecture) recommends.

```text
pending
↓ deadline passes before acceptance
expired
↓ new matching payment found
late payment found
↓
manual review
```

**Application policy.** Route newly discovered payments on expired requests to review, even when their value brings the total above the threshold. Do not finalise automatically.

Before deciding, the reviewer checks:

- The request, deposit and asset match.
- Event uniqueness, acceptance and confirmations.
- The total, tolerance and top-up permission.
- Payment and discovery times against the deadline.
- Earlier fulfilment or refunds, and whether fulfilment remains possible.

Release only when the amount meets policy and late acceptance is authorised. If fulfilment cannot proceed, refuse it with a recorded reason and a decision about the received funds. Refund only an authorised amount to an independently verified destination, under the documented fee policy; a refund requires a new transfer. Record the outcome.

**You should see:** A late top-up moves `<REQUEST_ID>` to `manual review` even if it meets `<THRESHOLD_ATOMIC>`; another delivery of that event leaves `<CONFIRMED_ATOMIC>` unchanged.

### Price quotes as payment state

Quote policy is application policy, not a Bawa feature. Bawa does not define a price API.

Freeze a quote snapshot into the payment request before presenting the amount. Keep live price collection separate from payment calculation and blockchain watching. The watcher uses the frozen amount; a market move must not change what the payer was asked to send.

Preserve these seven fields together:

- **Quote timestamp:** the time the quoted rate refers to. This establishes its age and the pricing moment; reading a cached rate must not give it a fresh timestamp.
- **Price source:** the provider and feed or currency pair used. This identifies where the rate came from when providers disagree.
- **Quoted price:** the exact conversion rate, including currencies and direction. This lets both sides reproduce the calculation.
- **Quoted atomic amount:** the exact integer amount requested. This settles what the payer was asked for, regardless of decimal formatting.
- **Expiry:** the limit of the quote’s validity. This records how long the rate was offered, rather than leaving an open-ended price promise.
- **Rounding rule:** the precision, direction and stage of rounding. This explains any smallest-unit difference between the conversion result and the payable amount.
- **Acceptance/tolerance rule:** the permitted deviation, if any, and its units. This prevents acceptance standards being chosen after seeing the payment.

Document rounding and tolerance as application policy, then preserve the applied rules with each quote. Apply rounding when calculating the atomic amount, not when displaying it. Store amounts as integers in the relevant atomic unit: BTC satoshis, EVM token base units, TRON token/base units or TON nanotons. Human-readable decimals are presentation only; formatting must not determine what is owed or tolerated.

Re-pricing during a payment check breaks the link between the amount requested and the amount assessed. The stored request can no longer explain the decision. A re-quote is permissible only where explicit business rules, disclosed to the payer, allow it. Record the replacement quote as a new request term, retain the previous snapshot and make the changed terms visible to the payer. Never silently overwrite the original quote.

Set a freshness limit for prices used at request time. If the feed is unavailable or stale and no fresh snapshot is available, either withhold the request or use an existing snapshot under a documented stale-quote policy. Clearly mark the quote as stale to the payer, show its age and retain its original timestamp. Never invent a replacement price.

During watching, a fallback feed changes only the source of new market data. It must not alter the frozen quote, including its recorded source, rate or atomic amount. Feed failover is not a re-quote.

# Duplicate payments, disputes and refunds

The controls below are **application policy, not Bawa behaviour**.

## Duplicate payments

**Application policy — replay-safe finalisation.** Expect repeat observations from polling, retries, restarts, duplicated webhooks, rescans, multiple workers and indexer replays. Identify the actual transfer using the network, `<TXID>` and relevant output or log index, rather than a callback identifier alone.

Observe the transfer, establish its identity, then persist the event and claim fulfilment atomically. Use a database transaction, a unique event constraint and a conditional claim on `<REQUEST_ID>`. Only the successful claimant fulfils, then records the final state; other workers consult the existing state instead of starting another fulfilment. Commit local credit with its outcome. For external fulfilment, use a durable outbox and an idempotent receiver.

Replayed ‘paid’ notifications must not dispatch goods again. [Gateway integration guidance](https://medium.com/@speend/crypto-payment-api-what-to-check-before-you-integrate-98bf6aa14c76) warns that processing redelivery without idempotency can credit an account repeatedly.

**Application policy — stored outcomes and lost responses.** When finalisation completes but its response is lost, a retry must resolve the stored outcome first. Return a matching result without another credit or repeated finalisation effect. If any saved outcome contradicts the evidence, preserve both and flag a discrepancy for review; do not quietly replace the result.

**Application policy — distinguish extra money from replay.** Retain every distinct transfer. An overpayment, or a second distinct payment against `<REQUEST_ID>`, belongs in review or an overpaid state rather than ordinary settlement. Use idempotent invoice creation to prevent accidental reissue, and reconciliation to detect multiple payments. [Community payment guidance](https://coinpayportal.com/blog/freelancing-crypto-payment-architecture) describes these as complementary controls: neither replaces the other.

## Disputes and refunds

**Application policy — retain review evidence.** Keep the request’s agreed asset, network, amount and destination alongside transaction evidence, confirmation status and the claim, credit and fulfilment history. Append review decisions and their reasons without erasing earlier evidence.

- **Wrong asset — application policy:** hold for review. Compare the requested and received asset identifiers, including token contract identifiers where relevant, against transfer logs or outputs. Record the amount and asset precision. Matching names or tickers are not sufficient.
- **Wrong network — application policy:** do not automatically settle the intended-network request. The reviewer needs the expected and observed chain identifiers, transaction evidence, destination and confirmation status, plus evidence that the operator controls the funds on the observed chain.
- **Wrong amount — application policy:** compare the expected amount with distinct eligible transfers counted once, using consistent asset units. Retain the calculation, precision and agreed fee or tolerance rules. Hold shortfalls for review and explicitly flag excess funds as overpaid or under review.
- **Sender unknown — application policy:** do not automatically return funds to a transaction’s source address; it may be a service wallet. Require authenticated claimant evidence linked to `<REQUEST_ID>` and `<TXID>`, corroborating payment records and verified return instructions. Transaction visibility alone does not establish entitlement.

**Application policy — refund through a separate payment.** A refund is a fresh outgoing payment requiring independent authorisation. Leave the original payment record unchanged. Create a linked refund record with its own approval, status and eventual `<REFUND_TXID>`. The approval must cover the asset, network, destination, amount and fees. Verify custody and recovery feasibility before promising repayment, particularly for wrong-asset or wrong-network cases. Apply atomic claiming and idempotent execution to refunds too, so a retry cannot send another payment.

**You should see:** Replays and a lost-response retry leave one credit and one fulfilment; distinct extra funds remain flagged, and any refund has separate approval and a linked outgoing-payment record.

## Watcher and reconciler

**Bawa behaviour:** Watching reports current observations. Reconciliation replays a bounded chain range, checks persisted state, and restores omitted entries or corrects obsolete ones. The watcher catches new activity beyond the replay’s endpoint; the reconciler catches missed payments and reorganisation-related changes within its range. Fresh observations do not certify earlier database history.

**Application policy:** Watch frequently and reconcile periodically. Retain native cursors: Bitcoin’s most recent relevant block/transaction position; EVM’s processed block height; Solana’s slot plus signature; XRPL’s ledger index plus transaction; Cosmos’s height plus pagination state. Store the height reached by the latest successful reconciliation, or its chain equivalent, separately from watcher progress. Advance it only when the whole range succeeds and writes are durable. After downtime, restart from a conservative earlier boundary. Timestamps cannot replace chain cursors.

### Three-sided check

**Bawa behaviour:** Check the request’s recorded terms against unique matching events that satisfy the confirmation policy, then compare the resulting entitlement with the saved finalisation outcome. Recheck individual matches as well as the accepted total. Re-observing an event must not count its value again.

**Application policy:** Choose confirmation requirements, amount tolerances and late-payment treatment. Commit finalisation atomically with the credit or an outbox entry. Enforce a stable idempotency key for that entitlement, including in downstream consumers; never generate a fresh credit key per reconciliation run.

### Worked recovery

**Application policy:** `<REQUEST_ID>` expects `<AMOUNT>` of `<ASSET>` on `<NETWORK>` at `<DESTINATION>`. The watcher was offline when `<TXID>` paid `<AMOUNT>` at `<HEIGHT>`; the database still records no payment. Replay `<SAFE_HEIGHT>` through `<END_HEIGHT>`, containing `<HEIGHT>`.

**Bawa behaviour:** The replay finds the missing event and restores its record. The event matches the request and meets `<CONFIRMATION_POLICY>`, so the stored outcome needs correction.

**Application policy:** Record the corrected finalisation and `<CREDIT_ID>` under `<IDEMPOTENCY_KEY>`. A second replay retains that credit rather than issuing another.

### Audit trail — application policy

Keep request state, not merely an address: [community payment guidance](https://coinpayportal.com/blog/freelancing-crypto-payment-architecture) treats stateful reconciliation as central to dependable payments. Maintain an append-only journal with UTC timestamps, source, actor/job identity and schema/software versions. Preserve original decisions when correcting them.

Before scanning, log the run ID, trigger, input checkpoint and range bounds. After durable processing, append its comparisons, repairs, errors, completion status and safe checkpoint. Retain the linked payment records in this causal order:

1. **Request:** `<REQUEST_ID>`, creation/revision history, chain/network, asset identifier, base-unit amount, recipient, required memo/tag, validity limits and policy snapshot.
2. **Observation:** `<TXID>`, chain/network and native event/output/log identity, cursor, block/slot/ledger identity, canonicality status, payer/recipient, asset, amount and memo/tag. Keep transaction/receipt and inclusion/checkpoint evidence supporting chain inclusion and confirmations.
3. **Match decision:** request–event link, deduplication key, evaluated confirmations, accepted/rejected/pending status and reason, tied to the policy version.
4. **Reconciliation/finalisation:** accepted event set, total, database before/after values, discrepancy and repair, resulting status and decision reason.
5. **Credit and settlement:** credit ID, idempotency key, journal amount/asset, reversals or adjustments, and allocation to the retained `<SETTLEMENT_LINE_ID>` record, including fees and net value. [Gateway audit guidance](https://www.coinsclone.com/cryptocurrency-payment-gateway-development/) emphasises settlement traceability for each payment.

From these records alone, a reviewer verifies inclusion and policy acceptance at the recorded checkpoint, reconstructs the distinct accepted total, checks finalisation, and follows the credit into settlement. Run history establishes scanned coverage; credit keys and journal entries demonstrate that replay did not pay twice.

**You should see:** Replaying the worked range twice leaves one accepted event, one credit and a traceable request-to-settlement record chain.

### The Telegram example’s watcher loop

The Telegram bot example runs its background watcher on a 60-second cycle. This code is an external example above Bawa, not a Bawa dependency, and it does not turn Bawa into a service.

Each deposit check has its own error boundary. One bad deposit, failed chain lookup or broken price feed must not stop the loop or block other deposits. Catching errors only around the whole cycle can leave the watcher running while still skipping the checks after a failure.

Each cycle visits four branches, in this order:

1. **Pending or underpaid direct deposits.** Fetch transaction data using the chain-specific lookup, match the expected payment and total the matching payments. Apply that chain’s confirmation policy. A ready deposit is claimed atomically before its order is fulfilled; otherwise it remains pending or underpaid.

2. **Expired deposits.** Run a short scan for late payments, then move the deposit into the manual-review state. This branch leaves the order for review rather than treating expiry handling as successful payment completion.

3. **CryptoBot recovery.** Query paid invoices and recover orders whose finalisation is still outstanding. These go through idempotent finalisation, not a separate invoice-only route to fulfilment.

4. **TON Connect pending payments.** Run the slow-path lookup for payments still pending. Unresolved payments stay pending; recovered evidence goes to the same finalisation path.

CryptoBot invoice recovery and the TON Connect slow path are separate branches because they provide different evidence with different timing. They are not extra chain feeds. Neither branch bypasses payment matching or confirmation: each must satisfy those checks before the common idempotent finalisation gate can complete the order.

For your own watcher, keep the states separate, isolate failures within individual checks, and use the same finalisation gate whenever any branch is ready to fulfil. The loop should distinguish finding evidence, waiting for readiness, holding for review and completing an order.

This code is an external example above Bawa, not a Bawa dependency, and it does not turn Bawa into a service.

### Bitcoin descriptors and PSBT

Descriptors and PSBT are Bitcoin ecosystem standards, not Bawa features. Bawa’s tools do not build or sign PSBTs.

A bare xpub allows public-key derivation, but does not fully describe the key’s origin or how those keys become spendable outputs. [Bitcoin Core output descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) can record:

- **Derivation origin:** the master-key fingerprint and derivation path.
- **Script policy:** the output type and spending requirements, such as single-key SegWit or a multisignature threshold.
- **Ranged derivation:** wildcard paths from which the tracker derives successive public keys and addresses.

Use public-only descriptors covering the wallet’s receiving and change branches. These let the watch-only side determine which addresses belong to the wallet and what policy governs their outputs, without holding private keys.

The tracker can enumerate addresses within its configured ranges and match their output scripts against chain data to identify the wallet’s unspent transaction outputs (UTXOs). It is tracking a defined address set, not guessing wallet ownership from one address. Keep those ranges current; a descriptor does not automatically reveal payments to addresses beyond the scanned range.

#### Moving a transaction to the signer

[BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki) specifies the partially signed Bitcoin transaction (PSBT) format. [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki) adds Taproot-specific PSBT fields.

Use a separate PSBT-capable Bitcoin wallet or coordinator for this flow:

1. **Build online.** Select known wallet UTXOs and construct an unsigned transaction with the intended destinations, amounts and fee. Package it as an unsigned PSBT with the previous-output and derivation information the signer needs.
2. **Sign offline or on hardware.** Transfer the PSBT to the signer, where the spending keys remain. Verify the destinations, amounts and fee through the trusted signing interface against the intended payment before approving. Treat the online proposal as untrusted.
3. **Finalise.** Return the signed PSBT to the coordinator. Once the required signatures are present, finalise it and extract the signed transaction.
4. **Broadcast online.** Send only the signed transaction to the Bitcoin network. The PSBT is a hand-off format for signing, not the object broadcast.

The online tracker and watcher never touch a spending key. A watcher compromise alone cannot spend funds; it can at most misreport them, which reconciliation must catch.

## Derivation ownership and token identity

The Telegram bot’s `tools/hdwallet-gen/` directory holds a copy of Bawa’s wallet tooling. Maintaining both trees independently creates drift: a derivation or validation change made in only one copy can leave them producing or accepting different addresses for the same root, without an obvious failure.

Keep Bawa as the canonical home for the derivation explanation and reference implementation. Package the application’s copy from that reference and treat it as a generated deployment output. Never hand-edit the copied tooling in place.

The application owns orders, payment records, quoting, address allocation, matching, confirmations, reconciliation and fulfilment. Bawa supplies the reusable derivation reference, not the payment workflow.

The wallet/key layer ends at the account-level public root. The application layer begins with that root; no step in it needs a spending key.

```text
WALLET / KEY LAYER
entropy
  -> mnemonic
  -> deterministic key tree
  -> account-level public root
```

```text
APPLICATION LAYER
account-level public root
  -> address allocation
  -> payment request
  -> blockchain observation
  -> payment matching
  -> confirmation / finality
  -> idempotent claim
  -> fulfilment
  -> reconciliation
```

A token’s ticker is only a label. Unrelated contracts can share a symbol, including on the same network, and a familiar symbol can appear on several chains. It cannot identify the asset being paid.

For each token payment, persist at least these seven fields:

- Network/chain ID.
- Asset type.
- Token contract or chain-specific asset address.
- Expected decimal precision.
- Recipient address.
- Amount expressed in atomic units.
- Any required memo or tag.

Use [Trust Wallet Assets](https://github.com/trustwallet/assets) for presentation metadata, token lists and logos, not as evidence that a payment has settled. Settlement must be based on a verified chain event checked against the requested network and token contract or equivalent asset address, never on a matching symbol or metadata entry.
