// UI/UX fixes, item 4 — sharing creates and shares the QR as a real
// PNG image, and the downloaded file decodes to the payment URI.
//
// Headless Chromium has no navigator.share, so the Share button takes
// the download fallback — which is exactly what this spec proves:
// the downloaded artifact is a genuine PNG whose QR payload is the
// same payment URI the on-screen QR encodes (read from the SVG's
// <title>, the value qrcode.react was given).
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';
import { decodePng } from './png-decode';

setupMaskedScreenshots();

test('E2E-04 shared/downloaded QR is a real PNG encoding the payment URI', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Receive');
  // The chain buttons are named "Ethereum ETH" (no separator dot):
  // the earlier /Ethereum · ETH/ pattern never matched the rendered
  // accessible name and the spec timed out waiting for it.
  await page.getByRole('button', { name: /Ethereum ETH/ }).click();
  // Item 20 stepped flow: the chain button lands on the token step;
  // the native coin opens the details step where the QR renders.
  // The token-step button carries the dot: "Ethereum · ETH · Native coin".
  await page.getByRole('button', { name: /Ethereum · ETH · Native coin/ }).click();

  // Ground truth: the payment URI the on-screen QR was rendered from.
  const qrTitle = page.locator('div.bg-paper svg title').first();
  await expect(qrTitle).toBeAttached({ timeout: 15_000 });
  const expectedUri = ((await qrTitle.textContent()) ?? '').trim();
  expect(expectedUri.startsWith('ethereum:0x')).toBe(true);

  // Share in headless Chromium has no navigator.share, so it falls
  // back to downloading the PNG — and says so.
  const shareDownload = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const shared = await shareDownload;
  expect(shared.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByRole('status')).toContainText('downloaded');
  const sharedPath = `test-results/lane-b/${shared.suggestedFilename()}`;
  await shared.saveAs(sharedPath);

  const sharedBytes = await readFile(sharedPath);
  expect(sharedBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const sharedPixels = decodePng(sharedBytes);
  const sharedCode = jsQR(sharedPixels.data, sharedPixels.width, sharedPixels.height);
  expect(sharedCode, 'shared PNG must decode as a QR code').not.toBeNull();
  expect(sharedCode!.data).toBe(expectedUri);

  // Download QR directly: same PNG, same payload. The button is
  // named "Download card" — the earlier 'Download QR' name never
  // matched and the click timed out waiting for it.
  const directDownload = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Download card' }).click();
  const direct = await directDownload;
  expect(direct.suggestedFilename()).toMatch(/\.png$/);
  const directPath = `test-results/lane-b/${direct.suggestedFilename()}`;
  await direct.saveAs(directPath);
  const directPixels = decodePng(await readFile(directPath));
  const directCode = jsQR(directPixels.data, directPixels.width, directPixels.height);
  expect(directCode, 'downloaded PNG must decode as a QR code').not.toBeNull();
  expect(directCode!.data).toBe(expectedUri);

  await page.screenshot({ path: 'test-results/lane-b/item4-receive-1919.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lane-b/item4-receive-390.png' });
});
