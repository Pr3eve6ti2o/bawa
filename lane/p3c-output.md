// SNIPPET 1 — replace the existing fabricated-total test
```tsx
  it('never renders a fabricated portfolio total', async () => {
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      // No fiat amount anywhere: no fabricated portfolio total.
      expect(mounted.div.textContent).not.toContain('$');
      // The feed exists now; the hero invites a manual refresh instead of claiming no feed is connected.
      expect(mounted.div.textContent).toContain('No prices loaded yet');
    } finally {
      await mounted.cleanup();
    }
  });
```

// SNIPPET 2 — insert helpers and new tests immediately after Snippet 1
```tsx
  function stubPriceFetch(response: {
    ok: boolean;
    status: number;
    json?: () => Promise<unknown>;
    headers?: { get: (name: string) => string | null };
  }): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: response.ok,
        status: response.status,
        json: response.json ?? (async () => ({})),
        headers: response.headers ?? { get: () => null },
      })),
    );
  }
  function freshPayload(ageSeconds = 30): Record<string, { usd: number; last_updated_at: number }> {
    const lastUpdatedAt = Math.floor(Date.now() / 1000) - ageSeconds;
    return {
      bitcoin: { usd: 62683, last_updated_at: lastUpdatedAt },
      ethereum: { usd: 1774.93, last_updated_at: lastUpdatedAt },
      tron: { usd: 0.310229, last_updated_at: lastUpdatedAt },
      'the-open-network': { usd: 1.028, last_updated_at: lastUpdatedAt },
    };
  }
  async function clickRefreshPrices(mounted: { div: HTMLDivElement }): Promise<void> {
    const button = [...mounted.div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Refresh prices',
    ) as HTMLButtonElement;
    expect(button).not.toBeUndefined();
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('shows the live portfolio total with source and freshness after refreshing prices', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', amount: '100000000' },
        eth: { status: 'available', amount: '0' },
        trx: { status: 'available', amount: '0' },
        ton: { status: 'available', amount: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
      expect(mounted.div.textContent).toContain('Updated just now');
      expect(mounted.div.textContent).toContain('· CoinGecko');
      expect(mounted.div.textContent).not.toContain('(Partial)');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows a Partial total when one price is expired', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', amount: '100000000' },
        eth: { status: 'available', amount: '1500000000000000000' },
        trx: { status: 'available', amount: '0' },
        ton: { status: 'available', amount: '0' },
      }),
    );
    const payload = freshPayload(11 * 60);
    payload.bitcoin.last_updated_at = Math.floor(Date.now() / 1000) - 30;
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('$62,683.00 (Partial)');
      expect(mounted.div.textContent).toContain('Partial total');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows expired prices as expired, never as current', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', amount: '100000000' },
        eth: { status: 'available', amount: '0' },
        trx: { status: 'available', amount: '0' },
        ton: { status: 'available', amount: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(11 * 60),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('Price expired');
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('$62,683.00');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows an honest error on a rate-limited price feed, never $0.00', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', amount: '100000000' },
        eth: { status: 'available', amount: '0' },
        trx: { status: 'available', amount: '0' },
        ton: { status: 'available', amount: '0' },
      }),
    );
    stubPriceFetch({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name === 'Retry-After' ? '120' : null),
      },
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('Price feed rate-limited');
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('$');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows a missing price as unavailable, never $0.00', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', amount: '100000000' },
        eth: { status: 'available', amount: '0' },
        trx: { status: 'available', amount: '0' },
        ton: { status: 'available', amount: '1000000000' },
      }),
    );
    const payload = freshPayload();
    delete payload['the-open-network'];
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('Price unavailable');
      expect(mounted.div.textContent).toContain('$62,683.00 (Partial)');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });
```