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
  options: {
    vaultAccounts?: number[];
    vaultPassphraseNeeded?: boolean;
    createVaultAccounts?: (count: number) => Promise<number[]>;
    selectVaultAccount?: (account: number) => Promise<void>;
  } = {},
): void {
  vi.mocked(useWallet).mockReturnValue({
    xpubs: { btc: null, eth: null, trx: null, ton: null },
    removeXpub: vi.fn(),
    vaultAccount,
    setVaultAccount,
    vaultAddresses: TEST_ADDRESSES,
    vaultAccounts: options.vaultAccounts ?? [0],
    vaultPassphraseNeeded: options.vaultPassphraseNeeded ?? false,
    createVaultAccounts: options.createVaultAccounts ?? vi.fn(async () => []),
    selectVaultAccount: options.selectVaultAccount ?? vi.fn(async () => {}),
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
  it('shows the derived addresses and the Solana/TON note (the vault is always unlocked)', async () => {
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
        'Solana and TON addresses change with the account as well',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('always shows the accounts section — the vault never locks', async () => {
    // Vault-lock removal: the section used to hide when the vault was
    // locked. There is no locked state any more, so it always renders.
    setWallet(vi.fn(async () => {}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('#vault-account')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Your accounts');
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

  it('explains in plain English what Wallets is for and how accounts work', async () => {
    setWallet(vi.fn(async () => {}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        'Wallets is where you manage the wallets this app knows about.',
      );
      expect(mounted.div.textContent).toContain(
        'Your recovery phrase holds all your accounts.',
      );
      expect(mounted.div.textContent).toContain('multichain wallet');
      expect(mounted.div.textContent).toContain('HD wallet');
      expect(mounted.div.textContent).toContain('Addresses for this account');
      expect(mounted.div.textContent).toContain('Account number');
      expect(mounted.div.textContent).toContain(
        'Receiving address number (HD)',
      );
      expect(mounted.div.textContent).toContain(
        'Watching only shows what is already public on the network — it cannot send.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists a watch-only Solana wallet, not just the four original chains', async () => {
    // Token gaps, item 6 + item 8: the Wallets screen only listed
    // watch-only wallets for BTC/ETH/TRX/TON, so an imported SOL
    // wallet was invisible here even though it was stored.
    vi.mocked(useWallet).mockReturnValue({
      xpubs: {
        btc: null,
        eth: null,
        trx: null,
        ton: null,
        sol: {
          chain: 'sol',
          xpub: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
          label: '',
          derivedCount: 1,
        },
      },
      removeXpub: vi.fn(),
      vaultAccount: { account: 0, index: 0 },
      setVaultAccount: vi.fn(async () => {}),
      vaultAddresses: TEST_ADDRESSES,
      vaultAccounts: [0],
      vaultPassphraseNeeded: false,
      createVaultAccounts: vi.fn(async () => []),
      selectVaultAccount: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Solana');
      expect(mounted.div.textContent).toContain('4uQeVj5tqViQ');
      expect(mounted.div.textContent).toContain('WCJziofM');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('wallet management — accounts list and bulk creation', () => {
  // Lane C, items 7 + 17: one recovery phrase holds many named accounts.
  // The Wallets screen lists them (Account 1, Account 2, …), lets the
  // user create more in bulk, and switches between them — without ever
  // asking them to delete anything.
  function findButton(div: HTMLElement, text: string): HTMLButtonElement {
    const found = [...div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    );
    if (!found) throw new Error(`no button with text ${text}`);
    return found as HTMLButtonElement;
  }

  it('lists the accounts with a Current badge and a Switch button', async () => {
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0, 1],
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Account 1');
      expect(mounted.div.textContent).toContain('Account 2');
      expect(mounted.div.textContent).toContain('Current');
      expect(
        [...mounted.div.querySelectorAll('button')].some(
          (candidate) =>
            candidate.textContent === 'Switch to Account 2',
        ),
      ).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('switching calls selectVaultAccount with the account index', async () => {
    const selectVaultAccount = vi.fn(async () => {});
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0, 1],
      selectVaultAccount,
    });
    const mounted = await mountScreen();
    try {
      await act(async () => {
        findButton(mounted.div, 'Switch to Account 2').click();
      });
      expect(selectVaultAccount).toHaveBeenCalledWith(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('creates 10 new accounts from the bulk control and names them', async () => {
    const created = Array.from({ length: 10 }, (_, i) => i + 1);
    const createVaultAccounts = vi.fn(async () => created);
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0],
      createVaultAccounts,
    });
    const mounted = await mountScreen();
    try {
      const count = mounted.div.querySelector(
        '#create-accounts-count',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(count, '10');
      });
      await act(async () => {
        findButton(mounted.div, 'Create accounts').click();
      });
      expect(createVaultAccounts).toHaveBeenCalledWith(10);
      expect(mounted.div.textContent).toContain(
        'Account 2 to Account 11 created',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('quick pick 50 creates 50 accounts', async () => {
    const created = Array.from({ length: 50 }, (_, i) => i + 1);
    const createVaultAccounts = vi.fn(async () => created);
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0],
      createVaultAccounts,
    });
    const mounted = await mountScreen();
    try {
      const pick = mounted.div.querySelector(
        '[aria-label="Create 50 accounts"]',
      ) as HTMLButtonElement;
      await act(async () => {
        pick.click();
      });
      expect(createVaultAccounts).toHaveBeenCalledWith(50);
      expect(mounted.div.textContent).toContain(
        'Account 2 to Account 51 created',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a count outside 1–50 without calling create', async () => {
    const createVaultAccounts = vi.fn(async () => []);
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0],
      createVaultAccounts,
    });
    const mounted = await mountScreen();
    try {
      const count = mounted.div.querySelector(
        '#create-accounts-count',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(count, '0');
      });
      await act(async () => {
        findButton(mounted.div, 'Create accounts').click();
      });
      expect(createVaultAccounts).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('between 1 and 50');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the passphrase notice with a link to unlock', async () => {
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [0],
      vaultPassphraseNeeded: true,
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('recovery passphrase');
      const link = mounted.div.querySelector(
        'a[href="/lock"]',
      ) as HTMLAnchorElement;
      expect(link).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows an empty state with no vault, and a way to create one', async () => {
    setWallet(vi.fn(async () => {}), { account: 0, index: 0 }, {
      vaultAccounts: [],
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        "You don't have a wallet yet",
      );
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
      expect(mounted.div.querySelector('#vault-account')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
