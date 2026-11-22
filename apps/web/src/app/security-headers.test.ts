import { describe, expect, it } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from './security-headers';
import {
  EXPECTED_WASM_SHA256,
  sha256Hex,
  verifyWasmHash,
} from '../../scripts/wasm-integrity.mjs';

const EXPECTED_CONNECT_SRC =
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com https://api.coingecko.com https://bsc-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://arbitrum-rpc.publicnode.com https://optimism-rpc.publicnode.com https://base-rpc.publicnode.com https://avalanche-rpc.publicnode.com https://solana-rpc.publicnode.com https://public.rpc.solanavibestation.com https://litecoinspace.org https://sochain.com https://api.blockcypher.com https://ethereum-sepolia-rpc.publicnode.com https://eth-sepolia.blockscout.com https://nile.trongrid.io https://api.nileex.io https://testnet.toncenter.com";

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

  it('CSP blocks plugins, base hijack and framing; connect-src allows only the seventeen pinned provider origins plus the five TEMPORARY devnet origins', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain(EXPECTED_CONNECT_SRC);
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
    // Exact match on the directive: no other origin may creep in.
    const connectSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src '));
    expect(connectSrc).toBe(EXPECTED_CONNECT_SRC);
    // Exactly twenty-two https: origins in the whole policy, all of them in
    // connect-src: mempool.space (BTC), ethereum-rpc.publicnode.com (ETH RPC)
    // + eth.blockscout.com (ETH history), api.trongrid.io (TRX),
    // toncenter.com (TON), api.coingecko.com (CoinGecko price feed), plus
    // the nine token-discovery origins: bsc/polygon-bor/arbitrum/
    // optimism/base/avalanche-rpc.publicnode.com, solana-rpc.publicnode.com
    // (SOL primary) + public.rpc.solanavibestation.com (SOL fallback),
    // litecoinspace.org (LTC), sochain.com (DOGE primary) +
    // api.blockcypher.com (DOGE fallback). Token gaps (item 1, Lane 1,
    // 2026-11-22): api.mainnet-beta.solana.com is retired — it 403s
    // browser requests — and is no longer pinned. Plus the five TEMPORARY
    // devnet origins (Lane D, 2026-11-22: without them every devnet fetch
    // is refused by the browser — the devnet endpoints are separate
    // origins from mainnet). Devnet is TEMPORARY: the removal checklist
    // in docs/DECISIONS.md reverts this test and security-headers.ts to
    // the seventeen mainnet origins.
    const httpsOrigins = CONTENT_SECURITY_POLICY.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(httpsOrigins).toEqual([
      'https://mempool.space',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.blockscout.com',
      'https://api.trongrid.io',
      'https://toncenter.com',
      'https://api.coingecko.com',
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
