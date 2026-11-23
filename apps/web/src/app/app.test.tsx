// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './app';

// jsdom has no matchMedia; the vendored theme toggle reads it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }) as unknown as MediaQueryList;
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function withRenderedApp(
  path: string,
  assertions: (div: HTMLDivElement) => void,
): Promise<void> {
  const previousUrl = window.location.href;
  const previousState = window.history.state;
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;

  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);

  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    window.history.pushState({}, '', path);

    await act(async () => {
      root.render(<App />);
    });

    // Route screens are lazy-loaded: wait for the Suspense fallback to
    // clear before asserting on the screen's content.
    await act(async () => {
      for (let i = 0; i < 40 && div.textContent?.includes('Loading…'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    assertions(div);
  } finally {
    try {
      await act(async () => {
        root.unmount();
      });
    } finally {
      div.remove();
      window.history.replaceState(previousState, '', previousUrl);

      if (previousActEnvironment === undefined) {
        delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
      } else {
        testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  }
}

describe.sequential('App', () => {
  it('renders the wallet title and welcome screen without a vault', async () => {
    window.localStorage.removeItem('bawa-vault');

    await withRenderedApp('/', (div) => {
      expect(div.textContent).toContain('Bawa Web Wallet');
      expect(div.textContent).toContain('Welcome to Bawa Web Wallet');
      expect(div.textContent).toContain(
        'Mainnet only — this wallet never connects to a test network',
      );
      expect(div.textContent).not.toContain('No wallet yet');
    });
  });

  it('renders the dashboard when a vault is present', async () => {
    window.localStorage.setItem(
      'bawa-vault',
      JSON.stringify({
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 600000,
          saltB64: 'AAAAAAAAAAAAAAAAAAAAAA==',
        },
        ivB64: 'AAAAAAAAAAAAAAAA',
        ciphertextB64: 'AAAAAAAAAAAAAAAAAAAAAA==',
        profileIds: [],
      }),
    );

    try {
      await withRenderedApp('/', (div) => {
        // Vault-lock removal: there is no locked state and no /lock
        // route any more — a vault present means the dashboard, with
        // the hero and rows, straight away.
        expect(div.textContent).not.toContain(
          'Vault locked — your vault addresses are hidden until you unlock.',
        );
        expect(div.textContent).toContain('Portfolio balance');
        expect(div.textContent).toContain('Send');
        expect(div.textContent).not.toContain('Welcome to Bawa Web Wallet');
      });
    } finally {
      window.localStorage.removeItem('bawa-vault');
    }
  });

  it('renders the watch-only wallet import page', async () => {
    await withRenderedApp('/import-wallet', (div) => {
      expect(div.textContent).toContain('Import a wallet');
    });
  });

  it('renders the send screen (offline signing; sending switched off)', async () => {
    await withRenderedApp('/send', (div) => {
      // No vault in the default app state, so the send screen shows its
      // no-wallet state; the placeholder copy is gone with Phase 4.
      expect(div.textContent).toContain('No wallet yet');
      expect(div.textContent).toContain('Create a wallet');
    });
  });

  it('gives the main content bottom clearance above the sticky mobile nav', async () => {
    // Lane C gap 7: with only pb-6, the last ~40px of a long mobile
    // page (e.g. the "Show recent activity" button on /track) scrolled
    // under the sticky bottom nav and was half-untappable. The main
    // needs bottom padding that clears the ~65px nav + safe-area.
    await withRenderedApp('/track', (div) => {
      const main = div.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.className).toContain('pb-24');
      expect(main?.className).toContain('lg:py-6');
    });
  });

  it('desktop shell is full-bleed with a widening content cap and no sidebar horizontal scroll', async () => {
    // Issue (a): the sidebar's inner nav was w-64 (256px) inside a
    // 224px shell, overflowing a wrapper whose overflow-y-auto computes
    // overflow-x to auto — a horizontal scrollbar on every desktop
    // page. Issue (c): the frame capped at 1440px, so on a 1919px
    // viewport the content sat in the left ~1230px. The shell now owns
    // the sidebar width, the nav fills it, the wrapper clips x, the
    // frame is full-bleed at lg, and the content cap steps up at 2xl.
    await withRenderedApp('/', (div) => {
      const frame = Array.from(div.querySelectorAll('div')).find((el) =>
        el.className.includes('lg:flex-row'),
      );
      expect(frame?.className).toContain('lg:max-w-none');
      expect(frame?.className).not.toContain('lg:max-w-[1440px]');

      const asides = div.querySelectorAll('aside');
      expect(asides.length).toBeGreaterThanOrEqual(2);
      const shellAside = asides[0] as Element;
      expect(shellAside.className).toContain('lg:w-[224px]');
      expect(shellAside.className).not.toContain('lg:border-r-2');
      const stickyWrapper = shellAside.children[0] as Element;
      expect(stickyWrapper?.className).toContain('overflow-x-hidden');
      expect(stickyWrapper?.className).toContain('overflow-y-auto');
      const innerAside = asides[1] as Element;
      expect(innerAside.className).toContain('w-full');
      expect(innerAside.className).not.toContain('w-64');
      expect(innerAside.className).not.toContain('w-20');

      const main = div.querySelector('main');
      expect(main?.className).toContain('xl:max-w-[1152px]');
      expect(main?.className).toContain('2xl:max-w-[1440px]');
    });
  });

  it('renders the Create screen with all seven tools', async () => {
    await withRenderedApp('/create', (div) => {
      expect(div.querySelector('#create-title')?.textContent).toBe('Create');
      expect(div.textContent).toContain('Multichain wallet');
      expect(div.textContent).toContain('HD wallet');
      expect(div.textContent).toContain('Web wallet');
      expect(div.textContent).toContain('Android wallet');
      expect(div.textContent).toContain('Smart contract creator');
      expect(div.textContent).toContain('Multi-signature wallet');
      expect(div.textContent).toContain('Connect an existing wallet');
      expect(div.textContent).toContain('Coming soon');
    });
  });

  it('shows the Devnet pill and devnet welcome copy when devnet is on', async () => {
    window.localStorage.removeItem('bawa-vault');
    window.localStorage.setItem('bawa-devnet-enabled', '1');
    try {
      await withRenderedApp('/', (div) => {
        expect(div.textContent).toContain('Devnet — test mode');
        expect(div.textContent).toContain(
          'Devnet — test mode. This wallet connects to a test network',
        );
        expect(div.textContent).not.toContain(
          'Mainnet only — this wallet never connects to a test network',
        );
      });
    } finally {
      window.localStorage.removeItem('bawa-devnet-enabled');
    }
  });

  it('sizes the shell with dynamic viewport units so mobile sections do not jump', async () => {
    // Item 1: min-h-screen/h-screen are 100vh — the LARGE viewport, so on
    // a phone the shell and sidebar jump by the URL-bar height every time
    // it shows or hides mid-scroll. dvh tracks the visible viewport.
    await withRenderedApp('/', (div) => {
      const frame = Array.from(div.querySelectorAll('div')).find((el) =>
        el.className.includes('lg:flex-row'),
      );
      expect(frame?.className).toContain('min-h-dvh');
      expect(frame?.className).not.toContain('min-h-screen');
      const stickyWrapper = div.querySelector('aside')
        ?.children[0] as Element | undefined;
      expect(stickyWrapper?.className).toContain('h-dvh');
      expect(stickyWrapper?.className).not.toContain('h-screen');
      expect(div.querySelector('.min-h-screen, .h-screen')).toBeNull();
    });
  });
});
