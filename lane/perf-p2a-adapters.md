# Lane A perf, prompt 2a: lazy-load the balance adapters in wallet-context (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

Vite 8, React 19, TypeScript strict. `apps/web/src/state/wallet-context.tsx`
statically imports the adapter registry, so the 3.1 MB wallet-engine chunk
(viem + adapters + wallet-core glue) loads before first paint. Goal: load it
on demand only. A separate prompt handles the engine (boundary/core)
imports; do NOT touch those here.

## Task

1. Remove the static value-import `import { getAdapter } from
   '../wallet/adapters';` (keep the type-only `import type { AdapterTx }
   from '../wallet/adapters/types';` — it is erased at compile time).
2. Add a module-level `ensureAdapters()` helper: cached promise, dynamic
   `import('../wallet/adapters')`, calls the module's
   `registerAllAdapters()` once, returns the module. Concurrent callers
   share the one promise. If the import rejects, the cached promise must be
   cleared so a later call retries (same pattern as the existing
   `loadCore` rejection handling: clear only if still the same promise).
3. In `refreshBalances` and `refreshHistory` (current code below), await
   `ensureAdapters()` first and use the returned module's `getAdapter`.
   `main.tsx` will stop calling `registerAllAdapters()` at startup, so
   registration MUST happen inside `ensureAdapters()` — do not rely on it
   having run already.
4. No behaviour change: same balance/history states, same per-chain
   request counters and stale-request guards, same `availableFor` gating.

## Acceptance

`tsc --noEmit` clean with the rest of the project unchanged; no static
value-import of `../wallet/adapters` remains in this file; first paint no
longer pulls the adapter chunk.

## Current code (replace exactly these blocks)

Imports (lines 1-13):

```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { deriveAddresses, validateWatchOnlyImport } from '../engine/boundary';
import { deriveAddressesAt as deriveVaultAddressesAt } from '../wallet/core';
import { availableFor } from '../wallet/chains';
import { getAdapter } from '../wallet/adapters';
import type { AdapterTx } from '../wallet/adapters/types';
import * as vault from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';
```

`refreshBalances`:

```tsx
  const refreshBalances = useCallback(async () => {
    await Promise.all(CHAINS.map(async (chain) => {
      const request = ++balanceRequests.current[chain];
      const setBalance = (balance: BalanceState) => {
        if (request !== balanceRequests.current[chain]) return;
        update(previous => ({
          ...previous,
          balances: { ...previous.balances, [chain]: balance },
        }));
      };
      if (!availableFor('balance').includes(chain)) {
        setBalance({ status: 'unavailable', reason: 'no-adapter' });
        return;
      }
      const adapter = getAdapter(chain);
      if (!adapter) {
        setBalance({ status: 'unavailable', reason: 'no-adapter' });
        return;
      }
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        setBalance({ status: 'unavailable', reason: 'no-address' });
        return;
      }
      setBalance({ status: 'loading' });
      const result = await adapter.getBalance(address);
      if (request !== balanceRequests.current[chain]) return;
      if (result.status === 'ok') {
        setBalance(
          result.data.valueBaseUnits === '0'
            ? { status: 'zero', value: '0' }
            : { status: 'available', value: result.data.valueBaseUnits },
        );
      } else if (result.status === 'unavailable') {
        setBalance({ status: 'unavailable', reason: result.reason });
      } else {
        setBalance({ status: 'error', reason: result.reason });
      }
    }));
  }, [update]);
```

`refreshHistory`:

```tsx
  const refreshHistory = useCallback(async () => {
    await Promise.all(CHAINS.map(async (chain) => {
      const request = ++historyRequests.current[chain];
      const setHistory = (history: HistoryState) => {
        if (request !== historyRequests.current[chain]) return;
        update(previous => ({
          ...previous,
          history: { ...previous.history, [chain]: history },
        }));
      };
      if (!availableFor('history').includes(chain)) {
        setHistory({ status: 'unavailable', reason: 'no-adapter', txs: [] });
        return;
      }
      const adapter = getAdapter(chain);
      if (!adapter) {
        setHistory({ status: 'unavailable', reason: 'no-adapter', txs: [] });
        return;
      }
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        setHistory({ status: 'unavailable', reason: 'no-address', txs: [] });
        return;
      }
      setHistory({ status: 'loading', txs: [] });
      const result = await adapter.getHistory(address, 25);
      if (request !== historyRequests.current[chain]) return;
      if (result.status === 'ok') {
        setHistory(
          result.data.length === 0
            ? { status: 'empty', txs: [] }
            : { status: 'loaded', txs: result.data },
        );
      } else if (result.status === 'unavailable') {
        setHistory({ status: 'unavailable', reason: result.reason, txs: [] });
      } else {
        setHistory({ status: 'error', reason: result.reason, txs: [] });
      }
    }));
  }, [update]);
```
