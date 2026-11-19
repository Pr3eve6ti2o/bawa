Hi Sol, please help with a small naming review for the Bawa repo. You are Lane A (naming) support. I verified each file's contents first-hand on the branch panel-rebuild/adopt-proper; judge ONLY whether the current name is confusing, misleading, or inconsistent, and suggest a better name or say KEEP. Do not invent contents. Do not rename for the sake of it: a name that is merely plain but clear should be KEEP.

Context: scripts/ holds the AI Wallet Builder workflow (Node .mjs). tools/ holds offline wallet tools (Python + Node). Naming convention in the repo: kebab-case for JS/TS files, snake_case for Python files (Python convention).

Items (current path — what it actually contains):
1. scripts/build.mjs — builds the web and/or Android platform apps (usage: node scripts/build.mjs [--platform web|android|all] [--skip-install]). Its sibling scripts/build-wallet.mjs is the one-prompt workflow (classify a plain-language request, generate a project, verify it, write a JSON report).
2. scripts/gate-verdict.mjs — a pure function that prints the quality-gates verdict line; it is used by scripts/quality-gates.mjs, which actually runs the gates.
3. scripts/classify-request.mjs — classifies a plain-language wallet request to a registry profile. Compare ai/detect-capabilities.mjs, which checks the local toolchain capabilities (Node, Python, tools installed).
4. scripts/plan-build.mjs — planner that proves a request matches a profile. Compare scripts/generate-project.mjs, which generates a project for one profile.
5. tools/hdwallet-gen/derive_daemon.js — a JSONL daemon that derives watch-only addresses from extended public keys. It is the ONLY snake_case JS file in the whole repo; every other JS file is kebab-case. Its siblings: derive.js (derive one address from an xpub), generate.js (generate a fresh wallet), compare.js (derive addresses from xpubs for comparison in smoke tests), extended-key.js (shared extended-key validation), derive-ton.js (TON derivation).
6. tools/verify-sign/run-verify-sign.mjs — the only file in tools/verify-sign/, it runs the verify-sign check.
7. tools/mainnet-fees/fees.mjs, tools/mainnet-guards/mainnet-guards.mjs, tools/mainnet-signing/local-signing.mjs, tools/mainnet-tx/unsigned-tx.mjs — each directory holds exactly one .mjs file, and each filename repeats (or nearly repeats) its directory name.

Reply as a short table, one row per item: current path | verdict KEEP or RENAME | new name (blank if KEEP) | one-line reason. Acceptance check: every numbered item gets a verdict with a reason, and no rename is proposed without a concrete confusion it fixes. Keep the whole reply under 400 words. Thank you.
