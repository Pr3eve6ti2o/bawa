# P2a — ETH balance only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; ETH networkId eip155:1; viem 2.58.0 installed.
Write ONLY getBalance of adapters/eth.ts, plus the factory shell and identity check. Other methods are stubs.
Factory: viem createPublicClient({chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com')}); never viem's default RPC. Every call first runs client.getChainId(); must be 1, else error 'Network identity mismatch: expected chain 1 (eip155:1), got <id>'.
getBalance(address): invalid → error 'Invalid Ethereum address'. Else client.getBalance({address}) → {chain:'eth', address: checksum via getAddress, networkId:'eip155:1', valueBaseUnits: wei string, decimals:18, source:'publicnode', fetchedAt: Date.now()}. RPC failure → error.
Tests (mocked client): exact wei string; zero '0' not error; chainId 11155111 → identity error; invalid address → error; RPC throw → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
