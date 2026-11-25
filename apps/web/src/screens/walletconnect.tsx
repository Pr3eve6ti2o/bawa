/**
 * WalletConnect screen — connect dApps to this wallet.
 *
 * Lane C, "install all usable" programme (2026-11-25). The entry
 * point is the WalletConnect link in the More menu / desktop sidebar
 * (`/walletconnect`, lazy route).
 *
 * Flow: the owner enters a WalletConnect Cloud projectId (or the
 * build set `VITE_WALLETCONNECT_PROJECT_ID`); the screen then loads
 * the SignClient — dynamically, so the ~400 KB SDK chunk is fetched
 * only here, never on app boot — and pairs with a dApp's `wc:` URI.
 * A session proposal shows the dApp's name and address and what it
 * asks for; Approve serves only the chains this wallet holds and
 * the message-signing methods it supports, Reject turns it down.
 * A session request shows the method and what would be signed;
 * Approve signs it with the vault key (the vault must be unlocked),
 * Reject answers the dApp with a rejection. Sending is switched
 * off: no session can ask this wallet to send or sign a transaction.
 *
 * Honest limits, stated on the screen itself: without a projectId
 * nothing can connect; a live dApp connection cannot be proved
 * without the owner's projectId. The dApp's icon is not rendered —
 * the CSP only allows token-icon hosts for images, so an arbitrary
 * dApp icon URL would be refused; name and address are shown as
 * text instead. The projectId itself is never shown on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { CopyButton } from '../ui/components/copy-button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import {
  buildApprovedNamespaces,
  clearWalletConnectProjectId,
  readWalletConnectProjectId,
  saveWalletConnectProjectId,
  walletConnectAccounts,
  WALLETCONNECT_SUPPORTED_METHODS,
} from '../wallet/walletconnect';
import {
  createVaultEvmSignerProvider,
  signWalletConnectRequest,
} from '../wallet/walletconnect-signing';
import type { WalletConnectClient } from '../wallet/walletconnect-client';

type ClientModule = typeof import('../wallet/walletconnect-client');

type PendingRequest = {
  id: number;
  topic: string;
  method: string;
  params: unknown;
  chainId: string;
};

const BUILD_FAILURE_COPY: Record<string, string> = {
  'unsupported-namespace':
    'The dApp asked for a chain family this wallet does not support — only Ethereum chains.',
  'no-common-chain':
    'The dApp asked for chains this wallet does not hold.',
  'no-supported-method':
    'The dApp asked for methods this wallet does not support. This wallet signs messages only; sending is switched off.',
  'unsupported-event':
    'The dApp asked for events this wallet does not send.',
};

function shortParams(params: unknown): string {
  const text =
    typeof params === 'string' ? params : JSON.stringify(params ?? null);
  if (text === undefined) return '';
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

export function WalletConnectScreen() {
  const { vaultState, vaultAddresses, enabledChains } = useWallet();
  const [projectId, setProjectId] = useState<string | undefined>(() =>
    readWalletConnectProjectId(),
  );
  const [projectIdDraft, setProjectIdDraft] = useState('');
  const [clientState, setClientState] = useState<
    'idle' | 'connecting' | 'connected' | 'failed'
  >('idle');
  const [clientError, setClientError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [proposals, setProposals] = useState<ProposalTypes.Struct[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [pairUri, setPairUri] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const clientRef = useRef<WalletConnectClient | null>(null);
  const moduleRef = useRef<ClientModule | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const connectingRef = useRef(false);

  const evmAddress = vaultAddresses.eth?.[0] ?? null;

  const refreshLists = useCallback(() => {
    const client = clientRef.current;
    if (client === null) return;
    setSessions(client.getSessions());
    setProposals(client.getPendingProposals());
    setRequests(client.getPendingRequests());
  }, []);

  // Drop the live client (listeners off, lists cleared). The relay
  // socket itself closes with the tab — SignClient has no stop — so
  // clearing also disconnects the sessions first (see below).
  const teardownClient = useCallback(() => {
    for (const cleanup of cleanupsRef.current) cleanup();
    cleanupsRef.current = [];
    clientRef.current = null;
    moduleRef.current = null;
    connectingRef.current = false;
    setSessions([]);
    setProposals([]);
    setRequests([]);
    setClientState('idle');
  }, []);

  const connect = useCallback(
    async (id: string) => {
      if (clientRef.current !== null || connectingRef.current) return;
      connectingRef.current = true;
      setClientState('connecting');
      setClientError(null);
      try {
        // Dynamic import only: the SignClient chunk is fetched here
        // and nowhere else. It must never enter the main chunk.
        const mod = await import('../wallet/walletconnect-client');
        moduleRef.current = mod;
        const client = await mod.initWalletConnectClient(id);
        // The screen may have unmounted (or the projectId changed)
        // while init was in flight; teardown clears this flag, so a
        // cleared flag means: do not register listeners or render.
        if (!connectingRef.current) return;
        clientRef.current = client;
        const refresh = () => {
          refreshLists();
        };
        // SIWE auth is out of scope for this lane: reject it so the
        // dApp does not hang, instead of silently ignoring it.
        const rejectAuth = (args: unknown) => {
          if (
            typeof args === 'object' &&
            args !== null &&
            'id' in args &&
            typeof (args as { id: unknown }).id === 'number'
          ) {
            void client
              .rejectSessionAuthenticate((args as { id: number }).id)
              .catch(() => undefined);
          }
        };
        const handlers: Array<{
          event: Parameters<WalletConnectClient['on']>[0];
          listener: (args: unknown) => void;
        }> = [
          { event: 'session_proposal', listener: refresh },
          { event: 'session_request', listener: refresh },
          { event: 'session_delete', listener: refresh },
          { event: 'session_expire', listener: refresh },
          { event: 'proposal_expire', listener: refresh },
          // An approved session lands in the store when the dApp
          // acknowledges it — that is when it appears in the list.
          { event: 'session_connect', listener: refresh },
          { event: 'session_authenticate', listener: rejectAuth },
        ];
        for (const { event, listener } of handlers) {
          client.on(event, listener);
          cleanupsRef.current.push(() => client.off(event, listener));
        }
        refreshLists();
        setClientState('connected');
      } catch (error) {
        connectingRef.current = false;
        setClientState('failed');
        setClientError(
          error instanceof Error
            ? error.message
            : 'Could not connect to WalletConnect.',
        );
      }
    },
    [refreshLists],
  );

  // Auto-connect on entry when a projectId is already configured —
  // the owner opted in by saving one. Without a projectId nothing
  // loads: the screen shows the setup state instead.
  useEffect(() => {
    if (projectId !== undefined) {
      void connect(projectId);
    }
    return () => {
      teardownClient();
    };
  }, [projectId, connect, teardownClient]);

  function handleSaveProjectId() {
    setActionError(null);
    try {
      saveWalletConnectProjectId(projectIdDraft);
      const saved = readWalletConnectProjectId();
      setProjectIdDraft('');
      setProjectId(saved);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not save the projectId.',
      );
    }
  }

  async function handleClearProjectId() {
    setBusy('clear');
    setActionError(null);
    try {
      const client = clientRef.current;
      if (client !== null) {
        for (const session of client.getSessions()) {
          await client.disconnectSession(session.topic).catch(() => undefined);
        }
      }
      // The relay socket itself closes with the tab; clearing removes
      // the saved id and disconnects the sessions, so nothing new can
      // connect.
      clearWalletConnectProjectId();
      teardownClient();
      setClientError(null);
      setProjectId(undefined);
    } finally {
      setBusy(null);
    }
  }

  async function handlePair() {
    setPairError(null);
    setActionError(null);
    const uri = pairUri.trim();
    if (!uri.startsWith('wc:')) {
      setPairError('Paste a WalletConnect pairing URI — it starts with wc:.');
      return;
    }
    const client = clientRef.current;
    if (client === null) {
      setPairError('WalletConnect is not connected yet.');
      return;
    }
    setBusy('pair');
    try {
      await client.pair(uri);
      setPairUri('');
    } catch (error) {
      setPairError(
        error instanceof Error ? error.message : 'Pairing failed.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveProposal(proposal: ProposalTypes.Struct) {
    const client = clientRef.current;
    const mod = moduleRef.current;
    if (client === null || mod === null) return;
    if (vaultState !== 'unlocked') {
      setActionError(
        'Unlock the wallet first — approving needs your wallet address.',
      );
      return;
    }
    setBusy(`proposal:${proposal.id}`);
    setActionError(null);
    try {
      const accounts = walletConnectAccounts(vaultAddresses, enabledChains);
      const built = buildApprovedNamespaces({
        requiredNamespaces: proposal.requiredNamespaces,
        optionalNamespaces: proposal.optionalNamespaces,
        accounts,
      });
      if (!built.ok) {
        await client.rejectProposal(
          proposal.id,
          mod.buildFailureError(built.reason),
        );
        setActionError(
          BUILD_FAILURE_COPY[built.reason] ??
            'This proposal cannot be approved.',
        );
        refreshLists();
        return;
      }
      await client.approveProposal(proposal.id, built.namespaces);
      refreshLists();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not approve.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectProposal(proposal: ProposalTypes.Struct) {
    const client = clientRef.current;
    if (client === null) return;
    setBusy(`proposal:${proposal.id}`);
    setActionError(null);
    try {
      await client.rejectProposal(proposal.id);
      refreshLists();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not reject.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveRequest(request: PendingRequest) {
    const client = clientRef.current;
    const mod = moduleRef.current;
    if (client === null || mod === null) return;
    if (evmAddress === null) {
      setActionError(
        'Unlock the wallet first — there is no address to sign with.',
      );
      return;
    }
    setBusy(`request:${request.id}`);
    setActionError(null);
    try {
      if (!WALLETCONNECT_SUPPORTED_METHODS.includes(request.method)) {
        await client.respondWithError(
          request.topic,
          request.id,
          mod.unsupportedMethodError(),
        );
        setActionError(
          `The dApp asked for ${request.method}, which this wallet does not support.`,
        );
        refreshLists();
        return;
      }
      const result = await signWalletConnectRequest({
        method: request.method,
        params: request.params,
        chainId: request.chainId,
        address: evmAddress,
        getSigner: createVaultEvmSignerProvider(),
      });
      await client.respondWithResult(request.topic, request.id, result);
      refreshLists();
    } catch (error) {
      // Answer the dApp so it does not hang, then show the real
      // reason here. A failed signing is a rejection from the dApp's
      // side — no signature leaves this wallet.
      await client
        .respondWithError(
          request.topic,
          request.id,
          mod.userRejectedError(),
        )
        .catch(() => undefined);
      setActionError(
        error instanceof Error ? error.message : 'Signing failed.',
      );
      refreshLists();
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectRequest(request: PendingRequest) {
    const client = clientRef.current;
    const mod = moduleRef.current;
    if (client === null || mod === null) return;
    setBusy(`request:${request.id}`);
    setActionError(null);
    try {
      await client.respondWithError(
        request.topic,
        request.id,
        mod.userRejectedError(),
      );
      refreshLists();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not reject.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(topic: string) {
    const client = clientRef.current;
    if (client === null) return;
    setBusy(`session:${topic}`);
    setActionError(null);
    try {
      await client.disconnectSession(topic);
      refreshLists();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not disconnect.',
      );
    } finally {
      setBusy(null);
    }
  }

  const connected = clientState === 'connected';
  const module = moduleRef.current;

  return (
    <section className="space-y-6" aria-labelledby="walletconnect-heading">
      <h1 id="walletconnect-heading" className="text-2xl font-semibold">
        WalletConnect
      </h1>

      <p className="max-w-[75ch] text-sm text-ink">
        Connect dApps to this wallet. A dApp can ask this wallet to sign
        messages — it cannot move your funds: sending is switched off,
        so no session can ask for a transaction. Only Ethereum chains
        are served.
      </p>

      {vaultState === 'no-vault' && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink">
              No wallet yet. WalletConnect signs with your wallet&apos;s
              key, so create or import a wallet first.
            </p>
            <Link
              to="/create"
              className="inline-block text-sm font-medium text-ink bawa-squiggle-underline"
            >
              Create a wallet
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ProjectId</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectId === undefined ? (
            <>
              <p className="max-w-[75ch] text-sm text-ink">
                A WalletConnect projectId is needed before anything can
                connect. It identifies this wallet to the WalletConnect
                relay. Get one free from WalletConnect Cloud and paste it
                here — it is stored only on this device and never shown
                again.
              </p>
              <p className="text-sm text-ink">
                <a
                  href="https://cloud.walletconnect.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-ink bawa-squiggle-underline"
                >
                  Get a projectId from WalletConnect Cloud
                </a>
              </p>
              <div className="space-y-2">
                <Label htmlFor="walletconnect-project-id">ProjectId</Label>
                <Input
                  id="walletconnect-project-id"
                  type="password"
                  autoComplete="off"
                  value={projectIdDraft}
                  onChange={(event) => setProjectIdDraft(event.target.value)}
                  placeholder="Paste your WalletConnect projectId"
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveProjectId}
                disabled={projectIdDraft.trim().length === 0}
              >
                Save projectId and connect
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-[75ch] text-sm text-ink">
                A projectId is saved on this device. It is never shown
                here. To use a different one, clear it and paste the new
                one.
              </p>
              <div className="space-y-2">
                <Label htmlFor="walletconnect-project-id">
                  Replace projectId
                </Label>
                <Input
                  id="walletconnect-project-id"
                  type="password"
                  autoComplete="off"
                  value={projectIdDraft}
                  onChange={(event) => setProjectIdDraft(event.target.value)}
                  placeholder="Paste a different projectId"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleSaveProjectId}
                  disabled={projectIdDraft.trim().length === 0}
                >
                  Save projectId and connect
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleClearProjectId()}
                  disabled={busy === 'clear'}
                >
                  Clear saved projectId
                </Button>
              </div>
            </>
          )}
          {clientState === 'connecting' && (
            <p className="text-sm text-ink">Connecting to WalletConnect…</p>
          )}
          {clientState === 'failed' && (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-ink">
                Could not connect to WalletConnect: {clientError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  connectingRef.current = false;
                  clientRef.current = null;
                  if (projectId !== undefined) void connect(projectId);
                }}
              >
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {actionError !== null && (
        <p role="alert" className="text-sm text-ink">
          {actionError}
        </p>
      )}

      {connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pair with a dApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="max-w-[75ch] text-sm text-ink">
                In the dApp, choose WalletConnect and copy its pairing
                code, then paste the whole `wc:` URI here.
              </p>
              <div className="space-y-2">
                <Label htmlFor="walletconnect-pair-uri">Pairing URI</Label>
                <Input
                  id="walletconnect-pair-uri"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={pairUri}
                  onChange={(event) => setPairUri(event.target.value)}
                  placeholder="wc:…"
                />
              </div>
              {pairError !== null && (
                <p role="alert" className="text-sm text-ink">
                  {pairError}
                </p>
              )}
              <Button
                type="button"
                onClick={() => void handlePair()}
                disabled={busy === 'pair' || pairUri.trim().length === 0}
              >
                Pair
              </Button>
            </CardContent>
          </Card>

          {evmAddress !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Your dApp address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="max-w-[75ch] text-sm text-ink">
                  dApps see this address on every Ethereum chain. It is
                  the same address your wallet uses for Ethereum.
                </p>
                <p className="break-all font-mono text-sm text-ink">
                  {evmAddress}
                </p>
                <CopyButton value={evmAddress} label="Copy address" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Session requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.length === 0 ? (
                <p className="text-sm text-ink">
                  No requests waiting. When a connected dApp asks this
                  wallet to sign something, it appears here for you to
                  approve or reject.
                </p>
              ) : (
                <ul className="space-y-4">
                  {requests.map((request) => (
                    <li
                      key={request.id}
                      className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-4"
                    >
                      <p className="font-mono text-sm font-bold text-ink">
                        {request.method}
                      </p>
                      <p className="font-mono text-sm text-ink">
                        {request.chainId}
                      </p>
                      <p className="break-all font-mono text-xs text-ink">
                        {shortParams(request.params)}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={() => void handleApproveRequest(request)}
                          disabled={
                            busy === `request:${request.id}` ||
                            vaultState !== 'unlocked'
                          }
                          title={
                            vaultState !== 'unlocked'
                              ? 'Unlock the wallet to sign'
                              : undefined
                          }
                        >
                          Approve and sign
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRejectRequest(request)}
                          disabled={busy === `request:${request.id}`}
                        >
                          Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session proposals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {proposals.length === 0 ? (
                <p className="text-sm text-ink">
                  No proposals waiting. Pair with a dApp and its request
                  to connect appears here.
                </p>
              ) : (
                <ul className="space-y-4">
                  {proposals.map((proposal) => {
                    const summary =
                      module?.summariseProposal(proposal) ?? null;
                    return (
                      <li
                        key={proposal.id}
                        className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-4"
                      >
                        <p className="text-sm font-bold text-ink">
                          {summary?.peerName ?? 'Unknown dApp'}
                        </p>
                        {summary?.peerUrl && (
                          <p className="break-all text-sm text-ink">
                            {summary.peerUrl}
                          </p>
                        )}
                        <p className="text-sm text-ink">
                          Chains:{' '}
                          {summary === null ||
                          summary.requiredChains.length === 0
                            ? 'none requested'
                            : summary.requiredChains.join(', ')}
                        </p>
                        <p className="text-sm text-ink">
                          Methods:{' '}
                          {summary === null ||
                          summary.requiredMethods.length === 0
                            ? 'none requested'
                            : summary.requiredMethods.join(', ')}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            onClick={() => void handleApproveProposal(proposal)}
                            disabled={
                              busy === `proposal:${proposal.id}` ||
                              vaultState !== 'unlocked'
                            }
                            title={
                              vaultState !== 'unlocked'
                                ? 'Unlock the wallet to approve'
                                : undefined
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRejectProposal(proposal)}
                            disabled={busy === `proposal:${proposal.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connected dApps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.length === 0 ? (
                <p className="text-sm text-ink">
                  No dApps connected yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {sessions.map((session) => {
                    const summary =
                      module?.summariseSession(session) ?? null;
                    return (
                      <li
                        key={session.topic}
                        className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-4"
                      >
                        <p className="text-sm font-bold text-ink">
                          {summary?.peerName ?? 'Unknown dApp'}
                        </p>
                        {summary?.peerUrl && (
                          <p className="break-all text-sm text-ink">
                            {summary.peerUrl}
                          </p>
                        )}
                        <p className="text-sm text-ink">
                          Chains:{' '}
                          {summary === null || summary.chains.length === 0
                            ? 'none'
                            : summary.chains.join(', ')}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleDisconnect(session.topic)}
                          disabled={busy === `session:${session.topic}`}
                        >
                          Disconnect
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
