// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildApprovedNamespaces,
  clearWalletConnectProjectId,
  envWalletConnectProjectId,
  parseCaipAccount,
  readWalletConnectProjectId,
  saveWalletConnectProjectId,
  walletConnectAccounts,
  WALLETCONNECT_PROJECT_ID_KEY,
} from './walletconnect';

/** In-memory stand-in for localStorage: the functions take it explicitly. */
function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

const ADDRESS = '0x1111111111111111111111111111111111111111';
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';

beforeEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('WalletConnect projectId config', () => {
  it('returns undefined with no saved id and no env var', () => {
    const store = memoryStore();
    expect(readWalletConnectProjectId(store)).toBeUndefined();
    expect(envWalletConnectProjectId()).toBeUndefined();
  });

  it('saves and reads the projectId, and clears it again', () => {
    const store = memoryStore();
    saveWalletConnectProjectId('  test-only-project-id  ', store);
    expect(readWalletConnectProjectId(store)).toBe('test-only-project-id');
    expect(store.getItem(WALLETCONNECT_PROJECT_ID_KEY)).toBe(
      'test-only-project-id',
    );
    clearWalletConnectProjectId(store);
    expect(readWalletConnectProjectId(store)).toBeUndefined();
  });

  it('refuses to save a blank projectId', () => {
    expect(() => saveWalletConnectProjectId('   ', memoryStore())).toThrow(
      'Enter a WalletConnect projectId first.',
    );
  });

  it('prefers the saved setting over the build-time variable', () => {
    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'env-project-id');
    const store = memoryStore();
    expect(readWalletConnectProjectId(store)).toBe('env-project-id');
    saveWalletConnectProjectId('saved-project-id', store);
    expect(readWalletConnectProjectId(store)).toBe('saved-project-id');
  });
});

describe('parseCaipAccount', () => {
  it('parses a well-formed account id', () => {
    expect(parseCaipAccount(`eip155:1:${ADDRESS}`)).toEqual({
      namespace: 'eip155',
      reference: '1',
      address: ADDRESS,
    });
  });

  it('rejects malformed account ids', () => {
    expect(parseCaipAccount('eip155:1')).toBeNull();
    expect(parseCaipAccount('eip155:1:0xabc:extra')).toBeNull();
    expect(parseCaipAccount('eip155::0xabc')).toBeNull();
    expect(parseCaipAccount('')).toBeNull();
  });
});

describe('walletConnectAccounts', () => {
  it('serves one CAIP account per enabled EVM chain with an address', () => {
    const accounts = walletConnectAccounts(
      {
        eth: [ADDRESS],
        bsc: [ADDRESS],
        ronin: [`ronin:${OTHER_ADDRESS}`],
        btc: ['bc1qexample'],
      },
      ['eth', 'bsc', 'ronin', 'btc'],
    );
    expect(accounts).toEqual([
      `eip155:1:${ADDRESS}`,
      `eip155:56:${ADDRESS}`,
      `eip155:2020:${OTHER_ADDRESS}`,
    ]);
  });

  it('skips disabled chains, chains without an address, and bad addresses', () => {
    const accounts = walletConnectAccounts(
      {
        eth: [ADDRESS],
        bsc: [ADDRESS],
        matic: ['not-an-address'],
      },
      ['eth', 'matic'],
    );
    expect(accounts).toEqual([`eip155:1:${ADDRESS}`]);
  });
});

describe('buildApprovedNamespaces', () => {
  const accounts = [
    `eip155:1:${ADDRESS}`,
    `eip155:56:${ADDRESS}`,
  ];

  it('approves the required chains with only the supported methods', () => {
    const built = buildApprovedNamespaces({
      requiredNamespaces: {
        eip155: {
          chains: ['eip155:1'],
          methods: ['personal_sign'],
          events: ['chainChanged'],
        },
      },
      optionalNamespaces: {},
      accounts,
    });
    expect(built).toEqual({
      ok: true,
      namespaces: {
        eip155: {
          chains: ['eip155:1'],
          accounts: [`eip155:1:${ADDRESS}`],
          methods: ['personal_sign'],
          events: ['chainChanged'],
        },
      },
    });
  });

  it('adds overlapping optional chains and methods', () => {
    const built = buildApprovedNamespaces({
      requiredNamespaces: {
        eip155: {
          chains: ['eip155:1'],
          methods: ['personal_sign'],
          events: [],
        },
      },
      optionalNamespaces: {
        eip155: {
          chains: ['eip155:56', 'eip155:999999'],
          methods: ['eth_signTypedData_v4', 'eth_sendTransaction'],
          events: ['accountsChanged'],
        },
      },
      accounts,
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.namespaces['eip155']?.chains).toEqual([
        'eip155:1',
        'eip155:56',
      ]);
      expect(built.namespaces['eip155']?.methods).toEqual([
        'personal_sign',
        'eth_signTypedData_v4',
      ]);
      expect(built.namespaces['eip155']?.events).toEqual(['accountsChanged']);
      // eth_sendTransaction is never approved: sending is switched off.
      expect(built.namespaces['eip155']?.methods).not.toContain(
        'eth_sendTransaction',
      );
    }
  });

  it('fails when a required chain is not held', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:999999'],
            methods: ['personal_sign'],
            events: [],
          },
        },
        optionalNamespaces: {},
        accounts,
      }),
    ).toEqual({ ok: false, reason: 'no-common-chain' });
  });

  it('fails when a required method is a transaction method', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:1'],
            methods: ['eth_sendTransaction'],
            events: [],
          },
        },
        optionalNamespaces: {},
        accounts,
      }),
    ).toEqual({ ok: false, reason: 'no-supported-method' });
  });

  it('fails when a required namespace is not eip155', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          solana: {
            chains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
            methods: ['signMessage'],
            events: [],
          },
        },
        optionalNamespaces: {},
        accounts,
      }),
    ).toEqual({ ok: false, reason: 'unsupported-namespace' });
  });

  it('fails when a required event is not supported', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:1'],
            methods: ['personal_sign'],
            events: ['somethingChanged'],
          },
        },
        optionalNamespaces: {},
        accounts,
      }),
    ).toEqual({ ok: false, reason: 'unsupported-event' });
  });

  it('fails when no method would be approved', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: [], events: [] },
        },
        optionalNamespaces: {},
        accounts,
      }),
    ).toEqual({ ok: false, reason: 'no-supported-method' });
  });

  it('fails with no accounts to serve', () => {
    expect(
      buildApprovedNamespaces({
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:1'],
            methods: ['personal_sign'],
            events: [],
          },
        },
        optionalNamespaces: {},
        accounts: [],
      }),
    ).toEqual({ ok: false, reason: 'no-common-chain' });
  });
});
