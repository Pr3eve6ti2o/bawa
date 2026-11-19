You are editing two small files for the Bawa web wallet (repo at /home/boxd/workspace/bawa-multichain-d-prices, app in apps/web). You have no shell or filesystem access. EMIT ONLY two replacement snippets, each in its own ```ts fenced block, in order, with a one-line `// SNIPPET N replaces: ...` comment before each block. No prose, no other files.

CONTEXT: the live price feed (CoinGecko keyless public API, base https://api.coingecko.com/api/v3) needs exactly one new connect-src origin: https://api.coingecko.com. No wildcard, no other origin. The shared policy lives in apps/web/src/app/security-headers.ts and is pinned by apps/web/src/app/security-headers.test.ts. The old five origins must stay, in the same order, with the new origin appended last.

SNIPPET 1 replaces these exact lines in apps/web/src/app/security-headers.ts:
```
// - connect-src 'self' plus the five pinned provider origins: the
//   same-origin wallet-core.wasm fetch plus the read-only balance/history
//   adapter endpoints — BTC https://mempool.space, ETH
//   https://ethereum-rpc.publicnode.com (RPC) and https://eth.blockscout.com
//   (history), TRX https://api.trongrid.io, TON https://toncenter.com.
//   No other origin, no wildcard. Explorer links (tronscan.org,
//   tonviewer.com) are plain links, not fetches, so they need no entry.
```
and
```
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com",
```
Replacement: the comment becomes the same text with 'five' changed to 'six', and after 'TON https://toncenter.com.' add ' Price feed: CoinGecko https://api.coingecko.com (keyless public API, on-demand quotes only; the optional free Demo key is sent as a header, never as a URL).' The directive becomes `"connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com https://api.coingecko.com",`. Keep every other line of the file unchanged.

SNIPPET 2 replaces these exact lines in apps/web/src/app/security-headers.test.ts:
```
const EXPECTED_CONNECT_SRC =
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com";
```
and
```
  it('CSP blocks plugins, base hijack and framing; connect-src allows only the five pinned provider origins', () => {
```
and
```
    // Exactly five https: origins in the whole policy, all of them in
    // connect-src: mempool.space (BTC), ethereum-rpc.publicnode.com (ETH RPC)
    // + eth.blockscout.com (ETH history), api.trongrid.io (TRX),
    // toncenter.com (TON).
    const httpsOrigins = CONTENT_SECURITY_POLICY.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(httpsOrigins).toEqual([
      'https://mempool.space',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.blockscout.com',
      'https://api.trongrid.io',
      'https://toncenter.com',
    ]);
```
Replacement: EXPECTED_CONNECT_SRC gains ' https://api.coingecko.com' at the end (before the closing quote). The test title changes 'five' to 'six'. The comment changes 'Exactly five' to 'Exactly six' and appends 'api.coingecko.com (CoinGecko price feed).' to the origin list sentence. The expected array gains 'https://api.coingecko.com' as the last entry. Keep every other line of the file unchanged.

CONSTRAINTS: exact pinned origins only, no wildcard, no other origin added, no AVOID-list names.
