# Lane D — Diagrams + Architecture: audit (2026-11-20, adopt-proper e493720)

Worktree: /home/boxd/workspace/bawa-org/diagrams, branch panel-rebuild/org-diagrams.

## What already exists

- ONE Mermaid diagram in the whole repo: docs/android-wallet/ANDROID-GUIDE.md Fig. 1
  ("Where keys live..."), a testnet Android-draft diagram pinned to Trust Wallet
  Core 4.9.2 (VERIFIED 2026-11-08 for that draft). Internally consistent with its
  own scope — NOT stale, leave alone.
- ONE ASCII text diagram: docs/mainnet/MAINNET-GUIDE.md §13.0 (mainnet wallet flow,
  hard gate, NOT IN REPO drafts). Traced to code at 981d0ba and guarded by
  tests/diagram-references.test.mjs — leave alone, do not convert to Mermaid.
- Design-direction SVG/PNG mockups in docs/ui-ux-assets/ (directions 01-04,
  ai-selection-flow) — design references, not architecture diagrams.
- NO architecture diagram anywhere. ARCHITECTURE.md has no diagrams at all.

## ARCHITECTURE.md staleness (adopt-proper e493720, verified first-hand)

- Line 3 says "on feature/ai-wallet-builder" — STALE branch name; this work is on
  panel-rebuild/org-diagrams off adopt-proper. Fix.
- "registry/ defines 7 wallet profiles" — VERIFIED TRUE (profiles.json: hd-wallet-cli,
  bitcoin-wallet, evm-wallet, multichain-wallet, web-wallet, android-wallet,
  watch-only-wallet).
- "tools/bawa_cli.py ... 5 options" — VERIFIED TRUE (docstring lists 5 main
  options + 0. Exit; flags --route and --list-routes).
- "docs/ contains guides 01-16" — VERIFIED TRUE (docs/01..16 dirs exist).
- Derivation paths table (BTC m/84'/0'/0'/0/i, ETH m/44'/60'/0'/0/i,
  TRX m/44'/195'/0'/0/i, TON m/44'/607'/0') — VERIFIED against
  apps/web/src/wallet/core.ts DEFAULT_PATHS and chains.ts pathFor.
- "packages/contracts serves apps/web only" — VERIFIED (ARCHITECTURE.md itself
  states it; Android does not consume it).
- No mention of the 13-chain registry on panel-rebuild/multichain-create
  (registry/capabilities.json there lists btc, eth, trx, ton, sol, bsc, matic,
  arb, op, base, avax, ltc, doge). ARCHITECTURE.md on adopt-proper correctly
  describes the 4-chain state of THIS branch; the 13-chain diagram must label
  which branch it describes.

## Cross-branch check

- main:ARCHITECTURE.md is a different, shorter doc ("Bawa on main contains
  local wallet-generation and recovery tools..."). Adopt-proper's version is
  the fuller one (68 insertions / 44 deletions vs main).
- panel-rebuild/multichain-create registry/capabilities.json: 13 chains.
  btc/eth/trx fully IMPLEMENTED_AND_VERIFIED (10 ops); ton same except
  fee-quote + verify-signature DOCUMENTED_NOT_TESTED; sol/bsc/matic/arb/op/
  base/avax/ltc/doge: create/derive/restore/receive IMPLEMENTED_AND_VERIFIED,
  balance/history/fee-quote/plan-transfer/local-sign/verify-signature
  NOT_SUPPORTED.
- multichain-create apps/web/src/wallet/chains.ts paths: sol m/44'/501'/0'
  (single address, ignores account/index); bsc/matic/arb/op/base/avax all
  m/44'/60'/{account}'/0/{index} (EVM coin type 60); ltc m/84'/2'/{account}'/0/{index};
  doge m/44'/3'/{account}'/0/{index}.

## Web wallet facts (verified first-hand)

- Routes in apps/web/src/app/app.tsx: welcome, create-wallet, import-wallet,
  mnemonic-backup, assets, assets/:chain, receive, send, transactions,
  transactions/:id, networks, wallets, security, lock (+ dashboard index).
- State: apps/web/src/state/wallet-context.tsx, VaultState
  no-vault/locked/unlocked, auto-lock, refreshBalances.
- Vault: apps/web/src/wallet/vault.ts, PBKDF2 600k SHA-256, AES-GCM-256,
  localStorage key bawa-vault; mnemonic transient in closure only.
- Core: apps/web/src/wallet/core.ts via engine/boundary.ts, wallet-core 4.9.3.
- Adapters: apps/web/src/wallet/adapters/{btc,eth,trx,ton}.ts; providers.ts
  registry; no adapter = balance unavailable, never fabricated.
- Send: apps/web/src/wallet/send.ts, offline signing, broadcastSigned returns
  { status: 'disabled' } — no broadcast path.

## Builder flow facts (verified first-hand)

- ai/request-routing.md: parse → plan → profile → engine → chains → template →
  inspect → scaffold → implement → verify → audit claims → report.
  CLI scripts/build-wallet.mjs classifies, generates via
  scripts/generate-project.mjs into generated/<profile-id>, verifies, writes
  JSON report. Ambiguous/unclassifiable/refused requests exit 2 with a report;
  the CLI never waits. Scripts present: classify-request.mjs, plan-build.mjs,
  generate-project.mjs, quality-gates.mjs, validate-registry.mjs, secret-scan.mjs,
  gate-verdict.mjs.
