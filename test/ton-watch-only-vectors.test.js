// ton-watch-only-vectors.test.js — TON watch-only derivation vectors (T17).
//
// Run standalone: node test/ton-watch-only-vectors.test.js
// (from the repo root, after `npm ci` in tools/hdwallet-gen).
// Public material only. Nothing here touches the network.
//
// What this pins: wallet-core 4.9.3 derives a TON address from a 32-byte
// Ed25519 PUBLIC KEY alone — no mnemonic, seed or private key. The fixed
// profile is Wallet V4 R2, wallet ID 698983191, workchain 0 (the repo's
// TON generation profile). This is a library-behaviour regression test;
// it does NOT test a watch-only CLI tool — no such tool exists yet (T18).
//
// Evidence (T17 lane, /home/boxd/workspace/bawa-fanout/T17/evidence/):
// - Fixture vector: published public key c8aeb00a…022d0c9 gives the repo's
//   TON deposit address UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn
//   (MAINNET-GUIDE §13.8; M-39 FINDINGS §0). Reproduced exactly by three
//   independent implementations: @ton/ton 16.3.0 (8/8 checks), tonweb
//   0.0.66 (3/3), wallet-core 4.8.4 (this file), and matched on-chain
//   (toncenter getAddressInformation: active, code hash, wallet ID and
//   public key all match, 2026-11-12).
// - Second valid key: keyPairFromSeed over fixed test seed bytes 00..1f
//   gives public key 03a107bf…5531b8 and address
//   UQDTcUOcJvwtMx4R6Vbb-uYCtJELCzAAvdD439fc2Y0UNpjM, agreed by
//   wallet-core 4.8.4 and @ton/ton 16.3.0 V4R2/698983191.
// - Invalid-point behaviour: a 32-byte string that is NOT a valid Ed25519
//   point (bytes 01..20) makes wallet-core return an EMPTY string. A tool
//   built on this MUST treat empty output as a hard failure, never as an
//   address.
// - TON has no xpub and no indexed address series: there is no TON
//   equivalent of the BTC/ETH/TRX /0/i derivation in derive.js.
//
// Any failure exits non-zero.
"use strict";

const path = require("node:path");

const TOOLS_DIR = path.join(__dirname, "..", "tools", "hdwallet-gen");
const { initWasm } = require(path.join(TOOLS_DIR, "node_modules", "@trustwallet", "wallet-core"));

// Fixed profile: V4R2, wallet ID 698983191, workchain 0.
const FIXTURE_PUBKEY_HEX = "c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9";
const FIXTURE_UQ = "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn";
const SECOND_PUBKEY_HEX = "03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8";
const SECOND_UQ = "UQDTcUOcJvwtMx4R6Vbb-uYCtJELCzAAvdD439fc2Y0UNpjM";
const INVALID_POINT_HEX = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log("ok - " + name);
  } else {
    failures++;
    console.log("FAIL - " + name + (detail ? " (" + detail + ")" : ""));
  }
}

(async () => {
  const core = await initWasm();
  const { CoinType, CoinTypeExt, PublicKey, PublicKeyType, AnyAddress } = core;

  function deriveUq(pubkeyHex) {
    const pubkey = PublicKey.createWithData(Buffer.from(pubkeyHex, "hex"), PublicKeyType.ed25519);
    try {
      return CoinTypeExt.deriveAddressFromPublicKey(CoinType.ton, pubkey);
    } finally {
      pubkey.delete();
    }
  }

  const fixture = deriveUq(FIXTURE_PUBKEY_HEX);
  check("fixture pubkey derives UQ address", fixture === FIXTURE_UQ, "got=" + fixture);
  check("fixture address validates", CoinTypeExt.validate(CoinType.ton, fixture) === true);

  const viaAnyAddress = (() => {
    const pubkey = PublicKey.createWithData(Buffer.from(FIXTURE_PUBKEY_HEX, "hex"), PublicKeyType.ed25519);
    try {
      return AnyAddress.createWithPublicKey(pubkey, CoinType.ton).description();
    } finally {
      pubkey.delete();
    }
  })();
  check("AnyAddress route agrees on fixture", viaAnyAddress === FIXTURE_UQ, "got=" + viaAnyAddress);

  const second = deriveUq(SECOND_PUBKEY_HEX);
  check("second valid pubkey derives UQ address", second === SECOND_UQ, "got=" + second);
  check("second address validates", CoinTypeExt.validate(CoinType.ton, second) === true);

  const invalid = deriveUq(INVALID_POINT_HEX);
  check("invalid Ed25519 point yields empty string (must fail loudly upstream)", invalid === "", "got=" + invalid);

  if (failures > 0) {
    console.log("TON WATCH-ONLY VECTOR TESTS FAILED: " + failures + " failure(s)");
    process.exit(1);
  }
  console.log("TON WATCH-ONLY VECTOR TESTS PASSED");
})().catch((e) => {
  console.log("TON WATCH-ONLY VECTOR TESTS FAILED: " + (e && e.message ? e.message : e));
  process.exit(1);
});
