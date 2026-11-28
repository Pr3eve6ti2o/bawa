# Constraints

Last reviewed: 2026-11-29 by the docs-currency pass, Lane A (hands-on, 0 Sol calls).
Base: `panel-rebuild/token-gaps` at `bcf180e` (fix-all programme merge, live).

This is Bawa's written quality contract. It outlives any single session:
a number here is a decision, not an aspiration. Every enforced row names
the exact command that produces the verdict. A dimension with a number
and no command is an aspiration, not a constraint.

Read this file before writing code. **Do not weaken it to make a change
pass.** Tightening the bar is silent; loosening it is loud (see
"Guard the bar").

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `@ts-nocheck`,
  `eslint-disable`, `biome-ignore`, `# noqa`, `# type: ignore`,
  `istanbul ignore`, `nosemgrep`, `gitleaks:allow`, `Stryker disable`.
- No unimplemented stubs: `throw new Error("Not implemented")`, empty
  `catch {}`, `TODO` standing where the implementation should be.
- No skipped or deleted tests without a reason in the commit message.
- No secrets in source: no mnemonic, seed, private key, xprv, vault key,
  password, or token in code, tests, logs, or fixtures. Test-only keys
  are fresh, disposable, and never funded.
- No fake data: no fabricated balances or prices. A missing value is
  `unavailable` with a reason, never `$0.00`.
- No broadcast path built or enabled (standing owner order). Exception E1 (temporary devnet only) applies — see Exceptions below.
- This file does not get weakened to make a change pass.

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
| --- | --- | --- | --- |
| Types (web) | Zero type errors | `npm run typecheck` in `apps/web` (`tsc --noEmit`) | every edit, CI |
| Lint (web) | Zero errors from the repo config | `npm run lint` in `apps/web` (`eslint src vite.config.ts vitest.config.ts`) | every edit, CI |
| Tests (web) | All pass; no skipped or deleted test without a reason in the commit message | `npm run test` in `apps/web` (`vitest run`) | every edit, CI |
| Build (web) | Zero errors | `npm run build` in `apps/web` | CI |
| Audit (web) | Zero vulnerabilities | `npm audit` in `apps/web` | CI |
| Bundle size (web) | Total JS in `dist/assets` ≤ 6,000,000 bytes; largest single JS chunk ≤ 3,050,000 bytes | CI bundle-size step (sums `dist/assets/*.js` after `npm run build`; budgets in `PERF.md`) | CI |
| E2E (web) | Critical-path harness green (create / unlock / balance / send-disabled / lock) | `npx playwright test` in `apps/web` (CI job) | CI |
| Secrets | No secrets in the staged diff | `node scripts/secret-scan.mjs` (pre-commit); CI floor-guard job | pre-commit, CI |
| Docs links | All internal documentation links resolve | `python tools/check-links.py` (CI `docs-checks` job) | CI |
| Docs drift | No doc older than its code (see `docs/inventory.md`) | CI `docs-checks` drift step (code-versus-doc last-change comparison) | CI |
| Root checks | Generator checks pass | `npm run check` and `npm test` at the repo root | CI |
| Python | Reference tests pass | `python test/test_make_wallet.py`, `python test/test_decrypt_seed.py` | CI |

## Measured, not yet enforced

| Metric | Today (2026-11-26, this tree) | Direction |
| --- | --- | --- |
| Web vitest | 130 files — PASSES on loud-stone (3,479 passed + 5 skipped, 0 failed, Node 22, at token-gaps `bcf180e`, 2026-11-29; the 3,477-passed figure was the gates at `658937d`, the 3,459-passed figure the gates at `65daa64`, the 3,437-passed figure the gates at `1a85258`, the 3,429-passed figure the gates at `1253bf6`, the 3,416-passed figure the gates at `7f24ef1`, the 3,351-passed figure the publish gates at `734cfef`). FAILS in this sandbox on Node 22 (2026-11-26): 104 failed / 2,841 passed + 5 skipped (guide-update tip), 79 failed / 2,866 passed + 5 skipped (pristine token-gaps `7a170f4`); timeout-dominated, varies run to run — environment artefacts, not code defects | must not fall |
| Web bundle JS | 4,536,948 bytes total (measured 2026-11-29 on token-gaps `bcf180e`, coordinator gates, first-hand on loud-stone; was 4,536,937 at `658937d`, 4,532,436 at `65daa64`, 4,509,960 at `1a85258`, 4,509,662 at `1253bf6`, 4,509,097 at `7f24ef1`, 4,508,592 at `4adbd30`); largest chunk (boundary) 2,906,616 bytes (re-measured 2026-11-29 at `bcf180e`, fresh build, Node v22.23.4, first-hand on loud-stone — unchanged from `7f24ef1`); passes the 6,000,000 budget by 1,463,052 bytes | must not grow (ratchet: budgets above are the owner-ordered 6,000,000) |
| Web test duration | ~93 s (`vitest run`, 2026-11-27, 92.66 s at token-gaps `33f1ff1`) | must not grow without a reason |
| Root smoke checks | 440 checks pass, 0 fail (412 smoke + 28 register-links, re-verified 2026-11-29 at token-gaps `bcf180e` on loud-stone, Node v22.23.4, first-hand by docs-currency Lane B; the 734cfef figure was the previous measurement) | must not fall |

When a number improves, update it here. When it drops, that is the
finding — not a reason to edit this file.

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
| --- | --- | --- | --- | --- | --- |
| E1 | No broadcast path built or enabled | `apps/web/src/wallet/send.ts` (`broadcastSignedDevnet`), devnet adapter `broadcast()` implementations, `apps/web/src/screens/send.tsx` (devnet broadcast stage) | TEMPORARY devnet mode only (owner order 2026-11-22): broadcast is enabled for the four devnet networks only — Bitcoin testnet4, Ethereum Sepolia, TRON Nile, TON testnet. Every mainnet `broadcast()` still throws `BROADCAST_DISABLED_MESSAGE` unconditionally, and `broadcastSignedDevnet` asserts devnet mode plus a devnet networkId before any network write. | Owner (2026-11-22) | 2027-02-20 |

An exception with no owner, or an expiry more than 90 days out, is not
an exception — it is a deleted rule.

## Shortcut markers and the debt ledger

A deliberate deferral is marked in code with a greppable marker so it
can be found again, and is recorded in the ledger below. The marker
format is `DEFER(<id>): <what is deferred> — ceiling: <condition that
forces the work> — trigger: <event that re-opens it>`.

```sh
# Find every recorded deferral:
grep -rn "DEFER(" -- apps/web/src scripts tools | grep -v node_modules
```

### Ledger (known deferrals at 2026-11-20)

| ID | Deferral | Ceiling / trigger |
| --- | --- | --- |
| D1 | Single-attempt `fetchJson` (ADR-0009). No retry in the transport; retries live in callers under a budget. | Ceiling: retries stay caller-side, bounded, reads-only. Trigger: a caller retries a broadcast, or an unbounded retry appears. |
| D2 | Broadcast disabled (standing owner order). Send is built, signing is local, broadcast throws. | Ceiling: no broadcast path is enabled. Trigger: a separate owner authorisation to enable broadcast. Trigger MET for devnet only (owner order 2026-11-22, exception E1, expires 2027-02-20): a devnet-only broadcast path exists (`broadcastSignedDevnet`); mainnet broadcast remains disabled and every mainnet `broadcast()` still throws. |
| D3 | Price-feed absence on this checkout — CLOSED 2026-11-26 (guide-update pass). The CoinGecko client exists (`apps/web/src/wallet/prices.ts`, `PRICE_IDS` covers all 87 chains) with CoinLore / Coinbase / DexScreener / TonAPI fallbacks (`price-fallbacks.ts`); balances carry fiat values from real sources, never invented. See ADR-0007 and `docs/CREATE-THIS-SPEC.md` §7. | Closed: feed implemented; the ceiling (no fiat value ever invented) still stands as §0.4 of the spec. |
| D4 | `toBalanceProvider` legacy shim (`adapters/types.ts`) — REMOVED 2026-11-22 (P5 C1, merge 85ba72a). `balance-providers.ts` deleted; zero references to `toBalanceProvider`, `getBalanceProvider`, or `balance-providers` remain in the tree. Trigger met: last consumer removed. | Closed: shim and file deleted; new code uses `getAdapter`. |
| D5 | ecdsa 0.19.2 accepted residual risk (PYSEC-2026-1325 / CVE-2024-23342). No owner acceptance order is on record. | Ceiling: the acceptance is a lane verdict, not an owner decision. Trigger: owner acceptance, a new signing path, `coincurve` dropped, or `ecdsa` bumped. See `SECURITY-FINDINGS.md`. |

## Guard the bar

A change that lowers the bar is reviewed as a bar change, not as a
code change. Watch the diff for these five cheap roads to green
(enforced by the CI `floor-guard` job, adapted from the
constraint-driven-development skill's floor-guard reference):

1. **The threshold moved.** A budget lowered, a severity dropped, a
   check removed from the fast stage. Compare `CONSTRAINTS.md` against
   its state at the branch point.
2. **A test got easier.** `.skip` added, a test file deleted, assertions
   pulled out of tests that stayed.
3. **A checker got silenced.** A new suppression comment (see the Floor
   list above).
4. **Work is unfinished.** A stub that throws, an empty `catch` turning
   a failure into silence, a `TODO` standing where the implementation
   should be.
5. **An exception appeared.** A new row in the Exceptions table nobody
   discussed.

Tightening the bar should be silent; loosening it should be loud. A
loosening without a tracked exception is a failed check.

The CI job checks roads 2–4 on code files only (`*.ts`, `*.tsx`,
`*.js`, `*.mjs`, `*.py`, and the other compiled-language extensions):
a document describing a suppression — this file names every marker —
is not a suppression.
