
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './app';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountApp(path: string) {
  window.history.pushState({}, '', path);
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<App />);
  });
  // The asset screens are lazy: wait until some settled screen is visible.
  for (let i = 0; i < 50; i += 1) {
    const text = div.textContent ?? '';
    if (
      text.includes('Recent transactions') ||
      text.includes('Portfolio balance') ||
      text.includes('Create wallet')
    ) {
      break;
    }
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    });
  }
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
  vi.clearAllMocks();
  localStorage.clear();
});

describe('app routing — asset detail (Lane B)', () => {
  // NOTE (Lane F): this first-navigation test MUST stay first in this
  // file. It asserts on a cold detail chunk: a lazy detail suspends on
  // its first render and the 'Loading…' fallback stays up until the
  // chunk loads, while an eager detail renders in the same flush. Once
  // any earlier test has loaded the chunk, the import is cached and the
  // test can no longer tell lazy from eager. Do not reorder it below
  // the direct-load test.
  it('renders the asset detail on the FIRST navigation to /assets/btc, not the previous screen', async () => {
    // Lane F (Phase 3): the live browser showed the first click on a
    // BTC row rendering the previous screen again, with the detail only
    // appearing on a second click — the detail chunk was lazy and the
    // Suspense fallback kept the old screen up. In this no-vault jsdom
    // state there is no clickable BTC row to drive the navigation with:
    // unavailable rows render without links (asset-rows.tsx), so the
    // navigation is driven through the router itself — pushState plus a
    // popstate event, the same client-side transition a link click
    // performs. One synchronous flush must already show the detail:
    // with the detail eager, it renders in that flush; with it lazy,
    // the 'Loading…' fallback would still be showing.
    const mounted = await mountApp('/');
    try {
      expect(mounted.div.textContent).toContain('Welcome to Bawa Web Wallet');
      act(() => {
        window.history.pushState({}, '', '/assets/btc');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(window.location.pathname).toBe('/assets/btc');
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Recent transactions');
      expect(mounted.div.textContent).toContain('Balance unavailable');
      expect(mounted.div.textContent).not.toContain('Loading…');
      expect(mounted.div.textContent).not.toContain(
        'Welcome to Bawa Web Wallet',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the asset detail screen at /assets/btc, not the dashboard', async () => {
    const mounted = await mountApp('/assets/btc');
    try {
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Recent transactions');
      expect(mounted.div.textContent).toContain('Balance unavailable');
      expect(mounted.div.textContent).not.toContain('Portfolio balance');
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the welcome screen at /, not the asset detail', async () => {
    const mounted = await mountApp('/');
    try {
      expect(mounted.div.textContent).toContain('Create wallet');
      expect(mounted.div.textContent).not.toContain('Recent transactions');
    } finally {
      await mounted.cleanup();
    }
  });
});
