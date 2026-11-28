# Decisions — Bawa layout-makeover programme

Decided 2026-11-20 by Orion/coordinator under owner delegation (2026-11-20,
all pending Bawa decisions delegated to Orion). Each section records the
decision, the evidence, and what was done. The layout-makeover branch is
`panel-rebuild/layout-makeover` (off `panel-rebuild/adopt-proper`
`b20786b`); the main-adopt-fixes work is on `main`.

## 1. ECDSA 0.19.2 (PYSEC-2026-1325 / CVE-2024-23342) — accept and document

**Decision: accept the residual risk; do not replace or remove `ecdsa`.**

Evidence: no fix version exists (OSV re-verified 2026-11-20: affected range
has a single event, `introduced: 0`, and no `fixed` event) and upstream
will never ship one (`python-ecdsa` `SECURITY.md`: "Fixes for side-channel
vulnerabilities will not be developed"). The vulnerable operation — timed
P-256 `sign_digest` — is unreachable on Bawa's paths: `ecdsa` is transitive
only via `bip-utils`, `bip_utils` defaults `USE_COINCURVE = True` so the
secp256k1 path executes coincurve (pinned 21.0.0), no `Sign` method exists
on any `bip_utils` key wrapper, and Bawa never signs with Python at all, on
any curve. `ecdsa` IS loaded at `bip_utils` import time via the `nist256p1`
module, but no signing path executes it (load is not execution). Precedents
from the shared repos: dYdX replaced `ecdsa` because it called
`ecdsa.SigningKey` directly to sign; KIVOX removed it because a drop-in
parent replacement existed; Prismal accepted + documented because the
vulnerable signing path was not exercised; SUSE records won't-fix. Neither
removal ground holds for Bawa (no direct signing, no drop-in parent), and
no repo in the sample forks `ecdsa` or its parents for this CVE.

What was done (all four upgrades):

- New ADR `docs/adr/0008-ecdsa-residual-risk.md` (Status: Accepted), with
  the advisory, the OSV no-fixed-event fact, the upstream won't-fix quote,
  the reachability evidence, the alternatives considered and rejected, and
  the four flip conditions.
- `docs/SECURITY-FINDINGS.md` §1 updated: the acceptance is now a delegated
  decision (was a lane verdict with no owner acceptance on record); the
  load-vs-execute sentence added; review date 2027-05-20 recorded.
- Review date 2027-05-20 (or sooner if any flip condition is met): any
  Python signing path appears (including a future P-256 coin), `coincurve`
  is dropped from the lockfile, a fix version appears in OSV (then upgrade
  immediately), or `bip-utils` ships a build without the `ecdsa`
  requirement (then drop the pin).
- Fail-closed guard test `test/test_ecdsa_guard.py` (3 tests, passing):
  asserts `EccConf.USE_COINCURVE` is True, `coincurve==21.0.0` and
  `ecdsa==0.19.2` are pinned (not floating) in `requirements.lock`, and no
  file under `tools/` imports `ecdsa` or `nist256p1`. Wired into CI
  (`.github/workflows/ci.yml`: "Run ecdsa guard tests" step + log required).
  The OSV/pip-audit scan stays report-only — no ignore entry in
  `.osv-scanner.toml` (its own rule forbids silencing without evidence; the
  adjudication is the evidence).

## 2. confirmation-policy.ts — keep spec-only

**Decision: keep it spec-only; do not wire it into production.**

Evidence: `apps/web/src/engine/confirmation-policy.ts` is a pure,
provider-independent evaluator, tested 54/54 (vitest). But no caller can
supply a complete observation yet. `assessConfirmation` returns "unknown"
("Canonicality not established") unless `canonicalBlockHashAtInclusionHeight`
is a valid block hash matching the inclusion hash, and for ETH it also
requires a `finalized` flag. The tracker (the only plausible caller) has
confirmations, block height and block hash, but no canonical-block-hash
fetch and no ETH finalised flag (that needs an Ethereum consensus API).
Wiring it in with incomplete observations would make it return "unknown"
always — a dead integration that looks live, which is worse than spec-only.
The repo-study programme independently reached the same conclusion: it left
`confirmation-policy.ts` untouched ("pure-evaluator contract intact, no
production importer added"). The evaluator stays as a tested, documented
enforcement point for a future caller; the integration needs a live
observation path first (canonical hash fetch + ETH finalised flag), which is
a separate piece of work, not a wiring job.

## 3. main-adopt-fixes merge into main — merged as-is

**Decision: merge `df3dd25` into `main` as-is; do NOT wire
`assert_bundle_decrypts` into `main()` yet.**

What was done: `main` fast-forwarded 74ae078 → `df3dd25` (5 files, 194
insertions, 1 deletion: `docs/03-tools-and-repositories/README.md`,
`docs/08-security-recovery/README.md`, `requirements.txt`
(`mnemonic==0.21`, trezor/python-mnemonic, MIT), `test/test_make_wallet.py`,
`tools/make_wallet.py`). Main's gates verified after the merge (Python:
64 passed, 3 skipped, 101 subtests passed). Pushed via the PAT protocol and
verified by fresh ls-remote. `main-adopt-fixes` deleted from the remote
(fully contained in `main` after the merge). A leftover local worktree
`bawa-main-port/main-adopt-fixes` still exists on gray-pinee (from the
earlier main-port programme); the remote branch is gone.

Why not wire `assert_bundle_decrypts`: the function is written and tested
(`test_valid_mnemonic_passes`, `test_tampered_checksum_word_rejected`,
`test_missing_mnemonic_package_rejected` — all call it directly with a known
key), but `main()` does not have the data key. The generator displays the
seed phrase + data key on the controlling terminal only, never in the
captured stdout (which `main()` checks for seed material). Wiring it in
needs the data-key pipe ported from the panel branch — a separate,
security-sensitive functional change, not a trivial call. The function is
available for a future caller that has the data key; the wiring is an
unordered follow-up, recorded here, not done silently.

`adopt-proper` was NOT merged into main (not delegated, not ordered).

## 4. Delete multichain-create — yes, deleted

**Decision: delete `panel-rebuild/multichain-create` from the remote.**

Evidence: verified fully contained in `adopt-proper` (`git merge-base
--is-ancestor`, 0 unique commits). The owner authorised "do whatever of the
other file or branch". Deleted via the PAT protocol and verified by fresh
ls-remote: the remote now has 2 branches (`main` `df3dd25`,
`panel-rebuild/adopt-proper` `b20786b`) + 3 archival tags. (The
`panel-rebuild/repo-study` branch is local-only on gray-pinee at the time of
writing; it was pushed later by its own programme at `ee248a6` — its merge
into adopt-proper is a separate step, not delegated here.)

## 5. Live browser inspection of the merged adopt-proper build — order a fresh preview

**Decision: order a fresh preview of the merged adopt-proper build (after
`panel-rebuild/layout-makeover` merges into adopt-proper) and inspect it via
Orion's live browser; do NOT accept code-level verification alone.**

Rationale: the current preview serves `fix-preview-gaps`, not adopt-proper.
Code-level verification is not a substitute for a live browser inspection —
the 2026-11-20 inspection proved the point by contradicting a coordinator's
"defect does NOT reproduce" claim (SPA stale navigation, asset-detail
`(no-adapter)` failure, flaky balances, missing Popular chains strip). This
is a follow-up after the merge — it does not block this programme. The
preview + inspection happens on the merged tree (adopt-proper +
layout-makeover), not on `b20786b` alone.

## 6. Another fix round — yes, carried out here (Phase 3)

**Decision: yes.** The eight live-browser items from the 2026-11-20 ~18:53
IST inspection were fixed in Phase 3 of this programme and verified
(tsc 0, build 0, vitest 685 passed + 1 skipped, npm audit 0, root suite
clean, Python 119 passed). Per item:

- (a) SPA stale navigation: hot routes eager + `preloadRoute` on hover/focus
  (bottom nav, More menu, header, desktop sidebar) + lock-with-return-to.
  CDP A/B: BTC row click 9 ms, no chunk fetched (was 60 ms + chunk fetch).
- (b) Asset detail on direct load/reload: boot rehydration of public
  derived addresses + mount refresh + hydrating gate; Retry now retries
  (`fetchWithRetry`, 3 attempts, `Retry-After` capped 30 s).
- (c) Flaky dashboard balances: first paint is `loading` (not
  "unavailable"), last-good kept with a `stale` flag, 10-minute balances
  cache.
- (d) False "No wallet imported": union source of truth (vault addresses +
  xpub addresses).
- (e) `(no-adapter)` removed from all user-visible text via a central
  human-readable reason map; no raw reason reaches the UI.
- (f) Popular chains strip: added on Welcome and dashboard (Phase 2).
- (g) Hero blanking: all-or-nothing gates deleted; a failed chain
  contributes 0 and the total is marked partial.
- (h) TON 429s: serial gate around `rpc()` (~1100 ms from the previous
  attempt's start, covering the identity check and retries).

## 7. Vault lock removal — remove the lock; auto-unlock via a stored key

**Decision: remove the vault lock entirely; the vault stays unlocked once
a wallet is created or imported.**

Evidence: the owner ordered the lock removed (2026-11-20 ~22:39 IST) after
the live browser found the vault auto-locking in ~1 minute, not the stated
5 minutes. The lock (auto-lock timer + inactivity detection, lock state,
lock screen, manual lock) is deleted, not made optional.

What was done (Lane 1, state):

- `apps/web/src/wallet/vault.ts`: `isLocked()`, `lock()` and `unlock()`
  removed. New `autoUnlock(): Promise<boolean>` — reads the stored key +
  envelope, decrypts, puts the mnemonic/key in the closure; returns false
  (never throws) when there is no vault, no stored key, or decryption
  fails. `createVault()` also stores the derived key (raw bytes, base64,
  `bawa-vault-key`) alongside the envelope, so a later boot auto-unlocks;
  `deleteVault()` deletes the stored key too and clears the closure
  directly. `changePassword()` now takes only the new password (no old
  password to verify against — the mnemonic is already in the closure)
  and re-stores the newly derived key. `withMnemonic`/`withMnemonicAsync`
  now throw `Vault is not unlocked.` when no mnemonic is available.
  Kept: `hasVault()`, `vaultProfiles()`, `getSessionPassphrase()`, the
  envelope format, PBKDF2 600k, AES-GCM-256. `VAULT_WRONG_PASSWORD`
  removed with `unlock()` (no password check remains).
- `apps/web/src/state/wallet-context.tsx`: lock state, auto-lock timer,
  inactivity detection and the unlock flow removed. The context no longer
  exposes `isLocked`, `lock`, `unlock`, `unlockVault`, `lockVault`,
  `autoLockMinutes` or `setAutoLockMinutes`. `VaultState` is now
  `'no-vault' | 'unlocked'`. On mount the provider calls `autoUnlock()`.
  `refreshVaultAccounts()` re-derives only when the mnemonic is available
  AND the session passphrase is known (a passphrase wallet whose
  passphrase is unknown after a reload must not derive with `''` — that
  would produce and persist the wrong addresses; it falls back to the
  persisted public addresses instead). Balance/history/price refresh
  logic unchanged.
- Tests: lock-asserting tests removed or rewritten in
  `wallet/vault.test.ts` (22 tests, incl. new autoUnlock success /
  no-vault / no-key / wrong-key / tampered-ciphertext / corrupt-envelope
  cases and a key-stored-at-creation test) and the four state test files
  (17 tests). Deleted tests and why are recorded in a header comment in
  each test file. (The lock screen and `/security` copy are the UI lane's.)

SECURITY TRADEOFF (owner decision, recorded in `vault.ts` and here): the
raw vault key sits in localStorage next to the ciphertext it decrypts, so
anyone who can read this origin's localStorage can decrypt the vault
without the password. The mnemonic itself is still never stored in
plaintext, and the envelope stays AES-GCM-256 / PBKDF2 600k. This is the
standard "stay unlocked" pattern and the owner's explicit choice; the
vault must never be described as locked.

Known gaps (not fixed here, flagged to the coordinator):

- Legacy vaults: a vault created before this change has no stored key, so
  `autoUnlock()` returns false and signing is unavailable for it until
  the vault is deleted and recreated (or a one-time password migration is
  built). Balances still show from the persisted public addresses.
- Passphrase wallets: the session passphrase was never persisted, so a
  reload loses it. Derivation is blocked in `refreshVaultAccounts` until
  the passphrase is in the session again (set at creation/import) —
  deriving with `''` would produce and persist the wrong addresses.
  Persisted addresses keep balances visible after a reload, but the
  addresses cannot be re-derived, and the send path's behaviour with an
  unknown passphrase was not verified by this lane (send screen is the
  UI lane's scope).

## 8. Optional auto-lock — auto-lock returns as an optional setting, off by default

**Decision: auto-lock returns as an OPTIONAL setting, OFF by default, via
`AutoLockSetting` on /security (toggle + duration: Immediately / 1 / 5 / 15
minutes / 1 hour / 1 day).**

Evidence: the owner ordered the lock removed (2026-11-20 ~22:39 IST) after
the live browser found the vault auto-locking in ~1 minute, not the stated
5 minutes (section 7). A later order (2026-11-20 ~23:11 IST) supersedes it:
"Keep auto lock optional." The vault stays unlocked by default; it locks
only when the user enables auto-lock and picks a duration.

What was done (Lane D0, auto-lock):

- `apps/web/src/wallet/auto-lock.ts` (new): `AUTO_LOCK_OPTIONS = [0, 1, 5,
  15, 60, 1440]`, labels, `AUTO_LOCK_DEFAULT_MINUTES = 5`, keys
  `bawa-auto-lock-enabled` / `bawa-auto-lock-minutes`, read/write helpers,
  `autoLockDurationMs()` — the one minutes-to-ms conversion. Default OFF.
- `apps/web/src/wallet/vault.ts`: `isLocked()`, `lock()` and `unlock()`
  restored (`VAULT_WRONG_PASSWORD` back). Key-storage invariant enforced
  at `createVault`, `unlock` and `changePassword`: auto-lock ON means NO
  stored vault key (`bawa-vault-key` is deleted on enabling); auto-lock OFF
  means the derived key IS stored and the vault auto-unlocks. Disabling
  auto-lock stores the key when unlocked, or prompts for the password first
  when locked. `changePassword` deletes the stored key when auto-lock is ON
  (a stale old key otherwise survived). `storeCurrentKey()` /
  `deleteStoredKey()` / `hasStoredKey()`; `deleteVault()` deletes the stored
  key too.
- `apps/web/src/state/wallet-context.tsx`: `VaultState` is
  `'no-vault' | 'locked' | 'unlocked'` again. `computeVaultState()` /
  `computeBootVaultState()` ('unlocked' only with a stored key AND auto-lock
  off); `lockVault()` (clears addresses/balances/history) / `unlockVault()`;
  auto-lock settings state with invariant-correct toggling. Timer
  redesigned: one `setTimeout(lockVault, autoLockDurationMs(minutes))`,
  activity resets it, minutes 0 locks on `pagehide` / `visibilitychange`
  hidden, NO persisted deadline — the removed timer honoured a stored
  deadline across reloads, so an old deadline could fire minutes early
  despite the 5-minute setting, which likely caused the ~1-minute lock.
  The new timer always counts the FULL chosen duration from the last unlock
  or activity, in the live session only. A locked boot never rehydrates
  persisted addresses; `refreshVaultAccounts` restores them only when
  unlocked.
- `apps/web/src/screens/lock.tsx` (new, rebuilt in the D1 drawing style):
  the `/lock` screen returns, with lock return-to, password and passphrase
  fields, wrong-password alert, and 'Forgotten password? Restore wallet'
  → `/import-wallet`. The deleted lock tests are restored
  (`lock.test.tsx`, 9 tests).
- `apps/web/src/screens/security-settings.tsx`: the 'Vault stays unlocked'
  card is replaced by `<AutoLockSetting />` (toggle + duration + honest
  copy explaining both states), plus a Danger-zone delete-vault card with
  two-tap confirmation that works while locked. No copy claims the vault
  never locks.
- Locked-state UX: while locked, derived addresses are hidden; the
  dashboard hero shows 'Locked' plus 'Locked — unlock to see balances.';
  Popular chains show 'Locked'; send refuses to sign and links to `/lock`.
- Legacy vaults heal on their first unlock when auto-lock is off:
  `unlock()` stores the key, so later boots auto-unlock (section 7's
  legacy-vault gap is closed for this path).
- Tests: `auto-lock.test.ts` (31 tests), `vault.test.ts` (35 tests, incl.
  stored-key invariant tests), `lock.test.tsx` (9 tests),
  `auto-lock-setting.test.tsx` (9 tests), `security-settings.test.tsx`
  (5 tests), context auto-lock tests incl. the fake-timer suite and the
  real-time 1-minute timer test (see below).

Timer verification: the 1-minute timer was verified end-to-end by a
real-time test (D0-20b): the vault locked at ~60 real seconds (≥59 s
asserted, rejecting premature locking) and the stored key was absent.
The 5-minute path is reasoned from the same code (same timer function,
same duration parameter) but NOT verified — do not claim it works without
evidence.

SECURITY TRADEOFF (unchanged from section 7): with auto-lock off, the raw
vault key sits in localStorage next to the ciphertext it decrypts, so
anyone who can read this origin's localStorage can decrypt the vault
without the password. The mnemonic itself is still never stored in
plaintext, and the envelope stays AES-GCM-256 / PBKDF2 600k. With auto-lock
on, there is no stored key while locked, so the lock is real — unlocking
requires the password.

Known gaps (not fixed here, flagged to the coordinator):

- The 5-minute timer path is not verified end-to-end (see above).
- Passphrase wallets: the session passphrase is still never persisted, so
  a reload loses it; derivation stays blocked until the passphrase is in
  the session again (section 7's gap, unchanged).

## 9. Temporary devnet mode — test networks only, removable without touching mainnet

**Decision: a TEMPORARY devnet mode (owner order 2026-11-22 ~19:53 IST) lets
the wallet test send and receive on the four adapter chains' test networks.
Devnet is off by default, clearly marked in the UI and the code, and must
be removable without touching mainnet. It is NOT merged into adopt-proper
or main; it lives on `panel-rebuild/devnet-temp` only.**

Evidence: the owner's order — "add devnet temporary so we can test send
and receive function properly in the wallet and get some devnet token for
each chain yourself. And tell me how it went. Devnet will be temporary
for checking the wallet all the chains."

What was done (Lane C, hands-on Muse, 0 Sol calls):

- `apps/web/src/wallet/devnet.ts` (new): `DEVNET_ENABLED_KEY =
  'bawa-devnet-enabled'`, `readDevnetEnabled()` (default off) /
  `writeDevnetEnabled()`, plus the address re-encoding helpers (bech32
  BIP-173/350, base58check, TON testnet-flag variant with CRC16-XMODEM).
- `apps/web/src/wallet/devnet-endpoints.ts` (new, outside the generated
  block in `chains.ts`): `DEVNET_CHAIN_CONFIGS` — Bitcoin testnet4
  (mempool.space/testnet4, genesis
  `00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043`),
  Ethereum Sepolia (chainId 11155111, publicnode RPC, Blockscout
  history), TRON Nile (nile.trongrid.io, api.nileex.io fallback), TON
  testnet (testnet.toncenter.com). `DEVNET_NETWORK_IDS`,
  `isDevnetNetworkId()`, `chainConfigForDevnetNetwork()`,
  `devnetExplorerTxUrl()`, and the four devnet `broadcast()` closures
  (mempool `POST /tx`, viem `sendRawTransaction`, TronGrid
  `POST /wallet/broadcasttransaction`, TonCenter `sendBoc`).
- `apps/web/src/wallet/core.ts`: `deriveDevnetAddressesAt()` — BTC at
  `m/84'/1'/…` re-encoded `bc1q` → `tb1q`; TON testnet-flag variant;
  ETH/TRX reuse mainnet derivation. `DEFAULT_PATHS` / `pathFor`
  untouched.
- `apps/web/src/wallet/adapters/`: devnet factory overrides + a
  separate devnet registry (`registerDevnetAdapters()`,
  `getDevnetAdapter()`, `getAdapterForMode(chain, devnet)`,
  `registeredDevnetChains()`). Mainnet `registerAllAdapters` untouched.
  Devnet adapters accept testnet forms ONLY; mainnet adapters accept
  mainnet forms only.
- `apps/web/src/wallet/send.ts`: `SendDevnetOptions = { devnet? }`
  threaded through `validateRecipient`, `previewSendAmount`,
  `simulateSend`, `planBtcFee`, `signEthOffline` (Sepolia chainId),
  `signBtcOffline` (key path `m/84'/1'/0'/0/0`, tb1q → bc1q mapping
  for Wallet Core calls), `signTrxOffline`, `signTonOffline`. New
  `broadcastSignedDevnet(chain, signedTx, { devnet })`: asserts devnet
  mode on, provenance not test-provenance, and the adapter
  `networkId` is a devnet id — then calls the devnet adapter
  `broadcast()`. Mainnet `broadcastSigned` / every mainnet
  `broadcast()` still throw `BROADCAST_DISABLED_MESSAGE`.
- `apps/web/src/engine/destination.ts` + `engine/boundary.ts`:
  devnet-aware BTC/TON validation (`tb` HRP, base58 `0x6f`/`0xc4`,
  TON testnet flag). Watch-only stays mainnet-only, no tpub.
- `apps/web/src/wallet/tracker.ts` + `wallet/prices.ts` +
  `state/pending-broadcasts.ts`: tracker lookups take `{ devnet? }`
  (testnet explorers); `usePrices({ devnet? })` skips cached AND live
  mainnet prices in devnet mode; pending broadcasts recorded under a
  separate key `bawa-pending-broadcasts-devnet`.
- `apps/web/src/state/wallet-context.tsx`: `devnetEnabled` +
  `setDevnetEnabled()` (mirrors autoLock), `ensureDevnetAdapters()`,
  `devnetEnabledRef`; devnet addresses persist under
  `bawa-vault-addresses-devnet:v1`, never overwriting
  `bawa-vault-addresses:v1`; toggling off restores mainnet addresses.
- UI (`app/app.tsx`, `screens/network-selection.tsx`,
  `screens/devnet-setting.tsx` (new), `screens/welcome.tsx`,
  `screens/receive.tsx`, `screens/send.tsx`,
  `screens/send-review.tsx`, `screens/send-approval.ts`,
  `screens/track-transaction.tsx`, `screens/dashboard.tsx`,
  `screens/asset-list.tsx`, `screens/asset-detail.tsx`,
  `screens/chain-strip.tsx`): the header pill reads "Devnet — test
  mode" when on; the Networks screen gains the Devnet switch with
  temporary / test-only / valueless copy and per-chain devnet status;
  receive/welcome copy names the devnet per chain; the send flow gains
  stage `'broadcast-devnet'` (tx hash + testnet explorer link +
  "testnet tokens, no value" copy); the tracker screen and price
  displays pass the devnet flag. Mobile layout at 390/820 px is
  unchanged except the devnet switch/marker itself.
- Tests: devnet describes added to `wallet/devnet.test.ts`,
  `wallet/devnet-endpoints.test.ts`, `wallet/core.test.ts`,
  `wallet/adapters/devnet.test.ts`, `wallet/send.test.ts`,
  `engine/destination.test.ts`, `engine/boundary.test.ts`,
  `wallet/tracker.test.ts`, `wallet/prices.test.tsx`,
  `state/pending-broadcasts.test.ts`,
  `state/wallet-context.test.tsx`,
  `screens/devnet-setting.test.tsx` (new),
  `screens/network-selection.test.tsx` (new),
  `screens/track-transaction.test.tsx`, `screens/dashboard.test.tsx`,
  `app/app.test.tsx`, `wallet/chains.test.ts` (devnet ids live in the
  devnet module only; the mainnet registry guard is kept).
- CONSTRAINTS.md: exception E1 (owner 2026-11-22, expires 2027-02-20)
  carves devnet-only broadcast out of the "no broadcast path" floor;
  D2 records its trigger as met for devnet only. AGENTS.md §8 was NOT
  edited — the conflict between its DoD line and this programme is
  flagged in the Lane C report instead.

CONFLICT (flagged, not resolved by editing house rules): AGENTS.md §8
DoD and CONSTRAINTS.md both state "No broadcast path built or enabled
(standing owner order)". This programme's owner order explicitly
authorises a devnet-only broadcast path, so the work proceeded with
mainnet broadcast still throwing unconditionally, and the loosening is
recorded loudly (E1 + D2 + this section). The exception expires
2027-02-20; if devnet is still needed then, the owner must renew it.

Known gaps (not fixed here, flagged to the coordinator):

- BTC plan/sign with tb1q is proven only by unit test (synthetic
  UTXOs, no WASM chain verification): `signBtcOffline` devnet signs a
  tb1q spend in-test, but live proof with a funded testnet4 UTXO,
  broadcast and explorer confirmation stays with the testing lane.
  Never let a first testnet plan attempt run against the live app
  session — an uncaught WASM throw aborts the instance.
- The TON devnet `broadcast()` return shape (base64 message hash →
  hex tx hash) is an assumption from the TonCenter `sendBoc` docs,
  not a live observation; the testing lane must verify it.
- Sign functions always derive account 0 index 0, ignoring a
  non-default vault account selection (mainnet has the same
  behaviour; out of scope).

### Removal checklist — how to remove devnet mode later

Devnet is designed to delete cleanly. Work top-down; after each step
run `npx tsc --noEmit` and the full vitest suite in `apps/web`.

1. Delete `apps/web/src/wallet/devnet.ts`,
   `apps/web/src/wallet/devnet-endpoints.ts`,
   `apps/web/src/wallet/adapters/devnet.test.ts`,
   `apps/web/src/screens/devnet-setting.tsx` and its test.
2. In `apps/web/src/wallet/core.ts`: delete
   `deriveDevnetAddressesAt()` and its tests in `core.test.ts`.
3. In `apps/web/src/wallet/adapters/`: delete the devnet factory
   overrides and `registerDevnetAdapters()` / `getDevnetAdapter()` /
   `getAdapterForMode()` / `registeredDevnetChains()` in `index.ts`;
   restore `requireMainnet` naming if desired. Delete the devnet
   `broadcast()` closures.
4. In `apps/web/src/wallet/send.ts`: delete `broadcastSignedDevnet()`
   and the `SendDevnetOptions` parameter from every function; restore
   the mainnet-only call sites. Delete the devnet describe in
   `send.test.ts`.
5. In `apps/web/src/engine/destination.ts` and
   `engine/boundary.ts`: delete the devnet branches; restore the
   mainnet-only validators.
6. In `apps/web/src/wallet/tracker.ts`, `wallet/prices.ts` and
   `state/pending-broadcasts.ts`: delete the `{ devnet? }` options,
   the devnet parse variants, and the devnet pending-broadcast
   functions + key `bawa-pending-broadcasts-devnet`.
7. In `apps/web/src/state/wallet-context.tsx`: delete `devnetEnabled`
   / `setDevnetEnabled` / `ensureDevnetAdapters()` /
   `devnetEnabledRef` and the `bawa-vault-addresses-devnet:v1` key.
   Users' `bawa-devnet-enabled` flags and devnet address records
   become inert localStorage entries; delete them on next unlock if
   desired.
8. In the UI: delete the `DevnetSetting` card from
   `screens/network-selection.tsx` and restore the mainnet-only copy;
   restore the `Mainnet` pill in `app/app.tsx`, the `MAINNET` badge
   and copy in `screens/welcome.tsx`, the mainnet copy in
   `screens/receive.tsx`; delete the `'broadcast-devnet'` stage from
   `screens/send-approval.ts`, the devnet branch in `screens/send.tsx`
   and `screens/send-review.tsx`; drop the devnet flag from
   `screens/track-transaction.tsx` and the `usePrices({ devnet })`
   calls.
9. In `wallet/chains.test.ts`: delete the "keeps devnet network ids
   in the devnet module only" test.
10. In `CONSTRAINTS.md`: delete exception E1 and restore the D2 row
    to its pre-devnet text. In this file: mark this section REMOVED
    with the date. Verify `node scripts/generate-chains.mjs --check`,
    `scripts/check-wallet-cycles.mjs`, `npm run lint`, `npm audit`
    and the full gates still pass — the mainnet code paths must be
    byte-identical to before devnet was added.
11. In `apps/web/src/app/security-headers.ts` and
    `security-headers.test.ts`: delete the five TEMPORARY devnet
    `connect-src` origins (Sepolia RPC + Blockscout, Nile + Nileex,
    testnet TonCenter) and restore the six mainnet origins. Found by
    Lane D, 2026-11-22: without them the browser refuses every devnet
    fetch, so devnet mode was dead in the app until this fix.

## Coordinator calls made during the programme

- **Doc 4 scope (Phase 4):** kept Lane I's "Doc 4 — Mainnet" → "Mainnet"
  change. The brief named only "Doc 2"/"Doc 3", but "Doc 4" has the
  identical collision with the numbered scheme (`docs/04` is "Doc 04"); the
  same fix applied consistently, not scope creep.
- **README-FULL.md check-links (Phase 4):** exempted
  `docs/README-FULL.md` from `tools/check-links.py`. It is a
  verbatim-preserved frozen snapshot that must not be edited, so its
  internal links rot as files move; `docs/RENAME-MAP.md` records where the
  targets went. The exemption is a named list in the script (add a file
  only with a recorded reason). `check-links` now passes on 130 files.
- **Sidebar preload (Phase 3):** wired `preloadRoute` into the desktop
  sidebar as an optional `onPreloadRoute` prop (not a circular import from
  `app.tsx`). Verified by tsc + shell tests.
- **Hide-balance persistence:** yes (localStorage `bawa:hide-balance:v1`,
  Lane H). Lock does NOT delete the persisted address record (addresses are
  public on-chain identifiers; keys/mnemonic are never persisted).
- **Two strip implementations left separate:** Lane A's exported
  `PopularChainsStrip` in `welcome.tsx` vs Lane C's dashboard strip.
  Unifying two working strips is a nice-to-have, not a necessity.

## Token discovery (2026-11-22, branch panel-rebuild/token-discovery)

Owner order 2026-11-22 ~20:51 IST: the wallet showed only the 4 native
coins (BTC, ETH, TRX, TON). It now loads with 20 tokens by default — the
13 native coins plus USDC/USDT/DAI/LINK/UNI/WBTC on Ethereum and USDT on
TRON (contracts in `apps/web/src/wallet/tokens.ts`, all verified against
their upstream CoinGecko listings and Trust Wallet `info.json` names by
Lane 1) — and has a working "Add token" flow (add a chain from the 13
registry chains; add a token by contract address, ERC-20 or TRC-20).

Decisions:

- **Price-id traps fixed.** `PRICE_IDS` mapped Arbitrum → `arbitrum`
  and Optimism → `optimism` (governance-token prices, not native ETH);
  both now map to `ethereum`. `matic` mapped to `matic-network`, whose
  CoinGecko quote was last updated 2026-02-03 (stale — it would parse as
  expired forever); it now maps to `polygon-ecosystem-token`, the live
  POL listing (last updated 2026-11-22, $0.075427). Regression tests in
  `wallet/prices.test.tsx` and `wallet/token-prices.test.ts`.
- **Polygon RPC pin.** `https://polygon-bor-rpc.publicnode.com` only —
  `polygon-rpc.publicnode.com` returned empty twice (Lane 1) and is
  never pinned. The other eight new RPCs are Lane 1's live-verified
  endpoints (publicnode for the EVM chains, api.mainnet-beta.solana.com,
  litecoinspace.org, api.blockcypher.com for DOGE).
- **LTC second-source note.** Litecoinspace (pinned) vs BlockCypher
  disagreed by 627,083,939 sats on one address
  (`LYhttvnKawAv6RcHQ4eBkNtifuiEA99PFe`); the gap is explained by a
  block-3217536 payment of 626,114,459 sats plus 969,480 sats that
  BlockCypher's address-balance index had not yet folded in (its chain
  height matched the tip, and it knew the transaction). The pinned
  source reconciles to chain tip and transaction data; the LTC balance
  is verified with this documented lag note.
- **Token balances are screen-driven, not boot-wired.** `refreshTokenBalances`
  runs when the asset rows mount (and when vault addresses change), like
  the price hooks — not in the provider boot effect. The provider tests
  derive real vault addresses, and a boot-wired token refresh would fire
  live RPC calls from unit tests.
- **Hero total stays native-only.** `portfolioTotal` takes an optional
  `chains` parameter (defaults to all 13); the dashboard passes
  `availableFor('balance')`. Token fiat values show on their rows, not
  in the hero total.
- **Fee-quote (new EVM chains) and LTC history stay blocked in
  capabilities** despite being implemented and unit-tested — no live
  cross-check yet. Never faked; `registry/capabilities.json` flips only
  `balance` to IMPLEMENTED_AND_VERIFIED for the 9 chains.
- **Add Token dialog uses a native `<select>`** for the chain picker,
  not Radix Select: no screen uses Radix Select, the native select is
  the auto-lock-setting precedent, and it is fully keyboard-accessible
  and drivable in the repo's raw-DOM test harness.
- **Duplicate pre-check covers the custom list only** in the dialog
  (adding a default token runs verification first); the context's
  `addCustomToken` additionally rejects defaults at the persistence
  boundary, and the dialog surfaces that error.
- **Logos:** Trust Wallet assets pinned at
  `e8f61783ac6451fa8b7b1b4f72bf4a9607f6872e`; BSC from
  `blockchains/smartchain` (not `binance`), Avalanche from
  `blockchains/avalanchec`, Dogecoin from `blockchains/doge`.
- **Trust Wallet logo files:** original PNGs kept as canonical sources;
  96 px WebP at quality 85 for display (39,670 bytes total vs 303,787
  PNG, -87%).
- **`/networks` is registry-driven** with an enable/disable toggle per
  chain. A disabled chain's rows are hidden; its derived addresses stay
  in the vault, so re-enabling restores them.
- **Token history is honestly unavailable.** The token detail route
  (`/assets/:chain/:token`) shows "Transaction history is not connected
  for this token yet" — no token-history adapter exists, and no list is
  fabricated. Token Send is hidden (no token send exists); Receive
  stays (the token's receive address is the chain address).
- **Bundle budget: raw `eth_call`, no viem `readContract`.** The first
  build totalled 4,051,685 bytes vs the 4,040,000 budget. The cause was
  measured, not guessed: `token-balances.ts` used viem `readContract`,
  whose `call` action pulls viem's ABI coder + CCIP machinery into the
  shared chunks (a 152,006-byte `retry` chunk; the baseline `eth.ts`
  never used `readContract` — it uses raw `transport.request`). The EVM
  token path was rewritten to raw JSON-RPC `eth_call` / `eth_getCode` /
  `eth_chainId` over a minimal `EvmRpcClient` (plain fetch on
  `httpFetchTransport`, 10 s timeout), with hand-encoded calldata and
  the repo's own ABI decoders (`decodeAbiString` gained a bytes32
  fallback for older tokens like MKR). That collapsed the `retry`
  chunk to 1,879 bytes. The Add Token dialog also dynamically imports
  `token-balances` at submit time (saved only 2,583 bytes — the static
  import was not the main cause). Final total 4,050,102 — still over
  the nominal budget by 10,102 bytes (0.25%). The remaining growth vs
  the true 67c48e2 baseline (3,978,773, built in /tmp/bawa-baseline)
  is Radix Dialog's first use (~30–50 KB, previously tree-shaken out),
  keccak's first use (~13 KB, via `isAddress`/`getAddress`), and ~20 KB
  of genuinely new code; no duplication was found. CONSTRAINTS.md line
  53 still records a stale baseline (3,846,651), so its +5% ratchet
  intent is 4,177,711 and this build (+1.8% over baseline) is inside
  it. CONSTRAINTS.md was NOT edited — weakening the bar to pass is
  forbidden. Flagged for the coordinator / Lane 3: either refresh the
  stale baseline measurement (a factual correction; the +5% rule
  stays) or explicitly accept the 0.25% nominal overage. Largest chunk
  `boundary` 2,901,695 is under its 3,050,000 budget.
- **Chain list source in the Add Token dialog.** The dialog lists
  chains from `availableFor('derive')`, not `SUPPORTED_CHAINS`: the
  dashboard and asset-list tests factory-mock `../wallet/chains`
  with only `availableFor` + `chainConfig`, so importing
  `SUPPORTED_CHAINS` broke those tests at module load even though the
  dialog never opens there. `availableFor('derive')` is all 13 chains
  in production. Same constraint forced the token rows to be filtered
  by `availableFor('balance')` (otherwise the mocked empty list still
  rendered 7 loading token rows instead of the empty state), and the
  Popular chains strip to pin its 4 chains instead of deriving them
  from `availableFor('balance')` (which now returns all 13).
- **Solana's pinned RPC 403s browser requests (2026-11-22).** The
  Solana adapter is correct and unit-tested, and
  `api.mainnet-beta.solana.com` answers 200 from node — but from a
  real browser (Origin + Chrome UA) it answers 403 "Access forbidden",
  so the SOL row honestly shows "Could not load balance" + Retry in
  the browser while its price still loads. The alternates were probed
  from the browser too and are worse: `solana-rpc.publicnode.com`
  works from node (200) but the in-page fetch throws (CORS preflight
  failure), `1rpc.io/sol` answers 400 "unknown network" from node,
  and `rpc.ankr.com/solana` answers 403 "API key is not allowed"
  from node. No free Solana RPC works from the browser, so the pin
  stays on the canonical endpoint and the failure stays honest — no
  balance is faked. Consequence: E2E-03 asserts settled rows
  (zero + failed == 20, at least 19 zeros) instead of an exact 20,
  and the add-chain E2E asserts the Solana row rather than a link
  (failed/loading rows are not links, by the pre-existing row
  pattern). If a keyed Solana RPC is ever configured, the pin and
  the E2E expectations should be revisited.
- **E2E port collision (2026-11-22).** The first E2E run hit a stale
  preview server on 127.0.0.1:4193 left over from the parallel devnet
  programme (cwd `bawa-devnet-temp-worktree`, serving the devnet
  dist — recognisable by its `devnet-*.js` chunk). Playwright reused
  the occupied port, so 4 tests failed against the wrong app (no "Add
  token" button, 5 "Zero balance" rows instead of 20). The stale
  server was killed by explicit PID (425863) and the suite re-run
  against this branch's own dist. Lesson: check `ss -ltn` / the
  serving process cwd before trusting an E2E failure on a shared VM.
- **Root `npm test` / Python suite baselining (2026-11-22).** Root
  `npm test` first failed with MODULE_NOT_FOUND
  (`@trustwallet/wallet-core`) — identical on untouched 67c48e2,
  because neither worktree had `tools/hdwallet-gen/node_modules`
  installed. After `npm ci` in `tools/hdwallet-gen` it passes on the
  branch (exit 0). The Python suite first failed identically on
  branch and baseline (make_wallet 20 errors, decrypt_seed 5
  failures + 3 errors) — missing `bip_utils` / `mnemonic` packages in
  system Python. With an isolated venv
  (`/tmp/lane2-venv`, `bip_utils` + `cryptography` + `mnemonic`
  installed) both suites pass on the branch: make_wallet 89/89,
  decrypt_seed 30/30. No repo code was changed for any of this.
- **Token discovery Lane 3 verification - bundle baseline correction + manifest port (2026-11-22).** Lane 3 rebuilt adopt-proper 67c48e2 from clean (npm run build) and measured total JS 3,978,773 bytes, largest chunk (boundary) 2,901,695 bytes - byte-identical to Lane 2's independent build. The CONSTRAINTS.md baseline 3,846,651 was measured 2026-11-20 on the repo-study tree (0fd3a2e), not on the adopt-proper base, so it was stale. Factual correction only: the +5% ratchet rule is unchanged, the total cap moves 4,040,000 to 4,177,711, and the branch build (4,050,102) is inside it. The largest-chunk budget 3,050,000 is unchanged (2,901,695 x 1.05 = 3,046,780, still under it). PERF.md records the re-measurement with its history kept. Separately, e2e/manifest.json said the preview serves on 4173 while the Playwright config deliberately serves on 4193 (4173 is Vite's default and is held by another lane on this shared VM); the manifest now says 4193.
- **Token gaps, items 1–10 + Base USDC #21 (2026-11-22, branch panel-rebuild/token-gaps, Lane 2 IMPLEMENT, hands-on Muse, 0 Sol calls).** SOL balances: `solana-rpc.publicnode.com` primary, `public.rpc.solanavibestation.com` fallback (both verified in-page 200 by Lane 1: 2368210 lamports for 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM); `api.mainnet-beta.solana.com` retired (in-page 403 re-confirmed). DOGE balances: SoChain `https://sochain.com/api/v3/balance/DOGE/{address}` primary (confirmed 10007.79125175 DOGE for the fixture address DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K), BlockCypher fallback. CSP pinned to 17 origins (added publicnode, Vibe Station, sochain.com; dropped mainnet-beta). Verified tick rule: verified = in-repo DEFAULT_TOKENS OR the record's coingeckoId resolved from CoinGecko's contract endpoint for that exact chain+contract at add time; raw-contract user-added tokens get no tick. Short contract = first 6 + `…` + last 4. Payment URIs: BIP-21, EIP-681 with @chainId (+ transfer for ERC-20), Solana Pay, TON `ton://transfer`; TRON has no generic payment-URI standard, so no `tron:` URI is invented — TRX/TRC-20 QRs stay address-only with amount as text and the shareable Bawa `/send` web link carries amount+address. Base USDC #21: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 6 decimals, CoinGecko usd-coin (verified from CoinGecko + Lane 1). Portfolio hero: partial $0.00 when everything loaded is zero and a chain failed; 'unavailable' only when nothing loaded at all. E2E-03 updated to 21 rows (13 natives + 8 default tokens); the >= 18 zero floor is unchanged pending CDP evidence. No merge, no push.
- **Token gaps, item 8 bug hunt round 2 — watch-only hydration + 15-word import gate (2026-11-22, same branch).** (1) Watch-only hydration covered only 4 of 13 chains: `state/wallet-context.tsx` defined a local `CHAINS = ['btc','eth','trx','ton']` that the boot hydration effect iterated, so a stored watch-only wallet for SOL (or any other non-original chain) was persisted but dropped on every reload — Wallets showed "No wallets imported" and the Assets row stayed "Balance unavailable" until re-added. The `addXpub` balance-refresh fix was correct but wiped by the remount (`page.goto` reloads; in-app SPA navigation kept the in-memory state, so a real user hit this only on reload/fresh visit). Fix: hydration + cleanup iterate `ALL_CHAIN_IDS` (13); RED-first test seeds localStorage before mount and asserts xpubs.sol restored + balance 2368210. (2) Import rejected valid 15-word mnemonics: the submit gate accepted only 12 or 24 words, but the repo's own published test vector is 15 words (docs/mainnet/MAINNET-VECTORS.md) and BIP-39 allows 12/15/18/21/24. Fix: gate accepts all five counts; helper/placeholder/error copy updated; RED-first test restores the 15-word vector to the preview step. No merge, no push.

## 10. UI/UX Fixes programme — 21 items, merged into token-gaps (2026-11-23)

**Decision: the 21-item UI/UX Fixes programme (owner order 2026-11-23
~04:40 IST) is complete and merged into `panel-rebuild/token-gaps`.**
Branch `panel-rebuild/ui-ux-fixes` (`68fd75b`, branched from token-gaps
`488f644`, devnet mode brought in from `panel-rebuild/devnet-temp`
`8994584`) was merged into token-gaps by Lane E (hands-on Muse, 0 Sol
calls) as merge commit `4eb0242`. Merge destination per the owner's
decision 2026-11-23 ~05:11 IST: further work continues on top of
token-gaps. No code merged into `panel-rebuild/adopt-proper` or `main`.

Gates on the merged tree, first-hand (Node 22.23.4, `apps/web`): `npx
tsc --noEmit` 0; `npm run build` 0; full vitest 86 files, 1644 passed /
5 skipped; `npm run lint` 0; `npm audit` 0 vulnerabilities; root `npm
test` 0 (after `npm ci` in `tools/hdwallet-gen` — the first attempt in
the fresh worktree failed only on absent `node_modules`, not on code).
CDP re-verification at 1919/1440/820/390 was done by the coordinator on
`ui-ux-fixes` before the merge and passed; Lane E did not re-run CDP.

Item 21 (document everything): `docs/UI-UX-FIXES-PROGRAMME.md` is the
programme record (all 21 items, gates, branch state, preview/Pages
pointers, still-open list). Doc-only updates were pushed to `main` and
the active remote branches (`adopt-proper`, `desktop-layout-v2`,
`devnet-temp`, `token-discovery`, `token-gaps`, `ui-ux-fixes`) on
2026-11-23 per the owner's order. Dead local-only lane branches were
left alone (superseded intermediates, not on the remote).

Still open after the programme: E2E-03/06 need a stable-network run;
non-zero DOGE watch-row render unproven; 1919 settled widths not
captured; TON Issue 5 (first-send state init) and Issue 6 (`/track`
message hash) in `DEVNET-ISSUES.md`; devnet exception E1 expires
2027-02-20; the mobile Receive 40 px question was decided 2026-11-23
~14:17 IST (owner: keep the fix — do not re-ask; the fix itself was
restored to the token-gaps tree by reverify lane 1, see
`docs/REVERIFY-CHECKLIST.md` item R-14); the item-14 cannot-add chain
list is now recorded in `docs/UI-UX-FIXES-PROGRAMME.md` (reverify lane
1, item R-16).

## 11. UI/UX Round 2 programme — 10 items, merged into token-gaps (2026-11-23)

**Decision: the 10-item UI/UX Round 2 programme (owner order 2026-11-23
~15:28 IST) is complete and merged into `panel-rebuild/token-gaps`.**
Branch `panel-rebuild/ui-ux-round2` (`5da29a8`, branched from token-gaps
`231ecbf`) was merged into token-gaps by Lane E (hands-on Muse, 0 Sol
calls) as merge commit `6147b74`. Merge destination per the owner's
standing decision: further work continues on top of token-gaps. No code
merged into `panel-rebuild/adopt-proper` or `main`.

Gates on the merged tree, first-hand (Node 22.23.4, `apps/web`): `npx
tsc --noEmit` 0; `npm run build` 0; full vitest 89 files, 1697 passed /
5 skipped; `npm run lint` 0; `npm audit` 0 vulnerabilities; root `npm
test` 0 (after `npm ci` in `tools/hdwallet-gen`). CDP re-verification
of the merged tree passed per item (Lane E). E2E: 2 specs failed
(`item4-qr-share`, `send-disabled`) because `vite preview` 404s
`/bawa/assets/*.js` under the new `base: '/bawa/'` — a harness problem,
not round-2 code; it needs a decision.

Decisions taken in the programme:

- **Devnet prices.** The fetch gate is lifted: both price hooks fetch
  and cache in devnet exactly as on mainnet, because prices are public
  market data for the native asset or token and a testnet BTC balance
  is still priced per BTC. Fiat valuation of test balances stays
  suppressed at the display layer, so a funded test wallet never
  shows an invented dollar value. Do not regress either half.
- **Font.** Baloo 2 replaces Caveat as the display face. Caveat, a
  handwriting script, was hard to read at mobile sizes, worst on the
  recovery phrase itself, where misreading one word loses the wallet.
  Baloo 2 keeps the rounded, friendly character without the legibility
  cost, and it is self-hosted. Inter stays the body font.
- **Copy.** Main titles and descriptions are plain human en-GB.
  Em dashes joining two sentences became full stops, trailing
  pile-ons were cut, redundant paragraphs went. Security-meaning lines
  kept every fact. Error and toast strings were left alone: their dash
  is a cause-to-remedy separator, not an AI tell.
- **Deep links.** A shared send link is kept while the wallet is
  locked or missing, the panels name the pending payment, and the
  create-wallet ready screen offers a way back to the send. With more
  than one vault account a chooser appears. The link keeps the
  `/bawa/` subpath, and the router carries the matching basename.
  `apps/web/vite.config.ts` is byte-identical to
  `panel-rebuild/pages-base` (`cd39306`).
- **QR card.** The Receive QR is a card (QR, amount, address, token
  plus chain with both logos), and the card itself is the shared
  image. Scanning a payment QR auto-selects chain, token, amount and
  address.
- **Mobile.** Inputs are 16 px on coarse pointers so iOS Safari does
  not zoom on focus. The viewport meta carries `viewport-fit=cover`.
  Send is chain, token, address plus amount, review, sign, result;
  Receive is network grid, token, amount plus QR. Picker steps fit a
  390 by 844 viewport with no scroll.
- **Watch wallet.** The horizontal chain sliding is gone: a search
  bar shows all chains on click, with picked chains in a Recent row
  below it.

Item 10 (document everything): `docs/UI-UX-ROUND2-PROGRAMME.md` is the
programme record (all 10 items, gates, branch state, preview/Pages
pointers, still-open list). Doc-only updates were pushed to `main` and
the active remote branches (`adopt-proper`, `desktop-layout-v2`,
`devnet-temp`, `token-discovery`, `token-gaps`, `ui-ux-round2`) on
2026-11-23 per the owner's order. Dead local-only lane branches were
left alone (superseded intermediates, not on the remote).

Still open after the programme: the E2E harness versus `base:
'/bawa/'` needs a decision; the camera path is unverified on a real
device (items 1 and 9); the Receive tagline removed in item 8; the
token contract tail truncated on one-line rows; review and sign steps
not CDP-verified; CoinGecko 429s on the shared VM IP; the word grid at
1024 px is tight; the import path now has a "Continue to your send"
button on the restored screen (reverify lane 1, 2026-11-23, see
`docs/REVERIFY-CHECKLIST.md` item R-15); external wallet apps not
tested for deep links; the mobile Receive 40 px question was decided
2026-11-23 ~14:17 IST (owner: keep the fix — do not re-ask; the fix
itself was restored to the token-gaps tree by reverify lane 1, see
`docs/REVERIFY-CHECKLIST.md` item R-14); devnet exception
E1 expires 2027-02-20; TON Issues 5 and 6 in `DEVNET-ISSUES.md`.

## 12. Reverify + Professional Polish programme — 5 lanes, merged into token-gaps (2026-11-23)

Owner order 2026-11-23 ~18:14 IST. Branch
`panel-rebuild/reverify-pro` from token-gaps `b089c28`; fast-forwarded
into `panel-rebuild/token-gaps` to `ccb8195` on 2026-11-23. Doc-only
updates pushed the same day to `main` (`e64679e`),
`panel-rebuild/adopt-proper` (`d0aa6ba`),
`panel-rebuild/desktop-layout-v2` (`df6e54d`),
`panel-rebuild/devnet-temp` (`bd4bdd4`) and
`panel-rebuild/token-discovery` (`81994e8`). Full record: `docs/REVERIFY-PROGRAMME.md`;
checklist: `docs/REVERIFY-CHECKLIST.md`. Hands-on Muse, 0 Sol calls.

- **Vitest baseline corrected.** The Round 2 record says 89 files /
  1697 passed / 5 skipped on tip `b089c28`. Four independent
  first-hand runs on that tip (merge lane plus lanes 1, 3 and 4)
  measure 90 files / 1718 passed / 5 skipped. The Round 2 figure
  does not reproduce; its cause was not established. The merged
  reverify tree measures 1722 passed / 5 skipped — baseline 1718
  plus Lane 1's 4 new tests, exactly. The Round 2 record itself was
  left as written; the correction lives here and in the programme
  record.
- **Lane 3 discrepancies, recorded not resolved.** (1) SOL/LTC/DOGE
  history: `chains.ts` records history verified,
  `registry/capabilities.json` records it NOT_SUPPORTED for all 18
  additional chains — which source is right needs re-verification.
  (2) Vitest count, see above. (3) ADR-0007's 2026-11-20 amendment
  says 12 unique CoinGecko ids for the original 13 chains; the
  current `prices.ts` map yields 10 for those 13. The 2026-11-23
  amendment states the current verified map (15 unique for 22); the
  old amendment was left as written.
- **Reference-repo link still missing.** The owner never named the
  repo or attached a link for the README showcase. No layout from it
  was used or invented.
- **Hygiene scan (merge lane, `repo-hygiene-scan` skill, tools run
  first-hand).** Madge: no circular dependency. Ts-prune/knip:
  nothing deleted — the only genuinely unreferenced export is
  `registerLookupHandler` (designed extension point, kept), and the
  unused files are all false positives. Knip lists 8 unused
  dependencies (7 `@radix-ui/*` plus `react-hook-form`, orphaned by
  Lane 4's deletions); `package.json` cleanup is a separate change.
  Jscpd: 78 production-production clone groups; largest are the
  btc/ltc adapters, prices/token-prices, asset-list/dashboard and
  three BTC pairs in `send.ts`. Consolidation candidates for a
  future lane.
- **`send.ts` / `core.ts` split and `wallet-refresh.ts` re-wire stay
  open** (Lane 4, with evidence in its report): the split touches
  the secret-handling path, and the re-wire would change refresh
  behaviour for 18 chains, devnet mode, caching and the
  stale/refreshing flags. Neither is polish work.
- **Unwired modules stay:** `engine/destination.ts`,
  `wallet/adapters/confirmation.ts`, `wallet/evm-typed-data.ts`,
  `wallet/secret-handoff.ts` — wire them, or delete them by explicit
  decision.
- **Merge decisions.** The Lane 2 / Lane 3 README conflict was
  resolved by keeping Lane 2's canonical Screenshots section; Lane
  3's follow-up commit was skipped because its content was already
  in the tree from that resolution. Nothing from any lane was
  dropped.

## 13. Deep Audit + Devnet E2E programme — 5 lanes, merged into token-gaps (2026-11-23)

**Decision: the 5-lane Deep Audit + Devnet E2E programme (owner order
2026-11-23 ~18:10 IST) is complete and merged into
`panel-rebuild/token-gaps`.** Branch `panel-rebuild/deep-audit-devnet`
(branched from token-gaps `b089c28`, devnet mode brought in from
`panel-rebuild/devnet-temp` `21f4726`, reverify-pro's token-gaps tip
`71326e1` merged in) was merged into token-gaps by the coordinator
(hands-on Muse, 0 Sol calls). No code merged into adopt-proper or
main. Full record: `docs/DEEP-AUDIT-DEVNET-PROGRAMME.md`;
`docs/GAP-ANALYSIS.md` (24 gaps, repos checked live).

Decisions and findings recorded here:

- **HD wallet verified; bot xpub export added.** All 22 chains match
  both independent oracles (Python bip_utils + Wallet Core 4.9.3)
  at indexes 0/1/2/5. There was no xpub export at all before this
  programme; the wallet now exposes per-chain account public keys
  on demand for the owner's bot (BTC zpub `m/84'/0'/0'`, LTC Ltub
  `m/84'/2'/0'`, DOGE dpub `m/44'/3'/0'`, TRX + all EVM xpub
  `m/44'/60'/0'`; TON/SOL one address per wallet). The bot use
  case is YES for 20 chains. DOGE dpub is now accepted on import
  (Wallet Core emits dpub; import only allowed dgub, so the wallet
  rejected its own export). LTC zpub stays rejected — it is BTC's
  version prefix, intentionally. SOL multi-address and TON
  one-address are by design (owner decisions to confirm as final);
  the bot must use shared `m/44'/60'` for CELO, not SLIP-44 527.
- **Lane A (FINISH THE PRODUCT, 2026-11-23) — the four "confirm as
  final" derivation items are FIXED, not confirmed.** Hands-on Muse,
  0 Sol calls. (1) SOL multi-address: account 0 index 0 keeps
  `m/44'/501'/0'` byte-identical, so existing users' addresses do not
  move; new accounts use `m/44'/501'/<account>'/0'` (the Phantom
  template already recorded in `SOLANA_PROFILES`) and rotations
  `m/44'/501'/<account>'/0'/<index>'`. (2) TON second address: the
  same scheme — (0,0) keeps `m/44'/607'/0'`, accounts
  `m/44'/607'/<account>'` (Tonkeeper template), rotations
  `m/44'/607'/<account>'/<index>'`; a second key gives a distinct
  V4R2 wallet contract (same code hash, wallet ID 698983191), so the
  one-address limit was a Wallet Core default-path convention, not a
  protocol limit. `signTonOffline` now signs from the selected
  account's key (`options.account`, default 0). (3) CELO: derivation,
  export and the bot agreement already used the shared `m/44'/60'`
  at the programme base; pinned by regression tests (CELO == ETH
  addresses at (0,0)/(0,1)/(1,0), CELO xpub == ETH xpub,
  export/import round-trip). (4) LTC zpub accepted alongside Ltub:
  the version prefix alone cannot tell a BTC zpub from an LTC zpub,
  so the chain chosen at import is the disambiguator — the same
  accepted semantics as the `0488b21e` xpub shared by BTC/ETH/TRX.
  This supersedes the "LTC zpub stays rejected" line above and the
  GAP-ANALYSIS §15 rejection. Oracle proof: Python bip_utils 2.13.0
  + Wallet Core 4.9.3 (`apps/web/src/wallet/lane-a-derivation.test.ts`,
  14 tests; full suite 1758 passed / 5 skipped). CDP proof: SOL
  rotation changes the Receive address; /wallets shows CELO
  `m/44'/60'/0'` with an xpub identical to ETH's; the
  ripple-fixture LTC zpub imports as a watch-only LTC wallet.
- **Devnet Issue 5 CLOSED with live proof.** The TON first-send
  state init IS present in the app-signed BOC (code hash
  `feb5ff68...`, V4R2, init address == wallet C's address exactly;
  TonViewer tx `4f35a862...fe4a42c0`, contract deploy, C uninit to
  active). The 2026-11-22 missing-init inference was wrong (that
  decode was of a garbage-seqno BOC). At seqno 0 Wallet Core
  4.9.3 sets valid_until to UINT32_MAX, so the first-send message
  is deterministic and never expires. The vendored-BOC-builder fix
  sketch is not needed.
- **Devnet Issue 6 FIXED in place.** `/track` resolves TON message
  hashes (0x-prefixed and base64 `in_msg.hash`); the exact landed
  A to B tx was returned in CDP.
- **Devnet faucets still 0 tokens (Issue 7).** Retried 2026-11-23:
  pk910 IP block is gone, new block `[INVALID_CAPTCHA]`; nileex
  Turnstile never completes; coinfaucet.eu hCaptcha; ZalalenA
  Turnstile gate never clears. Owner action: complete the captchas
  in their own browser with the wallet-A addresses. BTC/ETH/TRX
  stay NOT PROVEN on devnet until then.
- **Watch-only rejects devnet TON addresses (new finding).** A
  deliberate boundary (`validateWatchOnlyImport` /
  `deriveAddress` call `validateTonAddress` with no devnet
  option). Not fixed in this programme — threading devnet through
  validation, derivation and balance adapters is multi-site with
  mainnet safety implications and overrides a recorded deliberate
  decision. Needs an owner decision; fix sketch in the Lane B
  report; recorded as gap 21 in `docs/GAP-ANALYSIS.md`.
- **E2E harness fixed (ADR-0011).** Root-base `build:e2e` +
  `preview:e2e`; CI e2e job builds with `build:e2e`; Playwright
  config reads `E2E_PORT` (default 4193) so a shared machine
  cannot silently test another lane's build. Pages build untouched.
- **Re-verification:** nearly all Round 2 and showcase claims
  HOLD in CDP. One regression found and partially fixed (Send
  chain scroll 936 back to 844; Receive details 1446 to 1390;
  Share/Copy link/Download still need ~40–90 px scroll — owner
  decision: smaller buttons or top-stack rework). The hard-coded
  "Account 01" header now follows the selected account. Fantom
  price always "Price expired" (CoinGecko quote ~6.2 h stale vs
  the 10-min window — owner decision). DOGE has no working browser
  fallback when SoChain is rate-limited (owner decision on a
  second CORS-friendly source). Refresh-burst duplicates and the
  429 retry storm are measured and handed to the gap analysis
  (gap 5).
- **Merge notes.** The programme branch merged devnet-temp in
  first (1 DECISIONS.md conflict: devnet side added nothing in
  that hunk), then reverify-pro's token-gaps tip `71326e1` (clean).
  Lane cherry-picks were all clean except Lane E's
  `docs/index.md` (kept reverify-pro's two entries plus the
  gap-analysis entry). Lane A's and Lane C's header fixes composed
  (both headers now use `accountName(vaultAccount.account)`).
## 14. Marketing Fix + Found-Bugs programme — 8 lanes, merged into token-gaps (2026-11-23)

Owner order 2026-11-23 ~19:14 IST, from two phone screenshots (mobile `$0.00
(Partial)`; desktop `Ethereum history unavailable` + Retry): the screenshots look
bad, the Retry button should not be there, the mobile balance should not say
Partial. Hands-on Muse, 0 Sol calls. Branch `panel-rebuild/marketing-fix` from
`71326e1`, rebased onto `e290654` after the deep-audit programme merged into
token-gaps first; merged into token-gaps as `571f0fb` (merged tree
byte-identical to the verified `a8018fd` tree).

- **Lane 1 (first-impression defects).** Reproduced both screenshots on
  baseline first (burst ~230 requests, 36 failed). Partial: shared refresh
  limiter, cap 4 concurrent calls; all-loaded-zero returns the zero state —
  clean `$0.00` + quiet note. Retry: history Retry only when the wallet/chain
  has activity; a fresh wallet shows "No activity yet". Indexer gap recorded
  (keyed/paid indexer or owner-hosted Blockscout is an owner decision).
  Residual: one Retry remains — the Dogecoin row (sochain 429s every attempt,
  BlockCypher CORS-blocked).
- **Lane 2 (found bugs).** 8 unused deps removed (knip 0). jscpd 78 groups /
  1,332 lines → 15 / 183 (63 consolidated, 1,149 lines removed). send.ts/core.ts
  split DONE (`wallet/signing-intent.ts`). wallet-refresh re-wire PROVED
  infeasible without behaviour change (6 reasons in the lane report) — decision
  needed: redesign, keep as tested-but-unused, or delete. D-02 DONE: /lock
  double `<main>` fixed; "Lock now" button added to AutoLockSetting.
- **Lane 3 (marketing view).** Welcome wallet-first (Create card next to
  Import), one 22-chain Create card, factual hero tagline, Send step 1 matches
  its banner. `docs/VALUE-PROPOSITION.md` — every claim verified against code.
- **Lane 4 (README rewrite).** 256 → 180 lines, mined MetaMask / Trust Wallet /
  BlueWallet / RainbowKit / shadcn-ui READMEs; 4 screenshots re-shot clean on
  the fixed build. Reference-repo link never arrived — nothing invented.
- **Lane 5 (Mermaid diagram).** `docs/HOW-IT-WORKS.md`: two 8-node Mermaid
  flowcharts (how it starts / what it does), render-validated, all 49 cited
  paths exist. Trade-off stated: GitHub mobile app shows Mermaid as raw code.
- **Lane 6 (branch cleanup).** Remote 13 -> 9 branches: deleted ui-ux-round2,
  reverify-pro, readme-showcase-token, deep-audit-devnet (all verified
  ancestors of token-gaps `571f0fb`). Kept: token-discovery and ui-ux-fixes
  (not ancestors - post-merge doc-only commits with unique content),
  desktop-layout-v2 and devnet-temp (unique unmerged work), marketing-fix
  (programme branch), main, adopt-proper, token-gaps, gh-pages. Local 59 -> 56
  branches; the rest are pinned by checked-out worktrees and need a
  worktree-removal pass (finish-product Lane E). Full lists in
  `docs/MARKETING-FIX-PROGRAMME.md`.
- **Lane 7 (QR templates, owner correction).** The owner was right: templates
  were not visible as asked (Receive opened on the network picker; alternates
  40 px, below the fold, unlabelled; Payment request a disabled grey box;
  shown template unnamed). Fixed in place: 64 px small QRs + heading naming
  the shown template, amount inside the card, Payment-unavailable explained,
  selected template clamped to one with a value. CDP proof: template row ends
  above the tab bar at 390 px in all cases; tap-to-swap proven by payloads;
  share/download sends the selected template's card.
- **Lane 8 (reverify properly, browser-first).** Checklist rebuilt from scratch
  and re-verified by using the app in CDP. Corrected counts (42 rows): done 6,
  partial 7, missed 2, not verifiable in CDP 23, in progress 4. Five wrong old
  verdicts flagged (W-1..W-5) with the method flaw named in the checklist doc.
  D-01 (980 px breakpoint) is an owner decision: port it, merge
  desktop-layout-v2's breakpoint, or accept the mobile layout at 980 px.
- **Rebase.** Two conflicts, both resolved by the coordinator: `receive.tsx`
  (heading + templates first, action row right after — the templates own the
  above-fold slot); `wallet/core.test.ts` (split import per Lane 2).
- **Deviation found in merge verification (owner decision needed):** the main
  QR renders at 136 px, not the 192 px spec — deep-audit Lane A reduced it
  from 192 to 136 to get the actions above the fold. Restoring 192 px would
  put the template row at ~762 px (still above the fold by 8 px) but push the
  action row further below it.
- **Gates (rebased tree):** tsc 0, build pass, vitest 1,748 passed / 5 skipped
  (90 files), lint 25 errors all pre-existing in `apps/web/scripts/*.mjs`,
  npm audit 0, root `npm test` 0. E2E not run on this tree (deep-audit ran
  23/24 on its own tree; this tree covered by vitest + CDP).

## §15 — Finish-the-product programme, Lane J (homepage + 4-token sweep + Retry + performance + Scan)

- **Popular chains removed from the homepage (both states).** The
  `PopularChainsStrip` is gone from `welcome.tsx` (no vault) and
  `dashboard.tsx` (vault) — the homepage is the hero total, the four
  actions, then the rows. The `chain-strip.tsx` /
  `chain-strip-display.ts` files are left in place, now unused: Lane G
  owns the component machinery, so the merge lane deletes them if G
  does not re-home the component.
- **4-token sweep — two real bugs fixed, the rest honest labels.**
  `transaction-detail.tsx` hardcoded the four chains for its history
  lookup; it now iterates `availableFor('history')` (7 chains).
  `mnemonic-backup.tsx` showed 4 recovery profiles; the create/import
  flows already store 7 distinct profiles, so the screen now shows all
  7 (EVM collapsed to one Ethereum row). Genuinely-4 screens are
  labelled, not silently 4: `SIGNING_CHAINS` (the wallet signs native
  BTC/ETH/TRX/TON only) and `DEVNET_CHAINS` (4 test networks) both say
  so in their copy. `wallet-refresh.ts` (`CHAINS = 4`) is dead
  production code — imported only by its own tests — reported, not
  rewritten; repo-cleanup owns deletion.
- **Per-row Retry removed entirely from asset rows.** The fetch layer
  already retries silently with backoff and keeps the last good value,
  so a row button could only fail again — the Dogecoin row proved it
  (SoChain 429s, BlockCypher CORS-blocked). The row model is MetaMask's
  standardised unavailable display plus Ivy Wallet's
  `feature/accounts` pattern (icon + name + balance + one status line,
  no Retry — patterns only, GPL-3.0, no code copied); a failed row is
  an Aceternity Empty States shape (real logo, one plain line, one
  action — the list-level Refresh). The single retry path is the
  list-level "Refresh balances" on the hosting screen; the /assets one
  is a Stateful Button (busy + disabled while the refetch is in
  flight). Deliberately kept: the dashboard hero Retry (only when every
  hero balance failed), `asset-detail.tsx` LockedOrRetry, the
  history Retry in `recent-activity.tsx`, and the Transactions-screen
  Retry in `refresh-failure.spec.ts`.
- **Scan on the homepage (dashboard only).** Fourth action tile
  (Send / Receive / Scan / Activity) linking to `/send?scan=1`, which
  opens the Round 2 QR scanner on arrival. No Scan tile on the welcome
  screen: without a vault there is nothing to send from.
- **Performance (measured, see `PERF.md`).** Cold-load fix, two
  attempts. Attempt 1 (gated warm-up + lazy engine) won first paint
  but made Slow 4G settle worse (55.1 s → 69.0 s), so the warm-up was
  removed: attempt 2 loads the engine only on demand. Final medians:
  FCP -33% to -45%, heading visible -38% to -71%, Slow 4G settle
  55.1 s → 3.8 s (mobile) and 55.5 s → 3.8 s (desktop); cold-load
  bytes 14,698,005 → 1,369,955. The 2.9 MB engine chunk left the
  first-paint modulepreload graph (dynamic `loadCore` in
  `create-wallet.tsx` and `wallet/core.ts`, plus the coin-type key
  table moved to the leaf module `engine/coin-type-keys.ts`).
  Trade-off: Generate pays the engine download on first use on a
  slow connection, behind its honest loading state. Keys are never
  cached: the engine download never carries a vault or a mnemonic.
- **UI/UX research applied (see `bawa-uiux-sources/RESEARCH.md`).**
  Linework token structure formalised Bawa's tokens as a comment in
  `globals.css` (no value changes); Magic UI Number Ticker picked over
  Number Flow for the hero, honest variant (counts only between
  settled dollar values, never from $0.00, immediate under
  reduced motion); the ui-ux-pro-max pre-delivery checklist adopted as
  the gate (SVG icons only, 4.5:1 contrast via existing tokens,
  375 px check); OJO 8-state model on the new Scan tile and Refresh
  button. NOT applied: Animated List (activity feed is not this
  lane's screen), the Send Stateful Button (Send screen is not this
  lane's screen), liquid-glass/aurora/neon styling (clashes with the
  hand-drawn ink look).

## §16 — Finish-the-product programme, Lane D (fix all recorded gaps) — 2026-11-23

**Lane D (this lane), hands-on Muse, 0 Sol calls, 0 AgentRouter calls.**
Worktree detached at token-gaps `d47d282`; nothing pushed, no branch
created.

- **Gap 1 (EVM history, partial fix).** Celo, Optimism and Scroll now
  have wired keyless history sources (probed live 2026-11-23;
  `EVM_HISTORY_SOURCES` in `apps/web/src/wallet/adapters/index.ts`).
  The other twelve non-ETH EVM chains stay unwired (403/404 per host);
  the remaining decision is unchanged: an Etherscan-family keyed API
  (owner approval) or accept those twelve as balance-only.
- **Gap 16 (derive.js, fixed).** `derive.js`, `derive-daemon.js` and
  `extended-key.js` now cover 20 chains (btc/eth/trx + ltc/doge + 15
  EVM); every new fixture address two-oracle verified (Wallet Core
  4.9.3 + bip_utils 2.12.3); smoke test RED-then-GREEN.
- **Gap 24 (result-screen copy, fixed).** A failed devnet broadcast
  now says so in the heading ("Send signed — broadcast failed") and
  the paragraph, instead of claiming it was broadcast.
- **Gap 11 (lint, fixed).** apps/web lint widened to cover `scripts/`
  (25 `no-undef` errors gone); new root eslint config + `npm run
  lint` (6 more errors in `scripts/check-pinned-dependencies.js`
  gone). CI still lints apps/web only — wiring the root lint into
  the workflow is a follow-up.
- **Gap 7 (E1 expiry, fixed).** The 2027-02-20 date is now in
  `docs/launch-checklist.md` (Devnet exception section); the renewal
  owner is still blank.
- **Gap 17 (phrases fixed, rotation a decision).** 18/21-word
  restore tests added (25/25). Rotation: refresh reads only
  `vaultAddresses[chain][0]` and `receiveAddresses` is consumed
  only by Receive — funds at a rotated address are invisible in the
  dashboard. Options: sum rotated addresses into the hero + merge
  history; per-address rows; or leave as-is and document watch-only.
  Owner picks; not implemented silently.
- **Gap 21 (watch-only devnet TON, closed by owner decision).**
  Watch-only is MAINNET-ONLY and stays that way (owner order
  2026-11-23 ~20:34 IST) — no code change.
- **Gaps 3/5/6 verified already fixed** (adapters + token logos;
  refresh limiter cap 4; TON Issues 5/6) and statuses updated in
  `docs/GAP-ANALYSIS.md` and `DEVNET-ISSUES.md`.
- **Not duplicated:** gaps 13/18/19 (Networks copy) belong to Lane
  C; gap 15 belongs to Lane A; gap 2 (multi-phrase vaults) stays a
  decision (design questions unsettled); gaps 9/10/12/22/23 stay
  decisions (faucets, TonCenter key, DOGE fallback).
- **Owner-order scope note (2026-11-23 ~21:03 IST, six phone
  screenshots):** Lanes G–J were added to the programme after this
  lane started (Popular-chains cards, Retry-as-zero, token icons,
  Receive step-1 redesign, create-screen single button, 'Popular
  chains' removal, remaining token Retry, slow loading, Scan icon,
  QR-card polish). That work overlaps gaps 3/12/14/20 but was NOT
  briefed to this lane; recorded for the coordinator, not done here.
- **Registry validator note:** `scripts/validate-registry.mjs`
  reports pre-existing errors for opbnb/metis/aurora/fantom
  ("unknown chain") on the untouched baseline too — identical with
  and without this lane's `capabilities.json` change.
- **Gap 4 / E2E (final).** Full suite run 4 times on the root-base
  build: 22/24, 23/24, 22/24 (plus a killed first run). **E2E-05
  rewritten in place** — the old spec expected 'history unavailable'
  on a fresh wallet, which the Transactions screen deliberately
  never shows (failure box only when the wallet has activity);
  proved by a 120 s CDP probe and by the spec failing identically
  on the untouched `d47d282` baseline. The rewritten spec asserts
  the honest empty state and passed alone (56.2 s) and in the full
  suite. **E2E-02 found bug (not fixed here):** after toggle +
  full reload, the devnet BTC receive address can stay missing
  ("No receiving address available for this chain", failure
  screenshot viewed) — the devnet re-derivation has no retry and
  `refreshReceiveAddresses` runs only on rotation; failed in 3 of 4
  full runs, passed alone and in CDP. Item D Jetton timeouts are
  live-network flakes (pass alone).
- **CDP (this tree).** C-41 Done — QR templates labelled + 64 px
  alternates, main QR 136 px measured live (code: `qr-card.tsx`
  `size={136}`; the 192 px spec is a recorded owner decision, not
  changed). D-02 verified — `/lock` has exactly 1 `<main>`,
  `/security` has "Lock now". Gap 14 measured: details step is
  1,270 px in an 844 px viewport at 390 px (426 px scroll, was
  40–90 px) — owner decision, folded into the Lanes G–J QR-card
  redesign. Gap 20 measured: exactly 2 of 22 chain names truncate
  at 390 px (BNB Smart Chain, Avalanche C-Chain) — left alone for
  the owner-ordered Receive redesign. Gap 1 Celo settled in CDP:
  "No transactions yet for this chain." DOGE watch row renders with
  "Could not load balance" + the app's single remaining Retry.
  1919 px dashboard: no overflow, no clipping.
- **Owner-order scope note 2 (2026-11-23 ~21:33 IST):** diagrams
  BOTH — hand-crafted SVG in the README + richer Mermaid in docs —
  added as Lane K. Not this lane's work; recorded for the
  coordinator.


## §17 — Finish-the-product programme, Lane B — watch-only multi-chain, HD all-chains, real-time tracking (2026-11-23)

Hands-on Muse, 0 Sol calls. Worktree `bawa-finish-b-worktree`, detached
from token-gaps `e290654`; commit SHA in the lane report.

- **Watch-only fans out by address family (mainnet only).** One plain
  address import now watches every chain the address belongs to:
  an EVM address (`0x…`) watches all 16 EVM chains; BTC, LTC, DOGE,
  TRX and SOL addresses watch their own chain. An existing watch-only
  entry is never overwritten — an xpub entry keeps its 5 derived
  addresses. Implementation: `wallet/watch-only-families.ts` (pure
  shape routing), `engine/boundary.ts` (`validateWatchOnlyImport`
  returns `kind: 'address' | 'xpub'`; `deriveAddress`/`deriveAddresses`
  return the plain address at index 0 only),
  `state/wallet-context.tsx` (`addWatchOnlyAddress`, skips already
  watched chains), `screens/import-wallet.tsx` (per-chain "address or
  xpub" labels, grouped import list by stored value). **Vault-shadowing
  finding (same day, CDP):** `balances[chain]` is a single per-chain
  slot and `refreshBalances` reads the vault address first, so a
  watch-only balance never reaches the asset rows while a vault
  exists — the fan-out stored the address on 16 chains but the user
  saw only the vault's zeros. Fixed in place: the Wallets screen now
  shows each watch-only row's own balance (`WatchOnlyBalance` in
  `screens/wallet-management.tsx`, fetched for the watched address
  via `ensureAdapters`, with an honest failure + "Retry balance";
  unit-tested with Vitalik's 5.799564 ETH). History stays
  vault-shadowed the same way on the Transactions screen — a
  watch-only address's history is still reachable per-address via
  /track "Recent activity for an address".
- **History wired for 9 more EVM chains (gap 1: 7 → 16 verified).**
  Optimism, Scroll, Celo, Aurora via their Blockscout hosts;
  Avalanche and Mantle via Routescan's Etherscan-compatible API;
  Polygon, Base and Arbitrum via their Blockscout hosts — these
  three answer 403 Cloudflare to curl but HTTP 200 with real
  transactions to a headless-Chromium fetch, and their Blockscout v2
  tx-by-hash endpoints verified the same way. All probed live
  2026-11-23 with Vitalik's address
  (`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`, nonzero balance on
  all 16 EVM chains). `/track` hash lookup extended to seven
  Blockscout v2 chains (`wallet/tracker.ts`, parameterised
  `parseEthTx`); Avalanche/Mantle lookup stays unsupported
  (Routescan tx-info shape differs from Blockscout v2). **CSP catch:**
  the wiring was dead in the browser until `connect-src` pinned the
  nine history hosts (56 origins: 51 mainnet + 5 temporary devnet);
  the drift-guard test now collects `historyBaseUrl` and
  `historyExplorerBase` origins too (it collected RPC endpoints
  only). Six chains remain blocked with no working keyless indexer
  (bsc, gnosis, linea, opbnb, metis, fantom) — owner decision §1 in
  GAP-ANALYSIS.md (Etherscan key or another indexer).
- **Live ground truth for the CDP demo (all verified 2026-11-23):**
  Vitalik EVM address (all 16 chains); SOL
  `4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM` (0.00236821 SOL);
  TRX `TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5` (19,276,582.84 TRX,
  richest-accounts list); BTC `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`
  (57.7198 BTC); LTC `MLos7u44mMq1ufgPJZTatEfPm3Kgxj5Nt9`
  (0.0533665 LTC, 857 txs); DOGE `DEgDVFa2DoW1533dxeDVdTxQFhMzs1pMke`
  (27,164,003,668.40 DOGE). Two recalled candidate addresses proved
  wrong and were dropped: a Binance EVM address (42 hex chars, nodes
  want 40) and the Litecoin/Dogecoin foundation addresses from memory
  (both invalid; the correct DOGE whale address ends `…vGLR3mr7L`).
  DOGE's in-app sources are both degraded today (SoChain keyless
  quota exhausted, BlockCypher 429) — the live DOGE figure above is
  from dogechain.info, not the wallet's own path.
- **Final live verdict (same day, CDP, Wallets screen).** Every
  family above was imported watch-only and its balance read in the
  app: EVM 16/16 live (Vitalik, each matching the RPC ground truth
  to 6 decimals), BTC 57.71980119, SOL 0.00236821, LTC 0.0533665,
  TON 0 (toncenter confirms 0). TRX and DOGE show an honest failure
  with "Retry balance": TRX 429s from Trongrid on the shared egress
  IP (the `/v1/accounts/` fetch and `getnowblock` both rate-limited
  under the app's request volume; a single direct probe returns
  19,283,710.80 TRX), DOGE has no working in-app source that day.
  History in-app still flaps with the same rate limits — the
  Transactions screen showed 9 chains "unavailable" on the final
  run and the ETH `/track` lookup that succeeded earlier in the day
  failed on re-run, while the OP lookup of the same hash returned
  the correct "Transaction not found", proving the OP wiring
  reaches its indexer. The wiring is proven; the flapping is the
  keyless indexers' rate limits on a shared IP, and only a keyed
  indexer (owner decision §1 in GAP-ANALYSIS.md) fixes it durably.
- **SOL multi-address untouched.** The SOL derivation question is
  Lane A's open owner decision; this lane did not change SOL
  derivation (would move existing users' addresses).
- **Gates:** tsc 0, build 0, vitest 1775 passed / 5 skipped / 0
  failed (baseline 1738/5/0), lint 0, npm audit 0 vulnerabilities,
  `generate-chains.mjs --check` OK, root `npm test` 0.
## §18 — Finish-the-product programme, merge lane (Lane F) — 2026-11-23

Hands-on Muse, 0 Sol calls. Worktree `bawa-finish-product-worktree`.
Cherry-picked all 10 lane commits onto `panel-rebuild/finish-product`
(`d47d282` base) in order E, A, C, K, G, H, I, J, D, B-last; follow-up
commit `69f7d8c` + SVG fix `e0f0c0a`. Merged into `token-gaps` as [SHA TBD].

- **Merge order.** B last because its base was `e290654` (rebase onto
  `d47d282`, 11 conflicts). C and A merged before K's follow-ups so the
  stale price-fallback copy and derivation paths were fixed on the merged
  tree, not on a lane branch.
- **Merged CSP is 56 total origins, 51 mainnet.** Lane B added 8 history
  hosts; 3 overlapped Lane D's gap-1 origins (deduplicated). The
  `security-headers.test.ts` `httpsOrigins` array is rebuilt from the
  merged string so the two can never drift. History verified is 16 chains
  (`btc, eth, trx, ton, sol, matic, arb, op, base, avax, ltc, doge, celo,
  mantle, scroll, aurora`); six stay blocked (`bsc, gnosis, linea, opbnb,
  metis, fantom`) — no working keyless indexer (owner decision §1 in
  GAP-ANALYSIS.md).
- **Chain-strip removal wins.** `chain-strip.tsx` / `chain-strip-display.ts`
  / `chain-strip.test.tsx` deleted (owner order via Lane J); verified no
  production importers.
- **`--bawa-shadow`: keep as-is.** The Oishi hard-offset-shadow treatment
  was explicitly ordered by the research steer. A flat 4 px ink offset is
  not the blur/glow the `globals.test.ts` box-shadow guard covers, and the
  guard bans literal `box-shadow` in `globals.css` source — the token holds
  the value in a CSS variable, so the source stays clean. If the owner
  wants the guard to ban offset shadows too, that is a new decision.
- **QR 136 px vs 192 px spec: keep 136 px.** Owner decision; measured live
  at 136×136 in CDP. Do not change silently.
- **Recent Activity vs Transactions divergence (both tested, intentional).**
  On Recent Activity, a failed history is not an empty history: the
  unavailable + Retry block renders when the wallet has activity, while
  locked, or when any chain failed with a reason other than `no-address`
  (`no-address` is the initial state, not a failure). On the Transactions
  screen the merged semantics show neither state with no activity (the
  honest empty state, E2E-05). The two screens differ by design; do not
  "unify" them without an owner decision.
- **Merge defects found by gates and fixed in place (all in commit
  `69f7d8c`).** `dex-prices.ts` lost Lane C's `PRICE_FETCH_TIMEOUT_MS`
  import + local `isAbortError` in the resolution (tsc caught it);
  `chains.ts` had a stray comment line + a duplicate
  `HISTORY_EVIDENCE_2026_11_23` const git auto-merged; `chains.test.ts`
  had a dead `else if (chain === 'op')` outside the resolved region. The
  lesson stands: a cherry-pick that "succeeds" still needs the full suite
  on the merged tree before it is trusted.
- **CDP re-verification (this lane, root-base build).** SOL rotation live
  (`AWJmCKgC…` → `C4McuDyE…`, QR decodes to the rotated address); TON
  second address live (`UQBlsndF…` → `UQDI4-PA…`); CELO shares the ETH
  address live; LTC zpub import live (toast + Imported wallets entry);
  watch-only Vitalik 16/16 live; CoinGecko-blocked prices live (CoinLore
  BTC $61,878.40, ETH $1,763.80; Fantom $0.029092 DexScreener); Celo history
  empty state live; Transactions honest empty state live; no Retry / no
  "Balance unavailable" / real logos at 390/1440/1919; Receive redesign +
  136 px QR + 3 templates live; single Create button live; no Popular
  chains on the homepage + Scan tile live; cold load 1,376,967 bytes
  (390 ms settle ~3.2 s unthrottled, ~5.3 s Slow 4G); both SVGs render
  (architecture line fixed after a viewed clip). The Recent Activity "No
  activity yet" empty state was NOT captured live in CDP — the indexers
  429'd on both runs, so Lane C's all-failed unavailable state rendered
  instead (correct behaviour); it is covered by unit test + E2E-05.
- **Gates:** tsc 0, build 0, build:e2e 0, vitest 1871 passed / 5 skipped /
  0 failed (97 files), lint 0 (apps/web + root), npm audit 0
  vulnerabilities, root `npm test` 0, root `npm run check` 0. E2E: full
  suite 15/24 pass, 9 fail (13.3 min) — E2E-06, E2E-03, E2E-13, E2E-18,
  E2E-19, E2E-02, Item D DISC, Item D MY, E2E-05. Alone on the merged tree
  E2E-03 and E2E-18 pass; E2E-06, E2E-19, E2E-02, E2E-05, E2E-13, DISC fail
  identically on the pristine `d47d282` baseline (pre-existing, not merge
  defects; the CoinGecko failure flipped: NOT on baseline, SHIB on merged).
  E2E-02 is the known real devnet-derivation race. The rest are
  live-network (Solana backup RPC unreachable from this egress, CoinGecko
  429s, public-RPC rate limits). E2E is NOT claimed green.
- **Open decisions carried forward (unchanged).** QR 136/192; Receive
  details scroll 426 px (smaller buttons vs top-stack rework); E2E-02
  devnet-derivation race (real app bug); 12 EVM chains balance-only
  without a keyed API; rotation funds invisible in the dashboard;
  multi-phrase vaults; faucets (owner must complete captchas); TonCenter
  keyed tier; DOGE fallback (Blockchair key or accept outage); xDAI+MNT
  no keyless price fallback; FTM low-liquidity pair; devnet+unlocked-vault
  Retry; asset-detail sticky Refresh; Number Ticker CDP-unverified
  (nonzero hero needs a funded wallet, forbidden); live-camera scan
  unverified (needs the owner's phone); review/sign CDP-unverified;
  Receive tagline (owner must say which line goes); README showcase link
  (item A waits on the owner's link); `ci.yml` defines the `web` job
  twice (second shadows the first — owner/merge-lane decision).
## §19 — FIX-ALL programme, Lane G (skills archive + final-SHA record fix) — 2026-11-24

Hands-on Muse, 0 Sol calls, 0 AgentRouter calls, 0 runner invocations.
Worktree `bawa-fixall-g`, branch `panel-rebuild/fix-all-g`, base `8191b2c`
(`token-gaps` tip). No merge; no code touched on any branch.

- **Skills are for Orion's use, not for the repo (owner order 2026-11-24).**
  No plan to add skills into the repo. The three new skills
  (`order-traceability-checklist`, `cdp-visual-verification`,
  `repo-hygiene-scan`) stay live in `/home/boxd/workspace/custom-skills/`
  on gray-pinee and `~/workspace/custom-skills/` in the sandbox, and are
  archived at `/home/boxd/workspace/bawa-fix-all/skills-archive/` (copies +
  README) for future use when skills are added to the repo. Verified: no
  skills directory exists anywhere in the repo tree (the only `*skill*`
  path is Playwright's own tooling inside `apps/web/node_modules`).
- **Second honest gap fixed (Lane G).** The finish-product record as pushed
  to the five branches carried the final SHAs as unfilled placeholders
  because the coordinator reasoned re-pushing would recurse. That reasoning was wrong — a document
  cannot contain its own commit hash, and that is normal: the record lists
  the SHAs of the other pushes, and its own commit gets a new hash, which is
  fine. `docs/FINISH-PRODUCT-PROGRAMME.md` now lists the final SHAs
  (`finish-product` `8191b2c`, `token-gaps` `8191b2c`, `main` `6af3daf`,
  `desktop-layout-v2` `3c1a6df`, `devnet-temp` `db221c4`,
  `token-discovery` `84142e2`, `ui-ux-fixes` `d4ea91d`;
  `adopt-proper` `47fe6c6` and `gh-pages` `ee63a13` untouched) and was
  re-pushed doc-only to the five branches (fresh `ls-remote` verified, no
  unfilled placeholder remains in the file on any of the five branches).
  This section's §18 placeholder is likewise fixed to `8191b2c` on the
  fix-all branch only; the five branches' `DECISIONS.md` copies still carry
  the §18 placeholder, out of scope for this lane's doc-only push (only the
  programme-record file was re-pushed there).

## §20 — FIX-ALL programme, Lane I (branches under 4 + renames + pushes) — 2026-11-24

Hands-on Muse, 0 Sol calls, 0 AgentRouter calls, 0 runner invocations.
Worktree `bawa-fixall-i`, branch `panel-rebuild/fix-all-i`, base `8191b2c`
(`token-gaps` tip). No merge into `token-gaps` or `main` by this lane.
Skills read first-hand on the VM: `repo-hygiene-scan` (naming/structure
scan method + verify-before-deleting rule), `order-traceability-checklist`
(order set locked first, evidence per verdict — used for the branch audit),
`git-workflow-and-versioning` (atomic commits, one concern per commit).

- **Unpushed sweep: nothing pushed.** Every local branch tip is already
  reachable from a pushed remote ref, or its content is: 57 of the 66
  local branches were ancestors of `token-gaps` `8191b2c` at audit time
  (55 after this lane's 4 commits on `fix-all-i`; the 11th non-ancestor
  is the parallel Lane G branch `panel-rebuild/fix-all-g` at `0dd82de`,
  created during this lane);
  `main-adopt-fixes` (`df3dd25`) is contained in `main`; `gh-pages` /
  `main` / remote tips are in sync. 34 worktree HEADs (33 detached
  deep-audit, finish-product, marketing-fix, reverify, round-2 lane tips
  + this lane's own tip) are not contained in any remote ref as SHAs —
  spot-checked by line-subsumption against the
  `8191b2c` tree (deep-audit A 0/11 lines missing, finish A 1/421,
  marketing-fix 1 11/236, round-2 item 1 58/571, finish E 0/146 with
  `secret-handoff.ts` present): their content entered `token-gaps` via the
  recorded cherry-pick merges under new SHAs, or (reverify Lane 1,
  199/342) was superseded by the corrected Lane 8 rewrite that explicitly
  replaces it. Deliberately left unpushed: `panel-rebuild/pages-base`
  (`cd39306`, local-only, worktree-pinned) — its `/bawa/` base + router
  basename work is already in the `8191b2c` tree, and pushing it would add
  a 10th remote branch against the under-4 goal. My own lane commits stay
  local by brief (lane branches are not pushed). All 4 local tags exist on
  the remote.
- **Remote branches 9 → 8.** Fresh `ls-remote` at lane start (2026-11-24):
  `gh-pages ee63a13`, `main 6af3daf`, `adopt-proper 47fe6c6`,
  `desktop-layout-v2 3c1a6df`, `devnet-temp db221c4`,
  `finish-product 8191b2c`, `token-discovery 84142e2`,
  `token-gaps 8191b2c`, `ui-ux-fixes d4ea91d`. `finish-product` DELETED via
  PAT protocol — verified `merge-base --is-ancestor` of `token-gaps` with
  0 unique commits (`8191b2c` = `token-gaps` tip); fresh `ls-remote`
  confirms the ref is gone. During this lane the Lane G doc-push moved
  five tips one doc-only commit each (`main 250272a`,
  `desktop-layout-v2 5fff7ce`, `devnet-temp 76fdd25`,
  `token-discovery 150b2f6`, `ui-ux-fixes 8ac66fa`; `main` later `58e7c36`
  for the README fix) — the audit below is against the pre-move tips,
  re-verified as docs-only on top of them.
- **Branch audit (unique vs `token-gaps` `8191b2c`, `git cherry` +
  line-subsumption, not SHA equality).** `adopt-proper` (10 unique, all
  docs): substance superseded — `token-gaps` carries later corrected
  versions of the same files (reverify checklist explicitly REPLACES the
  first checklist; gap rows present with updated statuses; `index.md` /
  `inventory.md` strictly newer, zero adopt-only lines). `devnet-temp`
  (8 unique, all docs; devnet code already in the tree,
  `devnet-setting.tsx` etc.): same supersession verdict. `token-discovery`
  (11 unique, all docs) and `ui-ux-fixes` (2 unique, both docs): same.
  Cherry-picking any of those doc commits would REGRESS the docs — not
  done, with evidence in the lane report. `desktop-layout-v2` (14 unique):
  3 code commits (`ed0abba`, `0e194f4`, `bf00f54`) with no equivalent in
  `token-gaps`; the `lg+` two-column commits conflict across 8 files and
  their layouts were superseded by finish-product desktop work, so only
  the 980 px breakpoint was ported (see below). `main` (628 unique) and
  `gh-pages` (orphan build commit) are keepers, never merged.
- **Deletion list for the merge lane (execute only after the
  fix-all → `token-gaps` merge).** `desktop-layout-v2` (unique code now
  ported as `3fce3f7`; remaining unique commits are superseded docs),
  `devnet-temp`, `token-discovery`, `ui-ux-fixes` (unique commits docs-only
  and superseded — see audit), `adopt-proper` (same). Evidence per branch
  is in the lane report (`LANE-I-REPORT.md` in the programme record
  directory). Local branches: 57 at audit time (55 now — `fix-all-i` and `fix-all-g` hold new work) are ancestors of `token-gaps` and safe to
  delete once their worktrees are removed — but most are checked out in a
  worktree, so this lane deleted none (no force-delete of worktree
  branches); the merge lane / coordinator owns worktree removal. Never
  deleted: `main`, `token-gaps`, `gh-pages`, `panel-rebuild/fix-all-i`.
- **980 px breakpoint ported (`3fce3f7`).** Hand-port of `bf00f54` onto
  `8191b2c` (verbatim cherry-pick of `ed0abba`/`0e194f4`/`bf00f54` aborted
  on 8-file conflicts): Tailwind `desktop:` variant at 980 px
  (`--breakpoint-desktop: 61.25rem` in `globals.css`) and the shell-only
  `lg:` → `desktop:` switch in `app.tsx` (frame, sidebar, headers, bottom
  nav, more menu, outlet cap), `sidebar-nav.tsx` + `security-settings.tsx`
  comments, tests in `app.test.tsx` / `app-nav.test.tsx` /
  `globals.test.ts`. In-page `lg:` grids untouched. The Retry-gate half of
  `bf00f54` was NOT ported — finish-product Lane J already gates Retry on
  this tree. Verified `token-gaps` had no `980` in `apps/web/src` before.
- **Lane G docs incorporated (`77ad733`, cherry-pick of `0dd82de`).**
  Final SHAs in `docs/FINISH-PRODUCT-PROGRAMME.md` (the `bdb8fa8` →
  `8191b2c` fix the owner ordered) + DECISIONS §19 (skills archive note).
  The branch variants (`5fff7ce` etc.) carry the record half only; the
  fuller `0dd82de` was picked.
- **Rename (`6a8cdf5`, separate commit).**
  `apps/web/e2e/itemD-add-token-prices.spec.ts` →
  `apps/web/e2e/item-d-add-token-prices.spec.ts` — the last camelCase
  filename in `e2e/` (siblings `item13`/`item14`/… are lowercase +
  number). Screenshot paths inside the spec and the `add-token.spec.ts`
  comment updated; test titles keep "Item D" (programme item label).
  Nothing else renamed: the audit found no other misnamed file —
  `docs/` SCREAMING-CASE is the recorded convention, Android PascalCase
  is Kotlin convention, `__typetests__` is the type-test convention,
  `LICENSE-token-ui` / `boundary.ts` / `test/` vs `tests/` / `docs/index.md`
  vs `docs/README.md` are all KEEP decisions already recorded in
  `NAMING-MAP.md` §2 (re-checked, not re-litigated). `secretHandoff.ts`
  was already renamed by finish-product Lane E. No file deleted.
- **Captcha rename follow-up: not applicable to this tree.** The
  2026-11-24 main rename (`captcha/run-tronscan-check` →
  `run-captcha-check`, main `58e7c36`) and its stale
  `docs/diagrams/captcha.*` references live on `main` only — this tree
  contains zero `captcha` paths. Touching `main` is outside this lane's
  brief; flagged for the coordinator.
- **Docs brought to the new state (this commit).** `docs/index.md` project
  structure re-verified by `git ls-files` against `8191b2c`:
  `apps/web` 273 → 304 files, `src/screens` 57 → 56, `src/wallet` 80 → 86,
  `docs/` 216 → 219; root-docs list extended (added `DEVNET-ISSUES.md`,
  `PERF.md`, `SECURITY-FINDINGS.md`, the three `NOV18-*.md` reports);
  stamp `d47d282` → `8191b2c`. `README.md` Project history gains the
  FIX-ALL line. `NAMING-MAP.md` §1 gains the `item-d` row.
- **Gates on this lane tree (Node 22, after `npm ci`):** `tsc --noEmit` 0,
  `npm run build` 0 (palette audit passed), `vitest` 97 files, 1873 passed
  / 5 skipped / 0 failed, `eslint` 0, `npm audit` 0 vulnerabilities.

## §21 — FIX-ALL programme, Lane A (watch-only, history, RPCs) — 2026-11-24

Hands-on Muse, 0 Sol calls, 0 AgentRouter calls. Worktree
`bawa-fixall-a`, branch `panel-rebuild/fix-all-a`, base `8191b2c`
(token-gaps tip). Lane report:
`/home/boxd/workspace/bawa-fix-all/LANE-A-REPORT.md`.

- **TRX watch-only fixed (TronScan fallback + PublicNode backup).**
  Trongrid 429s under load (`/v1/accounts/` and `/wallet/getaccount`
  both 429 in the probe runs). The adapter now falls back to TronScan
  (`https://apilist.tronscanapi.com`, balance + history, TransferContract
  only, direction from owner/to) and the registry gains PublicNode's
  TRON full node (`https://tron-rpc.publicnode.com`) as second RPC —
  it answers `/wallet/*` (identity, fee) but 404s `/v1/*`, which is
  why TronScan owns balance/history. Mainnet-only gate: the fallback
  never runs on devnet (Nile). CDP: `/wallets` shows
  `20,032,755.932541 TRX` for `TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5`,
  matching Trongrid = TronScan = PublicNode in one probe run.
- **TON: the 0 was genuine.** TonCenter and TonAPI agree the tested
  address holds 0 (active v4r2 wallet). No adapter change: the TonAPI
  fallback already existed. Funded address
  `UQAXDV0lgZTFoAkp_pwBwJbY1Gg8yppMrp2rU7JF6dBG3B5B`
  (41.293091416 TON, v5r1) renders in CDP, and the zero address
  renders `Balance: 0 TON` in a separate run. Known limit: the
  watch-only store holds one entry per chain, so two TON addresses
  cannot be watched in one browser profile.
- **DOGE: dogechain.info added, then removed in the same lane.**
  Correct data in Node (200, exact agreement with BlockCypher) but
  no `Access-Control-Allow-Origin` on `.info` or `.com`, so the
  browser fails every fetch — proven in CDP round 2 (six
  `net::ERR_FAILED`, same URL 200 in Node) and from a no-CSP probe
  page, so it is CORS, not the app's CSP. Zelcore Blockbook and
  DogeSoft return the same correct balance with the same defect;
  Trezor Blockbook 403s, Blockchair 430s (IP blacklisted), NOWNodes /
  CryptoAPIs / Ankr need a key, PublicNode has no Dogecoin RPC.
  Adapter stays SoChain → BlockCypher (both CORS-clean); on
  2026-11-24 both are quota-limited, so the row honestly shows
  "Could not load balance" with Retry. Owner decision unchanged:
  Blockchair with a key, or accept the outage (GAP-ANALYSIS.md §12).
- **Linea history wired (Etherscan V2, keyless).** Chain 59144
  answers `txlist` with status `"1"` and real transactions; the
  other five blocked chains were probed and stay blocked (Routescan
  "chain not supported" / `NO_BLOCKCHAINS_FOR_PARAMS`; Etherscan V2
  "Free API access is not supported" (bsc, gnosis), "Missing or
  unsupported chainid" (metis, fantom), 502 (opbnb); Blockscout 404s
  and gnosis 403 Cloudflare — the browser fetch fails too, so it is
  not a curl artefact). CDP: `/assets/linea` renders the real tx
  `0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c`.
  History verified is now 17 chains; five stay blocked (owner
  decision §1 in GAP-ANALYSIS.md).
- **Every RPC audited live through the app's adapters (38
  endpoints).** All answer except the two 1RPC backups, which return
  `-32001` "usage limit" (shared free tier exhausted) and were
  replaced with dRPC (`https://eth.drpc.org`,
  `https://aurora.drpc.org`), verified live through the adapter with
  Vitalik's exact balance. The Solana backup
  (`public.rpc.solanavibestation.com`), unreachable on 2026-11-23,
  answers again. CSP is now 61 origins (56 mainnet + 5 temporary
  devnet); the drift guard collects history hosts too.
- **Build note (own goal, fixed in the lane).** The first CDP run
  used `npx vite build` directly, which skips the `prebuild`
  `copy-wasm.mjs` step — the wallet-core WASM 404d in the browser
  and `loadCore()` aborted. The proper build is `npm run build`
  (copy-wasm → tsc → vite build → palette-audit); the lane's later
  runs used it and the WASM loads (HTTP 200). Lesson: never verify a
  `vite build` invocation that bypasses `prebuild`.
- **Observed, not Lane A scope.** The Linea asset screen's large
  balance (`0.006803680919043338 ETH`) clips at the right card edge
  at 390 px (viewed in `r3-04-linea-history-390.png`). Pre-existing
  asset-detail layout; recorded here, not fixed in this lane.
- **Gates:** tsc 0, `npm run build` 0, vitest 1883 passed / 5 skipped /
  0 failed (97 files), lint 0 (apps/web), npm audit 0 vulnerabilities,
  root `npm test` 0 (after `npm ci` in `tools/hdwallet-gen`, whose
  `node_modules` was never installed in this worktree — pre-existing),
  `generate-chains --check` 0. Root `npm run lint` cannot run here
  (no root `node_modules`, `eslint: not found`) — pre-existing, not
  a lane change.

## §22 — Fix-all Lane H — the 13 "still needing your word" items (2026-11-23/24, branch panel-rebuild/fix-all-h)

Lane H decided the 13 items by live preview (CDP against the statically
served dist, served-JS hash verified against the dist hash) and code
evidence. Hands-on Muse work, 0 Sol calls, 0 AgentRouter calls. Base:
token-gaps 8191b2c. Gates on the lane tree: tsc 0, build 0, vitest 1808
passed / 5 skipped / 0 failed (91 files), lint 0, npm audit 0
vulnerabilities. Net diff (commit 1962d84): 46 files, +1,046 / -3,714 lines.

### 1. 980 px breakpoint — DECIDED-AND-DONE
Ported desktop-layout-v2's breakpoint, shell-only: `--breakpoint-desktop:
61.25rem` in `apps/web/src/ui/styles/globals.css` (the token lives there,
not in app.tsx as the brief said) and `lg:` → `desktop:` on the shell
lines in `apps/web/src/app/app.tsx` and `sidebar-nav.tsx`. Verified live
at exactly 980 px: the desktop shell renders (sidebar with Home, Assets,
Receive, Send, Wallets, Transactions, Track, Import, Create, Security,
Networks, Mnemonic backup, Welcome; Collapse sidebar) — final
`final-nowallet-welcome-980.png`. Mobile at 390 px is unchanged (bottom
nav, hero card). Deliberately NOT ported from v2: dvh → screen, the
NetworkModePill removal, the BrowserRouter basename removal, the
`/assets/:chain/:token` route removal, the Lane G zero-balance removal —
that branch diverged in 283 files and carries regressions; those are a
separate v2 follow-up, not the breakpoint.

### 2. Devnet fiat suppression on token rows — DECIDED-AND-DONE (bug, fixed)
Native rows suppressed fiat in devnet by design (`fiatDetail` returns
zero when `devnet && fiat.kind === 'fiat'`); token rows hardcoded `false`
in their `fiatDetail` call and `getTokenRowModel` took no devnet param —
a latent bug, fixed by threading `devnet` through. The new test then
caught a second instance: the hero ALSO valued test tokens
(`tokenContribution` read live token prices with no devnet branch, putting
"$25.00 (Partial)" in the hero for 25 test USDC) — fixed the same way
(`tokenContribution` returns empty in devnet). Tests pin both: 25 USDC
shows `$1.00` + `per USDC`, never `$25.00`; the hero is clean `$0.00`.

### 3. Receive QR on step 1 — DECIDED-AND-RECORDED (leave the flow)
Step 1 is a clean network picker (search + Popular + "All networks (18)")
that fits at 390 px with no scroll; no network is chosen yet, so no
address exists to encode — a QR here would show a default-chain address
and risk a wrong-network payment. The QR is 2 taps away (network → token
→ QR). The finish-product Lane H redesign already answered the underlying
complaint. No change.

### 4. Lane 3 questions — DECIDED-AND-DONE
(a) The Create card back on Welcome STANDS: code in `welcome.tsx`,
confirmed in preview at 1440 px (right column, coral button) — no change.
(b) Quiet note under a genuinely fresh $0.00 ADDED: "Nothing here yet —
receive on any chain to get started.", shown only when all balances
loaded zero and nothing failed. A partial $0.00 still shows the failure
note instead — the final CDP run confirmed that branch on the live egress
(hero $0.00 + "Some balances or prices couldn't be checked just now.").
(c) The four "Coming soon" cards (Android wallet, Smart contract creator,
Multi-signature wallet, Connect an existing wallet) COLLAPSED into a
native `<details>` (closed by default, "Coming soon" as `<summary>`,
one tap away, no new dependency). Create at 390 px is now 1,276 px tall
with one disclosure row instead of a whole extra screen of cards.

### 5. Receive tagline — DECIDED-AND-DONE
Restored from the Round 2 history (`git show d370c58`, Round 2 item 8,
which removed it): "This is your address — share the drawing, keep the
keys." It sits on the Receive DETAILS step, directly under the
network/Back row, in the same `font-display text-xl` styling as before.
Verified at 390 px: the QR card still sits above the fold (QR + "Any
amount" + address + Ethereum/Native coin), the template minis still peek
above the fold; the action row was already below the fold, so the cost
is one line of scroll.

### 6. The 12 EVM chains that are balance-only — DECIDED-AND-RECORDED (accept 6, count corrected)
The "12" in the brief is stale: finish-product Lane B (2026-11-23) wired
9 of the 15 non-ETH EVM chains — celo/op/scroll, aurora, avax/mantle,
matic/arb/base. Truly unwired five: bsc, gnosis, opbnb, metis,
fantom (matches the `history-sources.test.ts` header comment). Live
probes from gray-pinee (2026-11-23): Routescan
`api.routescan.io/v2/network/mainnet/evm/{chainId}/etherscan/api`
returns "chain not supported" for all 10 remaining chain IDs (56, 137,
42161, 8453, 100, 59144, 204, 1088, 1313161554, 250); the avax control
(43114) returns status 1 with real txs and CORS `*`, proving the probe
format valid. Blockscout hosts with a browser UA: bsc/linea/opbnb/metis/
fantom `.blockscout.com` 404; gnosis.blockscout.com 301 → gnosisscan.io
(Etherscan-family, keyed). Metis `andromeda-explorer.metis.io/api`
returns status '1' with 2 real txs but NO `Access-Control-Allow-Origin`
header — one header away from wiring; record this. Aurora re-verified:
status '1', 2 real txs, CORS `*`. Verdict: accept the five as balance-only
with an honest note in the UI. `evm.ts` now renders: "History is not
connected for {chain} yet — no keyless indexer covers this chain, so only
the balance shows here." (rendered verbatim: `humanReasonMessage` shows a
reason that already reads as a human sentence as-is).

Correction (merge lane, 2026-11-24): Linea is wired since FIX-ALL
Lane A (Etherscan V2 keyless, real tx `0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c`
rendered in CDP) — five stay unwired, not six; `evm.ts` and this item
corrected, `history-sources.test.ts` and `chains.ts` already said five.

### 7. Rotation funds invisible in the dashboard — DECIDED-AND-DONE (stated-not-shown)
Evidence: `refreshBalances` reads only `vaultAddresses[chain][0]`
(`wallet-context.tsx`); `receiveAddresses` is consumed only by Receive.
Funds paid to a rotated address (index ≥ 1) are never fetched — invisible
in dashboard, rows, hero and history. Earlier indices are not even stored
(only the current index, in `bawa-receive-index:v1`). Showing them needs
persisting used indices per chain + multi-address refresh + history merge
— refresh-path surgery of the same class Lane 2 / item 13 proved
infeasible to re-wire without behaviour change. Implemented instead: a
quiet note on the Receive details step by the "New address" rotation
control (shown only when `canRotate`, verified in the final preview):
"New addresses come from the same phrase. Funds sent to an earlier
address still belong to this wallet, but the dashboard only shows your
main address on each chain." Follow-up for the owner: aggregate rotated
addresses into the hero + merge their history, or show per-address rows.

### 8. Multi-phrase vaults — PLAN ONLY (recorded, decision needed)
Architecture (grounded): single JSON envelope in localStorage under
`bawa-vault` (v1, AES-GCM-256, PBKDF2-SHA-256 600k, 16-byte salt, 12-byte
IV; never a mnemonic/key/password), backup `bawa-vault-backup` (verbatim
copy), auto-unlock key `bawa-vault-key`. Module
`apps/web/src/wallet/vault.ts` (874 lines): `migrateEnvelope` /
`VAULT_MIGRATORS`, `createVault`, `unlock` / `lock` / `autoUnlock`,
`withMnemonic` / `withMnemonicAsync` (the closure holds THE mnemonic),
`changePassword`, `restoreVaultFromBackup`, `deleteVault`,
`readVaultAccounts` / `writeVaultAccounts`, `vaultProfiles`,
`vaultProvenance`. Docs: `docs/vault-design.md` (165 lines). The whole
app assumes one vault (one vaultState, one closure mnemonic, single-vault
backup/restore/delete/lock, auto-lock key-storage invariant per vault).
Options: (A) multiple envelopes — registry `bawa-vaults` /
`bawa-vault:<id>` + active-vault pointer; per-vault password/salt/key;
migrate the existing envelope to vault #1; per-vault backup/restore/
delete/auto-lock key; vault switcher UI. (B) one envelope holding multiple
mnemonics — one password unlocks all; all-or-nothing backup/restore;
envelope version bump via `VAULT_MIGRATORS`. (C) status quo. Decision
needed from the owner: per-vault passwords? switching UI? migration?
Implementing touches the vault crypto boundary and every vaultState
consumer — it does not fit safely in this lane. NOT implemented.

### 9. The 4 unwired modules (1,079 lines) — DECIDED-AND-DONE (all deleted)
Exact total: `engine/destination.ts` 602 + `wallet/adapters/
confirmation.ts` 302 + `wallet/evm-typed-data.ts` 121 +
`wallet/secret-handoff.ts` 54 = 1,079. Each imported only by its own test
file; zero production importers, zero doc references in docs/ or
.github/. Per module: destination.ts DELETE — Send already validates via
`validateRecipient` in `wallet/send.ts` (landed 2026-11-19, Wallet Core +
devnet testnet forms, wired into Send steps + deep links); wiring a
parallel validator into the money path is wrong, and `MAINNET_PARAMS`
(confirmations 6/12/19/1, derivation prefixes) duplicates data in
`core.ts` / `chains.ts` / `confirmation-policy.ts`. adapters/
confirmation.ts DELETE — wraps `engine/confirmation-policy.ts` and needs
an `ObserveFn` implementation that does not exist; the track screen reads
indexer confirmations one-shot with no polling, so wiring it would be a
new live-polling feature, not a wire-up. evm-typed-data.ts DELETE — EIP-712
helpers (viem `hashTypedData`, domain Bawa v1); zero references outside
itself; no dApp connect, no EIP-712 signing feature. secret-handoff.ts
DELETE — single-use in-memory secret handoff (`storeSecret` /
`takeSecret`); no consumer — mnemonic flows read from the vault closure
(`withMnemonic`); navigation carries no secrets (only `lock.tsx` `from`
state). Deleted via `git rm` with their tests. Consequential orphan (NOT
deleted — out of scope, for Lane I / repo-cleanup):
`engine/confirmation-policy.ts` (470 lines + 602-line test +
`__typetests__`) — its only production importer was the deleted adapter.

### 10. DOGE fallback — DECIDED-AND-RECORDED (owner decision needed)
Live probes from gray-pinee, 2026-11-23 ~20:03 UTC, fixture address
`DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K`: SoChain quota exhausted —
"Lookups without a key are 2,500 a day per IP, and today's are used up;
they reset at 00:00 UTC. A free API key gives you 75,000 a month..."
(Quota is per client IP, so it may work on the owner's own IP; the outage
the owner saw was SoChain 429s.) BlockCypher CORS-blocked in the real
browser (confirmed in the baseline and final CDP console errors) — dead
as a browser fallback. dogechain.info → 301 to dogechain.com;
dogechain.com `/api/v1/address/balance/{addr}` returns correct data with
rate-limit headers (limit 120, remaining 29) but NO
`Access-Control-Allow-Origin` header — browser-blocked. dogebook.com
(Blockbook): 307 to domainmonkey.com — dead domain. Trezor
`doge1.trezor.io`: 403. `blockbook.dogecoin.org`: connection failed.
Blockchair no-key: 430 "Your IP address is temporary blacklisted due to
exceeding usage of API resources. Please apply for an API key" — keyed +
blacklisted. Verdict: no working keyless fallback the browser can read.
Owner decision needed — free SoChain API key (owner creates it; 75k/month
free tier) vs Blockchair key vs accept the outage. Do NOT ship a fallback
that cannot work in-browser. The DOGE row already fails honestly
("Balance unavailable", no fake zero). Note: the fixture address was
emptied — BlockCypher says `final_balance: 0`, `total_received ==
total_sent == 1000781125175`, 6 txs — so dogechain.com's 0 is correct and
the adapter doc's "confirmed 10007.79125175 DOGE" example is stale.

### 11. ci.yml defines the web job twice — DECIDED-AND-DONE
Deleted the first `web:` job (10-min timeout, build + `npm test` only).
One `web:` job remains (20-min, full gates: typecheck, lint, vitest,
build, bundle-size, audit, pinned deps, cycles, crypto-architecture,
chains drift). YAML parses; jobs = docs-checks, e2e, floor-guard,
node-tests, python-tests, web. `e2e`'s `needs: web` still resolves.

### 12. The 16 jscpd clone pairs — DECIDED-AND-DONE (20 → 1)
Method: `npx jscpd src --min-lines 5 --min-tokens 50`, excluding
`**/*.test.ts` / `**/*.test.tsx` — 20 clones, 267 duplicated lines. The
brief's "16" does not reproduce exactly (likely jscpd version drift or
pair-vs-group counting; several pairs overlap into single blocks). The
independent repo-hygiene audit (2026-11-24) found the same 20 groups /
267 lines on token-gaps, confirming the count. Without the test exclusion
the count is 438 clones (117 ts + 321 tsx) — mostly test-file mirrors,
which are not duplication. Consolidated 19, each verified
behaviour-identical by tsc 0 + targeted tests: (H) `sameTokenAddress` /
`validUsdPrice` / `liquidityUsd` / `freshQuote` byte-identical between
`dex-prices.ts` and `price-fallbacks.ts` → new leaf module
`wallet/price-helpers.ts` (imports only `guards` at runtime + erased
types — adds no edge to the documented prices ↔ price-fallbacks ↔
dex-prices cycle); (W) `watchChains` / `exportChains` in
`wallet-management.tsx` were the same 22-chain literal twice → both
derive from `SUPPORTED_CHAINS`; (P) dex-prices' `fetchJson` was a second
copy of `prices.ts` `fetchJsonWithTimeout` → one call + remap; (ton)
`devnet-endpoints.ts` had a private copy of the exported `ton.ts`
`base64ToHex` → deleted, imported; (types) `adapters/types.ts`
`fetchJson` and the devnet BTC broadcast's inline fetch shared the
timeout/abort/HTTP-error shape → new `fetchWithTimeout` in
`adapters/types.ts`; (confirmation-policy) `evaluateTron` / `evaluateTon`
returned the same unknown-evaluation literal in five places → module-level
`unknownEvaluation(reason)` helper; (useDevnetToggle) the toggle preamble
+ logic shared by `app.tsx` `NetworkModePill` and
`devnet-setting.tsx` `DevnetSetting` → new `state/use-devnet-toggle.ts`
hook; (J) Receive/Send token-picker rows shared the `<li>` + `<button>`
shell → new `screens/token-picker-row.tsx` `TokenPickerRow`; (A)
`asset-detail.tsx` history list vs `transaction-history.tsx` rows shared
the tx `<li>` → new `screens/tx-row.tsx` `TxRow` + `formatDate` (moved
from transaction-history); (sol/trx) `checkAddress` / `rpcErrorMessage` /
`dataList` preambles deduplicated; (trx) the two `readJsonFrom` try/catch
blocks → `tryRead` thunk helper; (R) `usePrices` / `useTokenPrices` were
the same scaffolding (idle/loading/ready, mounted + in-flight guards,
no-fetch network error, 3 attempts with the same backoff, cache saved when
anything is fresh) → generic `usePriceRefresh<E>` in `prices.ts` with the
four differing pieces injected through an `implRef` (latest-ref pattern),
so the refresh callbacks keep the callers' exact dependencies. One
deliberate micro-difference, documented in the hook comment: the native
hook used to check mounted between its two per-attempt fetches (CoinGecko,
then fallbacks); the shared loop checks before and after the combined
fetch — the only effect is one fallback fetch still firing after an
unmount, its result discarded by the post-fetch mounted check, so no state
update and no cache write can follow an unmount in either version. One
clone LEFT, with reason: `state/wallet-context.tsx:1725-1733` (8 lines, 50
tokens) — the useMemo VALUE object literal vs its DEPS array listing the
same identifiers is a FALSE POSITIVE for consolidation: React's useMemo
contract requires the deps array to mirror the value; there is nothing to
dedupe without breaking the hook.

### 13. Wallet-refresh re-wire — DECIDED-AND-DONE (deleted)
`apps/web/src/state/wallet-refresh.ts` (401 lines) + tests
`wallet-refresh-characterisation.test.tsx` (280) +
`wallet-refresh-import-failure.test.tsx` (142) = 823 lines, deleted via
`git rm`. Zero production importers (only the two test files imported
`createRefresh`); `wallet-context.tsx` owns refresh inline
(`refreshBalances` / `refreshTokenBalances`). The 6 infeasibility reasons
(from `docs/MARKETING-FIX-PROGRAMME.md` (c2)): 4 hardcoded chains vs 21
registry chains; mainnet-only vs devnet-aware; different retry policy
(observable under 429s); `refreshing` / `stale` flags the context sets
and UI renders; `bawa:balances-cache:v1` the context writes; token
balances not covered at all. Redesign would mean rewriting the live
refresh path — the proved-infeasible work — so delete, with gate proof
(tsc 0, full vitest 1808 passed / 5 skipped / 0 failed on the lane tree).
Docs fixed: `docs/runbooks/refresh-failure.md` was stale (claimed
wallet-refresh.ts is "wrapped and re-exported by wallet-context.tsx" —
false; and referenced `sanitiseReason` in wallet-refresh.ts — that
function existed ONLY there; the live path produces reason tokens inline,
e.g. `wallet-context.tsx:883`); header now points at
`wallet-context.tsx` inline with the deletion noted.
`docs/HOW-IT-WORKS.md:222` refresh pointer wallet-refresh.ts →
wallet-context.tsx. Historical programme records mentioning wallet-refresh
(`docs/MARKETING-FIX-PROGRAMME.md:63`, `docs/DECISIONS.md:816,955,1021`,
`docs/REVERIFY-PROGRAMME.md:155`, `docs/GAP-ANALYSIS.md:616,618`) left as
dated records.

### Open decisions carried forward (unchanged from §18, minus the items decided above)
Live-camera scan (needs the owner's phone); review/sign (needs a funded
wallet); README showcase link (owner never named the repo — do NOT invent
it); Android Gradle (no SDK/JDK on gray-pinee); ECDSA confirmation;
one-time password migration (NOT ordered — do NOT implement); broadcast
authorisation (NOT authorised — do NOT implement); M-39 (needs
desktop/device work); QR 136/192; Receive details scroll 426 px (smaller
buttons vs top-stack rework); E2E-02 devnet-derivation race (real app
bug); faucets (owner must complete captchas); TonCenter keyed tier;
xDAI+MNT no keyless price fallback; FTM low-liquidity pair;
devnet+unlocked-vault Retry; asset-detail sticky Refresh; Number Ticker
CDP-unverified (nonzero hero needs a funded wallet, forbidden).
NEW from this lane: `engine/confirmation-policy.ts` orphaned by the item-9
deletion (for Lane I / repo-cleanup); multi-phrase vaults (owner decision
on options A/B/C); DOGE fallback (owner key decision); rotation-funds
aggregation (follow-up design); Metis history is one CORS header away
from wiring.

## §23 — FIX-ALL merge lane (Lane J), 2026-11-24

The FIX-ALL programme (Lanes A–I) was merged into `panel-rebuild/fix-all`
by cherry-pick, then merged into `panel-rebuild/token-gaps`. Coordinator:
hands-on Muse, 0 Sol calls. Base token-gaps `8191b2c`; fix-all code tip `62abe11`; merged into
token-gaps at `343cd3a` (fast-forward from `6db1d1e`; the fix-all
branch was deleted after the merge).

### What was merged

- Lane C `68aa8e6`, Lane G `0dd82de`, Lane I docs `2aab406`, Lane E
  `24fcd20`, Lane I 980 px `3fce3f7`, Lane A `3e18b7b`, Lane B `23ae583`,
  Lane D `09cf474`, Lane F `c518704`, Lane H `a72ebf7`, Lane I rename
  `6a8cdf5`. Token-gaps `df48d9c` (README-FULL fix), `3a05657` (redrawn
  diagrams), `5e88c07` (re-shot screenshots + grid) and `8aefab7`
  (HOW-IT-WORKS trace fix) merged in — none reverted.
- Merge-lane commits: `b534c4f` (Linea out of the balance-only list;
  E2E-05 manifest corrected), `62a8d59` (HOW-IT-WORKS trace
  re-verified against the merged tree: 48/48 refs pass), `313cacb`
  (Lane F tests/prose reconciled with Lane A/B data; merge join
  defects fixed).

### Decisions taken in the merge lane

1. **confirmation-policy.ts — KEEP.** Lane H's module deletion orphaned
   it (no production importer; only its own `__typetests__` file
   imports it). The owner's 2026-11-20 decision stands: the file stays
   spec-only. Orphan status recorded, not silently deleted.
2. **E2E-05 manifest — UPDATED, not landed via wallet-refresh.ts.**
   `wallet-refresh.ts` was deleted by Lane H, so landing it is no
   longer an option. `apps/web/e2e/manifest.json` E2E-05 now asserts
   the honest blank state the rewritten spec pins.
3. **Linea — out of the balance-only list.** Lane A wired Linea
   history via Etherscan V2 (keyless). Five chains stay unwired
   (bsc, gnosis, opbnb, metis, fantom), not six.
4. **CSP — 62 unique origins (57 mainnet + 5 devnet).** Union of
   Lane A's and Lane F's origin lists, minus dead `1rpc.io` (Lane A:
   -32001 usage-limit exhausted on this egress). `1rpc.io` survives
   only in comments documenting its removal.
5. **priceFallbackSourcesFor — kept as the API.** Lane F's Prices
   card states the fallback order in words rather than calling the
   function. That drift is recorded here, not re-engineered in the
   merge lane.
6. **Price-source truth after the merge (Lane B over Lane F's
   numbers):** CoinLore covers 19 chains, DexScreener 13 wrapped
   contracts; TonAPI covers TON, Coinbase covers LTC; the three
   chains CoinLore misses are all covered another way. **No chain is
   CoinGecko-alone any more** (pinned by a new every-chain test).
7. **980 px breakpoint — one port.** Lane H and Lane I ported
   desktop-layout-v2's breakpoint identically (`lg:` → `desktop:`);
   only comment wording differed. HEAD (Lane I) wording taken, plus
   both border assertions in `app.test.tsx`.

### Merge defects found and fixed in the lane

- `trx.ts`: the hand-merge left a second `resolveBaseUrls` /
  `readJsonFrom` pair and a second `identityChecked` (Lane A had
  inserted its PublicNode comment before those lines in its file).
  Removed; all declarations single; tsc clean.
- Line-join defects: the marker-regex resolver dropped the newline
  after a resolved hunk when the next line was not blank, joining
  lines in `app.test.tsx` (comment swallowed an `await`), `app.tsx`,
  `globals.test.ts` (comment swallowed an `expect`),
  `price-fallbacks.ts` (`}export function`), `HOW-IT-WORKS.md`
  (Prices + Receive rows joined) and `DECISIONS.md` (trailing
  newline). Found by tsc (TS1128); fixed by `fix-joins.py`.
- Lane F's new tests were stale against the merged data: ETH
  registry lists dRPC, not 1RPC; CoinLore covers Gnosis/Mantle/
  Fantom. Tests, Prices-card prose, HOW-IT-WORKS bullets,
  GAP-ANALYSIS (history 16 → 17 chains) and an ADR-0007 amendment
  updated to the new truth. Mantle also has a DexScreener leg
  (wrapped MNT).

### Gates on the merged tree

tsc 0, build 0, build:e2e 0, vitest 1858 passed / 5 skipped /
0 failed, lint apps/web 0, lint root 0, root test 0, npm audit
0 vulnerabilities. E2E: 23 of 27 verified passing on the merged
tree (17 in the full run, 6 more on targeted re-runs after the
stale-spec fixes: E2E-19 ETH, LANE-F switch, E2E-05, E2E-04,
E2E-02, Item D MY). 4 never passed in any Lane J run, all
live-network with per-test evidence: E2E-06 SHIB (add dialog never
opened), Item D DISC ("Token added" never appeared; Solana RPC
degraded), E2E-13 SPL USDT (Metaplex verification over degraded
Solana RPC), E2E-19 SOL fallback (backup Vibe Station unreachable).
Window-flip proof: MY failed in the full run (2.0 m timeout) and
passed on re-run (3.2 s); NOT passed in the full run (2.8 s) and
failed on re-run (2.0 m) — the suite is network-window-dependent,
not deterministically green. The full run's last three tests
initially failed on a dead preview server ([WebServer] Terminated
mid-run, ERR_CONNECTION_REFUSED) — infrastructure, not the app;
all three passed on re-run. Two stale-spec families were fixed in
the merge lane, not waived: the ETH backup is dRPC not 1RPC
(E2E-19 ETH + LANE-F switch), and the item19 custom-RPC choice
must be on the CSP allowlist (ankr -> Flashbots; the manager
correctly rejects ankr with "the browser would block it"). CDP
re-verification at 390/820/980/1440/1919 with screenshots viewed
(see Lane J report).

### Branch deletions (Lane I list, executed by Lane J)

Deleted after the merge, each verified first-hand with 0 unique
code and confirmed by fresh ls-remote: `devnet-temp` (`915054b`),
`token-discovery` (`176613f`), `ui-ux-fixes` (`333880f`),
`adopt-proper` (`21ce11d`) — their unique commits were all
programme-record docs, superseded by token-gaps' corrected
versions (their `CREATE-EXAMPLE-WALLET.md` copies carried a stale
blob: no `-L`, wrong wasm path, absolute GitHub link, vs
token-gaps' corrected `b8319c2`); `readme-marketing` (`8aefab7`,
0 unique commits, ancestor of token-gaps — its work had already
landed as `6d4bfbf`/`6db1d1e` on token-gaps and `bcc8555`/`8126b8e`
on main); `fix-all` itself (`343cd3a`, tip == token-gaps tip after
the merge). KEPT: `desktop-layout-v2` (`15af54c`) — 40 unique code
files (+1,755/−197 since merge-base `67c48e2`): the two-column
desktop layout (`ed0abba`/`0e194f4`) deliberately not ported by
Lane H (v2 regressions; only the 980 px shell was ported).
Final remote count: 4 branches — main, token-gaps, gh-pages,
desktop-layout-v2.

### Merge-lane fixes found by re-verification (after the gates above)

8. **E2E specs expected dead 1RPC as the ETH backup.** E2E-19 ETH
   and the Lane F switch spec asserted `1rpc.io`; the merged registry
   lists dRPC (Lane A). Fixed to `eth.drpc.org`; the Lane F switch
   test then passed live (10.2 s). The item19 custom-RPC choice
   (ankr) is correctly rejected by Lane F's allowlist gate ("the
   browser would block it") — replaced with Flashbots, which is on
   the allowlist and not in the registry; the test then passed.
   The full run's last three tests failed on a dead preview server
   ([WebServer] Terminated mid-run) — infrastructure, not the app;
   all three passed on re-run.
9. **Linea history rendered "No transactions yet" on re-verification.**
   Root cause, proven live: Etherscan V2's keyless tier is 1 request
   per 5 s per IP and answers NOTOK "Missing/Invalid API Key" inside
   the window — the same message as a missing key. The app fires the
   history refresh twice in quick succession, the second call lands
   inside the window, and the store's request counter discards the
   first (good) result, so the page ends empty. An empty `&apikey=`
   parameter was tried first and proven a placebo (a quiet call
   without it returns status 1; a call inside the window still
   returns NOTOK with it) — reverted, not shipped. Fix: the EVM
   adapter retries a keyless-quota NOTOK once after 6 s, with a
   regression test. Proved live in CDP: NOTOK, NOTOK, then status 1
   with the real tx, and 0x75dfb5f5... renders under Recent
   transactions (five real Linea txs for the watched address).

## §24 — Docs audit: main README and docs refreshed to the current live wallet (2026-11-28)

Branch `docs-audit-main-2026-11-28`, off `main` `af828a9`. Hands-on Muse, 0 Sol calls. Docs only; no code merged from `token-gaps` into `main`.

- **Why:** the owner flagged (2026-11-28 ~20:05 IST) that main's README and docs were being ignored while the live wallet moved on. Verified: main's README still showed the 2026-11-23 showcase (2 dashboard screenshots) and quoted the `667527e` verification snapshot, with no pointer at the current live build.
- **What changed on main:** README Showcase now embeds the current live-wallet previews from `panel-rebuild/token-gaps` `docs/preview/` (raw.githubusercontent.com, no duplication into main) plus a "Live wallet (current state)" section; the stargazers badge link was fixed (the old `/stargazers` URL returns HTTP 404); test counts re-confirmed at `af828a9` (test files unchanged since `667527e`; static counts 48 launcher / 26 `make_wallet`; smoke 136 stands by file identity and determinism). GLOSSARY `btc-change` corrected (the launcher's `CHAINS` set is `btc`/`eth`/`trx` only). FAQ testnet/mainnet wording reconciled. HOW-IT-WORKS scope updated from `2c161b7` (65 commits behind) to current tip `ceade79` with the live build pointer. TESTING line references corrected. FURTHER-READING, docs/10 and docs/12 re-pinned/re-checked (npm `latest` is now 4.10.0; installed pin stays 4.9.3 by owner order; registry sources re-verified at 4.9.3). docs/SECURITY disclosure and auto-lock statements corrected. wallet-lifecycle auto-lock and token-gaps references corrected. WEB/ANDROID guides carry a pointer to the finished live wallet (they remain from-scratch testnet drafts).
- **Current live state (2026-11-28, `panel-rebuild/token-gaps` `ceade79`, Pages build `index-Brm7r34g.js`):** 87 chains; dashboard 43 rows (22 natives + 21 tokens); history verified on 18 chains, 4 history-blocked (bsc, opbnb, metis, fantom). Fix programme landed: remove token, change password, watch balances, wallets rename/delete, native TRX PublicNode fallback, chart retry, Activity wallet switcher. QR-card redesign in polished flat style. Honest remains fixed: BSC third RPC (DeFiBit), dashboard 43, BNB header icon. Auto-lock optional, off by default. Still open at `ceade79`: TRON USDT token-path PublicNode fallback, wallet creation under `vite dev` (WASM path), persistent `mmdc` path. Detail of the honest remains lives on `token-gaps` in DECISIONS §48.
- **Not changed:** dated programme records (EXPANSION, TOKEN-VERIFY, TOKEN-EVERYWHERE, FINISH-PRODUCT, FIX-ALL, MARKETING-FIX, README-MARKETING, UI-UX-FIXES, UI-UX-ROUND2, REVERIFY, DEEP-AUDIT-DEVNET), GAP-ANALYSIS, README-FULL (frozen 2026-11-08 archive), ADR-0011, and `captcha/` third-party content (two broken upstream links found there — HUMAN Security Learn and the feder-cr Turnstile write-up — reported, not rewritten).
