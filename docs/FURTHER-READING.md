## Further reading — by authority

Use **Canonical References** for links. The table below explains what each specification covers without repeating the URLs.

**Re-check current implementation behaviour before production releases.**

```text
Primary specifications → requirements, not implementation proof
Upstream references    → guidance, not Bawa guarantees
```

```text
Bawa code              → local evidence, once inspected
Community experience   → investigation leads, not guarantees
```

### Primary specifications

These specifications set the requirements. They do not prove that Bawa implements them, and this list does not assess Bawa’s conformance.

| Source | Safe use |
|---|---|
| BIP-32 | Defines hierarchical deterministic (HD) key derivation. |
| BIP-39 | Defines how to create mnemonic phrases and derive seeds from them. |
| BIP-43 | Defines the purpose field in HD wallet derivation paths. |
| BIP-44 | Defines the multi-account hierarchy for deterministic wallets. |
| BIP-84 | Defines key derivation for native SegWit accounts. |
| BIP-174 / PSBT | Defines the Partially Signed Bitcoin Transaction (PSBT) format; it does not establish Bawa support. |
| BIP-371 / Taproot PSBT | Defines Taproot extensions to PSBT; it does not establish Bawa support. |
| SLIP-0010 | Defines HD key derivation for supported elliptic curves. |
| SLIP-0044 | Lists registered coin types for wallet derivation paths. |
| SLIP-0132 | Registers version bytes for serialised extended keys. |
| TON TEP-3 | Sets out TON guidelines and standards. |
| Cardano CIP-1852 | Defines Cardano’s HD wallet derivation structure. |

### Upstream Wallet Core docs and ecosystem

Bawa’s `docs/REFERENCES.md` records these links. Upstream documentation is guidance, not a guarantee of Bawa’s behaviour or a substitute for checking its implementation.

| Source | Safe use |
|---|---|
| [Trust Wallet organisation](https://github.com/trustwallet) | Upstream project discovery, not compatibility proof. |
| [Wallet Core](https://github.com/trustwallet/wallet-core) | Upstream project reference. Inspect the relevant code before relying on implementation details, and check whether Bawa behaves the same way. |
| [Wallet Core Usage Guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) | Upstream usage guidance; check Bawa’s implementation before applying it. |
| [Wallet Core HDWallet API](https://trustwallet.github.io/docc/documentation/walletcore/hdwallet/) | Upstream API reference; verify the relevant behaviour in Bawa’s local code. |
| [Wallet Core registry fields](https://github.com/trustwallet/wallet-core/blob/master/docs/registry-fields.md) | Look up upstream registry-field definitions. Check Bawa’s handling of a field before relying on it. |
| [Wallet Core registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json) | Look up upstream registry data. Verify individual entries and Bawa’s handling before relying on them. |
| [Trust Wallet Assets](https://github.com/trustwallet/assets) | Asset-project reference, not signing authority. |
| [Assets repository overview](https://github.com/trustwallet/assets/blob/master/knowledge/architecture/repo-overview.md) | Overview of the Assets repository; use it for project context. |

### Bawa code and companion material

| Source | Safe use |
|---|---|
| Bawa code | Review the local repository’s `tools/`, `docs/` and `IMPLEMENTATION.md` at the revision you are using. Base implementation claims on code you have inspected. |
| Companion guides / `IMPLEMENTATION.md` | The companion material is this repository’s own `docs/` and `IMPLEMENTATION.md`, not a separate download. Check detailed implementation claims against the local code. |
| Bawa fixtures | Public-output comparison anchors only—not a derivation or signing recipe. |

### Community experience and independent verification

A public-output comparison is an independent check, not a community experience report.

| Source | Safe use |
|---|---|
| [bip_utils](https://github.com/ebellocchia/bip_utils) ([PyPI](https://pypi.org/project/bip-utils/)) | Bawa’s `test/differential_test.py` uses **bip_utils 2.12.2** as the independent reference for comparisons against Wallet Core. It compares public outputs only. Read that test for the comparison procedure. |
| Community reports | Bawa does not cite a community report or URL here, so these references do not support an experience-based recommendation. Treat reports you find as investigation leads only and verify their claims against Bawa’s local code. |

Differential verification uses **known public test material** and compares **public outputs**. Never put a real mnemonic, seed or xprv in CI.
