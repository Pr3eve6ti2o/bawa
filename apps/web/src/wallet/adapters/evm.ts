/**
 * Generalised EVM adapter (token discovery).
 *
 * One factory for the six EVM chains that share the eth.ts pattern:
 * a viem public client on the chain's pinned RPC, chain-id checked on
 * every call, native balance via getBalance, nonce tx inputs, and a
 * 21000-gas native-transfer fee estimate. History reads the
 * Etherscan-compatible txlist API whenever a history endpoint is
 * configured — Ethereum via Routescan (partials fix, 2026-11-28:
 * Blockscout v1 429s on the shared egress IP, and its tokentx +
 * contract filter hangs; Blockscout v2 REST is the fallback when
 * the primary errors), Optimism, Scroll, Celo and Aurora via
 * Blockscout instances, Avalanche and Mantle via Routescan (Lane B,
 * 2026-11-23), Linea via Etherscan's V2 API keyless (Fix-All Lane A,
 * 2026-11-24: api.etherscan.io/v2/api?chainid=59144 answers real
 * transactions with no key, rate-limited to 1 req/5s — the base URL
 * carries the chainid query, so the txlist params join with '&');
 * the other EVM chains report history unavailable — never faked.
 * Broadcast stays disabled.
 */
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  type PublicClient,
} from 'viem';
import { isRecord } from '../guards';
import type { ChainId } from '../../engine/boundary';
import {
  assertNetworkId,
  createDisabledBroadcast,
  endpointHost,
  httpFetchTransport,
  resolveEndpoints,
  toAdapterError,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type BroadcastResult,
  type ChainAdapter,
  type EndpointList,
  type FeeEstimate,
  type FeeTierData,
  type FetchTransport,
  type TxInput,
} from './types';
import { withRetry } from '../retry';

export interface EvmAdapterConfig {
  chain: ChainId;
  networkId: string;
  rpcUrl: string;
  evmChainId: number;
  chainName: string;
  /** Native asset symbol, e.g. ETH, BNB, POL, AVAX. */
  nativeSymbol: string;
  source: string;
  /** Etherscan-compatible history base URL (Ethereum via Routescan, the rest via Blockscout instances). */
  historyBaseUrl?: string;
  /** Explorer base for history links, e.g. https://eth.blockscout.com. */
  historyExplorerBase?: string;
  /**
   * Label for the history source in adapter results, e.g. 'blockscout'.
   * Defaults to 'blockscout'; Optimism reports 'optimism-explorer' and
   * Scroll 'scrollscan' so the result names the host that answered.
   */
  historySource?: string;
}

interface EvmAdapterOverrides {
  client?: PublicClient;
  rpcUrl?: string;
  /**
   * Ordered RPC list, or a resolver re-read on every call (the RPC
   * manager in Networks writes the owner's list to localStorage; the
   * adapter picks it up without being rebuilt). Defaults to [rpcUrl].
   */
  rpcUrls?: EndpointList;
  historyBaseUrl?: string;
  /** Injectable transport for the Blockscout history read. */
  transport?: FetchTransport;
  /**
   * Devnet overrides (temporary devnet mode, via eth.ts): the network
   * id, the chain id the identity check pins, the explorer base for
   * history links, and the devnet broadcast. Unset, the adapter is
   * the configured mainnet adapter exactly as before.
   */
  networkId?: string;
  evmChainId?: number;
  historyExplorerBase?: string;
  broadcast?: (signedTx: unknown) => Promise<BroadcastResult>;
}
/**
 * Ronin addresses arrive in Trust Wallet Core's `ronin:<40 hex>` form
 * (the wallet's own derived address — the prefix REPLACES the 0x, it
 * is not prepended to it; probe-proven 2026-11-24 with the test-vector
 * address ronin:9858EfFD232B4033E47d90003D41EC34EcaEda94). The EVM RPCs
 * and viem take the bare 0x form, so restore the 0x here, at the
 * adapter boundary, and the adapter serves Ronin exactly like the
 * other 0x EVM chains. A `ronin:0x…` spelling is accepted too.
 * Every other chain passes through unchanged.
 * Exported for the send path (wallet/send.ts): the UI validates a
 * `ronin:` recipient as correct — it is the wallet's own address
 * form — so signing must accept it too instead of failing on the
 * non-0x `to` (Lane B, token-verify, 2026-11-24).
 */
export function normalizeEvmAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed.startsWith('ronin:')) return trimmed;
  const stripped = trimmed.slice('ronin:'.length);
  return stripped.startsWith('0x') ? stripped : `0x${stripped}`;
}

interface BlockscoutV2ParseOpts {
  chain: ChainId;
  networkId: string;
  address: string;
  explorerBase?: string;
}

// Partials fix (2026-11-28): Blockscout v2 REST parsers, for the
// fallback in createEvmAdapter. The v2 shapes were probed live from
// loud-stone (eth.blockscout.com/api/v2): the transactions list is
// {items, next_page_params} with per-item {hash, block_number,
// timestamp (ISO), status ('ok'|'error'), value (string),
// from/to: {hash} (to is null on contract creation), fee: {value}};
// the token-transfers list is the same envelope with per-item
// {transaction_hash, block_number, timestamp (ISO), from/to: {hash},
// token: {address_hash, symbol, decimals (string)}, total: {value}}.
// Strict, like parseEthTx in tracker.ts: a malformed item fails the
// whole page (null) so the caller keeps the primary error instead of
// showing invented rows. A `to` of null is valid (contract creation),
// not malformed.
function blockscoutV2Tx(
  hash: string,
  fromRaw: string,
  toRaw: string,
  value: string,
  timestampMs: number | null,
  failed: boolean,
  opts: BlockscoutV2ParseOpts,
  token?: { symbol: string; decimals: number },
): AdapterTx {
  const lower = opts.address.toLowerCase();
  const from = fromRaw.toLowerCase();
  const to = toRaw.toLowerCase();
  const fromSelf = from === lower;
  const toSelf = to === lower;
  return {
    hash,
    chain: opts.chain,
    networkId: opts.networkId,
    direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
    amountBaseUnits: value,
    counterparty:
      fromSelf && toSelf ? null : fromSelf ? toRaw || null : fromRaw || null,
    timestamp: timestampMs,
    status: failed ? 'failed' : 'confirmed',
    explorerUrl:
      opts.explorerBase !== undefined
        ? `${opts.explorerBase}/tx/${hash}`
        : null,
    ...(token !== undefined ? { token } : {}),
  };
}

export function parseBlockscoutV2TxList(
  raw: unknown,
  opts: BlockscoutV2ParseOpts,
): AdapterTx[] | null {
  if (!isRecord(raw) || !Array.isArray(raw['items'])) return null;
  const txs: AdapterTx[] = [];
  for (const item of raw['items']) {
    if (!isRecord(item)) return null;
    const hash = typeof item['hash'] === 'string' ? item['hash'] : null;
    const value = typeof item['value'] === 'string' ? item['value'] : null;
    if (hash === null || value === null) return null;
    const from = isRecord(item['from']) ? item['from'] : null;
    const to = isRecord(item['to']) ? item['to'] : null;
    if (from === null || typeof from['hash'] !== 'string') return null;
    const toRaw =
      to !== null && typeof to['hash'] === 'string' ? to['hash'] : '';
    const parsedTime =
      typeof item['timestamp'] === 'string'
        ? Date.parse(item['timestamp'])
        : NaN;
    txs.push(
      blockscoutV2Tx(
        hash,
        from['hash'],
        toRaw,
        value,
        Number.isFinite(parsedTime) ? parsedTime : null,
        item['status'] === 'error',
        opts,
      ),
    );
  }
  return txs;
}

export interface BlockscoutV2TokenTransfersPage {
  txs: AdapterTx[];
  nextPageParams: Record<string, string | number> | null;
}

export function parseBlockscoutV2TokenTransfers(
  raw: unknown,
  opts: BlockscoutV2ParseOpts & { contract: string },
): BlockscoutV2TokenTransfersPage | null {
  if (!isRecord(raw) || !Array.isArray(raw['items'])) return null;
  // The server-side ?token= filter hangs (probed live 2026-11-28,
  // same slow path as v1's contractaddress filter), so the token is
  // filtered client-side on token.address_hash.
  const contract = opts.contract.toLowerCase();
  const txs: AdapterTx[] = [];
  for (const item of raw['items']) {
    if (!isRecord(item)) return null;
    const token = isRecord(item['token']) ? item['token'] : null;
    const tokenAddress =
      token !== null && typeof token['address_hash'] === 'string'
        ? token['address_hash']
        : '';
    if (tokenAddress.toLowerCase() !== contract) continue;
    const hash =
      typeof item['transaction_hash'] === 'string'
        ? item['transaction_hash']
        : null;
    const total = isRecord(item['total']) ? item['total'] : null;
    const value =
      total !== null && typeof total['value'] === 'string'
        ? total['value']
        : null;
    if (hash === null || value === null) return null;
    const from = isRecord(item['from']) ? item['from'] : null;
    const to = isRecord(item['to']) ? item['to'] : null;
    if (from === null || typeof from['hash'] !== 'string') return null;
    const toRaw =
      to !== null && typeof to['hash'] === 'string' ? to['hash'] : '';
    const parsedTime =
      typeof item['timestamp'] === 'string'
        ? Date.parse(item['timestamp'])
        : NaN;
    const symbol =
      token !== null && typeof token['symbol'] === 'string'
        ? token['symbol']
        : '';
    const decimals =
      token !== null && typeof token['decimals'] === 'string'
        ? Number(token['decimals'])
        : NaN;
    txs.push(
      blockscoutV2Tx(
        hash,
        from['hash'],
        toRaw,
        value,
        Number.isFinite(parsedTime) ? parsedTime : null,
        false,
        opts,
        symbol !== '' && Number.isFinite(decimals)
          ? { symbol, decimals }
          : undefined,
      ),
    );
  }
  // Keyset pagination for the next page, or null at the end of the
  // list. Only string/number params survive — anything else cannot
  // be a query param, so a page carrying none is the end.
  const next = isRecord(raw['next_page_params'])
    ? raw['next_page_params']
    : null;
  let nextPageParams: Record<string, string | number> | null = null;
  if (next !== null) {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === 'string' || typeof value === 'number') {
        params[key] = value;
      }
    }
    nextPageParams =
      Object.keys(params).length > 0 ? params : null;
  }
  return { txs, nextPageParams };
}

export function createEvmAdapter(
  config: EvmAdapterConfig,
  overrides: EvmAdapterOverrides = {},
): ChainAdapter {
  const rpcUrl = overrides.rpcUrl ?? config.rpcUrl;
  // Devnet overrides fall back to the configured mainnet values, so a
  // mainnet adapter constructed without them is byte-for-byte the old one.
  const networkId = overrides.networkId ?? config.networkId;
  const evmChainId = overrides.evmChainId ?? config.evmChainId;
  // RPC failover (UI/UX fixes, item 19): one viem client per endpoint,
  // built lazily and rebuilt only when the resolved list changes, so a
  // manager change applies on the next call. An injected client (tests,
  // devnet Sepolia) is the only client and keeps the configured source
  // label; a URL-built client reports its own hostname as the source, so
  // a balance that came through the backup never claims the primary.
  interface EndpointClient {
    client: PublicClient;
    source: string;
  }
  let cachedClients: EndpointClient[] | null = null;
  let cachedUrlsKey = '';
  const getClients = (): EndpointClient[] => {
    if (overrides.client !== undefined) {
      return [{ client: overrides.client, source: config.source }];
    }
    const urls = resolveEndpoints(overrides.rpcUrls, [rpcUrl]);
    const key = urls.join('\n');
    if (cachedClients === null || cachedUrlsKey !== key) {
      cachedClients = urls.map((url) => ({
        client: createPublicClient({
          chain: defineChain({
            id: evmChainId,
            name: config.chainName,
            nativeCurrency: {
              name: config.chainName,
              symbol: config.nativeSymbol,
              decimals: 18,
            },
            rpcUrls: { default: { http: [url] } },
          }),
          transport: http(url, {
            // No per-transport retries: the adapter's own endpoint loop
            // is the failover. A dead endpoint must fail fast (one
            // attempt) instead of burning 4 attempts × retryDelay here.
            retryCount: 0,
          }),
        }),
        source: endpointHost(url),
      }));
      cachedUrlsKey = key;
    }
    return cachedClients;
  };
  const historyBaseUrl = overrides.historyBaseUrl ?? config.historyBaseUrl;
  const historyExplorerBase =
    overrides.historyExplorerBase ?? config.historyExplorerBase;
  // The history source label names the indexer that answered: an
  // explicit config label wins (Lane D: optimism-explorer, scrollscan);
  // otherwise derive it from the URL — Routescan for Ethereum/
  // Avalanche/Mantle, Blockscout v2 ('blockscout-v2') is set by the
  // fallback below, not derived here.
  // Etherscan V2 for Linea, gnosisscan for Gnosis (Etherscan v1 API,
  // 2026-11-28), Blockscout instances for the rest (Lane B).
  const historySource =
    config.historySource ??
    (historyBaseUrl?.includes('routescan')
      ? 'routescan'
      : historyBaseUrl?.includes('etherscan.io')
        ? 'etherscan-v2'
        : historyBaseUrl?.includes('gnosisscan.io')
          ? 'gnosisscan'
          : 'blockscout');
  const transport = overrides.transport ?? httpFetchTransport;
  const readJson = (url: string, operation: string): Promise<unknown> =>
    withRetry(() => transport.request(url), { operation });

  // Partials fix (2026-11-28): the Blockscout v2 REST fallback base.
  // The v1 Etherscan-compatible API and the v2 REST API live on
  // separate rate-limit buckets on the same host (v1: 10, v2: 180 —
  // probed live 2026-11-28, v1 429ing while v2 answered 200), so when
  // the primary errors the v2 read can still answer. Only chains whose
  // explorer base is a Blockscout host get one (eth, matic, base, arb,
  // celo); Routescan/Etherscan/scrollscan hosts have no v2 endpoint
  // here, and their primary is the only path.
  const blockscoutV2Base: string | undefined = (() => {
    if (historyExplorerBase === undefined) return undefined;
    let host: string;
    try {
      host = new URL(historyExplorerBase).hostname;
    } catch {
      return undefined;
    }
    return host === 'blockscout.com' || host.endsWith('.blockscout.com')
      ? `${historyExplorerBase}/api/v2`
      : undefined;
  })();

  // Runs after the Etherscan-compatible primary errors transiently,
  // and only then (a terminal primary error never reaches here).
  // Returns null when there is no v2 endpoint, when a v2 page fails,
  // or when a token walk finds nothing in its bounded pages — all
  // inconclusive, so the caller keeps the primary error instead of
  // showing a false "no transactions". A v2 success is a real answer
  // with source 'blockscout-v2' (an empty txlist page is conclusive:
  // the list is newest-first, so empty means no transactions at all).
  const fetchBlockscoutV2 = async (
    action: 'txlist' | 'tokentx',
    address: string,
    limit: number,
    contract?: string,
  ): Promise<AdapterResult<AdapterTx[]> | null> => {
    if (blockscoutV2Base === undefined) return null;
    const normalized = normalizeEvmAddress(address);
    // The v2 token-transfers list is slow (13–30 s a page, probed
    // live 2026-11-28) — one attempt per page with a 30 s timeout, no
    // retry loop: retrying a slow endpoint only burns the UI's
    // patience, and the primary already spent its own retries.
    const readV2Page = async (url: string): Promise<unknown | null> => {
      try {
        return await withRetry(
          () => transport.request(url, undefined, 30000),
          { operation: `${config.chain}.blockscoutV2`, maxAttempts: 1 },
        );
      } catch {
        return null;
      }
    };
    if (action === 'txlist') {
      const raw = await readV2Page(
        `${blockscoutV2Base}/addresses/${normalized}/transactions?items_count=${limit}`,
      );
      if (raw === null) return null;
      const txs = parseBlockscoutV2TxList(raw, {
        chain: config.chain,
        networkId,
        address: normalized,
        explorerBase: historyExplorerBase,
      });
      return txs === null
        ? null
        : {
            status: 'ok',
            data: txs,
            source: 'blockscout-v2',
            fetchedAt: Date.now(),
          };
    }
    if (contract === undefined) return null;
    const found: AdapterTx[] = [];
    let url =
      `${blockscoutV2Base}/addresses/${normalized}/token-transfers` +
      `?type=ERC-20&items_count=50`;
    // Bounded walk: at most 3 pages, stopping early once `limit`
    // matching transfers are found. The list is newest-first and a
    // token's transfers may sit pages deep (the EF address's newest
    // USDC transfer is on the first 50-page; the older two are not),
    // so one page is not enough — but an unbounded walk would page
    // through the address's whole ERC-20 history at ~20 s a page.
    for (let page = 0; page < 3 && found.length < limit; page += 1) {
      const raw = await readV2Page(url);
      if (raw === null) return null;
      const parsed = parseBlockscoutV2TokenTransfers(raw, {
        chain: config.chain,
        networkId,
        address: normalized,
        explorerBase: historyExplorerBase,
        contract,
      });
      if (parsed === null) return null;
      found.push(...parsed.txs.slice(0, limit - found.length));
      if (found.length >= limit) break;
      if (parsed.nextPageParams === null) {
        // Walked to the end of the list: zero matches is a settled
        // empty answer, not an inconclusive one.
        return {
          status: 'ok',
          data: found,
          source: 'blockscout-v2',
          fetchedAt: Date.now(),
        };
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(parsed.nextPageParams)) {
        query.set(key, String(value));
      }
      url =
        `${blockscoutV2Base}/addresses/${normalized}/token-transfers` +
        `?type=ERC-20&items_count=50&${query.toString()}`;
    }
    // Matches found are a real answer; none after the bounded walk
    // proves nothing (more pages may hold the token's transfers), so
    // the caller keeps the primary error.
    return found.length > 0
      ? {
          status: 'ok',
          data: found,
          source: 'blockscout-v2',
          fetchedAt: Date.now(),
        }
      : null;
  };

  /**
   * Runs one read on the first endpoint that is both reachable and
   * serving the expected chain, and returns the answering endpoint's
   * source with the value. A wrong chain id is a failure for that
   * endpoint (the next one is tried); when every endpoint fails, the
   * last error surfaces — a wrong-chain error when that is what every
   * endpoint reported, a transport error when the network is down.
   * Chain identity is checked on every call, per endpoint.
   */
  const runOnHealthyClient = async <T>(
    operation: (client: PublicClient) => Promise<T>,
  ): Promise<{ value: T; source: string }> => {
    let lastError: unknown = new Error('No RPC endpoints configured.');
    for (const { client, source } of getClients()) {
      try {
        const chainId = await client.getChainId();
        if (chainId !== evmChainId) {
          lastError = new Error(
            `Network identity mismatch: expected chain ${evmChainId} ` +
              `(${networkId}), got ${chainId}.`,
          );
          continue;
        }
        assertNetworkId(`eip155:${chainId}`, networkId, source);
        const value = await operation(client);
        return { value, source };
      } catch (error: unknown) {
        lastError = error;
      }
    }
    throw lastError;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    const normalized = normalizeEvmAddress(address);
    if (!isAddress(normalized)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    try {
      const { value: balance, source } = await runOnHealthyClient((client) =>
        client.getBalance({ address: getAddress(normalized) }),
      );
      return {
        status: 'ok',
        data: {
          chain: config.chain,
          address: getAddress(normalized),
          networkId,
          valueBaseUnits: balance.toString(),
          decimals: 18,
          source,
          fetchedAt: Date.now(),
        },
        source,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return toAdapterError(error);
    }
  };

  // Watch-only display programme: the txlist and tokentx calls share
  // one fetch + parse (same host, same quota window, same entry shape);
  // only the action and the token field differ.
  const fetchAccountTransactions = async (
    action: 'txlist' | 'tokentx',
    address: string,
    limit: number,
    contract?: string,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    const normalized = normalizeEvmAddress(address);
    if (!isAddress(normalized)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    if (!historyBaseUrl) {
      return {
        status: 'unavailable',
        // Fix-all Lane H, item 6: four chains stay balance-only — no
        // keyless indexer covers them — so the reason says so, and that
        // the balance still loads. Shown as-is by humanReasonMessage.
        // (Gnosis left this set 2026-11-28: gnosisscan.io answers keyless.)
        reason: `History is not connected for ${config.chainName} yet — no keyless indexer covers this chain, so only the balance shows here.`,
      };
    }
    try {
      await runOnHealthyClient((client) => client.getChainId());
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    // The primary Etherscan-compatible read, extracted so the v2
    // fallback below can run when it errors — a primary 'ok' (rows
    // or an empty list) is never second-guessed.
    const fetchEtherscanCompatible = async (): Promise<
      AdapterResult<AdapterTx[]>
    > => {
      // A history base URL may already carry a query string (Linea's
      // Etherscan V2 base carries ?chainid=59144): join with '&' then,
      // '?' otherwise. A second '?' would make the whole query one
      // opaque parameter and Etherscan would ignore the txlist module.
      const separator = historyBaseUrl.includes('?') ? '&' : '?';
      const operation = action === 'tokentx' ? 'getTokenHistory' : 'getHistory';
      const contractParam =
        contract !== undefined ? `&contractaddress=${contract}` : '';
      const url =
        `${historyBaseUrl}${separator}module=account&action=${action}` +
        `&address=${normalized}${contractParam}&page=1&offset=${limit}&sort=desc`;
      // Merge lane (2026-11-24): Etherscan V2's keyless tier allows 1
      // request per 5 s per IP, and answers NOTOK "Missing/Invalid API
      // Key" inside the window — the same message as a missing key, so
      // it looks like keyless access ended when it did not (proven live:
      // a quiet call without any apikey parameter returns status 1 with
      // real transactions). The app fires the history refresh twice in
      // quick succession (boot + page), so the second Linea call lands
      // inside the window, and the store's request counter discards the
      // first (good) result — the page ends on "No transactions yet".
      // One retry after 6 s clears the window; a second NOTOK is
      // returned as the error, as before. No key is used or needed.
      let raw: unknown;
      for (let attempt = 1; ; attempt += 1) {
        try {
          raw = await readJson(url, `${config.chain}.${operation}`);
        } catch (error: unknown) {
          return toAdapterError(error);
        }
        // The quota signal is in `result`, not `message`: Etherscan
        // answers { status: '0', message: 'NOTOK', result:
        // 'Missing/Invalid API Key' } inside the 5 s window. (isRecord
        // narrows `raw` first — it is still `unknown` here.)
        const quotaHit =
          historySource === 'etherscan-v2' &&
          attempt === 1 &&
          isRecord(raw) &&
          raw['status'] !== '1' &&
          ((typeof raw['message'] === 'string' &&
            raw['message'].includes('Missing/Invalid API Key')) ||
            (typeof raw['result'] === 'string' &&
              raw['result'].includes('Missing/Invalid API Key')));
        if (!quotaHit) break;
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }
      if (!isRecord(raw)) {
        return { status: 'error', reason: 'Invalid response: expected an object' };
      }
      if (raw['status'] !== '1') {
        const message = typeof raw['message'] === 'string' ? raw['message'] : '';
        if (message.includes('No transactions found')) {
          return { status: 'ok', data: [], source: historySource, fetchedAt: Date.now() };
        }
        return { status: 'error', reason: message || 'History request failed' };
      }
      if (!Array.isArray(raw['result'])) {
        return { status: 'error', reason: 'Invalid response: expected a result list' };
      }
      const lower = normalized.toLowerCase();
      const txs: AdapterTx[] = [];
      for (const entry of raw['result']) {
        if (!isRecord(entry)) continue;
        const hash = typeof entry['hash'] === 'string' ? entry['hash'] : '';
        const fromRaw = typeof entry['from'] === 'string' ? entry['from'] : '';
        const toRaw = typeof entry['to'] === 'string' ? entry['to'] : '';
        const from = fromRaw.toLowerCase();
        const to = toRaw.toLowerCase();
        const value = typeof entry['value'] === 'string' ? entry['value'] : '0';
        const timeStamp =
          typeof entry['timeStamp'] === 'string' ? Number(entry['timeStamp']) : NaN;
        const receiptStatus = entry['txreceipt_status'];
        const isError = entry['isError'];
        const failed = receiptStatus === '0' || isError === '1';
        const fromSelf = from === lower;
        const toSelf = to === lower;
        const tokenSymbol =
          typeof entry['tokenSymbol'] === 'string' ? entry['tokenSymbol'] : '';
        const tokenDecimal =
          typeof entry['tokenDecimal'] === 'string'
            ? Number(entry['tokenDecimal'])
            : NaN;
        txs.push({
          hash,
          chain: config.chain,
          networkId,
          direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
          amountBaseUnits: value,
          counterparty:
            fromSelf && toSelf ? null : fromSelf ? toRaw || null : fromRaw || null,
          timestamp: Number.isFinite(timeStamp) ? timeStamp * 1000 : null,
          status: failed ? 'failed' : 'confirmed',
          explorerUrl:
            historyExplorerBase !== undefined
              ? `${historyExplorerBase}/tx/${hash}`
              : null,
          // A tokentx entry names its token; the amount is in that
          // token's smallest units, so the row carries the token with it.
          ...(action === 'tokentx' &&
          tokenSymbol !== '' &&
          Number.isFinite(tokenDecimal)
            ? { token: { symbol: tokenSymbol, decimals: tokenDecimal } }
            : {}),
        });
      }
      return { status: 'ok', data: txs, source: historySource, fetchedAt: Date.now() };
    };
    const primary = await fetchEtherscanCompatible();
    if (primary.status !== 'error') return primary;
    // Item 2 ("does not retry a terminal 404"): a terminal primary
    // error is the indexer's settled answer, not a reason to try
    // another endpoint. Only transient failures fall back — the same
    // signals withRetry retries on (429 / 5xx / timeouts / network
    // errors, per classifyRetryableError), plus a rate-limit message
    // in the body. toAdapterError keeps the thrown message verbatim
    // as the reason, so the reason string carries the signal.
    const transient =
      /^(HTTP (?:429|502|503|504)|Network error: )/.test(primary.reason) ||
      /rate limit/i.test(primary.reason);
    if (!transient) return primary;
    return (
      await fetchBlockscoutV2(action, address, limit, contract)
    ) ?? primary;
  };

  const getHistory = async (
    address: string,
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> =>
    fetchAccountTransactions('txlist', address, limit);

  // Watch-only display programme: the transfers of one token
  // (Etherscan-compatible `tokentx`, same host as txlist), so the
  // asset-detail token route can show real history.
  const getTokenHistory = async (
    contract: string,
    address: string,
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isAddress(contract)) {
      return { status: 'error', reason: 'Invalid token contract address' };
    }
    return fetchAccountTransactions('tokentx', address, limit, contract);
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    try {
      const { value: gasPrice, source } = await runOnHealthyClient((client) =>
        client.getGasPrice(),
      );
      return {
        status: 'ok',
        data: {
          chain: config.chain,
          networkId,
          feeBaseUnits: (gasPrice * 21000n).toString(),
          unit: 'wei',
          note: 'Native-transfer estimate at current gas price, 21000 gas; not a final fee',
          source,
          fetchedAt: Date.now(),
        },
        source,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return toAdapterError(error);
    }
  };

  // P2-A, M2: live fee data for the Slow / Standard / Fast tiers.
  // estimateFeesPerGas reads the chain's fee market (eth_feeHistory
  // + priority-fee estimation) on the same healthy client the flat
  // fee uses. A chain without EIP-1559 fees throws there, so fall
  // back to the gas price as the max fee with a zero priority fee —
  // the tier still varies a real number, and the priority row is
  // omitted downstream rather than shown as a fake 0. Both reads
  // failing means the tiers are unavailable, never guessed.
  const estimateFeeTiers = async (): Promise<
    AdapterResult<FeeTierData>
  > => {
    try {
      const { value, source } = await runOnHealthyClient(async (client) => {
        try {
          const fees = await client.estimateFeesPerGas();
          return {
            maxFeePerGasWei: fees.maxFeePerGas.toString(),
            maxPriorityFeePerGasWei: fees.maxPriorityFeePerGas.toString(),
          };
        } catch {
          const gasPrice = await client.getGasPrice();
          return {
            maxFeePerGasWei: gasPrice.toString(),
            maxPriorityFeePerGasWei: '0',
          };
        }
      });
      return {
        status: 'ok',
        data: {
          chain: config.chain,
          networkId,
          maxFeePerGasWei: value.maxFeePerGasWei,
          maxPriorityFeePerGasWei: value.maxPriorityFeePerGasWei,
        },
        source,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return toAdapterError(error);
    }
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const normalized = normalizeEvmAddress(address);
    if (!isAddress(normalized)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    try {
      const { value: nonce, source } = await runOnHealthyClient((client) =>
        // 'pending' counts transactions already in the mempool: with
        // the default 'latest' a second send made while the first is
        // still pending reuses its nonce and replaces it (A-4).
        client.getTransactionCount({
          address: getAddress(normalized),
          blockTag: 'pending',
        }),
      );
      return {
        status: 'ok',
        data: { kind: 'nonce', nonce },
        source,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return toAdapterError(error);
    }
  };

  // Mainnet: always throws. Devnet: the injected devnet broadcast.
  const broadcast: ChainAdapter['broadcast'] =
    overrides.broadcast ?? createDisabledBroadcast();

  return {
    chain: config.chain,
    networkId,
    getBalance,
    getHistory,
    getTokenHistory,
    estimateFee,
    estimateFeeTiers,
    getTxInputs,
    broadcast,
  };
}
