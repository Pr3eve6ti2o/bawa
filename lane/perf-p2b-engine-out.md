```tsx title="Imports"
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { availableFor } from '../wallet/chains';
import type { AdapterTx } from '../wallet/adapters/types';
import * as vault from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';

let vaultCorePromise: Promise<typeof import('../wallet/core')> | undefined;

function loadVaultCore(): Promise<typeof import('../wallet/core')> {
  if (!vaultCorePromise) {
    vaultCorePromise = import('../wallet/core').catch((error: unknown) => {
      vaultCorePromise = undefined;
      throw error;
    });
  }
  return vaultCorePromise;
}
```

```tsx title="refreshChain"
  const refreshChain = useCallback(async (chain: ChainId) => {
    const request = ++derivations.current[chain];
    const wallet = current.current.xpubs[chain];
    if (!wallet || current.current.locked) {
      setChain(chain, 'empty');
      return;
    }
    setChain(chain, 'loading');
    const { deriveAddresses } = await import('../engine/boundary');
    try {
      const addresses = await deriveAddresses(chain, wallet.xpub, wallet.derivedCount);
      if (request !== derivations.current[chain]) return;
      setChain(chain, 'ready', addresses.map((address, index) => ({ chain, index, address })));
    } catch (error: unknown) {
      if (request === derivations.current[chain]) {
        setChain(chain, 'error', [], messageOf(error));
      }
    }
  }, [setChain]);
```

```tsx title="addXpub (first lines only)"
  const addXpub = useCallback(async (chain: ChainId, xpub: string, label: string) => {
    const request = ++additions.current[chain];
    const epoch = lifetime.current;
    const publicKey = xpub.trim();
    const { validateWatchOnlyImport } = await import('../engine/boundary');
    const validation = await validateWatchOnlyImport(chain, publicKey);
```

```tsx title="Hydration effect (first lines only)"
  useEffect(() => {
    let cancelled = false;
    const saved = readStored();
    void Promise.all(CHAINS.map(async chain => {
      const entry = saved[chain];
      if (changed.current[chain] || !isRecord(entry) || typeof entry.xpub !== 'string') return;
      const publicKey = entry.xpub.trim();
      // An over-long stored label is dropped to '' (T43 r2b Fix (b)):
      // restore-to-'' rather than truncation, so a persisted prefix of
      // a pasted secret is not kept. The persistence effect below then
      // overwrites the stored label with ''.
      const rawLabel = typeof entry.label === 'string' ? entry.label.trim() : '';
      const label = rawLabel.length > LABEL_MAX_LENGTH ? '' : rawLabel;
      try {
        const { validateWatchOnlyImport } = await import('../engine/boundary');
        const validation = await validateWatchOnlyImport(chain, publicKey);
```

```tsx title="refreshVaultAccounts derivation"
    let derived: Record<ChainId, string>;
    try {
      const { deriveAddressesAt: deriveVaultAddressesAt } = await loadVaultCore();
      derived = await vault.withMnemonic((mnemonic) =>
        deriveVaultAddressesAt(
          mnemonic,
          // The passphrase lane (p13a) already landed: derive with the
          // session passphrase, never '' when one is in use.
          vault.getSessionPassphrase(),
          selected.account,
          selected.index,
        ),
      );
```