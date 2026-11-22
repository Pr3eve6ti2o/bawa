import { expect, test } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// Wrapped ETH — a real ERC-20 on Ethereum mainnet, NOT one of the
// wallet's 7 default tokens (USDC is a default, so adding it reports
// "Already added"). The fresh wallet holds 0 WETH; the balance the
// app shows comes from a live eth_call, never a fixture.
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

test('E2E-06 add token by contract adds WETH with a real balance', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await page.getByRole('button', { name: 'Add token' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Ethereum contract address').fill(WETH);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Live verification: eth_getCode + name/symbol/decimals + balanceOf
  // on the pinned Ethereum RPC, plus the CoinGecko contract lookup.
  // It takes a few seconds; the 30 s test timeout covers it.
  await expect(page.getByText('Token added')).toBeVisible({ timeout: 20_000 });

  // Close the dialog and see the new row with its real zero balance.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: /WETH/ }).first()).toBeVisible();
  await expect(
    page.getByText('Zero balance', { exact: true }).last(),
  ).toBeVisible();
});

test('E2E-06 a bad contract is rejected with an inline error', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await page.getByRole('button', { name: 'Add token' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Ethereum contract address').fill('0x1234');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText(
    'Enter a 40-character contract address starting with 0x',
  );
  // Nothing added, nothing persisted: the dialog is still open.
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('E2E-06 add chain re-enables a disabled chain', async ({ page }) => {
  await createTestWallet(page);
  await page.goto('/networks');
  await expect(page.getByRole('heading', { name: 'Networks' })).toBeVisible();

  const solanaRow = page.locator('li', { hasText: 'Solana' });
  await solanaRow.getByRole('button', { name: 'Disable' }).click();
  await expect(solanaRow.getByText('DISABLED')).toBeVisible();

  await gotoInApp(page, 'Assets');
  await page.getByRole('button', { name: 'Add token' }).first().click();
  await page.getByRole('button', { name: 'Add chain' }).click();
  const dialogSolanaRow = page
    .getByRole('dialog')
    .locator('li', { hasText: 'Solana' });
  await dialogSolanaRow.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Solana added')).toBeVisible();

  await page.keyboard.press('Escape');
  // The Solana row is back in the list. It is a link only once its
  // balance resolves — and Solana's pinned RPC 403s browser requests
  // (see balances.spec.ts), so the row may honestly be a failed row
  // with a Retry instead of a link. Assert the row, not the link.
  const solanaRowInAssets = page.locator('main li', { hasText: 'Solana' });
  await expect(solanaRowInAssets).toBeVisible();
});
