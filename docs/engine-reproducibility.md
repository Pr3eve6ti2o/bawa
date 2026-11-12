# Engine reproducibility

- **Repository:** `Pr3eve6ti2o/bawa`
- **Source baseline:** `51c7e39`; Phase 3 complete.
- **Evidence date:** 2026-11-10 (baseline); 4.9.1 qualification 2026-11-12 (T20).
- **Recorded H7 results:** suite **92/92**, differential test **PASS**, fixtures **exact**.
- **Recorded T20 results (2026-11-12):** differential run of 4.9.1 against 4.8.4 — tools smoke 130 ok / 0 fail on both; 9 derive + 9 compare addresses identical; TON fixture PASS; EIP-1559 chainId 1 local sign PASS with byte-identical signed bytes and independent sender recovery 12/12; web vitest 28/28, tsc + build exit 0 on both; mainnet endpoints eth_chainId 0x1 on two public RPCs (read-only).

Version checks and environment observations below were recorded first-hand on 2026-11-10. Historical guide and Android-draft evidence is identified separately; citing it does not imply a re-test. **PROPOSED** and **OPEN** items are not validated toolchain choices.

## 1. Engine decision

**DECISION (proposed, T20 2026-11-12) — UPGRADE the tool pin to Trust Wallet Core 4.9.1, subject to owner approval.**

This replaces the Phase 4 resolution against **Doc 4, M-21** (stay on 4.8.4) on the strength of the T20 qualification run recorded below. Merging this change is the approval; until then 4.8.4 remains the selected tool pin.

- **4.8.4 — previously selected and verified; superseded as the active pin.** It was pinned in `tools/hdwallet-gen/package.json` and `tools/hdwallet-gen/package-lock.json`. The supporting H7 evidence is the 92/92 suite result, a passing differential test and exact fixtures.
- **4.9.1 — selected (proposed upgrade, T20 2026-11-12).** Installed and tested in scratch copies against 4.8.4: tools smoke 130 ok / 0 fail on both versions, exact fixtures, TON fixture PASS, EIP-1559 chainId 1 local sign PASS with byte-identical signed bytes and independent sender recovery, web vitest 28/28 with tsc + build exit 0 on both. No regressions found; the only measured differences are WASM +33,286 bytes and bundle +14.87 kB. The 4.9.1 / 4.9.2 npm packages are byte-identical except the version field, so D21/D30/D31 evidence on 4.9.2 applies at the artifact level.
- **4.9.2 — guides’ reference engine only.** It is a prerelease per **Doc 4, M-21**, referenced at tag `17e3cd4`, dated 2026-11-06. Signing demos D21/D31 were recorded on it. In-browser send, sign and broadcast were never exercised. It is not this tool’s pin.
- **4.8.5, 4.8.6, 4.8.7 and 4.9.0** also exist on npm, verified on 2026-11-10. None was evaluated or selected.

Neither 4.9.1 nor 4.9.2 carries an Android AAR (**Doc 4, M-21**). Changing the npm engine version would not, by itself, settle Android integration.

### Upgrade gate

An upgrade requires a **separate decision**, followed by an intentional update of the tool manifest and lockfile. Re-run and record:

1. Installation from the updated lockfile.
2. `npm run check` and the complete test suite.
3. The Python differential test.
4. Exact comparison against the existing fixtures.

Do not regenerate fixtures merely to make a changed engine pass. Any intended derivation or fixture-contract change requires its own decision. Upgrade evidence was recorded by T20 on 2026-11-12 (see §1); acceptance is the owner's decision, expressed by merging this change.

## 2. Pinned toolchain

The table distinguishes declared constraints, checked-in pins and observed runtimes. An observation is not automatically a project pin.

| Component | Pin or recorded value | Where the pin lives / evidence | Status |
|---|---|---|---|
| Trust Wallet Core, generator | **4.9.1** (proposed; was 4.8.4) | `tools/hdwallet-gen/package.json` and `tools/hdwallet-gen/package-lock.json` | verified (T20 qualification 2026-11-12) |
| Node.js requirement | `>=22 <23`; CI uses Node 22 | Recorded runtime policy; CI Node selection | verified |
| Node.js on this VM | `v24.22.2` | VM observation; not the declared project range | observed — deviation |
| Python requirement | `>=3.11`; CI uses 3.13 | Recorded runtime policy; CI Python selection | verified |
| Python on this VM | `3.12.3` | VM observation | observed |
| npm on this VM | `11.19.1` | VM observation; not a separate CI pin | observed |
| npm in CI | Whatever ships with Node 22; no separate npm pin | CI Node installation | verified — unpinned separately |
| `cryptography` | `==50.0.2` | `requirements.txt` | verified |
| `bip-utils` | `==2.12.2` | `requirements.txt` | verified |
| `@ton/ton` cross-check | No numerical version asserted here; derivation cross-check only | M-39 T1 | verified — narrowly scoped |
| Gradle | `8.9`, in the Android draft only | Android draft’s `gradle-wrapper.properties` | verified — draft evidence |
| JDK | **17 PROPOSED** | Proposal motivated by the Android Gradle Plugin 8.x requirement; starter compatibility still to be confirmed | PROPOSED |
| Android engine binding | No binding selected | Phase 5 decision required; build evidence required in Phase 7 | OPEN |

M-39 T1 establishes only the narrow `@ton/ton` derivation cross-check. It does not establish a broader engine substitution, signing capability or network-operation capability.

No JDK is installed on this VM. Gradle 8.9 is the **only grounded Gradle version in the evidence**, not proof of a working Android starter toolchain.

## 3. Reproduction steps

Use **Node 22** and **Python >=3.11** for a range-compliant reproduction. CI uses Python 3.13. The recorded VM’s Node v24.22.2 result must remain labelled as an out-of-range observation.

The following commands use a POSIX shell. Run the generator and Python checks from `tools/hdwallet-gen`, then return to the repository root for registry validation.

```sh
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
git checkout --detach 51c7e39

cd tools/hdwallet-gen
npm ci
npm run check
npm test

python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python test/differential_test.py
deactivate

cd ../..
node scripts/validate-registry.mjs
```

### Expected results against H7

The recorded H7 outcomes are **92/92**, **PASS** and **exact fixtures**. For setup, check and registry-validation commands, the table gives the expected success condition rather than claiming an additional recorded transcript or output count.

| Step | Expected result |
|---|---|
| Fresh clone and checkout | Checkout succeeds and `HEAD` resolves to the baseline identified by `51c7e39`. |
| `npm ci` in `tools/hdwallet-gen` | Installation succeeds using the committed lockfile, retaining Trust Wallet Core 4.8.4 rather than resolving an upgrade. |
| `npm run check` | The checked-in check script completes successfully. |
| `npm test` | **92/92 passing**, matching H7. |
| Create and activate the Python venv | An isolated environment is active under a Python version satisfying `>=3.11`. |
| `python -m pip install -r requirements.txt` | Installation succeeds with `cryptography==50.0.2` and `bip-utils==2.12.2`. |
| `python test/differential_test.py` | **PASS**, matching H7. |
| `node scripts/validate-registry.mjs` from the repository root | Registry validation completes successfully, without validation failures. No validator count is asserted here. |
| Fixture acceptance across the reproduction | Existing fixtures remain an **exact match**, as recorded at H7. |

This procedure is not a claim that a new clean-room run has been performed, or that CI already uses these installation commands.

### Fixed derivation and fixture contract

Use **BIP-39, 24 words, with an empty passphrase**. Account **0** is fixed. Where a receiving branch is present, only branch **0** is in policy; `i` denotes the receiving address index.

| Chain | Fixed derivation policy | Scope |
|---|---|---|
| BTC | `m/84'/0'/0'/0/i` | Account 0, receiving branch 0 |
| ETH | `m/44'/60'/0'/0/i` | Account 0, receiving branch 0 |
| TRX | `m/44'/195'/0'/0/i` | Account 0, receiving branch 0 |
| TON | `m/44'/607'/0'` | Generation-only; do not append a receiving branch or index |

**Documented deviation:** BTC testnet4 uses the **mainnet derivation path** by policy. Do not silently substitute a different derivation when reproducing its fixtures.

BTC, ETH and TRX xpubs share version `0488b21e`. Cross-chain xpub misuse among those three is therefore **undetectable from serialisation alone**. Preserve chain and derivation context; the version bytes are not a chain-identity check.

## 4. Lockfile strategy

**Plan decision 6: per-app lockfiles.**

- The only lockfile today is `tools/hdwallet-gen/package-lock.json`.
- `apps/web` and `apps/android` must each receive their own lockfile during **Phases 6–7**.
- There is **no root lockfile**, and the strategy does not introduce one.
- The generator’s lockfile must not be treated as a lockfile for either application.

### Known CI drift

CI currently runs **`npm install`**, not **`npm ci`**. The reproduction procedure above deliberately uses `npm ci` in the tool directory, but that does not describe the current CI implementation.

Record this as an unresolved reproducibility gap. **Do not claim CI reproducibility** from the presence of the lockfile or from the passing H7 suite. A CI installation change and its verification are separate implementation work, not completed by this document.

## 5. Android toolchain

### Grounded evidence

- **Gradle 8.9** is recorded in the Android draft’s `gradle-wrapper.properties`. No other Gradle version is established by the evidence.
- **JDK 17 is PROPOSED**, motivated by the Android Gradle Plugin 8.x requirement. This does not select an AGP version or establish compatibility with the WDK starter.
- **No JDK is installed on this VM.**
- The local Android draft’s Gradle execution was blocked by **sandbox loopback interception in its own environment**. This is a recorded result, **not re-tested here**, and is not successful build evidence.

### Binding remains OPEN

As of the evidence date, **no wallet-core version ships a downloadable Android AAR**. In particular, neither 4.9.1 nor 4.9.2 carries one (**Doc 4, M-21**). The verified npm tool pin does not establish an Android binding or native dependency delivery route.

**Phase 5 must:**

1. Settle the Android engine-binding question **before any starter integrates it**.
2. Establish the binding’s source, dependency and build requirements.
3. Confirm the WDK starter’s own toolchain requirements, including whether the proposed JDK 17 and the draft’s Gradle 8.9 are appropriate.

**Phase 7 must:**

1. Produce real Android build evidence for the settled binding.
2. Confirm the toolchain through that build, rather than treating the draft wrapper or JDK proposal as proof.
3. Record the actual versions, lockfiles, commands and build outcome.

The binding remains **OPEN**, and JDK 17 remains **PROPOSED**, until the corresponding decisions and verification are completed.

## 6. What this document does NOT establish

- **No signing/broadcast code:** this reproduction procedure supplies or validates no signing or broadcast implementation. D21/D31 are historical reference-engine demos, not evidence of working browser integration. In-browser send, sign and broadcast have never been exercised.
- **No mainnet use:** derivation paths, xpubs and exact fixtures are not evidence of mainnet operation or production readiness. Mainnet transactions and real funds are outside this procedure.
- **No Android build yet:** there is no successful Android build evidence here. The binding is OPEN; the draft’s sandbox blockage was not re-tested.
- **No expansion of the Node range:** this VM’s Node v24.22.2 is outside `>=22 <23`. Tests passing anyway is a recorded deviation, not a change to the supported range.
- **No automatic upgrade or CI reproducibility claim:** npm release availability does not validate an upgrade, and the current `npm install` drift remains unresolved.
