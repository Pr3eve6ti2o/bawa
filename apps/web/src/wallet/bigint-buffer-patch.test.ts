import { describe, expect, it } from 'vitest';
import {
  toBigIntBE,
  toBigIntLE,
  toBufferBE,
  toBufferLE,
} from 'bigint-buffer';

// Lane D (token-verify): pins the vendored bigint-buffer 1.1.6 fork in
// packages/bigint-buffer. The fork removes the native C binding that
// GHSA-3gc7-fjrx-p6mg (buffer overflow in toBigIntLE) is about; the vectors
// below were recorded against the original 1.1.5 pure-JS implementation and
// must stay identical — any drift means the fork changed behaviour.
describe('bigint-buffer security fork (Lane D)', () => {
  it('decodes little-endian buffers exactly like the original 1.1.5 JS implementation', () => {
    expect(toBigIntLE(Buffer.alloc(0))).toBe(0n);
    expect(toBigIntLE(Buffer.from([0x01]))).toBe(1n);
    expect(toBigIntLE(Buffer.from([0x01, 0x00]))).toBe(1n);
    expect(toBigIntLE(Buffer.from('40420f0000000000', 'hex'))).toBe(1000000n);
    expect(toBigIntLE(Buffer.alloc(8, 0xff))).toBe(18446744073709551615n);
    // Short buffer: reads exactly the bytes present. The native binding
    // over-read past the end here (GHSA-3gc7-fjrx-p6mg).
    expect(toBigIntLE(Buffer.from([0xff, 0xff, 0xff]))).toBe(16777215n);
    expect(toBigIntLE(Buffer.from('40787d0100000000', 'hex'))).toBe(25000000n);
    expect(toBigIntLE(Buffer.alloc(16, 0xff))).toBe(
      340282366920938463463374607431768211455n,
    );
  });

  it('decodes big-endian buffers', () => {
    expect(toBigIntBE(Buffer.from([0x01, 0x00]))).toBe(256n);
    expect(toBigIntBE(Buffer.from('00000000000f4240', 'hex'))).toBe(1000000n);
    expect(toBigIntBE(Buffer.alloc(8, 0xff))).toBe(18446744073709551615n);
  });

  it('encodes to fixed-width buffers and round-trips', () => {
    expect(toBufferLE(1000000n, 8).toString('hex')).toBe('40420f0000000000');
    expect(toBufferLE(0n, 8).toString('hex')).toBe('0000000000000000');
    expect(toBufferLE(18446744073709551615n, 8).toString('hex')).toBe(
      'ffffffffffffffff',
    );
    expect(toBufferLE(25000000n, 8).toString('hex')).toBe('40787d0100000000');
    expect(toBufferLE(340282366920938463463374607431768211455n, 16).toString('hex')).toBe(
      'ffffffffffffffffffffffffffffffff',
    );
    expect(toBufferBE(1000000n, 8).toString('hex')).toBe('00000000000f4240');
    expect(toBufferBE(18446744073709551615n, 8).toString('hex')).toBe(
      'ffffffffffffffff',
    );
    expect(toBufferBE(25000000n, 8).toString('hex')).toBe('00000000017d7840');
    for (const n of [0n, 1n, 1000000n, 25000000n, 18446744073709551615n]) {
      expect(toBigIntLE(toBufferLE(n, 8))).toBe(n);
      expect(toBigIntBE(toBufferBE(n, 8))).toBe(n);
    }
  });
});
