# Lane A perf, prompt 2b: lazy-load the wallet engine in wallet-context (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

Vite 8, React 19, TypeScript strict. `apps/web/src/state/wallet-context.tsx`
still statically imports the wallet engine, so the ~2.9 MB wallet-core glue
sits in the first-paint chunk. Goal: load the engine on demand only.
Prompt 2a already made the adapters lazy via `ensureAdapters()` (do NOT
touch that). Do NOT touch `refreshBalances`, `refreshHistory`,
`refreshVaultAccounts` or `unlockVault` here — a separate prompt splits
those.

## Task

1. Remove the two static value-imports:
   `import { deriveAddresses, validateWatchOnlyImport } from
   '../engine/boundary';` and `import { deriveAddressesAt as
   deriveVaultAddressesAt } from '../wallet/core';`
   (Keep all other imports exactly as they are.)
2. In `refreshChain`, dynamic-import `deriveAddresses` from
   `../engine/boundary` AFTER the early return for a missing wallet or a
   locked wallet, right before the `try`, so no engine loads when there is
   nothing to derive.
3. In `addXpub`, dynamic-import `validateWatchOnlyImport` from
   `../engine/boundary` before it is used.
4. In the hydration `useEffect` (the `Promise.all(CHAINS.map(...))` block),
   dynamic-import `validateWatchOnlyImport` from `../engine/boundary`
   inside the per-chain callback before it is used.
5. `refreshVaultAccounts` calls `deriveVaultAddressesAt` — leave that call
   site for the follow-up prompt, but it must keep working: add a
   module-level cached dynamic-import helper `loadVaultCore()` that returns
   the `../wallet/core` module, and use it in `refreshVaultAccounts` in
   place of the removed static import (same function name
   `deriveVaultAddressesAt`, same arguments, same awaited behaviour).
   A rejected import must clear the cached promise so a later call retries.

## Acceptance

`tsc --noEmit` clean with the rest of the project unchanged; no static
value-import of `../engine/boundary` or `../wallet/core` remains in this
file; first paint no longer pulls the engine chunk; watch-only add,
hydration restore, and vault address derivation behave exactly as before.

## Current code (replace exactly these blocks)

Imports:

```tsx
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
```

`refreshChain`:

```tsx
  const refreshChain = useCallback(async (chain: ChainId) => {
    const request = ++derivations.current[chain];
    const wallet = current.current.xpubs[chain];
    if (!wallet || current.current.locked) {
      setChain(chain, 'empty');
      return;
    }
    setChain(chain, 'loading');
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

`addXpub` (first lines only; the rest of the function is unchanged):

```tsx
  const addXpub = useCallback(async (chain: ChainId, xpub: string, label: string) => {
    const request = ++additions.current[chain];
    const epoch = lifetime.current;
    const publicKey = xpub.trim();
    const validation = await validateWatchOnlyImport(chain, publicKey);
```

Hydration effect (first lines only; the rest of the effect is unchanged):

```tsx
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
        const validation = await validateWatchOnlyImport(chain, publicKey);
```

`refreshVaultAccounts` derivation (the `deriveVaultAddressesAt` call only):

```tsx
    let derived: Record<ChainId, string>;
    try {
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
