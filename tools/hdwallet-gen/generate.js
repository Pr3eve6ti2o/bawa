// generate.js — Trust Wallet Core HD wallet generation for Bawa.
// Private material stays on the trusted interactive machine. Stdout contains
// only public material so it can be safely consumed by the parent orchestrator.
const { initWasm } = require("@trustwallet/wallet-core");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VEC_MNEMONIC = "ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal";
const VEC = {
  btc: "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd",
  eth: "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7",
};

function addrFromExtended(core, xpub, coin, derivationPath) {
  const pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, derivationPath);
  try {
    return core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } finally {
    pubkey.delete();
  }
}

(async () => {
  let tty;
  try {
    tty = fs.openSync("/dev/tty", "w");
  } catch {
    console.error("FATAL: no controlling terminal — refusing to run; generate the wallet interactively");
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const secretsDir = process.env.NOVA_SECRETS_DIR ||
    path.join(__dirname, "..", "..", "secrets");
  const encPath = path.join(secretsDir, "seed.enc.json");

  if (fs.existsSync(encPath)) {
    if (!force) {
      throw new Error("Refusing to overwrite existing seed.enc.json; pass --force to replace");
    }
    const backupPath = encPath + ".bak." + new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(encPath, backupPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backupPath, 0o600);
  }

  const core = await initWasm();
  const { HDWallet, CoinType, CoinTypeExt, Purpose, Derivation, HDVersion } = core;
  const checks = [];
  const ok = (name, cond) => {
    checks.push({ name, ok: !!cond });
    if (!cond) throw new Error("CHECK FAILED: " + name);
  };

  ok("coin_tron_195", CoinType.tron.value === 195);
  ok("coin_ton_607", CoinType.ton.value === 607);

  // Public deterministic regression fixtures.
  const v = HDWallet.createWithMnemonic(VEC_MNEMONIC, "");
  ok("vec_btc", v.getAddressForCoin(CoinType.bitcoin) === VEC.btc);
  ok("vec_eth", v.getAddressForCoin(CoinType.ethereum) === VEC.eth);

  const vBtcZpub = v.getExtendedPublicKeyAccount(
    Purpose.bip84, CoinType.bitcoin, Derivation.bitcoinSegwit, HDVersion.zpub, 0
  );
  ok("vec_zpub_prefix", vBtcZpub.startsWith("zpub"));
  ok("vec_zpub_addr0",
    addrFromExtended(core, vBtcZpub, CoinType.bitcoin, "m/84'/0'/0'/0/0") === VEC.btc
  );
  ok("vec_zpub_addr1_valid",
    CoinTypeExt.validate(
      CoinType.bitcoin,
      addrFromExtended(core, vBtcZpub, CoinType.bitcoin, "m/84'/0'/0'/0/1")
    )
  );

  const vEthXpub = v.getExtendedPublicKeyAccount(
    Purpose.bip44, CoinType.ethereum, Derivation.default, HDVersion.xpub, 0
  );
  ok("vec_ethxpub_prefix", vEthXpub.startsWith("xpub"));
  ok("vec_ethxpub_addr0",
    addrFromExtended(core, vEthXpub, CoinType.ethereum, "m/44'/60'/0'/0/0") === VEC.eth
  );

  const vTrxXpub = v.getExtendedPublicKeyAccount(
    Purpose.bip44, CoinType.tron, Derivation.default, HDVersion.xpub, 0
  );
  ok("vec_trxxpub_prefix", vTrxXpub.startsWith("xpub"));
  ok("vec_trxxpub_addr0",
    addrFromExtended(core, vTrxXpub, CoinType.tron, "m/44'/195'/0'/0/0") ===
      v.getAddressForCoin(CoinType.tron)
  );
  ok("vec_trx_valid", CoinTypeExt.validate(CoinType.tron, v.getAddressForCoin(CoinType.tron)));
  v.delete();

  // Fresh 256-bit BIP-39 wallet. Bawa's application policy uses an empty
  // BIP-39 passphrase; changing that policy creates a different wallet.
  const w = HDWallet.create(256, "");
  const mnemonic = w.mnemonic();
  ok("mnemonic_24_words",
    mnemonic.trim().split(/\s+/).length === 24 && core.Mnemonic.isValid(mnemonic)
  );

  const btcZpub = w.getExtendedPublicKeyAccount(
    Purpose.bip84, CoinType.bitcoin, Derivation.bitcoinSegwit, HDVersion.zpub, 0
  );
  const ethXpub = w.getExtendedPublicKeyAccount(
    Purpose.bip44, CoinType.ethereum, Derivation.default, HDVersion.xpub, 0
  );
  const trxXpub = w.getExtendedPublicKeyAccount(
    Purpose.bip44, CoinType.tron, Derivation.default, HDVersion.xpub, 0
  );
  const tonAddress = w.getAddressForCoin(CoinType.ton);

  ok("btc_zpub_prefix", btcZpub.startsWith("zpub"));
  ok("eth_xpub_prefix", ethXpub.startsWith("xpub"));
  ok("trx_xpub_prefix", trxXpub.startsWith("xpub"));
  ok("ton_valid", CoinTypeExt.validate(CoinType.ton, tonAddress));

  ok("btc_roundtrip",
    addrFromExtended(core, btcZpub, CoinType.bitcoin, "m/84'/0'/0'/0/0") ===
      w.getAddressForCoin(CoinType.bitcoin)
  );
  ok("eth_roundtrip",
    addrFromExtended(core, ethXpub, CoinType.ethereum, "m/44'/60'/0'/0/0") ===
      w.getAddressForCoin(CoinType.ethereum)
  );
  ok("trx_roundtrip",
    addrFromExtended(core, trxXpub, CoinType.tron, "m/44'/195'/0'/0/0") ===
      w.getAddressForCoin(CoinType.tron)
  );

  const samples = {
    btc1: addrFromExtended(core, btcZpub, CoinType.bitcoin, "m/84'/0'/0'/0/1"),
    eth1: addrFromExtended(core, ethXpub, CoinType.ethereum, "m/44'/60'/0'/0/1"),
    trx1: addrFromExtended(core, trxXpub, CoinType.tron, "m/44'/195'/0'/0/1"),
  };
  w.delete();

  // Encrypt the recovery phrase in-process. Plaintext is only displayed on
  // the controlling terminal and is never emitted to stdout/stderr.
  fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(secretsDir, 0o700);
  const dataKey = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, nonce);
  cipher.setAAD(Buffer.from("nova-shop-seed-v1", "utf8"));
  const encBody = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);

  const show = (s) => fs.writeSync(tty, s);
  show("\n" + "=".repeat(64) + "\n");
  show("SEED PHRASE (24 words) — write down OFFLINE, never share:\n  " + mnemonic + "\n");
  show("=".repeat(64) + "\n");
  show("DATA KEY (hex) — save separately; never store it with the ciphertext:\n  " +
    dataKey.toString("hex") + "\n");
  show("=".repeat(64) + "\n");

  const ttyIn = fs.openSync("/dev/tty", "r");
  const readLine = (fd) => {
    let line = "";
    const buf = Buffer.alloc(1);
    while (true) {
      const n = fs.readSync(fd, buf, 0, 1, null);
      if (n === 0) throw new Error("unexpected EOF on /dev/tty");
      const ch = buf.toString("utf8", 0, n);
      if (ch === "\n") break;
      if (ch !== "\r") line += ch;
    }
    return line;
  };

  show("Type the first word of the seed phrase to confirm you wrote it down: ");
  if (readLine(ttyIn).trim() !== mnemonic.trim().split(/\s+/)[0]) {
    throw new Error("Seed phrase confirmation failed — not writing seed.enc.json");
  }
  show("Type SAVED to confirm you stored the data key: ");
  if (readLine(ttyIn).trim() !== "SAVED") {
    throw new Error("Data key confirmation failed — not writing seed.enc.json");
  }
  fs.closeSync(ttyIn);
  fs.closeSync(tty);

  const tmpPath = encPath + ".tmp";
  fs.rmSync(tmpPath, { force: true });
  fs.writeFileSync(tmpPath, JSON.stringify({
    alg: "AES-256-GCM",
    kdf: "none - random 256-bit data key (shown once at creation)",
    nonce_b64: nonce.toString("base64"),
    ciphertext_b64: Buffer.concat([encBody, cipher.getAuthTag()]).toString("base64"),
    created: "bawa/tools/hdwallet-gen/generate.js",
    aad: "nova-shop-seed-v1",
    note: "Decrypt with tools/decrypt_seed.py and the data key.",
  }, null, 2) + "\n", { mode: 0o600 });

  const tmpFd = fs.openSync(tmpPath, "r+");
  fs.fsyncSync(tmpFd);
  fs.closeSync(tmpFd);
  fs.renameSync(tmpPath, encPath);

  const dirFd = fs.openSync(secretsDir, "r");
  fs.fsyncSync(dirFd);
  fs.closeSync(dirFd);
  dataKey.fill(0);

  console.log(JSON.stringify({
    btc_zpub: btcZpub,
    eth_xpub: ethXpub,
    trx_xpub: trxXpub,
    ton_address: tonAddress,
    ton_path: CoinTypeExt.derivationPath(CoinType.ton),
    ton_note: "single address per wallet; no xpub exported",
    samples,
    checks,
    seed_encrypted_to: encPath,
    wallet_core_version: require("@trustwallet/wallet-core/package.json").version,
  }));
})().catch(() => {
  console.error("FATAL: wallet generation failed — details redacted");
  process.exit(1);
});
