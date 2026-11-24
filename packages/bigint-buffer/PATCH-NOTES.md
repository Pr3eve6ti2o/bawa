# bigint-buffer 1.1.6 — Bawa security fork of 1.1.5

## What this is

A vendored, minimally patched copy of
[`bigint-buffer@1.1.5`](https://github.com/no2chem/bigint-buffer) (Apache-2.0;
`LICENSE` kept verbatim), held in this repo because upstream has published
**no fixed version**.

## Why it exists

`npm audit` reports **GHSA-3gc7-fjrx-p6mg** — "bigint-buffer Vulnerable to
Buffer Overflow via toBigIntLE() Function" (CWE-120, CVSS 7.5) — against
every published version (`<=1.1.5`; 1.1.5 is the latest on the registry).
The overflow is in the **native C binding** (`src/bigint-buffer.c`, loaded
via the `bindings` package in `dist/node.js`). There is no published
version to upgrade to, and the only audit-suggested fix is a downgrade of
`@solana/spl-token` to the ancient 0.1.8, which is incompatible with the
`@solana/web3.js@3.2.1` the same audit suggests and would break SPL support.

## What changed vs 1.1.5

- `dist/node.js`: the `require('bindings')('bigint_buffer')` block is
  removed, so `converter` stays `undefined` and the package's own pure-JS
  implementation runs unconditionally. That implementation is the same code
  the browser build (`dist/browser.js`, unchanged) already runs, and the
  same fallback this install already used — no native binding was ever
  built in this repo's install (`npm ci` prints "Failed to load bindings,
  pure JS will be used").
- `src/index.ts`: the same removal, for source fidelity.
- Deleted, no longer applicable: `binding.gyp`, `src/bigint-buffer.c`,
  `src/index.spec.ts`, `src/index.bench.ts`, `helper/`, `karma.conf.js`,
  `rollup.config.js`, `tsconfig.json`, `.travis.yml`,
  `dist/index.spec.d.ts`, `dist/index.bench.d.ts`.
- `package.json`: version `1.1.6` (one patch above the vulnerable range so
  the advisory no longer matches), `bindings` dependency and all
  build/test scripts removed. No other code changed.
- `dist/browser.js` and `dist/index.d.ts` are byte-identical to 1.1.5.

## Equivalence evidence

The fork was checked against the original 1.1.5 pure-JS implementation with
a 30-case vector battery (empty / 1-byte / 3-byte / 8-byte / 16-byte inputs,
u64 and u128 maxima, LE and BE, encode and decode round-trips, including the
SPL amount 25,000,000 used by the wallet's tests). Outputs are identical —
see `apps/web/src/wallet/bigint-buffer-patch.test.ts`, which pins those
vectors in the suite. The existing suite (spl-token instruction decoding,
which exercises u64 through this package) and the CDP SOL/SPL signing proof
also run against the fork.

## Maintenance

If upstream ever publishes a fixed version (>1.1.5), prefer it: delete this
directory, drop the `bigint-buffer` override in `apps/web/package.json`,
re-install, and re-run `npm audit` plus the gates and the SOL signing proof.
Until then this fork is the fix, not a suppression — the vulnerable code is
not present in this copy at all.
