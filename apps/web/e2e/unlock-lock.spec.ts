import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// E2E-02 — REWRITTEN for the vault-lock removal (owner order 2026-11-20).
// The old "Lock and unlock the vault" case no longer exists: there is no
// lock button, no lock screen and no /lock route. This case now guards
// the no-lock behaviour instead: the vault stays open after creation,
// the Security screen says so, and a full page reload re-opens it via
// auto-unlock with no password prompt.
test('E2E-02 vault stays unlocked (no lock screen)', async ({ page }) => {
  await createTestWallet(page);

  // The vault is open immediately after creation: balances load.
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Zero balance').first()).toBeVisible();

  // The Security screen states the vault stays unlocked and offers no
  // way to lock it.
  await gotoInApp(page, 'Security');
  await expect(page.getByText('Vault stays unlocked')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Lock vault' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Unlock your wallet' }),
  ).toHaveCount(0);

  // A full page reload re-opens the vault via auto-unlock: no password
  // prompt, no unlock screen, balances load again.
  await page.reload();
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Zero balance').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Unlock your wallet' }),
  ).toHaveCount(0);

  // /lock is not a route any more: it never shows an unlock screen.
  await page.goto('/lock');
  await expect(
    page.getByRole('heading', { name: 'Unlock your wallet' }),
  ).toHaveCount(0);
});
