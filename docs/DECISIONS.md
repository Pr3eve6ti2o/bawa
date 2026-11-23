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
2027-02-20; the mobile Receive 40 px question awaits the owner's pick;
the item-14 cannot-add chain list is not recorded in the repo.

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
1024 px is tight; the import path has no "Continue to your send"
button; external wallet apps not tested for deep links; the mobile
Receive 40 px question still awaits the owner's pick; devnet exception
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
  `wallet/secretHandoff.ts` — wire them, or delete them by explicit
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
token-gaps first; merged into token-gaps (merge SHA recorded in
`docs/MARKETING-FIX-PROGRAMME.md`).

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
- **Lane 6 (branch cleanup).** Recorded in `docs/MARKETING-FIX-PROGRAMME.md`
  after the merge.
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
