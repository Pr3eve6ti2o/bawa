// Lane 1 (2026-11-28) — CAKE add-by-contract on BSC through the third
// RPC endpoint.
//
// The sandbox failure: BSC's first two endpoints (PublicNode,
// Binance dataseed) 429 the shared egress, so Add Token by contract
// failed with "Could not read this token". The fix adds DeFiBit's
// dataseed (https://bsc-dataseed1.defibit.io, probed live from
// loud-stone: eth_blockNumber + eth_getCode + eth_call name/symbol/
// decimals on CAKE, 9-76 ms, CORS open) as the third registry
// endpoint. This spec reproduces the failure mode in the browser by
// aborting the first two endpoints at the network layer, then adds
// CAKE (0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82) by contract and
// proves it resolves with its real on-chain metadata — name
// "PancakeSwap Token", symbol "Cake", decimals 18 — via the fallback.
import { expect, test, type Page } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

const CAKE = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
const BSC_PRIMARY = '**bsc-rpc.publicnode.com**';
const BSC_BACKUP = '**bsc-dataseed.binance.org**';
const BSC_FALLBACK_HOST = 'bsc-dataseed1.defibit.io';

interface StoredToken {
  chain: string;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  coingeckoId: string | null;
}

async function customTokens(page: Page): Promise<StoredToken[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('bawa:custom-tokens:v1');
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('tokens' in parsed) ||
      !Array.isArray((parsed as { tokens: unknown }).tokens)
    ) {
      return [];
    }
    return (parsed as { tokens: StoredToken[] }).tokens;
  });
}

async function openAddToken(page: Page): Promise<void> {
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

test('Lane 1 — CAKE adds by contract on BSC when the first two RPCs are down', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await createTestWallet(page);

  // Reproduce the sandbox failure mode: the first two BSC endpoints
  // are dead at the network layer, so only the DeFiBit fallback can
  // answer the contract read.
  await page.route(BSC_PRIMARY, (route) => route.abort());
  await page.route(BSC_BACKUP, (route) => route.abort());

  const requestedHosts: string[] = [];
  page.on('request', (request) => {
    requestedHosts.push(new URL(request.url()).host);
  });

  await gotoInApp(page, 'Assets');
  await openAddToken(page);

  // Pick BNB Smart Chain in the shared chain picker.
  await page.getByPlaceholder('Search chains…').fill('BNB Smart Chain');
  await page
    .getByRole('option', { name: /BNB Smart Chain/ })
    .first()
    .click();
  await expect(
    page.getByLabel('BNB Smart Chain contract address'),
  ).toBeVisible();

  await page.getByLabel('BNB Smart Chain contract address').fill(CAKE);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Live verification through the fallback: eth_getCode +
  // name/symbol/decimals + balanceOf, plus the CoinGecko contract
  // lookup for the verified-mark path.
  await expect(page.getByText('Token added')).toBeVisible({ timeout: 120_000 });

  // The fallback actually answered: the token read went to DeFiBit.
  expect(requestedHosts).toContain(BSC_FALLBACK_HOST);

  // The stored token carries the real on-chain metadata — never a
  // fixture, never hard-coded Cake data.
  const added = (await customTokens(page)).find(
    (token) => token.contract.toLowerCase() === CAKE.toLowerCase(),
  );
  expect(added).toMatchObject({
    chain: 'bsc',
    name: 'PancakeSwap Token',
    symbol: 'Cake',
    decimals: 18,
  });

  await page.screenshot({ path: 'test-results/lane1/cake-add-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane1/cake-add-390.png' });

  // Close the dialog and see the new row with its real zero balance.
  await page.keyboard.press('Escape');
  const cakeRow = page.getByRole('link', { name: /PancakeSwap Token/ }).first();
  await expect(cakeRow).toBeVisible({ timeout: 30_000 });
  await page.setViewportSize({ width: 1280, height: 800 });
  await cakeRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane1/cake-row-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await cakeRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane1/cake-row-390.png' });
});
