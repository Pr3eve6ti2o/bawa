You are editing `apps/web/src/wallet/chains.test.ts` (vitest). The registry
now has 13 chains. SUPPORTED_CHAINS order:
['btc','eth','trx','ton','sol','bsc','matic','arb','op','base','avax','ltc','doge'].
New CHAINS entries (already in chains.ts): sol networkId
'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', bsc 'eip155:56', matic
'eip155:137', arb 'eip155:42161', op 'eip155:10', base 'eip155:8453',
avax 'eip155:43114', ltc
'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
doge 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691'.
Asset IDs are networkId + '/slip44:' + coin type: sol 501, bsc 714, matic
966, arb/op/base 60, avax 9000, ltc 2, doge 3. Paths (account 0 index 0):
sol "m/44'/501'/0'", bsc/matic/arb/op/base/avax "m/44'/60'/0'/0/0'", ltc
"m/84'/2'/0'/0/0'", doge "m/44'/3'/0'/0/0'". Profiles: sol
'bawa-sol-bip44-v1', bsc/matic/arb/op/base/avax 'bawa-evm-bip44-v1', ltc
'bawa-ltc-bip84-v1', doge 'bawa-doge-bip44-v1'. For the 9 new chains,
derive/restore/receive are verified and every other operation is blocked.
`availableFor` returns chains in SUPPORTED_CHAINS order.

CURRENT blocks to replace (verbatim, first 7 tests):

  it('supports exactly four mainnet chains', () => {
    expect([...SUPPORTED_CHAINS].sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
    expect(Object.keys(CHAINS).sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
  });

  it('uses mainnet CAIP-2 network IDs', () => {
    expect(CHAINS.eth.networkId).toBe('eip155:1');
    expect(CHAINS.btc.networkId).toBe(
      'bip122:000000000019d6689c085ae165831e93',
    );
    expect(CHAINS.trx.networkId).toBe('tron:0x2b6653dc');
    expect(CHAINS.ton.networkId).toBe('ton:-239');
  });

  it('uses CAIP-19 native asset IDs via the slip44 namespace', () => {
    expect(CHAINS.btc.assetId).toBe(
      'bip122:000000000019d6689c085ae165831e93/slip44:0',
    );
    expect(CHAINS.eth.assetId).toBe('eip155:1/slip44:60');
    expect(CHAINS.trx.assetId).toBe('tron:0x2b6653dc/slip44:195');
    expect(CHAINS.ton.assetId).toBe('ton:-239/slip44:607');
  });

  it('derives account 0 index 0 paths from the pinned profiles', () => {
    expect(pathFor('btc', 0, 0)).toBe("m/84'/0'/0'/0/0");
    expect(pathFor('eth', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('trx', 0, 0)).toBe("m/44'/195'/0'/0/0");
    expect(pathFor('ton', 0, 0)).toBe("m/44'/607'/0'");
    expect(profileFor('btc')).toBe('bawa-btc-bip84-v1');
    expect(profileFor('eth')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('trx')).toBe('bawa-trx-bip44-v1');
    expect(profileFor('ton')).toBe('bawa-ton-v4r2-v1');
  });

  it('uses a fully hardened TON path with no index suffix', () => {
    expect(pathFor('ton', 0, 1)).toBe("m/44'/607'/0'");
    expect(pathFor('ton', 1, 0)).toBe("m/44'/607'/0'");
  });

  it('lists all four chains for derive, restore and receive', () => {
    expect(availableFor('derive')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('restore')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('receive')).toEqual(['btc', 'eth', 'trx', 'ton']);
  });

  it('lists all four chains for balance and history, and three for fee-quote', () => {
    expect(availableFor('balance')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('history')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON fee-quote stays blocked: it needs the unsigned message (Phase 4).
    expect(availableFor('fee-quote')).toEqual(['btc', 'eth', 'trx']);
  });

EDITS (emit only the 8 replacement it-blocks: the 7 above rewritten plus
one new SOL test after the TON test):
1. First test: rename 'supports exactly thirteen mainnet chains'; sorted
expectations list all 13 ids alphabetically.
2. Network IDs test: keep the 4 original assertions, add one expect per
new chain with the networkId above.
3. Asset IDs test: keep the 4 original assertions, add one expect per new
chain (networkId + slip44 above).
4. Paths/profiles test: keep the 4 original pathFor/profileFor assertions,
add pathFor + profileFor for all 9 new chains.
5. Add a new test 'uses a fully hardened SOL path with no index suffix'
mirroring the TON test: pathFor('sol', 0, 1) and pathFor('sol', 1, 0) both
"m/44'/501'/0'".
6. derive/restore/receive test: rename 'lists all thirteen chains for
derive, restore and receive'; all three expectations list all 13 chains
in SUPPORTED_CHAINS order.
7. balance/history/fee-quote test: rename 'lists the four adapter chains
for balance and history, and three for fee-quote'; balance and history
stay ['btc','eth','trx','ton'], fee-quote stays ['btc','eth','trx'],
keeping the TON comment.
Do NOT change any other test. Emit only the 8 replacement it-blocks as
one TypeScript code block, nothing else.
