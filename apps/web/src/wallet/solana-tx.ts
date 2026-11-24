// solana-tx.ts — minimal Solana legacy wire-transaction primitives.
//
// Lane C (token-verify programme, bundle-size gate): @solana/web3.js cost
// ~180 KB minified for the five names send.ts used (Keypair, PublicKey,
// SystemProgram, Transaction, TransactionInstruction), most of it
// CommonJS dependencies Rolldown cannot tree-shake (bn.js, buffer-layout,
// borsh, superstruct, jayson/uuid, rpc-websockets). This module implements
// exactly the wire format the wallet uses — a legacy transaction with one
// SystemProgram.transfer or the hand-built SPL instructions — on top of
// primitives already in the bundle (@noble/curves ed25519, the app's own
// base58 codecs). Nothing here broadcasts: it only builds and signs, the
// same as the web3.js path did.
//
// Byte-identity with the reference implementation is the contract, and it
// is checked, not assumed: send.test.ts constructs the same transactions
// with @solana/web3.js (kept as a devDependency, test-only) and asserts
// the serialised bytes are identical, and decodes this module's output
// with web3.js Transaction.from + verifySignatures + the SPL decoders.
// If this module ever drifts from the wire format, those tests fail.
//
// Wire format (legacy message, solana-labs/solana-web3.js message.ts):
//   message = header(3) || accountKeys || recentBlockhash(32) || instructions
//   header  = numRequiredSignatures || numReadonlySignedAccounts
//             || numReadonlyUnsignedAccounts
//   accountKeys = shortvec(count) || 32 bytes per key, ordered: fee payer
//             first, then signers, then writable non-signers, then readonly
//             non-signers; program ids appended last as readonly non-signers
//   instruction = programIdIndex(u8) || shortvec(keyCount) || key indices
//             (u8 each) || shortvec(dataLen) || data
//   serialised = shortvec(sigCount) || 64 bytes per signature || message
// shortvec is unsigned LEB128 (7 bits per byte, continuation bit set).

import { ed25519 } from '@noble/curves/ed25519';
import { decodeBase58, encodeBase58 } from '../engine/address-codecs';

/** A Solana account address: 32 raw bytes. */
export class SolPublicKey {
  private readonly bytes: Uint8Array;

  constructor(value: string | Uint8Array) {
    let bytes: Uint8Array | null;
    if (typeof value === 'string') {
      bytes = decodeBase58(value);
    } else {
      bytes = value;
    }
    if (bytes === null || bytes.length !== 32) {
      throw new Error('Invalid public key input');
    }
    this.bytes = new Uint8Array(bytes);
  }

  toBase58(): string {
    return encodeBase58(this.bytes);
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  equals(other: SolPublicKey): boolean {
    const a = this.bytes;
    const b = other.bytes;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
    return diff === 0;
  }
}

/** System program: the all-ones address (32 zero bytes). */
export const SOL_SYSTEM_PROGRAM_ID = new SolPublicKey(
  '11111111111111111111111111111111',
);
/** SPL Token program id (legacy token program). */
export const SOL_TOKEN_PROGRAM_ID = new SolPublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
/** Associated Token Program id (the program that owns ATAs). */
export const SOL_ASSOCIATED_TOKEN_PROGRAM_ID = new SolPublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export type SolInstructionKey = {
  pubkey: SolPublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

export type SolInstruction = {
  keys: SolInstructionKey[];
  programId: SolPublicKey;
  data: Uint8Array;
};

/** SystemProgram.transfer data: u32-LE instruction index 2, u64-LE lamports. */
export function solSystemTransferInstruction(
  from: SolPublicKey,
  to: SolPublicKey,
  lamports: bigint,
): SolInstruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  // Throws RangeError when lamports is outside u64, like the
  // web3.js layout encoder did — the caller maps it to invalid-input.
  view.setBigUint64(4, lamports, true);
  return {
    keys: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
    ],
    programId: SOL_SYSTEM_PROGRAM_ID,
    data,
  };
}

/** The ed25519 public key for a 32-byte seed (RFC 8032, same as Keypair.fromSeed). */
export function solKeypairPublicKey(seed: Uint8Array): SolPublicKey {
  if (seed.length !== 32) {
    throw new Error('Invalid seed length: expected 32 bytes');
  }
  return new SolPublicKey(ed25519.getPublicKey(seed));
}

function encodeShortvec(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid shortvec value');
  }
  const out: number[] = [];
  let remaining = value;
  for (;;) {
    const byte = remaining & 0x7f;
    remaining >>= 7;
    if (remaining === 0) {
      out.push(byte);
      break;
    }
    out.push(byte | 0x80);
  }
  return new Uint8Array(out);
}

function decodeShortvec(
  bytes: Uint8Array,
  offset: number,
): { value: number; nextOffset: number } {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  for (let i = 0; i < 3; i++) {
    if (cursor >= bytes.length) {
      throw new Error('Invalid shortvec: unexpected end of input');
    }
    const byte = bytes[cursor]!;
    cursor += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, nextOffset: cursor };
    shift += 7;
  }
  throw new Error('Invalid shortvec: too many bytes');
}

type SolAccountMeta = {
  pubkey: SolPublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

type SolCompiledMessage = {
  bytes: Uint8Array;
  accountKeys: SolPublicKey[];
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
};

/**
 * Compile the legacy message for a fee payer, blockhash and instruction
 * list, with the web3.js account ordering: the fee payer first, then
 * signers, then writable non-signers, then readonly non-signers (stable
 * within each rank, first-seen order); program ids appended last as
 * readonly non-signers.
 */
export function solCompileMessage(
  feePayer: SolPublicKey,
  recentBlockhash: string,
  instructions: SolInstruction[],
): SolCompiledMessage {
  const blockhashBytes = decodeBase58(recentBlockhash);
  if (blockhashBytes === null || blockhashBytes.length !== 32) {
    throw new Error('Invalid blockhash: expected 32 base58 bytes');
  }
  // web3.js Transaction.compileMessage, step for step: the instruction
  // keys in order, then the program ids appended as readonly
  // non-signers, deduped with OR-merged flags, sorted signer first,
  // then writable, then base58 stringwise, and the fee payer moved to
  // the front (forced signer+writable). The base58 tiebreak is
  // load-bearing: two writable ATAs sort by their base58, not by
  // insertion order — a stable sort returning 0 here serialises an SPL
  // transfer with the accounts swapped, which is a different message
  // and a different signature.
  const metas: SolAccountMeta[] = [];
  const findMeta = (pubkey: SolPublicKey): SolAccountMeta | undefined =>
    metas.find((meta) => meta.pubkey.equals(pubkey));
  const addMeta = (meta: SolAccountMeta): void => {
    const existing = findMeta(meta.pubkey);
    if (existing) {
      existing.isSigner = existing.isSigner || meta.isSigner;
      existing.isWritable = existing.isWritable || meta.isWritable;
    } else {
      metas.push({ ...meta });
    }
  };
  for (const instruction of instructions) {
    for (const key of instruction.keys) {
      addMeta(key);
    }
  }
  for (const instruction of instructions) {
    addMeta({
      pubkey: instruction.programId,
      isSigner: false,
      isWritable: false,
    });
  }
  metas.sort((a, b) => {
    if (a.isSigner !== b.isSigner) return a.isSigner ? -1 : 1;
    if (a.isWritable !== b.isWritable) return a.isWritable ? -1 : 1;
    // Otherwise, sort by pubkey, stringwise.
    return a.pubkey.toBase58().localeCompare(b.pubkey.toBase58(), 'en', {
      localeMatcher: 'best fit',
      usage: 'sort',
      sensitivity: 'variant',
      ignorePunctuation: false,
      numeric: false,
      caseFirst: 'lower',
    });
  });
  // Move the fee payer to the front.
  const feePayerIndex = metas.findIndex((meta) =>
    meta.pubkey.equals(feePayer),
  );
  if (feePayerIndex > -1) {
    const payerMeta = metas[feePayerIndex]!;
    metas.splice(feePayerIndex, 1);
    payerMeta.isSigner = true;
    payerMeta.isWritable = true;
    metas.unshift(payerMeta);
  } else {
    metas.unshift({ pubkey: feePayer, isSigner: true, isWritable: true });
  }
  const accountKeys = metas.map((meta) => meta.pubkey);
  const numRequiredSignatures = metas.filter((meta) => meta.isSigner).length;
  const numReadonlySignedAccounts = metas.filter(
    (meta) => meta.isSigner && !meta.isWritable,
  ).length;
  const numReadonlyUnsignedAccounts =
    accountKeys.length -
    metas.filter((meta) => !meta.isSigner && meta.isWritable).length -
    numRequiredSignatures;
  const header = new Uint8Array([
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts,
  ]);
  const keyBytes = concat(accountKeys.map((key) => key.toBytes()));
  const instructionParts: Uint8Array[] = [];
  for (const instruction of instructions) {
    const programIdIndex = accountKeys.findIndex((key) =>
      key.equals(instruction.programId),
    );
    const accountIndices = instruction.keys.map((key) =>
      accountKeys.findIndex((account) => account.equals(key.pubkey)),
    );
    instructionParts.push(
      concat([
        new Uint8Array([programIdIndex]),
        encodeShortvec(accountIndices.length),
        new Uint8Array(accountIndices),
        encodeShortvec(instruction.data.length),
        instruction.data,
      ]),
    );
  }
  const bytes = concat([
    header,
    encodeShortvec(accountKeys.length),
    keyBytes,
    blockhashBytes,
    encodeShortvec(instructions.length),
    ...instructionParts,
  ]);
  return {
    bytes,
    accountKeys,
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts,
  };
}

/**
 * A legacy Solana transaction: fee payer + recent blockhash + instructions,
 * signed with a 32-byte ed25519 seed. Mirrors the web3.js Transaction
 * surface send.ts used (constructor, add, sign, serialize, from,
 * verifySignatures, feePayer, recentBlockhash, signature) and nothing more.
 */
export class SolTransaction {
  readonly feePayer: SolPublicKey;
  readonly recentBlockhash: string;
  readonly instructions: SolInstruction[];
  private signatures: (Uint8Array | null)[];

  constructor(options: {
    feePayer: SolPublicKey;
    recentBlockhash: string;
    instructions?: SolInstruction[];
    signatures?: (Uint8Array | null)[];
  }) {
    this.feePayer = options.feePayer;
    this.recentBlockhash = options.recentBlockhash;
    this.instructions = options.instructions ? [...options.instructions] : [];
    this.signatures = options.signatures ? [...options.signatures] : [];
  }

  add(instruction: SolInstruction): this {
    this.instructions.push(instruction);
    return this;
  }

  /** Compile the unsigned message bytes. */
  compileMessage(): SolCompiledMessage {
    return solCompileMessage(
      this.feePayer,
      this.recentBlockhash,
      this.instructions,
    );
  }

  /**
   * Sign the compiled message with the 32-byte ed25519 seed. The seed's
   * public key must be one of the required signers (in this wallet it is
   * always the fee payer); a key that is not a signer throws, like a
   * web3.js sign with an unrelated keypair.
   */
  sign(seed: Uint8Array): void {
    if (seed.length !== 32) {
      throw new Error('Invalid seed length: expected 32 bytes');
    }
    const compiled = this.compileMessage();
    const publicKey = solKeypairPublicKey(seed);
    const signerIndex = compiled.accountKeys
      .slice(0, compiled.numRequiredSignatures)
      .findIndex((key) => key.equals(publicKey));
    if (signerIndex < 0) {
      throw new Error('Signing key is not a required signer');
    }
    const signature = ed25519.sign(compiled.bytes, seed);
    this.signatures = new Array<Uint8Array | null>(
      compiled.numRequiredSignatures,
    ).fill(null);
    this.signatures[signerIndex] = signature;
  }

  /** The fee payer's signature (the transaction id), or null when unsigned. */
  get signature(): Uint8Array | null {
    return this.signatures[0] ?? null;
  }

  /**
   * Serialise the signed transaction. Throws when a required signature is
   * missing, like web3.js serialize with requireAllSignatures.
   */
  serialize(): Uint8Array {
    const compiled = this.compileMessage();
    if (
      this.signatures.length !== compiled.numRequiredSignatures ||
      this.signatures.some((signature) => signature === null)
    ) {
      throw new Error('Transaction has not been signed');
    }
    return concat([
      encodeShortvec(this.signatures.length),
      ...this.signatures.map((signature) => signature!),
      compiled.bytes,
    ]);
  }

  /** True when every required signature is present and verifies. */
  verifySignatures(): boolean {
    const compiled = this.compileMessage();
    if (this.signatures.length !== compiled.numRequiredSignatures) {
      return false;
    }
    for (let i = 0; i < compiled.numRequiredSignatures; i++) {
      const signature = this.signatures[i];
      if (signature === null || signature === undefined) return false;
      const publicKey = compiled.accountKeys[i]!;
      if (!ed25519.verify(signature, compiled.bytes, publicKey.toBytes())) {
        return false;
      }
    }
    return true;
  }

  /**
   * Parse serialised bytes back, reconstructing instructions with the
   * signer/writable flags the header implies (the web3.js from() shape).
   */
  static from(bytes: Uint8Array): SolTransaction {
    const { value: signatureCount, nextOffset: afterSigs } = decodeShortvec(
      bytes,
      0,
    );
    let cursor = afterSigs;
    const signatures: (Uint8Array | null)[] = [];
    for (let i = 0; i < signatureCount; i++) {
      if (cursor + 64 > bytes.length) {
        throw new Error('Invalid transaction: truncated signature');
      }
      signatures.push(new Uint8Array(bytes.slice(cursor, cursor + 64)));
      cursor += 64;
    }
    if (cursor + 3 > bytes.length) {
      throw new Error('Invalid transaction: truncated header');
    }
    const numRequiredSignatures = bytes[cursor]!;
    const numReadonlySignedAccounts = bytes[cursor + 1]!;
    const numReadonlyUnsignedAccounts = bytes[cursor + 2]!;
    cursor += 3;
    const keyCount = decodeShortvec(bytes, cursor);
    cursor = keyCount.nextOffset;
    const accountKeys: SolPublicKey[] = [];
    for (let i = 0; i < keyCount.value; i++) {
      if (cursor + 32 > bytes.length) {
        throw new Error('Invalid transaction: truncated account key');
      }
      accountKeys.push(new SolPublicKey(bytes.slice(cursor, cursor + 32)));
      cursor += 32;
    }
    if (cursor + 32 > bytes.length) {
      throw new Error('Invalid transaction: truncated blockhash');
    }
    const recentBlockhash = encodeBase58(bytes.slice(cursor, cursor + 32));
    cursor += 32;
    const instructionCount = decodeShortvec(bytes, cursor);
    cursor = instructionCount.nextOffset;
    const instructions: SolInstruction[] = [];
    for (let i = 0; i < instructionCount.value; i++) {
      if (cursor >= bytes.length) {
        throw new Error('Invalid transaction: truncated instruction');
      }
      const programIdIndex = bytes[cursor]!;
      cursor += 1;
      if (programIdIndex >= accountKeys.length) {
        throw new Error('Invalid transaction: bad program id index');
      }
      const accountCount = decodeShortvec(bytes, cursor);
      cursor = accountCount.nextOffset;
      const keys: SolInstructionKey[] = [];
      for (let j = 0; j < accountCount.value; j++) {
        if (cursor >= bytes.length) {
          throw new Error('Invalid transaction: truncated instruction key');
        }
        const index = bytes[cursor]!;
        cursor += 1;
        if (index >= accountKeys.length) {
          throw new Error('Invalid transaction: bad account index');
        }
        keys.push({
          pubkey: accountKeys[index]!,
          isSigner: index < numRequiredSignatures,
          isWritable:
            index < numRequiredSignatures - numReadonlySignedAccounts ||
            (index >= numRequiredSignatures &&
              index < accountKeys.length - numReadonlyUnsignedAccounts),
        });
      }
      const dataLength = decodeShortvec(bytes, cursor);
      cursor = dataLength.nextOffset;
      if (cursor + dataLength.value > bytes.length) {
        throw new Error('Invalid transaction: truncated instruction data');
      }
      const data = new Uint8Array(
        bytes.slice(cursor, cursor + dataLength.value),
      );
      cursor += dataLength.value;
      instructions.push({
        keys,
        programId: accountKeys[programIdIndex]!,
        data,
      });
    }
    return new SolTransaction({
      feePayer: accountKeys[0]!,
      recentBlockhash,
      instructions,
      signatures,
    });
  }
}
