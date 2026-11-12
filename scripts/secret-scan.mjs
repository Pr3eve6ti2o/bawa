import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const excludedTrees = [
  'apps/web/dist', 'apps/android/app/build', 'apps/android/.gradle',
];

function alwaysExcluded(file) {
  return file.split('/').some(part => part === 'node_modules' || part === '.git') ||
    excludedTrees.some(tree => file === tree || file.startsWith(`${tree}/`));
}

function excluded(file, trackedOrUnknown) {
  return alwaysExcluded(file) ||
    (!trackedOrUnknown && (
      file === 'reports' ||
      file.startsWith('reports/') ||
      /\.(?:log|png)$/.test(file)
    ));
}

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

function readText(root, file) {
  const { absolute, stat } = inspect(root, file);
  if (stat.isDirectory()) return null; // Submodule gitlinks are not text files.
  // Inspect the tracked symlink text, never the contents of its target.
  if (stat.isSymbolicLink()) return readlinkSync(absolute, 'utf8');
  if (!stat.isFile()) throw new Error('Not a regular file');
  const data = readFileSync(absolute);
  // Recognise BOM-marked UTF-16 before applying the binary NUL-byte check.
  if (data[0] === 0xff && data[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(data);
  }
  if (data[0] === 0xfe && data[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(data);
  }
  return data.includes(0) ? null : data.toString('utf8');
}

function* walk(root, directory, onReadError) {
  let entries;
  try {
    let absolute = root;
    if (directory) {
      const inspected = inspect(root, directory);
      if (!inspected.stat.isDirectory()) throw new Error('Not a directory');
      absolute = inspected.absolute;
    }
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    onReadError(directory || '.');
    return;
  }

  for (const entry of entries) {
    const file = directory ? `${directory}/${entry.name}` : entry.name;
    // Defer untracked-only exclusions until tracking status is known.
    // In particular, suffix-named directories must still be traversed.
    if (alwaysExcluded(file)) continue;
    if (entry.isDirectory()) yield* walk(root, file, onReadError);
    else yield file; // Symlinks are collected, never traversed.
  }
}

function gitFiles(root, args) {
  try {
    const result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || result.signal ||
        typeof result.stdout !== 'string') {
      return null;
    }
    return result.stdout.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function collectFiles(root, onReadError) {
  const trackedList = gitFiles(root, ['ls-files', '-z']);
  const untrackedList = gitFiles(root, [
    'ls-files', '--others', '--exclude-standard', '-z',
  ]);
  const tracked = new Set(trackedList ?? []);
  const untracked = new Set(untrackedList ?? []);
  const generated = new Set();
  const files = new Set([...tracked, ...untracked]);

  if (trackedList === null || untrackedList === null) {
    // If either Git listing fails, walk conservatively without ignore rules.
    // This also covers generated/ when present.
    for (const file of walk(root, '', onReadError)) files.add(file);
  } else {
    try {
      // Use lstat through inspect so a symlink named generated is not followed.
      if (inspect(root, 'generated').stat.isDirectory()) {
        for (const file of walk(root, 'generated', onReadError)) {
          files.add(file);
          generated.add(file);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') onReadError('generated');
    }
  }

  return [...files].filter(file => {
    // Without a tracked list, only paths explicitly identified as untracked
    // may receive the untracked-only exclusions. Unknown paths are scanned.
    // Files collected from the generated/ walk are scanned in full: the
    // gate scans generated/ when present, including its .log/.png files.
    const trackedOrUnknown = tracked.has(file) || generated.has(file) ||
      (trackedList === null && !untracked.has(file));
    return !excluded(file, trackedOrUnknown);
  }).sort();
}

// Shared alternation for pattern 2 (used four times in one RegExp, so
// it is defined once and cannot drift between the branches).
const seedKeyAlternatives = String.raw`mnemonic(?:[_ -]?(?:words|phrase))?|recovery[_ -]?phrase|seed(?:[_ -]?phrase)?|priv(?:ate)?[_ -]?key(?:[_ -]?hex)?|secret[_ -]?key|passphrase`;

export const secretPatterns = [
  // T44-F1: every documented private extended-key prefix, not just
  // xprv/zprv. The repo's own redaction policy lists xprv, yprv, zprv,
  // Yprv, Zprv, tprv, uprv, vprv (docs/05-watch-only/README.md,
  // docs/14-wallet-app-implementation/README.md); the gate previously
  // missed yprv/tprv/vprv/uprv/Yprv/Zprv entirely, so such a literal
  // committed cleanly. Base58 run length 100+ as before.
  /[xyzYZuUvVtT]prv[1-9A-HJ-NP-Za-km-z]{100,}/,
  // T44-F2 (s4b re-audit): WIF private keys — 51 or 52 Base58
  // characters. 51: uncompressed (5) and testnet uncompressed (9);
  // 52: compressed mainnet (K/L) and testnet (c). The first fix
  // covered 51-char 5/K/L only and missed compressed and testnet WIF.
  /\b[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/,
  // T44-F3 (s4b re-audit): seed-material assignment spellings. The
  // first fix covered the spellings but the anchor missed the forms
  // secrets actually take in committed code: declarations, exports,
  // member assignments and JSON objects with a quoted key and a
  // quoted value. Aliases added:
  // privkey / priv_key, private-key, private_key_hex,
  // recovery_phrase, passphrase. Four branches: (A) a declaration
  // whose value must be a literal (quote, backtick or [), so a
  // legitimate const mnemonic = w.mnemonic() does not flag; (B) the
  // plain anchored form, any value, which is why the reviewed
  // call-value lines stay in the allowlist; (C) a member assignment
  // with a literal value; (D) an object property at a line start,
  // { or , boundary, quoted or unquoted key, literal value — this
  // is what catches an unquoted property key (s8 High: the old
  // quoted-key branch missed unquoted properties) and a property
  // on its own line of pretty-printed JSON (s9 High: the { or ,
  // must be on the same line as the key, so an indented property
  // was missed) while NOT flagging a ternary such as "mnemonic" :
  // "seed" (s8 Low: the old branch matched any quoted key
  // followed by a colon, including ternary operands). The member
  // branch (C) accepts = only (s9 Low: a member followed by a
  // colon is a ternary, e.g. wallet.mnemonic : "", not an
  // assignment).
  // The separator cannot be part of == (lookahead), so comparisons
  // do not flag. Deliberately NOT covered: generic credential words
  // (password, api_key, token, bare secret) — the gate's contract is
  // wallet seed material, and those words appear legitimately in
  // tests and docs. Multiline values (key on one line, value on the
  // next) and indirect references (const mnemonic = getMnemonic())
  // are not detected: the gate is line-based and literal-based.
  new RegExp(
    String.raw`^\s*(?:(?:export|const|let|var)\s+){1,2}(${seedKeyAlternatives})\s*[:=](?!=)\s*["'\x60\[]|^\s*(${seedKeyAlternatives})\s*[:=](?!=)\s*\S+|\.(${seedKeyAlternatives})\s*=(?!=)\s*["'\x60\[]|(?:^|\{|,)\s*["']?(${seedKeyAlternatives})["']?\s*:\s*["'\x60\[]`,
    "i",
  ),
];

// Known published BIP-32 test vectors ("test vector, never for funds"):
// TV1 root xprv, TV5 bad-checksum xprv, the abandon-mnemonic zprv, and the
// TV1 path xprv (seed 000102..., m/0'/1/2'/2/1000000000).
// Stripped from a line before the xprv/zprv patterns are tested, so any
// OTHER private extended key literal anywhere still fails the gate.
export const knownTestVectors = [
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL',
  'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
  'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76',
];

// Exceptions apply only to these exact trimmed statements, not entire files.
// The test_make_wallet.py statement is reviewed at all three occurrences.
export const secretAllowlist = [
  {
    file: 'tools/decrypt_seed.py',
    pattern: 2,
    line: 'mnemonic = decrypt(args.path, key)',
  },
  {
    file: 'test/differential_test.py',
    pattern: 2,
    line: 'MNEMONIC = (',
  },
  {
    file: 'test/differential_test.py',
    pattern: 2,
    line: 'seed = Bip39SeedGenerator(MNEMONIC).Generate()',
  },
  {
    file: 'test/test_make_wallet.py',
    pattern: 2,
    line: 'mnemonic = " ".join(["abandon"] * 23 + ["art"])',
  },
  // test/fixture-oracle.py (T09): the same published 15-word fixture
  // vector and the same two statements already exempted for
  // test/differential_test.py above (F-26). The seed line occurs twice
  // (lines 62, 236); one entry covers both, as with test_make_wallet.
  {
    file: 'test/fixture-oracle.py',
    pattern: 2,
    line: 'MNEMONIC = (',
  },
  {
    file: 'test/fixture-oracle.py',
    pattern: 2,
    line: 'seed = Bip39SeedGenerator(MNEMONIC).Generate()',
  },
];

const displayPath = file => JSON.stringify(file).slice(1, -1);

/**
 * Scan a repository without logging matching text or filesystem error details.
 * Line 0 denotes a path that could not be read or enumerated safely.
 */
export function secretScan(root) {
  let passed = true;
  const unreadable = new Set();
  const reportUnreadable = file => {
    passed = false;
    if (unreadable.has(file)) return;
    unreadable.add(file);
    console.error(`  ${displayPath(file)}:0`);
  };

  for (const file of collectFiles(root, reportUnreadable)) {
    let text;
    try {
      text = readText(root, file);
    } catch {
      reportUnreadable(file);
      continue;
    }
    if (text === null) continue;

    const lines = text.split(/\r\n?|\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      const scrubbed = knownTestVectors.reduce(
        (value, vector) => value.split(vector).join(''),
        line,
      );
      if (secretPatterns.some((pattern, patternIndex) => {
        const allowed = secretAllowlist.some(entry =>
          entry.file === file &&
          entry.pattern === patternIndex &&
          entry.line === trimmed);
        if (allowed) return false;
        // Patterns 0/1 (private extended keys, WIF) test the scrubbed
        // line; pattern 2 (secret assignment) tests the raw line.
        return pattern.test(patternIndex < 2 ? scrubbed : line);
      })) {
        // Report locations only, never the matching text.
        console.error(`  ${displayPath(file)}:${index + 1}`);
        passed = false;
      }
    }
  }
  return passed;
}
