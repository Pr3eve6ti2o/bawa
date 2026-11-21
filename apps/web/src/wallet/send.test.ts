import { createHash } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
      reason: 'Sending funds is switched off until it is separately approved.',
    });
    expect(await broadcastSigned('btc', '0x1234')).toEqual({
      status: 'disabled',
      reason: 'Sending funds is switched off until it is separately approved.',
    });
  });

  it('marks an unknown outcome unresolved without resend permission', () => {
    const result = markBroadcastUnknown('0xabc');
    expect(result).toEqual({
      txHash: '0xabc',
      status: 'unknown',
      message:
        'It is unclear whether the transaction was sent — it stays unresolved. Do not resend it and do not create a replacement without checking the network first.',
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

      // Merge 1 (Lane B): repo-study's S6b-2 block expected the old
      // wording; the merged BROADCAST_DISABLED_MESSAGE is adopt-proper's
      // ('Sending funds is switched off…'), as everywhere else in the
      // merged tree (lines 384/388 already expect it).
      await expect(broadcastSigned('eth', '0x1234')).resolves.toEqual({
        status: 'disabled',
        reason: 'Sending funds is switched off until it is separately approved.',
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

describe('offline signing — determinism and TON external signer', () => {
  const mnemonic = 'abandon '.repeat(11) + 'about';
  const passphrase = 'TREZOR';

  const expected = {
    btc: {
      txHash: 'e1fedbc2b7d283348895200e9cffe882728d1934b61e17da6a42d341fc73e2da',
      feeBaseUnits: '1410',
    },
    eth: {
      txHash: '0x08bbd8cf9baad0ff45e1220c95a205bd47f1506fa91312fde4247b01b551f578',
    },
    trx: {
      txId: 'c7c6843bafc655cd226f1fcf0e049bbbddfaf931bb90344ca70c6c7d30550f52',
    },
    ton: {
      messageHash: '0x9b098e9a691c990951e4c0c1b6a453be43790440952307dc91603a69868bacbf',
    },
  } as const;

  const btc = () =>
    signBtcOffline(
      mnemonic,
      passphrase,
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
      '50000',
      [{
        txid: createHash('sha256').update('lane3-btc-test-utxo').digest('hex'),
        vout: 0,
        valueBaseUnits: '100000',
      }],
      '10',
      'bc1qv5rmq0kt9yz3pm36wvzct7p3x6mtgehjul0feu',
    );

  const eth = () =>
    signEthOffline(
      mnemonic,
      passphrase,
      '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      '10000000000000000',
      '0',
      '20000000000',
    );

  const trx = () =>
    signTrxOffline(
      mnemonic,
      passphrase,
      'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
      '1000000',
      {
        timestamp: 1_700_000_000_000,
        number: 1,
        txTrieRoot: '00'.repeat(32),
        parentHash: '00'.repeat(32),
        witnessAddress: 'TAyDUYP5rcf56xFwrg8cU1qQwvnWpkeapM',
      },
    );

  const tonArgs = [
    mnemonic,
    passphrase,
    'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
    '1000000000',
    0,
  ] as const;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Strict deep equality compares the serialized transaction/BOC strings exactly.
  it('BTC signs the same transfer twice with byte-identical output', async () => {
    const first = await btc();
    const second = await btc();

    expect(second).toStrictEqual(first);
    expect(first).toMatchObject({ ok: true, ...expected.btc });
  });

  it('ETH signs the same transfer twice with byte-identical output', async () => {
    const first = await eth();
    const second = await eth();

    expect(second).toStrictEqual(first);
    expect(first).toMatchObject({ ok: true, ...expected.eth });
  });

  // TRX timestamp comes from Date.now(), so the txId below is pinned only because this suite freezes time; the probe txId was recorded at an unrecorded wall-clock time and is not reproducible.
  it('TRX signs the same transfer twice with byte-identical output', async () => {
    const first = await trx();
    const second = await trx();

    expect(second).toStrictEqual(first);
    expect(first).toMatchObject({ ok: true, ...expected.trx });
  });

  it('TON signs the same transfer twice with byte-identical output when time is frozen', async () => {
    const first = await signTonOffline(...tonArgs);
    const second = await signTonOffline(...tonArgs);

    expect(second).toStrictEqual(first);
    expect(first).toMatchObject({ ok: true, ...expected.ton });
  });

  it('TON accepts the external signer\u2019s local-path BOC and hash verbatim', async () => {
    // Omitting options exercises the default walletVersion, v4r2.
    const local = await signTonOffline(...tonArgs);
    if (!local.ok) {
      throw new Error('Local TON fixture signing failed');
    }

    const signer = vi.fn(async () => ({
      signedBocBase64: local.signedBocBase64,
      messageHash: local.messageHash,
    }));

    const external = await signTonOffline(...tonArgs, {
      walletVersion: 'v4r2',
      signer,
    });

    expect(signer).toHaveBeenCalledTimes(1);
    if (!external.ok) {
      throw new Error('External TON fixture signing failed');
    }

    expect(external.signedBocBase64).toBe(local.signedBocBase64);
    expect(external.messageHash).toBe(local.messageHash);
  });

  it('TON rejects a garbage external-signer BOC with signing-failed', async () => {
    const signer = vi.fn(async () => ({
      signedBocBase64: 'garbage',
      messageHash: expected.ton.messageHash,
    }));

    const result = await signTonOffline(...tonArgs, { signer });

    expect(signer).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, code: 'signing-failed' });
  });

  it('TON rejects v3r2 without a signer with unsupported-version', async () => {
    const result = await signTonOffline(...tonArgs, {
      walletVersion: 'v3r2',
    });

    expect(result).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('BTC signedTxHex matches the full expected transaction', async () => {
    const result = await btc();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('BTC offline signing failed');
    }

    expect(result.signedTxHex).toBe(
      '0x0100000000010160ef5293b6ab415f141e54745288c9c494e7db842f7a3962b042e168f22435f90000000000000000000250c30000000000001600140c03e507f38033aca9ac5c32b32dce56051d097bcebd0000000000001600146507b03ecb290510ee3a730585f83136b6b466f2024730440220527995e5eb1e623f25929299fd8a24824c5cfff74f077cac98a77854140a36f9022071bddaa1feb9b46461ac03ad785e48398eaa7ac5f1183e07bdbf82253d42be06012102a0f073d11f80811fb4e6d2b0299695c866a0988c1acf9f82a96ebb925524f32800000000',
    );
  });

  it('ETH signedTxHex matches the full expected transaction', async () => {
    const result = await eth();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('ETH offline signing failed');
    }

    expect(result.signedTxHex).toBe(
      '0xf86b808504a817c8008252089427ef5cdbe01777d62438affeb695e33fc2335979872386f26fc100008026a02424e6dfd3460ce80faa99dd7ddc7a263ea1746fe5597cebe4bae8d16b86b47ca02a997cb91efe84498f836566ae0cf000a50903353672940ffc3142dbc4903dc9',
    );
  });

  it('pins the frozen-time TON signed BOC hash', async () => {
    const result = await signTonOffline(...tonArgs);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected TON offline signing to succeed');
    }

    const decoded = Buffer.from(result.signedBocBase64, 'base64');
    expect(decoded.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
    expect(createHash('sha256').update(decoded).digest('hex')).toBe(
      '63f00fb7de318a1bd06644760ea3dca504af953457345e37787885d0a754dab7',
    );
  });
});

describe.skip('mainnet qualification (item 23) — manual step, never in routine runs', () => {
  /*
   * Item 23 is a SEPARATE manual qualification, not proved by offline tests.
   *
   * Procedure, entirely outside Vitest:
   * 1. Generate disposable one-time keys; never use a funded key or the public
   *    regression-fixture key. Never print a mnemonic or put one in evidence.
   * 2. Record the intended chain inputs and sign those recorded inputs offline
   *    using the disposable keys. Keep secret material out of the record.
   * 3. Broadcast once per chain by hand, only if a valid mainnet transaction
   *    can be constructed without violating those constraints.
   * 4. Verify the real receipt manually, paste its explorer URL and txid below,
   *    then replace describe.skip with describe.
   *
   * Leave this skipped if the constraints cannot be met or no receipt exists.
   * No test broadcasts, including after un-skipping.
   *
   * expectedOffline contains the preceding suite's golden expected values,
   * NOT mainnet receipt IDs for different disposable keys/network inputs.
   * Never broadcast golden-vector payloads: the BTC outpoint is synthetic,
   * the TON expiry is frozen, and the fixture mnemonic is public.
   * TON messageHash is not a mainnet transaction ID.
   * Do not copy a reference hash into a receipt slot as fabricated evidence.
   */
  const records = [
    {
      chain: 'BTC',
      expectedOffline: {
        txHash: 'e1fedbc2b7d283348895200e9cffe882728d1934b61e17da6a42d341fc73e2da',
        feeBaseUnits: '1410',
      },
      explorerUrl: '',
      txid: '',
    },
    {
      chain: 'ETH',
      expectedOffline: {
        txHash: '0x08bbd8cf9baad0ff45e1220c95a205bd47f1506fa91312fde4247b01b551f578',
      },
      explorerUrl: '',
      txid: '',
    },
    {
      chain: 'TRX',
      expectedOffline: {
        txId: 'c7c6843bafc655cd226f1fcf0e049bbbddfaf931bb90344ca70c6c7d30550f52',
      },
      explorerUrl: '',
      txid: '',
    },
    {
      chain: 'TON',
      expectedOffline: {
        messageHash: '0x9b098e9a691c990951e4c0c1b6a453be43790440952307dc91603a69868bacbf',
      },
      explorerUrl: '',
      txid: '',
    },
  ];

  // Evidence-presence gate only; authenticity/inclusion verification is manual.
  it.each(records)('$chain — manually verified receipt is recorded', ({ explorerUrl, txid }) => {
    expect(txid.trim(), 'Paste the actual manually confirmed mainnet txid').not.toBe('');
    expect(explorerUrl.trim(), 'Paste the actual explorer URL').not.toBe('');
    expect(new URL(explorerUrl.trim()).protocol).toBe('https:');
  });
});
