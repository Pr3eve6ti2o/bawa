import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots, TEST_PASSWORD } from './helpers';

setupMaskedScreenshots();

test('E2E-02 lock and unlock', async ({ page }) => {
  await createTestWallet(page);

  // Lock from the security screen (there is no lock button on the home
  // screen). Client-side navigation: a full load would lock the vault.
  await gotoInApp(page, 'Security');
  await page.getByRole('button', { name: 'Lock vault' }).click();
  await expect(page.getByText('Vault locked')).toBeVisible();
  await page.getByRole('link', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Unlock your wallet' })).toBeVisible();

  // A wrong password shows an error and stays locked.
  await page.getByLabel(/password/i).fill('wrong password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlock your wallet' })).toBeVisible();
  await expect(page).toHaveURL(/\/lock$/);

  // The right password unlocks.
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Zero balance').first()).toBeVisible();
});
