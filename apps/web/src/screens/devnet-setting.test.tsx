// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../state/wallet-context';
import { DevnetSetting } from './devnet-setting';

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
        <DevnetSetting />
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

function getSwitch(div: HTMLDivElement) {
  const toggle = div.querySelector<HTMLElement>(
    '[role="switch"][aria-label="Devnet"]',
  );
  expect(toggle).not.toBeNull();
  return toggle!;
}

describe('DevnetSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that the wallet uses mainnet when devnet is off', () => {
    setWallet();
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Devnet off');
      expect(div.textContent).toContain('the wallet uses mainnet');
      expect(div.textContent).not.toContain('Bitcoin testnet4');
    } finally {
      cleanup();
    }
  });

  it('enables devnet when the switch is clicked', async () => {
    const wallet = setWallet();
    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);

      await act(async () => {
        toggle.click();
      });

      expect(wallet.setDevnetEnabled).toHaveBeenCalledTimes(1);
      expect(wallet.setDevnetEnabled).toHaveBeenCalledWith(true);
    } finally {
      cleanup();
    }
  });

  it('disables devnet when the switch is clicked while on', async () => {
    const wallet = setWallet({ devnetEnabled: true });
    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);

      await act(async () => {
        toggle.click();
      });

      expect(wallet.setDevnetEnabled).toHaveBeenCalledTimes(1);
      expect(wallet.setDevnetEnabled).toHaveBeenCalledWith(false);
    } finally {
      cleanup();
    }
  });

  it('states temporary, test-only and valueless tokens when devnet is on', () => {
    setWallet({ devnetEnabled: true });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Devnet on');
      expect(div.textContent).toContain('temporary test mode');
      expect(div.textContent).toContain('valueless test tokens');
      expect(div.textContent).toContain('without touching mainnet');
    } finally {
      cleanup();
    }
  });

  it('lists the per-chain devnet status when devnet is on', () => {
    setWallet({ devnetEnabled: true });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Bitcoin testnet4');
      expect(div.textContent).toContain('Ethereum Sepolia');
      expect(div.textContent).toContain('TRON Nile');
      expect(div.textContent).toContain('TON testnet');
    } finally {
      cleanup();
    }
  });

  it('shows the no-vault notice when there is no vault', () => {
    setWallet({ vaultState: 'no-vault' });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain(
        'No vault yet — create or import a wallet first.',
      );
      expect((getSwitch(div) as HTMLButtonElement).disabled).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('shows the error when toggling fails', async () => {
    const wallet = setWallet({
      setDevnetEnabled: vi.fn(async () => {
        throw new Error('toggle failed');
      }),
    });
    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);

      await act(async () => {
        toggle.click();
      });

      expect(wallet.setDevnetEnabled).toHaveBeenCalledTimes(1);
      expect(div.textContent).toContain('toggle failed');
    } finally {
      cleanup();
    }
  });
});
