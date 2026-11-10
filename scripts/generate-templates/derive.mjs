// derive.mjs — generated-project derivation wrapper template.
//
// Copied verbatim into each generated CLI wallet project by
// scripts/generate-project.mjs. Derives one address with the repo engine.
// Usage: node derive.mjs <chain> <xpub> [index]
// Public test vectors only in this template; the caller supplies the key.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const repoTools = join(dir, '..', '..', 'tools', 'hdwallet-gen');
const profile = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'));

const [chain, key, indexRaw = '0'] = process.argv.slice(2);
const usable =
  typeof chain === 'string' &&
  typeof key === 'string' &&
  /^[0-9]+$/.test(indexRaw) &&
  profile.chains.includes(chain) &&
  chain !== 'ton';

if (!usable) {
  console.error('Usage: node derive.mjs <chain> <xpub> [index]');
  console.error('Chain must be one of this profile\'s derivable chains: ' +
    profile.chains.filter((c) => c !== 'ton').join(', ') +
    '. TON is generation-only and has no derivation route.');
  process.exitCode = 2;
} else {
  const result = spawnSync(
    process.execPath,
    [join(repoTools, 'derive.js'), chain, indexRaw],
    { cwd: repoTools, input: key + '\n', encoding: 'utf8', timeout: 10000 },
  );
  if (result.error) {
    console.error('derive: could not run the repo engine: ' + result.error.message);
    process.exitCode = 1;
  } else {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exitCode = result.status ?? 1;
  }
}
