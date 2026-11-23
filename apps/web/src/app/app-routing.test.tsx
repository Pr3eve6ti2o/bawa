
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      text.includes('Create wallet') ||
      text.includes('No wallet yet')
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
      expect(mounted.div.textContent).toContain('Welcome to Bawa');
      act(() => {
        window.history.pushState({}, '', '/assets/btc');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(window.location.pathname).toBe('/assets/btc');
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Recent transactions');
      // Lane G: with no vault and no address the detail shows zero,
      // never "Balance unavailable" + a dead Retry.
      expect(mounted.div.textContent).toContain('Zero balance');
      expect(mounted.div.textContent).toContain('0 BTC');
      expect(mounted.div.textContent).not.toContain('Balance unavailable');
      expect(mounted.div.textContent).not.toContain('Loading…');
      expect(mounted.div.textContent).not.toContain(
        'Welcome to Bawa',
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
      // Lane G: with no vault and no address the detail shows zero,
      // never "Balance unavailable" + a dead Retry.
      expect(mounted.div.textContent).toContain('Zero balance');
      expect(mounted.div.textContent).toContain('0 BTC');
      expect(mounted.div.textContent).not.toContain('Balance unavailable');
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

describe('app routing — subpath basename (UI/UX round 2, deep-link fix)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  it('renders the Send screen for a /bawa/send deep link when built with base /bawa/', async () => {
    // The Pages build serves the app under /bawa/. Without a matching
    // BrowserRouter basename the router sees /bawa/send, matches
    // nothing, and renders the app's own "Page not found".
    vi.stubEnv('BASE_URL', '/bawa/');
    const mounted = await mountApp(
      '/bawa/send?chain=eth&to=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&amount=0.5',
    );
    try {
      expect(mounted.div.textContent).toContain('Send');
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(mounted.div.textContent).toContain(
        'This link asks to send 0.5 ETH',
      );
      expect(mounted.div.textContent).not.toContain('Page not found');
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Page not found for a /bawa/send link when built for the domain root', async () => {
    // Control: with the root build the basename is '/', so /bawa/send
    // is not a route at all.
    const mounted = await mountApp(
      '/bawa/send?chain=eth&to=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&amount=0.5',
    );
    try {
      expect(mounted.div.textContent).toContain('Page not found');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('app shell — single main landmark on /lock (D-02)', () => {
  it('renders exactly one main landmark on /lock', async () => {
    window.history.pushState({}, '', '/lock');
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(<App />);
      });
      // The lock screen is lazy: wait until it has rendered.
      for (let i = 0; i < 50; i += 1) {
        const text = div.textContent ?? '';
        if (
          text.includes('Set up your wallet') ||
          text.includes('Unlock your wallet')
        ) {
          break;
        }
        await act(async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
        });
      }
      expect(div.textContent).toContain('Set up your wallet');
      expect(div.querySelectorAll('main')).toHaveLength(1);
    } finally {
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
    }
  });
});