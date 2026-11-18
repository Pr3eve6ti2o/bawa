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
  markBroadcastUnknown,
} from './send';
import { createWallet, deriveAddresses } from './core';
import { loadCore } from '../engine/boundary';
import { registerAdapter } from './adapters';
import type {
  AdapterResult,
  ChainAdapter,
  FeeEstimate,
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
  });

  it('previews 0.5 ETH with fee and total', async () => {
    expect(
      await previewSendAmount(
        'eth',
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

  it('rejects an amount above the balance', async () => {
    expect(
      await previewSendAmount(
        'eth',
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '2',
      ),
    ).toEqual({ ok: false, reason: 'Amount exceeds available balance.' });
  });

  it('rejects invalid and zero amounts', async () => {
    for (const bad of ['abc', '0', '0.0000000000000000001', '']) {
      expect(
        await previewSendAmount(
          'eth',
          '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
          bad,
        ),
      ).toEqual({ ok: false, reason: 'Enter a valid amount.' });
    }
  });

  it('reports the TON fee-quote block honestly instead of inventing a fee', async () => {
    expect(
      await previewSendAmount(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '1',
      ),
    ).toEqual({
      ok: false,
      reason:
        'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
    });
  });

  it('reports no adapter for an unregistered chain', async () => {
    expect(
      await previewSendAmount(
        'btc',
        'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
        '0.001',
      ),
    ).toEqual({ ok: false, reason: 'No adapter available for this chain.' });
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
    ).toEqual({ ok: false, reason: 'Invalid mnemonic.' });
  });

  it('rejects non-integer inputs', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEthOffline(mnemonic, '', TO, '0.5', '0', '1'),
    ).toEqual({
      ok: false,
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
    ).toEqual({ ok: false, reason: 'Invalid mnemonic.' });
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
