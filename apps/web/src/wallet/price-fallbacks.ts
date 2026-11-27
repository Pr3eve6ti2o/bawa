/**
 * Native-price fallbacks after CoinGecko (Lane C, finish-the-product,
 * 2026-11-23). CoinGecko stays the first source: usePrices() fetches
 * its batched /simple/price call first, and only the chains whose
 * quote is NOT fresh reach this module (see applyPriceFallbacks).
 * A chain no source prices stays on its CoinGecko entry — expired,
 * error or unavailable — never a guessed price. The row label shows
 * the quote's real source (see asset-rows / asset-detail), never a
 * hardcoded provider.
 *
 * Fallback order per chain (live research, VM probes 2026-11-23):
 *
 * 1. CoinLore (https://api.coinlore.net/api/ticker/?id=...) — one
 *    batched call for every mapped chain. Keyless, no registration,
 *    CORS `access-control-allow-origin: *`, no rate-limit header
 *    observed across ~15 calls. Each mapped quote was cross-checked
 *    against CoinGecko live and agrees within 0.7% (BTC, ETH, BNB,
 *    SOL, TRX, DOGE, AVAX, CELO, METIS). It goes first because it is
 *    one call for many chains and its verified quotes track
 *    CoinGecko tightest; DexScreener's thin pairs wobble (CELO 8.5%,
 *    opBNB 1.4% off CoinGecko live).
 *    Lane B (2026-11-24) adds the three missing chains here:
 *    Mantle MNT id 121595 ($0.400541 live vs CoinGecko $0.400169,
 *    +0.09%); Gnosis xDAI via DAI id 32417 ($1.00) — xDAI is DAI
 *    locked 1:1 in the Gnosis bridge and redeemable for DAI, so the
 *    DAI quote is the xDAI price, the same shape as the ETH-native
 *    chains pricing as ETH; Fantom FTM via Sonic (S) id 148191
 *    ($0.028313 live) — Fantom Opera retired 2026-06-30 and FTM
 *    upgrades 1:1 to S, so S is FTM's redemption value (see the map
 *    note for the evidence and the divergence caveat).
 * 2. DexScreener (tokens/v1/<chain>/<wrapped>) — on-chain price of
 *    the wrapped native, one call per chain. Base-side pair wins
 *    (highest liquidity). Quote-side only: the implied price
 *    priceUsd / priceNative — NOT priceUsd itself, which is the
 *    base token's price (the trap documented in dex-prices.ts).
 *    The implied price is exact arithmetic, and it is validated
 *    live: WFTM implied $0.02973 matched Sonic (S) at $0.029725
 *    on CoinLore the same day (2026-11-23). Lane B (2026-11-24)
 *    adds Mantle WMNT as a base-side pair (Agni WMNT/USDT0,
 *    $0.4010, $2.69M liquidity — the second Mantle leg).
 * 3. TonAPI rates for TON, Coinbase Exchange ticker for LTC — the
 *    two chains CoinLore cannot cover (see the map notes).
 *
 * REJECTED live (do not re-add without fresh evidence):
 * - Binance (api.binance.com): HTTP 451 "Service unavailable from
 *   a restricted location" from this egress — geo-blocked. Its US
 *   endpoint (api.binance.us) answers but quotes FTM at $0.4806
 *   against CoinGecko $0.0254, DexScreener-implied $0.02973 and
 *   Sonic $0.0297 — a frozen pre-delisting quote, ~16x too high.
 * - CoinPaprika: answers keyless and quotes the same frozen FTM
 *   $0.4803 — and its free tier is personal-use only; customer
 *   display needs Enterprise (already rejected in prices.ts).
 * - CoinCodex: its /get_coin/fantom endpoint returns a
 *   "not_trading_anymore" record, not a price.
 * - Kraken: no Access-Control-Allow-Origin header, so a browser
 *   fetch is CORS-blocked (and it has no FTM pair at all).
 * - CoinLore TON ($1.78 live vs CoinGecko/TonAPI $1.015) and
 *   CoinLore MATIC ($0.377 live vs CoinGecko POL $0.0788) are
 *   stale legacy quotes — both are excluded from the map below,
 *   not trusted. CoinLore also lists neither LTC nor FTM in its
 *   top-500 tickers, and no XDAI or MNT quote was found.
 * - Gnosis (xDAI) and Mantle (MNT) are fixed by Lane B
 *   (2026-11-24, see leg 1 and the map notes): CoinLore DAI for
 *   xDAI, CoinLore MNT plus DexScreener WMNT for Mantle.
 * - REJECTED live by Lane B (do not re-add without fresh evidence):
 *   DIA (api.diadata.org) Fantom WFTM $0.0382 — stale (Price ==
 *   PriceYesterday, $0.18 volume) against CoinGecko $0.0252; DIA
 *   Gnosis/Mantle 404. CryptoCompare min-api now requires an API
 *   key (401). ParaSwap /prices has no CORS header and no longer
 *   supports Fantom (250). Bybit and KuCoin geo-block this egress
 *   (403 / 400302). Bitstamp ftmusd returns BTC data, not FTM.
 *   Gemini FTMUSD matches CoinGecko ($0.0252) but has no CORS
 *   header and $32/day volume. CoinCap is DNS-unresolvable from
 *   this egress, so it cannot be verified live here. DexScreener
 *   returns [] for Gnosis WXDAI and GNO, and for Aurora pairs.
 *   Binance US / CoinPaprika FTM ($0.48 frozen), Kraken (no FTM
 *   pair, no CORS) and Coinbase MNT/XDAI/FTM (404) stay rejected.
 *
 * Coverage after this module: 80 of 87 chains have at least one
 * fallback (7 are CoinGecko-only). Fantom — the flagged "Price expired" case — is
 * covered twice: CoinLore Sonic (S) first, then the DexScreener
 * implied price. CoinGecko's `fantom` id was ~8h stale live
 * (last_updated_at 1795417691 vs now 1795446545), so its quote
 * expires and the fallback replaces it with a live price.
 * FTM divergence caveat (live 2026-11-24): CoinGecko FTM
 * $0.0252 vs Sonic (S) $0.0283 vs DexScreener-implied $0.0287 —
 * the Opera market is dead and its last-trade quotes wobble ~13%
 * against the 1:1 redemption value. The fallback shows the
 * redemption value with its real source label; it never invents
 * a price, and the gap is recorded, not hidden.
 *
 * No timestamp comes back from any fallback source, so
 * providerUpdatedAtMs is the fetch time: the quote is fresh for
 * the same 10-minute window as a CoinGecko quote and then expires
 * honestly.
 *
 * Module shape (intentional): this module imports values from
 * prices.ts (PRICE_ASSET_IDS) and dex-prices.ts (fetchJson,
 * fetchTonJettonPrices), and prices.ts imports applyPriceFallbacks
 * from here — a cycle, but a safe one: every cross-module value is
 * read only inside functions invoked after module evaluation
 * (hoisted function declarations on both sides), never at
 * top-level evaluation time. tsc + vitest + vite build verify it.
 */
import { divideToString, parseDecimalString } from './decimal';
import type { ChainId } from '../engine/boundary';
import { isRecord, ownValue } from './guards';
import {
  DEXSCREENER_BASE_URL,
  fetchJson,
  fetchTonJettonPrices,
} from './dex-prices';
import {
  buildFreshQuote,
  liquidityUsd,
  sameTokenAddress,
  validUsdPrice,
} from './price-helpers';
import {
  PRICE_ASSET_IDS,
  type PriceEntry,
  type PriceMap,
  type PriceSource,
} from './prices';

const COINLORE_BASE_URL = 'https://api.coinlore.net';
const COINBASE_BASE_URL = 'https://api.exchange.coinbase.com';

/**
 * Native asset -> CoinLore coin id. ETH-native chains (Arbitrum,
 * Optimism, Base, Linea, Scroll, Aurora) price as ETH — never as
 * their governance tokens (ARB, OP) — and opBNB prices as BNB.
 * Every mapped id was verified live 2026-11-23 (see the module
 * note for the two excluded stale quotes and the two absent coins),
 * except the three Lane B rows below, verified live 2026-11-24:
 * gnosis prices as DAI (id 32417, $1.00) — xDAI is DAI locked 1:1
 * in the Gnosis bridge, redeemable for DAI, so the DAI quote is
 * the xDAI price; mantle is MNT (id 121595, $0.400541 live vs
 * CoinGecko $0.400169, +0.09%); fantom prices as Sonic (S)
 * (id 148191, $0.028313 live) — Fantom Opera retired 2026-06-30,
 * FTM upgrades 1:1 to S with no end date announced for the
 * ERC-20 route, and no deep FTM market remains (OKX delisted the
 * FTM-USDT instrument, Coinbase has no FTM-USD product, Kraken
 * has no FTM pair), so S is FTM's redemption value. Caveat: the
 * dead Opera market's last-trade quotes sit ~13% below S
 * (CoinGecko FTM $0.0252 live 2026-11-24) — the fallback shows
 * the redemption value under its real CoinLore label.
 */
export const COINLORE_NATIVE_IDS: Partial<Record<ChainId, string>> = {
  btc: '90',
  eth: '80',
  arb: '80',
  op: '80',
  base: '80',
  linea: '80',
  scroll: '80',
  aurora: '80',
  bsc: '2710',
  opbnb: '2710',
  sol: '48543',
  trx: '2713',
  doge: '2',
  avax: '44883',
  celo: '44425',
  metis: '49563',
  gnosis: '32417',
  mantle: '121595',
  fantom: '148191',
  zksync: '80',
  cronos: '33819',
  kava: '64675',
  filecoin: '32607',
  zora: '80',
  mode: '80',
  berachain: '150197',
  sei: '100427',
  arbnova: '80',
  worldchain: '80',
  manta: '80',
  unichain: '80',
  ink: '80',
  abstract: '80',
  soneium: '80',
  apechain: '45930',
  sonic: '148191',
  hyperevm: '148109',
  ronin: '64703',
  immutable: '121593',
  fuse: '44502',
  syscoin: '41',
  theta: '33768',
  iotex: '32719',
  xlayer: '33531',
  boba: '80',
  taiko: '80',
  astar: '62661',
  conflux: '121599',
  core: '120829',
  chiliz: '34391',
  etc: '118',
  flare: '84965',
  hemi: '80',
  bob: '80',
  flowevm: '48589',
  cosmos: '33830',
  osmosis: '64669',
  xrp: '58',
  stellar: '89',
  polkadot: '45219',
  near: '48563',
  aptos: '111341',
  tezos: '3682',
  algorand: '34406',
  hedera: '48555',
  injective: '46183',
  celestia: '136105',
  dydx: '54377',
  seicosmos: '100427',
  axelar: '99333',
  noble: '33285',
  juno: '56297',
  cardano: '257',
  kaspa: '70485',
  starknet: '136109',
};

/**
 * Wrapped native token per chain for the DexScreener leg. Each
 * contract was verified live 2026-11-23 via tokens/v1 returning a
 * pair for it (see the module note): bsc WBNB $572.32, matic
 * WPOL $0.07889 (the contract reports symbol WPOL since the
 * MATIC->POL migration; CoinGecko POL $0.07882), arb/op/base/
 * scroll WETH ~$1,775-1,781, avax WAVAX $7.025, sol WSOL $75.98,
 * celo CELO $0.05273 (thin, $71k liquidity — last resort only),
 *    opbnb WBNB quote-side implied $579.82, fantom WFTM quote-side
 *    implied $0.02973, mantle WMNT base-side $0.4010 (Agni
 *    WMNT/USDT0, $2.69M liquidity, live 2026-11-24).
 *
 * Linea and Aurora return [] from tokens/v1 for WETH (live), so
 * they have no DexScreener leg. TRX has no verified WTRX contract
 * on file; Metis has no verified wrapped contract. Gnosis returns
 * [] from tokens/v1 for WXDAI and GNO (live 2026-11-24), so it
 * has no DexScreener leg — CoinLore (DAI) covers it instead.
 */
export const NATIVE_WRAPPED_TOKENS: Partial<
  Record<ChainId, { dexChain: string; contract: string }>
> = {
  eth: {
    dexChain: 'ethereum',
    contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  bsc: {
    dexChain: 'bsc',
    contract: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },
  matic: {
    dexChain: 'polygon',
    contract: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  },
  arb: {
    dexChain: 'arbitrum',
    contract: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  op: {
    dexChain: 'optimism',
    contract: '0x4200000000000000000000000000000000000006',
  },
  base: {
    dexChain: 'base',
    contract: '0x4200000000000000000000000000000000000006',
  },
  avax: {
    dexChain: 'avalanche',
    contract: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  },
  sol: {
    dexChain: 'solana',
    contract: 'So11111111111111111111111111111111111111112',
  },
  celo: {
    dexChain: 'celo',
    contract: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  },
  scroll: {
    dexChain: 'scroll',
    contract: '0x5300000000000000000000000000000000000004',
  },
  opbnb: {
    dexChain: 'opbnb',
    contract: '0x4200000000000000000000000000000000000006',
  },
  mantle: {
    dexChain: 'mantle',
    contract: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
  },
  fantom: {
    dexChain: 'fantom',
    contract: '0x21be370d5312f44cB42ce377BC9b8a0cEF1A4C83',
  },
};

/** Coinbase product id per chain (Lane 80-APP, 2026-11-24: the 44 expanded chains with a Coinbase product join LTC — TonAPI covers TON and DexScreener covers Polygon, the other chains CoinLore misses). */
const COINBASE_PRODUCT_IDS: Partial<Record<ChainId, string>> = {
  ltc: 'LTC-USD',
  zksync: 'ETH-USD',
  cronos: 'CRO-USD',
  kava: 'KAVA-USD',
  filecoin: 'FIL-USD',
  zora: 'ETH-USD',
  mode: 'ETH-USD',
  berachain: 'BERA-USD',
  sei: 'SEI-USD',
  arbnova: 'ETH-USD',
  worldchain: 'ETH-USD',
  manta: 'ETH-USD',
  unichain: 'ETH-USD',
  ink: 'ETH-USD',
  abstract: 'ETH-USD',
  soneium: 'ETH-USD',
  apechain: 'APE-USD',
  sonic: 'S-USD',
  hyperevm: 'HYPE-USD',
  monad: 'MON-USD',
  immutable: 'IMX-USD',
  iotex: 'IOTX-USD',
  boba: 'ETH-USD',
  taiko: 'ETH-USD',
  chiliz: 'CHZ-USD',
  etc: 'ETC-USD',
  flare: 'FLR-USD',
  zetachain: 'ZETA-USD',
  hemi: 'ETH-USD',
  bob: 'ETH-USD',
  flowevm: 'FLOW-USD',
  cosmos: 'ATOM-USD',
  osmosis: 'OSMO-USD',
  xrp: 'XRP-USD',
  stellar: 'XLM-USD',
  polkadot: 'DOT-USD',
  near: 'NEAR-USD',
  aptos: 'APT-USD',
  tezos: 'XTZ-USD',
  algorand: 'ALGO-USD',
  hedera: 'HBAR-USD',
  injective: 'INJ-USD',
  celestia: 'TIA-USD',
  seicosmos: 'SEI-USD',
  axelar: 'AXL-USD',
  cardano: 'ADA-USD',
  starknet: 'STRK-USD',
};

/**
 * The price sources the wallet tries, in order, for one chain
 * (Lane F, FIX-ALL, 2026-11-24). CoinGecko is always first; CoinLore
 * second where it has the chain (75 chains); DexScreener third where a
 * wrapped contract is verified (13 chains); TonAPI for TON, Coinbase
 * where it has the chain (47 chains), and DexScreener for Polygon —
 * the chains CoinLore cannot cover. 80 of 87 chains have a verified
 * second source (FIX-ALL Lane B added CoinLore for Gnosis, Mantle
 * and Fantom; Lane 80-APP, 2026-11-24, added the expanded chains).
 * Seven are CoinGecko-alone — Fraxtal, Velas, Telos, Songbird,
 * Rootstock, PulseChain and XDC: no CoinLore id, no Coinbase product
 * and no verified DexScreener leg answers for them. (Telos and
 * PulseChain have DexScreener chain slugs for token lookups, but no
 * verified wrapped-native contract, so no native-price leg.) The
 * Networks screen's Prices
 * card states the same order in words; keep the two in step when
 * the maps change.
 */
export function priceFallbackSourcesFor(chain: ChainId): PriceSource[] {
  const sources: PriceSource[] = ['CoinGecko'];
  if (COINLORE_NATIVE_IDS[chain] !== undefined) sources.push('CoinLore');
  if (NATIVE_WRAPPED_TOKENS[chain] !== undefined) {
    sources.push('DexScreener');
  }
  if (chain === 'ton') sources.push('TonAPI');
  if (COINBASE_PRODUCT_IDS[chain] !== undefined) sources.push('Coinbase');
  return sources;
}

export function parseCoinLoreResponse(
  payload: unknown,
  chains: readonly ChainId[],
  nowMs: number,
): Partial<Record<ChainId, PriceEntry>> {
  const entries: Partial<Record<ChainId, PriceEntry>> = {};
  if (!Array.isArray(payload)) {
    for (const chain of chains) {
      entries[chain] = { status: 'error', reason: 'provider' };
    }
    return entries;
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const value of payload as unknown[]) {
    if (!isRecord(value)) continue;
    const id = ownValue(value, 'id');
    if (typeof id === 'string') byId.set(id, value);
  }

  for (const chain of chains) {
    const id = COINLORE_NATIVE_IDS[chain];
    if (id === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const coin = byId.get(id);
    if (coin === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const raw = ownValue(coin, 'price_usd');
    if (raw === undefined) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
      continue;
    }
    const price = validUsdPrice(raw);
    if (price === null) {
      entries[chain] = { status: 'unavailable', reason: 'invalid-price' };
      continue;
    }
    entries[chain] = buildFreshQuote(chain, PRICE_ASSET_IDS[chain], id, price, 'CoinLore', nowMs);
  }
  return entries;
}

/**
 * DexScreener native price: the wrapped token's pair. Base-side
 * wins (priceUsd IS the wrapped token's price). Quote-side only:
 * the implied price priceUsd / priceNative — the base token's USD
 * price divided by its price in wrapped-token units. That is exact
 * division, not the trap of reading priceUsd as the queried
 * token's price (see the module note for the live WFTM proof).
 * No pair involving the token at all stays "unavailable".
 */
export function parseDexScreenerNativeResponse(
  payload: unknown,
  chain: ChainId,
  contract: string,
  nowMs: number,
): PriceEntry {
  if (!Array.isArray(payload)) {
    return { status: 'error', reason: 'provider' };
  }
  const wrapped = NATIVE_WRAPPED_TOKENS[chain];
  if (wrapped === undefined || !sameTokenAddress(wrapped.contract, contract)) {
    return { status: 'unavailable', reason: 'missing' };
  }

  let bestBase: { price: string; liquidity: number } | null = null;
  let bestQuote: { price: string; liquidity: number } | null = null;
  for (const value of payload as unknown[]) {
    if (!isRecord(value)) continue;
    if (ownValue(value, 'chainId') !== wrapped.dexChain) continue;
    const liquidity = liquidityUsd(value);
    const baseToken = ownValue(value, 'baseToken');
    if (isRecord(baseToken)) {
      const baseAddress = ownValue(baseToken, 'address');
      if (
        typeof baseAddress === 'string' &&
        sameTokenAddress(baseAddress, contract)
      ) {
        const price = validUsdPrice(ownValue(value, 'priceUsd'));
        if (price !== null && (bestBase === null || liquidity > bestBase.liquidity)) {
          bestBase = { price, liquidity };
        }
        continue;
      }
    }
    const quoteToken = ownValue(value, 'quoteToken');
    if (!isRecord(quoteToken)) continue;
    const quoteAddress = ownValue(quoteToken, 'address');
    if (typeof quoteAddress !== 'string') continue;
    if (!sameTokenAddress(quoteAddress, contract)) continue;
    const basePrice = ownValue(value, 'priceUsd');
    const priceNative = ownValue(value, 'priceNative');
    if (
      (typeof basePrice !== 'number' && typeof basePrice !== 'string') ||
      (typeof priceNative !== 'number' && typeof priceNative !== 'string')
    ) {
      continue;
    }
    let implied: string | null = null;
    try {
      // Exact BigInt division at Decimal's default 20 significant
      // digits; null when the ratio is not a finite positive number.
      implied = divideToString(
        parseDecimalString(String(basePrice)),
        parseDecimalString(String(priceNative)),
      );
    } catch {
      implied = null;
    }
    if (implied === null) continue;
    if (bestQuote === null || liquidity > bestQuote.liquidity) {
      bestQuote = { price: implied, liquidity };
    }
  }

  if (bestBase !== null) {
    return buildFreshQuote(chain, PRICE_ASSET_IDS[chain], contract, bestBase.price, 'DexScreener', nowMs);
  }
  if (bestQuote !== null) {
    return buildFreshQuote(chain, PRICE_ASSET_IDS[chain], contract, bestQuote.price, 'DexScreener', nowMs);
  }
  // A quote-side pair existed but its numbers were unusable (e.g.
  // priceNative 0): an invalid price, not a missing pair.
  const sawQuoteSide = (payload as unknown[]).some((value) => {
    if (!isRecord(value)) return false;
    if (ownValue(value, 'chainId') !== wrapped.dexChain) return false;
    const quoteToken = ownValue(value, 'quoteToken');
    if (!isRecord(quoteToken)) return false;
    const quoteAddress = ownValue(quoteToken, 'address');
    return typeof quoteAddress === 'string' && sameTokenAddress(quoteAddress, contract);
  });
  return {
    status: 'unavailable',
    reason: sawQuoteSide ? 'invalid-price' : 'missing',
  };
}

/** Coinbase Exchange ticker: {"price": "42.956", ...} — LTC only. */
export function parseCoinbaseResponse(
  payload: unknown,
  chain: ChainId,
  nowMs: number,
): PriceEntry {
  const productId = COINBASE_PRODUCT_IDS[chain];
  if (productId === undefined) {
    return { status: 'unavailable', reason: 'missing' };
  }
  if (!isRecord(payload)) {
    return { status: 'error', reason: 'provider' };
  }
  const raw = ownValue(payload, 'price');
  if (raw === undefined) {
    return { status: 'unavailable', reason: 'missing' };
  }
  const price = validUsdPrice(raw);
  if (price === null) {
    return { status: 'unavailable', reason: 'invalid-price' };
  }
  return buildFreshQuote(chain, PRICE_ASSET_IDS[chain], productId, price, 'Coinbase', nowMs);
}

type FetchFn = typeof fetch;

export async function fetchCoinLorePrices(
  fetchFn: FetchFn,
  chains: readonly ChainId[],
  nowMs?: number,
): Promise<Partial<Record<ChainId, PriceEntry>>> {
  const resolvedNowMs = nowMs ?? Date.now();
  const ids: string[] = [];
  for (const chain of chains) {
    const id = COINLORE_NATIVE_IDS[chain];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) {
    const entries: Partial<Record<ChainId, PriceEntry>> = {};
    for (const chain of chains) {
      entries[chain] = { status: 'unavailable', reason: 'missing' };
    }
    return entries;
  }
  const result = await fetchJson(
    fetchFn,
    `${COINLORE_BASE_URL}/api/ticker/?id=${ids.join(',')}`,
  );
  if (result.status === 'error') {
    const entries: Partial<Record<ChainId, PriceEntry>> = {};
    for (const chain of chains) {
      entries[chain] = { ...result.entries };
    }
    return entries;
  }
  return parseCoinLoreResponse(result.payload, chains, resolvedNowMs);
}

export async function fetchDexScreenerNativePrices(
  fetchFn: FetchFn,
  chains: readonly ChainId[],
  nowMs?: number,
): Promise<Partial<Record<ChainId, PriceEntry>>> {
  const resolvedNowMs = nowMs ?? Date.now();
  const merged: Partial<Record<ChainId, PriceEntry>> = {};
  await Promise.all(
    chains.map(async (chain) => {
      const wrapped = NATIVE_WRAPPED_TOKENS[chain];
      if (wrapped === undefined) {
        merged[chain] = { status: 'unavailable', reason: 'missing' };
        return;
      }
      const result = await fetchJson(
        fetchFn,
        `${DEXSCREENER_BASE_URL}/tokens/v1/${wrapped.dexChain}/${wrapped.contract}`,
      );
      merged[chain] =
        result.status === 'error'
          ? { ...result.entries }
          : parseDexScreenerNativeResponse(
              result.payload,
              chain,
              wrapped.contract,
              resolvedNowMs,
            );
    }),
  );
  return merged;
}

export async function fetchCoinbaseLtcPrice(
  fetchFn: FetchFn,
  nowMs?: number,
): Promise<PriceEntry> {
  const resolvedNowMs = nowMs ?? Date.now();
  const result = await fetchJson(
    fetchFn,
    `${COINBASE_BASE_URL}/products/LTC-USD/ticker`,
  );
  if (result.status === 'error') {
    return { ...result.entries };
  }
  return parseCoinbaseResponse(result.payload, 'ltc', resolvedNowMs);
}

/**
 * Fill the gaps in a CoinGecko price map from the fallbacks, in
 * the order the live research justifies: CoinLore batch first,
 * then DexScreener per wrapped native, then TonAPI for TON and
 * Coinbase for LTC. A chain whose CoinGecko quote is already
 * fresh is never re-fetched. A chain no fallback prices keeps its
 * original CoinGecko entry — the honest expired/error/
 * unavailable state, never an invented price. One provider's
 * failure never blocks the others: each leg is caught and the
 * merge continues with the chains it did price.
 */
export async function applyPriceFallbacks(
  fetchFn: FetchFn,
  cgEntries: PriceMap,
  nowMs?: number,
): Promise<PriceMap> {
  const resolvedNowMs = nowMs ?? Date.now();
  const merged: PriceMap = { ...cgEntries };
  const isFresh = (chain: ChainId): boolean =>
    merged[chain]?.status === 'fresh';

  const needing = (Object.keys(merged) as ChainId[]).filter(
    (chain) => !isFresh(chain),
  );
  if (needing.length === 0) return merged;

  const takeFresh = (
    chain: ChainId,
    entry: PriceEntry | undefined,
  ): void => {
    if (entry?.status === 'fresh') merged[chain] = entry;
  };

  try {
    const coinLoreChains = needing.filter(
      (chain) => COINLORE_NATIVE_IDS[chain] !== undefined,
    );
    if (coinLoreChains.length > 0) {
      const entries = await fetchCoinLorePrices(
        fetchFn,
        coinLoreChains,
        resolvedNowMs,
      );
      for (const chain of coinLoreChains) takeFresh(chain, entries[chain]);
    }
  } catch {
    // CoinLore down: the DexScreener leg still runs below.
  }

  try {
    const dexChains = (Object.keys(merged) as ChainId[]).filter(
      (chain) => !isFresh(chain) && NATIVE_WRAPPED_TOKENS[chain] !== undefined,
    );
    if (dexChains.length > 0) {
      const entries = await fetchDexScreenerNativePrices(
        fetchFn,
        dexChains,
        resolvedNowMs,
      );
      for (const chain of dexChains) takeFresh(chain, entries[chain]);
    }
  } catch {
    // DexScreener down: TON/LTC legs still run below.
  }

  if (!isFresh('ton')) {
    try {
      const entries = await fetchTonJettonPrices(
        fetchFn,
        [{ key: 'ton', contract: 'TON' }],
        resolvedNowMs,
      );
      takeFresh('ton', entries['ton']);
    } catch {
      // TonAPI down: keep the CoinGecko entry for TON.
    }
  }

  if (!isFresh('ltc')) {
    try {
      takeFresh('ltc', await fetchCoinbaseLtcPrice(fetchFn, resolvedNowMs));
    } catch {
      // Coinbase down: keep the CoinGecko entry for LTC.
    }
  }

  return merged;
}
