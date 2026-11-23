// UI/UX fixes, item 13 — Add Token now offers every supported chain:
// SPL tokens on Solana (mint + Metaplex metadata + token accounts via
// the SOL RPC) and Jettons on TON (metadata + balance via TonAPI).
// Both add flows are proven live against the real networks with real
// canonical tokens — SPL USDT and Jetton NOT (Notcoin) — and the
// persisted record is read back from localStorage, so the name, symbol
// and decimals asserted here are the ones the network returned, not a
// fixture. SPL USDC and Jetton USDT were the original canonical tokens
// here, but item 18 made them defaults — Add Token correctly refuses
// them as 'Already added' — so this spec now uses the next canonical
// pair (USDT on Solana, NOT on TON), verified live 2026-11-23.
// BTC/LTC/DOGE stay unselectable: they have no token standard.
import { expect, test, type Page } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

// Canonical tokens, NOT defaults (item 18 made SPL USDC and Jetton
// USDT defaults, so Add Token correctly refuses them as 'Already
// added' — these two are the next canonical pair). The fresh test
// wallet holds 0 of each; every name, symbol and decimals below comes
// from a live network read.
// SPL USDT: mint verified live 2026-11-23 via Vibe Station —
// getAccountInfo decimals 6, owner Token program; Metaplex metadata
// name 'USDT' / symbol 'USDT' (the on-chain name is just 'USDT');
// CoinGecko contract endpoint id 'tether'.
// Jetton NOT (Notcoin): master verified live 2026-11-23 via TonAPI —
// metadata name 'Notcoin' / symbol 'NOT' / decimals 9; master address
// taken from the Ston.fi public assets list, confirmed by TonAPI.
const SOL_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const TON_NOT_MASTER = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';

interface StoredToken {
  chain: string;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
}

async function customTokens(page: Page): Promise<StoredToken[]> {
  // Stored as { version: 1, tokens: [...] } (see readCustomTokens).
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
  // The Assets page re-renders while its 43 rows settle, which can
  // detach the button between resolve and click; retry the open with
  // a freshly resolved locator until the dialog is visible.
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

test('E2E-13 add SPL token by mint adds USDT with real Metaplex metadata', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await openAddToken(page);
  await page.getByLabel('Chain').selectOption('sol');
  await page.getByLabel('Solana mint address').fill(SOL_USDT_MINT);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Live: getAccountInfo (mint + decimals) + getProgramAccounts
  // (Metaplex name/symbol) + getTokenAccountsByOwner (balance), over
  // the SOL endpoints with fallback to the next healthy endpoint.
  await expect(page.getByText('Token added')).toBeVisible({ timeout: 120_000 });

  const tokens = await customTokens(page);
  const added = tokens.find((token) => token.contract === SOL_USDT_MINT);
  expect(added).toMatchObject({
    chain: 'sol',
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
  });

  await page.screenshot({ path: 'test-results/lane-b/item13-spl-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item13-spl-390.png' });
});

test('E2E-13 add Jetton token by master adds NOT with real TonAPI metadata', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await openAddToken(page);
  await page.getByLabel('Chain').selectOption('ton');
  await page.getByLabel('TON Jetton master address').fill(TON_NOT_MASTER);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Live: TonAPI /v2/jettons/{master} (metadata) + /v2/accounts/
  // {owner}/jettons/{master} (balance).
  await expect(page.getByText('Token added')).toBeVisible({ timeout: 120_000 });

  const tokens = await customTokens(page);
  const added = tokens.find((token) => token.contract === TON_NOT_MASTER);
  expect(added).toMatchObject({
    chain: 'ton',
    name: 'Notcoin',
    symbol: 'NOT',
    decimals: 9,
  });

  await page.screenshot({ path: 'test-results/lane-b/item13-jetton-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item13-jetton-390.png' });
});

test('E2E-13 native-coin-only chains stay unselectable, SPL and Jetton are selectable', async ({
  page,
}) => {
  await createTestWallet(page);
  await gotoInApp(page, 'Assets');

  await openAddToken(page);
  const select = page.getByLabel('Chain');
  for (const value of ['btc', 'ltc', 'doge']) {
    const option = select.locator(`option[value="${value}"]`);
    await expect(option).toBeDisabled();
    await expect(option).toContainText('Native coin only');
  }
  await expect(select.locator('option[value="sol"]')).toBeEnabled();
  await expect(select.locator('option[value="ton"]')).toBeEnabled();
  // All nine new EVM chains are offered for ERC-20 as well.
  for (const value of [
    'gnosis',
    'celo',
    'linea',
    'mantle',
    'scroll',
    'opbnb',
    'metis',
    'aurora',
    'fantom',
  ]) {
    await expect(select.locator(`option[value="${value}"]`)).toBeEnabled();
  }
});
