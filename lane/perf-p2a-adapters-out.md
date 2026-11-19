```tsx
// Imports (lines 1-13)
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { deriveAddresses, validateWatchOnlyImport } from '../engine/boundary';
import { deriveAddressesAt as deriveVaultAddressesAt } from '../wallet/core';
import { availableFor } from '../wallet/chains';
import type { AdapterTx } from '../wallet/adapters/types';
import * as vault from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';

let adaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

function ensureAdapters(): Promise<typeof import('../wallet/adapters')> {
  if (adaptersPromise) return adaptersPromise;

  const promise = import('../wallet/adapters').then(adapters => {
    adapters.registerAllAdapters();
    return adapters;
  });
  adaptersPromise = promise;

  void promise.catch(() => {
    if (adaptersPromise === promise) adaptersPromise = null;
  });

  return promise;
}
```

```tsx
// refreshBalances
  const refreshBalances = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
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

```tsx
// refreshHistory
  const refreshHistory = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
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