// Chain search select (UI/UX Round 2, item 3; P1 Lane S1: the ONE shared
// searchable chain picker).
//
// The watch-only Import screen used to show all 22 chains as one
// horizontal row of pills with no wrapping: on a phone the row slid
// sideways and the later chains (MANTLE, SCROLL, …) were cut off past
// the edge. This replaces the row with a search bar: click (or focus)
// it and the full chain list opens; typing filters it by name, symbol
// or chain id. Every chain the user picks is kept in a "Recent" row
// right below the search bar, so the chains they actually use stay one
// tap away. Recents are chain ids only — no keys, no addresses — stored
// in localStorage under RECENT_CHAINS_KEY.
//
// P1 (Lane S1): this is now the single shared picker every chain choice
// in the wallet goes through — Send, Track, Add Token, Add Chain, the
// Transactions filter, Import, Address book, Networks, and (wired by
// Lane S4) Swap and Receive. One component, one behaviour:
// - search box (name, symbol or chain id);
// - chain-family grouping (EVM / Solana / Bitcoin / TRON / TON / Other),
//   with the Recent picks first — the list is grouped, never a flat 87;
// - logo + name + chain on every row (ChainLogo, the real chain mark);
// - the last-used chain is recorded on every pick (LAST_USED_CHAIN_KEY)
//   so the flows can pre-select it and the common case needs no chain
//   step at all.
//
// Accessibility follows the WAI-ARIA APG select-only combobox pattern:
// the input carries role="combobox" with aria-expanded, aria-controls
// and aria-activedescendant; the list is role="listbox" with
// role="option" rows. Arrow keys move, Enter picks, Escape closes.
import { Fragment, useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { ChainId } from '../engine/boundary';
import { chainConfig, filterChains, SUPPORTED_CHAINS } from '../wallet/chains';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { BawaIcon } from '../ui/components/icons';
import { ChainLogo } from './token-logo';

/** Re-exported from wallet/chains (Lane 5) so existing importers keep working. */
export { filterChains };

/** localStorage key for the recently picked watch-only chains. */
export const RECENT_CHAINS_KEY = 'bawa:watch-only-recent-chains';
/** localStorage key for the recently picked Send chains. Kept apart
    from the watch-only recents: the chains a user sends on are not
    the chains they watch, and mixing the two lists would surface
    watch-only chains on the Send step (and vice versa). */
export const SEND_RECENT_CHAINS_KEY = 'bawa:send-recent-chains';
/** localStorage key for the recently picked Swap chains. Kept apart
    from the send/watch-only recents (same reason as above). */
export const SWAP_RECENT_CHAINS_KEY = 'bawa:swap-recent-chains';
/** How many picked chains the Recent row keeps. */
export const MAX_RECENT_CHAINS = 5;
/** localStorage key for the last chain picked anywhere (P1 Lane S1):
    one shared last-used chain across Send, Receive, Swap, Track, Add
    Token and Add Chain, so the common case needs no chain step — the
    flows pre-select it on entry. A single chain id only: no keys, no
    addresses, never a balance or a secret. */
export const LAST_USED_CHAIN_KEY = 'bawa:last-used-chain';

const VALID_CHAIN_IDS = new Set<ChainId>(SUPPORTED_CHAINS);

/** The stored recents, newest first, with stale ids dropped. */
export function readRecentChains(key: string = RECENT_CHAINS_KEY): ChainId[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ChainId =>
        typeof entry === 'string' && VALID_CHAIN_IDS.has(entry as ChainId),
    );
  } catch {
    return [];
  }
}

function storeRecentChains(recent: ChainId[], key: string = RECENT_CHAINS_KEY): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(recent));
  } catch {
    // Recent picks are a convenience, never load-bearing: a full or
    // unavailable store must not break the picker.
  }
}

/** The last chain picked anywhere, or null when none was recorded, the
    stored value is stale, or it is outside `chains` when given. */
export function readLastUsedChain(chains?: readonly ChainId[]): ChainId | null {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_USED_CHAIN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'string' || !VALID_CHAIN_IDS.has(parsed as ChainId)) {
      return null;
    }
    const chain = parsed as ChainId;
    if (chains !== undefined && !chains.includes(chain)) return null;
    return chain;
  } catch {
    return null;
  }
}

/** Record a chain as the last-used one. A convenience, never
    load-bearing: a full or unavailable store must not break the
    picker or the caller. */
export function recordLastUsedChain(chain: ChainId): void {
  try {
    globalThis.localStorage?.setItem(LAST_USED_CHAIN_KEY, JSON.stringify(chain));
  } catch {
    // Last-used is a convenience, never load-bearing.
  }
}

// --- Chain families (P1 Lane S1; Lane E M5) ---

/** The family a chain belongs to, derived from the registry data —
    evmChainId for EVM, coinTypeName for the rest — so a chain added
    to the registry later groups itself without a code change. */
export function chainFamily(chain: ChainId): string {
  const config = chainConfig(chain);
  if (config.evmChainId !== null && config.evmChainId !== undefined) return 'EVM';
  switch (config.coinTypeName) {
    case 'solana':
      return 'Solana';
    case 'bitcoin':
    case 'litecoin':
    case 'dogecoin':
      return 'Bitcoin';
    case 'tron':
      return 'TRON';
    case 'ton':
      return 'TON';
    default:
      return 'Other';
  }
}

/** The order family groups render in: EVM first, then the
    single-chain families, then everything else. */
export const CHAIN_FAMILY_ORDER: readonly string[] = [
  'EVM',
  'Solana',
  'Bitcoin',
  'TRON',
  'TON',
  'Other',
];

export interface ChainGroup {
  heading: string;
  chains: ChainId[];
}

/** Group chains for a picker list: an optional Recent group first
    (newest first), then one group per family in CHAIN_FAMILY_ORDER.
    Chains in `recent` never repeat in their family group. */
export function groupChainsByFamily(
  chains: readonly ChainId[],
  recent: readonly ChainId[] = [],
): ChainGroup[] {
  const recentSet = new Set(recent);
  const groups: ChainGroup[] = [];
  // Newest first: the stored recent order, restricted to the chains
  // actually offered (and matching the search, when there is one).
  const recentChains = recent.filter((chain) => chains.includes(chain));
  if (recentChains.length > 0) {
    groups.push({ heading: 'Recent', chains: recentChains });
  }
  const byFamily = new Map<string, ChainId[]>();
  for (const chain of chains) {
    if (recentSet.has(chain)) continue;
    const family = chainFamily(chain);
    const list = byFamily.get(family) ?? [];
    list.push(chain);
    byFamily.set(family, list);
  }
  for (const family of CHAIN_FAMILY_ORDER) {
    const list = byFamily.get(family);
    if (list !== undefined && list.length > 0) {
      groups.push({ heading: family, chains: list });
    }
  }
  return groups;
}

/** A picker value: one chain, or 'all' for the Transactions filter
    (the only call site that filters rather than picks). */
export type ChainPickerValue = ChainId | 'all';

export function ChainSearchSelect<T extends ChainPickerValue = ChainId>({
  chains,
  value,
  onChange,
  id = 'chain-search',
  disabled = false,
  recentKey = RECENT_CHAINS_KEY,
  allowAll = false,
  isDisabled,
}: {
  /** Every chain the picker may offer, in display order. */
  chains: readonly ChainId[];
  /** The currently selected chain (or 'all' when allowAll). */
  value: T;
  onChange: (chain: T) => void;
  id?: string;
  disabled?: boolean;
  /** localStorage key for this picker's Recent row. The watch-only
      default stays for the watch-only caller; Send passes
      SEND_RECENT_CHAINS_KEY so the two lists never mix. */
  recentKey?: string;
  /** When true, an "All chains" row leads the list and the value may
      be 'all'. Only the Transactions filter uses this. */
  allowAll?: boolean;
  /** When set, a chain that returns a reason renders disabled with
      the reason shown, and cannot be picked (Add Token: chains with
      no token standard). */
  isDisabled?: (chain: ChainId) => string | null;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<ChainPickerValue | null>(null);
  const [recent, setRecent] = useState<ChainId[]>(() => readRecentChains(recentKey));

  const listboxId = `${id}-listbox`;
  const filtered = useMemo(() => filterChains(chains, query), [chains, query]);
  // Closed, the field shows the selected chain's name, so the current
  // choice is always visible. Open, it shows what the user typed.
  const inputValue = open
    ? query
    : value === 'all'
      ? 'All chains'
      : chainConfig(value as ChainId).displayName;
  // The current chain is already the selection; the Recent row only
  // needs the other chains the user picked before.
  const recentVisible = recent.filter((chain) => chain !== value);
  // The dropdown's Recent group shows the recents that match the
  // query (the chips below stay unfiltered — they are the one-tap
  // path and the open dropdown covers them anyway).
  const recentInList = recent.filter(
    (chain) => chain !== value && filtered.includes(chain),
  );
  const groups = groupChainsByFamily(filtered, recentInList);
  // What the keyboard can land on: the All row first when present,
  // then every group in order. Disabled chains are shown, never
  // landed on.
  const navigable: ChainPickerValue[] = [];
  if (allowAll) navigable.push('all');
  for (const group of groups) {
    for (const chain of group.chains) {
      if (isDisabled?.(chain) == null) navigable.push(chain);
    }
  }

  function select(chain: ChainId): void {
    if (disabled) return;
    if (isDisabled?.(chain) != null) return;
    onChange(chain as T);
    recordLastUsedChain(chain);
    const next = [chain, ...recent.filter((entry) => entry !== chain)].slice(
      0,
      MAX_RECENT_CHAINS,
    );
    setRecent(next);
    storeRecentChains(next, recentKey);
    setQuery('');
    setOpen(false);
    setActiveId(null);
  }

  function selectAll(): void {
    if (disabled || !allowAll) return;
    onChange('all' as T);
    setQuery('');
    setOpen(false);
    setActiveId(null);
  }

  function openList(): void {
    if (disabled) return;
    setQuery('');
    setOpen(true);
    setActiveId(value);
  }

  // The first row the keyboard lands on for a fresh filter: the All
  // row when present, else the first pickable chain in group order.
  function firstPickable(nextFiltered: ChainId[]): ChainPickerValue | null {
    if (allowAll) return 'all';
    const nextRecent = recent.filter(
      (chain) => chain !== value && nextFiltered.includes(chain),
    );
    for (const group of groupChainsByFamily(nextFiltered, nextRecent)) {
      const pick = group.chains.find((chain) => isDisabled?.(chain) == null);
      if (pick !== undefined) return pick;
    }
    return null;
  }

  function closeList(): void {
    setQuery('');
    setOpen(false);
    setActiveId(null);
  }

  // Focus leaving the whole picker (input, list or Recent row) closes
  // the list. Focus moving between the picker's own parts keeps it open.
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const next = event.relatedTarget as Node | null;
    if (next !== null && event.currentTarget.contains(next)) return;
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (navigable.length === 0) return;
      const at = activeId === null ? -1 : navigable.indexOf(activeId);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (at + step + navigable.length) % navigable.length;
      setActiveId(navigable[next] ?? null);
      return;
    }
    if (event.key === 'Enter') {
      // Open: Enter picks, it must not submit the surrounding form.
      // Closed: Enter falls through and submits, as before.
      if (!open) return;
      event.preventDefault();
      if (activeId !== null && navigable.includes(activeId)) {
        if (activeId === 'all') selectAll();
        else select(activeId);
      } else if (navigable.length === 1) {
        const only = navigable[0];
        if (only !== undefined) {
          if (only === 'all') selectAll();
          else select(only);
        }
      }
      return;
    }
    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      closeList();
    }
  }

  return (
    <div className="space-y-2" onBlur={handleBlur}>
      <Label htmlFor={id}>Chain</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeId !== null ? `${id}-option-${activeId}` : undefined
          }
          aria-autocomplete="list"
          aria-label="Search chains"
          value={inputValue}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            setActiveId(firstPickable(filterChains(chains, nextQuery)));
          }}
          onFocus={openList}
          // After a pick the field keeps focus, so a later click would
          // fire no focus event: reopen the list on click too. Clicking
          // while it is already open leaves the typed query alone.
          onClick={() => {
            if (!open) openList();
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Search chains…"
          disabled={disabled}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink"
        >
          <BawaIcon
            name="chevron-down"
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Chains"
            // Square corners on purpose: the list floats over the form
            // below it, and any radius lets the fields beneath show
            // through the corners (the wobbly radius left the xpub
            // label's "A" visible; rounded-xl still let the coral Add
            // button peek through the bottom corner). A dropdown that
            // overlaps form content has to be opaque to its edges.
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-none border-2 border-ink bg-paper shadow-lg"
          >
            {allowAll && (
              <li
                key="all"
                id={`${id}-option-all`}
                role="option"
                aria-selected={value === 'all'}
                onMouseDown={(event) => {
                  // Keep focus in the search field: without this the
                  // input blurs and the list closes before click.
                  event.preventDefault();
                }}
                onClick={() => selectAll()}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-base ${
                  activeId === 'all' ? 'bg-muted' : ''
                } ${value === 'all' ? 'font-semibold' : ''}`}
              >
                <span data-chain-option-name className="min-w-0 flex-1 truncate">
                  All chains
                </span>
                {value === 'all' && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Selected
                  </span>
                )}
              </li>
            )}
            {groups.map((group) => (
              <Fragment key={group.heading}>
                <li
                  role="presentation"
                  aria-hidden="true"
                  className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {group.heading}
                </li>
                {group.chains.map((chain) => {
                  const config = chainConfig(chain);
                  const isSelected = chain === value;
                  const isActive = chain === activeId;
                  const disabledReason = isDisabled?.(chain) ?? null;
                  return (
                    <li
                      key={chain}
                      id={`${id}-option-${chain}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={disabledReason !== null ? true : undefined}
                      onMouseDown={(event) => {
                        // Keep focus in the search field: without this the
                        // input blurs and the list closes before click.
                        event.preventDefault();
                      }}
                      onClick={() => select(chain)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-base ${
                        isActive ? 'bg-muted' : ''
                      } ${isSelected ? 'font-semibold' : ''} ${
                        disabledReason !== null
                          ? 'cursor-not-allowed opacity-40'
                          : ''
                      }`}
                    >
                      <ChainLogo chain={chain} size={32} />
                      <span
                        data-chain-option-name
                        className="min-w-0 flex-1 truncate"
                      >
                        {config.displayName}{' '}
                        <span className="text-muted-foreground">
                          {chain.toUpperCase()}
                        </span>
                      </span>
                      {disabledReason !== null ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {disabledReason}
                        </span>
                      ) : isSelected ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Selected
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No chains match &ldquo;{query.trim()}&rdquo;.
              </li>
            )}
          </ul>
        )}
      </div>
      {recentVisible.length > 0 && (
        <div className="space-y-1">
          <p
            id={`${id}-recent-label`}
            className="text-xs font-medium text-muted-foreground"
          >
            Recent
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby={`${id}-recent-label`}
          >
            {recentVisible.map((chain) => (
              <button
                key={chain}
                type="button"
                disabled={disabled}
                onClick={() => select(chain)}
                className="h-11 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chainConfig(chain).displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
