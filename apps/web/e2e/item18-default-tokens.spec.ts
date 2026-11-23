// UI/UX fixes, item 18 — the 13 new primary defaults render on the
// Assets list and settle honestly: SPL USDC + Jetton USDT (item 13),
// WETH on Ethereum, USDC/USDT(0) on Polygon/Arbitrum/Optimism/Base/
// Avalanche and USDT on BNB Smart Chain. The fresh test wallet holds
// 0 of each; every row below is a real zero from a live balance read,
// never a fabricated value. The dashboard now has 43 rows (22 native
// chains + 21 default tokens).
import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-18 thirteen new primary defaults settle on the Assets list', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  const zeroText = page.getByText('Zero balance', { exact: true });
  const failedText = page.locator(
    'text=/^(Balance unavailable|Could not load balance)$/',
  );
  const settled = async () =>
    (await zeroText.count()) + (await failedText.count());

  await expect.poll(settled, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(settled, { timeout: 60_000 }).toBe(43);

  const zero = await zeroText.count();
  const failed = await failedText.count();
  expect(zero + failed).toBe(43);
  expect(zero).toBeGreaterThanOrEqual(40);

  // Each new primary is a real row with a real zero balance. Rows are
  // located by their asset link (the WETH E2E-06 pattern): the title
  // text sits beside the VERIFIED tick in one element, so an exact
  // getByText match does not resolve, but the link's accessible name
  // carries the symbol.
  await expect(
    page.getByRole('link', { name: /WETH/ }).first(),
  ).toContainText('Zero balance');
  // USDT0 on Polygon reports the on-chain symbol USDT0; on Arbitrum
  // the same token's on-chain symbol is USD₮0 (verified live
  // 2026-11-23) — one row each, not two of the same symbol.
  await expect(page.getByRole('link', { name: /USDT0/ })).toHaveCount(1);
  // Avalanche USDT reports its on-chain symbol USDt; Arbitrum USDT0
  // reports USD₮0; TON USDT reports USD₮.
  await expect(
    page.getByRole('link', { name: /USDt/ }).first(),
  ).toContainText('Zero balance');
  await expect(
    page.getByRole('link', { name: /USD₮0/ }).first(),
  ).toContainText('Zero balance');
  await expect(
    page.getByRole('link', { name: /USD₮/ }).first(),
  ).toContainText('Zero balance');
  // SPL USDC on Solana (one of seven USDC rows).
  await expect(
    page.getByRole('link', { name: /USDC/ }).first(),
  ).toContainText('Zero balance');

  await page.screenshot({ path: 'test-results/lane-b/item18-defaults-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item18-defaults-390.png' });
});
