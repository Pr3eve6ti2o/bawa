# Mainnet capability and readiness gap assessment

- **Branch / tip assessed:** `feature/ai-wallet-builder` at `85b8d47` (merge commit, tree clean),
  working copy `/home/boxd/workspace/bawa-builder/bawa` on `muse-vm`.
- **Date:** 2026-11-14 (evidence dated 2026-11-09 – 2026-11-13, as cited per item).
- **Lane:** D5 (Bawa DX transformation re-dispatch), brief §6 + addendum §4 (mainnet-first).
- **Authorship:** drafted by gpt-6.1-sol (API 2, max reasoning; 3 calls, all landed) from
  first-hand evidence notes compiled by lane D5; every factual claim was verified by D5
  reading the code and vectors on the VM before inclusion. Two corrections were applied
  by D5 during assembly (see "Assembly notes").
- **Verdict: mainnet / production readiness is NOT PASS.** Nothing in this document
  authorises funding, sending, broadcasting, or real-funds use.

## How to read this document

- **Verified** means D5 read the code, vector, or test on the VM, or the cited lane
  evidence (T10/T30/T32/T33/T35, R08/E02) is recorded with a dated first-hand run.
- **Documented-only** means the guide or a procedure states it, but no executed
  verification at this tip is cited.
- **No tests were executed by this lane.** Test counts below are grep counts of
  `test(`/`it(` occurrences, i.e. inventory, not results. Recorded results cited
  (tools smoke 217 ok/0 fail at `e324130`, web vitest 144/144, T10 7/7 + 17/17)
  are historical results from the cited lanes, not re-runs at `85b8d47`.
- **Mainnet-first framing (owner correction, addendum §4):** the repo is primarily built
  for mainnet, NOT testnet. Testnet is a secondary/testing concern. No testnet code was
  deleted in this assessment; where testnet-only restrictions remain, they are listed
  in "Where testnet-only restrictions remain" so they can be reframed, not removed silently.
- **Scope:** native-asset transfers only (BTC, ETH, TRX, TON). No token (ERC-20/TRC-20),
  contract, or allowance support exists anywhere in the mainnet tools.

## Headline gaps (one line per chain)

- **BTC:** derivation independently verified and local signing implemented; live sending,
  broadcast, and change-output-spend rehearsal unexercised — NOT ready.
- **ETH:** derivation vectors present and EIP-1559 locally qualified; real-transfer gas
  and live sending unverified — NOT ready.
- **TRX:** derivation and signing fields verified; live transfer and real cost unverified,
  and the wallet-core public-key derive helper aborts the WASM runtime — NOT ready.
- **TON:** derivation verified; generation-only / receive-only by owner scope decision,
  signing never live-exercised, Android has no TON derivation at all — NOT ready.

## Register snapshot (§21, docs/mainnet/MAINNET-GUIDE.md)

46 rows (M-01 – M-46): **22 RESOLVED, 2 CLOSED, 22 OPEN.**

- CLOSED (owner, 2026-11-13): M-15, M-31 — review gate only; neither authorises
  funding, rehearsal, or any real-funds use.
- OPEN (22): M-03, M-05, M-06, M-09, M-11, M-14, M-17, M-20, M-22, M-23, M-25,
  M-26, M-27, M-28, M-29, M-30, M-32, M-35, M-36, M-37, M-39, M-43.
- Most blocking for mainnet use: M-35 (no live send/sign/broadcast exercised), M-32
  (borrowed testnet assurance), M-05/M-06 (web vault / Android send-sign gaps),
  M-09 (ETH real-transfer gas), M-03 (TON wallet-ID false metadata, Android),
  M-28 (RBF/CPFP/stuck-transaction procedures), M-29 (published fixtures active on
  mainnet), M-36/M-37 (undefined thresholds/durations).

## BTC — Bitcoin

### What exists in code

- **Engine:** Trust Wallet Core `4.9.3` is pinned. The `hdwallet-gen` WASM is **10,422,325 bytes**, SHA-256 `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`.
- **Derivation and network identity:** `derive.js` performs watch-only derivation from an account xpub, validated before WASM. BTC uses `m/84'/0'/0'/branch/i`, coin type `0`, mainnet Bech32 `bc1q` addresses, and `zpub`. Branch `1` is change, selected through `btc-change` mode with a stderr marker.
- **Unsigned transactions:** `buildBtcP2wpkhUnsignedTx` supports **P2WPKH only**, takes public inputs only, and uses a closed schema.
- **Local signing:** `signBtc` / `verifyBtc` in `tools/mainnet-signing/local-signing.mjs` use an own secp256k1 implementation, independent verification, and an 11-check fail-closed preflight. The signer emits transaction version `1`; fee calculation is `byteFee × estimated vsize`, with a **141 vB fixture**. The module has no network import.
- **Fee sources:** `getBtcFee` uses `mempool.space` and `blockstream.info`; disagreement fails closed.
- **Broadcast:** No broadcast path exists anywhere; stubs throw.

### Verified vs documented-only

- **Independently verified derivation:** The ripple-fixture vectors include:
  - Index `0`: `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - Index `1`: `bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za`
  - Change: `bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve`

  BIP-84 `abandon` anchors are also in the vectors. Independent reproduction dated **2026-11-12** reports byte-for-byte agreement between wallet-core `4.9.3` and Python `bip_utils 2.12.2`.
- **Resolved engineering rows:** **M-07** was resolved **2026-11-12**; the fee-model difference remains unexplained but is recorded as non-blocking. **M-41** address discovery is resolved with procedure, tools, and tests. Neither resolution establishes live sending.
- **Confirmation policy is decided, not live-verified:** **M-38** was resolved **2026-11-10** by owner decision. This establishes policy, **not live mainnet confirmation behavior**. Decided policy constants exist in `apps/android/app/src/main/java/com/bawa/wallet/core/DerivationPolicy.kt` (BTC 6 confirmations; ETH finalised plus a 12-block extra minimum), but no live confirmation on mainnet has been observed.
- **Implementation is not a mainnet rehearsal:** Builders, local signing, verification, and fee sourcing exist. **M-35** records that no live send/sign/broadcast has been exercised.

### Exact gaps

- **Index-2 coverage:** No test asserts BTC index-2 addresses.
- **M-27 — narrowed-open:** BTC change-policy documentation and tools are complete, but rehearsal evidence remains missing: **a BTC change-output spend**.
- **M-28 — OPEN:** RBF, CPFP, and stuck-transaction procedures are missing.
- **M-35 — live sending absent:** There is no usable broadcast path, and no live send/sign/broadcast evidence. **M-38** policy resolution does not close the live-confirmation evidence gap.

### Work required for full mainnet use

- Close the missing index-2 derivation assertion coverage.
- Complete and record the BTC change-output spend rehearsal required by **M-27**.
- Supply and rehearse the RBF/CPFP/stuck-transaction procedures required by **M-28**.
- Implement a usable broadcast path, replacing the throwing stubs, then record controlled mainnet signing, sending, broadcasting, and confirmation evidence for **M-35** under the owner-decided **M-38** policy.

Verdict: derivation independently verified, local signing implemented, live sending unexercised — NOT ready.

## ETH — Ethereum

### What exists in code

- **Derivation and network identity:** `derive.js` uses `m/44'/60'/0'/branch/i`, coin type `60`, and checksummed `0x` addresses. Ethereum mainnet identity requires chain ID **`1` / `0x1`**.
- **Unsigned transactions:** `buildEthLegacyUnsignedTx` and `buildEth1559UnsignedTx` exist. The EIP-1559 path uses chain ID `1` and `txMode: Enveloped`.
- **Local signing:** `signEth` / `verifyEth` exist, including a chain-ID preflight guard.
- **Fee sources:** `getEthFee` uses `eth_feeHistory` on `ethereum-rpc.publicnode.com` and `cloudflare-eth.com`, with a **1% base-fee cross-check tolerance**. Supplied endpoint observations are dated **2026-11-09**; the chain-ID requirement is `0x1`.
- **Scope:** Only native ETH transfers are supported. There is no token or contract support anywhere.
- **Broadcast:** The repository-wide evidence states that no broadcast path exists and stubs throw.

### Verified vs documented-only

- **Recorded derivation vectors:**
  - Index `0`: `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`
  - Index `1`: `0xD6c3112a8Db4991a7359018F15e501dfEE316d59`
  - Hardhat anchor: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

  The ripple-set ETH addresses were reproduced byte-for-byte by both wallet-core `4.9.3` and Python `bip_utils 2.12.2` in the 2026-11-12 independent reproduction recorded in `docs/mainnet/MAINNET-VECTORS.md`.
- **Verified local EIP-1559 qualification:** **T10 passed 17/17 independent Python checks**, covering the `0x02` envelope, 12 RLP fields, chain ID `1`, nonce `0`, gas `21000`, 20/2 gwei fees, low-s, and sender recovery. This qualifies the supplied transaction/signature fixture—not real-transfer gas or a mainnet send. No separate legacy qualification result is supplied.
- **Verified wrong-chain rejection:** **T6** supplies approval chain ID `1` against signed chain ID `11155111`; preflight check `2` rejects Sepolia.
- **Confirmation remains policy/evidence limited:** The supplied **M-38** resolution is an owner policy decision dated **2026-11-10**, not live-mainnet confirmation evidence. No ETH-specific live confirmations are supplied.

### Exact gaps

- **M-09 — OPEN:** Real-transfer gas is unverified. The two fee RPCs may share one upstream, so source independence is **not established**; two endpoints and a 1% comparison do not prove independence.
- **M-35 — live sending absent:** No live send/sign/broadcast has been exercised, and the repository has no usable broadcast path.
- **Confirmation evidence:** ETH-specific thresholds and live confirmation handling are not established by the supplied evidence. **M-38** cannot be treated as a live-confirmation result.
- **Support boundary:** Tokens and contracts are absent, not merely untested. The supplied independent transaction qualification covers EIP-1559, not a blanket qualification of every implemented transaction mode.

### Work required for full mainnet use

- Close **M-09** with real native-ETH transfer gas evidence and an established independence basis for the fee sources, or an explicit treatment of their possible shared-upstream risk.
- Implement a usable broadcast path and record controlled mainnet signing, sending, and broadcasting evidence for **M-35**, preserving the `0x1` identity requirement and wrong-chain rejection.
- Record the applicable ETH confirmation thresholds and demonstrate confirmation handling on mainnet; the **M-38** owner decision alone is insufficient.
- Obtain qualification evidence for any legacy mode included in the mainnet-use claim, and keep that claim explicitly scoped to native ETH rather than tokens or contracts.

Verdict: derivation vectors present and EIP-1559 locally qualified, real gas and live sending unverified — NOT ready.

## TRX — TRON

### What exists in code

- **Engine:** Trust Wallet Core **4.9.3**, pinned.
- **Derivation:** `derive.js` uses `m/44'/195'/0'/branch/i`, coin type **195**, producing **T-prefix Base58Check** addresses.
- **Transactions:** `buildTronMainnetUnsignedTransfer` builds native-TRX `TransferContract` transactions only. There are **no TRC-20 or contract builders**.
- **Signing:** `signTron` exists. It derives TRON addresses manually using **keccak256 + Base58Check** because of the wallet-core public-key helper failure described below.
- **Fees:** `getTronFee` uses TronGrid `triggerconstantcontract` dry-run only. It **never calls `estimateenergy`**, which is unsupported on TronGrid. **M-44 settled** the energy rate at **100 SUN/unit = 0.0001 TRX/unit**. `fee_limit` is a **caller-supplied cap**, not a computed fee.
- **Network identity:** TRON addresses have no mainnet/testnet tag: mainnet, Shasta and Nile share prefix **`0x41`**. Network selection comes from the configured endpoint; the mainnet endpoint is **`api.trongrid.io`**. The web engine rejects legacy testnet prefix **`0xa0`**. Supplied observations are dated **2026-11-09**.

### Verified vs documented-only

- **Derivation verified:** the ripple-fixture vectors agree with independent reproduction using wallet-core and Python **`bip_utils 2.12.2`**:
  - Index 0: `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`
  - Index 1: `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B`
- **Failure verified first-hand:** `CoinTypeExt.deriveAddressFromPublicKey(tron, pubkey)` **aborts the WASM runtime** when `pubkey` comes from `getKey().getPublicKeySecp256k1()`. Supported routes are **`getAddressForCoin` for index 0** and **`derive.js` from an xpub**.
- **Signing verified at field level only:** `signTron` recomputes `ref_block_hash` using bytes **8–15** of the SHA-256 hash of the `BlockHeader` protobuf. Consequently, signed `raw_data` and `txID` **differ from the T33 unsigned artifact**; verification is not byte-identical. Wallet-core's TRON `SigningInput.transaction` is a **flat message**, not the blockchain `Transaction` message.
- **Dry-run evidence is not transfer evidence:** M-08's dry-run branch is met, but the supplied evidence does not establish a completed live transfer or its real cost. The TronScan approval route remains documented-only and unverified.

### Exact gaps

- **M-08 — resolved:** resolution covers the dry-run branch; **real-transfer cost still needs rehearsal**. M-44's settled energy rate does not establish that cost or compute `fee_limit`.
- **M-11 — OPEN:** TRON approval mechanics differ from EVM revocation. The **TronScan Approval-tab route remains unverified**.
- The aborting public-key helper is unusable through the stated secp256k1 route. Supported address routes and the manual signing derivation are workarounds, not evidence that the helper is fixed.
- Transaction construction remains **native-TRX only**. No TRC-20/contract sending capability is supplied.

### Work required for full mainnet use

- Rehearse a native-TRX transfer on the configured mainnet endpoint, verifying signed fields, the resulting `txID` and actual transfer cost. Do not require byte equality with T33 or treat `fee_limit` as an estimate.
- Keep execution on the supported address routes and manual signing derivation; guard against the known runtime-aborting helper call.
- Verify the TRON-specific approval procedure and close M-11. Add TRC-20/contract builders if full use is intended to include those operations.

Verdict: derivation and signing fields verified; live transfer and cost unverified — NOT ready for full mainnet use.

## TON — The Open Network

### What exists in code

- **Engine:** Trust Wallet Core **4.9.3**, pinned.
- **Status: GENERATION-ONLY / RECEIVE-ONLY.** The guide says TON is **receivable, not sendable**. There is **no TON send procedure and no broadcast path**.
- **Derivation:** coin type **607**, key path `m/44'/607'/0'`. The path is fully hardened, so **no xpub exists**. `derive-ton.js` constructs a **single address** from a **64-hex Ed25519 public key**.
- **Wallet parameters:** **V4 R2**, wallet ID **698983191 (`0x29A9A317`, V4 default)**, workchain **0**. Address encodings/forms for the fixture are:
  - Non-bounceable: `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`
  - Bounceable: `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi`
  - Raw: `0:bb819bc6...`
- **Network identity checks:** the web engine rejects testnet-flagged TON addresses **`0x91`** as wrong-network and accepts only workchains **`0x00` / `0xff`**. The fixture uses workchain 0.
- **Transaction/signing code:** `buildTonV4R2UnsignedTransfer` exists in `tools/mainnet-tx/unsigned-tx.mjs`; `signTon` exists in `local-signing.mjs`, with Ed25519 verification and its own BOC parsing. Their presence **does not make TON sendable in the repo**.
- **Fees:** `getTonFee` uses **`toncenter.com/api/v2/estimateFee`**. There is **no TON send fee section**.

### Verified vs documented-only

- **Derivation verified:** wallet-core **4.9.3**, Python `bip_utils` SLIP-0010 public-key derivation and **`@ton/ton 15.4.0`** agree. `@ton/ton` is cross-check evidence, **not a repo dependency**. `generate.js` includes a **`vec_ton` regression check**.
- **Wallet-ID mismatch established:** wallet-ID **0** drafts produce a different address and are wrong for this fixture.
- **Signing is code-local, not live-network verified:** `signTon` has **never been exercised against a live network**. Documented quirks are the namespace **`TW.TheOpenNetwork.Proto`, not `TW.TON.Proto`**; wallet-core never setting **`d1` bit 3**; and the **all-zero destination quirk**.
- Receive-only scope and confirmation criteria are documented decisions, not demonstrated send or receipt outcomes. No successful live receipt result is supplied here.

### Exact gaps

- **M-03 — OPEN, headline defect:** the Android draft contains false TON wallet-ID metadata. The **Android starter has no TON derivation at all**; this is not merely an incorrect ID in an implemented derivation.
- **M-24 — resolved 2026-11-10 by owner scope decision:** TON is **receivable, not sendable**. Resolution does not establish sending capability.
- **M-35:** the rehearsal covers TON as **RECEIVE-ONLY**, with **0.05 nominal**. That scope is not evidence of a completed receipt.
- **M-13 — resolved:** the threshold is **one masterchain seqno after inclusion plus an outgoing-message outcome check**. This defines the criterion; it does not demonstrate a live confirmation flow.
- **M-39 — OPEN:** end-to-end external withdrawal compatibility remains unconfirmed. **`@ton/ton` is the documented expert-assisted route**, not a demonstrated compatibility result.
- Full sending remains absent despite local unsigned-builder and signer code: no live signing exercise, broadcast path, send procedure or send fee documentation exists.

### Work required for full mainnet use

- Correct the Android wallet-ID metadata and supply the missing TON derivation if Android is to support TON.
- Establish receive-only rehearsal evidence under M-35 and confirm external withdrawal compatibility to close M-39, using the documented expert-assisted route.
- If TON sending is required, first change the owner-approved receive-only scope. Then integrate and live-exercise the existing builder/signer, address the documented signing quirks, provide a broadcast path and send/fee procedure, and verify outcomes against M-13's criterion.

Verdict: derivation verified; generation-only/receive-only by scope, signing never live-exercised — NOT ready for full mainnet use.

## Transaction signing and broadcast state

`tools/mainnet-signing/local-signing.mjs` provides local BTC/ETH/TRX/TON signing, independent verification and an 11-check fail-closed preflight. T10 asserts that it has no network import. This is separate from `tools/mainnet-tx/unsigned-tx.mjs`, where `broadcastTransaction`, `sendTransaction`, `transferToken`, `callContract`, `approveAllowance` and `signTransaction` all throw `Disabled operation: offline unsigned native transactions only.`

Sending/broadcasting is disabled in the current tool surface, and **no broadcast code exists anywhere in the mainnet tools**. M-35 remains OPEN: no live send/sign/broadcast has been exercised on any network. Scope is native-asset transfers only—not ERC-20/TRC-20 tokens, contracts or allowances—and the tools provide no live balance/history check.

A first broadcast would still need a separately approved broadcast capability, successful fail-closed preflight, a recorded dry-run, the applicable §17 clearances, an accepted M-35 procedure, funding and separate explicit execution approval. The draft's BTC 0.0002, ETH 0.001, TRX 1 and TON 0.05 receive-only amounts were approved **FOR REVIEW ONLY** on 2026-11-10; its boundary is four moves, then STOP. The separately recorded 2026-11-13 owner decision declined funding, retired the rehearsal addresses and destroyed the isolated credentials. M-35 still lists funding as pending (the doc has not been updated to record the decline). There is therefore no currently authorised rehearsal setup; reopening execution requires a new explicit funding decision and approved setup, not reuse of the retired one.

## Fees, guards, and engine

**Fees:** `tools/mainnet-fees/fees.mjs` uses BigInt only, injected fetch and 60/15/30-second TTLs. BTC uses dual-source fail-closed estimation; ETH cross-checks base fees across two RPCs, but real-transfer gas remains unverified under M-09. TRON provides dry-run energy estimation: M-08 is resolved, but real cost still requires rehearsal. TON uses toncenter `estimateFee`. M-14 remains OPEN because fee figures are dated baselines by design. These estimates do not constitute demonstrated live-transfer costs.

**Guards:** `tools/mainnet-guards/mainnet-guards.mjs` provides redaction, a read-only allowlist—with local signing permitted only using temporary unfunded credentials—and three-pass credential destruction plus `verifyNoCopies`. That allowance does not authorise funded sends. Its limitations remain material: bare 64-hex secrets are never redacted, bare mnemonics are not pattern-matched, and SSD erasure cannot be certified. Destruction and copy-verification measures must not be presented as guarantees beyond those limits.

**Engine:** The wallet-core pin is **4.9.3** (both `tools/hdwallet-gen/package.json` and `apps/web/package.json`). The `hdwallet-gen` WASM identity is SHA-256 `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`, size 10,422,325 bytes, matching the R08 record (verified first-hand by D5). `apps/web/public/wallet-core.wasm` is a different artifact: SHA-256 `c202624dc95475d3d309a28d99e286875066ed20fd7adc81c28de38dc721e09f`, size 10,386,536 bytes. The R08 match establishes the recorded artifact identity, not equivalence with the web bundle. Web WASM parity qualification remains OPEN under OI-092; neither parity nor a web-version conclusion can be inferred from the supplied evidence.

## Where testnet-only restrictions remain

- **`ai/`:** `ai/request-routing.md` says, "Testnet is the default throughout. Mainnet without separate approval must be refused." All seven `ai/profiles` say, "Testnet is the default; mainnet is out of scope by default."
- **Web:** Network selection defaults to testnet4/Sepolia/Nile and states, "Testnet only, by repository policy." The welcome screen says, "Testnet by default; mainnet is out of scope." Nevertheless, the web engine rejects testnet addresses as wrong-network and accepts mainnet destinations only.
- **Android:** `DerivationPolicy.kt` defines `TESTNETS` as testnet4/Sepolia/Nile and says mainnet is out of scope by default. `ENGINE_BINDING_AVAILABLE=false`; the supplied evidence reports no Trust Wallet Core AAR for any version, leaving on-device derivation OPEN. TON is unsupported by the starter.

The central split is **app/policy testnet-default versus core mainnet by construction**: `derive.js` and the other core tools contain zero testnet code and derive mainnet addresses. Document and reframe capability, defaults and approval boundaries separately. Do not delete testnet code or imply that mainnet derivation overrides policy restrictions.

## Mainnet-first intent vs actual state

The mainnet-first intent is native-mainnet operation with an explicit approval boundary, not automatic production authorisation. The repository already has mainnet-by-construction derivation, a mainnet-destination web engine, offline unsigned transaction construction and local signing. It does not have a broadcast implementation, an authorised funded rehearsal, completed clearance checks or consistent app/policy framing; web engine parity and Android on-device derivation also remain unqualified. The single biggest gap is the structural mismatch between the mainnet core and testnet-default app/policy layer. M-32 identifies the resulting danger: borrowing testnet assurance for a mainnet operating path that has not itself been qualified.

## Verdict

**Mainnet/production readiness is NOT PASS** for feature-branch tip `85b8d47` on the supplied evidence. `MAINNET-GUIDE.md` §21 records 22 RESOLVED, two CLOSED and 22 OPEN rows. M-15 and M-31 were closed by the owner on 2026-11-13 for the review gate only; those closures do **not** authorise funding or rehearsal.

The following gates must clear first:

- **M-35:** Accept the procedure, reconcile the draft with the declined-funding decision, and obtain any new funding decision plus separate explicit execution approval before an authorised four-move/STOP rehearsal.
- **§17:** Rung 1 testnet execution remains FAIL until executed; independent security review is required before rung 3; rung 5 normal use is Not cleared. All clearance checks remain unperformed.
- **M-32:** Resolve the scope/assurance split without substituting testnet evidence for mainnet qualification.
- **M-05/M-06:** Establish and satisfy the referenced gate criteria with recorded clearance evidence. Their definitions and completion evidence are not supplied here.

Grepped test counts are inventory, not executed results. The cited smoke, web vitest and T10 outcomes were not re-run here and do not establish live-network clearance at this tip.

## Prioritised work required

1. Correct the stale rehearsal document to record declined funding, retired addresses and destroyed credentials; accept the procedure and obtain new explicit funding/execution decisions before reopening execution (M-35).
2. Establish the M-05/M-06 criteria and clearance evidence; execute §17 rung 1, complete independent review before rung 3, and leave rung 5 uncleared until its gates are satisfied (M-05/M-06; §17).
3. Document/reframe core-mainnet capability, app testnet defaults and approval policy; require mainnet-specific assurance while retaining testnet support (M-32).
4. Supply and qualify a separately approved native-only broadcast capability, preserving offline defaults and requiring preflight/dry-run before the gated four-move/STOP rehearsal (M-35).
5. Complete the open web WASM parity run and record the distinct artifacts' identities against the wallet-core pin and R08 evidence (OI-092; R08).
6. Document and mitigate bare-hex/mnemonic exposure, retain destruction and copy-verification evidence, and state the non-certifiable SSD-erasure limit.
7. Separate active published mainnet fixtures from rehearsal inputs and define an approved live balance/history verification process, which the tools currently lack (M-29).
8. Measure ETH native-transfer gas and TRON real costs only in an authorised rehearsal, and refresh dated fee evidence without treating estimates as demonstrated costs (M-09, M-14; M-08 remains resolved).
9. Resolve Android's engine-binding/on-device-derivation gap or explicitly exclude it from cleared scope; document the starter's unsupported TON capability.
10. Define the "larger amounts" threshold and approval-validity duration before expanded use or reliance on continuing approvals (M-36/M-37).
11. Execute and record the existing tool and web tests at `85b8d47`, distinguishing current-tip results from historical results, grep counts and live rehearsal evidence.

## Sources read first-hand on the VM (D5)

- `tools/hdwallet-gen/derive.js`, `derive-ton.js`, `generate.js`, `extended-key.js`,
  `compare.js`, `package.json` (pin 4.9.3); WASM sha256 verified by `sha256sum`.
- `tools/mainnet-signing/local-signing.mjs`, `tools/mainnet-tx/unsigned-tx.mjs`,
  `tools/mainnet-fees/fees.mjs`, `tools/mainnet-guards/mainnet-guards.mjs`.
- `docs/mainnet/MAINNET-VECTORS.md`, `MAINNET-GUIDE.md` (§§11, 13, 17, 21),
  `MAINNET-SIGNING.md`, `MAINNET-UNSIGNED-TX.md`, `MAINNET-GUARDS.md`,
  `M35-REHEARSAL-PROCEDURE.md`.
- `apps/web/src/screens/network-selection.tsx`, `welcome.tsx`, `src/engine/destination.ts`,
  `src/engine/boundary.ts`, `apps/web/README.md`, `apps/web/package.json`;
  `apps/android/.../DerivationPolicy.kt`.
- `ai/request-routing.md` and all seven `ai/profiles/*.md` (testnet-default wording).
- Test inventory: `tests/mainnet-signing.test.mjs`, `mainnet-unsigned-tx.test.mjs`,
  `mainnet-fees.test.mjs`, `mainnet-guards.test.mjs`, `mainnet-derivation-vectors.test.mjs`.

## Assembly notes (D5 corrections to the Sol drafts)

1. ETH derivation: the Sol draft said no independent ETH derivation reproduction was
   stated. Corrected — `MAINNET-VECTORS.md`'s independent-reproduction table records the
   same ripple set (including both ETH addresses) reproduced by wallet-core 4.9.3 and
   Python `bip_utils` 2.12.2; D5 read the table first-hand.
2. M-38: added that decided policy constants exist in Android `DerivationPolicy.kt`
   (BTC 6 confirmations; ETH finalised + 12 extra minimum). This is decided policy,
   not live confirmation — the verdict is unchanged.
3. M-35 wording softened from "incorrectly lists" to "lists funding as pending (the doc
   has not been updated to record the decline)": the decline is recorded in the owner's
   2026-11-13 decision, not in the repo doc; the drift itself is the gap.
4. No other Sol claim was altered. Every address, hash, path, coin type, chain ID,
   register status, and file/line reference above was checked against D5's first-hand
   reads (lane file `D5-EVIDENCE-NOTES.md`).
