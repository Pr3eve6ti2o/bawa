// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ReactElement } from 'react';
import {
  QrScanner,
  decodeQrImageData,
  decodeQrImageFile,
} from './qr-scanner';

// QR modules for the bare address 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
// (error correction M, version 3, 29 x 29), generated with the `qrcode`
// package. Stored as rows so the test needs no QR generator dependency.
const MODULE_ROWS = [
  '11111110110011110111101111111',
  '10000010001001010111101000001',
  '10111010010110000000101011101',
  '10111010100111101110001011101',
  '10111010101001100011101011101',
  '10000010101001001001101000001',
  '11111110101010101010101111111',
  '00000000101111110001000000000',
  '11101010111010001101111111001',
  '11000000001111110010001000010',
  '10011111010010111100111000101',
  '11100000101001001111000101111',
  '11011011110010000010010010111',
  '00101000110010100111100011001',
  '10010010010111101110111011010',
  '11111000001000100010001000100',
  '00010011111011011101101010000',
  '00100101010111001010001011011',
  '10100111110111001100101110110',
  '11110001100011101011111011010',
  '01001110010101111100111111111',
  '00000000111111000011100010001',
  '11111110000011110111101010110',
  '10000010001000010100100010111',
  '10111010110101010101111110101',
  '10111010010001110111001000010',
  '10111010111001110011110001011',
  '10000010111101101100111100100',
  '11111110100011111010100000110',
];

const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

function paintQrPixels(scale = 8, quietZone = 4): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const modules = MODULE_ROWS.length;
  const side = (modules + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const moduleX = Math.floor(x / scale) - quietZone;
      const moduleY = Math.floor(y / scale) - quietZone;
      const row =
        moduleY >= 0 && moduleY < modules ? MODULE_ROWS[moduleY] : undefined;
      const dark =
        row !== undefined &&
        moduleX >= 0 &&
        moduleX < modules &&
        row[moduleX] === '1';
      const offset = (y * side + x) * 4;
      const value = dark ? 0 : 255;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { data, width: side, height: side };
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type MountedEntry = {
  root: ReturnType<typeof createRoot>;
  div: HTMLDivElement;
  previous: boolean | undefined;
};

const mountedEntries: MountedEntry[] = [];

async function mount(node: ReactElement): Promise<HTMLDivElement> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previous = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  mountedEntries.push({ root, div, previous });
  await act(async () => {
    root.render(node);
  });
  return div;
}

afterEach(async () => {
  while (mountedEntries.length > 0) {
    const entry = mountedEntries.pop();
    if (!entry) break;
    try {
      await act(async () => {
        entry.root.unmount();
      });
    } finally {
      entry.div.remove();
      if (entry.previous === undefined) {
        delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
      } else {
        testGlobal.IS_REACT_ACT_ENVIRONMENT = entry.previous;
      }
    }
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('decodeQrImageData', () => {
  it('decodes a painted QR code to the bare address', () => {
    const { data, width, height } = paintQrPixels();
    expect(decodeQrImageData(data, width, height)).toBe(RECIPIENT);
  });

  it('returns null for a blank image', () => {
    const blank = new Uint8ClampedArray(200 * 200 * 4).fill(255);
    expect(decodeQrImageData(blank, 200, 200)).toBeNull();
  });
});

describe('QrScanner upload fallback', () => {
  it('shows the camera failure and the upload input when no camera exists', async () => {
    const container = await mount(
      <QrScanner onScan={() => undefined} onCancel={() => undefined} />,
    );
    expect(container.textContent).toContain(
      'Camera is not available in this browser.',
    );
    expect(
      container.querySelector('input[type="file"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('Upload a QR image');
  });

  it('reports an undecodable image instead of closing', async () => {
    // jsdom has no 2d canvas context, so any image decodes to null —
    // the path under test is the upload wiring and the message.
    vi.stubGlobal(
      'createImageBitmap',
      async () => ({ width: 10, height: 10, close: () => undefined }),
    );
    const onScan = vi.fn();
    const container = await mount(
      <QrScanner onScan={onScan} onCancel={() => undefined} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['not-an-image'], 'qr.png', {
      type: 'image/png',
    });
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain(
      'No QR code found in that image. Try another image.',
    );
    expect(onScan).not.toHaveBeenCalled();
  });

  it('decodeQrImageFile returns null when the bitmap cannot be drawn', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      async () => ({ width: 10, height: 10, close: () => undefined }),
    );
    const file = new File(['x'], 'qr.png', { type: 'image/png' });
    await expect(decodeQrImageFile(file)).resolves.toBeNull();
  });
});
