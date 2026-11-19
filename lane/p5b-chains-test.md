You are editing `apps/web/src/wallet/chains.test.ts` (vitest), second half.
Registry now has 13 chains; SUPPORTED_CHAINS order:
['btc','eth','trx','ton','sol','bsc','matic','arb','op','base','avax','ltc','doge'].
Extended chains (sol, bsc, matic, arb, op, base, avax, ltc, doge):
derive/restore/receive verified; balance/history/fee-quote/unsigned-plan/
local-sign/post-sign-verify blocked, each blocked evidence contains
'never faked'. Adapter chains (btc, eth, trx, ton) keep their Phase 2
behaviour. New chains have rpcEndpoints []. SOLANA_PROFILES now has only
'solana-phantom-bip44change-v1' with path "m/44'/501'/{i}'/0'".
chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp') resolves
to 'sol'; ltc networkId is
'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2'.

CURRENT blocks to replace (verbatim):

  it('lists all four chains for unsigned-plan and local-sign (Phase 4), and three for post-sign-verify', () => {
    expect(availableFor('unsigned-plan')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('local-sign')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON post-sign-verify stays blocked: the signed BOC is not re-parsed.
    expect(availableFor('post-sign-verify')).toEqual(['btc', 'eth', 'trx']);
  });

  it('marks the Phase 2 adapter capabilities verified with evidence', () => {
    for (const chain of SUPPORTED_CHAINS) {
      const caps = capabilitiesFor(chain);
      expect(caps.derive.status).toBe('verified');
      expect(caps.restore.status).toBe('verified');
      expect(caps.receive.status).toBe('verified');
      expect(caps.balance.status).toBe('verified');
      expect(caps.history.status).toBe('verified');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-19');
      expect(caps.history.evidence).toContain('live mainnet cross-check 2026-11-19');
      for (const capability of ['unsigned-plan', 'local-sign'] as const) {
        expect(caps[capability].status).toBe('verified');
        expect(caps[capability].evidence).toContain('send.test.ts');
      }
      if (chain === 'ton') {
        expect(caps['post-sign-verify'].status).toBe('blocked');
        expect(caps['post-sign-verify'].evidence).toContain('not re-parsed');
      } else {
        expect(caps['post-sign-verify'].status).toBe('verified');
        expect(caps['post-sign-verify'].evidence).toContain('send.test.ts');
      }
    }
    expect(capabilitiesFor('ton')['fee-quote'].status).toBe('blocked');
    expect(capabilitiesFor('ton')['fee-quote'].evidence).toContain('unsigned message');
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(capabilitiesFor(chain)['fee-quote'].status).toBe('verified');
    }
  });

  it('pins the Phase 2 adapter RPC endpoints (no viem:mainnet marker)', () => {
    expect(CHAINS.btc.rpcEndpoints).toEqual(['https://mempool.space/api']);
    expect(CHAINS.eth.rpcEndpoints).toEqual([
      'https://ethereum-rpc.publicnode.com',
    ]);
    expect(CHAINS.trx.rpcEndpoints).toEqual(['https://api.trongrid.io']);
    expect(CHAINS.ton.rpcEndpoints).toEqual([
      'https://toncenter.com/api/v2/jsonRPC',
    ]);
  });

  it('throws a typed error naming the unavailable combination', () => {
    expect(() => assertSupported('ton', 'fee-quote')).toThrow(
      /chain ton \(ton:-239, profile bawa-ton-v4r2-v1\) cannot do fee-quote/,
    );
    expect(() => assertSupported('ton', 'post-sign-verify')).toThrow(
      /cannot do post-sign-verify/,
    );
    expect(() => assertSupported('ton', 'local-sign')).not.toThrow();
    expect(() => assertSupported('eth', 'balance')).not.toThrow();
    expect(() => assertSupported('eth', 'derive')).not.toThrow();
  });

  it('resolves chains by mainnet network ID and throws for anything else', () => {
    expect(chainConfigForNetwork('eip155:1').id).toBe('eth');
    expect(chainConfigForNetwork('ton:-239').id).toBe('ton');
    expect(() => chainConfigForNetwork('eip155:11155111')).toThrow(
      /Unsupported network/,
    );
    expect(() => chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toThrow(
      /Unsupported network/,
    );
  });

  it('names both Solana profiles as unsupported and nothing else', () => {
    const ids = Object.keys(SOLANA_PROFILES).sort();
    expect(ids).toEqual([
      'solana-phantom-bip44change-v1',
      'walletcore-solana-default-v1',
    ]);
    for (const profile of Object.values(SOLANA_PROFILES)) {
      expect(profile.status).toBe('unsupported');
    }
    const walletcore = SOLANA_PROFILES['walletcore-solana-default-v1'];
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(walletcore).toBeDefined();
    expect(phantom).toBeDefined();
    expect(walletcore?.path).toBe("m/44'/501'/0'");
    expect(phantom?.path).toBe("m/44'/501'/{i}'/0'");
    expect(availableFor('derive')).not.toContain('solana');
  });

  it('sets the EVM chain ID only for Ethereum', () => {
    expect(CHAINS.eth.evmChainId).toBe(1);
    expect(CHAINS.btc.evmChainId).toBeNull();
    expect(CHAINS.trx.evmChainId).toBeNull();
    expect(CHAINS.ton.evmChainId).toBeNull();
  });

EDITS (emit only the 7 replacement it-blocks):
1. unsigned-plan test: rename 'lists the four adapter chains for
unsigned-plan and local-sign (Phase 4), and three for post-sign-verify';
lists unchanged, keep the TON comment.
2. Phase 2 test: rename 'marks the Phase 2 adapter capabilities verified
with evidence, and the extended chains blocked with never-faked evidence'.
Loop the adapter chains ['btc','eth','trx','ton'] with the existing
assertions (keep the TON fee-quote / post-sign-verify special cases and
the final fee-quote assertions). Then loop the extended chains
['sol','bsc','matic','arb','op','base','avax','ltc','doge']: derive,
restore, receive verified; balance, history, fee-quote, unsigned-plan,
local-sign, post-sign-verify blocked with evidence containing
'never faked'.
3. RPC test: rename 'pins the Phase 2 adapter RPC endpoints and empty
endpoints for the extended chains'; keep the 4 original assertions, add
`expect(CHAINS.<id>.rpcEndpoints).toEqual([])` for each of the 9 new
chains.
4. assertSupported test: keep all 5 existing assertions; add
`expect(() => assertSupported('sol', 'balance')).toThrow(/cannot do balance/)`,
`expect(() => assertSupported('sol', 'local-sign')).toThrow(/cannot do local-sign/)`,
`expect(() => assertSupported('ltc', 'history')).toThrow(/cannot do history/)`,
and `expect(() => assertSupported('sol', 'derive')).not.toThrow()`.
5. chainConfigForNetwork test: replace the solana-throws expectation with
`expect(chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp').id).toBe('sol')`
and add the ltc bip122 resolution above; sepolia still throws.
6. SOLANA_PROFILES test: rename 'names only the Solana phantom profile as
unsupported'; ids equal ['solana-phantom-bip44change-v1']; drop the
walletcore assertions; keep the status loop, the phantom path assertion
and the availableFor check.
7. EVM chain ID test: rename 'sets the EVM chain ID for the EVM chains
only'; eth 1, bsc 56, matic 137, arb 42161, op 10, base 8453, avax 43114;
btc, trx, ton, sol, ltc, doge null.
Do NOT change any other test. Emit only the 7 replacement it-blocks as
one TypeScript code block, nothing else.
