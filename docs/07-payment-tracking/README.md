# Payment tracking

## 1. Wallet tracking vs payment tracking

Use wallet tracking to answer what an address owns: its balance, history, tokens and NFTs.

Use payment tracking to decide whether an observed blockchain event satisfies a particular payment request. Check what was asked for, where to pay, which asset and network were specified, and when the request expired. Then check which on-chain event matched, whether the amount was sufficient, whether it reached the required finality and whether you have already fulfilled the order.

Treat payment tracking as the broader problem: it includes wallet tracking, then adds an application state machine around it.

## 2. A generic payment-tracking example

### Architecture and watcher loop

Arrange the layers from top to bottom:

```text
Bawa wallet/derivation layer
    ↓
application backend
    ↓
address allocation and blockchain data
    ↓
payment matcher
    ↓
confirmation policy
    ↓
idempotent finalisation
    ↓
application/database
```

Run the watcher as a 60-second background loop. Keep separate error boundaries within each cycle, including around individual deposit checks, so a failure while checking one deposit does not terminate the whole watcher.

Process these branches in each cycle:

1. **Pending and underpaid direct deposits:** fetch chain data, match the expected payment, total matching payments, check confirmation, claim atomically, then fulfil the order.
2. **Expired deposits:** run a short late-payment scan, then move the deposit to the manual-review state, `manual_review`.
3. **External invoice recovery:** query paid invoices and recover their fulfilment through idempotent finalisation.
4. **Slow-path pending payments:** run the slow-path lookup.

Keep the invoice-recovery and slow-path branches separate because they provide different evidence with different timing, not extra chain feeds. Do not let either branch bypass payment matching or confirmation. Require each to satisfy both checks before the common idempotent finalisation gate can complete the order.

Use this stateful flow rather than “address, get transactions, if transaction exists, paid”.

### Underpayments and top-ups

Sum matching payments to a deposit instead of assuming one exact transaction. For an expected amount of 100, two matching payments can reach the total: 60 + 40 = 100.

Allow the deposit to remain in an `underpaid` state until the total reaches your configured acceptance threshold. Set that threshold as application policy: it is not part of BIP-32, BIP-44, Ethereum JSON-RPC, Bitcoin Core or any other wallet standard.

### Expiry and late payments

Treat a payment deadline as an application rule, not a blockchain rule. Distinguish pending, expired, late payment found and manual review in your payment state.

Keep expired payment records so you can still match an on-chain payment that appears afterwards. Do not delete a record and assume expiry prevents a payment from arriving.

### Idempotency

Assume you can observe the same event more than once. Account for polling, retries, process restarts, duplicated webhook deliveries, rescans, multiple workers and indexer replays.

Use this finalisation pipeline:

```text
observe → identify event/payment uniquely → store/claim atomically → fulfil once → record final state
```

Make the claim atomic and choose a chain-specific uniqueness key:

- UTXO payments: `chain + txid + output`
- EVM token events: `chain_id + tx_hash + log_index`

Use the same idempotent finalisation gate for every payment path. Do not let a repeated observation fulfil an order again.

### Chain-specific matching

#### Bitcoin

Match a payment to a UTXO/output paying the assigned address. Follow Bitcoin's developer guide recommendation to use a unique address per payment request: associate the address with the request, then scan for transactions involving it.

For free/manual tracking, use Mempool.space and Blockstream Esplora. Treat a hosted explorer as a convenience, not as your application's canonical database.

#### EVM tokens

For an ERC-20 payment, track the network/chain ID, token contract, `Transfer` event, sender, recipient, amount, transaction hash, log index and block number.

Use the ERC-20 `Transfer` event as the normal low-level primitive. Fetch logs with Ethereum JSON-RPC's `eth_getLogs`, and use modern block queries to distinguish `latest`, `safe` and `finalized` views.

#### TRON

Use the hosted TRON ecosystem's indexed transaction and event data. For a small application, this often avoids the need to run a full TRON indexer yourself.

Retain the general matching model: network, contract, transaction-event, recipient, amount and block-finality state.

#### TON

Use a unique address, or a shared address plus a unique comment/memo. With a shared address, include the memo/comment in the payment-matching key.

Retain the exact wallet configuration. A TON wallet address depends on its wallet contract type and wallet ID; do not treat it as the result of a generic Bitcoin-like path alone.

### Confirmation is not one universal number

Choose chain-specific confirmation settings as application policy. Do not blindly copy another application's numbers.

Model the evidence each chain exposes:

- **Ethereum:** distinguish its different chain-head/finality views.
- **Solana:** use the explicit commitment levels `processed`, `confirmed`, `finalized`.
- **TRON:** account for the solidification/reorganisation information exposed by its event APIs.

Support richer states in your payment database: `seen`, `included`, `confirmed`, `finalized`, `reorged`, `expired`, `late`, `manual_review`, `paid`. Do not force every blockchain into one integer called `confirmations`.

### Price quotes as payment state

Cache recent prices in a separate price-feed subsystem. Keep the flow explicit:

```text
market-data provider → quote snapshot → expected payment amount → payment request → blockchain watcher
```

Preserve at least these fields so you can reconstruct how you calculated and accepted a payment:

- Quote timestamp
- Price source
- Quoted price
- Quoted atomic amount
- Expiry
- Rounding rule
- Acceptance/tolerance rule

Do not re-price an order at payment-check time unless your business rules explicitly say to do so.

### Atomic units, not floats

Use integers for stored monetary state:

- **BTC:** satoshis
- **EVM:** token base units
- **TRON:** token/base units
- **TON:** nanotons

Convert to human-readable decimal strings only at the presentation boundary.
## 3. Reconciliation

A watcher tells you what it currently sees; a reconciler checks whether your database still agrees with the chain. Use both:

- Frequent watcher → new activity → database.
- Periodic reconciler → re-scan a known range → compare with database → repair missing/stale records.

Retain a chain-native cursor:

- **Bitcoin** — last relevant block/transaction cursor.
- **EVM** — last processed block.
- **Solana** — last processed slot/signature cursor.
- **XRPL** — ledger index/transaction cursor.
- **Cosmos** — block height/pagination cursor.

The exact cursor depends on the chain. Do not rely only on wall-clock timestamps. Record successful reconciliation checkpoints so that, after an outage, your application can report "Last successfully reconciled height = H" and resume from a safe boundary.

## 4. Bitcoin descriptors and PSBT

Use an xpub-to-address script for learning, but make output descriptors part of a serious Bitcoin watch-only design. Bitcoin Core descriptors can preserve derivation origin, script policy and ranged public-key derivation — particularly useful for watch-only wallets and external signers.

For offline or hardware signing, study [BIP-174 (PSBT format)](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki) and [BIP-371 (Taproot-related PSBT fields)](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki). Use this architecture:

```text
WATCH-ONLY → known UTXOs → unsigned transaction/PSBT → OFFLINE OR HARDWARE SIGNER → signed transaction → broadcast
```

The online tracker never needs the spending key merely to build or monitor the transaction.

[Bitcoin Core output descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) can record:

- **Derivation origin:** the master-key fingerprint and derivation path.
- **Script policy:** the output type and spending requirements, such as single-key SegWit or a multisignature threshold.
- **Ranged derivation:** wildcard paths from which the tracker derives successive public keys and addresses.

Use public-only descriptors covering the wallet's receiving and change branches. These let the watch-only side determine which addresses belong to the wallet and what policy governs their outputs, without holding private keys.

Enumerate addresses within the tracker's configured ranges and match their output scripts against chain data to identify the wallet's unspent transaction outputs (UTXOs). Track a defined address set rather than guessing wallet ownership from one address. Keep those ranges current; a descriptor does not automatically reveal payments to addresses beyond the scanned range.

BIP-174 specifies the partially signed Bitcoin transaction (PSBT) format; BIP-371 adds Taproot-specific PSBT fields. Use a separate PSBT-capable Bitcoin wallet or coordinator to move a transaction through this flow:

1. **Build online.** Select known wallet UTXOs and construct an unsigned transaction with the intended destinations, amounts and fee. Package it as an unsigned PSBT with the previous-output and derivation information the signer needs.
2. **Sign offline or on hardware.** Transfer the PSBT to the signer, where the spending keys remain. Treat the online proposal as untrusted. Verify the destinations, amounts and fee through the trusted signing interface against the intended payment before approving.
3. **Finalise.** Return the signed PSBT to the coordinator. Once the required signatures are present, finalise it and extract the signed transaction.
4. **Broadcast online.** Send only the signed transaction to the Bitcoin network. The PSBT is a hand-off format for signing, not the object broadcast.

The online tracker and watcher never touch a spending key. A watcher compromise alone cannot spend funds; it can at most misreport them, which reconciliation must catch.

Descriptors and PSBT are Bitcoin ecosystem standards, not Bawa features; Bawa's tools do not build or sign PSBTs.
## 5. Payment requests are not payments

Separate the payment request you give the payer from the transaction you later observe. A payment request is not on-chain settlement.

For Bitcoin payment URIs, use [BIP-321](https://github.com/bitcoin/bips/blob/master/bip-0321.mediawiki). For Ethereum, use ERC-681 payment-request URLs, which can represent chain and token information.

Build an explicit payment request with the asset, network, recipient, amount, expiry and memo/tag when required. Later, verify the payment independently against the blockchain. Do not treat the request itself as proof of payment.

## 6. Source-of-truth drift

Keep Bawa as the canonical reference and single source of truth for wallet-generation and derivation code. Package and deploy that code into the application.

If you copy wallet tooling into the application’s own tools directory, treat the copied deployment artefacts as generated outputs where practical. Do not edit the Bawa copy and the application copy independently: they can eventually derive or validate addresses differently.

Keep application-specific payment tracking in the application: orders, payment records, quoting, allocation, matching, confirmations, reconciliation and fulfilment.

## 7. What this means for the whole architecture

Use a two-layer mental model for your HD-wallet architecture.

**WALLET / KEY LAYER**

```text
entropy → mnemonic → deterministic key tree → account-level public root
```

**APPLICATION LAYER**

```text
public root → address allocation → payment request → blockchain observation
  → payment matching → confirmation/finality → idempotent claim
  → fulfilment → reconciliation
```

Keep wallet and key derivation separate from application payment tracking.

Model at least these payment states:

```text
requested → address/memo assigned → observed → matched
  → underpaid/sufficient → confirmation/finality → claimed
  → fulfilled → reconciled
```

Treat an on-chain observation as evidence to validate. Do not treat it as automatic authorisation to fulfil an application order.
## 8. Asset identity and Trust Wallet metadata

For token payments, do not use a symbol alone as the asset identity. Persist at least:

- Network/chain ID.
- Asset type.
- Token contract / chain-specific address.
- Expected decimals.
- Recipient.
- Amount in atomic units.
- Memo/tag where required.

Treat Trust Wallet Assets as an optional metadata source for presentation, token lists and logos, not as the source of truth for observed payment settlement. Make your payment matcher verify the actual chain event against your application's requested network and asset identity.

See `docs/12` (Chain Registry and Asset Metadata) for the registry treatment.

## 9. From payment request to allocation

Use wallet tracking to determine what an address owns; use payment tracking to determine whether an observed blockchain event satisfies a particular request. Holdings are not payments, and allocation is not payment evidence.

Follow this flow: **request → allocation → observation → confirmation → reconciliation**.

### Define the request

Represent the following information in each request. These are conceptual fields, **not documented Bawa API keys**; Bawa does not define a payment API.

| Conceptual field | Required information |
| --- | --- |
| network | The request's network. |
| asset | The requested asset. |
| recipient | The intended recipient. |
| amount | The requested amount **in atomic units**. |
| memo/tag | The request's memo or tag information, where the chain supports one. |
| expiry | The request's expiry. |

Before accepting payments, define your application's request schema: field types, network/asset identifier formats, amount validation and conversion, memo/tag optionality and how to represent its absence, and expiry format and exact boundary rules. Bawa does not document these schema details. Represent the memo/tag field explicitly even when it does not apply.

Decide whether the caller provides the recipient or your application assigns it, and define how selection relates to address allocation. Bawa does not document who selects the recipient. Represent the recipient unambiguously in the request before allocation.

### Set the allocation policy

Put these application policies in place before accepting payments. They are not Bawa features.

| Condition | Application policy |
| --- | --- |
| Request information represented | Validate against your application's schema, then allocate. Treat allocation as the next application stage, not a payment conclusion. |
| A field missing or ambiguous | Reject rather than choosing a default. Define how callers can correct and resubmit; Bawa does not document correction behaviour. |
| Recipient already has holdings | Do not treat holdings alone as evidence that an event satisfies this request. |
| Recipient shared or previously allocated | Use one address per request where possible. If you share an address, distinguish requests with a memo/tag or use a unique address instead. Never use holdings alone. Define further address-reuse and exclusivity rules. |
| Allocation retried or attempted concurrently | Make allocation idempotent with a request/allocation identifier and atomic reservation, so a retry reuses the same allocation. |
| Expiry reached | Treat events after expiry as late payments for manual review, not automatic finalisation. Define an allocation cut-off; Bawa does not document one. |
| A blockchain event observed | Match the event to the request and apply the chain's confirmation policy before idempotent finalisation. Configure that policy per chain before accepting payments. Do not use allocation as a replacement for matching or confirmation. |
| An event duplicated or a temporary outage occurs | Count each distinct matched event once, not each watcher delivery. Ensure reconciliation does not double-count or lose a payment. Define persistence, replay and recovery mechanics; Bawa does not document these. |
| The confirmed amount differs from the request | Treat the difference as a discrepancy. Accumulate top-ups only if your application's own policy allows it. |
| A payment is ready for finalisation | Compare the request terms, distinct accepted events and stored outcome under the chain's confirmation policy. Do not silently overwrite a stored outcome that disagrees with the evidence. |
## 10. Observation, confirmation, reconciliation

Do not treat holdings as payments. Require evidence that satisfies a particular request, not merely a balance change.

Follow this conceptual flow:

Observation → match request and allocation → confirmation policy → confirmed evidence → reconciliation → idempotent finalisation.

Reconcile against your application/database. Bawa does not define a payment API; define your application's policy before accepting payments.

### Decision gate

Use these proposed application checks as payment-tracking policy, not as Bawa features, software output or claims about any example's implementation.

| Condition | Application check |
| --- | --- |
| Only holdings are known | Draw no payment conclusion from the balance alone. |
| The event does not match, or allocation is ambiguous | Do not attach the event automatically to a request. |
| A match is established, but the confirmation policy is not satisfied | Retain the evidence, but do not finalise. |
| The same event arrives again | Count at most one contribution from that event. |
| The confirmed amount differs, or timing is unresolved | Treat this as a discrepancy, not automatic acceptance. |
| An event arrives after expiry | Treat it as a late payment for manual review, not automatic finalisation. |
| Top-ups arrive | Accumulate them only if your application's own policy allows them. |
| Match, confirmation and amount agree | Compare with the stored outcome before any new finalisation effect. |
| Chain data is unavailable | Treat this as uncertainty, not proof of non-payment. Account for the missing interval during recovery. |

### What reconciliation compares

Compare three sides:

1. The request terms.
2. The distinct, matched events accepted by the confirmation policy.
3. The stored finalisation outcome.

Calculate the confirmed amount from distinct accepted events, in atomic units—not by counting watcher deliveries.

Make repeated reconciliation add no further credit. If the stored outcome disagrees with the evidence, keep that disagreement as a discrepancy; do not silently overwrite the outcome.

### Worked example

Keep this example conceptual: placeholders only, no signing or funds. Assume `<EVENT>` is the only distinct matching event and meets an explicitly defined application timing rule.

- `<REQUEST>` (network, asset, recipient, amount `<AMOUNT_ATOMIC>`, memo/tag `<MEMO_OR_TAG>`, expiry `<EXPIRY>`) → `<ALLOCATION>` → `<RECIPIENT>`.
- `<EVENT>` → matching transfer of `<AMOUNT_ATOMIC>`.

Work through these review steps:

1. **Observe `<EVENT>` for `<REQUEST>`.** Retain it as matching evidence, not yet a finalised payment.
2. **Receive `<EVENT>` again before confirmation.** Keep one evidence item; add no amount for the duplicate.
3. **Lose the chain feed, then resume observation.** Account for the unavailable interval during recovery, including missed observations. Do not discard the payment because of the outage alone.
4. **Recheck `<EVENT>` against `<CONFIRMATION_POLICY>`.** Proceed to reconciliation only if the policy is satisfied.
5. **Reconcile the confirmed evidence.** Use one accepted contribution of `<AMOUNT_ATOMIC>`, agreeing with the request, and check it against the stored outcome.
6. **Finalise, lose the response, then retry.** Resolve the stored outcome first. Do not create a second credit or repeat a finalisation effect.

Keep these two uncertainties separate: missing chain evidence during an outage, and not knowing whether an application update completed after a lost response. Treat neither as a fresh payment.

### Gaps before implementation

Define these application payment-tracking design rules before implementation and before accepting payments:

- Require every request to carry network, asset, recipient, amount in atomic units, memo/tag where the chain supports one, and expiry. Represent all six fields before allocation.
- Reject requests with missing or ambiguous fields rather than using defaults.
- Use one address per request where possible. When requests share a recipient, distinguish them with a memo/tag where supported or assign a unique address.
- Never rely on holdings alone.
- Make allocation idempotent with a request/allocation identifier and an atomic reservation, so a retry reuses the same allocation.
- Configure a confirmation policy for each chain before finalising.

Bawa does not document stable event identity, confirmation thresholds, reversal handling, durable storage, atomic finalisation or replay interfaces. Define and document these choices in your application, including how to recover missed observations, before turning these checks into an executable recovery runbook.

No commands or implementation guarantees are implied here.
## 11. Payment requests describe intent

A request records what your application expects to receive. Creating, displaying or scanning it moves no funds, proves no receipt and fulfils no order.

### Make all six fields explicit

Bawa does not prescribe a payment API. Before accepting payments, define field types, identifier formats, amount validation, memo/tag optionality and exact expiry boundaries in your application. Treat this list as an information checklist, not a serialisation schema.

### Receive QR payloads

Use the approved payload forms below for receive QRs. All profiles are testnet-only.

| Chain | Approved payload | Constraints |
|---|---|---|
| BTC testnet4 | `bitcoin:?tb=<ADDRESS>`, optionally followed by `&amount=<BTC>` (decimal BTC) | [BIP-321](https://github.com/bitcoin/bips/blob/master/bip-0321.mediawiki) supersedes BIP-21. Leave the URI body empty; put the testnet address in `tb`. A BTC URI alone does not establish testnet4: retain the selected network and compare it with the associated request. |
| ETH Sepolia | `ethereum:pay-<ADDRESS>@11155111`, optionally followed by `?value=<WEI>` (scientific-notation wei) | [ERC-681](https://eips.ethereum.org/EIPS/eip-681). The network is explicit in `@11155111`. The amount is a suggestion. No gas parameters, ENS, ERC-20 or function path. |
| TON testnet | `ton://transfer/<TESTNET_ADDRESS>`, with optional `?amount=<NANOCOINS>` (nanocoins) and `?text=<TEXT>` (URL-encoded UTF-8) | A de facto Keeper/Tonhub vendor convention, not a standard. Use `&` between query parameters when both are present. Require the full testnet address presentation; never use `bin`, `jetton` or `exp`. |
| TRX Nile | Bare 34-character Base58 address beginning with `T` | No `tron:` payment URI exists to prescribe. The amount stays outside the QR. Nile identity comes from wallet configuration, never from the address. |

For TON, use a full testnet address presentation, such as `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo` or `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt`, never the `UQC7…` mainnet presentation.

Keep the six-field application request separate from the QR payload. Serialise only the fields allowed by the Receive QR payloads table. Retain fields not carried by that payload in the associated request, display them with the request, and communicate them separately when the payer needs them. Do not encode the checklist as an application-specific six-field QR object.

A supported amount-less payload, including TRX's address-only form, is not by itself a complete six-field request. If a scan has no associated request metadata, leave missing fields unavailable rather than assigning defaults or claiming they were verified.

Field mapping: network — BTC `tb` carries a testnet address but does not establish testnet4 (retain the selected network and compare); ETH explicit `@11155111`; TON required testnet address presentation; TRX not carried (wallet configuration). Asset — fixed by each profile (BTC/ETH/TON native only; TRX supplied from context). Recipient — carried by all four. Amount — BTC decimal BTC, ETH scientific-notation wei, TON nanocoins, TRX not carried. Memo/tag — TON `text` only; otherwise not carried. Expiry — not carried by any approved form; it lives in the request record and the request details outside the QR. "Not carried" means not carried by these approved Bawa output forms, not that an underlying protocol lacks the capability.

**Verification contract.** `P.renderAndVerifyQr` constructs the approved payload, encodes it with the explicit error-correction setting below, decodes the actual QR output used by the UI, requires the decoded text to equal the intended payload, then calls `E.parsePaymentRequest` and `E.verifyPaymentRequest`. `P.scanPaymentRequest` supplies the decoded scanned text to `E.parsePaymentRequest`, then to `E.verifyPaymentRequest`. Do not require an external scan to equal a locally generated string. `E.verifyPaymentRequest` checks parsed fields against the approved profile, selected wallet context and any associated request record. Its result must distinguish encoded information from information supplied by configuration or the request record.

Shared checklist: (1) bind the context — selected network, asset, expected recipient, and the associated six-field request when available; (2) check actual output — for rendering, decode the actual QR, not the encoder input string, and require an exact text match; (3) parse, then verify — do not let normalisation discard information needed to reject prohibited duplicate parameters; (4) compare represented fields — recipient, network and asset against the expected context to the extent the payload represents them, applying the external-context rules where it does not; (5) preserve amounts and memo text — compare carried amounts with the intended request using exact atomic-unit values, without rounding, and compare carried memo text where present; do not interpret an omitted amount as zero; for ETH verify the encoded suggestion against the intended suggestion and display its full value including order of magnitude; (6) handle off-QR information explicitly — check the associated request's expiry and reject expired requests; if no expiry or other metadata was supplied, report it as unavailable, not as verified from the QR; (7) reject failures without fallback — do not silently substitute a bare address after an encoding, decoding, parsing or verification failure, and do not turn successful verification into a "paid", "received" or "order fulfilled" state.

Per-chain verification:

| Chain | Required verification |
|---|---|
| BTC testnet4 | Require the empty-body `bitcoin:?tb=...` form. Reject `bitcoin:tb1q...` and bare `tb1q...`. Reject the whole URI for an unknown `req-` key. Reject duplicate `amount`, `label`, `message` or `pop` before normalisation can overwrite them. Interpret `amount` as decimal BTC. Compare the full decoded recipient against the selected testnet4 address; do not infer testnet4 from the URI alone. |
| ETH Sepolia | Require `ethereum:pay-<ADDRESS>@11155111`, with the mandatory chain ID. Reject a missing or different chain ID, function paths, ENS, gas parameters and ERC-20 forms. Interpret `value` as scientific-notation wei. Display the complete suggested value, retaining its order of magnitude. |
| TON testnet | Require `ton://transfer/` and the testnet address form (full `kQC7...` / `0QC7...` forms); never accept the `UQC7...` mainnet presentation for this profile. Apply the supplied nanocoin amount or text variant. Reject `bin`, `jetton` and `exp`. Compare the recipient with the selected testnet recipient. |
| TRX Nile | Require the entire payload to be a bare 34-character Base58 address beginning with `T`; no scheme or amount query. Compare the recipient with the expected address. Establish Nile from wallet configuration, never from the address. Keep the amount outside the QR. |

Add round-trip tests for every emitted variant and rejection tests for every listed invalid form.

**Nile testnet — native TRX only.** This QR contains only an address, not a network selection. Before sending, confirm that the sending wallet is configured for Nile. Do not assume that scanning will switch a mainnet wallet to Nile.

Set QR error correction explicitly to M. Do not rely on an encoder default. Decode and verify the actual output before presenting it as verified.


| Field | Meaning | When missing |
| --- | --- | --- |
| Network | Chain on which payment is expected. | Reject — do not infer the network from an address or wallet setting. |
| Asset | Native currency or specific token expected. | Reject — do not assume the chain's native currency. |
| Recipient | Destination that must receive the funds. | Reject — do not substitute a default wallet address. |
| Amount in atomic units | Quantity in the asset's smallest units. | Reject — do not derive it from a balance or accept an arbitrary amount. |
| Memo/tag where supported | Chain-specific routing/reference information. | Reject omission. For unsupported chains, represent “not applicable” explicitly in your model. Where supported, define whether an explicit empty value is allowed. |
| Expiry | Time limit for satisfying the request. | Reject — do not interpret absence as unlimited validity. |

Reject ambiguous values too. Do not turn incomplete instructions into apparently valid requests by guessing.

### Treat instructions as instructions, not receipts

BIP-321 describes Bitcoin payment instructions using `bitcoin:<RECIPIENT>`, with parameters including `amount`, `label` and `message`. The wallet presents the amount as a suggestion to the payer; the URI cannot enforce settlement.

ERC-681 describes Ethereum transaction requests using `ethereum:<TARGET>[@<CHAIN_ID>][/transfer]`. Native-currency requests express `value` in wei. ERC-20 requests use `/transfer`, with `address` for the recipient and `uint256` for the atomic amount. The format has no invoice-reference field, so an ERC-20 `Transfer` log cannot by itself identify the invoice being paid.

Use these formats to communicate what to send. Neither establishes that the requested transfer happened.

### Keep three objects separate

- **The request:** store the intended terms. Your application may identify it with `<REQUEST_ID>`, but that identifier is not automatically carried on-chain.
- **The on-chain event:** assess the evidence and associate it with a particular request. Check its network, asset, recipient, atomic amount and applicable memo/tag, then apply your expiry rules. A wallet's holdings cannot show that a particular event meets those terms.
- **The fulfilled order:** record the business outcome after your application has accepted payment evidence and completed fulfilment. A matching transfer does not itself deliver goods, provide a service or update the order.

Keep explicit links between these objects. Do not treat the existence of one as proof that the others exist. Creating a valid `<REQUEST_ID>` leaves it awaiting payment; creation alone records neither receipt of funds nor order fulfilment.

### Allocate addresses in your application

Bawa exposes public roots for watch-only address derivation; it does not assign addresses to payment requests. Define application policy for choosing an address, recording its reservation and making retries safe.

#### Prefer a separate address

Allocate a separate derived address to each request where practical. Attach the allocation to `<REQUEST_ID>` and keep the network, token, expected amount, expiry time and payer instructions in the request record. A bare recipient address makes reconciliation fragile without that invoice state.

#### Handle shared recipients explicitly

If requests share `<RECIPIENT>`, allocate a distinct `<MEMO_OR_TAG>` to each request and require it in the payment instructions. Use this approach only when the payment mechanism carries that field and your tracking can read it; otherwise, use a dedicated address.

For standard ERC-20 transfers, the recipient and amount arrive without an invoice identifier. A note on your invoice does not become a memo in the transfer event, so a shared recipient alone cannot identify the request.

#### Make allocation idempotent

Use `<REQUEST_ID>` as the stable allocation key. Return its stored allocation if one already exists. Otherwise, reserve an available target and save the request mapping in one atomic transaction.

Enforce uniqueness on both:

- The request key.
- The allocation target: the address for dedicated allocations, or the recipient/tag pair for shared allocations.

If concurrent calls for the same request race, return the committed allocation rather than creating another one.

```text
First attempt: <REQUEST_ID>
Atomic reservation: <REQUEST_ID> -> <RECIPIENT>
Return: <RECIPIENT>

Retry: <REQUEST_ID>
Stored allocation: <REQUEST_ID> -> <RECIPIENT>
Return: <RECIPIENT>
```

On retry, retrieve the saved address along with any memo/tag. Do not reserve a second address just because the caller did not receive the first response.

An allocation is not evidence of payment. Funds already held at `<RECIPIENT>` do not prove that a particular event fulfils `<REQUEST_ID>`. Keep event matching and payment confirmation as separate requirements.

Make every allocation retry for `<REQUEST_ID>` return the same `<RECIPIENT>` and leave exactly one stored reservation.

### Payment lifecycle state machine

Own this lifecycle in your application; Bawa does not enforce these transitions. Append each change with its time, reason and evidence reference. Do not treat a transaction report alone as permission to fulfil.

Start at `requested`. Enter `allocated` once the request has its receiving address or memo. Capture a report at `observed`, record basic validation at `seen`, then bind validated network, asset, destination and memo evidence to `<REQUEST_ID>` at `matched`.

Apply one progression rule: **do not skip any state to reach finalisation** — process every applicable stage in order, even when evidence for several stages arrives together.

Allow these transitions:

```text
requested -> allocated -> observed -> seen -> matched -> sufficient -> included -> confirmed -> finalized -> paid -> claimed -> fulfilled -> reconciled
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

Also allow these conditional routes:

- When the acceptance deadline passes, allow `observed`, `seen`, `matched`, `sufficient`, `included`, `confirmed` and `reorged` to enter `expired`.
- For ambiguous or contradictory evidence, allow `observed`, `seen`, `matched`, `underpaid`, `sufficient`, `included`, `confirmed`, `reorged`, `finalized`, `paid` or `claimed` to enter `manual_review`.

Treat these routes as exhaustive. Keep the request in its current state when a duplicate report arrives.

### Checks and exception handling

#### Follow normal progression

- At `matched`, compare the validated total with the requested amount and choose `underpaid` or `sufficient`. Route top-ups back through `observed` for validation and matching.
- Require canonical block inclusion before entering `included`.
- Require the configured confirmation depth before entering `confirmed`.
- Require the chosen chain-finality test to pass before entering `finalized`.
- At `paid`, record application acceptance.
- At `claimed`, record an exclusive, durable fulfilment reservation.
- At `fulfilled`, record completed delivery.

#### Handle `confirmed -> reorged`

When the supporting block leaves the canonical chain, enter `reorged` and invalidate its confirmation credit without deleting its history. If the transaction reappears, return through `observed`, repeat matching and amount checks, then rebuild inclusion, confirmation and finality evidence.

#### Handle `allocated -> expired`

When the acceptance deadline passes, record expiry and retain the address/memo mapping. Stop automatic acceptance, but keep monitoring. Do not treat a later receipt as making the request retrospectively timely.

#### Handle `expired -> late`

Record newly discovered payment evidence as `late`, then enter `manual_review`. Do not finalise automatically.

From `manual_review`, restart only an unfulfilled request at `observed`, following a recorded approval that explicitly covers any deadline exception. Take the restarted request through every normal check. Do not jump directly from review to `finalized`, `paid` or `fulfilled`.

#### Handle `fulfilled -> disputed`

Append the dispute while preserving the delivery record and original stored result. Keep contrary evidence alongside them and flag the disagreement as a discrepancy. Continue into `manual_review`.

Do not silently replace the result or repeat delivery. Do not restart the payment route during post-fulfilment review.

#### Close at `reconciled`

Compare the evidence with the recorded outcome and retain the audit decision. Before closing from `manual_review`, require either:

- A documented decision not to fulfil.
- Resolution of an already-fulfilled order's dispute.

Keep unresolved discrepancies under review. Retain resolved discrepancies and their original evidence.

Treat `reconciled` as terminal audit closure, not another word for successful payment. Allow no outgoing transitions. For later findings, create a linked review case rather than rewriting the closed record.

**Expected:** an ordered history for `<REQUEST_ID>`, with every required check recorded, late payments routed to review, and no fulfilment authorised by observation alone.
## 12. Observation and chain-specific matching

Deduplicate observations using a chain-specific event key, then require an unambiguous link to a payment request. Compare the destination, asset and atomic amount with the request, validate the fields below, and apply your confirmation/finality policy before accepting a match.

### Bitcoin

Read transaction outputs from a node or a node-backed address indexer.

- Use `(<CHAIN>, <TXID>, <OUTPUT_INDEX>)` as the event key.
- Allocate a separate address to each request.
- Verify the network, transaction ID, output index, destination script/address and atomic amount, then check block inclusion and confirmation depth.
- Use the assigned address to identify the request and the output key to identify the payment observation.

Treat a mempool output as an attempted payment, not confirmation. Block inclusion can still be reversed by a reorganisation. Identify the particular paying output; do not substitute an address balance for that identification.

### EVM tokens

Use `eth_getLogs` on the intended network, filtering by the expected token contract and ERC-20 `Transfer` signature.

- Use `(<CHAIN_ID>, <TX_HASH>, <LOG_INDEX>)` as the event key.
- Verify the node's chain ID, emitting contract, event signature, sender, recipient, atomic token amount, transaction hash, log index and block number/hash.
- Enforce any sender restriction.
- Reject non-canonical logs and logs whose `removed` flag is `true`.
- If an accepted log is subsequently removed, invalidate that observation and reassess the request.

Distinguish the block views and removal signal:

- `latest` follows the current head without guaranteeing finality.
- Where supported, `safe` denotes a justified view that remains reorganisable in principle.
- `finalized` reflects acceptance by over two-thirds of validators.
- A `removed` flag set to `true` reports removal during a reorganisation.

Give each request its own deposit address. A standard token-transfer event contains no invoice reference: a shared recipient and matching amount do not establish unique invoice attribution.

### TRON

Read indexed transaction records and contract events, including execution results and block/finality state.

- For token events, use `(<NETWORK>, <TXID>, <EVENT_INDEX>)` as the event key. Use a stable transaction-local event position for `<EVENT_INDEX>`, never a pagination offset.
- For native transfers, use `(<NETWORK>, <TXID>, <CONTRACT_INDEX>)` in a separate namespace. The contract index identifies the transfer operation within the transaction.
- Check the network, transfer contract/type, recipient, atomic amount, successful execution, block number/hash and confirmed or solidified state.
- For tokens, also verify the expected token contract and decoded transfer event.

If several requests fit, do not guess. Treat an indexed transaction as evidence of visibility, not successful execution or finality. Do not treat a latest-block result as solidified merely because the indexer returned it.

### TON

Read the receiving account's transactions and inbound messages through a node/API or indexer.

- Use `(<NETWORK>, <ACCOUNT_ADDRESS>, <LT>, <TX_HASH>)` as the native-receipt key. `<LT>` is the receiving transaction's logical time.
- Check the network, exact recipient, inbound atomic value, transaction identity, execution/bounce outcome and block/finality state.
- Verify a credited, non-bounced inbound payment. Do not treat a sender-side transaction alone as proof of receipt.
- Use a dedicated address to identify the request. For a shared address, require the exact assigned comment/memo as part of the request-matching key. Do not use the memo in place of transaction identity.
- Retain the wallet contract type and wallet ID used to derive the address. Recreating the wallet with different settings can produce a different destination.

If you cannot reach a chain feed, leave the outcome unknown. Missing observations do not establish that nothing was paid.

**Expected:** repeated polls produce one record per qualifying event, tied to one request, with validated fields and a recorded confirmation/finality state.

### Confirmation thresholds

**ILLUSTRATIVE application policy — not Bawa behaviour.** Choose your own value bands, risk limits and waiting times; never transplant these thresholds blindly. Treat “confirmed” as meaning that your policy passed, not that reversal is impossible.

For BTC, count blocks, including the inclusion block. Elsewhere, **1** means one successful event inclusion satisfying the stated chain condition.

| Chain | Low | Ordinary | High |
| --- | --- | --- | --- |
| BTC | **1** — avoids mempool-only acceptance; reversal risk remains. | **3** — lower end of the deposit range, balancing delay and risk. | **6** — more accumulated work protects larger exposure, but remains probabilistic. |
| EVM (Ethereum) | **1 `latest` inclusion** — accepts head-reorg risk for small amounts. | **1 `safe` inclusion** — stronger consensus assurance than the latest head. | **1 `finalized` inclusion** — requires protocol finality for larger exposure. |
| TRX | **1 successful inclusion** — faster, but explicitly provisional. | **1 solidified inclusion** — waits for the protocol's quorum. | **1 solidified inclusion plus independent verification** — same finality, better protection against faulty node data. |
| TON | **1 verified masterchain anchor** — uses protocol finality rather than arbitrary depth. | **1 verified anchor** — ordinary value does not change the finality rule. | **1 verified anchor plus independent verification** — checks observation errors rather than inventing extra finality. |

For BTC, retail guidance gives **0–1**, deposits at exchanges **3–6**, and major settlements **6+**. More depth reduces reversal probability; a displaced transaction can later return in another block.

Treat Ethereum's views as gates, not fixed depths: verify that the payment block belongs to the chosen view. Use separate settlement rules for other EVM networks, including upstream finality where relevant.

For TON, require a verified finalised masterchain reference covering the payment's shard block; this is the anchor.

Apply TRON's confirmation rules: solidification requires block production by at least **19 different Super Representatives**, each at the target height or higher. This usually takes roughly a minute on mainnet. Broadcast `true` acknowledges completion of the call, not inclusion, execution success or solidification. Check that `contractRet` is `SUCCESS` separately.

### Reorg handling

Keep observation status (`seen`, `included`, `confirmed`, `finalized`, `reorged`) separate from business status (`expired`, `late`, `manual_review`, `paid`). Persist event identity, block hash and height, claim linkage and policy version.

Compare stored block hashes with the canonical chain. Do not rely solely on removal notifications.

When an event is removed:

- For `seen` or `included`, retain the removed block observation as `reorged` and withhold acceptance. Return to `seen` only after you actually observe the transaction pending again.
- For `confirmed`, mark it `reorged`, revoke eligibility and freeze outstanding fulfilment. Reverse provisional credits through compensating entries, preserving the confirmation history.
- If the event is claimed or `paid`, suspend the claim’s chain backing while retaining its allocation and audit trail. Block duplicate settlement. If goods have already been delivered or a payout is irreversible, trigger `manual_review`. Changing a database flag cannot undo an external action.

If an event is removed from a `finalized` or solidified view, also pause automated settlement and trigger `manual_review` with independent verification.

For ordinary reorg recovery:

1. Find the common ancestor, rewind the scan cursor and replay canonical blocks.
2. Reconcile pending and replacement transactions, then re-match idempotently.
3. If `<TXID>` returns, verify its new block hash and execution. Rebuild depth from its new inclusion and reapply the threshold.
4. Reassess `expired`/`late` status against the original deadline before restoring eligibility.

**Expected:** Removing a `confirmed` test event suspends acceptance; its canonical return restores eligibility only after policy checks, without duplicate credit or fulfilment.

### Amounts, top-ups and expiry

Use `<CONFIRMED_ATOMIC>` as the watcher’s combined value of transfers matching a deposit. Each accepted event contributes its atomic-unit amount once, however often its notification arrives.

Define the amount policy in your application. Calculate with integers in the requested asset’s atomic unit; convert only for display. Choose and document `<TOLERANCE_ATOMIC>` as a non-negative value smaller than `<EXPECTED_ATOMIC>`. Choose zero if no shortfall is acceptable.

Set:

```text
<THRESHOLD_ATOMIC> = <EXPECTED_ATOMIC> - <TOLERANCE_ATOMIC>
```

The amount check passes when `<CONFIRMED_ATOMIC> >= <THRESHOLD_ATOMIC>`. Apply timing rules and top-up permission as well. This threshold belongs to your application, not a wallet specification.

Calculate `<SHORTFALL>` as `<EXPECTED_ATOMIC> - <CONFIRMED_ATOMIC>` and `<EXCESS>` as `<CONFIRMED_ATOMIC> - <EXPECTED_ATOMIC>`, clamping each at zero. Keep any tolerated shortfall visible; acceptance does not rewrite the received amount.

For these worked amounts, assume the events match `<REQUEST_ID>` and are accepted before expiry. The examples use Bawa totals with application-policy outcomes; the two-part example assumes top-ups are enabled.

- **Exact:** One accepted transfer of `<EXPECTED_ATOMIC>` gives `<CONFIRMED_ATOMIC> = <EXPECTED_ATOMIC>`. Shortfall and excess are zero; the amount qualifies.
- **Underpaid:** One transfer of `<EXPECTED_ATOMIC> - <SHORTFALL>`, where `<SHORTFALL> > <TOLERANCE_ATOMIC>`, leaves the total below `<THRESHOLD_ATOMIC>`. Keep the request underpaid while its window remains open.
- **Overpaid:** One transfer of `<EXPECTED_ATOMIC> + <EXCESS>`, with positive `<EXCESS>`, clears the threshold. Record the excess separately.
- **Two-part top-up:** `<PART_A_ATOMIC> = <EXPECTED_ATOMIC> - <SHORTFALL>` remains insufficient when `<SHORTFALL> > <TOLERANCE_ATOMIC>`. A separate accepted event of `<PART_B_ATOMIC> = <SHORTFALL>` completes the amount: `<CONFIRMED_ATOMIC> = <PART_A_ATOMIC> + <PART_B_ATOMIC> = <EXPECTED_ATOMIC>`.

Allow multiple transfers to settle a request only when top-ups are enabled. For these examples, treat a timely, confirmed overpayment as fulfilling the request without an automatic excess refund.

### Expiry and late payments

Define expiry and late-payment handling as application policy. Record a deadline for `<REQUEST_ID>` and retain the record after expiry. Your deadline does not stop blockchain transfers.

Distinguish these states:

- No funds yet.
- A deposit awaiting confirmation.
- Full payment.
- Excess payment.
- Partial payment while the window is open.
- Underpayment after closure.

Give partial, late and excess payments separate statuses rather than one paid/unpaid flag.

Use this expiry flow:

`pending` → `deadline passes before acceptance` → `expired` → `new matching payment found` → `late payment found` → `manual review`

Route newly discovered payments on expired requests to manual review, even when their value brings the total above the threshold. Do not finalise automatically.

Before deciding, check:

- The request, deposit and asset match.
- Event uniqueness, acceptance and confirmations.
- The total, tolerance and top-up permission.
- Payment and discovery times against the deadline.
- Earlier fulfilment or refunds, and whether fulfilment remains possible.

Release only when the amount meets policy and late acceptance is authorised. If fulfilment cannot proceed, refuse it and record the reason and your decision about the received funds.

Refund only an authorised amount to an independently verified destination under the documented fee policy. A refund requires a new transfer. Record the outcome.

Move `<REQUEST_ID>` to manual review when a late top-up is found, even if the total meets `<THRESHOLD_ATOMIC>`. Leave `<CONFIRMED_ATOMIC>` unchanged if that event is delivered again.

### Price quotes as payment state

Define quote policy in your application; it is not a Bawa feature. Bawa does not define a price API.

Freeze a quote snapshot into the payment request before presenting the amount. Keep live price collection separate from payment calculation and blockchain watching. Use the frozen amount in the watcher; do not let a market move change what the payer was asked to send.

Preserve these seven fields together:

1. **Quote timestamp:** Record the time the quoted rate refers to. Use it to establish the quote’s age and pricing moment. Do not give a cached rate a fresh timestamp when you read it.
2. **Price source:** Record the provider and feed or currency pair used, so you can identify where the rate came from when providers disagree.
3. **Quoted price:** Store the exact conversion rate, including currencies and direction, so both sides can reproduce the calculation.
4. **Quoted atomic amount:** Store the exact integer amount requested, so what the payer was asked for remains clear regardless of decimal formatting.
5. **Expiry:** Record the limit of the quote’s validity to show how long the rate was offered. Do not leave an open-ended price promise.
6. **Rounding rule:** Record the precision, direction and stage of rounding to explain any smallest-unit difference between the conversion result and the payable amount.
7. **Acceptance/tolerance rule:** Record the permitted deviation, if any, and its units. Do not choose acceptance standards after seeing the payment.

Document rounding and tolerance as application policy, then preserve the applied rules with each quote. Apply rounding when calculating the atomic amount, not when displaying it.

Store amounts as integers in the relevant atomic unit: BTC satoshis, EVM token base units, TRON token/base units or TON nanotons. Use human-readable decimals for presentation only; do not let formatting determine what is owed or tolerated.

Re-pricing during a payment check breaks the link between the amount requested and the amount assessed; the stored request can no longer explain the decision. Re-quote only where explicit business rules, disclosed to the payer, allow it. Record the replacement quote as a new request term, retain the previous snapshot and make the changed terms visible to the payer. Never silently overwrite the original quote.

Set a freshness limit for prices used at request time. If the feed is unavailable or stale and no fresh snapshot is available, either withhold the request or use an existing snapshot under a documented stale-quote policy. If you use a stale snapshot, clearly mark the quote as stale to the payer, show its age and retain its original timestamp. Never invent a replacement price.

During watching, switch to a fallback feed only for new market data. Do not alter the frozen quote, including its recorded source, rate or atomic amount. Feed failover is not a re-quote.
## 13. Duplicate payments, disputes and refunds

Treat everything in this section as application policy, not Bawa behaviour.

### Make finalisation replay-safe

Expect repeat observations from polling, retries, restarts, duplicated webhooks, rescans, multiple workers and indexer replays.

1. Observe the transfer and establish its identity using the network, `<TXID>` and the relevant output or log index. Identify the actual transfer; do not rely on a callback identifier alone.
2. Persist the event and claim fulfilment atomically in a database transaction. Enforce a unique event constraint on the transfer identity and use a conditional claim on `<REQUEST_ID>`.
3. Let only the successful claimant fulfil and then record the final state. Make other workers consult the existing state instead of starting another fulfilment.

Commit local credit atomically with its outcome. For external fulfilment, use a durable outbox and an idempotent receiver. Do not dispatch goods again when a `paid` notification is replayed.

### Resolve stored outcomes after a lost response

If finalisation completes but its response is lost, resolve the stored outcome first on retry. Return a matching result without another credit or repeated finalisation effect.

If any saved outcome contradicts the evidence, preserve both and flag a discrepancy for review. Do not quietly replace the result.

### Distinguish extra money from replay

Retain every distinct transfer. Route an overpayment, or a second distinct payment against `<REQUEST_ID>`, to review or an overpaid state rather than ordinary settlement.

Use idempotent invoice creation to prevent accidental reissue, and reconciliation to detect multiple payments.

### Keep evidence for disputes and refunds

Keep the request’s agreed asset, network, amount and destination alongside transaction evidence, confirmation status and the claim, credit and fulfilment history. Append review decisions and their reasons without erasing earlier evidence.

- **Wrong asset:** Hold the payment for review. Compare the requested and received asset identifiers, including token contract identifiers where relevant, against transfer logs or outputs. Record the amount and asset precision. Do not rely on matching names or tickers.
- **Wrong network:** Do not automatically settle the intended-network request. Give the reviewer the expected and observed chain identifiers, transaction evidence, destination and confirmation status, plus evidence that the operator controls the funds on the observed chain.
- **Wrong amount:** Compare the expected amount with the total of distinct eligible transfers, counting each once and using consistent asset units. Retain the calculation, precision and agreed fee or tolerance rules. Hold shortfalls for review and explicitly flag excess funds as overpaid or under review.
- **Sender unknown:** Do not automatically return funds to a transaction’s source address; it may be a service wallet. Require authenticated claimant evidence linked to `<REQUEST_ID>` and `<TXID>`, corroborating payment records and verified return instructions. Do not treat transaction visibility alone as proof of entitlement.

### Refund through a separate payment

Treat each refund as a fresh outgoing payment requiring independent authorisation. Leave the original payment record unchanged. Create a linked refund record with its own approval, status and eventual `<REFUND_TXID>`.

Require the approval to cover the asset, network, destination, amount and fees. Verify custody and recovery feasibility before promising repayment, particularly for wrong-asset or wrong-network cases.

Apply atomic claiming and idempotent execution to refunds too, so a retry cannot send another payment.

**Expected:** Replays and a lost-response retry leave one credit and one fulfilment; distinct extra funds remain flagged, and any refund has separate approval and a linked outgoing-payment record.
## 14. Watcher and reconciler

Use the watcher to report current observations. Use the reconciler to replay a bounded chain range, check persisted state, and restore omitted entries or correct obsolete ones. Keep the watcher catching new activity beyond the replay's endpoint; use the reconciler to catch missed payments and reorganisation-related changes within its range. Do not treat fresh observations as proof that earlier database history is correct. Watch frequently and reconcile periodically.

Retain each chain's native cursor:

- **Bitcoin:** the most recent relevant block/transaction position.
- **EVM:** the processed block height.
- **Solana:** the slot plus signature.
- **XRPL:** the ledger index plus transaction.
- **Cosmos:** the height plus pagination state.

Store the height reached by the latest successful reconciliation, or its chain equivalent, separately from watcher progress. Advance it only when the whole range succeeds and writes are durable. After downtime, restart from a conservative earlier boundary. Do not substitute timestamps for chain cursors.

### Three-sided check

Choose confirmation requirements, amount tolerances and late-payment treatment. Check the request's recorded terms against unique matching events that satisfy the confirmation policy, then compare the resulting entitlement with the saved finalisation outcome.

Recheck individual matches as well as the accepted total. Count each event once: re-observing it must not add its value again.

Commit finalisation atomically with the credit or an outbox entry. Enforce a stable idempotency key for that entitlement, including in downstream consumers. Never generate a fresh credit key per reconciliation run.

### Worked recovery

`<REQUEST_ID>` expects `<AMOUNT>` of `<ASSET>` on `<NETWORK>` at `<DESTINATION>`. The watcher was offline when `<TXID>` paid `<AMOUNT>` at `<HEIGHT>`. The database still records no payment.

1. Replay `<SAFE_HEIGHT>` through `<END_HEIGHT>`, containing `<HEIGHT>`.
2. Find the missing event during replay and restore its record.
3. Check the restored event. It matches the request and meets `<CONFIRMATION_POLICY>`, so the stored outcome needs correction.
4. Record the corrected finalisation and `<CREDIT_ID>` under `<IDEMPOTENCY_KEY>`.
5. Replay the same range a second time. Retain that credit rather than issuing another.

### Audit trail

Maintain an append-only journal with UTC timestamps, source, actor/job identity and schema/software versions. Preserve original decisions when correcting them.

Before scanning, log the run ID, trigger, input checkpoint and range bounds. After durable processing, append the run's comparisons, repairs, errors, completion status and safe checkpoint.

Retain the linked payment records in causal order:

1. **Request:** `<REQUEST_ID>`, creation/revision history, chain/network, asset identifier, base-unit amount, recipient, required memo/tag, validity limits and policy snapshot.
2. **Observation:** `<TXID>`, chain/network and native event/output/log identity, cursor, block/slot/ledger identity, canonicality status, payer/recipient, asset, amount and memo/tag. Keep transaction/receipt and inclusion/checkpoint evidence supporting chain inclusion and confirmations.
3. **Match decision:** request–event link, deduplication key, evaluated confirmations, accepted/rejected/pending status and reason, tied to the policy version.
4. **Reconciliation/finalisation:** accepted event set, total, database before/after values, discrepancy and repair, resulting status and decision reason.
5. **Credit and settlement:** credit ID, idempotency key, journal amount/asset, reversals or adjustments, and allocation to the retained `<SETTLEMENT_LINE_ID>` record, including fees and net value.

Keep enough detail for a reviewer to verify inclusion and policy acceptance at the recorded checkpoint, reconstruct the distinct accepted total, check finalisation and follow the credit into settlement—all from these records alone. Use run history to establish scanned coverage, and credit keys and journal entries to show that replay did not pay twice.

Replay the worked range twice and check that it leaves one accepted event, one credit and a traceable request-to-settlement record chain.

### Watcher loop (generic)

Run the background watcher on a 60-second cycle. Give each deposit check its own error boundary. Do not let one bad deposit, failed chain lookup or broken price feed stop the loop or block other deposits. Do not rely on catching errors only around the whole cycle: that can leave the watcher running while it skips the remaining checks after a failure.

Visit these four branches in this order on every cycle:

1. **Pending or underpaid direct deposits:** fetch transaction data using the chain-specific lookup, match the expected payment and total the matching payments. Apply that chain's confirmation policy. Claim a ready deposit atomically before fulfilling its order; otherwise, leave it pending or underpaid.
2. **Expired deposits:** run a short scan for late payments, then move the deposit into the manual-review state. Leave the order for review rather than treating expiry handling as successful payment completion.
3. **External invoice recovery:** query paid invoices and recover orders whose finalisation is still outstanding. Send these orders through idempotent finalisation, not a separate invoice-only route to fulfilment.
4. **Slow-path pending payments:** run the slow-path lookup for payments still pending. Leave unresolved payments pending and send recovered evidence to the same finalisation path.

In your own watcher, keep the states separate, isolate failures within individual checks, and use the same finalisation gate whenever any branch is ready to fulfil. Distinguish finding evidence, waiting for readiness, holding for review and completing an order.
I can’t check sources live here. The guide paths and Medium URL weren’t supplied, so this draft uses named cross-references and retains your Medium check note.

## 15. Derivation ownership and token identity

Keep Bawa as the canonical home for the derivation explanation and reference implementation. Package the application’s copy from that reference and treat it as a generated deployment output. Never hand-edit the copied tooling in place.

Keep orders, payment records, quoting, address allocation, matching, confirmations, reconciliation and fulfilment in the application. Use Bawa for the reusable derivation reference, not the payment workflow. End the wallet/key layer at the account-level public root. Start the application layer with that root; no step in it needs a spending key.

Treat a token’s ticker as a label, not an asset identifier. Unrelated contracts can share a symbol, including on the same network, and a familiar symbol can appear on several chains. A ticker cannot identify the asset being paid.

For each token payment, persist at least these seven fields:

1. network/chain ID;
2. asset type;
3. token contract or chain-specific asset address;
4. expected decimal precision;
5. recipient address;
6. amount expressed in atomic units;
7. any required memo or tag.

Use Trust Wallet Assets for presentation metadata, token lists and logos, not as evidence that a payment has settled. Base settlement on a verified chain event checked against the requested network and token contract or equivalent asset address. Never accept a matching symbol or metadata entry as settlement evidence.

Keep these three worked procedures in the Web guide §H and Android guide §I, with README §13 cross-links:

- testnet session end to end;
- diagnose an apparently empty wallet;
- run a private local chain and restart it.

Link to those procedures rather than duplicating them here. Do not claim a capability until you have verified it by running it.

## 16. Sources

Use primary sources for technical claims. Check each source live at the time of writing:

- [BIP-174](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)
- [BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki)
- [BIP-321](https://github.com/bitcoin/bips/blob/master/bip-0321.mediawiki)
- [Bitcoin Core output descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)
- [ERC-681](https://eips.ethereum.org/EIPS/eip-681)

Retain the Medium article only as supplementary reading, with this dated check note: “403 to automated checks; existence confirmed 8 November 2026.”
