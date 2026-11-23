import {
  BROADCAST_DISABLED_MESSAGE,
  DEFAULT_TON_WALLET_VERSION,
  assertTonWalletVersion,
  endpointHost,
  httpFetchTransport,
  messageOf,
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
  type TonWalletVersion,
  type TxInput,
} from './types';
import { BawaError, WalletErrorCodes } from '../errors';
import { withRetry } from '../retry';

const NETWORK_ID = 'ton:-239';
const BASE_URL = 'https://toncenter.com/api/v2/jsonRPC';
// TonAPI is a different API shape (REST, not TonCenter JSON-RPC):
// balance-only fallback, verified live 2026-11-23 —
// /v2/accounts/{address} returns { balance: "<nanotons>" } keyless,
// and /v2/blockchain/masterchain-head returns { seqno } for identity.
// Mainnet only: the devnet adapter never falls back to mainnet TonAPI.
const TONAPI_BASE_URL = 'https://tonapi.io';
const TONAPI_SOURCE = 'tonapi';
const DECIMALS = 9;

export interface TonAdapterOverrides {
  baseUrl?: string;
  /**
   * Ordered TonCenter-compatible base URLs, or a resolver re-read on
   * every call (the RPC manager). Defaults to [baseUrl].
   */
  baseUrls?: EndpointList;
  /** TonAPI base URL (balance fallback). */
  tonApiBaseUrl?: string;
  /**
   * Devnet overrides (temporary devnet mode): the network id, the
   * explorer base, whether testnet address forms are accepted, and
   * the devnet broadcast. Unset, the adapter is the mainnet adapter
   * exactly as before.
   */
  networkId?: string;
  explorerBaseUrl?: string;
  acceptTestnetAddresses?: boolean;
  broadcast?: (signedTx: unknown) => Promise<BroadcastResult>;
  retryDelaysMs?: number[];
  /**
   * Minimum gap (ms) between the start of one TonCenter request and the
   * start of the next. Default 1100 (TonCenter's keyless tier allows
   * ~1 req/s). Tests may pass a smaller gap; production must not.
   */
  minCallGapMs?: number;
  /**
   * Injectable transport (item 2). Defaults to the single-attempt HTTP
   * transport; tests inject a fake instead of stubbing the global fetch.
   */
  transport?: FetchTransport;
  /**
   * Wallet contract version (item 4, adapter half). Defaults to V4R2, the
   * version `send.ts` pins today. Unknown versions throw at construction.
   */
  version?: TonWalletVersion;
}

const sleep = (delayMs: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTonAddress(address: string, acceptTestnet = false): boolean {
  if (address.length !== 48) return false;
  // Devnet mode accepts testnet-flagged forms ONLY (kQ bounceable, 0Q
  // non-bounceable); mainnet mode accepts EQ/UQ only. A mainnet address
  // on the devnet adapter is an isolation error, not a lookup.
  if (acceptTestnet) {
    return address.startsWith('kQ') || address.startsWith('0Q');
  }
  return address.startsWith('EQ') || address.startsWith('UQ');
}

/**
 * TON RPC schema validators (item 3). Hand-written, no zod: this is the
 * only call site needing them, and a dependency for three small shapes
 * would be heavier than the validators themselves (recorded lane decision:
 * no new dependency; review the reasoning in the P1 lane report). Each
 * validator throws BawaError PROVIDER_INVALID_RESPONSE; call sites convert
 * that into an AdapterResult error — adapter methods never throw.
 */
function invalidTonResponse(operation: string): BawaError {
  return new BawaError(WalletErrorCodes.PROVIDER_INVALID_RESPONSE, {
    operation,
  });
}

function parseTonBalance(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalidTonResponse('ton.getBalance');
  }
  return value;
}

function parseTonMasterchainSeqno(value: unknown): number {
  const last = isRecord(value) ? value['last'] : undefined;
  const seqno = isRecord(last) ? last['seqno'] : undefined;
  if (
    typeof seqno !== 'number' ||
    !Number.isSafeInteger(seqno) ||
    seqno < 0
  ) {
    throw invalidTonResponse('ton.identity');
  }
  return seqno;
}

function parseTonTxList(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidTonResponse('ton.getHistory');
  }
  return value;
}

/**
 * Parses a `runGetMethod seqno` stack (`[['num', '0x…']]`). Seqno 0 is a
 * valid seqno (a fresh wallet has seqno 0): it must parse to 0, never be
 * treated as missing — the ton 16.3.0 seqno-0 `validUntil` regression test
 * pins this.
 *
 * The run's `exit_code` must be 0: TonCenter answers ok:true even when
 * the get-method failed, and the stack on a failed run is garbage. Live
 * devnet finding (Lane D, 2026-11-22): on an uninitialized wallet the
 * run returns exit_code -13 with stack 0x14c97; reading that stack as a
 * seqno signed a message with seqno 85143 and the network rejected it.
 * A missing exit_code is tolerated (older fixtures / responses), but a
 * present non-zero one is always a failure.
 */
function parseTonSeqno(value: unknown): number {
  const exitCode = isRecord(value) ? value['exit_code'] : undefined;
  if (typeof exitCode === 'number' && exitCode !== 0) {
    throw invalidTonResponse('ton.getTxInputs');
  }
  const stack = isRecord(value) ? value['stack'] : undefined;
  const first = Array.isArray(stack) ? stack[0] : undefined;
  const hex =
    Array.isArray(first) && typeof first[1] === 'string' ? first[1] : undefined;
  if (hex === undefined || !/^0x[0-9a-fA-F]+$/.test(hex)) {
    throw invalidTonResponse('ton.getTxInputs');
  }
  const seqno = Number.parseInt(hex, 16);
  if (!Number.isSafeInteger(seqno) || seqno < 0) {
    throw invalidTonResponse('ton.getTxInputs');
  }
  return seqno;
}

/** Parses a `getAddressInformation` account state (`uninitialized` | `active` | `frozen`). */
function parseTonAccountState(value: unknown): string {
  const state = isRecord(value) ? value['state'] : undefined;
  if (typeof state !== 'string' || state.length === 0) {
    throw invalidTonResponse('ton.getTxInputs');
  }
  return state;
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
  const transport = overrides.transport ?? httpFetchTransport;
  // Devnet overrides default to the mainnet values, so a mainnet
  // adapter constructed without them is byte-for-byte the old one.
  const networkId = overrides.networkId ?? NETWORK_ID;
  const explorerBaseUrl = overrides.explorerBaseUrl ?? 'https://tonviewer.com';
  const acceptTestnet = overrides.acceptTestnetAddresses ?? false;
  // Fail loudly on an unsupported version (item 4): the adapter and the
  // signer must never silently disagree about the wallet contract.
  const version = assertTonWalletVersion(
    overrides.version ?? DEFAULT_TON_WALLET_VERSION,
  );
  // Per-adapter serial gate (Phase 3, Lane H): TonCenter's keyless tier
  // allows ~1 req/s, and Bawa fires the identity check, the balance and
  // the history back-to-back — three calls inside ~1 s, so history 429s
  // twice before recovering. Every rpc() call runs through one promise
  // chain, and every HTTP attempt waits until ~1100 ms after the previous
  // attempt STARTED (not finished), covering the identity check and the
  // 429 retries. A token bucket adds nothing over this for a 1 req/s
  // limit with a single consumer.
  const minCallGapMs = overrides.minCallGapMs ?? 1100;
  let gateChain: Promise<void> = Promise.resolve();
  let lastAttemptStartedAtMs = 0;
  const waitForGap = async (): Promise<void> => {
    const nowMs = Date.now();
    const waitMs = minCallGapMs - (nowMs - lastAttemptStartedAtMs);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastAttemptStartedAtMs = Date.now();
  };
  // Chain-identity check result, cached per instance: TON's identity rests
  // on the pinned host (mainnet lives on toncenter.com, testnet on
  // testnet.toncenter.com).
  // The host is fixed at construction, so one check per instance is enough.
  let identityChecked = false;
  let identityCheckInFlight: Promise<AdapterResult<never> | null> | null = null;

  // Merge 1 (Lane B): adopt-proper's 429 loop kept, but the fetch goes
  // through repo-study's injectable transport with withRetry (item 2).
  // Layering, each layer owning one concern:
  // - withRetry retries TRANSIENT failures (502/503/504/network) with
  //   backoff; a 429 is never retried there. It is returned as a
  //   sentinel so the loop below owns it with retryDelaysMs, exactly as
  //   adopt-proper did — withRetry would otherwise retry a 429 on its
  //   own backoff and exhaust with a bare 'HTTP 429' reason, losing the
  //   rate-limit message the tests pin. Broadcast is never retried —
  //   it stays disabled.
  type RpcAttempt =
    | { kind: 'ok'; raw: unknown; endpoint: string }
    | { kind: 'rate-limited' };
  // RPC failover (UI/UX fixes, item 19): one attempt sweeps the
  // TonCenter-compatible endpoints in order. A 429 on one endpoint
  // tries the next before the outer loop owns the rate limit; a
  // transport error tries the next endpoint and only throws when every
  // endpoint failed (the last non-429 error, so a network failure is
  // never reported as a rate limit).
  const resolveBaseUrls = (): string[] =>
    resolveEndpoints(overrides.baseUrls, [baseUrl]);
  const attemptFetch = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<RpcAttempt> => {
    let sawRateLimit = false;
    let lastNon429Error: unknown = null;
    for (const url of resolveBaseUrls()) {
      try {
        const raw = await transport.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
        });
        return { kind: 'ok', raw, endpoint: url };
      } catch (error: unknown) {
        if (messageOf(error) === 'HTTP 429') {
          sawRateLimit = true;
          continue;
        }
        lastNon429Error = error;
      }
    }
    if (lastNon429Error !== null) throw lastNon429Error;
    if (sawRateLimit) return { kind: 'rate-limited' };
    throw new Error('No TON endpoints configured.');
  };

  const rpcUnpaced = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<AdapterResult<unknown>> => {
    const retryDelaysMs = (overrides.retryDelaysMs ?? [1200, 2400]).slice(0, 2);

    for (let attempt = 0; ; attempt += 1) {
      let raw: unknown = undefined;
      let rateLimited = false;
      let endpoint = BASE_URL;

      // The gap is enforced per attempt, so a 429 retry also waits its
      // turn instead of firing into the same 1 s window. The retry
      // delay (1200/2400 ms) already exceeds the gap, so in production
      // the wait here is normally zero after a retry sleep.
      await waitForGap();
      let fetched: RpcAttempt;
      try {
        fetched = await withRetry(() => attemptFetch(method, params), {
          operation: 'ton.rpc',
        });
      } catch (error: unknown) {
        // withRetry exhausted on a transient failure: report it, never zero.
        return { status: 'error', reason: messageOf(error) };
      }
      if (fetched.kind === 'rate-limited') {
        rateLimited = true;
      } else {
        raw = fetched.raw;
        endpoint = fetched.endpoint;
      }

      if (rateLimited || (isRecord(raw) && raw['ok'] === false && raw['code'] === 429)) {
        const delayMs = retryDelaysMs[attempt];
        if (delayMs === undefined) {
          return {
            status: 'error',
            reason: 'TonCenter rate limit exceeded (HTTP 429); please retry.',
          };
        }
        await sleep(delayMs);
        continue;
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
      return {
        status: 'ok',
        data: raw['result'],
        source: endpointHost(endpoint),
        fetchedAt: Date.now(),
      };
    }
  };

  // Serialised entry point: every call waits its turn on the chain, so
  // two concurrent callers (balance + history) can never overlap, and
  // each call's attempts are gap-checked in waitForGap. The chain is kept
  // alive on failure so one failed call never blocks the next.
  const rpc = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<AdapterResult<unknown>> => {
    const run = gateChain.then(() => rpcUnpaced(method, params));
    gateChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const requireNetwork = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;

    // Merge 1 (Lane B): adopt-proper's in-flight dedup kept (concurrent
    // balance + history share ONE identity check — the rate-limiting test
    // pins exactly 3 fetch calls), with repo-study's schema validator
    // (item 3) replacing the hand-rolled seqno check.
    if (identityCheckInFlight === null) {
      identityCheckInFlight = (async (): Promise<AdapterResult<never> | null> => {
        const result = await rpc('getMasterchainInfo', {});
        if (result.status !== 'ok') return result;
        try {
          parseTonMasterchainSeqno(result.data);
        } catch {
          return {
            status: 'error',
            reason: 'Network identity check failed: TonCenter did not return masterchain info.',
          };
        }
        identityChecked = true;
        return null;
      })().finally(() => {
        identityCheckInFlight = null;
      });
    }

    return await identityCheckInFlight;
  };

  // TonAPI balance fallback (UI/UX fixes, item 19): when TonCenter is
  // down, the balance comes from TonAPI's REST account read instead.
  // Mainnet only — the devnet adapter (acceptTestnet) never reads
  // mainnet TonAPI. The TonAPI calls bypass the TonCenter serial gate
  // (different host, different rate limit).
  const tonApiBaseUrl = overrides.tonApiBaseUrl ?? TONAPI_BASE_URL;
  const tonApiEnabled = !acceptTestnet;
  const getTonApiBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    let raw: unknown;
    try {
      raw = await withRetry(
        () => transport.request(`${tonApiBaseUrl}/v2/accounts/${address}`),
        { operation: 'ton.getBalance.tonapi' },
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const balance = isRecord(raw) ? raw['balance'] : undefined;
    if (typeof balance !== 'string' || !/^\d+$/.test(balance)) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a TonAPI balance',
      };
    }
    return {
      status: 'ok',
      data: {
        chain: 'ton',
        address,
        networkId,
        valueBaseUnits: balance,
        decimals: DECIMALS,
        source: TONAPI_SOURCE,
        fetchedAt: Date.now(),
      },
      source: TONAPI_SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isTonAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireNetwork();
    if (identity) {
      if (!tonApiEnabled) return identity;
      // TonCenter identity failed: TonAPI's masterchain head proves
      // its API is live before the balance is read from it.
      try {
        const head = await withRetry(
          () =>
            transport.request(
              `${tonApiBaseUrl}/v2/blockchain/masterchain-head`,
            ),
          { operation: 'ton.identity.tonapi' },
        );
        const seqno = isRecord(head) ? head['seqno'] : undefined;
        if (typeof seqno !== 'number') return identity;
      } catch {
        return identity;
      }
      return await getTonApiBalance(address);
    }
    const result = await rpc('getAddressBalance', { address });
    if (result.status === 'ok') {
      let balance: string;
      try {
        balance = parseTonBalance(result.data);
      } catch (error: unknown) {
        return toAdapterError(error);
      }
      return {
        status: 'ok',
        data: {
          chain: 'ton',
          address,
          networkId,
          valueBaseUnits: balance,
          decimals: DECIMALS,
          source: result.source,
          fetchedAt: Date.now(),
        },
        source: result.source,
        fetchedAt: Date.now(),
      };
    }
    if (!tonApiEnabled) return result;
    // TonCenter balance failed after a good identity: fall back to
    // TonAPI. When TonAPI fails too, the TonCenter error is reported —
    // the primary failure is the one the owner needs to see.
    const fallback = await getTonApiBalance(address);
    return fallback.status === 'ok' ? fallback : result;
  };

  const getHistory = async (
    address: string,
    limit = 10,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isTonAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    const result = await rpc('getTransactions', { address, limit });
    if (result.status !== 'ok') return result;
    let list: unknown[];
    try {
      list = parseTonTxList(result.data);
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const txs: AdapterTx[] = [];
    for (const entry of list) {
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
        networkId,
        direction,
        amountBaseUnits: amount,
        counterparty,
        timestamp: Number.isFinite(utime) ? utime * 1000 : null,
        status: 'confirmed',
        explorerUrl: `${explorerBaseUrl}/transaction/${hash}`,
      });
    }
    return { status: 'ok', data: txs, source: result.source, fetchedAt: Date.now() };
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
    if (!isTonAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid TON address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    const result = await rpc('runGetMethod', {
      address,
      method: 'seqno',
      stack: [],
    });
    if (result.status !== 'ok') return result;
    let seqno: number;
    try {
      seqno = parseTonSeqno(result.data);
    } catch (error: unknown) {
      // A failed seqno run means the account has no code to run it — an
      // uninitialized wallet. Its seqno is 0 by definition, but only
      // the account state may say so: a failed run on an active or
      // unreadable account stays an error, never a guessed 0.
      const stateResult = await rpc('getAddressInformation', { address });
      if (stateResult.status !== 'ok') return toAdapterError(error);
      try {
        if (parseTonAccountState(stateResult.data) !== 'uninitialized') {
          return toAdapterError(error);
        }
      } catch {
        return toAdapterError(error);
      }
      seqno = 0;
    }
    return {
      status: 'ok',
      // The version travels with the seqno so the Phase 4 send flow signs
      // against the same contract the adapter read (item 4).
      data: { kind: 'seqno', seqno, walletVersion: version },
      source: result.source,
      fetchedAt: Date.now(),
    };
  };

  // Mainnet: always throws. Devnet: the injected devnet broadcast.
  const broadcast: ChainAdapter['broadcast'] =
    overrides.broadcast ??
    (async (_signedTx: unknown): Promise<never> => {
      throw new Error(BROADCAST_DISABLED_MESSAGE);
    });

  return {
    chain: 'ton',
    networkId,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
