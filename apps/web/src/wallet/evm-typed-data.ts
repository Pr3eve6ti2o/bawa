import {
  bytesToHex,
  hashTypedData,
  hexToBytes,
  sha256,
  stringToBytes,
  type Hex,
} from 'viem';
import {
  intentFingerprint,
  type PartialSigner,
  type SigningIntent,
} from './signing-intent';

export type Eip712Domain = {
  name: 'Bawa';
  version: '1';
  chainId: number;
};

function assertValidChainId(chainId: number): void {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new RangeError('EIP-712 chainId must be a safe positive integer');
  }
}

function assertDomain(domain: Eip712Domain): void {
  assertValidChainId(domain.chainId);

  // Reject extra runtime properties, including explicitly undefined values.
  if ('verifyingContract' in domain) {
    throw new TypeError('Bawa EIP-712 domains must not include verifyingContract');
  }
}

function signatureRecovery(signature: Uint8Array): 0 | 1 {
  if (signature.length !== 65) {
    throw new RangeError('Typed-data signatures must be exactly 65 bytes');
  }

  const recovery = signature[64];
  if (recovery !== 0 && recovery !== 1) {
    throw new RangeError('Typed-data signature recovery must be 0 or 1');
  }

  return recovery;
}

export function bawaEip712Domain(chainId: number): Eip712Domain {
  assertValidChainId(chainId);
  return { name: 'Bawa', version: '1', chainId };
}

/**
 * Fingerprinting uses SHA-256, independently of the EIP-712 signing digest.
 * Explicit field ordering makes the JSON string canonical for these fields.
 */
export function typedDataIntentFingerprint(
  intent: SigningIntent,
  domain: Eip712Domain,
): string {
  assertDomain(domain);

  const canonical = JSON.stringify({
    chainId: domain.chainId,
    name: domain.name,
    version: domain.version,
    intentFingerprint: intentFingerprint(intent),
  });

  return sha256(stringToBytes(canonical));
}

/**
 * EVM intent binding uses the EIP-712 domain, not Sui's signing format or bytes.
 * Bawa currently permits signing only with an ETH signer on chainId 1.
 */
export async function signTypedDataWithSigner(
  signer: PartialSigner,
  domain: Eip712Domain,
  types: Record<string, { name: string; type: string }[]>,
  primaryType: string,
  message: Record<string, unknown>,
): Promise<Uint8Array> {
  if (signer.chain !== 'eth') {
    throw new Error('EIP-712 typed-data signing requires an ETH signer');
  }

  assertDomain(domain);
  if (domain.chainId !== 1) {
    throw new Error('Bawa EIP-712 signing requires chainId 1');
  }

  // The definitions are supplied at runtime; viem performs EIP-712 encoding.
  const hash = hashTypedData<Record<string, unknown>, string>({
    domain,
    types,
    primaryType,
    message,
  });

  const signature = await signer.signDigest(hexToBytes(hash));
  signatureRecovery(signature);

  // Preserve the core format: r || s || recovery (0/1), without converting v.
  return signature;
}

export function splitTypedDataSignature(signature: Uint8Array): {
  r: Hex;
  s: Hex;
  v: number;
} {
  const recovery = signatureRecovery(signature);

  return {
    r: bytesToHex(signature.subarray(0, 32)),
    s: bytesToHex(signature.subarray(32, 64)),
    v: recovery + 27,
  };
}
