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
/** localStorage key for the recently picked Receive chains. Kept apart
    from the send/swap/watch-only recents (same reason as above). */
export const RECEIVE_RECENT_CHAINS_KEY = 'bawa:receive-recent-chains';
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

/** The family a chain belongs to, as a stable id — one implementation
    shared by the picker and the Networks screen (T1-8): the two used
    to disagree on TRON (picker: "TRON", Networks: "Other"). */
export type ChainFamily = 'evm' | 'solana' | 'bitcoin' | 'tron' | 'ton' | 'other';

/** The order family groups render in: EVM first, then the
    single-chain families, then everything else. Shared by the picker
    and the Networks tabs. */
export const CHAIN_FAMILY_ORDER: readonly ChainFamily[] = [
  'evm',
  'solana',
  'bitcoin',
  'tron',
  'ton',
  'other',
];

/** Display label for a family id. */
export const CHAIN_FAMILY_LABELS: Record<ChainFamily, string> = {
  evm: 'EVM',
  solana: 'Solana',
  bitcoin: 'Bitcoin',
  tron: 'TRON',
  ton: 'TON',
  other: 'Other',
};

/** The family a chain belongs to, derived from the registry data —
    evmChainId for EVM, coinTypeName for the rest — so a chain added
    to the registry later groups itself without a code change. */
export function chainFamilyId(chain: ChainId): ChainFamily {
  const config = chainConfig(chain);
  if (config.evmChainId !== null && config.evmChainId !== undefined) return 'evm';
  switch (config.coinTypeName) {
    case 'solana':
      return 'solana';
    case 'bitcoin':
    case 'litecoin':
    case 'dogecoin':
      return 'bitcoin';
    case 'tron':
      return 'tron';
    case 'ton':
      return 'ton';
    default:
      return 'other';
  }
}

/** The family a chain belongs to, as a display label. Thin wrapper
    over chainFamilyId — the label contract the picker tests pin. */
export function chainFamily(chain: ChainId): string {
  return CHAIN_FAMILY_LABELS[chainFamilyId(chain)];
}

// --- Family tabs (Lane P2-C, M5) ---

/** One family tab for the picker: 'all' plus one tab per family
    that has chains in the offered set, counts from the registry
    (never hard-coded). The same tab set as the Networks screen (P1
    item 7) — same mapping (T1-8), same labels, same order — so the
    two never disagree; TRON keeps its own tab in both. */
export interface PickerFamilyTab {
  id: 'all' | ChainFamily;
  label: string;
  count: number;
}

export function pickerFamilyTabs(
  chains: readonly ChainId[],
): PickerFamilyTab[] {
  const counts = new Map<ChainFamily, number>();
  for (const chain of chains) {
    const family = chainFamilyId(chain);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const tabs: PickerFamilyTab[] = [
    { id: 'all', label: 'All', count: chains.length },
  ];
  for (const family of CHAIN_FAMILY_ORDER) {
    const count = counts.get(family) ?? 0;
    if (count > 0) {
      tabs.push({ id: family, label: CHAIN_FAMILY_LABELS[family], count });
    }
  }
  return tabs;
}

interface ChainGroup {
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
  const byFamily = new Map<ChainFamily, ChainId[]>();
  for (const chain of chains) {
    if (recentSet.has(chain)) continue;
    const family = chainFamilyId(chain);
    const list = byFamily.get(family) ?? [];
    list.push(chain);
    byFamily.set(family, list);
  }
  for (const family of CHAIN_FAMILY_ORDER) {
    const list = byFamily.get(family);
    if (list !== undefined && list.length > 0) {
      groups.push({ heading: CHAIN_FAMILY_LABELS[family], chains: list });
    }
  }
  return groups;
}

/** A picker value: one chain, or 'all' for the Transactions filter
    (the only call site that filters rather than picks). */
type ChainPickerValue = ChainId | 'all';

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
  // Lane P2-C (M5): the active family tab — 'all' is the whole list,
  // a family filters it. The search filters inside the active family
  // (the Networks screen's pattern, P1 item 7).
  const [family, setFamily] = useState<'all' | ChainFamily>('all');

  const listboxId = `${id}-listbox`;
  const filtered = useMemo(() => filterChains(chains, query), [chains, query]);
  const tabs = useMemo(() => pickerFamilyTabs(chains), [chains]);
  // A family tab with no chains in the offered set cannot stay
  // active (the offered set changed under the picker): it reads as All.
  const effectiveFamily =
    family === 'all' || tabs.some((tab) => tab.id === family) ? family : 'all';
  // The tabs filter the list. The list under the EVM tab IS the EVM
  // sub-chain selector — the mined pattern's second level, with no
  // extra dropdown: every EVM chain is one row with its logo.
  function chainsForFamily(nextFamily: 'all' | ChainFamily): ChainId[] {
    return nextFamily === 'all'
      ? filtered
      : filtered.filter((chain) => chainFamilyId(chain) === nextFamily);
  }
  const familyFiltered = chainsForFamily(effectiveFamily);
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
  // path and the open dropdown covers them anyway). The family tab
  // filters the recents too: a recent from another family is not in
  // this family's list.
  const recentInList = recent.filter(
    (chain) => chain !== value && familyFiltered.includes(chain),
  );
  const groups = groupChainsByFamily(familyFiltered, recentInList);
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

  // Switching family re-aims the keyboard at the first pickable row
  // of the new family — a stale activeId from the old family would
  // make ArrowDown jump to a row that is no longer listed.
  function selectFamily(next: 'all' | ChainFamily): void {
    setFamily(next);
    setActiveId(firstPickable(chainsForFamily(next)));
  }

  function handleFamilyTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: 'all' | ChainFamily,
  ): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    // Roving tabindex, automatic activation — the tabs-accessibility
    // pattern, same as the Networks screen's tabs: arrows move focus
    // and switch the family in one motion.
    event.preventDefault();
    const index = tabs.findIndex((entry) => entry.id === tabId);
    const next =
      event.key === 'Home'
        ? tabs[0]!
        : event.key === 'End'
          ? tabs[tabs.length - 1]!
          : tabs[
              (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                tabs.length
            ]!;
    selectFamily(next.id);
    document.getElementById(`${id}-family-${next.id}-tab`)?.focus();
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
          <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-ink bg-paper shadow-lg">
            {/* Lane P2-C (M5): family tabs filter the list — one tab
                per family with its count, same set and styling as
                the Networks screen. Hidden when the offered chains
                span a single family (All and that family would list
                the same rows). The tabs sit outside the scrolling
                list, so they never scroll away. */}
            {tabs.length > 2 && (
              <div
                role="tablist"
                aria-label="Filter chains by family"
                className="flex flex-wrap gap-1 border-b-2 border-ink p-1"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={`${id}-family-${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={effectiveFamily === tab.id}
                    tabIndex={effectiveFamily === tab.id ? 0 : -1}
                    onMouseDown={(event) => {
                      // Keep focus in the search field: without this
                      // the input blurs and the list closes before
                      // the click lands (same as the option rows).
                      event.preventDefault();
                    }}
                    onClick={() => selectFamily(tab.id)}
                    onKeyDown={(event) => handleFamilyTabKeyDown(event, tab.id)}
                    className={`min-h-11 rounded-flat-sm px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent ${
                      effectiveFamily === tab.id
                        ? 'bg-sun text-ink'
                        : 'text-ink hover:bg-sun'
                    }`}
                  >
                    {`${tab.label} (${tab.count})`}
                  </button>
                ))}
              </div>
            )}
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
              className="max-h-64 overflow-auto rounded-none"
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
                {/* Under All the family headings group the list (as
                    before); under a family tab the tab already names
                    the family, so the heading would only repeat it. */}
                {effectiveFamily === 'all' && (
                  <li
                    role="presentation"
                    aria-hidden="true"
                    className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.heading}
                  </li>
                )}
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
            {familyFiltered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                {effectiveFamily === 'all'
                  ? `No chains match “${query.trim()}”.`
                  : `No ${CHAIN_FAMILY_LABELS[effectiveFamily]} chains match “${query.trim()}”.`}
              </li>
            )}
            </ul>
          </div>
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
