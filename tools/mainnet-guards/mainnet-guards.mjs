// Mainnet guards (T25, Bawa workstream 3).
//
// Purpose: gate mainnet test work so temporary unfunded credentials can
// never leak and no mainnet state can ever change. Three guards:
//   1. No-print / no-log / no-upload: redactText + guardedLog scrub secrets
//      from every emitted string; nothing secret-shaped is ever printed.
//   2. No-broadcast gate: assertOperationAllowed allows only the read-only
//      allowlist (plus local-only signing with temporary unfunded
//      credentials, which the owner authorisation permits); everything
//      else throws MainnetGuardError. M-35 execution is NOT authorised.
//   3. Destruction + no-copy verification: destroyCredentialFile wipes a
//      credential file (3 passes, fsync, unlink, dir fsync); verifyNoCopies
//      sweeps a declared scope for copies and reports locations only.
//
// Boundaries (read before relying on this module):
// - Bare 64-hex strings are NEVER redacted: they are indistinguishable
//   from transaction hashes. A 64-hex private key is redacted only when it
//   is the value of a secret-named field. Callers must therefore never
//   handle a bare private key as free text; keep it behind a field name
//   or pass it to fingerprintSecret / verifyNoCopies in memory.
// - Bare BIP-39 phrases are not pattern-matched (no wordlist is bundled
//   and free-text word runs false-positive); they are covered when they
//   appear as the value of a mnemonic/seed field, and by verifyNoCopies
//   when the phrase is supplied in memory.
// - Destruction cannot certify physical erasure on SSD / copy-on-write /
//   journaled / snapshotted storage, and the sweep establishes scoped
//   detection results, not universal absence. Copies outside the declared
//   scope are out of scope by definition: declare the scope completely.
// - This module never prints, logs, or uploads a secret. Error messages
//   carry redacted paths and locations only, never secret text.
//
// Design: Astra specs (T25 out/a1c-patterns.md, out/a2-ops.md,
// out/a3-destroy.md), assembled by the lane coordinator under the A-3
// precedent after code-generation calls stalled; see lane REPORT.md.
// Pure ESM, Node 22, no dependencies.
import {
  closeSync,
  existsSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REDACTED = '[REDACTED]';

export class MainnetGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MainnetGuardError';
  }
}

// ---------------------------------------------------------------------------
// Guard 1: redaction
// ---------------------------------------------------------------------------

const XPRV_RE = /[xz]prv[1-9A-HJ-NP-Za-km-z]{100,}/g;
const WIF_RE = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g;
const SECRET_FIELD = '(?:mnemonic|private[_-]?key|seed(?:[_-]?phrase)?|wif|[xz]prv)';
const MNEMONIC_FIELD = '(?:mnemonic|seed(?:[_-]?phrase)?)';
const QUOTED_VALUE_RE = new RegExp(
  `(${SECRET_FIELD}\\s*[:=]\\s*["'])` + `[^"']*` + `(["'])`,
  'gi',
);
const MNEMONIC_VALUE_RE = new RegExp(
  `(${MNEMONIC_FIELD}\\s*[:=]\\s*)` + '(?:[A-Za-z]{2,}\\s*){1,24}',
  'gi',
);
const SINGLE_VALUE_RE = new RegExp(
  `(${SECRET_FIELD}\\s*[:=]\\s*)` + '[A-Za-z0-9+/=_-]{2,}',
  'gi',
);

function redactDetailed(text) {
  let count = 0;
  const input = String(text);
  let out = input.replace(XPRV_RE, () => {
    count += 1;
    return REDACTED;
  });
  out = out.replace(WIF_RE, () => {
    count += 1;
    return REDACTED;
  });
  out = out.replace(QUOTED_VALUE_RE, (match, head, tail) => {
    count += 1;
    return head + REDACTED + tail;
  });
  out = out.replace(MNEMONIC_VALUE_RE, (match, head) => {
    count += 1;
    return head + REDACTED;
  });
  out = out.replace(SINGLE_VALUE_RE, (match, head) => {
    count += 1;
    return head + REDACTED;
  });
  return { text: out, count };
}

export function redactText(text) {
  return redactDetailed(text).text;
}

export function containsSecret(text) {
  return redactDetailed(text).count > 0;
}

// Log only through this: the emitted string is always redacted, and the
// return value is the number of redactions applied (0 is clean).
export function guardedLog(logFn, ...args) {
  const joined = args.map((value) => String(value)).join(' ');
  const result = redactDetailed(joined);
  logFn(result.text);
  return result.count;
}

// ---------------------------------------------------------------------------
// Guard 2: operation gate — STOP BEFORE BROADCASTING
// ---------------------------------------------------------------------------

export const READ_ONLY_OPS = ['getBalance', 'getChainId', 'call', 'estimateGas'];

export const FORBIDDEN_OPS = {
  sendTransaction: 'STOP BEFORE BROADCASTING: sendTransaction forbidden; M-35 execution NOT authorised.',
  sendRawTransaction: 'STOP BEFORE BROADCASTING: sendRawTransaction forbidden; M-35 execution NOT authorised.',
  broadcast: 'STOP BEFORE BROADCASTING: broadcasting forbidden; M-35 execution NOT authorised.',
  broadcastTransaction: 'STOP BEFORE BROADCASTING: broadcasting forbidden; M-35 execution NOT authorised.',
  transfer: 'STOP BEFORE BROADCASTING: asset transfers forbidden; M-35 execution NOT authorised.',
  sendToken: 'STOP BEFORE BROADCASTING: asset transfers forbidden; M-35 execution NOT authorised.',
  transferFrom: 'STOP BEFORE BROADCASTING: asset transfers forbidden; M-35 execution NOT authorised.',
  safeTransferFrom: 'STOP BEFORE BROADCASTING: asset transfers forbidden; M-35 execution NOT authorised.',
  approve: 'STOP BEFORE BROADCASTING: approval changes forbidden; M-35 execution NOT authorised.',
  permit: 'STOP BEFORE BROADCASTING: approval changes forbidden; M-35 execution NOT authorised.',
  setApprovalForAll: 'STOP BEFORE BROADCASTING: approval changes forbidden; M-35 execution NOT authorised.',
  increaseAllowance: 'STOP BEFORE BROADCASTING: approval changes forbidden; M-35 execution NOT authorised.',
  decreaseAllowance: 'STOP BEFORE BROADCASTING: approval changes forbidden; M-35 execution NOT authorised.',
  deploy: 'STOP BEFORE BROADCASTING: deployment forbidden; M-35 execution NOT authorised.',
  createContract: 'STOP BEFORE BROADCASTING: deployment forbidden; M-35 execution NOT authorised.',
  execute: 'STOP BEFORE BROADCASTING: state-changing execution forbidden; M-35 execution NOT authorised.',
  writeContract: 'STOP BEFORE BROADCASTING: state-changing execution forbidden; M-35 execution NOT authorised.',
  sendUserOperation: 'STOP BEFORE BROADCASTING: state-changing execution forbidden; M-35 execution NOT authorised.',
  sendCalls: 'STOP BEFORE BROADCASTING: state-changing execution forbidden; M-35 execution NOT authorised.',
};

export const SIGN_OPS = ['sign', 'signTransaction', 'signMessage', 'signTypedData', 'signAuthorization'];

export const NOT_ALLOWLISTED_MESSAGE =
  'STOP BEFORE BROADCASTING: operation not allowlisted; M-35 execution NOT authorised.';

export function assertOperationAllowed(op, options = {}) {
  const name = String(op);
  if (READ_ONLY_OPS.includes(name)) return true;
  if (SIGN_OPS.includes(name)) {
    // Local signing is authorised ONLY with temporary unfunded credentials
    // in an isolated test environment, and only for a signature that is
    // never broadcast. Any other signing is forbidden.
    if (options.credentialKind === 'temporary-unfunded' && options.localOnly === true) {
      return true;
    }
    throw new MainnetGuardError(
      'STOP BEFORE BROADCASTING: signing forbidden; M-35 execution NOT authorised.',
    );
  }
  if (Object.hasOwn(FORBIDDEN_OPS, name)) {
    throw new MainnetGuardError(FORBIDDEN_OPS[name]);
  }
  throw new MainnetGuardError(NOT_ALLOWLISTED_MESSAGE);
}

// ---------------------------------------------------------------------------
// Guard 3a: secure destruction
// ---------------------------------------------------------------------------

const OVERWRITE_CHUNK = 65536;
const MAX_CREDENTIAL_BYTES = 64 * 1024 * 1024;

function writeAll(fd, buffer, offset) {
  let written = 0;
  while (written < buffer.length) {
    written += writeSync(fd, buffer, written, buffer.length - written, offset + written);
  }
}

function overwritePass(fd, size, kind) {
  for (let offset = 0; offset < size; offset += OVERWRITE_CHUNK) {
    const length = Math.min(OVERWRITE_CHUNK, size - offset);
    const chunk = kind === 'zero' ? Buffer.alloc(length) : randomBytes(length);
    try {
      writeAll(fd, chunk, offset);
    } finally {
      chunk.fill(0);
    }
  }
  fsyncSync(fd);
}

// Overwrite (CSPRNG -> zeros -> CSPRNG), fsync after every pass, then unlink
// and fsync the parent directory. Never unlinks after a failed overwrite:
// on any failure the file is left in place (still restricted) and the
// error is reported, so a half-wiped credential is never silently lost
// track of. Returns { destroyed: true, bytes, passes, path }.
export function destroyCredentialFile(filePath) {
  const absolute = resolve(String(filePath));
  let fd;
  try {
    fd = openSync(absolute, fsConstants.O_RDWR | fsConstants.O_NOFOLLOW);
  } catch (error) {
    throw new MainnetGuardError(
      `Cannot open credential file for destruction: ${redactText(absolute)} (${error.code ?? 'open failed'})`,
    );
  }
  let size = 0;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new MainnetGuardError(`Not a regular file, refusing to destroy: ${redactText(absolute)}`);
    }
    if (stat.nlink !== 1) {
      throw new MainnetGuardError(`File has multiple hard links, refusing to destroy: ${redactText(absolute)}`);
    }
    size = stat.size;
    if (size > MAX_CREDENTIAL_BYTES) {
      throw new MainnetGuardError(`Credential file too large to wipe safely: ${redactText(absolute)}`);
    }
    overwritePass(fd, size, 'random');
    overwritePass(fd, size, 'zero');
    overwritePass(fd, size, 'random');
    const after = fstatSync(fd);
    if (after.size !== size || after.dev !== stat.dev || after.ino !== stat.ino) {
      throw new MainnetGuardError(`Credential file changed during destruction, not unlinked: ${redactText(absolute)}`);
    }
  } catch (error) {
    try {
      closeSync(fd);
    } catch {
      // Best effort; the original error is the one that matters.
    }
    if (error instanceof MainnetGuardError) throw error;
    throw new MainnetGuardError(`Destruction failed, file left in place: ${redactText(absolute)}`);
  }
  closeSync(fd);
  unlinkSync(absolute);
  const dirFd = openSync(dirname(absolute), fsConstants.O_RDONLY);
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
  return { destroyed: true, bytes: size, passes: 3, path: absolute };
}

// Fingerprint a secret WITHOUT storing it: SHA-256 plus length and a
// coarse format label. Only the hash ever leaves memory.
export function fingerprintSecret(secret) {
  const value = String(secret);
  const words = value.trim().split(/\s+/).filter(Boolean);
  let format = 'opaque';
  if (
    [12, 15, 18, 21, 24].includes(words.length) &&
    words.every((word) => /^[a-z]+$/.test(word))
  ) {
    format = 'mnemonic';
  } else if (/^[0-9a-fA-F]{64}$/.test(value.trim())) {
    format = 'hex64';
  } else if (/^[xz]prv[1-9A-HJ-NP-Za-km-z]{100,}$/.test(value.trim())) {
    format = 'extended-private';
  } else if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(value.trim())) {
    format = 'wif';
  }
  return {
    sha256: createHash('sha256').update(value, 'utf8').digest('hex'),
    length: Buffer.byteLength(value, 'utf8'),
    format,
  };
}

// ---------------------------------------------------------------------------
// Guard 3b: no-copy verification sweep (declared scope, locations only)
// ---------------------------------------------------------------------------

const MAX_SCAN_BYTES = 5 * 1024 * 1024;

function secretVariants(secret) {
  const variants = new Set();
  if (!secret) return variants;
  variants.add(secret);
  variants.add(JSON.stringify(secret).slice(1, -1));
  variants.add(encodeURIComponent(secret));
  variants.add(Buffer.from(secret, 'utf8').toString('base64'));
  return variants;
}

// options: { scopeDirs: [absolute paths], secrets: [in-memory strings],
//   credentialPath, excludeDirs: ['.git', 'node_modules'] }
// Returns { passed, findings: [{ file, line }], scannedFiles, skipped,
//   coverageComplete }. passed is true only with zero findings AND zero
// skipped (incomplete coverage is a failure, exit 2 at the CLI). Findings
// carry locations only, never matching text.
export function verifyNoCopies(options = {}) {
  const scopeDirs = (options.scopeDirs ?? []).map((dir) => resolve(String(dir)));
  const secrets = (options.secrets ?? []).map((secret) => String(secret));
  const credentialPath = options.credentialPath ? resolve(String(options.credentialPath)) : null;
  const excludeDirs = new Set(options.excludeDirs ?? ['.git', 'node_modules']);
  const findings = [];
  const skipped = [];
  let scannedFiles = 0;
  const variants = new Set();
  for (const secret of secrets) {
    for (const variant of secretVariants(secret)) variants.add(variant);
  }

  const checkLine = (file, lineNo, text) => {
    for (const variant of variants) {
      if (variant && text.includes(variant)) {
        findings.push({ file, line: lineNo });
        return;
      }
    }
    if (containsSecret(text)) findings.push({ file, line: lineNo });
  };

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped.push(dir);
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        skipped.push(path);
        continue;
      }
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        walk(path);
        continue;
      }
      if (!entry.isFile()) {
        skipped.push(path);
        continue;
      }
      if (containsSecret(entry.name)) findings.push({ file: path, line: 0 });
      let stat;
      try {
        stat = lstatSync(path);
      } catch {
        skipped.push(path);
        continue;
      }
      if (stat.size > MAX_SCAN_BYTES) {
        skipped.push(path);
        continue;
      }
      let data;
      try {
        data = readFileSync(path);
      } catch {
        skipped.push(path);
        continue;
      }
      if (data.includes(0)) {
        skipped.push(path);
        continue;
      }
      scannedFiles += 1;
      const lines = data.toString('utf8').split(/\r\n?|\n/);
      for (let index = 0; index < lines.length; index += 1) {
        checkLine(path, index + 1, lines[index]);
      }
    }
  };

  for (const dir of scopeDirs) walk(dir);
  if (credentialPath && existsSync(credentialPath)) {
    findings.push({ file: credentialPath, line: 0 });
  }
  const coverageComplete = skipped.length === 0;
  return {
    passed: findings.length === 0 && coverageComplete,
    findings,
    scannedFiles,
    skipped,
    coverageComplete,
  };
}

// ---------------------------------------------------------------------------
// CLI: node tools/mainnet-guards/mainnet-guards.mjs <destroy|verify> ...
//   destroy --file <abs> [--manifest-out <abs>]
//     exit 0 = destroyed; exit 2 = any error (file left in place).
//   verify --scope <dir> [--scope <dir> ...] [--credential-path <abs>]
//          [--manifest <abs>]
//     exit 0 = clean scoped sweep; exit 1 = findings; exit 2 = usage /
//     I/O error / incomplete coverage (2 overrides 1 when both apply).
//   Success is silent; findings and errors print locations only.
// ---------------------------------------------------------------------------

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) return { error: `Unexpected argument: ${redactText(arg)}` };
    const key = arg.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return { error: `Missing value for --${key}` };
    }
    index += 1;
    if (key === 'scope') {
      flags.scope = flags.scope ?? [];
      flags.scope.push(value);
    } else {
      flags[key] = value;
    }
  }
  return { flags };
}

function cliFail(message) {
  console.error(redactText(message));
  process.exitCode = 2;
}

function cliDestroy(flags) {
  if (!flags.file) return cliFail('Usage: destroy --file <absolute-path> [--manifest-out <absolute-path>]');
  const absolute = resolve(flags.file);
  let manifest = null;
  if (flags['manifest-out']) {
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      return cliFail(`Cannot read credential file for manifest: ${absolute}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return cliFail(`Not a regular file, refusing manifest: ${absolute}`);
    }
    const bytes = readFileSync(absolute);
    manifest = {
      file: absolute,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      length: bytes.length,
      format: 'file',
      destroyedAt: new Date().toISOString(),
    };
  }
  let result;
  try {
    result = destroyCredentialFile(absolute);
  } catch (error) {
    return cliFail(error instanceof MainnetGuardError ? error.message : `Destruction failed: ${absolute}`);
  }
  if (flags['manifest-out']) {
    writeFileSync(resolve(flags['manifest-out']), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  }
  return result;
}

function cliVerify(flags) {
  if (!flags.scope || flags.scope.length === 0) {
    return cliFail('Usage: verify --scope <dir> [--scope <dir> ...] [--credential-path <abs>] [--manifest <abs>]');
  }
  let manifestHash = null;
  if (flags.manifest) {
    try {
      const parsed = JSON.parse(readFileSync(resolve(flags.manifest), 'utf8'));
      if (typeof parsed.sha256 === 'string') manifestHash = parsed.sha256;
    } catch {
      return cliFail(`Cannot read manifest: ${redactText(resolve(flags.manifest))}`);
    }
  }
  const result = verifyNoCopies({
    scopeDirs: flags.scope,
    credentialPath: flags['credential-path'],
  });
  // A file whose bytes hash equals the destroyed credential file's hash is
  // a copy of that file, even if its contents match no secret pattern.
  if (manifestHash) {
    const seen = new Set();
    const hashWalk = (dir) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isSymbolicLink() || !entry.isFile()) {
          if (entry.isDirectory() && !entry.isSymbolicLink()) hashWalk(path);
          continue;
        }
        if (seen.has(path)) continue;
        seen.add(path);
        try {
          const data = readFileSync(path);
          if (data.length <= MAX_SCAN_BYTES && !data.includes(0)) {
            const hash = createHash('sha256').update(data).digest('hex');
            if (hash === manifestHash) result.findings.push({ file: path, line: 0 });
          }
        } catch {
          // Unreadable files are already reported as skipped by verifyNoCopies.
        }
      }
    };
    for (const dir of flags.scope) hashWalk(resolve(dir));
  }
  if (result.findings.length > 0 || result.skipped.length > 0) {
    for (const finding of result.findings) {
      console.error(`${finding.file}:${finding.line}`);
    }
    for (const skippedPath of result.skipped) {
      console.error(`${skippedPath}:0`);
    }
    // Exit 2 (incomplete coverage / error) overrides exit 1 (findings).
    process.exitCode = result.skipped.length > 0 ? 2 : 1;
    return result;
  }
  return result;
}

function main(args) {
  const [command, ...rest] = args;
  if (command === 'destroy') {
    const parsed = parseFlags(rest);
    if (parsed.error) return cliFail(parsed.error);
    cliDestroy(parsed.flags);
    return;
  }
  if (command === 'verify') {
    const parsed = parseFlags(rest);
    if (parsed.error) return cliFail(parsed.error);
    cliVerify(parsed.flags);
    return;
  }
  cliFail('Usage: mainnet-guards.mjs <destroy|verify> [options]');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
