/**
 * Regression checks for diagram references and source-level feature claims.
 *
 * T08 diagram-reference test — Doc 4 §13.0. Guards the corrected diagram's
 * traced claims: every in-repo path it cites must exist, every
 * validation-draft path it marks NOT IN REPO must stay absent, and the
 * offline-send / gated-signing facts it states must hold: the web wallet
 * signs offline with real vault keys (BTC, ETH, TRX and TON); the
 * T25-isolated tool signs only with temporary unfunded test credentials.
 * Neither provides a broadcast path. Android management retains its
 * no-signing / no-broadcast disclaimer.
 */
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

test("Web Send signs offline with broadcast disabled and ChainId includes TON", () => {
  const send = fs.readFileSync(
    path.join(ROOT, "apps/web/src/screens/send.tsx"),
    "utf8",
  );
  assert.equal(
    send.includes("Sending is not implemented in this starter"),
    false,
    "send.tsx must not reintroduce the obsolete unimplemented-Send placeholder",
  );
  assert.equal(
    send.includes("<fieldset disabled"),
    false,
    "send.tsx must not reintroduce the old always-disabled Send fieldset",
  );
  assert.ok(
    send.includes("previewSendAmount"),
    "send.tsx must wire the offline send preview",
  );
  assert.ok(
    send.includes("signEthOffline"),
    "send.tsx must wire offline signing",
  );
  assert.ok(
    send.includes("not sent anywhere: broadcast is disabled until separately"),
    "send.tsx must state signed transactions are not sent anywhere",
  );
  assert.ok(
    send.includes("Broadcast is disabled until separately authorised"),
    "send.tsx must retain the warning that broadcast requires separate authorisation",
  );
  assert.ok(
    send.includes("Send signed — not broadcast"),
    "send.tsx must describe the result as signed, not broadcast",
  );

  for (const signer of [
    "signEthOffline",
    "signBtcOffline",
    "signTrxOffline",
    "signTonOffline",
  ]) {
    assert.match(
      send,
      new RegExp(
        `import\\s*\\{[^}]*\\b${signer}\\b[^}]*\\}\\s*from\\s*['"]\\.\\./wallet/send['"]`,
      ),
      `send.tsx must not drop the ${signer} import from ../wallet/send required for offline signing`,
    );
  }

  const boundary = fs.readFileSync(
    path.join(ROOT, "apps/web/src/engine/boundary.ts"),
    "utf8",
  );
  assert.match(
    boundary,
    /export\s+type\s+ChainId\s*=\s*'btc'\s*\|\s*'eth'\s*\|\s*'trx'\s*\|\s*'ton'\s*;/,
    "boundary.ts ChainId must not omit TON or remove BTC, ETH or TRX",
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
    "ManagementScreens.kt must retain its no-signing, no-broadcast, no-transaction-construction disclaimer",
  );
});

test("no broadcast submission exists; broadcast stays a disabled stub", () => {
  // Production offline signing EXISTS (apps/web/src/wallet/send.ts signs
  // offline with the vault key via AnySigner.sign); what must never exist
  // is a broadcast/submission call. Broadcast exists only as disabled
  // stubs: the ChainAdapter interface returns Promise<never> and every
  // adapter broadcast() throws BROADCAST_DISABLED_MESSAGE.
  const codeDirs = ["tools", "apps", "scripts", "packages"];
  const submitPattern = /\b(signTransaction|sendRawTransaction)\s*\(/;
  const broadcastPattern = /\bbroadcast\s*\(/;
  const callPattern = new RegExp(
    `${submitPattern.source}|${broadcastPattern.source}`,
  );
  const submitAllowlist = {
    // signTransaction is a throwing stub, verified below.
    "tools/mainnet-tx/unsigned-tx.mjs": true,
    // broadcast( appears only inside the FORBIDDEN_IMPLEMENTED regex literal.
    "scripts/validate-registry.mjs": true,
  };
  const broadcastAllowlist = {
    ...submitAllowlist,
    // Interface declares broadcast(): Promise<never> — the disabled contract.
    "apps/web/src/wallet/adapters/types.ts": true,
    // Tests asserting adapter broadcast() rejects with the disabled message.
    "apps/web/src/wallet/adapters/btc.test.ts": true,
    "apps/web/src/wallet/adapters/eth.test.ts": true,
    "apps/web/src/wallet/adapters/ton.test.ts": true,
    "apps/web/src/wallet/adapters/trx.test.ts": true,
    "apps/web/src/wallet/adapters/types.test.ts": true,
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
      if (
        (submitPattern.test(text) &&
          !Object.hasOwn(submitAllowlist, repoPath)) ||
        (broadcastPattern.test(text) &&
          !Object.hasOwn(broadcastAllowlist, repoPath))
      ) {
        offenders.push(repoPath);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `broadcast/submission implementation call found in: ${offenders.join(", ")}`,
  );

  // The disabled design itself must stay pinned: the interface promises
  // never, and send.ts broadcastSigned always returns disabled.
  const adapterTypes = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/adapters/types.ts"),
    "utf8",
  );
  assert.ok(
    adapterTypes.includes("broadcast(signedTx: unknown): Promise<never>"),
    "ChainAdapter.broadcast must stay declared as Promise<never> (disabled by contract)",
  );
  const send = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/send.ts"),
    "utf8",
  );
  assert.ok(
    send.includes(
      "return { status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE }",
    ),
    "send.ts broadcastSigned must stay returning disabled",
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
    "only the FORBIDDEN_BROADCAST regex line may match in the registry",
  );
  assert.ok(
    registryCallLines.every((line) => line.includes("broadcast(s|ed|ing)?")),
    "registry matches must be confined to the FORBIDDEN_BROADCAST regex literal",
  );
});
