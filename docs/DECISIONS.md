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
commit `69f7d8c` + SVG fix `e0f0c0a`. Merged into `token-gaps` as `8191b2c`.

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

## §24 — QR share-card programme, Lane E (implement + verify + merge) — 2026-11-25

**Decision: ship the four QR-card templates (B Paper default, A Dark
Teal, C Minimal, D Poster) with the PNG exporter drawing the same
card as the in-app one, and a template picker on Receive driving
both. The palette exception, the A centre-mark fix, the in-app wrap
gap, and the bundle overage below are recorded here, not hidden.**

What was done (branch `panel-rebuild/qr-cards-lane-e`, merged into
`panel-rebuild/token-gaps`):

- `apps/web/src/wallet/payment-links.ts`: `qrCardToPngBlob` /
  `qrCardToPngFile` rewritten in place (no parallel exporter) — the
  full card per template, measured first then drawn, 1080 px export
  from Receive, 640 px default. `QrCardTemplate`, `QR_CARD_TEMPLATES`,
  `DEFAULT_QR_CARD_TEMPLATE = 'b'`, `QR_CARD_TEMPLATE_QR`.
- `apps/web/src/screens/qr-card.tsx`: the four in-app templates
  (`data-template`, default B); `NetworkSubtitle` bolds the network
  name in every template.
- `apps/web/src/screens/receive.tsx`: "Card style — tap to switch"
  picker (all four templates, `aria-pressed`, active `bg-sun`)
  driving the card and the PNG; share/download/copy-link flow itself
  unchanged.
- E2E: `e2e/qr-card-templates.spec.ts` (every template shares a PNG
  decoding to the payment URI; viewports 390/820/1440/1919) and
  `e2e/png-decode.ts` (the decoder extracted from
  `item4-qr-share.spec.ts`, which now imports it).

1. **Palette exception — the one confined breach of the 4-colour
   cap.** The templates need their colours (dark-teal family, two
   greys, near-black, pre-blended white-dim for D's subtitle), so
   ten named `--qr-*` tokens were added to `globals.css` (`--qr-teal`,
   `--qr-teal-deep`, `--qr-teal-band`, `--qr-teal-copy`, `--qr-bar`,
   `--qr-muted`, `--qr-grey`, `--qr-faint`, `--qr-nearblack`,
   `--qr-white-dim`), exposed as `bg-qr-*` / `text-qr-*` utilities,
   and exactly those ten literals (+ the minified `#111` form of
   `#111111`) were added to the `palette-audit.mjs` allowlist and to
   the `globals.test.ts` palette assertion. The cap still governs the
   whole app: the tokens are used ONLY by the QR card and its PNG
   exporter, and no further literal may be added without a recorded
   decision here. Raw arbitrary hex in `qr-card.tsx` was replaced by
   the token utilities; the audit passes (40 approved literals).
2. **Template A centre mark — the white diamond, not a white
   circle.** First viewed PNG showed a blank white circle on the
   coral disc: the repo's chain logos carry the glyph on a near-white
   disc (ETH asset measured: disc luminance 244, glyph <= 131), so a
   plain `source-in` white fill keeps the whole disc. Fix, in both
   the PNG exporter (`buildWhiteSilhouette`) and the in-app hook
   (`useDiscLogoImage`): after drawing the logo, pixels brighter
   than luminance 160 go transparent, then the `source-in` white
   fill — the dark glyph alone becomes the white mark. A logo whose
   glyph is itself light degrades to no mark rather than a white
   circle. Unit test proves the threshold (fake pixels 50/244/100/244
   -> alphas 255/0/255/0). Re-viewed PNG shows the white ETH diamond
   on coral, as in Lane D's preview.
3. **In-app address wrap — known parity gap, accepted.** The PNG is
   full-bleed 352 px and wraps a 42-char address to 2 lines in A (21
   per line), as specified. In-app the card is 322 px wide (the
   screen's locked `Card padding="sm"` + content column), so the A
   footer address wraps to 3 lines at 390 px (measured: card 322,
   band 274, address container 178 px at 17 px JetBrains Mono) and
   B's address box to 2 lines instead of the PNG's 1. Fixing it
   would need shrinking the address font below the design size or
   widening the card past the locked layout — both worse than the
   extra line. The full address is shown in-app, nothing truncated
   or overlapping; the shared PNG is exactly per spec. At desktop
   widths the in-app card wraps to 2 lines.
4. **Bundle over budget — reported, not re-baselined.** Merged
   tree: total JS 4,180,185 bytes against the 4,177,711 budget
   (over by 2,474, 0.06%); largest chunk 2,905,015 (under the
   3,050,000 limit). The lane adds 19,655 bytes over the
   token-gaps `ed412d6` baseline (4,160,530); the headroom was
   17,181. Two legitimate shrinks were tried (shared subtitle /
   address draw helpers, D title de-duplication) and saved ~60
   bytes; no designed functionality was cut to fit. The CI bundle
   gate will fail on token-gaps until the owner orders a
   re-baseline or a trim.
5. **Template A stays conditional on a phone decode test.** The
   jsQR matrix below proves A decodes in Chromium, but A is
   inverted (white on dark teal) and the phone-camera matrix (iOS +
   Android) cannot be done on the VM — unconfirmed, do not claim it.

**Decode matrix (repo jsQR, `inversionAttempts: "attemptBoth"`,
real exporter + real app SVGs for logo-on, Python `qrcode` EC-H
SVGs for logo-off): 32/32 passed** — 2 payloads (bare address v7
45x45, payment URI `ethereum:0x…@1` v8 49x49) x 4 templates x logo
on/off x 640/1080 px. Extras 9/9: D at the 320 px export floor (300
is below the exporter's 320 minimum and is rejected, not rendered);
Solana base58 (44 chars) in A/D at 640/1080; Bitcoin bech32 (62
chars) in A/D at 1080, including one logo-on cell (disc over
non-excavated modules). The 62-char address wraps to 3 lines in A
(the band grows, no clipping) and 2 in D. Harness note: the first
matrix run failed 16/16 logo-on cells because the extraction read
the SVGs with `outerHTML`, which drops the `xmlns` the data-URL
image load needs — the app serialises with `XMLSerializer`, which
keeps it; the harness was fixed to do the same and then passed
32/32. The matrix harness itself was temporary and deleted.

**Gates on the merged tree:** tsc 0, build 0 (palette audit
passed), vitest 2809 passed / 5 skipped / 99 files, eslint 0, E2E
`qr-card-templates` + `item4-qr-share` 2/2 passed. Viewed by eye:
all four PNGs against the Bitget screenshot and Lane D's previews,
and the Receive screen at 390/820/1440/1919.


## §25 — Receive redesign + three more QR templates (Lane 4) — 2026-11-25

**Decision: add templates E (Sun), F (Ink), G (Ticket) — seven templates
total, default still B — and reorder the Receive details step so the
amount sits under the card and Share is the first action after it.
No new colours, no new dependency, no re-baseline. The bundle is over
budget by 7,289 bytes; reported, not re-baselined (see 5).**

What was done (branch `redesign/receive-qr`, local-only, not pushed):

- `apps/web/src/wallet/payment-links.ts`: `QrCardTemplate` extended to
  `'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'`; `QR_CARD_TEMPLATES` now
  lists seven (order: b, a, e, f, g, c, d); `QR_CARD_TEMPLATE_QR` gains
  E 210 ink-on-white logo 42 (20%), F 208 ink-on-white logo 40 (19%),
  G 200 ink-on-paper logo 44 (22%). Layout + draw branches for E/F/G
  added to `layoutQrCard` / `drawQrCard` (E/F share a centred-card
  layout helper and a header helper — factored after the first build
  showed the bundle over; saved 607 bytes). The PNG exporter draws the
  same card as the in-app one for every template, as before.
- `apps/web/src/screens/qr-card.tsx`: in-app E/F/G branches
  (`data-template` e/f/g). E and F share a `CentredQrCard` component.
  G is the two-tone ticket: paper top, sun bottom, dashed tear rule
  with punched notches. `BrandMark` gains an optional
  `markTextClassName` (F's sun mark carries an ink B). In-card Copy
  controls raised to 44 px hit areas (B's pill `min-h-11`, C's text
  Copy `py-3`, D's glyph button `p-3 -m-3` — visuals unchanged).
- `apps/web/src/screens/receive.tsx`: details step reordered to card →
  amount → Share (coral, full-width, lg) → Download card + Copy link
  (outline, half-width, lg) → status → 7-template grid picker →
  compact QR-type segments → share-link line → rotation block
  ("Receiving address N" + New address + note). "Copy address" removed
  (the card's own Copy button is the one copy control). The QR-type
  row's 64 px mini-QR thumbnails removed (all three looked identical
  at that size and no 64 px code is scannable). The two below-card
  warnings merged into one paragraph. Action buttons raised from `sm`
  (32 px) to `lg` (48 px); picker segments to 44 px hit areas.
- Tests: `payment-links.test.ts` gains hand-computed E/F/G geometry at
  640 px (E 640×1185, F 640×1182, G 640×1083); `qr-card.test.tsx` gains
  E/F/G renders and the bold-network loop now covers all seven;
  `receive.test.tsx` gains order assertions (amount → Share → picker)
  and the one-copy-control / New-address-placement tests; E2E
  `qr-card-templates.spec.ts` covers all seven templates.

1. **No new colours.** E/F/G are composed entirely from the four core
   colours plus the ten `--qr-*` tokens from §24 — no new literal was
   added, and the palette audit still passes with the same 40 approved
   literals. The §24 exception is not extended; it is reused.
2. **No new inverted code.** A stays the only inverted template. E, F
   and G are all dark-on-light (ink on white/paper), so the new
   templates add no new decode risk — but their phone-camera results
   are still unconfirmed, like every other template's.
3. **Design-system §6 reading, recorded.** §6 says Share / Download /
   Copy-link sit "directly under the card". This lane reads that as
   "the first actions after the card unit" — the amount input sits
   between card and Share because the amount is displayed on the card
   and encoded in its QR. The alternative (Share immediately under the
   card, amount above it) would push the QR ~90 px further down the
   page, which the audit showed is already half-cut at the mobile
   fold. If the owner wants the letter of §6, the amount goes above
   the card.
4. **Proposed owner decision (NOT built): two-column desktop Receive.**
   At 1919 the details column is ~448 px with ~700 px empty each side.
   A two-column desktop layout (card left, controls right) would put
   the whole share task on one 1440/1919 screen, but DESIGN-SYSTEM
   §4.1 caps `/receive` at a 480 px single column "at every width".
   Recorded here for the owner; desktop stays single-column until
   ruled.
5. **Bundle over budget — reported, not re-baselined.** Lane tree:
   total JS **4,192,289** vs 4,185,000 budget (**over by 7,289,
   0.17%**); largest chunk 2,905,015 (under 3,050,000). The lane adds
   12,104 bytes over the `7fea3e4` baseline (4,180,185; headroom was
   4,815). One legitimate shrink was done (E/F factoring in the card
   and the exporter, 607 bytes saved); no designed functionality was
   cut to fit. The CI bundle gate fails on this branch until the owner
   orders a re-baseline or a trim elsewhere.
6. **Audit findings (measured first-hand, CDP, 390/820/1440/1919).**
   The QR was half-cut at the mobile fold (card starts 318 px down,
   QR ~560 px, fold ~770 px with the fixed bottom nav); the amount
   input sat 406 px below the card it controls; the 4-segment picker
   could not hold 7 templates (hints already wrapping to 3 lines);
   Share was 3rd of 5 buttons, below the fold at every viewport; the
   network warning was said three times. All five are fixed by the
   reorder above except the fold itself: the card + header stack is
   still taller than a 390 px viewport, so Share is one short scroll
   away rather than visible on arrival — the header stack (asset row,
   owner-restored tagline, network alert) was not cut. Chain/token
   steps were clean and are untouched.

7. **Parity notes found in verification (same class as A's accepted
   gap, §24.3).** (a) G's address wraps to 2 lines in-app at 390 (the
   in-app card is 322 px wide) but fits 1 line in the PNG (390 design
   units) — a width-driven wrap difference, like A's. (b) G's PNG
   border is a plain rounded rect; the in-app card uses the hand-drawn
   wobble radius (canvas `roundRect` cannot express it). (c) E's
   address wraps with a 3–4 character tail ("A37") in both the in-app
   card and the PNG — full address, no truncation. (d) Cosmetic:
   "Download card" wraps to two lines in its half-width button at 390,
   and "Payment request" wraps the same way in the QR-type row. Both
   stay legible and tappable.
## §26 — WalletConnect (Lane C, "install all usable" programme) — 2026-11-25

**AMENDMENT — REMOVED (providers programme, 2026-11-26).** WalletConnect was removed from the web wallet in commit `7fb1c4a` (providers Phase 2, on top of the guide merge `5ef6416`). Reason, proven from WalletConnect's own docs and a live test: the relay authenticates the Cloud projectId and the owner has none — without one the relayer never connects and `connect()` yields no pairing URI, so the screen, its client modules, the lazy route/nav/CSP entries and both `@walletconnect/*` 2.21.0 dependencies were removed rather than shipped dead. The Security screen carries a restoration note. Restoration: free account at https://cloud.reown.com, a project, the projectId in `VITE_WALLETCONNECT_PROJECT_ID`, and the files from git history. The record below is the 2026-11-25 integration as it stood; it binds any restoration (Apache-2.0 2.21.0 pin, lazy-load, message-signing only).

Branch `usable-lane-c-walletconnect` (from token-gaps `7fea3e4`),
hands-on, 0 Sol calls (AgentRouter API stopped by owner order).
Wires WalletConnect dApp connectivity into the web wallet: a
`/walletconnect` screen (sidebar "More" section on desktop, "More"
menu on mobile) that pairs with a dApp by `wc:` URI, shows the
session proposal for approve/reject, and answers signing requests
from the dApp.

1. **Licence pin — Apache-2.0 2.21.0, no Reown licence.**
   `@walletconnect/sign-client` and `@walletconnect/utils` are
   pinned exact at **2.21.0**, the last Apache-2.0 release. 2.22.0+
   switched to Reown Inc.'s custom Community Licence (mandatory
   Reown gateway, commercial licence above 500 MAU/month, Reown
   owns modifications); accepting it is the owner's call, not this
   lane's. Verified first-hand from the installed tree: sign-client,
   core, types and utils all 2.21.0 Apache-2.0 (the 1.x support
   packages are MIT); no Reown-licenced package in the tree. The
   npm registry confirms 2.21.0 is Apache-2.0.
2. **Lazy-load — the SDK never enters the main chunk.** The only
   runtime import of `@walletconnect/sign-client` is a dynamic
   `import()` inside `connect()` in `screens/walletconnect.tsx`,
   via the boundary module `wallet/walletconnect-client.ts`.
   `relay.walletconnect` occurs in `walletconnect-*.js` (route) and
   `walletconnect-client-*.js` (lazy) and 0 times in `index-*.js`.
   Browser-measured (Playwright network log, `vite preview` of
   `dist/`): home load fetches 21 JS files, 564,002 bytes, none of
   them WalletConnect; navigating to `/walletconnect` adds only the
   route chunk and `hashTypedData`; the lazy client chunk loads
   only when a projectId is configured and `connect()` runs.
3. **Message-signing only — sending stays off.** Approved methods:
   `personal_sign`, `eth_signTypedData`, `eth_signTypedData_v4`,
   `eth_chainId`, `eth_accounts`. `eth_sendTransaction` /
   `eth_signTransaction` are never approved: signing a transaction
   would let the dApp broadcast it and move funds, which is sending
   through the back door. Only the `eip155` namespace is served;
   SIWE `session_authenticate` is rejected with
   `WC_METHOD_UNSUPPORTED` (10001) so the dApp does not hang.
   Signing borrows the mnemonic inside the vault closure
   (`withMnemonicAsync` + `createPartialSigner`, `wallet/core.ts`)
   and never lets it leave; Wallet Core returns raw recovery 0/1,
   so Ethereum message signatures get +27 (v 27/28) in
   `wallet/walletconnect-signing.ts`.
4. **projectId — configuration only, never hardcoded, never
   shown.** The owner enters it on the screen (saved to
   `localStorage` under `bawa-walletconnect-project-id`) or sets
   `VITE_WALLETCONNECT_PROJECT_ID` at build time; the saved setting
   wins. Without one the screen says plainly that a WalletConnect
   projectId is needed, and no client is loaded. The saved value is
   never rendered — the screen says only that one is saved.
   Approve requires the vault to be unlocked. Relay
   `wss://relay.walletconnect.org`; Verify API
   `https://verify.walletconnect.org` (fallback
   `https://verify.walletconnect.com`) — both added to the CSP
   `connect-src` in `security-headers.ts` with an evidence comment.
   No other WalletConnect origin is pinned (telemetry/push hosts
   deliberately not added).
5. **Audit fix without touching the SDK version.** The install
   introduced 7 vulnerabilities (baseline `npm audit` was 0), all
   inside the `@walletconnect` tree and all with a fix pointing at
   sign-client 2.26.0 (Reown-licenced, forbidden): `decode-uri-
   component` 0.2.2 (via `query-string` 7.1.3) and `ws` 8.18.0
   (pinned exactly by the nested `viem` 2.23.2). Fixed by scoped
   overrides under `@walletconnect/utils` in `apps/web/package.json`:
   `decode-uri-component` → 0.5.1 (0.6.0 does not exist) and `viem`
   → `{ ws: 8.21.0, isows: { ws: 8.21.0 } }`. The `ws` override
   only took after the stale lockfile entry
   `node_modules/@walletconnect/utils/node_modules/ws` was deleted
   and `npm install` re-run; `npm ci` from the resulting lockfile
   reproduces the tree and `npm audit` reports 0 vulnerabilities.
   The override rationale lives here, not in `package.json`
   (JSON has no comments — an earlier `//` comment in the file
   broke `npm install` and was removed).
6. **Bundle over budget — reported, not re-baselined.**
   `npm run build` on this lane: total JS **4,577,447** bytes
   against the 4,185,000 budget (over by 392,447); largest chunk
   2,905,067 (under the 3,050,000 limit). Base `7fea3e4` was
   4,180,185, so the lane adds 397,262. The lazy
   `walletconnect-client` chunk is 348,194; the route chunk is
   17,372 and its `hashTypedData` split 15,929; `secp256k1`
   (30,367) is imported only by the lazy chunk. Dist total
   excluding the lazy chunk is 4,229,253 (still over by 44,253);
   excluding all four WalletConnect-only chunks it is 4,165,585
   (under by 19,415 — the non-WalletConnect tree is ~630 bytes
   bigger than base). Initial-load JS on home, browser-measured,
   is 564,002 bytes. The CI bundle step sums all of
   `dist/assets/*.js` as written and will fail; `ci.yml` was NOT
   edited — weakening the gate is the coordinator/owner's call.
7. **Live connection NOT verified — needs the owner's projectId.**
   CDP-verified at 390/820/1440/1919 (entry point visible in the
   More menu on mobile, in the sidebar on desktop; the honest
   missing-projectId state; screenshots in the lane report).
   A run with a bogus projectId shows the client initialises
   without error — `SignClient.init` does not validate the id;
   the relay rejects it at pair time, and the pair error is shown
   then. No real projectId exists in this lane and no live dApp
   connection was attempted; that step needs the owner's
   WalletConnect Cloud projectId.

**Gates on the lane tree:** tsc 0, build 0 (palette audit passed),
vitest 2856 passed / 5 skipped / 103 files (46 new tests, all in
the four WalletConnect files), eslint 0, `npm audit` 0
vulnerabilities, secret scan exit 0 (`node
scripts/secret-scan.mjs`). Viewed by eye: the WalletConnect screen
at 390/820/1440/1919 (missing-projectId state) and the More menu at
390.


## §27 — Bundle budget re-baseline to 4,650,000 (owner order) — 2026-11-25

**Decision (owner order, commit `7a170f4`):** the web bundle budget is
re-baselined a second time, 4,215,000 → **4,650,000** total JS in
`dist/assets` (largest chunk unchanged, ≤ 3,050,000). The merged tree
measures **4,648,952** total JS (largest chunk 2,906,541) and passes by
**1,048 bytes**. `CONSTRAINTS.md:40` and the CI bundle-size gate
(`.github/workflows/ci.yml:193`) enforce 4,650,000.

**Why (recorded so the next re-baseline is a decision, not a reflex):**
the first re-baseline (4,185,000 → 4,215,000, commit `4a12409`) covered
redesign growth (+30,623; the trim hunt found no legitimate trim ≥
25,808 — see §28). The second covers the six Part A integrations: most
of the growth is on-demand lazy code the gate counts anyway —
WalletConnect 348,194 B, jsQR 129,986 B, Shamir library 4,785 B (route
chunk 10,085 B) — none of it on the cold-load path (home cold load
fetches 564,002 B, no WalletConnect). Headroom is now 1,048 bytes
(0.02%): any addition over ~1 KB is a budget decision. Whether the gate
should exclude lazy chunks is an open owner question, not a lane
decision. Full rationale: `docs/CREATE-THIS-SPEC.md` §0.2; numbers:
`PERF.md` (merged-tree row, 2026-11-26).

## §28 — UI redesign programme, Lanes 1–3 and 5–6 (merged 2026-11-25)

**What:** the full redesign (drawing-illustration style, 4-colour cap)
landed on `panel-rebuild/token-gaps` in six lane merges from base
`7fea3e4`, tip `a81b6f8` (six merges + one e2e helper fix). Only Lane 4
(Receive + QR templates E–G) was previously recorded here (§25); this
section records Lanes 1–3 and 5–6 so the guide does not stay silent on
five sixths of the redesign. Design foundation:
`docs/DESIGN-SYSTEM.md` (moved into the repo by the guide-update pass,
2026-11-26; originally the redesign programme's Lane 0 document).

| Lane | Scope | Branch / commit | Merge |
| --- | --- | --- | --- |
| 1 | Shell + dashboard | `redesign/shell-dashboard` `44496b7` | `0a8ad30` |
| 2 | Assets list + detail + history | `redesign/assets-history` `4a56320` | `2546eda` |
| 3 | Send redesign | `redesign/send` `168631f` | `34e2a03` |
| 5 | Onboarding + watch-only + Add Token | `redesign/onboarding` `bc669d9` | `69aff9c` |
| 6 | Track + Networks + Settings/Security | `redesign/settings` `44e9549` | `d9d6384` |
| 4 | Receive + QR templates E–G | `redesign/receive-qr` `c811e9b` | `754347e` (see §25) |

**Gates on the merged tree (tip `a81b6f8`):** `tsc --noEmit` 0 errors;
`npm run build` exit 0, palette audit passed; eslint 0; vitest 99
files, 2,829 passed + 5 skipped, 0 failed; QR e2e 7/7 (all templates
decode via jsQR to the same payment URI); CDP sweep 4 tests, 91
screenshots — no horizontal overflow on any route, zero `pageerror`s.

**Bundle at merge:** 4,210,808 — over the then-budget (4,185,000) by
25,808, which blocked the push until the owner ordered the
re-baselines (§27). The trim hunt found no legitimate trim ≥ 25,808:
no duplicated helpers, no PNG-draw duplication, no oversized imports;
a trim would have had to cut live feature code (receive + send +
import-wallet growth combined). Lane 5 vs Lane 6 reconciliation
(wallet-management / welcome) is recorded in the programme record
(`~/workspace/bawa-redesign/PROGRAMME.md`).

**Also recorded here:** "Popular chains" was removed from the
homepage by owner order (finish-product Lanes G–J) — do not re-add
any chain marketing strip to the dashboard (`docs/DESIGN-SYSTEM.md`
§6). The single "Create wallet" button rule and the 44 px touch rule
are in the design system (§2.5, §6); the 44 px gap in `Button`
(`sm` 32 px, `xs` 28 px, `icon-sm` 32 px) was still open at merge
time and is being closed by the ux-major programme (uncommitted at
the guide-update pass — nothing to record yet).

## §29 — Live-preview republish + G1–G15 closed (2026-11-26, guide-update pass)

**Republish:** `gh-pages` was at `3635412` — "Publish token-gaps `7a170f4` to GitHub Pages (redesign + 87 chains + WalletConnect + Buy + Shamir + ERC-7730, bundle re-baselined to 4,650,000)" — verified first-hand by `git ls-remote` + `git log origin/gh-pages` on 2026-11-26. Republished 2026-11-27 from token-gaps `8a1d681` (`gh-pages` `d9a24e8`, verified first-hand by `git ls-remote`); the Pages site serves the token-gaps `8a1d681` build.

**Live-preview gaps G1–G15: closed.** D1–D3 are fixed in code on
token-gaps; D4 (indexer slowness on some chains) is inherent to the
upstream indexers, not a Bawa defect — no code fix is owed for it.
**Caution, standing:** a `browser.open` text fetch of the Pages site
once rendered "84 chains" from a stale crawl cache (observed
2026-11-26); re-checked 2026-11-28 the fetched text renders
"87 chains", matching the served build — trust the served asset
hash, not the fetched text, when checking the live chain count.

## §30 — Bundle budget re-baseline to 6,000,000 (owner order) — 2026-11-26

**Decision (owner order, commit `f5a5f19`):** the web bundle budget is re-baselined a third time, 4,650,000 → **6,000,000** total JS in `dist/assets` (largest chunk unchanged, ≤ 3,050,000). The merged tree measures **4,690,725** total JS (largest chunk 2,906,541) and passes by **1,309,275 bytes**. `CONSTRAINTS.md:40` and the CI bundle-size gate (`.github/workflows/ci.yml:193`) enforce 6,000,000.

**Why (recorded so the next re-baseline is a decision, not a reflex):** the UX-major programme put the tree at 4,690,725 against the 4,650,000 budget — 40,725 over, with no legitimate trim found; most of the growth is on-demand lazy code the gate counts anyway. The owner ordered 6,000,000 as the typed word, superseding the 4,700,000 and 4,695,000 taps. Headroom is now 1,309,275 bytes.

## §31 — Registry validator upgraded to v4 (2026-11-26, commit `2a0fa75`)

**Decision (registry-fix programme, commit `2a0fa75`):** the registry validator is upgraded from v3 to v4 — version check 3 → 4, `chainSupport` keys use the 87-chain schema vocabulary, the v4 profiles rule replaces the v2 model; history I&V goes 10 → 17 chains and the schema enum 84 → 87 (+cardano, kaspa, starknet). The validator exits 0 with 0 errors; registry tests 29/29. The same commit records the 6,000,000 re-baseline in §30 and the CHANGELOG. Pushed `e9d3d3d` → `2a0fa75`.

## §32 — Providers programme pushed (owner order 2026-11-26, pushed 2026-11-27, commit `e9d3d3d`)

**Decision (providers programme):** WalletConnect is REMOVED (no projectId; the relayer never connects, `connect()` hangs, the WebSocket probe returns JSON-RPC error 3000 "JWT is missing"; restoration needs a free Reown Cloud projectId), the Buy picker lands on Receive (`receive.tsx` `?buy=1`: Ramp first, then MoonPay, Onramper, Banxa Referral, Transak, Mercuryo, Coinbase as-is; no key invented, every row says "Not set up yet" with exactly what is needed), and Swaps land (`swap.tsx`: gas.zip refuel, Relay quotes-first behind a configurable proxy, STON.fi TON corridor, LI.FI stays). Guide spec §11, §12.1 and §12A updated. Provider keys are all still missing — owner inputs, none invented; the Relay proxy is unconfigured. Owner approved the push 2026-11-27 00:06 IST.

## §33 — STON.fi Lanes A–C merged (2026-11-27, commit `8a1d681`)

**Decision (STON.fi lanes A–C):** `@ston-fi/omniston-sdk@0.8.13` is installed (exact pin, MIT verified from the installed package), live quotes are wired (`fetchStonfiQuote` over `wss://omni-ws.ston.fi`; proven live 2026-11-27: 1 USDT on TON → 0.972388 USDC on Base, "Best quote"), and TON order signing is wired (`signStonfiOrderTonOffline` in `stonfi-signing.ts` returns the signed BoC only, V4R2, mode 3; 15 tests). TRON stays live-unverified and is never offered; no current official per-transaction limit is published; execution/broadcast still needs the owner's separate go-ahead. Gates at `8a1d681`: tsc 0, eslint 0, build 0, vitest 120 files / 3,121 passed + 5 skipped, bundle 4,457,283 / 6,000,000.

## §34 — Style decision: option B — polished financial style (owner, 2026-11-27 ~18:26 IST)

**Decision (owner):** option B is picked — polished financial style everywhere, illustration only for brand moments — PLUS keep a tiny fraction of the paper/comic theme. Money screens (dashboard, asset rows, Send, Receive, Swap, recovery phrase) go fully polished: flat, hairline, tabular, real semantic colour. The paper/comic theme stays only in a tiny bounded way: QR card templates, the Welcome illustration, at most one small brand touch per screen. The recovery-phrase screen goes first under the style work; the QR card is untouched.

**What this reverses:** the 2026-11-20 order to rebuild the layout fully in drawing-illustration style is reversed for the money screens (it stands only for the bounded brand moments above). P0 is the first build under this decision (its commits carry "style B": `2d65daf`, `bee40ee`, `33f1ff1`); P1/P2/P3 follow.

## §35 — Bug-hunt fixes: 69 findings, all resolved (2026-11-27, tip `7efba14`)

**Decision (bug-hunt programme):** all 69 findings from the six-lane hunt (run at `8a1d681`; lane reports in `bawa-bughunt/`: A 12, B 3, C 11, D 18, E 16, F 9) are fixed: 1 blocking use, 20 visible to the user, 37 latent, 10 cosmetic, 1 flagged needs-a-second-look. Fix commits: `8247437` (Lane A + A-7), `f999ccf` (Lanes C + F), `ae135f8` (Lane D), `d156657` (Lanes B + E + F2), `7efba14` (D-18 cleanup).

**Top fixes:** BTC exact-spend / dust-change signing (Lane A finding 3, confirmed by probe against the real WASM core: exact spend and 59-sat dust change both failed signing with "Signed outputs do not match the plan" before the fix); vault KDF validation; review-intent binding for EVM / EVM-token / SOL / SPL (`send.ts`, A-7 — the intent created at review time is asserted before any key is used; a mismatch refuses with `intent-mismatch`); STON.fi signing wired into Swap, with a live probe catching a missing HTLC secret; the backup-gate false promise removed as copy-only; `7efba14` drops `export` on 251 internal-only names (D-18), corrects D-15 unwired references, and removes stale Vibe Station comments.

**Still open (follow-ups, not fixed here):** BTC / TRX / TON signing is still unbound to the review intent (`send.ts` lists only EVM, EVM-token, SOL and SPL as asserting intent); the real backup gate is not implemented (`security-settings.tsx`: "no backup gate exists"); chainSupport "etc" key wart.

## §36 — Desktop-layout merge (2026-11-27, `34849a2` → `b65e8c3`)

**Decision (desktop-layout merge):** tag `archive/desktop-layout-v2` is merged into `panel-rebuild/token-gaps` (`34849a2`, 29 files, +1,141/−277), then pushed as part of token-gaps `b65e8c3`.

**Verified:** 980 px shell breakpoint (`globals.css`: Chrome and Brave force the layout viewport to exactly 980 CSS px in "Desktop site" mode); sidebar 224 px with 15 links at 980 / 1280 / 1440, hidden at 390 / 820.

## §37 — Android programme: step 1 done, toolchain proven, steps 3–6 blocked (2026-11-27)

**Decision (Android programme, owner-approved 2026-11-27):** step 1 is done — the versioned JSON export of the web wallet data (commit `58d85c5`, 2026-11-26 23:18): `registry/chains.json` 87 chains, 169 RPC endpoints, 21 tokens, 4 testnets; regenerated at `b65e8c3` (generatedAt 2026-11-27T00:44:31Z, sourceCommit `7efba14`, sourceDirty false).

**Toolchain (installed and proven on loud-stone, verified first-hand 2026-11-27):** JDK 17 OpenJDK 17.0.21.1, SDK platforms android-34 + android-35, build-tools 34.0.0 + 35.0.0, cmake 3.22.1, ndk 27.2.12479018. `./gradlew assembleDebug` BUILD SUCCESSFUL — first cold build 1 m 49 s (33 tasks); clean rebuild on 2026-11-27 in 15 s (34 tasks), `app-debug.apk` 52,578,208 bytes. App skeleton: AGP 8.2.2, Kotlin 1.9.22, Gradle 8.7, Compose BOM 2024.02.00, ZXing core 3.5.3 (QR display only), 14 screens, no data layer / Trust Wallet Core / network / scanner / INTERNET permission.

**Steps 3–6 BLOCKED:** the Step 3 lane's report was removed by safety classifiers before the coordinator could see it, and the coordinator was instructed not to continue that request. The lane left no trace — HEAD stayed `b65e8c3`, worktree clean, nothing committed, nothing pushed. Steps 3–6 need the owner's decision on how to proceed.

## §38 — P0 UX build under style B, pushed and live (2026-11-27, `33f1ff1`; gh-pages `4d8a98f`)

**Decision (P0 UX build, first build under §34):** three commits — `bee40ee` (P0-B: delete /create hub, shorten Welcome, fix Wallets desktop grid), `2d65daf` (P0-A: hero Copy button, 24 h on rows, hide no-wallet zeros), `33f1ff1` (P0-C: one error pattern everywhere).

**What changed:** hero Copy button — copying the address goes from 4 taps to 1, the label flips to "Copied!" for 2 s (`dashboard.tsx`); 24 h change on asset rows (`change24hPct`); no-wallet $0.00 rows hidden; the /create hub route and `create-hub.tsx` deleted (sidebar "Create wallet" and every link now go straight to /create-wallet; /create renders Page not found); Welcome shortened; one error pattern everywhere — one line + the reason + a Retry gated to real failures (hidden for locked / no-address / no-adapter); transaction detail resolves any real hash via Track's lookup; Wallets desktop grid fixed.

**Gates at `33f1ff1` on loud-stone with Node 22 (P0 lane verification):** tsc 0, eslint 0, build 0, vitest 3,216 passed + 5 skipped / 0 failures, bundle 4,473,583 / 6,000,000, diagram test 5/5.

**Pushed and live:** remote `panel-rebuild/token-gaps` is `33f1ff1` (verified by `git ls-remote`); `gh-pages` is `4d8a98f` (2026-11-27 14:36, "Publish Bawa from token-gaps `33f1ff1`…"), serving `assets/index-Bri-_XH1.js`; the live root returns 200 (verified by curl from loud-stone 2026-11-27).

**Current counts (verified 2026-11-27 on this tree):** 87 chains (`registry/chains.json` chainCount 87), 21 default tokens (`registry/tokens.json` tokenCount 21), 43 dashboard rows (22 native assets + 21 default tokens), bundle budget 6,000,000, diagram test 5/5 (`node tests/diagram-references.test.mjs`, re-run first-hand 2026-11-27).

## §39 — Provider keys: still none; swap execution approved, not implemented (2026-11-27)

**Decision (standing state, re-confirmed 2026-11-27):** no provider key is configured — Ramp, MoonPay, Onramper, Banxa, Transak, Relay, STON.fi — and none has been invented. Buy is not set up yet: every Buy row says "Not set up yet" with exactly what is needed (`receive.tsx`; the URL builders in `buy-providers.ts` take the key as a parameter and refuse an empty one).

**Swap execution:** approved in chat by the owner (2026-11-27) but NOT implemented. `swap.tsx` is sign-only, never broadcast ("execution needs the owner's separate broadcast authorisation"); broadcast stays disabled (`broadcastSigned` returns disabled; asserted by `tests/diagram-references.test.mjs`).

## §40 — Standing instruction: move verified work without asking (owner order, 2026-11-27 ~20:03 IST)

**Decision (owner order, standing):** "You can move it if you like, you do not have to take permission from me." The owner does not want to be asked for permission to move or apply verified work. Once work is verified, move/apply it without re-asking. This covers moving and applying verified work only; other promotions and guard installations are still each their own question.

## §41 — Link-text colour: deep coral for text (Lane T2 F1/F4, 2026-11-28)

**Decision (bug-hunt v2 fix-all, Lane T2):** coral `#FF6B4A` text on paper `#FFFDF7` is 2.77:1 — below WCAG AA 4.5:1 for normal text and below the 3:1 bar for the destructive Alert icon. Link text and destructive text now use a darker burnt shade, `--bawa-coral-deep` `#C23A1D`, which is 5.27:1 on paper (both ratios computed first-hand). The CTA button is unchanged: coral background + ink text is 5.03:1 and stays. The literal is added to the `scripts/palette-audit.mjs` allowlist as link-text/destructive-text only (never a fill or background); this entry is the recorded decision that rule requires. The 4-colour cap otherwise stands.

**What changed:** `--link` / `--color-link` tokens in `apps/web/src/ui/styles/globals.css`; `text-primary` (used only for link text) and `text-destructive` (used only for error text) are overridden at the token layer to the link colour, so all 17 link sites pass including the ones in files this lane does not own; the destructive Alert icon uses `text-link` in `apps/web/src/ui/components/alert.tsx` (its coral border is unchanged).

## §42 — Style B on the money screens + shared chrome: flat defaults, semantic colour, solid focus (Lane P3-B, 2026-11-28)

**Decision (owner-picked style B, 2026-11-27 ~18:26 IST; built by Lane P3-B, hands-on, 0 Sol calls, branch `p3-money`, local only):** the remaining money screens — Dashboard, Asset rows, Send, Receive, Swap — plus the shared chrome P3-A left (app-shell header, backup tabs bar + Backed up badge) go flat under style B: uniform 8/10/12 px radii, 1 px hairline ink borders, no hard shadow, no wobbly radius, no squiggle underline, no dashed connector, no highlighter on money. Baloo 2 is off money figures (dashboard hero and Send review amount are tabular Inter).

**Mechanism (this lane's decision, recorded so a later lane does not "fix" it back):** the flip is done by changing the SHARED-component defaults to flat — Card defaults `radius="flat"` + `borderWidth="hairline"`, Button `flat` defaults true, Alert `flat` defaults true — reusing P3-A's tokens/utilities (`.btn-flat`, `.alert-flat`, `--radius-flat*`), no second flat system. Ghost buttons get `.btn-flat-ghost` (radius only, never a border): ghost is borderless by contract so `.btn-flat` would add a border to it, but the size variant's `rounded-bawa` still showed on the `:focus-visible` outline, which follows the border radius — caught first-hand by the CDP probe on the dashboard Activity link (2026-11-28). Per-screen prop threading across ~hundreds of Button call sites would leave stragglers; Lane F §7 warns the worst outcome is a half-wobbly app. Consequence: other screens using those components (Create, Security, Transactions, etc.) go flat too — that is the owner-picked whole-app direction. The QR card is provably unaffected (it uses no Card/Button/Input/Alert — verified by grep). Known remainder: 19 explicit `radius="xl"` Cards on Create / Import / Network-selection / Wallet-management / Address-book / Backup panels, and `radius="bawa"` on the Lock screen, still render the old radii while their Buttons/Inputs/Alerts went flat — a follow-up lane should flip those 19 props.

**Semantic colour (the one lift of the 4-colour cap):** four new literals, all contrast-computed first-hand on paper `#FFFDF7` — green `--bawa-success #177245` (5.85:1, success / up / confirmed), red `--bawa-error #B42318` (6.46:1, error / down / failed), grey `--bawa-muted #5B5850` (6.98:1, secondary text), light-green tint `--bawa-success-surface #E7F3EA` (green on it 5.22:1; ink on it 12.41:1). Green on sun is only 4.32:1, so green text never sits on sun — success surfaces use the tint. Warning stays sun + ink (no amber literal). The literals are added to the `scripts/palette-audit.mjs` allowlist and the `globals.test.ts` palette exact-set regex; this entry is the recorded decision the audit's own rule requires. Colour is never the only signal: the 24h change keeps its `+`/`-` sign, errors keep `role="alert"` text. Errors are red text (`text-error`); the `.text-destructive` override moves from `var(--link)` to `var(--bawa-error)` (T2 mapped it to link only because no red existed yet).

**Focus-visible decision (task item 4, decided here):** the wavy coral underline on `:focus-visible` is REPLACED by the solid 2 px ink outline everywhere (WCAG 2.4.11). The `.bawa-squiggle-underline` utility is deleted — its last usages (Send/Swap/Receive errors, ghost button, bottom nav, focus rule, QR scanner) are all gone. Amount-input groups on Send/Swap signal focus with a coral ring on `focus-within` and turn their border red when invalid.

**What changed:** `apps/web/src/ui/styles/globals.css` (tokens, focus rule, utility deletion); `ui/components/{card,button,alert,input,tabs,badge,dialog,sonner,asset-row,skeleton}.tsx` (flat defaults / flat radii); `screens/{dashboard,asset-list,asset-detail,asset-rows,send,send-review,receive,swap,chain-search-select,token-picker-row,recent-activity,tx-row,add-token,price-chart,welcome,backup}.tsx` + `wallet/qr-scanner.tsx` + `app/{app,sidebar-nav}.tsx` (flat chrome, coloured 24h change, red errors); `apps/web/scripts/palette-audit.mjs` + `src/ui/styles/globals.test.ts` (palette); `docs/DESIGN-SYSTEM.md` (rewritten for style B — see its header).

**Deliberately untouched:** `screens/qr-card.tsx` (all 7 templates, exact), the Welcome illustration (intro card, `bawa-marker` title, doodles), the recovery-phrase screen (P3-A owns it), `screens/transaction-detail.tsx:323` warning box (P2-B's screen, one `rounded-xl` left), the backup panels at `backup.tsx:571–669`, and the Lock screen's `radius="bawa"`. Icons are NOT redrawn (Lane F REFINE, still open); the loading draw-circle stays as a brand beat; the Switch stays as built (Security/Networks only).

## §43 — P2 + P3 merged and live (2026-11-28, `2205f15`; gh-pages `5d64609`)

**Decision (P2 + P3 merge, pushed and live):** token-gaps `f1f0e6c` (P2 merge) → `9585647` (P3-B merge: flat polished money screens + shared chrome + DESIGN-SYSTEM.md rewrite), then `bughunt-v2-fixes` (`b64d83a`) merged with zero conflicts → `2205f15`, pushed `f1f0e6c` → `2205f15`, and republished to GitHub Pages (`gh-pages` `5d64609`, "Publish Bawa from token-gaps `2205f15` (P2+P3 + bughunt-v2-fixes merge)"), serving `assets/index-B2tRFRuM.js`; the live root returns 200 (verified by curl from loud-stone 2026-11-28).

**Gates at `2205f15` on loud-stone with Node 22 (verified first-hand before the push):** tsc 0, eslint 0, build 0, vitest 129 files / 3,347 passed + 5 skipped / 0 failures, bundle 4,482,619 / 6,000,000, diagram test 5/5.

**Current counts (verified 2026-11-28 on this tree):** 87 chains (`registry/chains.json` chainCount 87), 21 default tokens (`registry/tokens.json` tokenCount 21), 43 dashboard rows (22 native assets + 21 default tokens), bundle budget 6,000,000, diagram test 5/5. This supersedes §38 as the current live state; §38 stays as the record of the P0 push.

## §44 — NFT indexer stays guide-only, out of the live wallet (owner decision, 2026-11-28)

**Decision (owner, 2026-11-28 ~13:56 IST):** the NFT indexer stays in the GUIDE ONLY, out of the live preview wallet. No indexer in the app; no provider (SimpleHash / Alchemy / Moralis) to choose for the live wallet. This closes the NFT indexer pick — it was never a live feature and stays that way.

**What this means:** the live wallet has no NFT support and no NFT indexer. The dashboard says so plainly (`dashboard.tsx`: "No NFTs tab: no NFT support exists"; the dashboard NFT box is one line saying NFTs aren't listed yet — no indexer connected). No code change is needed for the app. The guide keeps NFT indexer guidance as reference only, clearly marked guide-only (see `docs/06-tracking/README.md` §5) — not a live or planned wallet feature. Do not present an NFT indexer as a live or planned feature in any doc, and do not re-open the provider pick for the live wallet.

## §45 — Wobbly-cards + Starknet QR warning + web follow-ups live; Android Step 3 done, Step 4 running; docs-currency pass (2026-11-28, `734cfef` + `04a17b2`)

**Wobbly-cards lane (pushed and live, `67c7610`, 2026-11-28, hands-on, 0 Sol calls):** flat + hairline everywhere — 26 of 27 `BawaIcon` glyphs redrawn geometric (link kept); 19 explicit `radius="xl"` Cards flipped flat; the `radius="bawa"` Lock screen flipped; transaction-history and track-transaction were out of scope here and fixed in `734cfef` below. This closes the known remainder §42 recorded ("a follow-up lane should flip those 19 props") and the DESIGN-SYSTEM.md §9.6 remainder. The QR card templates and the Welcome illustration keep the paper/comic treatment.

**Starknet QR warning (pushed and live, `77e4473`, 2026-11-28, hands-on, 0 Sol calls):** the shared `STARKNET_RECEIVE_ONLY_WARNING` (`payment-links.ts:785`) renders in all 7 QR templates and in the PNG export, after the subtitle and before the QR tile; Template B 390 px viewed by eye in-app + exported PNG; jsQR 7/7 exported PNGs decode to the same Starknet address; Ethereum negative control 0 warnings.

**Web follow-ups (pushed and live, `734cfef`, 2026-11-28, hands-on, 0 Sol calls):** transaction-history (6) + track-transaction (2) flat; dead Card `radius="xl"` branch removed (0 call sites); S3-a backup-done flag set at end of Create (`create-wallet.tsx:203` — fresh wallet shows "Backed up" badge). This closes the S3-a follow-up CREATE-THIS-SPEC.md §13 recorded as OPEN.

**Gates at `734cfef` on loud-stone with Node 22 (verified first-hand before the push):** build PASS, palette audit passed (3 files, 48 approved colour literals), tsc 0, eslint 0, vitest 3,351 passed + 5 skipped (129 files, 3,356 total), JS bundle 4,482,622 / 6,000,000, dist total 16,431,920 bytes, `index-BxW-qfX0.js` 439,478 bytes, `npm ci` 0 vulnerabilities. Live site root 200 serving `index-BxW-qfX0.js` (gh-pages `43fe69f`). This supersedes §43 as the current live state; §43 stays as the record of the `2205f15` push. HEAD is now `04a17b2` (docs-only §44 commit on top of `734cfef`).

**Android Step 3 DONE (`e20cee6`, 2026-11-28, hands-on, 0 Sol calls):** data layer from the versioned JSON export — 87 chains, 169 RPCs, 4 testnets, 21 tokens, 77 unit tests, APK 53,712,159 bytes. This supersedes §37 ("steps 3–6 blocked") for Step 3. **Step 4 (Trust Wallet Core AAR build from the cloned source) is RUNNING, owner-authorized 2026-11-28** ("anything else which got blocked or which requires my permission start those") — do not state it as done; `ENGINE_BINDING_AVAILABLE` stays `false` until the AAR lands. Steps 5–6 still await Step 4.

**M9 okx-dex-market NOT-BUILT (2026-11-28, `docs/M9-NOT-BUILT.md`):** 9 live probes, 0 successes — market endpoints demand x402 payment (402), index/security/config demand an API key (401). Unblocks only on an OKX API key or a funded x402 arrangement (owner decision).

**Owner orders (2026-11-28 ~13:56 IST, recorded here, not yet done):** (1) fix the 5 history-blocked chains (bsc, gnosis, opbnb, metis, fantom) — balance-only today; Linea was fixed via Etherscan V2 keyless (chainid 59144) and is the model; (2) full functional verification of every section (Add Token, add by contract, chain selection, Receive, Send, Security, Create, Import, Watch-only, and so on) for whether each works and how convenient it is; (3) autoUnlock KEEP, decided by the owner 2026-11-28 ~14:05 IST (autoUnlock opens the wallet without a password by importing a stored key when auto-lock is off, the default) — with the owner flagging the risk of storing the unlock key in localStorage; the owner ordered research into a security repo/resource that teaches how to do auto-unlock securely (how NOT to do the risky browser-storage pattern) — research in progress, not a code change yet. The NFT indexer decision is §44, not this section.

**Docs-currency pass (Lane B, 2026-11-28, hands-on, 0 Sol calls):** 27 docs files checked section by section against the repo at `734cfef` (+ `04a17b2` for this file); stale gates, counts, line numbers and status claims corrected in place (see the lane report). Registry validator now prints `OK: 4 files, 33 entries validated` (was 32); registry tests 29/29 pass; root `npm test` re-run first-hand at `734cfef`, exit 0 (smoke 412 ok / 0 not-ok, register-links 28 PASS).

**Flags, not fixed:** (1) §43 records "sidebar 224 px with 15 links", but `sidebar-nav.tsx` at this tip defines 11 nav links (Money 6, Wallets 2, Settings 3) plus the account link — the 15 figure does not match the current array; it needs a first-hand re-count before it is quoted again. §43 itself is left as the dated record. (2) `CONSTRAINTS.md:53` still records the `2205f15` bundle figures (4,482,619); it needs the `734cfef` figures (4,482,622) — outside this lane's file list.

## §46 — Fix programme + mobile-overflow fix + QR-card redesign + README preview; Android Step 4 done (2026-11-28, `7f24ef1`)

**Fix programme (owner order 2026-11-28 ~15:05 IST, hands-on, 0 Sol calls; commits `f77b803`–`4adbd30` on `token-gaps`, pushed `d06a224` -> `4adbd30`, ls-remote verified):** fix all 4 broken + 3 partial items from the functional verification. (1) Change password on /security (`f77b803`): current password verified by trial decrypt, new password >= 8 chars, vault re-encrypted, old password rejected. (2) Remove an added token (`9fc01e9`): `removeCustomToken` API + two-tap Remove on asset detail; removed tokens stay gone after reload. (3) Activity (`63fb8c4`): wallet switcher `#history-wallet`, watch-only history (27 real rows), counted progress, /track auto-retry (3 attempts). (4) /wallets rename + per-account delete (`65edc90`): inline rename persists, two-tap delete, deleting Current moves to first remaining, last account refused. (5) Asset chart (`ae519f0`): retry + Coinbase daily-candles fallback (keyless). (6) Watch balances + TRON + failed rows + 24h (`e6a2727`): dashboard + /assets Watch-only section, TRON fallback POST to tron-rpc.publicnode.com (keyless), failed rows stay visible with their honest error and never vanish, 24h change on the rows. (7) Watch-only-only Home (`4adbd30`): routes to Dashboard, header says "Watch-only" not "No wallet", gated on hydrating so Welcome never flashes. Gates at `4adbd30` (the programme's own verification): tsc 0, eslint clean, build exit 0, vitest 3,409 passed + 5 skipped (129 files), bundle 4,508,592 / 6,000,000, worktree clean. Republished gh-pages `43fe69f` -> `6fc6051`; live root 200 serving `index-CUzI5YH_.js`, bundle 200 verified.

**History-blocked chains: 1 of 5 fixed (2026-11-28 ~14:40 IST, hands-on, 0 Sol calls; `d06a224`):** Gnosis FIXED via gnosisscan.io keyless (browser fetch; plain curl is Cloudflare-403). CDP-verified in the real app: /track?chain=gnosis rendered 10 real Gnosis transactions, tx detail loads. History now covers 18 chains (12 EVM `historyBaseUrl` entries in `chains.ts` + 6 non-EVM adapters with `getHistory`: btc, doge, ltc, sol, ton, trx). FOUR STAY BLOCKED, each probed live, no keyless source exists: BSC (Etherscan V2 refuses keyless; no Blockscout; BscScan V1 needs a key), opBNB (Etherscan V2 502s; opbnbscan HTML only, no JSON API; no Blockscout), Fantom (Etherscan V2 dropped the chainid; Blockscout 503; ftmscout 522), Metis (Andromeda returns real txs to curl but sends NO CORS header, so the browser blocks every fetch; the wiring was built then correctly REVERTED after CDP caught the CORS block; diff preserved at `/home/boxd/workspace/metis-history-cdp/metis-wiring.diff`). OWNER DECISION NEEDED: the remaining 4 need a KEYED source (free Etherscan/BscScan key, NodeReal free-tier for BSC, or Blockscout PRO) — no key invented, nothing faked. LESSON: curl probes cannot see CORS; future history probes must include a browser fetch. Pre-existing, not fixed: inline-script CSP violation logs on every page load; `security-headers.test.ts` stale devnet-origin count. Partial remains: 7(b) vault-path Activity still ~19–21 s to settle (needs `wallet-context.tsx` refreshHistory change); 7(c) /track recovery-to-rows needs indexer availability (no code change); 6 residual unmapped chart ids (Fantom, Celo, xDai, TRON, USDC, WETH…) need a keyed history source or another keyless CORS-enabled history API; 5 caveat transient 429s still occur (honest + recoverable, not eliminated; CoinLore fallback drops percent_change_24h). No crypto moved; fresh disposable wallets only; phrases never logged.

**Mobile-overflow fix — Lane A (owner order 2026-11-28 ~17:21 IST + 2 phone screenshots, hands-on, 0 Sol calls; `aea4b58`, merged `f60c266`):** the Add Token dialog overflowed horizontally on phones — helper text "Search finds chain + contract. Not found? Add by contra" truncated mid-word, chain tabs cut off ("Bitcoir"), inputs + result rows past the right edge. The earlier verification's "no horizontal overflow at 390px" was wrong on the owner's real phone (1080 px wide, ~412 CSS px). Fixed; also fixed the CAKE fixture address in the same pass (`8d6f553`: 41 hex chars with a duplicated `c8` -> the real checksummed address `0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82`).

**Receive QR-card redesign — Lane B (owner order 2026-11-28 ~17:21 IST, hands-on, 0 Sol calls; `fec71be`, merged `7f24ef1`):** the QR card was wobbly-bordered paper/comic; the owner wants dope/polished cards (bar: the Bitget card). The Receive QR card and all seven share templates A–G were redesigned to the polished flat style; address wraps fixed; "Share the card, keep the keys." tagline kept. "Share the card, keep the keys." is visible on the rendered card (a previous lane claimed it does not exist in `qr-card.tsx` — re-check where it lives).

**README preview + docs — Lane C (this lane, 2026-11-28, hands-on, 0 Sol calls):** 18 fresh screenshots (`docs/preview/`, 9 screens x 390 px + 1280 px, fresh disposable test wallet per viewport, phrases never logged) of the merged `7f24ef1` build served locally — Home, /assets, Receive (QR-card step), Send, Swap, Add Token ("pengu" search, verified results), /wallets, Security, Activity; all 18 viewed by eye, overflowX false on all 18. README Showcase extended with the key-screens grid; README feature bullets, live-build line and project history updated; this section added; ARCHITECTURE.md, CHANGELOG.md and CONSTRAINTS.md brought to `7f24ef1`. Gates at `7f24ef1`, verified first-hand on loud-stone (Node 22) by this lane: build PASS (tsc 0, palette audit passed: 3 files, 48 approved colour literals), total JS 4,509,097 / 6,000,000, `index-DY516Vr9.js`, vitest 3,416 passed + 5 skipped (129 files, 0 failures). Not yet republished — the live site still serves the `734cfef` build (`index-BxW-qfX0.js`).

**Android Step 4 DONE (`f9f312b`, 2026-11-28, hands-on, 0 Sol calls):** Trust Wallet Core 4.8.4 AAR built from source + `:core` wired in (`apps/android/core/libs/wallet-core-4.8.4.aar`, `CoreWalletEngine.kt`, `TWC-AAR.md`); `ENGINE_BINDING_AVAILABLE` is now `true`. This supersedes §45 ("Step 4 running, not done"). Steps 5–6 still await Step 4's completion criteria beyond the build itself.

**autoUnlock DECISION (owner, 2026-11-28 ~14:05 IST):** KEEP auto-unlock. The owner flags the risk: storing the unlock key in the browser (localStorage) could be risky. Owner ordered: find a security repo or resource that teaches how to do auto-unlock securely — how NOT to do the risky browser-storage pattern. Research in progress. This closes the keep-or-revert pick §45 recorded as open; the secure-pattern research stays open.

**§45 flags, closed by this lane:** (2) `CONSTRAINTS.md:53` now records the `7f24ef1` bundle figures (4,509,097 total JS, measured first-hand on loud-stone, Node 22) — it no longer records the `2205f15` figures. (1) The §43 "sidebar 224 px with 15 links" figure is still unreconciled against `sidebar-nav.tsx` (11 nav links + account link at the `734cfef` tip); it needs a first-hand re-count before it is quoted again — still open, not fixed here.

**Still open and waiting on the owner:** the 4 history-blocked chains keyed-source pick; the autoUnlock secure-pattern research; the filesystem check and the guide-update worktree cleanup (both approved, sequenced after the Android lanes). The 24th UX point is still unnamed. Provider keys, the Relay proxy, phone-camera QR decode and live-camera scan, a funded wallet for live Send review/sign and a funded swap quote, an NFT indexer choice and the slides-skill rename stay gated as before.
