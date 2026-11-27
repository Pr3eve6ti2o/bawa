// @vitest-environment jsdom
// Lane P2-B (M4): the toast store's update-in-place, per-toast
// duration, action link and single-toast dismiss — the pieces the
// transaction lifecycle toast is built on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Toaster } from './sonner';
import { toast } from './toast';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('toast store (Lane P2-B)', () => {
  it('auto-dismisses after the 4 s default', async () => {
    const mounted = await mountToaster();
    try {
      let id = 0;
      act(() => {
        id = toast.success('Watch-only wallet added.');
      });
      expect(id).toBeGreaterThan(0);
      expect(mounted.div.textContent).toContain('Watch-only wallet added.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3999);
      });
      expect(mounted.div.textContent).toContain('Watch-only wallet added.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(mounted.div.textContent).not.toContain('Watch-only wallet added.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('updates a toast in place under the same id', async () => {
    const mounted = await mountToaster();
    try {
      let id = 0;
      act(() => {
        id = toast.info('Waiting for wallet…', { durationMs: 0 });
      });
      expect(mounted.div.textContent).toContain('Waiting for wallet…');
      act(() => {
        toast.update(id, { message: 'Transaction confirmed!', kind: 'success', durationMs: 8000 });
      });
      // One toast, rewritten — not a second toast stacked under it.
      expect(mounted.div.querySelectorAll('[role="status"]').length).toBe(1);
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
      expect(mounted.div.textContent).not.toContain('Waiting for wallet…');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mounted.div.textContent).toContain('Transaction confirmed!');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(mounted.div.textContent).not.toContain('Transaction confirmed!');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a zero duration stays until dismissed or updated', async () => {
    const mounted = await mountToaster();
    try {
      let id = 0;
      act(() => {
        id = toast.info('Transaction submitted / Waiting for confirmation…', { durationMs: 0 });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(mounted.div.textContent).toContain('Transaction submitted');
      act(() => {
        toast.dismiss(id);
      });
      expect(mounted.div.textContent).not.toContain('Transaction submitted');
    } finally {
      await mounted.cleanup();
    }
  });

  it('dismiss(id) removes only that toast', async () => {
    const mounted = await mountToaster();
    try {
      let first = 0;
      let second = 0;
      act(() => {
        first = toast.info('First', { durationMs: 0 });
        second = toast.info('Second', { durationMs: 0 });
      });
      expect(mounted.div.querySelectorAll('[role="status"]').length).toBe(2);
      act(() => {
        toast.dismiss(first);
      });
      expect(mounted.div.querySelectorAll('[role="status"]').length).toBe(1);
      expect(mounted.div.textContent).toContain('Second');
      expect(second).toBeGreaterThan(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the action link and dismisses by button', async () => {
    const mounted = await mountToaster();
    try {
      act(() => {
        toast.info('Transaction submitted', {
          durationMs: 0,
          action: { label: 'View on Explorer →', href: 'https://example.com/tx/1' },
        });
      });
      const link = mounted.div.querySelector('a[href="https://example.com/tx/1"]');
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('View on Explorer →');
      expect(link?.getAttribute('target')).toBe('_blank');
      const dismissButton = mounted.div.querySelector(
        'button[aria-label="Dismiss notification"]',
      );
      expect(dismissButton).not.toBeNull();
      await act(async () => {
        dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(mounted.div.textContent).not.toContain('Transaction submitted');
    } finally {
      await mounted.cleanup();
    }
  });

  it('updating a dismissed toast is a no-op', async () => {
    const mounted = await mountToaster();
    try {
      let id = 0;
      act(() => {
        id = toast.info('Gone', { durationMs: 0 });
        toast.dismiss(id);
      });
      act(() => {
        toast.update(id, { message: 'Back', durationMs: 8000 });
      });
      expect(mounted.div.textContent).not.toContain('Back');
    } finally {
      await mounted.cleanup();
    }
  });
});
