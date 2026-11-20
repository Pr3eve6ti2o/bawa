import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-05 refresh failure is shown honestly', async ({ page }) => {
  // Real-network refreshes with retry backoff are slow; allow 60 s.
  test.setTimeout(60_000);
  // Block every non-app request before the wallet is created, so the
  // background history refresh that runs on unlock fails deterministically.
  // Same-origin requests (the app itself) are allowed through.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4193') await route.continue();
    else await route.abort();
  });
  await createTestWallet(page);

  // Client-side navigation: a full load would lock the vault and the
  // failure would come from the lock, not from the blocked network.
  await gotoInApp(page, 'Transactions');
  await expect(page.getByText('history unavailable').first()).toBeVisible();

  // Retry with the network still blocked: still unavailable, never a
  // fabricated transaction — the failed-chains box stays, and no
  // transaction row is rendered.
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('history unavailable').first()).toBeVisible();
  await expect(page.getByText('Received')).toHaveCount(0);
  await expect(page.getByText('Sent')).toHaveCount(0);

  // Unblock and retry: the failure was the network, not the vault — at
  // least one chain recovers, so the original four-chain failure line
  // is gone. Chains still failing (Ethereum/TON are often still
  // rate-limited here) stay listed honestly instead of vanishing.
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Bitcoin, Ethereum, TRON, TON history unavailable')).toHaveCount(0, {
    timeout: 20_000,
  });
});
