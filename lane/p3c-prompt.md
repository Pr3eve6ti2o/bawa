You are editing one test file for the Bawa web wallet (app in apps/web). You have no shell or filesystem access. EMIT ONLY the replacement snippets for `apps/web/src/screens/dashboard.test.tsx`, each in its own ```tsx fenced block, in order, with a one-line `// SNIPPET N ...` comment before each block. No prose, no other files.

CONTEXT: the dashboard now wires the live CoinGecko price feed (`apps/web/src/wallet/prices.ts`, `usePrices()` hook). The hero shows the portfolio total from `portfolioTotal()` (only fresh-quoted balances; "(Partial)" when incomplete), a "Powered by CoinGecko" attribution line when a price is shown, and a "Refresh prices" button that calls `usePrices().refresh()` (one batched CoinGecko call per click; nothing on mount; no polling). Asset rows show a fiat value plus "Updated … · CoinGecko" only for fresh quotes; otherwise "Price expired" / "Price unavailable" / "Price error". The test file's existing harness (do not change it except as listed):
- `// @vitest-environment jsdom` at the top; imports beforeEach/describe/expect/it/vi from vitest, createRoot, act, MemoryRouter, DashboardScreen, useWallet, availableFor, chainConfig, BalanceState.
- `vi.mock('../state/wallet-context', ...)` and `vi.mock('../wallet/chains', ...)`; CHAINS map; `balancesFor(overrides)`; `mockRefreshBalances`; `setWallet(balances, extra)`; `mountScreen()` rendering `<MemoryRouter><DashboardScreen /></MemoryRouter>` with IS_REACT_ACT_ENVIRONMENT.
- `beforeEach`: vi.clearAllMocks(); mockRefreshBalances.mockResolvedValue(undefined); availableFor returns ['btc','eth','trx','ton']; chainConfig returns CHAINS[chain].
- Helper to find a button: `[...mounted.div.querySelectorAll('button')].find((c) => c.textContent === '...') as HTMLButtonElement`, clicked inside `await act(async () => { button.click(); })`.
- Fresh payload shape (real CoinGecko `/simple/price`): `{ bitcoin: { usd: 62683, last_updated_at: <seconds> }, ethereum: { usd: 1774.93, last_updated_at }, tron: { usd: 0.310229, last_updated_at }, 'the-open-network': { usd: 1.028, last_updated_at } }` with `last_updated_at` in SECONDS. The hook calls `fetchPrices(globalThis.fetch, Date.now())`, so build timestamps from the REAL Date.now() at test time: fresh is `Math.floor(Date.now() / 1000) - 30`, expired is `Math.floor(Date.now() / 1000) - 11 * 60`.

SNIPPET 1 replaces this exact test (the feed now exists, so the old "No price feed connected" copy is stale — the test's INTENT, no fabricated total, is unchanged):
```
  it('never renders a fabricated portfolio total', async () => {
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      // No fiat amount anywhere: no fabricated portfolio total.
      expect(mounted.div.textContent).not.toContain('$');
      expect(mounted.div.textContent).toContain('No price feed connected');
    } finally {
      await mounted.cleanup();
    }
  });
```
Replacement: same test, same name, but the copy assertion becomes `expect(mounted.div.textContent).toContain('No prices loaded yet');` (the hero now says "No prices loaded yet — refresh prices to see the portfolio total." while prices are idle). Keep the `not.toContain('$')` assertion. Add a comment noting the feed exists now and the hero invites a manual refresh instead of claiming no feed is connected.

SNIPPET 2 — new tests, appended INSIDE the existing `describe('dashboard screen', ...)` block, immediately AFTER the updated test from Snippet 1 (the assembler inserts them there; your snippet is only the new it() blocks, each complete). First add a fetch-stub helper at the top of your snippet (inside the describe, before the first new test):
```
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
```
And add an afterEach-style restore: the file has no afterEach import — do NOT add one; instead, each new test restores fetch in its finally block with `vi.unstubAllGlobals()` before `await mounted.cleanup()`. (The existing beforeEach calls vi.clearAllMocks(), which does not touch stubbed globals.)
New tests (each its own it(), using setWallet + mountScreen + the helpers):
(a) 'shows the live portfolio total with source and freshness after refreshing prices': balances 1 BTC available ('100000000') + eth/trx/ton zero; stubPriceFetch({ ok: true, status: 200, json: async () => freshPayload() }); mount; clickRefreshPrices; assert text contains '$62,683.00', 'Powered by CoinGecko', 'Updated just now', and '· CoinGecko' (the row freshness label). Assert it does NOT contain '(Partial)'.
(b) 'shows a Partial total when one price is expired': balances 1 BTC available + 1.5 ETH available ('1500000000000000000') + trx/ton zero; stub a payload where bitcoin is fresh (30s) and the other three are 11 minutes old (build with freshPayload(11 * 60) then override bitcoin last_updated_at to fresh); mount; clickRefreshPrices; assert text contains '$62,683.00 (Partial)' and 'Partial total' and 'Powered by CoinGecko'.
(c) 'shows expired prices as expired, never as current': balances 1 BTC available + others zero; stub freshPayload(11 * 60) (all expired); mount; clickRefreshPrices; assert text contains 'Price expired' and 'Unavailable', and does NOT contain '$62,683.00'.
(d) 'shows an honest error on a rate-limited price feed, never $0.00': balances 1 BTC available + others zero; stubPriceFetch({ ok: false, status: 429, headers: { get: (name: string) => (name === 'Retry-After' ? '120' : null) } }); mount; clickRefreshPrices; assert text contains 'Price feed rate-limited' and 'Unavailable', and does NOT contain '$' anywhere.
(e) 'shows a missing price as unavailable, never $0.00': balances 1 BTC available ('100000000') + 1 TON available ('1000000000') + eth/trx zero; stub a payload with bitcoin/ethereum/tron fresh and NO 'the-open-network' key (build freshPayload() then delete the key); mount; clickRefreshPrices; assert text contains 'Price unavailable' and '$62,683.00 (Partial)'.
In every new test, wrap the body in try/finally that calls vi.unstubAllGlobals() then await mounted.cleanup(). The 'Refresh prices' button label changes to 'Refreshing prices…' while loading; clickRefreshPrices finds it by the idle label before clicking, so call it only once per test.

CONSTRAINTS: no live network calls anywhere (all fetch calls are stubbed); no new dependencies; no AVOID-list names; do not change any existing test except the one in Snippet 1; do not change the harness, setWallet, mountScreen, or beforeEach.
