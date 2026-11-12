// derive-ton.js — derive the single TON deposit address from an Ed25519
// public key only (watch-only). No mnemonic, seed, private key or xpub is
// involved: TON has no xpub, and the account path m/44'/607'/0' is fully
// hardened, so no child address can be derived from a public key — the
// result is the one Wallet V4 R2 address (workchain 0, wallet ID
// 698983191) for that public key. There is no index argument.
// Usage: echo "<64 hex chars>" | node derive-ton.js
// Input validation (exactly 64 hex chars, no 0x prefix) happens BEFORE
// WASM initialisation, so invalid input never reaches WASM. All stderr
// messages go through redact(), so input material is never echoed.
const { initWasm } = require("@trustwallet/wallet-core");
const { redact } = require("./extended-key");

const USAGE = "usage: echo <64 hex chars of an Ed25519 public key> | node derive-ton.js";

(async () => {
  if (process.argv.length !== 2) {
    console.error(USAGE);
    process.exit(2);
  }

  let hex = "";
  try {
    hex = (await new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => {
        data += c;
        if (data.length > 200) {
          reject(new Error("public key input too long"));
          process.stdin.destroy();
        }
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    })).trim();
  } catch (e) {
    console.error("failed to read public key from stdin: " + redact(e && e.message));
    process.exit(2);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    console.error("invalid TON public key: expected exactly 64 hex characters, no 0x prefix");
    process.exit(2);
  }

  const core = await initWasm();
  const coin = core.CoinType.ton;
  let pubkey;
  try {
    pubkey = core.PublicKey.createWithData(
      Buffer.from(hex, "hex"),
      core.PublicKeyType.ed25519
    );
  } catch (e) {
    console.error("invalid Ed25519 public key: " + redact(e && e.message));
    process.exit(1);
  }

  let addr;
  try {
    addr = core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } catch (e) {
    console.error("deriveAddressFromPublicKey failed: " + redact(e && e.message));
    process.exitCode = 1;
    return;
  } finally {
    pubkey.delete();
  }

  if (!addr || !core.CoinTypeExt.validate(coin, addr)) {
    console.error("derived address failed validation");
    process.exit(1);
  }
  console.log(addr);
})().catch((e) => { console.error("FATAL: " + redact(e && e.message)); process.exit(1); });
