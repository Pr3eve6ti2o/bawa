// ENS name resolution for the Send recipient field (P2-A, M1).
//
// An EVM recipient may be a raw 0x address or an ENS name
// (vitalik.eth). Names resolve against the Ethereum mainnet ENS
// registry through the same pinned public RPC the ETH adapter uses
// (https://ethereum-rpc.publicnode.com) — no new dependency: viem
// 2.58.0 is already in the bundle, and its public client carries
// getEnsAddress. Probe-proven 2026-11-28 from loud-stone:
// vitalik.eth -> 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 in 112 ms;
// an unregistered name returns null (not an error), which is the
// "Invalid address" case.
//
// Only `.eth` names are accepted: ENSIP-15 normalisation and the
// registry live on mainnet, and every other TLD would need a
// per-TLD resolver decision the owner has not made. A name is
// resolved to an address, and the SEND always uses the resolved
// address — the name itself is never a transaction destination.
//
// Resolutions are cached per session (including misses): a name does
// not change hands mid-session, and the debounced field plus the
// submit-path validation would otherwise resolve the same name twice.
import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';

/** Pinned Ethereum mainnet RPC for ENS reads (same host as the ETH adapter). */
export const ENS_RPC_URL = 'https://ethereum-rpc.publicnode.com';

export type EnsResolution =
  | { ok: true; address: `0x${string}` }
  | { ok: false };

/** The only client capability resolution needs — injectable for tests. */
export type EnsClient = Pick<PublicClient, 'getEnsAddress'>;

export type EnsDeps = {
  client?: EnsClient;
};

/**
 * Whether the value looks like an ENS name (`.eth`, no spaces, not a
 * 0x address). ASCII labels only: a unicode name is not resolved and
 * fails validation as an invalid address instead of being guessed at.
 */
export function isEnsName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith('0x')) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(trimmed);
}

const cache = new Map<string, Promise<EnsResolution>>();

function createEnsClient(): EnsClient {
  return createPublicClient({
    chain: mainnet,
    transport: http(ENS_RPC_URL, { retryCount: 0 }),
  });
}

/**
 * Resolve an ENS name to its address. Returns ok:false for an
 * unregistered name AND for any read failure (dead RPC, bad name):
 * the caller cannot tell those apart from the registry, and both
 * mean "do not send to this name". The name is lowercased first —
 * ENS names are case-insensitive.
 */
export async function resolveEnsName(
  name: string,
  deps: EnsDeps = {},
): Promise<EnsResolution> {
  const normalized = name.trim().toLowerCase();
  const cached = cache.get(normalized);
  if (cached !== undefined) return cached;
  const promise = (async (): Promise<EnsResolution> => {
    try {
      const client = deps.client ?? createEnsClient();
      const address = await client.getEnsAddress({ name: normalized });
      return address === null ? { ok: false } : { ok: true, address };
    } catch {
      return { ok: false };
    }
  })();
  cache.set(normalized, promise);
  return promise;
}
