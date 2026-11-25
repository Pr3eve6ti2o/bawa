/**
 * WalletConnect request signing.
 *
 * Lane C, "install all usable" programme (2026-11-25). Answers the
 * session requests the screen approves, with the wallet's own keys.
 *
 * What is signed here — and only here:
 * - `personal_sign`: EIP-191 message, via the wallet's
 *   `PartialSigner.signMessage`.
 * - `eth_signTypedData` / `eth_signTypedData_v4`: EIP-712 typed data,
 *   hashed with viem's `hashTypedData` and signed with
 *   `PartialSigner.signDigest`.
 * - `eth_chainId` / `eth_accounts`: read-only answers, no key involved.
 *
 * What is NEVER signed here: `eth_sendTransaction` and
 * `eth_signTransaction` — sending is switched off by standing owner
 * order, and signing a transaction would let the dApp broadcast it
 * and move funds. Those methods are never approved in a session
 * (see walletconnect.ts) and throw here if one ever arrives.
 *
 * The signer is injected: the screen passes the vault-backed
 * provider (`createVaultEvmSignerProvider`), tests pass a fake.
 * The mnemonic is borrowed inside `withMnemonicAsync` and never
 * leaves the vault closure. A request for any address this wallet
 * does not hold is refused — the dApp cannot make this wallet sign
 * as someone else.
 */

import { bytesToHex, hashTypedData, hexToBytes } from 'viem';
import { createPartialSigner } from './core';
import type { PartialSigner } from './signing-intent';
import { getSessionPassphrase, withMnemonicAsync } from './vault';

/** Provides the EVM signer for the wallet's ETH key, on demand. */
export type WalletConnectSignerProvider = () => Promise<PartialSigner>;

/**
 * The vault-backed provider: borrows the mnemonic while the vault is
 * open and builds the ETH signer (all EVM chains share the ETH key).
 * Throws 'Vault is not unlocked.' when the vault is locked or there
 * is no vault — the screen surfaces that instead of signing.
 */
export function createVaultEvmSignerProvider(): WalletConnectSignerProvider {
  return () =>
    withMnemonicAsync(async (mnemonic) =>
      createPartialSigner(mnemonic, getSessionPassphrase(), 'eth'),
    );
}

/**
 * Wallet Core returns the raw secp256k1 recovery id (0/1) as the
 * last signature byte (see `signDigest` in wallet/core.ts:
 * "Preserve raw recovery 0/1"). Ethereum message signatures carry
 * v as 27/28, so shift it. A byte already 27/28 is left alone.
 */
export function toEthereumSignature(signature: Uint8Array): Uint8Array {
  if (signature.byteLength !== 65) {
    throw new Error('Invalid signature length: expected 65 bytes.');
  }
  const out = Uint8Array.from(signature);
  const recovery = out[64];
  if (recovery === undefined || recovery > 28) {
    throw new Error('Invalid signature recovery byte.');
  }
  if (recovery < 27) {
    out[64] = recovery + 27;
  }
  return out;
}

function parseEip155ChainId(chainId: string): number {
  const match = /^eip155:([0-9]+)$/.exec(chainId);
  if (match === null || match[1] === undefined) {
    throw new Error('Unsupported WalletConnect chain: expected eip155:<id>.');
  }
  return Number.parseInt(match[1], 10);
}

function isSameAddress(left: string, right: string): boolean {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase()
  );
}

/**
 * Split a two-parameter signing request into the address param and
 * the payload param. dApps send them in either order, so the param
 * that matches this wallet's address is the address; the other is
 * the payload. Anything else is refused.
 */
function splitAddressAndPayload(
  params: unknown,
  address: string,
): { payload: unknown } {
  if (!Array.isArray(params) || params.length !== 2) {
    throw new Error('Invalid signing request: expected two parameters.');
  }
  const [first, second] = params;
  if (typeof first === 'string' && isSameAddress(first, address)) {
    return { payload: second };
  }
  if (typeof second === 'string' && isSameAddress(second, address)) {
    return { payload: first };
  }
  throw new Error(
    'The dApp asked to sign with an address this wallet does not hold.',
  );
}

function messageToBytes(data: unknown): Uint8Array {
  if (typeof data === 'string' && data.startsWith('0x')) {
    return hexToBytes(data as `0x${string}`);
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  throw new Error('Invalid signing request: expected a message string.');
}

/**
 * Sign (or answer) one approved WalletConnect session request.
 * Returns the JSON-RPC result: a 0x signature for the signing
 * methods, a 0x chain id for `eth_chainId`, the address list for
 * `eth_accounts`. Throws for anything else — the screen answers
 * those throws with an unsupported-method error, never a signature.
 */
export async function signWalletConnectRequest(args: {
  method: string;
  params: unknown;
  chainId: string;
  address: string;
  getSigner: WalletConnectSignerProvider;
}): Promise<unknown> {
  const { method, params, chainId, address, getSigner } = args;
  const evmChainId = parseEip155ChainId(chainId);

  switch (method) {
    case 'eth_chainId':
      return `0x${evmChainId.toString(16)}`;

    case 'eth_accounts':
      return [address];

    case 'personal_sign': {
      const { payload } = splitAddressAndPayload(params, address);
      const signer = await getSigner();
      const signature = await signer.signMessage(messageToBytes(payload));
      return bytesToHex(toEthereumSignature(signature));
    }

    case 'eth_signTypedData':
    case 'eth_signTypedData_v4': {
      const { payload } = splitAddressAndPayload(params, address);
      const typedData =
        typeof payload === 'string'
          ? (JSON.parse(payload) as unknown)
          : payload;
      const digest = hashTypedData(
        typedData as unknown as Parameters<typeof hashTypedData>[0],
      );
      const signer = await getSigner();
      const signature = await signer.signDigest(hexToBytes(digest));
      return bytesToHex(toEthereumSignature(signature));
    }

    default:
      throw new Error(
        `Unsupported WalletConnect method: ${method}. This wallet signs messages only; sending is switched off.`,
      );
  }
}
