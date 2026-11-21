import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-04 send is disabled', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Send');

  // The merged Send screen states the disabled position in its own
  // words (adopt-proper's copy): sending is switched off until
  // separately approved and the flow signs offline only.
  await expect(
    page.getByText('Sending funds is switched off until it is separately approved.'),
  ).toBeVisible();
  // The flow never gets past its first step in this test: nothing is
  // signed, built, or broadcast.
  await expect(page.getByRole('heading', { name: 'Send' })).toBeVisible();
});
