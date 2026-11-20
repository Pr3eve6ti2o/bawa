# Lane evidence archive — 2026-11-20

Archived lane working records from the multichain-registry lane (Lane B,
2026-11-20). Moved here from `lane/` during the Phase 4 layout-makeover
rename lane; nothing was deleted or rewritten. Historical references to the
old `lane/` paths in other archived reports are left as they were.

## Contents

- `evidence/el-*.json` — per-chain registry extracts used by the derivation
  probe, one file per chain, named by chain ID: `el-10.json` (OP Mainnet),
  `el-56.json` (BNB Smart Chain Mainnet), `el-137.json` (Polygon Mainnet),
  `el-8453.json` (Base), `el-42161.json` (Arbitrum One), `el-43114.json`
  (Avalanche C-Chain). Each records the chain name, RPC endpoints, native
  currency and derivation paths. The filenames are opaque element IDs and
  were deliberately not renamed.
- `evidence/wc-registry-extract.json` — 13-chain wallet-core registry
  extract (Bitcoin, Ethereum, TRON, TON plus the nine added chains).
- `evidence/probe-2026-11-20.jsonl` — the 2026-11-20 derivation probe record
  (14 lines). Live source reference in `registry/profiles.json` and
  `ai/profiles/multichain-extended-wallet.md`, updated to this archive path.
- `report-b.md` — Lane B (multichain registry) report.
- `run-log-a.jsonl` … `run-log-e.jsonl` — Sol run logs for the lane.
