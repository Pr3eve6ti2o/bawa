import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { useWallet } from '../state/wallet-context';
import { CHAINS, SUPPORTED_CHAINS } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';

// The /networks screen reads the 13-chain registry directly and lets
// the owner enable or disable each chain (token-discovery programme).
// A disabled chain's rows are hidden from /assets and the dashboard;
// its derived addresses stay in the vault, so re-enabling restores
// them without any re-derivation. Nothing is deleted here.
export function NetworkSelectionScreen() {
  const { enabledChains, setChainEnabled, customTokens } = useWallet();
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
          Mainnet only. This wallet never connects to a test network.
          Enable or disable chains — disabled chains are hidden from your
          assets.
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

      <p className="text-sm text-muted-foreground">
        Your balances and history come from public blockchain networks.
      </p>
    </section>
  );
}
