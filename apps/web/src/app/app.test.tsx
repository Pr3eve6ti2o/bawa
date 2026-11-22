// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App, outletWrapperClass } from './app';

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

describe('outletWrapperClass', () => {
  it('widens the narrow task screens at the desktop: breakpoint, not lg', () => {
    // The shell switches at 980px (desktop:), the width a phone in
    // desktop mode is forced to — below Tailwind lg (1024px). The
    // in-page grids stay lg:; only the shell cap moves.
    for (const path of [
      '/send',
      '/receive',
      '/import-wallet',
      '/mnemonic-backup',
      '/assets/btc',
      '/security',
      '/create-wallet',
      '/lock',
    ]) {
      const cls = outletWrapperClass(path);
      expect(cls).toContain('max-w-[480px]');
      expect(cls).toContain('desktop:max-w-none');
      expect(cls).not.toContain('lg:max-w-none');
    }
  });

  it('leaves the asset list and other full-width routes unwrapped', () => {
    expect(outletWrapperClass('/assets')).toBeNull();
    expect(outletWrapperClass('/assets/')).toBeNull();
    expect(outletWrapperClass('/')).toBeNull();
    expect(outletWrapperClass('/transactions')).toBeNull();
  });
});

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
      expect(main?.className).toContain('desktop:py-6');
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
        el.className.includes('desktop:flex-row'),
      );
      expect(frame?.className).toContain('desktop:max-w-none');
      expect(frame?.className).not.toContain('desktop:max-w-[1440px]');

      const asides = div.querySelectorAll('aside');
      expect(asides.length).toBeGreaterThanOrEqual(2);
      const shellAside = asides[0] as Element;
      expect(shellAside.className).toContain('desktop:w-[224px]');
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

  it('desktop shell switches at the 980px desktop: breakpoint, not lg', async () => {
    // A phone in desktop mode is forced to a 980px layout viewport,
    // below lg (1024px) — the shell (frame, sidebar, headers, bottom
    // nav, main padding) must switch on desktop: so the sidebar
    // appears there. In-page lg: grids are untouched by this change.
    await withRenderedApp('/', (div) => {
      const frame = Array.from(div.querySelectorAll('div')).find((el) =>
        el.className.includes('desktop:flex-row'),
      );
      expect(frame?.className).toContain('desktop:max-w-none');
      expect(frame?.className).not.toContain('lg:flex-row');

      const shellAside = div.querySelectorAll('aside')[0] as Element;
      expect(shellAside.className).toContain('desktop:w-[224px]');
      expect(shellAside.className).not.toContain('lg:w-[224px]');

      const headers = div.querySelectorAll('header');
      expect(headers[0]?.className).toContain('desktop:flex');
      expect(headers[1]?.className).toContain('desktop:hidden');

      const bottomNav = Array.from(div.querySelectorAll('nav')).find((el) =>
        el.className.includes('sticky bottom-0'),
      );
      expect(bottomNav?.className).toContain('desktop:hidden');
      expect(bottomNav?.className).not.toContain('lg:hidden');

      const main = div.querySelector('main');
      expect(main?.className).toContain('desktop:py-6');
      expect(main?.className).not.toContain('lg:py-6');
    });
  });

  it('desktop task screens use wider caps at desktop:, not the 480px phone column', async () => {
    // Desktop layout (desktop-layout-v2 + follow-up): /assets/:chain,
    // /send, /receive, /import-wallet and /mnemonic-backup all go full
    // content width at desktop: (980px) — their screens lay out in two columns
    // there, and the 720px task column for the two import screens read
    // as a phone column on a 1440px main, so it was widened too. Below
    // desktop: every one of them keeps the 480px cap, so the mobile layout
    // is untouched.
    const cases: Array<[string, string]> = [
      ['/assets/btc', 'desktop:max-w-none'],
      ['/send', 'desktop:max-w-none'],
      ['/receive', 'desktop:max-w-none'],
      ['/import-wallet', 'desktop:max-w-none'],
      ['/mnemonic-backup', 'desktop:max-w-none'],
    ];
    for (const [path, expected] of cases) {
      await withRenderedApp(path, (div) => {
        const main = div.querySelector('main');
        expect(main).not.toBeNull();
        const wrapper = main?.children[0] as Element | undefined;
        expect(wrapper?.className).toContain('max-w-[480px]');
        expect(wrapper?.className).toContain(expected);
      });
    }
    // Five full App mounts in one test (lazy chunks + live provider
    // effects each) need more than the 5s default.
  }, 30000);

  it('treats a trailing slash on the asset list as the list, not a chain detail', async () => {
    // P10: GitHub Pages redirects /bawa/assets to /bawa/assets/, and
    // the trailing slash used to match startsWith('/assets/') and wrap
    // the list in the 480px phone column. The list route keeps full
    // width with or without the slash.
    await withRenderedApp('/assets/', (div) => {
      const main = div.querySelector('main');
      expect(main).not.toBeNull();
      const outlet = main?.children[0] as Element | undefined;
      expect(outlet?.className).not.toContain('max-w-[480px]');
      expect(div.textContent).toContain('Assets');
    });
  }, 30000);

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
});
