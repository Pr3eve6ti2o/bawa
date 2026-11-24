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
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction,
} from '@solana/spl-token';
import { SystemInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import {
  validateRecipient,
  previewSendAmount,
  signEthOffline,
  signEvmOffline,
  signBtcOffline,
  signTrxOffline,
  signTonOffline,
  tronAddressToBytes,
  broadcastSigned,
  broadcastSignedDevnet,
  verifyEthSignedTx,
  isBroadcastAllowedFor,
  markBroadcastUnknown,
  simulateSend,
  signingFailure,
  planFailure,
  buildErc20TransferData,
  previewTokenSendAmount,
  signEvmTokenOffline,
  signJettonOffline,
  signSolOffline,
  signSplOffline,
  signTrc20Offline,
  simulateTokenSend,
  verifyEvmTokenSignedTx,
} from './send';
import { chainConfig } from './chains';
import { DEFAULT_TOKENS, EVM_TOKEN_CHAINS, type TokenRecord } from './tokens';
import type { ChainId } from '../engine/boundary';
import { decodeBase58 } from '../engine/address-codecs';
import { deriveAssociatedTokenAddress } from './adapters/token-balances';
import {
  createWallet,
  deriveAddresses,
  deriveDevnetAddressesAt,
} from './core';
import { createVault, deleteVault, TEST_PROVENANCE } from './vault';
import { loadCore } from '../engine/boundary';
import { registerAdapter, registerDevnetAdapter } from './adapters';
import { decodeBtcBech32 } from './devnet';
import type {
  AdapterBalance,
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

  it('previews a TON send with the fee marked unknown instead of blocking on the fee quote (Lane D, 2026-11-22)', async () => {
    // The TON adapter honestly reports no fee quote (no read-only fee
    // endpoint exists). Gating the preview on it made TON sends
    // impossible — the review step could never be reached (found live
    // in devnet: the Amount step always failed with the fee-quote
    // reason). The preview now proceeds with the fee marked unknown;
    // no fee number is invented (feeBaseUnits '0' is a placeholder,
    // never displayed — the review screen shows unknown-fee copy).
    expect(
      await previewSendAmount(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '1',
      ),
    ).toEqual({
      ok: true,
      amountBaseUnits: '1000000000',
      feeBaseUnits: '0',
      totalBaseUnits: '1000000000',
      feeNote:
        'TON fee is charged by the network when the transaction is broadcast; it is not known in advance and comes out of your balance on top of this amount.',
      feeUnknown: true,
    });
  });

  it('previews a TON send with the adapter fee when one is available', async () => {
    registerAdapter(
      stubAdapter('ton', '1000000000', {
        status: 'ok',
        data: {
          chain: 'ton',
          networkId: 'test',
          feeBaseUnits: '1000000',
          unit: 'nanoton',
          note: 'stub fee',
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
    );
    expect(
      await previewSendAmount(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        '0.5',
      ),
    ).toEqual({
      ok: true,
      amountBaseUnits: '500000000',
      feeBaseUnits: '1000000',
      totalBaseUnits: '501000000',
      feeNote: 'stub fee',
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

describe('signEvmOffline BSC (native BNB, chain id 56)', () => {
  const TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

  it('signs 0.01 BNB offline; chain id is 56 and the sender is the BSC address (same as ETH)', async () => {
    const mnemonic = await createWallet();
    const addresses = await deriveAddresses(mnemonic, '');
    const signed = await signEvmOffline(
      'bsc',
      mnemonic,
      '',
      TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    // BSC shares m/44'/60' with ETH: the BSC address IS the ETH address.
    expect(signed.from).toBe(addresses.bsc);
    expect(signed.from).toBe(addresses.eth);
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(TO.toLowerCase());
    expect(parsed.value).toBe(10000000000000000n);
    expect(parsed.nonce).toBe(0);
    expect(parsed.chainId).toBe(56);
    expect(parsed.gas).toBe(21000n);
    expect(parsed.gasPrice).toBe(20000000000n);
    // The in-module verifier accepts the signed tx against its intent (chain 56).
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 56,
      }),
    ).resolves.toEqual({ ok: true });
    // And it rejects the same tx against the ETH chain id.
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 1,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction chain id does not match the signing intent.',
    });
  });

  it('refuses a non-EVM chain', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEvmOffline('sol', mnemonic, '', TO, '1000', '0', '1'),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'Solana is not an EVM chain.',
    });
  });

  it('refuses BSC in devnet mode (no BSC test network)', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEvmOffline('bsc', mnemonic, '', TO, '1000', '0', '1', {
        devnet: true,
      }),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'BNB Smart Chain has no devnet network in this wallet.',
    });
  });
});

describe('signEvmOffline new EVM chains (Lane 80-APP, 2026-11-24)', () => {
  const TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

  it('signs 0.01 on ZKsync Era offline; chain id is 324 and the sender is the ETH address (60\' path)', async () => {
    const mnemonic = await createWallet();
    const addresses = await deriveAddresses(mnemonic, '');
    const signed = await signEvmOffline(
      'zksync',
      mnemonic,
      '',
      TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    // ZKsync Era shares m/44'/60' with ETH: the sender IS the ETH address.
    expect(signed.from).toBe(addresses.zksync);
    expect(signed.from).toBe(addresses.eth);
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(TO.toLowerCase());
    expect(parsed.value).toBe(10000000000000000n);
    expect(parsed.nonce).toBe(0);
    expect(parsed.chainId).toBe(324);
    expect(parsed.gas).toBe(21000n);
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 324,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 1,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction chain id does not match the signing intent.',
    });
  });

  it('signs 0.01 RBTC on Rootstock offline; chain id is 30 and the sender is the 137\' key, not the ETH address', async () => {
    const mnemonic = await createWallet();
    const addresses = await deriveAddresses(mnemonic, '');
    const signed = await signEvmOffline(
      'rootstock',
      mnemonic,
      '',
      TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    // Rootstock derives on m/44'/137' (its own coin path), so its
    // address differs from the ETH address on the same mnemonic.
    expect(signed.from).toBe(addresses.rootstock);
    expect(signed.from).not.toBe(addresses.eth);
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(TO.toLowerCase());
    expect(parsed.value).toBe(10000000000000000n);
    expect(parsed.nonce).toBe(0);
    expect(parsed.chainId).toBe(30);
    expect(parsed.gas).toBe(21000n);
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 30,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: signed.from,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 1,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'Signed ETH transaction chain id does not match the signing intent.',
    });
  });

  it('signs 0.01 RON on Ronin offline; chain id is 2020 and the sender keeps the ronin: prefix', async () => {
    const mnemonic = await createWallet();
    const addresses = await deriveAddresses(mnemonic, '');
    const signed = await signEvmOffline(
      'ronin',
      mnemonic,
      '',
      TO,
      '10000000000000000',
      '0',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    // Ronin shares the 60' key with ETH but its wallet address carries
    // the ronin: prefix INSTEAD of the 0x (ronin:9858… is the ETH
    // address 0x9858… with the prefix swapped in).
    expect(signed.from).toBe(addresses.ronin);
    expect(signed.from.startsWith('ronin:')).toBe(true);
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(TO.toLowerCase());
    expect(parsed.value).toBe(10000000000000000n);
    expect(parsed.nonce).toBe(0);
    expect(parsed.chainId).toBe(2020);
    expect(parsed.gas).toBe(21000n);
    // The verifier compares against the recovered 0x sender, so the
    // intent names the 0x form (the prefix replaces the 0x, it is not
    // prepended to it — strip it and restore the 0x).
    const from0x = '0x' + signed.from.slice('ronin:'.length);
    await expect(
      verifyEthSignedTx(signed.signedTxHex, {
        from: from0x,
        to: TO,
        amountBaseUnits: '10000000000000000',
        nonce: '0',
        chainId: 2020,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('refuses a derive-only chain (Cosmos) for EVM signing', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEvmOffline('cosmos', mnemonic, '', TO, '1000', '0', '1'),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'Cosmos Hub is not an EVM chain.',
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

  it('signs TON from account 1 with the account-1 key (Lane A)', async () => {
    const result = await signTonOffline(...tonArgs, { account: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected TON offline signing to succeed');
    }
    // bip_utils 2.13.0 oracle: abandon mnemonic + TREZOR passphrase,
    // m/44'/607'/1' — distinct from the account-0 address.
    expect(result.from).toBe(
      'UQDyAtYEkrFti_NE7wQb-7rJS_W9w7VwQcqYdmIRQepWr56T',
    );
    const decoded = Buffer.from(result.signedBocBase64, 'base64');
    expect(decoded.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
  });

  it('rejects a negative TON signing account (Lane A)', async () => {
    const result = await signTonOffline(...tonArgs, { account: -1 });
    expect(result.ok).toBe(false);
  });
});

// Evidence-presence gate, shared by the skipped manual qualification
// below and the active validation test after it: a receipt record is
// valid only with a non-empty txid and an https explorer URL. The
// skipped block applies it to the real (still empty) records; the active
// test applies the same gate to synthetic records, so the gate logic
// itself is covered without a mainnet broadcast.
function assertReceiptRecord(record: {
  explorerUrl: string;
  txid: string;
}): void {
  expect(
    record.txid.trim(),
    'Paste the actual manually confirmed mainnet txid',
  ).not.toBe('');
  expect(
    record.explorerUrl.trim(),
    'Paste the actual explorer URL',
  ).not.toBe('');
  expect(new URL(record.explorerUrl.trim()).protocol).toBe('https:');
}

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
  it.each(records)('$chain — manually verified receipt is recorded', assertReceiptRecord);
});

describe('mainnet qualification receipt gate (validation)', () => {
  // Lane A: the gate logic is covered with synthetic records — the real
  // records above stay empty (and skipped) because filling them needs a
  // real mainnet broadcast, which the programme forbids.
  it('accepts a well-formed receipt record', () => {
    assertReceiptRecord({
      explorerUrl: `https://example.com/tx/${'a'.repeat(64)}`,
      txid: 'a'.repeat(64),
    });
  });

  it('rejects empty txids, empty URLs and non-https URLs', () => {
    expect(() =>
      assertReceiptRecord({
        explorerUrl: 'https://example.com/tx/abc',
        txid: '  ',
      }),
    ).toThrow();
    expect(() =>
      assertReceiptRecord({ explorerUrl: '  ', txid: 'abc' }),
    ).toThrow();
    expect(() =>
      assertReceiptRecord({
        explorerUrl: 'http://example.com/tx/abc',
        txid: 'abc',
      }),
    ).toThrow();
  });
});

describe('devnet send (temporary devnet mode)', () => {
  const TB1Q_DEST = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
  const TON_TESTNET_ZERO = '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkT';
  const ETH_TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

  it('validateRecipient accepts tb1q and testnet base58 only in devnet mode', async () => {
    expect(
      await validateRecipient('btc', TB1Q_DEST, { devnet: true }),
    ).toEqual({ ok: true });
    expect(
      await validateRecipient(
        'btc',
        'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        { devnet: true },
      ),
    ).toEqual({ ok: true });
    // Mainnet mode still rejects testnet forms.
    expect(await validateRecipient('btc', TB1Q_DEST)).toEqual({
      ok: false,
      reason: 'Invalid Bitcoin address.',
    });
    // Devnet mode rejects mainnet forms.
    expect(
      await validateRecipient(
        'btc',
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        { devnet: true },
      ),
    ).toEqual({ ok: false, reason: 'Invalid Bitcoin address.' });
  });

  it('validateRecipient accepts testnet-flagged TON only in devnet mode', async () => {
    expect(
      await validateRecipient('ton', TON_TESTNET_ZERO, { devnet: true }),
    ).toEqual({ ok: true });
    expect(
      await validateRecipient(
        'ton',
        'kQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHTW',
        { devnet: true },
      ),
    ).toEqual({ ok: true });
    // Mainnet mode still rejects testnet-flagged forms.
    expect(await validateRecipient('ton', TON_TESTNET_ZERO)).toEqual({
      ok: false,
      reason: 'Invalid TON address.',
    });
    // Mainnet forms stay valid destinations in devnet mode: the tag is
    // display-only, the on-chain destination (workchain + hash) is the same.
    expect(
      await validateRecipient(
        'ton',
        'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
        { devnet: true },
      ),
    ).toEqual({ ok: true });
  });

  it('signEthOffline signs with Sepolia chain id 11155111 in devnet mode', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).eth;
    const signed = await signEthOffline(
      mnemonic,
      '',
      ETH_TO,
      '10000000000000000',
      '0',
      '20000000000',
      { devnet: true },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.chainId).toBe(11155111);
    expect(parsed.value).toBe(10000000000000000n);
    const verified = await verifyEthSignedTx(signed.signedTxHex, {
      from,
      to: ETH_TO,
      amountBaseUnits: '10000000000000000',
      nonce: '0',
      chainId: 11155111,
    });
    expect(verified).toEqual({ ok: true });
  });

  it('signBtcOffline signs a tb1q spend in devnet mode; outputs verify against the witness programs', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveDevnetAddressesAt(mnemonic, '', 0, 0)).btc;
    expect(from.startsWith('tb1q')).toBe(true);
    const fakeTxid = createHash('sha256')
      .update('lane3-btc-devnet-test-utxo')
      .digest('hex');
    const signed = await signBtcOffline(
      mnemonic,
      '',
      TB1Q_DEST,
      '50000',
      [{ txid: fakeTxid, vout: 0, valueBaseUnits: '100000' }],
      '10',
      from,
      { devnet: true },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.feeBaseUnits).toBe('1410');
    const parsed = parseBtcRawTx(signed.signedTxHex);
    expect(parsed.txid).toBe(signed.txHash);
    // P2WPKH script from the witness program — no WASM call, so the
    // verification does not depend on Wallet Core accepting tb1q.
    const scriptHex = (address: string): string => {
      const decoded = decodeBtcBech32(address);
      if (!decoded) throw new Error('test address did not decode');
      return (
        '0014' + Buffer.from(decoded.program).toString('hex')
      );
    };
    expect(parsed.outputs).toContainEqual({
      value: 50000n,
      scriptHex: scriptHex(TB1Q_DEST),
    });
    expect(parsed.outputs).toContainEqual({
      value: 48590n,
      scriptHex: scriptHex(from),
    });
  });

  it('signTrxOffline signs with the devnet from address', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveDevnetAddressesAt(mnemonic, '', 0, 0)).trx;
    const dest = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
    const signed = await signTrxOffline(mnemonic, '', dest, '1000000', {
      timestamp: Date.now(),
      number: 72938490,
      txTrieRoot: '00'.repeat(32),
      parentHash: '00'.repeat(32),
      witnessAddress: from,
    }, { devnet: true });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    const json = JSON.parse(signed.signedTxJson) as {
      raw_data: {
        contract: {
          parameter: { value: { owner_address: string } };
        }[];
      };
    };
    expect(
      json.raw_data.contract[0]?.parameter.value.owner_address,
    ).toBe(bytesToHex(tronAddressToBytes(from)).slice(2));
  });

  it('signTonOffline signs with a 0Q from address in devnet mode', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveDevnetAddressesAt(mnemonic, '', 0, 0)).ton;
    expect(from.startsWith('0Q')).toBe(true);
    const signed = await signTonOffline(
      mnemonic,
      '',
      TON_TESTNET_ZERO,
      '1000000000',
      0,
      { devnet: true },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
    const boc = Buffer.from(signed.signedBocBase64, 'base64');
    expect(boc.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
  });

  it('previewSendAmount uses the devnet adapter in devnet mode (BTC plan proves the tb1q mapping)', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveDevnetAddressesAt(mnemonic, '', 0, 0)).btc;
    const fakeTxid = createHash('sha256')
      .update('lane3-btc-devnet-preview-utxo')
      .digest('hex');
    registerDevnetAdapter({
      chain: 'btc',
      networkId:
        'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      getBalance: async () => ({
        status: 'ok',
        data: {
          chain: 'btc',
          address: from,
          networkId:
            'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
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
          networkId:
            'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
          feeBaseUnits: '10',
          unit: 'sat/vB',
          note: 'stub',
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
          utxos: [{ txid: fakeTxid, vout: 0, valueBaseUnits: '100000' }],
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      broadcast: async () => {
        throw new Error('disabled');
      },
    });
    const preview = await previewSendAmount(
      'btc',
      from,
      TB1Q_DEST,
      '0.0005',
      { devnet: true },
    );
    expect(preview).toMatchObject({
      ok: true,
      amountBaseUnits: '50000',
      feeBaseUnits: '1410',
      totalBaseUnits: '51410',
    });
  });

  it('previewSendAmount in devnet mode without a devnet adapter is unavailable', async () => {
    const preview = await previewSendAmount(
      'trx',
      'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
      'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
      '1',
      { devnet: true },
    );
    expect(preview).toMatchObject({
      ok: false,
      code: 'adapter-unavailable',
    });
  });

  it('broadcastSignedDevnet submits through the devnet adapter', async () => {
    registerDevnetAdapter({
      chain: 'eth',
      networkId: 'eip155:11155111',
      getBalance: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      getHistory: async () => ({
        status: 'ok',
        data: [],
        source: 'stub',
        fetchedAt: 0,
      }),
      estimateFee: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      getTxInputs: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      broadcast: async () => ({
        txHash: '0xabc',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xabc',
      }),
    });
    const result = await broadcastSignedDevnet('eth', '0x02f801', {
      devnet: true,
    });
    expect(result).toEqual({
      status: 'submitted',
      txHash: '0xabc',
      explorerUrl: 'https://sepolia.etherscan.io/tx/0xabc',
    });
  });

  it('broadcastSignedDevnet refuses when devnet mode is off', async () => {
    await expect(
      broadcastSignedDevnet('eth', '0x02f801', { devnet: false }),
    ).rejects.toThrow('Devnet broadcast requires devnet mode.');
  });

  it('broadcastSignedDevnet refuses a non-devnet network id without calling broadcast', async () => {
    const broadcast = vi.fn(async () => ({
      txHash: '0xabc',
      explorerUrl: 'https://example.invalid/tx/0xabc',
    }));
    registerDevnetAdapter({
      chain: 'btc',
      networkId: 'bip122:000000000019d6689c085ae165831e93',
      getBalance: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      getHistory: async () => ({
        status: 'ok',
        data: [],
        source: 'stub',
        fetchedAt: 0,
      }),
      estimateFee: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      getTxInputs: async () => ({
        status: 'unavailable',
        reason: 'stub',
      }),
      broadcast,
    });
    await expect(
      broadcastSignedDevnet('btc', '0200000001deadbeef', { devnet: true }),
    ).rejects.toThrow('not a devnet network');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('broadcastSignedDevnet reports no adapter when none is registered', async () => {
    await expect(
      broadcastSignedDevnet('ton', 'te6ccgEBAQEAAgAA', { devnet: true }),
    ).rejects.toThrow('Devnet adapter unavailable for ton.');
  });

  it('broadcastSignedDevnet blocks test provenance', async () => {
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
      await createVault(
        mnemonic,
        'test-only-password',
        ['bawa-evm-bip44-v1'],
        '',
        TEST_PROVENANCE,
      );
      await expect(
        broadcastSignedDevnet('eth', '0x02f801', { devnet: true }),
      ).rejects.toThrow('Broadcast blocked: account has test provenance.');
    } finally {
      deleteVault();
      if (previousStorage === undefined) {
        delete holder.localStorage;
      } else {
        holder.localStorage = previousStorage;
      }
    }
  });
});

// --- Token sending (Lane 2) ------------------------------------------------

describe('buildErc20TransferData (Lane 2)', () => {
  it('encodes transfer(address,uint256) with the known vector', () => {
    expect(
      buildErc20TransferData(
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '1000000',
      ),
    ).toBe(
      '0xa9059cbb' +
        '00000000000000000000000027ef5cdbe01777d62438affeb695e33fc2335979' +
        '00000000000000000000000000000000000000000000000000000000000f4240',
    );
  });

  it('encodes a zero amount as a zero word', () => {
    expect(
      buildErc20TransferData(
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '0',
      ),
    ).toBe(
      '0xa9059cbb' +
        '00000000000000000000000027ef5cdbe01777d62438affeb695e33fc2335979' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('rejects a bad recipient and a bad amount', () => {
    expect(() => buildErc20TransferData('not-an-address', '1000')).toThrow(
      'Invalid ERC-20 transfer recipient.',
    );
    expect(() =>
      buildErc20TransferData(
        '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        '0.5',
      ),
    ).toThrow('Invalid ERC-20 transfer amount.');
  });
});

describe('signEvmTokenOffline (Lane 2)', () => {
  const TO = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
  const usdc = DEFAULT_TOKENS.find(
    (token) => token.chain === 'eth' && token.symbol === 'USDC',
  )!;
  const usdtBsc = DEFAULT_TOKENS.find(
    (token) => token.chain === 'bsc' && token.symbol === 'USDT',
  )!;
  const usdcBase = DEFAULT_TOKENS.find(
    (token) => token.chain === 'base' && token.symbol === 'USDC',
  )!;

  it('signs a 25 USDC transfer on ETH; to is the contract, value is 0, calldata is the transfer call, chain id 1, gas 100000', async () => {
    const mnemonic = await createWallet();
    const signed = await signEvmTokenOffline(
      'eth',
      mnemonic,
      '',
      usdc.contract,
      TO,
      '25000000',
      '3',
      '20000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.txHash).toBe(keccak256(signed.signedTxHex));
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.to?.toLowerCase()).toBe(usdc.contract.toLowerCase());
    expect(parsed.value ?? 0n).toBe(0n);
    expect(parsed.data?.toLowerCase()).toBe(
      buildErc20TransferData(TO, '25000000').toLowerCase(),
    );
    expect(parsed.nonce).toBe(3);
    expect(parsed.chainId).toBe(1);
    expect(parsed.gas).toBe(100000n);
    expect(parsed.gasPrice).toBe(20000000000n);
    // The in-module verifier accepts the signed tx against its intent.
    await expect(
      verifyEvmTokenSignedTx(signed.signedTxHex, {
        from: signed.from,
        contract: usdc.contract,
        to: TO,
        amountBaseUnits: '25000000',
        nonce: '3',
        chainId: 1,
      }),
    ).resolves.toEqual({ ok: true });
    // And it rejects the same tx against the BSC chain id and a wrong amount.
    await expect(
      verifyEvmTokenSignedTx(signed.signedTxHex, {
        from: signed.from,
        contract: usdc.contract,
        to: TO,
        amountBaseUnits: '25000000',
        nonce: '3',
        chainId: 56,
      }),
    ).resolves.toEqual({
      ok: false,
      reason:
        'Signed token transaction chain id does not match the signing intent.',
    });
    await expect(
      verifyEvmTokenSignedTx(signed.signedTxHex, {
        from: signed.from,
        contract: usdc.contract,
        to: TO,
        amountBaseUnits: '25000001',
        nonce: '3',
        chainId: 1,
      }),
    ).resolves.toEqual({
      ok: false,
      reason:
        'Signed token transaction calldata does not match the signing intent.',
    });
  });

  it('signs a BSC USDT transfer (18 decimals); chain id 56, sender is the BSC address', async () => {
    const mnemonic = await createWallet();
    const addresses = await deriveAddresses(mnemonic, '');
    const signed = await signEvmTokenOffline(
      'bsc',
      mnemonic,
      '',
      usdtBsc.contract,
      TO,
      '1000000000000000000',
      '0',
      '5000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(addresses.bsc);
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.chainId).toBe(56);
    expect(parsed.to?.toLowerCase()).toBe(usdtBsc.contract.toLowerCase());
    expect(parsed.value ?? 0n).toBe(0n);
    expect(parsed.gas).toBe(100000n);
    await expect(
      verifyEvmTokenSignedTx(signed.signedTxHex, {
        from: signed.from,
        contract: usdtBsc.contract,
        to: TO,
        amountBaseUnits: '1000000000000000000',
        nonce: '0',
        chainId: 56,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('signs a Base USDC transfer; chain id 8453', async () => {
    const mnemonic = await createWallet();
    const signed = await signEvmTokenOffline(
      'base',
      mnemonic,
      '',
      usdcBase.contract,
      TO,
      '1000000',
      '0',
      '1000000000',
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.chainId).toBe(8453);
    expect(parsed.to?.toLowerCase()).toBe(usdcBase.contract.toLowerCase());
  });

  it('signs on every EVM chain with that chain\u2019s id', async () => {
    const mnemonic = await createWallet();
    for (const chain of EVM_TOKEN_CHAINS) {
      const chainId = chainConfig(chain).evmChainId;
      if (chainId === null) throw new Error(`No chain id for ${chain}.`);
      const signed = await signEvmTokenOffline(
        chain,
        mnemonic,
        '',
        usdc.contract,
        TO,
        '1000000',
        '0',
        '1000000000',
      );
      expect(signed.ok).toBe(true);
      if (!signed.ok) continue;
      const parsed = parseTransaction(signed.signedTxHex);
      expect(parsed.chainId).toBe(chainId);
      expect(parsed.to?.toLowerCase()).toBe(usdc.contract.toLowerCase());
      expect(parsed.gas).toBe(100000n);
    }
  }, 60000);

  it('signs on Sepolia in devnet mode (chain id 11155111)', async () => {
    const mnemonic = await createWallet();
    const devnet = await deriveDevnetAddressesAt(mnemonic, '', 0, 0);
    const signed = await signEvmTokenOffline(
      'eth',
      mnemonic,
      '',
      usdc.contract,
      TO,
      '1000000',
      '0',
      '1000000000',
      { devnet: true },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(devnet.eth);
    const parsed = parseTransaction(signed.signedTxHex);
    expect(parsed.chainId).toBe(11155111);
  });

  it('rejects an invalid mnemonic', async () => {
    expect(
      await signEvmTokenOffline(
        'eth',
        'abandon abandon',
        '',
        usdc.contract,
        TO,
        '1000',
        '0',
        '1',
      ),
    ).toEqual({
      ok: false,
      code: 'invalid-mnemonic',
      reason: 'Invalid mnemonic.',
    });
  });

  it('refuses a non-EVM chain', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEvmTokenOffline(
        'sol',
        mnemonic,
        '',
        usdc.contract,
        TO,
        '1000',
        '0',
        '1',
      ),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'Solana is not an EVM chain.',
    });
  });

  it('refuses BSC in devnet mode (no BSC test network)', async () => {
    const mnemonic = await createWallet();
    expect(
      await signEvmTokenOffline(
        'bsc',
        mnemonic,
        '',
        usdtBsc.contract,
        TO,
        '1000',
        '0',
        '1',
        { devnet: true },
      ),
    ).toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'BNB Smart Chain has no devnet network in this wallet.',
    });
  });
});

describe('signTrc20Offline (Lane 2)', () => {
  const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const dest = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';

  it('signs offline; the trigger call carries transfer(recipient, amount), the txid and signature recovery verify', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).trx;
    const signed = await signTrc20Offline(mnemonic, '', USDT, dest, '1000000', {
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
        contract: {
          type: string;
          parameter: {
            value: {
              contract_address: string;
              owner_address: string;
              data: string;
            };
          };
        }[];
        fee_limit: number;
      };
      raw_data_hex: string;
      signature: string[];
    };
    const contract = json.raw_data.contract[0] as {
      type: string;
      parameter: {
        value: {
          contract_address: string;
          owner_address: string;
          data: string;
        };
      };
    };
    expect(contract.type).toBe('TriggerSmartContract');
    const param = contract.parameter.value;
    expect(param.contract_address).toBe(
      bytesToHex(tronAddressToBytes(USDT)).slice(2),
    );
    expect(param.owner_address).toBe(
      bytesToHex(tronAddressToBytes(from)).slice(2),
    );
    // data = transfer selector + 32-byte recipient + 32-byte amount.
    expect(param.data.startsWith('a9059cbb')).toBe(true);
    // Wallet Core encodes the full 21-byte TRON address (0x41
    // prefix) in the 32-byte word — 11 zero bytes + 21 address bytes.
    expect(param.data.slice(8, 72)).toBe(
      '0000000000000000000000' +
        bytesToHex(tronAddressToBytes(dest)).slice(2),
    );
    expect(param.data.slice(72)).toBe(
      '00000000000000000000000000000000000000000000000000000000000f4240',
    );
    expect(json.raw_data.fee_limit).toBe(100000000);
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

  it('signs from the devnet address in devnet mode', async () => {
    const mnemonic = await createWallet();
    const devnet = await deriveDevnetAddressesAt(mnemonic, '', 0, 0);
    const signed = await signTrc20Offline(
      mnemonic,
      '',
      USDT,
      dest,
      '1000000',
      {
        timestamp: Date.now(),
        number: 1,
        txTrieRoot: '00'.repeat(32),
        parentHash: '00'.repeat(32),
        witnessAddress: devnet.trx,
      },
      { devnet: true },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(devnet.trx);
  });
});

describe('Solana signing with @solana/web3.js (expansion Lane SOL)', () => {
  // The fix for Lane 2's refusal: Wallet Core 4.9.3's Solana signer
  // returns an `encoded` transaction that does not parse as a Solana
  // wire transaction. These tests prove the replacement path — a
  // web3.js Transaction built from the derived ed25519 keypair — by
  // parsing the produced transaction back with Transaction.from and
  // verifying its signatures, the exact step the old signer failed.
  // A real recent blockhash (PublicNode, 2026-11-24); signing does not
  // check freshness, only that it is 32 bytes base58.
  const BLOCKHASH = 'FyuXxRoUgru9MrwnmRkfFzZiyZ5WR4JePH98mcqPpgHM';
  const FROM = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';

  function solStubAdapter(): ChainAdapter {
    return {
      chain: 'sol',
      networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      getBalance: async () => ({
        status: 'ok',
        data: {
          chain: 'sol',
          address: 'stub',
          networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          valueBaseUnits: '1000000000',
          decimals: 9,
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
          chain: 'sol',
          networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          feeBaseUnits: '5000',
          unit: 'lamports',
          note: 'stub fee',
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      }),
      getTxInputs: async () => ({
        status: 'ok',
        data: { kind: 'blockhash', blockhash: BLOCKHASH },
        source: 'stub',
        fetchedAt: 0,
      }),
      broadcast: async (): Promise<never> => {
        throw new Error('disabled');
      },
    };
  }

  beforeAll(() => {
    registerAdapter(solStubAdapter());
  });

  it('signs a native SOL transfer that parses as a valid wire transaction', async () => {
    const mnemonic = await createWallet();
    const recipient = (await deriveAddresses(await createWallet(), '')).sol;
    const from = (await deriveAddresses(mnemonic, '')).sol;
    const signed = await signSolOffline(mnemonic, '', recipient, '1000000', BLOCKHASH);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    // The exact failure the old signer had: parse the wire bytes back.
    const parsed = Transaction.from(
      Buffer.from(signed.signedTxBase64, 'base64'),
    );
    expect(parsed.verifySignatures()).toBe(true);
    expect(parsed.feePayer?.toBase58()).toBe(from);
    expect(parsed.recentBlockhash).toBe(BLOCKHASH);
    expect(parsed.instructions).toHaveLength(1);
    const instruction = parsed.instructions[0]!;
    expect(instruction.programId.toBase58()).toBe(
      SystemProgram.programId.toBase58(),
    );
    const decoded = SystemInstruction.decodeTransfer(instruction);
    expect(decoded.fromPubkey.toBase58()).toBe(from);
    expect(decoded.toPubkey.toBase58()).toBe(recipient);
    expect(BigInt(decoded.lamports)).toBe(1000000n);
    expect(parsed.signature).not.toBeNull();
    expect(decodeBase58(signed.signature)).toEqual(
      Uint8Array.from(parsed.signature!),
    );
  });

  it('refuses invalid SOL signing inputs', async () => {
    const mnemonic = await createWallet();
    const recipient = (await deriveAddresses(await createWallet(), '')).sol;
    await expect(
      signSolOffline(mnemonic, '', recipient, '1000', 'not-a-blockhash'),
    ).resolves.toEqual({
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount must be a positive lamport integer and the blockhash must be a recent Solana blockhash.',
    });
    await expect(
      signSolOffline(mnemonic, '', recipient, '0', BLOCKHASH),
    ).resolves.toMatchObject({ ok: false, code: 'invalid-input' });
    await expect(
      signSolOffline(mnemonic, '', 'not-an-address!!', '1000', BLOCKHASH),
    ).resolves.toMatchObject({ ok: false, code: 'invalid-input' });
    await expect(
      signSolOffline(mnemonic, '', recipient, '1000', BLOCKHASH, {
        devnet: true,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'invalid-input' });
    await expect(
      signSolOffline('abandon abandon', '', recipient, '1000', BLOCKHASH),
    ).resolves.toEqual({
      ok: false,
      code: 'invalid-mnemonic',
      reason: 'Invalid mnemonic.',
    });
  });

  it('signs an SPL transfer that parses, with TransferChecked decoded', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    const mnemonic = await createWallet();
    const recipient = (await deriveAddresses(await createWallet(), '')).sol;
    const from = (await deriveAddresses(mnemonic, '')).sol;
    const signed = await signSplOffline(
      mnemonic,
      '',
      usdcSol.contract,
      recipient,
      '25000000',
      usdcSol.decimals,
      BLOCKHASH,
      true,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.createdRecipientAta).toBe(false);
    const parsed = Transaction.from(
      Buffer.from(signed.signedTxBase64, 'base64'),
    );
    expect(parsed.verifySignatures()).toBe(true);
    expect(parsed.instructions).toHaveLength(1);
    const instruction = parsed.instructions[0]!;
    expect(instruction.programId.toBase58()).toBe(
      TOKEN_PROGRAM_ID.toBase58(),
    );
    const decoded = decodeTransferCheckedInstruction(instruction);
    expect(decoded.data.amount).toBe(25000000n);
    expect(decoded.data.decimals).toBe(usdcSol.decimals);
    expect(decoded.keys.mint.pubkey.toBase58()).toBe(usdcSol.contract);
    expect(decoded.keys.source.pubkey.toBase58()).toBe(
      deriveAssociatedTokenAddress(from, usdcSol.contract),
    );
    expect(decoded.keys.destination.pubkey.toBase58()).toBe(
      deriveAssociatedTokenAddress(recipient, usdcSol.contract),
    );
    expect(decoded.keys.owner.pubkey.toBase58()).toBe(from);
  });

  it('creates the recipient token account first when it does not exist', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    const mnemonic = await createWallet();
    const recipient = (await deriveAddresses(await createWallet(), '')).sol;
    const from = (await deriveAddresses(mnemonic, '')).sol;
    const signed = await signSplOffline(
      mnemonic,
      '',
      usdcSol.contract,
      recipient,
      '25000000',
      usdcSol.decimals,
      BLOCKHASH,
      false,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.createdRecipientAta).toBe(true);
    const parsed = Transaction.from(
      Buffer.from(signed.signedTxBase64, 'base64'),
    );
    expect(parsed.verifySignatures()).toBe(true);
    expect(parsed.instructions).toHaveLength(2);
    const createAta = parsed.instructions[0]!;
    expect(createAta.programId.toBase58()).toBe(
      ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    );
    expect(createAta.data.length).toBe(0);
    expect(createAta.keys[1]?.pubkey.toBase58()).toBe(
      deriveAssociatedTokenAddress(recipient, usdcSol.contract),
    );
    const transfer = parsed.instructions[1]!;
    expect(transfer.programId.toBase58()).toBe(TOKEN_PROGRAM_ID.toBase58());
    expect(
      decodeTransferCheckedInstruction(transfer).data.amount,
    ).toBe(25000000n);
    expect(from).not.toBe(recipient);
  });

  it('refuses invalid SPL signing inputs', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    const mnemonic = await createWallet();
    const recipient = (await deriveAddresses(await createWallet(), '')).sol;
    await expect(
      signSplOffline(
        mnemonic,
        '',
        usdcSol.contract,
        recipient,
        '25000000',
        256,
        BLOCKHASH,
        true,
      ),
    ).resolves.toMatchObject({ ok: false, code: 'invalid-input' });
    await expect(
      signSplOffline(
        mnemonic,
        '',
        'not-a-mint!!',
        recipient,
        '25000000',
        usdcSol.decimals,
        BLOCKHASH,
        true,
      ),
    ).resolves.toMatchObject({ ok: false, code: 'invalid-input' });
  });

  it('previews a native SOL send at the 5,000-lamport base fee', async () => {
    await expect(previewSendAmount('sol', FROM, FROM, '0.001')).resolves.toEqual({
      ok: true,
      amountBaseUnits: '1000000',
      feeBaseUnits: '5000',
      totalBaseUnits: '1005000',
      // The stub adapter's note, not the real adapter's: the preview
      // quotes the stub's fee. The value asserted is the 5,000 fee.
      feeNote: 'stub fee',
    });
  });

  it('previews an SPL send with zero rent when the recipient token account exists', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    await expect(
      previewTokenSendAmount('sol', usdcSol, FROM, FROM, '25', '100000000', undefined, {
        fetchSolanaAccountExists: async () => true,
      }),
    ).resolves.toEqual({
      ok: true,
      token: usdcSol,
      amountBaseUnits: '25000000',
      feeBaseUnits: '5000',
      rentBaseUnits: '0',
      attachedBaseUnits: '0',
      feeNote:
        'Base fee of 5,000 lamports for one signature; the recipient already has a token account for this token.',
    });
  });

  it('previews an SPL send with the live rent when the recipient token account is missing', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    await expect(
      previewTokenSendAmount('sol', usdcSol, FROM, FROM, '25', '100000000', undefined, {
        fetchSolanaAccountExists: async () => false,
        fetchSolanaRentExemption: async () => 1488440,
      }),
    ).resolves.toEqual({
      ok: true,
      token: usdcSol,
      amountBaseUnits: '25000000',
      feeBaseUnits: '5000',
      rentBaseUnits: '1488440',
      attachedBaseUnits: '0',
      feeNote:
        'Base fee of 5,000 lamports for one signature, plus 1488440 lamports to create the recipient token account (rent-exempt minimum).',
    });
  });

  it('simulates native and SPL sends on a live blockhash', async () => {
    const usdcSol = DEFAULT_TOKENS.find(
      (token) => token.chain === 'sol' && token.symbol === 'USDC',
    )!;
    await expect(simulateSend('sol', FROM, FROM, '0.001')).resolves.toMatchObject({
      ok: true,
      feeBaseUnits: '5000',
    });
    await expect(
      simulateTokenSend('sol', usdcSol, FROM, FROM, '25', undefined, {
        fetchTokenBalance: async () => ({
          status: 'ok' as const,
          data: {
            chain: 'sol' as const,
            address: FROM,
            networkId: 'test',
            valueBaseUnits: '100000000',
            decimals: 6,
            source: 'stub',
            fetchedAt: 0,
          },
          source: 'stub',
          fetchedAt: 0,
        }),
        fetchSolanaAccountExists: async () => true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      feeBaseUnits: '5000',
      rentBaseUnits: '0',
    });
  });
});

describe('signJettonOffline (Lane 2)', () => {
  // The USDT Jetton wallet of the tether treasury (TonAPI, live
  // 2026-11-24): a real Jetton wallet in raw '0:' form.
  const JETTON_WALLET =
    '0:2626cf30b702bdded845efc883efa45029ff59defdacc4ce7b8b0a5966d75002';
  const RECIPIENT = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';

  it('signs offline; BOC envelope and message hash verify, and the BOC differs from a native transfer to the same destination', async () => {
    const mnemonic = await createWallet();
    const from = (await deriveAddresses(mnemonic, '')).ton;
    const signed = await signJettonOffline(
      mnemonic,
      '',
      JETTON_WALLET,
      RECIPIENT,
      '1000000',
      0,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.from).toBe(from);
    expect(signed.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
    const boc = Buffer.from(signed.signedBocBase64, 'base64');
    expect(boc.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
    expect(boc.length).toBeGreaterThan(100);
    // A different amount signs a different BOC.
    const other = await signJettonOffline(
      mnemonic,
      '',
      JETTON_WALLET,
      RECIPIENT,
      '2000000',
      0,
    );
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.signedBocBase64).not.toBe(signed.signedBocBase64);
    // A native TON transfer to the same Jetton wallet (same amount,
    // same seqno) is a different message entirely.
    const native = await signTonOffline(
      mnemonic,
      '',
      JETTON_WALLET,
      '1000000',
      0,
    );
    expect(native.ok).toBe(true);
    if (!native.ok) return;
    expect(native.signedBocBase64).not.toBe(signed.signedBocBase64);
  });

  it('rejects an invalid mnemonic', async () => {
    expect(
      await signJettonOffline(
        'abandon abandon',
        '',
        JETTON_WALLET,
        RECIPIENT,
        '1000',
        0,
      ),
    ).toEqual({
      ok: false,
      code: 'invalid-mnemonic',
      reason: 'Invalid mnemonic.',
    });
  });
});

describe('previewTokenSendAmount / simulateTokenSend (Lane 2)', () => {
  const ethFrom = '0x7ef5cdbe01777d62438affeb695e33fc233597987';
  const ethTo = '0x1111111111111111111111111111111111111111';
  const usdc = DEFAULT_TOKENS.find(
    (token) => token.chain === 'eth' && token.symbol === 'USDC',
  )!;
  const usdtTrx = DEFAULT_TOKENS.find(
    (token) => token.chain === 'trx' && token.symbol === 'USDT',
  )!;
  // TON USDT's symbol is 'USD₮' in the defaults — find it by contract.
  const usdtTon = DEFAULT_TOKENS.find(
    (token) =>
      token.chain === 'ton' &&
      token.contract ===
        'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  )!;
  const tonAddress = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';
  const trxAddress = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';

  function tokenStub(
    chain: ChainId,
    balance: string,
    decimals: number,
    fee: AdapterResult<FeeEstimate>,
    inputs: AdapterResult<TxInput>,
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
          valueBaseUnits: balance,
          decimals,
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
      getTxInputs: async () => inputs,
      broadcast: async () => {
        throw new Error('disabled');
      },
    };
  }

  function okFee(
    chain: ChainId,
    feeBaseUnits: string,
  ): AdapterResult<FeeEstimate> {
    return {
      status: 'ok',
      data: {
        chain,
        networkId: 'test',
        feeBaseUnits,
        unit: 'wei',
        note: 'stub',
        source: 'stub',
        fetchedAt: 0,
      },
      source: 'stub',
      fetchedAt: 0,
    };
  }

  function okInputs(data: TxInput): AdapterResult<TxInput> {
    return { status: 'ok', data, source: 'stub', fetchedAt: 0 };
  }

  function stubTokenBalance(
    valueBaseUnits: string,
  ): AdapterResult<AdapterBalance> {
    return {
      status: 'ok',
      data: {
        chain: 'eth',
        address: 'stub',
        networkId: 'test',
        valueBaseUnits,
        decimals: 6,
        source: 'stub',
        fetchedAt: 0,
      },
      source: 'stub',
      fetchedAt: 0,
    };
  }

  it('previews a 25 USDC send on ETH: 20 gwei x 100000 gas', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      previewTokenSendAmount('eth', usdc, ethFrom, ethTo, '25', '100000000'),
    ).resolves.toEqual({
      ok: true,
      token: usdc,
      amountBaseUnits: '25000000',
      feeBaseUnits: '2000000000000000',
      rentBaseUnits: '0',
      attachedBaseUnits: '0',
      feeNote:
        'Token-transfer estimate at current gas price, 100000 gas; not a final fee',
    });
  });

  it('previews a TRC-20 send: energy fee x 65000', async () => {
    registerAdapter(
      tokenStub(
        'trx',
        '100000000',
        6,
        okFee('trx', '280'),
        okInputs({ kind: 'account', balanceSun: '100000000' }),
      ),
    );
    await expect(
      previewTokenSendAmount(
        'trx',
        usdtTrx,
        trxAddress,
        trxAddress,
        '1',
        '10000000',
      ),
    ).resolves.toEqual({
      ok: true,
      token: usdtTrx,
      amountBaseUnits: '1000000',
      feeBaseUnits: '18200000',
      rentBaseUnits: '0',
      attachedBaseUnits: '0',
      feeNote:
        'Upper-bound estimate at the current energy fee (65000 energy): the network charges only the energy actually used.',
    });
  });

  it('previews a Jetton send: unknown fee, 0.05 TON attached', async () => {
    registerAdapter(
      tokenStub(
        'ton',
        '1000000000',
        9,
        okFee('ton', '1000000'),
        okInputs({ kind: 'seqno', seqno: 3 }),
      ),
    );
    await expect(
      previewTokenSendAmount(
        'ton',
        usdtTon,
        tonAddress,
        tonAddress,
        '1',
        '10000000',
      ),
    ).resolves.toEqual({
      ok: true,
      token: usdtTon,
      amountBaseUnits: '1000000',
      feeBaseUnits: '0',
      rentBaseUnits: '0',
      attachedBaseUnits: '50000000',
      feeNote:
        'TON fee is charged by the network when the transaction is broadcast; it is not known in advance. The Jetton transfer itself attaches 0.05 TON, which comes out of your balance on top of this amount.',
      feeUnknown: true,
    });
  });

  it('refuses when the token balance is short', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      previewTokenSendAmount('eth', usdc, ethFrom, ethTo, '25', '10000000'),
    ).resolves.toEqual({
      ok: false,
      code: 'insufficient-funds',
      reason: 'Amount exceeds available balance.',
    });
  });

  it('refuses when the native balance does not cover the fee', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      previewTokenSendAmount('eth', usdc, ethFrom, ethTo, '25', '100000000'),
    ).resolves.toEqual({
      ok: false,
      code: 'insufficient-gas',
      reason: 'The ETH balance does not cover the estimated fee.',
    });
  });

  it('refuses when the token balance is not loaded', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      previewTokenSendAmount('eth', usdc, ethFrom, ethTo, '25', null),
    ).resolves.toEqual({
      ok: false,
      code: 'adapter-unavailable',
      reason: 'The USDC balance is not loaded yet.',
    });
  });

  it('refuses a chain with no token standard', async () => {
    const fakeBtcToken: TokenRecord = {
      chain: 'btc',
      contract: '',
      name: 'Fake',
      symbol: 'FAKE',
      decimals: 8,
      coingeckoId: null,
      addedAtMs: 0,
    };
    await expect(
      previewTokenSendAmount(
        'btc',
        fakeBtcToken,
        'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
        'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
        '1',
        '100000000',
      ),
    ).resolves.toEqual({
      ok: false,
      code: 'adapter-unavailable',
      reason:
        'Bitcoin has no token standard — only its native coin can be sent.',
    });
  });

  it('refuses a non-ETH devnet token send', async () => {
    const usdcMatic = DEFAULT_TOKENS.find(
      (token) => token.chain === 'matic' && token.symbol === 'USDC',
    )!;
    await expect(
      previewTokenSendAmount(
        'matic',
        usdcMatic,
        ethFrom,
        ethTo,
        '25',
        '100000000',
        { devnet: true },
      ),
    ).resolves.toEqual({
      ok: false,
      code: 'invalid-input',
      reason: 'Polygon has no devnet network in this wallet.',
    });
  });

  it('simulates an ETH token send with live balance and nonce inputs', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      simulateTokenSend('eth', usdc, ethFrom, ethTo, '25', undefined, {
        fetchTokenBalance: async () => stubTokenBalance('100000000'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      amountBaseUnits: '25000000',
      feeBaseUnits: '2000000000000000',
    });
  });

  it('simulates a stale ETH token balance', async () => {
    registerAdapter(
      tokenStub(
        'eth',
        '1000000000000000000',
        18,
        okFee('eth', '420000000000000'),
        okInputs({ kind: 'nonce', nonce: 5 }),
      ),
    );
    await expect(
      simulateTokenSend('eth', usdc, ethFrom, ethTo, '25', undefined, {
        fetchTokenBalance: async () => stubTokenBalance('10000000'),
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'insufficient-funds',
      reason: 'Amount exceeds available balance.',
    });
  });

  it('simulates a TRX token send refused when the native balance no longer covers the fee', async () => {
    registerAdapter(
      tokenStub(
        'trx',
        '100000000',
        6,
        okFee('trx', '280'),
        okInputs({ kind: 'account', balanceSun: '1000000' }),
      ),
    );
    await expect(
      simulateTokenSend(
        'trx',
        usdtTrx,
        trxAddress,
        trxAddress,
        '1',
        undefined,
        {
          fetchTokenBalance: async () => stubTokenBalance('10000000'),
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      code: 'insufficient-funds',
      reason: 'The TRX balance no longer covers the estimated fee.',
    });
  });

  it('simulates a Jetton send with seqno inputs', async () => {
    registerAdapter(
      tokenStub(
        'ton',
        '1000000000',
        9,
        okFee('ton', '1000000'),
        okInputs({ kind: 'seqno', seqno: 3 }),
      ),
    );
    await expect(
      simulateTokenSend('ton', usdtTon, tonAddress, tonAddress, '1', undefined, {
        fetchTokenBalance: async () => stubTokenBalance('10000000'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      amountBaseUnits: '1000000',
      feeUnknown: true,
    });
  });
});
