# CSP lane prompt 1 — widen connect-src to the five pinned adapter origins (open item 22)

Worktree: /home/boxd/workspace/bawa-panel-rebuild/fix-csp
Branch: panel-rebuild/fix-csp (base panel-rebuild/pr2 at 5638eea). LOCAL ONLY — do not push, do not create branches.

## Exact change (two files only)

### 1. apps/web/src/app/security-headers.ts
Replace the connect-src directive:
  OLD: "connect-src 'self'",
  NEW: "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com"
That is the complete list — exactly these five origins, no other origin, no wildcard, no http: scheme.
Also fix the now-wrong comment on the line above it (currently: the only fetch is the same-origin wallet-core.wasm). Rewrite it to state the truth: same-origin WASM fetch plus the five pinned read-only provider origins used by the balance/history adapters (BTC mempool.space, ETH publicnode RPC + Blockscout history, TRX api.trongrid.io, TON toncenter.com). Also fix the header comment line "Everything is same-origin" / "loads no third-party ... network resource" if it still claims that — it is no longer true for network fetches; keep scripts/styles/fonts/images same-origin as they are.
Do NOT touch any other directive. Do NOT touch vite.config.ts — it imports this shared string already (verified).

### 2. apps/web/src/app/security-headers.test.ts
Update the tests to assert the new policy:
- The first test currently asserts the whole CSP contains no 'https:' — that assertion is now wrong and must be replaced with scoped checks: script-src contains no https: origin, no '*' anywhere in the CSP, no 'http:' (plain http) anywhere. Keep the exact script-src match and the style-src check.
- The second test currently asserts connect-src 'self' exactly and is titled "blocks plugins, base hijack, framing and off-origin fetches" — update it to assert the exact new connect-src string above, and rename/adjust the title so it no longer claims all off-origin fetches are blocked (only non-pinned ones are). Add an assertion that the CSP contains exactly those five https origins and no other https origin (e.g. extract the connect-src directive and compare it exactly).
- Keep all other assertions (object-src, base-uri, frame-ancestors, form-action, preview headers, WASM pin) unchanged.

## Hard limits
- Do NOT touch any broadcast/send path, wallet generation, derivation, vault, or signing code. Do NOT add a price feed or invent prices. Do NOT add demo/fake data. Do NOT touch any other file.

## Acceptance check (run in the worktree, apps/web as needed)
- Run the vitest suite for the security-headers test file and confirm it passes.
- Show the exact final connect-src line and the git diff (git diff --stat and git diff for the two files) in your output.

## Output
Write a short report: the two files changed, the exact new connect-src string, the test results, and the git diff. Do not commit — leave changes uncommitted for the lane agent to verify and commit.
