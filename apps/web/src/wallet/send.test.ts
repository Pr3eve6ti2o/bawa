import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  bytesToHex,
  keccak256,
  parseTransaction,
  recoverAddress,
  serializeTransaction,
} from 'viem';
import {
  validateRecipient,
  previewSendAmount,
  signEthOffline,
  signBtcOffline,
  signTrxOffline,
  signTonOffline,
  tronAddressToBytes,
  broadcastSigned,
  isBroadcastAllowedFor,
  markBroadcastUnknown,
  simulateSend,
  signingFailure,
  planFailure,
} from './send';
import { createWallet, deriveAddresses } from './core';
import { createVault, deleteVault, TEST_PROVENANCE } from './vault';
import { loadCore } from '../engine/boundary';
import { registerAdapter } from './adapters';
import type {
  AdapterResult,
  ChainAdapter,
  FeeEstimate,
  TxInput,
} from './adapters/types';

describe('validateRecipient (Sol p1, assembled hands-on)', () => {
  it('accepts the published ETH vector address', async () => {
    expect(
      await validateRecipient(
        'eth',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      ),
    ).toEqual({ ok: true });
  });

  it('rejects a non-address', async () => {
    expect(await validateRecipient('eth', 'not-an-address')).toEqual({
      ok: false,
      reason: 'Invalid Ethereum address.',
    });
  });

  it('rejects empty input', async () => {
    expect(await validateRecipient('eth', '   ')).toEqual({
      ok: false,
      reason: 'Recipient address is required.',
    });
  });

  it('accepts a real mainnet BTC bech32 address', async () => {
    expect(
      await validateRecipient(
        'btc',
        'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
      ),
    ).toEqual({ ok: true });
  });

  it('accepts a real mainnet TRX address', async () => {
    expect(
      await validateRecipient('trx', 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c'),
    ).toEqual({ ok: true });
  });

  it('accepts a real mainnet TON UQ address', async () => {
    expect(
      await validateRecipient(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
      ),
    ).toEqual({ ok: true });
  });

  it('rejects a TON address whose third character is outside A-D', async () => {
    // Same payload with the workchain-0 proof character replaced.
    expect(
      await validateRecipient(
        'ton',
        'UQE7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
      ),
    ).toEqual({ ok: false, reason: 'Invalid TON address.' });
  });

  it('rejects an ETH address on the BTC chain', async () => {
    expect(
      await validateRecipient(
        'btc',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      ),
    ).toEqual({ ok: false, reason: 'Invalid Bitcoin address.' });
  });
});

describe('previewSendAmount (Sol p2, corrected hands-on)', () => {
  function stubAdapter(
    chain: 'eth' | 'ton',
    balanceBaseUnits: string,
    fee: AdapterResult<FeeEstimate>,
  ): ChainAdapter {
    return {
      chain,
      networkId: 'test',
      getBalance: async () => ({
        status: 'ok',
        data: {
          chain,
          address: 'stub',
          networkId: 'test',
          valueBaseUnits: balanceBaseUnits,
          decimals: 18,
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      getHistory: async () => ({
        status: 'ok',
        data: [],
        source: 'stub',
        fetchedAt: 0,
      }),
      estimateFee: async () => fee,
      getTxInputs: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      broadcast: async (): Promise<never> => {
        throw new Error('disabled');
      },
    };
  }

  beforeAll(() => {
    registerAdapter(
      stubAdapter('eth', '1000000000000000000', {
        status: 'ok',
        data: {
          chain: 'eth',
          networkId: 'test',
          feeBaseUnits: '420000000000000',
          unit: 'wei',
          note: 'stub fee',
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
    );
    registerAdapter(
      stubAdapter('ton', '1000000000', {
        status: 'unavailable',
        reason:
          'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
      }),
    );
    registerAdapter({
      chain: 'btc',
      networkId: 'test',
      getBalance: async () => ({
        status: 'ok',
        data: {
          chain: 'btc',
          address: 'stub',
          networkId: 'test',
          valueBaseUnits: '100000',
          decimals: 8,
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      getHistory: async () => ({
        status: 'ok',
        data: [],
        source: 'stub',
        fetchedAt: 0,
      }),
      estimateFee: async () => ({
        status: 'ok',
        data: {
          chain: 'btc',
          networkId: 'test',
          feeBaseUnits: '10',
          unit: 'sat/vB',
          note: 'stub rate',
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      getTxInputs: async () => ({
        status: 'ok',
        data: {
          kind: 'utxo',
          utxos: [
            {
              txid: createHash('sha256')
                .update('lane3-btc-test-utxo')
                .digest('hex'),
              vout: 0,
              valueBaseUnits: '100000',
            },
          ],
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      broadcast: async (): Promise<never> => {
        throw new Error('disabled');
      },
    });
  });

  it('previews 0.5 ETH with fee and total', async () => {
    expect(
      await previewSendAmount(
        'eth',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '0.5',
      ),
    ).toEqual({
      ok: true,
      amountBaseUnits: '500000000000000000',
      feeBaseUnits: '420000000000000',
      totalBaseUnits: '500420000000000000',
      feeNote: 'stub fee',
    });
  });

  it('previews 0.0005 BTC with the real planned fee, not the sat/vB rate', async () => {
    expect(
      await previewSendAmount(
        'btc',
        'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
        'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        '0.0005',
      ),
    ).toEqual({
      ok: true,
      amountBaseUnits: '50000',
      feeBaseUnits: '1410',
      totalBaseUnits: '51410',
      feeNote: 'Planned fee at 10 sat/vB from the live UTXO set.',
    });
  });

  it('rejects an amount above the balance', async () => {
    expect(
      await previewSendAmount(
        'eth',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '2',
      ),
    ).toEqual({ ok: false, code: 'insufficient-funds', reason: 'Amount exceeds available balance.' });
  });

  it('rejects invalid and zero amounts', async () => {
    for (const bad of ['abc', '0', '0.0000000000000000001', '']) {
      expect(
        await previewSendAmount(
          'eth',
          '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
          '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
          bad,
        ),
      ).toEqual({ ok: false, code: 'invalid-input', reason: 'Enter a valid amount.' });
    }
  });

  it('reports the TON fee-quote block honestly instead of inventing a fee', async () => {
    expect(
      await previewSendAmount(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '1',
      ),
    ).toEqual({
      ok: false,
      code: 'adapter-unavailable',
      reason:
        'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
    });
  });

  it('reports no adapter for an unregistered chain', async () => {
    expect(
      await previewSendAmount(
        'trx',
        'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
        'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
        '1',
      ),
    ).toEqual({ ok: false, code: 'adapter-unavailable', reason: 'No adapter available for this chain.' });
  });
});

describe('signEthOffline (Sol p4, corrected hands-on)', () => {
  const TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

  it('signs 0.01 ETH offline; decoded fields match and the signature recovers the sender', async () => {
    // Fresh disposable mnemonic, generated in-test, never printed.
    const mnemonic = await createWallet();
    const signed = await signEthOffline(
      mnemonic,
      '',
      TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.signedTxHex.startsWith('0x')).toBe(true);
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(TO.toLowerCase());
    expect(parsed.value).toBe(10000000000000000n);
    expect(parsed.nonce).toBe(0);
    expect(parsed.chainId).toBe(1);
    expect(parsed.gas).toBe(21000n);
    expect(parsed.gasPrice).toBe(20000000000n);
    // viem parseTransaction leaves `from` undefined in 2.58; recover it
    // from the signature over the unsigned serialization (EIP-155).
    const payload = serializeTransaction({
      chainId: 1,
      nonce: parsed.nonce,
      gasPrice: parsed.gasPrice,
      gas: parsed.gas,
      to: parsed.to,
      value: parsed.value,
      data: parsed.data ?? '0x',
    });
    const recovered = await recoverAddress({
      hash: keccak256(payload),
      signature: {
        r: parsed.r as `0x${string}`,
        s: parsed.s as `0x${string}`,
        yParity: Number((parsed.v as bigint) - 35n - 2n),
      },
    });
    expect(recovered.toLowerCase()).toBe(signed.from.toLowerCase());
  });

  it('rejects an invalid mnemonic', async () => {
    expect(
      await signEthOffline('abandon abandon', '', TO, '1000', '0', '1'),
    ).toEqual({ ok: false, code: 'invalid-mnemonic', reason: 'Invalid mnemonic.' });
  });

  it('rejects non-integer inputs', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEthOffline(mnemonic, '', TO, '0.5', '0', '1'),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount, nonce and gas price must be unsigned decimal integer strings.',
    });
  });
});

describe('broadcastSigned / markBroadcastUnknown (Sol p5)', () => {
  it('always returns disabled and never broadcasts', async () => {
    expect(await broadcastSigned('eth', '0x1234')).toEqual({
      status: 'disabled',
      reason: 'Broadcast is disabled until separately authorised.',
    });
    expect(await broadcastSigned('btc', '0x1234')).toEqual({
      status: 'disabled',
      reason: 'Broadcast is disabled until separately authorised.',
    });
  });

  it('marks an unknown outcome unresolved without resend permission', () => {
    const result = markBroadcastUnknown('0xabc');
    expect(result).toEqual({
      txHash: '0xabc',
      status: 'unknown',
      message:
        'Broadcast outcome unknown — the transaction stays unresolved. Do not resend it and do not compose a replacement without independent reconciliation.',
    });
  });
});

/** Minimal raw segwit-transaction parser (test-only): outputs + txid. */
function parseBtcRawTx(hex: string): {
  txid: string;
  outputs: { value: bigint; scriptHex: string }[];
} {
  const raw = Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex');
  let pos = 0;
  const readVarint = (): number => {
    const first = raw[pos] as number;
    if (first < 0xfd) {
      pos += 1;
      return first;
    }
    if (first === 0xfd) {
      const value = (raw[pos + 1] as number) | ((raw[pos + 2] as number) << 8);
      pos += 3;
      return value;
    }
    throw new Error('unsupported varint');
  };
  const version = raw.subarray(pos, pos + 4);
  pos += 4;
  const segwit = raw[pos] === 0 && raw[pos + 1] === 1;
  if (segwit) pos += 2;
  const stripped: Buffer[] = [Buffer.from(version)];
  const countStart = pos;
  const inputCount = readVarint();
  stripped.push(Buffer.from(raw.subarray(countStart, pos)));
  for (let i = 0; i < inputCount; i += 1) {
    const prevHash = raw.subarray(pos, pos + 32);
    pos += 32;
    const vout = raw.subarray(pos, pos + 4);
    pos += 4;
    const scriptLen = readVarint();
    pos += scriptLen;
    const sequence = raw.subarray(pos, pos + 4);
    pos += 4;
    stripped.push(
      Buffer.concat([Buffer.from(prevHash), Buffer.from(vout), Buffer.from([0]), Buffer.from(sequence)]),
    );
  }
  const outputCountStart = pos;
  const outputCount = readVarint();
  stripped.push(Buffer.from(raw.subarray(outputCountStart, pos)));
  const outputs: { value: bigint; scriptHex: string }[] = [];
  const outputsRaw: Buffer[] = [];
  for (let i = 0; i < outputCount; i += 1) {
    const valueStart = pos;
    const value = raw.subarray(pos, pos + 8).reduce((acc, byte, index) => acc | (BigInt(byte) << BigInt(8 * index)), 0n);
    pos += 8;
    const scriptLen = readVarint();
    const script = raw.subarray(pos, pos + scriptLen);
    pos += scriptLen;
    outputs.push({ value, scriptHex: Buffer.from(script).toString('hex') });
    outputsRaw.push(Buffer.from(raw.subarray(valueStart, pos)));
  }
  stripped.push(Buffer.concat(outputsRaw));
  if (segwit) {
    for (let i = 0; i < inputCount; i += 1) {
      const stack = readVarint();
      for (let j = 0; j < stack; j += 1) {
        const itemLen = readVarint();
        pos += itemLen;
      }
    }
  }
  const locktime = raw.subarray(pos, pos + 4);
  stripped.push(Buffer.from(locktime));
  const txid = createHash('sha256')
    .update(
      createHash('sha256').update(Buffer.concat(stripped)).digest(),
    )
    .digest()
    .reverse()
    .toString('hex');
  return { txid, outputs };
}

describe('signBtcOffline (hands-on, probe-proven)', () => {
  it('signs offline; plan fee, outputs and txid verify', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).btc;
    const dest = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';
    const fakeTxid = createHash('sha256')
      .update('lane3-btc-test-utxo')
      .digest('hex');
    const signed = await signBtcOffline(
      mnemonic,
      '',
      dest,
      '50000',
      [{ txid: fakeTxid, vout: 0, valueBaseUnits: '100000' }],
      '10',
      from,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.feeBaseUnits).toBe('1410');
    const parsed = parseBtcRawTx(signed.signedTxHex);
    expect(parsed.txid).toBe(signed.txHash);
    const core = await loadCore();
    const scriptHex = (address: string): string =>
      Buffer.from(
        core.BitcoinScript.lockScriptForAddress(
          address,
          core.CoinType.bitcoin,
        ).data(),
      ).toString('hex');
    expect(parsed.outputs).toContainEqual({
      value: 50000n,
      scriptHex: scriptHex(dest),
    });
    expect(parsed.outputs).toContainEqual({
      value: 48590n,
      scriptHex: scriptHex(from),
    });
  });

  it('rejects an invalid mnemonic', async () => {
    expect(
      await signBtcOffline('abandon abandon', '', 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd', '50000', [{ txid: '00'.repeat(32), vout: 0, valueBaseUnits: '100000' }], '10', 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd'),
    ).toEqual({ ok: false, code: 'invalid-mnemonic', reason: 'Invalid mnemonic.' });
  });
});

describe('signTrxOffline (hands-on, probe-proven)', () => {
  it('signs offline; contract, txid and signature recovery verify', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).trx;
    const dest = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
    const signed = await signTrxOffline(mnemonic, '', dest, '1000000', {
      timestamp: Date.now(),
      number: 1,
      txTrieRoot: '00'.repeat(32),
      parentHash: '00'.repeat(32),
      witnessAddress: from,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const json = JSON.parse(signed.signedTxJson) as {
      raw_data: {
        contract: { type: string; parameter: { value: { owner_address: string; to_address: string; amount: number } } }[];
      };
      raw_data_hex: string;
      signature: string[];
    };
    const contract = json.raw_data.contract[0] as {
      type: string;
      parameter: {
        value: { owner_address: string; to_address: string; amount: number };
      };
    };
    const param = contract.parameter.value;
    expect(contract.type).toBe('TransferContract');
    expect(param.amount).toBe(1000000);
    expect(param.to_address).toBe(
      bytesToHex(tronAddressToBytes(dest)).slice(2),
    );
    expect(param.owner_address).toBe(
      bytesToHex(tronAddressToBytes(from)).slice(2),
    );
    const txid = createHash('sha256')
      .update(Buffer.from(json.raw_data_hex, 'hex'))
      .digest('hex');
    expect(txid).toBe(signed.txId);
    const sigHex = json.signature[0] as string;
    expect(sigHex).toBeDefined();
    const sig = Buffer.from(sigHex, 'hex');
    expect(sig.length).toBe(65);
    const lastByte = sig[64] as number;
    const yParity = lastByte >= 27 ? lastByte - 27 : lastByte;
    const recovered = await recoverAddress({
      hash: ('0x' + txid) as `0x${string}`,
      signature: {
        r: ('0x' + sig.subarray(0, 32).toString('hex')) as `0x${string}`,
        s: ('0x' + sig.subarray(32, 64).toString('hex')) as `0x${string}`,
        yParity,
      },
    });
    expect('41' + recovered.slice(2).toLowerCase()).toBe(
      bytesToHex(tronAddressToBytes(from)).slice(2),
    );
  });
});

describe('signTonOffline (hands-on, probe-proven)', () => {
  it('signs offline; BOC envelope and message hash verify', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).ton;
    const signed = await signTonOffline(
      mnemonic,
      '',
      'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
      '1000000000',
      0,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
    const boc = Buffer.from(signed.signedBocBase64, 'base64');
    expect(boc.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
    expect(boc.length).toBeGreaterThan(100);
  });
});

describe('tronAddressToBytes', () => {
  it('decodes a mainnet TRON address to 21 bytes', () => {
    expect(bytesToHex(tronAddressToBytes('TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c'))).toBe(
      '0x4159b2f14f54513afa5b324aabd5c70362e7aa0836',
    );
  });

  it('rejects non-TRON input', () => {
    expect(() =>
      tronAddressToBytes('0x27Ef5cDBe01777D62438AfFeb695e33fC2335979'),
    ).toThrow('Invalid TRON address.');
  });
});

describe('isBroadcastAllowedFor (S6b, item 36)', () => {
  it('rejects TEST_PROVENANCE', () => {
    expect(isBroadcastAllowedFor(TEST_PROVENANCE)).toBe(false);
  });

  it('allows created, non-test provenance', () => {
    expect(
      isBroadcastAllowedFor({ source: 'created', isTesting: false }),
    ).toBe(true);
  });

  it('allows unknown, non-test provenance', () => {
    expect(
      isBroadcastAllowedFor({ source: 'unknown', isTesting: false }),
    ).toBe(true);
  });
});

describe('item 36 broadcast guard with real vaults (S6b-2)', () => {
  it('blocks test provenance and keeps default provenance disabled', async () => {
    // send.test.ts runs in the node environment (no localStorage), so
    // install a minimal in-memory Storage for this test only. vault.ts
    // reads storage at call time, so a test-time shim works.
    const holder = globalThis as Record<string, unknown>;
    const previousStorage = holder.localStorage;
    const store = new Map<string, string>();
    const shim = {
      get length() {
        return store.size;
      },
      clear: () => {
        store.clear();
      },
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as Storage;
    holder.localStorage = shim;

    try {
      const mnemonic = await createWallet();
      const password = 'test-only-password';

      await createVault(
        mnemonic,
        password,
        ['bawa-evm-bip44-v1'],
        '',
        TEST_PROVENANCE,
      );

      await expect(broadcastSigned('eth', '0x1234')).rejects.toThrow(
        'Broadcast blocked: account has test provenance.',
      );

      // createVault refuses when a vault already exists.
      deleteVault();
      await createVault(mnemonic, password, ['bawa-evm-bip44-v1'], '');

      await expect(broadcastSigned('eth', '0x1234')).resolves.toEqual({
        status: 'disabled',
        reason: 'Broadcast is disabled until separately authorised.',
      });
    } finally {
      if (previousStorage === undefined) {
        delete holder.localStorage;
      } else {
        holder.localStorage = previousStorage;
      }
    }
  });
});

describe('simulateSend BTC', () => {
  function simStub(chain: 'btc', balance: string, fee: AdapterResult<FeeEstimate>, inputs: AdapterResult<TxInput>): ChainAdapter { return { chain, networkId: 'test', getBalance: async () => ({ status: 'ok', data: { chain, address: 'stub', networkId: 'test', valueBaseUnits: balance, decimals: 8, source: 'stub', fetchedAt: 0 }, source: 'stub', fetchedAt: 0 }), getHistory: async () => ({ status: 'ok', data: [], source: 'stub', fetchedAt: 0 }), estimateFee: async () => fee, getTxInputs: async () => inputs, broadcast: async () => { throw new Error('disabled'); } }; }

  const from = 'bc1qv5rmq0kt9yz3pm36wvzct7p3x6mtgehjul0feu';
  const to = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';

  const fee: AdapterResult<FeeEstimate> = {
    status: 'ok',
    data: {
      chain: 'btc',
      networkId: 'test',
      feeBaseUnits: '10',
      unit: 'sat/vB',
      note: 'stub fee rate',
      source: 'stub',
      fetchedAt: 0,
    },
    source: 'stub',
    fetchedAt: 0,
  };

  const utxos = [
    {
      txid: createHash('sha256')
        .update('lane3-btc-test-utxo')
        .digest('hex'),
      vout: 0,
      valueBaseUnits: '100000',
    },
  ];

  const inputs: AdapterResult<TxInput> = {
    status: 'ok',
    data: { kind: 'utxo', utxos },
    source: 'stub',
    fetchedAt: 0,
  };

  it('returns the amount and calculated BTC fee in base units', async () => {
    registerAdapter(simStub('btc', '100000', fee, inputs));

    expect(await simulateSend('btc', from, to, '0.0005')).toMatchObject({
      ok: true,
      amountBaseUnits: '50000',
      feeBaseUnits: '1410',
    });
  });

  it('returns fee-unavailable when getTxInputs is unavailable', async () => {
    registerAdapter(
      simStub('btc', '100000', fee, {
        status: 'unavailable',
        reason: 'down',
      }),
    );

    expect(await simulateSend('btc', from, to, '0.0005')).toMatchObject({
      ok: false,
      error: { code: 'adapter-unavailable' },
      code: 'adapter-unavailable',
    });
  });

  it('returns fee-unavailable when estimateFee is unavailable', async () => {
    registerAdapter(
      simStub(
        'btc',
        '100000',
        { status: 'unavailable', reason: 'down' },
        inputs,
      ),
    );

    expect(await simulateSend('btc', from, to, '0.0005')).toMatchObject({
      ok: false,
      error: { code: 'adapter-unavailable' },
      code: 'adapter-unavailable',
    });
  });
});

describe('simulateSend failures and failure helpers', () => {
  function simStub(chain: 'btc' | 'trx', balance: string, decimals: number, fee: AdapterResult<FeeEstimate>, inputs: AdapterResult<TxInput>): ChainAdapter { return { chain, networkId: 'test', getBalance: async () => ({ status: 'ok', data: { chain, address: 'stub', networkId: 'test', valueBaseUnits: balance, decimals, source: 'stub', fetchedAt: 0 }, source: 'stub', fetchedAt: 0 }), getHistory: async () => ({ status: 'ok', data: [], source: 'stub', fetchedAt: 0 }), estimateFee: async () => fee, getTxInputs: async () => inputs, broadcast: async () => { throw new Error('disabled'); } }; }

  it('returns inner and outer insufficient-funds codes for BTC', async () => {
    const from = 'bc1qv5rmq0kt9yz3pm36wvzct7p3x6mtgehjul0feu';
    const to = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';

    registerAdapter(
      simStub(
        'btc',
        '100000',
        8,
        {
          status: 'ok',
          data: {
            chain: 'btc',
            networkId: 'test',
            feeBaseUnits: '10',
            unit: 'sat/vB',
            note: 'stub',
            source: 'stub',
            fetchedAt: 0,
          },
          source: 'stub',
          fetchedAt: 0,
        },
        {
          status: 'ok',
          data: {
            kind: 'utxo',
            utxos: [
              {
                txid: createHash('sha256')
                  .update('lane3-btc-test-utxo')
                  .digest('hex'),
                vout: 0,
                valueBaseUnits: '100000',
              },
            ],
          },
          source: 'stub',
          fetchedAt: 0,
        },
      ),
    );

    const result = await simulateSend('btc', from, to, '0.00101');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'insufficient-funds' },
      code: 'insufficient-funds',
    });
  });

  it('returns inner and outer adapter-unavailable codes for TRX with seqno inputs', async () => {
    const from = 'TAyDUYP5rcf56xFwrg8cU1qQwvnWpkeapM';
    const to = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';

    registerAdapter(
      simStub(
        'trx',
        '10000000',
        6,
        {
          status: 'ok',
          data: {
            chain: 'trx',
            networkId: 'test',
            feeBaseUnits: '100000',
            unit: 'sun',
            note: 'stub',
            source: 'stub',
            fetchedAt: 0,
          },
          source: 'stub',
          fetchedAt: 0,
        },
        {
          status: 'ok',
          data: { kind: 'seqno', seqno: 1 },
          source: 'stub',
          fetchedAt: 0,
        },
      ),
    );

    const result = await simulateSend('trx', from, to, '1');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'adapter-unavailable' },
      code: 'adapter-unavailable',
    });
  });

  it('constructs signing and plan failure results', () => {
    expect(signingFailure('Signing failed.', 7)).toEqual({
      ok: false,
      code: 'signing-failed',
      reason: 'Signing failed.',
      signingErrorCode: 7,
    });

    expect(planFailure(7, 'plan boom')).toEqual({
      ok: false,
      code: 'plan-failed',
      reason: 'Transaction plan failed (SigningError 7): plan boom',
      signingErrorCode: 7,
    });
  });
});

describe('simulateSend ETH and TON', () => {
  const ethFrom = '0x7ef5cdbe01777d62438affeb695e33fc233597987';
  const ethTo = '0x1111111111111111111111111111111111111111';
  const tonAddress = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';
  const ethBalance = '1000000000000000000';
  const tonBalance = '1000000000';

  const ethFee: AdapterResult<FeeEstimate> = {
    status: 'ok',
    data: {
      chain: 'eth',
      networkId: 'test',
      feeBaseUnits: '420000000000000',
      unit: 'wei',
      note: 'stub',
      source: 'stub',
      fetchedAt: 0,
    },
    source: 'stub',
    fetchedAt: 0,
  };

  const tonFee: AdapterResult<FeeEstimate> = {
    status: 'ok',
    data: {
      chain: 'ton',
      networkId: 'test',
      feeBaseUnits: '1000000',
      unit: 'nanoton',
      note: 'stub',
      source: 'stub',
      fetchedAt: 0,
    },
    source: 'stub',
    fetchedAt: 0,
  };

  function simStub(chain: 'eth' | 'ton', balance: string, decimals: number, fee: AdapterResult<FeeEstimate>, inputs: AdapterResult<TxInput>): ChainAdapter { return { chain, networkId: 'test', getBalance: async () => ({ status: 'ok', data: { chain, address: 'stub', networkId: 'test', valueBaseUnits: balance, decimals, source: 'stub', fetchedAt: 0 }, source: 'stub', fetchedAt: 0 }), getHistory: async () => ({ status: 'ok', data: [], source: 'stub', fetchedAt: 0 }), estimateFee: async () => fee, getTxInputs: async () => inputs, broadcast: async () => { throw new Error('disabled'); } }; }

  function okInputs(data: TxInput): AdapterResult<TxInput> {
    return { status: 'ok', data, source: 'stub', fetchedAt: 0 };
  }

  it('simulates an ETH send with nonce inputs', async () => {
    registerAdapter(
      simStub('eth', ethBalance, 18, ethFee, okInputs({ kind: 'nonce', nonce: 5 })),
    );

    expect(await simulateSend('eth', ethFrom, ethTo, '0.5')).toMatchObject({
      ok: true,
      amountBaseUnits: '500000000000000000',
      feeBaseUnits: '420000000000000',
    });
  });

  it('rejects unavailable ETH nonce inputs', async () => {
    registerAdapter(
      simStub('eth', ethBalance, 18, ethFee, {
        status: 'unavailable',
        reason: 'stub unavailable',
      }),
    );

    expect(await simulateSend('eth', ethFrom, ethTo, '0.5')).toMatchObject({
      ok: false,
      error: { code: 'stale-nonce', chain: 'eth' },
      code: 'bad-nonce',
    });
  });

  it('rejects seqno inputs for ETH', async () => {
    registerAdapter(
      simStub('eth', ethBalance, 18, ethFee, okInputs({ kind: 'seqno', seqno: 1 })),
    );

    expect(await simulateSend('eth', ethFrom, ethTo, '0.5')).toMatchObject({
      ok: false,
      error: { code: 'stale-nonce', chain: 'eth' },
      code: 'bad-nonce',
    });
  });

  it('simulates a TON send with seqno inputs', async () => {
    registerAdapter(
      simStub('ton', tonBalance, 9, tonFee, okInputs({ kind: 'seqno', seqno: 3 })),
    );

    expect(await simulateSend('ton', tonAddress, tonAddress, '0.5')).toMatchObject({
      ok: true,
      amountBaseUnits: '500000000',
      feeBaseUnits: '1000000',
    });
  });

  it('rejects unavailable TON seqno inputs', async () => {
    registerAdapter(
      simStub('ton', tonBalance, 9, tonFee, {
        status: 'unavailable',
        reason: 'stub unavailable',
      }),
    );

    expect(await simulateSend('ton', tonAddress, tonAddress, '0.5')).toMatchObject({
      ok: false,
      error: { code: 'stale-seqno', chain: 'ton' },
      code: 'bad-seqno',
    });
  });

  it('rejects nonce inputs for TON', async () => {
    registerAdapter(
      simStub('ton', tonBalance, 9, tonFee, okInputs({ kind: 'nonce', nonce: 1 })),
    );

    expect(await simulateSend('ton', tonAddress, tonAddress, '0.5')).toMatchObject({
      ok: false,
      error: { code: 'stale-seqno', chain: 'ton' },
      code: 'bad-seqno',
    });
  });
});
