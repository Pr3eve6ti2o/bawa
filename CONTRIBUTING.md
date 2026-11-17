# Contributing

Thanks for taking the time to help Bawa. We're a small team. You can contribute by reporting or fixing bugs, suggesting features, or improving documentation. Documentation changes, broken-link fixes and typo corrections are valid first contributions.

## Scope and secrets

Keep wallet generation/recovery separate from watch-only CLI tooling (`tools/hdwallet-gen/`) and documentation-only payment tracking (guides only; no tracker executable).

Never commit `.env`, `secrets/`, `seed-backup/`, mnemonics, private keys, production xpubs/zpubs or real recovery material.

## Reporting bugs and suggesting features

**Reporting location:** [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues).

For a bug report, include:

- Steps to reproduce the problem.
- Expected behaviour.
- Actual behaviour.

Do not include secrets or real recovery material.

For a feature suggestion, describe the problem you want to solve and the behaviour you propose.

Before starting work, open an issue in [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues) to report the problem or propose the change.

### Good-first issues: guidance for maintainers

Label issues suitable for a first contribution so contributors can find them. Before applying the label:

- Choose a task that stands alone and does not depend on unfinished work.
- Keep its scope bounded and state what completion looks like.
- Describe the problem and give pointers to the relevant files, documentation and checks.
- Tell contributors where to ask for help, and make sure a person answers their questions.

## Branch workflow

Fork [`Pr3eve6ti2o/bawa`](https://github.com/Pr3eve6ti2o/bawa) on GitHub and create a working branch from `main` in your fork. All work builds from `main`. Existing branches use `feature/<topic>` and `audit-fixes/<lane>` patterns; use these as naming examples. Make your changes, push the branch to your fork, and open a pull request targeting `main` in `Pr3eve6ti2o/bawa`. CI runs on pushes and pull requests.

**Policies still unconfirmed — maintainer confirmation needed:** whether an issue is mandatory for every change or before every pull request, whether using a fork is mandatory, and whether the observed branch-naming patterns are required. The steps above provide the documented route without asserting those repository-specific requirements.

## Code style

Match the conventions of the surrounding code in the language you are changing. Keep your change focused and leave unrelated formatting changes out of the pull request.

## Local setup and checks

Use Node.js 22 and Python 3.13 to match CI; see `.github/workflows/ci.yml`. The reported local versions were Node v22.23.4 and Python 3.12.3. [README](README.md), §8 records verification output for `npm install`, `npm test` (130 checks), the differential test, and the launcher/wallet-generator unit tests. The differential test ran with bip-utils 2.12.2 (per the `smoke.test.js` header), while `requirements.txt` pins `bip-utils==2.12.3`; that run does not verify the pinned version.

Create and activate a Python virtual environment. From the repository root, install the Node dependencies in `tools/hdwallet-gen` and the Python dependencies from `requirements.txt`:

```sh
npm --prefix tools/hdwallet-gen install
python -m pip install -r requirements.txt
```

Verification scope for the check list below: README §8 has no recorded verification output for `npm run check`, `python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py`, or the venv/pip-install setup steps.

Run all four checks from the repository root before requesting review:

```sh
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
```

## Review and approval

In your pull request, explain what changed, why it is needed and the results of the checks you ran. Link the relevant issue where applicable.

These review and merge decisions are **unconfirmed** and need maintainer confirmation:

- Reviewer or reviewer-selection route: `<maintainer-confirmed reviewer or reviewer-selection route>`.
- Approval and merge requirements: `<maintainer-confirmed approval and merge requirements>`.

## Derivation changes and deterministic public fixtures

For derivation changes, update the relevant standards/chain documentation and add deterministic public fixtures. Document the exact path, curve, address format, network assumptions and compatibility effects.

A deterministic public fixture is a deliberately public, non-secret test case with fixed inputs and expected public outputs that can be reproduced under the documented assumptions.

Use `docs/11-trust-wallet-and-independent-verification/` as the canonical fixture home; `docs/11` is shorthand used across the guides, not a literal directory path. See the derivation-paths table in [README](README.md), §1. Record the inputs, expected outputs and the steps needed to reproduce the result.

The “Never commit” rule above applies to fixtures too.