import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { useWallet } from '../state/wallet-context';
import {
  CHAINS,
  SUPPORTED_CHAINS,
  addCustomRpcEndpoint,
  promoteBackupEndpoint,
  promoteBackupEndpointsAll,
  removeRpcEndpoint,
  resetAllRpcEndpoints,
  resolveRpcEndpoints,
  rpcEndpointHost,
  RPC_MANAGED_CHAINS,
} from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import { DevnetSetting } from './devnet-setting';

// The /networks screen reads the 13-chain registry directly and lets
// the owner enable or disable each chain (token-discovery programme).
// A disabled chain's rows are hidden from /assets and the dashboard;
// its derived addresses stay in the vault, so re-enabling restores
// them without any re-derivation. Nothing is deleted here.
export function NetworkSelectionScreen() {
  const { enabledChains, setChainEnabled, customTokens, devnetEnabled } = useWallet();
  const enabled = new Set(enabledChains ?? SUPPORTED_CHAINS);
  const customByChain = new Map<ChainId, number>();
  for (const token of customTokens ?? []) {
    customByChain.set(token.chain, (customByChain.get(token.chain) ?? 0) + 1);
  }

  return (
    <section className="space-y-6" aria-labelledby="networks-heading">
      <header className="space-y-2">
        <h1 id="networks-heading" className="text-2xl font-semibold">
          Networks
        </h1>
        <p className="text-sm text-muted-foreground">
          {devnetEnabled
            ? "Devnet test mode is on. This wallet connects to test networks with valueless test tokens."
            : "Mainnet only. This wallet never connects to a test network. Enable or disable chains — disabled chains are hidden from your assets."}
        </p>
      </header>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Mainnet</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {SUPPORTED_CHAINS.map((chain) => {
              const config = CHAINS[chain];
              const isEnabled = enabled.has(chain);
              const customCount = customByChain.get(chain) ?? 0;
              return (
                <li
                  key={chain}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-border bg-card p-3"
                >
                  <span>
                    <span className="font-semibold">{config.displayName}</span>
                    {' '}
                    <span className="text-sm text-muted-foreground">{config.symbol}</span>
                    {customCount > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {`${customCount} custom token${customCount === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {isEnabled ? (
                      <>
                        <span className="flex h-6 items-center rounded-[12px] bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
                          ACTIVE
                        </span>
                        <button
                          type="button"
                          className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                          onClick={() => setChainEnabled(chain, false)}
                        >
                          Disable
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex h-6 items-center rounded-[12px] border px-3 text-[10px] font-bold text-muted-foreground">
                          DISABLED
                        </span>
                        <button
                          type="button"
                          className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                          onClick={() => setChainEnabled(chain, true)}
                        >
                          Enable
                        </button>
                      </>
                    )}
                    <Link
                      to={`/assets/${chain}`}
                      className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                    >
                      View
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <DevnetSetting />

      <RpcEndpointManager />

      <p className="text-sm text-muted-foreground">
        Your balances and history come from public blockchain networks.
      </p>
    </section>
  );
}

/**
 * RPC endpoints (UI/UX fixes, item 19): automatic failover plus a
 * manual manager. Every balance read tries the chain's endpoints in
 * order, so a dead primary falls back on its own. The owner can also
 * add a custom RPC (https only, never keyed), promote a backup to
 * primary for one chain or for all chains, remove a custom RPC, or
 * reset everything to the registry defaults. Changes are stored in
 * localStorage and apply on the next balance refresh — adapters
 * resolve their list lazily. Dogecoin keeps its built-in SoChain /
 * BlockCypher pair (different API shapes): it takes no custom RPC.
 */
function RpcEndpointManager() {
  const [version, setVersion] = useState(0);
  const [selectedChain, setSelectedChain] = useState<ChainId>('eth');
  const [customUrl, setCustomUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  // Re-reads localStorage on every render after a mutation bumps this.
  void version;
  const refresh = () => setVersion((value) => value + 1);

  const addCustom = () => {
    const result = addCustomRpcEndpoint(selectedChain, customUrl.trim());
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setCustomUrl('');
    setMessage(
      `Added ${rpcEndpointHost(customUrl.trim())} for ${CHAINS[selectedChain].displayName}.`,
    );
    refresh();
  };

  const switchAll = () => {
    const changed = promoteBackupEndpointsAll();
    setMessage(
      changed.length === 0
        ? 'No chain has a backup endpoint to switch to.'
        : `Switched ${changed.length} chain${changed.length === 1 ? '' : 's'} to their backup endpoints.`,
    );
    refresh();
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>RPC endpoints</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When an RPC is down the wallet tries the next one automatically.
          Add your own RPC, or switch a chain to its backup.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Chain
            <select
              value={selectedChain}
              onChange={(event) =>
                setSelectedChain(event.target.value as ChainId)
              }
              className="rounded-[12px] border bg-card px-3 py-2 text-sm"
            >
              {RPC_MANAGED_CHAINS.map((chain) => (
                <option key={chain} value={chain}>
                  {CHAINS[chain].displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
            Custom RPC URL
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://your-rpc.example"
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
              className="min-w-0 rounded-[12px] border bg-card px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            className="rounded-[22px] border px-3 py-2 text-sm font-medium"
            onClick={addCustom}
          >
            Add RPC
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-[22px] border px-3 py-2 text-sm font-medium"
            onClick={switchAll}
          >
            Switch all to backup
          </button>
          <button
            type="button"
            className="rounded-[22px] border px-3 py-2 text-sm font-medium"
            onClick={() => {
              resetAllRpcEndpoints();
              setMessage('All RPC endpoints reset to the defaults.');
              refresh();
            }}
          >
            Reset all to defaults
          </button>
        </div>

        {message !== null && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}

        <ul className="space-y-3">
          {SUPPORTED_CHAINS.map((chain) => {
            const config = CHAINS[chain];
            const endpoints = resolveRpcEndpoints(chain);
            const managed = (RPC_MANAGED_CHAINS as readonly ChainId[]).includes(
              chain,
            );
            return (
              <li
                key={chain}
                className="space-y-2 rounded-[15px] border border-border bg-card p-3"
              >
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold">{config.displayName}</span>{' '}
                    <span className="text-sm text-muted-foreground">
                      {config.symbol}
                    </span>
                  </span>
                  {managed && endpoints.length >= 2 && (
                    <button
                      type="button"
                      className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                      onClick={() => {
                        promoteBackupEndpoint(chain);
                        setMessage(
                          `Switched ${config.displayName} to its backup endpoint.`,
                        );
                        refresh();
                      }}
                    >
                      Use backup
                    </button>
                  )}
                </span>
                <span className="flex flex-wrap gap-2">
                  {endpoints.map((url, index) => {
                    const isCustom = !config.rpcEndpoints.includes(url);
                    const badge = isCustom
                      ? 'Custom'
                      : index === 0
                        ? 'Primary'
                        : 'Backup';
                    return (
                      <span
                        key={url}
                        className="flex items-center gap-2 rounded-[12px] border px-2 py-1 text-sm"
                      >
                        <span>{rpcEndpointHost(url)}</span><span className="text-xs font-bold text-muted-foreground">{badge}</span>
                        {isCustom && (
                          <button
                            type="button"
                            className="text-xs font-medium underline"
                            onClick={() => {
                              removeRpcEndpoint(chain, url);
                              setMessage(
                                `Removed ${rpcEndpointHost(url)} from ${config.displayName}.`,
                              );
                              refresh();
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {!managed && (
                    <span className="text-sm text-muted-foreground">
                      Built-in failover
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
