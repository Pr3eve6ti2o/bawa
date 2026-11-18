import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type PublicClient,
} from 'viem';
import { mainnet } from 'viem/chains';
import {
  assertNetworkId,
  BROADCAST_DISABLED_MESSAGE,
  fetchJson,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type ChainAdapter,
  type FeeEstimate,
  type TxInput,
} from './types';

const NETWORK_ID = 'eip155:1';
const RPC_URL = 'https://ethereum-rpc.publicnode.com';
const HISTORY_BASE_URL = 'https://eth.blockscout.com/api';
const SOURCE = 'publicnode';
const DECIMALS = 18;

export interface EthAdapterOverrides {
  client?: PublicClient;
  historyBaseUrl?: string;
  rpcUrl?: string;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** True when `value` is a record with the given string key. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEthAdapter(overrides: EthAdapterOverrides = {}): ChainAdapter {
  const client: PublicClient =
    overrides.client ??
    createPublicClient({
      chain: mainnet,
      transport: http(overrides.rpcUrl ?? RPC_URL),
    });
  const historyBaseUrl = overrides.historyBaseUrl ?? HISTORY_BASE_URL;

  /**
   * Chain identity, checked on every call: the RPC must report chain 1.
   * Returns an error result on mismatch, null when the network is mainnet.
   * No silent fallback to another RPC.
   */
  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    let chainId: number;
    try {
      chainId = await client.getChainId();
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
    if (chainId !== 1) {
      return {
        status: 'error',
        reason: `Network identity mismatch: expected chain 1 (eip155:1), got ${chainId}.`,
      };
    }
    // The RPC's chain id maps to the CAIP-2 network id; verify the mapping.
    assertNetworkId(`eip155:${chainId}`, NETWORK_ID, SOURCE);
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    try {
      const balance = await client.getBalance({ address: getAddress(address) });
      return {
        status: 'ok',
        data: {
          chain: 'eth',
          address: getAddress(address),
          networkId: NETWORK_ID,
          valueBaseUnits: balance.toString(),
          decimals: DECIMALS,
          source: SOURCE,
          fetchedAt: Date.now(),
        },
        source: SOURCE,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
  };

  const getHistory = async (
    address: string,
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    const url =
      `${historyBaseUrl}?module=account&action=txlist` +
      `&address=${address}&page=1&offset=${limit}&sort=desc`;
    let raw: unknown;
    try {
      raw = await fetchJson(url);
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
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
        chain: 'eth',
        networkId: NETWORK_ID,
        direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
        amountBaseUnits: value,
        counterparty:
          fromSelf && toSelf ? null : fromSelf ? toRaw || null : fromRaw || null,
        timestamp: Number.isFinite(timeStamp) ? timeStamp * 1000 : null,
        status: failed ? 'failed' : 'confirmed',
        explorerUrl: `https://eth.blockscout.com/tx/${hash}`,
      });
    }
    return { status: 'ok', data: txs, source: 'blockscout', fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireMainnet();
    if (identity) return identity;
    try {
      const gasPrice = await client.getGasPrice();
      return {
        status: 'ok',
        data: {
          chain: 'eth',
          networkId: NETWORK_ID,
          feeBaseUnits: (gasPrice * 21000n).toString(),
          unit: 'wei',
          note: 'Native-transfer estimate at current gas price, 21000 gas; not a final fee',
          source: SOURCE,
          fetchedAt: Date.now(),
        },
        source: SOURCE,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    if (!isAddress(address)) {
      return { status: 'error', reason: 'Invalid Ethereum address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    try {
      const nonce = await client.getTransactionCount({ address: getAddress(address) });
      return {
        status: 'ok',
        data: { kind: 'nonce', nonce },
        source: SOURCE,
        fetchedAt: Date.now(),
      };
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
  };

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'eth',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
