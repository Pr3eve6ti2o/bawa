// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { MORE_LINKS, SIDEBAR_LINKS, SidebarNav } from './sidebar-nav';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountNav(props: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNav {...props} />
      </MemoryRouter>,
    );
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

async function click(button: Element): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('sidebar nav — collapse toggle (Lane A)', () => {
  it('lists every destination expanded, with a collapse button', async () => {
    const mounted = await mountNav({});
    try {
      const text = mounted.div.textContent ?? '';
      for (const { label } of SIDEBAR_LINKS) {
        expect(text).toContain(label);
      }
      expect(mounted.div.querySelectorAll('nav a')).toHaveLength(
        SIDEBAR_LINKS.length,
      );
      const toggle = mounted.div.querySelector(
        'button[aria-label="Collapse sidebar"]',
      );
      expect(toggle).not.toBeNull();
      expect(toggle?.textContent).toContain('Collapse');
    } finally {
      await mounted.cleanup();
    }
  });

  it('collapses to an icon rail: labels sr-only, toggle offers expansion', async () => {
    const mounted = await mountNav({ collapsed: true });
    try {
      // Labels stay in the DOM for screen readers, visually hidden.
      const homeLabel = mounted.div.querySelector(
        'a[href="/"] span.sr-only',
      );
      expect(homeLabel).not.toBeNull();
      expect(homeLabel?.textContent).toBe('Home');
      const toggle = mounted.div.querySelector(
        'button[aria-label="Expand sidebar"]',
      );
      expect(toggle).not.toBeNull();
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      await mounted.cleanup();
    }
  });

  it('fills its shell width instead of setting its own (no sidebar overflow)', async () => {
    // The shell in app.tsx owns the sidebar width (224px expanded,
    // 72px collapsed). A fixed w-64 (256px) / w-20 (80px) here
    // overflowed the shell's sticky wrapper and produced a horizontal
    // scrollbar on every desktop page.
    const mounted = await mountNav({});
    try {
      const aside = mounted.div.querySelector('aside');
      expect(aside?.className).toContain('w-full');
      expect(aside?.className).not.toContain('w-64');
      expect(aside?.className).not.toContain('w-20');
    } finally {
      await mounted.cleanup();
    }
  });

  it('calls onToggleCollapse when the toggle is clicked', async () => {
    const onToggleCollapse = vi.fn();
    const mounted = await mountNav({ onToggleCollapse });
    try {
      const toggle = mounted.div.querySelector(
        'button[aria-label="Collapse sidebar"]',
      );
      expect(toggle).not.toBeNull();
      await click(toggle as Element);
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps the More menu destinations unchanged (11 links)', () => {
    // UX-major Lane 5: Address book joins the More menu after Wallets.
    expect(MORE_LINKS).toHaveLength(11);
    expect(MORE_LINKS.map(({ to }) => to)).toEqual([
      '/wallets',
      '/address-book',
      '/transactions',
      '/track',
      '/import-wallet',
      '/create',
      '/security',
      '/networks',
      '/walletconnect',
      '/mnemonic-backup',
      '/welcome',
    ]);
  });

  it('has exactly one Create wallet button, in the Create button’s place and layout', async () => {
    // Token gaps, item 9: the duplicate 'create wallet' entry is gone;
    // the 'Create' entry was renamed to 'Create wallet' and keeps its
    // /create target and wrench icon.
    expect(
      MORE_LINKS.filter(({ label }) => label === 'Create wallet'),
    ).toHaveLength(1);
    expect(
      MORE_LINKS.find(({ label }) => label === 'Create wallet'),
    ).toEqual({ to: '/create', label: 'Create wallet', icon: 'wrench' });
    const mounted = await mountNav({});
    try {
      const links = [...mounted.div.querySelectorAll('nav a')].filter(
        (link) => link.textContent?.includes('Create wallet'),
      );
      expect(links).toHaveLength(1);
      expect(links[0]?.getAttribute('href')).toBe('/create');
    } finally {
      await mounted.cleanup();
    }
  });
});
