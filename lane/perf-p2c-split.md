# Lane A perf, prompt 2c: show the wallet before balances load (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

Vite 8, React 19, TypeScript strict. In
`apps/web/src/state/wallet-context.tsx`, `refreshVaultAccounts` awaits
`refreshBalances()` then `refreshHistory()` before returning, and its
callers (`unlockVault`, the create-wallet confirm step, the import-wallet
save step) await it before showing the wallet. Each adapter fetch has a
10 s timeout and they run sequentially (balances, then history), so the
user waits on the network before seeing their addresses. Measured
confirm-to-ready is 0.85–1.36 s on localhost with fast providers; on a
phone with slow providers it is seconds. Goal: addresses show first,
balances/history fill in afterwards.

## Task

In `refreshVaultAccounts` ONLY (current code below), replace the two
awaited calls at the end with background calls that never reject into the
caller:

```ts
    // Balances/history load in the background: this function returns as
    // soon as the derived addresses are in state, so the wallet shows
    // immediately. A failed background refresh leaves the per-chain
    // error/unavailable state (or the previous state) and the dashboard
    // Retry button re-runs it; it never throws here.
    void refreshBalances().catch(() => {});
    void refreshHistory().catch(() => {});
```

Requirements:
- The addresses `update()` above those lines is unchanged and still
  happens before the background calls start.
- `unlockVault` (shown below) needs NO change: it still awaits
  `refreshVaultAccounts()`, which now returns after the addresses are set.
- No other behaviour change: same derivation, same stale-request guards,
  same state shape. Do NOT touch `refreshBalances`, `refreshHistory`,
  `ensureAdapters`, or any import.

## Acceptance

`tsc --noEmit` clean with the rest of the project unchanged;
`refreshVaultAccounts` resolves after the addresses update, without
waiting for any provider fetch; a failing provider fetch still lands as
a per-chain error/unavailable balance state, never an unhandled rejection.

## Current code (replace exactly this tail of refreshVaultAccounts)

```tsx
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
    // New vault addresses: refresh the adapter-backed balances + history.
    await refreshBalances();
    await refreshHistory();
  }, [update, refreshBalances, refreshHistory]);
```

`unlockVault` (reference only — no change needed):

```tsx
  const unlockVault = useCallback(async (password: string, passphrase = '') => {
    if (isPassphraseUsed() && !passphrase) {
      throw new Error('This wallet uses a passphrase. Enter it to unlock.');
    }

    await vault.unlock(password, passphrase);
    await refreshVaultAccounts();
  }, [refreshVaultAccounts]);
```
