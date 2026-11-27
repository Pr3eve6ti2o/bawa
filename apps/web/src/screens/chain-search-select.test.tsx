// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  chainFamily,
  ChainSearchSelect,
  filterChains,
  groupChainsByFamily,
  LAST_USED_CHAIN_KEY,
  MAX_RECENT_CHAINS,
  readLastUsedChain,
  readRecentChains,
  RECENT_CHAINS_KEY,
  recordLastUsedChain,
  SEND_RECENT_CHAINS_KEY,
} from './chain-search-select';
import type { ChainId } from '../engine/boundary';

// UI/UX Round 2, item 3: the watch-only chain picker was one horizontal
// row of 22 pills that slid sideways and cut chains off past the edge.
// It is now a search bar that opens the full list on click, with the
// chains the user picked before in a Recent row right below it.
const CHAINS: ChainId[] = [
  'btc',
  'eth',
  'trx',
  'ton',
  'sol',
  'bsc',
  'matic',
  'arb',
  'op',
  'base',
  'avax',
  'gnosis',
  'celo',
  'linea',
  'mantle',
  'scroll',
  'opbnb',
  'metis',
  'aurora',
  'fantom',
  'ltc',
  'doge',
];

const actGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('filterChains', () => {
  it('returns every chain for an empty query', () => {
    expect(filterChains(CHAINS, '')).toEqual(CHAINS);
    expect(filterChains(CHAINS, '   ')).toEqual(CHAINS);
  });

  it('matches by display name', () => {
    // 'bit' is a substring of both Bitcoin and Arbitrum — substring
    // matching is the point, the list shows the full name either way.
    expect(filterChains(CHAINS, 'bit')).toEqual(['btc', 'arb']);
    expect(filterChains(CHAINS, 'bitcoin')).toEqual(['btc']);
    expect(filterChains(CHAINS, 'SOLANA')).toEqual(['sol']);
  });

  it('matches by chain id', () => {
    expect(filterChains(CHAINS, 'opbnb')).toEqual(['opbnb']);
    expect(filterChains(CHAINS, 'matic')).toEqual(['matic']);
  });

  it('matches by symbol, including shared symbols', () => {
    // Arbitrum One, OP Mainnet, Base, Linea, Scroll and Aurora all
    // settle in ETH, so 'eth' must list them all — the row shows the
    // chain name, not just the symbol, so they stay distinguishable.
    expect(filterChains(CHAINS, 'eth')).toEqual([
      'eth',
      'arb',
      'op',
      'base',
      'linea',
      'scroll',
      'aurora',
    ]);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterChains(CHAINS, 'zzz')).toEqual([]);
  });
});

describe('ChainSearchSelect', () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  function renderSelect(
    value: ChainId = 'btc',
    onChange: (chain: ChainId) => void = () => {},
  ) {
    act(() => {
      root.render(
        <ChainSearchSelect
          chains={CHAINS}
          value={value}
          onChange={onChange}
          id="test-chain-search"
        />,
      );
    });
    return container;
  }

  function input(): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>('#test-chain-search');
    if (!found) throw new Error('chain search input not found');
    return found;
  }

  function options(): Element[] {
    return [...container.querySelectorAll('[role="option"]')];
  }

  function openList(): void {
    if (!open) return;
    act(() => {
      input().blur();
      input().focus();
      input().click();
    });
  }

  function setInputValue(value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!setter) throw new Error('no input value setter');
    act(() => {
      setter.call(input(), value);
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  beforeEach(() => {
    previousActEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;
    actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    if (previousActEnvironment === undefined) {
      delete actGlobal.IS_REACT_ACT_ENVIRONMENT;
    } else {
      actGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it('shows the selected chain name while closed and no list', () => {
    renderSelect('sol');
    expect(input().value).toBe('Solana');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.textContent).not.toContain('Recent');
  });

  it('opens the full list on click, with every chain as an option', () => {
    renderSelect();
    openList();
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(options()).toHaveLength(CHAINS.length);
    expect(options().map((option) => option.textContent)).toContain('Solana SOL');
    expect(options().map((option) => option.textContent)).toContain('Dogecoin DOGE');
  });

  it('filters the list as the user types', () => {
    renderSelect();
    openList();
    setInputValue('sol');
    expect(options().map((option) => option.textContent)).toEqual(['Solana SOL']);
  });

  it('says so honestly when nothing matches', () => {
    renderSelect();
    openList();
    setInputValue('zzz');
    expect(options()).toHaveLength(0);
    expect(container.textContent).toContain('No chains match');
  });

  it('picks a chain on click, closes, and remembers it in Recent', () => {
    const onChange = vi.fn();
    renderSelect('btc', onChange);
    openList();
    const solana = options().find(
      (option) => option.textContent === 'Solana SOL',
    );
    expect(solana).not.toBeUndefined();
    act(() => {
      solana!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (solana as HTMLElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('sol');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.textContent).toContain('Recent');
    expect(container.textContent).toContain('Solana');
    expect(readRecentChains()).toEqual(['sol']);
    expect(JSON.parse(window.localStorage.getItem(RECENT_CHAINS_KEY) ?? '[]')).toEqual([
      'sol',
    ]);
  });

  it('keeps the most recent picks first, capped, without the current chain', () => {
    const onChange = vi.fn();
    renderSelect('btc', onChange);
    // Pick SOL, then ETH, then SOL again: SOL moves back to the front.
    for (const name of ['Solana SOL', 'Ethereum ETH', 'Solana SOL']) {
      openList();
      const option = options().find((candidate) => candidate.textContent === name);
      expect(option).not.toBeUndefined();
      act(() => {
        option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        (option as HTMLElement).click();
      });
    }
    expect(readRecentChains()).toEqual(['sol', 'eth']);
    // The current chain (BTC) never appears in its own Recent row, and
    // the row lists the picks newest first.
    const recentGroup = container.querySelector('[role="group"]');
    expect(recentGroup).not.toBeNull();
    expect([...(recentGroup as Element).querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Solana',
      'Ethereum',
    ]);
    expect(MAX_RECENT_CHAINS).toBe(5);
  });

  it('picks a recent chain straight from the Recent row', () => {
    const onChange = vi.fn();
    window.localStorage.setItem(RECENT_CHAINS_KEY, JSON.stringify(['sol', 'eth']));
    renderSelect('btc', onChange);
    const recentSol = [...container.querySelectorAll('[role="group"] button')].find(
      (button) => button.textContent === 'Solana',
    );
    expect(recentSol).not.toBeUndefined();
    act(() => {
      (recentSol as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('sol');
  });

  it('drops stale ids stored under the recent key', () => {
    window.localStorage.setItem(
      RECENT_CHAINS_KEY,
      JSON.stringify(['sol', 'not-a-chain', 42, 'eth']),
    );
    expect(readRecentChains()).toEqual(['sol', 'eth']);
  });

  it('keeps Send recents under the Send key, apart from watch-only recents', () => {
    // Redesign Lane 3 (Send): Send passes SEND_RECENT_CHAINS_KEY so
    // the chains a user sends on never mix with the chains they watch
    // — and a watch-only recent never surfaces on the Send step.
    window.localStorage.setItem(RECENT_CHAINS_KEY, JSON.stringify(['eth']));
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ChainSearchSelect
          chains={CHAINS}
          value="btc"
          onChange={onChange}
          id="test-chain-search"
          recentKey={SEND_RECENT_CHAINS_KEY}
        />,
      );
    });
    // No Recent row from the watch-only key.
    expect(container.textContent).not.toContain('Recent');
    openList();
    const solana = options().find(
      (option) => option.textContent === 'Solana SOL',
    );
    expect(solana).not.toBeUndefined();
    act(() => {
      solana!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (solana as HTMLElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('sol');
    expect(readRecentChains(SEND_RECENT_CHAINS_KEY)).toEqual(['sol']);
    expect(readRecentChains()).toEqual(['eth']);
    expect(
      JSON.parse(
        window.localStorage.getItem(SEND_RECENT_CHAINS_KEY) ?? '[]',
      ),
    ).toEqual(['sol']);
  });

  it('selects with ArrowDown and Enter, and closes with Escape', () => {
    const onChange = vi.fn();
    renderSelect('btc', onChange);
    openList();
    // Focus opens with the current chain active; one ArrowDown moves to
    // the next chain in group order — EVM first, then Solana, then
    // Bitcoin — so BTC is followed by LTC, not ETH.
    // (P1 Lane S1: the list is family-grouped now.)
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
    });
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });
    expect(onChange).toHaveBeenCalledWith('ltc');
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    // Escape closes the open list without picking anything.
    openList();
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('groups the list by chain family, Recent first', () => {
    window.localStorage.setItem(RECENT_CHAINS_KEY, JSON.stringify(['sol', 'eth']));
    renderSelect('btc');
    openList();
    const headings = [...container.querySelectorAll('[role="presentation"]')].map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(['Recent', 'EVM', 'Bitcoin', 'TRON', 'TON']);
    // The Recent group leads with the recent picks, newest first, and
    // a recent chain never repeats in its family group.
    const texts = [...container.querySelectorAll('[role="option"]')].map(
      (option) => option.textContent,
    );
    expect(texts[0]).toBe('Solana SOL');
    expect(texts[1]).toBe('Ethereum ETH');
    expect(texts.filter((text) => text === 'Solana SOL')).toHaveLength(1);
  });

  it('shows the real chain logo on every row', () => {
    renderSelect();
    openList();
    const solana = options().find((option) => option.textContent === 'Solana SOL');
    expect(solana).not.toBeUndefined();
    const img = solana!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('Solana logo');
  });

  it('records the last-used chain on every pick', () => {
    const onChange = vi.fn();
    renderSelect('btc', onChange);
    openList();
    const solana = options().find((option) => option.textContent === 'Solana SOL');
    expect(solana).not.toBeUndefined();
    act(() => {
      solana!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (solana as HTMLElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('sol');
    expect(readLastUsedChain()).toBe('sol');
    expect(JSON.parse(window.localStorage.getItem(LAST_USED_CHAIN_KEY) ?? '[]')).toBe(
      'sol',
    );
  });

  it('drops a stale last-used chain', () => {
    window.localStorage.setItem(LAST_USED_CHAIN_KEY, JSON.stringify('not-a-chain'));
    expect(readLastUsedChain()).toBeNull();
    window.localStorage.setItem(LAST_USED_CHAIN_KEY, JSON.stringify(['sol']));
    expect(readLastUsedChain()).toBeNull();
    recordLastUsedChain('eth');
    expect(readLastUsedChain()).toBe('eth');
    expect(readLastUsedChain(['btc', 'sol'])).toBeNull();
    expect(readLastUsedChain(['btc', 'eth'])).toBe('eth');
  });

  it('groups chains by family, EVM first', () => {
    expect(chainFamily('eth')).toBe('EVM');
    expect(chainFamily('sol')).toBe('Solana');
    expect(chainFamily('btc')).toBe('Bitcoin');
    expect(chainFamily('trx')).toBe('TRON');
    expect(chainFamily('ton')).toBe('TON');
    expect(
      groupChainsByFamily(['ton', 'btc', 'eth', 'sol']).map((group) => group.heading),
    ).toEqual(['EVM', 'Solana', 'Bitcoin', 'TON']);
  });

  it('offers an All chains row when allowAll', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ChainSearchSelect
          chains={CHAINS}
          value="all"
          onChange={onChange}
          id="test-chain-search"
          allowAll
        />,
      );
    });
    expect(input().value).toBe('All chains');
    openList();
    const all = options().find((option) =>
      option.textContent?.startsWith('All chains'),
    );
    expect(all).not.toBeUndefined();
    act(() => {
      all!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (all as HTMLElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('shows a disabled chain with its reason and never picks it', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ChainSearchSelect
          chains={CHAINS}
          value="btc"
          onChange={onChange}
          id="test-chain-search"
          isDisabled={(chain) => (chain === 'sol' ? 'No token standard' : null)}
        />,
      );
    });
    openList();
    const solana = options().find((option) =>
      option.textContent?.includes('Solana'),
    );
    expect(solana).not.toBeUndefined();
    expect(solana?.getAttribute('aria-disabled')).toBe('true');
    expect(solana?.textContent).toContain('No token standard');
    act(() => {
      solana!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (solana as HTMLElement).click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
