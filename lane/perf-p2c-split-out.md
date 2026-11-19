```tsx title="apps/web/src/state/wallet-context.tsx — refreshVaultAccounts tail"
    if (request !== vaultDerivations.current) return;
    update(previous => ({
      ...previous,
      vaultState,
      vaultProfileIds: profileIds,
      vaultAddresses: {
        btc: [derived.btc],
        eth: [derived.eth],
        trx: [derived.trx],
        ton: [derived.ton],
      },
    }));
    // Balances/history load in the background: this function returns as
    // soon as the derived addresses are in state, so the wallet shows
    // immediately. A failed background refresh leaves the per-chain
    // error/unavailable state (or the previous state) and the dashboard
    // Retry button re-runs it; it never throws here.
    void refreshBalances().catch(() => {});
    void refreshHistory().catch(() => {});
  }, [update, refreshBalances, refreshHistory]);
```