1. Old text:

> ```text
>       <Card className="rounded-[20px] border-[#d6deed]">
>         <CardContent className="space-y-2 pt-6">
>           <p className="text-sm text-muted-foreground">
>             Balance · {config.displayName} mainnet
>           </p>
>           {balance.status === 'loading' ? (
>             <div role="status">
>               <Skeleton className="h-8 w-48" />
>               <span className="sr-only">Loading balance…</span>
>             </div>
>           ) : balance.status === 'zero' ? (
>             <>
>               <p className="text-2xl font-bold">
>                 0 {config.symbol}
>               </p>
>               <p className="text-sm text-muted-foreground">Zero balance</p>
>             </>
>           ) : balance.status === 'available' ? (
>             <p className="text-2xl font-bold">
>               {formatNativeWithSymbol(
>                 balance.value ?? '0',
>                 CHAIN_DECIMALS[chain as ChainId],
>                 config.symbol,
>               )}
>             </p>
>           ) : (
>             <>
>               <p className="text-lg font-semibold">Balance unavailable</p>
>               <p className="text-sm text-muted-foreground">
>                 {balance.status === 'error'
>                   ? 'Could not load the balance.'
>                   : 'No balance adapter is available for this chain.'}
>                 {balance.reason ? ` (${balance.reason})` : ''}
>               </p>
>               <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
>                 Retry
>               </Button>
>             </>
>           )}
>         </CardContent>
>       </Card>
> ```

Replacement:

```tsx
      <div className="space-y-4 rounded-2xl bg-panel-surface-raised p-4">
        <div className="flex items-center gap-3">
          <ChainLogo chain={chain} size={48} />
          <div>
            <h1 className="text-2xl font-semibold text-panel-text">{config.displayName}</h1>
            <p className="text-sm text-panel-text-muted">{config.displayName} mainnet</p>
          </div>
        </div>
        {balance.status === 'loading' ? (
          <div role="status">
            <Skeleton className="h-8 w-48" />
            <span className="sr-only">Loading balance…</span>
          </div>
        ) : balance.status === 'zero' ? (
          <>
            <p className="text-[32px] font-semibold leading-10 text-panel-text">
              0 {config.symbol}
            </p>
            <p className="text-sm text-panel-text-muted">Zero balance</p>
          </>
        ) : balance.status === 'available' ? (
          <p className="text-[32px] font-semibold leading-10 text-panel-text">
            {formatNativeWithSymbol(
              balance.value ?? '0',
              CHAIN_DECIMALS[chain as ChainId],
              config.symbol,
            )}
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold text-panel-text">Balance unavailable</p>
            <p className="text-sm text-panel-text-muted">
              {balance.status === 'error'
                ? 'Could not load the balance.'
                : 'No balance adapter is available for this chain.'}
              {balance.reason ? ` (${balance.reason})` : ''}
            </p>
            <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
              Retry
            </Button>
          </>
        )}
      </div>
```

2. Old text:

> ```text
>       </div>
>
>       <section aria-labelledby="recent-transactions-heading" className="space-y-3">
> ```

Replacement:

```tsx
      </div>

      <div className="flex flex-wrap gap-3">
        {chain !== 'ton' && (
          <Button asChild className="h-11">
            <Link to="/send" onClick={() => setSelectedChain(chain)}>
              Send
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11">
          <Link to="/receive" onClick={() => setSelectedChain(chain)}>
            Receive
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={state === 'loading'}
          onClick={refreshAll}
          className="h-11"
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardContent className="pt-6">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Balance</dt>
              <dd className="font-semibold">
                {balance.status === 'loading'
                  ? 'Loading…'
                  : balance.status === 'zero'
                    ? `0 ${config.symbol}`
                    : balance.status === 'available'
                      ? formatNativeWithSymbol(
                          balance.value ?? '0',
                          CHAIN_DECIMALS[chain as ChainId],
                          config.symbol,
                        )
                      : 'Balance unavailable'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-semibold">{config.displayName} mainnet</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="recent-transactions-heading" className="space-y-3">
```

3. Old text:

> ```text
>   const { vaultState, vaultAddresses, balances } = useWallet();
>   const chainsWithWallet = CHAINS.filter(
>     (chain) => vaultAddresses[chain].length > 0,
>   );
>   const [chain, setChain] = useState<ChainId>(chainsWithWallet[0] ?? 'eth');
> ```

Replacement:

```tsx
  const { vaultState, vaultAddresses, balances, selectedChain } = useWallet();
  const chainsWithWallet = CHAINS.filter(
    (chain) => vaultAddresses[chain].length > 0,
  );
  const [chain, setChain] = useState<ChainId>(
    chainsWithWallet.includes(selectedChain)
      ? selectedChain
      : (chainsWithWallet[0] ?? 'eth'),
  );
```