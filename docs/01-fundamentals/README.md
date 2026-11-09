# HD wallet fundamentals

## 1. Entropy

A 24-word mnemonic holds 256 bits of entropy. Generate entropy with a CSPRNG from the operating system or a crypto library. Never use home-made generators, timestamps, usernames, mouse movements, “random” strings or human-chosen words. Humans are bad random-number generators.

## 2. BIP-39 mnemonic

For a 24-word [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic, 256 entropy bits plus 8 checksum bits gives 264 bits; 264 / 11 = 24 words. PBKDF2-HMAC-SHA512, with 2048 iterations, produces a 64-byte seed. The seed is root material, not a Bitcoin private key.

The exact construction is:

> Seed = PBKDF2-HMAC-SHA512(mnemonic in UTF-8 NFKD, salt "mnemonic" + passphrase in UTF-8 NFKD, 2048 iterations, 64-byte output). With Bawa's empty passphrase the salt is the literal string "mnemonic".

**Empty passphrase.** BIP-39 defines the empty string as the default when you do not supply a passphrase. Bawa’s policy is empty-only: if you supply any non-empty passphrase input, Bawa rejects it, never silently replacing or trimming it. That rejection is Bawa’s rule, not a BIP-39 requirement.

**Word counts.** BIP-39 supports entropy lengths from 128 to 256 bits in 32-bit steps, giving 12, 15, 18, 21 or 24 words. ENT is the entropy length, CS is the checksum length and MS is the mnemonic word count.

| ENT (bits) | CS (bits) | Combined (bits) | MS (words) |
| --- | --- | --- | --- |
| 128 | 4 | 132 | 12 |
| 160 | 5 | 165 | 15 |
| 192 | 6 | 198 | 18 |
| 224 | 7 | 231 | 21 |
| 256 | 8 | 264 | 24 |

The English list has 2048 words, with indices 0–2047. A 24-word mnemonic holds 256 entropy bits plus 8 checksum bits — not 264 bits of randomness.

Bawa generates 24-word mnemonics but the repository tools do not provide a mnemonic-import entry point; BIP-39 itself does not oblige an application to support all five.

**Published checksum test — test data only, never fund.** The published English test vector in [trezor/python-mnemonic’s `vectors.json`](https://github.com/trezor/python-mnemonic/blob/master/vectors.json) starts with 128 zero bits: 16 zero bytes.

- The SHA-256 digest begins `374708ff…`.
- The checksum is the first 4 bits: `0011`.
- The combined 132 bits form 12 groups.
- Groups 1–11 have index 0: `"abandon" ×11`.
- Group 12 contains seven entropy bits plus four checksum bits, giving index 3: `"about"`.

The mnemonic is `"abandon" ×11 + "about"`. The last word carries both entropy and checksum bits; it is not a separate checksum word.

**Checksum limits.** A 12-word mnemonic has a 4-bit checksum. One in sixteen uniformly random 12-word sequences from the word list passes. Checksum validity shows internal consistency, not proof that your backup is correct. A mistyped word that remains a valid list entry usually makes the checksum inconsistent; a wrong mnemonic with a valid checksum passes and leads to a different wallet.

## 3. HD derivation (BIP-32)

[BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) defines an HD tree on secp256k1. An extended node contains depth, parent fingerprint, child number, chain code and a key.

**Master derivation.**

```text
I = HMAC-SHA512(key "Bitcoin seed", data seed)
```

Interpret the left half, `I_L`, as the master private scalar `k_m`. Require `1 <= k_m < n`, where `n` is the secp256k1 group order. Reject invalid values; never reduce them modulo `n`. The right half, `I_R`, is the master chain code. The master public key is `K_m = point(k_m)`.

**Private-child derivation — CKDpriv.** With parent private key `k_p`, parent public key `K_p`, parent chain code `c_p` and child index `i`, construct the HMAC input as follows:

```text
normal:   D = serP(K_p) || ser32(i)
hardened: D = 0x00 || ser256(k_p) || ser32(i)

I = HMAC-SHA512(key c_p, data D)
```

Interpret `I_L` as the integer `t`. Derive the child key and chain code:

```text
k_child = (k_p + t) mod n
c_child = I_R
```

**Public-child derivation — CKDpub.** Use the normal `D` and the same HMAC construction:

```text
K_child = point(t) + K_p
c_child = I_R
```

CKDpub supports non-hardened derivation only. It rejects hardened indices.

Reject an invalid child and try the next index if `t >= n`, the private result is zero or the public result is the point at infinity.

**Hardened boundary.** The boundary is exactly `2^31`:

- `0..2^31-1`: non-hardened.
- `2^31..2^32-1`: hardened.

Index `2^31 = 2147483648 = 0x80000000` **is hardened**. For child number `j`, hardened notation means `j' = jH = j + 2^31`; for `j = 0`, `0' = 0H = 2^31`. The apostrophe is notation, not part of the encoded index.

**Private-key leak rule.** If you have a parent extended public key and any one descendant private key reached through an entirely non-hardened path, you can recover the parent private key. Work backwards along the path, using this relation at each edge:

```text
k_parent = (k_child - t) mod n
```

This compromises the whole subtree rooted at that parent, including hardened children below it. A hardened edge breaks the recovery link; it does not protect children beneath a parent whose extended private key has already been recovered.

**SLIP-0010 test vector 1 — published test material, never fund.** The published [secp256k1 test vector](https://github.com/satoshilabs/slips/blob/master/slip-0010.md#test-vector-1-for-secp256k1) uses this 16-byte seed input:

```text
000102030405060708090a0b0c0d0e0f
```

This is **not a 64-byte BIP-39 wallet seed**. Decode the hex to bytes and use those bytes unchanged. Do not pad or pre-hash them.

The master node is:

```text
Chain code:
873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508

Private key:
e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35

Compressed public key:
0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2
```

At `m/0H`, also written `m/0'`, the child index is `2147483648` (`0x80000000`):

```text
Chain code:
47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141

Private key:
edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea
```

CKDpub from the master public node at index `2147483648` fails: hardened derivation requires the parent private key.

## 4. Purpose, coin and account (BIP-43/44)

Use the [BIP-43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki) purpose convention and [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) path form:

```text
m / purpose' / coin_type' / account' / change / address_index
```

Read `m/44'/60'/0'/0/0` as:

| Component | Meaning |
| --- | --- |
| `44'` | BIP-44 purpose |
| `60'` | Ethereum coin type |
| `0'` | Account 0 |
| `0` | External chain |
| `0` | Address 0 |

This is a convention, not a universal law. Use accounts to separate logical wallets within one seed, not to create separate backups: the same seed recovers both.

Branch `0` is external/receiving; branch `1` is internal/change. Ethereum tooling commonly keeps branch `0` and increments the final index.

Store the index in your application; never reconstruct it by guessing from a few addresses. Persist the last-used and next index per account and branch. Record allocations before payment arrives: an unpaid address can look unused.

**Why the path and passphrase are fixed.** The fixed path and empty BIP-39 passphrase are what make the same mnemonic reproduce the same addresses. A different path or a non-empty passphrase gives you different addresses and an apparently empty wallet. The funds are not lost, but they are unreachable from this policy. Do not add any alternative-path or passphrase option.

## 5. Mnemonic, seed, private key, extended public key: what each is

Keep these distinct:

- **Mnemonic:** the 24-word BIP-39 sequence Bawa generates.
- **Seed:** the 64-byte value PBKDF2 derives from the mnemonic.
- **Private key:** the key you use to sign for one address.
- **Extended public key:** a key that derives public children without signing authority.

Your mnemonic reproduces the intended seed only with the same BIP-39 passphrase. A bare private key lacks the chain code needed for HD derivation. An account extended private key, or xprv, recovers only its subtree; the seed or master xprv is root-level material.

**What an xpub exposes.** An extended public key, or xpub, includes the chain code needed for non-hardened public-child derivation. Anyone holding an account xpub can derive every receiving and change address below that account, including unissued ones, and link their on-chain activity.

On its own, an xpub cannot recover hardened private ancestors or authorise a spend. Treat it as sensitive public material. Keep it out of public logs and unrestricted exports.

## 6. Hardened derivation and watch-only design

Keep your address server on the public side. For `m/44'/60'/0'/0/i`, the purpose, coin and account levels are hardened; the branch and address index are non-hardened.

Export the account xpub at `m/44'/60'/0'`. Your server derives `/0/0`, `/0/1`, `/0/2`… for deposit addresses without signing authority.

This design is unsafe if any private key on the non-hardened branch reaches someone holding the account xpub: one leaked address private key recovers the account private key. BIP-44 hardens account levels to contain the damage. An account compromise cannot be reversed through the hardened account edge to the coin-type parent or sibling accounts.

**SLIP-0010 curves.** [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) uses these master HMAC keys:

| Curve | HMAC key |
| --- | --- |
| secp256k1 | `"Bitcoin seed"` |
| NIST P-256 | `"Nist256p1 seed"` |
| ed25519 | `"ed25519 seed"` |
| curve25519 | `"curve25519 seed"` |

For ed25519 and curve25519, you must derive children through a hardened step from a private parent. There is no non-hardened derivation, so you cannot derive a watch-only sequence of new addresses from a public node.
## 7. Paths, accounts, change and indexes

An account separates your logical wallets within one seed; it does not create separate backups. The same seed recovers both. Branch `0` is external/receiving; branch `1` is internal/change. Record address allocations before payment arrives: an unpaid address can look unused. Persist the last-used and next index per account and branch. Never reconstruct an index by guessing from a few addresses.

The fixed path and the empty [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) passphrase are what make the same mnemonic reproduce the same addresses. If you use a different path or a non-empty passphrase, you get different addresses and an apparently empty wallet. The funds are not lost, but they are unreachable from this policy. Do not add any alternative-path or passphrase option.

## 8. Extended keys and version bytes

An extended key has a 78-byte payload, with these fields in order: version (4 bytes), depth (1 byte), parent fingerprint (4 bytes), child number (4 bytes), chain code (32 bytes) and key data (33 bytes). Add a 4-byte checksum — the first 4 bytes of `SHA256(SHA256(payload))` — to make 82 bytes, then Base58-encode them.

| Network | Key type | Version bytes | Prefix |
| --- | --- | --- | --- |
| Mainnet | Public | `0x0488B21E` | `xpub` |
| Mainnet | Private | `0x0488ADE4` | `xprv` |
| Testnet | Public | `0x043587CF` | `tpub` |
| Testnet | Private | `0x04358394` | `tprv` |

SLIP-0132 mainnet public prefixes:

| Prefix | Address policy |
| --- | --- |
| `xpub` | [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) legacy |
| `ypub` | [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) nested SegWit |
| `zpub` | [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) native SegWit |

SLIP-0132 testnet public prefixes:

| Prefix | Version bytes | Address policy | Path prefix |
| --- | --- | --- | --- |
| `vpub` | `0x045f1cf6` | [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) testnet | `m/84'/1'` |
| `tpub` | `0x043587cf` | [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) testnet | `m/44'/1'` |
| `upub` | `0x044a5262` | [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) testnet | `m/49'/1'` |

Do not treat these prefixes as interchangeable. A legacy-only `xpub` importer may reject a `zpub`, or derive the same child public keys but build legacy addresses.

## 9. From entropy to seed: the checked boundaries

The boundaries established in §§2–3 and §6 are:

```text
entropy (256 bits, CSPRNG)
  → mnemonic (24 words, 8 checksum bits)
  → seed (PBKDF2-HMAC-SHA512, 2048 iterations, 64 bytes)
  → master extended key (HMAC-SHA512, key "Bitcoin seed")
  → account key (hardened purpose/coin/account)
  → receiving addresses (non-hardened branch/index)
```

For 24 words, 256 entropy bits plus 8 checksum bits make 264 bits. The last word carries both entropy and checksum bits.

| PBKDF2 input or parameter | Value |
| --- | --- |
| Algorithm | PBKDF2-HMAC-SHA512 |
| Mnemonic input | NFKD-normalised, then UTF-8-encoded |
| Passphrase, used in the salt | NFKD-normalised, then UTF-8-encoded |
| Salt | `"mnemonic" + passphrase` |
| Iterations | 2048 |
| Output | 64 bytes: the seed |
| Bawa’s empty passphrase | `""`, so the salt is the literal string `"mnemonic"` |

**Leak rule (§3):** if you expose a parent extended public key and one descendant private key on an all-non-hardened path, you reveal the parent private key.

**Address server (§6):** the account xpub at `m/44'/60'/0'` lets you derive deposit addresses without signing authority.

**SLIP-0010 test vector 1 (§3):** the 16-byte test input `000102030405060708090a0b0c0d0e0f` gives the published master chain code, private key and compressed public key stated there.

## 10. From mnemonic to seed: PBKDF2, normalisation, passphrase

NFKD is Unicode compatibility decomposition. For both PBKDF2 inputs, normalise first, then UTF-8 encode. “é” as one character and “e” plus a combining acute accent normalise to the same sequence; the accent remains. NFKD does not correct spelling, translate words, ignore capitalisation or trim spaces. Byte equality is the boundary, not appearance. A word outside the selected wordlist fails validation.

An omitted BIP-39 passphrase means `""`, with the salt exactly `"mnemonic"`. A non-empty passphrase with the same 24 words gives you a wholly different wallet — not locked and unlocked views of one wallet.

[BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) never returns a “wrong passphrase” error: every passphrase is accepted and produces a valid seed. A typo silently selects another wallet, usually apparently empty. If you forget an unrecorded passphrase, there is no recovery mechanism; the mnemonic alone cannot restore your intended wallet.

A BIP-39 passphrase is not a device PIN, not a vault unlock passphrase and not a second factor with a reset path. PBKDF2 is one-way: you cannot decode the seed back into words or a passphrase.

Recording rules:

- Record the mnemonic’s words in their exact order.
- Record the passphrase exactly, including case and spaces. Explicitly note if it is empty.
- Keep the words and passphrase in separate offline records, in different locations.
- Never photograph either.
- Never type a real mnemonic or passphrase into a connected device.
- Keep real recovery data out of guides, tickets, repositories and chats.
## 11. Beginner mistakes

1. **Using a brainwallet.** Your choices follow searchable patterns. Replace it with a freshly generated wallet.

2. **Photographing or cloud-storing your mnemonic, or entering a real mnemonic into a website, chat or connected computer.** If exposed, treat it as compromised: create a fresh wallet from fresh entropy, move funds and retire the old wallet. Another address or account under the exposed mnemonic does not repair it.

3. **Setting a BIP-39 passphrase, then forgetting it or expecting a reset.** Do not confuse it with your vault unlock passphrase. Record the exact BIP-39 passphrase offline, separately from your mnemonic, and practise recovery with disposable testnet data. If you lose it but a device can still sign, migrate while access remains.

4. **Using one address for everything, or publishing an account `xpub`.** Use a fresh receiving address per payment and one account per purpose. Give the `xpub` only to the specific service needing that account's visibility. Never give descendant private keys to an `xpub` recipient.

5. **Giving an address server an `xprv`, or importing a child private key alongside a shared `xpub`.** Keep the server watch-only. The hardened purpose, coin and account levels block key recovery into higher ancestors; they do not protect the rest of the compromised account.

6. **Restoring with the wrong path, coin type or wordlist language, then treating an empty view as proof of loss.** Check your words, language, BIP-39 passphrase, network, `coin_type`, account path, receiving/change branch and index range. Do not translate the mnemonic. The testnet legacy BIP-44 example `m/44'/1'/0'/0/0` is account 0's first receiving address. Match the script/address type: `xpub` and `zpub` are not interchangeable. Scan the recorded range before concluding that funds are missing.

7. **Treating the mnemonic, seed, master key and account private key as equivalent backups.** An account `xprv` recovers only its subtree; the 64-byte BIP-39 seed or a master `xprv` is root-level. Your mnemonic reproduces the intended seed only with the same BIP-39 passphrase. A complete mnemonic backup needs ordered words, wordlist language, the exact passphrase or an explicit empty-passphrase decision, plus network/coin type, all account paths, script types and per-branch index records. A bare private key lacks the chain code for HD derivation.

8. **Sending real bitcoin to check derivation.** Rehearse with disposable testnet secrets, or compare derivations without transactions. Published test-vector secrets are public: compare outputs, never send coins to their addresses. Do not reuse rehearsal keys for a real wallet.

**Unfunded testnet recovery check:** use a disposable testnet wallet and leave it unfunded. Record its first receiving address. Restore with the same words and the exact BIP-39 passphrase, then repeat with a deliberately altered passphrase. Keep the path, index and address type unchanged. The exact restore reproduces the recorded address; the altered passphrase gives a different address, although both wallets look empty. Compare addresses, not balances. Keep recovery records offline and publish no account `xpub`.

## 12. From scratch, without Bawa code

1. **Generate entropy offline.** Use a CSPRNG on a trusted, disconnected device, with fresh material.

2. **Write the words by hand.** Use an offline tool to encode the entropy with your chosen wordlist. Number the words in order and record the language. Do not take photographs or screenshots, or store the mnemonic in cloud notes.

3. **Verify the checksum.** Re-enter the handwritten words with the same wordlist. A checksum pass does not mean your BIP-39 passphrase or path is correct.

4. **Derive the seed and record the passphrase decision.** Record an explicit empty-passphrase decision, or store the exact non-empty BIP-39 passphrase offline and separately from your mnemonic. Derive the 64-byte BIP-39 seed offline. A mistyped passphrase produces a different valid seed, with no warning.

5. **Derive the account.** Use the documented testnet account path for your intended address type. Derive the master `xprv`, then the account key and a receiving address with the intended script type. Give address-only applications only the account `xpub`.

6. **Record path and index state.** Record the network, coin type, account path and script convention. Keep separate last-used indices for receiving and change, plus the highest allocated index. Mark untouched branches as “none issued”. A written ledger works for rehearsal, but a payment application must persist allocations atomically before presenting addresses.

7. **Check published test vectors before real use.** In a separate disposable session, reproduce published BIP-39/BIP-32 cases with their stated inputs and settings. Compare mnemonic, seed and extended-key outputs. Treat public test inputs as test data, never as receiving wallets. Then rehearse restoring the testnet wallet you generated separately and confirm that the expected addresses reappear.

8. **Only after those checks, consider a real wallet.** Use fresh entropy, a new backup and trusted wallet software or hardware. Verify recovery without making a payment. Carry over none of the rehearsal or test-vector secrets.

**Exposure rule:** if your mnemonic, a passphrase or any private key is exposed, retire that wallet and move funds to a fresh wallet from independent entropy on a trusted device. Another address or account beneath the old seed is not a fresh wallet.

## 13. Primary standards and sources

- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP-43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki)
- [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki)
- [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki)
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)

Bawa does not name a concrete CSPRNG, mnemonic or PBKDF2 API here, or give exact normalisation or text-encoding rules beyond the BIP-39 reference. This section contains no byte-for-byte test-vector inputs and outputs, no executable end-to-end example and no expected seed value. Check your implementation against the published test vectors in the [BIP-39 specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) itself.

There is no runnable derivation or signing workflow with expected outputs here. Follow the full [BIP-32 procedure](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), choose a documented API and check your derivation against the published BIP-32 test vectors.
