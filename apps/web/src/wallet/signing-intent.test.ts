// Signing-intent recipient pinning (Lane A, A-7, 2026-11-27, hands-on,
// 0 Sol calls). The intent pins the token-transfer recipient, not just
// the contract/mint, so signing binds to the payee the user reviewed.
// All addresses below are public test vectors; none holds funds.
import { describe, expect, it } from 'vitest';
import {
  assertIntentMatchesTransaction,
  createTransactionIntent,
  intentFingerprint,
} from './signing-intent';

const CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const OTHER = '0x0000000000000000000000000000000000000001';

const txBase = {
  chain: 'eth' as const,
  to: CONTRACT,
  amountBaseUnits: '1000000',
  sequence: '7',
};

describe('signing intent recipient pinning (A-7)', () => {
  it('accepts a transaction whose recipient matches the pinned one', () => {
    const intent = createTransactionIntent(
      'eth',
      CONTRACT,
      '1000000',
      '7',
      RECIPIENT,
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        recipient: RECIPIENT,
      }),
    ).not.toThrow();
  });

  it('rejects a transaction to a different recipient', () => {
    const intent = createTransactionIntent(
      'eth',
      CONTRACT,
      '1000000',
      '7',
      RECIPIENT,
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, { ...txBase, recipient: OTHER }),
    ).toThrow('Signing intent mismatch: recipient.');
  });

  it('rejects a transaction that omits the pinned recipient', () => {
    const intent = createTransactionIntent(
      'eth',
      CONTRACT,
      '1000000',
      '7',
      RECIPIENT,
    );
    expect(() => assertIntentMatchesTransaction(intent, txBase)).toThrow(
      'Signing intent mismatch: recipient.',
    );
  });

  it('leaves native sends (no pinned recipient) unaffected', () => {
    const intent = createTransactionIntent(
      'eth',
      RECIPIENT,
      '1000000',
      '7',
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        chain: 'eth',
        to: RECIPIENT,
        amountBaseUnits: '1000000',
        sequence: '7',
      }),
    ).not.toThrow();
    // Even if the transaction happens to carry a recipient, an intent
    // without one does not check it.
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        chain: 'eth',
        to: RECIPIENT,
        amountBaseUnits: '1000000',
        sequence: '7',
        recipient: OTHER,
      }),
    ).not.toThrow();
  });

  it('fingerprints differ with and without a pinned recipient', () => {
    const pinned = createTransactionIntent(
      'eth',
      CONTRACT,
      '1000000',
      '7',
      RECIPIENT,
    );
    const unpinned = createTransactionIntent(
      'eth',
      CONTRACT,
      '1000000',
      '7',
    );
    expect(intentFingerprint(pinned)).not.toBe(intentFingerprint(unpinned));
    expect(intentFingerprint(pinned)).toBe(
      intentFingerprint(
        createTransactionIntent(
          'eth',
          CONTRACT,
          '1000000',
          '7',
          RECIPIENT,
        ),
      ),
    );
    expect('recipient' in unpinned).toBe(false);
    if (pinned.kind === 'transaction') {
      expect(pinned.recipient).toBe(RECIPIENT);
    } else {
      throw new Error('expected a transaction intent');
    }
  });

  it('rejects an empty or blank recipient', () => {
    expect(() =>
      createTransactionIntent('eth', CONTRACT, '1000000', '7', ''),
    ).toThrow(
      'Invalid signing intent field "recipient": expected a non-empty string.',
    );
    expect(() =>
      createTransactionIntent('eth', CONTRACT, '1000000', '7', '   '),
    ).toThrow(
      'Invalid signing intent field "recipient": expected a non-empty string.',
    );
  });
});

describe('review-time intent sequence (A-7)', () => {
  it('an intent with an empty sequence does not pin the sequence', () => {
    const intent = createTransactionIntent(
      'eth',
      RECIPIENT,
      '1000000',
      '',
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        to: RECIPIENT,
        sequence: '7',
      }),
    ).not.toThrow();
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        to: RECIPIENT,
        sequence: '0',
      }),
    ).not.toThrow();
  });

  it('an intent with a sequence still pins it exactly', () => {
    const intent = createTransactionIntent(
      'eth',
      RECIPIENT,
      '1000000',
      '7',
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        to: RECIPIENT,
        sequence: '8',
      }),
    ).toThrow('Signing intent mismatch: sequence.');
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        to: RECIPIENT,
        sequence: '',
      }),
    ).toThrow('Signing intent mismatch: sequence.');
  });

  it('an empty sequence does not weaken the other fields', () => {
    const intent = createTransactionIntent(
      'eth',
      RECIPIENT,
      '1000000',
      '',
    );
    expect(() =>
      assertIntentMatchesTransaction(intent, {
        ...txBase,
        to: RECIPIENT,
        amountBaseUnits: '1000001',
        sequence: '7',
      }),
    ).toThrow('Signing intent mismatch: amountBaseUnits.');
  });
});
