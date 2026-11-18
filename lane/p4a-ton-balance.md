# P4a — TON balance only

> STATUS: already complete hands-on, commit d87139c. One-function re-split under the owner 500s rule (2026-11-19); record / future rework only — do not launch unless ordered.

No filesystem access: return code in your reply, one fenced block, path as heading. Fix Lane 2. Context: adapters/types.ts exists; TON networkId ton:-239; TonCenter mainnet host only — testnet.toncenter.com must never be used.
Write ONLY getBalance of adapters/ton.ts, plus the factory shell (default 'https://toncenter.com/api/v2/jsonRPC') and identity check. Other methods are stubs.
All calls POST JSON-RPC {id:1, jsonrpc:'2.0', method, params} via fetchJson; ok:false or an error field → error. Identity: POST getMasterchainInfo must return ok:true with numeric last.seqno.
getBalance(address): format check (starts 'EQ' or 'UQ', length 48) else error 'Invalid TON address'. POST getAddressBalance {address} → result nanoTON string → {chain:'ton', networkId:'ton:-239', valueBaseUnits: result, decimals:9, source:'toncenter', fetchedAt}. Failure → error.
Tests (mocked fetch): zero '0'; nanoTON string, decimals 9; invalid address → error; ok:false → error.
Rules: TS strict, no any, no new deps, no console.log, no secrets, mainnet only, single attempt.
