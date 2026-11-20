import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

test('E2E-03 home shows honest zero balances', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Home');

  // Four chains, each honestly zero — never a fabricated value.
  await expect(page.getByText('Zero balance').first()).toBeVisible();
  await expect(page.getByText('Zero balance')).toHaveCount(4);
});
