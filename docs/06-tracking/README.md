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

Move upward only when the workload demands higher throughput, deeper history, richer data, privacy, reliability or operational control.