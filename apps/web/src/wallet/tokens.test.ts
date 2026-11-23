import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOKENS,
  isDuplicateToken,
  tokenKeyOf,
  tokenStandardFor,
  validateEvmContractAddress,
  validateSolMintAddress,
  validateTokenMetadata,
  validateTonJettonAddress,
  validateTronContractAddress,
} from './tokens';

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
