## FAQ

### Where should I start?

Start with [Fundamentals](01-fundamentals/README.md), then [Chain Guides](02-chains/README.md) and the [Tool & Repository Map](03-tools-and-repositories/README.md) before moving on to [Wallet Generation](04-wallet-generation/README.md). Each README is organised around a job, so you can also read only what you need.

Bawa is an HD-wallet reference. It generates wallet material on a trusted machine, derives public addresses without the seed, verifies with an independent implementation and supports recovery of an encrypted seed.

### Can an xpub recover my wallet?

**No. An xpub cannot recover a wallet and cannot sign.** It only lets a system derive and watch addresses below that account.

Recovery requires either:

- The **mnemonic**, together with the passphrase if one was set.
- The **encrypted seed plus its data key**.

See [Watch-Only Derivation](05-watch-only/README.md) and [Security & Recovery](08-security-recovery/README.md).

### What does Bawa not do?

Bawa does not provide custody and is not an exchange, a hosted service or a security audit.

It does **not run a node, fetch balances or broadcast transactions**. Wallet Core places those jobs outside its scope; they belong in the application or infrastructure.

Bawa’s tracker side does not sign. Signing belongs in a separate signer or hardware wallet. See [Signing & Hardware](09-signing-and-hardware/README.md).

### How do I fund a test wallet safely?

**Use testnet only, or keep the exercise conceptual. Never use real funds.**

Before relying on your backups:

1. Write them offline.
2. Keep **2–3 separated copies**. Never digitise them or share them with support.
3. Test a restore with a tiny testnet amount.

See [Chain Guides](02-chains/README.md) and [Operations & Testing](10-operations-and-testing/README.md).

### What do I do if a seed is compromised?

A seed cannot be changed. Replace the wallet:

1. Generate a new wallet on a **fresh, trusted device**.
2. Move **every asset and token** to the new wallet.
3. Retire the old wallet **permanently**.

See [Security & recovery](08-security-recovery/README.md).

### Why does a derived address not match the expected address?

Check that you are using the same settings as the wallet you are trying to match, **in this order**:

1. Mnemonic.
2. BIP-39 passphrase.
3. Curve.
4. Coin type.
5. Purpose.
6. Account.
7. Branch.
8. Index.
9. Network and address encoding.
10. Wallet implementation and configuration.

Also check the chain-specific details:

- **TON:** wallet contract/version and wallet-ID/subwallet configuration.
- **Cardano:** the exact CIP and role model.
- **Solana:** the exact derivation convention used by the source wallet.

See [Watch-only](05-watch-only/README.md).

### Why is my EVM balance zero when the address is right?

The same address legitimately exists on multiple EVM networks. A correct address alone does not establish which network you are checking.

Before concluding that derivation is wrong, check:

- Chain ID.
- RPC endpoint.
- Network name.
- Native currency.
- Explorer.

See [Tracking](06-tracking/README.md).

### How does payment tracking differ from wallet tracking?

**Wallet tracking asks what an address owns.**  
**Payment tracking asks whether an observed chain event satisfies a particular payment request.**

Payment tracking needs the request’s:

- Network.
- Asset.
- Recipient.
- Amount **in atomic units**.
- Memo or tag.
- Expiry.

It then follows **allocation → observation → confirmation → reconciliation**, handling duplicates, retries and temporary outages throughout.

See [Payment tracking](07-payment-tracking/README.md) and [Operations & testing](10-operations-and-testing/README.md).

### Why must signing stay separate from tracking?

Tracking does not need signing authority. The tracker holds **only an xpub or addresses**; the separate signer holds the private key or hardware wallet.

The conceptual PSBT flow keeps those roles separate:

1. Build a PSBT watch-only.
2. Verify the recipient and amount on the signing device, then sign separately.
3. Finalise and broadcast.

See [Signing & hardware](09-signing-and-hardware/README.md).

## Can I build a wallet app from Bawa?

Yes, but it is a development reference, not a ready-to-use wallet app. Bawa demonstrates wallet generation on a trusted computer, public-address derivation without the seed, and checking results against an independent implementation. Wallet Core handles derivation and signing, not connections to blockchain networks. You still need access to your own node or an external provider, code for balances and past transactions, transaction construction, an interface, backup procedures and a security review. The tracker must remain watch-only; use a dedicated signer or hardware wallet for signatures. Bawa does not hold funds or offer a hosted wallet service. Test the complete workflow on testnet, with no real funds.

## Free or paid security — what am I actually buying?

Free, open-source coordination software can support air-gapped signing through PSBT files or QR codes. Self-managed choices also include metal seed backups and running your own multisig. You handle all the work and checking yourself. Paid routes include hardware wallets, assisted multisig memberships, and institutional custody or hardware security module (HSM) services. An assisted vault might use a 2-of-3 arrangement, with the provider holding one key for recovery. Look up its published fees again before committing, because prices change. Paying may get you guidance, support and recovery assistance; it does not guarantee that your funds cannot be stolen.

## My seed may be stolen — what now?

Assume someone else can spend the funds, even if nothing appears to be missing. On a fresh, trusted device, generate a wallet with a new seed and promptly transfer all assets, including every token, into it. Do not wait for a theft to confirm your suspicion. Do not try to rescue the old wallet by altering its seed or adding a passphrase; it cannot be repaired. Avoid any trial payment from that wallet, as it could alert the thief. Once everything has been moved, retire it for good and stop using its addresses for incoming payments.

## Testnet or mainnet — what changes?

Use testnet for experiments: its coins carry no market value, so errors do not put real funds at risk. Mainnet uses real assets, and errors there cannot be undone. Testnets follow the same derivation rules but may use different coin-type values and address prefixes. Never send mainnet funds to an address intended for a testnet exercise. Before funding anything, confirm the network of the destination address, RPC endpoint and explorer. For EVM networks, also verify the chain ID, network name and native currency; the same address can appear on several networks. When checking a backup restore, use a tiny testnet amount, not real funds.

## Why do two wallets show different addresses for the same seed?

The usual explanation is a difference in settings, not a faulty wallet. Start with the mnemonic words, then check the BIP-39 passphrase, including whether one was used. Next compare the curve, coin-type value, derivation purpose, account number, branch and address index. After that, check the network and address encoding; legacy and native SegWit are different formats. Finally, compare the wallet implementations and their settings. For TON, include the wallet contract, its version and the wallet-ID configuration. Put the complete derivation paths and address formats side by side before deciding either wallet is wrong.
