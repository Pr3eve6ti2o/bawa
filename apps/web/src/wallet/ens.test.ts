// P2-A, M1: ENS name detection + resolution (injected client —
// no live RPC in unit tests).
import { describe, expect, it, vi } from 'vitest';
import { isEnsName, resolveEnsName } from './ens';

describe('isEnsName', () => {
  it('accepts a plain .eth name', () => {
    expect(isEnsName('vitalik.eth')).toBe(true);
    expect(isEnsName('my-wallet.eth')).toBe(true);
    expect(isEnsName('a.b.eth')).toBe(true);
  });

  it('accepts uppercase (names are case-insensitive)', () => {
    expect(isEnsName('Vitalik.ETH')).toBe(true);
  });

  it('rejects raw addresses, other TLDs, spaces and empties', () => {
    expect(isEnsName('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    expect(isEnsName('vitalik.xyz')).toBe(false);
    expect(isEnsName('vitalik.crypto')).toBe(false);
    expect(isEnsName('vitalik eth')).toBe(false);
    expect(isEnsName('vitalik. eth')).toBe(false);
    expect(isEnsName('')).toBe(false);
    expect(isEnsName('   ')).toBe(false);
    expect(isEnsName('.eth')).toBe(false);
    expect(isEnsName('vitalik.')).toBe(false);
  });
});

describe('resolveEnsName', () => {
  it('returns the address for a registered name', async () => {
    const client = {
      getEnsAddress: vi.fn(async () => '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const),
    };
    await expect(
      resolveEnsName('vitalik.eth', { client }),
    ).resolves.toEqual({
      ok: true,
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
    expect(client.getEnsAddress).toHaveBeenCalledWith({
      name: 'vitalik.eth',
    });
  });

  it('returns ok:false for an unregistered name (null, not an error)', async () => {
    const client = {
      getEnsAddress: vi.fn(async () => null),
    };
    await expect(
      resolveEnsName('definitely-not-a-real-name-xyz123.eth', { client }),
    ).resolves.toEqual({ ok: false });
  });

  it('returns ok:false when the read throws (dead RPC, bad name)', async () => {
    const client = {
      getEnsAddress: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    await expect(
      resolveEnsName('throws.eth', { client }),
    ).resolves.toEqual({ ok: false });
  });

  it('normalises the name to lowercase before resolving', async () => {
    const client = {
      getEnsAddress: vi.fn(async () => '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const),
    };
    await resolveEnsName('  MixedCase-Name.ETH  ', { client });
    expect(client.getEnsAddress).toHaveBeenCalledWith({
      name: 'mixedcase-name.eth',
    });
  });

  it('resolves a name once: the second call is a cache hit', async () => {
    const client = {
      getEnsAddress: vi.fn(async () => '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const),
    };
    await resolveEnsName('cached-name.eth', { client });
    await resolveEnsName('cached-name.eth', { client });
    expect(client.getEnsAddress).toHaveBeenCalledTimes(1);
  });
});
