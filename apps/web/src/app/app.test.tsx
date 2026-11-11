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
  it('renders the wallet title and the empty dashboard', async () => {
    await withRenderedApp('/', (div) => {
      expect(div.textContent).toContain('Bawa Web Wallet');
      expect(div.textContent).toContain('No wallets yet');
    });
  });

  it('renders the watch-only wallet import page', async () => {
    await withRenderedApp('/import-wallet', (div) => {
      expect(div.textContent).toContain('Import a watch-only wallet');
    });
  });

  it('renders the sending placeholder', async () => {
    await withRenderedApp('/send', (div) => {
      expect(div.textContent).toContain('Sending is not implemented');
    });
  });
});
