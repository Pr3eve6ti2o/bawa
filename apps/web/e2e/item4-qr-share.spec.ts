// UI/UX fixes, item 4 — sharing creates and shares the QR as a real
// PNG image, and the downloaded file decodes to the payment URI.
//
// Headless Chromium has no navigator.share, so the Share button takes
// the download fallback — which is exactly what this spec proves:
// the downloaded artifact is a genuine PNG whose QR payload is the
// same payment URI the on-screen QR encodes (read from the SVG's
// <title>, the value qrcode.react was given).
import { expect, test } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { createTestWallet, gotoInApp, setupMaskedScreenshots } from './helpers';

setupMaskedScreenshots();

/** Minimal PNG decoder: 8-bit, non-interlaced, colour types 0/2/6. */
function decodePng(buffer: Buffer): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('not a PNG file');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} unsupported`);
  const channels =
    colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (channels === 0) throw new Error(`colorType ${colorType} unsupported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos];
    pos += 1;
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const prev = y === 0 ? null : out.subarray((y - 1) * width * 4, y * width * 4);
    const recon = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? recon[i - channels] : 0;
      const b = prev ? prev[Math.floor(i / channels) * 4 + (i % channels)] : 0;
      const c =
        i >= channels && prev
          ? prev[Math.floor((i - channels) / channels) * 4 + ((i - channels) % channels)]
          : 0;
      const value = row[i];
      if (filter === 0) recon[i] = value;
      else if (filter === 1) recon[i] = (value + a) & 0xff;
      else if (filter === 2) recon[i] = (value + b) & 0xff;
      else if (filter === 3) recon[i] = (value + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        recon[i] = (value + predictor) & 0xff;
      } else {
        throw new Error(`filter ${filter} unsupported`);
      }
    }
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const src = x * channels;
      if (channels === 4) {
        out[dst] = recon[src];
        out[dst + 1] = recon[src + 1];
        out[dst + 2] = recon[src + 2];
        out[dst + 3] = recon[src + 3];
      } else if (channels === 3) {
        out[dst] = recon[src];
        out[dst + 1] = recon[src + 1];
        out[dst + 2] = recon[src + 2];
        out[dst + 3] = 255;
      } else {
        out[dst] = recon[src];
        out[dst + 1] = recon[src];
        out[dst + 2] = recon[src];
        out[dst + 3] = 255;
      }
    }
  }
  return { data: out, width, height };
}

test('E2E-04 shared/downloaded QR is a real PNG encoding the payment URI', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await createTestWallet(page);
  await gotoInApp(page, 'Receive');
  await page.getByRole('button', { name: /Ethereum · ETH/ }).click();

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

  // Download QR directly: same PNG, same payload.
  const directDownload = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Download QR' }).click();
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
