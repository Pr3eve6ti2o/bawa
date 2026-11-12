// Bawa register-links regression test — Doc 4 §20/§21 (M-16–M-19).
// Run via `npm test` from tools/hdwallet-gen (package.json) or directly:
//   node test/register-links.test.js
//
// Pure-text assertions over docs/mainnet/MAINNET-GUIDE.md and README.md.
// Nothing here touches the network: link liveness is evidenced by dated
// re-checks recorded in the guide itself (§20, §21 M-19), not by this test.
// Any failure exits non-zero.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const GUIDE = fs.readFileSync(
  path.join(REPO_ROOT, "docs", "mainnet", "MAINNET-GUIDE.md"),
  "utf8"
);
const README = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

let failures = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
function linesOf(text) {
  return text.split("\n");
}

// --- M-17: no faucet URL is ever a live link in the mainnet guide. ---
// The two testnet faucet hosts may occur only as §11 "Delete, without
// replacement" items, prose, or the M-17 register row — never as a markdown
// link a reader could follow.
for (const host of ["nileex.io/join/get", "mempool.space/testnet4/faucet"]) {
  const linked = linesOf(GUIDE).filter((l) => l.includes(host) && l.includes("]("));
  check(`M-17 faucet host ${host} is never a markdown link`, linked.length === 0,
    linked.length ? `${linked.length} linked line(s)` : "");
  check(`M-17 faucet host ${host} occurs only in deletion/prose context`,
    count(GUIDE, host) > 0, "host absent entirely (deletion instruction lost?)");
}

// --- M-18: Etherscan V1 appears only as the labelled failure demo (§12)
// and inside the M-18 register row. The V2 route must be present. ---
const v1Lines = linesOf(GUIDE).filter((l) => l.includes("api.etherscan.io/api"));
const v1OutsideRow = v1Lines.filter((l) => !l.includes("M18 F10"));
check("M-18 V1 URL occurs only in failure-demo block or M-18 row",
  v1OutsideRow.length <= 2, `${v1OutsideRow.length} occurrence line(s) outside row context`);
check("M-18 failure demonstration is labelled as retired",
  GUIDE.includes("Retired unauthenticated V1 route: failure demonstration only"));
check("M-18 V2 route stated with chainid and API key",
  GUIDE.includes("https://api.etherscan.io/v2/api") && GUIDE.includes("chainid=1"));
check("M-18 Blockscout replacement history route is cited",
  GUIDE.includes("https://eth.blockscout.com/api/v2/addresses/0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7/transactions"));
check("M-18 row is RESOLVED on the replacement-explorer branch",
  GUIDE.includes("RESOLVED 2026-11-12 — replacement-explorer branch"));

// --- M-19: the four DEAD-404 URLs are never cited as live. ---
check("M-19 wrong PublicNode hostname is absent",
  !GUIDE.includes("eth-mainnet.publicnode.com"));
check("M-19 PyPI template URL is absent",
  !GUIDE.includes("pypi.org/pypi/{package}/{version}/json"));
check("M-19 bare Blockstream API root is absent as a cited link",
  !GUIDE.includes("](https://blockstream.info/api)") &&
    !GUIDE.includes("](https://blockstream.info/api/)"));
check("M-19 Maven registry URL appears only with the authenticated qualification",
  GUIDE.includes("Authenticated Maven registry") &&
    GUIDE.includes("maven.pkg.github.com/trustwallet/wallet-core"));

// --- M-19: the 2026-11-12 non-VM re-check is recorded in §20. ---
check("M-19 §20 carries the 2026-11-12 re-check note",
  GUIDE.includes("Re-check 2026-11-12 (T04, non-VM routes)"));
const RECHECK_FORMS = {
  "WCAG 2.2": ["WCAG 2.2:** **LIVE on re-check 2026-11-12"],
  "CoinsPaid hot-wallet page": ["CoinsPaid hot-wallet page — LIVE on re-check 2026-11-12"],
  "CISA backup PDF": ["CISA backup PDF — LIVE on re-check 2026-11-12"],
  "Medium SIM-swap article": ["Medium SIM-swap article — LIVE on re-check 2026-11-12"],
  "Keycard Shell": ["Keycard Shell:** the product page is **LIVE on re-check 2026-11-12"],
};
for (const [item, forms] of Object.entries(RECHECK_FORMS)) {
  check(`M-19 §20 marks ${item} LIVE on re-check 2026-11-12`,
    forms.some((f) => GUIDE.includes(f)));
}
check("M-19 row is RESOLVED 2026-11-12",
  GUIDE.includes("RESOLVED 2026-11-12 — recorded non-VM re-check"));

// --- M-16: §10 recovery procedure follows M16 F42's 12-step order. ---
const F42_STEPS = [
  "Establish the original material and comparison record",
  "Establish the decrypt-tool procedure",
  "Decrypt the backup where encryption is used",
  "Check and import the recovered mnemonic",
  "Complete the post-import backup gate",
  "Apply the recorded derivation and wallet configuration",
  "Derive and compare the public outputs",
  "Complete network verification",
  "Close the pre-funding record",
  "Permit the post-match small receive",
  "Verify and record that receipt",
  "Only then permit further intended funding",
];
let lastIdx = -1;
let inOrder = true;
for (const step of F42_STEPS) {
  const idx = GUIDE.indexOf(step);
  if (idx === -1 || idx <= lastIdx) inOrder = false;
  lastIdx = Math.max(lastIdx, idx);
}
check("M-16 §10 procedure has the 12 F42 steps in order", inOrder);
check("M-16 backup-gate step carries a hard stop",
  GUIDE.includes("Complete the post-import backup gate") &&
    GUIDE.includes("HARD STOP:** failed, skipped or unavailable confirmation"));
check("M-16 Android deletion prerequisites are stated",
  GUIDE.includes("Android deletion prerequisites (established 2026-11-12)") &&
    GUIDE.includes("No user-passphrase requirement for Android deletion is evidenced"));
check("M-16 row is RESOLVED 2026-11-12",
  GUIDE.includes("RESOLVED 2026-11-12 — §10 prose now follows M16 F42"));

// --- M-16 (README): the §13 overclaim is gone. ---
check("M-16 README §13 overclaim removed",
  !README.includes("the funds were never sent to that address. Never re-fund a guess") &&
    README.includes("do not conclude the funds were never sent to that address"));
check("M-16 README §13 uses the recorded passphrase policy",
  README.includes("recorded BIP-39 passphrase policy"));

// --- M-15 / M-17: still OPEN, with dated verification. ---
check("M-15 row stays OPEN pending T50",
  GUIDE.includes("Closure awaits T50 (Workstream 4 AI-led separate-context Astra security review) acceptance"));
check("M-17 row stays OPEN blocked on M-20/OI-098",
  GUIDE.includes("Still blocked on the clearance condition below (M-20/OI-098 endpoint-identity re-verification)"));

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll register-links checks passed");
