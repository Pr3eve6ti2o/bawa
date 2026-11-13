// check-lockfiles.mjs — wallet-core lockfile pin verification (T44-F5).
//
// Exported for unit testing (tests/lockfiles.test.mjs). quality-gates.mjs
// runs it BEFORE any `npm ci`, so a tampered lockfile is caught before
// its code is installed or executed — the check used to run last, after
// the install and the test suites had already run against whatever the
// lockfile said.
//
// F-27 (kept): parse each lockfile as JSON and verify BOTH the spec and
// the resolution are 4.9.3. A string-presence check would pass a lockfile
// that merely mentions the pin in a comment or another entry.
// T44-F5 (added): version strings alone do not establish provenance —
// a tampered lockfile could pin 4.9.3 while pointing `resolved` at a
// hostile registry or an `integrity` hash the attacker chose. Require
// the npm registry URL and a sha512 integrity hash.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const REGISTRY_URL = 'https://registry.npmjs.org/';

const FILES = [
  'apps/web/package-lock.json',
  'tools/hdwallet-gen/package-lock.json',
];

// Reject symlinked parent directories rather than reading outside the worktree.
function inspect(root, file) {
  const parts = file.split('/');
  if (isAbsolute(file) || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid repository path');
  }
  let absolute = root;
  for (let index = 0; index < parts.length; index += 1) {
    absolute = join(absolute, parts[index]);
    const stat = lstatSync(absolute);
    if (index === parts.length - 1) return { absolute, stat };
    if (!stat.isDirectory()) throw new Error('Non-directory parent');
  }
}

export function lockfiles(root, files = FILES) {
  let passed = true;
  for (const file of files) {
    try {
      if (!existsSync(join(root, file))) throw new Error('Missing lockfile');
      const { absolute, stat } = inspect(root, file);
      if (!stat.isFile()) throw new Error('Not a regular lockfile');
      const lock = JSON.parse(readFileSync(absolute, 'utf8'));
      const spec = lock?.packages?.['']?.dependencies?.['@trustwallet/wallet-core'];
      const entry = lock?.packages?.['node_modules/@trustwallet/wallet-core'];
      const resolved = entry?.version;
      if (spec !== '4.9.3' || resolved !== '4.9.3') {
        console.error(
          `  ${file}: wallet-core pin must be 4.9.3 (spec: ${spec ?? 'missing'}, resolved: ${resolved ?? 'missing'})`,
        );
        passed = false;
        continue;
      }
      if (typeof entry?.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY_URL)) {
        console.error(
          `  ${file}: wallet-core resolved URL must start with ${REGISTRY_URL}`,
        );
        passed = false;
      }
      if (typeof entry?.integrity !== 'string' || !entry.integrity.startsWith('sha512-')) {
        console.error(
          `  ${file}: wallet-core integrity must be a sha512 hash`,
        );
        passed = false;
      }
    } catch {
      console.error(`  ${file}: lockfile is missing or unreadable`);
      passed = false;
    }
  }
  return passed;
}
