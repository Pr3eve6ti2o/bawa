// check-live-claim.mjs — the README live-site claim must never pin a build.
//
// The live-site claim kept going stale because it pinned a commit / bundle
// hash / gh-pages commit that changes on every publish (README said the live
// demo served 1a85258 / index-B9gxTjOm.js after the site had moved on to
// 658937d / index-DShv8S5N.js). The fix is to never pin it: the live claim
// always says "the latest published build of this branch" with no hash, so
// there is nothing to go stale. Bundle hashes belong only in dated
// "Project history" bullets, which record what was live, when.
//
// This check enforces that rule. It is offline (no network) so it can run
// anywhere, including CI. Run from the repo root:
//   node scripts/check-live-claim.mjs [repo-root]
//
// Rules:
//  1. README.md: a bundle hash (index-<hash>.js) may appear ONLY in a dated
//     history bullet under "## Project history" (a line starting "- **"
//     carrying a (YYYY-MM-DD) date).
//  2. README.md: no "branch tip is `<hash>`" pin outside those bullets.
//  3. README.md must still contain the unpinned live claim
//     ("latest published build of this branch") — the claim must exist,
//     just unpinned.
//  4. apps/web/README.md: no bundle hash at all.
//  5. ARCHITECTURE.md: a bundle hash may appear ONLY in a dated bullet
//     (a line starting "- " carrying a YYYY-MM-DD date).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.argv[2] || '.');
const BUNDLE_RE = /index-[A-Za-z0-9_-]+\.js/;
const DATED_BULLET_RE = /^- \*\*.*\(2026-\d\d-\d\d\)/;
const DATED_LINE_RE = /^- .*2026-\d\d-\d\d/;
const TIP_RE = /branch tip is `[0-9a-f]{7,40}`/;
const UNPINNED_PHRASE = 'latest published build of this branch';

const failures = [];
function fail(message) {
  failures.push(message);
}

function checkFile(relPath, allowed) {
  const text = readFileSync(join(repoRoot, relPath), 'utf8');
  const lines = text.split('\n');
  return { text, lines };
}

// Rule 1 + 2: root README.md.
const readme = checkFile('README.md');
let historyAt = -1;
readme.lines.forEach((line, i) => {
  if (/^## Project history/.test(line)) historyAt = i;
});
if (historyAt === -1) fail('README.md: no "## Project history" heading found');
readme.lines.forEach((line, i) => {
  const n = i + 1;
  const isDatedBullet = i > historyAt && DATED_BULLET_RE.test(line);
  if (BUNDLE_RE.test(line) && !isDatedBullet) {
    fail('README.md:' + n + ': pinned bundle hash outside a dated history bullet: ' + line.trim().slice(0, 120));
  }
  if (TIP_RE.test(line) && !isDatedBullet) {
    fail('README.md:' + n + ': pinned branch-tip claim outside a dated history bullet: ' + line.trim().slice(0, 120));
  }
});

// Rule 3: the unpinned live claim must exist.
if (!readme.text.includes(UNPINNED_PHRASE)) {
  fail('README.md: missing the unpinned live claim "' + UNPINNED_PHRASE + '"');
}

// Rule 4: apps/web/README.md — no bundle hash at all.
const webReadme = checkFile('apps/web/README.md');
webReadme.lines.forEach((line, i) => {
  if (BUNDLE_RE.test(line)) {
    fail('apps/web/README.md:' + (i + 1) + ': pinned bundle hash: ' + line.trim().slice(0, 120));
  }
});

// Rule 5: ARCHITECTURE.md — bundle hash only in dated bullets.
const arch = checkFile('ARCHITECTURE.md');
arch.lines.forEach((line, i) => {
  if (BUNDLE_RE.test(line) && !DATED_LINE_RE.test(line)) {
    fail('ARCHITECTURE.md:' + (i + 1) + ': pinned bundle hash outside a dated bullet: ' + line.trim().slice(0, 120));
  }
});

if (failures.length > 0) {
  console.log('live-claim check: FAIL (' + failures.length + ' problem(s))');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('live-claim check: OK — no pinned live-build claim in README.md, apps/web/README.md, ARCHITECTURE.md');
