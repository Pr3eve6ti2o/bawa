import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-04 send is disabled', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Send');

  await expect(
    page.getByText('Broadcast is disabled until separately authorised.'),
  ).toBeVisible();
  // The flow never gets past its first step in this test: nothing is
  // signed, built, or broadcast.
  await expect(page.getByRole('heading', { name: 'Send' })).toBeVisible();
});
