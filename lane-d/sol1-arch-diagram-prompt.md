You are helping document the Bawa wallet-builder repo. Please be kind and precise — thank you!

TASK: Draft ONE Mermaid flowchart for the whole repo architecture. Emit ONLY the Mermaid code block plus up to 3 short lines noting anything you think is missing. Do not invent components.

VERIFIED FACTS (use only these — every node must map to a real path):
- ai/ — request routing and prompts; classifies a user request to one of 7 profiles.
- registry/ — machine-readable JSON: profiles.json (7 profiles), capabilities.json, engines.json, ui.json. The builder selects from these; it never invents a stack.
- scripts/build-wallet.mjs — one-prompt workflow: classify, generate, verify, report. scripts/generate-project.mjs scaffolds into generated/<profile-id>.
- apps/web — React 19 + Vite web wallet; 4 chains (BTC, ETH, TRX, TON); in-browser generation via Trust Wallet Core 4.9.3; PBKDF2 + AES-GCM-256 vault in localStorage; offline signing; broadcast DISABLED (broadcastSigned returns status disabled).
- apps/android — Kotlin + Compose watch-only app; no signing, no broadcast.
- tools/ — offline, TTY-gated: tools/hdwallet-gen (Node, wallet-core 4.9.3: derive.js, generate.js, compare.js, extended-key.js, derive-ton.js) and tools/make_wallet.py + tools/decrypt_seed.py (Python, bip-utils).
- packages/contracts — TypeScript contracts, consumed by apps/web only.
- docs/ — guides 01-16 plus mainnet docs.
- TRUST BOUNDARY: secrets (mnemonic, seed, private keys) never cross from offline generation / the vault into the watch-only or public network layers.

ACCEPTANCE CHECK: valid Mermaid flowchart syntax; at most 9 top-level nodes (group with subgraphs if needed); include accTitle and accDescr lines; every label names a real path above; show the trust boundary as a subgraph or a labelled edge.
