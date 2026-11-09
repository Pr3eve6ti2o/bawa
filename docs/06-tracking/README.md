# Tracking a wallet

## 1. Tracking a wallet for $0

Start with the cheapest chain-native setup:

- **BTC:** Use Blockstream's public Esplora API for address state, UTXOs, confirmed and mempool history, and transaction details. Follow the [Esplora API reference](https://github.com/Blockstream/esplora/blob/master/API.md).
- **EVM:** Call JSON-RPC directly: `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockByNumber`, `eth_getTransactionReceipt` and `eth_getLogs`. Follow the [Ethereum JSON-RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/).
- **Solana:** Use the public cluster RPC endpoint for your network:
  - Mainnet: <https://api.mainnet.solana.com>
  - Devnet: <https://api.devnet.solana.com>
  - Testnet: <https://api.testnet.solana.com>
  
  Solana states that these shared endpoints are not for production and can rate-limit your requests.
- **TON:** Use the TON-native SDK/HTTP ecosystem, not an Ethereum RPC abstraction.
- **Cosmos:** Use chain-specific RPC/LCD/gRPC, plus the Cosmos Chain Registry for chain metadata.

Treat $0 as a target, not a promise of a free tier. Free public endpoints have provider quotas and no uptime guarantee. Check your chosen provider's current limits.

## 2. The ladder: manual to self-hosted

For cost details, follow the canonical pricing note in `docs/03` and use `docs/08` as the single costs reference.

### Level 0 — manual

Check one wallet manually when you are learning or only need occasional look-ups: verify a transaction hash or check whether a receiving address was ever funded. Treat this as the worst option for automation, privacy-sensitive work and high volume.

### Level 1 — personal automation

Build a tiny polling script around public RPCs or explorer APIs that permit your intended use. Store the results locally in SQLite/PostgreSQL. Choose this level as the best setup for learning how your tracker works.

### Level 2 — hosted RPC

Hand off node operation, not responsibility for the tracker. Hosted RPC removes node work; it does not remove all work.

Estimate usage from the calls your tracker actually makes, including retries and backfills. Do not equate credits, Compute Units and request counts: they are different measures, and methods carry different weights.

- Check allowance reset periods and short-window limits.
- Verify historical retention and supported methods. Archive state access does not automatically provide searchable wallet history.
- Assume the provider sees queried addresses. Keep secrets out of browser code.
- Before adding a payment method, check whether exhausting the allowance rejects calls, pauses service or permits chargeable usage.

Treat the free tier as a dependency, not a guarantee.

### Level 3 — small paid RPC plans

Choose a small paid RPC plan for modest balance checks and bounded log scans. Maintain your polling, caching and retry handling.

Do not assume payment guarantees historical coverage or uninterrupted service. Set spending alerts.

### Level 4 — indexed wallet APIs

Choose an indexed wallet API when you need “show every ERC-20 transfer”, “show NFT holdings”, “calculate wallet net worth” or “find historical token movements”.

You pay someone to follow blocks, interpret events, reconcile token formats, fetch metadata and repair records after reorgs.

Check pagination caps, endpoint charges, rate limits, chain coverage and the earliest indexed block. Do not mistake endpoint uptime for index freshness or completeness.

An indexed API is not a drop-in RPC endpoint: check Bawa's reader compatibility.

### Level 5 — larger hosted infrastructure

Move up when you need predictable throughput, multiple regional endpoints, higher request rates, WebSockets/streaming, archive/trace/debug access, support and SLAs.

Expect higher bills and contractual limits, not infinite capacity. Check whether your endpoints are independent: two URLs can share one underlying outage.

### Level 6 — self-hosted

Self-host mainly for control, not because it is automatically cheaper. Budget for compute, growing SSD storage, bandwidth, initial synchronisation and operator time.

Plan a separate index and backfill: an RPC node does not automatically supply an address-history API. Old contract state may need archive storage, which is a different requirement from indexing transfers.

Your endpoint has no provider-imposed quota, but CPU, disk and sync lag still limit throughput. Own the reliability work: upgrades, alerts, backups, reorg handling and tested resynchronisation. If nobody owns that work, stay hosted.

As you climb, control, privacy and reliability rise—and so do complexity and cost.

## 3. RPC is not an indexer

Use normal RPC to answer questions about state and execution. On EVM chains, examples include `eth_blockNumber`, `eth_getBalance`, `eth_getCode`, `eth_call`, `eth_getLogs`, `eth_getTransactionByHash` and `eth_getTransactionReceipt`.

Use an indexer for wallet history, all token transfers, NFT ownership, token metadata, historical prices, wallet net worth, contract interactions and swaps. An indexer builds those answers through this pipeline:

> node data → block ingestion → transaction decoding → event/log normalisation → contract/token metadata → reorg handling → database/index → API query

Apply this rule: **a standard RPC has no universal wallet-history method**. For fuller EVM history, scan blocks and logs, use tracing where supported, or use an indexer.

## 4. UTXO tracking vs account tracking

- **BTC:** Track which outputs belong to the wallet, which are unspent or spent, and which transaction created or spent each output. Keep the state UTXO-oriented. Treat xpubs as **sensitive public material**: they can reveal derived addresses and link their activity.
- **EVM:** Track native balance, nonce, contract storage and calls, transaction history, logs and events, token balances, token transfers and NFT ownership. An address's native balance is easy to query; “everything that happened to this wallet” is not.
- **Solana:** Account for accounts and program-owned/token accounts: SOL balance, SPL token accounts, token mint metadata, program interactions, transactions/instructions and NFT state.
- **TON:** Reason in messages, contract state and token contracts, not EVM-style transaction receipts.
- **Cosmos:** Model modules and IBC packet/channel relationships.

**Store the raw chain-native facts first; normalise into your own common schema second.**
## 5. EVM token and NFT tracking

Do not trust symbols alone. Anyone can reuse symbols such as USDC, USDT and WETH, or give different tokens the same name. The contract address identifies a token on a specific chain; matching contract addresses across chains are still separate identities.

Always store `chain_id` and `contract_address`, plus `token_id` when applicable. Treat the symbol as metadata. Give every EVM asset an unambiguous key:

- Use `(chain_id, contract_address)` for ERC-20 assets and NFT collections.
- Add `token_id` for individual ERC-721 and ERC-1155 items: `(chain_id, contract_address, token_id)`.

Build indexed records around the wallet, contract, asset type, chain, block, transaction, log index, token ID/amount, decimals and metadata.

- **[ERC-20](https://eips.ethereum.org/EIPS/eip-20):** Retain `Transfer` movements and exact integer amounts, plus token decimals and metadata when available. Use decimals to scale display values; names, symbols and decimals are optional metadata under the standard.
- **ERC-721 (EIP-721):** Record ownership per token ID and retain transfer history, including mint and burn transitions. Reconcile transfer-derived holdings with `ownerOf`.
- **ERC-1155 (EIP-1155):** Record balances as quantities per holder and token ID, not a single owner. Transfers are often batched: handle `TransferSingle` and expand `TransferBatch`, preserving each batch item's position alongside the log index.

Treat metadata as untrusted presentation data. Check a price provider's chain-and-contract mapping rather than matching ticker text. Mark unmatched holdings as unpriced, not worthless.

## 6. Reorganisations, finality and confirmations

Distinguish seen, included, confirmed, finalised and economically final. Their exact meanings depend on the blockchain:

- **Seen:** a node or indexer reported a transaction.
- **Included:** the transaction is in a block on the currently accepted fork.
- **Confirmed:** the transaction has reached a stated threshold.
- **Finalised:** consensus has committed to that history under its security assumptions.
- **Economically final:** reversal is judged uneconomic for the value involved. Treat this as a risk assessment, not another universal RPC status.

Apply the chain's own rules:

- **Bitcoin:** Count inclusion as 1 confirmation; each following block adds another. Nodes follow the valid chain with the greatest accumulated work, so depth reduces reversal risk without creating a protocol-finalised state. Treat six confirmations as a customary acceptance threshold, not a network requirement.
- **Ethereum:** Casper FFG justifies checkpoints using votes representing at least two-thirds of staked ETH. A supermajority link from a justified checkpoint to its immediate successor finalises the earlier checkpoint and its ancestors. Finalisation normally takes around two epochs; follow the node's finalised view rather than trusting a timer. Under the protocol's assumptions, conflicting finality makes at least one-third of stake slashable.
- **Solana:** Choose the commitment explicitly. `processed` reflects a node's processed block, potentially on a fork that will be discarded. `confirmed` has supermajority voting support. `finalized` has reached maximum vote lockout.

Treat an API provider's required confirmation count as its acceptance policy, not a new consensus rule. Do not mark an order "paid forever" on one RPC result.

At minimum, store `first_seen_at`, block/slot, transaction hash/signature, confirmation state and `last_checked_at`. Build a recheck path. Blockchain state can change around the tip; treat your database as a cached interpretation, not the blockchain.

## 7. Gap limits and discovering an HD wallet

Keep address derivation separate from wallet discovery. If an account has addresses 0–5 and you have only ever received at 5, a discovery process with a small gap limit can stop after a few unused addresses and miss the receiving address.

Read docs/05 §9 for the full gap-limit treatment. [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) uses gap limit 20: its external-chain scan stops after 20 consecutive addresses with no transaction history. Count an emptied address as used. Other wallets may use different windows. If indices 0–19 have no history, a default scan can stop before a payment at 20.

For a payment system, store the indexes you allocate; do not force the tracker to rediscover your own order database from the chain. Durably record the wallet/account, derivation scheme, branch, index, address and order reference **before issuing the address**.

Back up this allocation ledger and track its entries directly, including addresses allocated to expired invoices. A seed regenerates keys, not your allocation history. When importing without those records, extend discovery deliberately rather than assuming the default scan found everything.

## 8. Privacy: xpubs are sensitive public material

Treat xpubs as sensitive public material. An xpub does not normally let an attacker spend, but its holder can derive many receiving and change addresses below that public node. When payments are observable, this can reveal account structure, address reuse patterns, payment history, balances and customer relationships.

A BIP-44 account node covers receiving and change branches; hardened boundaries prevent public derivation beyond them. In a multi-account application, decide whether each subsystem really needs the account-level xpub or whether a narrower public node suffices. Give each subsystem individual addresses or a narrower public branch where sufficient.

Restrict access to stored xpubs, encrypt stored copies and exclude them from telemetry. Do not paste them into public issue trackers or tickets, untrusted analytics dashboards, random "xpub checkers", unreviewed browser extensions, unreviewed checking tools or unnecessary chat messages.

Do not try to restore privacy by choosing another index beneath a disclosed xpub. For future receipts, use an account outside the exposed subtree. Existing links remain visible.
## 9. A stand-alone, read-only build

Treat this as a design, **not a ready-to-run tracker**. Build to this component contract:

Public addresses + explicit chain/network → free RPC or public Esplora → local database → scheduled poll → local dashboard.

For each collection cycle, fetch, preserve raw chain facts with their chain/network and reorg/finality state, normalise, then update the dashboard.

| Component | Responsibility |
|---|---|
| Address list | Hold the public addresses to watch; keep chain/network explicit. |
| Reader | Fetch through public RPC or Esplora, using no-cost access where available. |
| Local DB | Preserve raw chain facts before normalisation; retain chain/network and reorg/finality state. |
| Poller | Schedule reads; handle indexer lag, RPC outages, retries, duplicates and reorgs. |
| Dashboard | Present the stored view locally, including chain/network, freshness and reorg/finality state. |

Bawa does not document a database engine or schema, reader code, polling interval, retry policy, duplicate-identification rules, reorg handling rules or finality thresholds. Choose and record these for your build, and write the reader code.

SQLite is a common choice for personal local storage. Set a polling interval, use bounded retries with backoff and choose a stable fact identity such as `(watch, transaction id, output index)`.

Configure a finality rule per chain, for example a chosen number of Bitcoin confirmations. Mark facts settled only once they meet it. Until a finality rule is configured, keep freshness and finality as `UNKNOWN`.

**Spending boundary:** keep mnemonics, seeds, private or data keys, and signing/spending interfaces out of this tracker.

### Read inventory

Use these Esplora reads against the Blockstream endpoint. The paths include `/api`.

| Read | Request |
|---|---|
| Address state | `GET /api/address/<address>` |
| UTXOs | `GET /api/address/<address>/utxo` |
| Confirmed/mempool history | `GET /api/address/<address>/txs` (chain and mempool variants) |
| Transaction details | `GET /api/tx/<txid>` |

Use the [Esplora API documentation](https://github.com/Blockstream/esplora/blob/master/API.md) for response schemas, history pagination and the chain/mempool variants.

For EVM reads, use `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockByNumber`, `eth_getTransactionReceipt` and `eth_getLogs`.

### Run the read probe

The probe below uses the published fixture address `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (the differential-test BTC address). Replace it with a real public Bitcoin address for the endpoint's network to probe your own address.

Run the sourced read probe after making that replacement:

```sh
curl https://blockstream.info/api/address/bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd
```

Expect address-state data from Esplora. Bawa does not document the exact JSON fields; use the Esplora reference.

### Complete the setup

The probe is an executable starting point, not a complete tracker installation.

Build, configure and document the remaining setup for your chosen environment: endpoint/network mapping, dependency installation, database creation, ingestion code, cron configuration, dashboard code and launch commands. Bawa does not document these pieces.

Add and run reliability tests for indexer lag, outages, retries, duplicates and reorgs before relying on the tracker. Bawa does not document these tests.

Treat the setup as runnable end to end only after you have implemented the remaining pieces and tested them together.
## 10. Persist first; reconcile later

Treat this as a proposed local design, not Bawa behaviour.

### Logical schema

Keep these logical records:

- **watches**: ID; unique `(chain, network, address)`.
- **observations**: ID; watch; source; read time; raw payload if available; request outcome.
- **facts**: unique `(watch, fact identity)`; raw-observation link; block reference if available; confirmation/reorg/finality state.
- **sync**: `(watch, source)`; last attempt/success; checkpoint; source anchor if available; freshness.

Keep raw observations unchanged so you can rebuild dashboard facts. Use each fact's watch reference to keep chain and network explicit.

### Worked observation flow

Use this conceptual flow as proposed acceptance criteria, not API output. `FACT_A` and `BLOCK_A` are placeholders. Bawa does not document database or replay commands — write them for your chosen database.

**(1) Successful poll**

Model a complete response with test fact `FACT_A` anchored to `BLOCK_A`. Retain raw data before normalisation. Commit facts and checkpoint together, only after reconciliation.

**Expected:** chain/network-scoped facts linked to raw observations; no checkpoint advance after an incomplete write; freshness and finality remain unknown until the required checks and a per-chain finality rule are in place.

**(2) Repeat poll**

Model overlapping data. Update or insert using the same stable fact identity.

**Expected:** observation history retained without duplicate dashboard facts.

**(3) Lag, then outage**

Compare the source's progress with a current chain view where available; otherwise, leave freshness unknown. Retain the last good view. Retry with bounded back-off.

**Expected:** attempts recorded separately from successful polls; stale or unknown values labelled, not treated as zero balances. A successful request alone is not a freshness check.

**(4) Possible reorg**

Model a changed block reference. Recheck against a current chain view: missing history alone does not prove a reorg. On a verified reorg, deactivate displaced facts, rewind to a verified checkpoint and replay.

**Expected:** raw history preserved; reconciled totals exclude displaced facts; unverified changes stay flagged. The dashboard does not silently present them as settled.

### Gaps before automation

Choose, record, implement and test the following before automating:

- **Stable fact identity, block-reference and checkpoint mappings.** For an output-level fact, a full stable key could be `(watch, transaction id, output index)`.
- **Reads for detecting lag.** Compare source progress with a current chain view.
- **Polling interval and bounded retry/back-off limits.** Fit these to the chosen provider's quotas.
- **Overlap and rescan depth.**
- **A finality rule per chain.** For example, use a Bitcoin confirmation count and mark facts as settled only once that count is reached.
- **Executable database, cron and dashboard setup**, including database and replay commands.

Until the relevant evidence and mappings are in place and a finality rule is configured, keep freshness and finality `UNKNOWN`, not assumed.
## 11. From derived addresses to a local tracking view

Start with one network and a short watch-list. Run collection and display separately from key handling. Make the dashboard report what was observed, at which block and how recently.

### 1. Define what is being watched

Copy public addresses only. Keep xpubs out of this collector and treat them as sensitive public material. Never give the collector a mnemonic, private key or data key, and make sure it works while the key-holding wallet is offline.

Pair every address with its network: the same address string on two networks does not mean the same balance. Add a non-secret label if useful.

Do not assume an address represents a whole wallet. Give receiving addresses, change addresses and additional accounts their own coverage. Add newly derived addresses explicitly; do not assume the tracker will discover them.

### 2. Choose a source by coverage, not convenience

Distinguish the source types. An RPC endpoint exposes node methods; an explorer API usually adds address-based indexing within its documented coverage.

On Ethereum, `eth_getBalance` reads native balance and `eth_getLogs` retrieves contract logs. Neither provides a universal history of everything involving an address. Use additional queries or contract-specific logic for token holdings and contract-mediated value movements. For another chain, start with its own RPC documentation.

Pin related balance queries to the same block where supported, and retain that reference. Check historical-state availability: an endpoint may serve recent balances without supporting old ones. Do not rely on an incomplete transfer list to reconstruct a balance.

If access requires a provider credential, keep it outside source control, browser code and logs. For Etherscan, check the [published rate limits](https://docs.etherscan.io/rate-limits) before setting your collection schedule.

### 3. Keep the evidence before calculating summaries

SQLite is a reasonable choice for a small, single-writer tracker. Keep a watch-list, source records and balance snapshots, plus progress cursors per collection stream.

Preserve provider responses without lossy numeric conversion before building display rows. Retain the network, block height and hash, transaction identifier, execution status, event or output position where applicable, provider name and retrieval time.

Do not count a requested transfer as necessarily successful. Account for execution results and fees.

Store amounts in exact chain base units, never floating point. Where values exceed SQLite's integer range, use decimal strings in `TEXT` columns. Keep display decimals as separate metadata. Identify tokens by network and contract, not ticker.

Give records stable, chain-appropriate unique keys so repeated pages cannot create duplicate transfers. Save each completed batch and its cursor in one SQLite transaction: a crash must not leave progress pointing beyond the records actually saved.

### 4. Make polling recoverable

Run a bounded job from cron or a systemd timer at an interval your request allowance can support. Prevent overlapping runs.

Backfill from an explicit starting block, then resume from the saved cursor. Fetch every page within each bounded range; a full page is not evidence that you reached the end. Mark earlier history as unscanned rather than implying nothing happened.

On timeouts and rate limits, retry with back-off and retain the last completed cursor. Treat failed retrieval as unknown, not zero activity. Record the last successful run, outstanding errors and distance from the chain head.

Re-fetch a trailing block range and compare block hashes: recent blocks can be replaced during a reorg. On a mismatch, find the common ancestor, invalidate displaced records, rewind collection to that point and rebuild affected summaries. Support a deeper rewind; a short overlap window is not enough for every possible reorg.

Choose a chain-specific confirmation/finality policy and keep unsettled observations visibly provisional. There is no universal safe confirmation count. Do not apply Ethereum's finality model unchanged to another network.

### 5. Show both the result and its limits

Serve the dashboard on loopback with read-only database access. Keep signing out of it. Show balances and activity alongside the network, indexed block, last successful check, confirmation state and coverage warnings.

Keep stale results visible but clearly labelled. Do not replace them with zeros after an API failure. If you add fiat estimates, show their price source and timestamp separately from the chain observations. Treat them as estimates, not facts recorded by the chain.

Use this setup to describe selected addresses within the provider's coverage and your scanned range. It cannot prove you control their keys, identify the people behind transfers, establish a token's value or guarantee that a displayed balance is spendable. Unlisted addresses, unsupported assets, protocol positions and off-chain balances may be absent. Do not treat polling confirmed blocks as mempool monitoring.

Cross-check important results against an independent endpoint, preferably one you control when stronger assurance is needed. A provider can omit or misreport information, and your local records can fall behind.

Do not confuse read-only with private. A provider can associate queried addresses with your connection and infer that you are watching them together. Restrict access to the watch-list, database and backups. Do not expose the dashboard publicly by default.
## 12. Low-cost tracking: BTC via Esplora, EVM via JSON-RPC

### Bitcoin: an address is not a wallet

Use `https://blockstream.info/api/` as the base URL. Track each address explicitly; do not treat one address’s results as a wallet balance.

- **Read the address summary** at `/address/<BITCOIN_ADDRESS>`. Keep confirmed and mempool statistics separate. Calculate the confirmed balance in satoshis as `chain_stats.funded_txo_sum` minus `chain_stats.spent_txo_sum`. Treat the mempool difference as a provisional adjustment. Neither number includes other receiving or change addresses of the same wallet.

- **Fetch UTXOs** from `/address/<BITCOIN_ADDRESS>/utxo`. Read each output’s `txid`, `vout`, `value` in satoshis and `status`. These results cannot establish who holds the keys or whether every output is immediately spendable.

- **Page through confirmed history** with `/address/<BITCOIN_ADDRESS>/txs/chain`. Work backwards through confirmed transactions, up to 25 at a time, and continue with `/address/<BITCOIN_ADDRESS>/txs/chain/<LAST_SEEN_TXID>`. Fetch pending transactions from `/address/<BITCOIN_ADDRESS>/txs/mempool`, which returns at most 50 transactions without pagination. Treat pending transactions as provisional: they may disappear or be replaced.

- **Read transaction details** at `/tx/<TXID>` for inputs, outputs, fee and confirmation status. Use the inputs and outputs to calculate an address’s net change. Do not infer a person’s identity, assume you can reliably distinguish change or conclude why a payment happened.

### EVM: state is not transfer history

Check `eth_chainId` first. Pin state reads to one block number and retain its hash; separate `latest` calls can straddle blocks. Treat `pending` as node-local and provisional. For older state, check whether the endpoint supports archive queries.

- **Read the native balance** with `eth_getBalance`. Interpret the result as a hex native balance at the requested block, in base units (wei on Ethereum). This excludes tokens and NFTs; use contract-specific reads for those, commonly `balanceOf` via `eth_call`.

- **Read the account nonce** with `eth_getTransactionCount`, not total activity. Incoming transfers do not increment it; do not treat a zero nonce as evidence of an unused account.

- **Read block metadata** with `eth_getBlockByNumber`, along with either transaction hashes or full transaction objects. Do not use it as an address-history query or expect it to expose internal call traces.

- **Read a mined transaction’s receipt** with `eth_getTransactionReceipt` for inclusion details, execution status, gas usage and emitted logs. A `null` result can mean pending or unknown. Do not treat successful execution as proof of the intended financial outcome or permanent finality.

- **Fetch matching event records** with `eth_getLogs`, including topics, data and transaction identity. Request bounded block ranges and filter by the emitting CONTRACT address. Use indexed topics for the tracked account where the event supports them; a wallet-address filter will miss ordinary token transfers. Events omit plain native transfers and do not establish balances.

Cache confirmed results, poll incrementally and back off when throttled. Re-check recent block hashes to detect reorgs and roll back affected observations. Treat these reads as a service’s view, not proof of key ownership.

For fuller EVM history, scan blocks and logs, use tracing where supported, or use an indexer. Standard RPC has no universal wallet-history method.
## 13. Solana, TON and Cosmos: the low-cost starting point

For a small watchlist, try shared public access before paying for dedicated infrastructure. Cache results, stagger polls and honour throttling. Do not treat free access as reserved capacity.

Use a common tracking flow: address and network → chain-specific read → native result plus observation context → Bawa display fields. Treat HTTP and JSON as transport choices, not evidence that two chains share an account or transaction model.

### Solana

Use https://api.mainnet.solana.com for mainnet experiments. Keep devnet and testnet separate: neither is a substitute for mainnet data. Do not base production workloads on shared services; they can throttle or block clients.

Use `getBalance` to read native SOL as an integer number of lamports, alongside a context slot. Set the commitment explicitly; `finalized` trades freshness for a stronger confirmation level. Treat this as an account balance, not a portfolio.

Use `getTokenAccountsByOwner` to read token accounts matching an owner plus a mint or token-program filter. Decode the amounts and mint identities, then use each mint's decimals for display. Include Token-2022 where relevant: querying the original Token Program does not enumerate both programmes. Do not treat an empty result under one filter as proof that there are no other holdings. Neither read reconstructs transfers or proves that the observer can spend the funds.

### TON

Use a shared service such as TON Center (https://toncenter.com/) to avoid running a node. Check its public-access terms, authentication rules and allowances; installing an SDK does not grant extra capacity. Historical coverage depends on the service and its archival support.

Use the v2 API's `getAddressInformation` for the native balance in nanotons, account state and last-transaction reference. Use `getTransactions` to read transactions and their incoming and outgoing messages.

Do not label a payment complete merely because its first transaction exists. An outgoing message can cause another account's transaction later. Inspect the relevant recipient-side execution and any bounce. Avoid an Ethereum receipt adapter here: it would obscure the distinction between one transaction and the wider message flow.

For Jettons, make separate contract reads (https://docs.ton.org/contracts/standard/tokens/jettons/overview). Use a trusted master's `get_wallet_address` to derive the owner's token-wallet address. Call that wallet's `get_wallet_data` for its token balance, owner and master. Verify those identities rather than trusting a symbol. Keep these holdings separate from the native TON balance, which excludes them.

### Cosmos

Pick the chain first. Use the Cosmos Chain Registry for chain IDs, address prefixes, endpoints and asset metadata, not as an availability guarantee. Try a listed public service, but verify its network and latest height. Shared services may lag, restrict queries or discard historical state.

Use that chain's REST/LCD or gRPC application queries for balances. Use its CometBFT RPC for blocks and consensus information (https://docs.cosmos.network/cometbft/latest/docs/README). Do not treat these interfaces as interchangeable URLs.

Use the bank module's `AllBalances` query for one address on one chain. It returns a paginated list of denominations and integer amounts, so read every page. Apply asset metadata for display units and resolve IBC denomination traces rather than guessing from a ticker.

Bank balances exclude delegated stake, unbonding positions, unclaimed rewards and separate contract-token balances. Locked vesting coins may still appear, so do not treat the total as necessarily spendable.

### Keep failures visible

Record the endpoint, network, observation time and available slot/block context. A timeout is not zero: retain the previous value and mark it stale.

Treat these reads as server-reported observations, not independent state verification or proof of who controls an account. When uptime or deep history matters, choose a service with explicit capacity and retention commitments.
## 14. Choosing your read source

Start a small tracker at levels 0–2:

- **Level 0:** make manual explorer checks.
- **Level 1:** run personal automation on public RPCs and explorer APIs.
- **Level 2:** use hosted RPC.

Move to levels 3–6 when the lower levels stop fitting: you need more throughput, deeper history, indexed wallet views or control.

- **Level 3:** use small paid RPC plans.
- **Level 4:** use indexed wallet APIs.
- **Level 5:** use larger hosted infrastructure.
- **Level 6:** run self-hosted nodes and indexers.

Follow the per-network testnet walkthroughs in the [Web guide §E](../web-wallet/WEB-GUIDE.md#e-connectivity) and [Android guide §F](../android-wallet/ANDROID-GUIDE.md#f--connectivity). For testing guidance, see the [Web guide §H](../web-wallet/WEB-GUIDE.md#h-testing) and [Android guide §I](../android-wallet/ANDROID-GUIDE.md#i--testing). No local chain stage is implemented for any chain in the validation draft.

## 15. From node RPC to reliable wallet state

Use a standard node RPC to answer specific questions about chain state and execution, not to retrieve a complete wallet view. For EVM:

- Use `eth_getBalance` to read the native balance at a block.
- Use `eth_call` to simulate a contract call without persisting changes.
- Use `eth_getTransactionReceipt` to retrieve execution details and logs.
- Use `eth_getLogs` to retrieve matching log entries, not an address’s complete financial history.

Do not rely on logs alone: they miss native-coin movements. Reconstructing value moved inside contract calls may require execution traces; check client and provider support before relying on them. Identify the token contract before calling `balanceOf`. Do not assume access to old state automatically solves asset discovery.

Use an indexer to turn these scattered facts into address activity, token-transfer histories and NFT holdings. Match balances to the correct asset price data before calculating net worth: balances alone cannot establish value. Use price data from the relevant time for historical valuations. Distinguish endpoints by the processing behind them, not their request format; providers sometimes expose indexed methods through JSON-RPC themselves.

### Build the ingestion pipeline

1. Read blocks, transactions and receipts from the node.
2. Capture block ranges with restart checkpoints.
3. Retain original responses by block hash.
4. Decode calls and normalise events.
5. Classify contracts and enrich metadata.
6. Reconcile forks.
7. Store the results in a searchable database.
8. Expose a wallet query API.

Retain chain-specific evidence before translating it into shared wallet records: block height and hash, transaction hash, event position and chain identifier. Make range processing idempotent: processing a range twice must not duplicate movements.

Handle reorgs by doing more than changing a block number. Mark displaced records non-canonical, reverse their derived effects and process the replacement branch. Check canonical-chain membership throughout ingestion, not only at the fork-reconciliation stage.

Show the last indexed block and label confirmation/finality status. Do not present partial synchronisation as an empty wallet.

### Store state that matches the chain

**UTXO chains:** identify each UTXO by `(txid, vout)`. Keep its value, locking script and creating block; once spent, keep its spending transaction and input. Match against the wallet’s receive and change scripts: checking one address can miss most of a wallet. Calculate balance as the sum of eligible unspent outputs, not a running account field. Separate pending spends from confirmed spends, and make both creation and spending reversible during a reorg.

**EVM accounts:** record native balance and nonce at a known block, separately from activity records. Use transactions, receipts, logs and sometimes traces to explain changes. Read token balances from their contracts’ state. Keep failed transactions too: they can still cost gas. Reconcile inferred token holdings with contract calls at the same block rather than assuming event totals always reproduce balances.

Give every EVM asset an unambiguous key: `(chain_id, contract_address)` for ERC-20 assets and NFT collections; add `token_id` for individual ERC-721 and ERC-1155 items: `(chain_id, contract_address, token_id)`. Always store `chain_id` and `contract_address`, plus `token_id` when applicable; treat the symbol as metadata. Record ERC-20 balances per contract, ERC-721 ownership per token ID, and ERC-1155 balances as quantities per holder and token ID — never merge different contracts or tokens into one balance.

**Solana:** track wallet authority, mint and token-account relationships. Distinguish the program owning a token account from its token-owner authority; they are not the same. Discover the authority’s token accounts rather than treating the wallet address as the container for every token balance.

## 16. Reorganisations, finality and wallet discovery

Keep chain observations separate from the decision to fulfil an order. Check execution success, destination, asset and amount separately. Do not treat finality as proof of payment: finalising a failed transaction does not turn it into a payment.

Allow for a different branch becoming canonical during a reorg. A transaction can survive in another block, return to pending or stop appearing in the accepted chain. Do not infer a fork switch from a missing lookup alone: pruning, indexing delays and endpoint faults can also hide results.

Persist `first_seen_at`, `last_checked_at`, transaction hash/signature, inclusion height/slot, block hash, state and acceptance-policy version. Recheck recent inclusions against canonical history. If an inclusion is displaced, reverse its provisional ledger effect with a compensating entry and review any fulfilment already triggered. Make each transition idempotent: reconcile re-inclusion with the existing payment rather than creating a duplicate.

### Preserve allocations, not just keys

Distinguish HD derivation from discovery. HD derivation calculates an address at an index; discovery searches for activity and needs a stopping point.

Account for [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)’s external-chain scan: it stops after **20 consecutive addresses with no transaction history**. Count an emptied address as used, and allow for other wallets to use different windows. If indices **0–19** have no history, a default scan can stop before a payment at **20**.

Durably record the wallet/account, derivation scheme, branch, index, address and order reference **before issuing the address**. Back up this allocation ledger and track its entries directly, including expired invoices. Do not rely on a seed to recover those records: it regenerates keys, not your allocation history. When importing without those records, extend discovery deliberately rather than assuming the default scan found everything.

### Protect the watch-only view

Treat an xpub as **sensitive public material**. An xpub alone cannot authorise spending, but it exposes the non-hardened public subtree below it. Mapping those keys to chain activity reveals structure, address reuse, histories and balances, potentially linking customers.

Restrict access, encrypt stored copies and exclude xpubs from telemetry, public tickets and unreviewed checking tools. Give each subsystem individual addresses or a narrower public branch where sufficient.

Do not expect choosing another index beneath a disclosed xpub to restore privacy. For future receipts, use an account outside the exposed subtree; existing links remain visible.
## 17. Stand-alone tracking, with no spending path

Build the watch list from public addresses with explicit chain/network labels, not wallet access. Keep mnemonics, seeds, private keys, data keys and every signing/spending interface outside the tracker, including its configuration, logs and database. Treat xpubs as sensitive public material.

Aim for $0 in service fees, not guaranteed free operation. Do not assume unlimited requests or uninterrupted public access. Budget hardware and connectivity costs separately; Bawa does not estimate them.

Connect the components in this order:

```text
watch list (chain, network, public address)
→ scheduled poller
→ read-only API client
→ local database (raw observations first)
→ normalised local views
→ local dashboard
```

### Local contracts

- **Address list:** Assign a watch identity to each `(chain, network, address)`. Never infer the network from the address text alone.
- **Reader:** Restrict calls to an allowlist of read routes and methods. Return the provider payload with retrieval time and source identity. Leave presentation calculations for later.
- **Database:** Save raw observations before deriving balances and activity. Retain chain/network, available block hashes and heights, and confirmation state so you can correct records later.
- **Poller:** Keep scheduling, timeouts and bounded retries with backoff in the poller. Expect indexer lag, outages, repeated records and reorgs. Do not let retries multiply records.
- **Dashboard:** Read the database, not a wallet. Show chain/network, last successful collection and freshness/finality labels. Never turn a failed fetch into a zero balance.

Treat SQLite as a reasonable starting point, not a Bawa requirement. Record your schema, polling interval, retry limits, duplicate identity and reorg procedure.

For Bitcoin outputs, `(chain, network, watch, txid, vout)` can identify a fact. Keep its confirmation state changeable. After a reorg, recheck affected records and rebuild derived totals rather than retaining an invalid settled label.

Choose a freshness window and a settlement rule per chain/network; for example, use a configured Bitcoin confirmation count as the settlement rule. Until those rules are configured, show freshness and finality as `UNKNOWN`. Do not treat a recent response as a settlement signal. Do not assume a Bitcoin confirmation threshold makes reorgs impossible.

### Bitcoin reads (Esplora)

For Bitcoin mainnet, prefix each path with `https://blockstream.info`; `/api` is already included. Select the deployment for your intended network rather than silently defaulting to mainnet.

| Read route | Returns |
| --- | --- |
| `GET /api/address/<address>` | Separate confirmed and mempool address statistics. |
| `GET /api/address/<address>/utxo` | Unspent output identifiers, values and confirmation status. |
| `GET /api/address/<address>/txs` | A limited page containing recent confirmed and mempool transactions. |
| `GET /api/address/<address>/txs/chain` | The first page of confirmed history. |
| `GET /api/address/<address>/txs/chain/<last_seen_txid>` | The next confirmed-history page after that transaction cursor. |
| `GET /api/address/<address>/txs/mempool` | Unconfirmed transactions; bounded, not paginated. |
| `GET /api/tx/<txid>` | Transaction contents and confirmation status. |

Backfill through the chain route, using the last confirmed transaction ID returned as the next cursor until the history is exhausted. Do not treat the mixed route, `/api/address/<address>/txs`, as a complete archive.

Do not infer confirmation from a transaction disappearing from a mempool response. Re-read its transaction status and retain uncertainty when the provider cannot answer.

Store Bitcoin amounts as integer satoshis; convert only for display.

### EVM reads

Use `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockByNumber`, `eth_getTransactionReceipt` and `eth_getLogs`. Follow the JSON-RPC reference for their semantics.

Bawa does not prescribe an endpoint, request bodies or a complete wallet/token/NFT collection strategy. Choose a provider for the exact network, check its current terms, implement the requests and test asset coverage before treating the dashboard as comprehensive.
## 18. Commit evidence before progress; make stale and provisional visible; finish the local installation; polling cadence, backoff and WebSockets

### Commit evidence before progress

Choose a transactional database. SQLite is a practical option for a personal installation. Implement and record your own schema and field mappings; Bawa does not document them. Start with this local proposal:

- **`watches`**: local ID, with uniqueness across `(chain, network, address)`.
- **`observations`**: append-only request records containing the watch, source, endpoint, read time, HTTP/transport outcome and untouched response body when available.
- **`facts`**: derived entries with observation links, watch identity, block hash/height and confirmation/reorg state.
- **`sync`**: per-watch/source attempt time, reconciled-success time, checkpoint and source block anchor.

Give output facts the unique key `(watch_id, txid, vout)`. Upsert on that key so a retry can refresh an entry without counting the output twice. Resolve every fact to its watch’s chain and network, including in dashboard queries.

Follow this persistence order:

1. Poll and commit each raw observation before decoding or deriving anything.
2. Normalise and reconcile the batch.
3. Only for a complete, validated batch, commit the reconciled facts, success time and checkpoint together in a separate transaction.
4. Refresh the dashboard from the committed facts.

If parsing fails, a page is missing or the fact transaction aborts, keep the observations but roll back derived changes. Leave both the checkpoint and last-success time unchanged. Record the failure in attempt and error metadata without advancing either.

Capture the source tip with each batch and compare block hashes, not just heights. Do not assume separate HTTP reads form a consistent snapshot. On a reorg, replay from a verified common ancestor and revise the affected facts and checkpoint together. Leave earlier observations untouched.

If you cannot establish a consistent anchor, retain the previous view and report uncertainty. Use bounded retries with backoff and prevent overlapping polls.

### Make stale and provisional visible

Show the last attempt, last reconciled success, data age and source tip separately. Do not treat a recent HTTP response as proof that the indexer is caught up. Without an independent tip comparison, label lag as “unknown”.

Keep previously accepted balances visible after failures, with a stale/error warning; do not replace them with zero. Before the first successful reconciliation, show "not synced".

Keep finality separate from freshness:

- Label mempool activity unconfirmed.
- Show confirmation counts as of the recorded tip.
- Identify reorg-affected entries.
- Explain the threshold for any "final" badge as local policy. Bitcoin confirmations reduce reversal risk rather than abolish it.

### Finish the local installation

Bawa does not document endpoint/network mapping, dependency installation, database creation, ingestion code, cron configuration, dashboard setup or reliability tests. Finish these parts locally:

- Record your network-to-URL choices.
- Install dependencies and create the database.
- Build the ingestion and dashboard code.
- Document launch commands and configure scheduling.
- Test indexer lag, outages, retries, duplicate reads, reorgs and crashes between persistence steps.
- Check that committed observations survive, replay produces consistent facts and checkpoints never outrun those facts.

### Polling cadence, backoff and WebSockets

Keep tracking read-only. Aim for $0 running costs, but check the provider’s current quotas and prices. Do not assume guaranteed uptime or lasting free access.

For a polling-only setup, try one cycle per network every 60 seconds. Treat this as a starting point, not a quota guarantee. Avoid overlapping cycles, count every request they make and lengthen the interval to fit your allowance. Use the same approach for Esplora services without subscriptions.

On HTTP 429, pause that provider’s queue. Use capped exponential backoff with jitter, but never wait less than `Retry-After` specifies. Try a limit of three retries per cycle; once exhausted, defer further work. Make scheduled polls respect the same cooldown rather than resetting it.

On EVM networks, prefer WebSocket `eth_subscribe` streams for `newHeads` and relevant `logs` where supported. Reserve `eth_blockNumber` checks for times when subscriptions cannot be used. Treat events as best-effort notifications, not durable history. After every reconnect, verify the stored chain view, fetch missed ranges and reconcile before marking the dashboard current.

For `eth_getLogs`, use short block windows and the relevant contract-address filter. If a window is rejected for size, split it instead of repeating a broad scan.

If fetching or reconciliation remains uncertain, keep the previously committed balances visible with a stale-data warning.

## 19. Local database and dashboard views

### Store four record types

- **Watches:** assign an ID and enforce uniqueness on `(chain, network, address)`.
- **Observations:** assign an ID and retain the watch reference, source, read timestamp, request outcome and any available raw response. Preserve the raw response unchanged so you can rebuild derived facts.
- **Facts:** key output-based activity uniquely by `(watch, transaction_id, output_index)`. For other event types, use `(watch, transaction_id, event_type, transaction_event_index)` and document how each chain adapter derives a deterministic index within the transaction’s complete event list. Do not use a block-wide log index, which can shift across a reorg. Update the same fact on repeated reads; never make confirmation changes or reorgs change its identity. Retain the supporting observation link, available block reference and confirmation/reorg/finality state.
- **Sync:** keep one record per `(watch, source)`, containing the last attempt, last success, checkpoint, available source anchor and freshness. Record failed attempts without advancing the success timestamp.

Supply chain and network for every fact through its watch reference. Never infer either from an address alone.

Build the data flow as follows:

```text
watches → observations → facts → dashboard views
sync → dashboard freshness
```

### Render stored local data

Show **chain, network, freshness and finality/reorganisation state** visibly on every dashboard view. Repeat these fields per row wherever contexts differ.

| View | Show |
|---|---|
| Watch overview | Monitored watches, latest successful reads and activity summaries. |
| Activity | Stored facts with transaction/output identity, available block reference and confirmation progress. |
| Fact detail | Provenance, supporting observation, available raw response and reorg status. |
| Sync health | Attempts, failures, checkpoints and available source anchors, alongside the affected watches’ finality state. |

Do not treat successful polling as evidence of finality.

Render stored local data rather than silently fetching from sources during page loads. Until a chain has an explicit finality rule configured, display both freshness and finality as `UNKNOWN`. Cached results are not proof of current chain state.

Restrict access to the database and dashboard. Treat xpubs as **sensitive public material**.

## 20. Confirmations, reorgs and recovery checks

### Set the rules before scheduling polls

Treat request success, freshness and finality as separate states. A successful request does not establish either freshness or finality.

Implement database and replay operations for your storage engine before scheduling polls: Bawa does not document database or replay commands. Keep freshness and finality `UNKNOWN` until you have implemented and checked block/checkpoint mappings, progress comparisons and a per-chain finality rule.

Verify network identity for **every chain**, not only ETH. Check each source’s chain-id or network identifier **plus known block anchors** against the watch configuration. Reject mismatches before ingestion.

Configure an eligible processing boundary:

- **Bitcoin:** choose `C >= 1` confirmations. A canonical block at height `h`, with verified tip `H`, has `H-h+1` confirmations. Eligibility ends at `H-C+1`.
- **Ethereum:** use a checked `finalized` block as the boundary where supported. Verify provider support before relying on it.

Record your choice. Treat a confirmation threshold as a risk policy, not protection against every reorg.

Store checkpoint height and hash. Process bounded batches from `checkpoint+1` to the eligible boundary, plus a configured overlap scan. Run the overlap scan even when the boundary has not advanced.

Enforce output-level uniqueness using `(chain, network, watch, txid, output_index)`. Use the watch ID for `watch`, map `txid` to the stored `transaction_id`, and obtain chain and network from the watch reference.

Follow this ingestion flow:

```text
retain raw response
  → check progress, ancestry and eligibility
  → reconcile normalised facts
  → commit facts, totals and checkpoint atomically
```

Keep raw observations when a derived-state commit fails. Never advance a checkpoint across an incomplete batch or a failed commit.

### Run local acceptance checks

Use this local fixture:

- `C=3` — test policy only.
- Verified tip: `102`.
- Checkpoint: `99`.
- `FACT_A` in `BLOCK_A` at height `100`.
- Eligible boundary: `100`.

Run these checks against **your implementation**. Bawa does not document a test endpoint for them.

1. **Successful poll**

   Supply the complete batch through `100`. Expect one active fact linked to its raw response and checkpoint `100`.

   Reset the fixture and fail a write. Keep derived state unchanged and the checkpoint at `99`; do not leave partially updated facts or totals.

   Without the required verification, a complete response still cannot establish finality.

2. **Repeat poll**

   Restore the successful result, then repeat the successful request. Configure the overlap scan to include height `100`.

   Retain the additional observation, but keep one dashboard fact, unchanged totals and checkpoint `100`. Reuse the stable key rather than making identity depend on the poll.

3. **Lag, then outage**

   With a one-block lag limit, move the independently checked tip to `104` while the source remains at `102`. Then fail requests.

   Keep the last good value labelled stale, not zero. Retry with bounded back-off and retain separate attempt and success timestamps. Do not advance the success timestamp on failed requests.

   Without a usable comparison, display freshness as `UNKNOWN`.

4. **Possible reorg**

   Report `BLOCK_B` at height `100`, omitting `FACT_A`. Treat missing history alone as inconclusive: check canonical ancestry against a current node view.

   For a verified replacement branch without that fact, mark old-branch facts inactive and roll back to the last verified common checkpoint — `99` here — then replay. Apply the changes to facts, totals and checkpoint atomically, and retain the raw observations.

   Remove `FACT_A` from totals. Keep unresolved differences flagged; do not give them settled status.

### Diagnose before retrying

| Symptom | Check and recover |
|---|---|
| **RPC down** | Check endpoint reachability, DNS/TLS errors and provider status. Preserve stored state and retry only within your budget. |
| **Rate-limited (`429`)** | A rate or usage limit was reached. Honour `Retry-After` when present, reduce request pressure and cap retries. |
| **Wrong chain or network** | Compare RPC network identifiers and known block anchors with the watch configuration. Apply these checks to every chain and reject mismatches before ingestion. |
| **Stale data** | Allow for cached responses. Compare source block progress and time since the last verified update. HTTP success proves neither freshness nor finality. |
| **Indexer lag** | Compare the advancing chain with the stalled indexed height. Monitor catch-up or use another checked source. |
| **Duplicates** | Inspect stable-key construction and database uniqueness constraints. Consolidate dashboard facts without deleting observation history. |
| **Checkpoint will not advance** | Check whether the eligible boundary has moved. Otherwise, inspect incomplete batches and failed commits. Never force progress across unprocessed data. |

For `429`, refer to [RFC 6585](https://www.rfc-editor.org/info/rfc6585/), section 4, **“429 Too Many Requests”**:

> The 429 status code indicates that the user has sent too many requests in a given amount of time ("rate limiting").
>
> The response representations SHOULD include details explaining the condition, and MAY include a Retry-After header indicating how long to wait before making a new request.

The tracker does **not** sign transactions or take custody, and it cannot prove a balance on its own. Do not call a payment settled on the strength of one RPC response.

## 21. Sources

Use primary sources only:

- [Esplora API reference](https://github.com/Blockstream/esplora/blob/master/API.md).
- [Ethereum JSON-RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/).
- [Canonical BIP-44 text](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki).
- [EIP-20](https://eips.ethereum.org/EIPS/eip-20).
- [Etherscan rate limits](https://docs.etherscan.io/rate-limits).
- [RFC 6585](https://www.rfc-editor.org/info/rfc6585/), especially section 4, “429 Too Many Requests”.
- [CometBFT documentation home](https://docs.cosmos.network/cometbft/latest/docs/README).
- [TON Jettons standard overview](https://docs.ton.org/contracts/standard/tokens/jettons/overview).
- Solana documentation from version-controlled source files in `solana-foundation/solana-com`, not rendered pages:
  - [`getGenesisHash`](https://github.com/solana-foundation/solana-com/blob/main/content/docs/rpc/http/getgenesishash.mdx).
  - [`getSlot`](https://github.com/solana-foundation/solana-com/blob/main/content/docs/rpc/http/getslot.mdx).
  - [`getSignatureStatuses`](https://github.com/solana-foundation/solana-com/blob/main/content/docs/rpc/http/getsignaturestatuses.mdx).
- Trust Wallet: [documentation home](https://developer.trustwallet.com/) and [Wallet Core repository](https://github.com/trustwallet/wallet-core).
