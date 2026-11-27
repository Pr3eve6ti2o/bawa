// P2-A, M1: validateRecipient resolves ENS names on EVM chains.
// The resolver itself is mocked (its own tests cover the live RPC);
// this file proves the send path uses the resolved address and
// rejects a bad name with the pattern's wording.
import { describe, expect, it, vi } from 'vitest';
import { validateRecipient } from './send';

vi.mock('./ens', async (importOriginal) => {
  const original = await importOriginal<typeof import('./ens')>();
  return {
    ...original,
    resolveEnsName: vi.fn(async (name: string) => {
      if (name.toLowerCase() === 'vitalik.eth') {
        return {
          ok: true,
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        };
      }
      return { ok: false };
    }),
  };
});

describe('validateRecipient with ENS names', () => {
  it('resolves a .eth name to its address on an EVM chain', async () => {
    await expect(validateRecipient('eth', 'vitalik.eth')).resolves.toEqual({
      ok: true,
      resolvedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
  });

  it('resolves the same name on another EVM chain (the address is chain-agnostic)', async () => {
    await expect(validateRecipient('bsc', 'vitalik.eth')).resolves.toEqual({
      ok: true,
      resolvedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
  });

  it('rejects an unregistered name as "Invalid address."', async () => {
    await expect(
      validateRecipient('eth', 'definitely-not-a-real-name-xyz123.eth'),
    ).resolves.toEqual({ ok: false, reason: 'Invalid address.' });
  });

  it('does not treat a name as an address on a non-EVM chain', async () => {
    await expect(validateRecipient('btc', 'vitalik.eth')).resolves.toEqual({
      ok: false,
      reason: 'Invalid Bitcoin address.',
    });
  });
});
