// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOONPAY_CURRENCY_BY_CHAIN,
  ONRAMPER_CHAINS,
  RAMP_ASSET_BY_CHAIN,
  banxaCoinFor,
  banxaDestinations,
  buildBanxaUrl,
  buildMercuryoUrl,
  buildMoonpayUrl,
  buildOnramperUrl,
  buildRampUrl,
  buyDestinationsFor,
  buyProviderReadiness,
  buyProviders,
  isRampAssetBlockedInEuEea,
  isRampStablecoinBlockedInTexas,
  isRampUnservedUsState,
  mercuryoWidgetId,
  moonpayCurrencyFor,
  moonpayPublishableKey,
  onramperApiKey,
  onramperSupportsChain,
  openBuyProviderUrl,
  rampAssetFor,
  rampAssetToken,
  rampEnabledAssetsFor,
  rampHostApiKey,
  type BuyProviderId,
} from './buy-providers';

describe('buy provider config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is unconfigured without any provider key', () => {
    expect(rampHostApiKey()).toBeNull();
    expect(moonpayPublishableKey()).toBeNull();
    expect(onramperApiKey()).toBeNull();
    expect(mercuryoWidgetId()).toBeNull();
    expect(buyProviderReadiness('ramp')).toBe('not-configured');
    expect(buyProviderReadiness('moonpay')).toBe('not-configured');
    expect(buyProviderReadiness('onramper')).toBe('not-configured');
    expect(buyProviderReadiness('mercuryo')).toBe('not-configured');
    expect(buyProviderReadiness('coinbase')).toBe('not-configured');
  });

  it('reads each key from its own env name and trims it', () => {
    vi.stubEnv('VITE_RAMP_HOST_API_KEY', '  ramp-key  ');
    vi.stubEnv('VITE_MOONPAY_API_KEY', 'pk_live_test');
    vi.stubEnv('VITE_ONRAMPER_API_KEY', 'onramper-key');
    vi.stubEnv('VITE_BANXA_PARTNER_REF', 'bawa');
    vi.stubEnv('VITE_MERCURYO_WIDGET_ID', 'widget-1');
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'coinbase-id');
    expect(rampHostApiKey()).toBe('ramp-key');
    expect(moonpayPublishableKey()).toBe('pk_live_test');
    expect(onramperApiKey()).toBe('onramper-key');
    expect(buyProviderReadiness('ramp')).toBe('ready');
    // Pre-fill needs a signing backend for these three, so they are
    // ready without pre-fill — never presented as the polished path.
    expect(buyProviderReadiness('moonpay')).toBe('ready-no-prefill');
    expect(buyProviderReadiness('onramper')).toBe('ready-no-prefill');
    expect(buyProviderReadiness('mercuryo')).toBe('ready-no-prefill');
    expect(buyProviderReadiness('banxa')).toBe('ready');
    expect(buyProviderReadiness('coinbase')).toBe('ready');
  });

  it('treats a blank key as unconfigured', () => {
    vi.stubEnv('VITE_RAMP_HOST_API_KEY', '   ');
    expect(rampHostApiKey()).toBeNull();
    expect(buyProviderReadiness('ramp')).toBe('not-configured');
  });

  it('Transak always needs a backend, even with keys set', () => {
    expect(buyProviderReadiness('transak')).toBe('needs-backend');
  });

  it('lists the providers in rank order with their key copy', () => {
    const providers = buyProviders();
    expect(providers.map((provider) => provider.id)).toEqual([
      'ramp',
      'moonpay',
      'onramper',
      'banxa',
      'transak',
      'mercuryo',
      'coinbase',
    ]);
    const byId = new Map(providers.map((p) => [p.id, p]));
    expect(byId.get('ramp')?.keyCopy).toContain('hostApiKey');
    expect(byId.get('moonpay')?.keyCopy).toContain('sk_live_');
    expect(byId.get('moonpay')?.keyCopy).toContain('never be in the app');
    expect(byId.get('onramper')?.keyCopy).toContain('signing key pair');
    expect(byId.get('banxa')?.keyCopy).toContain('No key in the app');
    expect(byId.get('transak')?.keyCopy).toContain('server-side');
    expect(byId.get('mercuryo')?.keyCopy).toContain('widget_id');
    expect(byId.get('coinbase')?.keyCopy).toContain('session token');
    for (const provider of providers) {
      expect(provider.feeCopy).toContain('indicative only');
      expect(provider.setupCopy.length).toBeGreaterThan(0);
    }
  });
});

describe('Ramp URL builder', () => {
  it('builds the hosted widget URL with the key, address and asset', () => {
    const url = new URL(
      buildRampUrl({
        hostApiKey: 'test-key',
        userAddress: '0xabc',
        enabledCryptoAssets: ['ETH'],
      }),
    );
    expect(url.origin).toBe('https://app.ramp.network');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('hostApiKey')).toBe('test-key');
    expect(url.searchParams.get('hostAppName')).toBe('Bawa');
    expect(url.searchParams.get('userAddress')).toBe('0xabc');
    expect(url.searchParams.get('enabledCryptoAssets')).toBe('ETH');
    expect(url.searchParams.get('variant')).toBe('hosted-auto');
    expect(url.searchParams.get('defaultFlow')).toBe('ONRAMP');
  });

  it('joins several assets and passes the logo URL through', () => {
    const url = new URL(
      buildRampUrl({
        hostApiKey: 'test-key',
        userAddress: 'bc1qtest',
        enabledCryptoAssets: ['BTC', 'TON_GRAM'],
        hostLogoUrl: 'https://example.com/logo.png',
        fiatCurrency: 'EUR',
      }),
    );
    expect(url.searchParams.get('enabledCryptoAssets')).toBe(
      'BTC,TON_GRAM',
    );
    expect(url.searchParams.get('hostLogoUrl')).toBe(
      'https://example.com/logo.png',
    );
    expect(url.searchParams.get('fiatCurrency')).toBe('EUR');
  });

  it('throws without a key or an address', () => {
    expect(() =>
      buildRampUrl({ hostApiKey: '', userAddress: '0xabc' }),
    ).toThrowError();
    expect(() =>
      buildRampUrl({ hostApiKey: 'k', userAddress: '  ' }),
    ).toThrowError();
  });
});

describe('MoonPay URL builder', () => {
  it('builds the widget URL with the publishable key and a preferred currency', () => {
    const url = new URL(
      buildMoonpayUrl({
        apiKey: 'pk_live_test',
        defaultCurrencyCode: 'eth',
      }),
    );
    expect(url.origin).toBe('https://buy.moonpay.com');
    expect(url.searchParams.get('apiKey')).toBe('pk_live_test');
    expect(url.searchParams.get('defaultCurrencyCode')).toBe('eth');
  });

  it('never carries a wallet address (that would need a server signature)', () => {
    const url = new URL(buildMoonpayUrl({ apiKey: 'pk_live_test' }));
    expect(url.searchParams.has('walletAddress')).toBe(false);
    expect(url.searchParams.has('walletAddresses')).toBe(false);
    expect(url.searchParams.has('signature')).toBe(false);
  });

  it('throws without a publishable key', () => {
    expect(() => buildMoonpayUrl({ apiKey: ' ' })).toThrowError();
  });
});

describe('Onramper URL builder', () => {
  it('builds the widget URL with the key and buy mode', () => {
    const url = new URL(buildOnramperUrl({ apiKey: 'onramper-key' }));
    expect(url.origin).toBe('https://buy.onramper.com');
    expect(url.searchParams.get('apiKey')).toBe('onramper-key');
    expect(url.searchParams.get('mode')).toBe('buy');
  });

  it('never carries wallet addresses (those need a server signature)', () => {
    const url = new URL(buildOnramperUrl({ apiKey: 'onramper-key' }));
    expect(url.searchParams.has('wallets')).toBe(false);
    expect(url.searchParams.has('networkWallets')).toBe(false);
    expect(url.searchParams.has('signature')).toBe(false);
    expect(url.searchParams.has('sigV2')).toBe(false);
  });

  it('throws without a key', () => {
    expect(() => buildOnramperUrl({ apiKey: '' })).toThrowError();
  });
});

describe('Banxa URL builder', () => {
  it('builds the referral URL with address, coin and chain pre-filled', () => {
    const url = new URL(
      buildBanxaUrl({
        partnerRef: 'bawa',
        walletAddress: 'UQTestTonAddress',
        coinType: 'GRAM',
        blockchain: 'TON',
        fiatType: 'EUR',
      }),
    );
    expect(url.origin).toBe('https://bawa.banxa.com');
    expect(url.searchParams.get('walletAddress')).toBe('UQTestTonAddress');
    expect(url.searchParams.get('coinType')).toBe('GRAM');
    expect(url.searchParams.get('blockchain')).toBe('TON');
    expect(url.searchParams.get('fiatType')).toBe('EUR');
  });

  it('builds a bare referral URL with only the partnerRef', () => {
    const url = new URL(buildBanxaUrl({ partnerRef: 'bawa' }));
    expect(url.origin).toBe('https://bawa.banxa.com');
    expect([...url.searchParams.keys()]).toEqual([]);
  });

  it('throws without a partnerRef', () => {
    expect(() => buildBanxaUrl({ partnerRef: ' ' })).toThrowError();
  });
});

describe('Mercuryo URL builder', () => {
  it('builds the redirect URL with only the widget ID', () => {
    const url = new URL(buildMercuryoUrl({ widgetId: 'widget-1' }));
    expect(url.origin).toBe('https://exchange.mercuryo.io');
    expect(url.searchParams.get('widget_id')).toBe('widget-1');
  });

  it('never carries an address (signing needs the server secret)', () => {
    const url = new URL(buildMercuryoUrl({ widgetId: 'widget-1' }));
    expect(url.searchParams.has('address')).toBe(false);
    expect(url.searchParams.has('signature')).toBe(false);
  });

  it('throws without a widget ID', () => {
    expect(() => buildMercuryoUrl({ widgetId: '' })).toThrowError();
  });
});

describe('openBuyProviderUrl', () => {
  it('opens the URL directly with noopener, synchronously', () => {
    // With noopener a real browser returns null even when the pop-up
    // opens, so the function does not read the return value — it
    // reports 'opened' for the synchronous request itself. Blocking
    // is undetectable from the page under noopener, so there is no
    // 'blocked' case to test here.
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      expect(
        openBuyProviderUrl('https://app.ramp.network/?hostApiKey=k'),
      ).toBe('opened');
      expect(openSpy).toHaveBeenCalledWith(
        'https://app.ramp.network/?hostApiKey=k',
        '_blank',
        'noopener,width=430,height=600',
      );
    } finally {
      openSpy.mockRestore();
    }
  });
});

describe('per-chain gating', () => {
  it('covers TON on Ramp, MoonPay and Banxa (live lists, 2026-11-26)', () => {
    expect(rampAssetFor('ton')).toBe('TON_GRAM');
    expect(moonpayCurrencyFor('ton')).toBe('gram');
    expect(banxaCoinFor('ton')).toEqual({
      coinType: 'GRAM',
      blockchain: 'TON',
    });
  });

  it('maps the main chains to the live Ramp asset ids', () => {
    expect(rampAssetFor('btc')).toBe('BTC');
    expect(rampAssetFor('eth')).toBe('ETH');
    expect(rampAssetFor('sol')).toBe('SOLANA_SOL');
    expect(rampAssetFor('bsc')).toBe('BSC_BNB');
    expect(rampAssetFor('matic')).toBe('MATIC_POL');
    expect(rampAssetFor('arb')).toBe('ARBITRUM_ETH');
    expect(rampAssetFor('base')).toBe('BASE_ETH');
    expect(rampAssetFor('trx')).toBe('TRON_TRX');
    expect(rampAssetFor('ltc')).toBe('LTC');
    expect(rampAssetFor('doge')).toBe('DOGE');
  });

  it('maps the main chains to the live MoonPay currency codes', () => {
    expect(moonpayCurrencyFor('btc')).toBe('btc');
    expect(moonpayCurrencyFor('eth')).toBe('eth');
    expect(moonpayCurrencyFor('sol')).toBe('sol');
    expect(moonpayCurrencyFor('trx')).toBe('trx');
    expect(moonpayCurrencyFor('bsc')).toBe('bnb_bsc');
    expect(moonpayCurrencyFor('matic')).toBe('pol');
    expect(moonpayCurrencyFor('arb')).toBe('eth_arbitrum');
    expect(moonpayCurrencyFor('avax')).toBe('avax_cchain');
  });

  it('offers no native buy where the live list has no native asset', () => {
    // Ramp: Gnosis and Starknet have no native asset in the live list.
    expect(rampAssetFor('gnosis')).toBeNull();
    expect(rampAssetFor('starknet')).toBeNull();
    // MoonPay: Fantom, Cronos and Kava have no entry in the live list.
    expect(moonpayCurrencyFor('fantom')).toBeNull();
    expect(moonpayCurrencyFor('cronos')).toBeNull();
    expect(moonpayCurrencyFor('kava')).toBeNull();
    expect(banxaCoinFor('sol')).toBeNull();
  });

  it('Onramper covers the union of the Ramp and MoonPay chains', () => {
    for (const chain of Object.keys(RAMP_ASSET_BY_CHAIN)) {
      expect(onramperSupportsChain(chain as keyof typeof RAMP_ASSET_BY_CHAIN)).toBe(true);
    }
    for (const chain of Object.keys(MOONPAY_CURRENCY_BY_CHAIN)) {
      expect(
        onramperSupportsChain(chain as keyof typeof MOONPAY_CURRENCY_BY_CHAIN),
      ).toBe(true);
    }
    expect(ONRAMPER_CHAINS).toContain('ton');
    expect(onramperSupportsChain('fantom')).toBe(false);
  });

  it('resolves destinations like the Receive screen (receive, vault, watch-only)', () => {
    const destinations = buyDestinationsFor(RAMP_ASSET_BY_CHAIN, {
      receiveAddresses: { eth: '0xReceive', btc: null, ton: null },
      vaultAddresses: {
        btc: ['bc1qVault'],
        ton: ['UQVaultTon'],
      },
      watchAddresses: {
        sol: [{ chain: 'sol', index: 0, address: 'SolWatch' }],
      },
    });
    expect(destinations).toEqual([
      { chain: 'btc', asset: 'BTC', address: 'bc1qVault' },
      { chain: 'eth', asset: 'ETH', address: '0xReceive' },
      { chain: 'sol', asset: 'SOLANA_SOL', address: 'SolWatch' },
      { chain: 'ton', asset: 'TON_GRAM', address: 'UQVaultTon' },
    ]);
  });

  it('resolves Banxa destinations with coinType and blockchain', () => {
    expect(
      banxaDestinations({
        receiveAddresses: {},
        vaultAddresses: { ton: ['UQVaultTon'] },
        watchAddresses: {},
      }),
    ).toEqual([
      {
        chain: 'ton',
        coinType: 'GRAM',
        blockchain: 'TON',
        address: 'UQVaultTon',
      },
    ]);
    expect(
      banxaDestinations({ receiveAddresses: {}, watchAddresses: {} }),
    ).toEqual([]);
  });

  it('skips chains with no address and reports none at all', () => {
    expect(
      buyDestinationsFor(MOONPAY_CURRENCY_BY_CHAIN, {
        receiveAddresses: {},
        watchAddresses: {},
      }),
    ).toEqual([]);
  });
});

describe('Ramp region gating', () => {
  it('reads the token part of an asset id', () => {
    expect(rampAssetToken('TON_USDT')).toBe('USDT');
    expect(rampAssetToken('BASE_USDC')).toBe('USDC');
    expect(rampAssetToken('BTC')).toBe('BTC');
  });

  it('blocks USDT, USDT0, DAI and AUSD in the EU/EEA, nothing else', () => {
    expect(isRampAssetBlockedInEuEea('ETH_USDT')).toBe(true);
    expect(isRampAssetBlockedInEuEea('ETH_USDT0')).toBe(true);
    expect(isRampAssetBlockedInEuEea('ETH_DAI')).toBe(true);
    expect(isRampAssetBlockedInEuEea('ETH_AUSD')).toBe(true);
    expect(isRampAssetBlockedInEuEea('ETH_USDC')).toBe(false);
    expect(isRampAssetBlockedInEuEea('ETH')).toBe(false);
    expect(isRampAssetBlockedInEuEea('TON_GRAM')).toBe(false);
  });

  it('lists the nine unserved US states plus Puerto Rico', () => {
    for (const state of [
      'LA',
      'MN',
      'NV',
      'NJ',
      'NY',
      'PA',
      'VT',
      'WA',
      'PR',
    ]) {
      expect(isRampUnservedUsState(state)).toBe(true);
      expect(isRampUnservedUsState(state.toLowerCase())).toBe(true);
    }
    expect(isRampUnservedUsState('CA')).toBe(false);
    expect(isRampUnservedUsState('TX')).toBe(false);
  });

  it('blocks stablecoins in Texas only', () => {
    expect(isRampStablecoinBlockedInTexas('ETH_USDC', 'TX')).toBe(true);
    expect(isRampStablecoinBlockedInTexas('ETH_USDT', 'tx')).toBe(true);
    expect(isRampStablecoinBlockedInTexas('ETH', 'TX')).toBe(false);
    expect(isRampStablecoinBlockedInTexas('TON_GRAM', 'TX')).toBe(false);
    expect(isRampStablecoinBlockedInTexas('ETH_USDC', 'CA')).toBe(false);
  });

  it('gates the enabled assets for a chain by region', () => {
    expect(rampEnabledAssetsFor('eth')).toEqual(['ETH']);
    expect(rampEnabledAssetsFor('ton')).toEqual(['TON_GRAM']);
    expect(rampEnabledAssetsFor('eth', { usState: 'NY' })).toEqual([]);
    expect(rampEnabledAssetsFor('eth', { usState: 'TX' })).toEqual(['ETH']);
    expect(rampEnabledAssetsFor('eth', { euEea: true })).toEqual(['ETH']);
    expect(rampEnabledAssetsFor('gnosis')).toEqual([]);
  });
});

describe('honest states', () => {
  it('every provider has a setup line naming what the owner must provide', () => {
    const providers = buyProviders() as Array<{
      id: BuyProviderId;
      setupCopy: string;
    }>;
    const byId = new Map(providers.map((p) => [p.id, p.setupCopy]));
    expect(byId.get('ramp')).toContain('KYB');
    expect(byId.get('moonpay')).toContain('signing backend');
    expect(byId.get('onramper')).toContain('$199/month');
    expect(byId.get('banxa')).toContain('partnerRef');
    expect(byId.get('transak')).toContain('backend');
    expect(byId.get('mercuryo')).toContain('widget ID');
    expect(byId.get('coinbase')).toContain('onboarding and API keys');
  });
});
