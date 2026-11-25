import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import {
  addressFromAccountId,
  buildFailureError,
  createWalletConnectClient,
  initWalletConnectClient,
  summariseProposal,
  summariseSession,
  unsupportedAuthError,
  unsupportedMethodError,
  userRejectedError,
  type SignClientLike,
} from './walletconnect-client';

vi.mock('@walletconnect/sign-client', () => ({
  SignClient: { init: vi.fn() },
}));

import { SignClient } from '@walletconnect/sign-client';

const ADDRESS = '0x1111111111111111111111111111111111111111';

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
    optionalNamespaces: {
      eip155: {
        chains: ['eip155:56'],
        methods: ['eth_chainId'],
        events: [],
      },
    },
    pairingTopic: 'pairing-1',
  };
}

function makeFakeClient(): SignClientLike {
  return {
    pair: vi.fn(async () => {}),
    approve: vi.fn(async () => makeSession()),
    reject: vi.fn(async () => {}),
    respond: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    rejectSessionAuthenticate: vi.fn(async () => {}),
    session: { getAll: vi.fn(() => [makeSession()]) },
    proposal: { getAll: vi.fn(() => [makeProposal()]) },
    getPendingSessionRequests: vi.fn(() => [
      {
        id: 7,
        topic: 'topic-1',
        params: {
          request: { method: 'personal_sign', params: ['0x1234', ADDRESS] },
          chainId: 'eip155:1',
        },
      },
    ]),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as SignClientLike;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnect SDK error objects (upstream @walletconnect/utils)', () => {
  it('maps the user rejection to code 5000', () => {
    expect(userRejectedError()).toEqual({
      code: 5000,
      message: 'User rejected.',
    });
  });

  it('maps an unsupported method to code 5101', () => {
    expect(unsupportedMethodError()).toEqual({
      code: 5101,
      message: 'Unsupported methods.',
    });
  });

  it('maps an unsupported auth request to code 10001', () => {
    expect(unsupportedAuthError()).toEqual({
      code: 10001,
      message: 'Unsupported wc_ method.',
    });
  });

  it('maps namespace-build failures to the matching SDK errors', () => {
    expect(buildFailureError('unsupported-namespace').code).toBe(5104);
    expect(buildFailureError('no-common-chain').code).toBe(5100);
    expect(buildFailureError('no-supported-method').code).toBe(5101);
    expect(buildFailureError('unsupported-event').code).toBe(5102);
  });
});

describe('summariseSession / summariseProposal (upstream CAIP helpers)', () => {
  it('summarises a session with its chains and addresses', () => {
    expect(summariseSession(makeSession())).toEqual({
      topic: 'topic-1',
      peerName: 'Example dApp',
      peerUrl: 'https://example.com',
      chains: ['eip155:1'],
      addresses: [ADDRESS],
      methods: ['personal_sign'],
    });
  });

  it('summarises a proposal with its requested chains and methods', () => {
    expect(summariseProposal(makeProposal())).toEqual({
      id: 42,
      peerName: 'Example dApp',
      peerUrl: 'https://example.com',
      peerDescription: 'An example dApp',
      requiredChains: ['eip155:1'],
      requiredMethods: ['personal_sign'],
      optionalChains: ['eip155:56'],
      optionalMethods: ['eth_chainId'],
    });
  });

  it('extracts the address from a CAIP account id', () => {
    expect(addressFromAccountId(`eip155:1:${ADDRESS}`)).toBe(ADDRESS);
  });
});

describe('createWalletConnectClient', () => {
  it('pairs, approves and rejects through the SDK client', async () => {
    const fake = makeFakeClient();
    const client = createWalletConnectClient(fake);

    await client.pair('wc:topic@2?relay-protocol=irn&symKey=abc');
    expect(fake.pair).toHaveBeenCalledWith({
      uri: 'wc:topic@2?relay-protocol=irn&symKey=abc',
    });

    const session = await client.approveProposal(42, {
      eip155: {
        chains: ['eip155:1'],
        accounts: [`eip155:1:${ADDRESS}`],
        methods: ['personal_sign'],
        events: ['chainChanged'],
      },
    });
    expect(session).toBeUndefined();
    expect(fake.approve).toHaveBeenCalledWith({
      id: 42,
      namespaces: {
        eip155: {
          chains: ['eip155:1'],
          accounts: [`eip155:1:${ADDRESS}`],
          methods: ['personal_sign'],
          events: ['chainChanged'],
        },
      },
    });

    await client.rejectProposal(42);
    expect(fake.reject).toHaveBeenCalledWith({
      id: 42,
      reason: { code: 5000, message: 'User rejected.' },
    });

    await client.rejectProposal(43, {
      code: 5100,
      message: 'Unsupported chains.',
    });
    expect(fake.reject).toHaveBeenCalledWith({
      id: 43,
      reason: { code: 5100, message: 'Unsupported chains.' },
    });
  });

  it('answers requests with JSON-RPC result and error shapes', async () => {
    const fake = makeFakeClient();
    const client = createWalletConnectClient(fake);

    await client.respondWithResult('topic-1', 7, '0xsignature');
    expect(fake.respond).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: { id: 7, jsonrpc: '2.0', result: '0xsignature' },
    });

    await client.respondWithError('topic-1', 8, {
      code: 5101,
      message: 'Unsupported methods.',
    });
    expect(fake.respond).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 8,
        jsonrpc: '2.0',
        error: { code: 5101, message: 'Unsupported methods.' },
      },
    });
  });

  it('disconnects sessions and rejects auth requests', async () => {
    const fake = makeFakeClient();
    const client = createWalletConnectClient(fake);

    await client.disconnectSession('topic-1');
    expect(fake.disconnect).toHaveBeenCalledWith({
      topic: 'topic-1',
      reason: { code: 5000, message: 'User rejected.' },
    });

    await client.rejectSessionAuthenticate(9);
    expect(fake.rejectSessionAuthenticate).toHaveBeenCalledWith({
      id: 9,
      reason: { code: 10001, message: 'Unsupported wc_ method.' },
    });
  });

  it('reads sessions, proposals and pending requests from the stores', () => {
    const fake = makeFakeClient();
    const client = createWalletConnectClient(fake);

    expect(client.getSessions()).toHaveLength(1);
    expect(client.getPendingProposals()).toHaveLength(1);
    expect(client.getPendingRequests()).toEqual([
      {
        id: 7,
        topic: 'topic-1',
        method: 'personal_sign',
        params: ['0x1234', ADDRESS],
        chainId: 'eip155:1',
      },
    ]);
  });
});

describe('initWalletConnectClient', () => {
  it('initialises the SDK with the projectId, relay and wallet metadata', async () => {
    const fake = makeFakeClient();
    vi.mocked(SignClient.init).mockResolvedValue(
      fake as unknown as Awaited<ReturnType<typeof SignClient.init>>,
    );

    const client = await initWalletConnectClient('test-only-project-id');
    expect(SignClient.init).toHaveBeenCalledWith({
      projectId: 'test-only-project-id',
      relayUrl: 'wss://relay.walletconnect.org',
      metadata: {
        name: 'Bawa Web Wallet',
        description:
          'Bawa is a self-custodial multi-chain HD wallet. dApps can ask it to sign messages; sending stays switched off.',
        url: 'https://github.com/Pr3eve6ti2o/bawa',
        icons: [],
      },
    });
    expect(client.getSessions()).toHaveLength(1);
  });
});
