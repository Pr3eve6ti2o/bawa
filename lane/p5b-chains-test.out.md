```typescript
  it('lists the four adapter chains for unsigned-plan and local-sign (Phase 4), and three for post-sign-verify', () => {
    expect(availableFor('unsigned-plan')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('local-sign')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON post-sign-verify stays blocked: the signed BOC is not re-parsed.
    expect(availableFor('post-sign-verify')).toEqual(['btc', 'eth', 'trx']);
  });

  it('marks the Phase 2 adapter capabilities verified with evidence, and the extended chains blocked with never-faked evidence', () => {
    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
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
    for (const chain of [
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ] as const) {
      const caps = capabilitiesFor(chain);
      expect(caps.derive.status).toBe('verified');
      expect(caps.restore.status).toBe('verified');
      expect(caps.receive.status).toBe('verified');
      for (const capability of [
        'balance',
        'history',
        'fee-quote',
        'unsigned-plan',
        'local-sign',
        'post-sign-verify',
      ] as const) {
        expect(caps[capability].status).toBe('blocked');
        expect(caps[capability].evidence).toContain('never faked');
      }
    }
    expect(capabilitiesFor('ton')['fee-quote'].status).toBe('blocked');
    expect(capabilitiesFor('ton')['fee-quote'].evidence).toContain('unsigned message');
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(capabilitiesFor(chain)['fee-quote'].status).toBe('verified');
    }
  });

  it('pins the Phase 2 adapter RPC endpoints and empty endpoints for the extended chains', () => {
    expect(CHAINS.btc.rpcEndpoints).toEqual(['https://mempool.space/api']);
    expect(CHAINS.eth.rpcEndpoints).toEqual([
      'https://ethereum-rpc.publicnode.com',
    ]);
    expect(CHAINS.trx.rpcEndpoints).toEqual(['https://api.trongrid.io']);
    expect(CHAINS.ton.rpcEndpoints).toEqual([
      'https://toncenter.com/api/v2/jsonRPC',
    ]);
    expect(CHAINS.sol.rpcEndpoints).toEqual([]);
    expect(CHAINS.bsc.rpcEndpoints).toEqual([]);
    expect(CHAINS.matic.rpcEndpoints).toEqual([]);
    expect(CHAINS.arb.rpcEndpoints).toEqual([]);
    expect(CHAINS.op.rpcEndpoints).toEqual([]);
    expect(CHAINS.base.rpcEndpoints).toEqual([]);
    expect(CHAINS.avax.rpcEndpoints).toEqual([]);
    expect(CHAINS.ltc.rpcEndpoints).toEqual([]);
    expect(CHAINS.doge.rpcEndpoints).toEqual([]);
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
    expect(() => assertSupported('sol', 'balance')).toThrow(/cannot do balance/);
    expect(() => assertSupported('sol', 'local-sign')).toThrow(
      /cannot do local-sign/,
    );
    expect(() => assertSupported('ltc', 'history')).toThrow(/cannot do history/);
    expect(() => assertSupported('sol', 'derive')).not.toThrow();
  });

  it('resolves chains by mainnet network ID and throws for anything else', () => {
    expect(chainConfigForNetwork('eip155:1').id).toBe('eth');
    expect(chainConfigForNetwork('ton:-239').id).toBe('ton');
    expect(() => chainConfigForNetwork('eip155:11155111')).toThrow(
      /Unsupported network/,
    );
    expect(
      chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp').id,
    ).toBe('sol');
    expect(
      chainConfigForNetwork(
        'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
      ).id,
    ).toBe('ltc');
  });

  it('names only the Solana phantom profile as unsupported', () => {
    const ids = Object.keys(SOLANA_PROFILES).sort();
    expect(ids).toEqual(['solana-phantom-bip44change-v1']);
    for (const profile of Object.values(SOLANA_PROFILES)) {
      expect(profile.status).toBe('unsupported');
    }
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(phantom).toBeDefined();
    expect(phantom?.path).toBe("m/44'/501'/{i}'/0'");
    expect(availableFor('derive')).not.toContain('solana');
  });

  it('sets the EVM chain ID for the EVM chains only', () => {
    expect(CHAINS.eth.evmChainId).toBe(1);
    expect(CHAINS.bsc.evmChainId).toBe(56);
    expect(CHAINS.matic.evmChainId).toBe(137);
    expect(CHAINS.arb.evmChainId).toBe(42161);
    expect(CHAINS.op.evmChainId).toBe(10);
    expect(CHAINS.base.evmChainId).toBe(8453);
    expect(CHAINS.avax.evmChainId).toBe(43114);
    expect(CHAINS.btc.evmChainId).toBeNull();
    expect(CHAINS.trx.evmChainId).toBeNull();
    expect(CHAINS.ton.evmChainId).toBeNull();
    expect(CHAINS.sol.evmChainId).toBeNull();
    expect(CHAINS.ltc.evmChainId).toBeNull();
    expect(CHAINS.doge.evmChainId).toBeNull();
  });
```