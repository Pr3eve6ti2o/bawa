// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../state/wallet-context';
import { NetworkSelectionScreen } from './network-selection';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type Wallet = ReturnType<typeof useWallet>;

function setWallet(overrides: Partial<Wallet> = {}) {
  const wallet = {
    vaultState: 'unlocked',
    devnetEnabled: false,
    setDevnetEnabled: vi.fn(async () => {}),
    ...overrides,
  } as Wallet;

  vi.mocked(useWallet).mockReturnValue(wallet);
  return wallet;
}

function mount() {
  const div = document.createElement('div');
  document.body.appendChild(div);

  const root = createRoot(div);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/networks']}>
        <NetworkSelectionScreen />
      </MemoryRouter>,
    );
  });

  return {
    div,
    cleanup() {
      act(() => {
        root.unmount();
      });
      div.remove();
    },
  };
}

describe('NetworkSelectionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('states mainnet-only and lists the four mainnets when devnet is off', () => {
    setWallet();
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain(
        'Mainnet only. This wallet never connects to a test network.',
      );
      expect(div.textContent).toContain('Bitcoin mainnet');
      expect(div.textContent).toContain('Ethereum mainnet');
      expect(div.textContent).toContain('TRON mainnet');
      expect(div.textContent).toContain('TON mainnet');
      expect(div.textContent).toContain('Devnet — temporary test mode');
    } finally {
      cleanup();
    }
  });

  it('states devnet test mode when devnet is on', () => {
    setWallet({ devnetEnabled: true });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Devnet test mode is on.');
      expect(div.textContent).toContain('valueless test tokens');
      expect(div.textContent).not.toContain(
        'Mainnet only. This wallet never connects to a test network.',
      );
      expect(div.textContent).toContain('Bitcoin testnet4');
    } finally {
      cleanup();
    }
  });
});
