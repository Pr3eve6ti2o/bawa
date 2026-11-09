---
title: Frequently asked questions
description: Short answers to the questions readers ask most often about Bawa, derivation, tracking, signing, security and recovery; testnet only.
last-updated: 2026-11-08
---

# Frequently asked questions

Reference. Each answer is short; the linked section carries the detail.

## Contents

- [Where should I start?](#where-should-i-start)
- [Can an xpub recover my wallet?](#can-an-xpub-recover-my-wallet)
- [What does Bawa not do?](#what-does-bawa-not-do)
- [How do I fund a test wallet safely?](#how-do-i-fund-a-test-wallet-safely)
- [What do I do if a seed is compromised?](#what-do-i-do-if-a-seed-is-compromised)
- [Why does a derived address not match the expected address?](#why-does-a-derived-address-not-match-the-expected-address)
- [Why is my EVM balance zero when the address is right?](#why-is-my-evm-balance-zero-when-the-address-is-right)
- [How does payment tracking differ from wallet tracking?](#how-does-payment-tracking-differ-from-wallet-tracking)
- [Why must signing stay separate from tracking?](#why-must-signing-stay-separate-from-tracking)
- [Can I build a wallet app from Bawa?](#can-i-build-a-wallet-app-from-bawa)
- [Which tools does Bawa use?](#which-tools-does-bawa-use)
- [Free or paid security, what am I actually buying?](#free-or-paid-security-what-am-i-actually-buying)
- [My seed may be stolen, what now?](#my-seed-may-be-stolen-what-now)
- [Testnet or mainnet, what changes?](#testnet-or-mainnet-what-changes)
- [Why do two wallets show different addresses for the same seed?](#why-do-two-wallets-show-different-addresses-for-the-same-seed)

### Where should I start?

Start with [Fundamentals](01-fundamentals/README.md), then read [Chain Guides](02-chains/README.md) and the [Tool & Repository Map](03-tools-and-repositories/README.md) before moving on to [Wallet Generation](04-wallet-generation/README.md). Choose only the READMEs you need, each is organised around a job.

**Work with testnet wallets only. Mainnet is absent from this guide set.**

Use Bawa as an HD-wallet reference to generate wallet material on a trusted machine, derive public addresses without the seed (the 64-byte BIP-39 derived value), verify with an independent implementation and recover encrypted seed material from a seed bundle (the encrypted seed.enc.json file).

### Can an xpub recover my wallet?

**No. An xpub is sensitive public material and cannot spend, sign or recover your wallet.** Use it only to derive and watch addresses below its account. Treat zpubs as sensitive public material too.

Restore your wallet only with the mnemonic and its BIP-39 passphrase. Keep the BIP-39 passphrase empty, as required by this guide's policy. Do not confuse it with the vault unlock passphrase, which unlocks the vault (the encrypted store).

See [Watch-only derivation](05-watch-only/README.md) and [Security & Recovery](08-security-recovery/README.md).

### What does Bawa not do?

Do not rely on Bawa for custody or treat it as an exchange, a hosted service or a security audit.

Do not expect Bawa to **run a node, fetch balances or broadcast transactions**. Handle those jobs in the application or infrastructure, outside Wallet Core's scope.

Keep signing in a separate signer or hardware wallet. Bawa's tracker side does not sign.

See [Signing & Hardware](09-signing-and-hardware/README.md).

### How do I fund a test wallet safely?

**Use testnet only, or keep the exercise conceptual. Never use real funds.**

Before relying on your backups:

1. Write them offline.
2. Keep **2 to 3 separated copies**. Never digitise them or share them with support.
3. Test a restore with a tiny testnet amount.

See [Chain Guides](02-chains/README.md) and [Operations & Testing](10-operations-and-testing/README.md).

### What do I do if a seed is compromised?

Follow the procedure in [My seed may be stolen, what now?](#my-seed-may-be-stolen-what-now); it applies to both confirmed and suspected compromise.

See [Security & Recovery](08-security-recovery/README.md).

### Why does a derived address not match the expected address?

Check that you are using the same settings as the wallet you are trying to match, **in this order**:

1. Mnemonic.
2. BIP-39 passphrase (empty by policy in this guide).
3. Curve.
4. Coin type.
5. Purpose.
6. Account.
7. Branch.
8. Index.
9. Network and address encoding.
10. Wallet implementation and configuration.

Also check the chain-specific details:

- **TON:** Match the wallet contract and version, plus the wallet-ID/subwallet configuration.
- **Cardano:** Match the exact CIP and role model.
- **Solana:** Match the exact derivation convention used by the source wallet.

See [Watch-only derivation](05-watch-only/README.md).

### Why is my EVM balance zero when the address is right?

Check the network before concluding that derivation is wrong. Do not treat a correct address as proof that you are checking the right network, since the same address can legitimately exist on multiple EVM networks.

Confirm:

- Chain ID.
- RPC endpoint.
- Network name.
- Native currency.
- Explorer.

See [Tracking](06-tracking/README.md).

### How does payment tracking differ from wallet tracking?

Distinguish **wallet tracking, which asks what an address owns**, from **payment tracking, which asks whether an observed chain event satisfies a particular payment request**.

For payment tracking, use the request's:

- Network.
- Asset.
- Recipient.
- Amount **in atomic units**.
- Memo or tag.
- Expiry.

Follow **allocation → observation → confirmation → reconciliation**, and handle duplicates, retries and temporary outages throughout.

See [Payment tracking](07-payment-tracking/README.md) and [Operations & testing](10-operations-and-testing/README.md).

### Why must signing stay separate from tracking?

Keep the tracker watch-only, holding only an xpub or addresses. Treat these as sensitive public material, not signing authority. Keep the mnemonic, seed, seed bundle, vault, BIP-39 passphrase and vault unlock passphrase out of the tracker. Leave the private key or hardware wallet with a separate signer.

Keep those roles separate in the conceptual PSBT flow:

1. Build a PSBT watch-only.
2. Verify the recipient and amount on the signing device, then sign separately.
3. Finalise and broadcast.

See [Signing & hardware](09-signing-and-hardware/README.md).

### Can I build a wallet app from Bawa?

Use Bawa as a development reference, not a ready-to-use wallet app. Use its examples to generate a wallet on a trusted computer, derive public addresses without the seed and check results against an independent implementation.

Rely on Wallet Core for derivation and signing, not for connections to blockchain networks. Provide access to your own node or an external provider, code for balances and past transactions, transaction construction, an interface, backup procedures and a security review.

Keep the tracker watch-only and use a dedicated signer or hardware wallet for signatures. Do not rely on Bawa to hold funds or provide a hosted wallet service. Test the complete workflow on testnet, with no real funds.

### Which tools does Bawa use?

Use Bawa's Node tools in `tools/hdwallet-gen` (Trust Wallet Core 4.8.4) and its Python tools `tools/make_wallet.py` and `tools/decrypt_seed.py`. Trust Wallet Core 4.9.2 is the recommended upgrade pin in README section 5, not the version currently pinned by the tools. Do not attribute authorship of the guide's procedures to any other model or tool.

### Free or paid security, what am I actually buying?

Consider free, open-source coordination software that supports air-gapped signing through PSBT files or QR codes. For self-managed choices, also consider metal mnemonic backups and running your own multisig. Take responsibility for all the work and checking yourself.

Compare paid routes, including hardware wallets, assisted multisig memberships, and institutional custody or hardware security module (HSM) services. An assisted multisig arrangement might use 2-of-3, with the provider holding one key for recovery.

Recheck published fees before committing, because prices change. Look for guidance, support and recovery assistance, but do not treat payment as a guarantee that your funds cannot be stolen.

### My seed may be stolen, what now?

Assume someone else can spend the funds, even if nothing appears to be missing. On a fresh, trusted device, generate a wallet with a new seed and promptly transfer all assets, including every token, into it.

Do not wait for a theft to confirm your suspicion. Do not try to rescue the old wallet by altering its seed or adding a BIP-39 passphrase; it cannot be repaired. Avoid any trial payment from that wallet, as it could alert the thief.

Once everything has been moved, retire the old wallet for good and stop using its addresses for incoming payments.

### Testnet or mainnet, what changes?

Use testnet for experiments: its coins carry no market value, so errors do not put real funds at risk. Remember that mainnet uses real assets and errors there cannot be undone.

For Bitcoin on testnet4, recognise Bawa's use of `m/84'/0'/0'/0/i`, the mainnet derivation, as a documented deviation. Note that SLIP-0044 reserves coin type `1` for testnet, and SLIP-0132 gives testnet native SegWit the `vpub` prefix.

Treat mainnet as out of scope: it is absent from this guide set, and passing the gates does not authorise mainnet use.

Never send mainnet funds to an address intended for a testnet exercise. Before funding anything, confirm the network of the destination address, RPC endpoint and explorer. For EVM networks, also verify the chain ID, network name and native currency, since the same address can appear on several networks.

When checking a backup restore, use a tiny testnet amount, not real funds.

### Why do two wallets show different addresses for the same seed?

Bawa supports watch-only derivation for BTC, ETH and TRX. TON support is generation-only, not watch-only. Solana and Cardano are reference-only and are not supported by Bawa; their notes below describe comparisons with other wallets, not Bawa capabilities.

Start by comparing settings rather than assuming a faulty wallet. Check the mnemonic words, then check the BIP-39 passphrase, including whether one was used.

Next, compare the curve, coin-type value, derivation purpose, account number, branch and address index. Then check the network and address encoding, distinguishing legacy from native SegWit formats.

Finally, compare the wallet implementations and their settings. For TON, include the wallet contract, its version and the wallet-ID configuration. Put the complete derivation paths and address formats side by side before deciding either wallet is wrong.
