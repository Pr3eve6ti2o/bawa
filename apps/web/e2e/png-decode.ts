// Minimal PNG decoder for E2E specs that prove a downloaded file is a
// genuine PNG: 8-bit, non-interlaced, colour types 0/2/6.
// Extracted from e2e/item4-qr-share.spec.ts (QR-cards programme, Lane E,
// 2026-11-25) so the QR-card template spec reuses it instead of copying it.
import { inflateSync } from 'node:zlib';

/** Minimal PNG decoder: 8-bit, non-interlaced, colour types 0/2/6. */
export function decodePng(buffer: Buffer): {
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

