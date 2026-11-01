# Wallet Tracking

Use this file when you want to watch a wallet without immediately paying for an indexing platform.

# Tracking a wallet for $0

You do not need a paid indexer to start learning.

A completely free personal tracker can be built from:

```text
Bawa-derived public addresses
         ↓
free RPC / public explorer API
         ↓
small local database
         ↓
cron / scheduled poll
         ↓
local dashboard
```

For a personal wallet, this can be enough.

## The cheapest possible setup

### Bitcoin

Use Blockstream's public Esplora API for simple queries:

```text
https://blockstream.info/api/
```

The API exposes address state, UTXOs, confirmed/mempool history and transaction details. See the [Esplora API documentation](https://github.com/Blockstream/esplora/blob/master/API.md).

Example shape:

```bash
curl https://blockstream.info/api/address/<BITCOIN_ADDRESS>
```

### EVM

Use JSON-RPC directly.

At the simplest level:

```text
eth_getBalance
eth_getTransactionCount
eth_getBlockByNumber
eth_getTransactionReceipt
eth_getLogs
```

You can call a public endpoint or a free hosted RPC provider.

The Ethereum JSON-RPC specification is documented at:

https://ethereum.org/developers/docs/apis/json-rpc/

### Solana

Solana publishes public cluster RPC endpoints such as:

```text
https://api.mainnet.solana.com
https://api.devnet.solana.com
https://api.testnet.solana.com
```

But Solana explicitly states that these shared endpoints are not intended for production applications and can enforce rate limits.

Use them for experiments and personal tools, not as a hidden guarantee of production capacity.

### TON

Use the TON-native SDK/HTTP ecosystem rather than trying to force TON through an Ethereum RPC abstraction.

### Cosmos

Use chain-specific RPC/LCD/gRPC endpoints and the Cosmos Chain Registry for the chain metadata.

---

# Free → low-cost → paid → self-hosted tracking

Prices and free quotas change. The examples below are a **snapshot for October 5, 2026**, not a promise of future pricing.

The right way to think about this ladder is:

```text
$0
 │
 ├── manual explorer checks
 │
 ├── public RPC / free APIs
 │
 ├── free hosted RPC tier
 │
 ├── inexpensive hosted RPC/indexing
 │
 ├── richer indexed APIs
 │
 └── self-hosted nodes + indexers

more control / privacy / reliability / complexity →
```

## Level 0 — $0 and almost no infrastructure

Use a block explorer manually.

Best for:

- one wallet;
- occasional checks;
- learning;
- verifying a transaction hash;
- checking whether a receiving address has ever been funded.

Worst for:

- automated monitoring;
- privacy-sensitive workflows;
- high-volume applications.

## Level 1 — $0 personal automation

Use:

- public RPCs;
- explorer APIs that permit the intended use;
- local SQLite/PostgreSQL;
- a tiny polling script.

This is the best place to start if your goal is educational.

You learn what an indexer is actually doing instead of hiding all the complexity behind a premium API.

## Level 2 — $0 hosted RPC

Current examples include:

### Alchemy

Alchemy currently advertises a free tier with:

- 30 million Compute Units/month;
- 25 requests/second;
- access to its developer platform and supported networks.

See current [Alchemy pricing](https://www.alchemy.com/pricing) and [free-tier details](https://support.alchemy.com/articles/5827006872-what-is-included-in-the-free-tier).

Use this for:

- development;
- low-traffic personal tools;
- early prototypes.

Do not interpret “free” as “no operational dependency”.

You are still trusting a third party with your RPC traffic and depending on its quotas and availability.

### Infura

Infura currently advertises a free Core tier with:

- 3 million daily credits;
- a 500-credit/second rate limit;
- access to supported networks and archive-data capabilities in the current plan description.

See [Infura pricing](https://www.infura.io/pricing) and [pricing documentation](https://docs.infura.io/get-started/pricing/).

### GetBlock

GetBlock currently lists a free shared-node tier and paid shared-node tiers. Its documentation describes the free tier as suitable for low-traffic use, while paid plans add higher capacity and features such as archive access depending on the plan/network.

See [GetBlock plans](https://getblock.io/pricing-new/).

### Helius — Solana

For Solana specifically, Helius currently lists:

- Free: $0, 1M credits, 10 RPS;
- Developer: $49/month, 10M credits, 50 RPS;
- larger tiers for higher throughput/data products.

See [Helius pricing](https://www.helius.dev/pricing).

This is a good example of why chain-specific providers can be valuable: Solana's data model and indexing needs differ from EVM's.

## Level 3 — inexpensive pay-as-you-go or entry plans

### Ankr

Ankr currently documents usage-based RPC pricing. Its published pricing maps API Credits to request costs; for example, its current documentation lists different credit costs for EVM and Solana RPC calls and a pay-as-you-go exchange rate of `0.10 USD = 1M API Credits`.

See [Ankr service plans](https://www.ankr.com/docs/rpc-service/service-plans/) and [Advanced API pricing](https://www.ankr.com/docs/advanced-api/pricing/).

This model is useful when you want to stay cheap but stop treating a free quota as your architecture.

### Chainstack

Chainstack's current published plans include a free Developer tier and progressively more capable paid tiers; its current pricing page lists:

- Free: 3M request units/month;
- Growth: $49/month;
- Pro: $199/month;
- Business: $499/month;
- Enterprise: $990/month.

See [Chainstack pricing](https://chainstack.com/pricing/).

The useful lesson is not the exact dollar figure; it is the shape of the market: higher quotas, more nodes, higher RPS, support and operational guarantees cost progressively more.

## Level 4 — indexed wallet APIs

Once you need questions such as:

```text
“show every ERC-20 transfer for this address”
“show NFT holdings”
“calculate wallet net worth”
“find historical token movements across many chains”
```

you are moving beyond raw RPC.

Examples include:

### Moralis

Moralis currently offers higher-level wallet, token and NFT APIs, with the current Starter plan listed at $149/month when billed annually, followed by larger Pro and Business tiers.

See [Moralis pricing](https://moralis.com/pricing/).

Use an indexed API when development speed is more important than owning the indexing stack.

Do not use one merely because `eth_getLogs` looked intimidating. Learn the raw model first if the goal is understanding.

### Bitquery

Bitquery provides indexed blockchain data APIs and is useful when you need richer cross-chain data than a raw RPC node naturally exposes.

See [Bitquery pricing](https://bitquery.io/pricing/).

## Level 5 — larger hosted infrastructure

At this level you care about:

- predictable throughput;
- multiple regional endpoints;
- higher RPS;
- WebSockets/streaming;
- archive/trace/debug access;
- support;
- SLAs or enterprise contracts;
- less operational work on your side.

Examples include the higher plans of Alchemy, Infura, Chainstack, GetBlock and specialized indexed-data vendors.

The right provider depends on the chain and the exact query workload.

## Level 6 — self-hosted nodes and indexers

This is not automatically cheaper.

It is mainly about **control**.

A self-hosted architecture could look like:

```text
                   INTERNET
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Bitcoin Core    EVM client      Solana / other node
        │              │              │
        ▼              ▼              ▼
     indexer        indexer        chain-specific indexer
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  your database
                       │
                       ▼
                  your tracker
```

For Bitcoin, Esplora and ElectrumX are examples of open-source indexing approaches.

For Ethereum, node clients such as Erigon can be run in different storage/pruning modes, and archive requirements can become substantial.

Self-host when you have a reason:

- privacy;
- independence from a third party;
- large query volume;
- predictable data retention;
- custom indexing requirements.

Do not self-host merely because someone on Twitter said “RPC providers are centralized”. Running a reliable node is an operational job.

---

## Current hosted-infrastructure snapshot — October 5, 2026

These are current published planning figures, not permanent prices. Re-check the provider page before buying.

| Provider | Current published entry | Useful for |
|---|---:|---|
| Public RPC / explorer | $0 | Learning, manual checks, personal tools |
| Alchemy Free | $0 — 30M CU/month, 25 RPS | EVM RPC |
| Infura Core | $0 — 3M credits/day, 500 credits/s | EVM RPC |
| Helius Free | $0 — 1M credits, 10 RPS | Solana |
| Chainstack Developer | $0 — 3M request units/month, 25 RPS | Multi-chain RPC |
| Ankr Advanced API | PAYG — 1M API credits = $0.10 | Variable/indexed API calls |
| GetBlock Starter | $49/mo published paid entry | Multi-chain RPC |
| QuickNode | Paid plans | RPC, streams and infrastructure |
| Moralis Starter | $149/mo billed annually | Wallet/token/NFT indexed APIs |
| Self-hosted | Infrastructure cost | Privacy, control, custom indexing |

Primary sources: [Alchemy](https://www.alchemy.com/pricing), [Infura](https://www.infura.io/pricing), [Chainstack](https://chainstack.com/pricing/), [GetBlock](https://getblock.io/pricing/), [Ankr](https://www.ankr.com/docs/advanced-api/overview/), [Helius](https://www.helius.dev/pricing), [Moralis](https://moralis.com/pricing/).

# RPC is not an indexer

This distinction saves enormous amounts of confusion.

A normal RPC interface answers questions about blockchain state and execution.

For EVM:

```text
eth_blockNumber
eth_getBalance
eth_getCode
eth_call
eth_getLogs
eth_getTransactionByHash
eth_getTransactionReceipt
```

A high-level indexer may instead answer:

```text
wallet history
all token transfers
NFT ownership
token metadata
historical prices
wallet net worth
contract interactions
swaps
```

The indexer is doing substantial work behind the scenes:

```text
node data
   ↓
block ingestion
   ↓
transaction decoding
   ↓
event/log normalization
   ↓
contract/token metadata
   ↓
reorg handling
   ↓
database/index
   ↓
API query
```

That is why indexer APIs cost more than a bare node endpoint.

---

# UTXO tracking vs account tracking

## Bitcoin-like UTXO model

A tracker needs to answer:

```text
Which outputs belong to the wallet?
Which are unspent?
Which are spent?
Which transaction created each output?
Which transaction spent it?
```

Your state is naturally UTXO-oriented.

## EVM account model

A tracker needs to answer:

```text
native balance
nonce
contract storage / calls where relevant
transaction history
logs/events
token balances
token transfers
NFT ownership
```

An address's native balance is easy to query.

“Everything that happened to this wallet” is not.

## Solana

Solana adds another layer of complexity because accounts and program-owned/token accounts matter.

A portfolio tracker may need:

```text
SOL balance
SPL token accounts
token mint metadata
program interactions
transactions / instructions
NFT state
```

## TON

TON's account model and wallet contracts mean you should reason in terms of messages, contract state and token contracts rather than pretending every incoming transfer is an EVM-style transaction receipt.

## Cosmos

Cosmos ecosystems add modules and IBC packet/channel relationships to the tracking problem.

The practical rule is simple:

> **Store the raw chain-native facts first. Normalize into your own common schema second.**

---

# EVM token and NFT tracking

Tracking an EVM wallet's native balance is only the beginning.

For ERC-20 you care about transfer events and token decimals/metadata.

For ERC-721 you care about ownership of token IDs and transfer history.

For ERC-1155 you care about token IDs plus balances, often represented by batched transfer events.

That means a good indexed tracker eventually has structures resembling:

```text
wallet
contract
asset type
chain
block
transaction
log index
token id / amount
decimals
metadata
```

### Do not trust symbols alone

These can all be called:

```text
USDC
USDT
WETH
```

but the contract address is what identifies a token on a specific chain.

Always store:

```text
chain_id
contract_address
token_id (when applicable)
```

and treat the human-readable symbol as metadata.

---

# Reorganizations, finality and confirmations

A tracker must distinguish:

```text
seen
included
confirmed
finalized / economically final
```

The exact meaning changes by blockchain.

Bitcoin wallets usually use block confirmations and chain-work assumptions.

Ethereum-style networks may expose head/finality concepts through the node/client.

Solana explicitly exposes commitment levels such as `processed`, `confirmed` and `finalized`.

A good payment tracker therefore does not mark an order “paid forever” the instant it sees one RPC result.

At minimum store:

```text
first_seen_at
block / slot
transaction hash / signature
confirmation state
last_checked_at
```

and have a recheck path.

### Why?

Because blockchain state can change around the tip.

Your database is not the blockchain.

It is a cached interpretation of the blockchain.

That mindset is important.

---

# Gap limits and discovering an HD wallet

Address derivation and wallet discovery are not identical.

Suppose an account has:

```text
0
1
2
3
4
5
```

and the user has only ever received money at address `5`.

A discovery process that stops after finding a few unused addresses may fail to discover it if it uses a small gap limit.

Bitcoin's traditional HD-wallet conventions discuss an address gap-limit concept for discovery, and wallet implementations often scan a window of unused addresses before declaring the account empty.

For a payment system, there is a simpler and safer approach:

**you already know the indexes you allocated.**

Store them.

Do not force the tracker to rediscover your own order database from the chain if the application already owns the allocation history.

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

## Cost ladder

```
$0 manual explorer
↓
$0 public RPC / explorer API
↓
$0 free hosted RPC
↓
pay-as-you-go
↓
paid RPC / streams / webhooks
↓
indexed wallet/token/NFT API
↓
self-hosted nodes + indexers
```

## 06 — Tracking: a stand-alone, read-only build

Move to a more capable setup only when your workload needs higher throughput, deeper history, richer data, more privacy, better reliability or more operational control.

Keep the $0 target personal: public addresses, no-cost reads where available, local storage and a local dashboard. The design does not depend on external nova-shop code.

**Spending boundary:** keep mnemonics, seeds, private or data keys, and signing or spending interfaces out of this tracker.

**Costs and availability:** free public endpoints have provider quotas and no uptime guarantee. Check your chosen provider’s current limits and costs. Treat $0 as a target, not a promise of a free tier. Bawa does not document hardware or network costs; work these out for your own setup.

### Component contract

```text
Public addresses + explicit chain/network
↓
Free RPC / public Esplora
↓
Local DB
↓
Cron / scheduled poll
↓
Local dashboard
```

```text
Each collection cycle
↓
fetch
↓
preserve raw chain facts
├─ retain chain/network
└─ retain reorg/finality state
↓
normalise
↓
dashboard
```

This is a design for a local build, not a ready-to-run tracker.

| Component | Responsibility |
|---|---|
| Address list | Hold the public addresses to watch, with chain/network recorded explicitly. |
| Reader | Fetch through public RPC or Esplora, using no-cost access where available. |
| Local DB | Preserve raw chain facts before normalisation; retain reorg/finality state. |
| Poller | Schedule reads and handle indexer lag, RPC outages, retries, duplicates and chain reorganisations (reorgs). |
| Dashboard | Present the stored view locally, including its chain/network, freshness and reorg/finality state. |

**Implementation choices:** Bawa does not document a database engine or schema, reader code, polling interval, retry policy, rules for identifying duplicates, reorg handling rules or finality thresholds. Choose and record these for your build, and write the reader code. These are your implementation decisions, not Bawa features.

SQLite is a common choice for personal local storage. Set a polling interval, use bounded retries with backoff, and choose a stable fact identity such as `(watch, transaction id, output index)`. Configure a finality rule for each chain—for example, requiring a chosen number of Bitcoin confirmations—and only mark facts as settled once they meet that rule. Until a finality rule is configured, freshness and finality are **unknown**.

### Bitcoin: Esplora read inventory

The Esplora API documentation linked by Bawa defines these read routes. The paths below include the `/api` prefix used by the Blockstream endpoint.

| Read surface | Request |
|---|---|
| Address state | `GET /api/address/<address>` |
| UTXOs | `GET /api/address/<address>/utxo` |
| Confirmed/mempool history | `GET /api/address/<address>/txs`, with documented chain and mempool variants. |
| Transaction details | `GET /api/tx/<txid>` |

Reference: [Esplora API documentation](https://github.com/Blockstream/esplora/blob/master/API.md), linked by Bawa. Use it for response schemas, history pagination and the chain/mempool variants.

For **EVM**, Bawa lists the standard JSON-RPC read methods `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockByNumber`, `eth_getTransactionReceipt` and `eth_getLogs`.

**EVM setup:** Bawa does not choose a no-cost endpoint or document request bodies, a collection strategy or complete wallet, token and NFT coverage. Choose a provider for your chain/network, check its current limits and costs, follow its JSON-RPC documentation to build requests, and verify the coverage your tracker needs.

### Run the sourced read probe

With `curl` already available, replace `<BITCOIN_ADDRESS>` completely, including the angle brackets, with a real public Bitcoin address for the endpoint’s network **before running**. The unchanged placeholder is not shell-ready.

```bash
curl https://blockstream.info/api/address/<BITCOIN_ADDRESS>
```

**You should see:** address-state data from Esplora. Bawa does not document the exact JSON fields or give an example response; use the Esplora API documentation for field definitions.

### Runnable-setup boundary

Once you replace the address placeholder, the probe above is an executable starting point—not a complete tracker installation.

**Remaining setup:** Bawa does not document endpoint/network mapping, dependency installation, database creation, ingestion code, cron configuration, dashboard code or launch commands. Build, configure and document these pieces for your chosen setup.

Bawa also does not document reliability tests for indexer lag, outages, retries, duplicates or reorgs. Add and run these tests before relying on the tracker.

The architecture is independent of nova-shop. Treat the setup as runnable end to end only after you have implemented the remaining pieces and tested them together.

---
## Persist first; reconcile later

Personal, read-only scope: public addresses only, with a $0 budget target. Signing and spending stay outside this tracker. Free public endpoints have provider quotas and no uptime guarantee; check your chosen provider’s current limits and costs. A free tier is not guaranteed.

```text
public address
↓
RPC / Esplora
↓
local DB
↓
poll
↓
dashboard
```

```text
poll
↓
raw capture
↓
normalise
↓
reconcile
↓
commit

uncertainty
↓
retain last good view with a warning
```

### Logical schema — proposal

Bawa does not document a schema, field mappings or a database/poller implementation for this tracker. Treat this table as a proposed local design, not Bawa behaviour. Choose and record your local database—SQLite is a common choice for personal use—and implement the mappings and poller.

| Table | Key / retained data |
|---|---|
| `watches` | ID; unique `(chain, network, address)` |
| `observations` | ID; watch; source; read time; raw payload if available; request outcome |
| `facts` | Unique `(watch, fact identity)`; raw-observation link; block reference if available; confirmation/reorg/finality state |
| `sync` | `(watch, source)`; last attempt/success; checkpoint; source anchor if available; freshness |

Keep raw observations unchanged so dashboard facts can be rebuilt. Each fact’s watch reference keeps its chain and network explicit.

### Esplora read inventory

The [Esplora API documentation](https://github.com/Blockstream/esplora/blob/master/API.md), linked in Bawa, defines these reads:

- Address state: `GET /api/address/<address>`.
- UTXOs: `GET /api/address/<address>/utxo`.
- Address transactions, including confirmed and mempool history: `GET /api/address/<address>/txs`, with chain and mempool variants.
- Transaction details: `GET /api/tx/<txid>`.

Bawa does not document response-field mappings or pagination handling for this tracker. Use the Esplora API documentation to map the fields and implement paginated history reads.

1. Replace `<BITCOIN_ADDRESS>` with a real public Bitcoin address before running. Do not run the command with the placeholder unchanged:

```bash
curl 'https://blockstream.info/api/address/<BITCOIN_ADDRESS>'
```

**You should see:** address state on success. Bawa does not document exact JSON responses or failure output; check the API documentation before implementing response and error handling.

### Worked observation flow — conceptual

`FACT_A` and `BLOCK_A` are placeholders for a test fact and a block reference. These checks are proposed acceptance criteria for your local tracker, not API output. Bawa does not document database or replay commands; write them for your chosen database so you can run and repeat these tests.

**2. Successful poll.** Model a complete response containing test fact `FACT_A`, anchored to `BLOCK_A`. Retain the raw data before normalisation. Commit facts and the checkpoint together, only after reconciliation.

**You should see:** chain- and network-scoped facts linked to raw observations; no checkpoint advance after an incomplete write. Freshness and finality remain unknown until the required checks and a per-chain finality rule are in place.

**3. Repeat poll.** Model overlapping data from the next poll; update or insert using the same stable fact identity.

**You should see:** observation history retained without duplicate dashboard facts.

**4. Lag, then outage.** Compare the source’s progress with a current chain view where available; otherwise freshness is unknown. Retain the last good view and use bounded back-off retries.

**You should see:** attempts recorded separately from successful polls; stale or unknown values labelled, rather than treated as zero balances. A successful request alone is not a freshness check.

**5. Possible reorg.** Model a changed block reference. Recheck against a current chain view: missing history alone does not prove a chain reorganisation. On a verified reorg, deactivate displaced facts, rewind to a verified checkpoint and replay.

**You should see:** raw history preserved and reconciled totals excluding displaced facts. Unverified changes remain flagged; the dashboard does not silently present them as settled.

### Gaps before automation

Bawa does not document the following tracker-specific choices or setup. Choose and record them, then implement and test them before automating:

- Stable fact identity, block-reference mappings and checkpoint mappings. For an output-level fact, a full stable key could be `(watch, transaction id, output index)`.
- Reads for comparing source progress with a current chain view to detect lag.
- A polling interval and bounded retry/back-off limits that fit the chosen provider’s quotas.
- Overlap and rescan depth.
- A finality rule for each chain. For example, choose a Bitcoin confirmation count and treat facts as settled only once that count is reached.
- Executable database, cron and dashboard setup, including database and replay commands for the checks above.

These are your implementation choices, not Bawa features.

Until the relevant evidence and mappings are in place and a finality rule is configured for the chain, freshness and finality remain **unknown**, not assumed.

## From derived addresses to a local tracking view

Start with one network and a short watch-list. Bawa provides the derived public addresses; run collection and display separately from its key-handling workflow. The dashboard should report what was observed, at which block and how recently it was checked.

```text
Address watch-list from Bawa
          ↓
Timed collection worker
          ↓
RPC endpoint or explorer index
          ↓
SQLite on your machine
          ↓
Read-only view on localhost
```

### 1. Define what is being watched

Copy public addresses only. The collector must never receive a mnemonic, private key or data key, and should work while the key-holding wallet is offline.

Pair every address with its network, including mainnet or testnet. The same address string on two networks does not mean the same balance. Add a non-secret label if useful.

An address is not necessarily a whole wallet. Receiving addresses, change addresses and additional accounts need their own coverage. Add newly derived addresses explicitly; do not expect the provider to discover which other addresses belong to you.

### 2. Choose a source by coverage, not convenience

An RPC endpoint exposes node methods. An explorer API usually adds address-based indexing, within its documented coverage. On Ethereum, `eth_getBalance` reads the native-currency balance and `eth_getLogs` retrieves contract logs; neither provides a universal history of everything involving an address. See the [Ethereum JSON-RPC reference](https://ethereum.org/en/developers/docs/apis/json-rpc/). Token holdings and contract-mediated value movements require additional queries or contract-specific logic. For another chain, start with its own RPC documentation.

Pin related balance queries to the same block where supported, and retain that reference. Check historical-state availability: an endpoint may serve recent balances without supporting old ones. An incomplete transfer list cannot safely reconstruct a balance.

The no-cost provider assumption is an **October 2026 snapshot**, not a promise of free access today. Re-check your chosen provider’s pricing, supported networks and quotas; Etherscan publishes [plans](https://etherscan.io/apis) and [rate limits](https://docs.etherscan.io/resources/rate-limits). If access requires a provider credential, keep it outside source control, browser code and logs.

### 3. Keep the evidence before calculating summaries

SQLite is a reasonable choice for a small, single-writer tracker. Keep a watch-list, source records, balance snapshots and progress cursors for each collection stream.

Preserve provider responses without lossy numeric conversion before building display-friendly rows. Retain the network, block height and hash, transaction identifier, execution status, event or output position where applicable, provider name and retrieval time. A requested transfer is not necessarily a successful transfer; execution results and fees matter.

Amounts belong in exact chain base units, never floating point. Where values exceed [SQLite’s integer range](https://www.sqlite.org/datatype3.html), use decimal strings in `TEXT` columns. Keep display decimals as separate metadata. Identify tokens by network and contract, not merely by ticker.

Give records stable, chain-appropriate unique keys so repeated pages cannot create duplicate transfers. Save each completed batch and its cursor in one [SQLite transaction](https://www.sqlite.org/lang_transaction.html). A crash must not leave progress pointing beyond the records actually saved.

### 4. Make polling recoverable

Run a bounded job from cron or a systemd timer at an interval your request allowance can support. Prevent overlapping runs.

Backfill from an explicit starting block, then resume from the saved cursor. Fetch every page within each bounded range; a full page is not evidence that you reached the end. Mark earlier history as unscanned rather than implying that nothing happened.

On timeouts or rate limits, retry with back-off and retain the last completed cursor. Failed retrieval means unknown, not zero activity. Record the last successful run, outstanding errors and distance from the chain head.

Recent blocks can be replaced during a chain reorganisation. Re-fetch a trailing range and compare block hashes. On a mismatch, find the common ancestor, invalidate displaced records and rebuild affected summaries. A short overlap window is not enough for every possible reorganisation; support a deeper rewind.

Choose a chain-specific confirmation or finality policy and keep unsettled observations visibly provisional. There is no universal safe confirmation count; [Ethereum’s finality model](https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/#finality), for example, should not be applied unchanged to another network.

### 5. Show both the result and its limits

Serve the dashboard on loopback with read-only database access. It needs no signing function. Show balances and activity alongside the network, indexed block, last successful check, confirmation state and coverage warnings.

Keep stale results visible but clearly labelled. Do not replace them with zeros after an API failure. If you add fiat estimates, show their price source and timestamp separately: those estimates are not facts recorded by the chain.

This setup can describe selected addresses within the provider’s coverage and your scanned range. It cannot prove that you control their keys, identify the people behind transfers, establish a token’s value or guarantee that a displayed balance is spendable. Unlisted addresses, unsupported assets, protocol positions and off-chain balances may be absent. Polling confirmed blocks is also not a mempool monitor.

A provider can omit or misreport information, and your local records can fall behind. Cross-check important results against an independent endpoint, preferably one you control when stronger assurance is needed.

Finally, read-only does not mean private. A provider can associate queried addresses with your connection and infer that they are being watched together. Restrict access to the watch-list, database and backups, and do not expose the dashboard publicly by default.

### Low-cost tracking: Bitcoin via Esplora, EVM via JSON-RPC

For light Bawa tracking, start with Blockstream’s public Esplora service and a public or free-tier RPC endpoint for your EVM chain. That avoids a paid indexing dependency; it does not give you a complete wallet ledger. Treat October 2026 prices and quotas as a snapshot only, and re-check the chosen provider’s pricing and limits page before deployment.

```text
Bitcoin addresses
  ↓
Esplora
  ↓
Output state and address history

EVM chain + account + block
  ↓
JSON-RPC
  ↓
State reads and selected transaction evidence
```

#### Bitcoin: an address is not a wallet

Use `https://blockstream.info/api/` as the base URL. The [Esplora reference](https://github.com/Blockstream/esplora/blob/master/API.md) defines these reads:

- **Address summary** — `/address/<BITCOIN_ADDRESS>` separates confirmed and mempool statistics. Confirmed balance in satoshis is `chain_stats.funded_txo_sum − chain_stats.spent_txo_sum`; the equivalent mempool difference is a provisional adjustment. Neither number includes other receiving or change addresses belonging to the same wallet.
- **UTXOs** — `/address/<BITCOIN_ADDRESS>/utxo` reports outputs the service considers unspent. Entries identify the originating transaction (`txid`), output index (`vout`), amount (`value`, in satoshis) and confirmation state (`status`). This cannot establish who holds the keys or whether every output is immediately spendable.
- **History** — `/address/<BITCOIN_ADDRESS>/txs/chain` pages backwards through confirmed transactions, up to 25 at a time. Continue with `/address/<BITCOIN_ADDRESS>/txs/chain/<LAST_SEEN_TXID>` rather than stopping after the first page. The separate `/address/<BITCOIN_ADDRESS>/txs/mempool` route returns at most 50 transactions without pagination; pending transactions may disappear or be replaced.
- **Transaction details** — `/tx/<TXID>` supplies inputs, outputs, fee and confirmation status. You can calculate an address’s net change, but cannot infer a person’s identity, reliably distinguish change, or establish why a payment happened.

#### EVM: state is not transfer history

Check `eth_chainId`, pin state reads to one block number and retain its hash. Separate `latest` calls can straddle blocks; `pending` is node-local and provisional. For older state, check whether your endpoint supports archive queries. Method definitions are in the [Ethereum JSON-RPC reference](https://ethereum.org/developers/docs/apis/json-rpc/).

- **`eth_getBalance`** returns a hexadecimal native balance at the requested block, in base units: wei on Ethereum. It excludes tokens and NFTs; those need contract-specific reads, commonly `balanceOf` through `eth_call`.
- **`eth_getTransactionCount`** returns the account nonce, not its total activity. Incoming transfers do not increment it, so a zero nonce does not mean an unused account.
- **`eth_getBlockByNumber`** returns block metadata and either transaction hashes or full transaction objects. It is not an address-history query and does not expose internal call traces.
- **`eth_getTransactionReceipt`** returns inclusion details, execution status, gas usage and emitted logs for a mined transaction. `null` can mean pending or unknown. Successful execution is not proof of the intended financial outcome or permanent finality.
- **`eth_getLogs`** returns matching event records, including topics, data and transaction identity. Request bounded block ranges and filter by the emitting **contract** address, using indexed topics for the tracked account where the event supports them. A wallet-address filter will miss ordinary token transfers. Events omit plain native transfers and do not establish balances.

Cache confirmed results, poll incrementally and back off when throttled. Re-check recent block hashes to detect reorganisations, and roll back affected observations. These reads report a service’s view, not proof of key ownership. Fuller EVM history needs block/log scanning, tracing where supported, or an indexer; standard RPC has no universal wallet-history method.

### Solana, TON and Cosmos: the low-cost starting point

For a small watchlist, try shared public access before paying for dedicated infrastructure. Cache results, stagger polls and honour throttling responses. Free access is not reserved capacity. Treat October 2026 pricing and quota figures as a dated snapshot; re-check each provider’s page before choosing a tier.

Keep the common layer above the native query:

```text
Address + network
    ↓
Chain-specific read
    ↓
Native result + observation context
    ↓
Bawa display fields
```

HTTP and JSON are transport choices, not evidence that two chains share an account or transaction model.

#### Solana

Use `https://api.mainnet.solana.com` for mainnet experiments; devnet and testnet are separate networks, not substitutes for mainnet data. Solana’s [cluster guidance](https://solana.com/docs/references/clusters) warns that shared services can throttle or block clients and should not underpin production workloads.

[`getBalance`](https://solana.com/docs/rpc/http/getbalance) returns native SOL as an integer number of lamports, alongside a context slot. Set the commitment explicitly; `finalized` trades freshness for a stronger confirmation level. This is an account balance, not a portfolio.

[`getTokenAccountsByOwner`](https://solana.com/docs/rpc/http/gettokenaccountsbyowner) returns token accounts matching an owner and a mint or token-program filter. Decode their amounts and mint identities, using each mint’s decimals for display. Include Token-2022 where relevant: querying the original Token Program does not enumerate both programmes. An empty result under one filter does not rule out other holdings. Neither read reconstructs transfers or proves that the observer can spend the funds.

#### TON

A shared service such as [TON Center](https://toncenter.com/) avoids running a node. Check its public-access terms, authentication rules and allowances; installing an SDK does not grant extra capacity. Historical coverage also depends on the service and its archival support.

The [v2 API](https://toncenter.com/api/v2/) exposes `getAddressInformation`: native balance in nanotons, account state and a last-transaction reference. `getTransactions` lists transactions for that account, with incoming and outgoing messages. An outgoing message can cause another account’s transaction later. Do not label a payment complete merely because its first transaction exists; inspect the relevant recipient-side execution and any bounce.

[Jettons](https://docs.ton.org/v3/guidelines/dapps/asset-processing/jettons) require separate contract reads. A trusted master’s `get_wallet_address` derives the owner’s token-wallet address; that wallet’s `get_wallet_data` reports its token balance, owner and master. Verify those identities rather than trusting a symbol. Native TON balance excludes these holdings. An Ethereum receipt adapter would obscure the distinction between one transaction and the wider message flow.

#### Cosmos

Pick the chain first. The [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) supplies chain IDs, address prefixes, endpoints and asset metadata, not an availability guarantee. Try a listed public service, but verify its network and latest height. Shared services may lag, restrict queries or discard historical state.

Use that chain’s REST/LCD or gRPC application queries for balances; its [CometBFT RPC](https://docs.cometbft.com/v0.38/rpc/) is useful for blocks and consensus information. These interfaces are not interchangeable URLs, and an Ethereum balance call is not a generic Cosmos query.

The [bank module’s `AllBalances` query](https://docs.cosmos.network/sdk/v0.47/build/modules/bank/README) returns a paginated list of denominations and integer amounts for one address on one chain. Read every page. Apply asset metadata for display units, and resolve IBC denomination traces rather than guessing from a ticker. Bank balances exclude delegated stake, unbonding positions, unclaimed rewards and separate contract-token balances; those need additional module or contract reads. Locked vesting coins may still appear, so the total is not necessarily spendable.

#### Keep failures visible

Record the endpoint, network, observation time and available slot/block context. A timeout is not zero: retain the previous value as stale. These are server-reported observations, not independent state verification or proof of who controls an account. When uptime or deep history matters, choose a service with explicit capacity and retention commitments.

## Choosing your read source: levels 0–2

Start with the smallest setup you can maintain. $0 on the invoice does not mean private queries, complete history or dependable uptime.

```text
Browser or poller
    ↓
Explorer or RPC operator
    ↓
Node data and indexes
```

### Level 0 — manual checks, $0

For occasional checks of one wallet, use a [block explorer](https://ethereum.org/en/developers/docs/data-and-analytics/block-explorers/). There is no API subscription or daemon to maintain; your time is the main cost. Website access is not a bulk-data allowance, and excessive browsing may be restricted.

The explorer receives the addresses you look up and can associate them with your IP and browser session. History depends on its index and supported activity types; an empty result does not prove an address was never funded. Pages can also lag. Check the displayed block and confirmations before acting, and compare with another source when the result matters. Nothing here provides unattended alerts.

### Level 1 — personal polling, $0 service spend

Pair a public RPC or an explorer API that allows your intended use with a small poller and SQLite or PostgreSQL. Existing hardware can avoid a hosting bill, but storage, electricity and maintenance remain yours. This is a useful learning setup because you own the progress tracking and recovery.

Public endpoints may allocate capacity per IP: clients sharing a connection can compete for one allowance, and short bursts can fail ([Solana endpoint guidance](https://solana.com/docs/references/clusters)). Pace requests, back off on throttling and cap retries.

A local database does not conceal upstream queries. The RPC or API operator still receives the addresses you request and your connection details. Persist a progress checkpoint, make repeated writes safe and handle chain reorganisations. Record the last successful refresh so stale balances cannot pass as live.

Plan history separately. Standard [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/) has no complete address-activity feed. Older state reads may require archive access; finding earlier transfers may need scanning or an indexer. Test the backfill as well as steady polling: catching up can consume much more capacity than staying current.

### Level 2 — hosted RPC, $0 within the allowance

Hosted RPC removes node operation, not the work or cost of running your tracker.

**The provider prices and limits below are an October 2026 snapshot, not live terms. Re-check each linked provider page before choosing a service.**

- **Alchemy:** 30 million Compute Units/month and 25 requests/second on its free tier ([pricing](https://www.alchemy.com/pricing); [tier details](https://support.alchemy.com/articles/5827006872-what-is-included-in-the-free-tier)).
- **Infura Core:** 3 million credits/day and 500 credits/second; advertised features also mentioned archive data ([pricing](https://www.infura.io/pricing); [pricing documentation](https://docs.infura.io/get-started/pricing/)).
- **GetBlock:** a free shared-node option for modest traffic; archive availability depended on the plan and network ([plans](https://getblock.io/pricing-new/)).
- **Helius, for Solana:** a $0 tier listing 1 million credits and 10 requests/second ([pricing](https://www.helius.dev/pricing)).

Credits, Compute Units and request counts are different measures; methods can carry different weights. Estimate usage from the calls your tracker actually makes, including retries and backfills. Check allowance reset periods and short-window limits separately.

Verify historical retention and supported methods for your chosen chain. Archive state access does not automatically provide searchable wallet history, and an EVM indexing approach does not transfer unchanged to Solana.

The provider sees queried addresses and can connect usage to your account. You still maintain the poller, storage, credentials and quota monitoring. Keep secrets out of browser code. Check whether exhausting the allowance rejects calls, pauses service or permits chargeable usage before adding a payment method.

Treat the free tier as a dependency, not a guarantee. Its terms can change and its endpoint can fail; check support and uptime commitments rather than assuming them. Keep durable checkpoints and test a fallback against the history you need. That fallback also sees your queries. Surface stale data visibly instead of treating failed reads as success.

## Choosing where Bawa reads: levels 3–6

You do not have to climb every level. Measure request volume, peak rate, retries and the oldest data your tracker needs before spending more.

All prices and allowances below are an **October 2026 snapshot**, not live quotes. Re-check the linked provider pages before budgeting.

### Level 3 — small paid RPC plans

[Ankr’s plans](https://www.ankr.com/docs/rpc-service/service-plans/) listed a million API credits for US$0.10; [credit charges](https://www.ankr.com/docs/advanced-api/pricing/) vary by operation. [Chainstack](https://chainstack.com/pricing/) listed three million request units a month free and US$49/month for Growth. Credits are not a universal request count: price your actual methods, polling interval and retries, and check whether errors are billed. Set spending alerts.

This suits modest balance checks and bounded log scans. You still maintain polling, caching and retry handling. The provider can associate watched addresses with your account and IP address. Payment does not guarantee historical coverage or uninterrupted service: verify historical ranges, old-state access, peak-rate throttling and support terms.

Move here when free-tier ceilings disrupt normal reads. Stay here while it meets your needs.

### Level 4 — paying for a searchable wallet view

For transfer timelines, NFT inventories or cross-chain searches, compare the subscription with the time required to maintain your own database. [Moralis](https://moralis.com/pricing/) listed Starter at US$149/month with annual billing in that snapshot; [Bitquery](https://bitquery.io/pricing/) is another indexed-data option.

```text
Blocks and receipts
        ↓
Indexer and database
        ↓
Wallet query API
        ↓
Bawa
```

You are paying someone to follow blocks, interpret events, reconcile token formats, fetch metadata and repair records after reorganisations. There is less infrastructure to operate, but the provider can infer your watchlist.

Check pagination caps, endpoint charges, rate limits, chain coverage and the earliest indexed block for each dataset. Endpoint uptime does not prove index freshness or completeness: compare results with known transactions. Establish how to export results and resume scans without vendor-specific cursors.

Check Bawa’s reader compatibility before subscribing: an indexed API is not a drop-in RPC endpoint. If your aim is learning RPC, try a bounded log scan before outsourcing it.

### Level 5 — hosted infrastructure with commitments

Use larger hosted plans when sustained throughput, regional availability, streaming or trace/debug access becomes a requirement. [Chainstack’s higher tiers](https://chainstack.com/pricing/) illustrate this market; compare providers using your chain and method mix, not headline request rates.

Expect higher bills and contractual limits, not infinite capacity. Verify archive depth, burst ceilings, connection limits, regional routing, support response times and the actual service-level agreement.

Hosting removes node maintenance, not your need for monitoring, stream reconnection or tested failover. Two URLs can share one underlying outage. Address queries still reach the vendor: check retention and processing-location terms. Benchmark your workload, and fix duplicate polling before paying for more throughput.

### Level 6 — operating your own node and indexer

Choose this for control over queries, retention and dependencies, not an assumed discount. Budget compute, growing SSD storage, bandwidth, initial synchronisation and operator time. For a small tracker, that time can easily outweigh saved request fees.

An RPC node does not automatically supply an address-history API; plan a separate index and its backfill. Old contract state may also need [archive storage](https://ethereum.org/en/developers/docs/nodes-and-clients/archive-nodes/), which is a different requirement from indexing transfers. Start with [Ethereum’s node guide](https://ethereum.org/en/developers/docs/nodes-and-clients/) or your chain’s client documentation, and choose the retention window before provisioning disks.

Your endpoint has no provider-imposed request quota, but CPU, disk speed and synchronisation lag still limit throughput. Watchlist queries can stay local; cloud hosting and external metadata services still need a privacy review.

Reliability becomes your responsibility: upgrades, alerts, backups, reorganisation handling and tested resynchronisation. If nobody owns that ongoing work, stay hosted. A small, cached, monitored setup can be the right permanent choice.

## From node RPC to reliable wallet state

A standard node RPC answers specific questions about chain state and execution. On EVM chains, `eth_getBalance` reads native balance at a block, `eth_call` simulates a contract call without persisting changes, and `eth_getTransactionReceipt` supplies execution details and logs. `eth_getLogs` retrieves matching log entries, not an address’s complete financial history ([Ethereum RPC reference](https://ethereum.org/en/developers/docs/apis/json-rpc/)).

Logs alone miss native-coin movements. Reconstructing value moved inside contract calls may require [execution traces](https://geth.ethereum.org/docs/developers/evm-tracing/built-in-tracers); check client and provider support. Calling `balanceOf` also presupposes that you know the token contract. Access to old state does not automatically solve asset discovery.

An indexer turns those scattered facts into address activity, token-transfer histories and NFT holdings. A net-worth endpoint needs correctly matched price data too: balances alone cannot establish value, and historical valuations need prices from the relevant time. Providers sometimes expose indexed methods through JSON-RPC themselves; the distinction is the processing behind the endpoint, not the request format.

```text
Node blocks, transactions and receipts
  ↓
Block-range capture with restart checkpoints
  ↓
Original responses retained by block hash
  ↓
Call decoding and event normalisation
  ↓
Contract classification and metadata enrichment
  ↓
Fork reconciliation
  ↓
Searchable database
  ↓
Wallet query API
```

Retain chain-specific evidence before translating it into shared wallet records. Preserve block height/hash, transaction hash and event position, alongside the chain identifier. Processing a range twice must not duplicate movements.

Reorganisations require more than changing a block number: mark displaced records non-canonical, reverse their derived effects and process the replacement branch. Canonical-chain checks belong throughout ingestion. Show the last indexed block and label confirmation or finality status, so partial synchronisation is not presented as an empty wallet.

### Store state that matches the chain

**UTXO chains:** identify each unspent transaction output by transaction ID and output number (`txid`, `vout`). Keep its value, locking script, creating block and, once spent, the spending transaction/input. Match against the wallet’s receive and change scripts; checking one address can miss most of a wallet. Balance is the sum of eligible unspent outputs, not a running account field. Separate pending spends from confirmed spends, and make both creation and spending reversible during a reorganisation ([Bitcoin transaction model](https://developer.bitcoin.org/devguide/transactions.html)).

**EVM accounts:** record native balance and nonce at a known block, separately from activity records. Transactions, receipts, logs and sometimes traces explain changes; token balances live in their contracts’ state. Keep failed transactions too: they can still cost gas. Reconcile inferred token holdings with contract calls at the same block, rather than assuming event totals always reproduce balances.

**Solana:** track wallet authority, mint and token-account relationships. The program owning a token account is not the same thing as its token-owner authority. Discover the authority’s token accounts rather than treating the wallet address as the container for every token balance ([Solana tokens](https://solana.com/docs/core/tokens)).

### Give every EVM asset an unambiguous key

Use `(chain_id, contract_address)` for ERC-20 assets and NFT collections; add `token_id` for individual ERC-721 and ERC-1155 items. Anyone can reuse a symbol, and matching contract addresses across chains are still separate identities.

- **[ERC-20](https://eips.ethereum.org/EIPS/eip-20):** retain `Transfer` movements and exact integer amounts. Decimals scale display values; names, symbols and decimals are optional metadata under the standard.
- **[ERC-721](https://eips.ethereum.org/EIPS/eip-721):** record ownership per token ID, including mint/burn transitions; reconcile transfer-derived holdings with `ownerOf`.
- **[ERC-1155](https://eips.ethereum.org/EIPS/eip-1155):** record quantities per holder and token ID, not a single owner. Handle `TransferSingle` and expand `TransferBatch`, preserving each batch item’s position alongside the log index.

Treat metadata as untrusted presentation data. Check a price provider’s chain-and-contract mapping rather than matching ticker text, and mark unmatched holdings as unpriced—not worthless.

## Reorganisations, finality and wallet discovery

Keep chain observations separate from the decision to fulfil an order.

```text
seen
↓
included
↓
confirmed
```

**Seen** means a node or indexer reported a transaction. **Included** places it in a block on the currently accepted fork. **Confirmed** means a stated threshold has been reached. **Finalised** means consensus has committed to that history under its security assumptions. **Economically final** means reversal is judged uneconomic for the value involved: a risk assessment, not another universal RPC status.

Check execution success, destination, asset and amount separately. Finalising a failed transaction does not turn it into a payment.

- **Bitcoin:** inclusion gives one confirmation; each following block adds another. Nodes follow the valid chain with greatest accumulated work, so depth reduces reversal risk without creating a protocol-finalised state. Six is a customary acceptance threshold, not a network requirement ([Bitcoin guide](https://developer.bitcoin.org/devguide/block_chain.html), [payment guidance](https://bitcoin.org/en/you-need-to-know#confirmations)).
- **Ethereum:** Casper FFG justifies checkpoints using votes representing at least two-thirds of staked ETH. A supermajority link from a justified checkpoint to its immediate successor finalises the earlier checkpoint and its ancestors. This normally takes around two epochs; follow the node’s finalised view rather than trusting a timer. Conflicting finality makes at least one-third of stake slashable under the protocol’s assumptions ([Ethereum PoS](https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/#finality)).
- **Solana:** `processed` reflects a node’s processed block, potentially on a fork that will be discarded. `confirmed` has supermajority voting support; `finalized` has reached maximum vote lockout. Choose the commitment explicitly ([Solana RPC](https://solana.com/docs/rpc#configuring-state-commitment)).

An API provider’s required confirmation count is its acceptance policy, not a new consensus rule ([provider example](https://developer.interlace.money/docs/blockchain-confirmations)).

### Make rechecks part of settlement

During a reorganisation, a different branch becomes canonical. A transaction can survive in another block, return to pending status, or stop appearing in the accepted chain. A missing lookup alone does not establish a fork switch: pruning, indexing delays and endpoint faults can also hide results.

Persist `first_seen_at`, `last_checked_at`, the transaction hash or signature, inclusion height/slot, block hash, state and acceptance-policy version. Recheck recent inclusions against canonical history. If an inclusion is displaced, reverse its provisional ledger effect with a compensating entry and review any fulfilment already triggered. Make each transition idempotent; re-inclusion should reconcile the existing payment, not create a duplicate.

### Preserve allocations, not just keys

HD derivation calculates an address at an index; discovery searches for activity and needs a stopping point. BIP44’s external-chain scan stops after 20 consecutive addresses with no transaction history; an emptied address still counts as used ([BIP44](https://bips.dev/44/)). Other wallets may use different windows. If indices `0`–`19` have no history, a default scan can stop before a payment at `20`.

Durably record the wallet/account, derivation scheme, branch, index, address and order reference before issuing the address. Back up this allocation ledger and track its entries directly, including expired invoices. A seed regenerates keys, not your allocation history. When importing without those records, extend discovery deliberately rather than assuming the default scan found everything.

### Protect the watch-only view

An xpub alone cannot authorise spending, but it exposes the non-hardened public subtree below it. Mapping those keys to chain activity reveals structure, address reuse, histories and balances, potentially linking customers. A BIP44 account node covers receiving and change branches; hardened boundaries prevent public derivation beyond them ([BIP32](https://bips.dev/32/)).

Handle it as a **watch-only secret**: restrict access, encrypt stored copies and exclude it from telemetry, public tickets and unreviewed checking tools. Give each subsystem individual addresses or a narrower public branch where sufficient. Choosing another index beneath a disclosed xpub does not restore privacy. For future receipts, use an account outside the exposed subtree; existing links remain visible.

## Stand-alone tracking, with no spending path

Build this as a small local application, independent of nova-shop. Bawa does not provide a runnable tracker: you need to implement the reader and choose its storage and operating policies.

**Keep spending elsewhere.** The watch list needs public addresses and explicit chain/network labels, not wallet access. Mnemonics, seeds, private keys, data keys and every signing or spending interface must stay outside the tracker, including its configuration, logs and database.

Aim for $0 in service fees, not guaranteed free operation. Do not assume unlimited requests or uninterrupted public access. Any October 2026 prices or quotas are a snapshot only; re-check the provider’s page before deploying. Bawa does not estimate hardware or connectivity costs; budget those separately.

### Make the components agree

```text
Watch list: chain, network, public address
↓
Scheduled poller
↓
Read-only API client
↓
Local database: raw observations first
↓
Normalised local views
↓
Local dashboard
```

| Component | Local contract |
|---|---|
| Address list | Assign a watch identity to each `(chain, network, address)`. Never infer the network from the address text alone. |
| Reader | Call an allowlist of read routes or methods. Return the provider payload with retrieval time and source identity; leave presentation calculations for later. |
| Database | Save raw observations before deriving balances or activity. Retain chain/network, available block hashes and heights, and confirmation state so later corrections are possible. |
| Poller | Own scheduling, timeouts and bounded retries with backoff. Expect indexer lag, outages, repeated records and chain reorganisations (reorgs); retrying must not multiply records. |
| Dashboard | Read the database, not a wallet. Show chain/network, last successful collection and freshness/finality labels. A failed fetch must not become a zero balance. |

SQLite is a reasonable starting point, not a Bawa requirement. Record your schema, polling interval, retry limits, duplicate identity and reorg procedure. For Bitcoin outputs, `(chain, network, watch, txid, vout)` can identify a fact; its confirmation state remains changeable. Recheck affected records after a reorg and rebuild derived totals rather than retaining an invalid settled label.

Choose a freshness window and a settlement rule per chain/network, such as a configured Bitcoin confirmation count. Until those rules are configured, show freshness and finality as **unknown**. A recent response is not a settlement signal, and a Bitcoin confirmation threshold does not make reorgs impossible.

### Bitcoin reads: Esplora

The [Esplora API reference](https://github.com/Blockstream/esplora/blob/master/API.md) specifies these operations and their response schemas. Prefix each path below with `https://blockstream.info` for Bitcoin mainnet; `/api` is already included. Select the deployment for your intended network rather than silently defaulting to mainnet.

| Request | What to collect |
|---|---|
| `GET /api/address/<address>` | Separate confirmed and mempool address statistics. |
| `GET /api/address/<address>/utxo` | Unspent output identifiers, values and confirmation status. |
| `GET /api/address/<address>/txs` | A limited page containing recent confirmed and mempool transactions. |
| `GET /api/address/<address>/txs/chain` | The first page of confirmed history. |
| `GET /api/address/<address>/txs/chain/<last_seen_txid>` | The next confirmed-history page after that transaction cursor. |
| `GET /api/address/<address>/txs/mempool` | Unconfirmed transactions; bounded and not paginated. |
| `GET /api/tx/<txid>` | Transaction contents and confirmation status. |

Backfill through the chain route, using the last confirmed transaction ID returned as the next cursor until the history is exhausted. The mixed route is not a complete archive. Disappearance from a mempool response does not establish confirmation: re-read transaction status and retain uncertainty when the provider cannot answer. Store Bitcoin amounts as integer satoshis and convert only for display.

For EVM, Bawa names `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockByNumber`, `eth_getTransactionReceipt` and `eth_getLogs`; use the [JSON-RPC reference](https://ethereum.org/en/developers/docs/apis/json-rpc/) for their semantics. Bawa does not prescribe an endpoint, request bodies or a complete wallet/token/NFT collection strategy. Choose a provider for the exact network, check its current terms, implement the requests and test asset coverage before treating the dashboard as comprehensive.

## Persist first, reconcile later

Keep this personal tracker read-only: public addresses only, with signing and spending elsewhere. A $0 bill is the aim, not a promised free tier. Treat October 2026 prices and quotas as a dated snapshot; re-check the provider’s pricing and limits page, and plan for outages.

### Prove the read

The [Esplora API reference](https://github.com/Blockstream/esplora/blob/master/API.md) identifies the base below as Bitcoin mainnet. With `curl` installed, substitute a public mainnet address for the whole `<BITCOIN_ADDRESS>` token, angle brackets included, **before running**. The unchanged template is not shell-ready.

```bash
curl https://blockstream.info/api/address/<BITCOIN_ADDRESS>
```

Expect an address summary; use that reference for JSON field meanings. It also documents `/address/<address>/utxo`, `/address/<address>/txs` with chain/mempool variants, and `/tx/<txid>`, all relative to `/api` here. Paginate confirmed history rather than assuming one response contains everything.

One successful read checks access; it does not establish a working tracker.

### Commit evidence before progress

Choose a transactional database; [SQLite](https://www.sqlite.org/atomiccommit.html) is a practical personal option. Bawa does not document a schema or field mappings, so implement and record your own. This layout is a proposal:

| Table | Purpose |
|---|---|
| `watches` | Local ID with uniqueness enforced across `(chain, network, address)`. |
| `observations` | Append-only request records: watch, source, endpoint, read time, HTTP/transport outcome and untouched response body when available. |
| `facts` | Derived entries with observation links, watch identity, block hash/height and confirmation/reorg state. |
| `sync` | Per-watch/source attempt time, reconciled-success time, checkpoint and source block anchor. |

Give output facts the unique key `(watch_id, txid, vout)` and upsert on that key. A retry can refresh an entry without counting the output twice. Every fact must resolve to its watch’s chain and network, including in dashboard queries.

```text
poll
↓
commit raw observation
↓
normalise and reconcile
↓
commit facts and checkpoint together
↓
refresh dashboard
```

Persist each observation before decoding or deriving anything. In a separate transaction, write the reconciled facts, success time and checkpoint together, only for a complete, validated batch. If parsing fails, a page is missing or the fact transaction aborts, keep the observations but roll back derived changes; neither checkpoint nor last-success time moves. Attempt/error metadata can still record the failure.

Capture the source tip with each batch and compare block hashes, not just heights. Do not assume separate HTTP reads form a consistent snapshot. On a reorg, replay from a verified common ancestor and revise affected facts and the checkpoint together. Leave earlier observations untouched. If a consistent anchor cannot be established, retain the previous view and report uncertainty. Use bounded retries with backoff and prevent overlapping polls.

### Make stale and provisional visible

Show the last attempt, last reconciled success, data age and source tip separately. A recent HTTP response does not prove that the indexer is caught up; without an independent tip comparison, label lag as unknown. Keep previously accepted balances visible with a stale/error warning, rather than showing zero after failures. Before the first successful reconciliation, show “not synced”.

Keep finality separate from freshness. Label mempool activity unconfirmed, show confirmation counts as of the recorded tip, and identify reorg-affected entries. Any “final” badge must explain its threshold as local policy: Bitcoin confirmations reduce reversal risk rather than abolish it ([Bitcoin developer guide](https://developer.bitcoin.org/devguide/block_chain.html)).

### Finish the local installation

Bawa does not document endpoint/network mapping, dependency installation, database creation, ingestion code, cron configuration, dashboard setup or reliability tests. Record network-to-URL choices; install dependencies; create the database; build ingestion and dashboard code; document launch commands; configure scheduling.

Test indexer lag, outages, retries, duplicate reads, reorgs and crashes between persistence steps. Check that committed observations survive, replay produces consistent facts and checkpoints never outrun those facts. No nova-shop integration is required; rely on the tracker only after the whole path passes these checks.

### Polling cadence, backoff and WebSockets

Keep tracking read-only: watch public addresses and leave signing and spending elsewhere. Aim for $0 running costs, but check the provider’s current quotas and prices; do not assume either guaranteed uptime or lasting free access.

For a polling-only setup, try one cycle per network every 60 seconds. Treat this as a starting point, not a quota guarantee. Avoid overlapping cycles, count every request they make, and lengthen the interval to fit your allowance. This also suits Esplora services without subscriptions.

```text
timer or subscription event
↓
fetch and save raw responses
↓
normalise and reconcile
↓
commit locally
```

On HTTP `429`, pause that provider’s queue. Use capped exponential backoff with jitter, but never wait less than `Retry-After` specifies. Try a limit of three retries per cycle; once exhausted, defer further work. Scheduled polls must respect the same cooldown, rather than resetting it ([RPC operations guidance](https://docs.berachain.com/nodes/operations/self-hosted-rpc)).

On EVM networks, prefer WebSocket `eth_subscribe` streams for `newHeads` and relevant `logs` where supported. Reserve `eth_blockNumber` checks for times when subscriptions cannot be used. Events are best-effort notifications, not durable history: after every reconnect, verify the stored chain view, fetch missed ranges and reconcile before marking the dashboard current ([subscription behaviour](https://geth.ethereum.org/docs/interacting-with-geth/rpc/pubsub)).

For `eth_getLogs`, use short block windows and the relevant contract-address filter. If a window is rejected for size, split it instead of repeating a broad scan ([backfill guidance](https://docs.blockvectra.com/en/guides/hyperevm-backfill/)). If fetching or reconciliation remains uncertain, keep the previously committed balances visible with a stale-data warning.

## Local database and dashboard views

Bawa does not specify the tracker’s schema, field mappings or database/poller implementation. Treat this as a proposed local model, not built-in behaviour. Record your storage choice—[SQLite](https://www.sqlite.org/whentouse.html) suits a personal tracker—and implement the mappings and poller.

- **`watches`**: assign each watch an ID; enforce uniqueness on `(chain, network, address)`.
- **`observations`**: append an ID, watch reference, source, read timestamp, request outcome and any available raw response. Preserve observations unchanged so derived facts remain rebuildable.
- **`facts`**: key output-based activity uniquely by `(watch, transaction_id, output_index)`. Document an equally stable key for other event types. Repeated reads update the same fact; confirmation changes and reorganisations must not change its identity. Retain the supporting observation link, available block reference and confirmation, reorganisation and finality state.
- **`sync`**: maintain one record per `(watch, source)`, with last attempt, last success, checkpoint, available source anchor and freshness. A failed request must not advance the success timestamp.

```text
watches
  ↓
observations
  ↓
facts
  ↓
dashboard views
```

```text
sync
  ↓
dashboard freshness
```

The watch reference supplies chain and network for every fact; never infer either from an address alone.

Every dashboard view must visibly show **chain, network, freshness and finality/reorganisation state**. Repeat these fields per row where contexts differ:

- **Watch overview**: monitored watches, latest successful reads and activity summaries.
- **Activity**: stored facts with transaction/output identity, block reference and confirmation progress.
- **Fact detail**: provenance, available raw response and reorganisation status.
- **Sync health**: attempts, failures, checkpoints and source anchors, alongside the affected watches’ finality state. Successful polling does not establish finality.

Render stored local data rather than fetching silently during page loads. Until a chain has an explicit finality rule configured, display both freshness and finality as **unknown**. Cached results are not proof of current chain state.

## Confirmations, reorgs and recovery checks

Treat request success, freshness and finality as different states. Bawa does not document database or replay commands; implement these for your storage engine before scheduling polls. Keep freshness and finality **unknown** until block/checkpoint mappings, progress comparisons and a per-chain finality rule are implemented and checked.

For Bitcoin, choose `C≥1` confirmations. A canonical block at `h`, with verified tip `H`, has `H-h+1` confirmations; eligibility ends at `H-C+1` ([Bitcoin RPC](https://developer.bitcoin.org/reference/rpc/getblockheader.html)). On Ethereum, a checked `finalized` block can supply the boundary; verify provider support ([JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber)). Record your choice: a confirmation threshold is a risk policy, not protection against every reorg.

Store checkpoint height and hash. Process bounded batches from `checkpoint+1` to the eligible boundary, plus a configured overlap scan ([tracker pattern](https://socket.dev/go/package/github.com/Ethernal-Tech/blockchain-event-tracker)). Enforce output-level uniqueness using `(chain, network, watch, txid, output_index)`.

```text
Retain raw response
↓
Check progress, ancestry and eligibility
↓
Reconcile normalised facts
↓
Commit facts, totals and checkpoint atomically
```

### Local acceptance checks

Use a local fixture: `C=3` (**test policy only**), verified tip `102`, checkpoint `99`, and `FACT_A` in `BLOCK_A` at height `100`. These checks exercise your implementation, not a documented Bawa test endpoint.

1. **Successful poll:** Supply the complete batch through `100`. Expect one active fact linked to its raw response and checkpoint `100`. Reset the fixture and fail a write: derived state and checkpoint must remain unchanged. Without the required verification, a complete response still cannot establish finality.

2. **Repeat poll:** Repeat the successful request. Observation history grows, but there is still one dashboard fact, with unchanged totals and checkpoint `100`. Reuse the stable key rather than making identity depend on the poll.

3. **Lag, then outage:** With a one-block lag limit, move the independently checked tip to `104` while the source remains at `102`, then fail requests. Keep the last good value labelled stale, not zero; use bounded back-off retries and separate attempt/success timestamps. Without a usable comparison, freshness is unknown.

4. **Possible reorg:** Report `BLOCK_B` at `100`, omitting `FACT_A`. Missing history alone is inconclusive: check canonical ancestry against a current node view. For a verified replacement branch without that fact, mark old-branch facts inactive, roll back to the last verified common checkpoint (`99` here), then replay. Keep the raw observations; totals must drop `FACT_A`. Unresolved differences stay flagged and cannot carry settled status.

### Diagnose before retrying

| Failure mode | Diagnosis and next step |
|---|---|
| RPC down | Check endpoint reachability, DNS/TLS errors and provider status. Preserve stored state; retry only within your budget. |
| Rate-limited (`429`) | A rate or usage limit was reached. Honour `Retry-After` when present, reduce request pressure and cap retries ([HTTP 429](https://www.rfc-editor.org/rfc/rfc6585#section-4)). |
| Wrong chain or network | Compare RPC network identifiers and known block anchors with the watch configuration. Reject mismatches before ingestion. |
| Stale data | Responses may be cached. Compare source block progress and time since the last verified update; HTTP success proves neither. |
| Indexer lag | The chain advances while indexed height stalls. Compare both views, monitor catch-up or use another checked source. |
| Duplicates | Inspect stable-key construction and database uniqueness constraints. Consolidate dashboard facts without deleting observation history. |
| Checkpoint will not advance | The eligible boundary may not have moved. Otherwise inspect incomplete batches and failed commits; never force progress across unprocessed data. |

Any guide prices and quotas are an **October 2026 snapshot**. Re-check your provider’s page before choosing polling intervals and retry budgets.

The tracker **does not sign transactions or take custody**. It cannot prove a balance on its own, and one RPC response is not enough to call a payment settled.
