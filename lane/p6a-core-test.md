You are editing `apps/web/src/wallet/core.test.ts` (vitest). The wallet now
derives 13 chains: btc, eth, trx, ton, sol, bsc, matic, arb, op, base,
avax, ltc, doge. SOL behaves like TON (one address per wallet: account
and index ignored). LTC/DOGE derive from extended public keys like BTC.
SOL rejects deriveFromXpub like TON.

Verified LTC/DOGE fixtures (Wallet Core 4.9.3 probe 2026-11-20):
LTC Ltub:
'Ltub2ZANw57Fi4JfMGenngwfZMqDrsccTf2m3qEjvLuk8faGXB973sSqGttAdKBvGSCLG9DXh2yxaUB9qpwQUe2zCCtrZPhjxGuMAWqL6F7Xrpd'
derives index 0 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'.
DOGE dgub:
'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs'
derives index 0 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC'.

CURRENT blocks to replace (verbatim):

const btcZpub =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';

  it('restores with identical derived addresses on all four chains', async () => {
    const mnemonic = await createWallet();
    const first = await deriveAddresses(mnemonic);
    const restored = await restoreWallet(mnemonic);
    expect(restored).toBe(mnemonic);
    const second = await deriveAddresses(restored);
    expect(second).toEqual(first);
    expect(first.btc.startsWith('bc1q')).toBe(true);
    expect(first.eth.startsWith('0x')).toBe(true);
    expect(first.trx.startsWith('T')).toBe(true);
    expect(first.ton.startsWith('UQ')).toBe(true);
    expect(first.ton).toHaveLength(48);
  });

  it('deriveAddressesAt changes btc/eth/trx at index 1 but not TON', async () => {
    const mnemonic = await createWallet();
    const base = await deriveAddressesAt(mnemonic, '', 0, 0);
    const next = await deriveAddressesAt(mnemonic, '', 0, 1);
    expect(next.btc).not.toBe(base.btc);
    expect(next.eth).not.toBe(base.eth);
    expect(next.trx).not.toBe(base.trx);
    expect(next.btc.startsWith('bc1q')).toBe(true);
    expect(next.eth.startsWith('0x')).toBe(true);
    expect(next.trx.startsWith('T')).toBe(true);
    // TON has one address per wallet: account and index do not change it.
    expect(next.ton).toBe(base.ton);
    const other = await deriveAddressesAt(mnemonic, '', 2, 3);
    expect(other.ton).toBe(base.ton);
  });

  it('rejects TON derivation from an xpub', async () => {
    await expect(deriveFromXpub('ton', trxXpub, 0)).rejects.toThrow();
  });

EDITS (emit the replacement blocks plus the 2 new tests, as one TypeScript
code block, nothing else):
1. After the btcZpub const, add an ltcLtub const with the Ltub above and
a dogeDgub const with the dgub above.
2. Restores test: rename 'restores with identical derived addresses on
all thirteen chains'; keep the existing assertions, add: sol has length
44; bsc/matic/arb/op/base/avax start with '0x'; ltc starts with 'ltc1';
doge starts with 'D'.
3. Index-1 test: rename 'deriveAddressesAt changes btc/eth/trx/ltc/doge
at index 1 but not TON or SOL'; add `expect(next.ltc).not.toBe(base.ltc)`,
`expect(next.doge).not.toBe(base.doge)`, and startsWith checks for ltc
('ltc1') and doge ('D'); add `expect(next.sol).toBe(base.sol)` with a
comment that SOL, like TON, has one address per wallet, and
`expect(other.sol).toBe(base.sol)` alongside the TON line.
4. New test 'derives the LTC and DOGE xpub fixtures':
deriveFromXpub('ltc', ltcLtub, 0) is the LTC address above;
deriveFromXpub('doge', dogeDgub, 0) is the DOGE address above;
index 1 differs from index 0 for both.
5. New test 'rejects SOL derivation from an xpub' mirroring the TON test:
deriveFromXpub('sol', trxXpub, 0) rejects. Keep the TON test unchanged.
Do NOT change any other test.
