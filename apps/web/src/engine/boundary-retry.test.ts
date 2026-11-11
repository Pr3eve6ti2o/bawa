// F-40: loadCore must retry after a transient WASM init failure.
// Separate file from boundary.test.ts: that file is describe.sequential
// and asserts isEngineReady transitions, so a failing init there would
// disturb its state.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@trustwallet/wallet-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@trustwallet/wallet-core')>();
  let calls = 0;
  return {
    ...original,
    initWasm: async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient WASM init failure');
      return original.initWasm();
    },
  };
});

import { deriveAddress } from './boundary';

const btcZpub =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';

describe('loadCore retry (F-40)', () => {
  it('retries initialisation after a transient failure', async () => {
    await expect(deriveAddress('btc', btcZpub, 0)).rejects.toThrow(
      'transient WASM init failure',
    );
    await expect(deriveAddress('btc', btcZpub, 0)).resolves.toBe(
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
    );
  });
});
