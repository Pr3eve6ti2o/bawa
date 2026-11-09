# Contributing

Keep wallet generation/recovery separate from the online watch-only and payment layers.

## Issues

Report bugs and propose changes at <maintainer-confirmed reporting location>.
The policy on opening an issue before starting work or submitting a pull
request is: <maintainer-confirmed policy>.

For bug reports, include reproduction steps, expected behaviour and actual
behaviour. Link the relevant issue in the pull request where applicable.
Do not include secrets or real recovery material.

## Branch workflow

Use <maintainer-confirmed fork/branch workflow>.
Create your change branch from `<maintainer-confirmed base branch>`,
following `<maintainer-confirmed branch-naming convention>`.
Target the pull request at `<maintainer-confirmed target branch>`.

## Code style

Match the conventions of the surrounding code in the language you are
changing. Keep unrelated formatting changes out of the pull request.
Run the checks below before requesting review.

## Local setup and checks

To match CI, use Node.js 22 and Python 3.13. Before running the checks,
run `npm install` in `<confirmed CI installation working directory>`.
Run the checks below from the repository root.

Before opening a pull request:

~~~
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
~~~

## Review and approval

Request review from <maintainer-confirmed reviewer or reviewer-selection route>.
Merge only after <maintainer-confirmed approval and merge requirements>
have been satisfied.

## Derivation changes and deterministic public fixtures

For derivation changes, update the relevant standards/chain documentation
and add deterministic public fixtures. Document the exact path, curve,
address format, network assumptions and compatibility effects.

A deterministic public fixture is a deliberately public, non-secret test
case with fixed inputs and expected public outputs that can be reproduced
under the documented assumptions. Use `docs/11` as the canonical fixture
home (see README §5.3). Record the inputs, expected outputs and the steps
needed to reproduce the result.

The "Never commit" rule below also applies to fixtures.

Never commit .env, secrets/, seed-backup/, mnemonics, private keys, production xpubs/zpubs or real recovery material.
