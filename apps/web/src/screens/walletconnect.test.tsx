// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { WalletConnectScreen } from './walletconnect';
import { useWallet } from '../state/wallet-context';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

const ADDRESS = '0x1111111111111111111111111111111111111111';

const wcMocks = vi.hoisted(() => {
  const pair = vi.fn(async () => {});
  const approveProposal = vi.fn(async () => undefined);
  const rejectProposal = vi.fn(async () => {});
  const respondWithResult = vi.fn(async () => {});
  const respondWithError = vi.fn(async () => {});
  const rejectSessionAuthenticate = vi.fn(async () => {});
  const disconnectSession = vi.fn(async () => {});
  const getSessions = vi.fn((): SessionTypes.Struct[] => []);
  const getPendingProposals = vi.fn((): ProposalTypes.Struct[] => []);
  const getPendingRequests = vi.fn(
    (): Array<{
      id: number;
      topic: string;
      method: string;
      params: unknown;
      chainId: string;
    }> => [],
  );
  const on = vi.fn();
  const off = vi.fn();
  const client = {
    pair,
    approveProposal,
    rejectProposal,
    respondWithResult,
    respondWithError,
    rejectSessionAuthenticate,
    disconnectSession,
    getSessions,
    getPendingProposals,
    getPendingRequests,
    on,
    off,
  };
  const initWalletConnectClient = vi.fn(async () => client);
  const signWalletConnectRequest = vi.fn(async () => '0xsignature');
  return {
    client,
    initWalletConnectClient,
    pair,
    approveProposal,
    rejectProposal,
    respondWithResult,
    respondWithError,
    rejectSessionAuthenticate,
    disconnectSession,
    getSessions,
    getPendingProposals,
    getPendingRequests,
    on,
    off,
    signWalletConnectRequest,
  };
});

vi.mock('../wallet/walletconnect-client', () => ({
  initWalletConnectClient: wcMocks.initWalletConnectClient,
  summariseProposal: (proposal: ProposalTypes.Struct) => ({
    id: proposal.id,
    peerName: proposal.proposer.metadata.name,
    peerUrl: proposal.proposer.metadata.url,
    peerDescription: proposal.proposer.metadata.description,
    requiredChains: proposal.requiredNamespaces['eip155']?.chains ?? [],
    requiredMethods: proposal.requiredNamespaces['eip155']?.methods ?? [],
    optionalChains: proposal.optionalNamespaces['eip155']?.chains ?? [],
    optionalMethods: proposal.optionalNamespaces['eip155']?.methods ?? [],
  }),
  summariseSession: (session: SessionTypes.Struct) => ({
    topic: session.topic,
    peerName: session.peer.metadata.name,
    peerUrl: session.peer.metadata.url,
    chains: Object.values(session.namespaces).flatMap(
      (namespace) => namespace.chains ?? [],
    ),
    addresses: ['0x1111111111111111111111111111111111111111'],
    methods: Object.values(session.namespaces).flatMap(
      (namespace) => namespace.methods,
    ),
  }),
  buildFailureError: (reason: string) => ({
    code: 5100,
    message: `build failed: ${reason}`,
  }),
  userRejectedError: () => ({ code: 5000, message: 'User rejected.' }),
  unsupportedMethodError: () => ({
    code: 5101,
    message: 'Unsupported methods.',
  }),
}));

vi.mock('../wallet/walletconnect-signing', () => ({
  signWalletConnectRequest: wcMocks.signWalletConnectRequest,
  createVaultEvmSignerProvider: () => async () => ({}),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type Wallet = ReturnType<typeof useWallet>;

function setWallet(overrides: Partial<Wallet> = {}) {
  const mock = {
    vaultState: 'unlocked',
    vaultAddresses: { eth: [ADDRESS] },
    enabledChains: ['eth', 'bsc'],
    ...overrides,
  };
  vi.mocked(useWallet).mockReturnValue(
    mock as unknown as ReturnType<typeof useWallet>,
  );
  return mock;
}

function makeSession(): SessionTypes.Struct {
  return {
    topic: 'topic-1',
    pairingTopic: 'pairing-1',
    relay: { protocol: 'irn' },
    expiry: 9999999999,
    acknowledged: true,
    controller: 'controller-key',
    namespaces: {
      eip155: {
        chains: ['eip155:1'],
        accounts: [`eip155:1:${ADDRESS}`],
        methods: ['personal_sign'],
        events: ['chainChanged'],
      },
    },
    requiredNamespaces: {
      eip155: {
        chains: ['eip155:1'],
        methods: ['personal_sign'],
        events: ['chainChanged'],
      },
    },
    optionalNamespaces: {},
    self: {
      publicKey: 'self-key',
      metadata: {
        name: 'Bawa Web Wallet',
        description: '',
        url: 'https://github.com/Pr3eve6ti2o/bawa',
        icons: [],
      },
    },
    peer: {
      publicKey: 'peer-key',
      metadata: {
        name: 'Example dApp',
        description: 'An example dApp',
        url: 'https://example.com',
        icons: [],
      },
    },
  };
}

function makeProposal(): ProposalTypes.Struct {
  return {
    id: 42,
    expiryTimestamp: 9999999999,
    relays: [{ protocol: 'irn' }],
    proposer: {
      publicKey: 'proposer-key',
      metadata: {
        name: 'Example dApp',
        description: 'An example dApp',
        url: 'https://example.com',
        icons: [],
      },
    },
    requiredNamespaces: {
      eip155: {
        chains: ['eip155:1'],
        methods: ['personal_sign'],
        events: ['chainChanged'],
      },
    },
    optionalNamespaces: {},
    pairingTopic: 'pairing-1',
  };
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
        <WalletConnectScreen />
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

/** Wait until the mounted screen shows the given text (async connect). */
async function waitForText(
  div: HTMLDivElement,
  text: string,
): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if ((div.textContent ?? '').includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    });
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickButton(div: HTMLDivElement, text: string): Promise<void> {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).not.toBeUndefined();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  wcMocks.getSessions.mockReturnValue([]);
  wcMocks.getPendingProposals.mockReturnValue([]);
  wcMocks.getPendingRequests.mockReturnValue([]);
  wcMocks.signWalletConnectRequest.mockResolvedValue('0xsignature');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectScreen — missing projectId', () => {
  it('says plainly that a projectId is needed and loads no client', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        'A WalletConnect projectId is needed',
      );
      expect(mounted.div.textContent).toContain('WalletConnect Cloud');
      expect(wcMocks.initWalletConnectClient).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('saves the entered projectId and connects', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#walletconnect-project-id',
      ) as HTMLInputElement;
      setInputValue(input, 'test-only-project-id');
      await clickButton(mounted.div, 'Save projectId and connect');
      await waitForText(mounted.div, 'Pair with a dApp');
      expect(localStorage.getItem('bawa-walletconnect-project-id')).toBe(
        'test-only-project-id',
      );
      expect(wcMocks.initWalletConnectClient).toHaveBeenCalledWith(
        'test-only-project-id',
      );
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('WalletConnectScreen — connected', () => {
  it('auto-connects with the saved projectId and lists sessions', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getSessions.mockReturnValue([makeSession()]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Pair with a dApp');
      expect(wcMocks.initWalletConnectClient).toHaveBeenCalledWith(
        'test-only-project-id',
      );
      expect(mounted.div.textContent).toContain('Example dApp');
      expect(mounted.div.textContent).toContain(ADDRESS);
    } finally {
      await mounted.cleanup();
    }
  });

  it('pairs with a wc: URI and rejects a non-wc: value', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Pair with a dApp');
      const input = mounted.div.querySelector(
        '#walletconnect-pair-uri',
      ) as HTMLInputElement;
      setInputValue(input, 'https://example.com');
      await clickButton(mounted.div, 'Pair');
      expect(mounted.div.textContent).toContain('starts with wc:');
      expect(wcMocks.pair).not.toHaveBeenCalled();

      setInputValue(input, 'wc:abc@2?relay-protocol=irn&symKey=xyz');
      await clickButton(mounted.div, 'Pair');
      expect(wcMocks.pair).toHaveBeenCalledWith(
        'wc:abc@2?relay-protocol=irn&symKey=xyz',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('approves a proposal with the namespaces the wallet can serve', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getPendingProposals.mockReturnValue([makeProposal()]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Example dApp');
      await clickButton(mounted.div, 'Approve');
      expect(wcMocks.approveProposal).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          eip155: expect.objectContaining({
            chains: ['eip155:1'],
            accounts: [`eip155:1:${ADDRESS}`],
            methods: ['personal_sign'],
          }),
        }),
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a proposal through the client', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getPendingProposals.mockReturnValue([makeProposal()]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Example dApp');
      await clickButton(mounted.div, 'Reject');
      expect(wcMocks.rejectProposal).toHaveBeenCalledWith(42);
    } finally {
      await mounted.cleanup();
    }
  });

  it('signs an approved request and answers the dApp', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getPendingRequests.mockReturnValue([
      {
        id: 7,
        topic: 'topic-1',
        method: 'personal_sign',
        params: ['0x68656c6c6f', ADDRESS],
        chainId: 'eip155:1',
      },
    ]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'personal_sign');
      await clickButton(mounted.div, 'Approve and sign');
      expect(wcMocks.signWalletConnectRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'personal_sign' }),
      );
      expect(wcMocks.respondWithResult).toHaveBeenCalledWith(
        'topic-1',
        7,
        '0xsignature',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a request with the user-rejected error', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getPendingRequests.mockReturnValue([
      {
        id: 7,
        topic: 'topic-1',
        method: 'personal_sign',
        params: ['0x68656c6c6f', ADDRESS],
        chainId: 'eip155:1',
      },
    ]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'personal_sign');
      // The Reject button inside the request card (not the proposal's).
      const buttons = [...mounted.div.querySelectorAll('button')].filter(
        (button) => button.textContent?.trim() === 'Reject',
      );
      expect(buttons.length).toBe(1);
      await act(async () => {
        buttons[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(wcMocks.respondWithError).toHaveBeenCalledWith('topic-1', 7, {
        code: 5000,
        message: 'User rejected.',
      });
      expect(wcMocks.signWalletConnectRequest).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('answers an unsupported method without signing', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getPendingRequests.mockReturnValue([
      {
        id: 8,
        topic: 'topic-1',
        method: 'eth_sendTransaction',
        params: [],
        chainId: 'eip155:1',
      },
    ]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'eth_sendTransaction');
      await clickButton(mounted.div, 'Approve and sign');
      expect(wcMocks.signWalletConnectRequest).not.toHaveBeenCalled();
      expect(wcMocks.respondWithError).toHaveBeenCalledWith('topic-1', 8, {
        code: 5101,
        message: 'Unsupported methods.',
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it('disconnects a session', async () => {
    localStorage.setItem(
      'bawa-walletconnect-project-id',
      'test-only-project-id',
    );
    wcMocks.getSessions.mockReturnValue([makeSession()]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Example dApp');
      await clickButton(mounted.div, 'Disconnect');
      expect(wcMocks.disconnectSession).toHaveBeenCalledWith('topic-1');
    } finally {
      await mounted.cleanup();
    }
  });
});
