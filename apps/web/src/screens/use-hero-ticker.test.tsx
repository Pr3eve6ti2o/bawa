// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import {
  formatDollarAmount,
  parseDollarAmount,
  useAnimatedHeroValue,
} from './use-hero-ticker';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type FrameCallback = (now: number) => void;

function Probe({ target }: { target: string }) {
  const shown = useAnimatedHeroValue(target);
  return <p>{shown}</p>;
}

describe('hero ticker (Magic UI Number Ticker pattern, honest variant)', () => {
  describe('parseDollarAmount / formatDollarAmount', () => {
    it('parses an exact dollar total and formats it back', () => {
      expect(parseDollarAmount('$62,683.00')).toBe(62683);
      expect(formatDollarAmount(62683)).toBe('$62,683.00');
      expect(formatDollarAmount(0)).toBe('$0.00');
      expect(formatDollarAmount(187.5)).toBe('$187.50');
    });

    it('rejects anything that is not an exact dollar total', () => {
      expect(parseDollarAmount('$62,683.00 (Partial)')).toBeNull();
      expect(parseDollarAmount('Unavailable')).toBeNull();
      expect(parseDollarAmount('Locked')).toBeNull();
      expect(parseDollarAmount('••••••')).toBeNull();
      expect(parseDollarAmount('')).toBeNull();
      expect(parseDollarAmount('$62,683')).toBeNull();
    });
  });

  describe('useAnimatedHeroValue', () => {
    let div: HTMLDivElement;
    let root: Root;
    let frames: FrameCallback[];
    let previousActEnvironment: boolean | undefined;

    function mountProbe(target: string): void {
      div = document.createElement('div');
      document.body.appendChild(div);
      root = createRoot(div);
      previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
      testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
      act(() => {
        root.render(<Probe target={target} />);
      });
    }

    function rerenderProbe(target: string): void {
      act(() => {
        root.render(<Probe target={target} />);
      });
    }

    function runFrame(index: number, now: number): void {
      const callback = frames[index];
      expect(callback).not.toBeUndefined();
      act(() => {
        callback?.(now);
      });
    }

    beforeEach(() => {
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameCallback) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
      vi.stubGlobal('matchMedia', () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      div.remove();
      if (previousActEnvironment === undefined) {
        delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
      } else {
        testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
      vi.unstubAllGlobals();
    });

    it('shows the first settled value immediately, never counting from $0.00', () => {
      mountProbe('Unavailable');
      expect(div.textContent).toBe('Unavailable');
      rerenderProbe('$62,683.00');
      // The first real total renders at once: the previous value was
      // not a dollar amount, so there is nothing honest to count from.
      expect(div.textContent).toBe('$62,683.00');
      expect(frames).toHaveLength(0);
    });

    it('counts between two settled dollar values', () => {
      mountProbe('$100.00');
      expect(div.textContent).toBe('$100.00');
      rerenderProbe('$200.00');
      expect(div.textContent).toBe('$100.00');
      expect(frames).toHaveLength(1);
      runFrame(0, 0);
      expect(div.textContent).toBe('$100.00');
      runFrame(1, 300);
      // Halfway through the 600 ms count, eased: 100 + 100 * 0.875.
      expect(div.textContent).toBe('$187.50');
      runFrame(2, 600);
      expect(div.textContent).toBe('$200.00');
    });

    it('switches immediately when the new value is not a dollar total', () => {
      mountProbe('$100.00');
      rerenderProbe('Unavailable');
      expect(div.textContent).toBe('Unavailable');
      expect(frames).toHaveLength(0);
    });

    it('renders immediately under prefers-reduced-motion', () => {
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      mountProbe('$100.00');
      rerenderProbe('$200.00');
      expect(div.textContent).toBe('$200.00');
      expect(frames).toHaveLength(0);
    });
  });
});
