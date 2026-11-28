// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { SIDEBAR_GROUPS, SIDEBAR_LINKS, SidebarNav } from './sidebar-nav';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountNav(
  props: {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    hasVault?: boolean;
  },
  path = '/',
) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
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

  it('groups the destinations — Money, Wallets, Settings — with no Welcome, no Create', () => {
    // P1 (Lane S1): the 15-link flat sidebar is grouped; the More
    // menu is gone, so Swap and Activity (Transactions, renamed)
    // move into Money, and Create/Import live on the Wallets screen
    // as one Add wallet. Watch-only display programme (audit F12):
    // Track is linked from Money now (it used to live inside
    // Transactions only).
    expect(SIDEBAR_GROUPS.map(({ heading }) => heading)).toEqual([
      'Money',
      'Wallets',
      'Settings',
    ]);
    expect(SIDEBAR_LINKS.map(({ to }) => to)).toEqual([
      '/',
      '/assets',
      '/receive',
      '/send',
      '/swap',
      '/transactions',
      '/track',
      '/wallets',
      '/address-book',
      '/security',
      '/networks',
      '/mnemonic-backup',
    ]);
    const labels = SIDEBAR_LINKS.map(({ label }) => label);
    expect(labels).toContain('Activity');
    expect(labels).toContain('Track');
    expect(labels).not.toContain('Welcome');
    expect(labels).not.toContain('Track a transaction');
    expect(labels).not.toContain('Create wallet');
    expect(labels).not.toContain('Import wallet');
  });

  it('hides Mnemonic backup when there is no vault', async () => {
    // Watch-only display programme (audit F16): with no vault there
    // is no recovery phrase, so the backup item has nothing to back
    // up. The exported link list stays the full list (pinned above);
    // only the rendered nav drops the item.
    const mounted = await mountNav({ hasVault: false });
    try {
      const link = mounted.div.querySelector('a[href="/mnemonic-backup"]');
      expect(link).toBeNull();
      expect(mounted.div.querySelector('a[href="/track"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the group headings expanded', async () => {
    const mounted = await mountNav({});
    try {
      const text = mounted.div.textContent ?? '';
      for (const heading of ['Money', 'Wallets', 'Settings']) {
        expect(text).toContain(heading);
      }
    } finally {
      await mounted.cleanup();
    }
  });

  it('lets long active labels wrap instead of truncating them', async () => {
    // P3: the active item adds a coral square (~18px) beside the label,
    // so at 224px "Mnemonic backup" clipped to "Mnemonic back…". The
    // labels are copy and must not be shortened; the item lets them wrap
    // instead.
    const mounted = await mountNav({}, '/mnemonic-backup');
    try {
      const link = mounted.div.querySelector('a[href="/mnemonic-backup"]');
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('Mnemonic backup');
      expect(link?.querySelector('.truncate')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
