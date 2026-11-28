# Contributing

Thank you for considering contributing to Bawa. It is people like you that make Bawa such a useful reference. This guide covers the practical steps; the repository instructions in `AGENTS.md` cover how the work itself is done.

Keep wallet generation/recovery separate from the online watch-only and payment layers.

## Issues

Report bugs and propose changes at [github.com/Pr3eve6ti2o/bawa/issues](https://github.com/Pr3eve6ti2o/bawa/issues). Open an issue before starting substantial work, so the approach can be agreed first.

For bug reports, include reproduction steps, expected behaviour and actual behaviour. Link the relevant issue in the pull request where applicable. Do not include secrets or real recovery material.

## Branch workflow

Create your change branch from `panel-rebuild/token-gaps`, the working line (not `main` — `main` is a docs-sweep tip, currently `af828a9`). Name the branch after the work, for example `panel-rebuild/guide-update`. Target the pull request at the branch the work belongs to; ask in the issue if you are unsure.

The repo's branch families are `panel-rebuild/*`, `redesign/*`, `usable-*`, `gh-pages` and `main`.

## Code style

Match the conventions of the surrounding code in the language you are changing. Keep unrelated formatting changes out of the pull request. Run the checks below before requesting review.

## Local setup and checks

To match CI, use Node.js 22 and Python 3.13. Before running the checks, install the Node dependencies with `npm ci` in `tools/hdwallet-gen` (CI uses `npm ci`, not `npm install`). Run the checks below from the repository root.

Before opening a pull request:

~~~
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
~~~

For the web wallet (`apps/web`), also run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` there. The quality bar for all of this is `CONSTRAINTS.md`; do not weaken it to make a change pass.

## Adopting a dependency

Every new dependency is a decision, recorded, not a silent addition.
Before adding a dependency, complete this checklist and record it in
the pull request (or the lane report):

- [ ] **Source link.** The exact repository/package URL and the pinned
  version (or revision). An abbreviated name is not a source.
- [ ] **Warning.** What the dependency costs: size, maintenance,
  licence, supply-chain surface, and what breaks if it goes
  unmaintained. If you cannot name a cost, you have not inspected it.
- [ ] **Owner confirmation.** Who owns the dependency going forward
  (a person, not a team), and who re-reviews it when it changes.
- [ ] **One real use case.** The single concrete use in this repo that
  justifies the dependency. "Might need it later" is not a use case.
  A dependency with no consumer is not added.
- [ ] **Licence check.** The licence is MIT, Apache-2.0, or ISC — or
  the dependency is patterns-only (study the idea, write fresh code)
  because its licence blocks adaptation. Per-file verification for
  mixed-licence sources (MetaMask, Aptos, Sui); the two-year FSL→MIT
  conversion checked for safe-transaction-service.
- [ ] **Lockfile.** The lockfile diff is reviewed, never hand-edited.
  A version range is never used where an exact pin is the policy
  (notably `@trustwallet/wallet-core` 4.9.3 — see ADR-0001).
- [ ] **Pin recorded.** The pin and its reason are recorded where the
  dependency is used (package.json comment, ADR, or
  `scripts/check-pinned-dependencies.js`).

## Review and approval

Request review from the repository owner (Pr3eve6ti2o). Merge only after the checks above pass and the owner approves.

## Derivation changes and deterministic public fixtures

For derivation changes, update the relevant standards/chain documentation and add deterministic public fixtures. Document the exact path, curve, address format, network assumptions and compatibility effects.

A deterministic public fixture is a deliberately public, non-secret test case with fixed inputs and expected public outputs that can be reproduced under the documented assumptions. Use `docs/11-trust-wallet-and-independent-verification` as the canonical fixture home (see `docs/README-FULL.md` §5.3). Record the inputs, expected outputs and the steps needed to reproduce the result.

The "Never commit" rule below also applies to fixtures.

Never commit .env, secrets/, seed-backup/, mnemonics, private keys, production xpubs/zpubs or real recovery material.
