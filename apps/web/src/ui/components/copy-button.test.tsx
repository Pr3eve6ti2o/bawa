// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { CopyButton } from './copy-button';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mount(value: string, label = 'Copy address') {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<CopyButton value={value} label={label} />);
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

describe('CopyButton', () => {
  it('copies the value and confirms with Copied', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const mounted = await mount('0xTestAddress');
    try {
      const button = mounted.div.querySelector('button');
      expect(button?.textContent).toBe('Copy');
      await act(async () => {
        button?.click();
      });
      expect(writeText).toHaveBeenCalledWith('0xTestAddress');
      expect(button?.textContent).toBe('Copied');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says Copy failed when the clipboard rejects', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const mounted = await mount('0xTestAddress');
    try {
      const button = mounted.div.querySelector('button');
      await act(async () => {
        button?.click();
      });
      expect(button?.textContent).toBe('Copy failed');
    } finally {
      await mounted.cleanup();
    }
  });

  it('resets to Copy when the value changes', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(<CopyButton value="first" label="Copy address" />);
      });
      const button = div.querySelector('button');
      await act(async () => {
        button?.click();
      });
      expect(button?.textContent).toBe('Copied');
      await act(async () => {
        root.render(<CopyButton value="second" label="Copy address" />);
      });
      expect(button?.textContent).toBe('Copy');
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
