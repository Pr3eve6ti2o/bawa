# P2 — ETH adapter via viem (Bawa wallet rebuild, Fix Lane 2, Phase 2)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced ts block per file, path as heading. Output code, not descriptions.

Context: apps/web; adapters/types.ts (ChainAdapter, AdapterResult, fetchJson, assertNetworkId, BROADCAST_DISABLED_MESSAGE); chains.ts (ETH networkId eip155:1); viem 2.58.0 installed.

Write apps/web/src/wallet/adapters/eth.ts + eth.test.ts; update adapters/index.ts registerAllAdapters to register ETH.

`createEthAdapter(overrides?: { client?: PublicClient; historyBaseUrl?: string; rpcUrl?: string }): ChainAdapter`:
- Client: viem createPublicClient({ chain: mainnet, transport: http(rpcUrl ?? 'https://ethereum-rpc.publicnode.com') }); never viem's default RPC.
- Chain identity: every call first runs client.getChainId(); MUST be 1, else {status:'error', reason:'Network identity mismatch: expected chain 1 (eip155:1), got <id>'}.
- getBalance(address): isAddress check, else {status:'error', reason:'Invalid Ethereum address'}. client.getBalance({address}) → AdapterBalance {chain:'eth', address: checksum via getAddress, networkId:'eip155:1', valueBaseUnits: wei decimal string, decimals:18, source:'publicnode', fetchedAt:Date.now()}. RPC failure → {status:'error', reason:<viem message>}. toBalanceProvider returns {value: valueBaseUnits} on ok, throws Error(reason) otherwise.
- getHistory(address, limit=20): Blockscout GET `${historyBaseUrl ?? 'https://eth.blockscout.com/api'}?module=account&action=txlist&address=<addr>&page=1&offset=<limit>&sort=desc` via fetchJson. 'No transactions found' → ok []. Map: hash; direction by from/to vs address case-insensitive (both → 'self'); amountBaseUnits = value wei string; counterparty = other side (null for self); timestamp = Number(timeStamp)*1000; status 'confirmed' if txreceipt_status==='1' else 'failed'; explorerUrl `https://eth.blockscout.com/tx/<hash>`.
- estimateFee(): gasPrice = await client.getGasPrice(); feeBaseUnits = (gasPrice * 21000n).toString(), unit 'wei', note 'Native-transfer estimate at current gas price, 21000 gas; not a final fee'.
- getTxInputs(address): nonce = await client.getTransactionCount({address}); return {kind:'nonce', nonce}.
- broadcast: throw BROADCAST_DISABLED_MESSAGE, never send.

Tests (vitest, mocked client + fetch): balance exact wei string, decimals 18; zero balance '0' (not error); chainId 11155111 → identity error; invalid address → error; history in/out/self + failed + empty; fee = gasPrice*21000; nonce input; broadcast throws disabled message; RPC throw → error result.

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only, single attempt per call (no retry).
