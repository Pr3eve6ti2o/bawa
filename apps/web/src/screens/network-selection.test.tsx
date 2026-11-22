// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { NetworkSelectionScreen } from './network-selection';
import { useWallet } from '../state/wallet-context';
import { SUPPORTED_CHAINS } from '../wallet/chains';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function setWallet(enabledChains: string[]) {
  const mock = {
    enabledChains,
    setChainEnabled: vi.fn(),
    customTokens: [],
  };
  vi.mocked(useWallet).mockReturnValue(
    mock as unknown as ReturnType<typeof useWallet>,
  );
  return mock;
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter>
        <NetworkSelectionScreen />
      </MemoryRouter>,
    );
  });
  return {
    div,
    cleanup: async () => {
      try {
        await act(async () => {
          root.unmount();
        });
      } finally {
        div.remove();
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

describe('NetworkSelectionScreen', () => {
  it('lists all thirteen registry chains with their enable state', async () => {
    setWallet([...SUPPORTED_CHAINS].filter((chain) => chain !== 'sol'));
    const mounted = await mountScreen();
    try {
      for (const name of [
        'Bitcoin',
        'Ethereum',
        'TRON',
        'TON',
        'Solana',
        'BNB Smart Chain',
        'Polygon',
        'Arbitrum One',
        'OP Mainnet',
        'Base',
        'Avalanche C-Chain',
        'Litecoin',
        'Dogecoin',
      ]) {
        expect(mounted.div.textContent).toContain(name);
      }
      expect(mounted.div.textContent).toContain('DISABLED');
      expect(mounted.div.textContent).toContain('ACTIVE');
    } finally {
      await mounted.cleanup();
    }
  });

  it('disabling a chain calls setChainEnabled with false', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const buttons = [...mounted.div.querySelectorAll('button')].filter(
        (button) => button.textContent === 'Disable',
      );
      expect(buttons.length).toBe(13);
      await act(async () => {
        buttons[0]!.click();
      });
      expect(wallet.setChainEnabled).toHaveBeenCalledWith('btc', false);
    } finally {
      await mounted.cleanup();
    }
  });

  it('enabling a disabled chain calls setChainEnabled with true', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS].filter((chain) => chain !== 'sol'));
    const mounted = await mountScreen();
    try {
      const buttons = [...mounted.div.querySelectorAll('button')].filter(
        (button) => button.textContent === 'Enable',
      );
      expect(buttons.length).toBe(1);
      await act(async () => {
        buttons[0]!.click();
      });
      expect(wallet.setChainEnabled).toHaveBeenCalledWith('sol', true);
    } finally {
      await mounted.cleanup();
    }
  });
});
