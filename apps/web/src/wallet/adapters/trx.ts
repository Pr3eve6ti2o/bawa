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

const NETWORK_ID = 'tron:0x2b6653dc';
const BASE_URL = 'https://api.trongrid.io';
const SOURCE = 'trongrid';
const DECIMALS = 6;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export interface TronAdapterOverrides {
  baseUrl?: string;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTronAddress(address: string): boolean {
  if (address.length !== 34 || !address.startsWith('T')) return false;
  return [...address].every((ch) => BASE58_ALPHABET.includes(ch));
}

export function createTronAdapter(
  overrides: TronAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  // Chain-identity check result, cached per instance: TRON has no on-chain
  // chain-id, so identity rests on the pinned mainnet endpoint responding
  // with a well-formed mainnet block. The endpoint URL is fixed at
  // construction and never changes, so one check per instance is enough.
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    try {
      raw = await fetchJson(`${baseUrl}/wallet/getnowblock`);
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
    const header = isRecord(raw) ? raw['block_header'] : undefined;
    const number = isRecord(header) && isRecord(header['raw_data'])
      ? header['raw_data']['number']
      : undefined;
    if (typeof number !== 'number' || number <= 0) {
      return {
        status: 'error',
        reason: 'Network identity check failed: TronGrid did not return a mainnet block.',
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
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await fetchJson(`${baseUrl}/v1/accounts/${address}`);
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
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
    return {
      status: 'ok',
      data: {
        chain: 'trx',
        address,
        networkId: NETWORK_ID,
        valueBaseUnits: balance,
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
    limit = 20,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isTronAddress(address)) {
      return { status: 'error', reason: 'Invalid TRON address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await fetchJson(
        `${baseUrl}/v1/accounts/${address}/transactions?limit=${limit}&order_by=block_timestamp,desc`,
      );
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
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
        networkId: NETWORK_ID,
        direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
        amountBaseUnits: amount,
        counterparty: fromSelf && toSelf ? null : fromSelf ? to || null : owner || null,
        timestamp: Number.isFinite(blockTimestamp) ? blockTimestamp : null,
        status: 'confirmed',
        explorerUrl: `https://tronscan.org/#/transaction/${txID}`,
      });
    }
    return { status: 'ok', data: txs, source: SOURCE, fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await fetchJson(`${baseUrl}/wallet/getchainparameters`);
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
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
    return {
      status: 'ok',
      data: {
        chain: 'trx',
        networkId: NETWORK_ID,
        feeBaseUnits: String(Math.trunc(value)),
        unit: 'SUN per unit of energy',
        note: 'TRON fees are energy/bandwidth, not a flat tx fee; this is the network energy fee',
        source: SOURCE,
        fetchedAt: Date.now(),
      },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const balance = await getBalance(address);
    if (balance.status !== 'ok') return balance;
    return {
      status: 'ok',
      data: { kind: 'account', balanceSun: balance.data.valueBaseUnits },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'trx',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
