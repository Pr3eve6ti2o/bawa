```tsx
<>
  {/* DashboardScreen bindings (before return):
      const [assetsTab, setAssetsTab] = useState<'tokens' | 'activity'>('tokens');
      Add history and refreshHistory to the existing useWallet() destructuring.

      Assumes tx.amount, tx.timestamp, tx.direction ('in'/'out'/'self'),
      and chainConfig[chain].symbol / .displayName.
  */}

  <div
    role="tablist"
    aria-label="Wallet views"
    className="mb-4 flex w-fit gap-1 rounded-xl border border-[#263454] bg-[#0b1326] p-1"
  >
    {(['tokens', 'activity'] as const).map((tab) => (
      <button
        key={tab}
        id={`dashboard-assets-${tab}-tab`}
        type="button"
        role="tab"
        aria-selected={assetsTab === tab}
        aria-controls="dashboard-assets-panel"
        tabIndex={assetsTab === tab ? 0 : -1}
        onClick={() => setAssetsTab(tab)}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

          event.preventDefault();
          const nextTab =
            event.key === 'Home'
              ? 'tokens'
              : event.key === 'End'
                ? 'activity'
                : tab === 'tokens'
                  ? 'activity'
                  : 'tokens';

          setAssetsTab(nextTab);
          document.getElementById(`dashboard-assets-${nextTab}-tab`)?.focus();
        }}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8daeff] ${
          assetsTab === tab
            ? 'bg-[#1a2948] text-white'
            : 'text-[#c8d0e8] hover:bg-[#14213b] hover:text-white'
        }`}
      >
        {tab === 'tokens' ? 'Tokens' : 'Activity'}
      </button>
    ))}
  </div>

  <div
    id="dashboard-assets-panel"
    role="tabpanel"
    aria-labelledby={`dashboard-assets-${assetsTab}-tab`}
  >
    {assetsTab === 'tokens' ? (
      <section aria-label="Assets">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Assets</h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
            <input type="checkbox" checked={hideZero} onChange={(event) => setHideZero(event.target.checked)} />
            Hide zero balances
          </label>
        </div>
        <AssetRows hideZero={hideZero} />
      </section>
    ) : (
      <section aria-label="Activity" className="space-y-3">
        <h2 className="text-lg font-bold text-white">Recent activity</h2>

        {(() => {
          const chains = availableFor('history');

          const timestampMs = (timestamp: number | string | null | undefined) => {
            if (timestamp == null) return null;

            const value =
              typeof timestamp === 'number' && timestamp < 1_000_000_000_000
                ? timestamp * 1000
                : timestamp;
            const time = new Date(value).getTime();

            return Number.isFinite(time) ? time : null;
          };

          const rows = chains
            .flatMap((chain) =>
              (history[chain]?.txs ?? []).map((tx) => ({ chain, tx })),
            )
            .sort(
              (a, b) =>
                (timestampMs(b.tx.timestamp) ?? 0) -
                (timestampMs(a.tx.timestamp) ?? 0),
            );

          const loading = chains.some(
            (chain) => history[chain]?.status === 'loading',
          );

          const unavailableChains = chains.filter(
            (chain) =>
              history[chain]?.status === 'unavailable' ||
              history[chain]?.status === 'error',
          );

          return (
            <>
              {rows.length > 0 ? (
                <ul className="divide-y divide-[#263454] overflow-hidden rounded-xl border border-[#263454] bg-[#0b1326]">
                  {rows.map(({ chain, tx }) => {
                    const config = chainConfig[chain];
                    const time = timestampMs(tx.timestamp);
                    const direction =
                      tx.direction === 'in'
                        ? 'Received'
                        : tx.direction === 'out'
                          ? 'Sent'
                          : 'Self transfer';

                    return (
                      <li key={`${chain}:${tx.hash}`}>
                        <Link
                          to={`/transactions/${tx.hash}`}
                          className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#14213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#8daeff]"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-white">
                              {direction}
                              <span className="font-normal text-[#c8d0e8]">
                                {' · '}{config.symbol}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs text-[#a5b2d3]">
                              {time == null
                                ? 'Pending'
                                : new Date(time).toLocaleDateString('en-GB', {
                                    dateStyle: 'short',
                                  })}
                              {tx.status === 'failed'
                                ? ' · Failed'
                                : tx.status === 'pending'
                                  ? ' · Pending'
                                  : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-sm font-semibold text-white">
                            {formatNativeWithSymbol(
                              tx.amount,
                              CHAIN_DECIMALS[chain],
                              config.symbol,
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : loading ? (
                <Skeleton className="h-20 w-full rounded-xl bg-[#14213b]" />
              ) : (
                <p className="rounded-xl border border-[#263454] bg-[#0b1326] p-4 text-sm text-[#c8d0e8]">
                  No transactions yet
                </p>
              )}

              {unavailableChains.map((chain) => (
                <div
                  key={`history-unavailable:${chain}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#263454] bg-[#0b1326] px-4 py-3"
                >
                  <p className="text-sm text-[#c8d0e8]">
                    {chainConfig[chain].displayName} history unavailable
                  </p>
                  <Button
                    type="button"
                    onClick={() => void refreshHistory()}
                    className="shrink-0 rounded-lg border border-[#334767] bg-[#1a2948] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#223658]"
                  >
                    Retry
                  </Button>
                </div>
              ))}
            </>
          );
        })()}
      </section>
    )}
  </div>
</>
```