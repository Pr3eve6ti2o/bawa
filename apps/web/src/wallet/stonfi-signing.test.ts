// STON.fi Omniston TON order signing — Lane B (2026-11-27).
//
// Verifies, for real, that signStonfiOrderTonOffline produces a
// genuine V4R2-signed external message over the order's messages:
// the signed BoC parses, its root hash is the returned messageHash,
// the Ed25519 signature verifies against the derived public key,
// the header round-trips (subwallet / validUntil / seqno / op / send
// mode 3), the body carries exactly the order's messages, and every
// order payload (and stateInit) cell is present in the signed tree.
//
// The live fixture is a REAL orderTx.messages shape: RFQ 1 USDT on
// TON -> USDC on Base, 2026-11-27, quoteId
// 7fc458a6d46d6c9e1a19116cead9e8e546ee5083349c63cde89aa041175bc59e,
// outputUnits 972472, HTLC order (keccak256), built by the SDK's
// tonBuildEscrowTransfer. The quote has since expired, but the
// message shape is the live one — target, amount and the 3,162-byte
// payload BoC exactly as the builder returned them. Signing it here
// uses the standard never-funded BIP39 test-vector mnemonic and
// nothing is broadcast, sent or registered.
import { describe, expect, it } from 'vitest';
import { Cell, beginCell } from '@ton/core';
import { ed25519 } from '@noble/curves/ed25519';
import { loadCore } from '../engine/boundary';
import { pathFor } from './chains';
import {
  STONFI_TON_MAX_MESSAGES,
  signStonfiOrderTonOffline,
  stonfiOrderToTonConnectMessages,
} from './stonfi-signing';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// TON address derived from TEST_MNEMONIC at m/44'/607'/0'/0/0 (account 0).
const TEST_TON_ADDRESS = 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY';

// V4R2 default subwallet id, as stored in the signed body.
const V4R2_SUBWALLET_ID = 698983191;

/** Live order message (see the module note above). */
const LIVE_ORDER_MESSAGE = {
  targetAddress: 'EQCy8Y18iib6qg8GSzouKHOxNop6fe1QLSeeN-q-nKMOzwGp',
  sendAmount: '400000000',
  payload: 'b5ee9c7241022701000c4a0001ae0f8a7ea5e89aa041175bc59e30f4240801e4d9de792ed2d75813005a2a554cd00827f6dd8c9ceba0bc30ef18c6da0ce217000cd665aea73399897aff75c0673b54249f06822c611a8a26957bf0df0075df7e4823c34601010495c0a5f0d97fc458a6d46d6c9e1a19116cead9e8e546ee5083349c63cde89aa041175bc59e400335996ba9cce6625ebfdd7019ced50927c1a08b1846a289a55efc37c01d77df9407270e00400203040502aff2c6fa638011c78ec24d440fce6ed8fc4767f190460ac25e3149570f3a19adda4b91b1a2365ed210da12aa96ea42de4f2f61dc172bbaa3da86051a1b2a6f342f69a777d2770000000000000012c0000000000000000800040607046c228210066ac100bae3022282107fd9a46eba968200d8f4f2f0e02282108d9c37d4bae302228210653b10ffbae302228210a5ea9a04ba08090a0b01878000000000000000000000000000000000000000000000000000000000000000001000cd665aea73399897aff75c0673b54249f06822c611a8a26957bf0df0075df7e4400c0019000000000000004b000000002002000d0e00670000000000002105833589fcd6edb6e08f4c7c32d4f71b54bda029139858effd232b4033e47d90003d41ec34ecaeda9430ed7db802fe326f15d72c2792066984f2bfd33f31fa4831fa003001d0d72c279637d31cf2bffa48d3000192d3ff926d01e2d33fd33fd4f404d30fd18200cb2527fa4430f2f2f8235005a05204a024c2008e128200d6e225c201f2f48200d6e225c121f2f4dec85008fa0216fa52246e943403cf8195cf8314cbffe2cb3f14cb3f89cf16cc0f1001fc3031ed44d0810108d721fa4831fa4831fa00d4d74c01d021d0246f113501fa4830820080b6256e9331347f9505c705c300e214f2f402fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f23109a108a107a106a105a104a55205f056c2232f8235202bb925b7195be9172e073e28200d6db01c003f2f41100f85f03ed44d0810108d721fa4831fa4831fa00d431d74c20d0fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f23109a108a107a106a105a104a55205f056c2232f8235202bb925b7195be9172e073e28200d6db01c003f2f48200d6e101f2f28200d6e022c200f2f470206d6d2210567f7f6d6f0a03fee30231218210e175ab1fba8e6031ed44d0d431d74cd001d0fa00d101fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f503aa1c85009fa0217fa52256e943504cf8195cf8315cbffe213cb3fcb3fcb0f5003fa02ccf400cb0fc97053006d6d2270706d6f0ae021821051389218bae30221821093debc2e121314004320000000000000000000000000000000000000000000000000000000000000000004046c228210066ac100bae3022282107fd9a46eba968200d8f4f2f0e02282108d9c37d4bae302228210653b10ffbae302228210c81df26eba1516171801cbc8d4b4285ed7cb229ce58830edbe85c6cb988afd432a6c5cfcc1fd11fa62b2450d6525958011c78ec24d440fce6ed8fc4767f190460ac25e3149570f3a19adda4b91b1a2364000000000000000200000000000000f000000000000001e0000000000000025901900050000080020f400cb0fc97053006d6d227f706d6f0a00348200d6e022c200f2f4c00070206d21103441306d7f50036d6f0a02fc32ed44d0d431d74cd0216f11226f12236f14348200d6dc226eb3f2f4f82305d0d72c242638f264f2bfd30001988308d718d4810088946d6d5870e201fa00fa00f404d108fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f20c200209b3b3b8200d6df24f2f2280be30d8200d6e02cc200f2f45479871a1b01fc31ed44d0810108d721fa4831fa4831fa00d4d74c01d001d003d0fa00d103fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f513ca151bca0f82326bc2c91709320c300e29521c200c3009170e201952cc200c3009170e2c8500cfa021afa52286e943807cf8195cf8318cbffe216cb3f14cb3f12cb0f1c01aebae3023082105ef4b2d3ba8e43ed44d0810108d721fa4831fa4831fa00d431d74cd0fa0031fa4831d3000193d3ff31ded33f31d33fd30f31fa00308200d6e101f2f28200d6e002c20012f2f4a4206f02e08200d8f4f2f01d01fe326f15d72c2792066984f2bfd33f31fa4831fa00d74c02d0d72c2646a5a144f2bfd3fffa48d33fd33fd33fd33fd4d1d0fa48d3000192d3ff926d01e2fa00d18200cf0929f2f48200cf1428fa4430f2f28200cf1423fa4430f2f28200cf1127c200f2f48200cf115367bef2f48200cf115356bcf2f48200cf115345bef2f40a1e01f632ed44d0810108d721fa4831fa4831fa00d431d74c20d0236f11348200cf10246eb3f2f4f82301d3ff31fa00fa48d37f31d33fd33fd74c258200cf0d04be13f2f401d0d3000192d3ff926d01e2fa00fa48d15264b99d313437258200cf1002c705f2f4e30e70207f7fc85005fa02c95e26103710265e2241306f0a1f00b05f03ed44d0810108d721fa4831fa4831fa00d431d74c20d0f82301d3ff31fa00fa48d3bf31d33fd74c048200cf0d02bef2f402d0d3000193d3ff31defa00fa48d170207f7fc85007fa02c910891037102610451034126f0a02fe8efd32ed44d0d431d74c20d0226f11036f158200cf10246eb3f2f4d72c22bf7fc4bcf2bfd33f31d20031fa50d431fa4831f40431d1f82302d3fffa00fa48d33fd33fd33fd74c288200cf0b05be14f2f4278200cf0c02b9f2f409d0d72c20da3cafa4f2bfd6ffd30001988308d718d4810088946d6d5870e201d104d0d300012021004c80066b32d75399ccc4bd7fbae0339daa124f834116308d45134abdf86f803aefbf241dcd6500005253a4a122a527ba9b3d2c8200d6e50dbe1cf2f48e1353d0b940eee304208200d6e40dbe1cf2f410abe201fe547987547987295f056c2232f8235202bb925b7195be9172e073e220c0019c308200d6dc56112ac705f2f49ac002968200d6daf2f0e1e28200d6dd286eb3f2f48200d6dd0dc3001df2f48200cb2b2df9005410f8f9101ef2f40bd0d33ffa48d18200cb291110c7051ff2f40d8200d6de1111bc01111001f2f42ea451c7a0c822006e5008fa02ccf40015cb0fc903fa48302191359834521570e3040304e270530192337f9303c300e250066de304221046126d7050036d6f0a01fc31ed44d0810108d721fa4831fa4831fa00d431d74cd002d0fa00d102fa00fa48d3000192d3ff926d01e2d33fd33fd30ffa00d4f404d70b0f503ba1209239709509c000c300e2c85009fa0217fa52256e943504cf8195cf8315cbffe213cb3fcb3fcb0f5004fa02cc12f40012cb0fc97053006d2110561045103441306d702300cad0fa4831fa5031d35f31fa00308200cf182b821006d321a0a012bef2f4f8235207a05266a05265a05063a0c8266e943605cf8195cf8316cbffe25009fa0218fa52c905c8cbff5006fa0213fa5212cb3f13cb3f13cb3fcb3fccc97053006d6d227f706d6f0a00d05284c705b395206eb3c3009170e28e5208d0d72c20c1498d3cf2bfd30001988308d718d4810088946d6d5870e201d18200cb2b01c3009921f900403bf910c30093323970e2f2f407d0d33ffa48d18200cb295118c705f2f48200cf1604bc13f2f41593303336e21501fc92d3ff926d01e2fa00fa4831d152aeb99f10345f0435268200cf1002c705f2f48e4852b6c705b395246eb3c3009170e28e338200cb2b04c3009920f9004005f910c30093313370e212f2f401d0d33ffa48d18200cb295119c705f2f48200cf1606bc15f2f4935b365be2e20371f904038200cf0a02baf2f470207070c826240058e05b82105ef4b2d3ba8e1aed44d0d431d74cd0d3ff31fa0031fa4831d3bf31d70b3f206f02e08200d8f4f2f001fe5006fa025240fa52236e92cf8196cf8323cf0bffe212cb3fcb3f1acb0f58fa0225cf1416f40013cb0fc903d0d4d74cd0d72c2646a5a144f2bfd3fffa4831d33fd33fd33fd33fd4d1d0fa48d3000193d3ff31defa00d10caa018208989680a08208989680a082081e8480a0820afaf080a08200cf18511da0821006d321a0a025000a50036d6f0a001efa02c9107910681047103610346f0a01fc01111001be1ff2f424088e46378200cf202c6eb3f2f40bd7398200cf1c01f2f48200cf1d01d30701c00312f2f48200cf1e01d3ff05baf2f402d30f31d74c52c08307f40e6fa18200cf1f01f2f4d70bff451592343be20bc8fa52296e943908cf8195cf8319cbffe25007fa02c9c8cf932352d0a214cbff15fa5216cb3f1726001ecb3f15cb3f12cb3f14ccc944306f058efc4450',
};

async function derivedTonPublicKey(account = 0): Promise<Uint8Array> {
  const core = await loadCore();
  const wallet = core.HDWallet.createWithMnemonic(TEST_MNEMONIC, '');
  try {
    const key = wallet.getKey(core.CoinType.ton, pathFor('ton', account, 0));
    try {
      const pubkeyObj = key.getPublicKeyEd25519();
      try {
        return new Uint8Array(pubkeyObj.data());
      } finally {
        pubkeyObj.delete();
      }
    } finally {
      key.delete();
    }
  } finally {
    wallet.delete();
  }
}

function collectHashes(cell: Cell, into = new Set<string>()): Set<string> {
  into.add(cell.hash().toString('hex'));
  for (const ref of cell.refs) collectHashes(ref, into);
  return into;
}

/**
 * Verify a signed order BoC end to end: BoC magic, root hash,
 * Ed25519 signature over the unsigned body cell, header round-trip,
 * message count + send mode, and that every payload / stateInit cell
 * is embedded in the signed tree.
 */
async function verifySignedOrder(
  signed: { signedBocBase64: string; messageHash: string },
  expected: {
    seqno: number;
    validUntil: number;
    messageCount: number;
    payloadHexes: string[];
    stateInitHexes: string[];
    account?: number;
    /** Read-back validUntil when it differs (seqno 0: UINT32_MAX). */
    readBackValidUntil?: number;
  },
): Promise<void> {
  const bytes = Buffer.from(signed.signedBocBase64, 'base64');
  expect(bytes.subarray(0, 4).toString('hex')).toBe('b5ee9c72');
  const roots = Cell.fromBoc(bytes);
  expect(roots).toHaveLength(1);
  const root = roots[0];
  expect(root).toBeDefined();
  if (root === undefined) throw new Error('unreachable');
  expect(signed.messageHash).toBe('0x' + root.hash().toString('hex'));

  // 512-bit signature + subwallet(32) + validUntil(32) + seqno(32)
  // + op(8) + one send-mode byte per message. The root carries the
  // signed body, plus — only for seqno 0, an undeployed wallet — the
  // wallet's own stateInit as a second ref (a StateInit cell: code +
  // data refs).
  expect(root.refs.length).toBeLessThanOrEqual(2);
  const expectedBodyBits = 616 + 8 * expected.messageCount;
  const signedBody = root.refs.find(
    (ref) => ref.bits.length === expectedBodyBits,
  );
  expect(signedBody).toBeDefined();
  if (signedBody === undefined) throw new Error('unreachable');
  expect(signedBody.bits.length).toBe(expectedBodyBits);
  const extraRefs = root.refs.filter((ref) => ref !== signedBody);
  for (const extra of extraRefs) {
    expect(extra.refs).toHaveLength(2);
  }
  const slice = signedBody.beginParse();
  const signature = slice.loadBuffer(64);
  const restBits = slice.loadBits(slice.remainingBits);
  const unsigned = beginCell().storeBits(restBits);
  const refCount = slice.remainingRefs;
  for (let i = 0; i < refCount; i += 1) {
    unsigned.storeRef(slice.loadRef());
  }
  const unsignedCell = unsigned.endCell();
  const pubkey = await derivedTonPublicKey(expected.account ?? 0);
  expect(ed25519.verify(signature, unsignedCell.hash(), pubkey)).toBe(true);

  const body = unsignedCell.beginParse();
  expect(body.loadUint(32)).toBe(V4R2_SUBWALLET_ID);
  expect(body.loadUint(32)).toBe(
    expected.readBackValidUntil ?? expected.validUntil,
  );
  expect(body.loadUint(32)).toBe(expected.seqno);
  expect(body.loadUint(8)).toBe(0);
  expect(body.remainingRefs).toBe(expected.messageCount);
  for (let i = 0; i < expected.messageCount; i += 1) {
    expect(body.loadUint(8)).toBe(3);
  }

  const treeHashes = collectHashes(root);
  for (const hex of expected.payloadHexes) {
    expect(treeHashes.has(Cell.fromHex(hex).hash().toString('hex'))).toBe(true);
  }
  for (const hex of expected.stateInitHexes) {
    expect(treeHashes.has(Cell.fromHex(hex).hash().toString('hex'))).toBe(true);
  }
}

describe('signStonfiOrderTonOffline (live-shape order)', () => {
  it('signs the real Omniston order message with a verifiable signature', async () => {
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const signed = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      7,
      { validUntil },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) throw new Error('unreachable');
    expect(signed.from).toBe(TEST_TON_ADDRESS);
    expect(signed.messageCount).toBe(1);
    expect(signed.validUntil).toBe(validUntil);
    expect(signed.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
    await verifySignedOrder(signed, {
      seqno: 7,
      validUntil,
      messageCount: 1,
      payloadHexes: [LIVE_ORDER_MESSAGE.payload],
      stateInitHexes: [],
    });
  });

  it('signs a two-message order with a stateInit, all cells embedded', async () => {
    const payloadA = beginCell()
      .storeUint(0x12345678, 32)
      .storeUint(0n, 64)
      .endCell()
      .toBoc()
      .toString('hex');
    const payloadB = beginCell()
      .storeUint(0x0f8a7ea5, 32)
      .storeUint(0n, 64)
      .storeCoins(1000000n)
      .endCell()
      .toBoc()
      .toString('hex');
    const stateInit = beginCell()
      .storeUint(0xabcdef01, 32)
      .storeBuffer(Buffer.from('jetton-wallet-state', 'utf8'))
      .endCell()
      .toBoc()
      .toString('hex');
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const signed = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      {
        messages: [
          {
            targetAddress: 'EQDybO88l2lrrAmALRUqpmgEE_tuxk510F4Yd4xjbQZxC9IA',
            sendAmount: '100000000',
            payload: payloadA,
          },
          {
            targetAddress: 'EQCOPHYSaiB-c3bH4js_jIIwVhLxikq4edDNbtJcjY0Rsg88',
            sendAmount: '50000000',
            payload: payloadB,
            jettonWalletStateInit: stateInit,
          },
        ],
      },
      3,
      { validUntil },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) throw new Error('unreachable');
    expect(signed.messageCount).toBe(2);
    await verifySignedOrder(signed, {
      seqno: 3,
      validUntil,
      messageCount: 2,
      payloadHexes: [payloadA, payloadB],
      stateInitHexes: [stateInit],
    });
  });

  it('is deterministic for fixed inputs', async () => {
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const first = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      7,
      { validUntil },
    );
    const second = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      7,
      { validUntil },
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');
    expect(second.signedBocBase64).toBe(first.signedBocBase64);
    expect(second.messageHash).toBe(first.messageHash);
  });

  it('signs from the requested vault account', async () => {
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const signed = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      0,
      { validUntil, account: 1 },
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) throw new Error('unreachable');
    expect(signed.from).not.toBe(TEST_TON_ADDRESS);
    // Seqno 0 is the wallet-deploy transaction: Wallet Core signs
    // valid_until = UINT32_MAX, and the function reports that
    // effective expiry rather than the requested one.
    expect(signed.validUntil).toBe(4294967295);
    await verifySignedOrder(signed, {
      seqno: 0,
      validUntil,
      messageCount: 1,
      payloadHexes: [LIVE_ORDER_MESSAGE.payload],
      stateInitHexes: [],
      account: 1,
      readBackValidUntil: 4294967295,
    });
  });

  it('converts the live order to TON Connect messages', () => {
    const messages = stonfiOrderToTonConnectMessages({
      messages: [LIVE_ORDER_MESSAGE],
    });
    expect(messages).toHaveLength(1);
    const firstMessage = messages[0];
    expect(firstMessage).toBeDefined();
    if (firstMessage === undefined) throw new Error('unreachable');
    expect(firstMessage.address).toBe(LIVE_ORDER_MESSAGE.targetAddress);
    expect(firstMessage.amount).toBe('400000000');
    expect(firstMessage.stateInit).toBeUndefined();
    expect(firstMessage.payload).toBe(
      Buffer.from(LIVE_ORDER_MESSAGE.payload, 'hex').toString('base64'),
    );
    // The converted payload is the same BoC bytes the SDK handed over.
    expect(
      Buffer.from(firstMessage.payload as string, 'base64').toString('hex'),
    ).toBe(LIVE_ORDER_MESSAGE.payload);
  });

  it.each([
    ['empty messages', { messages: [] }, 0, {}, 'invalid-input'],
    [
      'too many messages',
      {
        messages: Array.from({ length: STONFI_TON_MAX_MESSAGES + 1 }, () => ({
          ...LIVE_ORDER_MESSAGE,
        })),
      },
      0,
      {},
      'invalid-input',
    ],
    [
      'bad amount',
      {
        messages: [{ ...LIVE_ORDER_MESSAGE, sendAmount: '1.5' }],
      },
      0,
      {},
      'invalid-input',
    ],
    [
      'bad payload hex',
      {
        messages: [{ ...LIVE_ORDER_MESSAGE, payload: 'zz' }],
      },
      0,
      {},
      'invalid-input',
    ],
    [
      'bad stateInit hex',
      {
        messages: [{ ...LIVE_ORDER_MESSAGE, jettonWalletStateInit: '0xzz' }],
      },
      0,
      {},
      'invalid-input',
    ],
    [
      'missing target',
      {
        messages: [{ ...LIVE_ORDER_MESSAGE, targetAddress: '' }],
      },
      0,
      {},
      'invalid-input',
    ],
    [
      'negative seqno',
      { messages: [LIVE_ORDER_MESSAGE] },
      -1,
      {},
      'invalid-input',
    ],
    [
      'expired validUntil',
      { messages: [LIVE_ORDER_MESSAGE] },
      0,
      { validUntil: Math.floor(Date.now() / 1000) - 10 },
      'invalid-input',
    ],
  ])('rejects %s', async (_label, orderTx, seqno, options, code) => {
    const result = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      orderTx,
      seqno,
      options,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe(code);
  });

  it('rejects an unsupported wallet version', async () => {
    const result = await signStonfiOrderTonOffline(
      TEST_MNEMONIC,
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      0,
      // 'v3r2' is not a supported option: the cast is the test.
      { walletVersion: 'v3r2' as unknown as 'v4r2' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('unsupported-version');
  });

  it('rejects an invalid mnemonic', async () => {
    const result = await signStonfiOrderTonOffline(
      'abandon abandon abandon',
      '',
      { messages: [LIVE_ORDER_MESSAGE] },
      0,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('invalid-mnemonic');
  });
});
