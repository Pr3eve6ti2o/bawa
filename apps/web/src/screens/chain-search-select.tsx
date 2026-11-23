// Chain search select (UI/UX Round 2, item 3).
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
// Accessibility follows the WAI-ARIA APG select-only combobox pattern:
// the input carries role="combobox" with aria-expanded, aria-controls
// and aria-activedescendant; the list is role="listbox" with
// role="option" rows. Arrow keys move, Enter picks, Escape closes.
import { useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { ChainId } from '../engine/boundary';
import { chainConfig, SUPPORTED_CHAINS } from '../wallet/chains';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

/** localStorage key for the recently picked watch-only chains. */
export const RECENT_CHAINS_KEY = 'bawa:watch-only-recent-chains';
/** How many picked chains the Recent row keeps. */
export const MAX_RECENT_CHAINS = 5;

const VALID_CHAIN_IDS = new Set<ChainId>(SUPPORTED_CHAINS);

/** Chains whose name, symbol or id contains the query (case-insensitive). */
export function filterChains(chains: readonly ChainId[], query: string): ChainId[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...chains];
  return chains.filter((chain) => {
    const config = chainConfig(chain);
    return (
      config.displayName.toLowerCase().includes(needle) ||
      config.symbol.toLowerCase().includes(needle) ||
      chain.toLowerCase().includes(needle)
    );
  });
}

/** The stored recents, newest first, with stale ids dropped. */
export function readRecentChains(): ChainId[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_CHAINS_KEY);
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

function storeRecentChains(recent: ChainId[]): void {
  try {
    globalThis.localStorage?.setItem(RECENT_CHAINS_KEY, JSON.stringify(recent));
  } catch {
    // Recent picks are a convenience, never load-bearing: a full or
    // unavailable store must not break the picker.
  }
}

export function ChainSearchSelect({
  chains,
  value,
  onChange,
  id = 'chain-search',
  disabled = false,
}: {
  /** Every chain the picker may offer, in display order. */
  chains: readonly ChainId[];
  /** The currently selected chain. */
  value: ChainId;
  onChange: (chain: ChainId) => void;
  id?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<ChainId | null>(null);
  const [recent, setRecent] = useState<ChainId[]>(() => readRecentChains());

  const listboxId = `${id}-listbox`;
  const filtered = useMemo(() => filterChains(chains, query), [chains, query]);
  // Closed, the field shows the selected chain's name, so the current
  // choice is always visible. Open, it shows what the user typed.
  const inputValue = open ? query : chainConfig(value).displayName;
  // The current chain is already the selection; the Recent row only
  // needs the other chains the user picked before.
  const recentVisible = recent.filter((chain) => chain !== value);

  function select(chain: ChainId): void {
    if (disabled) return;
    onChange(chain);
    const next = [chain, ...recent.filter((entry) => entry !== chain)].slice(
      0,
      MAX_RECENT_CHAINS,
    );
    setRecent(next);
    storeRecentChains(next);
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
      if (filtered.length === 0) return;
      const at = activeId === null ? -1 : filtered.indexOf(activeId);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (at + step + filtered.length) % filtered.length;
      setActiveId(filtered[next] ?? null);
      return;
    }
    if (event.key === 'Enter') {
      // Open: Enter picks, it must not submit the surrounding form.
      // Closed: Enter falls through and submits, as before.
      if (!open) return;
      event.preventDefault();
      if (activeId !== null && filtered.includes(activeId)) {
        select(activeId);
      } else if (filtered.length === 1) {
        const only = filtered[0];
        if (only !== undefined) select(only);
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
            setActiveId(filterChains(chains, nextQuery)[0] ?? null);
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
          <svg
            viewBox="0 0 16 16"
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 6l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No chains match &ldquo;{query.trim()}&rdquo;.
              </li>
            ) : (
              filtered.map((chain) => {
                const config = chainConfig(chain);
                const isSelected = chain === value;
                const isActive = chain === activeId;
                return (
                  <li
                    key={chain}
                    id={`${id}-option-${chain}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => {
                      // Keep focus in the search field: without this the
                      // input blurs and the list closes before click.
                      event.preventDefault();
                    }}
                    onClick={() => select(chain)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm ${
                      isActive ? 'bg-muted' : ''
                    } ${isSelected ? 'font-semibold' : ''}`}
                  >
                    <span>
                      {config.displayName}{' '}
                      <span className="text-muted-foreground">
                        {chain.toUpperCase()}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="text-xs text-muted-foreground">
                        Selected
                      </span>
                    )}
                  </li>
                );
              })
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
                className="h-8 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
