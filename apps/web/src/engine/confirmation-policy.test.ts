import { describe, expect, it } from 'vitest';
import {
  assessConfirmation,
  BTC_CONFIRMATIONS_REQUIRED,
  ETH_CONFIRMATIONS_MINIMUM,
  type ConfirmationObservation,
} from './confirmation-policy';

// Fixture observations use invented block hashes; no live chain, no
// provider and no funds are involved. Heights are small integers so the
// confirmation arithmetic (tip - inclusion + 1) is readable.
const HASH_A = 'aa'.repeat(32);
const HASH_B = 'bb'.repeat(32);

function btc(overrides: Partial<ConfirmationObservation> = {}): ConfirmationObservation {
  return {
    chain: 'btc',
    txid: 'tx-btc-1',
    inclusionHeight: 100,
    inclusionBlockHash: HASH_A,
    canonicalBlockHashAtInclusionHeight: HASH_A,
    tipHeight: 105,
    finalized: false,
    stale: false,
    ...overrides,
  };
}

function eth(overrides: Partial<ConfirmationObservation> = {}): ConfirmationObservation {
  return {
    chain: 'eth',
    txid: 'tx-eth-1',
    inclusionHeight: 100,
    inclusionBlockHash: HASH_A,
    canonicalBlockHashAtInclusionHeight: HASH_A,
    tipHeight: 111,
    finalized: true,
    stale: false,
    ...overrides,
  };
}

describe('confirmation policy thresholds', () => {
  it('pins the documented thresholds', () => {
    expect(BTC_CONFIRMATIONS_REQUIRED).toBe(6);
    expect(ETH_CONFIRMATIONS_MINIMUM).toBe(12);
  });

  it('BTC: 6 confirmations is confirmed and settlement-eligible', () => {
    const result = assessConfirmation(btc({ tipHeight: 105 }));
    expect(result.status).toBe('confirmed');
    expect(result.confirmations).toBe(6);
    expect(result.settlementEligible).toBe(true);
    expect(result.settlementLabel).toBe('confirmed for settlement');
  });

  it('BTC: 5 confirmations is included, unconfirmed for settlement', () => {
    const result = assessConfirmation(btc({ tipHeight: 104 }));
    expect(result.status).toBe('included');
    expect(result.confirmations).toBe(5);
    expect(result.settlementEligible).toBe(false);
    expect(result.settlementLabel).toBe('unconfirmed for settlement');
  });

  it('BTC: 1 confirmation is included with the actual count shown', () => {
    const result = assessConfirmation(btc({ tipHeight: 100 }));
    expect(result.status).toBe('included');
    expect(result.confirmations).toBe(1);
    expect(result.settlementEligible).toBe(false);
  });

  it('BTC: mempool-only is seen, never included or confirmed', () => {
    const result = assessConfirmation(
      btc({ inclusionHeight: null, inclusionBlockHash: null, canonicalBlockHashAtInclusionHeight: null }),
    );
    expect(result.status).toBe('seen');
    expect(result.confirmations).toBeNull();
    expect(result.settlementEligible).toBe(false);
  });

  it('ETH: finalised with 12 confirmations is confirmed', () => {
    const result = assessConfirmation(eth({ tipHeight: 111, finalized: true }));
    expect(result.status).toBe('confirmed');
    expect(result.confirmations).toBe(12);
    expect(result.settlementEligible).toBe(true);
  });

  it('ETH: finalised with 11 confirmations is included, not settled', () => {
    const result = assessConfirmation(eth({ tipHeight: 110, finalized: true }));
    expect(result.status).toBe('included');
    expect(result.confirmations).toBe(11);
    expect(result.settlementEligible).toBe(false);
  });

  it('ETH: 12 confirmations without finality is included, never confirmed', () => {
    const result = assessConfirmation(eth({ tipHeight: 111, finalized: false }));
    expect(result.status).toBe('included');
    expect(result.confirmations).toBe(12);
    expect(result.settlementEligible).toBe(false);
  });

  it('ETH: 50 confirmations without finality is still not confirmed', () => {
    const result = assessConfirmation(eth({ tipHeight: 149, finalized: false }));
    expect(result.status).toBe('included');
    expect(result.settlementEligible).toBe(false);
  });

  it('ETH: finalised with 6 confirmations is included, not settled', () => {
    const result = assessConfirmation(eth({ tipHeight: 105, finalized: true }));
    expect(result.status).toBe('included');
    expect(result.confirmations).toBe(6);
    expect(result.settlementEligible).toBe(false);
  });
});

describe('confirmation policy reorgs', () => {
  it('a hash mismatch revokes a prior confirmed status', () => {
    const before = assessConfirmation(btc({ tipHeight: 105 }));
    expect(before.status).toBe('confirmed');
    // Same transaction, same heights, but the canonical hash at the
    // inclusion height is now a different block: the funding block was
    // displaced by a reorganisation.
    const after = assessConfirmation(
      btc({ tipHeight: 105, canonicalBlockHashAtInclusionHeight: HASH_B }),
    );
    expect(after.status).toBe('reorged');
    expect(after.confirmations).toBeNull();
    expect(after.settlementEligible).toBe(false);
    expect(after.settlementLabel).toBe('reorged - do not settle');
  });

  it('a reorged ETH transaction is not confirmed even when finalised', () => {
    const result = assessConfirmation(
      eth({ tipHeight: 111, finalized: true, canonicalBlockHashAtInclusionHeight: HASH_B }),
    );
    expect(result.status).toBe('reorged');
    expect(result.settlementEligible).toBe(false);
  });

  it('re-inclusion reconciles to the same assessment: no double-count', () => {
    const first = assessConfirmation(btc({ tipHeight: 105 }));
    const again = assessConfirmation(btc({ tipHeight: 105 }));
    expect(again).toEqual(first);
  });
});

describe('confirmation policy failures fail closed', () => {
  it('a stale observation is unknown, never confirmed', () => {
    const result = assessConfirmation(btc({ tipHeight: 105, stale: true }));
    expect(result.status).toBe('unknown');
    expect(result.settlementEligible).toBe(false);
  });

  it('a missing tip height is unknown', () => {
    const result = assessConfirmation(btc({ tipHeight: null }));
    expect(result.status).toBe('unknown');
    expect(result.settlementEligible).toBe(false);
  });

  it('tip below the inclusion height is unknown, not negative confirmations', () => {
    const result = assessConfirmation(btc({ tipHeight: 99 }));
    expect(result.status).toBe('unknown');
    expect(result.confirmations).toBeNull();
  });

  it('no canonical hash supplied is unknown: height alone never confirms', () => {
    const result = assessConfirmation(
      btc({ tipHeight: 105, canonicalBlockHashAtInclusionHeight: null }),
    );
    expect(result.status).toBe('unknown');
    expect(result.settlementEligible).toBe(false);
  });

  it('a missing inclusion block hash is unknown', () => {
    const result = assessConfirmation(btc({ inclusionBlockHash: null }));
    expect(result.status).toBe('unknown');
  });

  it('a missing transaction id is unknown', () => {
    const result = assessConfirmation(btc({ txid: '   ' }));
    expect(result.status).toBe('unknown');
  });

  it('negative and fractional heights are unknown', () => {
    expect(assessConfirmation(btc({ tipHeight: -1 })).status).toBe('unknown');
    expect(assessConfirmation(btc({ inclusionHeight: 100.5 })).status).toBe('unknown');
  });

  it('mempool-only with block data is unknown, not seen', () => {
    expect(
      assessConfirmation(
        btc({ inclusionHeight: null, inclusionBlockHash: HASH_A, canonicalBlockHashAtInclusionHeight: null }),
      ).status,
    ).toBe('unknown');
    expect(
      assessConfirmation(
        btc({ inclusionHeight: null, inclusionBlockHash: null, canonicalBlockHashAtInclusionHeight: HASH_A }),
      ).status,
    ).toBe('unknown');
  });

  it('a stale mempool-only observation is unknown, not seen', () => {
    const result = assessConfirmation(
      btc({ inclusionHeight: null, inclusionBlockHash: null, canonicalBlockHashAtInclusionHeight: null, stale: true }),
    );
    expect(result.status).toBe('unknown');
  });

  it('matching malformed hashes never confirm', () => {
    const result = assessConfirmation(
      btc({ inclusionBlockHash: 'xyz', canonicalBlockHashAtInclusionHeight: 'xyz' }),
    );
    expect(result.status).toBe('unknown');
    expect(result.settlementEligible).toBe(false);
  });

  it('a malformed inclusion hash is unknown', () => {
    expect(assessConfirmation(btc({ inclusionBlockHash: '0x' + HASH_A })).status).toBe('unknown');
  });

  it('a non-boolean finalised flag is unknown', () => {
    const result = assessConfirmation(
      eth({ finalized: 'yes' as unknown as boolean }),
    );
    expect(result.status).toBe('unknown');
    expect(result.settlementEligible).toBe(false);
  });
});
