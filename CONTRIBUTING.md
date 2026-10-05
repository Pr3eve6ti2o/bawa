# Contributing

Keep wallet generation/recovery separate from the online watch-only and payment layers.

Before opening a pull request:

~~~
npm run check
npm test
python3 -m py_compile tools/make_wallet.py tools/decrypt_seed.py
python3 test/differential_test.py
~~~

For derivation changes, update the relevant standards/chain documentation and add deterministic public fixtures. Document the exact path, curve, address format, network assumptions and compatibility effects.

Never commit .env, secrets/, seed-backup/, mnemonics, private keys, production xpubs/zpubs or real recovery material.
