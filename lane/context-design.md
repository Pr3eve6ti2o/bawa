# Hands-on: wallet-context extension design (Phase 1.4/1.5)

Done hands-on by the lane agent (not a Sol call) to preserve the epoch /
hydration / not-account-key logic in wallet-context.tsx verbatim. Sol calls
cover fresh modules and screen rewrites; this file is a surgical extension.

## Added to WalletContextValue

- `vaultState: 'no-vault' | 'locked' | 'unlocked'` — from vault.hasVault() /
  vault.isLocked(), refreshed on unlock/lock/vault-create.
- `vaultAddresses: PerChain<string[]>` — vault-derived addresses, account 0
  index 0 first (via core.ts deriveAddresses), public data, safe in state.
  Empty when locked or when no vault exists.
- `unlockVault(password: string): Promise<void>` — vault.unlock, then
  re-derive vault addresses; wrong password surfaces the vault error.
- `lockVault(): void` — vault.lock, clear vaultAddresses, bump derivation
  epochs so stale async results are dropped (existing ref-epoch pattern).
- `refreshVaultAccounts(): Promise<void>` — re-derive vault addresses while
  unlocked; called by create/import screens after vault creation.

## Preserved exactly
- All existing xpub (watch-only) behaviour: STORAGE_KEY
  `bawa-watch-only-xpubs`, validation, derivedCount, hydration, persistence
  effect, label bound (40), `addXpub` / `removeXpub` / `refreshChain` /
  `setSelectedChain`, lock/unlock (no-arg) semantics for watch-only.
- `lock()` (existing, no-arg) additionally locks the vault and clears
  vaultAddresses. `unlock()` (existing, no-arg) re-derives watch-only only;
  vault unlock stays a separate password step.

## Labelling rule

- `xpubs` IS the watch-only set: file header states it, and the context value
  exposes no path from an xpub to signing keys. An xpub can never be upgraded
  into signing keys; spending requires vault creation or mnemonic restoration.

## Interfaces the screens rely on (implemented here to match)

- `core.ts`: `createWallet(passphrase?)`, `deriveAddresses(mnemonic, passphrase?)`,
  `restoreWallet(mnemonic, passphrase?)` — signatures as written by Sol call 1b;
  reconcile on read-back.
- `vault.ts`: `createVault(mnemonic, password, profileIds)`, `hasVault()`, `vaultProfiles()`, `unlock(password)`,
  `lock()`, `isLocked()`, `withMnemonic(fn)`, `changePassword`, `deleteVault`. (Correction 2026-11-19: createVault takes the pinned profileIds; the context passes all four profileIds at creation time.)
- `chains.ts`: `CHAINS`, `pathFor`, `availableFor(capability)`, `assertSupported(chain, capability)`.

## Layout-page API (owner addition 2 — hands-on, no Sol call)

The Phase 5 layout page builds directly on the context. Additions:

- `balances: PerChain<BalanceState>` where `BalanceState = { status: 'loading' | 'zero' | 'available' | 'unavailable' | 'error', value?: string, reason?: string }`. (Correction 2026-11-19: an 'available' status was added for a non-zero provider balance; the design's four statuses had no state for it. No provider exists in this lane, so every balance is `unavailable` / `no-adapter` in practice.) Initial state per chain: `unavailable` with reason `no-adapter`. Never a fabricated number, never a silent zero on failure.
- `refreshBalances(): Promise<void>` — consults `capabilitiesFor(chain)`; for any chain whose balance capability is not verified, sets `unavailable`; otherwise delegates to the registered provider (see below). Loading state is set while a provider call is in flight.
- `apps/web/src/wallet/providers.ts` (new, hands-on, types + registry only): `BalanceProvider` interface with `getBalance(chain, address): Promise<{ value: string }>` and `getHistory(chain, address): Promise<unknown[]>`; `registerBalanceProvider(chain, provider)` and `getBalanceProvider(chain)`. Phase 2 adapters implement this interface; until one registers, balances stay `unavailable`. No provider implementation in this lane.
- Receive action: layout reads the address from `vaultAddresses[chain]` (or watch-only derived addresses) — no new API needed. Send action: layout calls `assertSupported(chain, 'local-sign')`, which throws the exact unavailable combination until Phase 4; the send entry point stays visibly blocked, never working-looking.
- `vaultState` + `lockVault()` / `unlockVault(password)` are the lock/unlock actions.

## Indexed accounts (Phase 1.5)

Account 0 index 0 first for all four chains. `deriveMore(chain, count)` is an
extension point: derive index 1..n via core.ts deriveFromXpub-style helpers
once the vault session exposes the mnemonic transiently through
vault.withMnemonic. Not implemented in this lane unless the vault session
design makes it trivial; record as open if deferred.
