// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { PriceChart } from './price-chart';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// TEST-DATA-006 (rule: the chart plots real CoinGecko history only —
// loading is a skeleton, a missing id / degenerate payload / failed
// fetch is an honest state, never invented points).
describe('price chart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function mountChart(coingeckoId: string | null) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {
      root.render(<PriceChart coingeckoId={coingeckoId} label="Bitcoin" />);
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

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows a skeleton while the history loads', async () => {
    const fetchStub = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart('bitcoin');
    try {
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(div.textContent).toContain('Loading price chart…');
      expect(div.querySelector('polyline')).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it('plots real history points with the 7-day movement', async () => {
    const fetchStub = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        prices: [
          [1000, 60000],
          [2000, 61000],
          [3000, 62683],
        ],
      }),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart('bitcoin');
    try {
      await flush();
      const polyline = div.querySelector('polyline');
      expect(polyline).not.toBeNull();
      expect(polyline?.getAttribute('points')?.split(' ').length).toBe(3);
      expect(div.textContent).toContain('$60,000.00');
      expect(div.textContent).toContain('$62,683.00');
      expect(div.textContent).toContain('+4.47% over 7 days');
      expect(div.textContent).toContain('Prices from CoinGecko.');
    } finally {
      await cleanup();
    }
  });

  it('shows an honest rate-limit state, never invented points', async () => {
    const fetchStub = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart('bitcoin');
    try {
      await flush();
      expect(div.querySelector('polyline')).toBeNull();
      expect(div.textContent).toContain('rate-limiting charts');
      expect(div.textContent).not.toContain('in a minute');
    } finally {
      await cleanup();
    }
  });

  it('offers a Retry on a failed chart that refetches the chart only', async () => {
    // P0-6: the chart error said "try again" with nothing to tap.
    // The first fetch fails (rate limit); Retry refetches and the
    // chart plots. No other screen state is touched.
    const fetchStub = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart('bitcoin');
    try {
      await flush();
      expect(div.textContent).toContain('rate-limiting charts');
      const retry = Array.from(div.querySelectorAll('button')).find(
        (button) => button.textContent === 'Retry',
      );
      expect(retry).not.toBeUndefined();
      fetchStub.mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          prices: [
            [1000, 60000],
            [2000, 61000],
            [3000, 62683],
          ],
        }),
        headers: { get: () => null },
      }));
      await act(async () => {
        retry?.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      await flush();
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(div.querySelector('polyline')).not.toBeNull();
      expect(div.textContent).toContain('$60,000.00');
    } finally {
      await cleanup();
    }
  });

  it('offers no Retry when there is no CoinGecko id to fetch', async () => {
    const fetchStub = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ prices: [] }),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart(null);
    try {
      await flush();
      expect(fetchStub).not.toHaveBeenCalled();
      expect(div.querySelector('polyline')).toBeNull();
      expect(div.textContent).toContain('No chart data for this asset yet.');
      // P0-6: no id means nothing to refetch, so no Retry either.
      expect(
        Array.from(div.querySelectorAll('button')).find(
          (button) => button.textContent === 'Retry',
        ),
      ).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('shows no-chart-data for a single-point payload', async () => {
    const fetchStub = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ prices: [[1000, 60000]] }),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', fetchStub);
    const { div, cleanup } = await mountChart('bitcoin');
    try {
      await flush();
      expect(div.querySelector('polyline')).toBeNull();
      expect(div.textContent).toContain('No chart data for this asset yet.');
    } finally {
      await cleanup();
    }
  });
});
