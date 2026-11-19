// SNIPPET 1 replaces: apps/web/src/app/security-headers.ts
```ts
// - connect-src 'self' plus the six pinned provider origins: the
//   same-origin wallet-core.wasm fetch plus the read-only balance/history
//   adapter endpoints — BTC https://mempool.space, ETH
//   https://ethereum-rpc.publicnode.com (RPC) and https://eth.blockscout.com
//   (history), TRX https://api.trongrid.io, TON https://toncenter.com. Price feed: CoinGecko https://api.coingecko.com (keyless public API, on-demand quotes only; the optional free Demo key is sent as a header, never as a URL).
//   No other origin, no wildcard. Explorer links (tronscan.org,
//   tonviewer.com) are plain links, not fetches, so they need no entry.

  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com https://api.coingecko.com",
```

// SNIPPET 2 replaces: apps/web/src/app/security-headers.test.ts
```ts
const EXPECTED_CONNECT_SRC =
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com https://api.coingecko.com";

  it('CSP blocks plugins, base hijack and framing; connect-src allows only the six pinned provider origins', () => {

    // Exactly six https: origins in the whole policy, all of them in
    // connect-src: mempool.space (BTC), ethereum-rpc.publicnode.com (ETH RPC)
    // + eth.blockscout.com (ETH history), api.trongrid.io (TRX),
    // toncenter.com (TON), api.coingecko.com (CoinGecko price feed).
    const httpsOrigins = CONTENT_SECURITY_POLICY.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(httpsOrigins).toEqual([
      'https://mempool.space',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.blockscout.com',
      'https://api.trongrid.io',
      'https://toncenter.com',
      'https://api.coingecko.com',
    ]);
```