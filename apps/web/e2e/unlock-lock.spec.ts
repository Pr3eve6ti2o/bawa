import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// E2E-02 — REWRITTEN for auto-lock restored (merge 2, layout-rebuild into
// adopt-proper). Auto-lock is OPTIONAL and OFF by default: with it off the
// vault stays open after creation, the Security screen shows the Auto-lock
// card switched off, and a full page reload re-opens it via auto-unlock
// with no password prompt. /lock IS a route again — it shows the unlock
// screen only when the vault is locked, so while unlocked it shows no
// unlock screen. (The title is a CardTitle, which renders a <div>,
// so no heading role ever matches it — the old getByRole('heading')
// assertions were vacuous: they passed whether or not the lock
// screen was showing. getByText matches the real element.) (The merge-1 version of this spec guarded the no-lock
// model — "Vault stays unlocked" copy, no /lock route — which merge 2
// superseded.)
test('E2E-02 vault stays unlocked (no lock screen)', async ({ page }) => {
  await createTestWallet(page);

  // The vault is open immediately after creation: balances load.
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Zero balance').first()).toBeVisible();

  // The Security screen states auto-lock is off and offers no way to
  // lock it: the duration select only appears when auto-lock is on.
  await gotoInApp(page, 'Security');
  await expect(
    page.getByText(
      'Auto-lock is off. Your wallet stays unlocked on this device.',
    ),
  ).toBeVisible();
  await expect(page.locator('#auto-lock')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Lock vault' }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Unlock your wallet'),
  ).toHaveCount(0);

  // A full page reload re-opens the vault via auto-unlock: no password
  // prompt, no unlock screen, balances load again.
  await page.reload();
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Zero balance').first()).toBeVisible();
  await expect(
    page.getByText('Unlock your wallet'),
  ).toHaveCount(0);

  // /lock with the vault unlocked shows no unlock screen.
  await page.goto('/lock');
  await expect(
    page.getByText('Unlock your wallet'),
  ).toHaveCount(0);
});
