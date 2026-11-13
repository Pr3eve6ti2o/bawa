// Keccak-256 (the original Keccak padding, NOT NIST SHA3-256).
//
// Keccak-f[1600], 24 rounds, rate 1088 bits (136 bytes), capacity 512.
// Padding is pad10*1 with the Keccak suffix 0x01: append 0x01, zero bytes,
// then set the top bit of the final rate byte. SHA3-256 uses suffix 0x06;
// using it here would give wrong digests.
//
// This module exists only to verify EIP-55 address checksums (see
// destination.ts). It is pure and dependency-free: no I/O, no network,
// no secrets. Correctness is pinned by the published test vectors in
// keccak.test.ts (empty input, "hello world", and the EIP-55 canary
// ASCII string whose digest is d385650c...).

const MASK_64 = (1n << 64n) - 1n;
const RATE_BYTES = 136;
const DIGEST_BYTES = 32;

// Keccak-f[1600] round constants, from the Keccak specification.
const ROUND_CONSTANTS: readonly bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

// Rho rotation offsets, indexed [x][y], from the Keccak specification.
const ROTATION_OFFSETS: readonly (readonly number[])[] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function rotateLeft(value: bigint, shift: number): bigint {
  if (shift === 0) return value;
  const amount = BigInt(shift);
  return ((value << amount) | (value >> (64n - amount))) & MASK_64;
}

function keccakF1600(state: BigUint64Array): void {
  for (let round = 0; round < 24; round++) {
    // Theta.
    const columnParity = new BigUint64Array(5);
    for (let x = 0; x < 5; x++) {
      columnParity[x] =
        state[x]! ^
        state[x + 5]! ^
        state[x + 10]! ^
        state[x + 15]! ^
        state[x + 20]!;
    }
    for (let x = 0; x < 5; x++) {
      const d =
        columnParity[(x + 4) % 5]! ^
        rotateLeft(columnParity[(x + 1) % 5]!, 1);
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y]! ^= d;
      }
    }

    // Rho and Pi.
    const moved = new BigUint64Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const source = x + 5 * y;
        const target = y + 5 * ((2 * x + 3 * y) % 5);
        moved[target] = rotateLeft(
          state[source]!,
          ROTATION_OFFSETS[x]![y]!,
        );
      }
    }

    // Chi.
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const index = x + 5 * y;
        state[index] =
          moved[index]! ^
          ((~moved[((x + 1) % 5) + 5 * y]! & MASK_64) &
            moved[((x + 2) % 5) + 5 * y]!);
      }
    }

    // Iota.
    state[0]! ^= ROUND_CONSTANTS[round]!;
  }
}

function xorBlockIntoState(
  state: BigUint64Array,
  block: Uint8Array,
): void {
  for (let i = 0; i < block.length; i++) {
    const lane = Math.floor(i / 8);
    const shift = BigInt((i % 8) * 8);
    state[lane]! ^= BigInt(block[i]!) << shift;
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  const state = new BigUint64Array(25);
  let offset = 0;

  while (offset + RATE_BYTES <= data.length) {
    xorBlockIntoState(state, data.subarray(offset, offset + RATE_BYTES));
    keccakF1600(state);
    offset += RATE_BYTES;
  }

  // Final block: remaining bytes, then pad10*1 with suffix 0x01.
  const finalBlock = new Uint8Array(RATE_BYTES);
  finalBlock.set(data.subarray(offset));
  finalBlock[data.length - offset]! ^= 0x01;
  finalBlock[RATE_BYTES - 1]! ^= 0x80;
  xorBlockIntoState(state, finalBlock);
  keccakF1600(state);

  // Squeeze 32 bytes: the first four lanes, little-endian.
  const digest = new Uint8Array(DIGEST_BYTES);
  for (let lane = 0; lane < 4; lane++) {
    let value = state[lane]!;
    for (let i = 0; i < 8; i++) {
      digest[lane * 8 + i] = Number(value & 0xffn);
      value >>= 8n;
    }
  }
  return digest;
}

export function keccak256Ascii(text: string): Uint8Array {
  return keccak256(new TextEncoder().encode(text));
}
