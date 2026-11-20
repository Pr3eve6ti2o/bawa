/**
 * Compile-time-only confirmation-policy type-contract tests, in the
 * MIT-licensed anza-xyz/kit __typetests__ style (idea only; no source copied).
 *
 * Checked by `npm run typecheck`: tsconfig includes `src`. Vitest never
 * executes this file because its filename is not `*.test.ts`.
 *
 * Vitest's `expectTypeOf` / `toEqualTypeOf` pins exact types; rejections use
 * `// @ts-expect-error`. Widening a type to accept a rejected value leaves an
 * unused directive, which is itself a TypeScript error. A wrong expectation
 * must fail tsc—that is the point.
 *
 * No runtime tests, test data, or skipped assertions. The policy constants
 * pinned here as literals (BTC 6, ETH 12, POLICY_VERSION) are deliberate
 * policy values: changing one must update this file deliberately.
 */
import { expectTypeOf } from 'vitest';

import {
  assessConfirmation,
  BTC_CONFIRMATIONS_REQUIRED,
  ETH_CONFIRMATIONS_MINIMUM,
  evaluateTon,
  evaluateTron,
  POLICY_VERSION,
  TON_REQUIRED_MASTERCHAIN_SEQNO,
  transition,
  TRX_REQUIRED_SUPER_REPRESENTATIVES,
  TRX_TOTAL_SUPER_REPRESENTATIVES,
} from '../confirmation-policy';
import type {
  ConfirmationAssessment,
  ConfirmationChain,
  ConfirmationObservation,
  ConfirmationState,
  ConfirmationStatus,
  Evaluation,
  TonObservation,
  Transition,
  TronObservation,
} from '../confirmation-policy';

type ExpectedStatus =
  | 'seen'
  | 'included'
  | 'confirmed'
  | 'reorged'
  | 'unknown';

expectTypeOf<ConfirmationChain>().toEqualTypeOf<'btc' | 'eth'>();
expectTypeOf<ConfirmationStatus>().toEqualTypeOf<ExpectedStatus>();
expectTypeOf<ConfirmationState>().toEqualTypeOf<ExpectedStatus>();

// Exact equality also pins required fields and their nullability.
expectTypeOf<ConfirmationObservation>().toEqualTypeOf<{
  chain: ConfirmationChain;
  txid: string;
  inclusionHeight: number | null;
  inclusionBlockHash: string | null;
  canonicalBlockHashAtInclusionHeight: string | null;
  tipHeight: number | null;
  finalized: boolean;
  stale: boolean;
}>();
expectTypeOf<ConfirmationObservation['finalized']>().toEqualTypeOf<boolean>();

expectTypeOf<ConfirmationAssessment>().toEqualTypeOf<{
  status: ConfirmationStatus;
  confirmations: number | null;
  settlementEligible: boolean;
  settlementLabel: string;
  reason: string;
}>();
expectTypeOf<typeof assessConfirmation>().toEqualTypeOf<
  (observation: ConfirmationObservation) => ConfirmationAssessment
>();

declare const missingFinalized: Omit<ConfirmationObservation, 'finalized'>;
declare const stringInclusionHeight: Omit<
  ConfirmationObservation,
  'inclusionHeight'
> & {
  inclusionHeight: string;
};

// @ts-expect-error finalized is required.
assessConfirmation(missingFinalized);

// @ts-expect-error inclusionHeight must be number | null, not string.
assessConfirmation(stringInclusionHeight);

// Policy constants must retain their literal types.
expectTypeOf<typeof BTC_CONFIRMATIONS_REQUIRED>().toEqualTypeOf<6>();
expectTypeOf<typeof ETH_CONFIRMATIONS_MINIMUM>().toEqualTypeOf<12>();
expectTypeOf<typeof POLICY_VERSION>().toEqualTypeOf<'trx-ton-1'>();
expectTypeOf<typeof TRX_REQUIRED_SUPER_REPRESENTATIVES>().toEqualTypeOf<19>();
expectTypeOf<typeof TRX_TOTAL_SUPER_REPRESENTATIVES>().toEqualTypeOf<27>();
expectTypeOf<typeof TON_REQUIRED_MASTERCHAIN_SEQNO>().toEqualTypeOf<1>();

expectTypeOf<TronObservation>().toEqualTypeOf<{
  txid: string;
  included: boolean;
  blockNumber: number | null;
  contractRet: 'SUCCESS' | 'FAILED' | null;
  solidifiedBlockNumber: number | null;
  distinctSolidifyingSRs: number | null;
  dataAvailable: boolean;
  stale: boolean;
}>();

expectTypeOf<TonObservation>().toEqualTypeOf<{
  txid: string;
  included: boolean;
  shardBlockId: string | null;
  inclusionAnchorSeqno: number | null;
  currentMasterchainSeqno: number | null;
  outMessageOutcome: 'delivered' | 'bounced' | 'failed' | 'aborted' | null;
  dataAvailable: boolean;
  stale: boolean;
}>();

// @ts-expect-error TRON contractRet does not accept lowercase 'success'.
expectTypeOf<'success'>().toMatchTypeOf<TronObservation['contractRet']>();

// @ts-expect-error TON outMessageOutcome does not accept 'pending'.
expectTypeOf<'pending'>().toMatchTypeOf<TonObservation['outMessageOutcome']>();

expectTypeOf<Evaluation>().toEqualTypeOf<{
  state: ConfirmationState;
  confirmed: boolean;
  reason: string;
  policyVersion: string;
}>();
expectTypeOf<Evaluation['state']>().toEqualTypeOf<ConfirmationState>();

// Deliberately widened: this must not become typeof POLICY_VERSION.
expectTypeOf<Evaluation['policyVersion']>().toEqualTypeOf<string>();

expectTypeOf<typeof evaluateTron>().toEqualTypeOf<
  (obs: TronObservation) => Evaluation
>();
expectTypeOf<typeof evaluateTon>().toEqualTypeOf<
  (obs: TonObservation) => Evaluation
>();

declare const tronObservation: TronObservation;
declare const tonObservation: TonObservation;

// @ts-expect-error The TRON evaluator must reject TON observations.
evaluateTron(tonObservation);

// @ts-expect-error The TON evaluator must reject TRON observations.
evaluateTon(tronObservation);

expectTypeOf<Transition>().toEqualTypeOf<{
  state: ConfirmationState;
  manualReview: boolean;
  reason: string;
}>();
expectTypeOf<Transition['state']>().toEqualTypeOf<ConfirmationState>();

expectTypeOf<typeof transition>().toEqualTypeOf<
  (
    current: ConfirmationState,
    evaluation: Evaluation,
    wasSettled: boolean,
  ) => Transition
>();
