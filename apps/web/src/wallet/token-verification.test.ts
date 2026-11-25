// Token verification by contract address (token-verify Lane A).
// Every leg is exercised against a mocked fetch: the real list
// payloads were read live 2026-11-24 and are reproduced here in
// miniature (one BONK row, one banned mint, one 1inch entry, one
// Uniswap entry, one PancakeSwap entry, one Bitget USDC record and
// one Bitget stub for a fake contract, read live 2026-11-25).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BITGET_CHAIN_FOR_CHAIN,
  ONE_INCH_CHAIN_IDS,
  TRUST_WALLET_ASSETS_PIN,
  evmChainIdFor,
  isBannedToken,
  resetTokenVerificationCaches,
  resolveTokenIcon,
  resolveTokenListVerification,
  trustWalletIconUrl,
} from './token-verification';
import { TRUST_WALLET_ASSETS_PIN as EXPANDED_PIN } from './chains-expanded';
import { COINGECKO_PLATFORM_FOR_CHAIN } from './tokens';

const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const FAKE_BONK_MINT = 'BonkUg9t46HnxF4erZzmnB4Ae6oEcDS4V66zqUoUhwWY';
const BANNED_MINT = '3mXx1bNiB5bhgwznk4eeqM9eoy6DU3CeCkm1LPabeoEh';
const AAMPL = '0x1e6bb68acec8fefbd87d192be09bb274170a0548';
const PEPE = '0x6982508145454ce325ddbe47a25d4ec3d2311933';
const UNKNOWN_EVM = '0x00000000000000000000000000000000000000f0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const FAKE_ETH = '0x1111111111111111111111111111111111111111';

// One BONK row, exactly as the live validated-tokens.csv carries it
// (name, symbol, mint, decimals, logoURI, community-validated).
const JUPITER_VALIDATED_CSV = [
  'Name,Symbol,Mint,Decimals,LogoURI,Community Validated',
  `Bonk,Bonk,${BONK_MINT},5,https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I?ext=png,true`,
  'MonkeyBucks,MBS,Fm9rHUTF5v3hwMLbStjZXqNBBoZyGriQaFM6sTFz3K8A,6,https://example.invalid/logo.png,false',
].join('\n');

const JUPITER_BANNED_CSV = [
  'Mint,Reasons',
  `${BANNED_MINT},SAMOY scam coin`,
].join('\n');

const ONE_INCH_CHAIN_1 = {
  [AAMPL.toLowerCase()]: {
    address: AAMPL.toLowerCase(),
    chainId: 1,
    symbol: 'aAMPL',
    name: 'Aave interest bearing AMPL',
    decimals: 9,
    logoURI:
      'https://raw.githubusercontent.com/aave-dao/web3-icons/main/icons/full/aampl.svg',
  },
};

const UNISWAP_LIST = {
  name: 'Uniswap Labs Default',
  version: { major: 22, minor: 34, patch: 0 },
  tokens: [
    {
      chainId: 1,
      address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      name: 'Pepe',
      symbol: 'PEPE',
      decimals: 18,
      logoURI:
        'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg?1682922725',
    },
  ],
};

const PANCAKESWAP_LIST = {
  name: 'PancakeSwap Extended',
  tokens: [
    {
      chainId: 56,
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81c8e82',
      name: 'PancakeSwap Token',
      symbol: 'CAKE',
      decimals: 18,
      logoURI: 'https://tokens.pancakeswap.finance/images/0x0e09fabb73bd3ade0a17ecc321fd13a19e81c8e82.png',
    },
  ],
};

// Bitget Agent API payloads, miniature but shape-true to the live
// responses read 2026-11-25 (copenapi.bgwapi.io): a real token
// carries symbol + name; a fake contract returns a zeroed stub
// with neither; a fake's audit still answers highRisk false.
const BITGET_TOKEN_INFO_USDC = {
  status: 0,
  data: {
    list: [
      {
        chain: 'eth',
        contract: USDC,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        holders: 9270738,
        price: 1.0011124716533941,
      },
    ],
  },
};

const BITGET_TOKEN_INFO_STUB = {
  status: 0,
  data: {
    list: [
      {
        chain: 'eth',
        contract: FAKE_ETH,
        holders: 0,
        liquidity: 0,
        price: 0,
      },
    ],
  },
};

const BITGET_SECURITY_CLEAN = {
  status: 0,
  data: [
    {
      chain: 'eth',
      chain_id: 1,
      contract: USDC,
      riskCount: 0,
      warnCount: 0,
      highRisk: false,
    },
  ],
};

const BITGET_SECURITY_CLEAN_FAKE = {
  status: 0,
  data: [
    {
      chain: 'eth',
      chain_id: 1,
      contract: FAKE_ETH,
      riskCount: 0,
      warnCount: 0,
      highRisk: false,
    },
  ],
};

const BITGET_SECURITY_RISKY = {
  status: 0,
  data: [
    {
      chain: 'eth',
      chain_id: 1,
      contract: USDC,
      riskCount: 2,
      warnCount: 0,
      highRisk: true,
    },
  ],
};

/** A fetch stub routed by URL substring. Unmatched URLs 404. */
function stubFetch(
  routes: Array<{ match: string; status: number; body: unknown }>,
): typeof fetch {
  return (async (url: unknown) => {
    const href = String(url);
    for (const route of routes) {
      if (!href.includes(route.match)) continue;
      if (typeof route.body === 'string') {
        return { ok: route.status >= 200 && route.status < 300, status: route.status, text: async () => route.body };
      }
      return { ok: route.status >= 200 && route.status < 300, status: route.status, json: async () => route.body };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  resetTokenVerificationCaches();
  vi.clearAllMocks();
});

describe('COINGECKO_PLATFORM_FOR_CHAIN', () => {
  it('covers every EVM chain except Bob, which CoinGecko has no platform for', () => {
    const evmChains = (
      [
        'eth', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'gnosis', 'celo',
        'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom',
        'zksync', 'cronos', 'kava', 'filecoin', 'zora', 'mode', 'fraxtal',
        'berachain', 'sei', 'arbnova', 'worldchain', 'manta', 'unichain',
        'ink', 'abstract', 'soneium', 'apechain', 'sonic', 'hyperevm',
        'monad', 'ronin', 'immutable', 'fuse', 'velas', 'syscoin', 'theta',
        'iotex', 'xlayer', 'boba', 'taiko', 'astar', 'telos', 'conflux',
        'core', 'songbird', 'rootstock', 'pulsechain', 'xdc', 'chiliz',
        'etc', 'flare', 'zetachain', 'hemi', 'flowevm',
      ] as const
    ).filter((chain) => evmChainIdFor(chain) !== null);
    // Sixty EVM chains carry a platform (the 61st EVM chain is Bob).
    expect(evmChains).toHaveLength(60);
    for (const chain of evmChains) {
      expect(
        COINGECKO_PLATFORM_FOR_CHAIN[chain],
        `${chain} has no CoinGecko platform`,
      ).toBeDefined();
    }
    // Bob (60808) is the one EVM chain with no CoinGecko platform.
    expect(COINGECKO_PLATFORM_FOR_CHAIN['bob']).toBeUndefined();
    expect(evmChainIdFor('bob')).toBe(60808);
  });

  it('maps the three non-EVM token chains and fixes the Metis slug', () => {
    expect(COINGECKO_PLATFORM_FOR_CHAIN['sol']).toBe('solana');
    expect(COINGECKO_PLATFORM_FOR_CHAIN['trx']).toBe('tron');
    expect(COINGECKO_PLATFORM_FOR_CHAIN['ton']).toBe('the-open-network');
    // 'metis' is not a CoinGecko platform (verified live: the
    // contract endpoint 404s on it); chain 1088 is 'metis-andromeda'.
    expect(COINGECKO_PLATFORM_FOR_CHAIN['metis']).toBe('metis-andromeda');
  });
});

describe('evmChainIdFor', () => {
  it('reads the EVM chain id from the registry networkId', () => {
    expect(evmChainIdFor('eth')).toBe(1);
    expect(evmChainIdFor('bsc')).toBe(56);
    expect(evmChainIdFor('zksync')).toBe(324);
    expect(evmChainIdFor('bob')).toBe(60808);
  });

  it('returns null for non-EVM chains', () => {
    expect(evmChainIdFor('sol')).toBeNull();
    expect(evmChainIdFor('trx')).toBeNull();
    expect(evmChainIdFor('ton')).toBeNull();
    expect(evmChainIdFor('btc')).toBeNull();
  });
});

describe('isBannedToken', () => {
  it('refuses a mint on Jupiter\'s banned list', async () => {
    const fetchFn = stubFetch([
      { match: 'banned-tokens.csv', status: 200, body: JUPITER_BANNED_CSV },
    ]);
    await expect(
      isBannedToken({ chain: 'sol', contract: BANNED_MINT, fetchFn }),
    ).resolves.toBe(true);
  });

  it('does not ban the real BONK mint', async () => {
    const fetchFn = stubFetch([
      { match: 'banned-tokens.csv', status: 200, body: JUPITER_BANNED_CSV },
    ]);
    await expect(
      isBannedToken({ chain: 'sol', contract: BONK_MINT, fetchFn }),
    ).resolves.toBe(false);
  });

  it('never bans a non-Solana contract and never throws when the list fails', async () => {
    const failing = (async () => {
      throw new Error('fetch failed');
    }) as unknown as typeof fetch;
    await expect(
      isBannedToken({ chain: 'eth', contract: PEPE, fetchFn: failing }),
    ).resolves.toBe(false);
    await expect(
      isBannedToken({ chain: 'sol', contract: BONK_MINT, fetchFn: failing }),
    ).resolves.toBe(false);
  });
});

describe('resolveTokenListVerification', () => {
  it('verifies BONK via Jupiter Strict and keeps its list logoURI', async () => {
    const fetchFn = stubFetch([
      { match: 'validated-tokens.csv', status: 200, body: JUPITER_VALIDATED_CSV },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'sol',
      contract: BONK_MINT,
      fetchFn,
    });
    expect(result).toEqual({
      verified: true,
      source: 'jupiter-strict',
      logoUri:
        'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I?ext=png',
    });
  });

  it('does NOT verify a copycat mint with the same name and symbol', async () => {
    // The fake BONK is a real on-chain mint with a Raydium pool —
    // but it is in no trusted list, so it stays unverified.
    const fetchFn = stubFetch([
      { match: 'validated-tokens.csv', status: 200, body: JUPITER_VALIDATED_CSV },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'sol',
      contract: FAKE_BONK_MINT,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
  });

  it('verifies aAMPL via 1inch when CoinGecko has no listing for it', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: ONE_INCH_CHAIN_1 },
      { match: 'tokens.uniswap.org', status: 200, body: UNISWAP_LIST },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: AAMPL,
      fetchFn,
    });
    expect(result.verified).toBe(true);
    expect(result.source).toBe('one-inch');
    expect(result.logoUri).toContain('raw.githubusercontent.com/aave-dao/web3-icons');
  });

  it('verifies PEPE via the Uniswap Default list when 1inch does not carry it', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: UNISWAP_LIST },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: PEPE,
      fetchFn,
    });
    expect(result).toEqual({
      verified: true,
      source: 'uniswap-default',
      logoUri:
        'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg?1682922725',
    });
  });

  it('verifies CAKE via PancakeSwap Extended on BSC', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/56', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: { tokens: [] } },
      {
        match: 'pancakeswap-extended.json',
        status: 200,
        body: PANCAKESWAP_LIST,
      },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'bsc',
      contract: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81c8e82',
      fetchFn,
    });
    expect(result.verified).toBe(true);
    expect(result.source).toBe('pancakeswap');
  });

  it('verifies USDC via Bitget when 1inch/Uniswap do not carry it', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: { tokens: [] } },
      { match: 'batchGetBaseInfo', status: 200, body: BITGET_TOKEN_INFO_USDC },
      { match: 'security/audits', status: 200, body: BITGET_SECURITY_CLEAN },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: USDC,
      fetchFn,
    });
    // Bitget never supplies a logoURI (its icon host is not an
    // allowed image origin) — the row falls back to other icons.
    expect(result).toEqual({ verified: true, source: 'bitget', logoUri: null });
  });

  it('does NOT verify a fake contract whose Bitget record is a stub', async () => {
    // The fake's token-info is a zeroed stub (no symbol/name) and
    // its audit is clean — the stub alone must still refuse it.
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: { tokens: [] } },
      { match: 'batchGetBaseInfo', status: 200, body: BITGET_TOKEN_INFO_STUB },
      { match: 'security/audits', status: 200, body: BITGET_SECURITY_CLEAN_FAKE },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: FAKE_ETH,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
  });

  it('does NOT verify when the Bitget security audit flags high risk', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: { tokens: [] } },
      { match: 'batchGetBaseInfo', status: 200, body: BITGET_TOKEN_INFO_USDC },
      { match: 'security/audits', status: 200, body: BITGET_SECURITY_RISKY },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: USDC,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
  });

  it('does NOT verify when the Bitget security call fails', async () => {
    // Token-info says USDC is real, but the audit is unreachable —
    // fail closed, never verified on the token-info half alone.
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: {} },
      { match: 'tokens.uniswap.org', status: 200, body: { tokens: [] } },
      { match: 'batchGetBaseInfo', status: 200, body: BITGET_TOKEN_INFO_USDC },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: USDC,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
  });

  it('never fetches Bitget for Solana', async () => {
    const urls: string[] = [];
    const fetchFn = (async (url: unknown) => {
      const href = String(url);
      urls.push(href);
      if (href.includes('validated-tokens.csv')) {
        return {
          ok: true,
          status: 200,
          text: async (): Promise<string> => JUPITER_VALIDATED_CSV,
        };
      }
      return {
        ok: false,
        status: 404,
        json: async (): Promise<Record<string, unknown>> => ({}),
        text: async (): Promise<string> => '',
      };
    }) as unknown as typeof fetch;
    const result = await resolveTokenListVerification({
      chain: 'sol',
      contract: FAKE_BONK_MINT,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
    expect(urls.some((url) => url.includes('copenapi.bgwapi.io'))).toBe(false);
  });

  it('signs the Bitget request the way the Agent API script does', async () => {
    const seen: Array<{ url: string; init: unknown }> = [];
    const fetchFn = (async (url: unknown, init?: unknown) => {
      const href = String(url);
      seen.push({ url: href, init });
      if (href.includes('batchGetBaseInfo')) {
        return { ok: true, status: 200, json: async () => BITGET_TOKEN_INFO_USDC };
      }
      if (href.includes('security/audits')) {
        return { ok: true, status: 200, json: async () => BITGET_SECURITY_CLEAN };
      }
      return { ok: true, status: 200, json: async () => ({ tokens: [] }) };
    }) as unknown as typeof fetch;
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: USDC,
      fetchFn,
    });
    expect(result.source).toBe('bitget');
    const infoCall = seen.find((call) => call.url.includes('batchGetBaseInfo'));
    expect(infoCall).toBeDefined();
    const headers = (
      infoCall?.init as { headers?: Record<string, string> } | undefined
    )?.headers;
    expect(headers?.['token']).toBe('toc_agent');
    expect(headers?.['channel']).toBe('toc_agent');
    expect(headers?.['X-SIGN']).toMatch(/^0x[0-9a-f]{64}$/);
    expect(headers?.['X-TIMESTAMP']).toMatch(/^\d+$/);
  });

  it('fetches the Bitget check at most once per token per session', async () => {
    const fetchFn = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes('batchGetBaseInfo')) {
        return { ok: true, status: 200, json: async () => BITGET_TOKEN_INFO_USDC };
      }
      if (href.includes('security/audits')) {
        return { ok: true, status: 200, json: async () => BITGET_SECURITY_CLEAN };
      }
      return { ok: true, status: 200, json: async () => ({ tokens: [] }) };
    }) as unknown as typeof fetch;
    await resolveTokenListVerification({ chain: 'eth', contract: USDC, fetchFn });
    await resolveTokenListVerification({ chain: 'eth', contract: USDC, fetchFn });
    const infoCalls = vi
      .mocked(fetchFn)
      .mock.calls.filter((call) => String(call[0]).includes('batchGetBaseInfo'));
    expect(infoCalls).toHaveLength(1);
  });

  it('never verifies an unknown contract on any leg', async () => {
    const fetchFn = stubFetch([
      { match: 'tokens.1inch.io/v1.2/1', status: 200, body: ONE_INCH_CHAIN_1 },
      { match: 'tokens.uniswap.org', status: 200, body: UNISWAP_LIST },
    ]);
    const result = await resolveTokenListVerification({
      chain: 'eth',
      contract: UNKNOWN_EVM,
      fetchFn,
    });
    expect(result).toEqual({ verified: false, source: null, logoUri: null });
  });

  it('does not fetch 1inch for a chain 1inch does not serve', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tokens: [] }),
    })) as unknown as typeof fetch;
    // Fantom (250) answered 400 on tokens.1inch.io — the resolver
    // must not even try it, and must still check Uniswap.
    await resolveTokenListVerification({ chain: 'fantom', contract: PEPE, fetchFn });
    const urls = vi.mocked(fetchFn).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('tokens.1inch.io'))).toBe(false);
    expect(urls.some((url) => url.includes('tokens.uniswap.org'))).toBe(true);
  });

  it('fails closed when every list fetch fails', async () => {
    const failing = (async () => {
      throw new Error('fetch failed');
    }) as unknown as typeof fetch;
    await expect(
      resolveTokenListVerification({ chain: 'eth', contract: PEPE, fetchFn: failing }),
    ).resolves.toEqual({ verified: false, source: null, logoUri: null });
    await expect(
      resolveTokenListVerification({ chain: 'sol', contract: BONK_MINT, fetchFn: failing }),
    ).resolves.toEqual({ verified: false, source: null, logoUri: null });
  });

  it('fetches each list at most once per session', async () => {
    const fetchFn = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes('tokens.uniswap.org')) {
        return { ok: true, status: 200, json: async () => UNISWAP_LIST };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
    await resolveTokenListVerification({ chain: 'eth', contract: PEPE, fetchFn });
    await resolveTokenListVerification({ chain: 'eth', contract: UNKNOWN_EVM, fetchFn });
    const uniswapCalls = vi
      .mocked(fetchFn)
      .mock.calls.filter((call) => String(call[0]).includes('tokens.uniswap.org'));
    expect(uniswapCalls).toHaveLength(1);
  });
});

describe('resolveTokenIcon', () => {
  it('prefers the Trust Wallet Assets logo when it exists', async () => {
    const fetchFn = stubFetch([]);
    const head = vi.fn(async () => ({ ok: true, status: 200 }));
    const fetchWithHead = (async (url: string, init?: unknown) => {
      if ((init as { method?: string } | undefined)?.method === 'HEAD') return head();
      return fetchFn(url);
    }) as unknown as typeof fetch;
    const result = await resolveTokenIcon({
      chain: 'sol',
      contract: BONK_MINT,
      coingeckoImage: 'https://coin-images.coingecko.com/coins/images/28600/small/bonk.jpg',
      fetchFn: fetchWithHead,
    });
    expect(result).toEqual({
      iconUrl: trustWalletIconUrl('sol', BONK_MINT),
      iconSource: 'trustwallet',
    });
    expect(head).toHaveBeenCalledTimes(1);
  });

  it('falls back to the CoinGecko image when Trust Wallet has none', async () => {
    const fetchFn = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    const result = await resolveTokenIcon({
      chain: 'zksync',
      contract: '0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e',
      coingeckoImage: 'https://coin-images.coingecko.com/coins/images/38043/small/ZKTokenBlack.png',
      fetchFn,
    });
    expect(result).toEqual({
      iconUrl: 'https://coin-images.coingecko.com/coins/images/38043/small/ZKTokenBlack.png',
      iconSource: 'coingecko',
    });
  });

  it('falls back to a list logoURI only on an allowed host', async () => {
    const fetchFn = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    const oneInch = await resolveTokenIcon({
      chain: 'eth',
      contract: AAMPL,
      listLogoUri:
        'https://raw.githubusercontent.com/aave-dao/web3-icons/main/icons/full/aampl.svg',
      fetchFn,
    });
    expect(oneInch).toEqual({
      iconUrl:
        'https://raw.githubusercontent.com/aave-dao/web3-icons/main/icons/full/aampl.svg',
      iconSource: 'token-list',
    });
    // Jupiter's BONK logo is on arweave.net — not an allowed image
    // origin, so it is skipped rather than loaded from an unvetted host.
    const jupiter = await resolveTokenIcon({
      chain: 'sol',
      contract: BONK_MINT,
      listLogoUri:
        'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I?ext=png',
      fetchFn,
    });
    expect(jupiter).toEqual({ iconUrl: null, iconSource: null });
  });

  it('returns no icon when no source has one', async () => {
    const fetchFn = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    const result = await resolveTokenIcon({
      chain: 'sol',
      contract: FAKE_BONK_MINT,
      fetchFn,
    });
    expect(result).toEqual({ iconUrl: null, iconSource: null });
  });

  it('returns no Trust Wallet icon for a chain with no Assets directory', () => {
    expect(trustWalletIconUrl('zora', '0x0000000000000000000000000000000000000001')).toBeNull();
    expect(trustWalletIconUrl('mode', '0x0000000000000000000000000000000000000001')).toBeNull();
    expect(trustWalletIconUrl('bob', '0x0000000000000000000000000000000000000001')).toBeNull();
    expect(trustWalletIconUrl('eth', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toContain(
      '/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    );
  });
});

describe('BITGET_CHAIN_FOR_CHAIN', () => {
  it('maps the chains Bitget indexes live and no others', () => {
    expect(BITGET_CHAIN_FOR_CHAIN['eth']).toBe('eth');
    expect(BITGET_CHAIN_FOR_CHAIN['bsc']).toBe('bnb');
    expect(BITGET_CHAIN_FOR_CHAIN['matic']).toBe('matic');
    expect(BITGET_CHAIN_FOR_CHAIN['arb']).toBe('arbitrum');
    expect(BITGET_CHAIN_FOR_CHAIN['base']).toBe('base');
    expect(BITGET_CHAIN_FOR_CHAIN['avax']).toBe('avax');
    // Solana is unusable (sol errors, solana stubs) and op stubs
    // for real tokens; neither is ever fetched.
    expect(BITGET_CHAIN_FOR_CHAIN['sol']).toBeUndefined();
    expect(BITGET_CHAIN_FOR_CHAIN['op']).toBeUndefined();
    expect(BITGET_CHAIN_FOR_CHAIN['ton']).toBeUndefined();
    expect(BITGET_CHAIN_FOR_CHAIN['btc']).toBeUndefined();
  });
});

describe('ONE_INCH_CHAIN_IDS', () => {
  it('covers the chains 1inch serves and not the ones that 400', () => {
    for (const id of [1, 10, 56, 100, 137, 324, 42161, 43114, 8453, 59144]) {
      expect(ONE_INCH_CHAIN_IDS.has(id)).toBe(true);
    }
    for (const id of [250, 5000, 534352, 204, 1088, 1313161554, 42220]) {
      expect(ONE_INCH_CHAIN_IDS.has(id)).toBe(false);
    }
  });
});

describe('TRUST_WALLET_ASSETS_PIN', () => {
  it('stays equal to the pin in chains-expanded.ts', () => {
    // The pin is spelled out in token-verification.ts so the module
    // does not pull the 62-chain data table into the eager bundle;
    // the two must never drift apart.
    expect(TRUST_WALLET_ASSETS_PIN).toBe(EXPANDED_PIN);
  });
});
