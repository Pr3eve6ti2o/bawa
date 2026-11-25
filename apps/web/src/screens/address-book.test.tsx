// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { AddressBookScreen } from './address-book';
import { validateRecipient } from '../wallet/send';
import {
  ADDRESS_BOOK_KEY,
  MAX_ADDRESS_BOOK_ENTRIES,
  newAddressBookId,
  readAddressBook,
  shortAddress,
  writeAddressBook,
  type AddressBookEntry,
} from '../wallet/address-book';

vi.mock('../wallet/send', () => ({
  validateRecipient: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function memoryStore(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const MAYA: AddressBookEntry = {
  id: 'entry-1',
  label: 'Maya',
  address: '0x1111111111111111111111111111111111111111',
  chain: 'eth',
};

describe('address-book storage', () => {
  it('starts empty when nothing is stored', () => {
    expect(readAddressBook(memoryStore())).toEqual([]);
  });

  it('round-trips entries through the versioned key', () => {
    const store = memoryStore();
    writeAddressBook([MAYA], store);
    expect(readAddressBook(store)).toEqual([MAYA]);
    const raw = store.getItem(ADDRESS_BOOK_KEY);
    expect(raw).not.toBeNull();
    expect((JSON.parse(raw as string) as { version: number }).version).toBe(1);
  });

  it('falls back to empty on corrupt JSON, a wrong version, or an unknown chain', () => {
    expect(
      readAddressBook(memoryStore({ [ADDRESS_BOOK_KEY]: 'not json' })),
    ).toEqual([]);
    expect(
      readAddressBook(
        memoryStore({
          [ADDRESS_BOOK_KEY]: JSON.stringify({ version: 2, entries: [MAYA] }),
        }),
      ),
    ).toEqual([]);
    expect(
      readAddressBook(
        memoryStore({
          [ADDRESS_BOOK_KEY]: JSON.stringify({
            version: 1,
            entries: [{ ...MAYA, chain: 'no-such-chain' }],
          }),
        }),
      ),
    ).toEqual([]);
  });

  it('never throws when the store itself throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('no storage');
      },
      setItem: () => {
        throw new Error('no storage');
      },
    };
    expect(readAddressBook(broken)).toEqual([]);
    expect(() => writeAddressBook([MAYA], broken)).not.toThrow();
  });

  it('shortens long addresses and leaves short ones alone', () => {
    expect(shortAddress(MAYA.address)).toBe('0x111111…111111');
    expect(shortAddress('bc1qxy')).toBe('bc1qxy');
  });

  it('mints distinct ids', () => {
    expect(newAddressBookId()).not.toBe(newAddressBookId());
  });

  it('exposes a sane cap', () => {
    expect(MAX_ADDRESS_BOOK_ENTRIES).toBeGreaterThan(0);
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error('button not found: ' + text);
  return button as HTMLButtonElement;
}

async function mountScreen() {
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/address-book']}>
        <AddressBookScreen />
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

describe('AddressBookScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(validateRecipient).mockReset();
    vi.mocked(validateRecipient).mockResolvedValue({ ok: true });
  });

  it('shows the empty state and saves a valid address', async () => {
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No saved addresses yet');
      const label = mounted.div.querySelector(
        '#address-book-label',
      ) as HTMLInputElement;
      const address = mounted.div.querySelector(
        '#address-book-address',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(label, 'Maya');
        setInputValue(address, MAYA.address);
      });
      await act(async () => {
        findButton(mounted.div, 'Save address').click();
      });
      expect(mounted.div.textContent).toContain('Maya saved to your address book.');
      expect(mounted.div.textContent).toContain('Maya');
      expect(mounted.div.textContent).toContain(MAYA.address);
      expect(readAddressBook()).toEqual([
        expect.objectContaining({ label: 'Maya', address: MAYA.address, chain: 'eth' }),
      ]);
      expect(vi.mocked(validateRecipient)).toHaveBeenCalledWith('eth', MAYA.address);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the validation error inline, saves nothing, and keeps the typed values', async () => {
    vi.mocked(validateRecipient).mockResolvedValue({
      ok: false,
      reason: 'Invalid Ethereum address.',
    });
    const mounted = await mountScreen();
    try {
      const label = mounted.div.querySelector(
        '#address-book-label',
      ) as HTMLInputElement;
      const address = mounted.div.querySelector(
        '#address-book-address',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(label, 'Maya');
        setInputValue(address, 'not-an-address');
      });
      await act(async () => {
        findButton(mounted.div, 'Save address').click();
      });
      expect(mounted.div.textContent).toContain('Invalid Ethereum address.');
      expect(readAddressBook()).toEqual([]);
      expect(label.value).toBe('Maya');
      expect(address.value).toBe('not-an-address');
    } finally {
      await mounted.cleanup();
    }
  });

  it('requires a label before saving', async () => {
    const mounted = await mountScreen();
    try {
      const address = mounted.div.querySelector(
        '#address-book-address',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(address, MAYA.address);
      });
      await act(async () => {
        findButton(mounted.div, 'Save address').click();
      });
      expect(mounted.div.textContent).toContain('Give this address a label');
      expect(vi.mocked(validateRecipient)).not.toHaveBeenCalled();
      expect(readAddressBook()).toEqual([]);
    } finally {
      await mounted.cleanup();
    }
  });

  it('removes an entry only on the second tap, then shows the empty state', async () => {
    writeAddressBook([MAYA]);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Maya');
      await act(async () => {
        findButton(mounted.div, 'Remove').click();
      });
      expect(readAddressBook()).toEqual([MAYA]);
      expect(mounted.div.textContent).toContain('Tap again to remove');
      await act(async () => {
        findButton(mounted.div, 'Tap again to remove').click();
      });
      expect(readAddressBook()).toEqual([]);
      expect(mounted.div.textContent).toContain('No saved addresses yet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('edits a saved entry in place', async () => {
    writeAddressBook([MAYA]);
    const mounted = await mountScreen();
    try {
      await act(async () => {
        findButton(mounted.div, 'Edit').click();
      });
      const label = mounted.div.querySelector(
        '#address-book-label',
      ) as HTMLInputElement;
      expect(label.value).toBe('Maya');
      await act(async () => {
        setInputValue(label, 'Maya (new)');
      });
      await act(async () => {
        findButton(mounted.div, 'Save changes').click();
      });
      expect(readAddressBook()).toEqual([
        expect.objectContaining({ id: 'entry-1', label: 'Maya (new)' }),
      ]);
    } finally {
      await mounted.cleanup();
    }
  });
});
