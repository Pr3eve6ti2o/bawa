import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { useWallet } from '../state/wallet-context';
import {
  CHAINS,
  SUPPORTED_CHAINS,
  addCustomRpcEndpoint,
  availableFor,
  isCustomRpcOriginUsable,
  makePrimaryEndpoint,
  promoteBackupEndpoint,
  promoteBackupEndpointsAll,
  removeRpcEndpoint,
  resetAllRpcEndpoints,
  resolveRpcEndpoints,
  rpcEndpointHost,
  RPC_MANAGED_CHAINS,
  SUGGESTED_CUSTOM_RPCS,
  validateRpcEndpoint,
} from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import { probeRpcEndpoint, type RpcProbeResult } from '../wallet/rpc-probe';
import { loadCachedPrices, type PriceSource } from '../wallet/prices';
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
            : "Mainnet by default. Enable or disable chains. Disabled chains are hidden from your assets. A temporary devnet test mode is available below."}
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

      <PriceSourcesCard />

      <p className="text-sm text-muted-foreground">
        Your balances and history come from public blockchain networks.
      </p>
    </section>
  );
}

/**
 * Which host serves a chain's history, in plain words (Lane F,
 * FIX-ALL, 2026-11-24). Only chains whose history is verified count:
 * a pinned history URL with an unverified capability (Linea) is not
 * shown as a working source — the wallet never reads history from
 * it. Chains without a pinned indexer (Bitcoin, TRON, TON, Solana,
 * Litecoin, Dogecoin) read history from their own API host, which is
 * their first RPC endpoint. Null means no working history source:
 * history is unavailable for that chain, never faked.
 */
function historySourceFor(chain: ChainId): string | null {
  if (!availableFor('history').includes(chain)) return null;
  const config = CHAINS[chain];
  if (config.historyBaseUrl !== undefined) {
    return rpcEndpointHost(config.historyBaseUrl);
  }
  const first = resolveRpcEndpoints(chain)[0];
  return first === undefined ? null : rpcEndpointHost(first);
}

/**
 * RPC endpoints (UI/UX fixes, item 19; extended Lane F, FIX-ALL,
 * 2026-11-24): automatic failover plus a manual manager. Every
 * balance read tries the chain's endpoints in order, so a dead
 * primary falls back on its own. The owner can also add a custom RPC
 * (https only, never keyed), promote a backup to primary for one
 * chain or for all chains, make any listed endpoint the one tried
 * first ("Use this one"), remove a custom RPC, or reset everything
 * to the registry defaults. Changes are stored in localStorage and
 * the screen refreshes balances straight away, so the switch is
 * visible at once — the row shows which host answered the last
 * balance ("Last balance from …"), and "Check" probes each endpoint
 * live from this browser. Dogecoin keeps its built-in SoChain /
 * BlockCypher pair (different API shapes): it takes no custom RPC.
 *
 * One honest limit, stated on the screen: the browser only allows
 * connections to the addresses in the wallet's built-in allowed
 * list, so a custom RPC outside that list cannot be used — the
 * screen says so instead of storing a dead entry. The well-known
 * public RPCs that are allowed are offered as one-tap buttons.
 */
function RpcEndpointManager() {
  const { refreshBalances, balances, history } = useWallet();
  const [version, setVersion] = useState(0);
  const [selectedChain, setSelectedChain] = useState<ChainId>('eth');
  const [customUrl, setCustomUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [probes, setProbes] = useState<
    Partial<Record<ChainId, Partial<Record<string, RpcProbeResult>>>>
  >({});
  const [checking, setChecking] = useState<readonly ChainId[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Re-reads localStorage on every render after a mutation bumps this.
  void version;
  const refresh = () => setVersion((value) => value + 1);

  /** Applies a change, then refreshes balances so the effect is visible at once. */
  const applyAndRefresh = async (note: string) => {
    refresh();
    setRefreshing(true);
    setMessage(`${note} Refreshing balance…`);
    try {
      await refreshBalances();
      setMessage(`${note} Balance refreshed.`);
    } finally {
      setRefreshing(false);
    }
  };

  const addCustom = () => {
    const url = customUrl.trim();
    // Shape first (https, no credentials, no query): a malformed URL
    // gets the shape error, not the allowlist one.
    const invalid = validateRpcEndpoint(url);
    if (invalid !== null) {
      setMessage(invalid);
      return;
    }
    if (!isCustomRpcOriginUsable(url)) {
      setMessage(
        'That address is not on the wallet’s allowed connection list, so the browser would block it. Use one of the well-known public RPCs below.',
      );
      return;
    }
    const result = addCustomRpcEndpoint(selectedChain, url);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setCustomUrl('');
    void applyAndRefresh(
      `Added ${rpcEndpointHost(url)} for ${CHAINS[selectedChain].displayName}. It is last in line — use “Use this one” to make it the one tried first.`,
    );
  };

  const addSuggestion = (url: string) => {
    if (!isCustomRpcOriginUsable(url)) {
      setMessage(
        'That address is not on the wallet’s allowed connection list, so the browser would block it.',
      );
      return;
    }
    const result = addCustomRpcEndpoint(selectedChain, url);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    void applyAndRefresh(
      `Added ${rpcEndpointHost(url)} for ${CHAINS[selectedChain].displayName}. It is last in line — use “Use this one” to make it the one tried first.`,
    );
  };

  const switchAll = () => {
    const changed = promoteBackupEndpointsAll();
    void applyAndRefresh(
      changed.length === 0
        ? 'No chain has a backup endpoint to switch to.'
        : `Switched ${changed.length} chain${changed.length === 1 ? '' : 's'} to their backup endpoints.`,
    );
  };

  const checkChain = async (chain: ChainId) => {
    const endpoints = resolveRpcEndpoints(chain);
    setChecking((previous) => [...previous, chain]);
    try {
      const results = await Promise.all(
        endpoints.map((url) => probeRpcEndpoint(chain, url)),
      );
      const next: Partial<Record<string, RpcProbeResult>> = {};
      endpoints.forEach((url, index) => {
        next[url] = results[index] as RpcProbeResult;
      });
      setProbes((previous) => ({ ...previous, [chain]: next }));
    } finally {
      setChecking((previous) => previous.filter((entry) => entry !== chain));
    }
  };

  const checkAll = async () => {
    setChecking(SUPPORTED_CHAINS);
    try {
      for (const chain of SUPPORTED_CHAINS) {
        // Sequential per chain, parallel per endpoint: one burst of
        // ~40 live fetches would swamp the small hosts.
        const endpoints = resolveRpcEndpoints(chain);
        const results = await Promise.all(
          endpoints.map((url) => probeRpcEndpoint(chain, url)),
        );
        const next: Partial<Record<string, RpcProbeResult>> = {};
        endpoints.forEach((url, index) => {
          next[url] = results[index] as RpcProbeResult;
        });
        setProbes((previous) => ({ ...previous, [chain]: next }));
      }
    } finally {
      setChecking([]);
    }
  };

  const suggestions = SUGGESTED_CUSTOM_RPCS.filter(
    (suggestion) => suggestion.chain === selectedChain,
  );

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>RPC endpoints</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When an RPC is down the wallet tries the next one automatically.
          Add your own RPC, or switch a chain to its backup. Every change
          refreshes balances straight away, so you can see it work.
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

        {suggestions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Well-known public RPCs for {CHAINS[selectedChain].displayName}{' '}
            that the browser allows:{' '}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.url}
                type="button"
                className="mr-2 rounded-[22px] border px-3 py-2 text-sm font-medium"
                onClick={() => addSuggestion(suggestion.url)}
              >
                Add {suggestion.label}
              </button>
            ))}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Only addresses on the wallet’s allowed connection list can be
          used — the browser blocks any other address, so it cannot be
          added here.
        </p>

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
              void applyAndRefresh('All RPC endpoints reset to the defaults.');
            }}
          >
            Reset all to defaults
          </button>
          <button
            type="button"
            className="rounded-[22px] border px-3 py-2 text-sm font-medium"
            disabled={checking.length > 0}
            onClick={() => void checkAll()}
          >
            {checking.length > 0 ? 'Checking…' : 'Check all connections'}
          </button>
        </div>

        {message !== null && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
        {refreshing && (
          <p className="text-sm text-muted-foreground" role="status">
            Refreshing balances…
          </p>
        )}

        <ul className="space-y-3">
          {SUPPORTED_CHAINS.map((chain) => {
            const config = CHAINS[chain];
            const endpoints = resolveRpcEndpoints(chain);
            const managed = (RPC_MANAGED_CHAINS as readonly ChainId[]).includes(
              chain,
            );
            const chainProbes = probes[chain] ?? {};
            const isChecking = checking.includes(chain);
            const balance = balances[chain];
            const historyState = history[chain];
            const historySource = historySourceFor(chain);
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
                  <span className="flex flex-wrap gap-2">
                    {managed && endpoints.length >= 2 && (
                      <button
                        type="button"
                        className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                        onClick={() => {
                          promoteBackupEndpoint(chain);
                          void applyAndRefresh(
                            `Switched ${config.displayName} to its backup endpoint.`,
                          );
                        }}
                      >
                        Use backup
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-[22px] border px-3 py-2 text-sm font-medium"
                      disabled={isChecking}
                      onClick={() => void checkChain(chain)}
                    >
                      {isChecking ? 'Checking…' : 'Check'}
                    </button>
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  {endpoints.map((url, index) => {
                    const isCustom = !config.rpcEndpoints.includes(url);
                    // The first entry is always the Primary — the one
                    // the wallet tries first — even when it is a custom
                    // address the owner added. Custom is a second
                    // marker, not a replacement: without it, making a
                    // custom RPC primary would leave the row with no
                    // Primary at all.
                    const badge = index === 0 ? 'Primary' : 'Backup';
                    const probe = chainProbes[url];
                    return (
                      <span
                        key={url}
                        className="flex flex-wrap items-center gap-2 rounded-[12px] border px-2 py-1 text-sm"
                      >
                        <span>{rpcEndpointHost(url)}</span><span className="text-xs font-bold text-muted-foreground">{badge}</span>
                        {isCustom && (
                          <span className="text-xs font-bold text-muted-foreground">Custom</span>
                        )}
                        {managed && index > 0 && (
                          <button
                            type="button"
                            className="text-xs font-medium underline"
                            onClick={() => {
                              makePrimaryEndpoint(chain, url);
                              void applyAndRefresh(
                                `Switched ${config.displayName} to ${rpcEndpointHost(url)}.`,
                              );
                            }}
                          >
                            Use this one
                          </button>
                        )}
                        {isCustom && (
                          <button
                            type="button"
                            className="text-xs font-medium underline"
                            onClick={() => {
                              removeRpcEndpoint(chain, url);
                              void applyAndRefresh(
                                `Removed ${rpcEndpointHost(url)} from ${config.displayName}.`,
                              );
                            }}
                          >
                            Remove
                          </button>
                        )}
                        {probe !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {probe.status === 'working'
                              ? `Working · ${probe.detail} · ${probe.latencyMs} ms`
                              : probe.status === 'unchecked'
                                ? `No direct check · ${probe.reason}`
                                : `Not answering · ${probe.reason}`}
                          </span>
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
                {balance?.source !== undefined && (
                  <span className="block text-sm text-muted-foreground">
                    Last balance from {balance.source}
                    {balance.fetchedAtMs !== undefined &&
                      ` · ${new Date(balance.fetchedAtMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                )}
                <span className="block text-sm text-muted-foreground">
                  {historySource === null
                    ? 'History: no working source — history unavailable for this chain.'
                    : `History: ${historySource}` +
                      (historyState?.status === 'error'
                        ? ' · failed to load'
                        : historyState?.status === 'loaded' ||
                            historyState?.status === 'empty'
                          ? ' · working'
                          : '')}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Prices — where they come from, in order (Lane F, FIX-ALL,
 * 2026-11-24). The wallet tries CoinGecko first for every chain,
 * then the next source in line when a price is stale or missing —
 * never a guessed price. The live line below counts, from the last
 * fetched prices on this device, which source is pricing each chain
 * right now; each asset row also names the source that priced it.
 * Gnosis and Mantle have no second source: when CoinGecko has no
 * price for them, the wallet says the price is unavailable.
 */
const PRICE_SOURCE_ORDER: readonly PriceSource[] = [
  'CoinGecko',
  'CoinLore',
  'DexScreener',
  'TonAPI',
  'Coinbase',
];

function PriceSourcesCard() {
  let cached: ReturnType<typeof loadCachedPrices> = null;
  try {
    cached = loadCachedPrices(Date.now());
  } catch {
    cached = null;
  }
  const counts = new Map<PriceSource, number>();
  let priced = 0;
  if (cached !== null) {
    for (const chain of SUPPORTED_CHAINS) {
      const entry = cached[chain];
      if (entry?.status === 'fresh') {
        priced += 1;
        counts.set(
          entry.quote.source,
          (counts.get(entry.quote.source) ?? 0) + 1,
        );
      }
    }
  }
  const liveLine =
    priced === 0
      ? 'No prices fetched yet — open Assets and the wallet fetches them.'
      : `Right now: ${PRICE_SOURCE_ORDER.filter((source) => (counts.get(source) ?? 0) > 0)
          .map(
            (source) =>
              `${counts.get(source)} chain${(counts.get(source) ?? 0) === 1 ? '' : 's'} priced by ${source}`,
          )
          .join(', ')}.`;
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Prices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Prices come from CoinGecko first. If a price is stale or
          missing, the wallet tries the next source in line — never a
          guessed price.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            <span className="font-medium">CoinGecko</span> — first for
            every chain.
          </li>
          <li>
            <span className="font-medium">CoinLore</span> — next for 19
            chains.
          </li>
          <li>
            <span className="font-medium">DexScreener</span> — next for
            13 chains, from the on-chain price of the wrapped coin.
          </li>
          <li>
            <span className="font-medium">TonAPI</span> for TON,{' '}
            <span className="font-medium">Coinbase</span> for Litecoin and{' '}
            <span className="font-medium">DexScreener</span> for Polygon —
            the three chains CoinLore cannot cover.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Every chain has a second source — no chain is CoinGecko-alone.
          Each asset row also names the source that priced it.
        </p>
        <p className="text-sm text-muted-foreground" role="status">
          {liveLine}
        </p>
      </CardContent>
    </Card>
  );
}
