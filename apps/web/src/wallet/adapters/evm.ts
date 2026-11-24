/**
 * Generalised EVM adapter (token discovery).
 *
 * One factory for the six EVM chains that share the eth.ts pattern:
 * a viem public client on the chain's pinned RPC, chain-id checked on
 * every call, native balance via getBalance, nonce tx inputs, and a
 * 21000-gas native-transfer fee estimate. History reads the
 * Etherscan-compatible txlist API whenever a history endpoint is
 * configured — Ethereum, Optimism, Scroll, Celo and Aurora via
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
  /** Blockscout-shaped history base URL (Ethereum, Celo, Optimism, Scroll). */
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

export interface EvmAdapterOverrides {
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
 */
function normalizeEvmAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed.startsWith('ronin:')) return trimmed;
  const stripped = trimmed.slice('ronin:'.length);
  return stripped.startsWith('0x') ? stripped : `0x${stripped}`;
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
  // otherwise derive it from the URL — Routescan for Avalanche/Mantle,
  // Etherscan V2 for Linea, Blockscout instances for the rest (Lane B).
  const historySource =
    config.historySource ??
    (historyBaseUrl?.includes('routescan')
      ? 'routescan'
      : historyBaseUrl?.includes('etherscan.io')
        ? 'etherscan-v2'
        : 'blockscout');
  const transport = overrides.transport ?? httpFetchTransport;
  const readJson = (url: string, operation: string): Promise<unknown> =>
    withRetry(() => transport.request(url), { operation });

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

  const getHistory = async (
    address: string,
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    const normalized = normalizeEvmAddress(address);
    if (!isAddress(normalized)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    if (!historyBaseUrl) {
      return {
        status: 'unavailable',
        // Fix-all Lane H, item 6: five chains stay balance-only — no
        // keyless indexer covers them — so the reason says so, and that
        // the balance still loads. Shown as-is by humanReasonMessage.
        reason: `History is not connected for ${config.chainName} yet — no keyless indexer covers this chain, so only the balance shows here.`,
      };
    }
    try {
      await runOnHealthyClient((client) => client.getChainId());
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    // A history base URL may already carry a query string (Linea's
    // Etherscan V2 base carries ?chainid=59144): join with '&' then,
    // '?' otherwise. A second '?' would make the whole query one
    // opaque parameter and Etherscan would ignore the txlist module.
    const separator = historyBaseUrl.includes('?') ? '&' : '?';
    const url =
      `${historyBaseUrl}${separator}module=account&action=txlist` +
      `&address=${normalized}&page=1&offset=${limit}&sort=desc`;
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
        raw = await readJson(url, `${config.chain}.getHistory`);
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
      });
    }
    return { status: 'ok', data: txs, source: historySource, fetchedAt: Date.now() };
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

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const normalized = normalizeEvmAddress(address);
    if (!isAddress(normalized)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    try {
      const { value: nonce, source } = await runOnHealthyClient((client) =>
        client.getTransactionCount({ address: getAddress(normalized) }),
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
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
