import { describe, expect, it } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from './security-headers';
import { CHAINS, SUGGESTED_CUSTOM_RPCS } from '../wallet/chains';
import {
  EXPECTED_WASM_SHA256,
  sha256Hex,
  verifyWasmHash,
} from '../../scripts/wasm-integrity.mjs';

const EXPECTED_CONNECT_SRC =
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.drpc.org https://rpc.flashbots.net https://eth.blockscout.com https://explorer.optimism.io https://scrollscan.com https://celo.blockscout.com https://explorer.aurora.dev https://api.routescan.io https://polygon.blockscout.com https://base.blockscout.com https://arbitrum.blockscout.com https://api.etherscan.io https://lineascan.build https://api.trongrid.io https://apilist.tronscanapi.com https://tron-rpc.publicnode.com https://toncenter.com https://api.coingecko.com https://api.dexscreener.com https://api.coinlore.net https://api.exchange.coinbase.com https://bsc-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://arbitrum-rpc.publicnode.com https://optimism-rpc.publicnode.com https://base-rpc.publicnode.com https://avalanche-rpc.publicnode.com https://solana-rpc.publicnode.com https://public.rpc.solanavibestation.com https://litecoinspace.org https://sochain.com https://api.blockcypher.com https://blockstream.info https://bsc-dataseed.binance.org https://mainnet.optimism.io https://api.avax.network https://tonapi.io https://gnosis-rpc.publicnode.com https://rpc.gnosischain.com https://celo-rpc.publicnode.com https://forno.celo.org https://linea-rpc.publicnode.com https://rpc.linea.build https://mantle-rpc.publicnode.com https://rpc.mantle.xyz https://scroll-rpc.publicnode.com https://rpc.scroll.io https://opbnb-rpc.publicnode.com https://opbnb-mainnet-rpc.bnbchain.org https://metis-rpc.publicnode.com https://andromeda.metis.io https://mainnet.aurora.dev https://aurora.drpc.org https://rpc.fantom.network https://rpc2.fantom.network https://ethereum-sepolia-rpc.publicnode.com https://eth-sepolia.blockscout.com https://nile.trongrid.io https://api.nileex.io https://testnet.toncenter.com";
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

  it('CSP blocks plugins, base hijack and framing; connect-src allows only the fifty-seven pinned provider origins plus the five TEMPORARY devnet origins', () => {    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain(EXPECTED_CONNECT_SRC);
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
    // Exact match on the directive: no other origin may creep in.
    const connectSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src '));
    expect(connectSrc).toBe(EXPECTED_CONNECT_SRC);
    // Exactly sixty-two https: origins in the whole policy, all of them in    // connect-src: mempool.space (BTC), ethereum-rpc.publicnode.com (ETH RPC)
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
    // Plus the two Lane F custom-RPC origins (FIX-ALL, 2026-11-24):
    // Flashbots https://rpc.flashbots.net and dRPC
    // https://eth.drpc.org — the one-tap suggestions on the Networks
    // screen, both verified live (eth_chainId 0x1 + live block tip).    // Plus the five TEMPORARY devnet origins (Lane D,
    // 2026-11-22: without them every devnet fetch is refused by the
    // browser — the devnet endpoints are separate origins from mainnet).
    // Devnet is TEMPORARY: the removal checklist in docs/DECISIONS.md
    // reverts this test and security-headers.ts to the fifty-seven mainnet    // origins.
    const httpsOrigins = CONTENT_SECURITY_POLICY.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(httpsOrigins).toEqual([
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
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://eth-sepolia.blockscout.com',
      'https://nile.trongrid.io',
      'https://api.nileex.io',
      'https://testnet.toncenter.com',
    ]);
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
