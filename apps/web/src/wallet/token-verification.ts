/**
 * Token verification by contract address (token-verify Lane A,
 * 2026-11-24) — the way the real swaps do it.
 *
 * A token is verified by MEMBERSHIP in a trusted list, checked by
 * exact chain + contract — never by name or symbol, which fakes copy.
 * Every leg is fail-closed: a fetch that fails, rate-limits or
 * returns an unexpected shape is skipped, never treated as verified.
 * Lists are fetched at most once per page load (module-level caches);
 * a list that changes is picked up on the next load, never from a
 * stale local copy.
 *
 * The model, per swap (researched first-hand 2026-11-24):
 *
 * - Jupiter Strict (Solana): the Strict list is the tokens tagged
 *   "wormhole", "original-registry" or "community" in Jupiter's All
 *   list (jup-ag/token-list, README-developers.md). The live Token
 *   List API (tokens.jup.ag) is DNS-unreachable from this egress and
 *   its successor (api.jup.ag/tokens/v2) needs an API key, so the
 *   implemented check is membership in the published community list,
 *   validated-tokens.csv, fetched live from the repo — BONK is in it,
 *   a copycat mint is not. The CSV was last updated 2025-04-21
 *   (Jupiter moved verification to VRFD), so it only ever ADDS
 *   verification for older community-validated tokens; a newer
 *   memecoin is verified by CoinGecko or 1inch instead. Jupiter's
 *   banned-tokens.csv is checked first: a banned mint is REFUSED,
 *   never verified.
 * - Uniswap Default (EVM): the token-lists specification
 *   (Uniswap/token-lists) — a JSON list validated against the schema,
 *   identity is chainId + address. The published list
 *   (tokens.uniswap.org, "Uniswap Labs Default" v22.34.0, 2,176
 *   tokens, 2026-11-19) is fetched live and searched by chainId +
 *   address. (The Uniswap web app itself now verifies via a backend
 *   safetyLevel, not the list — the list is the client-checkable
 *   half of that model, and the one this wallet can implement
 *   without a backend.)
 * - 1inch (EVM): the 1inch token list, served address-keyed per
 *   chain at tokens.1inch.io/v1.2/{chainId} — one small fetch per
 *   chain, no key. Only the chains 1inch actually serves are queried
 *   (verified live 2026-11-24: 1, 10, 56, 100, 137, 324, 42161,
 *   43114, 8453, 59144 answer 200; 250, 5000, 534352, 204, 1088,
 *   1313161554, 42220 answer 400). A chain outside that set is
 *   skipped, not fetched.
 * - PancakeSwap (BSC): the PancakeSwap-published lists at
 *   tokens.pancakeswap.finance. The Default list is 13 tokens last
 *   updated 2023-12-26 — too stale to be the source — so the
 *   Extended list (995 tokens) is used; all 13 Default tokens are
 *   in it.
 * - CoinGecko: the contract endpoint for the exact platform +
 *   contract (see resolveTokenCoingeckoId in adapters/token-balances).
 *   It is checked by the Add Token dialog BEFORE these legs, because
 *   it also yields the price id and the token image in one call.
 *   A memecoin with a real CoinGecko listing (BONK, PEPE) is Verified
 *   by that leg alone.
 *
 * NOT verification sources, and why:
 * - Raydium: any token with a pool is listable — no curation gate —
 *   and the full list is 337 MB, unfetchable client-side; the V3
 *   mint endpoint does not filter to the queried mint. Raydium
 *   stays a price/existence source via DexScreener, never a tick.
 * - DexScreener: pair existence + liquidity only; its token profiles
 *   are paid. A pair proves someone made a pool, not that the token
 *   is the real one. Price/existence only, never a tick.
 *
 * Icons (same module, resolveTokenIcon): Trust Wallet Assets first
 * (the pinned commit, blockchains/<dir>/assets/<contract>/logo.png,
 * HEAD-checked), then the CoinGecko token image, then the verifying
 * list's logoURI — but only when its host is already an allowed
 * image origin (see ALLOWED_TOKEN_ICON_HOSTS). No source → null,
 * and the row shows the deliberate link mark, never an invented icon.
 *
 * Read-only throughout. No signing, no broadcast, no funds moved.
 */
import { CHAINS } from './chains';
import type { ChainId } from '../engine/boundary';
import { isRecord } from './guards';
import type { TokenIconSource, VerifiedSource } from './tokens';

/**
 * Trust Wallet Assets commit pin — the SAME pin as
 * TRUST_WALLET_ASSETS_PIN in chains-expanded.ts (verified 2026-11-24,
 * commit e8f61783, "Mark FAKE Anthropic as FAKE (#38836)"). It is
 * spelled out here instead of imported: chains-expanded.ts also
 * carries the 62-chain data table, and importing it would pull that
 * table into the eager bundle for one string. The unit test asserts
 * the two pins stay equal.
 */
export const TRUST_WALLET_ASSETS_PIN = 'e8f61783ac6451fa8b7b1b4f72bf4a9607f6872e';

/** The EVM chain id for a chain, from its CAIP-2 networkId — or null. */
export function evmChainIdFor(chain: ChainId): number | null {
  const networkId = CHAINS[chain]?.networkId;
  if (typeof networkId !== 'string') return null;
  const match = /^eip155:(\d+)$/.exec(networkId);
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * 1inch chain ids that answer 200 on tokens.1inch.io/v1.2/{chainId}
 * (verified live 2026-11-24). Anything else is skipped, not fetched.
 */
export const ONE_INCH_CHAIN_IDS: ReadonlySet<number> = new Set([
  1, 10, 56, 100, 137, 324, 42161, 43114, 8453, 59144,
]);

/**
 * Trust Wallet Assets blockchains/<dir> for token icons
 * (blockchains/<dir>/assets/<contract>/logo.png). Verified against
 * the live blockchains/ listing 2026-11-24: only these chains have
 * an Assets directory at all — the other EVM chains (zora, mode,
 * fraxtal, berachain, worldchain, unichain, ink, abstract, soneium,
 * apechain, velas, taiko, astar, telos, core, songbird, pulsechain,
 * chiliz, flare, hemi, bob, flowevm, immutable, fuse, arbnova,
 * xlayer) have none, and their tokens fall through to the CoinGecko
 * image. Directory corrections where the Bawa key differs from the
 * Trust Wallet directory: kava → kavaevm, sei → seievm, iotex →
 * iotexevm, conflux → cfxevm, etc → classic, zetachain → zetaevm.
 * The xlayer directory (okxchain) is deliberately absent: it is the
 * old OKC chain, not X Layer.
 */
export const TRUST_WALLET_ASSET_DIR_FOR_CHAIN: Partial<Record<ChainId, string>> = {
  eth: 'ethereum',
  bsc: 'smartchain',
  matic: 'polygon',
  arb: 'arbitrum',
  op: 'optimism',
  base: 'base',
  avax: 'avalanchec',
  gnosis: 'xdai',
  celo: 'celo',
  linea: 'linea',
  mantle: 'mantle',
  scroll: 'scroll',
  opbnb: 'opbnb',
  metis: 'metis',
  aurora: 'aurora',
  fantom: 'fantom',
  zksync: 'zksync',
  cronos: 'cronos',
  kava: 'kavaevm',
  filecoin: 'filecoin',
  sei: 'seievm',
  manta: 'manta',
  sonic: 'sonic',
  hyperevm: 'hyperevm',
  monad: 'monad',
  ronin: 'ronin',
  syscoin: 'syscoin',
  theta: 'theta',
  iotex: 'iotexevm',
  boba: 'boba',
  rootstock: 'rootstock',
  xdc: 'xdc',
  etc: 'classic',
  zetachain: 'zetaevm',
  sol: 'solana',
  ton: 'ton',
  trx: 'tron',
};

/**
 * Image origins a token icon may come from. A verifying list's
 * logoURI is used only when its host is in this set — a logoURI on
 * any other host (e.g. Jupiter's arweave.net logo) is skipped, so
 * the CSP img-src list stays tight and no icon ever loads from an
 * unvetted host.
 */
export const ALLOWED_TOKEN_ICON_HOSTS: ReadonlySet<string> = new Set([
  'raw.githubusercontent.com',
  'assets.coingecko.com',
  'coin-images.coingecko.com',
  'tokens.1inch.io',
  'tokens.pancakeswap.finance',
]);

/** Trust Wallet Assets logo URL for a token at the pinned commit. */
export function trustWalletIconUrl(chain: ChainId, contract: string): string | null {
  const dir = TRUST_WALLET_ASSET_DIR_FOR_CHAIN[chain];
  if (dir === undefined) return null;
  return `https://raw.githubusercontent.com/trustwallet/assets/${TRUST_WALLET_ASSETS_PIN}/blockchains/${dir}/assets/${contract}/logo.png`;
}

export interface ListVerificationResult {
  /** True when a trusted list holds this exact chain + contract. */
  verified: boolean;
  /** Which list verified it, or null. */
  source: VerifiedSource | null;
  /** The verifying list's logoURI, when it has one (icon fallback). */
  logoUri: string | null;
}

export interface TokenIconResult {
  iconUrl: string | null;
  iconSource: TokenIconSource | null;
}

type FetchFn = typeof fetch;

/** Fetch JSON, or null on any failure (fail-closed, never throws). */
async function fetchJson(url: string, fetchFn: FetchFn): Promise<unknown> {
  try {
    const response = await fetchFn(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Fetch text, or null on any failure (fail-closed, never throws). */
async function fetchText(url: string, fetchFn: FetchFn): Promise<string | null> {
  try {
    const response = await fetchFn(url, {
      headers: { Accept: 'text/csv' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// --- Session caches (one fetch per list per page load) ------------------
// Each cache holds the in-flight promise, so concurrent adds share
// one request. resetTokenVerificationCaches clears them; it exists
// for the unit tests (fresh fixtures per test), not for the app.

let jupiterValidatedCache: Promise<Map<string, string | null>> | null = null;
let jupiterBannedCache: Promise<Set<string>> | null = null;
let oneInchCache = new Map<number, Promise<Record<string, unknown>>>();
let uniswapCache: Promise<unknown> | null = null;
let pancakeswapCache: Promise<unknown> | null = null;

/** Test-only: clear the session list caches. */
export function resetTokenVerificationCaches(): void {
  jupiterValidatedCache = null;
  jupiterBannedCache = null;
  oneInchCache = new Map();
  uniswapCache = null;
  pancakeswapCache = null;
}

const JUPITER_VALIDATED_CSV_URL =
  'https://raw.githubusercontent.com/jup-ag/token-list/main/validated-tokens.csv';
const JUPITER_BANNED_CSV_URL =
  'https://raw.githubusercontent.com/jup-ag/token-list/main/banned-tokens.csv';

/**
 * Jupiter Strict, community list: mint → logoURI (or null when the
 * row has none). The CSV is Name,Symbol,Mint,Decimals,LogoURI,
 * Community Validated. The parse does not trust column positions —
 * a token name can contain a comma — it finds the mint-shaped field
 * (32–44 base58 chars) and the http(s) field on each line instead.
 */
async function jupiterValidatedTokens(fetchFn: FetchFn): Promise<Map<string, string | null>> {
  if (jupiterValidatedCache === null) {
    jupiterValidatedCache = (async () => {
      const text = await fetchText(JUPITER_VALIDATED_CSV_URL, fetchFn);
      const byMint = new Map<string, string | null>();
      if (text === null) return byMint;
      for (const line of text.split('\n')) {
        const cells = line.split(',');
        const mint = cells.find((cell) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cell.trim()));
        if (mint === undefined) continue;
        const logoUri = cells.find((cell) => /^https?:\/\//.test(cell.trim()));
        byMint.set(
          mint.trim(),
          logoUri !== undefined && logoUri.trim() !== '' ? logoUri.trim() : null,
        );
      }
      return byMint;
    })();
  }
  return jupiterValidatedCache;
}

/** Jupiter banned mints: the CSV is Mint,Reasons — the first field. */
async function jupiterBannedTokens(fetchFn: FetchFn): Promise<Set<string>> {
  if (jupiterBannedCache === null) {
    jupiterBannedCache = (async () => {
      const text = await fetchText(JUPITER_BANNED_CSV_URL, fetchFn);
      const banned = new Set<string>();
      if (text === null) return banned;
      for (const line of text.split('\n')) {
        const mint = line.split(',')[0]?.trim();
        if (mint !== undefined && mint !== '' && mint !== 'Mint') banned.add(mint);
      }
      return banned;
    })();
  }
  return jupiterBannedCache;
}

/**
 * True when this Solana mint is on Jupiter's banned list. A banned
 * token is refused by the Add Token dialog, never verified. Non-
 * Solana chains are never banned (the list is mints only).
 */
export async function isBannedToken(input: {
  chain: ChainId;
  contract: string;
  fetchFn?: FetchFn;
}): Promise<boolean> {
  if (input.chain !== 'sol') return false;
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') return false;
  const banned = await jupiterBannedTokens(fetchFn);
  return banned.has(input.contract);
}

/** 1inch token map for one EVM chain id (address-keyed, lowercase). */
async function oneInchTokens(
  evmChainId: number,
  fetchFn: FetchFn,
): Promise<Record<string, unknown>> {
  const cached = oneInchCache.get(evmChainId);
  if (cached !== undefined) return cached;
  const pending = (async () => {
    const payload = await fetchJson(
      `https://tokens.1inch.io/v1.2/${evmChainId}`,
      fetchFn,
    );
    return isRecord(payload) ? payload : {};
  })();
  oneInchCache.set(evmChainId, pending);
  return pending;
}

/** The Uniswap Labs Default list (token-lists JSON, 2,176 tokens). */
async function uniswapDefaultList(fetchFn: FetchFn): Promise<unknown> {
  if (uniswapCache === null) {
    uniswapCache = fetchJson('https://tokens.uniswap.org', fetchFn);
  }
  return uniswapCache;
}

/** The PancakeSwap Extended list (token-lists JSON, 995 tokens). */
async function pancakeswapExtendedList(fetchFn: FetchFn): Promise<unknown> {
  if (pancakeswapCache === null) {
    pancakeswapCache = fetchJson(
      'https://tokens.pancakeswap.finance/pancakeswap-extended.json',
      fetchFn,
    );
  }
  return pancakeswapCache;
}

/**
 * One token entry from a token-lists JSON blob: { chainId, address,
 * logoURI } when the entry names this exact chain + contract, else
 * null. Identity is chainId + address, lowercased — never name or
 * symbol.
 */
function findInTokenList(
  payload: unknown,
  evmChainId: number,
  contract: string,
): { logoUri: string | null } | null {
  if (!isRecord(payload) || !Array.isArray(payload['tokens'])) return null;
  const wanted = contract.toLowerCase();
  for (const entry of payload['tokens']) {
    if (!isRecord(entry)) continue;
    if (entry['chainId'] !== evmChainId) continue;
    const address = entry['address'];
    if (typeof address !== 'string' || address.toLowerCase() !== wanted) continue;
    const logoUri = entry['logoURI'];
    return {
      logoUri: typeof logoUri === 'string' && logoUri !== '' ? logoUri : null,
    };
  }
  return null;
}

/**
 * The trusted-list legs, in order: Jupiter Strict (Solana), 1inch
 * (EVM chains 1inch serves), Uniswap Default (any EVM chain), then
 * PancakeSwap Extended (BSC). CoinGecko is NOT checked here — the
 * Add Token dialog checks it first, because it also yields the price
 * id and image. A leg that fails is skipped, never verified.
 */
export async function resolveTokenListVerification(input: {
  chain: ChainId;
  contract: string;
  fetchFn?: FetchFn;
}): Promise<ListVerificationResult> {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    return { verified: false, source: null, logoUri: null };
  }
  const { chain, contract } = input;
  // Jupiter Strict — Solana only.
  if (chain === 'sol') {
    const validated = await jupiterValidatedTokens(fetchFn);
    const logoUri = validated.get(contract);
    if (logoUri !== undefined) {
      return { verified: true, source: 'jupiter-strict', logoUri };
    }
  }
  // 1inch + Uniswap + PancakeSwap — EVM chains only.
  const evmChainId = evmChainIdFor(chain);
  if (evmChainId === null) return { verified: false, source: null, logoUri: null };
  if (ONE_INCH_CHAIN_IDS.has(evmChainId)) {
    const tokens = await oneInchTokens(evmChainId, fetchFn);
    const entry = tokens[contract.toLowerCase()];
    if (isRecord(entry)) {
      const logoUri = entry['logoURI'];
      return {
        verified: true,
        source: 'one-inch',
        logoUri: typeof logoUri === 'string' && logoUri !== '' ? logoUri : null,
      };
    }
  }
  const uniswap = await uniswapDefaultList(fetchFn);
  const uniswapMatch = findInTokenList(uniswap, evmChainId, contract);
  if (uniswapMatch !== null) {
    return {
      verified: true,
      source: 'uniswap-default',
      logoUri: uniswapMatch.logoUri,
    };
  }
  if (chain === 'bsc') {
    const pancakeswap = await pancakeswapExtendedList(fetchFn);
    const match = findInTokenList(pancakeswap, 56, contract);
    if (match !== null) {
      return {
        verified: true,
        source: 'pancakeswap',
        logoUri: match.logoUri,
      };
    }
  }
  return { verified: false, source: null, logoUri: null };
}

/**
 * Resolve a token's icon, in order: Trust Wallet Assets (HEAD-checked
 * at the pinned commit), the CoinGecko token image, then the
 * verifying list's logoURI — only when its host is allowed (see
 * ALLOWED_TOKEN_ICON_HOSTS). No source → null, and the row shows the
 * deliberate link mark.
 */
export async function resolveTokenIcon(input: {
  chain: ChainId;
  contract: string;
  /** CoinGecko image.small, when the contract endpoint returned one. */
  coingeckoImage?: string | null;
  /** The verifying list's logoURI, when the token was list-verified. */
  listLogoUri?: string | null;
  fetchFn?: FetchFn;
}): Promise<TokenIconResult> {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const url = trustWalletIconUrl(input.chain, input.contract);
  if (url !== null && typeof fetchFn === 'function') {
    try {
      const response = await fetchFn(url, { method: 'HEAD' });
      if (response.ok) return { iconUrl: url, iconSource: 'trustwallet' };
    } catch {
      // A failed HEAD falls through to the next source.
    }
  }
  if (typeof input.coingeckoImage === 'string' && input.coingeckoImage !== '') {
    return { iconUrl: input.coingeckoImage, iconSource: 'coingecko' };
  }
  if (typeof input.listLogoUri === 'string' && input.listLogoUri !== '') {
    try {
      const host = new URL(input.listLogoUri).hostname;
      if (ALLOWED_TOKEN_ICON_HOSTS.has(host)) {
        return { iconUrl: input.listLogoUri, iconSource: 'token-list' };
      }
    } catch {
      // A malformed logoURI is skipped, never used.
    }
  }
  return { iconUrl: null, iconSource: null };
}
