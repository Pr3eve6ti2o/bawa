// @vitest-environment jsdom
// Lane P2-B (M4): the transaction lifecycle toast — one toast per
// transaction, updated in place from "Waiting for wallet…" through
// "Transaction submitted / Waiting for confirmation…" (hash +
// explorer link) to "Transaction confirmed!" (8 s) or "Transaction
// failed" (10 s). The confirmation poll is driven by the injected
// lookup, so no network call fires here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Toaster } from '../ui/components/sonner';
import { toast } from '../ui/components/toast';
import {
  beginTxLifecycleToast,
  TX_TOAST_CONFIRMED_MS,
  TX_TOAST_FAILED_MS,
  type TxLifecycleHandle,
} from './tx-lifecycle-toast';
import type { TrackedTx } from './tracker';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const TX_HASH =
  '0x2bfcadb4c53025f00c074e7990a5240aca38b1f0bf772f4b40eeb190e33c70ca';
const EXPLORER_URL = `https://explorer.optimism.io/tx/${TX_HASH}`;

function trackedTx(status: TrackedTx['status']): TrackedTx {
  return {
    hash: TX_HASH,
    chain: 'op',
    networkId: 'eip155:10',
    status,
    statusLabel: status,
    confirmations: status === 'confirmed' ? 12 : null,
    blockHeight: status === 'confirmed' ? 160110409 : null,
    from: null,
    to: null,
    amountBaseUnits: '0',
    feeBaseUnits: null,
    timestamp: null,
    explorerUrl: EXPLORER_URL,
    source: 'blockscout',
    fetchedAt: 0,
  };
}

async function mountToaster() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<Toaster />);
  });
  return {
    div,
    cleanup: async () => {
      try {
        await act(async () => {
          root.unmount();
        });
      } finally {
        div.remove();
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

async function advance(div: HTMLDivElement, ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  void div;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('transaction lifecycle toast (Lane P2-B)', () => {
  it('walks waiting → submitted → confirmed, then auto-closes in 8 s', async () => {
    expect(TX_TOAST_CONFIRMED_MS).toBe(8000);
    expect(TX_TOAST_FAILED_MS).toBe(10000);
    const lookup = vi.fn(async () => ({
      status: 'ok' as const,
      data: trackedTx('confirmed'),
    }));
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      expect(mounted.div.textContent).toContain('Waiting for wallet…');
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      expect(mounted.div.textContent).toContain(
        'Transaction submitted / Waiting for confirmation…',
      );
      expect(mounted.div.textContent).toContain(TX_HASH);
      const link = mounted.div.querySelector(`a[href="${EXPLORER_URL}"]`);
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('View on Explorer →');
      // One toast, updated in place — not a second one stacked.
      expect(mounted.div.querySelectorAll('[role="status"]').length).toBe(1);
      await advance(mounted.div, 5000);
      expect(lookup).toHaveBeenCalledWith('op', TX_HASH, { devnet: true });
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
      expect(mounted.div.textContent).not.toContain('Waiting for confirmation');
      await advance(mounted.div, 7999);
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
      await advance(mounted.div, 1);
      expect(mounted.div.textContent).not.toContain('Transaction confirmed!');
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps waiting while the transaction is pending, then confirms', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ status: 'ok', data: trackedTx('pending') })
      .mockResolvedValue({ status: 'ok', data: trackedTx('confirmed') });
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      await advance(mounted.div, 5000);
      expect(mounted.div.textContent).toContain('Waiting for confirmation');
      await advance(mounted.div, 5000);
      expect(lookup).toHaveBeenCalledTimes(2);
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows "Transaction failed" for 10 s when the chain reports failed', async () => {
    const lookup = vi.fn(async () => ({
      status: 'ok' as const,
      data: trackedTx('failed'),
    }));
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      await advance(mounted.div, 5000);
      expect(mounted.div.textContent).toContain('Transaction failed');
      // The explorer link stays, so the failure can be checked.
      expect(
        mounted.div.querySelector(`a[href="${EXPLORER_URL}"]`),
      ).not.toBeNull();
      await advance(mounted.div, 9999);
      expect(mounted.div.textContent).toContain('Transaction failed');
      await advance(mounted.div, 1);
      expect(mounted.div.textContent).not.toContain('Transaction failed');
    } finally {
      await mounted.cleanup();
    }
  });

  it('failed() covers a signing or broadcast failure, with no poll', async () => {
    const lookup = vi.fn(async () => ({
      status: 'ok' as const,
      data: trackedTx('confirmed'),
    }));
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
        handle!.failed();
      });
      expect(mounted.div.textContent).toContain('Transaction failed');
      await advance(mounted.div, 60000);
      expect(lookup).not.toHaveBeenCalled();
      expect(mounted.div.textContent).not.toContain('Transaction failed');
    } finally {
      await mounted.cleanup();
    }
  });

  it('gives up after five minutes with a still-waiting toast', async () => {
    const lookup = vi.fn(async () => ({
      status: 'ok' as const,
      data: trackedTx('pending'),
    }));
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      await advance(mounted.div, 60 * 5000);
      expect(lookup).toHaveBeenCalledTimes(60);
      expect(mounted.div.textContent).toContain(
        'Still waiting for confirmation — check the explorer',
      );
      expect(
        mounted.div.querySelector(`a[href="${EXPLORER_URL}"]`),
      ).not.toBeNull();
      await advance(mounted.div, 10000);
      expect(mounted.div.textContent).not.toContain('Still waiting');
    } finally {
      await mounted.cleanup();
    }
  });

  it('stops polling when the user dismisses the toast', async () => {
    const lookup = vi.fn(async () => ({
      status: 'ok' as const,
      data: trackedTx('pending'),
    }));
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      const dismissButton = mounted.div.querySelector(
        'button[aria-label="Dismiss notification"]',
      );
      await act(async () => {
        dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(mounted.div.textContent).not.toContain('Transaction submitted');
      await advance(mounted.div, 60000);
      expect(lookup).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('treats not-found as indexer lag and keeps waiting', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ status: 'not-found' as const })
      .mockResolvedValue({ status: 'ok' as const, data: trackedTx('confirmed') });
    const mounted = await mountToaster();
    try {
      let handle: TxLifecycleHandle | undefined;
      act(() => {
        handle = beginTxLifecycleToast({ lookup });
      });
      act(() => {
        handle!.submitted({
          chain: 'op',
          txHash: TX_HASH,
          explorerUrl: EXPLORER_URL,
          devnet: true,
        });
      });
      await advance(mounted.div, 5000);
      expect(mounted.div.textContent).toContain('Waiting for confirmation');
      await advance(mounted.div, 5000);
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
    } finally {
      await mounted.cleanup();
    }
  });
});
