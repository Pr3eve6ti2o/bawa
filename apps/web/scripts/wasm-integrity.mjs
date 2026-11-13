// Integrity pin for the Trust Wallet Core WASM binary (T47).
//
// The published @trustwallet/wallet-core@4.9.3 tarball (the repository's
// Phase 4 pin) contains dist/lib/wallet-core.wasm with this SHA-256.
// scripts/copy-wasm.mjs refuses to copy a binary whose hash differs, so a
// tampered or accidentally replaced file in node_modules cannot silently
// ship as the app's crypto engine. If the wallet-core version is ever
// bumped, update this hash from the new published tarball and record the
// source (registry tarball hash) in the change — never from a local build.
import { createHash } from 'node:crypto';

export const EXPECTED_WASM_SHA256 =
  '13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217';

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function verifyWasmHash(data) {
  return sha256Hex(data) === EXPECTED_WASM_SHA256;
}
