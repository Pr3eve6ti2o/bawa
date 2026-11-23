import { hexToBytes, sha256 } from 'viem';
import { isRecord } from '../guards';
import {
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
import { createMempoolReader, feeEstimateResult } from './utxo-shared';

const NETWORK_ID = 'tron:0x2b6653dc';
const BASE_URL = 'https://api.trongrid.io';
const DECIMALS = 6;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export interface TronAdapterOverrides {
  baseUrl?: string;
  /**
   * Ordered Trongrid-shaped base URLs, or a resolver re-read on every
   * call (the RPC manager). Defaults to [baseUrl].
   */
  baseUrls?: EndpointList;
  /**
   * Injectable transport (item 2). Defaults to the single-attempt HTTP
   * transport; tests inject a fake instead of stubbing the global fetch.
   */
  transport?: FetchTransport;
  /**
   * Devnet overrides (temporary devnet mode): the network id, the
   * explorer base, and the devnet broadcast. Unset, the adapter is
   * the mainnet adapter exactly as before.
   */
  networkId?: string;
  explorerBaseUrl?: string;
  broadcast?: (signedTx: unknown) => Promise<BroadcastResult>;
}


/** One bounded-retry read through the given transport (item 2). */
function readWithRetry(
  transport: FetchTransport,
  url: string,
  operation: string,
): Promise<unknown> {
  return withRetry(() => transport.request(url), { operation });
}


function isTronAddress(address: string): boolean {
  if (address.length !== 34 || !address.startsWith('T')) return false;
  return [...address].every((ch) => BASE58_ALPHABET.includes(ch));
}

/** Latest-block header fields a TRON offline signature needs. */
export interface TronBlockHeader {
  /** Unix epoch milliseconds of the latest block. */
  timestamp: number;
  /** Block number. */
  number: number;
  /** 64 lowercase hex chars (32 bytes). */
  txTrieRoot: string;
  /** 64 lowercase hex chars (32 bytes). */
  parentHash: string;
  /** Base58 TRON address of the block witness. */
  witnessAddress: string;
}

function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] as number) * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return (
    '1'.repeat(zeros) +
    digits
      .reverse()
      .map((digit) => BASE58_ALPHABET[digit] as string)
      .join('')
  );
}

/** 21 address bytes (0x41 version + 20-byte hash) as a base58check T-address. */
function tronBytesToBase58(addressBytes: Uint8Array): string {
  const checksum = hexToBytes(sha256(hexToBytes(sha256(addressBytes))));
  const payload = new Uint8Array(25);
  payload.set(addressBytes, 0);
  payload.set(checksum.subarray(0, 4), 21);
  return encodeBase58(payload);
}

export function createTronAdapter(
  overrides: TronAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  // Devnet overrides default to the mainnet values, so a mainnet
  // adapter constructed without them is byte-for-byte the old one.
  const networkId = overrides.networkId ?? NETWORK_ID;
  const explorerBaseUrl = overrides.explorerBaseUrl ?? 'https://tronscan.org';
  // RPC failover (UI/UX fixes, item 19): every read sweeps the
  // endpoint list in order (SOL pattern), one withRetry around the
  // whole sweep. The attempt is a raw transport call — no per-endpoint
  // retry — so a dead primary fails over after one attempt, not nine.
  const resolveBaseUrls = (): string[] =>
    resolveEndpoints(overrides.baseUrls, [baseUrl]);
  const readJsonFrom = createMempoolReader(transport, resolveBaseUrls);
  // Chain-identity check result, cached per instance: TRON has no on-chain
  // chain-id, so identity rests on the pinned endpoint responding
  // with a well-formed block. The endpoint URL is fixed at
  // construction and never changes, so one check per instance is enough.
  let identityChecked = false;

  const requireNetwork = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    try {
      ({ raw } = await readJsonFrom(
        (base) => `${base}/wallet/getnowblock`,
        'trx.identity',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const header = isRecord(raw) ? raw['block_header'] : undefined;
    const number = isRecord(header) && isRecord(header['raw_data'])
      ? header['raw_data']['number']
      : undefined;
    if (typeof number !== 'number' || number <= 0) {
      return {
        status: 'error',
        reason: 'Network identity check failed: TronGrid did not return a block.',
      };
    }
    // Endpoint check only: TRON exposes no on-chain chain-id, so there is
    // no value to assert against — do not claim a stronger check exists.
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isTronAddress(address)) {
      return { status: 'error', reason: 'Invalid TRON address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/v1/accounts/${address}`,
        'trx.getBalance',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const data = isRecord(raw) && Array.isArray(raw['data']) ? raw['data'] : undefined;
    if (!data) {
      return { status: 'error', reason: 'Invalid response: expected an account list' };
    }
    const first = data[0];
    // An account that was never funded has no data entry: exact zero.
    // JSON numbers lose precision above Number.MAX_SAFE_INTEGER; fine for a
    // personal wallet, recorded limitation.
    const balance =
      isRecord(first) && typeof first['balance'] === 'number'
        ? String(Math.trunc(first['balance']))
        : '0';
    const source = endpointHost(endpoint);
    return {
      status: 'ok',
      data: {
        chain: 'trx',
        address,
        networkId,
        valueBaseUnits: balance,
        decimals: DECIMALS,
        source,
        fetchedAt: Date.now(),
      },
      source,
      fetchedAt: Date.now(),
    };
  };

  const getHistory = async (
    address: string,
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isTronAddress(address)) {
      return { status: 'error', reason: 'Invalid TRON address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) =>
          `${base}/v1/accounts/${address}/transactions?limit=${limit}&order_by=block_timestamp,desc`,
        'trx.getHistory',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const data = isRecord(raw) && Array.isArray(raw['data']) ? raw['data'] : undefined;
    if (!data) {
      return { status: 'error', reason: 'Invalid response: expected a transaction list' };
    }
    const txs: AdapterTx[] = [];
    for (const entry of data) {
      if (!isRecord(entry)) continue;
      const contracts =
        isRecord(entry['raw_data']) && Array.isArray(entry['raw_data']['contract'])
          ? entry['raw_data']['contract']
          : [];
      const transfer = contracts.find(
        (c): c is Record<string, unknown> =>
          isRecord(c) && c['type'] === 'TransferContract',
      );
      // History covers native TRX transfers only; TRC20 and contract calls
      // are out of scope for this adapter and are skipped, not fabricated.
      if (!transfer) continue;
      const value = isRecord(transfer['parameter'])
        ? transfer['parameter']['value']
        : undefined;
      const amount =
        isRecord(value) && typeof value['amount'] === 'number'
          ? String(Math.trunc(value['amount']))
          : '0';
      const owner =
        isRecord(value) && typeof value['owner_address'] === 'string'
          ? value['owner_address']
          : '';
      const to =
        isRecord(value) && typeof value['to_address'] === 'string'
          ? value['to_address']
          : '';
      const txID = typeof entry['txID'] === 'string' ? entry['txID'] : '';
      const blockTimestamp =
        typeof entry['block_timestamp'] === 'number' ? entry['block_timestamp'] : NaN;
      const fromSelf = owner === address;
      const toSelf = to === address;
      txs.push({
        hash: txID,
        chain: 'trx',
        networkId,
        direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
        amountBaseUnits: amount,
        counterparty: fromSelf && toSelf ? null : fromSelf ? to || null : owner || null,
        timestamp: Number.isFinite(blockTimestamp) ? blockTimestamp : null,
        status: 'confirmed',
        explorerUrl: `${explorerBaseUrl}/#/transaction/${txID}`,
      });
    }
    return { status: 'ok', data: txs, source: endpointHost(endpoint), fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/wallet/getchainparameters`,
        'trx.estimateFee',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const params =
      isRecord(raw) && Array.isArray(raw['chainParameter']) ? raw['chainParameter'] : [];
    const energyFee = params.find(
      (p): p is Record<string, unknown> =>
        isRecord(p) && p['key'] === 'getEnergyFee',
    );
    const value = isRecord(energyFee) ? energyFee['value'] : undefined;
    if (typeof value !== 'number') {
      return {
        status: 'error',
        reason: 'getEnergyFee not found in chain parameters',
      };
    }
    return feeEstimateResult(
      'trx',
      networkId,
      String(Math.trunc(value)),
      'SUN per unit of energy',
      'TRON fees are energy/bandwidth, not a flat tx fee; this is the network energy fee',
      endpoint,
    );
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const balance = await getBalance(address);
    if (balance.status !== 'ok') return balance;
    return {
      status: 'ok',
      data: { kind: 'account', balanceSun: balance.data.valueBaseUnits },
      source: balance.source,
      fetchedAt: Date.now(),
    };
  };

  // Mainnet: always throws. Devnet: the injected devnet broadcast.
  const broadcast: ChainAdapter['broadcast'] =
    overrides.broadcast ?? createDisabledBroadcast();

  return {
    chain: 'trx',
    networkId,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}

/**
 * Read-only latest-block header from TronGrid (Phase 4 send: TRON signing
 * needs the block header for ref_block_bytes/ref_block_hash). TronGrid
 * returns the witness address as 21-byte hex; it is converted to the
 * canonical base58 T-address here. Fails closed on any malformed field —
 * a header is never guessed.
 */
export async function getLatestBlockHeader(
  overrides: TronAdapterOverrides = {},
): Promise<AdapterResult<TronBlockHeader>> {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  let raw: unknown;
  try {
    raw = await readWithRetry(
      transport,
      `${baseUrl}/wallet/getnowblock`,
      'trx.getLatestBlockHeader',
    );
  } catch (error: unknown) {
    return toAdapterError(error);
  }
  const data = isRecord(raw) ? raw['block_header'] : undefined;
  const rawData = isRecord(data) ? data['raw_data'] : undefined;
  if (!isRecord(rawData)) {
    return { status: 'error', reason: 'TronGrid did not return a block header.' };
  }
  const timestamp = rawData['timestamp'];
  const number = rawData['number'];
  const txTrieRoot = rawData['txTrieRoot'];
  const parentHash = rawData['parentHash'];
  const witness = rawData['witness_address'];
  const isHex64 = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
  if (
    typeof timestamp !== 'number' ||
    timestamp <= 0 ||
    typeof number !== 'number' ||
    number <= 0 ||
    !isHex64(txTrieRoot) ||
    !isHex64(parentHash) ||
    typeof witness !== 'string'
  ) {
    return {
      status: 'error',
      reason: 'TronGrid returned a malformed block header.',
    };
  }
  let witnessAddress: string;
  if (/^[0-9a-fA-F]{42}$/.test(witness) && witness.toLowerCase().startsWith('41')) {
    witnessAddress = tronBytesToBase58(
      hexToBytes((`0x${witness.toLowerCase()}`) as `0x${string}`),
    );
  } else if (isTronAddress(witness)) {
    witnessAddress = witness;
  } else {
    return {
      status: 'error',
      reason: 'TronGrid returned an unrecognised witness address.',
    };
  }
  return {
    status: 'ok',
    data: {
      timestamp,
      number,
      txTrieRoot: (txTrieRoot as string).toLowerCase(),
      parentHash: (parentHash as string).toLowerCase(),
      witnessAddress,
    },
    source: endpointHost(baseUrl),
    fetchedAt: Date.now(),
  };
}
