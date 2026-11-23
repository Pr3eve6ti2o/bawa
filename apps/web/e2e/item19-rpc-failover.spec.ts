// UI/UX fixes, item 19 — RPC backup/failover, proved live in the
// browser by killing the primary endpoint at the network layer.
//
// Two real defects were found and fixed while proving this (2026-11-23):
// (1) The app's own CSP connect-src allowlist did not include the new
//     backup origins — the browser refused those fetches before any
//     request was sent, so every backup silently failed. The fix added
//     all 24 missing origins (see security-headers.ts) plus a
//     drift-guard test that pins every registry origin in the CSP.
// (2) The first ETH backup, blastapi.io, is unreachable from this
//     browser even with the CSP fixed (still TypeError on every fetch,
//     plain GET included; intermittent 403 from curl) — so the ETH
//     backup is now https://1rpc.io/eth, which answers HTTP 200 from
//     this browser. Blast was dropped from the registry and the CSP.
//
// Proofs in this spec: ETH falls back to 1rpc, Solana falls back to
// Vibe Station, blocking both of a pair fails honestly while Bitcoin
// is unaffected, and the RPC manager adds/removes a custom RPC.
// Correction 2026-11-24 (FIX-ALL Lane A + merge lane): the ETH backup
// is now https://eth.drpc.org — 1rpc.io answers -32001 "usage limit"
// from this egress (twice). The assertions below now expect dRPC.
import { expect, test, type Page } from '@playwright/test';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

const SOL_PRIMARY = '**solana-rpc.publicnode.com**';
const SOL_BACKUP = '**public.rpc.solanavibestation.com**';
const ETH_PRIMARY = '**ethereum-rpc.publicnode.com**';
const ETH_BACKUP_HOST = 'eth.drpc.org';

// Asset rows show the display name first ("Solana", not "SOL") since
// Lane A item 12, with the symbol underneath. A settled row is a link
// to /assets/<chain>; a failed row is a plain <li> with no link — so
// rows are located inside the Assets region by the display name at the
// start of the row text. (The Popular-chains strip above the list also
// links to /assets/<chain>, so an unscoped href locator would measure
// the strip, not the row.)
const DISPLAY_NAMES: Record<string, string> = {
  SOL: 'Solana',
  ETH: 'Ethereum',
  BTC: 'Bitcoin',
};
function row(page: Page, symbol: string) {
  const name = DISPLAY_NAMES[symbol] ?? symbol;
  return page
    .getByRole('region', { name: 'Assets' })
    .locator('li', { hasText: new RegExp(`^${name}\\b`) })
    .first();
}

test('E2E-19 Solana falls back to the backup RPC', async ({ page }) => {
  test.setTimeout(300_000);
  await createTestWallet(page);

  const requestedHosts: string[] = [];
  page.on('request', (request) => {
    requestedHosts.push(new URL(request.url()).host);
  });
  await page.route(SOL_PRIMARY, (route) => route.abort());

  await gotoInApp(page, 'Home');
  await expect(row(page, 'SOL')).toContainText('Zero balance', {
    timeout: 90_000,
  });
  expect(requestedHosts).toContain('public.rpc.solanavibestation.com');

  await page.screenshot({ path: 'test-results/lane-b/item19-failover-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item19-failover-390.png' });
});

test('E2E-19 Solana fails honestly when both RPCs are down', async ({ page }) => {
  test.setTimeout(300_000);
  await createTestWallet(page);

  await page.route(SOL_PRIMARY, (route) => route.abort());
  await page.route(SOL_BACKUP, (route) => route.abort());

  await gotoInApp(page, 'Home');
  // A failed row shows the display name first ("Solana SOL Could
  // not load balance ..."), unlike a settled row, which starts
  // with the symbol — so the failed row is located by name.
  const solFailed = page
    .getByRole('region', { name: 'Assets' })
    .locator('li', { hasText: 'Solana' })
    .first();
  await expect(solFailed).toContainText(
    /Could not load balance|Balance unavailable|Unavailable/,
    { timeout: 120_000 },
  );

  // The failure is contained: Bitcoin (a different adapter, different
  // hosts) still settles to zero.
  await expect(row(page, 'BTC')).toContainText('Zero balance', {
    timeout: 90_000,
  });
});

test('E2E-19 Ethereum falls back to the backup RPC, and the RPC manager adds/removes one', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await createTestWallet(page);

  const requestedHosts: string[] = [];
  page.on('request', (request) => {
    requestedHosts.push(new URL(request.url()).host);
  });
  await page.route(ETH_PRIMARY, (route) => route.abort());

  await gotoInApp(page, 'Home');
  await expect(row(page, 'ETH')).toContainText('Zero balance', {
    timeout: 120_000,
  });
  // The balance came through the backup, not the dead primary.
  expect(requestedHosts).toContain(ETH_BACKUP_HOST);

  // The RPC manager: add a custom ETH endpoint, see it listed as
  // Custom, then remove it again.
  await gotoInApp(page, 'Networks');
  // The Chain label wraps its select, so the label's computed name
  // includes the option texts — select by the eth option instead.
  await page
    .locator('select', { has: page.locator('option[value="eth"]') })
    .first()
    .selectOption('eth');
  // Add a genuinely custom endpoint (blast is already ETH's registry
  // backup, so adding it would be dedupe-rejected): ankr is a valid
  // https URL that is not in the registry. The manager only stores and
  // lists it here — no network call is made to it.
  await page
    .getByLabel('Custom RPC URL')
    .fill('https://rpc.ankr.com/eth');
  await page.getByRole('button', { name: 'Add RPC' }).click();
  const customRow = page.locator('text=rpc.ankr.com').first();
  await expect(customRow).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText('Custom', { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove', exact: true })
    .last()
    .click();
  // The status message still names the host ("Removed rpc.ankr.com
  // from Ethereum."), so the removal is asserted on the Custom badge
  // disappearing, not on the host text vanishing.
  await expect(page.getByText('Removed rpc.ankr.com from Ethereum.')).toBeVisible();
  await expect(page.getByText('Custom', { exact: true })).toHaveCount(0);
});
