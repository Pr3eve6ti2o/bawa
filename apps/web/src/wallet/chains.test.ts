import { describe, expect, it } from 'vitest';
import {
  assertSupported,
  availableFor,
  capabilitiesFor,
  CHAINS,
  chainConfig,
  chainConfigForNetwork,
  pathFor,
  profileFor,
  SOLANA_PROFILES,
  SUPPORTED_CHAINS,
} from './chains';

describe('chains registry', () => {
  it('supports exactly four mainnet chains', () => {
    expect([...SUPPORTED_CHAINS].sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
    expect(Object.keys(CHAINS).sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
  });

  it('uses mainnet CAIP-2 network IDs', () => {
    expect(CHAINS.eth.networkId).toBe('eip155:1');
    expect(CHAINS.btc.networkId).toBe(
      'bip122:000000000019d6689c085ae165831e93',
    );
    expect(CHAINS.trx.networkId).toBe('tron:0x2b6653dc');
    expect(CHAINS.ton.networkId).toBe('ton:-239');
  });

  it('uses CAIP-19 native asset IDs via the slip44 namespace', () => {
    expect(CHAINS.btc.assetId).toBe(
      'bip122:000000000019d6689c085ae165831e93/slip44:0',
    );
    expect(CHAINS.eth.assetId).toBe('eip155:1/slip44:60');
    expect(CHAINS.trx.assetId).toBe('tron:0x2b6653dc/slip44:195');
    expect(CHAINS.ton.assetId).toBe('ton:-239/slip44:607');
  });

  it('derives account 0 index 0 paths from the pinned profiles', () => {
    expect(pathFor('btc', 0, 0)).toBe("m/84'/0'/0'/0/0");
    expect(pathFor('eth', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('trx', 0, 0)).toBe("m/44'/195'/0'/0/0");
    expect(pathFor('ton', 0, 0)).toBe("m/44'/607'/0'");
    expect(profileFor('btc')).toBe('bawa-btc-bip84-v1');
    expect(profileFor('eth')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('trx')).toBe('bawa-trx-bip44-v1');
    expect(profileFor('ton')).toBe('bawa-ton-v4r2-v1');
  });

  it('uses a fully hardened TON path with no index suffix', () => {
    expect(pathFor('ton', 0, 1)).toBe("m/44'/607'/0'");
    expect(pathFor('ton', 1, 0)).toBe("m/44'/607'/0'");
  });

  it('rejects negative or non-integer account and index values', () => {
    expect(() => pathFor('eth', -1, 0)).toThrow();
    expect(() => pathFor('eth', 0, -1)).toThrow();
    expect(() => pathFor('eth', 0.5, 0)).toThrow();
  });

  it('lists all four chains for derive, restore and receive', () => {
    expect(availableFor('derive')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('restore')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('receive')).toEqual(['btc', 'eth', 'trx', 'ton']);
  });

  it('lists all four chains for balance and history, and three for fee-quote', () => {
    expect(availableFor('balance')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('history')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON fee-quote stays blocked: it needs the unsigned message (Phase 4).
    expect(availableFor('fee-quote')).toEqual(['btc', 'eth', 'trx']);
  });

  it('lists all four chains for unsigned-plan and local-sign (Phase 4), and three for post-sign-verify', () => {
    expect(availableFor('unsigned-plan')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('local-sign')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON post-sign-verify stays blocked: the signed BOC is not re-parsed.
    expect(availableFor('post-sign-verify')).toEqual(['btc', 'eth', 'trx']);
  });

  it('marks the Phase 2 adapter capabilities verified with evidence', () => {
    for (const chain of SUPPORTED_CHAINS) {
      const caps = capabilitiesFor(chain);
      expect(caps.derive.status).toBe('verified');
      expect(caps.restore.status).toBe('verified');
      expect(caps.receive.status).toBe('verified');
      expect(caps.balance.status).toBe('verified');
      expect(caps.history.status).toBe('verified');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-19');
      expect(caps.history.evidence).toContain('live mainnet cross-check 2026-11-19');
      for (const capability of ['unsigned-plan', 'local-sign'] as const) {
        expect(caps[capability].status).toBe('verified');
        expect(caps[capability].evidence).toContain('send.test.ts');
      }
      if (chain === 'ton') {
        expect(caps['post-sign-verify'].status).toBe('blocked');
        expect(caps['post-sign-verify'].evidence).toContain('not re-parsed');
      } else {
        expect(caps['post-sign-verify'].status).toBe('verified');
        expect(caps['post-sign-verify'].evidence).toContain('send.test.ts');
      }
    }
    expect(capabilitiesFor('ton')['fee-quote'].status).toBe('blocked');
    expect(capabilitiesFor('ton')['fee-quote'].evidence).toContain('unsigned message');
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(capabilitiesFor(chain)['fee-quote'].status).toBe('verified');
    }
  });

  it('pins the Phase 2 adapter RPC endpoints (no viem:mainnet marker)', () => {
    expect(CHAINS.btc.rpcEndpoints).toEqual(['https://mempool.space/api']);
    expect(CHAINS.eth.rpcEndpoints).toEqual([
      'https://ethereum-rpc.publicnode.com',
    ]);
    expect(CHAINS.trx.rpcEndpoints).toEqual(['https://api.trongrid.io']);
    expect(CHAINS.ton.rpcEndpoints).toEqual([
      'https://toncenter.com/api/v2/jsonRPC',
    ]);
  });

  it('throws a typed error naming the unavailable combination', () => {
    expect(() => assertSupported('ton', 'fee-quote')).toThrow(
      /chain ton \(ton:-239, profile bawa-ton-v4r2-v1\) cannot do fee-quote/,
    );
    expect(() => assertSupported('ton', 'post-sign-verify')).toThrow(
      /cannot do post-sign-verify/,
    );
    expect(() => assertSupported('ton', 'local-sign')).not.toThrow();
    expect(() => assertSupported('eth', 'balance')).not.toThrow();
    expect(() => assertSupported('eth', 'derive')).not.toThrow();
  });

  it('has no non-mainnet network, asset or endpoint string in the registry', () => {
    const registryText = JSON.stringify(CHAINS) + JSON.stringify(SOLANA_PROFILES);
    expect(registryText).not.toMatch(/testnet|sepolia|nile/i);
  });

  it('resolves chains by mainnet network ID and throws for anything else', () => {
    expect(chainConfigForNetwork('eip155:1').id).toBe('eth');
    expect(chainConfigForNetwork('ton:-239').id).toBe('ton');
    expect(() => chainConfigForNetwork('eip155:11155111')).toThrow(
      /Unsupported network/,
    );
    expect(() => chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toThrow(
      /Unsupported network/,
    );
  });

  it('names both Solana profiles as unsupported and nothing else', () => {
    const ids = Object.keys(SOLANA_PROFILES).sort();
    expect(ids).toEqual([
      'solana-phantom-bip44change-v1',
      'walletcore-solana-default-v1',
    ]);
    for (const profile of Object.values(SOLANA_PROFILES)) {
      expect(profile.status).toBe('unsupported');
    }
    const walletcore = SOLANA_PROFILES['walletcore-solana-default-v1'];
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(walletcore).toBeDefined();
    expect(phantom).toBeDefined();
    expect(walletcore?.path).toBe("m/44'/501'/0'");
    expect(phantom?.path).toBe("m/44'/501'/{i}'/0'");
    expect(availableFor('derive')).not.toContain('solana');
  });

  it('sets the EVM chain ID only for Ethereum', () => {
    expect(CHAINS.eth.evmChainId).toBe(1);
    expect(CHAINS.btc.evmChainId).toBeNull();
    expect(CHAINS.trx.evmChainId).toBeNull();
    expect(CHAINS.ton.evmChainId).toBeNull();
  });

  it('throws for an unknown chain', () => {
    expect(() => chainConfig('solana' as never)).toThrow(/Unsupported chain/);
  });
});

describe('capabilities.json registry shape and identity', () => {
  type RegistryCoin = {
    registryId: string;
    bawaChainId: 'btc' | 'eth' | 'trx' | 'ton' | null;
    coinTypeName: string;
    coinId: number;
    slip44: number | null;
    symbol: string;
    registrySymbol: string;
    decimals: number;
    curve: 'secp256k1' | 'ed25519';
    derivationTemplate: string;
    xpubVersion: string | null;
    evmChainId: number | null;
    status: 'supported' | 'prospective';
    displayName: string;
    networkId: string | null;
    assetId: string | null;
    profileId: string | null;
    rpcEndpoints: string[] | null;
  };

  const coinFields = [
    'registryId',
    'bawaChainId',
    'coinTypeName',
    'coinId',
    'slip44',
    'symbol',
    'registrySymbol',
    'decimals',
    'curve',
    'derivationTemplate',
    'xpubVersion',
    'evmChainId',
    'status',
    'displayName',
    'networkId',
    'assetId',
    'profileId',
    'rpcEndpoints',
  ] as const;

  const expectedSupportedCoins = {
    bitcoin: {
      registryId: 'bitcoin',
      bawaChainId: 'btc',
      coinTypeName: 'bitcoin',
      coinId: 0,
      slip44: null,
      symbol: 'BTC',
      registrySymbol: 'BTC',
      decimals: 8,
      curve: 'secp256k1',
      derivationTemplate: "m/84'/0'/{account}'/0/{index}",
      xpubVersion: '0x04b24746',
      evmChainId: null,
      status: 'supported',
      displayName: 'Bitcoin',
      networkId: 'bip122:000000000019d6689c085ae165831e93',
      assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
      profileId: 'bawa-btc-bip84-v1',
      rpcEndpoints: ['https://mempool.space/api'],
    },
    ethereum: {
      registryId: 'ethereum',
      bawaChainId: 'eth',
      coinTypeName: 'ethereum',
      coinId: 60,
      slip44: null,
      symbol: 'ETH',
      registrySymbol: 'ETH',
      decimals: 18,
      curve: 'secp256k1',
      derivationTemplate: "m/44'/60'/{account}'/0/{index}",
      xpubVersion: '0x0488b21e',
      evmChainId: 1,
      status: 'supported',
      displayName: 'Ethereum',
      networkId: 'eip155:1',
      assetId: 'eip155:1/slip44:60',
      profileId: 'bawa-evm-bip44-v1',
      rpcEndpoints: ['https://ethereum-rpc.publicnode.com'],
    },
    tron: {
      registryId: 'tron',
      bawaChainId: 'trx',
      coinTypeName: 'tron',
      coinId: 195,
      slip44: null,
      symbol: 'TRX',
      registrySymbol: 'TRX',
      decimals: 6,
      curve: 'secp256k1',
      derivationTemplate: "m/44'/195'/{account}'/0/{index}",
      xpubVersion: '0x0488b21e',
      evmChainId: null,
      status: 'supported',
      displayName: 'TRON',
      networkId: 'tron:0x2b6653dc',
      assetId: 'tron:0x2b6653dc/slip44:195',
      profileId: 'bawa-trx-bip44-v1',
      rpcEndpoints: ['https://api.trongrid.io'],
    },
    ton: {
      registryId: 'ton',
      bawaChainId: 'ton',
      coinTypeName: 'ton',
      coinId: 607,
      slip44: null,
      symbol: 'TON',
      registrySymbol: 'GRAM',
      decimals: 9,
      curve: 'ed25519',
      derivationTemplate: "m/44'/607'/0'",
      xpubVersion: null,
      evmChainId: null,
      status: 'supported',
      displayName: 'TON',
      networkId: 'ton:-239',
      assetId: 'ton:-239/slip44:607',
      profileId: 'bawa-ton-v4r2-v1',
      rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    },
  } as const;

  const implementedCoins = Object.entries(expectedSupportedCoins);
  const prospectiveCoinNames = [
    'solana',
    'smartchain',
    'polygon',
    'arbitrum',
    'optimism',
    'base',
    'avalanchec',
    'litecoin',
    'doge',
  ] as const;
  const coinNames = [
    ...Object.keys(expectedSupportedCoins),
    ...prospectiveCoinNames,
  ];

  // An explicit allowlist, independent of the forbidden-words check.
  const mainnetNetworkIds = [
    'bip122:000000000019d6689c085ae165831e93',
    'eip155:1',
    'tron:0x2b6653dc',
    'ton:-239',
  ] as const;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  function isHttpsUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  function hasCoinShape(
    coinName: string,
    value: unknown,
  ): value is RegistryCoin {
    if (!isRecord(value)) return false;

    // All listed fields are required; no additional fields are permitted.
    if (
      Object.keys(value).length !== coinFields.length ||
      !coinFields.every((field) =>
        Object.prototype.hasOwnProperty.call(value, field),
      )
    ) {
      return false;
    }

    if (
      value.registryId !== coinName ||
      !isNonEmptyString(value.coinTypeName) ||
      !isNonEmptyString(value.displayName) ||
      !isNonNegativeInteger(value.coinId) ||
      (value.slip44 !== null && !isNonNegativeInteger(value.slip44)) ||
      !isNonNegativeInteger(value.decimals) ||
      typeof value.symbol !== 'string' ||
      !/^[A-Z]+$/.test(value.symbol) ||
      typeof value.registrySymbol !== 'string' ||
      !/^[A-Z]+$/.test(value.registrySymbol) ||
      (value.curve !== 'secp256k1' && value.curve !== 'ed25519') ||
      !isNonEmptyString(value.derivationTemplate) ||
      !/^m(?:\/(?:\d+|\{account\}|\{index\})'?)+$/.test(
        value.derivationTemplate,
      ) ||
      (value.xpubVersion !== null &&
        (typeof value.xpubVersion !== 'string' ||
          !/^0x[0-9a-fA-F]{8}$/.test(value.xpubVersion))) ||
      (value.evmChainId !== null && !isNonNegativeInteger(value.evmChainId))
    ) {
      return false;
    }

    if (value.status === 'prospective') {
      return (
        value.bawaChainId === null &&
        value.networkId === null &&
        value.assetId === null &&
        value.profileId === null &&
        value.rpcEndpoints === null &&
        value.xpubVersion === null &&
        value.registrySymbol === value.symbol
      );
    }

    if (value.status !== 'supported') return false;

    return (
      typeof value.bawaChainId === 'string' &&
      ['btc', 'eth', 'trx', 'ton'].includes(value.bawaChainId) &&
      isNonEmptyString(value.networkId) &&
      /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/.test(value.networkId) &&
      isNonEmptyString(value.assetId) &&
      /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}\/slip44:\d+$/.test(
        value.assetId,
      ) &&
      isNonEmptyString(value.profileId) &&
      Array.isArray(value.rpcEndpoints) &&
      value.rpcEndpoints.length > 0 &&
      value.rpcEndpoints.every(isHttpsUrl) &&
      (value.curve === 'ed25519'
        ? value.xpubVersion === null
        : typeof value.xpubVersion === 'string') &&
      (value.bawaChainId === 'eth'
        ? isNonNegativeInteger(value.evmChainId)
        : value.evmChainId === null)
    );
  }

  function checkedCoin(coinName: string, value: unknown): RegistryCoin {
    if (!hasCoinShape(coinName, value)) {
      throw new Error(`Invalid registry coin: ${coinName}`);
    }
    return value;
  }

  async function readRegistryCoins(): Promise<Record<string, unknown>> {
    const { readFileSync } = await import('node:fs');
    // Resolve from this test file, not from the Vitest working directory.
    const registryUrl = new URL(
      '../../../../registry/capabilities.json',
      import.meta.url,
    );
    const registry: unknown = JSON.parse(readFileSync(registryUrl, 'utf8'));
    if (!isRecord(registry) || !isRecord(registry.coins)) {
      throw new Error('Registry must contain a coins object');
    }
    return registry.coins;
  }

  function supportedRegistryCoins(
    coins: Record<string, unknown>,
  ): RegistryCoin[] {
    return Object.entries(coins)
      .map(([coinName, value]) => checkedCoin(coinName, value))
      .filter((coin) => coin.status === 'supported');
  }

  function pathAtOrigin(template: string): string {
    return template
      .replace(/\{account\}/g, '0')
      .replace(/\{index\}/g, '0');
  }

  it('contains exactly the thirteen known coin entries', async () => {
    expect.assertions(1);
    const coins = await readRegistryCoins();
    expect(Object.keys(coins).sort()).toEqual([...coinNames].sort());
  });

  it.each(coinNames)(
    'validates required/permitted fields, symbols and decimals for %s',
    async (coinName) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);

      expect(Object.keys(coin).sort()).toEqual([...coinFields].sort());
      expect(coin.symbol).toMatch(/^[A-Z]+$/);
      expect(coin.registrySymbol).toMatch(/^[A-Z]+$/);
      expect(Number.isInteger(coin.decimals)).toBe(true);
      expect(coin.decimals).toBeGreaterThanOrEqual(0);
    },
  );

  it('rejects missing required fields and unpermitted fields', () => {
    expect.assertions(3);
    const validConfig = expectedSupportedCoins.ethereum;
    const missingConfig: Record<string, unknown> = { ...validConfig };
    delete missingConfig.decimals;
    const extraConfig = { ...validConfig, unexpectedField: true };

    expect(() => checkedCoin('ethereum', validConfig)).not.toThrow();
    expect(() => checkedCoin('ethereum', missingConfig)).toThrow(
      /Invalid registry coin: ethereum/,
    );
    expect(() => checkedCoin('ethereum', extraConfig)).toThrow(
      /Invalid registry coin: ethereum/,
    );
  });

  it.each([
    ['a lowercase symbol', { symbol: 'Eth' }],
    ['fractional decimals', { decimals: 1.5 }],
    ['negative decimals', { decimals: -1 }],
    ['an HTTP RPC URL', { rpcEndpoints: ['http://example.com'] }],
    ['a malformed RPC URL', { rpcEndpoints: ['https://['] }],
  ] as const)(
    'rejects a locally built config with %s',
    (_reason, changes) => {
      expect.assertions(2);
      const validConfig = expectedSupportedCoins.ethereum;
      const badConfig = { ...validConfig, ...changes };

      expect(() => checkedCoin('ethereum', validConfig)).not.toThrow();
      expect(() => checkedCoin('ethereum', badConfig)).toThrow(
        /Invalid registry coin: ethereum/,
      );
    },
  );

  it.each(implementedCoins)(
    'pins all supported %s fields and aligns them with the live chain',
    async (coinName, expectedCoin) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      expect(coin).toEqual(expectedCoin);
      expect(live).toMatchObject({
        id: expectedCoin.bawaChainId,
        displayName: coin.displayName,
        symbol: coin.symbol,
        coinTypeName: coin.coinTypeName,
        networkId: coin.networkId,
        assetId: coin.assetId,
        profileId: coin.profileId,
        rpcEndpoints: coin.rpcEndpoints,
        evmChainId: coin.evmChainId,
      });
      expect(live).toHaveProperty(
        'symbol',
        expect.stringMatching(/^[A-Z]+$/),
      );
      expect(profileFor(expectedCoin.bawaChainId)).toBe(coin.profileId);
      expect(pathFor(expectedCoin.bawaChainId, 0, 0)).toBe(
        pathAtOrigin(coin.derivationTemplate),
      );
    },
  );

  it('allows only the four explicitly listed mainnet network IDs', async () => {
    expect.assertions(2);
    const coins = await readRegistryCoins();

    expect(
      Object.values(CHAINS).map((chain) => chain.networkId).sort(),
    ).toEqual([...mainnetNetworkIds].sort());
    expect(
      supportedRegistryCoins(coins).map((coin) => coin.networkId).sort(),
    ).toEqual([...mainnetNetworkIds].sort());
  });

  it('matches the EIP-155 numeric reference to evmChainId in both registries', async () => {
    expect.assertions(4);
    const coins = await readRegistryCoins();
    const ethereum = checkedCoin('ethereum', coins.ethereum);

    for (const config of [ethereum, CHAINS.eth]) {
      expect(config.networkId).toMatch(/^eip155:(0|[1-9]\d*)$/);
      expect(Number(config.networkId?.split(':')[1])).toBe(config.evmChainId);
    }
  });

  it.each(implementedCoins)(
    'keeps the %s asset network component identical to its CAIP-2 ID',
    async (coinName, expectedCoin) => {
      expect.assertions(3);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      expect(coin.assetId?.split('/')[0]).toBe(coin.networkId);
      expect(live.assetId.split('/')[0]).toBe(live.networkId);
      expect(coin.assetId).toBe(`${coin.networkId}/slip44:${coin.coinId}`);
    },
  );

  it('has unique network IDs across the four implemented chains', async () => {
    expect.assertions(2);
    const coins = await readRegistryCoins();
    const liveIds = Object.values(CHAINS).map((chain) => chain.networkId);
    const registryIds = supportedRegistryCoins(coins).map(
      (coin) => coin.networkId,
    );

    expect(new Set(liveIds).size).toBe(4);
    expect(new Set(registryIds).size).toBe(4);
  });

  it('has unique account 0 index 0 derivation paths across the four chains', async () => {
    expect.assertions(2);
    const coins = await readRegistryCoins();
    const livePaths = SUPPORTED_CHAINS.map((chain) => pathFor(chain, 0, 0));
    const registryPaths = supportedRegistryCoins(coins).map((coin) =>
      pathAtOrigin(coin.derivationTemplate),
    );

    expect(new Set(livePaths).size).toBe(4);
    expect(new Set(registryPaths).size).toBe(4);
  });

  it.each(implementedCoins)(
    'parses every %s RPC URL and permits only HTTPS',
    async (coinName, expectedCoin) => {
      expect.assertions(4);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      for (const endpoints of [coin.rpcEndpoints ?? [], live.rpcEndpoints]) {
        expect(endpoints.length).toBeGreaterThan(0);
        expect(endpoints.map((endpoint) => new URL(endpoint).protocol)).toEqual(
          endpoints.map(() => 'https:'),
        );
      }
    },
  );

  it.each(prospectiveCoinNames)(
    'keeps %s as prospective registry-only metadata, not a live chain',
    async (coinName) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);

      expect(coin.status).toBe('prospective');
      expect(coin.bawaChainId).toBeNull();
      expect(coin).toMatchObject({
        networkId: null,
        assetId: null,
        profileId: null,
        rpcEndpoints: null,
        xpubVersion: null,
      });
      expect(coin.registrySymbol).toBe(coin.symbol);
      expect(() => chainConfig(coinName as never)).toThrow(/Unsupported chain/);
    },
  );
});
