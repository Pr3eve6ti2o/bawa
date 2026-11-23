import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// Lane D rewrite (2026-11-23): the previous version of this test expected
// 'history unavailable' on a FRESH wallet with the network blocked. That
// can never appear: the Transactions screen deliberately discloses a
// failed history fetch only when the wallet has activity
// (screens/transaction-history.tsx — "a fresh wallet with no
// transactions shows 'No transactions yet', not an error + a dead Retry
// for a 429 that would only 429 again"). The rule came from the
// marketing-fix programme (Lane 1) and was never re-checked against
// this spec, so the spec failed twice in isolation on this tree AND on
// the untouched d47d282 baseline — a stale test, not a regression.
// Proved first-hand by a 120 s CDP probe (route-abort, disposable
// wallet): the screen settles on "No transactions yet.", never on a
// failure box. The failure box itself IS covered by unit tests
// (transaction-history.test.tsx renders 'TRON history unavailable'
// with mocked loaded rows). So this spec now asserts the honest
// fresh-wallet behaviour: no fabricated transactions, no dead Retry,
// no 'history unavailable' line — the empty state, stated plainly.
test('E2E-05 refresh failure is shown honestly', async ({ page }) => {
  // Real-network refreshes with retry backoff are slow; allow 90 s.
  test.setTimeout(90_000);
  // Block every non-app request before the wallet is created, so the
  // background history refresh that runs on unlock fails deterministically.
  // Same-origin requests (the app itself) are allowed through. The check
  // is on the hostname, not the port: the harness port is overridable
  // (E2E_PORT, ADR-0011), and a hardcoded port would abort the app's
  // own requests on any other port.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') await route.continue();
    else await route.abort();
  });
  await createTestWallet(page);

  // Client-side navigation: a full load would lock the vault and the
  // failure would come from the lock, not from the blocked network.
  await gotoInApp(page, 'Transactions');
  // The history tasks sit behind the shared refresh limiter (cap 4
  // across ~50 balance/token/history tasks, with 1 s + 2 s retry
  // delays), so the empty state can take well past 30 s to settle
  // with the network fully down — allow 60 s.
  await expect(page.getByText('No transactions yet').first()).toBeVisible({
    timeout: 60_000,
  });
  // Honest empty state: no failure line and no dead Retry on a wallet
  // with no activity, and never a fabricated transaction.
  await expect(page.getByText('history unavailable')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(page.getByText('Received')).toHaveCount(0);
  await expect(page.getByText('Sent')).toHaveCount(0);

  // Unblock: the failure was the network, not the vault — and a fresh
  // wallet genuinely has no transactions, so the empty state stays.
  await page.unrouteAll({ behavior: 'wait' });
  await page.waitForTimeout(5_000);
  await expect(page.getByText('No transactions yet').first()).toBeVisible();
  await expect(page.getByText('Received')).toHaveCount(0);
  await expect(page.getByText('Sent')).toHaveCount(0);
});
