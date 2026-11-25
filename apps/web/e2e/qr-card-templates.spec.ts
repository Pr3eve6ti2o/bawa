// QR-cards programme, Lane E — the template picker switches the
// in-app card and the shared PNG between the four templates, and every
// template's PNG decodes to the same payment URI the on-screen QR
// encodes.
//
// Headless Chromium has no navigator.share, so Share takes the
// download fallback every time — which is exactly what this spec
// proves per template: the downloaded artifact is a genuine PNG whose
// QR payload is the payment URI. The phone-camera matrix (iOS +
// Android) cannot be done on the VM and stays unconfirmed; template A
// (inverted) is the one that must not ship on jsQR alone.
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';
import { decodePng } from './png-decode';

setupMaskedScreenshots();

const TEMPLATES = [
  { id: 'b', label: 'Paper' },
  { id: 'a', label: 'Dark Teal' },
  { id: 'e', label: 'Sun' },
  { id: 'f', label: 'Ink' },
  { id: 'g', label: 'Ticket' },
  { id: 'c', label: 'Minimal' },
  { id: 'd', label: 'Poster' },
] as const;

test('QR-cards every template shares a PNG decoding to the payment URI', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Receive');
  // The chain buttons are named "Ethereum ETH" (no separator dot).
  await page.getByRole('button', { name: /Ethereum ETH/ }).click();
  // Item 20 stepped flow: the chain button lands on the token step;
  // the native coin opens the details step where the QR renders.
  await page.getByRole('button', { name: /Ethereum · ETH · Native coin/ }).click();

  // Ground truth: the payment URI the on-screen QR was rendered from,
  // read from the default (Paper) card before any switching.
  const qrTitle = page.locator('div.bg-paper svg title').first();
  await expect(qrTitle).toBeAttached({ timeout: 15_000 });
  const expectedUri = ((await qrTitle.textContent()) ?? '').trim();
  expect(expectedUri.startsWith('ethereum:0x')).toBe(true);

  // The card defaults to Paper (template B).
  const card = page.locator('[data-template]').first();
  await expect(card).toHaveAttribute('data-template', 'b');

  for (const template of TEMPLATES) {
    const pickerButton = page.getByRole('button', {
      name: `Show ${template.label} card style`,
    });
    await pickerButton.click();
    await expect(card).toHaveAttribute('data-template', template.id);
    await expect(pickerButton).toHaveAttribute('aria-pressed', 'true');

    const shareDownload = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const shared = await shareDownload;
    expect(shared.suggestedFilename()).toMatch(/\.png$/);
    await expect(page.getByRole('status')).toContainText('downloaded');
    const sharedPath = `test-results/qr-cards/${template.id}.png`;
    await shared.saveAs(sharedPath);

    const sharedBytes = await readFile(sharedPath);
    expect(sharedBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const sharedPixels = decodePng(sharedBytes);
    const sharedCode = jsQR(sharedPixels.data, sharedPixels.width, sharedPixels.height, {
      inversionAttempts: 'attemptBoth',
    });
    expect(sharedCode, `${template.label} PNG must decode as a QR code`).not.toBeNull();
    expect(sharedCode!.data).toBe(expectedUri);
  }

  // The card + picker at every viewport (browser-first check; the
  // screenshots are viewed by eye, not asserted on).
  await page.getByRole('button', { name: 'Show Paper card style' }).click();
  await expect(card).toHaveAttribute('data-template', 'b');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/qr-cards/receive-390.png' });
  await page.getByRole('button', { name: 'Show Dark Teal card style' }).click();
  await expect(card).toHaveAttribute('data-template', 'a');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/qr-cards/receive-390-a.png' });
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/qr-cards/receive-820.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/qr-cards/receive-1440.png' });
  await page.setViewportSize({ width: 1919, height: 1080 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/qr-cards/receive-1919.png' });
});
