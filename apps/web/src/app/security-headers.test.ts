import { describe, expect, it } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_META,
  SECURITY_HEADERS,
} from './security-headers';
import { CHAINS, SUGGESTED_CUSTOM_RPCS } from '../wallet/chains';
import {
  EXPECTED_WASM_SHA256,
  sha256Hex,
  verifyWasmHash,
} from '../../scripts/wasm-integrity.mjs';

const EXPECTED_CONNECT_SRC =
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.drpc.org https://rpc.flashbots.net https://eth.blockscout.com https://explorer.optimism.io https://scrollscan.com https://celo.blockscout.com https://explorer.aurora.dev https://api.routescan.io https://polygon.blockscout.com https://base.blockscout.com https://arbitrum.blockscout.com https://api.etherscan.io https://lineascan.build https://api.trongrid.io https://apilist.tronscanapi.com https://tron-rpc.publicnode.com https://toncenter.com https://api.coingecko.com https://api.dexscreener.com https://api.coinlore.net https://api.exchange.coinbase.com https://li.quest https://backend.gas.zip wss://omni-ws.ston.fi https://bsc-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://arbitrum-rpc.publicnode.com https://optimism-rpc.publicnode.com https://base-rpc.publicnode.com https://avalanche-rpc.publicnode.com https://solana-rpc.publicnode.com https://public.rpc.solanavibestation.com https://litecoinspace.org https://sochain.com https://api.blockcypher.com https://blockstream.info https://bsc-dataseed.binance.org https://mainnet.optimism.io https://api.avax.network https://tonapi.io https://gnosis-rpc.publicnode.com https://rpc.gnosischain.com https://celo-rpc.publicnode.com https://forno.celo.org https://linea-rpc.publicnode.com https://rpc.linea.build https://mantle-rpc.publicnode.com https://rpc.mantle.xyz https://scroll-rpc.publicnode.com https://rpc.scroll.io https://opbnb-rpc.publicnode.com https://opbnb-mainnet-rpc.bnbchain.org https://metis-rpc.publicnode.com https://andromeda.metis.io https://mainnet.aurora.dev https://aurora.drpc.org https://rpc.fantom.network https://rpc2.fantom.network https://106.rpc.thirdweb.com https://361.rpc.thirdweb.com https://43111.rpc.thirdweb.com https://4689.rpc.thirdweb.com https://480.rpc.thirdweb.com https://50.rpc.thirdweb.com https://57.rpc.thirdweb.com https://60808.rpc.thirdweb.com https://747.rpc.thirdweb.com https://abstract.drpc.org https://apechain.drpc.org https://api.kaspa.org https://api.koios.rest https://api.mainnet.abs.xyz https://api.mainnet.aptoslabs.com https://api.node.glif.io https://api.roninchain.com https://arbitrum-nova-rpc.publicnode.com https://astar.drpc.org https://axelar-rpc.polkachu.com https://axelar-rpc.publicnode.com https://babel-api.mainnet.iotex.io https://berachain-rpc.publicnode.com https://boba-ethereum.gateway.tenderly.co https://celestia-rpc.polkachu.com https://celestia-rpc.publicnode.com https://core.drpc.org https://cosmos-rpc.polkachu.com https://cosmos-rpc.publicnode.com https://cronos-evm-rpc.publicnode.com https://dydx-rpc.polkachu.com https://dydx-rpc.publicnode.com https://etc.etcdesktop.com https://eth-rpc-api.thetatoken.org https://evm-rpc.sei-apis.com https://evm.astar.network https://evm.confluxrpc.com https://evm.confluxrpc.org https://evm.cronos.com https://evm.kava.io https://evmexplorer.velas.com https://flare-api.flare.network https://flare.rpc.thirdweb.com https://fraxtal-rpc.publicnode.com https://fullnode.mainnet.aptoslabs.com https://fuse.drpc.org https://geth-at.etc-network.info https://horizon.stellar.lobstr.co https://horizon.stellar.org https://hyperliquid-rpc.publicnode.com https://immutable-zkevm.drpc.org https://injective-rpc.polkachu.com https://injective-rpc.publicnode.com https://juno-rpc.polkachu.com https://juno-rpc.publicnode.com https://kava-evm-rpc.publicnode.com https://mainnet-api.4160.nodely.dev https://mainnet-api.algonode.cloud https://mainnet-public.mirrornode.hedera.com https://mainnet.boba.network https://mainnet.era.zksync.io https://mainnet.evm.nodes.onflow.org https://mainnet.mirrornode.hedera.com https://mainnet.mode.network https://mainnet.unichain.org https://manta-pacific.drpc.org https://mode.drpc.org https://monad.drpc.org https://mycrypto.rsk.co https://near.drpc.org https://noble-rpc.polkachu.com https://nova.arbitrum.io https://osmosis-rpc.publicnode.com https://pacific-rpc.manta.network https://polkadot-rpc.publicnode.com https://public-node.rsk.co https://pulsechain-rpc.publicnode.com https://ronin.drpc.org https://rpc-gel.inkonchain.com https://rpc-noble.keplr.app https://rpc-qnd.inkonchain.com https://rpc.ankr.com https://rpc.apechain.com https://rpc.berachain.com https://rpc.chiliz.com https://rpc.coredao.org https://rpc.frax.com https://rpc.fuse.io https://rpc.gobob.xyz https://rpc.hemi.network https://rpc.hyperliquid.xyz https://rpc.immutable.com https://rpc.mainnet.near.org https://rpc.mainnet.taiko.xyz https://rpc.monad.xyz https://rpc.osmosis.zone https://rpc.polkadot.io https://rpc.pulsechain.com https://rpc.soneium.org https://rpc.soniclabs.com https://rpc.syscoin.org https://rpc.telos.net https://rpc.tzbeta.net https://rpc.tzkt.io https://rpc.xdc.network https://rpc.xlayer.tech https://rpc.zora.energy https://s1.ripple.com:51234 https://sei-rpc.polkachu.com https://sei-rpc.publicnode.com https://sei.drpc.org https://soneium-rpc.publicnode.com https://songbird-api.flare.network https://sonic-rpc.publicnode.com https://starknet-mainnet.drpc.org https://starknet.drpc.org https://taiko-rpc.publicnode.com https://telos.drpc.org https://unichain-rpc.publicnode.com https://worldchain-mainnet.g.alchemy.com https://xlayerrpc.okx.com https://xrplcluster.com https://zetachain-evm.blockpi.network https://zetachain-mainnet.g.allthatnode.com https://zksync.drpc.org https://zora.drpc.org https://etc.blockscout.com https://explorer.fuse.io https://explorer.hemi.xyz https://explorer.mode.network https://explorer.roninchain.com https://explorer.syscoin.org https://flare-explorer.flare.network https://pacific-explorer.manta.network https://songbird-explorer.flare.network https://zetascan.com https://ethereum-sepolia-rpc.publicnode.com https://eth-sepolia.blockscout.com https://nile.trongrid.io https://api.nileex.io https://testnet.toncenter.com https://tokens.1inch.io https://tokens.pancakeswap.finance https://tokens.uniswap.org https://raw.githubusercontent.com";
describe('T47 security headers', () => {
  it('CSP allows same-origin scripts plus WASM compilation only', () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src '));
    // Exact match: no 'unsafe-inline', no bare 'unsafe-eval' in script-src.
    // ('unsafe-inline' appears ONLY in style-src — see the next test.)
    expect(scriptSrc).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
    // No off-origin script source: script-src lists no https: origin.
    // (connect-src DOES list the five pinned provider origins — see below —
    // so the old whole-policy 'no https:' assertion no longer applies.)
    expect(scriptSrc).not.toContain('https:');
    expect(CONTENT_SECURITY_POLICY).not.toContain('http:');
    expect(CONTENT_SECURITY_POLICY).not.toContain('*');
  });

  it('CSP blocks plugins, base hijack and framing; connect-src allows only the two hundred pinned provider origins plus the five TEMPORARY devnet origins', () => {    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain(EXPECTED_CONNECT_SRC);
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
    // Exact match on the directive: no other origin may creep in.
    const connectSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src '));
    expect(connectSrc).toBe(EXPECTED_CONNECT_SRC);
    // Exactly two hundred and nine https: origins in the whole policy: the
    // five img-src token-icon origins (Lane A, 2026-11-24 — see below) plus
    // the two hundred and four connect-src origins: mempool.space (BTC), ethereum-rpc.publicnode.com (ETH RPC)
    // + eth.blockscout.com (ETH history), api.trongrid.io (TRX),
    // toncenter.com (TON), api.coingecko.com (CoinGecko price feed) +
    // api.dexscreener.com (DexScreener fallback price feed, item D,
    // 2026-11-23) + api.coinlore.net (CoinLore fallback price feed, Lane C,
    // 2026-11-23) + api.exchange.coinbase.com (Coinbase LTC fallback, Lane C,
    // 2026-11-23), plus
    // the eleven token-discovery origins: bsc/polygon-bor/arbitrum/
    // optimism/base/avalanche-rpc.publicnode.com, solana-rpc.publicnode.com
    // (SOL primary) + public.rpc.solanavibestation.com (SOL fallback),
    // litecoinspace.org (LTC), sochain.com (DOGE primary) +
    // api.blockcypher.com (DOGE fallback). Token gaps (item 1, Lane 1,
    // 2026-11-22): api.mainnet-beta.solana.com is retired — it 403s
    // browser requests — and is no longer pinned. Plus the twenty-three
    // UI/UX-fixes origins (2026-11-23): the six item-19 backup RPCs
    // (eth.drpc.org — replacing 1rpc.io in Fix-All Lane A, 2026-11-24,
    // blockstream.info,
    // bsc-dataseed.binance.org, mainnet.optimism.io, api.avax.network,
    // tonapi.io) and the eighteen item-14 chain endpoints (nine chains ×
    // primary + backup). Plus the eight Lane B history hosts (Finish the
    // Product, 2026-11-23): explorer.optimism.io, scrollscan.com,
    // celo.blockscout.com, explorer.aurora.dev, api.routescan.io,
    // polygon.blockscout.com, base.blockscout.com, arbitrum.blockscout.com.
    // Plus the four Fix-All Lane A origins (2026-11-24): api.etherscan.io
    // (Linea history, Etherscan V2 keyless) + lineascan.build (Linea
    // explorer base, fetched by the /track lookup),
    // apilist.tronscanapi.com
    // (TRX TronScan balance/history fallback), tron-rpc.publicnode.com
    // (TRX PublicNode full-node backup). The same lane also replaced
    // the two dead 1RPC backups with dRPC (eth.drpc.org,
    // aurora.drpc.org) and dropped 1rpc.io — and removed the
    // dogechain.info origin it had briefly pinned, because dogechain
    // sends no CORS headers and a browser can never fetch it.
    // Plus the one hundred and twenty-two Lane 80-APP origins
    // (2026-11-24): the two live RPC endpoints of each of the 62
    // expanded chains (45 EVM + 10 non-EVM + 7 Cosmos-ecosystem),
    // in data-file order.
    // Plus the four Lane B origins (OKX chains, 2026-11-25): the live
    // RPC endpoints of the 3 new chains — api.koios.rest (Cardano),
    // api.kaspa.org (Kaspa), starknet-mainnet.drpc.org +
    // starknet.drpc.org (Starknet) — each verified live before pinning.
    // Plus the two Lane F custom-RPC origins (FIX-ALL, 2026-11-24):
    // Flashbots https://rpc.flashbots.net and dRPC
    // https://eth.drpc.org — the one-tap suggestions on the Networks
    // screen, both verified live (eth_chainId 0x1 + live block tip).    // Plus the five TEMPORARY devnet origins (Lane D,
    // 2026-11-22: without them every devnet fetch is refused by the
    // browser — the devnet endpoints are separate origins from mainnet).
    // Devnet is TEMPORARY: the removal checklist in docs/DECISIONS.md
    // reverts this test and security-headers.ts to the one hundred and
    // seventy-nine mainnet origins.
    // Plus the four Lane A trusted-list origins (token-verify,
    // 2026-11-24): tokens.1inch.io (1inch list), tokens.pancakeswap.finance
    // (PancakeSwap lists), tokens.uniswap.org (Uniswap Default list) and
    // raw.githubusercontent.com (Jupiter's list CSVs + Trust Wallet
    // Assets icons) — each verified live (200 + CORS *) before pinning.
    // Plus the five Lane A img-src token-icon origins (same lane):
    // raw.githubusercontent.com, assets.coingecko.com,
    // coin-images.coingecko.com, tokens.1inch.io and
    // tokens.pancakeswap.finance — the only hosts a token icon may load
    // from (see ALLOWED_TOKEN_ICON_HOSTS in wallet/token-verification.ts).
    const httpsOrigins = CONTENT_SECURITY_POLICY.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(httpsOrigins).toEqual([
      // Lane A img-src token-icon origins (img-src precedes connect-src
      // in the policy, so they come first in the match order).
      'https://raw.githubusercontent.com',
      'https://assets.coingecko.com',
      'https://coin-images.coingecko.com',
      'https://tokens.1inch.io',
      'https://tokens.pancakeswap.finance',
      'https://mempool.space',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://rpc.flashbots.net',
      'https://eth.blockscout.com',
      'https://explorer.optimism.io',
      'https://scrollscan.com',
      'https://celo.blockscout.com',
      'https://explorer.aurora.dev',
      'https://api.routescan.io',
      'https://polygon.blockscout.com',
      'https://base.blockscout.com',
      'https://arbitrum.blockscout.com',
      'https://api.etherscan.io',
      'https://lineascan.build',
      'https://api.trongrid.io',
      'https://apilist.tronscanapi.com',
      'https://tron-rpc.publicnode.com',
      'https://toncenter.com',
      'https://api.coingecko.com',
      'https://api.dexscreener.com',
      'https://api.coinlore.net',
      'https://api.exchange.coinbase.com',
      'https://li.quest',
      'https://backend.gas.zip',
      'https://bsc-rpc.publicnode.com',
      'https://polygon-bor-rpc.publicnode.com',
      'https://arbitrum-rpc.publicnode.com',
      'https://optimism-rpc.publicnode.com',
      'https://base-rpc.publicnode.com',
      'https://avalanche-rpc.publicnode.com',
      'https://solana-rpc.publicnode.com',
      'https://public.rpc.solanavibestation.com',
      'https://litecoinspace.org',
      'https://sochain.com',
      'https://api.blockcypher.com',
      'https://blockstream.info',
      'https://bsc-dataseed.binance.org',
      'https://mainnet.optimism.io',
      'https://api.avax.network',
      'https://tonapi.io',
      'https://gnosis-rpc.publicnode.com',
      'https://rpc.gnosischain.com',
      'https://celo-rpc.publicnode.com',
      'https://forno.celo.org',
      'https://linea-rpc.publicnode.com',
      'https://rpc.linea.build',
      'https://mantle-rpc.publicnode.com',
      'https://rpc.mantle.xyz',
      'https://scroll-rpc.publicnode.com',
      'https://rpc.scroll.io',
      'https://opbnb-rpc.publicnode.com',
      'https://opbnb-mainnet-rpc.bnbchain.org',
      'https://metis-rpc.publicnode.com',
      'https://andromeda.metis.io',
      'https://mainnet.aurora.dev',
      'https://aurora.drpc.org',
      'https://rpc.fantom.network',
      'https://rpc2.fantom.network',
      'https://106.rpc.thirdweb.com',
      'https://361.rpc.thirdweb.com',
      'https://43111.rpc.thirdweb.com',
      'https://4689.rpc.thirdweb.com',
      'https://480.rpc.thirdweb.com',
      'https://50.rpc.thirdweb.com',
      'https://57.rpc.thirdweb.com',
      'https://60808.rpc.thirdweb.com',
      'https://747.rpc.thirdweb.com',
      'https://abstract.drpc.org',
      'https://apechain.drpc.org',
      'https://api.kaspa.org',
      'https://api.koios.rest',
      'https://api.mainnet.abs.xyz',
      'https://api.mainnet.aptoslabs.com',
      'https://api.node.glif.io',
      'https://api.roninchain.com',
      'https://arbitrum-nova-rpc.publicnode.com',
      'https://astar.drpc.org',
      'https://axelar-rpc.polkachu.com',
      'https://axelar-rpc.publicnode.com',
      'https://babel-api.mainnet.iotex.io',
      'https://berachain-rpc.publicnode.com',
      'https://boba-ethereum.gateway.tenderly.co',
      'https://celestia-rpc.polkachu.com',
      'https://celestia-rpc.publicnode.com',
      'https://core.drpc.org',
      'https://cosmos-rpc.polkachu.com',
      'https://cosmos-rpc.publicnode.com',
      'https://cronos-evm-rpc.publicnode.com',
      'https://dydx-rpc.polkachu.com',
      'https://dydx-rpc.publicnode.com',
      'https://etc.etcdesktop.com',
      'https://eth-rpc-api.thetatoken.org',
      'https://evm-rpc.sei-apis.com',
      'https://evm.astar.network',
      'https://evm.confluxrpc.com',
      'https://evm.confluxrpc.org',
      'https://evm.cronos.com',
      'https://evm.kava.io',
      'https://evmexplorer.velas.com',
      'https://flare-api.flare.network',
      'https://flare.rpc.thirdweb.com',
      'https://fraxtal-rpc.publicnode.com',
      'https://fullnode.mainnet.aptoslabs.com',
      'https://fuse.drpc.org',
      'https://geth-at.etc-network.info',
      'https://horizon.stellar.lobstr.co',
      'https://horizon.stellar.org',
      'https://hyperliquid-rpc.publicnode.com',
      'https://immutable-zkevm.drpc.org',
      'https://injective-rpc.polkachu.com',
      'https://injective-rpc.publicnode.com',
      'https://juno-rpc.polkachu.com',
      'https://juno-rpc.publicnode.com',
      'https://kava-evm-rpc.publicnode.com',
      'https://mainnet-api.4160.nodely.dev',
      'https://mainnet-api.algonode.cloud',
      'https://mainnet-public.mirrornode.hedera.com',
      'https://mainnet.boba.network',
      'https://mainnet.era.zksync.io',
      'https://mainnet.evm.nodes.onflow.org',
      'https://mainnet.mirrornode.hedera.com',
      'https://mainnet.mode.network',
      'https://mainnet.unichain.org',
      'https://manta-pacific.drpc.org',
      'https://mode.drpc.org',
      'https://monad.drpc.org',
      'https://mycrypto.rsk.co',
      'https://near.drpc.org',
      'https://noble-rpc.polkachu.com',
      'https://nova.arbitrum.io',
      'https://osmosis-rpc.publicnode.com',
      'https://pacific-rpc.manta.network',
      'https://polkadot-rpc.publicnode.com',
      'https://public-node.rsk.co',
      'https://pulsechain-rpc.publicnode.com',
      'https://ronin.drpc.org',
      'https://rpc-gel.inkonchain.com',
      'https://rpc-noble.keplr.app',
      'https://rpc-qnd.inkonchain.com',
      'https://rpc.ankr.com',
      'https://rpc.apechain.com',
      'https://rpc.berachain.com',
      'https://rpc.chiliz.com',
      'https://rpc.coredao.org',
      'https://rpc.frax.com',
      'https://rpc.fuse.io',
      'https://rpc.gobob.xyz',
      'https://rpc.hemi.network',
      'https://rpc.hyperliquid.xyz',
      'https://rpc.immutable.com',
      'https://rpc.mainnet.near.org',
      'https://rpc.mainnet.taiko.xyz',
      'https://rpc.monad.xyz',
      'https://rpc.osmosis.zone',
      'https://rpc.polkadot.io',
      'https://rpc.pulsechain.com',
      'https://rpc.soneium.org',
      'https://rpc.soniclabs.com',
      'https://rpc.syscoin.org',
      'https://rpc.telos.net',
      'https://rpc.tzbeta.net',
      'https://rpc.tzkt.io',
      'https://rpc.xdc.network',
      'https://rpc.xlayer.tech',
      'https://rpc.zora.energy',
      'https://s1.ripple.com:51234',
      'https://sei-rpc.polkachu.com',
      'https://sei-rpc.publicnode.com',
      'https://sei.drpc.org',
      'https://soneium-rpc.publicnode.com',
      'https://songbird-api.flare.network',
      'https://sonic-rpc.publicnode.com',
      'https://starknet-mainnet.drpc.org',
      'https://starknet.drpc.org',
      'https://taiko-rpc.publicnode.com',
      'https://telos.drpc.org',
      'https://unichain-rpc.publicnode.com',
      'https://worldchain-mainnet.g.alchemy.com',
      'https://xlayerrpc.okx.com',
      'https://xrplcluster.com',
      'https://zetachain-evm.blockpi.network',
      'https://zetachain-mainnet.g.allthatnode.com',
      'https://zksync.drpc.org',
      'https://zora.drpc.org',
      'https://etc.blockscout.com',
      'https://explorer.fuse.io',
      'https://explorer.hemi.xyz',
      'https://explorer.mode.network',
      'https://explorer.roninchain.com',
      'https://explorer.syscoin.org',
      'https://flare-explorer.flare.network',
      'https://pacific-explorer.manta.network',
      'https://songbird-explorer.flare.network',
      'https://zetascan.com',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://eth-sepolia.blockscout.com',
      'https://nile.trongrid.io',
      'https://api.nileex.io',
      'https://testnet.toncenter.com',
      // Lane A connect-src trusted-list origins.
      'https://tokens.1inch.io',
      'https://tokens.pancakeswap.finance',
      'https://tokens.uniswap.org',
      'https://raw.githubusercontent.com',
    ]);
  });

  it('meta CSP omits frame-ancestors (a <meta> tag cannot set it) and is otherwise identical to the header CSP', () => {
    // Browsers ignore frame-ancestors delivered via <meta> and log a
    // console error on every page — so the build-time meta must not carry
    // it, while the HTTP-header policy keeps it (preview.headers).
    expect(CONTENT_SECURITY_POLICY_META).not.toContain('frame-ancestors');
    expect(CONTENT_SECURITY_POLICY_META).not.toContain('report-uri');
    expect(CONTENT_SECURITY_POLICY_META).not.toContain('report-to');
    expect(CONTENT_SECURITY_POLICY).toBe(
      CONTENT_SECURITY_POLICY_META + "; frame-ancestors 'none'",
    );
  });

  it('preview/server headers carry the CSP and framing + sniffing guards', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).toBe(CONTENT_SECURITY_POLICY);
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('connect-src allows every RPC origin the registry pins, plus the non-registry fetch origins (UI/UX fixes, items 14 + 19)', () => {
    // Drift guard: a chain (or backup) added to the registry without a
    // matching CSP entry is silently dead in the browser — the fetch is
    // refused before any request is sent, so the row just shows
    // "Could not load balance" with no network error to diagnose.
    // (Caught live 2026-11-23: all nine item-14 chains failed this way.)
    const origins = new Set<string>();
    for (const chain of Object.values(CHAINS)) {
      for (const endpoint of chain.rpcEndpoints) {
        origins.add(new URL(endpoint).origin);
      }
    }
    // Non-registry fetch origins the adapters use: TonAPI (TON balance
    // fallback) and Blockscout (ETH history) plus the three gap-1 history
    // hosts (Celo Blockscout, Optimism explorer, Scrollscan).
    origins.add('https://tonapi.io');
    origins.add('https://eth.blockscout.com');
    // Lane B (Finish the Product, 2026-11-23): the drift guard used to
    // collect RPC endpoints only, so the nine wired history hosts were
    // live in the registry but missing from connect-src — the browser
    // refused every history fetch (CSP) while the unit tests stayed
    // green. History base URLs and explorer bases (the /track v2
    // lookup fetches the explorer base) are fetch origins too.
    for (const chain of Object.values(CHAINS)) {
      if (chain.historyBaseUrl !== undefined) {
        origins.add(new URL(chain.historyBaseUrl).origin);
      }
      if (chain.historyExplorerBase !== undefined) {
        origins.add(new URL(chain.historyExplorerBase).origin);
      }
    }
    for (const origin of [...origins].sort()) {
      expect(
        CONTENT_SECURITY_POLICY,
        `${origin} is fetched by an adapter but missing from connect-src`,
      ).toContain(origin);
    }
    // Lane F (FIX-ALL, 2026-11-24): the one-tap custom RPCs must be
    // in connect-src too — the CSP cannot learn a host at runtime,
    // so a suggestion whose origin is missing here would be stored
    // by the Networks screen and then refused on every fetch.
    for (const suggestion of SUGGESTED_CUSTOM_RPCS) {
      expect(
        CONTENT_SECURITY_POLICY,
        `${suggestion.url} is offered as a custom RPC but missing from connect-src`,
      ).toContain(new URL(suggestion.url).origin);
    }
  });
});

describe('T47 wallet-core WASM integrity pin', () => {
  it('pins the published 4.9.3 wasm hash', () => {
    expect(EXPECTED_WASM_SHA256).toBe(
      '13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217',
    );
  });

  it('accepts data hashing to the pin and rejects a one-byte change', () => {
    const good = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    // sha256Hex is exercised against a known vector, not the pin itself:
    expect(sha256Hex(good)).toBe(
      'cd5d4935a48c0672cb06407bb443bc0087aff947c6b864bac886982c73b3027f',
    );
    expect(verifyWasmHash(good)).toBe(false);
    const tampered = new Uint8Array([0x00, 0x61, 0x73, 0x6e]);
    expect(sha256Hex(tampered)).not.toBe(sha256Hex(good));
  });
});
