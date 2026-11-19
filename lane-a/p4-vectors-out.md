PLACEMENT: top imports
```js
import { createHash } from 'node:crypto';
```

PLACEMENT: fixture constants near the other fixtures
```js
// Source: miguelmota/go-ethereum-hdwallet README/TestWallet.
const GOETH_FIXTURE = 'tag volcano eight thank tide danger coast health above argue embrace heavy';

// Source: dan-da/hd-wallet-derive README.
const HDWD_FIXTURE = 'refuse brush romance together undo document tortoise life equal trash sun ask';

// Source: miguelmota/go-ethereum-hdwallet README/TestWallet.
const GOETH_EXPECTED = '0xC49926C4124cEe1cbA0Ea94Ea31a6c12318df947';

// Source: dan-da/hd-wallet-derive README; legacy P2PKH cross-check, not wallet-core's default address.
const HDWD_EXPECTED = {
  legacyAddress: '14QEoz5SwQ5Kfjkhs5QitskgfD5QCqM7RB',
  compressedPubkeyHex: '024977580921d65487194d2d84744b411cdbc19ec374bdb3fdfcf32e86e3e16830',
};
```

PLACEMENT: helper above the describe
```js
function legacyP2PKHAddress(compressedPubkeyHex) {
  const pubkey = Buffer.from(compressedPubkeyHex, 'hex');
  const sha256 = createHash('sha256').update(pubkey).digest();
  const hash160 = createHash('ripemd160').update(sha256).digest();
  const payload = Buffer.concat([Buffer.from([0x00]), hash160]);
  const checksum = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);
  const bytes = Buffer.concat([payload, checksum]);
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = '1' + encoded;
  }
  return encoded;
}
```

PLACEMENT: inside the describe, after the Hardhat test
```js
  test('go-ethereum-hdwallet cross-check: volcano mnemonic derives the documented ETH address', () => {
    const wallet = core.HDWallet.createWithMnemonic(GOETH_FIXTURE, '');
    try {
      assert.equal(
        addressAt(wallet, core.CoinType.ethereum, "m/44'/60'/0'/0/0"),
        GOETH_EXPECTED,
      );
      assert.equal(wallet.getAddressForCoin(core.CoinType.ethereum), GOETH_EXPECTED);
    } finally {
      wallet.delete();
    }
  });

  test('hd-wallet-derive cross-check: refuse mnemonic derives the documented BTC legacy address', () => {
    const wallet = core.HDWallet.createWithMnemonic(HDWD_FIXTURE, '');
    let privateKey;
    let publicKey;
    try {
      privateKey = wallet.getKey(core.CoinType.bitcoin, "m/44'/0'/0'/0/0");
      publicKey = privateKey.getPublicKeySecp256k1(true);
      const compressedPubkeyHex = Buffer.from(publicKey.data()).toString('hex');
      assert.equal(compressedPubkeyHex, HDWD_EXPECTED.compressedPubkeyHex);
      assert.equal(
        legacyP2PKHAddress(compressedPubkeyHex),
        HDWD_EXPECTED.legacyAddress,
      );
    } finally {
      publicKey?.delete();
      privateKey?.delete();
      wallet.delete();
    }
  });
```