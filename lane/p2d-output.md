```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrices } from './prices';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

describe('usePrices', () => {
  let originalFetch: typeof globalThis.fetch;
  let latest: ReturnType<typeof usePrices> | null = null;
  function Probe(): null { latest = usePrices(); return null; }

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    latest = null;
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function mount() {
    const div = document.createElement('div');
    document.body.appendChild(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(div);
    await act(async () => { root.render(<Probe />); });
    return {
      div, root,
      cleanup: async () => {
        await act(async () => { root.unmount(); });
        div.remove();
      },
    };
  }

  it('stays idle on mount and loads fresh prices on refresh', async () => {
    const stub = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => freshPayload(),
      headers: { get: () => null },
    }));
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      expect(latest!.state).toMatchObject({ status: 'idle', lastFetchedAtMs: null });
      expect(stub).not.toHaveBeenCalled();
      await act(async () => {
        latest?.refresh();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(4);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'fresh' });
      expect(Number.isFinite(latest!.state.lastFetchedAtMs)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('reports network errors when fetch throws', async () => {
    const stub = vi.fn(async () => { throw new Error('down'); });
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      await act(async () => {
        latest?.refresh();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(4);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'error', error: 'network' });
    } finally {
      await cleanup();
    }
  });

  it('ignores duplicate refresh calls while loading', async () => {
    const stub = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', stub);
    const { cleanup } = await mount();
    try {
      await act(async () => {
        latest?.refresh();
        latest?.refresh();
      });
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup();
    }
  });

  it('reports network errors when fetch is unavailable', async () => {
    vi.stubGlobal('fetch', undefined);
    delete (globalThis as Record<string, unknown>).fetch;
    const { cleanup } = await mount();
    try {
      await act(async () => { latest?.refresh(); });
      expect(latest!.state.status).toBe('ready');
      const entries = Object.values(latest!.state.entries);
      expect(entries).toHaveLength(4);
      for (const entry of entries) expect(entry).toMatchObject({ status: 'error', error: 'network' });
    } finally {
      await cleanup();
    }
  });
});
```