# Branch documentation status — docs lane, 2026-11-20

This file records the documentation state of the four branches covered by the
Bawa repo-organisation programme's docs lane (`panel-rebuild/org-docs`, based
on `panel-rebuild/adopt-proper` at `e493720`), and the findings for the three
branches this lane did not edit. Nothing in this file was pushed; the lane is
local-only.

## What this lane changed (adopt-proper line)

The full list is in the lane's `RUN-LOG.jsonl` (see
`bawa-org/docs-lane/` on the VM) and in the branch diff. In short:

- `README.md` — CI badge and clone command now name
  `panel-rebuild/adopt-proper` (was `feature/ai-wallet-builder`); blank line
  restored before `## Usage`; "watch-only starters" corrected.
- `AGENTS.md` — branch/base corrected to the adopt-proper line at `e493720`;
  honesty state rewritten (offline signing exists, broadcast disabled, APK
  built, Add-button path unverified); Trust Wallet Core 4.9.3; web 457 tests;
  Android 57 `@Test` annotations (count, not a pass count); mainnet-first.
- `WALLET_BUILDER.md` — testnet default replaced with mainnet-first
  throughout (approval gate kept); H9 "no signing code" contradiction
  removed; Doc 4 register corrected to 32 rows (was 46); baseline updated to
  217 smoke checks (H9 130 superseded).
- `ARCHITECTURE.md` — branch corrected to the adopt-proper line.
- `ai/request-routing.md` — scope boundary aligned to mainnet-first; web
  starter counts updated; the classifier's code-pinned refusal sentence is
  kept verbatim (see open items below).
- `apps/web/README.md` — "strictly watch-only" contradiction removed;
  in-browser generation/recovery, offline signing and adapters described;
  testnet-only line replaced with mainnet-first; TON public-address import
  added; 457-test evidence added.
- `docs/CAPABILITY-MAP.md` — dated 2026-11-20 refresh note; launcher
  existence corrected; web 457-test resolution; seven current registry gaps;
  Appendix A items 1, 3 and 4 resolved, item 2 (Android 17 vs 57) still open.
- `docs/08-security-recovery/README.md` — section 1 rewritten to the true
  current state (signing/builders exist, starters in-repo, APK built);
  4.9.3 tag; xpub-import workflow now points at docs/05 and the web
  import-wallet screen.
- `docs/index.md` — evidence date moved to 20 November 2026; engine 217,
  web 457, Android annotation-count honesty, quality-gates FAIL, R-01
  resolved, stale-data/failure-modes counts corrected (7 and 10).
- `docs/handoff.md` — dated 2026-11-20 addendum only; the 2026-11-10 body
  is preserved as history.
- `docs/mainnet/MAINNET-GUIDE.md` — dated updates only, no re-pin (a re-pin
  needs a coordinator/owner re-issue decision per M-33): M-30 QR-scanner
  staleness, M-31/M-15 closure contradictions, M-05 vault-code staleness,
  M-06 APK staleness.

Verified first-hand on 2026-11-20 on this tree: `tools/hdwallet-gen`
`npm test` exit 0 (217 smoke checks, register-links pass); `apps/web`
vitest 40 files, 457 tests, all passed, exit 0; quality gates
`--skip-android` FAILED (2 gates — see open items below).

## `main` (74ae078) — findings, not edited

- `README.md` (276 lines) is in decent shape. Section 8 records
  "Current verification: 2026-11-15" with `npm test` 130 checks, 0 fail;
  the differential test BTC/ETH index 0 only; 25 `test_bawa_cli.py` tests;
  14 `test_make_wallet.py` tests. Those figures are internally consistent
  for main (main has no `apps/web`).
- Stale: section 7 says "These instructions describe the `main` worktree
  based on `da82fe3` (staging commit `2bb9a98`)" — neither matches the
  branch tip `74ae078`. `AGENTS.md` says "Verified snapshot (2026-11-14):
  main at `16c074e`" — also not the tip.
- `AGENTS.md` says "The full AI Wallet Builder — profiles, registry,
  starters, mainnet tools, TON watch-only derivation — lives on the
  `feature/ai-wallet-builder` branch, not here." That branch still exists,
  but the builder work continued on the `panel-rebuild/*` branches; the
  pointer is out of date.
- `AGENTS.md` "There is NO signing, broadcast or transaction-construction
  code on this branch" is true for main. Main pins wallet-core 4.9.3
  (verified first-hand); the old "main pins 4.8.4" claim is stale.
- Main's `docs/08-security-recovery/README.md` does not have the
  recovery-techniques section (FinderOuter/indy/BTCRecover) that
  `main-adopt-fixes` added.

## `main-adopt-fixes` (df3dd25) — findings, not edited

- Only five files differ from `main`: `docs/03-tools-and-repositories/
  README.md` (+2 lines), `docs/08-security-recovery/README.md` (+40
  lines: legitimate recovery techniques — FinderOuter, indy path-matrix /
  gap-limit, BTCRecover techniques, with the no-vendoring boundary — plus
  four reference links), `requirements.txt` (+2: `mnemonic==0.21`),
  `test/test_make_wallet.py` (+82) and `tools/make_wallet.py` (+69: the
  trezor/python-mnemonic second check).
- `README.md`, `AGENTS.md` and `ARCHITECTURE.md` are byte-identical to
  main. Finding: the branch's one new capability (the Python adoption port
  — a second BIP-39 check via trezor/python-mnemonic) is documented only
  in `docs/08` and in code, not in the README or AGENTS.md. A reader of
  the branch's front door cannot tell it apart from main.

## `panel-rebuild/multichain-create` (40d8cc5) — findings, not edited

- Root `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `WALLET_BUILDER.md`
  and `docs/CAPABILITY-MAP.md` are byte-identical to adopt-proper. The
  branch's new features are therefore undocumented at the front door:
  the 13-chain registry, the transaction tracker, the live price feed
  (public USD quotes, source + freshness), the Create screen (main title
  "Create", 7 tool cards) and the token logos are described only in
  `MULTICHAIN-ASSESSMENT.md`, `docs/adr/0006-price-feed-provider.md`,
  `lane/report-b.md` — and, for token logos only, in the +23-line addition
  to `apps/web/README.md`. The tracker, price feed and Create screen have
  no mention in the root README, the capability map, the architecture map
  or the registry docs (`docs/12-chain-registry-and-assets`).
- ADR numbering collision: `docs/adr/0006-use-case-split.md` (43 lines,
  present on adopt-proper and preserved on this lane's branch) was
  DELETED on multichain-create and replaced by
  `docs/adr/0006-price-feed-provider.md`. Two different decisions share
  the number 0006 across branches, and the use-case-split ADR is absent
  from multichain-create. The naming lane should decide the numbering.
- Recommendation: port this lane's adopt-proper doc fixes onto
  multichain-create, then add a short multichain section (registry,
  tracker, price feed, Create screen, token logos) to the root README and
  the capability map. This lane did not do that, because its base is
  adopt-proper and the multichain features do not exist there.

## Open items handed to other lanes (not docs fixes)

- `tests/stale-data.test.mjs` asserts Doc 4 §21 M-31 is OPEN; the guide
  correctly records CLOSED (owner, 2026-11-13). The test needs a one-line
  update (assert CLOSED). This lane did not touch tests (docs only).
- Quality gates on this tree (2026-11-20, `--skip-android`): FAILED —
  `phase9-tests` (the M-31 stale-data assertion above; 157/158 pass) and
  `secret-scan` (flagged lines in `apps/web/src/wallet/core.ts`,
  `send.ts`, `vault.ts`, `test/test_make_wallet.py`,
  `tests/mainnet-derivation-vectors.test.mjs` and the web package files;
  none is a known public test vector verbatim on the flagged line — the
  matches appear to span multi-line word arrays; needs a code-lane look).
- `scripts/classify-request.mjs:367` emits the refusal sentence "the
  default scope is testnet" verbatim, and `tests/classifier.test.mjs`
  asserts it in six places. Aligning it with mainnet-first needs a code
  change, not a doc edit. `scripts/generate-project.mjs:215` also says
  "Testnet only. Mainnet is out of scope without separate approval."
- Android executed passing count (17 vs 57 `@Test` annotations) is still
  unresolved: no Android SDK exists on gray-pinee, so no Gradle run was
  possible here. Needs a machine with an Android SDK.
- `docs/mainnet/MAINNET-GUIDE.md` header pin (`e3b65fb8`, baseline
  2026-11-09) is intentionally untouched: M-33 says the step-4 values are
  revision-locked and must be updated only when Doc 4 is re-issued, by a
  coordinator/owner decision.
