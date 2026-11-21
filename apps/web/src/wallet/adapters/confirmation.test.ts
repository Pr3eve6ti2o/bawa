import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BawaError } from '../errors';
import { waitForConfirmation } from './confirmation';

const HASH = 'a'.repeat(64);

function btcObs(
  tip: number,
  inclusion: number | null,
  canonical?: string,
  stale = false,
) {
  return {
    kind: 'btc-eth' as const,
    observation: {
      chain: 'btc' as const,
      txid: 'tx1',
      inclusionHeight: inclusion,
      inclusionBlockHash: inclusion === null ? null : HASH,
      canonicalBlockHashAtInclusionHeight:
        inclusion === null ? null : (canonical ?? HASH),
      tipHeight: tip,
      finalized: false,
      stale,
    },
  };
}

describe('waitForConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('confirms BTC with six confirmations on the first poll', async () => {
    const observe = vi.fn(async () => btcObs(105, 100));

    const result = await waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
    });

    expect(result).toMatchObject({
      outcome: 'confirmed',
      status: 'confirmed',
      confirmations: 6,
      polls: 1,
    });
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('keeps polling BTC until six confirmations are reached', async () => {
    const observe = vi
      .fn(async () => btcObs(105, 100))
      .mockResolvedValueOnce(btcObs(102, 100));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      timeoutMs: 100,
      pollIntervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;

    expect(result).toMatchObject({
      outcome: 'confirmed',
      status: 'confirmed',
      confirmations: 6,
      polls: 2,
    });
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('returns reorged when the canonical BTC block hash differs', async () => {
    const observe = vi.fn(async () => btcObs(105, 100, 'b'.repeat(64)));

    const result = await waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
    });

    expect(result).toMatchObject({
      outcome: 'reorged',
      status: 'reorged',
      polls: 1,
    });
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('treats a mempool-only timeout as inconclusive', async () => {
    const observe = vi.fn(async () => btcObs(105, null));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      timeoutMs: 50,
      pollIntervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(60);
    const result = await pending;

    expect(result.outcome).toBe('inconclusive');
    expect(result.polls).toBeGreaterThanOrEqual(1);
    expect(result.reason).not.toBe('not landed');
  });

  it('rejects with BawaError 4001 when the validity height is exceeded', async () => {
    const observe = vi
      .fn(async () => btcObs(106, 100))
      .mockResolvedValueOnce(btcObs(103, 100));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      timeoutMs: 100,
      pollIntervalMs: 10,
      validUntilHeight: 105,
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(BawaError);

    await vi.advanceTimersByTimeAsync(10);
    await rejection;

    await expect(pending).rejects.toMatchObject({ code: 4001 });
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('rejects an already-aborted signal without observing', async () => {
    const controller = new AbortController();
    const observe = vi.fn(async () => btcObs(105, 100));
    controller.abort();

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      signal: controller.signal,
    });

    await expect(pending).rejects.toThrow(/abort/i);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects with an abort error when aborted after 15 ms', async () => {
    const controller = new AbortController();
    const observe = vi.fn(async () => btcObs(105, null));

    setTimeout(() => controller.abort(), 15);

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      timeoutMs: 5000,
      pollIntervalMs: 5,
      signal: controller.signal,
    });
    const rejection = expect(pending).rejects.toThrow(/abort/i);

    await vi.advanceTimersByTimeAsync(15);
    await rejection;

    expect(observe).toHaveBeenCalled();
  });

  it('leaves TON included and inconclusive without a masterchain anchor', async () => {
    const observe = vi.fn(async () => ({
      kind: 'ton' as const,
      observation: {
        txid: 'tx1',
        included: true,
        shardBlockId: null,
        inclusionAnchorSeqno: null,
        currentMasterchainSeqno: null,
        outMessageOutcome: 'delivered' as const,
        dataAvailable: true,
        stale: false,
      },
    }));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'ton',
      observe,
      timeoutMs: 40,
      pollIntervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    expect(result).toMatchObject({
      outcome: 'inconclusive',
      status: 'included',
    });
  });

  it('leaves ETH included and inconclusive without finality', async () => {
    const observe = vi.fn(async () => ({
      kind: 'btc-eth' as const,
      observation: {
        chain: 'eth' as const,
        txid: 'tx1',
        inclusionHeight: 100,
        inclusionBlockHash: HASH,
        canonicalBlockHashAtInclusionHeight: HASH,
        tipHeight: 112,
        finalized: false,
        stale: false,
      },
    }));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'eth',
      observe,
      timeoutMs: 40,
      pollIntervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    expect(result).toMatchObject({
      outcome: 'inconclusive',
      status: 'included',
    });
  });

  it('confirms a successful TRX transaction in a solidified block', async () => {
    const observe = vi.fn(async () => ({
      kind: 'trx' as const,
      observation: {
        txid: 'tx1',
        included: true,
        blockNumber: 10,
        contractRet: 'SUCCESS' as const,
        solidifiedBlockNumber: 10,
        distinctSolidifyingSRs: null,
        dataAvailable: true,
        stale: false,
      },
    }));

    const result = await waitForConfirmation({
      txid: 'tx1',
      chain: 'trx',
      observe,
    });

    expect(result).toMatchObject({
      outcome: 'confirmed',
      status: 'confirmed',
      polls: 1,
    });
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('continues polling stale BTC observations until timing out', async () => {
    const observe = vi.fn(async () => btcObs(105, 100, undefined, true));

    const pending = waitForConfirmation({
      txid: 'tx1',
      chain: 'btc',
      observe,
      timeoutMs: 40,
      pollIntervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    expect(result.outcome).toBe('inconclusive');
    expect(result.polls).toBeGreaterThan(1);
    expect(observe.mock.calls.length).toBeGreaterThan(1);
  });
});
