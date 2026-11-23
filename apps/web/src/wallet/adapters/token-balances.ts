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
 *   null: the token is still added; its price then comes from the
 *   DexScreener / TonAPI fallback in token-prices, or shows
 *   "Price unavailable" when no source has it).
 *
 * Read-only throughout. No signing, no broadcast, no funds moved.
 */
import { hexToBytes, isAddress } from 'viem';
import { isRecord } from '../guards';
import { CHAINS, resolveRpcEndpoints } from '../chains';
import type { ChainId } from '../../engine/boundary';
import { PRICE_PROVIDER_BASE_URL } from '../prices';
import {
  DEFAULT_TOKENS,
  isValidTronAddress,
  tokenKey,
  tronAddressToHex,
  validateEvmContractAddress,
  validateSolMintAddress,
  validateTokenMetadata,
  validateTonJettonAddress,
  validateTronContractAddress,
} from '../tokens';
import {
  endpointHost,
  httpFetchTransport,
  messageOf,
  toAdapterError,
  tryEndpoints,
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
  /** The endpoint that answered the last request, when known. */
  lastEndpoint?: () => string | undefined;
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


/** Builds a minimal JSON-RPC client for an EVM chain from its pinned
 * RPC. Plain fetch on the repo's httpFetchTransport (10 s timeout),
 * not a viem client: the token path only needs `request`, and a viem
 * PublicClient's narrow method union is not assignable to EvmRpcClient
 * — and the viem client would pull the `call` action machinery back
 * into the shared chunks. RPC failover (UI/UX fixes, item 19): each
 * request sweeps the chain's resolved endpoint list (registry +
 * owner's overrides) in order and reports the answering endpoint
 * through lastEndpoint, so a balance that came through the backup
 * never claims the primary. */
export function evmClientForChain(
  chain: ChainId,
  rpcUrl?: string,
  transport: FetchTransport = httpFetchTransport,
): EvmRpcClient {
  const urls =
    rpcUrl !== undefined ? [rpcUrl] : resolveRpcEndpoints(chain);
  let id = 0;
  let lastEndpoint: string | undefined;
  return {
    request: async ({ method, params }) => {
      const { result, endpoint } = await withRetry(
        () =>
          tryEndpoints(urls, async (url) => {
            const body = await transport.request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
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
          }),
        { operation: `token-balances.${chain}.request` },
      );
      lastEndpoint = endpoint;
      return result;
    },
    lastEndpoint: () => lastEndpoint,
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
  // The owner's RPC list applies here too (item 19): a custom
  // Trongrid-shaped endpoint replaces the default for token reads.
  const baseUrl =
    input.baseUrl ?? resolveRpcEndpoints('trx')[0] ?? TRONGRID_BASE_URL;
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
    const lastEndpoint = client.lastEndpoint?.();
    const source =
      lastEndpoint !== undefined ? endpointHost(lastEndpoint) : rpcHost(chain);
    return {
      status: 'ok',
      data: {
        chain,
        address: ownerAddress,
        networkId: config.networkId,
        valueBaseUnits: balance.toString(),
        decimals,
        source,
        fetchedAt: Date.now(),
      },
      source,
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
  // The owner's RPC list applies here too (item 19): a custom
  // Trongrid-shaped endpoint replaces the default for token reads.
  const baseUrl =
    input.baseUrl ?? resolveRpcEndpoints('trx')[0] ?? TRONGRID_BASE_URL;
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
      source: endpointHost(baseUrl),
      fetchedAt: Date.now(),
    },
    source: endpointHost(baseUrl),
    fetchedAt: Date.now(),
  };
}

/**
 * Token balance for one token record + owner address. EVM chains read
 * ERC-20 balanceOf on the token chain's pinned RPC; TRON reads TRC-20
 * balanceOf via TronGrid; Solana reads SPL token accounts on the SOL
 * RPC; TON reads the Jetton balance via TonAPI. A zero balance is a
 * real balance (status ok).
 */
export async function fetchTokenBalance(
  input: TokenBalanceInput,
  deps: TokenBalanceDeps = {},
): Promise<AdapterResult<AdapterBalance>> {
  if (input.chain === 'sol') {
    return fetchSplTokenBalance({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      decimals: input.decimals,
      transport: deps.transport,
    });
  }
  if (input.chain === 'ton') {
    return fetchJettonTokenBalance({
      contract: input.contract,
      ownerAddress: input.ownerAddress,
      decimals: input.decimals,
      transport: deps.transport,
    });
  }
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

// --- Solana SPL tokens (UI/UX fixes, item 13) ---------------------------
// Read-only JSON-RPC against the SOL endpoints (primary + fallback,
// item-19 sweep): the mint account proves the mint exists and carries
// the decimals; the Metaplex metadata account carries the name/symbol;
// getTokenAccountsByOwner sums the owner's token accounts. No ATA PDA
// math is needed — the RPC finds the accounts by owner + mint filter.

const SOL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SOL_TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const METAPLEX_METADATA_PROGRAM =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/** Minimal Solana JSON-RPC client, mirroring evmClientForChain. */
function solRpcClient(transport: FetchTransport = httpFetchTransport): {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  lastEndpoint: () => string | undefined;
} {
  const urls = resolveRpcEndpoints('sol');
  let id = 0;
  let lastEndpoint: string | undefined;
  return {
    request: async ({ method, params }) => {
      const { result, endpoint } = await withRetry(
        () =>
          tryEndpoints(urls, async (url) => {
            const body = await transport.request(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
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
          }),
        { operation: 'token-balances.sol.request' },
      );
      lastEndpoint = endpoint;
      return result;
    },
    lastEndpoint: () => lastEndpoint,
  };
}

/** Base64 → bytes (atob is standard base64 only). Returns null on bad input. */
function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
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
 * One length-prefixed (u32 LE + bytes) string from a Metaplex metadata
 * account: name at offset 65, symbol after it, uri after that. The
 * offsets are the field starts (length prefix included). Real accounts
 * pad the strings to fixed widths (name 32, symbol 10, uri 200) with
 * trailing NUL bytes — the length prefix records the padded length, so
 * the decoded value is stripped of trailing NULs (verified live
 * against the real USDC metadata account, 2026-11-23).
 */
function parseMetaplexString(
  data: Uint8Array,
  offset: number,
): { value: string; next: number } | null {
  if (offset + 4 > data.length) return null;
  const length = new DataView(
    data.buffer,
    data.byteOffset + offset,
    4,
  ).getUint32(0, true);
  if (length > 200 || offset + 4 + length > data.length) return null;
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(
      data.subarray(offset + 4, offset + 4 + length),
    );
    const value = raw.replace(/\0+$/, '');
    if (value === '') return null;
    return { value, next: offset + 4 + length };
  } catch {
    return null;
  }
}

/** SPL metadata: the mint account's decimals + the Metaplex name/symbol. */
export async function fetchSplTokenMetadata(input: {
  contract: string;
  transport?: FetchTransport;
}): Promise<MetadataResult> {
  const { contract } = input;
  const client = solRpcClient(input.transport);
  let account: unknown;
  try {
    account = await client.request({
      method: 'getAccountInfo',
      params: [contract, { encoding: 'jsonParsed' }],
    });
  } catch {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  const value = isRecord(account) ? account['value'] : undefined;
  if (!isRecord(value)) {
    return {
      ok: false,
      error: 'This address is not a token mint on Solana',
    };
  }
  const owner = typeof value['owner'] === 'string' ? value['owner'] : '';
  if (
    owner !== SOL_TOKEN_PROGRAM &&
    owner !== SOL_TOKEN_2022_PROGRAM
  ) {
    return {
      ok: false,
      error: 'This address is not a token mint on Solana',
    };
  }
  const data = isRecord(value['data']) ? value['data'] : undefined;
  const parsed = isRecord(data) ? data['parsed'] : undefined;
  const info = isRecord(parsed) ? parsed['info'] : undefined;
  const decimals =
    isRecord(info) && typeof info['decimals'] === 'number'
      ? info['decimals']
      : undefined;
  if (decimals === undefined) {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  let accounts: unknown;
  try {
    accounts = await client.request({
      method: 'getProgramAccounts',
      params: [
        METAPLEX_METADATA_PROGRAM,
        {
          encoding: 'base64',
          filters: [{ memcmp: { offset: 33, bytes: contract } }],
        },
      ],
    });
  } catch {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  // getProgramAccounts returns a bare array (unlike getAccountInfo /
  // getTokenAccountsByOwner, whose result is { context, value }).
  const list = Array.isArray(accounts) ? accounts : undefined;
  if (list === undefined || list.length === 0) {
    return {
      ok: false,
      error: 'No Metaplex metadata found for this mint',
    };
  }
  const first = list[0];
  const accountData = isRecord(first)
    ? isRecord(first['account'])
      ? first['account']['data']
      : undefined
    : undefined;
  if (
    !Array.isArray(accountData) ||
    typeof accountData[0] !== 'string'
  ) {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  const bytes = decodeBase64(accountData[0]);
  // Metaplex MetadataV1: 1-byte key (4), 32-byte update authority,
  // 32-byte mint, then length-prefixed name, symbol, uri. The memcmp
  // filter above already constrains the account to this mint.
  if (bytes === null || bytes.length < 69 || bytes[0] !== 4) {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  const name = parseMetaplexString(bytes, 65);
  if (name === null) return { ok: false, error: UNREADABLE_TOKEN };
  const symbol = parseMetaplexString(bytes, name.next);
  if (symbol === null) return { ok: false, error: UNREADABLE_TOKEN };
  const metadata = { name: name.value, symbol: symbol.value, decimals };
  const problem = validateTokenMetadata(
    metadata.name,
    metadata.symbol,
    metadata.decimals,
  );
  if (problem !== null) return { ok: false, error: problem };
  return { ok: true, metadata };
}

/** SPL balanceOf: sums the owner's token accounts for the mint. */
async function fetchSplTokenBalance(input: {
  contract: string;
  ownerAddress: string;
  decimals?: number;
  transport?: FetchTransport;
}): Promise<AdapterResult<AdapterBalance>> {
  const client = solRpcClient(input.transport);
  try {
    const raw = await client.request({
      method: 'getTokenAccountsByOwner',
      params: [
        input.ownerAddress,
        { mint: input.contract },
        { encoding: 'jsonParsed' },
      ],
    });
    const list = isRecord(raw) ? raw['value'] : undefined;
    if (!Array.isArray(list)) {
      return { status: 'error', reason: 'Invalid response: expected a balance' };
    }
    let total = 0n;
    for (const entry of list) {
      const data = isRecord(entry)
        ? isRecord(entry['account'])
          ? isRecord(entry['account']['data'])
            ? entry['account']['data']['parsed']
            : undefined
          : undefined
        : undefined;
      const info = isRecord(data) ? data['info'] : undefined;
      const tokenAmount = isRecord(info) ? info['tokenAmount'] : undefined;
      const amount =
        isRecord(tokenAmount) && typeof tokenAmount['amount'] === 'string'
          ? tokenAmount['amount']
          : undefined;
      if (amount === undefined || !/^[0-9]+$/.test(amount)) {
        return {
          status: 'error',
          reason: 'Invalid response: expected a balance',
        };
      }
      total += BigInt(amount);
    }
    let decimals = input.decimals;
    if (decimals === undefined) {
      const metadata = await fetchSplTokenMetadata({
        contract: input.contract,
        transport: input.transport,
      });
      if (!metadata.ok) {
        return { status: 'error', reason: metadata.error };
      }
      decimals = metadata.metadata.decimals;
    }
    const source =
      client.lastEndpoint() !== undefined
        ? endpointHost(client.lastEndpoint() as string)
        : rpcHost('sol');
    return {
      status: 'ok',
      data: {
        chain: 'sol',
        address: input.ownerAddress,
        networkId: CHAINS.sol.networkId,
        valueBaseUnits: total.toString(),
        decimals,
        source,
        fetchedAt: Date.now(),
      },
      source,
      fetchedAt: Date.now(),
    };
  } catch (error: unknown) {
    return toAdapterError(error);
  }
}

/** Full SPL verification for the Add Token flow (same checks as EVM). */
export async function verifySplToken(input: {
  contract: string;
  ownerAddress: string;
  transport?: FetchTransport;
}): Promise<TokenVerification> {
  const format = validateSolMintAddress(input.contract);
  if (!format.ok) return { ok: false, error: format.error };
  const metadata = await fetchSplTokenMetadata({
    contract: format.normalized,
    transport: input.transport,
  });
  if (!metadata.ok) return { ok: false, error: metadata.error };
  const balance = await fetchSplTokenBalance({
    contract: format.normalized,
    ownerAddress: input.ownerAddress,
    decimals: metadata.metadata.decimals,
    transport: input.transport,
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

// --- TON Jettons (UI/UX fixes, item 13) ---------------------------------
// TonAPI (keyless, already the TON balance fallback in item 19 and
// already in the CSP): structured Jetton metadata + the owner's Jetton
// balance, no BOC cell parsing. TonCenter runGetMethod would return the
// metadata as a BOC cell needing a full cell parser; TonAPI answers the
// same facts as JSON.

const TONAPI_BASE_URL = 'https://tonapi.io';

async function tonApiGet(
  path: string,
  transport: FetchTransport,
): Promise<unknown> {
  return withRetry(
    () =>
      transport.request(`${TONAPI_BASE_URL}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    { operation: 'token-balances.tonapi' },
  );
}

/** Jetton metadata from TonAPI. 404 → not a Jetton master. */
export async function fetchJettonTokenMetadata(input: {
  contract: string;
  transport?: FetchTransport;
}): Promise<MetadataResult> {
  const transport = input.transport ?? httpFetchTransport;
  let body: unknown;
  try {
    body = await tonApiGet(`/v2/jettons/${input.contract}`, transport);
  } catch (error: unknown) {
    if (messageOf(error).includes('HTTP 404')) {
      return {
        ok: false,
        error: 'This address is not a Jetton master on TON',
      };
    }
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  if (!isRecord(body)) return { ok: false, error: UNREADABLE_TOKEN };
  const metadata = isRecord(body['metadata']) ? body['metadata'] : undefined;
  const name =
    metadata !== undefined && typeof metadata['name'] === 'string'
      ? metadata['name']
      : undefined;
  const symbol =
    metadata !== undefined && typeof metadata['symbol'] === 'string'
      ? metadata['symbol']
      : undefined;
  const decimalsRaw = metadata !== undefined ? metadata['decimals'] : undefined;
  const decimals =
    typeof decimalsRaw === 'number'
      ? decimalsRaw
      : typeof decimalsRaw === 'string'
        ? Number(decimalsRaw)
        : undefined;
  if (
    name === undefined ||
    symbol === undefined ||
    decimals === undefined ||
    !Number.isInteger(decimals)
  ) {
    return { ok: false, error: UNREADABLE_TOKEN };
  }
  const meta = { name, symbol, decimals };
  const problem = validateTokenMetadata(meta.name, meta.symbol, meta.decimals);
  if (problem !== null) return { ok: false, error: problem };
  return { ok: true, metadata: meta };
}

/** Jetton balanceOf via TonAPI. A missing jetton wallet is a real zero. */
async function fetchJettonTokenBalance(input: {
  contract: string;
  ownerAddress: string;
  decimals?: number;
  transport?: FetchTransport;
}): Promise<AdapterResult<AdapterBalance>> {
  const transport = input.transport ?? httpFetchTransport;
  let balance = '0';
  try {
    const body = await tonApiGet(
      `/v2/accounts/${input.ownerAddress}/jettons/${input.contract}`,
      transport,
    );
    const raw = isRecord(body) ? body['balance'] : undefined;
    if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) {
      return { status: 'error', reason: 'Invalid response: expected a balance' };
    }
    balance = raw;
  } catch (error: unknown) {
    if (messageOf(error).includes('HTTP 404')) {
      balance = '0';
    } else {
      return toAdapterError(error);
    }
  }
  let decimals = input.decimals;
  if (decimals === undefined) {
    const metadata = await fetchJettonTokenMetadata({
      contract: input.contract,
      transport,
    });
    if (!metadata.ok) {
      return { status: 'error', reason: metadata.error };
    }
    decimals = metadata.metadata.decimals;
  }
  return {
    status: 'ok',
    data: {
      chain: 'ton',
      address: input.ownerAddress,
      networkId: CHAINS.ton.networkId,
      valueBaseUnits: balance,
      decimals,
      source: 'tonapi',
      fetchedAt: Date.now(),
    },
    source: 'tonapi',
    fetchedAt: Date.now(),
  };
}

/** Full Jetton verification for the Add Token flow (same checks as EVM). */
export async function verifyJettonToken(input: {
  contract: string;
  ownerAddress: string;
  transport?: FetchTransport;
}): Promise<TokenVerification> {
  const format = validateTonJettonAddress(input.contract);
  if (!format.ok) return { ok: false, error: format.error };
  const metadata = await fetchJettonTokenMetadata({
    contract: format.normalized,
    transport: input.transport,
  });
  if (!metadata.ok) return { ok: false, error: metadata.error };
  const balance = await fetchJettonTokenBalance({
    contract: format.normalized,
    ownerAddress: input.ownerAddress,
    decimals: metadata.metadata.decimals,
    transport: input.transport,
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
 * "Price unavailable" unless the DexScreener / TonAPI fallback has it
 * (see token-prices). Never throws: network failure also yields null.
 * Platform ids are CoinGecko's per-chain slugs (ethereum, tron,
 * binance-smart-chain, polygon-pos, arbitrum-one, optimistic-ethereum,
 * base, avalanche, solana, xdai, celo, linea, mantle, scroll, opbnb,
 * metis, aurora, fantom, the-open-network). The endpoint accepts the
 * lowercased address for every platform — verified live 2026-11-23 for
 * Solana, TRON and TON (the friendly EQ… form lowercased still resolves).
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
    | 'avalanche'
    | 'solana'
    | 'xdai'
    | 'celo'
    | 'linea'
    | 'mantle'
    | 'scroll'
    | 'opbnb'
    | 'metis'
    | 'aurora'
    | 'fantom'
    | 'the-open-network';
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
