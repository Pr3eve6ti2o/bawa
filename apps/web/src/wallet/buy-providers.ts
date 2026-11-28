// Buy provider picker — fiat on-ramps (providers programme, Phase 2,
// Lane B, 2026-11-26, hands-on Muse, 0 Sol calls).
//
// Source of truth: /home/boxd/workspace/bawa-providers/RESEARCH.md
// section 2 (+ research/onramps.md). Every key fact below comes from
// there unless marked "live-checked", in which case it was verified
// first-hand on 2026-11-26 against the provider's own live list:
//
// - Ramp: GET https://api.ramp.network/api/host-api/v2/assets
//   (129 assets). Native asset ids below are the live `symbol` values
//   verbatim (e.g. SOLANA_SOL, MATIC_POL, TON_GRAM) — note the docs'
//   swapAsset examples (BTC_BTC, ETH_ETH) differ from the live list
//   (BTC, ETH); the live list is the authority.
// - MoonPay: GET https://api.moonpay.com/v3/currencies (147
//   currencies, no key needed). Currency codes below are the live
//   `code` values verbatim (e.g. bnb_bsc, avax_cchain, eth_arbitrum,
//   pol for Polygon's native token — `matic` no longer exists).
// - Banxa: the supported-cryptocurrencies reference
//   (docs.banxa.com/reference/supported-cryptocurrencies-and-blockchains,
//   read 2026-11-26). The coinType/blockchain pairs below are rows
//   with Buy ✅ seen first-hand on that page.
//
// TON, previously unconfirmed for every provider (open verification
// #2), is CONFIRMED by those live lists and is offered:
// - Ramp: chain TON, TON_GRAM native (enabled) + TON_USDT.
// - MoonPay: code `gram` ("Gram (prev. TonCoin)"), supportsLiveMode,
//   minBuyAmount 5.21, TON address regex, metadata networkCode 'ton'.
// - Banxa: GRAM on TON, Buy ✅ (restricted geo: US).
// Mercuryo's live pairs list (GET /v1.6/public/currencies-buy) was
// also fetched: it contains a bare 'TON' entry but the endpoint's
// list mixes fiat and crypto codes, so that entry is ambiguous and
// Mercuryo TON stays unconfirmed — and Mercuryo carries no chain
// pre-fill anyway (see below), so nothing in the UI depends on it.
//
// What is NOT built here, deliberately:
// - No SDK is bundled (Ramp, MoonPay, Banxa licences are npm/jsDelivr
//   metadata only — open verification #3, repo LICENSE files not
//   verified). Every widget URL is hand-rolled, like the existing
//   Coinbase onramp.ts.
// - No client-side URL signing anywhere: MoonPay's secret key, the
//   Onramper signing key pair and Mercuryo's widget secret must never
//   be in the app. Builders that would need a signature take NO
//   address: MoonPay omits walletAddress, Onramper omits wallets /
//   networkWallets (Onramper's own docs: passing them without a
//   server-side signature gets checkout requests rejected), Mercuryo
//   omits the address (its signature scheme is plain SHA-512 —
//   verified, closing verification #5).
// - No Transak builder at all: since the 2026-11-16 migration the
//   widget URL is minted server-side with the API secret — there is
//   no client-side path.
// - No key is ever invented: every config value is empty by default
//   and comes from the owner-must-provide list (RESEARCH.md §4.1).
//   Until provided, the UI says so — never a fake "Buy".
//
// Region gating (Ramp): Bawa does not know the user's region, so the
// restrictions are stated on the Ramp row and enforced by the pure
// helpers below for callers that do know it (a region picker, a
// future geo lookup). The default pre-fill buys the chain's NATIVE
// asset, which no regional rule blocks — the EU/EEA and Texas rules
// bite only on stablecoins, which are never pre-selected.

import type { ChainId } from '../engine/boundary';
import type { DerivedAddress } from '@bawa/contracts';

// ---------------------------------------------------------------------------
// Configuration: every value empty by default, from the build-time env.
// ---------------------------------------------------------------------------

function readEnv(name: string): string | null {
  const raw: unknown = (import.meta.env as Record<string, unknown>)[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** Ramp production key. Public by Ramp's own design (support article, updated 2026-11-12): "disclosing your API key within the URL is completely safe … it's specifically designed to be placed on the front end." */
const RAMP_HOST_API_KEY_ENV = 'VITE_RAMP_HOST_API_KEY';
export function rampHostApiKey(): string | null {
  return readEnv(RAMP_HOST_API_KEY_ENV);
}

/** MoonPay publishable key (pk_live_…). Safe in the app. The secret key (sk_live_…) is NEVER read here. */
const MOONPAY_API_KEY_ENV = 'VITE_MOONPAY_API_KEY';
export function moonpayPublishableKey(): string | null {
  return readEnv(MOONPAY_API_KEY_ENV);
}

/** Onramper API key. A public identifier in the widget URL. */
const ONRAMPER_API_KEY_ENV = 'VITE_ONRAMPER_API_KEY';
export function onramperApiKey(): string | null {
  return readEnv(ONRAMPER_API_KEY_ENV);
}

/** Banxa partner subdomain (partnerRef). The only thing the Referral path needs — no key at all. */
const BANXA_PARTNER_REF_ENV = 'VITE_BANXA_PARTNER_REF';
export function banxaPartnerRef(): string | null {
  return readEnv(BANXA_PARTNER_REF_ENV);
}

/** Mercuryo widget ID. Public, in the redirect URL. */
const MERCURYO_WIDGET_ID_ENV = 'VITE_MERCURYO_WIDGET_ID';
export function mercuryoWidgetId(): string | null {
  return readEnv(MERCURYO_WIDGET_ID_ENV);
}

// ---------------------------------------------------------------------------
// Per-chain coverage, from the registry (apps/web/src/wallet/chains.ts).
// A chain is listed only when the provider's own live list confirms
// its native asset as buyable. Absent = not offered, never faked.
// ---------------------------------------------------------------------------

/**
 * Bawa chain -> Ramp native asset id (live `symbol`, 2026-11-26).
 * Gnosis has no native asset on Ramp (only XDAI_USDCE / XDAI_LINK);
 * Starknet has none either (only STARKNET_ETH / STARKNET_USDC /
 * STARKNET_STRK); Fantom is not on Ramp's chain list at all.
 */
export const RAMP_ASSET_BY_CHAIN: Readonly<Partial<Record<ChainId, string>>> = {
  btc: 'BTC',
  eth: 'ETH',
  sol: 'SOLANA_SOL',
  bsc: 'BSC_BNB',
  matic: 'MATIC_POL',
  arb: 'ARBITRUM_ETH',
  op: 'OPTIMISM_ETH',
  base: 'BASE_ETH',
  avax: 'AVAX',
  trx: 'TRON_TRX',
  ton: 'TON_GRAM',
  ltc: 'LTC',
  doge: 'DOGE',
  celo: 'CELO',
  linea: 'LINEA_ETH',
  zksync: 'ZKSYNCERA_ETH',
  worldchain: 'WORLDCHAIN_ETH',
  ronin: 'RONIN_RON',
  monad: 'MONAD_MON',
  cosmos: 'COSMOS_ATOM',
  near: 'NEAR_NEAR',
  cardano: 'CARDANO_ADA',
  xrp: 'XRP',
  stellar: 'XLM',
  hedera: 'HEDERA_HBAR',
  telos: 'TELOS_TLOS',
  xdc: 'XDC_XDC',
};

/** The Ramp native asset id for a chain, or null when Ramp does not sell it. */
export function rampAssetFor(chain: ChainId): string | null {
  return RAMP_ASSET_BY_CHAIN[chain] ?? null;
}

/**
 * Bawa chain -> MoonPay native currency code (live `code`, 2026-11-26).
 * `matic` does not exist in the live list (Polygon's native token is
 * `pol`); BNB is `bnb_bsc`, AVAX is `avax_cchain`, ETH on L2s is
 * `eth_arbitrum` / `eth_optimism` / `eth_base` / `eth_linea`.
 * Fantom, Cronos, Kava and Kaspa have no entry in the live list.
 */
export const MOONPAY_CURRENCY_BY_CHAIN: Readonly<
  Partial<Record<ChainId, string>>
> = {
  btc: 'btc',
  eth: 'eth',
  sol: 'sol',
  trx: 'trx',
  ton: 'gram',
  bsc: 'bnb_bsc',
  matic: 'pol',
  arb: 'eth_arbitrum',
  op: 'eth_optimism',
  base: 'eth_base',
  avax: 'avax_cchain',
  linea: 'eth_linea',
  celo: 'celo',
  ltc: 'ltc',
  doge: 'doge',
  cosmos: 'atom',
  aptos: 'apt',
  near: 'near',
  cardano: 'ada',
  xrp: 'xrp',
  stellar: 'xlm',
  polkadot: 'dot',
  algorand: 'algo',
  tezos: 'xtz',
  hedera: 'hbar',
  injective: 'inj_inj',
  starknet: 'strk_strk',
  ronin: 'ron',
  monad: 'mon_mon',
  sonic: 's_sonic',
  filecoin: 'fil',
};

/** The MoonPay native currency code for a chain, or null when MoonPay does not list it. */
export function moonpayCurrencyFor(chain: ChainId): string | null {
  return MOONPAY_CURRENCY_BY_CHAIN[chain] ?? null;
}

/**
 * Bawa chain -> Banxa Referral coinType + blockchain (reference page,
 * Buy ✅ rows seen first-hand, 2026-11-26). Banxa's widget covers
 * more networks than this pre-fill map; the map gates only the
 * address/asset pre-fill, never the redirect itself.
 */
const BANXA_COIN_BY_CHAIN: Readonly<
  Partial<Record<ChainId, { coinType: string; blockchain: string }>>
> = {
  btc: { coinType: 'BTC', blockchain: 'BTC' },
  eth: { coinType: 'ETH', blockchain: 'ETH' },
  doge: { coinType: 'DOGE', blockchain: 'DOGE' },
  ltc: { coinType: 'LTC', blockchain: 'LTC' },
  ton: { coinType: 'GRAM', blockchain: 'TON' },
  cardano: { coinType: 'ADA', blockchain: 'ADA' },
  polkadot: { coinType: 'DOT', blockchain: 'DOT' },
  cosmos: { coinType: 'ATOM', blockchain: 'ATOM' },
  cronos: { coinType: 'CRO', blockchain: 'CRO' },
  celo: { coinType: 'CELO', blockchain: 'CELO' },
  hedera: { coinType: 'HBAR', blockchain: 'HBAR' },
  injective: { coinType: 'INJ', blockchain: 'INJ' },
  aptos: { coinType: 'APT', blockchain: 'APT' },
};

/** The Banxa coinType/blockchain pair for a chain, or null when the pre-fill is not verified. */
export function banxaCoinFor(
  chain: ChainId,
): { coinType: string; blockchain: string } | null {
  return BANXA_COIN_BY_CHAIN[chain] ?? null;
}

/**
 * Onramper chains: the union of its underlying providers' coverage,
 * approximated here by the union of the Ramp and MoonPay maps above
 * (Onramper aggregates 30+ on-ramps incl. MoonPay, Transak and
 * Banxa — RESEARCH.md §2.3). The Onramper widget itself is the final
 * authority per transaction; the widget carries no address pre-fill
 * (it would need a server-signed URL), so this gates only which
 * chains the row claims to cover.
 */
export const ONRAMPER_CHAINS: readonly ChainId[] = Array.from(
  new Set([
    ...Object.keys(RAMP_ASSET_BY_CHAIN),
    ...Object.keys(MOONPAY_CURRENCY_BY_CHAIN),
  ]),
).sort() as ChainId[];

/** True when Onramper's underlying providers cover this chain. */
export function onramperSupportsChain(chain: ChainId): boolean {
  return (ONRAMPER_CHAINS as readonly ChainId[]).includes(chain);
}

// ---------------------------------------------------------------------------
// Ramp region gating (RESEARCH.md §2.1). Pure functions, so they are
// testable without knowing the user's region; the Buy UI states the
// restrictions because Bawa cannot detect the region itself.
// ---------------------------------------------------------------------------

/** Stablecoins Ramp does not sell in the EU/EEA under MiCA. */
const RAMP_EU_EEA_BLOCKED_STABLECOINS: readonly string[] = [
  'USDT',
  'USDT0',
  'DAI',
  'AUSD',
];

/** US states (plus Puerto Rico) Ramp does not serve. */
const RAMP_UNSERVED_US_STATES: readonly string[] = [
  'LA',
  'MN',
  'NV',
  'NJ',
  'NY',
  'PA',
  'VT',
  'WA',
  'PR',
];

/** Stablecoins (Ramp sells none of these in Texas). */
const RAMP_STABLECOINS: readonly string[] = [
  ...RAMP_EU_EEA_BLOCKED_STABLECOINS,
  'USDC',
  'USDC.E',
  'EURQ',
  'USDQ',
];

/** The token part of a Ramp asset id: 'TON_USDT' -> 'USDT', 'BTC' -> 'BTC'. */
export function rampAssetToken(assetId: string): string {
  const parts = assetId.split('_');
  return parts[parts.length - 1] ?? assetId;
}

/** True when this asset cannot be bought in the EU/EEA. */
export function isRampAssetBlockedInEuEea(assetId: string): boolean {
  return (RAMP_EU_EEA_BLOCKED_STABLECOINS as readonly string[]).includes(
    rampAssetToken(assetId),
  );
}

/** True when this US state / territory is not served by Ramp (case-insensitive, trims). */
export function isRampUnservedUsState(state: string): boolean {
  return (RAMP_UNSERVED_US_STATES as readonly string[]).includes(
    state.trim().toUpperCase(),
  );
}

/** True when this asset is a stablecoin Ramp will not sell in Texas. */
export function isRampStablecoinBlockedInTexas(
  assetId: string,
  usState: string,
): boolean {
  if (usState.trim().toUpperCase() !== 'TX') return false;
  return (RAMP_STABLECOINS as readonly string[]).includes(
    rampAssetToken(assetId),
  );
}

type RampRegion = {
  /** US state code, e.g. 'TX'. Omit when unknown. */
  usState?: string;
  /** True when the buyer is in the EU/EEA. Omit when unknown. */
  euEea?: boolean;
};

/**
 * The Ramp asset ids buyable on this chain for a buyer in this
 * region: the chain's native asset, or [] when the region rules it
 * out (an unserved US state blocks everything; the EU/EEA and Texas
 * rules bite only on stablecoins, never on a native asset).
 */
export function rampEnabledAssetsFor(
  chain: ChainId,
  region: RampRegion = {},
): string[] {
  const asset = rampAssetFor(chain);
  if (asset === null) return [];
  if (
    region.usState !== undefined &&
    isRampUnservedUsState(region.usState)
  ) {
    return [];
  }
  if (region.euEea === true && isRampAssetBlockedInEuEea(asset)) return [];
  if (
    region.usState !== undefined &&
    isRampStablecoinBlockedInTexas(asset, region.usState)
  ) {
    return [];
  }
  return [asset];
}

// ---------------------------------------------------------------------------
// Destinations: the same address resolution as the Receive screen
// (HD receive address, then vault primary, then watch-only) applied
// to a provider's own chain map. Chains with no address are skipped,
// never invented. Mirrors onrampDestinations (wallet/onramp.ts).
// ---------------------------------------------------------------------------

type BuyAddressMaps = {
  receiveAddresses?: Partial<Record<ChainId, string | null>> | null;
  vaultAddresses?: Partial<Record<ChainId, string[]>> | null;
  watchAddresses?: Partial<Record<ChainId, DerivedAddress[]>> | null;
};

type BuyDestination = {
  chain: ChainId;
  /** The provider's asset id for this chain (Ramp asset id / MoonPay currency code). */
  asset: string;
  address: string;
};

/**
 * One destination per covered chain that has an address, in map
 * order. Used for Ramp (asset = Ramp asset id) and MoonPay (asset =
 * MoonPay currency code).
 */
export function buyDestinationsFor(
  assetByChain: Readonly<Partial<Record<ChainId, string>>>,
  { receiveAddresses, vaultAddresses, watchAddresses }: BuyAddressMaps,
): BuyDestination[] {
  const destinations: BuyDestination[] = [];
  for (const [chain, asset] of Object.entries(assetByChain)) {
    const id = chain as ChainId;
    const receiveAddress = receiveAddresses?.[id] ?? null;
    const vaultAddress = vaultAddresses?.[id]?.[0];
    const watchAddress = watchAddresses?.[id]?.[0]?.address;
    const address =
      typeof receiveAddress === 'string' && receiveAddress !== ''
        ? receiveAddress
        : typeof vaultAddress === 'string' && vaultAddress !== ''
          ? vaultAddress
          : watchAddress;
    if (
      typeof address !== 'string' ||
      address === '' ||
      asset === undefined
    ) {
      continue;
    }
    destinations.push({ chain: id, asset, address });
  }
  return destinations;
}

type BanxaDestination = {
  chain: ChainId;
  coinType: string;
  blockchain: string;
  address: string;
};

/** One Banxa Referral destination per covered chain that has an address, in map order. */
export function banxaDestinations(
  maps: BuyAddressMaps,
): BanxaDestination[] {
  const destinations: BanxaDestination[] = [];
  for (const [chain, coin] of Object.entries(BANXA_COIN_BY_CHAIN)) {
    const id = chain as ChainId;
    const receiveAddress = maps.receiveAddresses?.[id] ?? null;
    const vaultAddress = maps.vaultAddresses?.[id]?.[0];
    const watchAddress = maps.watchAddresses?.[id]?.[0]?.address;
    const address =
      typeof receiveAddress === 'string' && receiveAddress !== ''
        ? receiveAddress
        : typeof vaultAddress === 'string' && vaultAddress !== ''
          ? vaultAddress
          : watchAddress;
    if (
      typeof address !== 'string' ||
      address === '' ||
      coin === undefined
    ) {
      continue;
    }
    destinations.push({
      chain: id,
      coinType: coin.coinType,
      blockchain: coin.blockchain,
      address,
    });
  }
  return destinations;
}

// ---------------------------------------------------------------------------
// Widget URL builders (hand-rolled; no SDK bundled — see the header).
// ---------------------------------------------------------------------------

/** The Ramp hosted widget host (docs.rampnetwork.com; the Android browser tutorial uses the app.rampnetwork.com alias — both answer 200). */
const RAMP_WIDGET_HOST = 'https://app.ramp.network';

type BuildRampUrlOptions = {
  hostApiKey: string;
  /** The single destination address the purchase is sent to. */
  userAddress: string;
  /** Assets on offer, first = default. Defaults to the native asset only when omitted by the caller. */
  enabledCryptoAssets?: string[];
  hostAppName?: string;
  hostLogoUrl?: string;
  fiatCurrency?: string;
};

/**
 * The Ramp hosted widget URL. Query params are the SDK config names
 * (docs.rampnetwork.com/configuration): hostApiKey, hostAppName,
 * hostLogoUrl, userAddress, enabledCryptoAssets (comma-separated,
 * CHAIN_SYMBOL ids — `enabledCryptoAssets=BTC_BTC,ETH_ETH,BASE_USDC`
 * in the docs), variant hosted-auto, defaultFlow ONRAMP. Throws
 * when the key or the address is blank — a widget without either
 * cannot work.
 */
export function buildRampUrl({
  hostApiKey,
  userAddress,
  enabledCryptoAssets,
  hostAppName = 'Bawa',
  hostLogoUrl,
  fiatCurrency,
}: BuildRampUrlOptions): string {
  if (hostApiKey.trim() === '') {
    throw new Error('Ramp needs a host API key.');
  }
  if (userAddress.trim() === '') {
    throw new Error('Ramp needs a destination address.');
  }
  const url = new URL(RAMP_WIDGET_HOST);
  url.searchParams.set('hostApiKey', hostApiKey);
  url.searchParams.set('hostAppName', hostAppName);
  if (hostLogoUrl !== undefined && hostLogoUrl.trim() !== '') {
    url.searchParams.set('hostLogoUrl', hostLogoUrl);
  }
  url.searchParams.set('userAddress', userAddress);
  if (enabledCryptoAssets !== undefined && enabledCryptoAssets.length > 0) {
    url.searchParams.set(
      'enabledCryptoAssets',
      enabledCryptoAssets.join(','),
    );
  }
  url.searchParams.set('variant', 'hosted-auto');
  url.searchParams.set('defaultFlow', 'ONRAMP');
  if (fiatCurrency !== undefined && fiatCurrency.trim() !== '') {
    url.searchParams.set('fiatCurrency', fiatCurrency);
  }
  return url.toString();
}

/** The MoonPay buy widget host. */
const MOONPAY_WIDGET_HOST = 'https://buy.moonpay.com';

type BuildMoonpayUrlOptions = {
  /** Publishable key (pk_live_…). The secret key is never a parameter here. */
  apiKey: string;
  /** Preferred crypto (user may still change it inside the widget). NOT `currencyCode`, which would lock the choice. */
  defaultCurrencyCode?: string;
  baseCurrencyCode?: string;
  baseCurrencyAmount?: string;
};

/**
 * The MoonPay widget URL — WITHOUT walletAddress, deliberately.
 * MoonPay requires a server-signed URL (HMAC-SHA256 with the secret
 * key) whenever walletAddress is passed, and without the signature
 * the widget fails to load (400, 1_SYS_UNKNOWN). Bawa has no signing
 * backend, so the address is left for the user to paste inside the
 * widget; the row copy says so plainly. Throws when the publishable
 * key is blank.
 */
export function buildMoonpayUrl({
  apiKey,
  defaultCurrencyCode,
  baseCurrencyCode,
  baseCurrencyAmount,
}: BuildMoonpayUrlOptions): string {
  if (apiKey.trim() === '') {
    throw new Error('MoonPay needs a publishable key.');
  }
  const url = new URL(MOONPAY_WIDGET_HOST);
  url.searchParams.set('apiKey', apiKey);
  if (defaultCurrencyCode !== undefined && defaultCurrencyCode !== '') {
    url.searchParams.set('defaultCurrencyCode', defaultCurrencyCode);
  }
  if (baseCurrencyCode !== undefined && baseCurrencyCode !== '') {
    url.searchParams.set('baseCurrencyCode', baseCurrencyCode);
  }
  if (baseCurrencyAmount !== undefined && baseCurrencyAmount !== '') {
    url.searchParams.set('baseCurrencyAmount', baseCurrencyAmount);
  }
  return url.toString();
}

/** The Onramper buy widget host. */
const ONRAMPER_WIDGET_HOST = 'https://buy.onramper.com';

type BuildOnramperUrlOptions = {
  /** Public API key (public identifier in the URL). */
  apiKey: string;
};

/**
 * The Onramper widget URL — WITHOUT wallets / networkWallets,
 * deliberately. Onramper's own docs: those parameters carry
 * sensitive data and must be server-signed (Signature V2, Ed25519);
 * unsigned, checkout requests are rejected. Bawa has no signing
 * backend, so the address is left for the user to paste inside the
 * widget; the row copy says so plainly. Throws when the key is blank.
 */
export function buildOnramperUrl({ apiKey }: BuildOnramperUrlOptions): string {
  if (apiKey.trim() === '') {
    throw new Error('Onramper needs an API key.');
  }
  const url = new URL(ONRAMPER_WIDGET_HOST);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('mode', 'buy');
  return url.toString();
}

type BuildBanxaUrlOptions = {
  /** Partner subdomain (partnerRef). */
  partnerRef: string;
  walletAddress?: string;
  coinType?: string;
  blockchain?: string;
  fiatType?: string;
};

/**
 * The Banxa Referral URL: https://{partnerRef}.banxa.com/ with
 * optional pre-fill. Every parameter is optional on the Referral
 * path and nothing is signed — that is also why it is a plain
 * redirect with no quote UI, no webhooks and no order lookup.
 * Throws when the partnerRef is blank.
 */
export function buildBanxaUrl({
  partnerRef,
  walletAddress,
  coinType,
  blockchain,
  fiatType,
}: BuildBanxaUrlOptions): string {
  if (partnerRef.trim() === '') {
    throw new Error('Banxa needs a partnerRef.');
  }
  const url = new URL(`https://${partnerRef}.banxa.com/`);
  if (walletAddress !== undefined && walletAddress !== '') {
    url.searchParams.set('walletAddress', walletAddress);
  }
  if (coinType !== undefined && coinType !== '') {
    url.searchParams.set('coinType', coinType);
  }
  if (blockchain !== undefined && blockchain !== '') {
    url.searchParams.set('blockchain', blockchain);
  }
  if (fiatType !== undefined && fiatType !== '') {
    url.searchParams.set('fiatType', fiatType);
  }
  return url.toString();
}

/** The Mercuryo exchange host for the redirect flow. */
const MERCURYO_WIDGET_HOST = 'https://exchange.mercuryo.io';

type BuildMercuryoUrlOptions = {
  /** Public widget ID. */
  widgetId: string;
};

/**
 * The Mercuryo redirect URL — WITHOUT the address, deliberately.
 * Address pre-fill needs a server-generated signature with the
 * widget secret; the scheme is plain SHA-512 (SHA-512 of address +
 * secret — verification #5 closed). The address is left for the
 * user to paste inside the widget; the row copy says so plainly.
 * Throws when the widget ID is blank.
 */
export function buildMercuryoUrl({ widgetId }: BuildMercuryoUrlOptions): string {
  if (widgetId.trim() === '') {
    throw new Error('Mercuryo needs a widget ID.');
  }
  const url = new URL(MERCURYO_WIDGET_HOST);
  url.searchParams.set('widget_id', widgetId);
  return url.toString();
}

// Transak has NO builder here, deliberately: since the 2026-11-16
// migration the widget URL is minted server-side with the API
// secret (POST …/refresh-token, then POST …/auth/session → widgetUrl,
// valid 5 minutes, sessionId single-use). There is no client-side
// path to build.

type BuyOpenOutcome = 'opened' | 'blocked';

/**
 * Open a provider widget URL as a pop-up, the same way
 * openCoinbaseOnramp does: open directly onto the built URL,
 * synchronously inside the click (so the browser cannot mistake it
 * for unprompted), with noopener. 'opened' means the pop-up was
 * requested; with noopener the page cannot tell whether the browser
 * blocked it, so 'blocked' is not returned from here. The purchase
 * itself is completed inside the pop-up.
 */
export function openBuyProviderUrl(url: string): BuyOpenOutcome {
  window.open(url, '_blank', 'noopener,width=430,height=600');
  return 'opened';
}

// ---------------------------------------------------------------------------
// Provider table: rank order, key copy (RESEARCH.md §2.8 is the source
// of truth) and the honest state each row is in. The Buy panel renders
// this table; nothing here invents a working "Buy".
// ---------------------------------------------------------------------------

export type BuyProviderId =
  | 'ramp'
  | 'moonpay'
  | 'onramper'
  | 'banxa'
  | 'transak'
  | 'mercuryo'
  | 'coinbase';

type BuyProviderReadiness =
  | 'ready'
  | 'ready-no-prefill'
  | 'not-configured'
  | 'needs-backend';

export type BuyProviderInfo = {
  id: BuyProviderId;
  name: string;
  /** Rank in RESEARCH.md §2.10. */
  rank: number;
  /** Which keys it needs and where they live (RESEARCH.md §2.8). */
  keyCopy: string;
  /** Indicative fee; the quote at purchase time is authoritative. */
  feeCopy: string;
  readiness: BuyProviderReadiness;
  /** What the owner must provide before this row can work. */
  setupCopy: string;
};

/** True once the provider can be opened from this static page. */
export function buyProviderReadiness(id: BuyProviderId): BuyProviderReadiness {
  switch (id) {
    case 'ramp':
      return rampHostApiKey() !== null ? 'ready' : 'not-configured';
    case 'moonpay':
      return moonpayPublishableKey() !== null
        ? 'ready-no-prefill'
        : 'not-configured';
    case 'onramper':
      return onramperApiKey() !== null ? 'ready-no-prefill' : 'not-configured';
    case 'banxa':
      return banxaPartnerRef() !== null ? 'ready' : 'not-configured';
    case 'transak':
      return 'needs-backend';
    case 'mercuryo':
      return mercuryoWidgetId() !== null
        ? 'ready-no-prefill'
        : 'not-configured';
    case 'coinbase': {
      const raw: unknown = (import.meta.env as Record<string, unknown>)[
        'VITE_COINBASE_ONRAMP_APP_ID'
      ];
      return typeof raw === 'string' && raw.trim() !== ''
        ? 'ready'
        : 'not-configured';
    }
  }
}

/** The provider table in rank order (Ramp first, Coinbase last). */
export function buyProviders(): BuyProviderInfo[] {
  return [
    {
      id: 'ramp',
      name: 'Ramp',
      rank: 1,
      keyCopy:
        'Public API key (hostApiKey) — safe in the app by Ramp’s own design; no server needed.',
      feeCopy: 'From 1.40% by bank transfer (indicative only).',
      readiness: buyProviderReadiness('ramp'),
      setupCopy:
        'The owner needs to finish Ramp onboarding and KYB to get a production hostApiKey.',
    },
    {
      id: 'moonpay',
      name: 'MoonPay',
      rank: 2,
      keyCopy:
        'Publishable key (pk_live_…) in the app; secret key (sk_live_…) must never be in the app — it signs the widget URL on a server.',
      feeCopy: 'Up to 4.5% by card (indicative only).',
      readiness: buyProviderReadiness('moonpay'),
      setupCopy:
        'The owner needs a MoonPay dashboard account, Account Review and Business Verification (KYB) for a production publishable key — plus a signing backend before your address can be pre-filled.',
    },
    {
      id: 'onramper',
      name: 'Onramper',
      rank: 3,
      keyCopy:
        'Public API key in the widget URL; production go-live also needs a signing key pair.',
      feeCopy:
        'Business plans from $199/month (third-party figure); provider quotes apply per purchase (indicative only).',
      readiness: buyProviderReadiness('onramper'),
      setupCopy:
        'The owner needs an Onramper account and API key; go-live also needs a signing key pair and a $199/month business plan (third-party figure).',
    },
    {
      id: 'banxa',
      name: 'Banxa',
      rank: 4,
      keyCopy: 'No key in the app — only the partner subdomain (partnerRef).',
      feeCopy:
        '1.99% processing on card and Apple Pay buys; 0% on other methods (indicative only — spread and partner settings dominate the all-in cost).',
      readiness: buyProviderReadiness('banxa'),
      setupCopy:
        'The owner needs a Banxa partnerRef (partner subdomain) from Banxa onboarding.',
    },
    {
      id: 'transak',
      name: 'Transak',
      rank: 5,
      keyCopy:
        'API key plus an API secret that must stay server-side.',
      feeCopy:
        'Card 3.99% + $1; bank transfer 2% + $1 (indicative only; November 2026 figures — re-check at integration time).',
      readiness: buyProviderReadiness('transak'),
      setupCopy:
        'Transak needs a backend: the widget URL is minted server-side with the API secret (since the 2026-11-16 migration there is no client-side path).',
    },
    {
      id: 'mercuryo',
      name: 'Mercuryo',
      rank: 6,
      keyCopy:
        'Widget ID (widget_id) in the app; the widget secret stays server-side.',
      feeCopy: 'Up to 5.5% by card; up to 3% by bank transfer (indicative only).',
      readiness: buyProviderReadiness('mercuryo'),
      setupCopy:
        'The owner needs a Mercuryo widget (dashboard access via an integration manager) and its widget ID.',
    },
    {
      id: 'coinbase',
      name: 'Coinbase',
      rank: 7,
      keyCopy:
        'Public project ID in the app; a session token minted server-side with CDP keys is needed for secure initialisation.',
      feeCopy: 'About 2.5% by card (third-party figure; indicative only).',
      readiness: buyProviderReadiness('coinbase'),
      setupCopy:
        'Buying needs Coinbase Onramp onboarding and API keys, which aren’t configured yet.',
    },
  ];
}
