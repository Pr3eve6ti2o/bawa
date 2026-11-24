import { describe, expect, it } from 'vitest';
import {
  CUSTOM_TOKENS_KEY,
  DEFAULT_ENABLED_CHAINS,
  DEFAULT_TOKENS,
  ENABLED_CHAINS_KEY,
  addCustomTokenToList,
  isDuplicateToken,
  isVerifiedToken,
  orderAssetsByBalance,
  readCustomTokens,
  readEnabledChains,
  resolveTokenByTickerOrName,
  shortContract,
  tokenKey,
  tokenKeyOf,
  tokenStandardFor,
  validateEvmContractAddress,
  validateSolMintAddress,
  validateTokenMetadata,
  validateTonJettonAddress,
  validateTronContractAddress,
  writeCustomTokens,
  writeEnabledChains,
  type TokenRecord,
  type TokenStore,
} from './tokens';

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


describe('DEFAULT_TOKENS — UI/UX fixes, item 18', () => {
  // The 8 original defaults + 13 verified primaries (item 18):
  // SPL USDC + Jetton USDT (item 13, live-verified in CDP), WETH on
  // Ethereum, USDC/USDT(0) on Polygon/Arbitrum/Optimism/Base/Avalanche
  // and USDT on BNB Smart Chain. Every contract, name, symbol and
  // decimals below was verified live on-chain (eth_call / Solana RPC /
  // TonAPI) and against the CoinGecko contract endpoint, 2026-11-23.
  const EXPECTED_NEW = [
    {
      chain: 'sol',
      contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      chain: 'ton',
      contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      name: 'Tether USD',
      symbol: 'USD₮',
      decimals: 6,
      coingeckoId: 'tether',
    },
    {
      chain: 'eth',
      contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      coingeckoId: 'weth',
    },
    {
      chain: 'matic',
      contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      chain: 'matic',
      contract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      name: 'USDT0',
      symbol: 'USDT0',
      decimals: 6,
      coingeckoId: 'usdt0',
    },
    {
      chain: 'arb',
      contract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      chain: 'arb',
      contract: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      name: 'USD₮0',
      symbol: 'USD₮0',
      decimals: 6,
      coingeckoId: 'usdt0',
    },
    {
      chain: 'op',
      contract: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      chain: 'op',
      contract: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      coingeckoId: 'bridged-usdt',
    },
    {
      chain: 'base',
      contract: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      coingeckoId: 'l2-standard-bridged-usdt-base',
    },
    {
      chain: 'avax',
      contract: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      chain: 'avax',
      contract: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      name: 'TetherToken',
      symbol: 'USDt',
      decimals: 6,
      coingeckoId: 'tether',
    },
    {
      chain: 'bsc',
      contract: '0x55d398326f99059fF775485246999027B3197955',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 18,
      coingeckoId: 'binance-bridged-usdt-bnb-smart-chain',
    },
  ] as const;

  it('holds 21 verified defaults (8 original + 13 item-18 primaries)', () => {
    expect(DEFAULT_TOKENS).toHaveLength(21);
    for (const expected of EXPECTED_NEW) {
      const found = DEFAULT_TOKENS.find(
        (token) => tokenKeyOf(token) === `${expected.chain}:${expected.contract.toLowerCase()}`,
      );
      expect(found).toMatchObject({
        chain: expected.chain,
        contract: expected.contract,
        name: expected.name,
        symbol: expected.symbol,
        decimals: expected.decimals,
        coingeckoId: expected.coingeckoId,
      });
    }
  });

  it('has no duplicate defaults and every contract is valid for its chain', () => {
    const keys = DEFAULT_TOKENS.map((token) => tokenKeyOf(token));
    expect(new Set(keys).size).toBe(keys.length);
    for (const token of DEFAULT_TOKENS) {
      expect(token.coingeckoId).not.toBeNull();
      if (token.chain === 'sol') {
        expect(validateSolMintAddress(token.contract).ok).toBe(true);
      } else if (token.chain === 'ton') {
        expect(validateTonJettonAddress(token.contract).ok).toBe(true);
      } else if (token.chain === 'trx') {
        expect(validateTronContractAddress(token.contract).ok).toBe(true);
      } else {
        expect(validateEvmContractAddress(token.contract).ok).toBe(true);
      }
      expect(isDuplicateToken(DEFAULT_TOKENS, token.chain, token.contract)).toBe(true);
    }
  });
});

describe('tokenStandardFor — UI/UX fixes, item 13', () => {
  it('offers SPL on Solana and Jetton on TON', () => {
    expect(tokenStandardFor('sol')).toEqual({ standard: 'spl' });
    expect(tokenStandardFor('ton')).toEqual({ standard: 'jetton' });
  });

  it('still offers ERC-20 on every EVM chain and TRC-20 on TRON', () => {
    for (const chain of [
      'eth',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'gnosis',
      'celo',
      'linea',
      'mantle',
      'scroll',
      'opbnb',
      'metis',
      'aurora',
      'fantom',
    ] as const) {
      expect(tokenStandardFor(chain)).toEqual({ standard: 'erc20' });
    }
    expect(tokenStandardFor('trx')).toEqual({ standard: 'trc20' });
  });

  it('keeps native-coin-only chains unselectable', () => {
    for (const chain of ['btc', 'ltc', 'doge'] as const) {
      expect(tokenStandardFor(chain)).toEqual({
        standard: null,
        reason: 'Native coin only',
      });
    }
  });
});

describe('validateSolMintAddress — UI/UX fixes, item 13', () => {
  it('accepts the USDC mint', () => {
    expect(
      validateSolMintAddress(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ),
    ).toEqual({
      ok: true,
      normalized: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    });
  });

  it('rejects bad base58, short and over-long mints without touching the network', () => {
    // A 43-char base58 string can still decode to 32 bytes (the USDC
    // mint minus its last char does), so the short/over-long cases use
    // vectors whose decoded byte length is provably wrong: all-'1'
    // collapses to one zero byte, all-'z' overflows to 33 bytes.
    for (const bad of [
      '',
      '1'.repeat(43),
      'z'.repeat(45),
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1O', // 'O' is not base58
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // an EVM address, not a mint
    ]) {
      const result = validateSolMintAddress(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Solana mint');
    }
  });
});

describe('validateTonJettonAddress — UI/UX fixes, item 13', () => {
  it('accepts the USDT jetton master and the raw form', () => {
    expect(
      validateTonJettonAddress(
        'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      ).ok,
    ).toBe(true);
    expect(
      validateTonJettonAddress(`0:${'ab'.repeat(32)}`).ok,
    ).toBe(true);
  });

  it('rejects short, garbage and wrong-prefix addresses', () => {
    for (const bad of [
      '',
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sD', // 47 chars
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs!', // '!' is not base64
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // an EVM address
      '1:ab', // bad workchain/hash shape
    ]) {
      const result = validateTonJettonAddress(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Jetton');
    }
  });
});

describe('validateTokenMetadata — UI/UX fixes, item 13', () => {
  it('accepts a real non-ASCII symbol (TON USDT is USD₮ on TonAPI)', () => {
    expect(validateTokenMetadata('Tether USD', 'USD₮', 6)).toBeNull();
  });

  it('still rejects an empty, whitespace or control-character symbol', () => {
    expect(validateTokenMetadata('Tether USD', '', 6)).not.toBeNull();
    expect(validateTokenMetadata('Tether USD', 'US DT', 6)).not.toBeNull();
    expect(validateTokenMetadata('Tether USD', 'US\u0001DT', 6)).not.toBeNull();
  });
});

describe('orderAssetsByBalance', () => {
  // Item 20: how top wallets order a token list — non-zero balances
  // first (highest fiat value first), zero balances below in registry
  // order, nothing hidden when nothing has a balance.
  const asset = (
    key: string,
    hasBalance: boolean,
    fiatMinorUnits: number | null,
  ) => ({ key, hasBalance, fiatMinorUnits });

  it('puts non-zero balances first, highest fiat value first', () => {
    const ordered = orderAssetsByBalance([
      asset('zero-a', false, null),
      asset('small', true, 100),
      asset('big', true, 5000),
      asset('zero-b', false, null),
    ]);
    expect(ordered.map((a) => a.key)).toEqual([
      'big',
      'small',
      'zero-a',
      'zero-b',
    ]);
  });

  it('keeps registry order when nothing has a balance', () => {
    const ordered = orderAssetsByBalance([
      asset('first', false, null),
      asset('second', false, null),
      asset('third', false, null),
    ]);
    expect(ordered.map((a) => a.key)).toEqual(['first', 'second', 'third']);
  });

  it('puts a non-zero balance without a price above zero balances', () => {
    const ordered = orderAssetsByBalance([
      asset('zero', false, null),
      asset('priceless', true, null),
    ]);
    expect(ordered.map((a) => a.key)).toEqual(['priceless', 'zero']);
  });

  it('does not mutate the input list', () => {
    const input = [asset('a', true, 1), asset('b', false, null)];
    const snapshot = [...input];
    orderAssetsByBalance(input);
    expect(input).toEqual(snapshot);
  });
});
// Restored from Lane A (uiux-a-layout): unit coverage the B-side
// rewrite of this file dropped. Lane A tokenStandardFor and
// DEFAULT_TOKENS describes are NOT restored — B supersedes them
// (SPL/Jetton support, item 13; 21 default tokens, item 18).

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
  it('defaults to the 22 curated chains when nothing is stored (Lane 80-APP)', () => {
    expect(readEnabledChains(memoryStore())).toEqual([...DEFAULT_ENABLED_CHAINS]);
    expect(DEFAULT_ENABLED_CHAINS).toHaveLength(22);
  });

  it('round-trips a stored subset', () => {
    const store = memoryStore();
    writeEnabledChains(['btc', 'eth'], store);
    expect(store.getItem(ENABLED_CHAINS_KEY)).toContain('btc');
    expect(readEnabledChains(store)).toEqual(['btc', 'eth']);
  });

  it('falls back to the 22 curated chains on corrupt storage', () => {
    expect(readEnabledChains(memoryStore({ [ENABLED_CHAINS_KEY]: 'not json' }))).toEqual([
      ...DEFAULT_ENABLED_CHAINS,
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
