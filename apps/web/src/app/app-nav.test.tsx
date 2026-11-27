// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './app';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountApp(path: string, waitFor: string) {
  window.history.pushState({}, '', path);
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<App />);
  });
  for (let i = 0; i < 50; i += 1) {
    if ((div.textContent ?? '').includes(waitFor)) break;
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

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('app nav — focused flows and sidebar collapse (Lane A)', () => {
  it('hides the sidebar and bottom nav during the create flow', async () => {
    const mounted = await mountApp('/create-wallet', 'Create a wallet');
    try {
      expect(mounted.div.querySelector('aside')).toBeNull();
      expect(
        mounted.div.querySelector('nav[aria-label="Main navigation"]'),
      ).toBeNull();
      expect(
        mounted.div.querySelector('button[aria-label="More"]'),
      ).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('hides the sidebar and bottom nav during the send flow (review sits inside /send)', async () => {
    const mounted = await mountApp('/send', 'No wallet yet');
    try {
      expect(mounted.div.querySelector('aside')).toBeNull();
      expect(
        mounted.div.querySelector('nav[aria-label="Main navigation"]'),
      ).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('collapses the sidebar to an icon rail and back', async () => {
    const mounted = await mountApp('/', 'Welcome to Bawa');
    try {
      const aside = () => mounted.div.querySelector('aside');
      expect(aside()?.className).toContain('desktop:w-[224px]');
      const collapse = mounted.div.querySelector(
        'button[aria-label="Collapse sidebar"]',
      );
      expect(collapse).not.toBeNull();
      await click(collapse as Element);
      expect(aside()?.className).toContain('desktop:w-[72px]');
      const expand = mounted.div.querySelector(
        'button[aria-label="Expand sidebar"]',
      );
      expect(expand).not.toBeNull();
      await click(expand as Element);
      expect(aside()?.className).toContain('desktop:w-[224px]');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the 5-slot bottom nav — Home, Assets, Receive, Send, Activity — and no More button', async () => {
    // P1 (Lane S1): the More button and its sheet are gone; Activity
    // (Transactions, renamed) takes the fifth slot.
    const mounted = await mountApp('/', 'Welcome to Bawa');
    try {
      // Two navs share the label: the desktop sidebar (first in the DOM)
      // and the mobile bottom nav (second).
      const navs = mounted.div.querySelectorAll(
        'nav[aria-label="Main navigation"]',
      );
      expect(navs).toHaveLength(2);
      const nav = navs[1] as Element;
      for (const label of ['Home', 'Assets', 'Receive', 'Send', 'Activity']) {
        expect(nav?.textContent).toContain(label);
      }
      expect(nav?.textContent).not.toContain('More');
      expect(mounted.div.querySelector('button[aria-label="More"]')).toBeNull();
      expect(mounted.div.querySelector('[role="menu"]')).toBeNull();
      const activity = nav.querySelector('a[href="/transactions"]');
      expect(activity).not.toBeNull();
      await click(activity as Element);
      expect(window.location.pathname).toBe('/transactions');
    } finally {
      await mounted.cleanup();
    }
  });
});
