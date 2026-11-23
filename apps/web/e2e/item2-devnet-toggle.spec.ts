// UI/UX fixes, item 2 — the header pill toggles mainnet <-> devnet in
// place, and the wallet follows: addresses switch to the testnet
// derivations, token balances/prices go off in devnet, and toggling
// back restores mainnet with no mainnet leakage.
//
// Bitcoin is the discriminator: mainnet derives bc1q… (m/44'/0'),
// devnet testnet4 derives tb1q… (m/44'/1'). Ethereum cannot
// discriminate — its devnet address equals its mainnet address by
// design (same m/44'/60' path).
import { expect, test, type Page } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

async function btcAddress(page: Page): Promise<string> {
  // Full load: the Receive screen keeps its step in SPA state, so a
  // second visit would land on the details step with no chain button.
  // A reload resets the stepped flow to step 1; the vault auto-unlocks
  // and the devnet flag persists.
  await page.goto('/receive');
  await page.getByRole('button', { name: /Bitcoin · BTC/ }).click();
  // Item 20 stepped flow: the chain button lands on the token step;
  // the native coin opens the details step where the QR address shows.
  await page.getByRole('button', { name: /Bitcoin · BTC/ }).click();
  // The QR card shows the selected chain's address as a mono paragraph.
  const address = page.locator('p.font-mono', { hasText: /^(bc1q|tb1q)/ }).first();
  await expect(address).toBeVisible({ timeout: 15_000 });
  return (await address.innerText()).trim();
}

test('E2E-02 header pill toggles mainnet to devnet and back', async ({ page }) => {
  test.setTimeout(180_000);
  await createTestWallet(page);

  const mainnetAddress = await btcAddress(page);
  expect(mainnetAddress.startsWith('bc1q')).toBe(true);

  await page.getByRole('button', { name: 'Switch to devnet' }).click();
  await expect(
    page.getByRole('button', { name: 'Switch to mainnet' }),
  ).toBeVisible({ timeout: 15_000 });

  const devnetAddress = await btcAddress(page);
  expect(devnetAddress.startsWith('tb1q')).toBe(true);
  expect(devnetAddress).not.toBe(mainnetAddress);

  // Devnet mode says so on the dashboard, and token balances are off.
  await gotoInApp(page, 'Home');
  await expect(page.getByText('Devnet test mode')).toBeVisible();
  await page.screenshot({ path: 'test-results/lane-b/item2-devnet-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item2-devnet-390.png' });

  // Back to mainnet: the pill flips and the original address returns.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Switch to mainnet' }).click();
  await expect(
    page.getByRole('button', { name: 'Switch to devnet' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Devnet test mode')).toHaveCount(0);

  const restoredAddress = await btcAddress(page);
  expect(restoredAddress).toBe(mainnetAddress);
});
