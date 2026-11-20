# Verification Lane A — Build + Test Suite (§6 item 9)

## Verdict: PASS

All four checks pass on the Fix Lane 2 state. No failures, no fixes made (verification lane only).

## Scope

- Branch: panel-rebuild/verify-build (new worktree, created off panel-rebuild/fix-adapters)
- Commit verified: fe6fd76 — "Fix Lane 2: Phase 2+3 evidence + 500s prompt re-split (final)"
- Worktree: /home/boxd/workspace/bawa-panel-rebuild/verify-build (muse-vm)
- Verified: 2026-11-19 ~04:29 IST (2026-11-18 22:59 UTC)
- Working directory for all commands: apps/web in the worktree
- Sol calls made: 0 (hands-on verification only; no model call was needed)

## Environment

- Node: v22.23.4 via nvm (repo engines require >=22 <23; VM default v24.22.2 would fail npm ci with EBADENGINE)
- npm: 10.9.9
- Install first: npm ci — added 275 packages, audited 277 packages in 7s, found 0 vulnerabilities, exit 0

## 1. Typecheck — npx tsc --noEmit

- Exit code: 0
- Output: (empty — no type errors)

## 2. Test suite — npm test (vitest run)

- Exit code: 0
- Test Files: 29 passed (29)
- Tests: 281 passed (281), 0 failed, 0 skipped
- Duration: 9.78s (transform 5.30s, setup 0ms, import 13.93s, tests 11.45s, environment 8.98s)
- Start: 22:56:28 UTC
- Notes on stderr noise (not failures): two "Aborted(Assertion failed: Exception thrown, but exception catching is not enabled...)" lines come from src/wallet/core.test.ts tests that deliberately prove the known TRX 33-byte WASM abort and the BTC mirror-image rule (65-byte aborts, 33-byte works). Both tests pass. Two ReactDOMTestUtils.act deprecation warnings appear in mnemonic-backup and app tests; they do not fail anything.

## 3. Production build — npm run build

- Exit code: 0
- Built in 6.10s (vite v8.3.8, 3082 modules transformed)
- WASM step: copied wallet-core.wasm -> public/wallet-core.wasm (sha256 verified)
- Build runs tsc --noEmit first as part of the script, so the typecheck is covered twice
- Output artifacts confirmed present: dist/index.html (0.76 kB), dist/wallet-core.wasm, dist/assets/index-CJOXFLgY.js, dist/assets/index-De2vjgTC.css (473.41 kB, gzip 171.75 kB)
- Warnings (advisory only, not failures):
  - Chunk size: index JS chunk is 3,595.96 kB (gzip 500.37 kB), over the 500 kB advisory limit. Vite suggests dynamic import() code-splitting or raising build.chunkSizeWarningLimit.
  - Vite configLoader native warning: vite.config.ts imports ./src/app/security-headers without a file extension (vite.config.ts:7:8).
  - Four Node built-ins externalized for browser compatibility by rolldown:vite-resolve — fs/promises and fs/crypto from @trustwallet/wallet-core, node:worker_threads from ox. Expected for a browser bundle using wallet-core; build still succeeds.

## 4. Security check — npm audit

- Exit code: 0
- Result: found 0 vulnerabilities
- (npm ci audit agreed: 0 vulnerabilities across 277 packages)

## Raw logs

Full untruncated logs are kept untracked in the worktree root (not committed): npm-ci.log, check-node.log, check-tsc.log, check-test.log, check-build.log, check-audit.log, checks-done.flag.

## Open items

- None blocking. The chunk-size warning (3.6 MB single JS chunk) is a performance/code-splitting note for a later lane, not a §6 item 9 failure.
