# Mainnet derivation vectors (pinned)

> **Never fund any address in this file.** Every fixture below is a
> published test vector: the words are public, anyone can derive the
> same keys, and funds sent to these addresses can be stolen. These are
> regression targets only, never receiving addresses. Nothing on this
> page authorises a transfer, and no check here establishes a balance.

## How to run the checks

```sh
# Node side — Trust Wallet Core 4.9.1 (requires tools/hdwallet-gen deps)
node --test tests/mainnet-derivation-vectors.test.mjs
# Python side — bip_utils 2.12.2 (independent implementation)
python3 test/differential_test.py
```

Both must pass. A mismatch in either file is a stop: do not ship the
derivation change that caused it. The two files share one expected-value
table by construction — the same addresses appear in both, and the
vectors doc below is the human-readable copy. If a value changes in one
file, change it in all three places or not at all.

## Ripple fixture (Trust Wallet Core HDWallet example)

- Words: `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal`
- Passphrase: empty
- Entropy: `ba5821e8c356c05ba5f025d9532fe0f21f65d594`
- Source: Trust Wallet Core, `swift/Tests/HDWalletTests.swift`
- Note: 15 words because it is a published test vector; real wallets
  created by this repo are 24 words. Never mix the two.

| Chain | Path | Expected address |
|---|---|---|
| BTC | `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| BTC | `m/84'/0'/0'/0/1` | `bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za` |
| BTC | `m/84'/0'/0'/1/0` (change) | `bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve` |
| ETH | `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| ETH | `m/44'/60'/0'/0/1` | `0xD6c3112a8Db4991a7359018F15e501dfEE316d59` |
| TRX | `m/44'/195'/0'/0/0` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TRX | `m/44'/195'/0'/0/1` | `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` |
| TON | `m/44'/607'/0'` | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

Account extended public keys (account 0):

| Chain | Path | Expected node |
|---|---|---|
| BTC | `m/84'/0'/0'` | `zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9` |
| ETH | `m/44'/60'/0'` | `xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc` |
| TRX | `m/44'/195'/0'` | `xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF` |

## TON contract identity (ripple fixture)

- Contract: Wallet V4 R2 (`v4r2`)
- Wallet ID: `698983191` (`0x29A9A317`, the V4 default)
- Workchain: `0`
- Ed25519 public key at `m/44'/607'/0'`: `c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9`
- Raw address: `0:bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f`
- Non-bounceable: `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`
- Bounceable (same account, different encoding): `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi`
- The wallet-ID `0` drafts elsewhere are wrong for this fixture: they
  produce a different address for the same signing key.

## BIP-84 anchors (abandon phrase)

- Words: `abandon` eleven times, then `about`
- Passphrase: empty
- Source: BIP-84 specification, test vectors
  (`https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki`)

| Item | Path | Expected value |
|---|---|---|
| Account public key | `m/84'/0'/0'` | `zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs` |
| First receiving | `m/84'/0'/0'/0/0` | `bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu` |
| Second receiving | `m/84'/0'/0'/0/1` | `bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g` |
| First change | `m/84'/0'/0'/1/0` | `bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el` |

## Hardhat anchor (account 0)

- Words: `test` ten times, then `junk`
- Passphrase: empty
- Path: `m/44'/60'/0'/0/0`
- Expected ETH: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Source: Hardhat account 0 (`https://hardhat.org/hardhat-runner/docs/getting-started#overview`)

## BIP-32 test vector 1 (extended public keys only)

- Raw seed (hex): `000102030405060708090a0b0c0d0e0f`
- Source: BIP-32 specification, test vector 1
  (`https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki`)
- Only the extended *public* keys are reproduced here and in
  `test/differential_test.py`. The matching private extended keys are
  published in the specification itself and are already referenced by
  the repo's negative tests (`test/smoke.test.js`) and the secret
  scanner's known-test-vectors list; they are deliberately not copied
  into this doc or the positive tests.

| Path | Expected xpub |
|---|---|
| `m` | `xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8` |
| `m/0'` | `xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw` |
| `m/0'/1` | `xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ` |
| `m/0'/1/2'` | `xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5` |
| `m/0'/1/2'/2` | `xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV` |
| `m/0'/1/2'/2/1000000000` | `xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy` |

## Independent reproduction (2026-11-12, muse-vm)

| Implementation | Version | What it reproduced |
|---|---|---|
| Trust Wallet Core (WASM) | 4.9.1 (repo pin) | Ripple BTC/ETH/TRX/TON index 0, BTC/ETH index 1, BTC change 0, all three account xpubs, TON pubkey + address, abandon zpub + 3 addresses, Hardhat ETH 0 |
| Python bip_utils | 2.12.2 | Same ripple set, plus TRX index 1, TON address + SLIP-0010 pubkey, abandon set, Hardhat, BIP-32 TV1 xpubs at all 6 paths |
| @ton/ton (evidence only, not a repo dependency) | 15.4.0 (@ton/crypto 3.3.0) | TON V4 R2 address from the published pubkey: raw `0:bb819bc6…`, non-bounceable `UQC7…`, bounceable `EQC7…` |

Every shared value agrees byte for byte across the implementations that
cover it. Evidence: T30 lane (`bawa-fanout/T30/`), including the probe
scripts and the `@ton/ton` check output.

## Known limitation — TRON via a raw public key (Core 4.8.4)

`CoinTypeExt.deriveAddressFromPublicKey(tron, pubkey)` aborts the WASM
runtime when the public key comes from `getKey().getPublicKeySecp256k1()`
(verified first-hand: the first two steps succeed, the derive step
aborts and the process exits). The supported TRON routes at this pin
are `getAddressForCoin` (index 0) and `derive.js` from an extended
public key (the route the index-1 test uses). The xpub route via
`HDWallet.getPublicKeyFromExtended` works — that is what `derive.js`
uses. Do not add a direct TRON getKey-then-derive assertion: the abort
kills the whole test runner instead of failing one test.

## Not covered

- Index 2 addresses: no repo test asserts them (same gap as before;
  `compare.js` derives 0–2 as a helper, not as a test).
- Balances, histories, and any live-network state: out of scope for
  this offline derivation check. A derivation match proves address
  agreement only, never a balance or receipt of funds.
- Transaction construction/signing/broadcast: out of scope. This lane
  stops before broadcasting; M-35 execution is not authorised.
