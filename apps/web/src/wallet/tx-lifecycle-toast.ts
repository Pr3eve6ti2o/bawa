// tx-lifecycle-toast.ts — Lane P2-B (M4): persistent transaction-lifecycle toast.
//
// One toast per transaction, updated in place through its stages:
//
//   "Waiting for wallet…" → "Transaction submitted / Waiting for
//   confirmation…" (with the tx hash and a "View on Explorer →" link)
//   → "Transaction confirmed!" (auto-close 8 s) or "Transaction
//   failed" (auto-close 10 s).
//
// The toast lives in the module-level store behind the <Toaster />
// mounted in app.tsx, so it survives navigation: the user can leave
// /send while the transaction confirms and the toast follows them.
// The confirmation poll is module-level too, for the same reason —
// it is not tied to the Send screen's lifecycle.
//
// Scope, stated plainly: this covers the DEVNET broadcast only.
// Mainnet broadcast is disabled by standing owner order, so no
// mainnet send ever produces a hash to follow, and no lifecycle
// toast is started for one. The result screen still states the
// broadcast block on mainnet; the toast never claims otherwise.
//
// A poll that never resolves ends after five minutes with "Still
// waiting for confirmation — check the explorer" (10 s, explorer
// link kept) instead of polling forever. Dismissing the toast stops
// its poll.
import { lookupTransaction } from './tracker';
import { toast } from '../ui/components/toast';
import type { ChainId } from '../engine/boundary';

/** Auto-close for the confirmed stage (pattern: 8 s). */
export const TX_TOAST_CONFIRMED_MS = 8000;
/** Auto-close for the failed stage (pattern: 10 s). */
export const TX_TOAST_FAILED_MS = 10000;

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60;

export type TxLifecycleDeps = {
  lookup?: typeof lookupTransaction;
};

export type TxLifecycleHandle = {
  readonly id: number;
  /** The broadcast landed: show the hash + explorer link and start polling for confirmation. */
  submitted(opts: {
    chain: ChainId;
    txHash: string;
    explorerUrl: string;
    devnet: boolean;
  }): void;
  /** Signing or the broadcast itself failed: the transaction never landed. */
  failed(): void;
};

export function beginTxLifecycleToast(deps?: TxLifecycleDeps): TxLifecycleHandle {
  const lookup = deps?.lookup ?? lookupTransaction;
  const id = toast.info('Waiting for wallet…', { durationMs: 0 });
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stopPolling(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function finish(message: string, kind: 'success' | 'error' | 'warning', durationMs: number): void {
    stopPolling();
    toast.update(id, { message, kind, durationMs });
  }

  const handle: TxLifecycleHandle = {
    id,
    submitted(opts) {
      stopPolling();
      toast.update(id, {
        message: `Transaction submitted / Waiting for confirmation…\n${opts.txHash}`,
        kind: 'info',
        action: { label: 'View on Explorer →', href: opts.explorerUrl },
        durationMs: 0,
      });
      let polls = 0;
      const tick = (): void => {
        timer = null;
        // The user dismissed the toast: stop polling instead of
        // chasing a confirmation nobody is watching.
        if (!toast.exists(id)) return;
        polls += 1;
        void lookup(opts.chain, opts.txHash, { devnet: opts.devnet })
          .then((result) => {
            if (!toast.exists(id)) return;
            if (result.status === 'ok' && result.data.status === 'confirmed') {
              finish('Transaction confirmed!', 'success', TX_TOAST_CONFIRMED_MS);
              return;
            }
            if (result.status === 'ok' && result.data.status === 'failed') {
              finish('Transaction failed', 'error', TX_TOAST_FAILED_MS);
              return;
            }
            if (result.status === 'unsupported') {
              // This chain cannot be polled — the explorer link on
              // the toast stays the way to check it.
              finish(
                'Still waiting for confirmation — check the explorer',
                'warning',
                TX_TOAST_FAILED_MS,
              );
              return;
            }
            // Pending, not-found (indexer lag) or a transient error:
            // keep waiting until the poll budget runs out.
            if (polls >= MAX_POLLS) {
              finish(
                'Still waiting for confirmation — check the explorer',
                'warning',
                TX_TOAST_FAILED_MS,
              );
              return;
            }
            timer = setTimeout(tick, POLL_INTERVAL_MS);
          })
          .catch(() => {
            if (!toast.exists(id)) return;
            if (polls >= MAX_POLLS) {
              finish(
                'Still waiting for confirmation — check the explorer',
                'warning',
                TX_TOAST_FAILED_MS,
              );
              return;
            }
            timer = setTimeout(tick, POLL_INTERVAL_MS);
          });
      };
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    },
    failed() {
      finish('Transaction failed', 'error', TX_TOAST_FAILED_MS);
    },
  };
  return handle;
}
