# Contributing to Bawa

Thank you for considering contributing to Bawa. You can fix documentation, repair broken links, correct typos, add test fixtures, or make code changes to the wallet tools. Documentation work counts—you do not need to touch crypto code to contribute.

## Check your changes

Run these checks:

```bash
npm run check
npm test
python3 -m py_compile tools/decrypt_seed.py
python3 test/differential_test.py
```

## Contribution rules

- Keep wallet generation and recovery separate from the online watch-only and payment layers.
- If you change derivation, update the relevant standards/chain documentation and add deterministic public fixtures. Document the exact path, curve, address format, network assumptions, and compatibility effects.
- Never commit `.env`, `secrets/`, `seed-backup/`, mnemonics, private keys, production xpubs/zpubs, or real recovery material.

## Pull requests

Maintainers review pull requests. In your pull request, say what you changed, why you changed it, and what you ran to check it.