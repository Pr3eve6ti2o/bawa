// Integrity pin for the Trust Wallet Core WASM binary (T47).
//
// The published @trustwallet/wallet-core@4.9.1 tarball (the repository's
// Phase 4 pin) contains dist/lib/wallet-core.wasm with this SHA-256.
// scripts/copy-wasm.mjs refuses to copy a binary whose hash differs, so a
// tampered or accidentally replaced file in node_modules cannot silently
// ship as the app's crypto engine. If the wallet-core version is ever
// bumped, update this hash from the new published tarball and record the
// source (registry tarball hash) in the change — never from a local build.
import { createHash } from 'node:crypto';

export const EXPECTED_WASM_SHA256 =
  '0d6385c019891181f916be4c4f4a1986fff1dcb0391ca2027e1247e8bc496cd5';

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function verifyWasmHash(data) {
  return sha256Hex(data) === EXPECTED_WASM_SHA256;
}
