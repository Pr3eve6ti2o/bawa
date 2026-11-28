// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOnrampAddresses,
  buildOnrampUrl,
  coinbaseNetworkFor,
  coinbaseOnrampAppId,
  isBuySupportedChain,
  isCoinbaseOnrampConfigured,
  onrampDestinations,
  openCoinbaseOnramp,
} from './onramp';

describe('coinbase onramp config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is unconfigured without the project ID', () => {
    expect(coinbaseOnrampAppId()).toBeNull();
    expect(isCoinbaseOnrampConfigured()).toBe(false);
  });

  it('reads the project ID from the environment', () => {
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', '  test-app-id  ');
    expect(coinbaseOnrampAppId()).toBe('test-app-id');
    expect(isCoinbaseOnrampConfigured()).toBe(true);
  });

  it('treats a blank project ID as unconfigured', () => {
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', '   ');
    expect(coinbaseOnrampAppId()).toBeNull();
    expect(isCoinbaseOnrampConfigured()).toBe(false);
  });
});

describe('coinbase network map', () => {
  it('maps the supported chains to Coinbase network slugs', () => {
    expect(coinbaseNetworkFor('eth')).toBe('ethereum');
    expect(coinbaseNetworkFor('base')).toBe('base');
    expect(coinbaseNetworkFor('op')).toBe('optimism');
    expect(coinbaseNetworkFor('arb')).toBe('arbitrum');
    expect(coinbaseNetworkFor('matic')).toBe('polygon');
    expect(coinbaseNetworkFor('avax')).toBe('avalanche-c-chain');
    expect(coinbaseNetworkFor('sol')).toBe('solana');
    expect(coinbaseNetworkFor('btc')).toBe('bitcoin');
    expect(coinbaseNetworkFor('bsc')).toBe('bnb-chain');
    expect(coinbaseNetworkFor('trx')).toBe('tron');
  });

  it('offers no destination for chains Coinbase does not list', () => {
    expect(coinbaseNetworkFor('ton')).toBeNull();
    expect(coinbaseNetworkFor('ltc')).toBeNull();
    expect(coinbaseNetworkFor('doge')).toBeNull();
    expect(isBuySupportedChain('ton')).toBe(false);
    expect(isBuySupportedChain('eth')).toBe(true);
  });
});

describe('onramp destinations', () => {
  it('uses the HD receive address and groups shared EVM addresses', () => {
    const destinations = onrampDestinations({
      receiveAddresses: {
        eth: '0xabc',
        base: '0xabc',
        btc: 'bc1qtest',
        sol: null,
      },
      watchAddresses: {},
    });
    expect(destinations).toEqual([
      { chain: 'btc', network: 'bitcoin', address: 'bc1qtest' },
      { chain: 'eth', network: 'ethereum', address: '0xabc' },
      { chain: 'base', network: 'base', address: '0xabc' },
    ]);
    // One key per address; the shared EVM address carries both networks.
    expect(buildOnrampAddresses(destinations)).toEqual({
      bc1qtest: ['bitcoin'],
      '0xabc': ['ethereum', 'base'],
    });
  });

  it('falls back to the vault address, and the receive address wins over it', () => {
    const destinations = onrampDestinations({
      receiveAddresses: { eth: '0xReceive', btc: null, sol: null },
      vaultAddresses: {
        eth: ['0xVaultEth'],
        btc: ['bc1qVaultBtc'],
        sol: ['SolVault'],
      },
      watchAddresses: {
        eth: [{ chain: 'eth', index: 0, address: '0xWatchEth' }],
        sol: [{ chain: 'sol', index: 0, address: 'SolWatch' }],
      },
    });
    expect(destinations).toEqual([
      { chain: 'btc', network: 'bitcoin', address: 'bc1qVaultBtc' },
      { chain: 'eth', network: 'ethereum', address: '0xReceive' },
      { chain: 'sol', network: 'solana', address: 'SolVault' },
    ]);
  });

  it('falls back to a watch-only address when there is no vault address', () => {
    const destinations = onrampDestinations({
      receiveAddresses: { sol: null },
      watchAddresses: {
        sol: [{ chain: 'sol', index: 0, address: 'SolWatchOnly' }],
      },
    });
    expect(destinations).toEqual([
      { chain: 'sol', network: 'solana', address: 'SolWatchOnly' },
    ]);
  });

  it('skips chains with no address and reports none at all', () => {
    expect(
      onrampDestinations({ receiveAddresses: {}, watchAddresses: {} }),
    ).toEqual([]);
    expect(buildOnrampAddresses([])).toBeNull();
  });
});

describe('buildOnrampUrl', () => {
  // Parity with the SDK's own generateOnRampURL.test.ts vectors
  // (cbpay-js src/onramp/generateOnRampURL.test.ts): same inputs
  // must produce the same URL. If Coinbase changes the contract,
  // these fail first.
  it('builds the widget URL with the default host and path', () => {
    const url = new URL(
      buildOnrampUrl({
        appId: 'test',
        addresses: { '0x5ome4ddre55': ['ethereum'] },
      }),
    );
    expect(url.origin).toBe('https://pay.coinbase.com');
    expect(url.pathname).toBe('/buy/select-asset');
    expect(url.searchParams.get('appId')).toBe('test');
  });

  it('encodes multiple addresses and assets like the SDK', () => {
    const url = new URL(
      buildOnrampUrl({
        appId: 'test',
        addresses: {
          '0x5ome4ddre55': ['ethereum', 'avalanche-c-chain'],
          '90123jd09ef09df': ['solana'],
        },
        assets: ['USDC', 'SOL'],
      }),
    );
    expect(url.searchParams.get('addresses')).toBe(
      '{"0x5ome4ddre55":["ethereum","avalanche-c-chain"],"90123jd09ef09df":["solana"]}',
    );
    expect(url.searchParams.get('assets')).toBe('["USDC","SOL"]');
  });

  it('supports defaultNetwork', () => {
    const url = new URL(
      buildOnrampUrl({
        appId: 'test',
        addresses: { '0x5ome4ddre55': ['ethereum'] },
        defaultNetwork: 'polygon',
      }),
    );
    expect(url.searchParams.get('defaultNetwork')).toBe('polygon');
  });

  it('throws when no addresses are given', () => {
    expect(() =>
      buildOnrampUrl({
        appId: 'test',
        addresses: null as unknown as Record<string, string[]>,
      }),
    ).toThrowError();
  });
});

describe('openCoinbaseOnramp', () => {
  const popup = {
    location: { href: '' },
    close: vi.fn(),
    closed: false,
  };
  const openSpy = vi.spyOn(window, 'open');

  beforeEach(() => {
    vi.clearAllMocks();
    popup.location.href = '';
    popup.closed = false;
    openSpy.mockReturnValue(popup as unknown as WindowProxy);
  });

  // No mockRestore: the spy stays installed for the whole file and
  // beforeEach re-sets its return value. Restoring it would hand
  // later tests jsdom's real window.open, which returns undefined.

  it('builds the URL first, then opens a pop-up directly onto it with noopener', () => {
    const outcome = openCoinbaseOnramp({
      appId: 'test-app-id',
      addresses: { '0xabc': ['ethereum', 'base'] },
      defaultNetwork: 'ethereum',
    });
    expect(outcome).toBe('opened');
    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0]?.[0] as string;
    expect(openSpy).toHaveBeenCalledWith(
      openedUrl,
      '_blank',
      'noopener,width=430,height=600',
    );
    const url = new URL(openedUrl);
    expect(url.origin).toBe('https://pay.coinbase.com');
    expect(url.pathname).toBe('/buy/select-asset');
    expect(url.searchParams.get('appId')).toBe('test-app-id');
    expect(url.searchParams.get('addresses')).toBe(
      '{"0xabc":["ethereum","base"]}',
    );
    expect(url.searchParams.get('defaultNetwork')).toBe('ethereum');
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('reports opened even when window.open returns null (noopener)', () => {
    // With noopener set, Chromium returns null even when the pop-up
    // opened (verified first-hand: noopener => null, plain =>
    // WindowProxy), so a null return cannot mean "blocked" here.
    // A blocked pop-up is indistinguishable from an opened one, and
    // is reported as opened — the old blank-then-navigate code read
    // the same null as blocked and left a blank pop-up behind.
    openSpy.mockReturnValue(null);
    const outcome = openCoinbaseOnramp({
      appId: 'test-app-id',
      addresses: { '0xabc': ['ethereum'] },
    });
    expect(outcome).toBe('opened');
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('reports load failure without opening anything when the URL cannot be built', () => {
    const outcome = openCoinbaseOnramp({
      appId: 'test-app-id',
      addresses: null as unknown as Record<string, string[]>,
    });
    expect(outcome).toBe('load-failed');
    expect(openSpy).not.toHaveBeenCalled();
    expect(popup.close).not.toHaveBeenCalled();
  });
});
