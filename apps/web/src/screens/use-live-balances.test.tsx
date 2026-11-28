// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ComponentType } from 'react';
import { useLiveBalances } from './use-live-balances';

// fix-import-err-name-not-resolved (2026-11-29): the mount fetch is
// what keeps token gaps item 6 (a wallet added after boot shows its
// balances with no reload or manual refresh) now that the import
// flow itself issues no network requests. These tests pin that a
// portfolio screen fetches balances, token balances and history
// once when it appears — and never when the hook is disabled.
const { refreshBalances, refreshTokenBalances, refreshHistory } =
  vi.hoisted(() => ({
    refreshBalances: vi.fn(async () => {}),
    refreshTokenBalances: vi.fn(async () => {}),
    refreshHistory: vi.fn(async () => {}),
  }));

vi.mock('../state/wallet-context', () => ({
  useWallet: () => ({
    refreshBalances,
    refreshTokenBalances,
    refreshHistory,
  }),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function Probe() {
  useLiveBalances();
  return null;
}

function DisabledProbe() {
  useLiveBalances(false);
  return null;
}

async function mountProbe(Component: ComponentType) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<Component />);
  });
  return {
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

describe('useLiveBalances', () => {
  beforeEach(() => {
    refreshBalances.mockClear();
    refreshTokenBalances.mockClear();
    refreshHistory.mockClear();
  });

  it('refreshes balances, token balances and history once on mount', async () => {
    const mounted = await mountProbe(Probe);
    try {
      expect(refreshBalances).toHaveBeenCalledTimes(1);
      expect(refreshTokenBalances).toHaveBeenCalledTimes(1);
      expect(refreshHistory).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('issues no refresh when disabled', async () => {
    const mounted = await mountProbe(DisabledProbe);
    try {
      expect(refreshBalances).not.toHaveBeenCalled();
      expect(refreshTokenBalances).not.toHaveBeenCalled();
      expect(refreshHistory).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });
});
