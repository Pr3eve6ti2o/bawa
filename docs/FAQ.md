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
