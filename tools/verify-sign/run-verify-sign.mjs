// Lane E independent verification — offline transaction construction + signing
// + verification for BTC / ETH / TRX / TON (§6 item 6, Bawa wallet-panel rebuild).
//
// Fresh CSPRNG 24-word mnemonic, one per run, held in process memory only.
// The mnemonic and every private-key byte array are NEVER printed, logged,
// committed or uploaded; key byte arrays are zeroed after use and the
// process exits at the end. Only PUBLIC addresses, signed-transaction
// verification outputs and decoded fields are printed.
//
// No broadcast path: the run first asserts the signing module has no
// network capability, and no broadcast/send function is called anywhere.
// STOP BEFORE BROADCASTING: M-35 execution is NOT authorised.
//
// Usage (Node >=22 <23, from the repo root):
//   node tools/verify-sign/run-verify-sign.mjs
import { getRandomValues, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBtcP2wpkhUnsignedTx,
  buildEth1559UnsignedTx,
  buildTonV4R2UnsignedTransfer,
  buildTronMainnetUnsignedTransfer,
} from '../mainnet-tx/unsigned-tx.mjs';
import {
  assertNoNetworkCapability,
  base58CheckEncode,
  bytesToHex,
  encodeBech32,
  hash160,
  hexToBytes,
  loadWalletCore,
  parseBtcSignedTx,
  parseEthSignedTx,
  parseTonBoc,
  parseTronRawData,
  privateKeyToPublicKey,
  publicKeyToEthAddress,
  publicKeyToTronAddress,
  signBtc,
  signEth,
  signTon,
  signTron,
  tonAddressToHash,
  tonHashToFriendlyAddress,
  verifyBtc,
  verifyEth,
  verifyTon,
  verifyTron,
  WALLET_CORE_VERSION,
} from '../mainnet-signing/local-signing.mjs';

const EXPECTED_WASM_SHA256 =
  '13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217';

// Published public test-vector destinations (docs/mainnet/MAINNET-VECTORS.md,
// ripple fixture — public vectors, never funded, never receiving addresses).
const BTC_DEST = 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd';
const ETH_DEST = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';
const TRX_DEST = 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c';
const TON_DEST = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';

// Construction inputs (realistic mainnet values; all offline, unfunded).
const BTC_INPUT_SATS = '50000';
const BTC_AMOUNT_SATS = '30000';
const BTC_BYTE_FEE = 2; // sat/vB; signer fee = byteFee * 141 vB = 282 sats
const BTC_EXPECTED_FEE_SATS = '282';
const BTC_EXPECTED_CHANGE_SATS = '19718';
const ETH_NONCE = '7';
const ETH_VALUE_WEI = '2500000000000000'; // 0.0025 ETH
const ETH_GAS_LIMIT = '21000';
const ETH_MAX_PRIORITY_GWEI = '2000000000'; // 2 gwei
const ETH_MAX_FEE_GWEI = '30000000000'; // 30 gwei
const ETH_MAX_FEE_WEI = '630000000000000'; // 21000 * 30 gwei
const TRX_AMOUNT_SUN = '2500000'; // 2.5 TRX
const TRX_TIMESTAMP_MS = '1763506000000';
const TRX_EXPIRATION_MS = '1763509600000';
const TON_AMOUNT_NANO = '120000000'; // 0.12 TON
const TON_SEQNO = 5;
const TON_VALID_UNTIL = 1800000000;
const TON_MODE = 3;

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function randomHex32() {
  // Fresh random 32 bytes; never all-zero (rejected as a null outpoint).
  for (;;) {
    const bytes = getRandomValues(new Uint8Array(32));
    if (bytes.some((b) => b !== 0)) return bytesToHex(bytes);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

function trunc(hex, head = 64) {
  return hex.length > head ? `${hex.slice(0, head)}…(${hex.length} chars)` : hex;
}

// Minimal protobuf scan: pull the length-delimited bytes of one field number
// out of a protobuf message (used only to decode the TRON outer Transaction:
// field 1 = raw_data, field 2 = signature).
function protoFieldBytes(buf, wantField) {
  let pos = 0;
  while (pos < buf.length) {
    let tag = 0;
    let shift = 0;
    for (;;) {
      const b = buf[pos++];
      tag |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const field = tag >> 3;
    const wire = tag & 0x07;
    if (wire !== 2) throw new Error(`TRON outer decode: unexpected wire type ${wire}`);
    let len = 0;
    shift = 0;
    for (;;) {
      const b = buf[pos++];
      len |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const bytes = buf.subarray(pos, pos + len);
    pos += len;
    if (field === wantField) return Buffer.from(bytes);
  }
  throw new Error(`TRON outer decode: field ${wantField} not found`);
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printJson(label, value) {
  console.log(`${label}: ${JSON.stringify(value)}`);
}

const results = {};
function verdict(chain, status, detail) {
  results[chain] = { status, detail };
  console.log(`VERDICT ${chain}: ${status} — ${detail}`);
}

async function main() {
  console.log('Lane E offline signing verification (fresh CSPRNG keys, no broadcast)');
  console.log(`node: ${process.version}`);
  console.log(`wallet-core package version: ${WALLET_CORE_VERSION}`);

  // --- WASM identity -------------------------------------------------------
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const wasmPath = join(
    moduleDir, '..', 'hdwallet-gen', 'node_modules',
    '@trustwallet', 'wallet-core', 'dist', 'lib', 'wallet-core.wasm',
  );
  const wasmBytes = readFileSync(wasmPath);
  const wasmHash = sha256Hex(wasmBytes);
  console.log(`wasm: ${wasmBytes.length} bytes sha256 ${wasmHash}`);
  assert(wasmHash === EXPECTED_WASM_SHA256, 'WASM sha256 mismatch');
  const pkgVersion = JSON.parse(readFileSync(join(
    moduleDir, '..', 'hdwallet-gen', 'node_modules',
    '@trustwallet', 'wallet-core', 'package.json',
  ), 'utf8')).version;
  assert(pkgVersion === WALLET_CORE_VERSION, 'wallet-core version mismatch');
  console.log('wasm hash: MATCH (4.9.3 pinned WASM)');

  // --- No-network gate -----------------------------------------------------
  const noNet = assertNoNetworkCapability();
  console.log(`assertNoNetworkCapability: ${noNet}`);

  const { core } = await loadWalletCore();
  const isolation = {
    dir: mkdtempSync(join(tmpdir(), 'lane-e-isolation-')),
    assertIsolated: () => true,
    credentialKind: 'temporary-unfunded',
  };

  // --- Fresh disposable test wallet (CSPRNG, memory only) ------------------
  const entropy = getRandomValues(new Uint8Array(32));
  const wallet = core.HDWallet.createWithEntropy(entropy, '');
  entropy.fill(0);
  // The mnemonic string is held in process memory only, never printed.
  const mnemonic = wallet.mnemonic();
  assert(typeof mnemonic === 'string' && mnemonic.split(' ').length === 24, 'expected a 24-word mnemonic');
  console.log('fresh mnemonic: 24 words generated from 32 bytes CSPRNG (words NOT printed)');

  const keyBytes = {}; // chain -> Buffer (zeroed in finally)
  const addresses = {};
  try {
    const paths = {
      btc: "m/84'/0'/0'/0/0",
      eth: "m/44'/60'/0'/0/0",
      trx: "m/44'/195'/0'/0/0",
      ton: "m/44'/607'/0'",
    };
    const coins = {
      btc: core.CoinType.bitcoin,
      eth: core.CoinType.ethereum,
      trx: core.CoinType.tron,
      ton: core.CoinType.ton,
    };
    for (const chain of ['btc', 'eth', 'trx', 'ton']) {
      const key = wallet.getKey(coins[chain], paths[chain]);
      try {
        keyBytes[chain] = Buffer.from(key.data());
      } finally {
        key.delete();
      }
      assert(keyBytes[chain].length === 32, `${chain} key must be 32 bytes`);
    }
    // BTC change key (m/84'/0'/0'/1/0).
    const changeKey = wallet.getKey(core.CoinType.bitcoin, "m/84'/0'/0'/1/0");
    let changePub;
    try {
      keyBytes.btcChange = Buffer.from(changeKey.data());
      changePub = privateKeyToPublicKey(keyBytes.btcChange, true);
    } finally {
      changeKey.delete();
    }
    const changeAddress = encodeBech32('bc', hash160(changePub));
    const changePubHex = bytesToHex(changePub);

    // Sender addresses: module helpers (independent of wallet-core) + a
    // cross-check against wallet-core getAddressForCoin for every chain.
    addresses.btc = encodeBech32('bc', hash160(privateKeyToPublicKey(keyBytes.btc, true)));
    addresses.eth = publicKeyToEthAddress(privateKeyToPublicKey(keyBytes.eth, false));
    addresses.trx = publicKeyToTronAddress(privateKeyToPublicKey(keyBytes.trx, false));
    const tonEdPub = core.PrivateKey.createWithData(keyBytes.ton).getPublicKeyEd25519();
    let tonPubHex;
    try {
      tonPubHex = bytesToHex(tonEdPub.data());
      const anyAddr = core.AnyAddress.createWithPublicKey(tonEdPub, core.CoinType.ton);
      try {
        addresses.ton = tonHashToFriendlyAddress(anyAddr.data());
      } finally {
        anyAddr.delete();
      }
    } finally {
      tonEdPub.delete();
    }
    const wcBtc = wallet.getAddressForCoin(core.CoinType.bitcoin);
    const wcEth = wallet.getAddressForCoin(core.CoinType.ethereum);
    const wcTrx = wallet.getAddressForCoin(core.CoinType.tron);
    const wcTon = wallet.getAddressForCoin(core.CoinType.ton);
    assert(wcBtc === addresses.btc, 'BTC wallet-core address differs from module derivation');
    assert(wcEth.toLowerCase() === addresses.eth.toLowerCase(), 'ETH wallet-core address differs');
    assert(wcTrx === addresses.trx, 'TRX wallet-core address differs');
    // TON: compare the 32-byte address hashes (wallet-core may return EQ form).
    const wcTonHash = Buffer.from(wcTon, 'base64url').subarray(2, 34);
    assert(
      wcTonHash.equals(tonAddressToHash(addresses.ton, 'ton sender')),
      'TON wallet-core address hash differs',
    );
    printJson('sender addresses (public)', addresses);
    console.log(`change address (public): ${changeAddress}`);
    console.log('address cross-check: module derivation == wallet-core getAddressForCoin (all 4 chains)');

    // --- BTC ---------------------------------------------------------------
    printSection('BTC — P2WPKH, 1 input / 2 outputs, offline');
    const btcTxid = randomHex32();
    const btcScript = `0014${bytesToHex(hash160(privateKeyToPublicKey(keyBytes.btc, true)))}`;
    console.log(`inputs: 1 UTXO ${btcTxid}:0 = ${BTC_INPUT_SATS} sats (synthetic, offline-only)`);
    console.log(`destination: ${BTC_DEST} amount ${BTC_AMOUNT_SATS} sats; byteFee ${BTC_BYTE_FEE} sat/vB`);
    const btcUnsigned = buildBtcP2wpkhUnsignedTx({
      utxos: [{ txid: btcTxid, vout: 0, valueSats: BTC_INPUT_SATS, scriptPubKey: btcScript }],
      toAddress: BTC_DEST,
      amountSats: BTC_AMOUNT_SATS,
      feeSats: BTC_EXPECTED_FEE_SATS,
      maxFeeSats: '500',
      changeAddress,
    });
    const btcApproval = {
      network: 'bitcoin-mainnet',
      toAddress: BTC_DEST,
      amountSats: BTC_AMOUNT_SATS,
      maxFeeSats: '500',
      changeAddress,
      byteFee: BTC_BYTE_FEE,
      changePubkeyHex: changePubHex,
    };
    const btcSigned = await signBtc(btcUnsigned, btcApproval, keyBytes.btc, isolation);
    printJson('btc signed.feeSats', btcSigned.feeSats);
    printJson('btc signed.outputs', btcSigned.outputs);
    printJson('btc verification', btcSigned.verification);
    printJson('btc preflight', btcSigned.preflight);
    console.log(`btc signedTxHex: ${trunc(btcSigned.signedTxHex)}`);
    assert(btcSigned.feeSats === BTC_EXPECTED_FEE_SATS, 'BTC signed fee must be byteFee*vsize = 282');
    assert(btcSigned.outputs[0].valueSats === BTC_AMOUNT_SATS, 'BTC payment output amount');
    assert(btcSigned.outputs[0].address === BTC_DEST, 'BTC payment output address');
    assert(btcSigned.outputs[1].valueSats === BTC_EXPECTED_CHANGE_SATS, 'BTC change output amount');
    assert(btcSigned.outputs[1].address === changeAddress, 'BTC change output address');
    assert(
      BigInt(BTC_INPUT_SATS) - BigInt(btcSigned.outputs[0].valueSats) - BigInt(btcSigned.outputs[1].valueSats)
        === BigInt(btcSigned.feeSats),
      'BTC fee must equal inputs minus outputs',
    );
    const btcAgain = verifyBtc(btcSigned, btcUnsigned, btcApproval);
    assert(btcAgain.valid === true, 'BTC independent re-verification must pass');
    const btcParsed = parseBtcSignedTx(btcSigned.signedTxHex);
    assert(btcParsed.version === 1, 'BTC signed version is 1 (wallet-core deviation, documented)');
    assert(btcParsed.locktime === 0, 'BTC locktime 0');
    assert(btcParsed.witnesses.length === 1 && btcParsed.witnesses[0].length === 2, 'BTC 1 witness, 2 items');
    assert(BigInt(btcParsed.outputs[0].value) === 30000n, 'BTC decoded payment value');
    // Decode the output scripts: P2WPKH script = 0014 || 20-byte program.
    // The payment program must be the destination's, the change program the
    // change address's (both taken from the unsigned artifact).
    printJson('btc decoded', {
      version: btcParsed.version,
      locktime: btcParsed.locktime,
      outputs: btcParsed.outputs.map((o) => ({ value: o.value.toString(), script: bytesToHex(o.script) })),
      witnesses: btcParsed.witnesses.map((w) => w.length),
    });
    assert(bytesToHex(btcParsed.outputs[0].script).slice(4) === btcUnsigned.outputs[0].scriptPubKey.slice(4), 'BTC decoded payment script program matches destination');
    assert(bytesToHex(btcParsed.outputs[1].script).slice(4) === btcUnsigned.outputs[1].scriptPubKey.slice(4), 'BTC decoded change script program matches change address');
    assert(btcSigned.preflight.passed === true && btcSigned.preflight.checks.length === 11, 'BTC preflight 11/11');
    verdict('btc', 'PASS', 'signed offline (AnySigner), BIP-143 verifies, decoded dest/amount/fee/change match, preflight 11/11');

    // --- ETH ---------------------------------------------------------------
    printSection('ETH — EIP-1559 type 2, chain 1, offline');
    console.log(`destination: ${ETH_DEST} value ${ETH_VALUE_WEI} wei (0.0025 ETH); nonce ${ETH_NONCE}; gas 21000; maxFee 30 gwei; priority 2 gwei`);
    const ethUnsigned = buildEth1559UnsignedTx({
      chainId: 1,
      nonce: ETH_NONCE,
      to: ETH_DEST,
      valueWei: ETH_VALUE_WEI,
      gasLimit: ETH_GAS_LIMIT,
      maxPriorityFeePerGasWei: ETH_MAX_PRIORITY_GWEI,
      maxFeePerGasWei: ETH_MAX_FEE_GWEI,
      data: '0x',
    });
    const ethApproval = {
      network: 'ethereum-mainnet',
      chainId: 1,
      to: ETH_DEST,
      valueWei: ETH_VALUE_WEI,
      gasLimit: ETH_GAS_LIMIT,
      maxFeePerGasWei: ETH_MAX_FEE_GWEI,
      maxPriorityFeePerGasWei: ETH_MAX_PRIORITY_GWEI,
      maxFeeWei: ETH_MAX_FEE_WEI,
      nonce: ETH_NONCE,
      expectedSender: addresses.eth,
      data: '0x',
    };
    const ethSigned = await signEth(ethUnsigned, ethApproval, keyBytes.eth, isolation);
    printJson('eth verification', ethSigned.verification);
    printJson('eth preflight', ethSigned.preflight);
    console.log(`eth encoded: ${trunc(ethSigned.encoded)} (type 0x02, v=${ethSigned.v})`);
    assert(ethSigned.encoded.startsWith('0x02'), 'ETH signed tx must be type 2');
    // EIP-1559 v is the y-parity bit (0 or 1); the fixture happened to sign
    // to 0, a fresh key may sign to 1. The decoded yParity must equal v.
    assert(ethSigned.v === 0 || ethSigned.v === 1, 'ETH v must be a y-parity bit');
    assert(ethSigned.verification.valid === true, 'ETH verification valid');
    assert(ethSigned.verification.method === 'ecrecover', 'ETH verification method ecrecover');
    assert(ethSigned.verification.sender.toLowerCase() === addresses.eth.toLowerCase(), 'ETH ecrecover sender matches signer');
    const ethAgain = verifyEth(ethSigned, ethUnsigned, ethApproval);
    assert(ethAgain.valid === true, 'ETH independent re-verification must pass');
    assert(ethAgain.sender.toLowerCase() === addresses.eth.toLowerCase(), 'ETH re-verify sender matches');
    const ethParsed = parseEthSignedTx(ethSigned.encoded);
    assert(ethParsed.chainId === 1n, 'ETH decoded chainId 1');
    assert(ethParsed.nonce === 7n, 'ETH decoded nonce 7');
    assert(`0x${ethParsed.to.toString('hex')}`.toLowerCase() === ETH_DEST.toLowerCase(), 'ETH decoded to matches destination');
    assert(ethParsed.amount === 2500000000000000n, 'ETH decoded amount 0.0025 ETH');
    assert(ethParsed.gasLimit === 21000n, 'ETH decoded gasLimit 21000');
    assert(ethParsed.maxFeePerGas === 30000000000n, 'ETH decoded maxFeePerGas 30 gwei');
    assert(ethParsed.maxPriorityFeePerGas === 2000000000n, 'ETH decoded maxPriorityFeePerGas 2 gwei');
    assert(ethParsed.yParity === BigInt(ethSigned.v), 'ETH decoded yParity equals signed v');
    printJson('eth decoded', {
      chainId: ethParsed.chainId.toString(),
      nonce: ethParsed.nonce.toString(),
      to: `0x${ethParsed.to.toString('hex')}`,
      amountWei: ethParsed.amount.toString(),
      gasLimit: ethParsed.gasLimit.toString(),
      maxFeePerGasWei: ethParsed.maxFeePerGas.toString(),
      maxPriorityFeePerGasWei: ethParsed.maxPriorityFeePerGas.toString(),
      yParity: ethParsed.yParity.toString(),
    });
    assert(ethSigned.preflight.passed === true && ethSigned.preflight.checks.length === 11, 'ETH preflight 11/11');
    verdict('eth', 'PASS', 'signed offline (AnySigner), ecrecover sender matches signer, decoded chain/to/amount/fees match, preflight 11/11');

    // --- TRX ---------------------------------------------------------------
    printSection('TRX — native TransferContract, offline');
    const trxRefBlockId = randomHex32();
    console.log(`owner: ${addresses.trx} -> destination: ${TRX_DEST} amount ${TRX_AMOUNT_SUN} sun (2.5 TRX); fee_limit 0 (bandwidth-covered)`);
    console.log(`refBlockId: ${trxRefBlockId}; timestamp ${TRX_TIMESTAMP_MS}; expiration ${TRX_EXPIRATION_MS}`);
    const trxUnsigned = buildTronMainnetUnsignedTransfer({
      ownerAddress: addresses.trx,
      toAddress: TRX_DEST,
      amountSun: TRX_AMOUNT_SUN,
      refBlockId: trxRefBlockId,
      timestampMs: TRX_TIMESTAMP_MS,
      expirationMs: TRX_EXPIRATION_MS,
      feeLimitSun: '0',
    });
    const trxApproval = {
      network: 'tron-mainnet',
      ownerAddress: addresses.trx,
      toAddress: TRX_DEST,
      amountSun: TRX_AMOUNT_SUN,
      maxFeeSun: '0',
      refBlockId: trxRefBlockId,
      timestampMs: TRX_TIMESTAMP_MS,
      expirationMs: TRX_EXPIRATION_MS,
    };
    const trxSigned = await signTron(trxUnsigned, trxApproval, keyBytes.trx, isolation);
    printJson('trx verification', trxSigned.verification);
    printJson('trx preflight', trxSigned.preflight);
    console.log(`trx txID: ${trxSigned.txID}`);
    console.log(`trx signature: ${trunc(trxSigned.signature)} (${trxSigned.signature.length} hex chars)`);
    assert(trxSigned.signature.length === 130, 'TRX signature must be 65 bytes (130 hex chars)');
    assert(trxSigned.verification.valid === true, 'TRX verification valid');
    assert(trxSigned.verification.method === 'secp256k1-recovery', 'TRX verification method secp256k1-recovery');
    assert(trxSigned.verification.ownerAddress === addresses.trx, 'TRX recovered owner matches signer');
    assert(trxSigned.verification.toAddress === TRX_DEST, 'TRX verified destination matches');
    assert(trxSigned.verification.refBlockBytes === trxRefBlockId.slice(12, 16), 'TRX ref_block_bytes match refBlockId bytes 6-8');
    const trxAgain = verifyTron(trxSigned, trxUnsigned, trxApproval);
    assert(trxAgain.valid === true, 'TRX independent re-verification must pass');
    assert(trxAgain.txID === trxSigned.txID, 'TRX re-verified txID matches signed txID');
    // Independent decode of the signed outer Transaction protobuf.
    const trxRaw = protoFieldBytes(hexToBytes(trxSigned.signedTransactionHex, 'trx signed'), 1);
    const trxSig = protoFieldBytes(hexToBytes(trxSigned.signedTransactionHex, 'trx signed'), 2);
    assert(trxSig.length === 65, 'TRX decoded outer signature is 65 bytes');
    assert(sha256Hex(trxRaw) === trxSigned.txID, 'TRX txID equals SHA-256 of signed raw_data');
    const trxDecoded = parseTronRawData(bytesToHex(trxRaw));
    printJson('trx decoded raw_data', {
      txID: sha256Hex(trxRaw),
      timestamp: trxDecoded.timestamp.toString(),
      expiration: trxDecoded.expiration.toString(),
      refBlockBytes: bytesToHex(trxDecoded.refBlockBytes),
      refBlockHash: bytesToHex(trxDecoded.refBlockHash),
      amountSun: trxDecoded.contract.amount.toString(),
    });
    // Owner/to as base58: re-derive from the parsed 21-byte addresses.
    assert(base58CheckEncode(Buffer.from(trxDecoded.contract.owner)) === addresses.trx, 'TRX decoded owner address matches signer');
    assert(base58CheckEncode(Buffer.from(trxDecoded.contract.to)) === TRX_DEST, 'TRX decoded destination matches');
    assert(trxDecoded.contract.amount === 2500000n, 'TRX decoded amount 2,500,000 sun');
    assert(trxDecoded.timestamp === 1763506000000n, 'TRX decoded timestamp matches');
    assert(trxDecoded.expiration === 1763509600000n, 'TRX decoded expiration matches');
    assert(trxSigned.preflight.passed === true && trxSigned.preflight.checks.length === 11, 'TRX preflight 11/11');
    console.log(`trx note: signed ref_block_hash differs from the T33 fixture value (documented deviation: signer derives it as SHA-256(BlockHeader) bytes 8-15); ref_block_bytes, contract, timestamp, expiration match exactly.`);
    verdict('trx', 'PASS', 'signed offline (AnySigner), secp256k1 recovery matches owner, decoded owner/to/amount/timestamps match, txID recomputes, preflight 11/11');

    // --- TON ---------------------------------------------------------------
    printSection('TON — Wallet V4 R2 transfer, offline');
    console.log(`sender: ${addresses.ton} -> destination: ${TON_DEST} amount ${TON_AMOUNT_NANO} nano (0.12 TON); seqno ${TON_SEQNO}; validUntil ${TON_VALID_UNTIL}; mode ${TON_MODE}`);
    const tonUnsigned = buildTonV4R2UnsignedTransfer({
      sender: addresses.ton,
      destination: TON_DEST,
      amountNano: TON_AMOUNT_NANO,
      seqno: TON_SEQNO,
      validUntil: TON_VALID_UNTIL,
    });
    const tonApproval = {
      network: 'ton-mainnet',
      sender: addresses.ton,
      destination: TON_DEST,
      amountNano: TON_AMOUNT_NANO,
      seqno: TON_SEQNO,
      validUntil: TON_VALID_UNTIL,
      mode: TON_MODE,
      publicKeyHex: tonPubHex,
    };
    const tonSigned = await signTon(tonUnsigned, tonApproval, keyBytes.ton, isolation);
    printJson('ton verification', tonSigned.verification);
    printJson('ton preflight', tonSigned.preflight);
    console.log(`ton signedBocBase64: ${trunc(tonSigned.signedBocBase64)} (starts te6)`);
    assert(tonSigned.signedBocBase64.startsWith('te6'), 'TON signed BOC must start with te6');
    assert(tonSigned.verification.valid === true, 'TON verification valid');
    assert(tonSigned.verification.method === 'ed25519', 'TON verification method ed25519');
    assert(tonSigned.verification.sender === addresses.ton, 'TON verified sender matches signer');
    assert(
      tonSigned.verification.normalizedSigningHash === Buffer.from(tonUnsigned.signingHashBase64, 'base64').toString('hex'),
      'TON normalised signing hash equals the unsigned signing hash',
    );
    const tonAgain = verifyTon(tonSigned, tonUnsigned, tonApproval);
    assert(tonAgain.valid === true, 'TON independent re-verification must pass');
    const tonParsed = parseTonBoc(tonSigned.signedBocBase64);
    printJson('ton decoded BOC', { cells: tonParsed.cells.length, rootIndex: tonParsed.rootIndex });
    assert(tonParsed.cells.length >= 2, 'TON signed BOC has at least the signing + internal cells');
    assert(tonSigned.preflight.passed === true && tonSigned.preflight.checks.length === 11, 'TON preflight 11/11');
    console.log('ton note: signer attaches an empty body cell (hasBody 1) where the unsigned artifact stores none (hasBody 0) — documented deviation; Ed25519 verifies against the signer hash and the normalised hash equals the unsigned signing hash exactly.');
    verdict('ton', 'PASS', 'signed offline (AnySigner), Ed25519 verifies, sender/destination/amount/seqno/validUntil checked by verifyTon, normalised signing hash matches, preflight 11/11');
  } finally {
    for (const k of Object.keys(keyBytes)) keyBytes[k].fill(0);
    wallet.delete();
    // The mnemonic string cannot be zeroed (JS strings are immutable); it
    // lived only in this process's memory and dies with the process exit.
  }

  printSection('SUMMARY');
  printJson('verdicts', results);
  const allPass = Object.values(results).every((r) => r.status === 'PASS');
  console.log(allPass ? 'LANE E: ALL FOUR CHAINS PASS — offline signing + verification confirmed.' : 'LANE E: NOT ALL CHAINS PASS — see verdicts above.');
  if (!allPass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`LANE E FAILED: ${error.message}`);
  process.exitCode = 1;
});
