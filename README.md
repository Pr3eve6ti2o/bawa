# Bawa — HD Wallet Generator

A production-grade hierarchical deterministic (HD) wallet generator built on Trust Wallet's `wallet-core` WebAssembly engine. It creates a single 24-word BIP39 wallet and exports extended public keys for deriving unlimited per-order deposit addresses — without ever exposing private key material to the systems that derive addresses.

Designed for self-custody payment infrastructure: the seed is encrypted in-process at creation, shown once on the operator's terminal, and never touches logs, pipes, or disk in plaintext.

---

## How it works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  generate.js    │     │  seed.enc.json   │     │ derive_daemon   │
│  (one-time)     │────▶│  (AES-256-GCM,   │     │ (persistent)    │
│  wallet-core    │     │   0600)          │     │ xpub → address  │
│  test vectors → │     └──────────────────┘     │ JSON-line proto │
│  24-word wallet │                              └─────────────────┘
│  → xpubs        │                                        │
└─────────────────┘                                        ▼
        │                                          deposit address
        │                                          per order index
        ▼
   .env: XPUB_BTC / XPUB_ETH / XPUB_TRX / TON_DEPOSIT_ADDRESS
```

**Two-phase design:**

1. **Generation (once, interactive):** `generate.js` validates the engine against official test vectors, creates a fresh 256-bit wallet, encrypts the mnemonic in-process, and exports only public material.
2. **Derivation (continuous, automated):** `derive_daemon.js` loads the WASM engine once and derives deposit addresses from extended *public* keys over a JSON-line protocol. Private keys never enter this process.

---

## Supported chains

| Chain | Extended key | Derivation path | Address format |
|-------|-------------|-----------------|----------------|
| Bitcoin | `zpub` (BIP84) | `m/84'/0'/0'/0/{index}` | Native SegWit (`bc1q…`) |
| Ethereum | `xpub` (BIP44) | `m/44'/60'/0'/0/{index}` | `0x…` (EIP-55) |
| TRON | `xpub` (BIP44) | `m/44'/195'/0'/0/{index}` | Base58 (`T…`) |
| TON | single address | `m/44'/607'/0'/0/0` | `UQ…` (bounceable) |

Coin type IDs follow SLIP-0044: BTC = 0, ETH = 60, TRX = 195, TON = 607.

Index 0 is reserved; deposit derivation starts at index 1. The derivation index is capped at 2³¹ − 1 (2,147,483,647) — anything at or above 2³¹ would set the BIP32 hardened bit and derive from an entirely different keychain, making funds unrecoverable via the xpub.

---

## Security model

### Generation-time guarantees

- **Test vectors first.** Before any key material is created, the engine must reproduce the official wallet-core vectors (BTC `bc1qpsp72…`, ETH `0xA3Dcd8…` from the standard test mnemonic). If the engine is wrong, nothing is generated.
- **256-bit entropy.** `HDWallet.create(256, "")` — 24 words, empty passphrase, validated with `Mnemonic.isValid`.
- **Cross-verification.** Every exported xpub is round-tripped: derive index-0 address from the xpub and compare against the wallet's own default address. Mismatch aborts.
- **Interactive-only.** The generator refuses to run without a controlling terminal (`/dev/tty` is opened *before* any key material exists). Non-interactive environments get a hard exit — no orphaned seeds.

### Seed handling

- **In-process encryption.** The mnemonic is encrypted with AES-256-GCM (random 256-bit data key, 96-bit nonce, `nova-shop-seed-v1` as additional authenticated data) *inside the generator process*. It never passes through stdout, pipes, or subprocess boundaries.
- **Terminal-only display.** The seed phrase and data key are written directly to `/dev/tty`, bypassing all pipes and logs. stdout carries public material only.
- **Operator confirmation.** The encrypted bundle is written only after the operator types the first seed word *and* confirms the data key is saved. If confirmation fails, nothing is written — no undecryptable orphan files.
- **Atomic restricted writes.** The bundle is written to a temp file created with mode `0600`, fsynced, then renamed. The secrets directory is enforced to `0700`. No window exists where ciphertext is world-readable.

### Derivation-time guarantees

- **Public keys only.** The daemon accepts extended *public* keys exclusively. Extended *private* keys are rejected by version bytes (`xprv`, `yprv`, `zprv`, `tprv`, and variants) before reaching the engine — not by string matching, which is bypassable.
- **No argv exposure.** The xpub travels in the request body over stdin, never in process arguments (which are visible in `/proc/<pid>/cmdline` to all local users).
- **Hardened-path rejection.** Derivation paths are constructed server-side from an allowlist (`btc` / `eth` / `trx`); callers supply only the chain name and index. Arbitrary paths are impossible.
- **Prototype-pollution resistance.** Lookup tables use null-prototype objects, so keys like `__proto__` or `toString` can't pass the chain check and crash the daemon.
- **Input bounds.** Requests are length-capped (4 KB lines, 200-char xpubs); indices must be non-negative integers within the BIP32 non-hardened range.

---

## Components

| File | Role |
|------|------|
| `generate.js` | One-time wallet creation: vectors → 24-word wallet → encrypted seed + xpubs |
| `derive_daemon.js` | Persistent derivation engine (JSON-line protocol over stdin/stdout) |
| `derive.js` | One-shot derivation (xpub + index → address); used for verification |
| `make_wallet.py` | Orchestrator: runs the generator, cross-verifies with application code, writes `.env`, backs up the encrypted bundle |
| `decrypt_seed.py` | Seed recovery from `seed.enc.json` + data key |
| `compare.js` | Independent cross-verification of derived addresses |

### Derivation daemon protocol

The daemon loads the wallet-core WASM engine once per process lifetime, then serves requests:

```
→ {"chain":"btc","xpub":"zpub…","index":5}
← {"ok":true,"address":"bc1q…"}
← {"ok":false,"error":"…"}
```

On startup it prints `{"ready":true}` when the engine is loaded. This replaces per-request process spawning (~700 ms cold start) with sub-10 ms derivations — roughly an 85× latency reduction at checkout scale.

---

## Usage

### Prerequisites

- Node.js ≥ 22
- `@trustwallet/wallet-core` (installed via npm)

```bash
npm install
```

### 1. Generate a wallet (interactive — run on a trusted machine)

```bash
node generate.js
```

You will see the 24-word seed phrase and a 64-character data key on your terminal. **Write the seed down offline. Store the data key in a password manager.** The generator asks you to confirm both before writing anything to disk.

Output (stdout, public material only):

```json
{
  "btc_zpub": "zpub…",
  "eth_xpub": "xpub…",
  "trx_xpub": "xpub…",
  "ton_address": "UQ…",
  "seed_encrypted_to": "/path/to/secrets/seed.enc.json"
}
```

Add the xpubs to your application's environment:

```bash
XPUB_BTC=zpub…
XPUB_ETH=xpub…
XPUB_TRX=xpub…
TON_DEPOSIT_ADDRESS=UQ…
```

To replace an existing wallet, pass `--force` (a timestamped backup of the old bundle is written first).

### 2. Derive deposit addresses

Start the daemon once:

```bash
node derive_daemon.js
# {"ready":true}
```

Then send one JSON object per line on stdin. Each order gets the next index from your application's atomic counter — never reuse an index across orders.

```bash
echo '{"chain":"eth","xpub":"xpub…","index":42}' | node derive_daemon.js
```

### 3. Recover the seed (disaster recovery)

```bash
python3 decrypt_seed.py /path/to/seed.enc.json
# Enter the 64-character data key when prompted
```

The decrypted mnemonic is printed once. Move it offline immediately.

---

## Backup strategy

A wallet is recoverable from **either**:

1. The 24-word seed phrase (written down at generation), **or**
2. `seed.enc.json` **plus** the data key (neither alone is sufficient)

Best practice: store the seed phrase on paper in one physical location, and the encrypted bundle + data key in two separate digital locations. Test recovery with `decrypt_seed.py` before funding the wallet.

---

## Threat model

| Threat | Mitigation |
|--------|-----------|
| Compromised derivation server | Only xpubs are present — addresses are enumerable but funds can't move |
| Log scraping / pipe snooping | Seed never enters stdout, pipes, or logs; tty-only display |
| Crash dump analysis | Mnemonic is memzeroed in the WASM heap after use; encryption is in-process |
| Malicious derivation index | Capped at 2³¹ − 1; paths built server-side from allowlist |
| Private key smuggled to daemon | Rejected by version bytes before reaching the engine |
| Partial-file reads during write | Atomic rename; temp file born `0600` |
| Silent engine regression | Official test vectors validated on every generation run |

**Known limitations:** process memory and OS crash dumps can theoretically capture secrets during the brief generation window — run generation on a trusted, single-operator machine. The data key is shown once and never stored; losing both the seed phrase and the data key means permanent loss of funds.

---

## Verification

Every generation run performs 20 self-checks:

- Coin type IDs match SLIP-0044 (TRX = 195, TON = 607)
- Official test vectors reproduce exactly (BTC, ETH)
- Extended-key roundtrips: xpub-derived index-0 address equals the wallet's default address on all three chains
- Key prefixes correct (`zpub` for BTC, `xpub` for ETH/TRX)
- Fresh wallet: 24 valid BIP39 words, all four chain addresses validate

If any check fails, the process aborts before writing anything.

---

## License

MIT
