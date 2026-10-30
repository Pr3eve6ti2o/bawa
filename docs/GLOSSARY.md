## Glossary

| Term | Plain definition | Authority |
|---|---|---|
| **Entropy** | The starting random data: 128–256 bits from a cryptographically secure random source. Before encoding it as words, BIP39 adds a checksum whose length in bits is the entropy length divided by 32. | BIP39 |
| **Mnemonic** | A word sequence encoding the entropy and its checksum. Each 11-bit chunk selects a word from a 2,048-word list, producing 12, 15, 18, 21 or 24 words. | BIP39 |
| **Seed** | A 64-byte value derived from the mnemonic and optional passphrase using PBKDF2-HMAC-SHA512 with 2,048 iterations. The salt is the literal text `mnemonic` followed by the passphrase. BIP32 uses the seed to derive the master private key and chain code. | BIP39; BIP32 |
| **Passphrase** | An optional input used alongside the mnemonic to derive the seed, not an extra word from the mnemonic word list. Changing the passphrase produces an entirely different seed. | BIP39 |
| **Master key** | The starting private key for BIP32 derivation. It is produced from the seed using HMAC-SHA512, together with a 32-byte chain code. | BIP32 |
| **Chain code** | A 32-byte value produced alongside the master private key. A chain code is used with a parent key and an index to derive a child key. | BIP32 |
| **Hardened derivation** | Child-key derivation that requires the parent private key; a public key alone cannot derive hardened children. Hardened indices are 2³¹ and above. An apostrophe marks a hardened index, as in `44'`. | BIP32 |
| **Non-hardened derivation** | Child-key derivation using indices from 0 to 2³¹ − 1. Child public keys can be derived from the parent public key and its chain code. | BIP32 |
| **Derivation path** | A sequence of steps leading to a derived key. The layout is `m/purpose'/coin_type'/account'/change/address_index`. Purpose, coin type and account are hardened. `change` is `0` for receiving addresses and `1` for change addresses. | BIP44 |
| **Account** | The hardened `account'` level of the derivation path. Bawa exports an account-level public key at `m/purpose'/coin'/account'`, for example BTC `m/84'/0'/0'`. The daemon and one-shot tool derive receiving addresses below that account at `/0/<index>`. | BIP44; Bawa code |
| **Address index** | The final number in the derivation path. It counts receiving addresses or change addresses from `0`, according to the selected change branch. | BIP44 |

BIP32 extended keys serialise one node of the key tree and its chain code into 78 bytes, then encode the result with Base58Check.

| Term | Plain definition | Authority |
|---|---|---|
| **xprv** | The BIP44 version of an extended private key. Bawa’s daemon rejects private extended keys. | BIP32; BIP44; Bawa code |
| **xpub** | The BIP44 version of an extended public key. Anyone holding it can derive non-hardened child public keys and addresses below that node, but it cannot sign or derive hardened children or private keys. Never store an xpub alongside a child private key: that combination can expose the parent. | BIP32; BIP44 |
| **ypub** | The BIP49 nested-SegWit version of an extended public key. | BIP32 (BIP49 version) |
| **zpub** | The BIP84 native-SegWit version of an extended public key. | BIP32; BIP84 |
| **Gap limit** | The number of consecutive unused addresses after which a wallet stops scanning for used addresses. Recovery must scan both receiving and change branches; addresses beyond the gap can be missed. | BIP44 |
| **Descriptor** | A Bitcoin Core string recording a script policy, its derivation origin and an address range. It lets a wallet reproduce its addresses without holding keys. | Bawa code (Bitcoin Core terminology) |
| **PSBT** | A standard unsigned-transaction format. A watch-only wallet builds it, a separate hardware wallet or offline signer signs it, and the watch-only side finalises and broadcasts it. The signer must verify the recipient and amount on its own screen. | BIP174; BIP371 extends it for Taproot |
| **Watch-only** | A system holding only public material, such as xpubs, zpubs or addresses. It can derive and watch addresses but cannot spend. Bawa’s `tools/hdwallet-gen` supports watch-only derivation for `btc`, `eth` and `trx` only. | Bawa code |
| **RPC** | A remote procedure call to a node or provider that reads chain state, such as balances, history or transaction status. It does not hold keys. | Bawa code |
| **Indexer** | A system that makes chain history searchable. It does not hold keys. | Bawa code |
| **Reorg** | A chain reorganisation that replaces recent blocks. A transaction that looked confirmed can drop out as a result. | Bawa code |
| **Confirmation** | Confirmations count the blocks built on top of a transaction. Trackers must handle reorgs rather than treating one sighting as final. | Bawa code |
| **Token identity** | The combination of network, contract or asset address, and decimals that identifies a token. A symbol alone is never enough: the same symbol can exist on many networks and contracts. | Bawa code |