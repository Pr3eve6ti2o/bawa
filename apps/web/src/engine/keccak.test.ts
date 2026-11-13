import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { keccak256, keccak256Ascii } from './keccak';

function hexDigest(input: Uint8Array): string {
  return Buffer.from(keccak256(input)).toString('hex');
}

describe('keccak256', () => {
  it('hashes the empty input', () => {
    expect(hexDigest(new Uint8Array(0))).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
  });

  it('hashes ASCII "hello world"', () => {
    // Compare as hex: vitest toEqual distinguishes Uint8Array from
    // Buffer even when the bytes match.
    expect(hexDigest(new TextEncoder().encode('hello world'))).toBe(
      '47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad',
    );
  });

  it('hashes the EIP-55 canary ASCII string', () => {
    expect(
      Buffer.from(
        keccak256Ascii('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
      ).toString('hex'),
    ).toBe(
      'd385650ce8fdc6db7ee3a091d34814dbc4ce18219ffae52182efff4034d707e5',
    );
  });

  it('always returns 32 bytes', () => {
    for (const input of [
      new Uint8Array(0),
      new Uint8Array([0]),
      new TextEncoder().encode('hello world'),
    ]) {
      expect(keccak256(input).length).toBe(32);
    }
  });

  it('is deterministic and input-sensitive', () => {
    const first = keccak256Ascii('hello world');
    const second = keccak256Ascii('hello world');
    const other = keccak256Ascii('hello worle');
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });

  it('keccak256Ascii matches keccak256 of the UTF-8 bytes', () => {
    const text = 'hello world';
    expect(keccak256Ascii(text)).toEqual(
      keccak256(new TextEncoder().encode(text)),
    );
  });
});
