import { describe, expect, it } from 'vitest';
import { hashTypedData } from 'viem';
import { createMessageIntent, createNoopSigner } from './signing-intent';
import {
  bawaEip712Domain,
  signTypedDataWithSigner,
  splitTypedDataSignature,
  typedDataIntentFingerprint,
  type Eip712Domain,
} from './evm-typed-data';

const types: Record<string, { name: string; type: string }[]> = {
  BawaMessage: [{ name: 'text', type: 'string' }],
};
const primaryType = 'BawaMessage';
const message: Record<string, unknown> = { text: 'Approve this Bawa action' };

const typedDataHash = hashTypedData<Record<string, unknown>, string>({
  domain: bawaEip712Domain(1),
  types,
  primaryType,
  message,
});

// Keep the typed-data intent fixed when comparing domain bindings.
const intent = createMessageIntent('eth', typedDataHash);

describe('bawaEip712Domain', () => {
  it('creates the Bawa domain without a verifying contract', () => {
    const domain = bawaEip712Domain(1);

    expect(domain).toEqual({ name: 'Bawa', version: '1', chainId: 1 });
    expect(domain).not.toHaveProperty('verifyingContract');
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid chainId %s', (chainId) => {
    expect(() => bawaEip712Domain(chainId)).toThrow(RangeError);
  });

  it('accepts the largest safe positive integer', () => {
    expect(bawaEip712Domain(Number.MAX_SAFE_INTEGER).chainId).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('rejects a verifyingContract supplied on a runtime domain', async () => {
    const domain = {
      ...bawaEip712Domain(1),
      verifyingContract: '0x0000000000000000000000000000000000000001',
    };

    expect(() => typedDataIntentFingerprint(intent, domain)).toThrow(
      /verifyingContract/,
    );

    await expect(
      signTypedDataWithSigner(
        createNoopSigner('eth', '0x0000000000000000000000000000000000000000'),
        domain,
        types,
        primaryType,
        message,
      ),
    ).rejects.toThrow(/verifyingContract/);
  });
});

describe('typedDataIntentFingerprint', () => {
  it('gives different fingerprints for the same typed data on chains 1 and 2', () => {
    const chainOne = typedDataIntentFingerprint(intent, bawaEip712Domain(1));
    const chainTwo = typedDataIntentFingerprint(intent, bawaEip712Domain(2));

    expect(chainOne).toMatch(/^0x[0-9a-f]{64}$/);
    expect(chainTwo).toMatch(/^0x[0-9a-f]{64}$/);
    expect(chainOne).not.toBe(chainTwo);
  });

  it('is deterministic regardless of domain property insertion order', () => {
    const reordered: Eip712Domain = {
      version: '1',
      name: 'Bawa',
      chainId: 1,
    };

    expect(typedDataIntentFingerprint(intent, reordered)).toBe(
      typedDataIntentFingerprint(intent, bawaEip712Domain(1)),
    );
  });
});

describe('signTypedDataWithSigner', () => {
  it('returns the noop ETH signer’s raw 65 zero bytes', async () => {
    const signature = await signTypedDataWithSigner(
      createNoopSigner('eth', '0x0000000000000000000000000000000000000000'),
      bawaEip712Domain(1),
      types,
      primaryType,
      message,
    );

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature).toHaveLength(65);
    expect(signature).toEqual(new Uint8Array(65));
  });

  it('rejects a non-ETH signer', async () => {
    await expect(
      signTypedDataWithSigner(
        createNoopSigner('btc', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'),
        bawaEip712Domain(1),
        types,
        primaryType,
        message,
      ),
    ).rejects.toThrow(/ETH signer/);
  });

  it('rejects signing on a domain other than chainId 1', async () => {
    await expect(
      signTypedDataWithSigner(
        createNoopSigner('eth', '0x0000000000000000000000000000000000000000'),
        bawaEip712Domain(2),
        types,
        primaryType,
        message,
      ),
    ).rejects.toThrow(/chainId 1/);
  });
});

describe('splitTypedDataSignature', () => {
  it('extracts r and s and converts recovery 0/1 to v 27/28', () => {
    const signature = new Uint8Array(65);
    signature.fill(0x11, 0, 32);
    signature.fill(0x22, 32, 64);

    expect(splitTypedDataSignature(signature)).toEqual({
      r: `0x${'11'.repeat(32)}`,
      s: `0x${'22'.repeat(32)}`,
      v: 27,
    });

    signature[64] = 1;
    expect(splitTypedDataSignature(signature).v).toBe(28);
  });

  it.each([0, 64, 66])('rejects signature length %s', (length) => {
    expect(() => splitTypedDataSignature(new Uint8Array(length))).toThrow(
      /exactly 65 bytes/,
    );
  });

  it('rejects recovery values other than 0 or 1', () => {
    const signature = new Uint8Array(65);
    signature[64] = 2;

    expect(() => splitTypedDataSignature(signature)).toThrow(/recovery/);
  });
});
