// Lane 2 (2026-11-28) — TRON USDT dashboard balance through the
// PublicNode fallback.
//
// The sandbox failure: Trongrid's keyless tier 429s the shared egress
// IP on triggerconstantcontract, and the TRC-20 read had no fallback
// — TRON USDT went missing in 3/10 baseline runs while native TRX
// survived the same 429s via its PublicNode fallback. The fix sweeps
// the TRON token endpoints in order (Trongrid -> PublicNode) in
// token-balances.ts, so the metadata probe + balanceOf fall through
// to PublicNode's full node (probed live from loud-stone: POST
// /wallet/triggerconstantcontract 200 on both hosts, same balance
// 258880897 base units for USDT /
// TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5, decimals() 6, OPTIONS preflight
// 204 with access-control-allow-origin: *). TronScan cannot join the
// sweep: its API has no triggerconstantcontract (405, probed the same
// day).
//
// Why watch-only, not Add Token: USDT on TRON is a default token, so
// the Add Token flow answers "Already added" before any network read
// (seen first-hand: the dialog's alert reads "Already added"). The
// finding is the dashboard balance, so the spec watches the funded
// public address TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5 (USDT 258.880897,
// TRX 20032.755932541, probed live 2026-11-28) and proves the TRON
// USDT row still loads its real balance with api.trongrid.io aborted
// at the network layer. No vault, no keys, no funds moved.
import { expect, test, type Page } from '@playwright/test';
import { gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

const TRON_OWNER = 'TU3kjFuhtEo42tsCBtfYUAZxoqQ4yuSLQ5';
const TRONGRID = '**api.trongrid.io**';
const PUBLIC_NODE_HOST = 'tron-rpc.publicnode.com';

async function watchTronAddress(page: Page): Promise<void> {
  await page.goto('/import-wallet');
  await page.getByRole('tab', { name: 'Watch-only' }).click();
  await page.locator('#wallet-xpub').fill(TRON_OWNER);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Watch-only wallet added.')).toBeVisible({
    timeout: 30_000,
  });
}

async function tronUsdtRow(page: Page) {
  return page.getByRole('link', { name: /USDT · TRON/ }).first();
}

test('Lane 2 — TRON USDT balance loads via PublicNode when Trongrid is down', async ({
  page,
}) => {
  test.setTimeout(300_000);

  // Reproduce the sandbox failure mode before any navigation: every
  // Trongrid read (import validation, native balance, token balance)
  // is dead at the network layer, so only the PublicNode fallback
  // can answer the TRC-20 read.
  await page.route(TRONGRID, (route) => route.abort());

  const requestedHosts: string[] = [];
  page.on('request', (request) => {
    requestedHosts.push(new URL(request.url()).host);
  });

  await watchTronAddress(page);
  await gotoInApp(page, 'Home');

  // The TRON USDT row carries the real funded balance — never a
  // zero, never "Balance unavailable" — through the fallback.
  const usdtRow = await tronUsdtRow(page);
  await expect(usdtRow).toContainText('258.88', { timeout: 120_000 });

  // The fallback actually answered: a token read went to PublicNode.
  expect(requestedHosts).toContain(PUBLIC_NODE_HOST);

  await page.setViewportSize({ width: 1280, height: 800 });
  await usdtRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane2/usdt-row-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await usdtRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane2/usdt-row-390.png' });
});

test('Lane 2 — TRON USDT balance loads on the normal path (Trongrid up)', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await watchTronAddress(page);
  await gotoInApp(page, 'Home');

  const usdtRow = await tronUsdtRow(page);
  await expect(usdtRow).toContainText('258.88', { timeout: 120_000 });
});
