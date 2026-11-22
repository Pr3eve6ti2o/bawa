/**
 * Token balances and token verification (token discovery).
 *
 * - ERC-20 `balanceOf` via raw JSON-RPC `eth_call` on the token chain's
 *   pinned RPC (the repo's own raw-RPC style, as in `eth.ts` — NOT
 *   viem `readContract`: the `call` action pulls viem's ABI coder +
 *   CCIP machinery into the shared chunks and blew the bundle budget
 *   by ~73 KB, measured 2026-11-22). Calldata is encoded by hand
 *   (4-byte selectors + 32-byte words) and returns are decoded with
 *   the small helpers below.
 * - TRC-20 `balanceOf` via TronGrid `triggerconstantcontract` (the
 *   read-only simulation path proven by the 2026-11-12 USDT dry run in
 *   docs/mainnet/MAINNET-GUIDE.md).
 * - Token verification for the Add Token flow: format + checksum,
 *   is-it-a-contract, on-chain name/symbol/decimals, balance sanity.
 *   Nothing is added until every check passes.
 * - CoinGecko contract lookup for the added token's price id (404 →
 *   null: the token is still added, its price shows "Price unavailable").
 *
 * Read-only throughout. No signing, no broadcast, no funds moved.
 */
import { hexToBytes, isAddress } from 'viem';
import { CHAINS } from '../chains';
import type { ChainId } from '../../engine/boundary';
import { PRICE_PROVIDER_BASE_URL } from '../prices';
import {
  DEFAULT_TOKENS,
  isValidTronAddress,
  tokenKey,
  tronAddressToHex,
  validateEvmContractAddress,
  validateTokenMetadata,
  validateTronContractAddress,
} from '../tokens';
import {
  httpFetchTransport,
  toAdapterError,
  type AdapterBalance,
  type AdapterResult,
  type FetchTransport,
} from './types';
import { withRetry } from '../retry';

export { isValidTronAddress, tronAddressToHex };
export type FetchTransportLike = FetchTransport;

/** Minimal EVM JSON-RPC client: only `request` is needed. viem's
 * PublicClient satisfies this structurally; tests inject a fake that
 * dispatches on the JSON-RPC method and the calldata selector. */
export interface EvmRpcClient {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const TRONGRID_BASE_URL = 'https://api.trongrid.io';

export interface TokenBalanceInput {
  chain: ChainId;
  contract: string;
  ownerAddress: string;
  /** Known decimals (from the token record); read on-chain when omitted. */
  decimals?: number;
}

export interface TokenBalanceDeps {
  evmClient?: EvmRpcClient;
  /** Injectable transport for TronGrid calls. */
  transport?: FetchTransport;
  tronBaseUrl?: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

export type TokenVerification =
  | { ok: true; metadata: TokenMetadata; balanceBaseUnits: string }
  | { ok: false; error: string };

export type MetadataResult =
  | { ok: true; metadata: TokenMetadata }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Builds a minimal JSON-RPC client for an EVM chain from its pinned
 * RPC. Plain fetch on the repo's httpFetchTransport (10 s timeout),
 * not a viem client: the token path only needs `request`, and a viem
 * PublicClient's narrow method union is not assignable to EvmRpcClient
 * — and the viem client would pull the `call` action machinery back
 * into the shared chunks. */
export function evmClientForChain(
  chain: ChainId,
  rpcUrl?: string,
  transport: FetchTransport = httpFetchTransport,
): EvmRpcClient {
  const config = CHAINS[chain];
  const url = rpcUrl ?? config.rpcEndpoints[0] ?? '';
  let id = 0;
  return {
    request: async ({ method, params }) => {
      const body = await transport.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: (id += 1),
          method,
          params: params ?? [],
        }),
      });
      if (!isRecord(body)) throw new Error('Invalid RPC response');
      if ('error' in body) {
        const error = body['error'];
        const message =
          isRecord(error) && typeof error['message'] === 'string'
            ? error['message']
            : 'RPC error';
        throw new Error(message);
      }
      return body['result'];
    },
  };
}

const UNREADABLE_TOKEN = 'Could not read this token — check the address and try again';

// ERC-20 function selectors (first 4 bytes of keccak256(signature)).
const BALANCE_OF_SELECTOR = '0x70a08231';
const NAME_SELECTOR = '0x06fdde03';
const SYMBOL_SELECTOR = '0x95d89b41';
const DECIMALS_SELECTOR = '0x313ce567';

/** 20-byte address hex (no 0x) left-padded to a 32-byte ABI word. */
function paddedAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

/** One read-only eth_call. Returns the raw hex result, or null. */
async function ethCall(
  client: EvmRpcClient,
  to: string,
  data: string,
): Promise<string | null> {
  const raw = await client.request({
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  });
  return typeof raw === 'string' ? raw : null;
}

/** Raw eth_getCode (the contract check). */
async function ethGetCode(client: EvmRpcClient, address: string): Promise<string | null> {
  const raw = await client.request({
    method: 'eth_getCode',
    params: [address, 'latest'],
  });
  return typeof raw === 'string' ? raw : null;
}

/** Raw eth_chainId, as a number, or null when unparsable. */
async function ethChainId(client: EvmRpcClient): Promise<number | null> {
  const raw = await client.request({ method: 'eth_chainId', params: [] });
  if (typeof raw !== 'string') return null;
  const value = Number.parseInt(raw, 16);
  return Number.isSafeInteger(value) ? value : null;
}

/** ERC-20 metadata via raw eth_call. All three reads must succeed. */
export async function fetchEvmTokenMetadata(input: {
  chain: ChainId;
  contract: string;
  evmClient?: EvmRpcClient;
}): Promise<MetadataResult> {
  const { chain, contract } = input;
  const config = CHAINS[chain];
  const client = input.evmClient ?? evmClientForChain(chain);
  let code: string | null;
  try {
    code = await ethGetCode(client, contract);
  } catch {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  if (code === null || code === '0x') {
    return {
      ok: false,
      error: `This address is not a token contract on ${config.displayName}`,
    };
  }
  try {
    const [nameRaw, symbolRaw, decimalsRaw] = await Promise.all([
      ethCall(client, contract, NAME_SELECTOR),
      ethCall(client, contract, SYMBOL_SELECTOR),
      ethCall(client, contract, DECIMALS_SELECTOR),
    ]);
    if (nameRaw === null || symbolRaw === null || decimalsRaw === null) {
      return { ok: false, error: UNREADABLE_TOKEN };
    }
    const name = decodeAbiString(nameRaw);
    const symbol = decodeAbiString(symbolRaw);
    const decimalsValue = decodeUint256Hex(decimalsRaw);
    if (name === null || symbol === null || decimalsValue === null) {
      return { ok: false, error: UNREADABLE_TOKEN };
    }
    const metadata = { name, symbol, decimals: Number(decimalsValue) };
    const problem = validateTokenMetadata(metadata.name, metadata.symbol, metadata.decimals);
    if (problem !== null) return { ok: false, error: problem };
    return { ok: true, metadata };
  } catch {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
}

/** One TronGrid triggerconstantcontract read (bounded retry, read-only). */
async function triggerConstant(input: {
  contract: string;
  ownerAddress: string;
  functionSelector: string;
  parameter: string;
  transport: FetchTransport;
  baseUrl: string;
}): Promise<{ ok: boolean; constantResult: string[] }> {
  const ownerHex = tronAddressToHex(input.ownerAddress);
  const contractHex = tronAddressToHex(input.contract);
  if (ownerHex === null || contractHex === null) {
    return { ok: false, constantResult: [] };
  }
  let raw: unknown;
  try {
    raw = await withRetry(
      () =>
        input.transport.request(`${input.baseUrl}/wallet/triggerconstantcontract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            owner_address: ownerHex,
            contract_address: contractHex,
            function_selector: input.functionSelector,
            parameter: input.parameter,
            visible: false,
          }),
        }),
      { operation: 'trx.triggerconstantcontract' },
    );
  } catch {
    return { ok: false, constantResult: [] };
  }
  if (!isRecord(raw)) return { ok: false, constantResult: [] };
  const result = isRecord(raw['result']) ? raw['result']['result'] : undefined;
  const constant = raw['constant_result'];
  if (result !== true || !Array.isArray(constant)) {
    return { ok: false, constantResult: [] };
  }
  return {
    ok: true,
    constantResult: constant.filter((entry): entry is string => typeof entry === 'string'),
  };
}

/** 20-byte TRON address hex (no 0x41 prefix) left-padded to 32 bytes. */
function tronAddressParameter(ownerAddress: string): string | null {
  const hex = tronAddressToHex(ownerAddress);
  if (hex === null || !hex.startsWith('41')) return null;
  return hex.slice(2).padStart(64, '0');
}

function decodeUint256Hex(hex: string): bigint | null {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean === '') return null;
  try {
    return BigInt(`0x${clean}`);
  } catch {
    return null;
  }
}

/** ABI-encoded string return: 32-byte offset, 32-byte length, UTF-8 data.
 * Some older tokens return a bare 32-byte word instead (bytes32 name /
 * symbol, e.g. MKR) — that decodes as UTF-8 with trailing NULs trimmed. */
function decodeAbiString(hex: string): string | null {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(`0x${clean}`);
  } catch {
    return null;
  }
  if (bytes.length === 32) {
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end -= 1;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end));
    } catch {
      return null;
    }
  }
  if (bytes.length < 64) return null;
  const lengthHex = [...bytes.subarray(32, 64)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const length = Number(decodeUint256Hex(lengthHex) ?? -1n);
  if (!Number.isSafeInteger(length) || length < 0 || length > 10000) return null;
  if (bytes.length < 64 + length) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(64, 64 + length));
  } catch {
    return null;
  }
}

/** TRC-20 metadata via triggerconstantcontract. All three reads must succeed. */
export async function fetchTronTokenMetadata(input: {
  contract: string;
  ownerAddress: string;
  transport?: FetchTransport;
  baseUrl?: string;
}): Promise<MetadataResult> {
  const transport = input.transport ?? httpFetchTransport;
  const baseUrl = input.baseUrl ?? TRONGRID_BASE_URL;
  // Probe first: a non-contract / nonexistent address fails here.
  const probe = await triggerConstant({
    contract: input.contract,
    ownerAddress: input.ownerAddress,
    functionSelector: 'decimals()',
    parameter: '',
    transport,
    baseUrl,
  });
  if (!probe.ok || probe.constantResult.length === 0) {
    return {
      ok: false,
      error: 'This address is not a token contract on TRON',
    };
  }
  const decimalsValue = decodeUint256Hex(probe.constantResult[0] ?? '');
  const [nameResult, symbolResult] = await Promise.all([
    triggerConstant({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      functionSelector: 'name()',
      parameter: '',
      transport,
      baseUrl,
    }),
    triggerConstant({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      functionSelector: 'symbol()',
      parameter: '',
      transport,
      baseUrl,
    }),
  ]);
  const name =
    nameResult.ok && nameResult.constantResult[0] !== undefined
      ? decodeAbiString(nameResult.constantResult[0])
      : null;
  const symbol =
    symbolResult.ok && symbolResult.constantResult[0] !== undefined
      ? decodeAbiString(symbolResult.constantResult[0])
      : null;
  if (name === null || symbol === null || decimalsValue === null) {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  const decimals = Number(decimalsValue);
  const metadata = { name, symbol, decimals };
  const problem = validateTokenMetadata(metadata.name, metadata.symbol, metadata.decimals);
  if (problem !== null) return { ok: false, error: problem };
  return { ok: true, metadata };
}

/** Host of a chain's pinned RPC, used as the balance source label. */
function rpcHost(chain: ChainId): string {
  const url = CHAINS[chain].rpcEndpoints[0];
  if (url === undefined) return 'evm-rpc';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Decimals of a default token, by chain + contract (case-insensitive key). */
function defaultTokenDecimals(chain: ChainId, contract: string): number | undefined {
  const key = tokenKey(chain, contract);
  return DEFAULT_TOKENS.find(
    (candidate) => tokenKey(candidate.chain, candidate.contract) === key,
  )?.decimals;
}

/** ERC-20 balanceOf via raw eth_call. */
async function fetchErc20Balance(input: {
  chain: ChainId;
  contract: string;
  ownerAddress: string;
  decimals?: number;
  evmClient?: EvmRpcClient;
}): Promise<AdapterResult<AdapterBalance>> {
  const { chain, contract, ownerAddress } = input;
  const config = CHAINS[chain];
  if (!isAddress(ownerAddress)) {
    return { status: 'error', reason: 'Invalid owner address' };
  }
  const client = input.evmClient ?? evmClientForChain(chain);
  try {
    const chainId = await ethChainId(client);
    if (chainId === null) {
      return { status: 'error', reason: 'Invalid response: expected a chain id' };
    }
    if (config.evmChainId !== null && chainId !== config.evmChainId) {
      return {
        status: 'error',
        reason:
          `Network identity mismatch: expected chain ${config.evmChainId} ` +
          `(${config.networkId}), got ${chainId}.`,
      };
    }
    const balanceRaw = await ethCall(
      client,
      contract,
      `${BALANCE_OF_SELECTOR}${paddedAddress(ownerAddress)}`,
    );
    const balance = balanceRaw === null ? null : decodeUint256Hex(balanceRaw);
    if (balance === null) {
      return { status: 'error', reason: 'Invalid response: expected a balance' };
    }
    // Decimals: caller-known first, then the verified default-token
    // table, then an on-chain read — a balance must never fail just
    // because the decimals read is unavailable.
    let decimals = input.decimals ?? defaultTokenDecimals(chain, contract);
    if (decimals === undefined) {
      const decimalsRaw = await ethCall(client, contract, DECIMALS_SELECTOR);
      const decimalsValue = decimalsRaw === null ? null : decodeUint256Hex(decimalsRaw);
      if (decimalsValue !== null) decimals = Number(decimalsValue);
    }
    if (decimals === undefined) {
      return { status: 'error', reason: UNREADABLE_TOKEN };
    }
    return {
      status: 'ok',
      data: {
        chain,
        address: ownerAddress,
        networkId: config.networkId,
        valueBaseUnits: balance.toString(),
        decimals,
        source: rpcHost(chain),
        fetchedAt: Date.now(),
      },
      source: rpcHost(chain),
      fetchedAt: Date.now(),
    };
  } catch (error: unknown) {
    return toAdapterError(error);
  }
}

/** TRC-20 balanceOf via triggerconstantcontract. */
async function fetchTrc20Balance(input: {
  contract: string;
  ownerAddress: string;
  decimals?: number;
  transport?: FetchTransport;
  baseUrl?: string;
}): Promise<AdapterResult<AdapterBalance>> {
  const transport = input.transport ?? httpFetchTransport;
  const baseUrl = input.baseUrl ?? TRONGRID_BASE_URL;
  const parameter = tronAddressParameter(input.ownerAddress);
  if (parameter === null) {
    return { status: 'error', reason: 'Invalid owner address' };
  }
  const result = await triggerConstant({
    contract: input.contract,
    ownerAddress: input.ownerAddress,
    functionSelector: 'balanceOf(address)',
    parameter,
    transport,
    baseUrl,
  });
  if (!result.ok || result.constantResult.length === 0) {
    return { status: 'error', reason: UNREADABLE_TOKEN };
  }
  const balance = decodeUint256Hex(result.constantResult[0] ?? '');
  if (balance === null) {
    return { status: 'error', reason: 'Invalid response: expected a balance' };
  }
  let decimals = input.decimals ?? defaultTokenDecimals('trx', input.contract);
  if (decimals === undefined) {
    const metadata = await fetchTronTokenMetadata({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      transport,
      baseUrl,
    });
    if (!metadata.ok) {
      return { status: 'error', reason: metadata.error };
    }
    decimals = metadata.metadata.decimals;
  }
  return {
    status: 'ok',
    data: {
      chain: 'trx',
      address: input.ownerAddress,
      networkId: CHAINS.trx.networkId,
      valueBaseUnits: balance.toString(),
      decimals,
      source: 'trongrid',
      fetchedAt: Date.now(),
    },
    source: 'trongrid',
    fetchedAt: Date.now(),
  };
}

/**
 * Token balance for one token record + owner address. EVM chains read
 * ERC-20 balanceOf on the token chain's pinned RPC; TRON reads TRC-20
 * balanceOf via TronGrid. A zero balance is a real balance (status ok).
 */
export async function fetchTokenBalance(
  input: TokenBalanceInput,
  deps: TokenBalanceDeps = {},
): Promise<AdapterResult<AdapterBalance>> {
  if (input.chain === 'trx') {
    return fetchTrc20Balance({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      decimals: input.decimals,
      transport: deps.transport,
      baseUrl: deps.tronBaseUrl,
    });
  }
  return fetchErc20Balance({
    chain: input.chain,
    contract: input.contract,
    ownerAddress: input.ownerAddress,
    decimals: input.decimals,
    evmClient: deps.evmClient,
  });
}

/**
 * Full EVM verification for the Add Token flow: format + checksum,
 * is-it-a-contract, on-chain metadata, balance sanity. Nothing is
 * added until every check passes; a failed read is reported, never
 * mapped to zero.
 */
export async function verifyEvmToken(input: {
  chain: ChainId;
  contract: string;
  ownerAddress: string;
  evmClient?: EvmRpcClient;
}): Promise<TokenVerification> {
  const format = validateEvmContractAddress(input.contract);
  if (!format.ok) return { ok: false, error: format.error };
  const metadata = await fetchEvmTokenMetadata({
    chain: input.chain,
    contract: format.normalized,
    evmClient: input.evmClient,
  });
  if (!metadata.ok) return { ok: false, error: metadata.error };
  const balance = await fetchErc20Balance({
    chain: input.chain,
    contract: format.normalized,
    ownerAddress: input.ownerAddress,
    decimals: metadata.metadata.decimals,
    evmClient: input.evmClient,
  });
  if (balance.status !== 'ok') {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  return {
    ok: true,
    metadata: metadata.metadata,
    balanceBaseUnits: balance.data.valueBaseUnits,
  };
}

/** Full TRON verification for the Add Token flow (same checks as EVM). */
export async function verifyTronToken(input: {
  contract: string;
  ownerAddress: string;
  transport?: FetchTransport;
  baseUrl?: string;
}): Promise<TokenVerification> {
  const format = validateTronContractAddress(input.contract);
  if (!format.ok) return { ok: false, error: format.error };
  const metadata = await fetchTronTokenMetadata({
    contract: format.normalized,
    ownerAddress: input.ownerAddress,
    transport: input.transport,
    baseUrl: input.baseUrl,
  });
  if (!metadata.ok) return { ok: false, error: metadata.error };
  const balance = await fetchTrc20Balance({
    contract: format.normalized,
    ownerAddress: input.ownerAddress,
    decimals: metadata.metadata.decimals,
    transport: input.transport,
    baseUrl: input.baseUrl,
  });
  if (balance.status !== 'ok') {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  return {
    ok: true,
    metadata: metadata.metadata,
    balanceBaseUnits: balance.data.valueBaseUnits,
  };
}

/**
 * Resolves a token's CoinGecko id via /coins/{platform}/contract/{address}.
 * 404 (unknown token) → null: the token is still added, its price shows
 * "Price unavailable". Never throws: network failure also yields null.
 * Platform ids are CoinGecko's per-chain slugs (ethereum, tron,
 * binance-smart-chain, polygon-pos, arbitrum-one, optimistic-ethereum,
 * base, avalanche).
 */
export async function resolveTokenCoingeckoId(input: {
  platform:
    | 'ethereum'
    | 'tron'
    | 'binance-smart-chain'
    | 'polygon-pos'
    | 'arbitrum-one'
    | 'optimistic-ethereum'
    | 'base'
    | 'avalanche';
  contract: string;
  fetchFn?: typeof fetch;
}): Promise<string | null> {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') return null;
  // CoinGecko contract endpoints take the lowercase hex address.
  const url = `${PRICE_PROVIDER_BASE_URL}/coins/${input.platform}/contract/${input.contract.toLowerCase()}`;
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload['id'] === 'string') {
      return payload['id'];
    }
    return null;
  } catch {
    return null;
  }
}
