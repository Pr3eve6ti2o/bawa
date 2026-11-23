import { expect, test, type Page } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

async function openAddToken(page: Page): Promise<void> {
  // The Assets page re-renders while its 43 rows settle, which can
  // detach the button between resolve and click; retry the open with
  // a freshly resolved locator until the dialog is visible (same
  // helper as the item13 / item-d specs — the single click this file
  // used before flaked on the re-render).
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page
        .getByRole('button', { name: 'Add token' })
        .first()
        .click({ timeout: 10_000 });
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      return;
    } catch {
      // The button detached or the dialog did not appear yet; retry.
    }
  }
  throw new Error('Add Token dialog did not open after 5 attempts');
}

// Shiba Inu — a real ERC-20 on Ethereum mainnet, NOT one of the
// wallet's default tokens (WETH was the original token here, but item 18
// made it a default, so adding it reports "Already added"; SHIB is the
// listed non-default replacement, CoinGecko id 'shiba-inu'). The fresh
// wallet holds 0 SHIB; the balance the app shows comes from a live
// eth_call, never a fixture.
const SHIB = '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE';

test('E2E-06 add token by contract adds SHIB with a real balance', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await openAddToken(page);
  await page.getByLabel('Ethereum contract address').fill(SHIB);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Live verification: eth_getCode + name/symbol/decimals + balanceOf
  // on the pinned Ethereum RPC, plus the CoinGecko contract lookup.
  // It takes a few seconds; the 30 s test timeout covers it.
  await expect(page.getByText('Token added')).toBeVisible({ timeout: 20_000 });

  // Close the dialog and see the new row with its real zero balance.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: /SHIB/ }).first()).toBeVisible();
  await expect(
    page.getByText('Zero balance', { exact: true }).last(),
  ).toBeVisible();
});

test('E2E-06 a bad contract is rejected with an inline error', async ({ page }) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await openAddToken(page);
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
  await openAddToken(page);
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
