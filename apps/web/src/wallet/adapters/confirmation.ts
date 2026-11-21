import {
  assessConfirmation,
  evaluateTron,
  type ConfirmationObservation,
  type TronObservation,
  type TonObservation,
} from '../../engine/confirmation-policy';
import { BawaError, WalletErrorCodes } from '../errors';

export type ConfirmationChain = 'btc' | 'eth' | 'trx' | 'ton';

export type LiveOutcome =
  | 'confirmed'
  | 'included'
  | 'reorged'
  | 'inconclusive'
  | 'validity-expired';

type ConfirmationStatus = ReturnType<typeof assessConfirmation>['status'];

export interface LiveConfirmationResult {
  outcome: LiveOutcome;
  status: ConfirmationStatus | null;
  confirmations: number | null;
  polls: number;
  reason: string;
}

export type ChainObservation =
  | { kind: 'btc-eth'; observation: ConfirmationObservation }
  | { kind: 'trx'; observation: TronObservation }
  | { kind: 'ton'; observation: TonObservation };

export type ObserveFn = (
  chain: ConfirmationChain,
  txid: string,
  address: string | undefined,
  signal: AbortSignal,
) => Promise<ChainObservation>;

export interface WaitOptions {
  txid: string;
  chain: ConfirmationChain;
  address?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  validUntilHeight?: number;
  signal?: AbortSignal;
  observe: ObserveFn;
}

interface Assessment {
  status: ConfirmationStatus;
  confirmations: number | null;
  reason: string;
}

function assessObservation(value: ChainObservation): Assessment {
  switch (value.kind) {
    case 'btc-eth':
      return assessConfirmation(value.observation);

    case 'trx': {
      const result = evaluateTron(value.observation);
      return {
        status: result.state,
        confirmations: null,
        reason: result.reason,
      };
    }

    case 'ton': {
      const observation = value.observation;

      if (observation.dataAvailable === false || observation.stale === true) {
        return {
          status: 'unknown',
          confirmations: null,
          reason:
            observation.dataAvailable === false
              ? 'TON observation data is unavailable.'
              : 'TON observation data is stale.',
        };
      }

      if (!observation.included) {
        return {
          status: 'unknown',
          confirmations: null,
          reason: 'not found in the last 10 transactions',
        };
      }

      // A masterchain sequence number alone cannot prove shard-block finality.
      return {
        status: 'included',
        confirmations: null,
        reason:
          'TON transaction is included, but confirmation cannot be established: ' +
          'missing shard-block identity (workchain, shard, seqno, rootHash, fileHash).',
      };
    }
  }
}

function observationTip(value: ChainObservation): number | null {
  switch (value.kind) {
    case 'btc-eth':
      return value.observation.tipHeight ?? null;
    case 'trx':
      return value.observation.solidifiedBlockNumber ?? null;
    case 'ton':
      return value.observation.currentMasterchainSeqno ?? null;
  }
}

function abortReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;
  return reason === undefined
    ? new DOMException('The operation was aborted.', 'AbortError')
    : reason;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw abortReason(signal);
  }
}

// Enforce cancellation even when an observer does not honor its signal.
function withAbort<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }

    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort);
      reject(abortReason(signal));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    try {
      operation().then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    } catch (error: unknown) {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    }
  });
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await withAbort(
      () =>
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, ms);
        }),
      signal,
    );
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Observes until the policy reaches a terminal state or the deadline expires.
 * This adapter neither signs nor broadcasts transactions.
 */
export async function waitForConfirmation(
  options: WaitOptions,
): Promise<LiveConfirmationResult> {
  const {
    txid,
    chain,
    address,
    timeoutMs = 60_000,
    pollIntervalMs = 5_000,
    validUntilHeight,
    signal: callerSignal,
    observe,
  } = options;

  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutReason = new DOMException('Confirmation timed out.', 'TimeoutError');

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let polls = 0;
  let lastAssessment: Assessment | null = null;

  const onCallerAbort = (): void => {
    if (callerSignal !== undefined) {
      controller.abort(abortReason(callerSignal));
    }
  };

  try {
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

    if (callerSignal?.aborted) {
      onCallerAbort();
    }

    throwIfAborted(signal);

    if (timeoutMs <= 0) {
      controller.abort(timeoutReason);
    } else {
      timeout = setTimeout(() => controller.abort(timeoutReason), timeoutMs);
    }

    while (true) {
      throwIfAborted(signal);

      const observation = await withAbort(() => {
        polls += 1;
        return observe(chain, txid, address, signal);
      }, signal);

      throwIfAborted(signal);
      lastAssessment = assessObservation(observation);

      // Only an observed chain tip can expire validity, not an inclusion height.
      const tip = observationTip(observation);
      if (
        validUntilHeight !== undefined &&
        tip !== null &&
        tip > validUntilHeight
      ) {
        throw new BawaError(
          WalletErrorCodes.CONFIRMATION_VALIDITY_EXPIRED,
          { tip, validUntilHeight },
        );
      }

      if (
        lastAssessment.status === 'confirmed' ||
        lastAssessment.status === 'reorged'
      ) {
        return {
          outcome: lastAssessment.status,
          status: lastAssessment.status,
          confirmations: lastAssessment.confirmations,
          polls,
          reason: lastAssessment.reason,
        };
      }

      await sleep(pollIntervalMs, signal);
    }
  } catch (error: unknown) {
    if (signal.aborted) {
      const reason = abortReason(signal);

      if (reason === timeoutReason) {
        const timeoutMessage =
          'Confirmation timed out; the outcome is inconclusive.';

        return {
          outcome: 'inconclusive',
          status: lastAssessment?.status ?? null,
          confirmations: lastAssessment?.confirmations ?? null,
          polls,
          reason:
            lastAssessment === null
              ? timeoutMessage
              : timeoutMessage + ' Last observation: ' + lastAssessment.reason,
        };
      }

      throw reason;
    }

    throw error;
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    callerSignal?.removeEventListener('abort', onCallerAbort);
    controller.abort();
  }
}
