import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-03 home shows honest zero balances', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Home');

  // Twenty tokens (13 natives + 7 default tokens), each honestly zero
  // — never a fabricated value. The live RPC reads can take a few
  // seconds, and a burst of 20 parallel reads can 429 a public
  // endpoint, so every row gets up to 60 s to settle and the test
  // retries failed rows once through the UI's own Retry buttons.
  // One chain is a known honest failure, not a zero: Solana's pinned
  // RPC (api.mainnet-beta.solana.com) answers 403 "Access forbidden"
  // to browser requests (verified 2026-11-22, node 200 / browser
  // 403), so its row shows "Could not load balance" with a Retry
  // instead of a zero. Dogecoin's free BlockCypher tier also 429s
  // under the load burst sometimes; its Retry usually clears it.
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

  await expect(zeroText.first()).toBeVisible();
  // All 20 rows settled (zero or failed) — none stuck loading, none
  // missing, none showing an invented amount.
  await expect.poll(settled, { timeout: 60_000 }).toBe(20);

  // Retry every failed row once through the UI, then let them settle
  // again. Transient 429s clear; the systematic Solana 403 does not.
  const retries = page.getByRole('button', { name: 'Retry' });
  const retryCount = await retries.count();
  for (let i = 0; i < retryCount; i++) {
    await retries.nth(0).click();
  }
  if (retryCount > 0) {
    await expect.poll(settled, { timeout: 30_000 }).toBe(20);
  }

  const zero = await zeroText.count();
  const failed = await failedText.count();
  expect(zero + failed).toBe(20);
  // At most Solana plus one transient failure may remain failed.
  expect(zero).toBeGreaterThanOrEqual(18);
  // Solana's row is honest either way: zero if its RPC answered, a
  // failure state if it 403'd again.
  const solRow = page.locator('main li', { hasText: 'Solana' }).first();
  await expect(solRow).toContainText(
    /Zero balance|Could not load balance|Balance unavailable/,
  );
});
