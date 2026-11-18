import {
  BROADCAST_DISABLED_MESSAGE,
  fetchJson,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type ChainAdapter,
  type FeeEstimate,
  type TxInput,
} from './types';

const NETWORK_ID = 'ton:-239';
const BASE_URL = 'https://toncenter.com/api/v2/jsonRPC';
const SOURCE = 'toncenter';
const DECIMALS = 9;

export interface TonAdapterOverrides {
  baseUrl?: string;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTonAddress(address: string): boolean {
  return address.length === 48 && (address.startsWith('EQ') || address.startsWith('UQ'));
}

/** Base64 (TonCenter tx hashes) to lowercase hex, without Buffer. */
export function base64ToHex(base64: string): string {
  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export function createTonAdapter(
  overrides: TonAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  // Chain-identity check result, cached per instance: TON's identity rests
  // on the pinned mainnet host (testnet lives on testnet.toncenter.com).
  // The host is fixed at construction, so one check per instance is enough.
  let identityChecked = false;

  const rpc = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<AdapterResult<unknown>> => {
    let raw: unknown;
    try {
      raw = await fetchJson(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
      });
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
    if (!isRecord(raw)) {
      return { status: 'error', reason: 'Invalid response: expected an object' };
    }
    if (raw['ok'] !== true) {
      const error = raw['error'];
      return {
        status: 'error',
        reason:
          typeof error === 'string'
            ? error
            : isRecord(error) && typeof error['message'] === 'string'
              ? error['message']
              : `TonCenter request failed (${method})`,
      };
    }
    return { status: 'ok', data: raw['result'], source: SOURCE, fetchedAt: Date.now() };
  };

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    const result = await rpc('getMasterchainInfo', {});
    if (result.status !== 'ok') return result;
    const last = isRecord(result.data) ? result.data['last'] : undefined;
    const seqno = isRecord(last) ? last['seqno'] : undefined;
    if (typeof seqno !== 'number') {
      return {
        status: 'error',
        reason: 'Network identity check failed: TonCenter did not return masterchain info.',
      };
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isTonAddress(address)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    const result = await rpc('getAddressBalance', { address });
    if (result.status !== 'ok') return result;
    if (typeof result.data !== 'string') {
      return { status: 'error', reason: 'Invalid response: expected a balance string' };
    }
    return {
      status: 'ok',
      data: {
        chain: 'ton',
        address,
        networkId: NETWORK_ID,
        valueBaseUnits: result.data,
        decimals: DECIMALS,
        source: SOURCE,
        fetchedAt: Date.now(),
      },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const getHistory = async (
    address: string,
    limit = 10,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isTonAddress(address)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    const result = await rpc('getTransactions', { address, limit });
    if (result.status !== 'ok') return result;
    if (!Array.isArray(result.data)) {
      return { status: 'error', reason: 'Invalid response: expected a transaction list' };
    }
    const txs: AdapterTx[] = [];
    for (const entry of result.data) {
      if (!isRecord(entry)) continue;
      const txId = isRecord(entry['transaction_id']) ? entry['transaction_id'] : undefined;
      const hashBase64 =
        isRecord(txId) && typeof txId['hash'] === 'string' ? txId['hash'] : '';
      if (!hashBase64) continue;
      const hash = base64ToHex(hashBase64);
      const utime = typeof entry['utime'] === 'number' ? entry['utime'] : NaN;
      const inMsg = isRecord(entry['in_msg']) ? entry['in_msg'] : undefined;
      const outMsgs = Array.isArray(entry['out_msgs']) ? entry['out_msgs'] : [];
      const firstOut = isRecord(outMsgs[0]) ? outMsgs[0] : undefined;
      let direction: AdapterTx['direction'];
      let amount = '0';
      let counterparty: string | null = null;
      if (firstOut) {
        direction = 'out';
        amount = typeof firstOut['value'] === 'string' ? firstOut['value'] : '0';
        counterparty =
          typeof firstOut['destination'] === 'string' ? firstOut['destination'] : null;
      } else if (inMsg) {
        direction = 'in';
        amount = typeof inMsg['value'] === 'string' ? inMsg['value'] : '0';
        counterparty =
          typeof inMsg['source'] === 'string' && inMsg['source'] !== ''
            ? inMsg['source']
            : null;
      } else {
        // No in- or out-message to attribute: skip rather than fabricate.
        continue;
      }
      // A wallet sending to its own address is a self-transfer.
      const outDest =
        firstOut && typeof firstOut['destination'] === 'string'
          ? firstOut['destination']
          : '';
      if (direction === 'out' && outDest === address) {
        direction = 'self';
        counterparty = null;
      }
      txs.push({
        hash,
        chain: 'ton',
        networkId: NETWORK_ID,
        direction,
        amountBaseUnits: amount,
        counterparty,
        timestamp: Number.isFinite(utime) ? utime * 1000 : null,
        status: 'confirmed',
        explorerUrl: `https://tonviewer.com/transaction/${hash}`,
      });
    }
    return { status: 'ok', data: txs, source: SOURCE, fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    // TON fees depend on the unsigned message; no read-only fee endpoint
    // exists. Never invent a fee number — Phase 4 estimates it per message.
    return {
      status: 'unavailable',
      reason: 'TON fees depend on the unsigned message; estimated in the Phase 4 send flow',
    };
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    if (!isTonAddress(address)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    const result = await rpc('runGetMethod', {
      address,
      method: 'seqno',
      stack: [],
    });
    if (result.status !== 'ok') return result;
    const stack = isRecord(result.data) ? result.data['stack'] : undefined;
    const first = Array.isArray(stack) ? stack[0] : undefined;
    const hex =
      Array.isArray(first) && typeof first[1] === 'string' ? first[1] : undefined;
    if (hex === undefined) {
      return { status: 'error', reason: 'Invalid response: expected a seqno stack' };
    }
    const seqno = Number.parseInt(hex, 16);
    if (!Number.isSafeInteger(seqno)) {
      return { status: 'error', reason: 'Invalid response: seqno is not an integer' };
    }
    return {
      status: 'ok',
      data: { kind: 'seqno', seqno },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'ton',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
