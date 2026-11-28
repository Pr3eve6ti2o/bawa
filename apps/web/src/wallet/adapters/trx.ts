import { hexToBytes, sha256 } from 'viem';
import { BASE58_ALPHABET, encodeBase58 } from '../../engine/address-codecs';
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
// TronScan fallback (Fix-All Lane A, 2026-11-24): TronGrid's keyless
// tier throttles the shared egress IP (HTTP 429, "request credit rate
// exceeded", probed live 2026-11-24 — the same minute PublicNode
// answered the same account). TronScan's keyless account API is TRON's
// own explorer backend: GET /api/account?address={T} returns
// { balance: <SUN number>, address } and GET
// /api/transaction?sort=-timestamp&count=true&limit=&start=0&address={T}
// returns { data: [...] } with contractType 1 = TransferContract
// (31 = TriggerSmartContract, skipped like the primary's non-transfer
// filter). Verified live 2026-11-24 for
// TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5: TronScan balance 20032755932541
// SUN agrees exactly with Trongrid and with PublicNode's
// /wallet/getaccount the same minute. Mainnet only — the devnet
// adapter (networkId 'tron:nile') never reads mainnet TronScan.
// 2026-11-28 update: TronScan sends no Access-Control-Allow-Origin
// header, so the browser blocks it — since then it is the SECOND
// balance fallback, after PublicNode's POST /wallet/getaccount (see
// PUBLIC_NODE_BASE_URL below), which is CORS-open.
const TRONSCAN_BASE_URL = 'https://apilist.tronscanapi.com';
const TRONSCAN_SOURCE = 'tronscan';
// PublicNode full-node fallback (2026-11-28, probed live): the
// registry's second endpoint is a real TRON full node, and unlike
// Trongrid's keyless tier it answers POST /wallet/getaccount without
// a key — 200 with { balance: <SUN> } for a funded account, {} for a
// never-funded one — and it sends `access-control-allow-origin: *`
// with a 204 preflight, so the browser POST passes CORS. Trongrid
// 429s the shared egress IP ("request credit rate exceeded") and
// TronScan sends no ACAO header at all, so both older paths are dead
// in the browser exactly when they are needed. Full-node API, same
// shape as Trongrid's /wallet/* paths.
const PUBLIC_NODE_BASE_URL = 'https://tron-rpc.publicnode.com';
const PUBLIC_NODE_SOURCE = 'publicnode';
const DECIMALS = 6;
interface TronAdapterOverrides {
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
  /** TronScan base URL (balance/history fallback). */
  tronScanBaseUrl?: string;
  /**
   * Full-node base URL for the PublicNode balance fallback (POST
   * /wallet/getaccount). Defaults to the registry's second endpoint.
   */
  fullNodeBaseUrl?: string;
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

/** One bounded-retry POST through the given transport (PublicNode full-node read). */
function postWithRetry(
  transport: FetchTransport,
  url: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  return withRetry(
    () =>
      transport.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    { operation },
  );
}


function isTronAddress(address: string): boolean {
  if (address.length !== 34 || !address.startsWith('T')) return false;
  return [...address].every((ch) => BASE58_ALPHABET.includes(ch));
}

/** Latest-block header fields a TRON offline signature needs. */
interface TronBlockHeader {
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

  // Fix-All Lane A: the registry's second entry is PublicNode's TRON
  // full node (tron-rpc.publicnode.com). It answers the /wallet/*
  // full-node paths (identity, fee) but not Trongrid's /v1/* REST
  // paths — a /v1 sweep that reaches it 404s fast (404 is not
  // retried) and the PublicNode/TronScan fallbacks below own the
  // balance then (PublicNode POST /wallet/getaccount first — it is
  // the same full node the sweep just 404d on, but on its native
  // path). Verified live 2026-11-24: Trongrid /wallet/getaccount
  // 429d the same minute PublicNode returned the same balance,
  // 20032755932541.
  // TronScan fallback (Fix-All Lane A): mainnet only, different API
  // shape from Trongrid, so it lives outside the base-URL sweep — the
  // same split the TON adapter uses for TonAPI.
  const tronScanBaseUrl = overrides.tronScanBaseUrl ?? TRONSCAN_BASE_URL;
  // PublicNode fallback (2026-11-28): the full-node base for the POST
  // /wallet/getaccount balance read. Mainnet only, like TronScan.
  const fullNodeBaseUrl = overrides.fullNodeBaseUrl ?? PUBLIC_NODE_BASE_URL;
  const tronScanEnabled = networkId === NETWORK_ID;

  /** Parse a PublicNode /wallet/getaccount response into SUN, or null. */
  const parsePublicNodeBalance = (raw: unknown, address: string): string | null => {
    if (!isRecord(raw)) return null;
    // A full-node error answers HTTP 200 with an `Error` field (an
    // invalid address, for example) — never read that as a balance.
    if (typeof raw['Error'] === 'string') return null;
    const returned = raw['address'];
    if (typeof returned === 'string' && returned !== address) return null;
    // A never-funded account answers `{}` — no balance field at all.
    // That is an exact zero, the same rule as Trongrid's empty data list.
    const balance = raw['balance'];
    if (balance === undefined) return '0';
    if (
      typeof balance !== 'number' ||
      !Number.isFinite(balance) ||
      balance < 0
    ) {
      return null;
    }
    return String(Math.trunc(balance));
  };

  const getPublicNodeBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    let raw: unknown;
    try {
      raw = await postWithRetry(
        transport,
        `${fullNodeBaseUrl}/wallet/getaccount`,
        { address, visible: true },
        'trx.getBalance.publicnode',
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const balance = parsePublicNodeBalance(raw, address);
    if (balance === null) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a PublicNode account balance',
      };
    }
    return {
      status: 'ok',
      data: {
        chain: 'trx',
        address,
        networkId,
        valueBaseUnits: balance,
        decimals: DECIMALS,
        source: PUBLIC_NODE_SOURCE,
        fetchedAt: Date.now(),
      },
      source: PUBLIC_NODE_SOURCE,
      fetchedAt: Date.now(),
    };
  };

  /** Parse a TronScan /api/account response into SUN, or null. */
  const parseTronScanBalance = (raw: unknown, address: string): string | null => {
    if (!isRecord(raw)) return null;
    const returned = raw['address'];
    if (typeof returned === 'string' && returned !== address) return null;
    const balance = raw['balance'];
    if (
      typeof balance !== 'number' ||
      !Number.isFinite(balance) ||
      balance < 0
    ) {
      return null;
    }
    return String(Math.trunc(balance));
  };

  const getTronScanBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    let raw: unknown;
    try {
      raw = await readWithRetry(
        transport,
        `${tronScanBaseUrl}/api/account?address=${address}`,
        'trx.getBalance.tronscan',
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const balance = parseTronScanBalance(raw, address);
    if (balance === null) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a TronScan balance',
      };
    }
    return {
      status: 'ok',
      data: {
        chain: 'trx',
        address,
        networkId,
        valueBaseUnits: balance,
        decimals: DECIMALS,
        source: TRONSCAN_SOURCE,
        fetchedAt: Date.now(),
      },
      source: TRONSCAN_SOURCE,
      fetchedAt: Date.now(),
    };
  };

  /**
   * Balance fallbacks, in order: PublicNode's full-node POST first
   * (keyless, CORS-open, authoritative), TronScan second (CORS-blocked
   * in browsers — kept for non-browser contexts). Returns the first
   * success, or null when neither answered, so the caller keeps its
   * primary error.
   */
  const getFallbackBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance> | null> => {
    const publicNode = await getPublicNodeBalance(address);
    if (publicNode.status === 'ok') return publicNode;
    const tronScan = await getTronScanBalance(address);
    if (tronScan.status === 'ok') return tronScan;
    return null;
  };

  /** Parse TronScan /api/transaction entries: native transfers only. */
  const parseTronScanTxs = (
    raw: unknown,
    address: string,
  ): AdapterTx[] | null => {
    if (!isRecord(raw) || !Array.isArray(raw['data'])) return null;
    const txs: AdapterTx[] = [];
    for (const entry of raw['data'] as unknown[]) {
      if (!isRecord(entry)) continue;
      // contractType 1 = TransferContract; 31 = TriggerSmartContract and
      // the rest are contract calls — skipped, never fabricated as TRX.
      if (entry['contractType'] !== 1) continue;
      const hash = typeof entry['hash'] === 'string' ? entry['hash'] : '';
      const owner =
        typeof entry['ownerAddress'] === 'string' ? entry['ownerAddress'] : '';
      const to =
        typeof entry['toAddress'] === 'string' ? entry['toAddress'] : '';
      const amountRaw = entry['amount'];
      const amount =
        typeof amountRaw === 'string' && /^\d+$/.test(amountRaw)
          ? amountRaw
          : typeof amountRaw === 'number' &&
              Number.isFinite(amountRaw) &&
              amountRaw >= 0
            ? String(Math.trunc(amountRaw))
            : null;
      const timestamp =
        typeof entry['timestamp'] === 'number' ? entry['timestamp'] : NaN;
      if (hash === '' || owner === '' || to === '' || amount === null) continue;
      const fromSelf = owner === address;
      const toSelf = to === address;
      txs.push({
        hash,
        chain: 'trx',
        networkId,
        direction: fromSelf && toSelf ? 'self' : fromSelf ? 'out' : 'in',
        amountBaseUnits: amount,
        counterparty: fromSelf && toSelf ? null : fromSelf ? to || null : owner || null,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        status: entry['confirmed'] === true ? 'confirmed' : 'pending',
        explorerUrl: `${explorerBaseUrl}/#/transaction/${hash}`,
      });
    }
    return txs;
  };

  const getTronScanHistory = async (
    address: string,
    limit: number,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    let raw: unknown;
    try {
      raw = await readWithRetry(
        transport,
        `${tronScanBaseUrl}/api/transaction?sort=-timestamp&count=true&limit=${limit}&start=0&address=${address}`,
        'trx.getHistory.tronscan',
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const txs = parseTronScanTxs(raw, address);
    if (txs === null) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a TronScan transaction list',
      };
    }
    return {
      status: 'ok',
      data: txs.slice(0, limit),
      source: TRONSCAN_SOURCE,
      fetchedAt: Date.now(),
    };
  };


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

  // Fix-all Lane H, item 12: getBalance/getHistory open identically
  // (address check + network identity + the same account-list shape)
  // — one helper each, so the shape is stated once.
  const checkAddress = async (
    address: string,
  ): Promise<AdapterResult<never> | null> => {
    if (!isTronAddress(address)) {
      return { status: 'error', reason: 'Invalid TRON address' };
    }
    return requireNetwork();
  };

  const dataList = (raw: unknown): unknown[] | undefined =>
    isRecord(raw) && Array.isArray(raw['data']) ? raw['data'] : undefined;

  // The two readJsonFrom calls differ only in the URL + op name —
  // the try/catch + error mapping is one helper taking the call as a
  // thunk. (Fix-all Lane H, item 12.)
  const tryRead = async (
    call: () => Promise<{ raw: unknown; endpoint: string }>,
  ): Promise<{ raw: unknown; endpoint: string } | AdapterResult<never>> => {
    try {
      return await call();
    } catch (error: unknown) {
      return toAdapterError(error);
    }
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    const blocked = await checkAddress(address);
    if (blocked) {
      // Identity failure (Trongrid 429 on the shared egress IP) falls
      // back to the PublicNode/TronScan fallbacks on mainnet
      // (Fix-All Lane A); an invalid address never falls back.
      if (!tronScanEnabled || !isTronAddress(address)) return blocked;
      const fallback = await getFallbackBalance(address);
      return fallback ?? blocked;
    }
    const read = await tryRead(() =>
      readJsonFrom((base) => `${base}/v1/accounts/${address}`, 'trx.getBalance'),
    );
    if ('status' in read) {
      if (!tronScanEnabled) return read;
      const fallback = await getFallbackBalance(address);
      return fallback ?? read;
    }
    const { raw, endpoint } = read;
    const data = dataList(raw);
    if (!data) {
      if (!tronScanEnabled) {
        return { status: 'error', reason: 'Invalid response: expected an account list' };
      }
      const fallback = await getFallbackBalance(address);
      return fallback ?? { status: 'error', reason: 'Invalid response: expected an account list' };
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
    const blocked = await checkAddress(address);
    if (blocked) {
      // Identity failure (Trongrid 429 on the shared egress IP) falls
      // back to TronScan on mainnet (Fix-All Lane A); an invalid
      // address never falls back.
      if (!tronScanEnabled || !isTronAddress(address)) return blocked;
      const fallback = await getTronScanHistory(address, limit);
      return fallback.status === 'ok' ? fallback : blocked;
    }
    const read = await tryRead(() =>
      readJsonFrom(
        (base) =>
          `${base}/v1/accounts/${address}/transactions?limit=${limit}&order_by=block_timestamp,desc`,
        'trx.getHistory',
      ),
    );
    if ('status' in read) {
      if (!tronScanEnabled) return read;
      const fallback = await getTronScanHistory(address, limit);
      return fallback.status === 'ok' ? fallback : read;
    }
    const { raw, endpoint } = read;
    const data = dataList(raw);
    if (!data) {
      if (!tronScanEnabled) {
        return { status: 'error', reason: 'Invalid response: expected a transaction list' };
      }
      const fallback = await getTronScanHistory(address, limit);
      return fallback.status === 'ok'
        ? fallback
        : { status: 'error', reason: 'Invalid response: expected a transaction list' };
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
