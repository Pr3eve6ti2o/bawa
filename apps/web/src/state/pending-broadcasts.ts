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
//
// TEMPORARY devnet mode: the devnet record lives under a separate key
// (bawa-pending-broadcasts-devnet) with parallel record/list/remove/
// reconcile functions, so a devnet broadcast is never reconciled
// against mainnet observations or vice versa.
import type { ChainId } from '@bawa/contracts';

interface PendingBroadcast {
  txHash: string;
  chain: ChainId;
  nonce?: number;
  recordedAt: number;
  /** Always 'unknown' until reconciled: the broadcast may or may not have landed. */
  status: 'unknown';
}

const STORAGE_KEY = 'bawa-pending-broadcasts';
const DEVNET_STORAGE_KEY = 'bawa-pending-broadcasts-devnet';
const MAX_ENTRIES = 50;

// One storage backend, decided once: localStorage when it works, an
// in-memory list otherwise. Never mix the two — a cleared localStorage
// must not resurrect entries from the memory copy. Mainnet and devnet
// records are separate stores under separate keys.
type BroadcastStore = { key: string; memory: PendingBroadcast[] };
const mainnetStore: BroadcastStore = { key: STORAGE_KEY, memory: [] };
const devnetStore: BroadcastStore = { key: DEVNET_STORAGE_KEY, memory: [] };

function storageWorks(): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, window.localStorage.getItem(STORAGE_KEY) ?? '');
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = storageWorks();

function readStored(store: BroadcastStore): PendingBroadcast[] {
  if (!useLocalStorage) return [...store.memory];
  try {
    const raw = window.localStorage.getItem(store.key);
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

function writeStored(store: BroadcastStore, entries: PendingBroadcast[]): void {
  if (!useLocalStorage) {
    store.memory = [...entries];
    return;
  }
  try {
    window.localStorage.setItem(store.key, JSON.stringify(entries));
  } catch {
    // Storage failed mid-write; the in-memory copy is not promoted —
    // the next read retries localStorage rather than serving stale data.
  }
}

/**
 * Shared record step for the mainnet and devnet stores: build the
 * record, drop any earlier entry for the same hash + chain, append
 * (capped). The exported wrappers keep the two stores apart.
 */
function recordBroadcastInStore(
  store: BroadcastStore,
  entry: { txHash: string; chain: ChainId; nonce?: number },
): PendingBroadcast {
  const recorded: PendingBroadcast = {
    txHash: entry.txHash,
    chain: entry.chain,
    ...(entry.nonce !== undefined ? { nonce: entry.nonce } : {}),
    recordedAt: Date.now(),
    status: 'unknown',
  };
  const rest = readStored(store).filter(
    (item) => !(item.txHash === recorded.txHash && item.chain === recorded.chain),
  );
  writeStored(store, [...rest, recorded].slice(-MAX_ENTRIES));
  return recorded;
}

/**
 * Shared reconcile step for the mainnet and devnet stores: confirmed
 * entries are removed (they settled); anything else stays pending.
 * This never resubmits a transaction.
 */
async function reconcileBroadcastsInStore(
  store: BroadcastStore,
  resolve: (entry: PendingBroadcast) => Promise<BroadcastResolution>,
): Promise<{ confirmed: number; stillUnknown: number }> {
  const entries = readStored(store);
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
  writeStored(store, remaining);
  return { confirmed, stillUnknown: remaining.length };
}

/** Record a broadcast attempt. Re-recording the same hash + chain replaces it. */
export function recordPendingBroadcast(entry: {
  txHash: string;
  chain: ChainId;
  nonce?: number;
}): PendingBroadcast {
  return recordBroadcastInStore(mainnetStore, entry);
}

export function listPendingBroadcasts(): PendingBroadcast[] {
  return readStored(mainnetStore);
}

export function removePendingBroadcast(txHash: string, chain: ChainId): void {
  writeStored(
    mainnetStore,
    readStored(mainnetStore).filter(
      (item) => !(item.txHash === txHash && item.chain === chain),
    ),
  );
}

/** TEMPORARY devnet mode: the parallel devnet record, separate key. */
export function recordPendingBroadcastDevnet(entry: {
  txHash: string;
  chain: ChainId;
  nonce?: number;
}): PendingBroadcast {
  return recordBroadcastInStore(devnetStore, entry);
}

export function listPendingBroadcastsDevnet(): PendingBroadcast[] {
  return readStored(devnetStore);
}

export function removePendingBroadcastDevnet(
  txHash: string,
  chain: ChainId,
): void {
  writeStored(
    devnetStore,
    readStored(devnetStore).filter(
      (item) => !(item.txHash === txHash && item.chain === chain),
    ),
  );
}

type BroadcastResolution = 'confirmed' | 'not-found' | 'unknown';

/**
 * Reconcile every pending broadcast against a read-only resolver.
 * Confirmed entries are removed (they settled); anything else stays
 * pending. This never resubmits a transaction.
 */
export async function reconcilePendingBroadcasts(
  resolve: (entry: PendingBroadcast) => Promise<BroadcastResolution>,
): Promise<{ confirmed: number; stillUnknown: number }> {
  return reconcileBroadcastsInStore(mainnetStore, resolve);
}

/** TEMPORARY devnet mode: reconcile the devnet record only. */
export async function reconcilePendingBroadcastsDevnet(
  resolve: (entry: PendingBroadcast) => Promise<BroadcastResolution>,
): Promise<{ confirmed: number; stillUnknown: number }> {
  return reconcileBroadcastsInStore(devnetStore, resolve);
}
