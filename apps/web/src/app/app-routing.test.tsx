
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
