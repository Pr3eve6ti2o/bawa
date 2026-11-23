// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../state/wallet-context';
import { NetworkModePill } from './app';

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
    root.render(<NetworkModePill />);
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

function getPill(div: HTMLDivElement) {
  const pill = div.querySelector<HTMLButtonElement>(
    'button[aria-label="Switch to devnet"], button[aria-label="Switch to mainnet"]',
  );
  expect(pill).not.toBeNull();
  return pill!;
}

describe('NetworkModePill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Mainnet as a button that switches to devnet when tapped', async () => {
    const wallet = setWallet({ devnetEnabled: false });
    const { div, cleanup } = mount();

    try {
      const pill = getPill(div);
      expect(pill.textContent).toBe('Mainnet');
      expect(pill.getAttribute('aria-pressed')).toBe('false');
      expect(pill.disabled).toBe(false);

      await act(async () => {
        pill.click();
      });

      expect(wallet.setDevnetEnabled).toHaveBeenCalledTimes(1);
      expect(wallet.setDevnetEnabled).toHaveBeenCalledWith(true);
    } finally {
      cleanup();
    }
  });

  it('renders Devnet as a pressed button that switches back to mainnet when tapped', async () => {
    const wallet = setWallet({ devnetEnabled: true });
    const { div, cleanup } = mount();

    try {
      const pill = getPill(div);
      expect(pill.textContent).toBe('Devnet — test mode');
      expect(pill.getAttribute('aria-pressed')).toBe('true');

      await act(async () => {
        pill.click();
      });

      expect(wallet.setDevnetEnabled).toHaveBeenCalledTimes(1);
      expect(wallet.setDevnetEnabled).toHaveBeenCalledWith(false);
    } finally {
      cleanup();
    }
  });

  it('is disabled with no vault, and tapping does nothing', async () => {
    const wallet = setWallet({ vaultState: 'no-vault' });
    const { div, cleanup } = mount();

    try {
      const pill = getPill(div);
      expect(pill.disabled).toBe(true);

      await act(async () => {
        pill.click();
      });

      expect(wallet.setDevnetEnabled).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it('announces a failed toggle instead of failing silently', async () => {
    setWallet({
      setDevnetEnabled: vi.fn(async () => {
        throw new Error('Could not switch networks — try again.');
      }),
    });
    const { div, cleanup } = mount();

    try {
      const pill = getPill(div);

      await act(async () => {
        pill.click();
      });

      const alert = div.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert!.textContent).toContain('Could not switch networks');
    } finally {
      cleanup();
    }
  });
});
