// Shared security-header policy for the Bawa Web starter (T47).
//
// One source of truth, used by:
// - vite.config.ts: `preview.headers` (served with `vite preview`) and the
//   build-only CSP <meta> injected into dist/index.html.
// - src/app/security-headers.test.ts: regression tests on the policy text.
//
// The policy is strict on purpose: the app loads no third-party script,
// style, font, image or worker resource. Everything except the pinned
// read-only provider fetches below is same-origin.
// Notes per directive:
// - script-src 'self' 'wasm-unsafe-eval': 'wasm-unsafe-eval' is REQUIRED for
//   WebAssembly.compile/instantiateStreaming (wallet-core WASM) once any CSP
//   is present; it does NOT re-enable eval(). No 'unsafe-inline': the built
//   output has no inline scripts, and inline script injection is the attack
//   this policy exists to stop (an injected script could substitute the
//   displayed receive address and exfiltrate xpubs from localStorage).
// - style-src 'self' 'unsafe-inline': Tailwind v4 + Radix/sonner use inline
//   style attributes; 'unsafe-inline' in style-src does not execute script.
// - img-src 'self' data: plus the five token-icon origins (token-verify
//   Lane A, 2026-11-24): raw.githubusercontent.com (Trust Wallet
//   Assets logos + Jupiter's list CSVs), assets.coingecko.com +
//   coin-images.coingecko.com (CoinGecko token images), tokens.1inch.io
//   and tokens.pancakeswap.finance (the lists' own logo hosts). A
//   token icon from any other host is never used (see
//   ALLOWED_TOKEN_ICON_HOSTS in wallet/token-verification.ts), so no
//   other image origin is needed. QR codes are inline SVG (no raster
//   fetch); data: is kept for favicon-style assets. font-src 'self'
//   data:: @fontsource woff2 is self-hosted; data: covers inlined
//   font subsets if any.
// - connect-src 'self' plus the one hundred and ninety-eight pinned provider origins: the//   same-origin wallet-core.wasm fetch plus the read-only balance/history
//   adapter endpoints — BTC https://mempool.space, ETH
//   https://ethereum-rpc.publicnode.com (RPC) and https://eth.blockscout.com
//   (history), TRX https://api.trongrid.io, TON https://toncenter.com, and
//   Lane A (token-verify, 2026-11-24): the four trusted-list origins —
//   tokens.1inch.io (1inch list), tokens.pancakeswap.finance (PancakeSwap
//   lists), tokens.uniswap.org (Uniswap Default list) and
//   raw.githubusercontent.com (Jupiter's list CSVs + Trust Wallet Assets
//   icons) — each verified live (200 + CORS *) before pinning.
//   the token-discovery chains: BSC/Polygon/Arbitrum/Optimism/Base/Avalanche
//   via publicnode.com, Solana https://solana-rpc.publicnode.com (primary)
//   + https://public.rpc.solanavibestation.com (fallback), Litecoin
//   https://litecoinspace.org, Dogecoin https://sochain.com (primary) +
//   https://api.blockcypher.com (fallback). History for the three wired
//   non-ETH EVM chains (gap 1, Lane D, 2026-11-23): Celo
//   https://celo.blockscout.com, Optimism https://explorer.optimism.io,
//   Scroll https://scrollscan.com. api.mainnet-beta.solana.com
//   was retired by the token-gaps programme (2026-11-22): it 403s browser
//   requests. Price feed: CoinGecko https://api.coingecko.com (keyless public API, on-demand quotes only; the optional free Demo key is sent as a header, never as a URL) and DexScreener https://api.dexscreener.com (keyless public API, the fallback price source for tokens CoinGecko does not list — README showcase + Add Token, item D, 2026-11-23; TonAPI rates for TON Jettons need no new origin, https://tonapi.io is already pinned). Lane C (FINISH THE PRODUCT, 2026-11-23): the CoinGecko fallback chain — CoinLore https://api.coinlore.net (keyless batched native-asset quotes, verified live) and Coinbase https://api.exchange.coinbase.com (keyless, LTC only, verified live); both fetch through price-fallbacks.ts when a CoinGecko quote is stale or missing.
//   UI/UX fixes, item 19 (2026-11-23): the backup RPCs — ETH
//   https://eth.drpc.org (dRPC public gateway; 1RPC was the backup
//   until 2026-11-24, when its shared free tier hit its usage limit
//   and every call returned -32001 "usage limit"; blastapi.io was the
//   first backup but is unreachable from the browser — still TypeError
//   after the CSP fix, and intermittent 403 from curl — so it was
//   dropped 2026-11-23), BTC https://blockstream.info,
//   BSC https://bsc-dataseed.binance.org, Optimism
//   https://mainnet.optimism.io, Avalanche https://api.avax.network, TON
//   balance fallback https://tonapi.io. UI/UX fixes, item 14 (2026-11-23):
//   the nine new Trust Wallet Core chains, primary + backup each —
//   Gnosis https://gnosis-rpc.publicnode.com + https://rpc.gnosischain.com,
//   Celo https://celo-rpc.publicnode.com + https://forno.celo.org, Linea
//   https://linea-rpc.publicnode.com + https://rpc.linea.build, Mantle
//   https://mantle-rpc.publicnode.com + https://rpc.mantle.xyz, Scroll
//   https://scroll-rpc.publicnode.com + https://rpc.scroll.io, opBNB
//   https://opbnb-rpc.publicnode.com +
//   https://opbnb-mainnet-rpc.bnbchain.org, Metis
//   https://metis-rpc.publicnode.com + https://andromeda.metis.io, Aurora
//   https://mainnet.aurora.dev + https://aurora.drpc.org (dRPC public
//   gateway, replacing 1RPC 2026-11-24 for the same usage-limit reason),
//   Fantom https://rpc.fantom.network + https://rpc2.fantom.network https://106.rpc.thirdweb.com https://361.rpc.thirdweb.com https://43111.rpc.thirdweb.com https://4689.rpc.thirdweb.com https://480.rpc.thirdweb.com https://50.rpc.thirdweb.com https://57.rpc.thirdweb.com https://60808.rpc.thirdweb.com https://747.rpc.thirdweb.com https://abstract.drpc.org https://apechain.drpc.org https://api.mainnet.abs.xyz https://api.mainnet.aptoslabs.com https://api.node.glif.io https://api.roninchain.com https://arbitrum-nova-rpc.publicnode.com https://astar.drpc.org https://axelar-rpc.polkachu.com https://axelar-rpc.publicnode.com https://babel-api.mainnet.iotex.io https://berachain-rpc.publicnode.com https://boba-ethereum.gateway.tenderly.co https://celestia-rpc.polkachu.com https://celestia-rpc.publicnode.com https://core.drpc.org https://cosmos-rpc.polkachu.com https://cosmos-rpc.publicnode.com https://cronos-evm-rpc.publicnode.com https://dydx-rpc.polkachu.com https://dydx-rpc.publicnode.com https://etc.etcdesktop.com https://eth-rpc-api.thetatoken.org https://evm-rpc.sei-apis.com https://evm.astar.network https://evm.confluxrpc.com https://evm.confluxrpc.org https://evm.cronos.com https://evm.kava.io https://evmexplorer.velas.com https://flare-api.flare.network https://flare.rpc.thirdweb.com https://fraxtal-rpc.publicnode.com https://fullnode.mainnet.aptoslabs.com https://fuse.drpc.org https://geth-at.etc-network.info https://horizon.stellar.lobstr.co https://horizon.stellar.org https://hyperliquid-rpc.publicnode.com https://immutable-zkevm.drpc.org https://injective-rpc.polkachu.com https://injective-rpc.publicnode.com https://juno-rpc.polkachu.com https://juno-rpc.publicnode.com https://kava-evm-rpc.publicnode.com https://mainnet-api.4160.nodely.dev https://mainnet-api.algonode.cloud https://mainnet-public.mirrornode.hedera.com https://mainnet.boba.network https://mainnet.era.zksync.io https://mainnet.evm.nodes.onflow.org https://mainnet.mirrornode.hedera.com https://mainnet.mode.network https://mainnet.unichain.org https://manta-pacific.drpc.org https://mode.drpc.org https://monad.drpc.org https://mycrypto.rsk.co https://near.drpc.org https://noble-rpc.polkachu.com https://nova.arbitrum.io https://osmosis-rpc.publicnode.com https://pacific-rpc.manta.network https://polkadot-rpc.publicnode.com https://public-node.rsk.co https://pulsechain-rpc.publicnode.com https://ronin.drpc.org https://rpc-gel.inkonchain.com https://rpc-noble.keplr.app https://rpc-qnd.inkonchain.com https://rpc.ankr.com https://rpc.apechain.com https://rpc.berachain.com https://rpc.chiliz.com https://rpc.coredao.org https://rpc.frax.com https://rpc.fuse.io https://rpc.gobob.xyz https://rpc.hemi.network https://rpc.hyperliquid.xyz https://rpc.immutable.com https://rpc.mainnet.near.org https://rpc.mainnet.taiko.xyz https://rpc.monad.xyz https://rpc.osmosis.zone https://rpc.polkadot.io https://rpc.pulsechain.com https://rpc.soneium.org https://rpc.soniclabs.com https://rpc.syscoin.org https://rpc.telos.net https://rpc.tzbeta.net https://rpc.tzkt.io https://rpc.xdc.network https://rpc.xlayer.tech https://rpc.zora.energy https://s1.ripple.com:51234 https://sei-rpc.polkachu.com https://sei-rpc.publicnode.com https://sei.drpc.org https://soneium-rpc.publicnode.com https://songbird-api.flare.network https://sonic-rpc.publicnode.com https://taiko-rpc.publicnode.com https://telos.drpc.org https://unichain-rpc.publicnode.com https://worldchain-mainnet.g.alchemy.com https://xlayerrpc.okx.com https://xrplcluster.com https://zetachain-evm.blockpi.network https://zetachain-mainnet.g.allthatnode.com https://zksync.drpc.org https://zora.drpc.org https://etc.blockscout.com https://explorer.fuse.io https://explorer.hemi.xyz https://explorer.mode.network https://explorer.roninchain.com https://explorer.syscoin.org https://flare-explorer.flare.network https://pacific-explorer.manta.network https://songbird-explorer.flare.network https://zetascan.com. The ten Blockscout-v2 explorer bases above (mode, manta, ronin, fuse, syscoin, songbird, etc, flare, zetachain, hemi) serve the /track lookups, probed live 2026-11-24. Lane 80-APP (2026-11-24): the 122 origins above are the sixty-two expanded chains' primary + backup RPC endpoints. Lane B
//   (Finish the Product, 2026-11-23): the nine newly-wired history
//   hosts — Optimism https://explorer.optimism.io, Scroll
//   https://scrollscan.com, Celo https://celo.blockscout.com, Aurora
//   https://explorer.aurora.dev, Avalanche + Mantle via Routescan
//   https://api.routescan.io, Polygon https://polygon.blockscout.com,
//   Base https://base.blockscout.com, Arbitrum
//   https://arbitrum.blockscout.com. Fix-All Lane A (2026-11-24): four
//   more origins, each live-probed before pinning — TRX TronScan
//   balance/history fallback https://apilist.tronscanapi.com, TRX
//   PublicNode full-node backup https://tron-rpc.publicnode.com, Linea
//   history via Etherscan V2 https://api.etherscan.io plus its
//   explorer base https://lineascan.build (the /track lookup fetches
//   the explorer base, so it is a fetch origin too). The same lane
//   also replaced the two dead 1RPC backups (usage limit -32001,
//   2026-11-24) with dRPC: ETH https://eth.drpc.org, Aurora
//   https://aurora.drpc.org — both verified live returning Vitalik's
//   exact on-chain balance; https://1rpc.io is no longer pinned.
//   dogechain.info was pinned and then removed in the same lane: it
//   sends no CORS headers, so a browser can never fetch it (CDP
//   round 2: the same URL 200s in Node and ERR_FAILEDs in the
//   browser) — see the DOGE adapter header for the full evidence.
//   hosts were live-probed before pinning; without them the browser
//   refuses the history fetch (CSP) and the chain shows "history
//   unavailable" even though the adapter is wired — caught live in
//   CDP 2026-11-23. A chain or backup added to the registry without a
//   matching entry here is dead in the browser — CSP refuses the fetch
//   before any request is sent — so the security-headers test pins
//   every registry origin (drift guard).
//   TEMPORARY devnet mode (Lane D, 2026-11-22): five more origins for the
//   test networks — ETH Sepolia https://ethereum-sepolia-rpc.publicnode.com
//   (RPC) and https://eth-sepolia.blockscout.com (history), TRX Nile
//   https://nile.trongrid.io and https://api.nileex.io (fallback), TON
//   testnet https://testnet.toncenter.com. BTC testnet4 needs no new
//   origin (same https://mempool.space host). Without these, the browser
//   refuses every devnet fetch and devnet mode is dead in the app even
//   though the endpoints answer curl. Devnet is TEMPORARY: the removal
//   checklist in docs/DECISIONS.md reverts this line and the test to the
//   fifty-seven mainnet origins.
//   Lane F (FIX-ALL, 2026-11-24): two more mainnet origins for the
//   one-tap custom RPCs on the Networks screen — Flashbots
//   https://rpc.flashbots.net and dRPC https://eth.drpc.org, both
//   keyless public ETH gateways verified live (eth_chainId 0x1 +
//   eth_blockNumber at the live tip). The CSP is baked into the built
//   index.html and cannot learn a new host at runtime, so a custom
//   RPC outside this list would be stored but refused on every fetch
//   — the Networks screen only accepts origins in this list (see
//   isCustomRpcOriginUsable in wallet/chains.ts) and the test below
//   pins the suggestion origins here. Rejected the same day:
//   LlamaRPC (HTTP 525), Ankr public (now keyed), Cloudflare-eth
//   (refuses eth_blockNumber).
//   Lane A (FIX-ALL, 2026-11-24) removed 1rpc.io from this list: both
//   1RPC backups returned -32001 usage-limit and were replaced by dRPC.//   No other origin, no wildcard. Explorer links (tronscan.org,
//   tonviewer.com) are plain links, not fetches, so they need no entry.
// - object-src 'none', base-uri 'self': no plugins, no <base> hijack.
// - frame-ancestors 'none' is in the shared string: it is ignored when the
//   policy is delivered via a <meta> tag, but enforced as an HTTP header
//   (preview.headers and production hosting) — see README.md. X-Frame-Options
//   is header-only and covers older browsers.
// Lane C (install-all-usable, 2026-11-25): three WalletConnect
// origins for the Sign v2 client (2.21.0). The relay is the only
// transport the client opens: wss://relay.walletconnect.org (the
// Sign v2 default relayUrl). The Verify API checks a proposing
// dApp's origin: https://verify.walletconnect.org (base, /v3) with
// https://verify.walletconnect.com as the fallback the SDK lists.
// Read from the installed 2.21.0 core bundle, not assumed.
// Deliberately NOT pinned: pulse.walletconnect.org (analytics
// batching) and echo.walletconnect.com (push) — the wallet sends no
// telemetry and takes no push notifications, so those fetches stay
// refused. rpc.walletconnect.org appears only in the UMD bundle, not
// the ES build the app ships, so it is not pinned either.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://raw.githubusercontent.com https://assets.coingecko.com https://coin-images.coingecko.com https://tokens.1inch.io https://tokens.pancakeswap.finance",
  "font-src 'self' data:",
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.drpc.org https://rpc.flashbots.net https://eth.blockscout.com https://explorer.optimism.io https://scrollscan.com https://celo.blockscout.com https://explorer.aurora.dev https://api.routescan.io https://polygon.blockscout.com https://base.blockscout.com https://arbitrum.blockscout.com https://api.etherscan.io https://lineascan.build https://api.trongrid.io https://apilist.tronscanapi.com https://tron-rpc.publicnode.com https://toncenter.com https://api.coingecko.com https://api.dexscreener.com https://api.coinlore.net https://api.exchange.coinbase.com https://bsc-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://arbitrum-rpc.publicnode.com https://optimism-rpc.publicnode.com https://base-rpc.publicnode.com https://avalanche-rpc.publicnode.com https://solana-rpc.publicnode.com https://public.rpc.solanavibestation.com https://litecoinspace.org https://sochain.com https://api.blockcypher.com https://blockstream.info https://bsc-dataseed.binance.org https://mainnet.optimism.io https://api.avax.network https://tonapi.io https://gnosis-rpc.publicnode.com https://rpc.gnosischain.com https://celo-rpc.publicnode.com https://forno.celo.org https://linea-rpc.publicnode.com https://rpc.linea.build https://mantle-rpc.publicnode.com https://rpc.mantle.xyz https://scroll-rpc.publicnode.com https://rpc.scroll.io https://opbnb-rpc.publicnode.com https://opbnb-mainnet-rpc.bnbchain.org https://metis-rpc.publicnode.com https://andromeda.metis.io https://mainnet.aurora.dev https://aurora.drpc.org https://rpc.fantom.network https://rpc2.fantom.network https://106.rpc.thirdweb.com https://361.rpc.thirdweb.com https://43111.rpc.thirdweb.com https://4689.rpc.thirdweb.com https://480.rpc.thirdweb.com https://50.rpc.thirdweb.com https://57.rpc.thirdweb.com https://60808.rpc.thirdweb.com https://747.rpc.thirdweb.com https://abstract.drpc.org https://apechain.drpc.org https://api.mainnet.abs.xyz https://api.mainnet.aptoslabs.com https://api.node.glif.io https://api.roninchain.com https://arbitrum-nova-rpc.publicnode.com https://astar.drpc.org https://axelar-rpc.polkachu.com https://axelar-rpc.publicnode.com https://babel-api.mainnet.iotex.io https://berachain-rpc.publicnode.com https://boba-ethereum.gateway.tenderly.co https://celestia-rpc.polkachu.com https://celestia-rpc.publicnode.com https://core.drpc.org https://cosmos-rpc.polkachu.com https://cosmos-rpc.publicnode.com https://cronos-evm-rpc.publicnode.com https://dydx-rpc.polkachu.com https://dydx-rpc.publicnode.com https://etc.etcdesktop.com https://eth-rpc-api.thetatoken.org https://evm-rpc.sei-apis.com https://evm.astar.network https://evm.confluxrpc.com https://evm.confluxrpc.org https://evm.cronos.com https://evm.kava.io https://evmexplorer.velas.com https://flare-api.flare.network https://flare.rpc.thirdweb.com https://fraxtal-rpc.publicnode.com https://fullnode.mainnet.aptoslabs.com https://fuse.drpc.org https://geth-at.etc-network.info https://horizon.stellar.lobstr.co https://horizon.stellar.org https://hyperliquid-rpc.publicnode.com https://immutable-zkevm.drpc.org https://injective-rpc.polkachu.com https://injective-rpc.publicnode.com https://juno-rpc.polkachu.com https://juno-rpc.publicnode.com https://kava-evm-rpc.publicnode.com https://mainnet-api.4160.nodely.dev https://mainnet-api.algonode.cloud https://mainnet-public.mirrornode.hedera.com https://mainnet.boba.network https://mainnet.era.zksync.io https://mainnet.evm.nodes.onflow.org https://mainnet.mirrornode.hedera.com https://mainnet.mode.network https://mainnet.unichain.org https://manta-pacific.drpc.org https://mode.drpc.org https://monad.drpc.org https://mycrypto.rsk.co https://near.drpc.org https://noble-rpc.polkachu.com https://nova.arbitrum.io https://osmosis-rpc.publicnode.com https://pacific-rpc.manta.network https://polkadot-rpc.publicnode.com https://public-node.rsk.co https://pulsechain-rpc.publicnode.com https://ronin.drpc.org https://rpc-gel.inkonchain.com https://rpc-noble.keplr.app https://rpc-qnd.inkonchain.com https://rpc.ankr.com https://rpc.apechain.com https://rpc.berachain.com https://rpc.chiliz.com https://rpc.coredao.org https://rpc.frax.com https://rpc.fuse.io https://rpc.gobob.xyz https://rpc.hemi.network https://rpc.hyperliquid.xyz https://rpc.immutable.com https://rpc.mainnet.near.org https://rpc.mainnet.taiko.xyz https://rpc.monad.xyz https://rpc.osmosis.zone https://rpc.polkadot.io https://rpc.pulsechain.com https://rpc.soneium.org https://rpc.soniclabs.com https://rpc.syscoin.org https://rpc.telos.net https://rpc.tzbeta.net https://rpc.tzkt.io https://rpc.xdc.network https://rpc.xlayer.tech https://rpc.zora.energy https://s1.ripple.com:51234 https://sei-rpc.polkachu.com https://sei-rpc.publicnode.com https://sei.drpc.org https://soneium-rpc.publicnode.com https://songbird-api.flare.network https://sonic-rpc.publicnode.com https://taiko-rpc.publicnode.com https://telos.drpc.org https://unichain-rpc.publicnode.com https://worldchain-mainnet.g.alchemy.com https://xlayerrpc.okx.com https://xrplcluster.com https://zetachain-evm.blockpi.network https://zetachain-mainnet.g.allthatnode.com https://zksync.drpc.org https://zora.drpc.org https://etc.blockscout.com https://explorer.fuse.io https://explorer.hemi.xyz https://explorer.mode.network https://explorer.roninchain.com https://explorer.syscoin.org https://flare-explorer.flare.network https://pacific-explorer.manta.network https://songbird-explorer.flare.network https://zetascan.com https://ethereum-sepolia-rpc.publicnode.com https://eth-sepolia.blockscout.com https://nile.trongrid.io https://api.nileex.io https://testnet.toncenter.com https://tokens.1inch.io https://tokens.pancakeswap.finance https://tokens.uniswap.org https://raw.githubusercontent.com wss://relay.walletconnect.org https://verify.walletconnect.org https://verify.walletconnect.com",  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // frame-ancestors is ignored when this policy is delivered via a <meta>
  // tag, but it is enforced when delivered as an HTTP header (preview.headers
  // and production hosting). Keeping it in the single shared string means
  // the header path is protected and the meta path is unaffected.
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};
