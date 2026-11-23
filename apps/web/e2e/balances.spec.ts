import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-03 home shows honest zero balances', async ({ page }) => {
  // Lane 3 (2026-11-22): the Playwright default 30 s test timeout
  // cannot contain this test's own budgets — wallet creation (~10 s)
  // + first row (measured 18.1 s live) + 60 s settle poll + retry +
  // 30 s re-poll. Live run 2026-11-22 20:57 UTC was killed by
  // "Test timeout of 30000ms exceeded" mid first-row wait. 300 s
  // covers the worst case (creation 25 + first-wait 60 + poll 60 +
  // 30 Retry clicks + re-poll 30 + final counts); the 2026-11-22
  // 21:11 UTC live run still exceeded 240 s in a dead window because
  // dead-egress requests hang instead of failing fast, burning every
  // poll's full budget. Every assertion below is unchanged.
  test.setTimeout(300_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Home');

  // Forty-three rows (22 natives + 21 default tokens incl. Base USDC),
  // UI/UX fixes item 14 (2026-11-23): nine new chains (Gnosis, Celo,
  // Linea, Mantle, Scroll, opBNB, Metis, Aurora, Fantom) joined the
  // dashboard, so the row count moved 21 -> 30.
  // UI/UX fixes item 18 (2026-11-23): thirteen more primary tokens
  // joined the dashboard, so the row count moved 30 -> 43.
  // each honestly zero — never a fabricated value. The live RPC reads
  // can take a few seconds, and a burst of 43 parallel reads can 429
  // a public endpoint, so every row gets up to 60 s to settle and the
  // test retries failed rows once through the UI's own Retry buttons.
  // Token gaps, item 1 (2026-11-22): Solana now reads from the free
  // publicnode RPC (solana-rpc.publicnode.com, fallback
  // public.rpc.solanavibestation.com) and Dogecoin from SoChain
  // (sochain.com, fallback BlockCypher) — both verified in-page
  // 200 by Lane 1 and wired in by Lane 2, so both rows are expected
  // to settle to zero like the rest. The old mainnet-beta pin
  // (api.mainnet-beta.solana.com) answered 403 "Access forbidden" to
  // browser requests and is retired. A public endpoint can still 429
  // under the load burst; its Retry usually clears it.
  //
  // Note the exact:true on every count: getByText substring matching
  // would also match the "Hide zero balances" button, inflating the
  // zero count by one (that cost a debugging round: 21, not 20).
  const zeroText = page.getByText('Zero balance', { exact: true });
  const failedText = page.locator(
    'text=/^(Balance unavailable|Could not load balance)$/',
  );
  const settled = async () =>
    (await zeroText.count()) + (await failedText.count());

  // Lane 3 (2026-11-22) — wait for the first SETTLED row (zero or
  // failed), not specifically a zero row. If the first fetch burst
  // fires while sandbox egress is down, every row fails honestly and
  // no zero row ever appears — the retry path below is the recovery,
  // and it can only run once this wait returns. The zero>=18
  // assertion at the end is unchanged, so the test keeps its teeth.
  await expect.poll(settled, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  // All 43 rows settled (zero or failed) — none stuck loading, none
  // missing, none showing an invented amount.
  //
  // Lane 3 (2026-11-22): this poll used to demand exactly 20 while the
  // test's own final assertion requires 43 — when all 43 rows settle
  // together the count skips 20 and the poll times out despite the
  // correct state (live run 2026-11-22 21:22 UTC: Expected 20,
  // Received 21, egress live). 43 is the stricter value: it requires
  // every row settled, matching the comment and the final assertion.
  await expect.poll(settled, { timeout: 60_000 }).toBe(43);

  // Retry every failed row once through the UI, then let them settle
  // again. Transient 429s clear; a systematic endpoint failure does not.
  const retries = page.getByRole('button', { name: 'Retry' });
  const retryCount = await retries.count();
  for (let i = 0; i < retryCount; i++) {
    await retries.nth(0).click();
  }
  if (retryCount > 0) {
    await expect.poll(settled, { timeout: 30_000 }).toBe(43);
  }

  const zero = await zeroText.count();
  const failed = await failedText.count();
  expect(zero + failed).toBe(43);
  // At most three transient failures may remain failed (same
  // tolerance as the old >= 18 floor on 21 rows, scaled to 43).
  expect(zero).toBeGreaterThanOrEqual(40);
  // Solana's row is honest either way: zero if its RPC answered, a
  // failure state if the endpoint failed again.
  // Asset rows show the symbol only, so the Solana row is located
  // by its asset link, not by display name.
  const solRow = page.locator('a[href="/assets/sol"]').first();
  await expect(solRow).toContainText(
    /Zero balance|Could not load balance|Balance unavailable/,
  );
});
