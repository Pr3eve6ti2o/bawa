import { describe, expect, it } from 'vitest';
import {
  CUSTOM_TOKENS_KEY,
  DEFAULT_TOKENS,
  ENABLED_CHAINS_KEY,
  addCustomTokenToList,
  isDuplicateToken,
  isVerifiedToken,
  readCustomTokens,
  readEnabledChains,
  resolveTokenByTickerOrName,
  shortContract,
  tokenKey,
  tokenStandardFor,
  validateEvmContractAddress,
  validateTokenMetadata,
  validateTronContractAddress,
  writeCustomTokens,
  writeEnabledChains,
  type TokenRecord,
  type TokenStore,
} from './tokens';
import { SUPPORTED_CHAINS } from './chains';

function memoryStore(initial: Record<string, string> = {}): TokenStore {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const USDC: TokenRecord = {
  chain: 'eth',
  contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  coingeckoId: 'usd-coin',
  addedAtMs: 0,
};

describe('DEFAULT_TOKENS', () => {
  it('lists exactly the 8 default tokens with verified contracts', () => {
    expect(DEFAULT_TOKENS).toHaveLength(8);
    const byKey = new Map(DEFAULT_TOKENS.map((t) => [tokenKey(t.chain, t.contract), t]));
    expect(byKey.get('eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toMatchObject({
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    });
    expect(byKey.get('eth:0xdac17f958d2ee523a2206206994597c13d831ec7')).toMatchObject({
      symbol: 'USDT',
      decimals: 6,
      coingeckoId: 'tether',
    });
    expect(byKey.get('eth:0x6b175474e89094c44da98b954eedeac495271d0f')).toMatchObject({
      symbol: 'DAI',
      decimals: 18,
      coingeckoId: 'dai',
    });
    expect(byKey.get('eth:0x514910771af9ca656af840dff83e8264ecf986ca')).toMatchObject({
      symbol: 'LINK',
      decimals: 18,
      coingeckoId: 'chainlink',
    });
    expect(byKey.get('eth:0x1f9840a85d5af5bf1d1762f925bdaddc4201f984')).toMatchObject({
      symbol: 'UNI',
      decimals: 18,
      coingeckoId: 'uniswap',
    });
    expect(byKey.get('eth:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599')).toMatchObject({
      symbol: 'WBTC',
      decimals: 8,
      coingeckoId: 'wrapped-bitcoin',
    });
    expect(byKey.get('trx:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t')).toMatchObject({
      symbol: 'USDT',
      decimals: 6,
      coingeckoId: 'tether',
    });
    // Token #21 (token gaps): Base USDC, verified live against the
    // CoinGecko Base contract endpoint 2026-11-22 (id usd-coin,
    // decimals 6, contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
    expect(byKey.get('base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')).toMatchObject({
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      coingeckoId: 'usd-coin',
    });
  });

  it('has unique token keys', () => {
    const keys = DEFAULT_TOKENS.map((t) => tokenKey(t.chain, t.contract));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('isVerifiedToken', () => {
  // Verified-tick rule (token gaps, item 2): a token is official when it
  // is one of the curated in-repo defaults — verified twice (in-repo +
  // live CoinGecko) — or when its contract resolved to a real CoinGecko
  // listing at add time (coingeckoId set by the contract endpoint). A
  // user-added token by raw contract with no CoinGecko listing gets no
  // tick. (Uniswap token-list pattern: membership in a curated list is
  // the verification; Trust Wallet assets pattern: a reviewed listing
  // with logo + info.json is the verification.)
  it('marks every default token verified', () => {
    for (const token of DEFAULT_TOKENS) {
      expect(isVerifiedToken(token)).toBe(true);
    }
  });

  it('marks a user-added token verified when CoinGecko listed its contract', () => {
    const added: TokenRecord = {
      chain: 'eth',
      contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      coingeckoId: 'weth',
      addedAtMs: 1,
    };
    expect(isVerifiedToken(added)).toBe(true);
  });

  it('does not mark a user-added token verified when CoinGecko has no listing for it', () => {
    const added: TokenRecord = {
      chain: 'eth',
      contract: '0x0000000000000000000000000000000000000001',
      name: 'Unknown Token',
      symbol: 'UNKN',
      decimals: 18,
      coingeckoId: null,
      addedAtMs: 1,
    };
    expect(isVerifiedToken(added)).toBe(false);
  });
});

describe('shortContract', () => {
  it('shortens an EVM contract to first 6 + ellipsis + last 4', () => {
    expect(shortContract('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(
      '0xA0b8…eB48',
    );
  });

  it('shortens a TRON contract the same way', () => {
    expect(shortContract('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(
      'TR7NHq…Lj6t',
    );
  });

  it('returns a short value unchanged', () => {
    expect(shortContract('0x1234')).toBe('0x1234');
  });
});

describe('resolveTokenByTickerOrName', () => {
  const list: TokenRecord[] = [
    USDC,
    {
      chain: 'trx',
      contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      coingeckoId: 'tether',
      addedAtMs: 0,
    },
    {
      chain: 'base',
      contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
      addedAtMs: 0,
    },
  ];

  it('resolves an exact ticker, case-insensitive, with chain and contract', () => {
    const found = resolveTokenByTickerOrName('usdc', list);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ chain: 'eth', symbol: 'USDC' });
    expect(found[1]).toMatchObject({ chain: 'base', symbol: 'USDC' });
  });

  it('resolves by name', () => {
    const found = resolveTokenByTickerOrName('Tether USD', list);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ chain: 'trx', symbol: 'USDT' });
  });

  it('resolves a partial ticker or name', () => {
    // 'usd' matches USDC (symbol) and 'Tether USD' (name) alike.
    const found = resolveTokenByTickerOrName('usd', list);
    expect(found).toHaveLength(3);
    expect(found.map((t) => `${t.chain}:${t.symbol}`).sort()).toEqual([
      'base:USDC',
      'eth:USDC',
      'trx:USDT',
    ]);
  });

  it('returns an empty list for a blank query', () => {
    expect(resolveTokenByTickerOrName('   ', list)).toEqual([]);
  });

  it('returns an empty list when nothing resolves — never invents a token', () => {
    expect(resolveTokenByTickerOrName('NOTATOKEN', list)).toEqual([]);
  });
});

describe('tokenKey', () => {
  it('normalises EVM contracts to lowercase', () => {
    expect(tokenKey('eth', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(
      'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });

  it('lowercases TRON contracts in the key but keeps the record as-is', () => {
    expect(tokenKey('trx', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(
      'trx:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t',
    );
    // The key is a lookup normalisation; the record keeps the base58
    // address exactly as verified.
    expect(
      DEFAULT_TOKENS.find((t) => t.chain === 'trx')?.contract,
    ).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  });
});

describe('validateEvmContractAddress', () => {
  it('accepts a checksummed address and returns the normalised form', () => {
    const result = validateEvmContractAddress(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    expect(result).toEqual({
      ok: true,
      normalized: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
  });

  it('accepts a lowercase address and checksums it', () => {
    const result = validateEvmContractAddress(
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    }
  });

  it('rejects a short address with a specific message', () => {
    const result = validateEvmContractAddress('0xA0b86991c6218b36c1d19D4a');
    expect(result).toEqual({
      ok: false,
      error: 'Enter a 40-character contract address starting with 0x',
    });
  });

  it('rejects an address without the 0x prefix', () => {
    const result = validateEvmContractAddress(
      'A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('starting with 0x');
    }
  });

  it('rejects non-hex characters', () => {
    const result = validateEvmContractAddress(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eBZZ',
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a bad checksum with a specific message', () => {
    // Checksummed USDC with one letter's case flipped.
    const result = validateEvmContractAddress(
      '0xA0B86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('checksum');
    }
  });
});

describe('validateTronContractAddress', () => {
  it('accepts the TRON USDT contract', () => {
    expect(
      validateTronContractAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
    ).toEqual({
      ok: true,
      normalized: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    });
  });

  it('rejects a bad checksum with a specific message', () => {
    const result = validateTronContractAddress(
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('TRON');
    }
  });

  it('rejects an address that does not start with T', () => {
    expect(validateTronContractAddress('AR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').ok).toBe(false);
  });

  it('rejects a short address', () => {
    expect(validateTronContractAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgj').ok).toBe(false);
  });
});

describe('validateTokenMetadata', () => {
  it('accepts valid metadata', () => {
    expect(validateTokenMetadata('USD Coin', 'USDC', 6)).toBeNull();
    expect(validateTokenMetadata('Tether USD', 'USDT', 0)).toBeNull();
    expect(validateTokenMetadata('Token', 'TKN', 36)).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(validateTokenMetadata('', 'USDC', 6)).toContain('name');
  });

  it('rejects a symbol longer than 11 characters', () => {
    expect(validateTokenMetadata('Token', 'VERYLONGSYMBOL', 18)).toContain('symbol');
  });

  it('rejects a symbol with a space', () => {
    expect(validateTokenMetadata('Token', 'US DC', 18)).toContain('symbol');
  });

  it('rejects decimals outside 0-36', () => {
    expect(validateTokenMetadata('Token', 'TKN', -1)).toContain('decimals');
    expect(validateTokenMetadata('Token', 'TKN', 37)).toContain('decimals');
    expect(validateTokenMetadata('Token', 'TKN', 1.5)).toContain('decimals');
  });
});

describe('tokenStandardFor', () => {
  it('offers ERC-20 on the seven EVM chains', () => {
    for (const chain of ['eth', 'bsc', 'matic', 'arb', 'op', 'base', 'avax'] as const) {
      expect(tokenStandardFor(chain)).toEqual({ standard: 'erc20' });
    }
  });

  it('offers TRC-20 on TRON', () => {
    expect(tokenStandardFor('trx')).toEqual({ standard: 'trc20' });
  });

  it('marks BTC, LTC and DOGE as native-coin only', () => {
    for (const chain of ['btc', 'ltc', 'doge'] as const) {
      const result = tokenStandardFor(chain);
      expect(result).toEqual({
        standard: null,
        reason: 'Native coin only',
      });
    }
  });

  it('marks TON Jettons as not supported yet', () => {
    const result = tokenStandardFor('ton');
    expect(result.standard).toBeNull();
    if (result.standard === null) {
      expect(result.reason).toContain('Jetton');
    }
  });

  it('marks Solana SPL tokens as not supported yet', () => {
    const result = tokenStandardFor('sol');
    expect(result.standard).toBeNull();
    if (result.standard === null) {
      expect(result.reason).toContain('SPL');
    }
  });
});

describe('duplicate detection', () => {
  it('treats the same EVM contract in different case as already added', () => {
    expect(isDuplicateToken([USDC], 'eth', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe(true);
    expect(isDuplicateToken([USDC], 'eth', '0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(false);
    expect(isDuplicateToken([USDC], 'trx', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(false);
  });

  it('refuses to add a duplicate with "Already added"', () => {
    const result = addCustomTokenToList([USDC], { ...USDC, addedAtMs: 1 });
    expect(result).toEqual({ error: 'Already added' });
  });

  it('appends a new token', () => {
    const other: TokenRecord = {
      ...USDC,
      contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      addedAtMs: 1,
    };
    const result = addCustomTokenToList([USDC], other);
    expect(result).toEqual({ list: [USDC, other] });
  });
});

describe('enabled-chains persistence', () => {
  it('defaults to all 13 chains when nothing is stored', () => {
    expect(readEnabledChains(memoryStore())).toEqual([...SUPPORTED_CHAINS]);
  });

  it('round-trips a stored subset', () => {
    const store = memoryStore();
    writeEnabledChains(['btc', 'eth'], store);
    expect(store.getItem(ENABLED_CHAINS_KEY)).toContain('btc');
    expect(readEnabledChains(store)).toEqual(['btc', 'eth']);
  });

  it('falls back to all chains on corrupt storage', () => {
    expect(readEnabledChains(memoryStore({ [ENABLED_CHAINS_KEY]: 'not json' }))).toEqual([
      ...SUPPORTED_CHAINS,
    ]);
  });

  it('drops unknown chain ids from storage', () => {
    const store = memoryStore({
      [ENABLED_CHAINS_KEY]: JSON.stringify({ version: 1, chains: ['btc', 'nope'] }),
    });
    expect(readEnabledChains(store)).toEqual(['btc']);
  });
});

describe('custom-tokens persistence', () => {
  it('starts empty when nothing is stored', () => {
    expect(readCustomTokens(memoryStore())).toEqual([]);
  });

  it('round-trips stored tokens', () => {
    const store = memoryStore();
    writeCustomTokens([USDC], store);
    expect(readCustomTokens(store)).toEqual([USDC]);
  });

  it('drops records with invalid decimals', () => {
    const store = memoryStore({
      [CUSTOM_TOKENS_KEY]: JSON.stringify({
        version: 1,
        tokens: [USDC, { ...USDC, contract: '0x0000000000000000000000000000000000000001', decimals: 99 }],
      }),
    });
    expect(readCustomTokens(store)).toEqual([USDC]);
  });

  it('returns empty on a version mismatch', () => {
    const store = memoryStore({
      [CUSTOM_TOKENS_KEY]: JSON.stringify({ version: 2, tokens: [USDC] }),
    });
    expect(readCustomTokens(store)).toEqual([]);
  });
});
