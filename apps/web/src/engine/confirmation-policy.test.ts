import { describe, expect, it } from 'vitest';
import {
  assessConfirmation,
  BTC_CONFIRMATIONS_REQUIRED,
  ETH_CONFIRMATIONS_MINIMUM,
  type ConfirmationObservation,
  POLICY_VERSION,
  TRX_REQUIRED_SUPER_REPRESENTATIVES,
  TRX_TOTAL_SUPER_REPRESENTATIVES,
  TON_REQUIRED_MASTERCHAIN_SEQNO,
  evaluateTron,
  evaluateTon,
  transition,
  type TronObservation,
  type TonObservation,
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

// ---- TRX / TON confirmation policy tests (T16, merged by the coordinator) ----
function tronObs(overrides: Partial<TronObservation> = {}): TronObservation {
  return {
    txid: 'trx-tx-1',
    included: true,
    blockNumber: 100,
    contractRet: 'SUCCESS',
    solidifiedBlockNumber: 100,
    distinctSolidifyingSRs: null,
    dataAvailable: true,
    stale: false,
    ...overrides,
  }
}

function tonObs(overrides: Partial<TonObservation> = {}): TonObservation {
  return {
    txid: 'ton-tx-1',
    included: true,
    shardBlockId: 'shard-1',
    inclusionAnchorSeqno: 50,
    currentMasterchainSeqno: 50,
    outMessageOutcome: 'delivered',
    dataAvailable: true,
    stale: false,
    ...overrides,
  }
}

describe('confirmation policy constants', () => {
  it('exports the fixed policy version and thresholds', () => {
    expect(POLICY_VERSION).toBe('trx-ton-1')
    expect(TRX_REQUIRED_SUPER_REPRESENTATIVES).toBe(19)
    expect(TRX_TOTAL_SUPER_REPRESENTATIVES).toBe(27)
    expect(TON_REQUIRED_MASTERCHAIN_SEQNO).toBe(1)
  })
})

describe('evaluateTron', () => {
  it('confirms when the solidified block number equals the inclusion block number', () => {
    const evaluation = evaluateTron(tronObs())

    expect(evaluation).toMatchObject({
      state: 'confirmed',
      confirmed: true,
      policyVersion: POLICY_VERSION,
    })
  })

  it('remains included when the solidified block number is one below the inclusion block', () => {
    const evaluation = evaluateTron(
      tronObs({ solidifiedBlockNumber: 99 }),
    )

    expect(evaluation).toMatchObject({
      state: 'included',
      confirmed: false,
    })
  })

  it('confirms with 19 distinct solidifying SRs and no solidified block number', () => {
    const evaluation = evaluateTron(
      tronObs({
        solidifiedBlockNumber: null,
        distinctSolidifyingSRs: 19,
      }),
    )

    expect(evaluation).toMatchObject({
      state: 'confirmed',
      confirmed: true,
    })
  })

  it('remains included with only 18 distinct solidifying SRs', () => {
    const evaluation = evaluateTron(
      tronObs({
        solidifiedBlockNumber: null,
        distinctSolidifyingSRs: 18,
      }),
    )

    expect(evaluation).toMatchObject({
      state: 'included',
      confirmed: false,
    })
  })

  it('does not confirm a FAILED execution despite otherwise confirming fields', () => {
    const evaluation = evaluateTron(tronObs({ contractRet: 'FAILED' }))

    expect(evaluation.state).not.toBe('confirmed')
    expect(evaluation.confirmed).toBe(false)
  })

  it('returns unknown when the contract result is unavailable', () => {
    const evaluation = evaluateTron(tronObs({ contractRet: null }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns unknown for unavailable data despite otherwise confirming fields', () => {
    const evaluation = evaluateTron(tronObs({ dataAvailable: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns unknown for stale data despite otherwise confirming fields', () => {
    const evaluation = evaluateTron(tronObs({ stale: true }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns unknown when the inclusion block number is null', () => {
    const evaluation = evaluateTron(tronObs({ blockNumber: null }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns not-included when available data reports no inclusion', () => {
    const evaluation = evaluateTron(tronObs({ included: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
    })
  })
})

describe('evaluateTon', () => {
  it('confirms when the current masterchain seqno equals the inclusion anchor', () => {
    const evaluation = evaluateTon(tonObs())

    expect(evaluation).toMatchObject({
      state: 'confirmed',
      confirmed: true,
      policyVersion: POLICY_VERSION,
    })
  })

  it('remains included when the current masterchain seqno is one below the inclusion anchor', () => {
    const evaluation = evaluateTon(
      tonObs({ currentMasterchainSeqno: 49 }),
    )

    expect(evaluation).toMatchObject({
      state: 'included',
      confirmed: false,
    })
  })

  it('remains included when the inclusion anchor seqno is null', () => {
    const evaluation = evaluateTon(
      tonObs({ inclusionAnchorSeqno: null }),
    )

    expect(evaluation).toMatchObject({
      state: 'included',
      confirmed: false,
    })
  })

  it('does not confirm a bounced out-message despite otherwise confirming fields', () => {
    const evaluation = evaluateTon(
      tonObs({ outMessageOutcome: 'bounced' }),
    )

    expect(evaluation.state).not.toBe('confirmed')
    expect(evaluation.confirmed).toBe(false)
  })

  it('does not confirm a failed out-message despite otherwise confirming fields', () => {
    const evaluation = evaluateTon(
      tonObs({ outMessageOutcome: 'failed' }),
    )

    expect(evaluation.state).not.toBe('confirmed')
    expect(evaluation.confirmed).toBe(false)
  })

  it('does not confirm an aborted out-message despite otherwise confirming fields', () => {
    const evaluation = evaluateTon(
      tonObs({ outMessageOutcome: 'aborted' }),
    )

    expect(evaluation.state).not.toBe('confirmed')
    expect(evaluation.confirmed).toBe(false)
  })

  it('returns unknown when the shard block ID is null', () => {
    const evaluation = evaluateTon(tonObs({ shardBlockId: null }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
    })
  })

  it('returns unknown for unavailable data despite otherwise confirming fields', () => {
    const evaluation = evaluateTon(tonObs({ dataAvailable: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns unknown for stale data despite otherwise confirming fields', () => {
    const evaluation = evaluateTon(tonObs({ stale: true }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns unknown when the current masterchain seqno is null', () => {
    const evaluation = evaluateTon(
      tonObs({ currentMasterchainSeqno: null }),
    )

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })
  })

  it('returns not-included when available data reports no inclusion', () => {
    const evaluation = evaluateTon(tonObs({ included: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
    })
  })
})

describe('transition', () => {
  it('moves included to confirmed after a confirmed evaluation', () => {
    const evaluation = evaluateTron(tronObs())

    expect(evaluation).toMatchObject({
      state: 'confirmed',
      confirmed: true,
    })

    const result = transition('included', evaluation, false)

    expect(result.state).toBe('confirmed')
  })

  it('reorgs a settled confirmed transaction that is no longer included and requires manual review', () => {
    const evaluation = evaluateTron(tronObs({ included: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
    })

    const result = transition('confirmed', evaluation, true)

    expect(result).toMatchObject({
      state: 'reorged',
      manualReview: true,
    })
  })

  it('reorgs an unsettled confirmed transaction that is no longer included without manual review', () => {
    const evaluation = evaluateTron(tronObs({ included: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'not-included',
    })

    const result = transition('confirmed', evaluation, false)

    expect(result).toMatchObject({
      state: 'reorged',
      manualReview: false,
    })
  })

  it('moves reorged to included, not confirmed, after an included evaluation', () => {
    const evaluation = evaluateTron(
      tronObs({ solidifiedBlockNumber: 99 }),
    )

    expect(evaluation).toMatchObject({
      state: 'included',
      confirmed: false,
    })

    const result = transition('reorged', evaluation, true)

    expect(result.state).toBe('included')
  })

  it('does not allow seen to skip inclusion after a confirmed evaluation', () => {
    const evaluation = evaluateTon(tonObs())

    expect(evaluation).toMatchObject({
      state: 'confirmed',
      confirmed: true,
    })

    const result = transition('seen', evaluation, false)

    expect(result).toMatchObject({
      state: 'included',
      reason: 'cannot-skip-inclusion',
    })
  })

  it('preserves confirmed when the evaluation is unknown due to unavailable data', () => {
    const evaluation = evaluateTron(tronObs({ dataAvailable: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })

    const result = transition('confirmed', evaluation, true)

    expect(result.state).toBe('confirmed')
  })

  it('preserves included when the evaluation is unknown due to unavailable data', () => {
    const evaluation = evaluateTon(tonObs({ dataAvailable: false }))

    expect(evaluation).toMatchObject({
      state: 'unknown',
      confirmed: false,
      reason: 'unavailable-chain-data',
    })

    const result = transition('included', evaluation, false)

    expect(result.state).toBe('included')
  })
})