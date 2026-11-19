| Current path | Verdict | New name | One-line reason |
|---|---|---|---|
| `scripts/build.mjs` | RENAME | `build-platforms.mjs` | Bare “build” is ambiguous beside `build-wallet.mjs`; this distinguishes web/Android app builds from the one-prompt workflow. |
| `scripts/gate-verdict.mjs` | KEEP | | Clearly names verdict output, distinct from `quality-gates.mjs`, which runs the gates. |
| `scripts/classify-request.mjs` | KEEP | | Accurately names request classification, not the toolchain detection performed by `detect-capabilities.mjs`. |
| `scripts/plan-build.mjs` | KEEP | | Fits its planning/profile-matching role; “plan” distinguishes it from project generation. |
| `tools/hdwallet-gen/derive_daemon.js` | RENAME | `derive-daemon.js` | Fixes the sole snake_case JS filename while preserving its clear derivation-daemon meaning. |
| `tools/verify-sign/run-verify-sign.mjs` | KEEP | | Clearly identifies the check it runs; repeating the directory name causes no confusion. |
| `tools/mainnet-fees/fees.mjs`<br>`tools/mainnet-guards/mainnet-guards.mjs`<br>`tools/mainnet-signing/local-signing.mjs`<br>`tools/mainnet-tx/unsigned-tx.mjs` | KEEP | | Each filename identifies its tool; directory-name repetition alone is neither misleading nor inconsistent. |