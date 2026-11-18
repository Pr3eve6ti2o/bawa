No tools; you cannot read files. Reply with the file's complete contents in a fenced code block; the lane agent will save, build and test it.

Task: Phase 0.3 plus guide PR2, apps/web, TypeScript strict, no new dependencies. chains.ts is a capability registry, not a chain list: listing a chain never implies it can do an operation.

Per chain (btc, eth, trx, ton): display name, symbol, Wallet Core coin-type name, CAIP-2 networkId (BTC bip122:000000000019d6689c085ae165831e93, ETH eip155:1, TRX tron:0x2b6653dc, TON ton:-239), CAIP-19 native assetId via the slip44 namespace and SLIP-44 coin type (BTC 0, ETH 60, TRX 195, TON 607), pinned profileId plus pathFor(account, index) (BTC bawa-btc-bip84-v1 m/84'/0'/0'/0/i, ETH bawa-evm-bip44-v1 m/44'/60'/0'/0/i, TRX bawa-trx-bip44-v1 m/44'/195'/0'/0/i, TON bawa-ton-v4r2-v1 m/44'/607'/0' fully hardened, Wallet V4 R2, workchain 0, wallet ID 698983191), RPC endpoints (ETH viem mainnet, TRX https://api.trongrid.io, TON https://toncenter.com/api/v2/jsonRPC, BTC Electrum-WS/proxy marked not-yet-implemented), EVM chain ID (1 for ETH, null otherwise).

Capabilities per chain, each verified, blocked, unsupported or candidate with evidence: derive, restore, receive, balance, history, fee-quote, unsigned-plan, local-sign, post-sign-verify. For all four: derive, restore, receive verified; the other six blocked (no Phase 2 adapter yet; no transaction construction in this lane). Never mark verified on a listing alone.

Name two Solana profiles as unsupported, no code path using them: walletcore-solana-default-v1 (m/44'/501'/0', solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) and solana-phantom-bip44change-v1 (m/44'/501'/{i}'/0'). Never hard-code a single Solana path.

Export CHAINS, ChainId (reuse from '../engine/boundary'), pathFor, chainConfig, profileFor, capabilitiesFor(chain), availableFor(capability) (only verified), assertSupported(chain, capability) throwing a typed error naming the exact unavailable combination. A testnet request throws. No secrets.
