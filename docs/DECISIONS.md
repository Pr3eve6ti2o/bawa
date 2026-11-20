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
