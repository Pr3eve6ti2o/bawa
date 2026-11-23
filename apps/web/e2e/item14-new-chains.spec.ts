// UI/UX fixes, item 14 — the nine new Trust Wallet Core chains render
// and settle on the dashboard like the original thirteen.
//
// The dashboard now has 43 asset rows (22 native chains + 21 default
// tokens, UI/UX fixes item 18). Each new chain's row must settle honestly — a real zero
// balance when its RPC answers, a failure state when it does not —
// never a fabricated value, never a missing row.
import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// Asset rows show the symbol only ("XDAI", not "Gnosis"), and
// symbols collide across chains (ETH is Ethereum, Linea, Scroll
// and Aurora), so each row is located by its asset link.
const NEW_CHAINS = [
  'gnosis',
  'celo',
  'linea',
  'mantle',
  'scroll',
  'opbnb',
  'metis',
  'aurora',
  'fantom',
] as const;

test('E2E-14 nine new chains settle on the dashboard', async ({ page }) => {
  test.setTimeout(300_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Home');

  const zeroText = page.getByText('Zero balance', { exact: true });
  const failedText = page.locator(
    'text=/^(Balance unavailable|Could not load balance)$/',
  );
  const settled = async () =>
    (await zeroText.count()) + (await failedText.count());

  await expect.poll(settled, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(settled, { timeout: 60_000 }).toBe(43);

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
  expect(zero).toBeGreaterThanOrEqual(40);

  for (const chain of NEW_CHAINS) {
    const row = page.locator(`a[href="/assets/${chain}"]`).first();
    await expect(row).toContainText(
      /Zero balance|Could not load balance|Balance unavailable/,
    );
  }

  await page.screenshot({ path: 'test-results/lane-b/item14-dashboard-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item14-dashboard-390.png' });
});
