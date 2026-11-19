You are helping document the Bawa chain registry. Please be kind and precise — thank you!

TASK: Draft ONE Mermaid flowchart giving an OVERVIEW of chain support. Emit ONLY the Mermaid code block plus up to 3 short lines noting anything you think is missing. Do not invent chains, paths or statuses. The per-chain detail lives in a table elsewhere — your diagram must show the GROUPING only, not 13 separate chain nodes.

VERIFIED FACTS (from registry/capabilities.json and apps/web/src/wallet/chains.ts):
- Source of truth: registry/capabilities.json (chainSupport) and apps/web/src/wallet/chains.ts (ChainId, pathFor, per-chain capabilities with evidence).
- On THIS branch (adopt-proper): 4 chains — BTC, ETH, TRX, TON. All 10 operations (create, derive, restore, receive, balance, history, fee-quote, plan-transfer, local-sign, verify-signature) are IMPLEMENTED_AND_VERIFIED, EXCEPT TON fee-quote and TON verify-signature, which are DOCUMENTED_NOT_TESTED.
- On panel-rebuild/multichain-create: 13 chains — the same 4 plus SOL, BSC, Polygon (matic), Arbitrum (arb), OP Mainnet (op), Base, Avalanche C-Chain (avax), Litecoin (ltc), Dogecoin (doge). For those 9 added chains: create, derive, restore, receive are IMPLEMENTED_AND_VERIFIED; balance, history, fee-quote, plan-transfer, local-sign, verify-signature are NOT_SUPPORTED.
- Derivation paths (account a, index i; TON and SOL are single-address): BTC m/84'/0'/a'/0/i; ETH m/44'/60'/a'/0/i; TRX m/44'/195'/a'/0/i; TON m/44'/607'/0'; SOL m/44'/501'/0'; BSC, Polygon, Arbitrum, OP, Base, Avalanche all m/44'/60'/a'/0/i (EVM coin type 60); LTC m/84'/2'/a'/0/i; DOGE m/44'/3'/a'/0/i.
- Never invent a balance or price. No broadcast anywhere in the repo.

ACCEPTANCE CHECK: valid Mermaid flowchart syntax; at most 9 top-level nodes — group the chains into THREE groups (fully verified: BTC/ETH/TRX; partially verified: TON with its 2 untested operations named; derive-only: the 9 added chains); include accTitle and accDescr lines; label clearly which branch each group describes (adopt-proper vs multichain-create); do NOT list all 13 paths in the diagram (the table carries them).
