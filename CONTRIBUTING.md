# Contributing

Thank you for considering contributing to Bawa. It is people like you that make Bawa such a useful reference. This guide covers the practical steps; the repository instructions in `AGENTS.md` cover how the work itself is done.

Keep wallet generation/recovery separate from the online watch-only and payment layers.

## Issues

Report bugs and propose changes at [github.com/Pr3eve6ti2o/bawa/issues](https://github.com/Pr3eve6ti2o/bawa/issues). Open an issue before starting substantial work, so the approach can be agreed first.

For bug reports, include reproduction steps, expected behaviour and actual behaviour. Link the relevant issue in the pull request where applicable. Do not include secrets or real recovery material.

## Branch workflow

Create your change branch from `main`, the default branch. Name the branch after the work, for example `feature/ai-wallet-builder`. Target the pull request at the branch the work belongs to; ask in the issue if you are unsure.

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

## Review and approval

Request review from the repository owner (Pr3eve6ti2o). Merge only after the checks above pass and the owner approves.

## Derivation changes and deterministic public fixtures

For derivation changes, update the relevant standards/chain documentation and add deterministic public fixtures. Document the exact path, curve, address format, network assumptions and compatibility effects.

A deterministic public fixture is a deliberately public, non-secret test case with fixed inputs and expected public outputs that can be reproduced under the documented assumptions. Use `docs/11` as the canonical fixture home (see `docs/README-FULL.md` §5.3). Record the inputs, expected outputs and the steps needed to reproduce the result.

The "Never commit" rule below also applies to fixtures.

Never commit .env, secrets/, seed-backup/, mnemonics, private keys, production xpubs/zpubs or real recovery material.
