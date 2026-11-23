// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ReactElement } from 'react';

import { NumberTicker } from './number-ticker';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mount(node: ReactElement): Promise<{
  div: HTMLDivElement;
  rerender: (next: ReactElement) => Promise<void>;
  cleanup: () => Promise<void>;
}> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previous = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(node);
  });
  return {
    div,
    rerender: async (next: ReactElement) => {
      await act(async () => {
        root.render(next);
      });
    },
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      div.remove();
      if (previous === undefined) {
        delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
      } else {
        testGlobal.IS_REACT_ACT_ENVIRONMENT = previous;
      }
    },
  };
}

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NumberTicker (Magic UI Number Ticker pattern, RESEARCH.md §12)', () => {
  it('renders the final value immediately with no matchMedia API (jsdom)', async () => {
    // No matchMedia: the motion preference is unknowable, so the ticker
    // is static — this is also what keeps the dashboard tests
    // deterministic (they assert the settled total).
    const mounted = await mount(<NumberTicker text="$62,683.00" />);
    try {
      expect(mounted.div.textContent).toBe('$62,683.00');
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the final value immediately under prefers-reduced-motion', async () => {
    stubMatchMedia(true);
    const mounted = await mount(<NumberTicker text="$62,683.00" />);
    try {
      expect(mounted.div.textContent).toBe('$62,683.00');
    } finally {
      await mounted.cleanup();
    }
  });

  it('counts from $0.00 to the value, then settles, when motion is allowed', async () => {
    vi.useFakeTimers();
    try {
      stubMatchMedia(false);
      const mounted = await mount(<NumberTicker text="$62,683.00" />);
      try {
        // The first frame is the count-up start, not the final value.
        expect(mounted.div.textContent).toBe('$0.00');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(mounted.div.textContent).toBe('$62,683.00');
      } finally {
        await mounted.cleanup();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a " (Partial)" suffix outside the animated number', async () => {
    vi.useFakeTimers();
    try {
      stubMatchMedia(false);
      const mounted = await mount(
        <NumberTicker text="$62,683.00 (Partial)" />,
      );
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(mounted.div.textContent).toBe('$62,683.00 (Partial)');
      } finally {
        await mounted.cleanup();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders non-numeric hero text statically, never as $0.00', async () => {
    stubMatchMedia(false);
    for (const text of ['Unavailable', 'Locked', '••••••']) {
      const mounted = await mount(<NumberTicker text={text} />);
      try {
        expect(mounted.div.textContent).toBe(text);
      } finally {
        await mounted.cleanup();
      }
    }
  });

  it('ticks from the previous value to a new one, never back to $0.00', async () => {
    vi.useFakeTimers();
    try {
      stubMatchMedia(false);
      const mounted = await mount(<NumberTicker text="$10.00" />);
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(mounted.div.textContent).toBe('$10.00');
        await mounted.rerender(<NumberTicker text="$20.00" />);
        // Mid-flight the value is between the old and the new total —
        // it never restarts from $0.00.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });
        const mid = Number(
          (mounted.div.textContent ?? '').replace(/[$,]/g, ''),
        );
        expect(mid).toBeGreaterThan(10);
        expect(mid).toBeLessThan(20);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(mounted.div.textContent).toBe('$20.00');
      } finally {
        await mounted.cleanup();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
