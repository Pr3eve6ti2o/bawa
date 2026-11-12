// T08 diagram-reference regression test — Doc 4 §13.0.
// Guards the corrected diagram's traced claims: every in-repo path it cites
// must exist, every validation-draft path it marks NOT IN REPO must stay
// absent, and the Send-disabled / gated-signing facts it states must hold:
// the only signing code is a local, test-only signer restricted to temporary
// unfunded test credentials, and broadcast is not implemented.
// Run: node tests/diagram-references.test.mjs (Node >=22 <23).
// No network, no secrets, no private material.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUIDE = path.join(ROOT, "docs", "mainnet", "MAINNET-GUIDE.md");

// In-repo files the §13.0 diagram cites. If any is moved or deleted, the
// diagram is stale and this test fails on purpose.
const IN_REPO = [
  "tools/make_wallet.py",
  "tools/decrypt_seed.py",
  "tools/hdwallet-gen/derive.js",
  "tools/hdwallet-gen/compare.js",
  "tools/hdwallet-gen/derive_daemon.js",
  "tools/hdwallet-gen/extended-key.js",
  "tools/hdwallet-gen/generate.js",
  "apps/web/src/engine/boundary.ts",
  "apps/web/src/screens/send.tsx",
  "apps/web/src/screens/network-selection.tsx",
  "apps/android/app/src/main/java/com/bawa/wallet/ui/screens/ManagementScreens.kt",
];

// Validation-draft paths the diagram marks NOT IN REPO (local-only drafts,
// WEB-GUIDE: "local-only, in no repository"). If any ever lands in the repo,
// the diagram's NOT IN REPO box is wrong and this test fails on purpose.
const NOT_IN_REPO = [
  "app-web/src/tx.js",
  "app-web/src/connectivity.js",
  "app-web/src/main.js",
];

const DRAFT_BASENAMES = [
  "tx.js",
  "connectivity.js",
  "SigningCoordinator.kt",
  "EthSepoliaAdapter.kt",
  "EthSendComposer.kt",
  "NetworkConfig.kt",
  "TonConfig.kt",
  "TonSeqnoTracker.kt",
  "TonTestnetAdapter.kt",
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

test("§13.0 diagram exists and carries the hard gate", () => {
  const guide = fs.readFileSync(GUIDE, "utf8");
  assert.ok(
    guide.includes("### 13.0 Mainnet wallet flow"),
    "§13.0 diagram section missing from MAINNET-GUIDE.md",
  );
  assert.ok(
    guide.includes("HARD GATE — NOTHING BELOW EXISTS"),
    "diagram hard-gate line missing",
  );
  assert.ok(
    guide.includes("NOT IN REPO — local-only validation drafts"),
    "diagram NOT IN REPO box missing",
  );
  assert.ok(
    guide.includes("698983191"),
    "diagram must pin TON wallet ID 698983191",
  );
});

test("diagram-cited in-repo files exist", () => {
  for (const rel of IN_REPO) {
    assert.ok(
      fs.existsSync(path.join(ROOT, rel)),
      `diagram-cited file missing: ${rel}`,
    );
  }
});

test("validation-draft files stay out of the repo", () => {
  for (const rel of NOT_IN_REPO) {
    assert.ok(
      !fs.existsSync(path.join(ROOT, rel)),
      `draft file must not exist in repo: ${rel}`,
    );
  }
  const allFiles = walk(ROOT, []);
  for (const base of DRAFT_BASENAMES) {
    const found = allFiles.filter((f) => path.basename(f) === base);
    assert.deepEqual(
      found,
      [],
      `draft file ${base} must not exist anywhere in repo (found: ${found.join(", ")})`,
    );
  }
});

test("Web Send stays disabled and watch-only derivation stays TON-free", () => {
  const send = fs.readFileSync(
    path.join(ROOT, "apps/web/src/screens/send.tsx"),
    "utf8",
  );
  assert.ok(
    send.includes("Sending is not implemented in this starter"),
    "send.tsx must state sending is not implemented",
  );
  assert.ok(
    send.includes("onSubmit={(event) => event.preventDefault()}"),
    "send.tsx form must prevent submission",
  );
  assert.ok(
    send.includes("<fieldset disabled"),
    "send.tsx form must be a disabled fieldset",
  );
  const boundary = fs.readFileSync(
    path.join(ROOT, "apps/web/src/engine/boundary.ts"),
    "utf8",
  );
  assert.match(
    boundary,
    /export type ChainId = 'btc' \| 'eth' \| 'trx'/,
    "boundary.ts ChainId must cover BTC/ETH/TRX only (no TON)",
  );
  const android = fs.readFileSync(
    path.join(
      ROOT,
      "apps/android/app/src/main/java/com/bawa/wallet/ui/screens/ManagementScreens.kt",
    ),
    "utf8",
  );
  assert.ok(
    android.includes("There is no signing, broadcast or transaction-construction code."),
    "Android starter must state no signing/broadcast/construction code",
  );
});

test("no production signing/broadcast call exists in repo code", () => {
  // The only signing code is a local, test-only signer restricted to temporary
  // unfunded test credentials; broadcast is not implemented.
  const codeDirs = ["tools", "apps", "scripts", "packages"];
  const callPattern = /\b(signTransaction|sendRawTransaction)\s*\(|\bbroadcast\s*\(/;
  const allowlist = {
    // signTransaction is a throwing stub, verified below.
    "tools/mainnet-tx/unsigned-tx.mjs": true,
    // broadcast( appears only inside the FORBIDDEN_IMPLEMENTED regex literal.
    "scripts/validate-registry.mjs": true,
  };
  const offenders = [];
  for (const dir of codeDirs) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root, [])) {
      if (!/\.(js|mjs|ts|tsx|kt|py)$/.test(file)) continue;
      if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
      const text = fs.readFileSync(file, "utf8");
      const repoPath = path.relative(ROOT, file).split(path.sep).join("/");
      if (callPattern.test(text) && !Object.hasOwn(allowlist, repoPath)) {
        offenders.push(repoPath);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `production signing/broadcast implementation call found in: ${offenders.join(", ")}`,
  );

  const localSigning = fs.readFileSync(
    path.join(ROOT, "tools/mainnet-signing/local-signing.mjs"),
    "utf8",
  );
  assert.ok(
    localSigning.includes(
      "assertOperationAllowed('sign', { credentialKind: 'temporary-unfunded', localOnly: true })",
    ),
    "the local signer must be gated to temporary unfunded test credentials",
  );

  const unsignedTx = fs.readFileSync(
    path.join(ROOT, "tools/mainnet-tx/unsigned-tx.mjs"),
    "utf8",
  );
  assert.match(
    unsignedTx,
    /export function signTransaction\(\)\s*\{[^}]*\bthrow\b[^}]*\}/,
    "signTransaction must remain a throwing stub",
  );

  assert.doesNotMatch(
    localSigning,
    callPattern,
    "local signing must not broadcast or send raw transactions",
  );

  const registry = fs.readFileSync(
    path.join(ROOT, "scripts/validate-registry.mjs"),
    "utf8",
  );
  const registryCallLines = registry
    .split(/\r?\n/)
    .filter((line) => callPattern.test(line));
  assert.equal(
    registryCallLines.length,
    1,
    "only the FORBIDDEN_IMPLEMENTED regex line may match in the registry",
  );
  assert.ok(
    registryCallLines.every((line) => line.includes("broadcast(s|ed|ing)?")),
    "registry matches must be confined to the FORBIDDEN_IMPLEMENTED regex literal",
  );
});
