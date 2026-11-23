/**
 * Generalised EVM adapter (token discovery).
 *
 * One factory for the six EVM chains that share the eth.ts pattern:
 * a viem public client on the chain's pinned RPC, chain-id checked on
 * every call, native balance via getBalance, nonce tx inputs, and a
 * 21000-gas native-transfer fee estimate. History is Blockscout-shaped
 * only when a history endpoint is configured (Ethereum today); the other
 * EVM chains report history unavailable — never faked. Broadcast stays
 * disabled.
 */
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  type PublicClient,
} from 'viem';
import type { ChainId } from '../../engine/boundary';
import {
  assertNetworkId,
  BROADCAST_DISABLED_MESSAGE,
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
  /** Blockscout-shaped history base URL (Ethereum only today). */
  historyBaseUrl?: string;
  /** Explorer base for history links, e.g. https://eth.blockscout.com. */
  historyExplorerBase?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    try {
      const { value: balance, source } = await runOnHealthyClient((client) =>
        client.getBalance({ address: getAddress(address) }),
      );
      return {
        status: 'ok',
        data: {
          chain: config.chain,
          address: getAddress(address),
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
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    if (!historyBaseUrl) {
      return {
        status: 'unavailable',
        reason: `History is not connected for ${config.chainName} yet.`,
      };
    }
    try {
      await runOnHealthyClient((client) => client.getChainId());
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const url =
      `${historyBaseUrl}?module=account&action=txlist` +
      `&address=${address}&page=1&offset=${limit}&sort=desc`;
    let raw: unknown;
    try {
      raw = await readJson(url, `${config.chain}.getHistory`);
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (!isRecord(raw)) {
      return { status: 'error', reason: 'Invalid response: expected an object' };
    }
    if (raw['status'] !== '1') {
      const message = typeof raw['message'] === 'string' ? raw['message'] : '';
      if (message.includes('No transactions found')) {
        return { status: 'ok', data: [], source: 'blockscout', fetchedAt: Date.now() };
      }
      return { status: 'error', reason: message || 'Blockscout request failed' };
    }
    if (!Array.isArray(raw['result'])) {
      return { status: 'error', reason: 'Invalid response: expected a result list' };
    }
    const lower = address.toLowerCase();
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
    return { status: 'ok', data: txs, source: 'blockscout', fetchedAt: Date.now() };
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
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    try {
      const { value: nonce, source } = await runOnHealthyClient((client) =>
        client.getTransactionCount({ address: getAddress(address) }),
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
    overrides.broadcast ??
    (async (_signedTx: unknown): Promise<never> => {
      throw new Error(BROADCAST_DISABLED_MESSAGE);
    });

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
