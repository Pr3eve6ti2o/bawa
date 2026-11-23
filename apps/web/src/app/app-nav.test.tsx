// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './app';
import { MORE_LINKS } from './sidebar-nav';

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

  it('keeps the bottom nav and shows the More menu with all destinations, which navigate', async () => {
    const mounted = await mountApp('/', 'Welcome to Bawa');
    try {
      // Two navs share the label: the desktop sidebar (first in the DOM)
      // and the mobile bottom nav (second). The More button lives only in
      // the bottom nav.
      const navs = mounted.div.querySelectorAll(
        'nav[aria-label="Main navigation"]',
      );
      expect(navs).toHaveLength(2);
      const nav = navs[1] as Element;
      expect(nav?.textContent).toContain('Home');
      expect(nav?.textContent).toContain('More');
      const moreButton = mounted.div.querySelector(
        'button[aria-label="More"]',
      );
      expect(moreButton).not.toBeNull();
      await click(moreButton as Element);
      const menu = mounted.div.querySelector('[role="menu"]');
      expect(menu).not.toBeNull();
      const items = mounted.div.querySelectorAll('[role="menuitem"]');
      expect(items).toHaveLength(MORE_LINKS.length);
      for (const { label } of MORE_LINKS) {
        expect(menu?.textContent).toContain(label);
      }
      const networksItem = Array.from(items).find(
        (item) => item.getAttribute('href') === '/networks',
      );
      expect(networksItem).not.toBeUndefined();
      await click(networksItem as Element);
      expect(window.location.pathname).toBe('/networks');
      expect(mounted.div.querySelector('[role="menu"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
