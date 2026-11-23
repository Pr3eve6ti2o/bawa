/**
 * Token identity and the default token list (token discovery).
 *
 * A token is identified by network + contract, never by symbol alone
 * (docs/12). The 21 default tokens below are the token half of the
 * default list (22 natives + 21 tokens = 43 rows); the natives come
 * from the chain registry (CHAINS). Contracts were verified twice:
 * in-repo (apps/web/README.md "Token logos") and live against
 * CoinGecko (2026-11-22 for the first 8, 2026-11-23 for the 13
 * item-18 primaries). Balances are never stored here — only the
 * identity and the CoinGecko id used to price the row.
 */
import { getAddress, hexToBytes, isAddress, sha256 } from 'viem';
import type { ChainId } from '../engine/boundary';
import { SUPPORTED_CHAINS } from './chains';

export interface TokenRecord {
  chain: ChainId;
  /** Canonical case: checksummed for EVM, base58 for TRON. */
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  /** CoinGecko id, or null when the token is unknown to CoinGecko (its
   * price then shows "Price unavailable" — never a guessed price). */
  coingeckoId: string | null;
  /** Epoch ms the token was added (0 for the built-in defaults). */
  addedAtMs: number;
}

export const DEFAULT_TOKENS: TokenRecord[] = [
  {
    chain: 'eth',
    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    coingeckoId: 'tether',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    decimals: 18,
    coingeckoId: 'dai',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    name: 'ChainLink Token',
    symbol: 'LINK',
    decimals: 18,
    coingeckoId: 'chainlink',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    name: 'Uniswap',
    symbol: 'UNI',
    decimals: 18,
    coingeckoId: 'uniswap',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    name: 'Wrapped BTC',
    symbol: 'WBTC',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
    addedAtMs: 0,
  },
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
    // Token #21 (token gaps): Base USDC — contract, decimals and
    // CoinGecko id verified live 2026-11-22 against the CoinGecko Base
    // contract endpoint (id usd-coin, decimals 6) and the Base explorer.
    chain: 'base',
    contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  // Thirteen more primaries (UI/UX fixes, item 18): primary tokens on
  // more chains. Every contract, name, symbol and decimals below was
  // verified live 2026-11-23 — on-chain via eth_call on the chain's
  // pinned RPC (Solana RPC + TonAPI for SPL/Jetton) and against the
  // CoinGecko contract endpoint for the exact platform + contract.
  // The CoinGecko id is the contract-specific one: bridged variants
  // have their own ids (e.g. Optimism USDT is 'bridged-usdt', BSC
  // USDT is 'binance-bridged-usdt-bnb-smart-chain'), not 'tether'.
  // On-chain quirks are recorded honestly: Arbitrum USDT0 reports
  // symbol 'USD₮0'; Avalanche USDT reports name 'TetherToken' and
  // symbol 'USDt'; BSC USDT has 18 decimals.
  {
    chain: 'sol',
    contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'ton',
    contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    name: 'Tether USD',
    symbol: 'USD₮',
    decimals: 6,
    coingeckoId: 'tether',
    addedAtMs: 0,
  },
  {
    chain: 'eth',
    contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    coingeckoId: 'weth',
    addedAtMs: 0,
  },
  {
    chain: 'matic',
    contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'matic',
    contract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    name: 'USDT0',
    symbol: 'USDT0',
    decimals: 6,
    coingeckoId: 'usdt0',
    addedAtMs: 0,
  },
  {
    chain: 'arb',
    contract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'arb',
    contract: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    name: 'USD₮0',
    symbol: 'USD₮0',
    decimals: 6,
    coingeckoId: 'usdt0',
    addedAtMs: 0,
  },
  {
    chain: 'op',
    contract: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'op',
    contract: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    coingeckoId: 'bridged-usdt',
    addedAtMs: 0,
  },
  {
    chain: 'base',
    contract: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    coingeckoId: 'l2-standard-bridged-usdt-base',
    addedAtMs: 0,
  },
  {
    chain: 'avax',
    contract: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
  },
  {
    chain: 'avax',
    contract: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    name: 'TetherToken',
    symbol: 'USDt',
    decimals: 6,
    coingeckoId: 'tether',
    addedAtMs: 0,
  },
  {
    chain: 'bsc',
    contract: '0x55d398326f99059fF775485246999027B3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    coingeckoId: 'binance-bridged-usdt-bnb-smart-chain',
    addedAtMs: 0,
  },
];

/** Identity key: `${chain}:${contract}` — contract lowercased, TRON included. */
export function tokenKey(chain: ChainId, contract: string): string {
  // TRON base58 is case-sensitive, so two distinct addresses could in
  // principle differ only by case — but a case-variant of a valid
  // base58check address fails its checksum (1-in-2^32 to pass), so
  // lowercasing is safe for a lookup key and makes duplicate detection
  // case-insensitive. The record's contract keeps its original case.
  return `${chain}:${contract.toLowerCase()}`;
}

export function tokenKeyOf(record: TokenRecord): string {
  return tokenKey(record.chain, record.contract);
}

/** True when the record is one of the 21 verified default tokens. */
export function isDefaultToken(record: TokenRecord): boolean {
  const key = tokenKeyOf(record);
  return DEFAULT_TOKENS.some((candidate) => tokenKeyOf(candidate) === key);
}

/**
 * Verified-tick rule (token gaps, item 2). A token is official — and
 * gets the VERIFIED tick — when it is one of the curated in-repo
 * defaults (verified twice: in-repo + live CoinGecko) or when its
 * contract resolved to a real CoinGecko listing at add time
 * (coingeckoId set by the contract endpoint for that exact chain +
 * contract). A user-added token by raw contract with no CoinGecko
 * listing gets no tick. Pattern: Uniswap token-lists (membership in a
 * curated list is the verification; identity is chainId + address)
 * and Trust Wallet assets (a reviewed listing with logo + info.json
 * is the verification).
 */
export function isVerifiedToken(record: TokenRecord): boolean {
  return isDefaultToken(record) || record.coingeckoId !== null;
}

/**
 * Short contract display: first 6 characters + ellipsis + last 4
 * (e.g. 0xA0b8…eB48, TR7NHq…Lj6t). Values already that short are
 * returned unchanged.
 */
export function shortContract(contract: string): string {
  if (contract.length <= 12) return contract;
  return `${contract.slice(0, 6)}…${contract.slice(-4)}`;
}

/**
 * Resolve tokens by ticker or name against the in-repo registry
 * (defaults + user-added). Exact symbol matches come first, then exact
 * name, then partial symbol/name — all case-insensitive. A query that
 * resolves to nothing returns an empty list: the caller must say so
 * honestly and never invent a token. (Remote ticker/name resolution
 * lives in token-search.ts, which queries CoinGecko; this function is
 * the local half.)
 */
export function resolveTokenByTickerOrName(
  query: string,
  tokens: readonly TokenRecord[],
): TokenRecord[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const exactSymbol: TokenRecord[] = [];
  const exactName: TokenRecord[] = [];
  const partial: TokenRecord[] = [];
  for (const token of tokens) {
    const symbol = token.symbol.toLowerCase();
    const name = token.name.toLowerCase();
    if (symbol === needle) exactSymbol.push(token);
    else if (name === needle) exactName.push(token);
    else if (symbol.includes(needle) || name.includes(needle)) partial.push(token);
  }
  return [...exactSymbol, ...exactName, ...partial];
}

/**
 * URL slug for a token's detail route (/assets/:chain/:slug). Defaults
 * are identified by symbol (stable, readable); user-added tokens by
 * contract (unique). The detail screen resolves by slug + chain, so a
 * lowercase contract in the URL still finds the record.
 */
export function tokenSlug(record: TokenRecord): string {
  return isDefaultToken(record)
    ? record.symbol.toLowerCase()
    : record.contract.toLowerCase();
}

/** Chains that can hold an ERC-20 token by contract address. */
export const EVM_TOKEN_CHAINS: readonly ChainId[] = [
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
];

export type TokenStandard =
  | { standard: 'erc20' }
  | { standard: 'trc20' }
  | { standard: 'spl' }
  | { standard: 'jetton' }
  | { standard: null; reason: string };

/**
 * What kind of token a chain can hold. Solana SPL tokens verify through
 * the Solana RPC (mint account + Metaplex metadata + token accounts) and
 * TON Jettons through TonAPI (UI/UX fixes, item 13). BTC/LTC/DOGE have
 * no token standard at all.
 */
export function tokenStandardFor(chain: ChainId): TokenStandard {
  if (EVM_TOKEN_CHAINS.includes(chain)) return { standard: 'erc20' };
  if (chain === 'trx') return { standard: 'trc20' };
  if (chain === 'ton') return { standard: 'jetton' };
  if (chain === 'sol') return { standard: 'spl' };
  return { standard: null, reason: 'Native coin only' };
}

export type AddressValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * EVM contract format + checksum (viem getAddress). A lowercase or
 * uppercase address is accepted and checksummed; a mixed-case address
 * with a bad checksum is rejected.
 */
export function validateEvmContractAddress(address: string): AddressValidation {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return {
      ok: false,
      error: 'Enter a 40-character contract address starting with 0x',
    };
  }
  // isAddress is the checksum validator: getAddress silently
  // re-checksums a mixed-case address instead of rejecting it, so it
  // cannot be used to detect a bad checksum. A lowercase or uppercase
  // address passes isAddress and is checksummed below; a mixed-case
  // address with a wrong checksum fails here.
  if (!isAddress(address)) {
    return {
      ok: false,
      error: 'The address checksum looks wrong — check the address and try again',
    };
  }
  try {
    return { ok: true, normalized: getAddress(address) };
  } catch {
    return {
      ok: false,
      error: 'The address checksum looks wrong — check the address and try again',
    };
  }
}

const TRON_BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58 decode (leading '1's are zero bytes). Returns null on a bad character. */
function decodeBase58(address: string): Uint8Array | null {
  let value = 0n;
  for (const ch of address) {
    const digit = TRON_BASE58_ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  const bytes = hex === '00' ? new Uint8Array(0) : hexToBytes(`0x${hex}`);
  let leadingOnes = 0;
  while (leadingOnes < address.length && address[leadingOnes] === '1') {
    leadingOnes += 1;
  }
  const out = new Uint8Array(leadingOnes + bytes.length);
  out.set(bytes, leadingOnes);
  return out;
}

/**
 * TRON base58 address → 21-byte hex (0x41 version + 20-byte hash), or
 * null when the shape or the double-SHA-256 checksum is wrong. The
 * 4-byte checksum is verified but not part of the address: this matches
 * the repo convention (adapters/trx.ts: "21 address bytes") and the
 * hex form TronGrid expects with visible:false. Verified against the
 * USDT contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t →
 * 41a614f803b6fd780986a42c78ec9c7f77e6ded13c.
 */
export function tronAddressToHex(address: string): string | null {
  const decoded = decodeBase58(address);
  if (decoded === null || decoded.length !== 25) return null;
  if (decoded[0] !== 0x41) return null;
  const payload = decoded.subarray(0, 21);
  const checksum = hexToBytes(sha256(hexToBytes(sha256(payload))));
  const expected = checksum.subarray(0, 4);
  const actual = decoded.subarray(21);
  for (let i = 0; i < 4; i += 1) {
    if (expected[i] !== actual[i]) return null;
  }
  return [...payload].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isValidTronAddress(address: string): boolean {
  return tronAddressToHex(address) !== null;
}

/** TRON Base58Check: 34 chars, starts with T, valid double-SHA-256 checksum. */
export function validateTronContractAddress(address: string): AddressValidation {
  if (
    address.length !== 34 ||
    !address.startsWith('T') ||
    ![...address].every((ch) => TRON_BASE58_ALPHABET.includes(ch)) ||
    !isValidTronAddress(address)
  ) {
    return {
      ok: false,
      error: 'Enter a valid TRON contract address starting with T',
    };
  }
  return { ok: true, normalized: address };
}

/**
 * Solana mint address: base58, decoding to exactly 32 bytes. No
 * checksum exists for a mint (base58 only), so a well-formed address
 * that is not a mint is caught by the on-chain check, not here.
 */
export function validateSolMintAddress(address: string): AddressValidation {
  const decoded = decodeBase58(address);
  if (decoded === null || decoded.length !== 32) {
    return {
      ok: false,
      error: 'Enter a valid Solana mint address',
    };
  }
  return { ok: true, normalized: address };
}

/** Base64url → bytes (atob is standard base64 only). Returns null on bad input. */
function decodeBase64Url(value: string): Uint8Array | null {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * TON Jetton master address: the raw form (`0:` + 64 hex chars) or the
 * user-friendly form (48 base64url chars decoding to 36 bytes: flags
 * 0x11 bounceable / 0x51 non-bounceable, workchain 0x00 / 0xff, 32-byte
 * hash, 2-byte CRC). The CRC is not re-checked here — the on-chain
 * TonAPI lookup is the real check, and a CRC typo fails there.
 */
export function validateTonJettonAddress(address: string): AddressValidation {
  if (/^0:[0-9a-fA-F]{64}$/.test(address)) {
    return { ok: true, normalized: address };
  }
  if (address.length !== 48) {
    return {
      ok: false,
      error: 'Enter a valid TON Jetton master address',
    };
  }
  const decoded = decodeBase64Url(address);
  if (
    decoded === null ||
    decoded.length !== 36 ||
    (decoded[0] !== 0x11 && decoded[0] !== 0x51) ||
    (decoded[1] !== 0x00 && decoded[1] !== 0xff)
  ) {
    return {
      ok: false,
      error: 'Enter a valid TON Jetton master address',
    };
  }
  return { ok: true, normalized: address };
}

/**
 * On-chain metadata rules (Lane 1 §7.3): name non-empty, symbol 1–11
 * printable chars, decimals an integer 0–36. Returns the specific
 * problem, or null when the metadata is valid.
 */
export function validateTokenMetadata(
  name: string,
  symbol: string,
  decimals: number,
): string | null {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Could not read this token — its name is empty';
  }
  if (
    typeof symbol !== 'string' ||
    symbol.length < 1 ||
    symbol.length > 11 ||
    // Printable only: no control characters and no whitespace. Real
    // symbols are not ASCII-only — TON USDT is 'USD₮' on TonAPI — so
    // non-ASCII printable characters are accepted.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001F\u007F]/.test(symbol) ||
    /\s/.test(symbol)
  ) {
    return 'Could not read this token — its symbol is invalid';
  }
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) {
    return 'Could not read this token — its decimals value is invalid';
  }
  return null;
}

/** Same network + contract (case-normalised) already in the list. */
export function isDuplicateToken(
  list: readonly TokenRecord[],
  chain: ChainId,
  contract: string,
): boolean {
  const key = tokenKey(chain, contract);
  return list.some((record) => tokenKeyOf(record) === key);
}

export function addCustomTokenToList(
  list: readonly TokenRecord[],
  record: TokenRecord,
): { list: TokenRecord[] } | { error: 'Already added' } {
  if (isDuplicateToken(list, record.chain, record.contract)) {
    return { error: 'Already added' };
  }
  return { list: [...list, record] };
}

// --- Persistence (localStorage, versioned keys, public data only) ---
// Follows the existing precedent (bawa-watch-only-xpubs,
// bawa-vault-addresses:v1): versioned JSON, best-effort writes, never
// secrets. The 21 default tokens are NOT stored here — they live in code
// so a fresh wallet always loads the 43; this key holds user-added
// tokens only.

export const ENABLED_CHAINS_KEY = 'bawa:enabled-chains:v1';
export const CUSTOM_TOKENS_KEY = 'bawa:custom-tokens:v1';

export interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): TokenStore | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Default (nothing stored): all 22 chains enabled — the default 20-token list is the enabled set. */
export function readEnabledChains(store?: TokenStore): ChainId[] {
  const storage = store ?? defaultStore();
  try {
    const raw = storage?.getItem(ENABLED_CHAINS_KEY);
    if (raw === null || raw === undefined) return [...SUPPORTED_CHAINS];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.chains)) {
      return [...SUPPORTED_CHAINS];
    }
    const chains = (parsed.chains as unknown[]).filter(
      (chain): chain is ChainId =>
        typeof chain === 'string' && (SUPPORTED_CHAINS as readonly string[]).includes(chain),
    );
    // Preserve registry order; an empty stored list means "none enabled"
    // only when it was explicitly stored that way — but an empty list
    // can never be produced by the UI (the last chain cannot be
    // disabled), so treat it as corrupt and fall back to all chains.
    if (chains.length === 0) return [...SUPPORTED_CHAINS];
    return SUPPORTED_CHAINS.filter((chain) => chains.includes(chain));
  } catch {
    return [...SUPPORTED_CHAINS];
  }
}

export function writeEnabledChains(chains: readonly ChainId[], store?: TokenStore): void {
  const storage = store ?? defaultStore();
  try {
    storage?.setItem(
      ENABLED_CHAINS_KEY,
      JSON.stringify({ version: 1, chains: [...chains] }),
    );
  } catch {
    // Persistence is best-effort; the in-memory set still works.
  }
}

function isValidTokenRecord(value: unknown): value is TokenRecord {
  if (!isRecord(value)) return false;
  if (typeof value.chain !== 'string' || !(SUPPORTED_CHAINS as readonly string[]).includes(value.chain)) {
    return false;
  }
  if (typeof value.contract !== 'string' || value.contract === '') return false;
  if (typeof value.name !== 'string' || value.name === '') return false;
  if (typeof value.symbol !== 'string' || value.symbol === '') return false;
  const decimals = value.decimals;
  if (typeof decimals !== 'number' || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) {
    return false;
  }
  if (value.coingeckoId !== null && typeof value.coingeckoId !== 'string') return false;
  if (typeof value.addedAtMs !== 'number' || !Number.isFinite(value.addedAtMs)) return false;
  return true;
}

export function readCustomTokens(store?: TokenStore): TokenRecord[] {
  const storage = store ?? defaultStore();
  try {
    const raw = storage?.getItem(CUSTOM_TOKENS_KEY);
    if (raw === null || raw === undefined) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.tokens)) {
      return [];
    }
    return (parsed.tokens as unknown[]).filter(isValidTokenRecord);
  } catch {
    return [];
  }
}

export function writeCustomTokens(tokens: readonly TokenRecord[], store?: TokenStore): void {
  const storage = store ?? defaultStore();
  try {
    storage?.setItem(
      CUSTOM_TOKENS_KEY,
      JSON.stringify({ version: 1, tokens: [...tokens] }),
    );
  } catch {
    // Persistence is best-effort; the in-memory list still works.
  }
}

/**
 * Sort keys for balance-aware asset ordering (Send / Receive pickers) —
 * how the top wallets order a token list: non-zero balances first,
 * highest fiat value first, then zero balances in registry order. Nothing
 * is hidden when nothing has a balance. Callers pass precomputed keys:
 * Send/Receive load no price feed, so fiatMinorUnits is null there and
 * the order is hasBalance, then registry order.
 */
export interface BalanceSortKey {
  hasBalance: boolean;
  fiatMinorUnits: number | null;
}

export function orderAssetsByBalance<T extends BalanceSortKey>(
  assets: readonly T[],
): T[] {
  return [...assets]
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      if (a.asset.hasBalance !== b.asset.hasBalance) {
        return a.asset.hasBalance ? -1 : 1;
      }
      const aFiat = a.asset.fiatMinorUnits;
      const bFiat = b.asset.fiatMinorUnits;
      if (aFiat !== null && bFiat !== null && aFiat !== bFiat) {
        return bFiat - aFiat;
      }
      if (aFiat !== null && bFiat === null) return -1;
      if (aFiat === null && bFiat !== null) return 1;
      return a.index - b.index;
    })
    .map(({ asset }) => asset);
}
