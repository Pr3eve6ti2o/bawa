// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { NetworkSelectionScreen } from './network-selection';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('NetworkSelectionScreen', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/networks']}>
          <NetworkSelectionScreen />
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (previousActEnvironment === undefined) {
      delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
    } else {
      testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it('lists all four mainnets', () => {
    const text = container.textContent ?? '';
    for (const name of ['Bitcoin', 'Ethereum', 'TRON', 'TON']) {
      expect(text).toContain(name);
    }
  });

  it('lays the four networks out in two columns on desktop widths', () => {
    // P7: one sparse list stretched full-width left ~55% of a
    // 1919x1080 viewport empty. Two columns at lg make it a compact
    // 2x2. Below lg it stays a single-column list, so the mobile
    // layout is untouched.
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.className).toContain('space-y-3');
    expect(list?.className).toContain('lg:grid');
    expect(list?.className).toContain('lg:grid-cols-2');
    expect(list?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(4);
  });
});
