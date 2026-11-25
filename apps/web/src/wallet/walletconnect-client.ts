/**
 * WalletConnect client — the lazy boundary.
 *
 * Lane C, "install all usable" programme (2026-11-25). This is the
 * ONLY module that imports `@walletconnect/sign-client` (pinned to
 * exactly 2.21.0, the last Apache-2.0 release — see walletconnect.ts).
 * The screen loads this module with a dynamic import, so Vite puts
 * the whole SDK — sign-client, core, utils and their support packages
 * — in its own chunk, fetched only when the user opens WalletConnect
 * with a projectId configured. Nothing here may be statically
 * imported by the app shell or any eager route.
 *
 * The small CAIP helpers come from `@walletconnect/utils` here, where
 * they cost nothing extra: sign-client already depends on that
 * package, so it is in this chunk either way
 * (`getChainsFromNamespaces`, `getAddressFromAccount`,
 * `parseAccountId`, `getSdkError`).
 *
 * No session is ever approved with a transaction method, and no
 * signing happens here — signing lives in walletconnect-signing.ts
 * and is driven by the screen, so a request is only ever signed
 * after the user taps Approve on its card.
 */

import { SignClient } from '@walletconnect/sign-client';
import {
  getAddressFromAccount,
  getChainsFromNamespaces,
  getSdkError,
  parseAccountId,
} from '@walletconnect/utils';
import type { JsonRpcResponse } from '@walletconnect/jsonrpc-types';
import type {
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import {
  WALLETCONNECT_METADATA,
  WALLETCONNECT_RELAY_URL,
  type BuildNamespacesFailureReason,
} from './walletconnect';

/**
 * The SignClient surface this wrapper uses, as a structural type so
 * tests can pass a fake without importing the real SDK. Picked from
 * the concrete class: the abstract ISignClient does not declare
 * `off` (it lives on the events side), the class does.
 */
export type SignClientLike = Pick<
  InstanceType<typeof SignClient>,
  | 'pair'
  | 'approve'
  | 'reject'
  | 'respond'
  | 'disconnect'
  | 'rejectSessionAuthenticate'
  | 'session'
  | 'proposal'
  | 'getPendingSessionRequests'
  | 'on'
  | 'off'
>;

/** A pending session request, in the shape the screen renders. */
export type WalletConnectPendingRequest = {
  id: number;
  topic: string;
  method: string;
  params: unknown;
  chainId: string;
};

/** What the screen shows for one live session. */
export type WalletConnectSessionSummary = {
  topic: string;
  peerName: string;
  peerUrl: string;
  chains: string[];
  addresses: string[];
  methods: string[];
};

/** What the screen shows for one session proposal. */
export type WalletConnectProposalSummary = {
  id: number;
  peerName: string;
  peerUrl: string;
  peerDescription: string;
  requiredChains: string[];
  requiredMethods: string[];
  optionalChains: string[];
  optionalMethods: string[];
};

function peerText(
  metadata: SignClientTypes.Metadata,
): { name: string; url: string; description: string } {
  return {
    name: metadata.name || 'Unknown dApp',
    url: metadata.url || '',
    description: metadata.description || '',
  };
}

/** Summarise a live session for the sessions list. */
export function summariseSession(
  session: SessionTypes.Struct,
): WalletConnectSessionSummary {
  const peer = peerText(session.peer.metadata);
  const accounts = Object.values(session.namespaces).flatMap(
    (namespace) => namespace.accounts,
  );
  const methods = [
    ...new Set(
      Object.values(session.namespaces).flatMap(
        (namespace) => namespace.methods,
      ),
    ),
  ];
  return {
    topic: session.topic,
    peerName: peer.name,
    peerUrl: peer.url,
    chains: getChainsFromNamespaces(session.namespaces),
    addresses: [
      ...new Set(accounts.map((account) => getAddressFromAccount(account))),
    ],
    methods,
  };
}

/** Summarise a session proposal for the approval card. */
export function summariseProposal(
  proposal: ProposalTypes.Struct,
): WalletConnectProposalSummary {
  const peer = peerText(proposal.proposer.metadata);
  const required = proposal.requiredNamespaces['eip155'];
  const optional = proposal.optionalNamespaces['eip155'];
  return {
    id: proposal.id,
    peerName: peer.name,
    peerUrl: peer.url,
    peerDescription: peer.description,
    requiredChains: required?.chains ?? [],
    requiredMethods: required?.methods ?? [],
    optionalChains: optional?.chains ?? [],
    optionalMethods: optional?.methods ?? [],
  };
}

/**
 * The address a CAIP-10 account id belongs to. Used by the screen to
 * check a session request is really for this wallet's address.
 */
export function addressFromAccountId(account: string): string {
  return parseAccountId(account).address;
}

/** The SDK error object for a user rejection (code 5000). */
export function userRejectedError(): { code: number; message: string } {
  return getSdkError('USER_REJECTED');
}

/** The SDK error object for an unsupported method (code 5101). */
export function unsupportedMethodError(): { code: number; message: string } {
  return getSdkError('UNSUPPORTED_METHODS');
}

/**
 * The SDK error object for a proposal this wallet cannot approve,
 * mapped from the namespace-build failure reason.
 */
export function buildFailureError(reason: BuildNamespacesFailureReason): {
  code: number;
  message: string;
} {
  switch (reason) {
    case 'unsupported-namespace':
      return getSdkError('UNSUPPORTED_NAMESPACE_KEY');
    case 'no-common-chain':
      return getSdkError('UNSUPPORTED_CHAINS');
    case 'no-supported-method':
      return getSdkError('UNSUPPORTED_METHODS');
    case 'unsupported-event':
      return getSdkError('UNSUPPORTED_EVENTS');
  }
}

/** The SDK error object for rejecting a SIWE auth request (code 10001). */
export function unsupportedAuthError(): { code: number; message: string } {
  return getSdkError('WC_METHOD_UNSUPPORTED');
}

/** Thin wrapper over a SignClient: the screen never touches the SDK directly. */
export interface WalletConnectClient {
  pair(uri: string): Promise<void>;
  /**
   * Approve a proposal. Resolves once the session is stored; the
   * dApp's acknowledgement arrives later, via `session_connect`.
   */
  approveProposal(
    id: number,
    namespaces: SessionTypes.Namespaces,
  ): Promise<void>;
  rejectProposal(
    id: number,
    reason?: { code: number; message: string },
  ): Promise<void>;
  respondWithResult(
    topic: string,
    id: number,
    result: unknown,
  ): Promise<void>;
  respondWithError(
    topic: string,
    id: number,
    error: { code: number; message: string },
  ): Promise<void>;
  rejectSessionAuthenticate(id: number): Promise<void>;
  disconnectSession(topic: string): Promise<void>;
  getSessions(): SessionTypes.Struct[];
  getPendingProposals(): ProposalTypes.Struct[];
  getPendingRequests(): WalletConnectPendingRequest[];
  on<E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => void,
  ): void;
  off<E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => void,
  ): void;
}

function jsonRpcResult(id: number, result: unknown): JsonRpcResponse {
  return { id, jsonrpc: '2.0', result };
}

function jsonRpcError(
  id: number,
  error: { code: number; message: string },
): JsonRpcResponse {
  return { id, jsonrpc: '2.0', error };
}

export function createWalletConnectClient(
  client: SignClientLike,
): WalletConnectClient {
  return {
    async pair(uri: string): Promise<void> {
      await client.pair({ uri });
    },

    async approveProposal(
      id: number,
      namespaces: SessionTypes.Namespaces,
    ): Promise<void> {
      await client.approve({ id, namespaces });
    },

    async rejectProposal(
      id: number,
      reason?: { code: number; message: string },
    ): Promise<void> {
      await client.reject({ id, reason: reason ?? userRejectedError() });
    },

    async respondWithResult(
      topic: string,
      id: number,
      result: unknown,
    ): Promise<void> {
      await client.respond({ topic, response: jsonRpcResult(id, result) });
    },

    async respondWithError(
      topic: string,
      id: number,
      error: { code: number; message: string },
    ): Promise<void> {
      await client.respond({ topic, response: jsonRpcError(id, error) });
    },

    async rejectSessionAuthenticate(id: number): Promise<void> {
      await client.rejectSessionAuthenticate({
        id,
        reason: unsupportedAuthError(),
      });
    },

    async disconnectSession(topic: string): Promise<void> {
      await client.disconnect({
        topic,
        reason: userRejectedError(),
      });
    },

    getSessions(): SessionTypes.Struct[] {
      return client.session.getAll();
    },

    getPendingProposals(): ProposalTypes.Struct[] {
      return client.proposal.getAll();
    },

    getPendingRequests(): WalletConnectPendingRequest[] {
      return client.getPendingSessionRequests().map((pending) => ({
        id: pending.id,
        topic: pending.topic,
        method: pending.params.request.method,
        params: pending.params.request.params,
        chainId: pending.params.chainId,
      }));
    },

    on(event, listener): void {
      client.on(event, listener);
    },

    off(event, listener): void {
      client.off(event, listener);
    },
  };
}

/**
 * Initialise a SignClient for this wallet. The projectId is required
 * by the relay; without one the caller must not call this at all.
 * The relay URL is the Sign v2 default, stated explicitly so the
 * connection target is visible in code, not hidden in the SDK.
 */
export async function initWalletConnectClient(
  projectId: string,
): Promise<WalletConnectClient> {
  const client = await SignClient.init({
    projectId,
    relayUrl: WALLETCONNECT_RELAY_URL,
    metadata: WALLETCONNECT_METADATA,
  });
  return createWalletConnectClient(client);
}
