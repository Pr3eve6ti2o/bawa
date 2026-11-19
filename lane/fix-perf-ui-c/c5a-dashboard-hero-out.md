1. **Old:**
```tsx
      <div className="space-y-1 pt-1">
        <p className="text-[13px] font-medium text-[#aab5d1]">Portfolio balance</p>
        <p className="text-2xl font-bold tracking-tight text-white">{hero.text}</p>
        {hero.noPriceFeed && (
          <p className="text-[13px] text-[#aab5d1]">
            No price feed connected — portfolio total unavailable. Balances below
            are exact native amounts from the mainnet adapters.
          </p>
        )}
        <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
          {hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
      </div>
```

**Replacement:**
```tsx
      <div className="space-y-1 rounded-2xl bg-panel-surface-raised p-5">
        <p className="text-[13px] leading-[18px] font-medium text-panel-text-muted">Portfolio balance</p>
        <p className="text-display-lg font-bold tracking-tight text-panel-text">{hero.text}</p>
        {hero.noPriceFeed && (
          <p className="text-xs leading-[18px] text-panel-text-muted">
            No price feed connected — portfolio total unavailable. Balances below
            are exact native amounts from the mainnet adapters.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={heroLoading}
          onClick={() => void refreshBalances()}
        >
          {heroLoading ? 'Refreshing…' : hero.retry ? 'Retry' : 'Refresh balances'}
        </Button>
      </div>
```

2. **Old:**
```tsx
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
```

**Replacement:**
```tsx
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-panel-icon-tile text-panel-accent transition-colors hover:bg-panel-action-hover">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-xs leading-4 font-medium text-panel-text">{label}</span>
```

3. **Old:**
```tsx
      {locked ? (
        <div className="space-y-4 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Locked — derived addresses are hidden until you unlock.
          </p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </div>
      ) : vaultState === 'locked' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Vault locked — your vault addresses are hidden until you unlock.
          </p>
          <Link
            to="/lock"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Unlock
          </Link>
        </div>
      ) : vaultState === 'no-vault' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            No wallet yet — create a wallet or import one to see its balances.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create-wallet"
              className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
            >
              Create wallet
            </Link>
            <Link
              to="/import-wallet"
              className="inline-block rounded-full border border-white/10 bg-[#263451] px-4 py-2 text-sm font-semibold text-[#eff2fc]"
            >
              Import wallet
            </Link>
          </div>
        </div>
      ) : null}
```

**Also delete only these `useWallet()` destructure entries:** `locked`, `unlock`, `vaultState`.

**Replacement: empty.**
```tsx
```