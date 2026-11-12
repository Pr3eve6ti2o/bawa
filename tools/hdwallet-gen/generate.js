// generate.js — Trust Wallet Core HD wallet generation for Bawa.
// Private material stays on the trusted interactive machine. Stdout contains
// only public material so it can be safely consumed by the parent orchestrator.
const { initWasm } = require("@trustwallet/wallet-core");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const VEC_MNEMONIC = "ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal";
const VEC = {
  btc: "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd",
  eth: "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7",
  ton: "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn",
};

function addrFromExtended(core, xpub, coin, derivationPath) {
  const pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, derivationPath);
  try {
    return core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } finally {
    pubkey.delete();
  }
}

// Verify a written seed bundle by decrypting it in-process and comparing the
// plaintext with the expected mnemonic. Returns false on any failure
// (malformed bundle, wrong AAD/key, tampered ciphertext) — never throws, and
// never prints the mnemonic or the key.
function verifySeedBundle(bundlePath, dataKey, expectedMnemonic) {
  try {
    const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    if (bundle.alg !== "AES-256-GCM") return false;
    const nonce = Buffer.from(bundle.nonce_b64, "base64");
    const ciphertext = Buffer.from(bundle.ciphertext_b64, "base64");
    if (nonce.length !== 12 || ciphertext.length < 16) return false;
    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, nonce);
    decipher.setAAD(Buffer.from("nova-shop-seed-v1", "utf8"));
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const body = ciphertext.subarray(0, ciphertext.length - 16);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(body), decipher.final()]);
    return (
      plain.length === Buffer.byteLength(expectedMnemonic, "utf8") &&
      crypto.timingSafeEqual(plain, Buffer.from(expectedMnemonic, "utf8"))
    );
  } catch {
    return false;
  }
}

// Resolve the secrets directory. Canonical name BAWA_SECRETS_DIR;
// NOVA_SECRETS_DIR is accepted during the one-release compatibility
// window with a deprecation warning. Both names set to different values
// refuses to run; neither set uses the default. Diagnostics name
// variables only, never values.
function resolveSecretsDir(env = process.env) {
  const value = (name) => {
    const v = env[name];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const expand = (p) => {
    if (p === "~") return os.homedir();
    if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
    return p;
  };
  const fresh = value("BAWA_SECRETS_DIR");
  const legacy = value("NOVA_SECRETS_DIR");
  if (fresh !== undefined && legacy !== undefined) {
    if (expand(fresh) !== expand(legacy)) {
      throw new Error(
        "conflicting secrets directories: BAWA_SECRETS_DIR and " +
          "NOVA_SECRETS_DIR are both set to different values; set only one"
      );
    }
    console.error(
      "warning: NOVA_SECRETS_DIR is deprecated; use BAWA_SECRETS_DIR"
    );
    return expand(fresh);
  }
  if (fresh !== undefined) return expand(fresh);
  if (legacy !== undefined) {
    console.error(
      "warning: NOVA_SECRETS_DIR is deprecated; use BAWA_SECRETS_DIR"
    );
    return expand(legacy);
  }
  return path.join(__dirname, "..", "..", "secrets");
}

function acquirePublishLock(encPath) {
  const lockPath = encPath + ".lock";
  const deadline = Date.now() + 10000;
  const waitState = new Int32Array(new SharedArrayBuffer(4));
  let lockFd;

  for (;;) {
    try {
      lockFd = fs.openSync(lockPath, "wx", 0o600);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }

    let live = false;
    try {
      const pidText = fs.readFileSync(lockPath, "utf8").trim();
      const pid = Number(pidText);
      if (/^\d+$/.test(pidText) && Number.isSafeInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          live = true;
        } catch (killErr) {
          // EPERM means the process exists but belongs to another
          // user: the lock is live and must NOT be stolen. Any other
          // probe failure (ESRCH = dead PID) permits reclamation.
          if (killErr.code === "EPERM") live = true;
        }
      }
    } catch (_) {
      // An unreadable lock or unsuccessful PID probe permits reclamation.
    }

    if (!live) {
      try {
        fs.unlinkSync(lockPath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          throw err;
        }
      }

      // Retry exclusive creation exactly once after reclaiming the lock.
      lockFd = fs.openSync(lockPath, "wx", 0o600);
      break;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("seed bundle publish already in progress for " + encPath);
    }
    Atomics.wait(waitState, 0, 0, Math.min(100, remaining));
  }

  let lockFdNeedsClose = true;
  try {
    fs.writeFileSync(lockFd, String(process.pid));
    // Do not retry close if it throws; the fd may already be released.
    lockFdNeedsClose = false;
    fs.closeSync(lockFd);
  } catch (err) {
    if (lockFdNeedsClose) {
      try {
        fs.closeSync(lockFd);
      } catch (_) {
        // Preserve the original acquisition error.
      }
    }
    releasePublishLock(lockPath);
    throw err;
  }

  return lockPath;
}

function releasePublishLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch (_) {
    // Ignore ENOENT and all other cleanup errors; release must never throw.
  }
}

function publishSeedBundle({ encPath, tmpPath, force }) {
  if (!force) {
    try {
      fs.linkSync(tmpPath, encPath);
    } catch (err) {
      if (err.code === "EEXIST") {
        throw new Error("Refusing to overwrite existing seed.enc.json; pass --force to replace");
      }
      throw err;
    }
    fs.unlinkSync(tmpPath);
  } else {
    fs.renameSync(tmpPath, encPath);
  }
}

async function main() {
  let tty;
  try {
    tty = fs.openSync("/dev/tty", "w");
  } catch {
    console.error("FATAL: no controlling terminal — refusing to run; generate the wallet interactively");
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const secretsDir = resolveSecretsDir();
  const encPath = path.join(secretsDir, "seed.enc.json");

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
  // TON triple check (M-03): wallet-core 4.8.4 defaults (V4 R2, wallet ID
  // 698983191, subwallet 0) must reproduce the recorded fixture address.
  ok("vec_ton", v.getAddressForCoin(CoinType.ton) === VEC.ton);

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
  // Wiping this Buffer is best-effort: it does not erase the mnemonic or hex
  // data-key display strings (immutable JS strings, plus split()/toString()
  // copies). Secret-string copies stay at the confirmation minimum: one hex
  // display and one first-word comparison.
  // The wrapper may supply the data key (BAWA_DATA_KEY_HEX) so it can
  // independently verify the bundle afterwards; otherwise generate one.
  // A supplied key must be exactly 64 hex characters (32 bytes).
  const dataKey = (() => {
    const supplied = process.env.BAWA_DATA_KEY_HEX;
    if (supplied === undefined) return crypto.randomBytes(32);
    if (!/^[0-9a-fA-F]{64}$/.test(supplied)) {
      throw new Error(
        "BAWA_DATA_KEY_HEX must be exactly 64 hex characters (32 bytes)"
      );
    }
    return Buffer.from(supplied, "hex");
  })();
  try {
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

    const lockPath = acquirePublishLock(encPath);
    try {
      if (fs.existsSync(encPath)) {
        if (!force) {
          throw new Error("Refusing to overwrite existing seed.enc.json; pass --force to replace");
        }
        const backupPath = encPath + ".bak." + new Date().toISOString().replace(/[:.]/g, "-");
        fs.copyFileSync(encPath, backupPath, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(backupPath, 0o600);

        const backupFd = fs.openSync(backupPath, "r");
        try {
          fs.fsyncSync(backupFd);
        } finally {
          fs.closeSync(backupFd);
        }

        const backupDirFd = fs.openSync(secretsDir, "r");
        try {
          fs.fsyncSync(backupDirFd);
        } finally {
          fs.closeSync(backupDirFd);
        }
      }

    const tmpPath = encPath + ".tmp." + process.pid + "." + crypto.randomBytes(8).toString("hex");
    // Enter temp-file cleanup only after a successful exclusive open.
    const tmpFd = fs.openSync(tmpPath, "wx", 0o600);
    let tmpFdNeedsClose = true;
    try {
      fs.writeFileSync(tmpFd, JSON.stringify({
        alg: "AES-256-GCM",
        kdf: "none - random 256-bit data key (shown once at creation)",
        nonce_b64: nonce.toString("base64"),
        ciphertext_b64: Buffer.concat([encBody, cipher.getAuthTag()]).toString("base64"),
        created: "bawa/tools/hdwallet-gen/generate.js",
        aad: "nova-shop-seed-v1",
        note: "Decrypt with tools/decrypt_seed.py and the data key.",
      }, null, 2) + "\n");

      fs.fsyncSync(tmpFd);
      // Do not retry close if it throws; the fd may already be released.
      tmpFdNeedsClose = false;
      fs.closeSync(tmpFd);
      publishSeedBundle({ encPath, tmpPath, force });
    } catch (err) {
      if (tmpFdNeedsClose) {
        try {
          fs.closeSync(tmpFd);
        } catch {
          // Preserve the original failure.
        }
      }
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Cleanup is best-effort; preserve the original failure.
      }
      throw err;
    }

    const dirFd = fs.openSync(secretsDir, "r");
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);

    // Verify the written bundle by decrypting it in-process before the data key
    // is zeroed. A failed round-trip fails the run; the stdout JSON is not printed.
    if (!verifySeedBundle(encPath, dataKey, mnemonic)) {
      throw new Error("seed bundle verification failed");
    }
    checks.push({ name: "bundle_verified", ok: true });
    } finally {
      releasePublishLock(lockPath);
    }
  } finally {
    dataKey.fill(0);
  }

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
}

if (require.main === module) {
  main().catch(() => {
    console.error("FATAL: wallet generation failed — details redacted");
    process.exit(1);
  });
}

module.exports = { verifySeedBundle, resolveSecretsDir, acquirePublishLock, releasePublishLock, publishSeedBundle };
