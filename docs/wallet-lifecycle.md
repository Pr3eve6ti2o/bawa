# Wallet lifecycle — unlock, sign, broadcast, refresh

This is the integration guide for the web wallet's lifecycle. It states the
order of operations and what each step does and does not do. It is a map,
not a second implementation: the code in `apps/web/src/` is authoritative
where the two disagree, and a disagreement is a bug in this document.

## The lifecycle, in order

```
create / restore vault → unlock → derive addresses → refresh balances/history
→ review → sign (local, offline) → broadcast (DISABLED) → explicit refresh
```

1. **Create or restore.** A vault is created from a fresh 24-word phrase
   (`screens/create-wallet.tsx`) or restored from a 12- or 24-word phrase
   (`screens/import-wallet.tsx`). The phrase lives in the screen's local
   state only until it is validated and derived, then the input is cleared
   immediately and on unmount. It is never stored, logged, or passed to the
   watch-only path.
2. **Unlock.** `unlockVault(password, passphrase?)` decrypts the vault
   envelope (PBKDF2 600,000 / AES-GCM-256, `apps/web/src/wallet/vault.ts`)
   and derives the vault addresses for the selected account and index.
   Unlocking never re-derives with a stale selection: the caller passes the
   selection explicitly. A wrong password fails closed; decryption cannot
   distinguish a bad password from corruption, and the wallet says so
   instead of guessing.
3. **Derive addresses.** Vault addresses are public derived addresses for
   the selected vault account (default account 0, index 0). TON has one
   address per wallet (fully hardened path `m/44'/607'/0'`). Watch-only
   xpubs are a separate, explicitly labelled account type and can never be
   upgraded into signing keys.
4. **Refresh balances and history.** `refreshBalances()` and
   `refreshHistory()` read public addresses through the chain adapters
   (`apps/web/src/wallet/adapters/`). They run in the background after
   unlock, so the wallet shows immediately. A failed background refresh
   leaves the per-chain error/unavailable state (or the previous state);
   the gated Retry buttons re-run it (dashboard: one list-level Retry
   when at least one balance failed, never per-row; history: only when
   a failed chain has an address to refetch). Refresh
   is explicit: there is no automatic recovery, no silent retry in the
   transport (ADR-0009), and a failed fetch is never reported as zero.
   See `docs/runbooks/refresh-failure.md` for the failure states.
5. **Review.** A send is reviewed before anything is signed
   (`screens/send.tsx`, `screens/send-review.tsx`). Review, unlock/sign
   and broadcast are distinct stages.
6. **Sign (local, offline).** Signing happens locally through the
   engine boundary (`apps/web/src/engine/boundary.ts`) and the wallet
   core (`apps/web/src/wallet/core.ts`, `send.ts`). Callers receive
   signatures, never key bytes. Signing never touches the network.
7. **Broadcast — DISABLED.** Broadcast is built but disabled by standing
   owner order (`BROADCAST_DISABLED_MESSAGE` in
   `apps/web/src/wallet/adapters/types.ts`). No send has ever run on
   token-gaps on any network. (Devnet TON test sends ran on the
   separate `panel-rebuild/devnet-temp` branch — see
   `docs/DEVNET-ISSUES.md` — not on token-gaps.) A pending broadcast
   is never auto-resubmitted: if a broadcast outcome is unknown, it
   stays unknown (`markBroadcastUnknown`).
8. **Explicit history refresh.** After any send attempt, history is
   re-read explicitly. There is no background poller that would turn an
   unknown broadcast into a presumed success.

## Storage and secrecy, in one place

- `localStorage` holds the encrypted vault envelope and public watch-only
  data (xpubs and labels) only — never secrets. The mnemonic never enters
  wallet state.
- The mnemonic is transient in a module closure during vault operations
  and is cleared afterwards. Deletion from JavaScript memory is not
  guaranteed erasure; the wallet documents that limit where it matters
  instead of claiming otherwise.
- Auto-lock (OFF by default; a toggle plus a duration — Immediately / 1 minute / 5 minutes / 15 minutes / 1 hour / 1 day) clears in-memory
  vault access and vault-derived addresses when enabled. Locking is not a security
  boundary for public xpubs, which remain in state and storage.

## What does not exist yet

- No automatic recovery: there is no backup store for the vault envelope
  beyond what the vault module provides, and no whole-profile recovery.
  Recovery rehearsal has never been executed.
- Prices are live (CoinGecko first, with CoinLore, Coinbase, DexScreener and TonAPI fallbacks; a chain no source prices shows unavailable, never a guessed price). Balances are native amounts; no fiat value is ever invented.
- No background transaction monitor. History is read when the user (or
  the unlock flow) asks for it.

## Related documents

- `CONSTRAINTS.md` — the quality bar this lifecycle is held to.
- `docs/adr/0009-fetchjson-no-retry.md` — why the transport never retries.
- `docs/runbooks/refresh-failure.md` — what each refresh failure state means.
- `docs/adr/0001-wallet-core-pin.md` — the engine pin the lifecycle runs on.
