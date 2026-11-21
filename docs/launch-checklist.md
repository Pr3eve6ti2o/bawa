# Launch checklist (pre-B-1)

Complete before the B-1 production launch. Each item is a check with an
owner and evidence; an unchecked item is a launch blocker, not a
follow-up.

## Error budget and health

- [ ] Error budget defined: what fraction of failed refreshes / failed
  unlocks / failed builds is tolerable, and over what window.
  Owner: ________. Evidence: ________.
- [ ] Health check defined: the endpoint or check that answers "is the
  wallet up", and what it does not cover. Owner: ________. Evidence: ________.
- [ ] Error boundary with reporting: the React error boundary
  (`apps/web/src/app/error-boundary.tsx`) is mounted, reports sanitised
  failures (never secrets, addresses, or balances), and has been
  exercised against a forced render failure. Owner: ________. Evidence: ________.

## Rollback

- [ ] Rollback plan written for the launch version, per
  `docs/release-procedure.md` §3 (previous good tag, exact commands,
  data question, trigger, verification). Owner: ________. Evidence: ________.
- [ ] Rollback rehearsed once against a non-production deployment.
  Owner: ________. Evidence: ________.

## Gates

- [ ] CI green on the launch commit, including the `apps/web` job
  (vitest, typecheck, build, audit, lint, bundle-size gate) and the E2E
  job. Owner: ________. Evidence: CI run URL.
- [ ] `npm audit` 0 for `apps/web` and for the root. Owner: ________.
  Evidence: ________.
- [ ] Dependency-version check green
  (`scripts/check-pinned-dependencies.js`); WASM SHA-256 verified
  against ADR-0001. Owner: ________. Evidence: ________.

## Docs and decisions

- [ ] Docs drift check green; `docs/inventory.md` freshness current for
  every doc the launch touches. Owner: ________. Evidence: ________.
- [ ] ecdsa 0.19.2 deferral: owner acceptance obtained, or the launch
  explicitly records that it ships without it. See
  `SECURITY-FINDINGS.md`. Owner: ________. Evidence: ________.
- [ ] Broadcast decision re-confirmed: broadcast stays disabled unless
  separately authorised. No broadcast path ships with the launch.
  Owner: ________. Evidence: ________.

## Verification

- [ ] Fresh-reader test passed for the launch-critical docs: a fresh
  agent given only the doc performed its task. Owner: ________. Evidence: ________.
- [ ] Live browser check of the launch build at desktop and phone width,
  with console clean. Owner: ________. Evidence: ________.
- [ ] No real crypto moved during any launch verification; all test
  wallets disposable. Owner: ________. Evidence: ________.
