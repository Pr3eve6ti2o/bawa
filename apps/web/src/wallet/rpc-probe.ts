/**
 * Live RPC endpoint probe (Lane F, FIX-ALL, 2026-11-24).
 *
 * The Networks screen's "Check" button calls this for each endpoint a
 * chain lists, so the owner sees which ones actually answer — from
 * their own browser, not from a report. A registry entry that has
 * gone dead (Aurora's 1rpc.io backup answers -32001 "usage limit"
 * since 2026-11-24; Solana's Vibe Station refuses plain curl but
 * answers the browser) shows up here honestly instead of hiding
 * behind a Primary/Backup badge.
 *
 * Each probe is the smallest call that proves the endpoint serves the
 * right chain: eth_chainId (+ eth_blockNumber for the block height
 * where the host allows it) for EVM chains, getSlot for Solana, the
 * tip height for Bitcoin/Litecoin, getnowblock for TRON,
 * getMasterchainInfo for TON, and BlockCypher's chain info for
 * Dogecoin. Dogecoin's SoChain host has no address-free check — it
 * only answers balance reads for an address — so it reports
 * `unchecked` with the reason, and the row's "Last balance from"
 * line is its check instead of a guessed one.
 *
 * Timeouts are 10 s per endpoint; a slow host reports failed, never
 * hangs the screen. No key, no credentials, no funds move.
 */
import type { ChainId } from '../engine/boundary';
import { CHAINS } from './chains';

export type RpcProbeResult =
  | { status: 'working'; latencyMs: number; detail: string }
  | { status: 'failed'; latencyMs: number; reason: string }
  | { status: 'unchecked'; latencyMs: number; reason: string };

const PROBE_TIMEOUT_MS = 10_000;

type FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** POSTs JSON and returns the parsed body; throws a plain message on any failure. */
async function postJson(
  fetchFn: FetchFn,
  url: string,
  body: unknown,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timed out after 10 s');
    }
    throw error instanceof Error ? error : new Error('Request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** GETs a URL and returns the parsed body, or the raw text for the height endpoints. */
async function getText(fetchFn: FetchFn, url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timed out after 10 s');
    }
    throw error instanceof Error ? error : new Error('Request failed');
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonRpcResult(body: unknown): unknown {
  if (!isRecord(body)) throw new Error('Unexpected reply');
  if (isRecord(body.error)) {
    const message =
      typeof body.error.message === 'string'
        ? body.error.message
        : 'RPC error';
    throw new Error(message);
  }
  return body.result;
}

async function probeEvm(
  chain: ChainId,
  url: string,
  fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  const evmChainId = CHAINS[chain].evmChainId;
  if (evmChainId === null) {
    return {
      status: 'failed',
      latencyMs: Date.now() - startedMs,
      reason: 'Not an EVM chain',
    };
  }
  const expected = `0x${evmChainId.toString(16)}`;
  const chainIdBody = await postJson(fetchFn, url, {
    jsonrpc: '2.0',
    method: 'eth_chainId',
    params: [],
    id: 1,
  });
  const got = jsonRpcResult(chainIdBody);
  if (got !== expected) {
    return {
      status: 'failed',
      latencyMs: Date.now() - startedMs,
      reason: `Answered as chain ${String(got)}, expected ${evmChainId}`,
    };
  }
  // The block height is the proof detail, but some public hosts
  // refuse it (Cloudflare-eth: -32046) while serving the chain fine —
  // so a refusal here still counts as working, without a height.
  try {
    const blockBody = await postJson(fetchFn, url, {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 2,
    });
    const block = jsonRpcResult(blockBody);
    if (typeof block === 'string') {
      return {
        status: 'working',
        latencyMs: Date.now() - startedMs,
        detail: `block ${Number.parseInt(block, 16).toLocaleString('en-GB')}`,
      };
    }
  } catch {
    // Fall through: chain identity is proven, height is not.
  }
  return {
    status: 'working',
    latencyMs: Date.now() - startedMs,
    detail: `chain ${evmChainId} confirmed`,
  };
}

async function probeSolana(
  url: string,
  fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  const body = await postJson(fetchFn, url, {
    jsonrpc: '2.0',
    method: 'getSlot',
    params: [],
    id: 1,
  });
  const slot = jsonRpcResult(body);
  if (typeof slot !== 'number') throw new Error('Unexpected reply');
  return {
    status: 'working',
    latencyMs: Date.now() - startedMs,
    detail: `slot ${slot.toLocaleString('en-GB')}`,
  };
}

async function probeTipHeight(
  url: string,
  fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  const text = (await getText(fetchFn, `${url}/blocks/tip/height`)).trim();
  if (!/^\d+$/.test(text)) throw new Error('Unexpected reply');
  return {
    status: 'working',
    latencyMs: Date.now() - startedMs,
    detail: `block ${Number(text).toLocaleString('en-GB')}`,
  };
}

async function probeTron(
  url: string,
  fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  const body = await postJson(fetchFn, `${url}/wallet/getnowblock`, {});
  if (!isRecord(body)) throw new Error('Unexpected reply');
  const header = body.block_header;
  const rawData = isRecord(header) ? header.raw_data : undefined;
  const number = isRecord(rawData) ? rawData.number : undefined;
  if (typeof number !== 'number') throw new Error('Unexpected reply');
  return {
    status: 'working',
    latencyMs: Date.now() - startedMs,
    detail: `block ${number.toLocaleString('en-GB')}`,
  };
}

async function probeTon(
  url: string,
  fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  const body = await postJson(fetchFn, url, {
    jsonrpc: '2.0',
    method: 'getMasterchainInfo',
    params: {},
    id: 1,
  });
  const result = jsonRpcResult(body);
  if (!isRecord(result)) throw new Error('Unexpected reply');
  const last = result.last;
  const seqno = isRecord(last) ? last.seqno : undefined;
  if (typeof seqno !== 'number') throw new Error('Unexpected reply');
  return {
    status: 'working',
    latencyMs: Date.now() - startedMs,
    detail: `seqno ${seqno.toLocaleString('en-GB')}`,
  };
}

async function probeDoge(
  _url: string,
  _fetchFn: FetchFn,
  startedMs: number,
): Promise<RpcProbeResult> {
  return {
    status: 'unchecked',
    latencyMs: Date.now() - startedMs,
    reason:
      'SoChain only answers balance reads for an address — the last balance from SoChain is its check',
  };
}

/**
 * Probes one endpoint for one chain. Never throws: every failure is
 * a `failed` result with the reason in plain words.
 */
export async function probeRpcEndpoint(
  chain: ChainId,
  url: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<RpcProbeResult> {
  const startedMs = Date.now();
  try {
    if (chain === 'sol') return await probeSolana(url, fetchFn, startedMs);
    if (chain === 'btc' || chain === 'ltc') {
      return await probeTipHeight(url, fetchFn, startedMs);
    }
    if (chain === 'trx') return await probeTron(url, fetchFn, startedMs);
    if (chain === 'ton') return await probeTon(url, fetchFn, startedMs);
    if (chain === 'doge') {
      if (url.includes('blockcypher.com')) {
        const text = await getText(fetchFn, url);
        const parsed: unknown = JSON.parse(text);
        if (!isRecord(parsed) || typeof parsed.height !== 'number') {
          throw new Error('Unexpected reply');
        }
        return {
          status: 'working',
          latencyMs: Date.now() - startedMs,
          detail: `block ${parsed.height.toLocaleString('en-GB')}`,
        };
      }
      return await probeDoge(url, fetchFn, startedMs);
    }
    return await probeEvm(chain, url, fetchFn, startedMs);
  } catch (error: unknown) {
    return {
      status: 'failed',
      latencyMs: Date.now() - startedMs,
      reason: error instanceof Error ? error.message : 'Request failed',
    };
  }
}
