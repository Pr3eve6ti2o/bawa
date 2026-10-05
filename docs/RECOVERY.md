# Recovery Procedure

This document contains operational recovery steps and no wallet secret.

## Required recovery material

For the current Bawa reference policy, preserve:

- the BIP-39 mnemonic;
- the exact BIP-39 passphrase policy (currently empty);
- chain derivation paths and address policy;
- network/chain configuration;
- TON wallet configuration where applicable;

or preserve the generated encrypted seed.enc.json plus its separate 32-byte data key.

An xpub/zpub cannot recover the wallet. It can reproduce only public descendants below the exported account node.

## Encrypted artifact

On a trusted machine:

~~~
python3 tools/decrypt_seed.py /path/to/seed.enc.json
~~~

The utility asks for the data key and displays the mnemonic on the controlling terminal by default. Use --stdout only for an explicit controlled pipeline or --output for an atomic 0600 plaintext file.

## Before funding

Recover on a clean trusted machine, verify the mnemonic/passphrase, derive known public addresses, and compare them with the recorded originals. Do not fund the restored wallet until the public outputs match.

## TON

TON is configuration-sensitive. Recovery must preserve the wallet contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID used by the original system.
