// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SendReview, type SendReviewProps } from '../screens/send-review';
import { createWallet, deriveAddresses } from './core';
import { signEthOffline } from './send';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
async function mountReview(props: SendReviewProps) { const div = document.createElement('div'); document.body.appendChild(div); const root = createRoot(div); const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT; testGlobal.IS_REACT_ACT_ENVIRONMENT = true; await act(async () => { root.render(<SendReview {...props} />); }); return { div, cleanup: async () => { try { await act(async () => { root.unmount(); }); } finally { div.remove(); if (previousActEnvironment === undefined) { delete testGlobal.IS_REACT_ACT_ENVIRONMENT; } else { testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; } } } }; }

function getSignOfflineButton(div: HTMLDivElement): HTMLButtonElement {
  const buttons = Array.from(div.querySelectorAll('button'));
  const signButtons = buttons.filter(
    (button) => button.textContent?.trim() === 'Sign offline',
  );

  expect(signButtons).toHaveLength(1);
  expect(
    buttons.some((button) => /\bbroadcast\b/i.test(button.textContent ?? '')),
  ).toBe(false);

  const signButton = signButtons[0];
  if (signButton === undefined) {
    throw new Error('Expected one Sign offline button');
  }

  return signButton;
}

describe('offline signing integration', () => {
  it('only calls onSign after an explicit click, never on mount or remount', async () => {
    const onSign = vi.fn();
    const props: SendReviewProps = {
      chainName: 'Ethereum',
      symbol: 'ETH',
      recipient: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amount: '0.01 ETH',
      fee: '0.00042 ETH',
      total: '0.01042 ETH',
      feeNote: 'Estimated fee from the live adapter.',
      disabledReason: 'Broadcast is disabled until separately authorised.',
      onBack: () => {},
      onSign,
    };

    const mounted = await mountReview(props);
    try {
      expect(onSign).not.toHaveBeenCalled();

      const signButton = getSignOfflineButton(mounted.div);
      await act(async () => {
        signButton.click();
      });

      expect(onSign).toHaveBeenCalledTimes(1);

      // Count any subsequent unmount/remount calls independently.
      onSign.mockClear();
    } finally {
      await mounted.cleanup();
    }

    expect(onSign).not.toHaveBeenCalled();

    const remounted = await mountReview(props);
    try {
      getSignOfflineButton(remounted.div);
      expect(onSign).not.toHaveBeenCalled();
    } finally {
      await remounted.cleanup();
    }

    expect(onSign).not.toHaveBeenCalled();
  });

  it('produces byte-identical ETH signatures and hashes for identical inputs', async () => {
    const mnemonic = await createWallet();
    const passphrase = '';
    const { eth } = await deriveAddresses(mnemonic, passphrase);

    const inputs = [
      mnemonic,
      passphrase,
      '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      '10000000000000000',
      '0',
      '20000000000',
    ] as const;

    const first = await signEthOffline(...inputs);
    const second = await signEthOffline(...inputs);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      throw new Error('Expected both offline ETH signing attempts to succeed');
    }

    expect(first.signedTxHex).toBe(second.signedTxHex);
    expect(first.txHash).toBe(second.txHash);
    expect(first.from.toLowerCase()).toBe(eth.toLowerCase());
    expect(second.from.toLowerCase()).toBe(eth.toLowerCase());
  }, 30_000);
});
