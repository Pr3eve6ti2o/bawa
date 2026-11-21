// Pending-broadcast bookkeeping (repo-study Phase 3, item 28).
//
// Broadcast is DISABLED by standing owner order, so nothing in the app
// records a pending broadcast today. This module is the bookkeeping the
// future send flow will use, and nothing else:
//
// - persist the transaction hash + chain + nonce when a broadcast is
//   attempted, so an ambiguous broadcast (sent, but the acknowledgement
//   was lost) is not forgotten;
// - reconcile the list on the next load against an observation source
//   the caller supplies;
// - NEVER auto-resubmit. An ambiguous broadcast stays 'unknown' until
//   a human — or a confirmed observation — resolves it.
//
// The module never fetches, signs or broadcasts anything itself. The
// reconcile resolver is read-only by contract: it answers whether a
// hash is confirmed, not found, or still unknown.
import type { ChainId } from '@bawa/contracts';

export interface PendingBroadcast {
  txHash: string;
  chain: ChainId;
  nonce?: number;
  recordedAt: number;
  /** Always 'unknown' until reconciled: the broadcast may or may not have landed. */
  status: 'unknown';
}

const STORAGE_KEY = 'bawa-pending-broadcasts';
const MAX_ENTRIES = 50;

// One storage backend, decided once: localStorage when it works, an
// in-memory list otherwise. Never mix the two — a cleared localStorage
// must not resurrect entries from the memory copy.
let memoryFallback: PendingBroadcast[] = [];

function storageWorks(): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, window.localStorage.getItem(STORAGE_KEY) ?? '');
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = storageWorks();

function readStored(): PendingBroadcast[] {
  if (!useLocalStorage) return [...memoryFallback];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingBroadcast =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PendingBroadcast).txHash === 'string' &&
        typeof (entry as PendingBroadcast).chain === 'string' &&
        typeof (entry as PendingBroadcast).recordedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeStored(entries: PendingBroadcast[]): void {
  if (!useLocalStorage) {
    memoryFallback = [...entries];
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage failed mid-write; the in-memory copy is not promoted —
    // the next read retries localStorage rather than serving stale data.
  }
}

/** Record a broadcast attempt. Re-recording the same hash + chain replaces it. */
export function recordPendingBroadcast(entry: {
  txHash: string;
  chain: ChainId;
  nonce?: number;
}): PendingBroadcast {
  const recorded: PendingBroadcast = {
    txHash: entry.txHash,
    chain: entry.chain,
    ...(entry.nonce !== undefined ? { nonce: entry.nonce } : {}),
    recordedAt: Date.now(),
    status: 'unknown',
  };
  const rest = readStored().filter(
    (item) => !(item.txHash === recorded.txHash && item.chain === recorded.chain),
  );
  writeStored([...rest, recorded].slice(-MAX_ENTRIES));
  return recorded;
}

export function listPendingBroadcasts(): PendingBroadcast[] {
  return readStored();
}

export function removePendingBroadcast(txHash: string, chain: ChainId): void {
  writeStored(
    readStored().filter(
      (item) => !(item.txHash === txHash && item.chain === chain),
    ),
  );
}

export type BroadcastResolution = 'confirmed' | 'not-found' | 'unknown';

/**
 * Reconcile every pending broadcast against a read-only resolver.
 * Confirmed entries are removed (they settled); anything else stays
 * pending. This never resubmits a transaction.
 */
export async function reconcilePendingBroadcasts(
  resolve: (entry: PendingBroadcast) => Promise<BroadcastResolution>,
): Promise<{ confirmed: number; stillUnknown: number }> {
  const entries = readStored();
  let confirmed = 0;
  const remaining: PendingBroadcast[] = [];
  for (const entry of entries) {
    const resolution = await resolve(entry);
    if (resolution === 'confirmed') {
      confirmed += 1;
    } else {
      remaining.push(entry);
    }
  }
  writeStored(remaining);
  return { confirmed, stillUnknown: remaining.length };
}
