# Canonical References

These are the primary specifications and upstream projects Bawa relies on. Re-check current implementation behavior before production releases.

## Standards

- BIP-32 — https://bips.dev/32/
- BIP-39 — https://bips.dev/39/
- BIP-43 — https://bips.dev/43/
- BIP-44 — https://bips.dev/44/
- BIP-84 — https://bips.dev/84/
- BIP-141 — https://bips.dev/141/
- BIP-173 — https://bips.dev/173/
- BIP-174 / PSBT — https://bips.dev/174/
- BIP-321 — https://bips.dev/321/
- BIP-371 / Taproot PSBT — https://bips.dev/371/
- EIP-681 — https://eips.ethereum.org/EIPS/eip-681
- SLIP-0010 — https://github.com/satoshilabs/slips/blob/master/slip-0010.md
- SLIP-0044 — https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- SLIP-0132 — https://github.com/satoshilabs/slips/blob/master/slip-0132.md
- TON TEP-3 — https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md

## Trust Wallet ecosystem

- Trust Wallet organization — https://github.com/trustwallet
- Wallet Core — https://github.com/trustwallet/wallet-core
- Wallet Core README — https://github.com/trustwallet/wallet-core/blob/master/README.md
- Wallet Core HDWallet API — https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/
- Wallet Core registry fields — https://github.com/trustwallet/wallet-core/blob/4.9.3/docs/registry-fields.md
- Wallet Core registry — https://github.com/trustwallet/wallet-core/blob/4.9.3/registry.json

The primary registry references are pinned to Wallet Core 4.9.3, matching tools/hdwallet-gen/package-lock.json.

- Trust Wallet Assets — https://github.com/trustwallet/assets
- Assets repository overview — https://github.com/trustwallet/assets/blob/master/knowledge/architecture/repo-overview.md

## Independent verification

- bip_utils — https://github.com/ebellocchia/bip_utils
- PyPI bip-utils — https://pypi.org/project/bip-utils/
- @hdwallet/core — https://www.npmjs.com/package/@hdwallet/core

The last item is reference/research material only; its current npm page states that it is not ready for production use.

## Live services the app calls

Lane C, FIX-ALL programme, 2026-11-24. The full entries — what each service does for the wallet, which chains it covers, and its free and paid tiers with source pages — live in docs/13 (RPCs), docs/06 (history indexers) and ADR-0007 (price sources). This section is the link index only.

### RPC providers

- PublicNode — https://publicnode.com
- 1RPC — https://1rpc.io — pricing: https://1rpc.io (plans on the homepage)
- TronGrid — https://www.trongrid.io — rate limits: https://developers.tron.network/reference/rate-limits
- TonCenter — https://toncenter.com — rate limits: https://docs.ton.org/api/rate-limit
- TonAPI — https://tonapi.io — pricing: https://console.tonapi.io
- mempool.space API — https://mempool.space/docs/api/rest
- Blockstream Esplora API — https://github.com/Blockstream/esplora/blob/master/API.md
- Litecoinspace — https://litecoinspace.org
- SoChain — https://sochain.com — limits: https://sochain.com/docs/limits — pricing: https://sochain.com/pricing
- BlockCypher — https://www.blockcypher.com — pricing: https://www.blockcypher.com/pricing.html — rate limits: https://www.blockcypher.com/dev/
- Binance public dataseed — https://bsc-dataseed.binance.org

### History indexers

- Blockscout — https://blockscout.com — Pro API docs: https://docs.blockscout.com/devs/pro-api.md
- Routescan — https://routescan.io — pricing: https://routescan.io/pricing
- Scrollscan — https://scrollscan.com
- Etherscan API rate limits — https://info.etherscan.com/api-return-errors/

### Price sources

- CoinGecko API — https://api.coingecko.com/api/v3 — pricing: https://www.coingecko.com/en/api/pricing — terms: https://www.coingecko.com/en/api_terms
- CoinLore API — https://www.coinlore.com/cryptocurrency-data-api
- DexScreener API — https://docs.dexscreener.com/api/reference
- TonAPI rates — https://tonapi.io
- Coinbase Exchange API rate limits — https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits

## Repositories the wallet draws from

- Trust Wallet Core — https://github.com/trustwallet/wallet-core
- Trust Wallet Assets — https://github.com/trustwallet/assets
- viem — https://github.com/wevm/viem
- @scure/bip39 — https://github.com/paulmillr/scure-bip39
- Blockstream Esplora — https://github.com/Blockstream/esplora
- mempool — https://github.com/mempool/mempool
- Blockscout — https://github.com/blockscout/blockscout
- Cosmos Chain Registry — https://github.com/cosmos/chain-registry
- consenlabs/token-ui (vendored) — https://github.com/ConsenLabs/token-ui
- ui-ux-pro-max-skill — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Ivy Wallet (patterns only, GPL-3.0) — https://github.com/Ivy-Apps/ivy-wallet
