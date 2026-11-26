/**
 * Regression checks for diagram references and source-level feature claims.
 *
 * T08 diagram-reference test — Doc 4 §13.0. Guards the corrected diagram's
 * traced claims: every in-repo path it cites must exist, every
 * validation-draft path it marks NOT IN REPO must stay absent, and the
 * offline-send / gated-signing facts it states must hold: the web wallet
 * signs offline with real vault keys (BTC, ETH, TRX and TON); the
 * T25-isolated tool signs only with temporary unfunded test credentials.
 * Mainnet broadcast does not exist: broadcastSigned in send.ts always
 * returns disabled and every mainnet adapter broadcast() throws. The
 * one broadcast path that DOES exist is the TEMPORARY devnet broadcast
 * (owner order 2026-11-22): broadcastSignedDevnet submits only through
 * a devnet adapter whose network id is a devnet id, and
 * createDevnet*Broadcast in devnet-endpoints.ts submits only to the
 * four devnet networks. Android management retains its no-signing /
 * no-broadcast disclaimer.
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
  "tools/hdwallet-gen/derive-daemon.js",
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
    // Generated build output duplicates src/ and is gitignored; scanning
    // it double-counts source and can never add signal.
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist"
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * Return the input with comments and string-literal contents blanked to
 * spaces (positions and newlines preserved), so a later pattern match
 * sees real code calls only. Prose mentions of `broadcast (` in a comment
 * or a test name are not calls and must not fail the scan; a real call
 * anywhere in code still matches. Code inside template ${ } expressions
 * is kept. Regex literals are left untouched: none of the scanned files
 * relies on a regex literal containing a quote or `//`.
 */
function codeOnly(text) {
  const out = text.split("");
  const n = text.length;
  const stack = [{ kind: "code", inTemplateExpr: false, braceDepth: 0 }];
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const frame = stack[stack.length - 1];
    const ch = text[i];
    const next = i + 1 < n ? text[i + 1] : "";
    if (frame.kind === "code") {
      if (ch === "/" && next === "/") {
        const end = text.indexOf("\n", i);
        const stop = end === -1 ? n : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === "/" && next === "*") {
        const end = text.indexOf("*/", i + 2);
        const stop = end === -1 ? n : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === "'" || ch === '"') {
        let j = i + 1;
        while (j < n) {
          if (text[j] === "\\") {
            j += 2;
            continue;
          }
          if (text[j] === ch || text[j] === "\n") break;
          j++;
        }
        const stop = j < n && text[j] === ch ? j + 1 : j;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (ch === "`") {
        stack.push({ kind: "template", inTemplateExpr: false, braceDepth: 0 });
        i += 1;
        continue;
      }
      if (frame.inTemplateExpr && ch === "{") {
        frame.braceDepth += 1;
        i += 1;
        continue;
      }
      if (frame.inTemplateExpr && ch === "}") {
        if (frame.braceDepth === 0) stack.pop();
        else frame.braceDepth -= 1;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    // Inside a template literal: blank everything except ${ } code.
    if (ch === "\\") {
      if (out[i] !== "\n") out[i] = " ";
      if (i + 1 < n && out[i + 1] !== "\n") out[i + 1] = " ";
      i += 2;
      continue;
    }
    if (ch === "`") {
      stack.pop();
      i += 1;
      continue;
    }
    if (ch === "$" && next === "{") {
      stack.push({ kind: "code", inTemplateExpr: true, braceDepth: 0 });
      i += 2;
      continue;
    }
    if (ch !== "\n") out[i] = " ";
    i += 1;
  }
  return out.join("");
}

/** 1-based line numbers of every match of `pattern` in `code`. */
function matchLineNumbers(code, pattern) {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  const lines = [];
  let m;
  while ((m = global.exec(code)) !== null) {
    lines.push(code.slice(0, m.index).split("\n").length);
    if (m[0].length === 0) global.lastIndex++;
  }
  return lines;
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
  // ETH signs through the generalised EVM offline signer: signEvmOffline
  // (generalised from signEthOffline for BSC send, 2026-11-24) is the
  // call send.tsx makes for every EVM chain including ETH.
  assert.ok(
    send.includes("signEvmOffline"),
    "send.tsx must wire offline signing",
  );
  assert.ok(
    send.includes("await signEvmOffline("),
    "send.tsx must call the offline EVM signer",
  );
  assert.ok(
    send.includes(
      "It was not sent anywhere. Sending funds is switched off until it is separately approved.",
    ),
    "send.tsx must state signed transactions are not sent anywhere",
  );
  assert.ok(
    send.includes("Sending funds is switched off until it is separately approved"),
    "send.tsx must retain the warning that sending requires separate authorisation",
  );
  assert.ok(
    send.includes("Send signed, not sent"),
    "send.tsx must describe the result as signed, not sent",
  );

  for (const signer of [
    "signEvmOffline",
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

  // signEthOffline remains in send.ts as the ETH entry point and
  // delegates to the generalised signer for 'eth'.
  const sendTs = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/send.ts"),
    "utf8",
  );
  assert.match(
    sendTs,
    /export async function signEthOffline\(/,
    "send.ts must keep the signEthOffline entry point",
  );
  assert.match(
    sendTs,
    /return signEvmOffline\(\s*'eth',/,
    "signEthOffline must delegate to signEvmOffline for 'eth'",
  );

  const boundary = fs.readFileSync(
    path.join(ROOT, "apps/web/src/engine/boundary.ts"),
    "utf8",
  );
  const chainIdMatch = boundary.match(
    /export\s+type\s+ChainId\s*=\s*([^;]+);/,
  );
  assert.ok(chainIdMatch, "boundary.ts must export a ChainId type");
  for (const chain of ["'btc'", "'eth'", "'trx'", "'ton'"]) {
    assert.ok(
      chainIdMatch[1].includes(chain),
      `boundary.ts ChainId must not omit ${chain} (13-chain registry keeps the four core chains)`,
    );
  }
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

test("no mainnet broadcast submission exists; devnet broadcast stays gated and broadcast stays a disabled stub", () => {
  // Mainnet broadcast must never exist. What DOES exist, by owner order
  // (TEMPORARY devnet mode, 2026-11-22), is a devnet-only broadcast:
  // broadcastSignedDevnet in send.ts calls adapter.broadcast() behind
  // three gates, and createDevnet*Broadcast in devnet-endpoints.ts
  // submits only to the four devnet networks. The scan below therefore
  // matches real code calls only (comments and string literals are
  // blanked first, generated dist/ is not walked), and the devnet path
  // plus the rejection-asserting adapter tests are allowlisted only
  // with the pinned assertions that follow.
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
    // viem sendRawTransaction on the Sepolia client, inside the
    // devnet-only createDevnetEthBroadcast (pinned below).
    "apps/web/src/wallet/devnet-endpoints.ts": true,
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
    "apps/web/src/wallet/adapters/doge.test.ts": true,
    "apps/web/src/wallet/adapters/evm.test.ts": true,
    "apps/web/src/wallet/adapters/ltc.test.ts": true,
    "apps/web/src/wallet/adapters/sol.test.ts": true,
    // Tests of the deliberate devnet broadcast path, against mocked
    // transports/clients only (pinned below).
    "apps/web/src/wallet/adapters/devnet.test.ts": true,
    "apps/web/src/wallet/devnet-endpoints.test.ts": true,
    // The single real adapter.broadcast() call, inside the gated
    // broadcastSignedDevnet only (pinned below).
    "apps/web/src/wallet/send.ts": true,
  };
  const offenders = [];
  for (const dir of codeDirs) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root, [])) {
      if (!/\.(js|mjs|ts|tsx|kt|py)$/.test(file)) continue;
      if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
      const text = fs.readFileSync(file, "utf8");
      const code = codeOnly(text);
      const repoPath = path.relative(ROOT, file).split(path.sep).join("/");
      if (
        (submitPattern.test(code) &&
          !Object.hasOwn(submitAllowlist, repoPath)) ||
        (broadcastPattern.test(code) &&
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

  // The disabled design itself must stay pinned. The interface promises
  // a BroadcastResult because the devnet adapters return one on success;
  // the DISABLED contract lives in the single shared stub
  // (createDisabledBroadcast, one definition since marketing-fix Lane 2),
  // which every mainnet adapter wires in, and send.ts broadcastSigned
  // always returns disabled.
  const adapterTypes = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/adapters/types.ts"),
    "utf8",
  );
  assert.ok(
    adapterTypes.includes(
      "broadcast(signedTx: unknown): Promise<BroadcastResult>",
    ),
    "ChainAdapter.broadcast must stay declared as returning BroadcastResult (devnet returns one; mainnet throws)",
  );
  assert.ok(
    adapterTypes.includes(
      "export function createDisabledBroadcast(): ChainAdapter['broadcast'] {",
    ),
    "types.ts must keep the single shared disabled-broadcast stub",
  );
  assert.ok(
    adapterTypes.includes(
      "return async (_signedTx: unknown): Promise<never> => {",
    ),
    "createDisabledBroadcast must stay typed as returning Promise<never>",
  );
  assert.ok(
    adapterTypes.includes("throw new Error(BROADCAST_DISABLED_MESSAGE);"),
    "createDisabledBroadcast must stay throwing the disabled message",
  );
  for (const rel of [
    "apps/web/src/wallet/adapters/btc.ts",
    "apps/web/src/wallet/adapters/doge.ts",
    "apps/web/src/wallet/adapters/evm.ts",
    "apps/web/src/wallet/adapters/ltc.ts",
    "apps/web/src/wallet/adapters/sol.ts",
    "apps/web/src/wallet/adapters/ton.ts",
    "apps/web/src/wallet/adapters/trx.ts",
  ]) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(
      text.includes("createDisabledBroadcast()"),
      `${rel} must keep wiring broadcast to the disabled stub`,
    );
  }
  const ethAdapter = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/adapters/eth.ts"),
    "utf8",
  );
  assert.ok(
    ethAdapter.includes("return createEvmAdapter("),
    "eth.ts must keep delegating to createEvmAdapter (whose broadcast is the disabled stub)",
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

  // The one real broadcast() call in send.ts must be the gated devnet
  // one: exactly one code match, inside broadcastSignedDevnet, which
  // keeps all three gates (devnet mode on, no test account, devnet
  // network id only).
  const sendCode = codeOnly(send);
  const sendBroadcastLines = matchLineNumbers(sendCode, broadcastPattern);
  assert.equal(
    sendBroadcastLines.length,
    1,
    `send.ts must contain exactly one broadcast() call, the gated devnet one (found on lines: ${sendBroadcastLines.join(", ")})`,
  );
  const sendLines = send.split(/\r?\n/);
  assert.ok(
    sendLines[sendBroadcastLines[0] - 1].includes("await adapter.broadcast("),
    "the single broadcast() call in send.ts must be adapter.broadcast()",
  );
  const devnetFnStart = send.indexOf(
    "export async function broadcastSignedDevnet(",
  );
  const devnetFnEnd = send.indexOf("\nexport ", devnetFnStart + 1);
  const devnetFn = send.slice(
    devnetFnStart,
    devnetFnEnd === -1 ? undefined : devnetFnEnd,
  );
  assert.ok(devnetFnStart !== -1, "broadcastSignedDevnet must exist in send.ts");
  for (const gate of [
    "if (options?.devnet !== true)",
    "assertNotTestAccount()",
    "if (!isDevnetNetworkId(adapter.networkId))",
  ]) {
    assert.ok(
      devnetFn.includes(gate),
      `broadcastSignedDevnet must keep its gate: ${gate}`,
    );
  }

  // The devnet broadcast implementations must stay devnet-only: the
  // four devnet network ids, the four createDevnet*Broadcast exports,
  // exactly two sendRawTransaction references (the Sepolia client type
  // and the devnet-only call) and no bare broadcast() call at all.
  const devnetEndpoints = fs.readFileSync(
    path.join(ROOT, "apps/web/src/wallet/devnet-endpoints.ts"),
    "utf8",
  );
  for (const networkId of [
    "00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043",
    "eip155:11155111",
    "tron:nile",
    "ton:-3",
  ]) {
    assert.ok(
      devnetEndpoints.includes(networkId),
      `devnet-endpoints.ts must stay devnet-only (missing ${networkId})`,
    );
  }
  for (const fn of [
    "createDevnetBtcBroadcast",
    "createDevnetEthBroadcast",
    "createDevnetTrxBroadcast",
    "createDevnetTonBroadcast",
  ]) {
    assert.ok(
      devnetEndpoints.includes(`export function ${fn}`),
      `devnet-endpoints.ts must keep ${fn}`,
    );
  }
  const devnetCode = codeOnly(devnetEndpoints);
  assert.equal(
    matchLineNumbers(devnetCode, submitPattern).length,
    2,
    "devnet-endpoints.ts must contain exactly two sendRawTransaction references: the Sepolia client type and the devnet-only call",
  );
  assert.deepEqual(
    matchLineNumbers(devnetCode, broadcastPattern),
    [],
    "devnet-endpoints.ts must contain no bare broadcast() call",
  );

  // Every allowlisted adapter test must keep asserting that
  // adapter.broadcast() rejects with the disabled message.
  for (const rel of [
    "apps/web/src/wallet/adapters/btc.test.ts",
    "apps/web/src/wallet/adapters/eth.test.ts",
    "apps/web/src/wallet/adapters/ton.test.ts",
    "apps/web/src/wallet/adapters/trx.test.ts",
    "apps/web/src/wallet/adapters/doge.test.ts",
    "apps/web/src/wallet/adapters/evm.test.ts",
    "apps/web/src/wallet/adapters/ltc.test.ts",
    "apps/web/src/wallet/adapters/sol.test.ts",
  ]) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(
      text.includes("BROADCAST_DISABLED_MESSAGE") &&
        text.includes("adapter.broadcast("),
      `${rel} must keep asserting adapter.broadcast() rejects with the disabled message`,
    );
  }

  // The allowlisted devnet tests must only exercise the devnet
  // broadcast helpers (mocked transports/clients).
  for (const rel of [
    "apps/web/src/wallet/adapters/devnet.test.ts",
    "apps/web/src/wallet/devnet-endpoints.test.ts",
  ]) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(
      text.includes("createDevnet"),
      `${rel} must only exercise the devnet broadcast helpers`,
    );
  }

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
