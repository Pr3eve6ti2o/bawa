import { describe, expect, it, vi } from 'vitest';
import { bytesToHex } from 'viem';
import {
  signWalletConnectRequest,
  toEthereumSignature,
  type WalletConnectSignerProvider,
} from './walletconnect-signing';
import type { PartialSigner } from './signing-intent';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';

/** Deterministic fake signer: returns canned bytes, signs nothing real. */
function makeFakeSigner(overrides: Partial<PartialSigner> = {}): {
  signer: PartialSigner;
  signMessage: ReturnType<typeof vi.fn>;
  signDigest: ReturnType<typeof vi.fn>;
} {
  const signature = new Uint8Array(65).fill(0xab);
  signature[64] = 1;
  const signMessage = vi.fn(async () => Uint8Array.from(signature));
  const signDigest = vi.fn(async () => Uint8Array.from(signature));
  const signer = {
    chain: 'eth',
    address: ADDRESS,
    signDigest,
    signMessage,
    ...overrides,
  } as PartialSigner;
  return { signer, signMessage, signDigest };
}

function providerFor(signer: PartialSigner): WalletConnectSignerProvider {
  return async () => signer;
}

describe('toEthereumSignature', () => {
  it('shifts recovery 0/1 to 27/28', () => {
    const raw = new Uint8Array(65).fill(0x01);
    raw[64] = 0;
    expect(toEthereumSignature(raw)[64]).toBe(27);
    raw[64] = 1;
    expect(toEthereumSignature(raw)[64]).toBe(28);
  });

  it('leaves 27/28 alone and rejects anything else', () => {
    const raw = new Uint8Array(65).fill(0x01);
    raw[64] = 27;
    expect(toEthereumSignature(raw)[64]).toBe(27);
    raw[64] = 28;
    expect(toEthereumSignature(raw)[64]).toBe(28);
    raw[64] = 29;
    expect(() => toEthereumSignature(raw)).toThrow(
      'Invalid signature recovery byte.',
    );
    expect(() => toEthereumSignature(new Uint8Array(64))).toThrow(
      'Invalid signature length: expected 65 bytes.',
    );
  });
});

describe('signWalletConnectRequest', () => {
  it('answers eth_chainId and eth_accounts without a signer', async () => {
    const getSigner = vi.fn(async () => {
      throw new Error('must not be called');
    });
    expect(
      await signWalletConnectRequest({
        method: 'eth_chainId',
        params: [],
        chainId: 'eip155:1',
        address: ADDRESS,
        getSigner,
      }),
    ).toBe('0x1');
    expect(
      await signWalletConnectRequest({
        method: 'eth_chainId',
        params: [],
        chainId: 'eip155:137',
        address: ADDRESS,
        getSigner,
      }),
    ).toBe('0x89');
    expect(
      await signWalletConnectRequest({
        method: 'eth_accounts',
        params: [],
        chainId: 'eip155:1',
        address: ADDRESS,
        getSigner,
      }),
    ).toEqual([ADDRESS]);
    expect(getSigner).not.toHaveBeenCalled();
  });

  it('signs a personal_sign message in either parameter order', async () => {
    const { signer, signMessage } = makeFakeSigner();
    const messageHex = '0x68656c6c6f';
    const raw = new Uint8Array(65).fill(0xab);
    raw[64] = 1;
    const expected = bytesToHex(toEthereumSignature(raw));

    for (const params of [
      [messageHex, ADDRESS],
      [ADDRESS, messageHex],
    ]) {
      const result = await signWalletConnectRequest({
        method: 'personal_sign',
        params,
        chainId: 'eip155:1',
        address: ADDRESS,
        getSigner: providerFor(signer),
      });
      expect(result).toBe(expected);
    }
    expect(signMessage).toHaveBeenCalledTimes(2);
    // 'hello' as bytes.
    expect(signMessage).toHaveBeenNthCalledWith(
      1,
      new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]),
    );
  });

  it('signs a plain-text personal_sign message', async () => {
    const { signer, signMessage } = makeFakeSigner();
    await signWalletConnectRequest({
      method: 'personal_sign',
      params: [ADDRESS, 'hello'],
      chainId: 'eip155:1',
      address: ADDRESS,
      getSigner: providerFor(signer),
    });
    expect(signMessage).toHaveBeenCalledWith(
      new TextEncoder().encode('hello'),
    );
  });

  it('signs EIP-712 typed data and returns the 27/28 signature', async () => {
    const { signer, signDigest } = makeFakeSigner();
    const typedData = {
      domain: {
        name: 'Example dApp',
        version: '1',
        chainId: 1,
        verifyingContract:
          '0x0000000000000000000000000000000000000000' as const,
      },
      types: {
        Greeting: [{ name: 'text', type: 'string' }],
      },
      primaryType: 'Greeting',
      message: { text: 'hello' },
    };
    const result = await signWalletConnectRequest({
      method: 'eth_signTypedData_v4',
      params: [ADDRESS, JSON.stringify(typedData)],
      chainId: 'eip155:1',
      address: ADDRESS,
      getSigner: providerFor(signer),
    });
    expect(signDigest).toHaveBeenCalledTimes(1);
    const digest = signDigest.mock.calls[0]?.[0] as Uint8Array;
    expect(digest.byteLength).toBe(32);
    const raw = new Uint8Array(65).fill(0xab);
    raw[64] = 1;
    expect(result).toBe(bytesToHex(toEthereumSignature(raw)));
  });

  it('refuses to sign for an address the wallet does not hold', async () => {
    const { signer } = makeFakeSigner();
    await expect(
      signWalletConnectRequest({
        method: 'personal_sign',
        params: ['0x68656c6c6f', OTHER_ADDRESS],
        chainId: 'eip155:1',
        address: ADDRESS,
        getSigner: providerFor(signer),
      }),
    ).rejects.toThrow('does not hold');
  });

  it('refuses transaction methods — sending is switched off', async () => {
    const { signer } = makeFakeSigner();
    for (const method of ['eth_sendTransaction', 'eth_signTransaction']) {
      await expect(
        signWalletConnectRequest({
          method,
          params: [],
          chainId: 'eip155:1',
          address: ADDRESS,
          getSigner: providerFor(signer),
        }),
      ).rejects.toThrow('Unsupported WalletConnect method');
    }
  });

  it('refuses non-EVM chain ids', async () => {
    const { signer } = makeFakeSigner();
    await expect(
      signWalletConnectRequest({
        method: 'eth_chainId',
        params: [],
        chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        address: ADDRESS,
        getSigner: providerFor(signer),
      }),
    ).rejects.toThrow('Unsupported WalletConnect chain');
  });
});
