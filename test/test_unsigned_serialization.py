#!/usr/bin/env python3
"""Unsigned transaction field/serialization validation (T34, Bawa W3 mainnet).

Validates unsigned fields and serialization across BTC, ETH, TRON and TON
using independent decoders, round-trips and negative cases.

Run: ``python3 test/test_unsigned_serialization.py`` — no pytest, no network,
no third-party dependencies (stdlib only), matching test/test_make_wallet.py.

What this proves (and what it does NOT prove):
- Each chain's UNSIGNED payload is built from the documented field layout,
  serializes deterministically, decodes back to the same fields with an
  INDEPENDENT decoder, and matches a REAL mainnet transaction fetched
  read-only from a public endpoint.
- Malformed inputs are rejected, not silently accepted.
- It does NOT prove execution, broadcast, or end-to-end payment. No
  transaction is broadcast, no funds move, no private key or seed phrase is
  involved anywhere in this file.

Fixtures (public mainnet data, fetched read-only 2026-11-12):
- BTC tx c364c2196aef7339de5c06af2e94daeea5816943f7d860e9577a4c0d4bb4cefe,
  confirmed block 975530 (Blockstream). Raw hex 222 bytes, segwit, 1 input,
  2 outputs, locktime 975529.
- ETH type-2 tx 0x3c13945e6f90d5d5b296416f8bd3c2d13a10cbf4408d6146ee0a4beb28f02433,
  block 0x192cb65 (ethereum.publicnode.com eth_chainId 0x1; raw signed RLP
  from Blockchair). chainId 1, nonce 0x3232f, gas 0x711fa,
  maxFeePerGas 0x58c1fdc, maxPriorityFeePerGas 0x0, value 0.
- TRON TransferContract tx 5e7cdcba1fb4c4d75215bbc04f7858d346cef764f3fed278912c855ea9a386e9,
  block 87932263, ret SUCCESS (api.trongrid.io). raw_data 131 bytes:
  ref_block_bytes bd53, ref_block_hash cd624180a88de7eb,
  expiration 1794470682000, timestamp 1794470625178, owner
  41d4e59bdc348c1e6f678066427b2ce7394b15d759, to
  414dc16f5f52e60c4739b3f39a128e27c8f9ba41a3, amount 7 SUN.
- TON transaction for the guide's own fixture address
  EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi (published Trust Wallet
  Core test vector, docs/02-chains section 6): toncenter getTransactions
  returned one real mainnet transaction, utime 1701461634, fee 14511410
  nanotons, data = full transaction BOC, 1377 bytes. The BOC root cell is
  decoded bit-for-bit against block.tlb (transaction$0111).
- TON V4R2 layout (docs.ton.org Wallet V4 + ton-blockchain/wallet-contract
  func/wallet-v4-code.fc): external-message body = signature bits512 +
  wallet_id uint32 + valid_until uint32 + msg_seqno uint32 + opcode uint32.
  Default V4 wallet_id 698983191 (0x29A9A317, TEP-3 section 6).
"""
import base64
import hashlib
import struct
import unittest

SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


class TxError(ValueError):
    """Raised by every decoder/constructor in this module on malformed input."""


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

BTC_TX_HEX = (
    "0200000000010110586862070bec05a820be5c5c8a844f177cb836eadef932bd1810f2c396c6a4"
    "0100000000fdffffff02fa360000000000001600148927018e5a29cc5131a6025f600aae1fc5a"
    "5661ddabb010000000000160014691019ce2577183880f8f1b097300526560aa9630247304402"
    "204d76939dc2b8669fcd9253727bbbac72a1f1b6419cd7d368f92dd0c8939f409e0220314578bc2a"
    "f2b7d8d27f47adb4e13620d7796999a34dd5da23b3248905c85f7101210292a29c30c06ffac5aeda"
    "bcd5ae235ddabd3d37c9acacedeb3d297d53e32a7f30a9e20e00"
)
BTC_TXID = "c364c2196aef7339de5c06af2e94daeea5816943f7d860e9577a4c0d4bb4cefe"
BTC_BLOCK_HEIGHT = 975530

ETH_RAW_HEX = (
    "02f90370018303232f8084058c1fdc830711fa940000000aa232009084bd71a5797d089aa4ed"
    "fad480b9030409c5eabe00000000000000000000000000000000000000000000000000000000"
    "0000002000000000000000000000000000000000000000000000000000000000000002bd0000"
    "cca0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000"
    "00000000000000000000001ff701c600000000000000000000000000000000c02aaa39b223fe"
    "8d0a0e5c4f27ead9083c756cc200000000000000000000000002c5f8f6000000000000000000"
    "000184c3ae22fe000000000000000006ef77eded766f05dac17f958d2ee523a2206206994597"
    "c13d831ec7000000000000000000000000000000000000000000000000000000001d24195b00"
    "00000000000000000000000000000000004c0000000100000000000000000000000000000000"
    "0000005dee75f4b58e5316a10f902ecae5a60001000200010000000000000000000000000000"
    "000000000000000000001c7bd4b4d07025c4000066020000000000000000000003a13628dc23"
    "3bc900000000000000000000000000000eb9000000000000000007c949d443318c0103000100"
    "00000000000000034e40404da5103e000000000000000000000184c3ae22fe00000000000000"
    "00071844e02ef08fb60001300c000000000000000003a13628dc233bc9000000000000000000"
    "0000001ff6f30d000000000000000000000000000f51f1000000000000000000000000000000"
    "00000073d53553ee552c1f2a9722e6407d43e41e19593f1cb6d5f6f1e834416833bddd402467"
    "0d37d89724375b790e9bde6967c7ccae37b25adb7f11656931e9ec2523e2e5ebfa8f73732a6a"
    "a5c4d52bdab3e3d72e39375a0e0000000000000000034e41c51153333c000000000000000000"
    "0000001d24195b00000000000000000001bb970f9891f600000000000000000000000002c5f8"
    "f6000173d53553ee552c1f2a9722e6407d43e41e19593f1badbcc44945bed18969544020ad1d"
    "bfef56249db70aba1afb7ce1418449bbf41239bd4edeef5b95c43259a5fd5ef760ac5f7a263d"
    "518d2d9bdc40ff1948d5c67c000000000000c080a062d74ada47c0ef5706f4183113faf6fdbd"
    "3b941c699532a7e7b5fb087c077d77a06359fb825a533bba8436e368923798b5cd565472f7bc"
    "d80de9a909c73337ad28"
)
ETH_TX_HASH = "0x3c13945e6f90d5d5b296416f8bd3c2d13a10cbf4408d6146ee0a4beb28f02433"
ETH_UNSIGNED_SIGNING_HASH = "87b691f930620e3e57d19aeb37edfcf65db0d1dafa0a0d08756a82359768fd23"

TRON_RAW_DATA_HEX = (
    "0a02bd532208cd624180a88de7eb4090bba6f69c345a65080112610a2d747970652e676f6f676c65"
    "617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412300a1541d4e5"
    "9bdc348c1e6f678066427b2ce7394b15d7591215414dc16f5f52e60c4739b3f39a128e27c8f9ba41a3"
    "1807709affa2f69c34"
)
TRON_TXID = "5e7cdcba1fb4c4d75215bbc04f7858d346cef764f3fed278912c855ea9a386e9"
TRON_SIGNATURE_HEX = "5529541620b1eff8e726d5dc32504edae467cadf909058b5defa75c77aadd3e242e051cd302824a863fbd99ab71595670523220aa45fddc449eb84f6f4b9293800"  # 65-byte secp256k1 signature (not hashed into txID)
TRON_BLOCK_NUMBER = 87932263

TON_BOC_B64 = (
    "te6cckECIgEABVEAA7V7uBm8ZV0LFmE8BrNmPjdtqAFxJh82/BBmiZ6N6YznAPAAAnESPyKMEfmF"
    "7JbRQhiDV93zJkAS0i2CHMQD/VAWtdzjHhlPIkXQAAJtLWGcJDZWo+ggACR6R5LoAQIDAgHgBAUA"
    "gnJsCo8cnovDFEOlboTLPZ8JqsCrX8+2hJpicaun8LHDvHAcgA3SMPTketTTB0C678PUNoGJY2yu"
    "ePtwni7KoKXuAhEMiDaGGZPPBEAgIQJFiAF3AzeMq6FizCeA1mzHxu21AC4kw+bfggzRM9G9MZzg"
    "Hh4GBwEB3x4CATQICQGcJjMYSSyYAh+oZCV0MdFt86LQbOklwo0snmjJ2v7DNzDLmsOqpxF9NP3J"
    "3RfzzGdd3DKNMpRr6oN/+icOduvkDimpoxf/////AAAAAACCHQEU/wD0pBP0vPLICwoAUQAAAAAp"
    "qaMXyK6wCorbWHmljQMa8B1gMft0PhlxpnnG7OoTVPAi0MlAAgEgCwwCAUgNDgT48oMI1xgg0x/T"
    "H9MfAvgju/Jk7UTQ0x/TH9P/9ATRUUO68qFRUbryogX5AVQQZPkQ8qP4ACSkyMsfUkDLH1Iwy/9S"
    "EPQAye1U+A8B0wchwACfbFGTINdKltMH1AL7AOgw4CHAAeMAIcAC4wABwAORMOMNA6TIyx8Syx/L"
    "/xkaGxwC5tAB0NMDIXGwkl8E4CLXScEgkl8E4ALTHyGCEHBsdWe9IoIQZHN0cr2wkl8F4AP6QDAg"
    "+kQByMoHy//J0O1E0IEBQNch9AQwXIEBCPQKb6Exs5JfB+AF0z/IJYIQcGx1Z7qSODDjDQOCEGRz"
    "dHK6kl8G4w0PEAIBIBESAHgB+gD0BDD4J28iMFAKoSG+8uBQghBwbHVngx6xcIAYUATLBSbPFlj6"
    "Ahn0AMtpF8sfUmDLPyDJgED7AAYAilAEgQEI9Fkw7UTQgQFA1yDIAc8W9ADJ7VQBcrCOI4IQZHN0"
    "coMesXCAGFAFywVQA88WI/oCE8tqyx/LP8mAQPsAkl8D4gIBIBMUAFm9JCtvaiaECAoGuQ+gIYRw"
    "1AgIR6STfSmRDOaQPp/5g3gSgBt4EBSJhxWfMYQCAVgVFgARuMl+1E0NcLH4AD2ynftRNCBAUDXI"
    "fQEMALIygfL/8nQAYEBCPQKb6ExgAgEgFxgAGa3OdqJoQCBrkOuF/8AAGa8d9qJoQBBrkOuFj8AA"
    "btIH+gDU1CL5AAXIygcVy//J0Hd0gBjIywXLAiLPFlAF+gIUy2sSzMzJc/sAyEAUgQEI9FHypwIA"
    "cIEBCNcY+gDTP8hUIEeBAQj0UfKnghBub3RlcHSAGMjLBcsCUAbPFlAE+gIUy2oSyx/LP8lz+wAC"
    "AGyBAQjXGPoA0z8wUiSBAQj0WfKnghBkc3RycHSAGMjLBcsCUAXPFlAD+gITy2rLHxLLP8lz+wAA"
    "CvQAye1UAWBCAARRwzgIGFCFcRJySDM1NcBWhUuJemvEwDLzsFcCgdanAAAAAAAAAAAAAAAAAAEf"
    "AbFIAXcDN4yroWLMJ4DWbMfG7bUALiTD5t+CDNEz0b0xnOAfAAIo4ZwEDChCuIk5JBmamuArQqXE"
    "vTXiYBl52CuBQOtTkOr1czgGFmE2AABOIkfkUYTK1H0EwB8AAACdQZ2DE4gAAAAAAAAAABEAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAIABvyYhkcEwWYRQAAAAAAAIAAAAAAAMJbWBXd5LrjXE+5zMLpU+0yjJ46IjFhX6kLQJ8tQdv"
    "iECQFgwUALwp"
)
TON_UTIME = 1701461634
TON_ACCOUNT_HASH = "bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f"
TON_FRIENDLY_NON_BOUNCEABLE = "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn"
TON_FRIENDLY_BOUNCEABLE = "EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi"
TON_FRIENDLY_BOUNCEABLE_TESTNET = "kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo"
TON_FRIENDLY_NON_BOUNCEABLE_TESTNET = "0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt"
TON_WALLET_ID = 698983191  # 0x29A9A317, TEP-3 section 6, V3R1-V4R2 mainnet


def sha256d(data):
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


# --------------------------------------------------------------------------
# Keccak-256 (pure python; Keccak padding 0x01, NOT FIPS-202 SHA3 padding)
# --------------------------------------------------------------------------

_KECCAK_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
    0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
    0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
    0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
    0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
    0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
    0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
_KECCAK_R = [
    [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]
_MASK64 = (1 << 64) - 1


def _rol64(x, n):
    return ((x << n) | (x >> (64 - n))) & _MASK64 if n else x


def _keccak_f(state):
    for rc in _KECCAK_RC:
        c = [state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
             for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol64(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] ^= d[x]
        b = [0] * 25
        for x in range(5):
            for y in range(5):
                b[y + 5 * ((2 * x + 3 * y) % 5)] = _rol64(state[x + 5 * y], _KECCAK_R[x][y])
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = b[x + 5 * y] ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y])
        state[0] ^= rc
    return state


def keccak256(data):
    """Keccak-256 (original Keccak, rate 1088). hashlib.sha3_256 is NOT this."""
    rate = 136
    state = [0] * 25
    data = bytearray(data)
    data.append(0x01)
    while len(data) % rate:
        data.append(0x00)
    data[-1] |= 0x80
    for off in range(0, len(data), rate):
        block = data[off:off + rate]
        for i in range(len(block) // 8):
            state[i] ^= struct.unpack_from("<Q", block, i * 8)[0]
        _keccak_f(state)
    return b"".join(struct.pack("<Q", state[i]) for i in range(4))


# --------------------------------------------------------------------------
# CRC32C (Castagnoli) and CRC16-XMODEM
# --------------------------------------------------------------------------

def _crc32c_table():
    table = []
    for i in range(256):
        crc = i
        for _ in range(8):
            crc = (crc >> 1) ^ 0x82F63B78 if crc & 1 else crc >> 1
        table.append(crc)
    return table


_CRC32C_TABLE = _crc32c_table()


def crc32c(data):
    crc = 0xFFFFFFFF
    for byte in data:
        crc = _CRC32C_TABLE[(crc ^ byte) & 0xFF] ^ (crc >> 8)
    return crc ^ 0xFFFFFFFF


def crc16_xmodem(data):
    """CRC-16/XMODEM: poly 0x1021, init 0x0000, no reflection, no xorout."""
    crc = 0
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


# --------------------------------------------------------------------------
# Base58Check
# --------------------------------------------------------------------------

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58check_encode(payload):
    n = int.from_bytes(payload + sha256d(payload)[:4], "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = _B58_ALPHABET[r] + out
    pad = len(payload) - len(payload.lstrip(b"\x00"))
    return "1" * pad + out


def b58check_decode(text):
    if not text or any(ch not in _B58_ALPHABET for ch in text):
        raise TxError("not base58: %r" % text)
    n = 0
    for ch in text:
        n = n * 58 + _B58_ALPHABET.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    pad = len(text) - len(text.lstrip("1"))
    raw = b"\x00" * pad + raw
    if len(raw) < 5:
        raise TxError("base58check input too short")
    payload, check = raw[:-4], raw[-4:]
    if sha256d(payload)[:4] != check:
        raise TxError("base58check checksum mismatch")
    return payload


# --------------------------------------------------------------------------
# Bech32 (BIP-173) — only the encoder is needed; the decoder is the
# independent cross-check (Blockstream reports the same addresses).
# --------------------------------------------------------------------------

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _bech32_polymod(values):
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for i, gen in enumerate((0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)):
            if (top >> i) & 1:
                chk ^= gen
    return chk


def _bech32_hrp_expand(hrp):
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def _convertbits(data, frombits, tobits, pad=True):
    acc = 0
    bits = 0
    out = []
    maxv = (1 << tobits) - 1
    for value in data:
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            out.append((acc >> bits) & maxv)
    if pad:
        if bits:
            out.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        raise TxError("bech32 convertbits: non-zero padding")
    return out


def bech32_encode(hrp, witver, program):
    if not 0 <= witver <= 16:
        raise TxError("bech32 witness version out of range: %d" % witver)
    if witver == 0 and len(program) not in (20, 32):
        raise TxError("bech32 v0 program must be 20 or 32 bytes")
    data = [witver] + _convertbits(program, 8, 5)
    values = _bech32_hrp_expand(hrp) + data
    polymod = _bech32_polymod(values + [0, 0, 0, 0, 0, 0]) ^ 1
    checksum = [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(_BECH32_CHARSET[d] for d in data + checksum)

# --------------------------------------------------------------------------
# Bitcoin: strict varint, segwit-aware transaction parse, txid, unsigned build
# --------------------------------------------------------------------------

def read_varint(buf, off):
    """Strict Bitcoin varint: canonical minimal encoding only."""
    if off >= len(buf):
        raise TxError("varint: truncated")
    first = buf[off]
    if first < 0xFD:
        return first, off + 1
    if first == 0xFD:
        if off + 3 > len(buf):
            raise TxError("varint 0xfd: truncated")
        value = struct.unpack_from("<H", buf, off + 1)[0]
        if value < 0xFD:
            raise TxError("varint 0xfd: non-canonical (value %d)" % value)
        return value, off + 3
    if first == 0xFE:
        if off + 5 > len(buf):
            raise TxError("varint 0xfe: truncated")
        value = struct.unpack_from("<I", buf, off + 1)[0]
        if value < 0x10000:
            raise TxError("varint 0xfe: non-canonical (value %d)" % value)
        return value, off + 5
    if off + 9 > len(buf):
        raise TxError("varint 0xff: truncated")
    value = struct.unpack_from("<Q", buf, off + 1)[0]
    if value < 0x100000000:
        raise TxError("varint 0xff: non-canonical (value %d)" % value)
    return value, off + 9


def write_varint(value):
    if value < 0xFD:
        return bytes([value])
    if value <= 0xFFFF:
        return b"\xfd" + struct.pack("<H", value)
    if value <= 0xFFFFFFFF:
        return b"\xfe" + struct.pack("<I", value)
    return b"\xff" + struct.pack("<Q", value)


def parse_btc_tx(raw):
    """Parse a (possibly segwit) Bitcoin transaction. Returns a dict; the
    witness is returned separately and is NOT part of the txid pre-image."""
    if len(raw) < 10:
        raise TxError("btc tx too short: %d bytes" % len(raw))
    version, = struct.unpack_from("<I", raw, 0)
    if version < 1 or version > 2:
        raise TxError("btc version out of range: %d" % version)
    off = 4
    segwit = False
    if raw[off] == 0:
        if raw[off + 1] != 1:
            raise TxError("btc witness flag without marker, or bad flag: %02x %02x"
                          % (raw[off], raw[off + 1]))
        segwit = True
        off += 2
    n_in, off = read_varint(raw, off)
    if n_in == 0:
        raise TxError("btc tx has zero inputs")
    inputs = []
    for _ in range(n_in):
        if off + 36 > len(raw):
            raise TxError("btc input header truncated")
        prev = raw[off:off + 32][::-1].hex()
        vout, = struct.unpack_from("<I", raw, off + 32)
        off += 36
        slen, off = read_varint(raw, off)
        if off + slen + 4 > len(raw):
            raise TxError("btc scriptSig truncated")
        script = raw[off:off + slen]
        off += slen
        seq, = struct.unpack_from("<I", raw, off)
        off += 4
        inputs.append({"prev_txid": prev, "vout": vout,
                       "script_sig": script.hex(), "sequence": seq})
    n_out, off = read_varint(raw, off)
    if n_out == 0:
        raise TxError("btc tx has zero outputs")
    outputs = []
    for _ in range(n_out):
        if off + 8 > len(raw):
            raise TxError("btc output value truncated")
        value, = struct.unpack_from("<Q", raw, off)
        off += 8
        slen, off = read_varint(raw, off)
        if off + slen > len(raw):
            raise TxError("btc scriptPubKey truncated")
        script = raw[off:off + slen]
        off += slen
        outputs.append({"value": value, "script_pubkey": script.hex()})
    witness = []
    if segwit:
        for _ in range(n_in):
            n_items, off = read_varint(raw, off)
            items = []
            for _ in range(n_items):
                item_len, off = read_varint(raw, off)
                if off + item_len > len(raw):
                    raise TxError("btc witness item truncated")
                items.append(raw[off:off + item_len].hex())
                off += item_len
            witness.append(items)
    if off + 4 > len(raw):
        raise TxError("btc locktime truncated")
    locktime, = struct.unpack_from("<I", raw, off)
    off += 4
    if off != len(raw):
        raise TxError("btc trailing bytes: %d of %d consumed" % (off, len(raw)))
    return {"version": version, "segwit": segwit, "inputs": inputs,
            "outputs": outputs, "witness": witness, "locktime": locktime}


def btc_serialize_unsigned(parsed):
    """Serialize WITHOUT marker/flag/witness and WITHOUT scriptSig content:
    the unsigned form. Inputs carry an empty scriptSig."""
    out = struct.pack("<I", parsed["version"])
    out += write_varint(len(parsed["inputs"]))
    for txin in parsed["inputs"]:
        out += bytes.fromhex(txin["prev_txid"])[::-1]
        out += struct.pack("<I", txin["vout"])
        out += b"\x00"  # empty scriptSig
        out += struct.pack("<I", txin["sequence"])
    out += write_varint(len(parsed["outputs"]))
    for txout in parsed["outputs"]:
        script = bytes.fromhex(txout["script_pubkey"])
        out += struct.pack("<Q", txout["value"])
        out += write_varint(len(script)) + script
    out += struct.pack("<I", parsed["locktime"])
    return out


def btc_txid(parsed):
    """txid = double-SHA256 of the NON-witness serialization, byte-reversed."""
    return sha256d(btc_serialize_unsigned(parsed))[::-1].hex()


def btc_serialize_signed(parsed):
    """Rebuild the exact signed serialization (with witness) from a parse."""
    out = struct.pack("<I", parsed["version"])
    if parsed["segwit"]:
        out += b"\x00\x01"
    out += write_varint(len(parsed["inputs"]))
    for txin in parsed["inputs"]:
        script = bytes.fromhex(txin["script_sig"])
        out += bytes.fromhex(txin["prev_txid"])[::-1]
        out += struct.pack("<I", txin["vout"])
        out += write_varint(len(script)) + script
        out += struct.pack("<I", txin["sequence"])
    out += write_varint(len(parsed["outputs"]))
    for txout in parsed["outputs"]:
        script = bytes.fromhex(txout["script_pubkey"])
        out += struct.pack("<Q", txout["value"])
        out += write_varint(len(script)) + script
    if parsed["segwit"]:
        for items in parsed["witness"]:
            out += write_varint(len(items))
            for item in items:
                raw = bytes.fromhex(item)
                out += write_varint(len(raw)) + raw
    out += struct.pack("<I", parsed["locktime"])
    return out


# --------------------------------------------------------------------------
# Ethereum: strict RLP, EIP-1559 unsigned payload, EIP-55 checksum
# --------------------------------------------------------------------------

def rlp_decode(buf, off=0):
    """Strict RLP decode. Returns (value, next_offset); value is bytes or a
    list. Rejects non-canonical length forms and leading-zero integers are
    rejected by rlp_decode_int, not here."""
    if off >= len(buf):
        raise TxError("rlp: truncated")
    first = buf[off]
    if first < 0x80:
        return bytes([first]), off + 1
    if first < 0xB8:
        ln = first - 0x80
        if off + 1 + ln > len(buf):
            raise TxError("rlp string: truncated")
        if ln == 1 and buf[off + 1] < 0x80:
            raise TxError("rlp string: single byte < 0x80 must be inline")
        return bytes(buf[off + 1:off + 1 + ln]), off + 1 + ln
    if first < 0xC0:
        llen = first - 0xB7
        if off + 1 + llen > len(buf):
            raise TxError("rlp string length: truncated")
        ln = int.from_bytes(buf[off + 1:off + 1 + llen], "big")
        if ln < 56:
            raise TxError("rlp string: long form used for short string")
        if buf[off + 1] == 0:
            raise TxError("rlp string: leading zero in length")
        if off + 1 + llen + ln > len(buf):
            raise TxError("rlp string: truncated")
        return bytes(buf[off + 1 + llen:off + 1 + llen + ln]), off + 1 + llen + ln
    if first < 0xF8:
        ln = first - 0xC0
        end = off + 1 + ln
        if end > len(buf):
            raise TxError("rlp list: truncated")
        items = []
        pos = off + 1
        while pos < end:
            item, pos = rlp_decode(buf, pos)
            items.append(item)
        if pos != end:
            raise TxError("rlp list: child overruns list end")
        return items, end
    llen = first - 0xF7
    if off + 1 + llen > len(buf):
        raise TxError("rlp list length: truncated")
    ln = int.from_bytes(buf[off + 1:off + 1 + llen], "big")
    if ln < 56:
        raise TxError("rlp list: long form used for short list")
    if buf[off + 1] == 0:
        raise TxError("rlp list: leading zero in length")
    end = off + 1 + llen + ln
    if end > len(buf):
        raise TxError("rlp list: truncated")
    items = []
    pos = off + 1 + llen
    while pos < end:
        item, pos = rlp_decode(buf, pos)
        items.append(item)
    if pos != end:
        raise TxError("rlp list: child overruns list end")
    return items, end


def rlp_encode(item):
    if isinstance(item, bytes):
        if len(item) == 1 and item[0] < 0x80:
            return item
        if len(item) < 56:
            return bytes([0x80 + len(item)]) + item
        lb = len(item).to_bytes((len(item).bit_length() + 7) // 8, "big")
        return bytes([0xB7 + len(lb)]) + lb + item
    payload = b"".join(rlp_encode(x) for x in item)
    if len(payload) < 56:
        return bytes([0xC0 + len(payload)]) + payload
    lb = len(payload).to_bytes((len(payload).bit_length() + 7) // 8, "big")
    return bytes([0xF7 + len(lb)]) + lb + payload


def rlp_encode_int(n):
    if n < 0:
        raise TxError("rlp int: negative")
    return b"" if n == 0 else n.to_bytes((n.bit_length() + 7) // 8, "big")


def rlp_decode_int(data):
    if len(data) > 1 and data[0] == 0:
        raise TxError("rlp int: leading zero byte")
    return int.from_bytes(data, "big") if data else 0


ETH_UNSIGNED_FIELDS = ["chainId", "nonce", "maxPriorityFeePerGas", "maxFeePerGas",
                       "gasLimit", "to", "value", "input", "accessList"]


def parse_eth_type2_signed(raw):
    """Parse a signed EIP-1559 (type 0x02) transaction. Returns the 12 fields
    as decoded values."""
    if len(raw) < 2 or raw[0] != 0x02:
        raise TxError("eth: not a type-0x02 transaction (first byte %s)"
                      % (raw[:1].hex() if raw else "empty"))
    fields, end = rlp_decode(raw, 1)
    if end != len(raw):
        raise TxError("eth: trailing bytes after RLP list")
    if not isinstance(fields, list) or len(fields) != 12:
        raise TxError("eth type-2: expected 12 RLP fields, got %s"
                      % (len(fields) if isinstance(fields, list) else type(fields)))
    names = ETH_UNSIGNED_FIELDS + ["v", "r", "s"]
    out = {}
    for name, item in zip(names, fields):
        if name == "accessList":
            if not isinstance(item, list):
                raise TxError("eth: accessList is not a list")
            for entry in item:
                if not isinstance(entry, list) or len(entry) != 2:
                    raise TxError("eth: access-list entry must be [address, storageKeys]")
                if len(entry[0]) != 20:
                    raise TxError("eth: access-list address must be 20 bytes")
                if not isinstance(entry[1], list):
                    raise TxError("eth: access-list storageKeys must be a list")
                for key in entry[1]:
                    if len(key) != 32:
                        raise TxError("eth: access-list storage key must be 32 bytes")
            out[name] = item
        elif name in ("to", "input", "r", "s"):
            out[name] = bytes(item)
        else:
            out[name] = rlp_decode_int(bytes(item))
    if len(out["to"]) not in (0, 20):
        raise TxError("eth: to must be 0 (creation) or 20 bytes")
    if out["v"] not in (0, 1):
        raise TxError("eth type-2: v (yParity) must be 0 or 1, got %d" % out["v"])
    for sig in ("r", "s"):
        if len(out[sig]) != 32:
            raise TxError("eth: %s must be 32 bytes" % sig)
        if not 0 < int.from_bytes(out[sig], "big") < SECP256K1_ORDER:
            raise TxError("eth: %s out of secp256k1 range" % sig)
    return out


def build_eth_unsigned_1559(chain_id, nonce, max_priority_fee, max_fee, gas_limit,
                            to, value, data, access_list=()):
    """Build the UNSIGNED EIP-1559 payload: 0x02 || rlp(9 fields). No v/r/s."""
    if chain_id <= 0:
        raise TxError("eth: chainId must be positive")
    if gas_limit <= 0:
        raise TxError("eth: gasLimit must be positive")
    if len(to) != 20:
        raise TxError("eth: to must be 20 bytes for a value transfer")
    fields = [rlp_encode_int(chain_id), rlp_encode_int(nonce),
              rlp_encode_int(max_priority_fee), rlp_encode_int(max_fee),
              rlp_encode_int(gas_limit), to, rlp_encode_int(value), data,
              [list(entry) for entry in access_list]]
    return b"\x02" + rlp_encode(fields)


def eth_signing_hash(unsigned_payload):
    """EIP-1559 signing hash: keccak-256 of the unsigned payload (0x02 || rlp)."""
    if len(unsigned_payload) < 2 or unsigned_payload[0] != 0x02:
        raise TxError("eth: unsigned payload must start with 0x02")
    return keccak256(unsigned_payload).hex()


def validate_eth_unsigned_mainnet(unsigned_payload):
    """Mainnet policy for an unsigned EIP-1559 payload: type 0x02, chainId 1,
    9 fields, non-empty 20-byte destination for a value transfer."""
    if len(unsigned_payload) < 2 or unsigned_payload[0] != 0x02:
        raise TxError("eth mainnet: not a type-0x02 payload")
    fields, end = rlp_decode(unsigned_payload, 1)
    if end != len(unsigned_payload):
        raise TxError("eth mainnet: trailing bytes after RLP list")
    if not isinstance(fields, list) or len(fields) != 9:
        raise TxError("eth mainnet: unsigned payload must have 9 fields")
    chain_id = rlp_decode_int(bytes(fields[0]))
    if chain_id != 1:
        raise TxError("eth mainnet: chainId must be 1, got %d" % chain_id)
    to = bytes(fields[5])
    if len(to) != 20:
        raise TxError("eth mainnet: transfer destination must be 20 bytes")
    value = rlp_decode_int(bytes(fields[6]))
    if value < 0:
        raise TxError("eth mainnet: negative value")
    return {"chainId": chain_id, "nonce": rlp_decode_int(bytes(fields[1])),
            "maxPriorityFeePerGas": rlp_decode_int(bytes(fields[2])),
            "maxFeePerGas": rlp_decode_int(bytes(fields[3])),
            "gasLimit": rlp_decode_int(bytes(fields[4])),
            "to": to, "value": value, "input": bytes(fields[7]),
            "accessList": fields[8]}


def eip55_checksum(address_hex_lower):
    """EIP-55 mixed-case checksum of a 40-hex-char lowercase address."""
    if len(address_hex_lower) != 40:
        raise TxError("eip55: address must be 40 hex chars")
    digest = keccak256(address_hex_lower.encode("ascii")).hex()
    return "0x" + "".join(ch.upper() if digest[i] in "89abcdef" else ch
                           for i, ch in enumerate(address_hex_lower))

# --------------------------------------------------------------------------
# TRON: minimal protobuf wire decode/encode, TransferContract, txID
# --------------------------------------------------------------------------

def _read_pb_varint(buf, off):
    result = 0
    shift = 0
    start = off
    while True:
        if off >= len(buf):
            raise TxError("protobuf varint: truncated")
        byte = buf[off]
        off += 1
        if shift == 63 and byte > 1:
            raise TxError("protobuf varint: overflows 64 bits")
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            if off - start > 10:
                raise TxError("protobuf varint: overlong (>10 bytes)")
            return result, off
        shift += 7
        if shift >= 70:
            raise TxError("protobuf varint: too long")


def pb_decode(buf):
    """Decode protobuf wire format. Returns [(field_number, wire_type, value)]
    where value is an int (wire 0), bytes (wire 2), or the raw 4/8 bytes
    (wire 5/1). Unknown fields are returned, not dropped."""
    fields = []
    off = 0
    while off < len(buf):
        key, off = _read_pb_varint(buf, off)
        num, wire = key >> 3, key & 7
        if num == 0:
            raise TxError("protobuf: field number 0 is invalid")
        if wire == 0:
            value, off = _read_pb_varint(buf, off)
            fields.append((num, wire, value))
        elif wire == 2:
            length, off = _read_pb_varint(buf, off)
            if off + length > len(buf):
                raise TxError("protobuf: length-delimited field overruns buffer")
            fields.append((num, wire, bytes(buf[off:off + length])))
            off += length
        elif wire == 1:
            if off + 8 > len(buf):
                raise TxError("protobuf: 64-bit field truncated")
            fields.append((num, wire, bytes(buf[off:off + 8])))
            off += 8
        elif wire == 5:
            if off + 4 > len(buf):
                raise TxError("protobuf: 32-bit field truncated")
            fields.append((num, wire, bytes(buf[off:off + 4])))
            off += 4
        else:
            raise TxError("protobuf: unsupported wire type %d" % wire)
    return fields


def _pb_encode_varint(n):
    if n < 0:
        raise TxError("protobuf varint: negative")
    out = bytearray()
    while True:
        byte = n & 0x7F
        n >>= 7
        if n:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def pb_encode_field(num, wire, payload):
    out = _pb_encode_varint((num << 3) | wire)
    if wire == 0:
        return out + _pb_encode_varint(payload)
    if wire == 2:
        return out + _pb_encode_varint(len(payload)) + payload
    raise TxError("pb_encode_field: wire %d not supported for encoding" % wire)


def parse_tron_raw_data(raw_data):
    """Parse TRON Transaction.raw (observed wire layout of the fixture):
    1 ref_block_bytes (bytes, len 2), 4 ref_block_hash (bytes, len 8),
    8 expiration (varint, ms), 11 contract (message, repeated),
    14 timestamp (varint, ms), 18 fee_limit (varint, optional).
    Returns a dict; unknown top-level fields are tolerated (protobuf rule)
    but recorded."""
    fields = pb_decode(raw_data)
    by_num = {}
    unknown = []
    for num, wire, value in fields:
        by_num.setdefault(num, []).append((wire, value))
        if num not in (1, 3, 4, 8, 9, 10, 11, 12, 14, 18):
            unknown.append(num)
    if 1 not in by_num or by_num[1][0][0] != 2 or len(by_num[1][0][1]) != 2:
        raise TxError("tron: ref_block_bytes (field 1) must be 2 bytes")
    if 4 not in by_num or by_num[4][0][0] != 2 or len(by_num[4][0][1]) != 8:
        raise TxError("tron: ref_block_hash (field 4) must be 8 bytes")
    if 8 not in by_num or by_num[8][0][0] != 0:
        raise TxError("tron: expiration (field 8) must be a varint")
    if 14 not in by_num or by_num[14][0][0] != 0:
        raise TxError("tron: timestamp (field 14) must be a varint")
    if 11 not in by_num:
        raise TxError("tron: contract (field 11) missing")
    expiration = by_num[8][0][1]
    timestamp = by_num[14][0][1]
    if expiration <= timestamp:
        raise TxError("tron: expiration (%d) must be after timestamp (%d)"
                      % (expiration, timestamp))
    contracts = []
    for wire, blob in by_num[11]:
        if wire != 2:
            raise TxError("tron: contract must be length-delimited")
        contracts.append(parse_tron_contract(blob))
    return {"ref_block_bytes": by_num[1][0][1], "ref_block_hash": by_num[4][0][1],
            "expiration": expiration, "timestamp": timestamp,
            "contracts": contracts,
            "fee_limit": by_num[18][0][1] if 18 in by_num else None,
            "unknown_fields": unknown}


def parse_tron_contract(blob):
    """Parse a TRON Contract message: 1 type (varint enum), 2 parameter (Any).
    Any: 1 type_url (string), 2 value (bytes)."""
    fields = {num: value for num, wire, value in pb_decode(blob)}
    if 1 not in fields:
        raise TxError("tron contract: type (field 1) missing")
    if 2 not in fields:
        raise TxError("tron contract: parameter (field 2) missing")
    param = {num: value for num, wire, value in pb_decode(fields[2])}
    if 1 not in param or 2 not in param:
        raise TxError("tron contract: Any needs type_url (1) and value (2)")
    type_url = param[1].decode("utf-8", "strict")
    value = param[2]
    out = {"type": fields[1], "type_url": type_url}
    if type_url.endswith("TransferContract"):
        if fields[1] != 1:
            raise TxError("tron: TransferContract must have type enum 1")
        inner = {num: value for num, wire, value in pb_decode(value)}
        for req in (1, 2, 3):
            if req not in inner:
                raise TxError("tron TransferContract: field %d missing" % req)
        for addr_field in (1, 2):
            if len(inner[addr_field]) != 21 or inner[addr_field][0] != 0x41:
                raise TxError("tron TransferContract: address field %d must be "
                              "21 bytes starting 0x41" % addr_field)
        amount = inner[3]
        if amount < 0 or amount >= (1 << 63):
            raise TxError("tron TransferContract: amount out of int64 range")
        out.update({"owner_address": inner[1], "to_address": inner[2],
                    "amount": amount})
    return out


def build_tron_raw_data(ref_block_bytes, ref_block_hash, expiration, timestamp,
                        contracts, fee_limit=None):
    """Build TRON Transaction.raw bytes (unsigned: no signature, no ret)."""
    if len(ref_block_bytes) != 2:
        raise TxError("tron: ref_block_bytes must be 2 bytes")
    if len(ref_block_hash) != 8:
        raise TxError("tron: ref_block_hash must be 8 bytes")
    if expiration <= timestamp:
        raise TxError("tron: expiration must be after timestamp")
    out = pb_encode_field(1, 2, ref_block_bytes)
    out += pb_encode_field(4, 2, ref_block_hash)
    out += pb_encode_field(8, 0, expiration)
    for contract in contracts:
        out += pb_encode_field(11, 2, contract)
    out += pb_encode_field(14, 0, timestamp)
    if fee_limit is not None:
        out += pb_encode_field(18, 0, fee_limit)
    return out


def build_tron_transfer_contract(owner_address, to_address, amount):
    """Build the serialised Contract message for a TransferContract."""
    if len(owner_address) != 21 or owner_address[0] != 0x41:
        raise TxError("tron: owner_address must be 21 bytes starting 0x41")
    if len(to_address) != 21 or to_address[0] != 0x41:
        raise TxError("tron: to_address must be 21 bytes starting 0x41")
    if amount < 0 or amount >= (1 << 63):
        raise TxError("tron: amount out of int64 range")
    inner = pb_encode_field(1, 2, owner_address)
    inner += pb_encode_field(2, 2, to_address)
    inner += pb_encode_field(3, 0, amount)
    any_msg = pb_encode_field(1, 2, b"type.googleapis.com/protocol.TransferContract")
    any_msg += pb_encode_field(2, 2, inner)
    return pb_encode_field(1, 0, 1) + pb_encode_field(2, 2, any_msg)


def tron_txid(raw_data):
    """TRON txID = SHA-256 (single round) of the raw_data bytes only.
    The signature and the ret block are NOT hashed."""
    return hashlib.sha256(raw_data).hexdigest()


def validate_tron_address(text):
    """TRON Base58Check address rules (docs/02-chains section 5): starts
    with T, exactly 34 chars, valid checksum, payload 21 bytes starting 0x41."""
    if len(text) != 34 or not text.startswith("T"):
        raise TxError("tron address must be 34 chars starting with T: %r" % text)
    payload = b58check_decode(text)
    if len(payload) != 21 or payload[0] != 0x41:
        raise TxError("tron address payload must be 21 bytes starting 0x41")
    return payload


# --------------------------------------------------------------------------
# TON: Bag-of-Cells parse/serialize, cell bit reader, friendly addresses,
# Wallet V4R2 external-message body
# --------------------------------------------------------------------------

class TonCell:
    def __init__(self, bits, bitlen, refs, exotic=False, level=0, hash_bytes=b""):
        self.bits = bits          # data bytes (padded, terminator included)
        self.bitlen = bitlen      # true data bit length (excluding terminator)
        self.refs = refs          # list of cell indices
        self.exotic = exotic
        self.level = level        # level mask bits (d1 >> 5)
        self.hash_bytes = hash_bytes  # stored hashes+depths (d1 & 16), if any

    def bit_reader(self):
        return TonBitReader(self.bits, self.bitlen)


class TonBitReader:
    def __init__(self, data, bitlen):
        self.data = data
        self.bitlen = bitlen
        self.pos = 0

    def load_uint(self, nbits):
        if self.pos + nbits > self.bitlen:
            raise TxError("ton cell: read past end (%d + %d > %d)"
                          % (self.pos, nbits, self.bitlen))
        value = 0
        for i in range(nbits):
            byte = self.data[(self.pos + i) // 8]
            bit = (byte >> (7 - (self.pos + i) % 8)) & 1
            value = (value << 1) | bit
        self.pos += nbits
        return value

    def remaining(self):
        return self.bitlen - self.pos


def parse_ton_boc(src):
    """Parse a Bag-of-Cells (ton-core serialization.ts parseBoc). Returns
    (cells, roots). Supports magic 0xB5EE9C72 (the toncenter form), 0x68FF65F3
    and 0xACC3A728."""
    if len(src) < 6:
        raise TxError("ton boc: too short")
    magic = int.from_bytes(src[:4], "big")
    if magic not in (0xB5EE9C72, 0x68FF65F3, 0xACC3A728):
        raise TxError("ton boc: bad magic %08x" % magic)
    pos = 4
    if magic == 0xB5EE9C72:
        flags = src[pos]
        pos += 1
        has_idx = (flags >> 7) & 1
        has_crc = (flags >> 6) & 1
        has_cache = (flags >> 5) & 1
        if has_cache:
            raise TxError("ton boc: cache bits not supported here")
        if (flags >> 3) & 0x3:
            raise TxError("ton boc: flags field must be 0")
        size_bytes = flags & 0x07
        if size_bytes == 0:
            raise TxError("ton boc: size_bytes must be >= 1")
        off_bytes = src[pos]
        pos += 1
    else:
        has_idx = 0
        has_crc = 1 if magic == 0xACC3A728 else 0
        size_bytes = src[pos]
        pos += 1
        off_bytes = src[pos]
        pos += 1
        if size_bytes == 0:
            raise TxError("ton boc: size_bytes must be >= 1")

    def read_sized(n):
        nonlocal pos
        if pos + n > len(src):
            raise TxError("ton boc header: truncated")
        value = int.from_bytes(src[pos:pos + n], "big")
        pos += n
        return value

    cells_num = read_sized(size_bytes)
    roots_num = read_sized(size_bytes)
    absent_num = read_sized(size_bytes)
    # NOTE: totalCellSize is read with offBytes, NOT sizeBytes
    # (ton-core serialization.ts L269).
    total_size = read_sized(off_bytes)
    if cells_num == 0:
        raise TxError("ton boc: zero cells")
    if roots_num == 0:
        raise TxError("ton boc: zero roots")
    if absent_num != 0:
        raise TxError("ton boc: absent cells not supported here")
    roots = [read_sized(size_bytes) for _ in range(roots_num)]
    for root in roots:
        if root >= cells_num:
            raise TxError("ton boc: root index %d out of range (%d cells)"
                          % (root, cells_num))
    if has_idx:
        pos += cells_num * off_bytes
    if pos + total_size > len(src):
        raise TxError("ton boc: cell data truncated")
    cell_data = src[pos:pos + total_size]
    pos += total_size
    if has_crc:
        if pos + 4 > len(src):
            raise TxError("ton boc: CRC truncated")
        # CRC32C is stored little-endian.
        stored = int.from_bytes(src[pos:pos + 4], "little")
        if stored != crc32c(src[:pos]):
            raise TxError("ton boc: CRC32C mismatch")
        pos += 4
    if pos != len(src):
        raise TxError("ton boc: trailing bytes after CRC")
    cells = _parse_ton_cells(cell_data, cells_num, size_bytes)
    return cells, roots


def _parse_ton_cells(cell_data, cells_num, size_bytes):
    pos = 0
    cells = []
    for _ in range(cells_num):
        if pos + 2 > len(cell_data):
            raise TxError("ton boc cell: truncated descriptor")
        d1, d2 = cell_data[pos], cell_data[pos + 1]
        pos += 2
        refs_count = d1 % 8
        exotic = bool(d1 & 8)
        has_hashes = bool(d1 & 16)
        level_mask = d1 >> 5
        hash_bytes = b""
        if has_hashes:
            hashes = 1 + bin(level_mask & 7).count("1")
            n_hash_bytes = hashes * 32 + hashes * 2  # hashes + depths
            if pos + n_hash_bytes > len(cell_data):
                raise TxError("ton boc cell: truncated hashes")
            hash_bytes = bytes(cell_data[pos:pos + n_hash_bytes])
            pos += n_hash_bytes
        data_bytes = (d2 + 1) // 2
        padding = bool(d2 % 2)
        if pos + data_bytes > len(cell_data):
            raise TxError("ton boc cell: truncated data")
        raw = cell_data[pos:pos + data_bytes]
        pos += data_bytes
        if padding:
            # True bit length: scan back from the end for the 1 terminator.
            total_bits = data_bytes * 8
            bitlen = total_bits
            while bitlen > 0:
                bitlen -= 1
                byte = raw[bitlen // 8]
                if (byte >> (7 - bitlen % 8)) & 1:
                    break
            else:
                raise TxError("ton boc cell: no terminator bit")
            if any(((raw[i // 8] >> (7 - i % 8)) & 1)
                   for i in range(bitlen + 1, total_bits)):
                raise TxError("ton boc cell: non-zero bits after terminator")
        else:
            bitlen = data_bytes * 8
        refs = []
        for _ in range(refs_count):
            if pos + size_bytes > len(cell_data):
                raise TxError("ton boc cell: truncated refs")
            refs.append(int.from_bytes(cell_data[pos:pos + size_bytes], "big"))
            pos += size_bytes
        for ref in refs:
            if ref >= cells_num:
                raise TxError("ton boc cell: ref %d out of range (%d cells)"
                              % (ref, cells_num))
        cells.append(TonCell(bytes(raw), bitlen, refs, exotic, level_mask, hash_bytes))
    if pos != len(cell_data):
        raise TxError("ton boc: cell data not fully consumed")
    return cells


def serialize_ton_boc(cells, roots, with_crc=True):
    """Serialize cells (in storage order) to a BOC. Mirrors ton-core
    serializeBoc with idx disabled. Used for the byte-exact round-trip."""
    size_bytes = max((max([len(cells)] + [r for r in roots]).bit_length() + 7) // 8, 1)

    def cell_size(cell):
        data_bytes = (cell.bitlen + 7) // 8  # bits rounded up (terminator fits)
        return 2 + len(cell.hash_bytes) + data_bytes + len(cell.refs) * size_bytes

    total_size = sum(cell_size(c) for c in cells)
    off_bytes = max((total_size.bit_length() + 7) // 8, 1)
    out = bytearray()
    out += (0xB5EE9C72).to_bytes(4, "big")
    flags = (1 if with_crc else 0) << 6 | size_bytes
    out.append(flags)
    out.append(off_bytes)
    out += len(cells).to_bytes(size_bytes, "big")
    out += len(roots).to_bytes(size_bytes, "big")
    out += (0).to_bytes(size_bytes, "big")
    out += total_size.to_bytes(off_bytes, "big")
    for root in roots:
        out += root.to_bytes(size_bytes, "big")
    for cell in cells:
        d1 = len(cell.refs) | (8 if cell.exotic else 0)
        d1 |= (16 if cell.hash_bytes else 0) | ((cell.level & 7) << 5)
        data_bytes = (cell.bitlen + 7) // 8
        d2 = data_bytes * 2 - (1 if cell.bitlen % 8 else 0)
        out.append(d1)
        out.append(d2)
        out += cell.hash_bytes
        padded = bytearray(cell.bits[:data_bytes])
        if len(padded) < data_bytes:
            padded += b"\x00" * (data_bytes - len(padded))
        if cell.bitlen % 8:
            padded[cell.bitlen // 8] |= 1 << (7 - cell.bitlen % 8)
        out += padded
        for ref in cell.refs:
            out += ref.to_bytes(size_bytes, "big")
    if with_crc:
        out += crc32c(bytes(out)).to_bytes(4, "little")
    return bytes(out)


TON_BOUNCEABLE_TAG = 0x11
TON_NON_BOUNCEABLE_TAG = 0x51
TON_TEST_FLAG = 0x80


def ton_decode_friendly(text):
    """Decode a TON user-friendly address (ton-core Address.ts):
    36 bytes = tag(1) + workchain(1) + hash(32) + crc16(2, big-endian).
    Tag 0x11 = bounceable, 0x51 = non-bounceable; testnet adds 0x80."""
    if len(text) != 48:
        raise TxError("ton friendly address must be 48 chars")
    raw = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    if len(raw) != 36:
        raise TxError("ton friendly address must decode to 36 bytes")
    if crc16_xmodem(raw[:34]) != int.from_bytes(raw[34:], "big"):
        raise TxError("ton friendly address: CRC16 mismatch")
    tag = raw[0]
    testnet = bool(tag & TON_TEST_FLAG)
    if testnet:
        tag ^= TON_TEST_FLAG
    if tag not in (TON_BOUNCEABLE_TAG, TON_NON_BOUNCEABLE_TAG):
        raise TxError("ton friendly address: unknown tag %02x" % tag)
    workchain = raw[1]
    if workchain == 0xFF:
        workchain = -1
    elif workchain > 0x7F:
        raise TxError("ton friendly address: workchain byte %02x invalid" % raw[1])
    return {"bounceable": tag == TON_BOUNCEABLE_TAG, "testnet": testnet,
            "workchain": workchain, "hash": raw[2:34].hex()}


def ton_encode_friendly(workchain, hash_hex, bounceable=True, testnet=False):
    """Encode a TON user-friendly address (inverse of ton_decode_friendly)."""
    if workchain not in (0, -1):
        raise TxError("ton friendly address: workchain must be 0 or -1")
    tag = TON_BOUNCEABLE_TAG if bounceable else TON_NON_BOUNCEABLE_TAG
    if testnet:
        tag |= TON_TEST_FLAG
    addr = bytes([tag, workchain & 0xFF]) + bytes.fromhex(hash_hex)
    payload = addr + crc16_xmodem(addr).to_bytes(2, "big")
    return base64.urlsafe_b64encode(payload).decode("ascii")


def build_ton_v4r2_body(wallet_id, valid_until, seqno, opcode=0):
    """Build a Wallet V4R2 external-message body cell (UNSIGNED: the 512-bit
    signature slot is zeros, not a signature). Layout (docs.ton.org Wallet V4,
    wallet-v4-code.fc): signature bits512, wallet_id uint32, valid_until
    uint32, msg_seqno uint32, opcode uint32. Returns (bits_bytes, bitlen)."""
    if wallet_id < 0 or wallet_id > 0xFFFFFFFF:
        raise TxError("ton v4r2: wallet_id out of uint32 range")
    bits = bytearray(80)  # 512-bit signature slot (zeros) + 4x uint32
    struct.pack_into(">I", bits, 64, wallet_id)
    struct.pack_into(">I", bits, 68, valid_until)
    struct.pack_into(">I", bits, 72, seqno)
    struct.pack_into(">I", bits, 76, opcode)
    return bytes(bits), 640


def parse_ton_v4r2_body(bits_bytes, bitlen):
    """Parse a Wallet V4R2 external-message body. Returns the fields; the
    signature slot is returned as bytes (zeros here = unsigned)."""
    if bitlen < 640:
        raise TxError("ton v4r2: body too short (%d bits)" % bitlen)
    reader = TonBitReader(bits_bytes, bitlen)
    signature = bytes(bits_bytes[:64])
    for _ in range(512):
        reader.load_uint(1)
    wallet_id = reader.load_uint(32)
    valid_until = reader.load_uint(32)
    seqno = reader.load_uint(32)
    opcode = reader.load_uint(32)
    return {"signature": signature, "wallet_id": wallet_id,
            "valid_until": valid_until, "seqno": seqno, "opcode": opcode,
            "extra_bits": reader.remaining()}


def validate_ton_v4r2_body(bits_bytes, bitlen, expected_wallet_id,
                           expected_seqno, now):
    """V4R2 acceptance checks that run BEFORE any signature is considered:
    wallet_id must match, seqno must match (replay protection), valid_until
    must be in the future. Raises TxError otherwise."""
    fields = parse_ton_v4r2_body(bits_bytes, bitlen)
    if fields["wallet_id"] != expected_wallet_id:
        raise TxError("ton v4r2: wallet_id %d != expected %d"
                      % (fields["wallet_id"], expected_wallet_id))
    if fields["seqno"] != expected_seqno:
        raise TxError("ton v4r2: seqno %d != expected %d (replay?)"
                      % (fields["seqno"], expected_seqno))
    if fields["valid_until"] <= now:
        raise TxError("ton v4r2: valid_until %d expired at now %d"
                      % (fields["valid_until"], now))
    if fields["extra_bits"] != 0:
        raise TxError("ton v4r2: %d unexpected trailing bits in body"
                      % fields["extra_bits"])
    return fields

# --------------------------------------------------------------------------
# Wallet-address policy helpers
# --------------------------------------------------------------------------

def validate_ton_wallet_workchain(decoded):
    """Wallet accounts live on workchain 0 (masterchain -1 for contracts);
    any other workchain is not a Bawa wallet address."""
    if decoded["workchain"] not in (0, -1):
        raise TxError("ton wallet address: workchain %d not 0 or -1"
                      % decoded["workchain"])
    return decoded


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------

class TestPrimitiveVectors(unittest.TestCase):
    def test_keccak256_empty(self):
        self.assertEqual(
            keccak256(b"").hex(),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")

    def test_keccak256_hello_world(self):
        self.assertEqual(
            keccak256(b"hello world").hex(),
            "47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad")

    def test_keccak256_is_not_sha3_256(self):
        # hashlib.sha3_256 uses FIPS-202 padding; Keccak-256 must differ.
        self.assertNotEqual(keccak256(b"").hex(),
                            hashlib.sha3_256(b"").hexdigest())

    def test_crc32c_vector(self):
        self.assertEqual(crc32c(b"123456789"), 0xE3069283)

    def test_crc16_xmodem_vector(self):
        self.assertEqual(crc16_xmodem(b"123456789"), 0x31C3)

    def test_bech32_bip173_vector(self):
        program = bytes.fromhex("751e76e8199196d454941c45d1b3a323f1433bd6")
        self.assertEqual(bech32_encode("bc", 0, program),
                         "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")


class TestBtcFixture(unittest.TestCase):
    def setUp(self):
        self.raw = bytes.fromhex(BTC_TX_HEX)
        self.tx = parse_btc_tx(self.raw)

    def test_fixture_shape(self):
        self.assertEqual(len(self.raw), 222)
        self.assertEqual(self.tx["version"], 2)
        self.assertTrue(self.tx["segwit"])
        self.assertEqual(self.tx["locktime"], 975529)

    def test_input(self):
        self.assertEqual(len(self.tx["inputs"]), 1)
        txin = self.tx["inputs"][0]
        self.assertEqual(txin["prev_txid"],
                         "a4c696c3f21018bd32f9deea36b87c174f848a5c5cbe20a805ec0b0762685810")
        self.assertEqual(txin["vout"], 1)
        self.assertEqual(txin["script_sig"], "")
        self.assertEqual(txin["sequence"], 0xFFFFFFFD)  # RBF-enabled

    def test_outputs(self):
        self.assertEqual(len(self.tx["outputs"]), 2)
        self.assertEqual(self.tx["outputs"][0]["value"], 14074)
        self.assertEqual(self.tx["outputs"][0]["script_pubkey"],
                         "00148927018e5a29cc5131a6025f600aae1fc5a5661d")
        self.assertEqual(self.tx["outputs"][1]["value"], 113626)
        self.assertEqual(self.tx["outputs"][1]["script_pubkey"],
                         "0014691019ce2577183880f8f1b097300526560aa963")

    def test_witness(self):
        self.assertEqual(len(self.tx["witness"]), 1)
        items = self.tx["witness"][0]
        self.assertEqual(len(items), 2)
        self.assertEqual(len(bytes.fromhex(items[0])), 71)   # DER signature
        self.assertEqual(len(bytes.fromhex(items[1])), 33)   # compressed pubkey
        self.assertEqual(items[1],
                         "0292a29c30c06ffac5aedabcd5ae235ddabd3d37c9acacedeb3d297d53e32a7f30")

    def test_txid_is_double_sha256_of_stripped_serialization(self):
        self.assertEqual(btc_txid(self.tx), BTC_TXID)

    def test_output_addresses_match_blockstream(self):
        # Independent cross-check: Blockstream reports these bc1q addresses
        # for the two P2WPKH outputs; our bech32 encoder must reproduce them.
        expected = ["bc1q3ynsrrj698x9zvdxqf0kqz4wrlz62esaqenzwy",
                    "bc1qdygpnn39wuvr3q8c7xcfwvq9yetq42trymagjv"]
        for txout, address in zip(self.tx["outputs"], expected):
            script = bytes.fromhex(txout["script_pubkey"])
            self.assertEqual(script[0], 0x00)      # witness version 0
            self.assertEqual(script[1], 0x14)      # 20-byte program
            self.assertEqual(bech32_encode("bc", 0, script[2:]), address)

    def test_signed_round_trip_is_byte_exact(self):
        self.assertEqual(btc_serialize_signed(self.tx), self.raw)


class TestBtcUnsigned(unittest.TestCase):
    def setUp(self):
        self.tx = parse_btc_tx(bytes.fromhex(BTC_TX_HEX))

    def test_unsigned_differs_from_signed_only_by_witness(self):
        unsigned = btc_serialize_unsigned(self.tx)
        signed = bytes.fromhex(BTC_TX_HEX)
        self.assertNotEqual(unsigned, signed)
        # No segwit marker/flag: bytes 0-3 are the version, byte 4 is the
        # input count (1), byte 5 is the first prev-txid byte (0x10).
        self.assertEqual(unsigned[:5], bytes.fromhex("0200000001"))
        self.assertEqual(len(unsigned), 4 + 1 + 41 + 1 + 2 * (8 + 1 + 22) + 4)
        reparsed = parse_btc_tx(unsigned)
        self.assertFalse(reparsed["segwit"])
        self.assertEqual(reparsed["inputs"], self.tx["inputs"])
        self.assertEqual(reparsed["outputs"], self.tx["outputs"])
        self.assertEqual(reparsed["locktime"], self.tx["locktime"])

    def test_unsigned_txid_is_the_real_txid(self):
        # The txid is computed from the stripped form, so the unsigned
        # serialization hashes to the published txid.
        self.assertEqual(sha256d(btc_serialize_unsigned(self.tx))[::-1].hex(),
                         BTC_TXID)

    def test_reattaching_witness_reproduces_signed_bytes(self):
        unsigned = btc_serialize_unsigned(self.tx)
        self.assertEqual(btc_serialize_signed(parse_btc_tx(unsigned)
                                              | {"witness": self.tx["witness"],
                                                 "segwit": True}),
                         bytes.fromhex(BTC_TX_HEX))


class TestBtcNegative(unittest.TestCase):
    def test_truncated_transaction(self):
        with self.assertRaises(TxError):
            parse_btc_tx(bytes.fromhex(BTC_TX_HEX)[:100])

    def test_trailing_bytes(self):
        with self.assertRaises(TxError):
            parse_btc_tx(bytes.fromhex(BTC_TX_HEX) + b"\x00")

    def test_short_locktime(self):
        with self.assertRaises(TxError):
            parse_btc_tx(bytes.fromhex(BTC_TX_HEX)[:-2])

    def test_version_zero_rejected(self):
        raw = b"\x00\x00\x00\x00" + bytes.fromhex(BTC_TX_HEX)[4:]
        with self.assertRaises(TxError):
            parse_btc_tx(raw)

    def test_witness_flag_without_marker(self):
        raw = bytearray(bytes.fromhex(BTC_TX_HEX))
        raw[4] = 0x00
        raw[5] = 0x02  # flag != 1
        with self.assertRaises(TxError):
            parse_btc_tx(bytes(raw))

    def test_noncanonical_varint(self):
        # Input count 1 encoded as 0xfd 0x01 0x00 (must be a single 0x01 byte).
        raw = b"\x02\x00\x00\x00\xfd\x01\x00"
        with self.assertRaises(TxError):
            parse_btc_tx(raw)

    def test_truncated_varint(self):
        raw = b"\x02\x00\x00\x00\xfd\x01"
        with self.assertRaises(TxError):
            parse_btc_tx(raw)

    def test_zero_inputs_rejected(self):
        # Segwit form with a zero input count (a bare 0x00 after the version
        # is the segwit marker position, so zero inputs must use 00 01 00).
        raw = b"\x02\x00\x00\x00\x00\x01\x00"
        with self.assertRaises(TxError):
            parse_btc_tx(raw)

    def test_varint_boundaries_are_canonical(self):
        self.assertEqual(read_varint(bytes([0xFC]), 0), (0xFC, 1))
        self.assertEqual(read_varint(bytes([0xFD, 0xFD, 0x00]), 0), (0xFD, 3))
        self.assertEqual(read_varint(bytes([0xFE, 0x00, 0x00, 0x01, 0x00]), 0),
                         (0x10000, 5))
        self.assertEqual(read_varint(bytes([0xFF, 0x00, 0x00, 0x00, 0x00,
                                            0x01, 0x00, 0x00, 0x00]), 0),
                         (0x100000000, 9))
        self.assertEqual(write_varint(0xFC), bytes([0xFC]))
        self.assertEqual(write_varint(0xFD), bytes([0xFD, 0xFD, 0x00]))
        self.assertEqual(write_varint(0x10000),
                         bytes([0xFE, 0x00, 0x00, 0x01, 0x00]))


class TestEthFixture(unittest.TestCase):
    def setUp(self):
        self.raw = bytes.fromhex(ETH_RAW_HEX)
        self.tx = parse_eth_type2_signed(self.raw)

    def test_raw_shape(self):
        self.assertEqual(self.raw[0], 0x02)
        self.assertEqual(len(self.raw), 884)

    def test_fields_match_rpc(self):
        self.assertEqual(self.tx["chainId"], 1)
        self.assertEqual(self.tx["nonce"], 0x3232F)
        self.assertEqual(self.tx["maxPriorityFeePerGas"], 0)
        self.assertEqual(self.tx["maxFeePerGas"], 0x58C1FDC)
        self.assertEqual(self.tx["gasLimit"], 0x711FA)
        self.assertEqual(self.tx["to"].hex(), "0000000aa232009084bd71a5797d089aa4edfad4")
        self.assertEqual(self.tx["value"], 0)
        self.assertEqual(self.tx["accessList"], [])
        self.assertTrue(self.tx["input"].startswith(bytes.fromhex("09c5eabe")))

    def test_signature_fields(self):
        self.assertEqual(self.tx["v"], 0)  # yParity
        self.assertEqual(len(self.tx["r"]), 32)
        self.assertEqual(len(self.tx["s"]), 32)
        self.assertEqual(self.tx["r"].hex(),
                         "62d74ada47c0ef5706f4183113faf6fdbd3b941c699532a7e7b5fb087c077d77")
        self.assertEqual(self.tx["s"].hex(),
                         "6359fb825a533bba8436e368923798b5cd565472f7bcd80de9a909c73337ad28")

    def test_signed_rlp_round_trip_is_byte_exact(self):
        fields = [rlp_encode_int(self.tx["chainId"]), rlp_encode_int(self.tx["nonce"]),
                  rlp_encode_int(self.tx["maxPriorityFeePerGas"]),
                  rlp_encode_int(self.tx["maxFeePerGas"]),
                  rlp_encode_int(self.tx["gasLimit"]), self.tx["to"],
                  rlp_encode_int(self.tx["value"]), self.tx["input"],
                  self.tx["accessList"],
                  rlp_encode_int(self.tx["v"]), self.tx["r"], self.tx["s"]]
        self.assertEqual(b"\x02" + rlp_encode(fields), self.raw)

    def test_eip55_vector(self):
        self.assertEqual(eip55_checksum("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"),
                         "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")


class TestEthUnsigned(unittest.TestCase):
    def setUp(self):
        self.tx = parse_eth_type2_signed(bytes.fromhex(ETH_RAW_HEX))

    def test_unsigned_payload_has_nine_fields_no_signature(self):
        unsigned = build_eth_unsigned_1559(
            self.tx["chainId"], self.tx["nonce"], self.tx["maxPriorityFeePerGas"],
            self.tx["maxFeePerGas"], self.tx["gasLimit"], self.tx["to"],
            self.tx["value"], self.tx["input"], self.tx["accessList"])
        self.assertEqual(unsigned[0], 0x02)
        fields, end = rlp_decode(unsigned, 1)
        self.assertEqual(end, len(unsigned))
        self.assertEqual(len(fields), 9)

    def test_unsigned_signing_hash_matches(self):
        unsigned = build_eth_unsigned_1559(
            self.tx["chainId"], self.tx["nonce"], self.tx["maxPriorityFeePerGas"],
            self.tx["maxFeePerGas"], self.tx["gasLimit"], self.tx["to"],
            self.tx["value"], self.tx["input"], self.tx["accessList"])
        self.assertEqual(eth_signing_hash(unsigned), ETH_UNSIGNED_SIGNING_HASH)

    def test_mainnet_validation_accepts_fixture(self):
        unsigned = build_eth_unsigned_1559(
            1, self.tx["nonce"], self.tx["maxPriorityFeePerGas"],
            self.tx["maxFeePerGas"], self.tx["gasLimit"], self.tx["to"],
            self.tx["value"], self.tx["input"], [])
        checked = validate_eth_unsigned_mainnet(unsigned)
        self.assertEqual(checked["chainId"], 1)
        self.assertEqual(checked["nonce"], 0x3232F)
        self.assertEqual(checked["gasLimit"], 0x711FA)

    def test_unsigned_round_trip(self):
        unsigned = build_eth_unsigned_1559(
            1, 7, 1_000_000_000, 50_000_000_000, 21000,
            bytes.fromhex("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"),
            1_000_000_000_000_000_000, b"", [])
        checked = validate_eth_unsigned_mainnet(unsigned)
        self.assertEqual(checked["nonce"], 7)
        self.assertEqual(checked["value"], 10 ** 18)
        self.assertEqual(checked["to"].hex(),
                         "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")


class TestEthNegative(unittest.TestCase):
    def test_wrong_type_byte(self):
        raw = b"\x01" + bytes.fromhex(ETH_RAW_HEX)[1:]
        with self.assertRaises(TxError):
            parse_eth_type2_signed(raw)

    def test_truncated_rlp(self):
        with self.assertRaises(TxError):
            parse_eth_type2_signed(bytes.fromhex(ETH_RAW_HEX)[:-5])

    def test_trailing_bytes(self):
        with self.assertRaises(TxError):
            parse_eth_type2_signed(bytes.fromhex(ETH_RAW_HEX) + b"\x00")

    def test_sepolia_chain_id_rejected_by_mainnet_validation(self):
        unsigned = build_eth_unsigned_1559(
            11155111, 0, 0, 1, 21000, bytes(20), 0, b"", [])
        with self.assertRaises(TxError):
            validate_eth_unsigned_mainnet(unsigned)

    def test_noncanonical_short_string_form(self):
        # 0xb8 0x01 0x01: long form for a 1-byte string.
        with self.assertRaises(TxError):
            rlp_decode(bytes([0xB8, 0x01, 0x01]))

    def test_single_byte_must_be_inline(self):
        # 0x81 0x01: a byte < 0x80 encoded as a string.
        with self.assertRaises(TxError):
            rlp_decode(bytes([0x81, 0x01]))

    def test_leading_zero_integer(self):
        with self.assertRaises(TxError):
            rlp_decode_int(bytes([0x00, 0x01]))

    def test_access_list_wrong_shape(self):
        fields = [rlp_encode_int(1), b"", b"", b"", rlp_encode_int(21000),
                  bytes(20), b"", b"",
                  [[bytes(20), b"not-a-list"]],
                  b"", bytes(32), bytes(32)]
        raw = b"\x02" + rlp_encode(fields)
        with self.assertRaises(TxError):
            parse_eth_type2_signed(raw)

    def test_zero_gas_limit_rejected(self):
        with self.assertRaises(TxError):
            build_eth_unsigned_1559(1, 0, 0, 1, 0, bytes(20), 0, b"", [])

    def test_short_destination_rejected(self):
        with self.assertRaises(TxError):
            build_eth_unsigned_1559(1, 0, 0, 1, 21000, bytes(19), 0, b"", [])


class TestTronFixture(unittest.TestCase):
    def setUp(self):
        self.raw_data = bytes.fromhex(TRON_RAW_DATA_HEX)
        self.tx = parse_tron_raw_data(self.raw_data)

    def test_raw_data_shape(self):
        self.assertEqual(len(self.raw_data), 131)

    def test_header_fields(self):
        self.assertEqual(self.tx["ref_block_bytes"], bytes.fromhex("bd53"))
        self.assertEqual(self.tx["ref_block_hash"],
                         bytes.fromhex("cd624180a88de7eb"))
        self.assertEqual(self.tx["expiration"], 1794470682000)
        self.assertEqual(self.tx["timestamp"], 1794470625178)
        self.assertGreater(self.tx["expiration"], self.tx["timestamp"])
        self.assertEqual(self.tx["unknown_fields"], [])

    def test_transfer_contract(self):
        self.assertEqual(len(self.tx["contracts"]), 1)
        contract = self.tx["contracts"][0]
        self.assertEqual(contract["type"], 1)
        self.assertEqual(contract["type_url"],
                         "type.googleapis.com/protocol.TransferContract")
        self.assertEqual(contract["owner_address"].hex(),
                         "41d4e59bdc348c1e6f678066427b2ce7394b15d759")
        self.assertEqual(contract["to_address"].hex(),
                         "414dc16f5f52e60c4739b3f39a128e27c8f9ba41a3")
        self.assertEqual(contract["amount"], 7)

    def test_txid_is_sha256_of_raw_data_only(self):
        self.assertEqual(tron_txid(self.raw_data), TRON_TXID)

    def test_addresses_are_valid_tron_base58check(self):
        self.assertEqual(
            b58check_encode(bytes.fromhex("41d4e59bdc348c1e6f678066427b2ce7394b15d759")),
            "TVNuKEBn3tnwqbFqSiBf9CL95hVCh4UsoG")
        self.assertEqual(
            b58check_encode(bytes.fromhex("414dc16f5f52e60c4739b3f39a128e27c8f9ba41a3")),
            "TH4Lkw3utnsEZjEuiZXdh1rgmNbV7SucgW")
        self.assertEqual(validate_tron_address("TVNuKEBn3tnwqbFqSiBf9CL95hVCh4UsoG"),
                         bytes.fromhex("41d4e59bdc348c1e6f678066427b2ce7394b15d759"))

    def test_same_key_material_as_ethereum_address(self):
        # TRON and ETH share the secp256k1 key: strip 0x41 to get the 20-byte
        # payload that ETH displays as 0x + 40 hex chars (docs/02-chains §5).
        payload = self.tx["contracts"][0]["owner_address"][1:]
        self.assertEqual(payload.hex(), "d4e59bdc348c1e6f678066427b2ce7394b15d759")
        self.assertEqual(len(payload), 20)

    def test_unknown_fields_are_tolerated_not_dropped(self):
        extra = self.raw_data + pb_encode_field(99, 0, 1)
        parsed = parse_tron_raw_data(extra)
        self.assertEqual(parsed["unknown_fields"], [99])
        self.assertEqual(parsed["contracts"][0]["amount"], 7)


class TestTronUnsigned(unittest.TestCase):
    def setUp(self):
        self.raw_data = bytes.fromhex(TRON_RAW_DATA_HEX)
        self.tx = parse_tron_raw_data(self.raw_data)

    def test_rebuild_is_byte_exact(self):
        contract = build_tron_transfer_contract(
            self.tx["contracts"][0]["owner_address"],
            self.tx["contracts"][0]["to_address"],
            self.tx["contracts"][0]["amount"])
        rebuilt = build_tron_raw_data(
            self.tx["ref_block_bytes"], self.tx["ref_block_hash"],
            self.tx["expiration"], self.tx["timestamp"], [contract])
        self.assertEqual(rebuilt, self.raw_data)
        self.assertEqual(tron_txid(rebuilt), TRON_TXID)

    def test_txid_excludes_signature_and_ret(self):
        # txID is a hash of raw_data ONLY: hashing raw_data + the real
        # 65-byte signature gives a different value, and the fixture txID
        # equals sha256(raw_data) exactly.
        self.assertEqual(tron_txid(self.raw_data), TRON_TXID)
        with_sig = self.raw_data + bytes.fromhex(TRON_SIGNATURE_HEX)
        self.assertNotEqual(tron_txid(with_sig), TRON_TXID)

    def test_unsigned_has_no_signature_field(self):
        fields = {num for num, _, _ in pb_decode(self.raw_data)}
        self.assertNotIn(99, fields)  # no out-of-band fields in the fixture
        self.assertEqual(sorted(fields), [1, 4, 8, 11, 14])


class TestTronNegative(unittest.TestCase):
    def test_truncated_varint(self):
        with self.assertRaises(TxError):
            pb_decode(bytes.fromhex(TRON_RAW_DATA_HEX)[:3])

    def test_wire_type_6_rejected(self):
        with self.assertRaises(TxError):
            pb_decode(bytes([0x36]))

    def test_wire_type_7_rejected(self):
        with self.assertRaises(TxError):
            pb_decode(bytes([0x37]))

    def test_length_delimited_overrun(self):
        with self.assertRaises(TxError):
            pb_decode(pb_encode_field(1, 2, b"abc")[:2])

    def test_amount_over_int64_rejected(self):
        with self.assertRaises(TxError):
            build_tron_transfer_contract(bytes.fromhex("41" + "00" * 20),
                                         bytes.fromhex("41" + "00" * 20),
                                         1 << 63)

    def test_short_address_rejected(self):
        with self.assertRaises(TxError):
            build_tron_transfer_contract(bytes(20), bytes.fromhex("41" + "00" * 20), 1)

    def test_ref_block_bytes_wrong_length(self):
        with self.assertRaises(TxError):
            build_tron_raw_data(b"\x00\x00\x00", bytes(8), 2, 1, [])

    def test_expiration_before_timestamp(self):
        with self.assertRaises(TxError):
            build_tron_raw_data(b"\x00\x00", bytes(8), 1000, 1001, [])

    def test_ethereum_text_is_not_a_tron_address(self):
        with self.assertRaises(TxError):
            validate_tron_address("0xd4e59bdc348c1e6f678066427b2ce7394b15d759")

    def test_bad_checksum_rejected(self):
        bad = "TVNuKEBn3tnwqbFqSiBf9CL95hVCh4UsoH"  # last char changed
        with self.assertRaises(TxError):
            validate_tron_address(bad)


class TestTonBocFixture(unittest.TestCase):
    def setUp(self):
        self.boc = base64.b64decode(TON_BOC_B64)
        self.cells, self.roots = parse_ton_boc(self.boc)

    def test_boc_shape(self):
        self.assertEqual(len(self.boc), 1377)
        self.assertEqual(self.boc[:4], bytes.fromhex("b5ee9c72"))
        self.assertEqual(len(self.cells), 34)
        self.assertEqual(self.roots, [0])

    def test_boc_round_trip_is_byte_exact(self):
        self.assertEqual(serialize_ton_boc(self.cells, self.roots), self.boc)

    def test_root_cell_is_a_transaction(self):
        # block.tlb: transaction$0111 account_addr:bits256 lt:uint64
        # prev_trans_hash:bits256 prev_trans_lt:uint64 now:uint32
        # outmsg_cnt:uint15 orig/end status (2 bits each), then fees.
        root = self.cells[0]
        self.assertEqual(len(root.refs), 3)
        self.assertEqual(root.bitlen, 724)
        reader2 = root.bit_reader()
        self.assertEqual(reader2.load_uint(4), 0b0111)
        acc_hash = reader2.load_uint(256)
        self.assertEqual("%064x" % acc_hash, TON_ACCOUNT_HASH)
        lt = reader2.load_uint(64)
        prev_hash = reader2.load_uint(256)
        prev_lt = reader2.load_uint(64)
        now = reader2.load_uint(32)
        self.assertEqual(lt, 42954571000001)
        self.assertEqual(prev_lt, 42686977000003)
        self.assertEqual(now, TON_UTIME)  # == toncenter JSON utime
        outmsg_cnt = reader2.load_uint(15)
        orig_status = reader2.load_uint(2)
        end_status = reader2.load_uint(2)
        self.assertEqual(outmsg_cnt, 1)
        self.assertEqual(orig_status, 0)   # nonexist
        self.assertEqual(end_status, 2)    # active
        grams_len = reader2.load_uint(4)
        grams = reader2.load_uint(grams_len * 8)
        other_empty = reader2.load_uint(1)
        self.assertEqual(grams, 13778071)
        self.assertEqual(other_empty, 0)
        self.assertEqual(reader2.pos, 724)
        self.assertEqual(reader2.remaining(), 0)


class TestTonAddress(unittest.TestCase):
    def test_friendly_forms_decode_to_same_account(self):
        for text, bounceable, testnet in (
                (TON_FRIENDLY_NON_BOUNCEABLE, False, False),
                (TON_FRIENDLY_BOUNCEABLE, True, False),
                (TON_FRIENDLY_BOUNCEABLE_TESTNET, True, True),
                (TON_FRIENDLY_NON_BOUNCEABLE_TESTNET, False, True)):
            decoded = ton_decode_friendly(text)
            self.assertEqual(decoded["bounceable"], bounceable, text)
            self.assertEqual(decoded["testnet"], testnet, text)
            self.assertEqual(decoded["workchain"], 0, text)
            self.assertEqual(decoded["hash"], TON_ACCOUNT_HASH, text)
            validate_ton_wallet_workchain(decoded)

    def test_friendly_encode_round_trip(self):
        self.assertEqual(ton_encode_friendly(0, TON_ACCOUNT_HASH, False, False),
                         TON_FRIENDLY_NON_BOUNCEABLE)
        self.assertEqual(ton_encode_friendly(0, TON_ACCOUNT_HASH, True, False),
                         TON_FRIENDLY_BOUNCEABLE)
        self.assertEqual(ton_encode_friendly(0, TON_ACCOUNT_HASH, True, True),
                         TON_FRIENDLY_BOUNCEABLE_TESTNET)
        self.assertEqual(ton_encode_friendly(0, TON_ACCOUNT_HASH, False, True),
                         TON_FRIENDLY_NON_BOUNCEABLE_TESTNET)

    def test_workchain_minus_one(self):
        raw = base64.urlsafe_b64decode(
            ton_encode_friendly(-1, TON_ACCOUNT_HASH, True, False))
        self.assertEqual(raw[1], 0xFF)
        self.assertEqual(ton_decode_friendly(
            ton_encode_friendly(-1, TON_ACCOUNT_HASH, True, False))["workchain"], -1)


class TestTonUnsignedConstruction(unittest.TestCase):
    def test_v4r2_body_round_trip(self):
        bits, bitlen = build_ton_v4r2_body(TON_WALLET_ID, 1893456000, 0, 0)
        self.assertEqual(bitlen, 640)
        self.assertEqual(len(bits), 80)
        fields = parse_ton_v4r2_body(bits, bitlen)
        self.assertEqual(fields["signature"], bytes(64))  # unsigned placeholder
        self.assertEqual(fields["wallet_id"], TON_WALLET_ID)
        self.assertEqual(fields["valid_until"], 1893456000)
        self.assertEqual(fields["seqno"], 0)
        self.assertEqual(fields["opcode"], 0)
        self.assertEqual(fields["extra_bits"], 0)

    def test_v4r2_body_validation_accepts(self):
        bits, bitlen = build_ton_v4r2_body(TON_WALLET_ID, 1893456000, 0, 0)
        fields = validate_ton_v4r2_body(bits, bitlen, TON_WALLET_ID, 0, TON_UTIME)
        self.assertEqual(fields["wallet_id"], TON_WALLET_ID)

    def test_v4r2_body_boc_round_trip(self):
        bits, bitlen = build_ton_v4r2_body(TON_WALLET_ID, 1893456000, 0, 0)
        cell = TonCell(bits, bitlen, [])
        boc = serialize_ton_boc([cell], [0])
        cells, roots = parse_ton_boc(boc)
        self.assertEqual(roots, [0])
        self.assertEqual(len(cells), 1)
        fields = parse_ton_v4r2_body(cells[0].bits, cells[0].bitlen)
        self.assertEqual(fields["wallet_id"], TON_WALLET_ID)
        self.assertEqual(fields["seqno"], 0)

    def test_v4r2_wallet_id_mismatch_rejected(self):
        bits, bitlen = build_ton_v4r2_body(0, 1893456000, 0, 0)
        with self.assertRaises(TxError):
            validate_ton_v4r2_body(bits, bitlen, TON_WALLET_ID, 0, TON_UTIME)

    def test_v4r2_expired_valid_until_rejected(self):
        bits, bitlen = build_ton_v4r2_body(TON_WALLET_ID, 1000000000, 0, 0)
        with self.assertRaises(TxError):
            validate_ton_v4r2_body(bits, bitlen, TON_WALLET_ID, 0, TON_UTIME)

    def test_v4r2_seqno_mismatch_rejected(self):
        bits, bitlen = build_ton_v4r2_body(TON_WALLET_ID, 1893456000, 1, 0)
        with self.assertRaises(TxError):
            validate_ton_v4r2_body(bits, bitlen, TON_WALLET_ID, 0, TON_UTIME)


class TestTonNegative(unittest.TestCase):
    def setUp(self):
        self.boc = base64.b64decode(TON_BOC_B64)

    def test_bad_magic(self):
        with self.assertRaises(TxError):
            parse_ton_boc(b"\x00\x00\x00\x00" + self.boc[4:])

    def test_crc_mismatch(self):
        bad = bytearray(self.boc)
        bad[100] ^= 0xFF
        with self.assertRaises(TxError):
            parse_ton_boc(bytes(bad))

    def test_truncated_boc(self):
        with self.assertRaises(TxError):
            parse_ton_boc(self.boc[:-10])

    def test_zero_cells_rejected(self):
        header = bytes.fromhex("b5ee9c72") + bytes([0x41, 0x01, 0x00, 0x01,
                                                    0x00, 0x00])
        with self.assertRaises(TxError):
            parse_ton_boc(header)

    def test_root_index_out_of_range(self):
        cell = TonCell(bytes(80), 640, [])
        boc = serialize_ton_boc([cell], [5])
        with self.assertRaises(TxError):
            parse_ton_boc(boc)

    def test_bad_address_tag(self):
        raw = bytearray(base64.urlsafe_b64decode(TON_FRIENDLY_BOUNCEABLE))
        raw[0] = 0x12
        raw[34:36] = crc16_xmodem(bytes(raw[:34])).to_bytes(2, "big")
        text = base64.urlsafe_b64encode(bytes(raw)).decode("ascii")
        with self.assertRaises(TxError):
            ton_decode_friendly(text)

    def test_bad_address_crc(self):
        bad = TON_FRIENDLY_BOUNCEABLE[:-1] + (
            "A" if TON_FRIENDLY_BOUNCEABLE[-1] != "A" else "B")
        with self.assertRaises(TxError):
            ton_decode_friendly(bad)

    def test_workchain_five_is_not_a_wallet_workchain(self):
        text = ton_encode_friendly(0, TON_ACCOUNT_HASH, True, False)
        raw = bytearray(base64.urlsafe_b64decode(text))
        raw[1] = 5
        raw[34:36] = crc16_xmodem(bytes(raw[:34])).to_bytes(2, "big")
        text5 = base64.urlsafe_b64encode(bytes(raw)).decode("ascii")
        decoded = ton_decode_friendly(text5)
        self.assertEqual(decoded["workchain"], 5)
        with self.assertRaises(TxError):
            validate_ton_wallet_workchain(decoded)

    def test_short_address_rejected(self):
        with self.assertRaises(TxError):
            ton_decode_friendly("UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3")


if __name__ == "__main__":
    unittest.main(verbosity=2)
