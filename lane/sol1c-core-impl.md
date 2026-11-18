```typescript
import { loadCore } from '../engine/boundary';

type WalletCore = Awaited<ReturnType<typeof loadCore>>;

export type ChainId = 'btc' | 'eth' | 'trx' | 'ton';
export type WalletAddresses = Record<ChainId, string>;
export type WalletCoin = Parameters<
  WalletCore['HDWallet']['getPublicKeyFromExtended']
>[1];

// These are getAddressForCoin's default derivation paths in Wallet Core 4.9.3.
const DEFAULT_PATHS: Readonly<Record<ChainId, string>> = Object.freeze({
  btc: "m/84'/0'/0'/0/0",
  eth: "m/44'/60'/0'/0/0",
  trx: "m/44'/195'/0'/0/0",
  ton: "m/44'/607'/0'",
});

function coinForChain(core: WalletCore, chain: ChainId): WalletCoin {
  switch (chain) {
    case 'btc':
      return core.CoinType.bitcoin;
    case 'eth':
      return core.CoinType.ethereum;
    case 'trx':
      return core.CoinType.tron;
    case 'ton':
      return core.CoinType.ton;
    default:
      throw new Error('Unsupported chain.');
  }
}

function assertValidMnemonic(core: WalletCore, mnemonic: string): void {
  if (!core.Mnemonic.isValid(mnemonic)) {
    throw new Error('Invalid mnemonic.');
  }
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;

  for (const byte of bytes) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

/**
 * Preserve the V4R2 contract hash supplied by Wallet Core and emit a mainnet,
 * workchain-zero, URL-safe UQ address.
 *
 * TON terminology: UQ uses the non-bounceable tag; EQ is bounceable. This file
 * follows the explicitly requested UQ prefix.
 */
function toTonUqAddress(address: string): string {
  let decoded: string;

  try {
    decoded = globalThis.atob(
      address.replace(/-/g, '+').replace(/_/g, '/'),
    );
  } catch {
    throw new Error('Invalid TON user-friendly address encoding.');
  }

  if (decoded.length !== 36) {
    throw new Error('Invalid TON user-friendly address length.');
  }

  const bytes = Uint8Array.from(decoded, (character) =>
    character.charCodeAt(0),
  );

  // Reject testnet addresses and any workchain other than zero.
  if (
    bytes[1] !== 0 ||
    (bytes[0] !== 0x11 && bytes[0] !== 0x51)
  ) {
    throw new Error('Expected a mainnet workchain-zero TON address.');
  }

  bytes[0] = 0x51;

  const checksum = crc16Xmodem(bytes.subarray(0, 34));
  bytes[34] = checksum >>> 8;
  bytes[35] = checksum & 0xff;

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function checkedAddress(
  core: WalletCore,
  chain: ChainId,
  address: string,
): string {
  const coin = coinForChain(core, chain);

  if (!core.CoinTypeExt.validate(coin, address)) {
    throw new Error(`Wallet Core returned an invalid ${chain} address.`);
  }

  if (chain !== 'ton') {
    return address;
  }

  const normalized = toTonUqAddress(address);

  if (
    !normalized.startsWith('UQ') ||
    !core.CoinTypeExt.validate(coin, normalized)
  ) {
    throw new Error('Invalid workchain-zero TON UQ address.');
  }

  return normalized;
}

/** Generate a 24-word mnemonic from 256 bits of secure entropy. */
export async function createWallet(passphrase = ''): Promise<string> {
  const cryptoProvider = globalThis.crypto;

  if (
    !cryptoProvider ||
    typeof cryptoProvider.getRandomValues !== 'function'
  ) {
    throw new Error('Secure random number generation is unavailable.');
  }

  const core = await loadCore();
  const entropy = new Uint8Array(32);

  try {
    cryptoProvider.getRandomValues(entropy);

    const wallet = core.HDWallet.createWithEntropy(entropy, passphrase);
    if (!wallet) {
      throw new Error('Unable to create wallet.');
    }

    try {
      return wallet.mnemonic();
    } finally {
      wallet.delete();
    }
  } finally {
    entropy.fill(0);
  }
}

/** Validate and restore a mnemonic without retaining a WASM wallet object. */
export async function restoreWallet(
  mnemonic: string,
  passphrase = '',
): Promise<string> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    return wallet.mnemonic();
  } finally {
    wallet.delete();
  }
}

/**
 * Derive account-zero, index-zero addresses using DEFAULT_PATHS.
 * Wallet Core 4.9.3's TON default is a workchain-zero V4R2 wallet, using the
 * single fully hardened path m/44'/607'/0', with no change/index suffix.
 */
export async function deriveAddresses(
  mnemonic: string,
  passphrase = '',
): Promise<WalletAddresses> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    const addressFor = (chain: ChainId): string =>
      checkedAddress(
        core,
        chain,
        wallet.getAddressForCoin(coinForChain(core, chain)),
      );

    return {
      btc: addressFor('btc'),
      eth: addressFor('eth'),
      trx: addressFor('trx'),
      ton: addressFor('ton'),
    };
  } finally {
    wallet.delete();
  }
}

/** Derive an external-chain address from an account-level extended public key. */
export async function deriveFromXpub(
  chain: ChainId,
  xpub: string,
  index: number,
): Promise<string> {
  if (chain === 'ton') {
    throw new Error(
      'TON uses fully hardened Ed25519 derivation and cannot derive children from an xpub.',
    );
  }

  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= 0x80000000
  ) {
    throw new Error('Address index must be an unhardened 31-bit integer.');
  }

  if (xpub.trim().length === 0) {
    throw new Error('An extended public key is required.');
  }

  const core = await loadCore();
  const coin = coinForChain(core, chain);
  const path = DEFAULT_PATHS[chain].replace(/\/0$/u, `/${index}`);

  const publicKey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, path);
  if (!publicKey) {
    throw new Error('Unable to derive an extended public key.');
  }

  try {
    // Required even when the source is already uncompressed: compressed TRX
    // public keys passed to deriveAddressFromPublicKey abort Wallet Core 4.9.3.
    const uncompressed = publicKey.uncompressed();
    if (!uncompressed) {
      throw new Error('Unable to obtain an uncompressed public key.');
    }

    try {
      const address = core.CoinTypeExt.deriveAddressFromPublicKey(
        coin,
        uncompressed,
      );

      return checkedAddress(core, chain, address);
    } finally {
      if (uncompressed !== publicKey) {
        uncompressed.delete();
      }
    }
  } finally {
    publicKey.delete();
  }
}

/**
 * Supply private-key bytes only for the duration of the callback.
 * Async callbacks are awaited before wiping the bytes. The callback must not
 * retain, copy, log, or transfer the supplied secret buffer.
 */
export async function withSigningKey<T>(
  mnemonic: string,
  passphrase: string,
  coin: WalletCoin,
  path: string,
  fn: (privateKeyBytes: Uint8Array) => T | PromiseLike<T>,
): Promise<T> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);

  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  if (!wallet) {
    throw new Error('Unable to restore wallet.');
  }

  try {
    const privateKey = wallet.getKey(coin, path);
    if (!privateKey) {
      throw new Error('Unable to derive a signing key.');
    }

    try {
      // Use the returned bytes directly, avoiding an additional secret copy.
      const bytes = privateKey.data();

      try {
        if (bytes.length === 0) {
          throw new Error('Wallet Core returned an empty signing key.');
        }

        return await fn(bytes);
      } finally {
        bytes.fill(0);
      }
    } finally {
      privateKey.delete();
    }
  } finally {
    wallet.delete();
  }
}
```