import { expect, test } from '@playwright/test';
import { createTestWallet, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-01 create a wallet end to end', async ({ page }) => {
  await createTestWallet(page);

  await expect(page.getByText('Your wallet is ready')).toBeVisible();
  // All four chain addresses are shown (Ethereum first).
  await expect(page.locator('code')).toHaveCount(4);
  for (const label of ['Bitcoin', 'Ethereum', 'TRON', 'TON']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  // The phrase is gone from the screen afterwards.
  await expect(page.locator('ol[aria-label="Recovery phrase"]')).toHaveCount(0);
});
