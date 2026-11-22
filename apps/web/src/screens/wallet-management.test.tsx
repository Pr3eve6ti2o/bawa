// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { WalletManagementScreen } from './wallet-management';
import { useWallet } from '../state/wallet-context';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const TEST_ADDRESSES = {
  btc: ['bc1qtest'],
  eth: ['0xTestEthAddress'],
  trx: ['TTestTrxAddress'],
  ton: ['UQTestTonAddress'],
};

function setWallet(
  setVaultAccount: (account: number, index: number) => Promise<void>,
  vaultAccount = { account: 0, index: 0 },
  xpubs: Record<'btc' | 'eth' | 'trx' | 'ton', { xpub: string; label?: string } | null> = {
    btc: null,
    eth: null,
    trx: null,
    ton: null,
  },
): void {
  vi.mocked(useWallet).mockReturnValue({
    xpubs,
    removeXpub: vi.fn(),
    vaultAccount,
    setVaultAccount,
    vaultAddresses: TEST_ADDRESSES,
  } as unknown as ReturnType<typeof useWallet>);
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/wallets']}>
        <WalletManagementScreen />
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

describe('wallet management — vault account selection', () => {
  it('shows the derived addresses and the TON note (the vault is always unlocked)', async () => {
    setWallet(vi.fn(async () => {}));
    const mounted = await mountScreen();
    try {
      expect(
        mounted.div.querySelector('#vault-account'),
      ).not.toBeNull();
      expect(mounted.div.textContent).toContain('bc1qtest');
      expect(mounted.div.textContent).toContain('0xTestEthAddress');
      expect(mounted.div.textContent).toContain('TTestTrxAddress');
      expect(mounted.div.textContent).toContain('UQTestTonAddress');
      expect(mounted.div.textContent).toContain(
        'TON has one address per wallet',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('always shows the vault account section — the vault never locks', async () => {
    // Vault-lock removal: the section used to hide when the vault was
    // locked. There is no locked state any more, so it always renders.
    setWallet(vi.fn(async () => {}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('#vault-account')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Vault account');
    } finally {
      await mounted.cleanup();
    }
  });

  it('applies the entered account/index and clamps invalid input to 0', async () => {
    const setVaultAccount = vi.fn(async () => {});
    setWallet(setVaultAccount);
    const mounted = await mountScreen();
    try {
      const index = mounted.div.querySelector(
        '#vault-index',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(index, '1');
      });
      const apply = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Apply',
      ) as HTMLButtonElement;
      await act(async () => {
        apply.click();
      });
      expect(setVaultAccount).toHaveBeenCalledWith(0, 1);

      const account = mounted.div.querySelector(
        '#vault-account',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(account, '-3');
        setInputValue(index, 'not a number');
      });
      await act(async () => {
        apply.click();
      });
      expect(setVaultAccount).toHaveBeenCalledWith(0, 0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the error when setVaultAccount throws', async () => {
    setWallet(async () => {
      throw new RangeError('index must be a non-negative safe integer below 0x80000000');
    });
    const mounted = await mountScreen();
    try {
      const index = mounted.div.querySelector(
        '#vault-index',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(index, '2147483648');
      });
      const apply = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Apply',
      ) as HTMLButtonElement;
      await act(async () => {
        apply.click();
      });
      expect(mounted.div.textContent).toContain(
        'index must be a non-negative safe integer below 0x80000000',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the vault card beside the imported wallets on desktop widths', async () => {
    // Follow-up: the vault card sat left and the imported list
    // underneath it in a full-width two-column grid, which left the
    // "No wallets imported" card mostly empty and the vault card with
    // dead space bottom-right. The screen is now two columns at lg —
    // vault card left, imported list (or the empty card), note and
    // Forget-all button in a right rail. The vault address list keeps
    // its own two columns inside the vault card. Below lg the same
    // blocks stack in one column in the same order (space-y-6, no bare
    // grid class), so the mobile layout is untouched.
    setWallet(async () => {}, { account: 0, index: 0 }, {
      btc: { xpub: 'xpub6TestBtc1234567890abcdef' },
      eth: null,
      trx: null,
      ton: null,
    });
    const mounted = await mountScreen();
    try {
      const section = mounted.div.querySelector('section');
      expect(section?.className).toContain('space-y-6');
      expect(section?.className).toContain('lg:grid');
      expect(section?.className).toContain('lg:grid-cols-[7fr_5fr]');
      expect(section?.className).not.toMatch(
        /(^|\s)grid-cols-\[7fr_5fr\](\s|$)/,
      );
      const dl = mounted.div.querySelector('dl');
      expect(dl?.className).toContain('lg:grid');
      expect(dl?.className).toContain('lg:grid-cols-2');
      expect(dl?.className).toContain('space-y-3');
      expect(dl?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      const list = [...mounted.div.querySelectorAll('ul')].find((el) =>
        el.querySelector('[aria-label="Forget stored Bitcoin key"]'),
      );
      expect(list?.className).toContain('lg:grid');
      expect(list?.className).toContain('lg:grid-cols-1');
      expect(list?.className).not.toContain('lg:grid-cols-2');
      expect(list?.className).toContain('space-y-4');
      expect(list?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
    } finally {
      await mounted.cleanup();
    }
  });
});
