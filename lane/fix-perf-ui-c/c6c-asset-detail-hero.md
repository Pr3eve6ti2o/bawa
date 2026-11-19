Make three edits (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only except EDIT 3, which wires the send flow's initial chain to the shared selected chain (no validation, signing or fee logic changes). Spec is UI-UX-REFERENCE.md §6 (Phantom detail-owns-actions). Assumes the previous edit already replaced the detail header with a Back link only and added the `ChainLogo` import.

EDIT 1 — Replace the light balance Card in `apps/web/src/screens/asset-detail.tsx` with the dark holding-card hero. Exact current code:
```tsx
      <Card className="rounded-[20px] border-[#d6deed]">
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm text-muted-foreground">
            Balance · {config.displayName} mainnet
          </p>
          {balance.status === 'loading' ? (
            <div role="status">
              <Skeleton className="h-8 w-48" />
              <span className="sr-only">Loading balance…</span>
            </div>
          ) : balance.status === 'zero' ? (
            <>
              <p className="text-2xl font-bold">
                0 {config.symbol}
              </p>
              <p className="text-sm text-muted-foreground">Zero balance</p>
            </>
          ) : balance.status === 'available' ? (
            <p className="text-2xl font-bold">
              {formatNativeWithSymbol(
                balance.value ?? '0',
                CHAIN_DECIMALS[chain as ChainId],
                config.symbol,
              )}
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold">Balance unavailable</p>
              <p className="text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
```
Replace with the dark hero (spec §6 hero order: 48px native logo → asset name 24px/600 and network 14px/400 → actual native quantity plus ticker 32px/600; surface `--panel-surface-raised`, radius 16px, padding 16px):
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
Keep the exact balance-state logic and copy; only the surface, sizes and text tokens change. The `Card` import stays (used by the breakdown and xpub Cards below); `CardContent` stays used.

EDIT 2 — Asset-scoped actions + breakdown Card, inserted directly after the hero (EDIT 1) and before `<section aria-labelledby="recent-transactions-heading"`. Exact anchor:
```tsx
      </div>

      <section aria-labelledby="recent-transactions-heading" className="space-y-3">
```
Insert between them (replacing the blank line with the new blocks):
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
Notes: Send is added only for btc/eth/trx — TON stays receive-only in-app, so TON detail shows Receive only (no Send button). Action buttons are 44px high (`h-11`), 12px gaps (`gap-3`). The breakdown Card shows only this chain's actual native amount/network — no multichain total, no invented values. The Refresh button reuses the existing `refreshAll` (which was orphaned by the header edit) with its existing `state === 'loading'` disabled condition.

EDIT 3 — `apps/web/src/screens/send.tsx`: initialise the send chain from the shared selected chain so the detail Send button lands on the right chain. Exact current code:
```tsx
  const { vaultState, vaultAddresses, balances } = useWallet();
  const chainsWithWallet = CHAINS.filter(
    (chain) => vaultAddresses[chain].length > 0,
  );
  const [chain, setChain] = useState<ChainId>(chainsWithWallet[0] ?? 'eth');
```
Replace with:
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
No other send behaviour changes: the chain selector, recipient, amount, review, sign and result steps are untouched by this edit.

Acceptance: hero is dark (`bg-panel-surface-raised`) with 48px logo, 24px name, 32px balance; actions are 44px with 12px gaps; TON has no Send button; breakdown shows only this chain; no `#` hex, no `white/`, no `slate-*`, no gradient classes in the returned code; `tsc`-clean.

Return ONLY the three edits, numbered 1-3, each with the exact old text quoted and the replacement in its own ```tsx fenced block. No explanation, no other changes.
