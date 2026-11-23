import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// Lane D rewrite #2 (FIX-ALL, 2026-11-24): the Lane D (finish-product)
// rewrite expected 'No transactions yet' on a fresh wallet with the
// network blocked. That can never appear: the Transactions screen's
// merged Lane C rule (screens/transaction-history.tsx, pinned by
// transaction-history.test.tsx 'never shows "No transactions yet" when
// every shown chain failed' and 'shows neither state when filtered to
// a failed chain') withholds BOTH the empty message and the failure
// block while the wallet has no activity — a failed history is not an
// empty history, and a dead Retry for a 429 is not offered. Proved
// first-hand by a 180 s probe (route-abort, disposable wallet): the
// screen shows 'Loading transactions…' until ~60 s, then settles to
// the filter chips with a blank content area — no empty message, no
// failure line, no Retry — and 'No transactions yet' never appears
// in 180 s. So this spec asserts the honest behaviour the screen
// actually has: the blocked refresh fabricates nothing and offers no
// dead Retry, and after the network returns a reload recovers to the
// genuine empty state (every history loads empty on a fresh wallet).
// The manifest's E2E-05 case still describes a failure state with a
// reason + Retry; that is the pre-wallet-refresh wording (its
// `requires` field says the case is skipped until wallet-refresh.ts
// lands) and does not match the merged screen behaviour — flagged as
// manifest drift in the Lane D report, not silently rewritten here.
test('E2E-05 refresh failure is shown honestly', async ({ page }) => {
  // Settle + recovery are slow: creation + ~60 s blocked settle +
  // reload + live history load. 300 s covers the worst case.
  test.setTimeout(300_000);
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

  // Client-side navigation: the failure under test is the blocked
  // refresh, not the boot — so reach Transactions without a reload.
  await gotoInApp(page, 'Transactions');
  // Wait for the loading state to settle: the history tasks sit behind
  // the shared refresh limiter (cap 4 across ~50 balance/token/history
  // tasks, with retry backoff), so the skeleton can take ~60 s to clear
  // with the network fully down — allow 120 s. The indicator must be
  // seen first: asserting only its absence would pass trivially before
  // the screen mounts.
  await expect(page.getByText(/Loading transactions/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Loading transactions/)).toHaveCount(0, {
    timeout: 120_000,
  });
  // Honest blank state (merged Lane C decision, unit-pinned): no
  // fabricated transactions, no false empty claim, no failure line and
  // no dead Retry on a wallet with no activity.
  await expect(page.getByText('No transactions yet')).toHaveCount(0);
  await expect(page.getByText('history unavailable')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(page.getByText('Received')).toHaveCount(0);
  await expect(page.getByText('Sent')).toHaveCount(0);

  // Unblock and reload: the failure was the network, not the vault —
  // and a fresh wallet genuinely has no transactions, so the empty
  // state now appears for real (every history loads empty). The reload
  // re-opens the vault via auto-unlock (auto-lock is off), so no
  // password prompt appears.
  await page.unrouteAll({ behavior: 'wait' });
  await page.goto('/transactions');
  await expect(page.getByText('No transactions yet').first()).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText('Received')).toHaveCount(0);
  await expect(page.getByText('Sent')).toHaveCount(0);
});
