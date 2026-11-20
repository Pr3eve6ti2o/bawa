// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SendReview, type SendReviewProps } from '../screens/send-review';
import { createWallet, deriveAddresses } from './core';
import { signEthOffline, simulateSend } from './send';
import { registerAdapter } from './adapters';
import type {
  AdapterResult,
  ChainAdapter,
  FeeEstimate,
  TxInput,
} from './adapters/types';

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
function simStub(balance: string, decimals: number, fee: AdapterResult<FeeEstimate>, inputs: AdapterResult<TxInput>): ChainAdapter { return { chain: 'eth', networkId: 'test', getBalance: async () => ({ status: 'ok', data: { chain: 'eth', address: 'stub', networkId: 'test', valueBaseUnits: balance, decimals, source: 'stub', fetchedAt: 0 }, source: 'stub', fetchedAt: 0 }), getHistory: async () => ({ status: 'ok', data: [], source: 'stub', fetchedAt: 0 }), estimateFee: async () => fee, getTxInputs: async () => inputs, broadcast: async () => { throw new Error('disabled'); } }; }


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

  it('(3) Retry bound to request context', async () => {
    const mnemonic = await createWallet();
    const { eth: from } = await deriveAddresses(mnemonic, '');
    const to = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
    const amountBaseUnits = '10000000000000000';
    const gasPrice = '20000000000';
    const feeBaseUnits = '420000000000000';

    const fee: AdapterResult<FeeEstimate> = {
      status: 'ok',
      data: {
        chain: 'eth',
        networkId: 'test',
        feeBaseUnits,
        unit: 'wei',
        note: 'Offline integration-test stub',
        source: 'stub',
        fetchedAt: 0,
      },
      source: 'stub',
      fetchedAt: 0,
    };

    const inputs: AdapterResult<TxInput> = {
      status: 'ok',
      data: { kind: 'nonce', nonce: 5 },
      source: 'stub',
      fetchedAt: 0,
    };

    registerAdapter(simStub('1000000000000000000', 18, fee, inputs));

    const simulation = await simulateSend('eth', from, to, '0.01');
    if (!simulation.ok) {
      throw new Error('Expected initial simulation to succeed');
    }
    expect(simulation.amountBaseUnits).toBe(amountBaseUnits);
    expect(simulation.feeBaseUnits).toBe(feeBaseUnits);

    const first = await signEthOffline(
      mnemonic, '', to, simulation.amountBaseUnits, '5', gasPrice,
    );
    const retry = await signEthOffline(
      mnemonic, '', to, simulation.amountBaseUnits, '5', gasPrice,
    );
    if (!first.ok || !retry.ok) {
      throw new Error('Expected both offline signatures to succeed');
    }

    expect(retry.signedTxHex).toBe(first.signedTxHex);
    expect(retry.txHash).toBe(first.txHash);

    const repeatedSimulation = await simulateSend('eth', from, to, '0.01');
    if (!repeatedSimulation.ok) {
      throw new Error('Expected repeated simulation to succeed');
    }
    expect(repeatedSimulation.amountBaseUnits).toBe(simulation.amountBaseUnits);
    expect(repeatedSimulation.feeBaseUnits).toBe(simulation.feeBaseUnits);

    const repeatedSignature = await signEthOffline(
      mnemonic, '', to, repeatedSimulation.amountBaseUnits, '5', gasPrice,
    );
    if (!repeatedSignature.ok) {
      throw new Error('Expected signing after repeated simulation to succeed');
    }

    expect(repeatedSignature.signedTxHex).toBe(first.signedTxHex);
    expect(repeatedSignature.txHash).toBe(first.txHash);

    const changedNonce = await signEthOffline(
      mnemonic, '', to, simulation.amountBaseUnits, '6', gasPrice,
    );
    if (!changedNonce.ok) {
      throw new Error('Expected signing with a changed nonce to succeed');
    }

    expect(changedNonce.signedTxHex).not.toBe(first.signedTxHex);
  });

  it('(4) Retry bound to authorisation context', async () => {
    const mnemonic = await createWallet();
    const otherMnemonic = await createWallet();
    const { eth: from } = await deriveAddresses(mnemonic, '');
    const { eth: otherFrom } = await deriveAddresses(otherMnemonic, '');
    const to = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
    const amountBaseUnits = '10000000000000000';
    const gasPrice = '20000000000';

    const first = await signEthOffline(
      mnemonic, '', to, amountBaseUnits, '5', gasPrice,
    );
    const retry = await signEthOffline(
      mnemonic, '', to, amountBaseUnits, '5', gasPrice,
    );
    const other = await signEthOffline(
      otherMnemonic, '', to, amountBaseUnits, '5', gasPrice,
    );
    if (!first.ok || !retry.ok || !other.ok) {
      throw new Error('Expected all offline signatures to succeed');
    }

    expect(first.from).toBe(from);
    expect(retry.from).toBe(from);
    expect(retry.from).toBe(first.from);
    expect(other.from).toBe(otherFrom);
    expect(other.from).not.toBe(retry.from);
  });
});
