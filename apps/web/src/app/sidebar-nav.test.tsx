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

  it('keeps the More menu destinations unchanged (10 links)', () => {
    expect(MORE_LINKS).toHaveLength(10);
    expect(MORE_LINKS.map(({ to }) => to)).toEqual([
      '/wallets',
      '/transactions',
      '/track',
      '/import-wallet',
      '/create-wallet',
      '/create',
      '/security',
      '/networks',
      '/mnemonic-backup',
      '/welcome',
    ]);
  });
});
