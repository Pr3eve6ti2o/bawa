// Address book (UX-major Lane 5): saved recipient addresses, stored
// locally, never sent anywhere.
//
// Same persistence pattern as bawa:enabled-chains:v1 /
// bawa:custom-tokens:v1 in ./tokens.ts: versioned JSON under one key,
// best-effort writes, corrupt or stale data falls back to empty.
// What is stored is public data only — a label, a chain and a public
// receiving address. No private key, no recovery phrase, no secret of
// any kind ever goes here (cf. token-storage-security: localStorage
// holds no tokens or credentials; the watch-only xpubs follow the
// same public-data-only precedent).
//
// An entry is only ever added by the user typing or pasting it on the
// Address book screen. Nothing is auto-added from history, balances
// or received payments: saving a counterparty's address without being
// asked would be a consent surprise, and a mistyped save is the
// user's to fix (edit/delete on the screen).

import type { ChainId } from '../engine/boundary';
import { SUPPORTED_CHAINS } from './chains';

export const ADDRESS_BOOK_KEY = 'bawa:address-book:v1';

/** Hard cap: a book is a short list of frequent recipients, not a dump. */
export const MAX_ADDRESS_BOOK_ENTRIES = 100;

export interface AddressBookEntry {
  id: string;
  label: string;
  address: string;
  chain: ChainId;
}

interface AddressBookStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): AddressBookStore | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntry(value: unknown): value is AddressBookEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    typeof value.chain === 'string' &&
    (SUPPORTED_CHAINS as readonly string[]).includes(value.chain)
  );
}

export function readAddressBook(store?: AddressBookStore): AddressBookEntry[] {
  const storage = store ?? defaultStore();
  try {
    const raw = storage?.getItem(ADDRESS_BOOK_KEY);
    if (raw === null || raw === undefined) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return [];
    }
    return (parsed.entries as unknown[]).filter(isEntry).map((entry) => ({
      id: entry.id,
      label: entry.label.trim(),
      address: entry.address.trim(),
      chain: entry.chain,
    }));
  } catch {
    return [];
  }
}

export function writeAddressBook(
  entries: readonly AddressBookEntry[],
  store?: AddressBookStore,
): void {
  const storage = store ?? defaultStore();
  try {
    storage?.setItem(
      ADDRESS_BOOK_KEY,
      JSON.stringify({ version: 1, entries: [...entries] }),
    );
  } catch {
    // Persistence is best-effort; the in-memory list still works.
  }
}

/** Stable-enough id for a user-created entry (never a secret). */
export function newAddressBookId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Short form for option labels and list rows; the full address is
    always shown beside it (or one tap away via Copy). */
export function shortAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 18) return trimmed;
  return trimmed.slice(0, 8) + '…' + trimmed.slice(-6);
}
