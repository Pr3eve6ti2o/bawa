# Mainnet guards (T25)

Gate mainnet test work so temporary unfunded credentials can never leak
and no mainnet state can ever change. Implementation:
`tools/mainnet-guards/mainnet-guards.mjs`; tests:
`tests/mainnet-guards.test.mjs`; wired into the quality gates
(`scripts/quality-gates.mjs`, phase9-tests).

Standing rules this enforces (verbatim from the owner authorisation):

- Temporary unfunded test credentials ONLY; never reuse
  personal/production credentials; keep credentials isolated from the
  repository and source control.
- NEVER print, log, upload or expose private keys or seed phrases.
- Do NOT fund these wallets.
- Securely destroy temporary credentials after testing and verify no
  copies remain.
- STOP BEFORE BROADCASTING. ABSOLUTELY DO NOT broadcast transactions,
  transfer funds, send tokens/coins, execute smart-contract transactions,
  approve token allowances, sign/submit with personal/funded wallets, or
  perform any operation changing mainnet state or creating financial
  obligations.
- Transactions may be constructed and locally signed using temporary,
  unfunded test credentials, but they must NEVER be broadcast.
- M-35 execution is NOT authorised. Do NOT claim transaction execution
  or end-to-end payment is verified.

## The three guards

### 1. No-print / no-log / no-upload

`redactText(text)` replaces secret-shaped material with `[REDACTED]`:

- `xprv` / `zprv` literals (100+ base58 characters).
- WIF-shaped strings (51–52 base58 characters starting `5`, `K` or `L`).
- The value of a secret assignment: a field named `mnemonic`,
  `private_key` / `private-key`, `seed` / `seed_phrase`, `wif`,
  `xprv` / `zprv`, followed by `=` or `:`, then a quoted value, an
  unquoted multi-word mnemonic value, or a single token. Only the
  value is redacted; the field name stays.
- A 64-hex string is redacted ONLY as such an assignment value.

`containsSecret(text)` reports whether redaction would change the
text. `guardedLog(logFn, ...args)` joins its arguments, redacts the
result, calls `logFn` once with the redacted string, and returns the
redaction count. All mainnet lane output (T26–T36) must go through
`guardedLog` or an equivalent redacted sink. Never use `console.log`
with unredacted mainnet output.

What is deliberately NOT redacted: public addresses and transaction
hashes. A bare 64-hex string is never redacted, because it is
indistinguishable from a transaction hash — so a 64-hex private key
must never be handled as bare free text. Keep it behind a secret
field name, or pass it to `fingerprintSecret` / `verifyNoCopies` in
memory.

### 2. No-broadcast gate

`assertOperationAllowed(op, options)` returns `true` or throws
`MainnetGuardError`. The read-only allowlist is `getBalance`,
`getChainId`, `call` (unsigned, non-persistent only), `estimateGas`
(unsigned RPC simulation only: no signing, no broadcasting, no
persistent state change).

Forbidden, each with a message starting `STOP BEFORE BROADCASTING:`
and ending `M-35 execution NOT authorised.`: `sendTransaction`,
`sendRawTransaction`, `broadcast`, `broadcastTransaction`,
`transfer`, `sendToken`, `transferFrom`, `safeTransferFrom`,
`approve`, `permit`, `setApprovalForAll`, `increaseAllowance`,
`decreaseAllowance`, `deploy`, `createContract`, `execute`,
`writeContract`, `sendUserOperation`, `sendCalls`. Any other
operation — including anything routed through `request`, `send` or
`batch` — is forbidden as not allowlisted.

Signing (`sign`, `signTransaction`, `signMessage`, `signTypedData`,
`signAuthorization`) is allowed ONLY when `options` is exactly
`{ credentialKind: 'temporary-unfunded', localOnly: true }`, i.e.
local signing in an isolated test environment with temporary
unfunded credentials, for a signature that is never broadcast.
Every other signing attempt is forbidden. Signing with a
personal or funded wallet is always forbidden.

Call `assertOperationAllowed` before every mainnet operation in a
lane. A thrown `MainnetGuardError` is a hard stop for that lane
step, not something to catch and continue past.

### 3. Destruction + no-copy verification

`destroyCredentialFile(filePath)` wipes one credential file: it
opens with `O_NOFOLLOW`, requires a regular file with exactly one
hard link, overwrites the full length three times (CSPRNG bytes,
then zeros, then CSPRNG bytes, `fsync` after every pass), rechecks
that the pathname still names the same inode at the same size, then
unlinks and `fsync`s the parent directory. Any failure leaves the
file in place and throws `MainnetGuardError` — a half-wiped
credential is never silently dropped. Files over 64 MiB are refused
(a credential file is small; refuse rather than guess).

`fingerprintSecret(secret)` returns `{ sha256, length, format }`
for a secret held in memory: the SHA-256 hash, byte length and a
coarse format label (`mnemonic`, `hex64`, `extended-private`,
`wif`, `opaque`). Only the hash ever leaves memory; the secret
itself is never stored, printed or written.

`verifyNoCopies({ scopeDirs, secrets, credentialPath, excludeDirs })`
sweeps a declared scope and returns `{ passed, findings,
scannedFiles, skipped, coverageComplete }`. It reports a finding
(`{ file, line }`, locations only, never matching text) when a file
contains an in-memory secret or one of its JSON-escaped, URL-encoded
or base64 variants, or any secret-shaped pattern, or when the
credential pathname still exists. Symlinks are never followed,
binary files and files over 5 MiB are recorded as skipped, and
`passed` is true only with zero findings AND zero skipped —
incomplete coverage is a failure, not a pass.

## CLI

```sh
node tools/mainnet-guards/mainnet-guards.mjs destroy --file "$CRED" [--manifest-out "$FP"]
node tools/mainnet-guards/mainnet-guards.mjs verify --scope "$SCOPE" [--scope ...] [--credential-path "$CRED"] [--manifest "$FP"]
```

`destroy` exits 0 when destroyed, 2 on any error. `verify` exits
0 for a clean scoped sweep, 1 for findings, 2 for usage errors,
I/O errors or incomplete coverage (2 overrides 1 when both apply).
Success is silent; findings and errors print locations only
(`path:line`). The manifest (`--manifest-out` / `--manifest`) holds
only the destroyed file's SHA-256, length and format — never a
secret — and `verify` additionally flags any in-scope file whose
bytes hash equals the destroyed file's hash.

## Rules for lanes T26–T36

| What is forbidden | How it is enforced | How destruction is verified |
| --- | --- | --- |
| Printing, logging, uploading or exposing a private key or seed phrase | All output through `guardedLog`; `redactText` scrubs xprv/zprv, WIF, and secret-assignment values before anything is emitted | `verifyNoCopies` sweeps the lane work dir, logs and temp paths for secret patterns and in-memory secret variants; findings are `path:line` only |
| Reusing personal / production credentials | Lanes generate fresh temporary credentials only; `assertOperationAllowed` signing allowance requires `credentialKind: 'temporary-unfunded'` | `fingerprintSecret` records only the hash; no personal credential ever enters a lane |
| Funding a test wallet | No funding operation exists in the allowlist; any transfer/send is forbidden | Balance checks are read-only (`getBalance`); a non-zero balance on a test wallet is itself a finding to report, not to use |
| Broadcasting, transferring, sending tokens, executing contracts, approving allowances, any state-changing operation | `assertOperationAllowed` throws `MainnetGuardError` (`STOP BEFORE BROADCASTING … M-35 execution NOT authorised.`) for every non-allowlisted operation | No broadcast path exists in the guards; lanes stop before broadcasting by construction, and the gate is asserted before every operation |
| Signing with a personal / funded wallet | Signing is allowed only with `{ credentialKind: 'temporary-unfunded', localOnly: true }` | Signing calls are logged (redacted) with their credential kind; any other signing throws |
| Leaving credential copies behind | `destroyCredentialFile` (3-pass overwrite + fsync + unlink + dir fsync) runs at the end of every lane; never unlink after a failed overwrite | `verifyNoCopies` must return `passed: true` (zero findings, complete coverage) over the declared scope; CLI `verify` must exit 0 |
| Claiming execution is verified | Nothing in the guards can broadcast, so nothing can produce execution evidence; M-35 stays a separate gate | The lane report records the `verify` exit code and the scope swept — not a claim of execution |

## Known limitations (do not work around them silently)

- The sweep establishes scoped detection results, not universal
  absence. Declare the scope completely (lane work dir, log files,
  temp dirs, any path a credential touched). Copies outside the
  declared scope are not covered.
- Destruction cannot certify physical erasure on SSD, copy-on-write,
  journaled or snapshotted storage. Where the storage may retain
  blocks, note it in the lane report as erasure-unverified.
- Bare BIP-39 phrases are not pattern-matched as free text (no
  wordlist is bundled; word runs false-positive). Cover them via the
  mnemonic/seed assignment form and via `verifyNoCopies` with the
  phrase supplied in memory.
- Bare 64-hex private keys are never redacted (indistinguishable
  from transaction hashes). Never handle one as bare free text.
- The guards do not weaken any security control to make a test
  pass. If a guard blocks a lane step, the step is blocked: record
  it and continue with other work.
