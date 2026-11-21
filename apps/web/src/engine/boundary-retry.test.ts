/**
 * F-40 initialization contract:
 * - A failed call rejects without retrying internally.
 * - Rejected init promises are evicted so a subsequent call can retry.
 * - In-flight callers share one attempt; successful initialization stays cached.
 * - engineWaitReady() reports readiness without throwing.
 *
 * The boundary caches initialization/readiness state at module scope, so each
 * test uses resetModules() and a fresh dynamic import. The hoisted loader control
 * must also be reset to isolate failure injection and call counts.
 *
 * btcZpub is the existing disposable public-key test vector.
 */

import { describe, expect, it, vi } from 'vitest';

const loader = vi.hoisted(() => ({ calls: 0, failTimes: 0 }));

vi.mock('@trustwallet/wallet-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@trustwallet/wallet-core')>();

  return {
    ...actual,
    initWasm: async (...args: Parameters<typeof actual.initWasm>) => {
      loader.calls += 1;

      if (loader.calls <= loader.failTimes) {
        throw new Error('transient WASM init failure');
      }

      return actual.initWasm(...args);
    },
  };
});

const btcZpub =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';
const expectedAddress = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';

describe('F-40 boundary initialization contract', () => {
  it('evicts a transient failure so a subsequent deriveAddress call retries', async () => {
    vi.resetModules();
    loader.calls = 0;
    loader.failTimes = 1;

    const { deriveAddress } = await import('./boundary');

    await expect(deriveAddress('btc', btcZpub, 0)).rejects.toThrow(
      'transient WASM init failure',
    );
    expect(loader.calls).toBe(1);

    await expect(deriveAddress('btc', btcZpub, 0)).resolves.toBe(expectedAddress);
    expect(loader.calls).toBe(2);
  });

  it('shares one failed in-flight attempt and retries on a later call', async () => {
    vi.resetModules();
    loader.calls = 0;
    loader.failTimes = 1;

    const { loadCore } = await import('./boundary');

    const first = loadCore();
    const second = loadCore();

    await Promise.all([
      expect(first).rejects.toThrow('transient WASM init failure'),
      expect(second).rejects.toThrow('transient WASM init failure'),
    ]);
    expect(loader.calls).toBe(1);

    await loadCore();
    expect(loader.calls).toBe(2);
  });

  it('keeps successful initialization cached', async () => {
    vi.resetModules();
    loader.calls = 0;
    loader.failTimes = 0;

    const { loadCore, engineIsReady } = await import('./boundary');

    await loadCore();
    expect(loader.calls).toBe(1);
    expect(engineIsReady()).toBe(true);

    await loadCore();
    await loadCore();

    expect(loader.calls).toBe(1);
    expect(engineIsReady()).toBe(true);
  });

  it('rejects once per call under permanent failure and stays unready', async () => {
    vi.resetModules();
    loader.calls = 0;
    loader.failTimes = 100;

    const { loadCore, engineIsReady, engineWaitReady } = await import('./boundary');

    expect(engineIsReady()).toBe(false);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(loadCore()).rejects.toThrow('transient WASM init failure');
      expect(loader.calls).toBe(attempt);
      expect(engineIsReady()).toBe(false);
    }

    // engineWaitReady starts one more attempt (the fourth), which also
    // fails; it resolves false instead of throwing.
    await expect(engineWaitReady()).resolves.toBe(false);
    expect(loader.calls).toBe(4);
    expect(engineIsReady()).toBe(false);
  });

  it('makes engineWaitReady non-throwing on failure and after recovery', async () => {
    vi.resetModules();
    loader.calls = 0;
    loader.failTimes = 1;

    const { loadCore, engineIsReady, engineWaitReady } = await import('./boundary');

    // Before any init attempt the engine is not ready. This is the
    // synchronous check: engineWaitReady itself starts an attempt, so it
    // cannot observe the pre-init state.
    expect(engineIsReady()).toBe(false);

    // The first attempt fails transiently: engineWaitReady resolves false
    // instead of throwing, and exactly one init was attempted.
    await expect(engineWaitReady()).resolves.toBe(false);
    expect(loader.calls).toBe(1);
    expect(engineIsReady()).toBe(false);

    // A later call retries and succeeds: engineWaitReady resolves true.
    await expect(engineWaitReady()).resolves.toBe(true);
    expect(loader.calls).toBe(2);
    expect(engineIsReady()).toBe(true);

    // Success stays cached.
    await loadCore();
    expect(loader.calls).toBe(2);
  });
});
