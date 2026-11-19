You are writing TypeScript for the Bawa wallet repo (Wallet Core 4.9.3, strict TS, noUncheckedIndexedAccess). File: apps/web/src/wallet/chains.ts. Do NOT change the 4 existing chain entries (btc, eth, trx, ton) or capabilitiesForAdapterChain. Emit ONLY new/changed code blocks, each in its own fenced typescript block with a one-line anchor comment stating where it goes.

Context (verified first-hand, do not re-derive): every new chain's derivation was verified with Wallet Core 4.9.3 on the public BIP-39 test-vector mnemonic: getAddressForCoin == explicit-key path address == xpub round-trip, CoinTypeExt.validate true. EVM chains share ETH's path m/44'/60'/0'/0/i and xpub version 0488b21e, so they share the ETH address. LTC is BIP84 m/84'/2'/0'/0/i, Ltub version 019da462. DOGE is BIP44 m/44'/3'/0'/0/i, dgub version 02facafd. SOL is Ed25519, default path m/44'/501'/0', no xpub. No adapter or send builder exists for any new chain: balance, history, fee-quote, unsigned-plan, local-sign, post-sign-verify are all blocked, never faked.

1. Extend the ChainConfig coinTypeName union to add: 'solana' | 'smartChain' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalancheCChain' | 'litecoin' | 'dogecoin'. Anchor: the coinTypeName line.

2. Add a function capabilitiesForExtendedChain(chain: ChainId): Capabilities, placed right after capabilitiesForAdapterChain. derive, restore, receive: status 'verified', evidence 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for <capability>.'. balance, history, fee-quote: status 'blocked', evidence 'No <chain> adapter in this lane; <capability> is blocked, never faked.'. unsigned-plan, local-sign, post-sign-verify: status 'blocked', evidence 'No <chain> send builder in this lane; <capability> is blocked, never faked.'. Replace <chain>/<capability> with the real names in each string.

3. Add these 9 entries to the CHAINS record, after the ton entry, in this order, matching the existing style (2-space indent, single quotes, trailing commas, pathFor calls assertAccountIndex(account, index) first; rpcEndpoints: [] for all nine; pathFor for sol ignores account/index and returns "m/44'/501'/0'" like ton does):
- sol: displayName 'Solana', symbol 'SOL', coinTypeName 'solana', networkId 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', assetId 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501', profileId 'bawa-sol-bip44-v1', pathFor "m/44'/501'/0'", evmChainId null, capabilities capabilitiesForExtendedChain('sol').
- bsc: 'BNB Smart Chain', 'BNB', 'smartChain', 'eip155:56', 'eip155:56/slip44:714', 'bawa-evm-bip44-v1', "m/44'/60'/${account}'/0/${index}", evmChainId 56.
- matic: 'Polygon', 'POL', 'polygon', 'eip155:137', 'eip155:137/slip44:966', 'bawa-evm-bip44-v1', same EVM path shape, evmChainId 137.
- arb: 'Arbitrum One', 'ETH', 'arbitrum', 'eip155:42161', 'eip155:42161/slip44:60', 'bawa-evm-bip44-v1', same EVM path shape, evmChainId 42161.
- op: 'OP Mainnet', 'ETH', 'optimism', 'eip155:10', 'eip155:10/slip44:60', 'bawa-evm-bip44-v1', same EVM path shape, evmChainId 10.
- base: 'Base', 'ETH', 'base', 'eip155:8453', 'eip155:8453/slip44:60', 'bawa-evm-bip44-v1', same EVM path shape, evmChainId 8453.
- avax: 'Avalanche C-Chain', 'AVAX', 'avalancheCChain', 'eip155:43114', 'eip155:43114/slip44:9000', 'bawa-evm-bip44-v1', same EVM path shape, evmChainId 43114.
- ltc: 'Litecoin', 'LTC', 'litecoin', 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2', 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2', 'bawa-ltc-bip84-v1', "m/84'/2'/${account}'/0/${index}", evmChainId null.
- doge: 'Dogecoin', 'DOGE', 'dogecoin', 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691', 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3', 'bawa-doge-bip44-v1', "m/44'/3'/${account}'/0/${index}", evmChainId null.
Each EVM/UTXO entry's capabilities is capabilitiesForExtendedChain('<id>').

4. Replace the SUPPORTED_CHAINS line with: ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'].

5. Replace the SOLANA_PROFILES block: delete the 'walletcore-solana-default-v1' entry (that profile is now the supported chain entry above). Keep only 'solana-phantom-bip44change-v1' with its existing fields unchanged. Rewrite the comment above it to say the Wallet Core default Solana profile is now supported as bawa-sol-bip44-v1 and only the Phantom bip44Change profile stays unsupported.

Acceptance: strict TS compiles; every new entry has derive/restore/receive verified and the other six capabilities blocked; no existing entry touched. Output only the code blocks plus anchors, no other prose.
