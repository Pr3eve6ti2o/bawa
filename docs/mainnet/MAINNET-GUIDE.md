# Bawa — Mainnet non-custodial wallet guide (Doc 4)

Doc 4 is one new standalone document: the mainnet guide for creating a non-custodial wallet with the Bawa repository (`Pr3eve6ti2o/bawa` at `56396a20`), covering Bitcoin, Ethereum, TRON and TON mainnet with real funds. Guide prose only — no app or UI code. Docs 1–3 remain unchanged as the testnet guide set; they do not cover mainnet.

Evidence baseline: 2026-11-09 (research slices M01–M36; live checks dated 2026-11-09). The code pin is the repair commit `e3b65fb832db287fdc8d54794980dd0b3456cc12` (short `e3b65fb8`), decided 2026-11-10 — see §5 and M-33.

**"Complete" in this guide means the prose is done and checked — never authorisation for real-fund use.**

## Mainnet warnings — read before anything else

The three warnings below appear in full here and in §2, and are presented before every wallet or recovery-material creation or import route; §§7 and 10 use short-form reminders. If another warning in this guide conflicts with §2, §2 governs.

### Real-money loss

> **Warning** Before funding or authorising a mainnet transfer, verify the destination, network and amount and follow the checks and stop conditions below. A wrong address, wrong network, wrong amount, stuck transaction or theft can lose real funds irreversibly. There is no wallet-level undo for a confirmed transfer.

> **Stop** If there is any mismatch, the destination cannot be verified or inspected in full, the destination display is shortened, or you have not confirmed the intended network, do not proceed with funding, signing or confirmation. A shortened display is never sufficient for address verification. Ignoring this stop risks irreversible loss of real funds.

### Non-custodial responsibility

> **Warning** When creating, importing or using a wallet, keep its recovery material private and test restoration before funding. Anyone who obtains the seed — or its mnemonic together with any required BIP-39 passphrase (empty under Bawa policy) — can spend all funds controlled by its derived keys on every chain. There is no reset and no support desk that can recreate lost keys or undo theft. Missing recovery material strands funds.

> **Stop** If recovery material has been disclosed, is missing or has not been tested, stop the mainnet procedure. Do not fund addresses derived from disclosed material or commit real funds with missing or untested recovery material. Ignoring this stop can enable theft or strand funds.

### No inherited assurance

> **Warning** If you are considering real-fund use, do not treat this documentation as assurance. Nothing in this guide claims that the repository, the drafts or this guide are audited, secure or production-ready. The testnet gates do not authorise mainnet work (README §18 L1160). “Complete” means prose done and checked — never authorisation for real-fund use. Ignoring this distinction risks irreversible real-money loss.

> **Stop** If you are treating any gate, review or completion as permission to use real funds, stop the mainnet procedure. Do not proceed on that basis; ignoring this stop risks irreversible real-fund loss.

## Contents

1. Scope, non-goals and mainnet warnings
2. Mainnet warnings and stop conditions
3. Law, tax and records
4. Choose your task and prerequisites
5. Clone and pin with a worktree
6. Node and Python installation
7. Shared contracts and wallet generation
8. Watch-only derivation and mainnet paths
9. Public-derivation comparison and differential testing
10. Vault, backup and recovery
11. Endpoints and connectivity
12. Wallet tracking and payment monitoring
13. Sending and signing: capability boundaries
14. Fees and transaction-cost review
15. Security posture and threat model
16. Testing and independent verification
17. Mainnet review gates
18. Troubleshooting and FAQ
19. Updating and rebuilding
20. Primary references and evidence provenance
21. Mainnet open-items register
22. Prose credit
Appendix. UI templates (pointer)

## 1. Scope, non-goals and mainnet warnings

### What this guide is and who it is for

This guide is for readers who want a straightforward way to create a non-custodial mainnet wallet using Bawa (`Pr3eve6ti2o/bawa` at `56396a20`). It covers Bitcoin, Ethereum, TRON and TON mainnet, with real funds. It provides guide prose only, not app or UI code.

Doc 4 is one new standalone document. Docs 1–3 remain unchanged as the testnet guide set; they do not cover mainnet (README §§18–19).

The repository already uses mainnet derivation paths: Bitcoin `m/84'/0'`, Ethereum `m/44'/60'`, TRON `m/44'/195'` and TON `m/44'/607'`. The testnet4 derivation deviation disappears on mainnet; do not “fix” the Bitcoin mainnet path to `m/84'/1'`.

### Non-goals

- **Not a hosted wallet, custody service or exchange.** This guide is for non-custodial use.
- **No security, audit or production-readiness claim.** Do not treat the repository or this guide as audited or production-ready.
- **No hardware-wallet support or multisig.** Neither is provided by the repository.
- **No verified sending procedure.** The repository contains no transaction construction or signing code (README L1197). Signing exists only in the separate Web/Android validation drafts. No send/sign/broadcast flow has been exercised on-chain on any network. Every send procedure in this guide is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **Testnet gates are not mainnet authorisation.** README §18 places any mainnet work outside the testnet guide set as a separate, reviewed change. Passing the testnet gates does not authorise it.

### Mainnet warnings

> **Warning** Before using mainnet with real funds, read the full real-money-loss warning in §2 and follow its stop conditions. Ignoring them risks real-money loss through a wrong address, wrong network, wrong amount, a stuck transaction or theft.

> **Stop** If your seed or other secrets have been disclosed, or recovery material is missing, do not proceed. Read the full non-custodial responsibility warning in §2 and follow its stop conditions. Disclosure enables theft; missing recovery material strands funds.

> **Stop** If you are treating testnet gates, this guide or its completion as mainnet approval, do not proceed. Read the full no-inherited-assurance warning and stop conditions in §2. There is no security, audit or production-readiness claim; assuming otherwise puts real funds at risk.

### The fixture rule

> **Never** fund fixture addresses. When using the published 15-word “ripple scissors…” fixture mnemonic, treat it and its addresses only as derivation-test vectors. The mnemonic is public: anyone can derive its private keys and steal funds sent to those addresses.

### How to read this guide

Read the sections in order. §2 is the warning home: it contains the full wording of the three mainnet warnings and their stop conditions. Read it before following any wallet procedure. §21 is the open-items register.

“Complete” in this guide means that the prose is done and checked—not that real-fund use has been authorised. Nothing in this guide authorises real-fund use.

## 2. Mainnet warnings and stop conditions

This is the guide’s single authoritative warning home. Read this section before any wallet procedure. The warnings are presented before every creation/import route; §2 contains the full warning, while §§7 and 10 use short-form reminders.

If another warning in the guide conflicts with this section, this section governs. We cannot mark the writing complete while that conflict remains. A Warning cannot override a Stop or Never instruction.

### Real-money loss

> **Warning** Before funding or authorising a mainnet transfer, verify the destination, network and amount and follow the checks and stop conditions below. A wrong address, wrong network, wrong amount, stuck transaction or theft can lose real funds irreversibly. There is no wallet-level undo for a confirmed transfer.

The risks apply throughout the wallet workflow:

- **Generation:** exposed recovery material can enable theft; using the wrong address or network when funding can lose funds.
- **Sending and signing:** a wrong address, wrong network, wrong amount, stuck transaction or theft can lose funds.
- **Recovery:** exposed material or an untrusted process can enable theft. Wrong restoration can lead to use of the wrong address or network, or leave funds inaccessible. Where recovery moves funds, a wrong amount or stuck transaction can also cause loss.
- **Tracking and payments:** wrong addresses, networks or amounts in payment details can cause loss. Misleading status can prompt a follow-up payment. Substituted destinations or requests for secrets can enable theft.

Never use transaction history as an address book. Use this full-address verification procedure for every destination:

1. Establish the **full intended recipient address** from a verified source outside transaction history. Retain that original source as the comparison reference.
2. After pasting, compare the **entire pasted address** against the original verified reference. Require a full-string match, not an endpoint match.
3. On the signing display, before confirmation, compare the **entire destination** against that same original verified reference — not merely against the pasted copy.

Address poisoning has three forms: zero-value transfers, tiny/dust transfers and fake-token transfers. A successful test payment does not validate a subsequently selected address. In December 2025, a $50 test payment reached the correct address; minutes later, a poisoned address copied from history led to the loss of about $50 million in USDT.

Clipboard swappers can replace a correctly copied address with a lookalike matching its first and last characters. Checking only those characters can pass while the destination is wrong.

> **Stop** If there is any mismatch, the destination cannot be verified or inspected in full, the destination display is shortened, or you have not confirmed the intended network, do not proceed with funding, signing or confirmation. A shortened display is never sufficient for address verification. Ignoring this stop risks irreversible loss of real funds.

### Non-custodial responsibility

> **Warning** When creating, importing or using a wallet, keep its recovery material private and test restoration before funding. Anyone who obtains the seed — or its mnemonic together with any required BIP-39 passphrase (empty under Bawa policy) — can spend all funds controlled by its derived keys on every chain. There is no reset and no support desk that can recreate lost keys or undo theft. Missing recovery material strands funds.

> **Stop** If recovery material has been disclosed, is missing or has not been tested, stop the mainnet procedure. Do not fund addresses derived from disclosed material or commit real funds with missing or untested recovery material. Ignoring this stop can enable theft or strand funds.

### No inherited assurance

> **Warning** If you are considering real-fund use, do not treat this documentation as assurance. Nothing in this guide claims that the repository, the drafts or this guide are audited, secure or production-ready. The testnet gates do not authorise mainnet work (README §18 L1160). “Complete” means prose done and checked — never authorisation for real-fund use. Ignoring this distinction risks irreversible real-money loss.

> **Stop** If you are treating any gate, review or completion as permission to use real funds, stop the mainnet procedure. Do not proceed on that basis; ignoring this stop risks irreversible real-fund loss.

### Fixture and rehearsal rules

> **Never** If an address is derived from the published 15-word “ripple scissors…” fixture mnemonic, do not fund it. The mnemonic is public: anyone can derive its private keys and spend any funds sent to those addresses.

> **Warning** If you rehearse on mainnet, use only a tiny real amount you can afford to lose; a rehearsal error can lose that amount. The tiny amount does not waive the restoration checks: public outputs and derived account-0 addresses must match their independent comparison targets before funding. If any comparison fails or cannot be made, stop without funding.

## 3. Law, tax and records

This guide covers Bitcoin, Ethereum, TRON and TON mainnet wallets using real funds. It is technical information, not legal or tax advice. Non-custodial describes control of funds, not a legal or tax conclusion. We have not determined your obligations. Check the rules that apply to you and seek qualified local advice where needed.

### Check your local law

Only the US, UK, EU and India were researched; no other jurisdiction is covered. All checks are dated **9 November 2026**. The verification limits below matter: an available summary or converging secondary sources are not the same as a readable primary text.

#### US — direct IRS

**Source:** US IRS, “Virtual currencies” FAQs, [irs.gov](https://www.irs.gov/). **Checked 9 November 2026.**

The IRS gives these four US federal-tax points:

1. “If you have digital asset transactions, you must report them whether or not they result in a taxable gain or loss.”
2. Business receipts of a digital asset are taxed as ordinary income.
3. For capital gains, short-term means held for one year or less; long-term means held for more than one year.
4. The FAQs explain “the general tax principles applicable to property transactions outlined in Notice 2014-21”.

#### UK — manual-existence-only HMRC

**Source:** UK HMRC, *Cryptoassets Manual*, [gov.uk](https://www.gov.uk/). **Checked 9 November 2026.**

HMRC’s manual exists and says it “concerns the tax treatment of cryptoassets”. It was published on **30 March 2021** and updated on **28 November 2025**.

We could not read its section-level content on pooling, disposals or record-keeping from the VM. This section therefore states no UK rule on those topics.

#### India — convergence-only

**Source basis:** five independent secondary sources citing India’s Finance Act 2022 and Income-tax Act 1961, ss. 115BBH/194S. **Checked 9 November 2026.** Indian official sources could not be reached during that check.

Those secondary sources report for India:

- a flat **30%** tax on income from transfer of a virtual digital asset;
- no loss set-off, with only the cost of acquisition deductible;
- **1% TDS** on transfer consideration above thresholds.

The successor-law position remains unresolved in this check. Two secondary sources conflict: one identifies the **Income Tax Act 2025**, effective **1 April 2026**; another identifies the **Income-tax Act 2026**, effective **1 April 2027**. These are conflicting accounts, not a verified statement of which successor law is in force.

Confirm the applicable law and current position with a **Chartered Accountant**. No renumbered successor sections are given here.

#### EU — direct ESMA summary

**Source:** EU ESMA, MiCA summary, [esma.europa.eu](https://www.esma.europa.eu/). **Checked 9 November 2026.**

ESMA states: “Markets in Crypto-Assets Regulation (MiCA) institutes uniform EU market rules for crypto-assets.”

The scope described by this EU market-rule pointer is issuers and trading, not your self-custody. It does not determine your obligations as a wallet user.

The text of **Regulation (EU) 2023/1114** could not be read: the request returned **HTTP 202 with an empty body**. This section makes no article-level claims.

### Keep records

Bawa at `56396a20` writes no transaction log. Keep your own log, with **one row per transaction**.

The US IRS fields below come from its record-keeping list at [irs.gov](https://www.irs.gov/) — **direct; checked 9 November 2026**. The local-currency value for non-US readers and the fields marked “Practical addition” are practical record-keeping additions, not statements of local legal requirements.

| Log column | Source or status |
|---|---|
| Type of digital asset | US IRS |
| Date and time of transaction | US IRS |
| Number of units | US IRS |
| Fair market value at the time of the transaction, measured in US dollars; non-US readers also record the value in their local currency | US IRS for the US-dollar value; local-currency value is a practical addition |
| Basis of the digital asset sold or disposed of | US IRS |
| Transaction kind: purchase, receipt, sale, exchange or other disposition | US IRS |
| Chain | Practical addition |
| Transaction ID | Practical addition |
| Sending address(es) | Practical addition |
| Receiving address(es) | Practical addition |
| Fee paid | Practical addition |
| Purpose/counterparty | Practical addition |
| Wallet/derivation path used | Practical addition |

#### Retention

For **US federal income tax**, the IRS states: “The Internal Revenue Code and regulations require taxpayers to maintain sufficient records to establish the positions taken on federal income tax returns.”

**Source:** US IRS record-keeping standard, [irs.gov](https://www.irs.gov/) — **direct; checked 9 November 2026**.

This guide gives no fixed retention period. Check your local retention rules and keep records.

> **Warning** If a transaction is missing from your log, add its details and retain the records. For US federal tax, leaving gaps risks tax under-reporting. Without the necessary records, you cannot prove basis, cannot prove holding period, and cannot answer a tax enquiry. This loss mode follows from the US IRS record-keeping standard above — direct; checked 9 November 2026.

### Sanctions and AML — US only

#### OFAC — convergence

**Source basis:** convergence on the US OFAC position. **Checked 9 November 2026.**

The converging sources report that OFAC sanctions apply to **US persons** and apply equally to virtual-currency transactions. Virtual-currency addresses appear on the **SDN List**. Violations carry **strict liability**: penalties are possible even without knowledge or intent.

> **Stop** If you are a US person and a proposed transaction involves a sanctioned address or counterparty, pause and check the applicable US rules, seeking qualified local advice where needed. Proceeding can lead to penalties for transacting with a sanctioned address, even without knowledge or intent, and to frozen or seized funds via a sanctioned counterparty. Source basis: US OFAC, convergence; checked 9 November 2026.

Neither an SDN List check nor following this guide’s checks is presented here as sufficient for US OFAC compliance.

#### FinCEN — direct

**Source:** US FinCEN guidance **FIN-2019-G001**, dated **9 May 2019** — **direct; checked 9 November 2026**.

For an unhosted single-signature wallet, FinCEN describes the value as the owner’s property and the owner as interacting with the payment system directly, with total independent control. It states that a person transacting through an unhosted wallet to purchase goods or services on their own behalf is not a money transmitter.

That is a US-only position, not a worldwide rule or a determination of your obligations.

### Limits and loss modes

This guide makes no assurances about:

- tax exemptions or a tax position inferred solely from whether a sale occurred;
- permission to use a wallet in a particular jurisdiction;
- identity concealment or absence of transaction traceability;
- sanctions immunity or compliance conferred by the wallet;
- record-keeping exemptions based on transaction size.

The loss modes to keep in view are:

- **Missing records — US federal tax:** tax under-reporting, and missing evidence of basis or holding period when answering a tax enquiry. Source basis: US IRS record-keeping standard, irs.gov — direct; checked 9 November 2026.
- **Sanctioned transactions — US persons:** strict-liability penalties for transacting with a sanctioned address, and frozen or seized funds via a sanctioned counterparty. Source basis: US OFAC — convergence; checked 9 November 2026.
- **Mainnet mistakes and theft:** wrong address, wrong network, wrong amount, stuck transaction and theft. The log above provides the evidence that makes recovery attempts or reporting possible afterwards; it is not a promise that funds can be recovered.

Check your local law and keep records.

## 4. Choose your task and prerequisites

Bawa is a practical open-source reference for HD-wallet generation, watch-only derivation, recovery, tracking and reconciliation—not a hosted wallet, custody service or exchange. The repo has **no transaction-construction, signing, broadcast or import tool**. This guide is prose only; it does not add those capabilities. [M16-F09]

### Choose your task

Read §5 before §6, then the applicable procedures in §§7–9. The tool names below identify the task route, not commands to run from this table. [M01]

| What you want to do | Read in this order and follow this route |
|---|---|
| **Create a new mainnet wallet** | §5 → §6 → §§7–9: generation with `tools/hdwallet-gen/generate.js` and `tools/make_wallet.py`, then backup and recovery requirements before funding. |
| **Build a watch-only view** | §5 → §6 → §§7–9: derivation with `tools/hdwallet-gen/derive.js`. Under `bawa-derivation-policy-v1`, TON is generation-only: one deposit address, no xpub. |
| **Compare derivations against an independent reference** | §5 → §6 → §§7–9: derivation, then comparison with `tools/hdwallet-gen/compare.js` against that reference. |
| **Recover from a backup** | §5 → §6 → §§7–9: backup dependencies, decryption with `tools/decrypt_seed.py`, then recovery rehearsal. Decryption is not import; Bawa supplies no import tool. [M16-F09] |
| **Track balances** | §5 → §6 → §§7–9: watch-only setup and tracking prerequisites, using `tools/hdwallet-gen/daemon.js` as the tracking entry point. |
| **Send** | §5 → §6 → §§7–9 for prerequisites only, then an external sending route or the app drafts. The drafts’ send/sign/broadcast was never exercised on-chain in either verification round: **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. [M16-F09; M27] |

### Prerequisites and stop conditions

Gate status below is the **2026-11-09 baseline**, not a statement that the gates have passed.

- [ ] **Clean, trusted machine.** Stop before handling seed material or data keys if you cannot establish that the machine is clean and trusted.
- [ ] **Repository cloned and pinned — §5.** Use `Pr3eve6ti2o/bawa` at `45d75a2a`. Do this **before any generation**. Stop if the checkout does not match the pinned revision. [M01]
- [ ] **Node, Python and dependencies installed — §6.** Follow the documented runtime requirements and dependency pins. Stop on unresolved installation or version mismatches; do not substitute npm “latest” for the repo pin. [M05]
- [ ] **Independent security review gate met before real funds.** Stop before **any use with real funds on mainnet**, including the first small receive. This gate is not reserved for sending. [OI-055]
- [ ] **Backup material and dependencies inventoried before funding.** The seed bundle and its **matching 32-byte data key are a paired dependency**. Stop before funding if either is missing or the recovery dependency inventory is incomplete. [M16-F25] Recovery rehearsal has never been executed: **FAIL — “Unexecuted = FAIL”**. A decrypt round trip is not that rehearsal. [README §18]
- [ ] **Rehearsal gates respected.** Follow the ladder: testnet first (**FAIL until executed**) → unfunded mainnet watch-only check → small mainnet receive → small mainnet send → normal use (**not cleared**). The small receive and small send are **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. Do not advance beyond an unpassed rung. A pass covers only the wallet, chain, network, derivation policy and signing route actually rehearsed. [M27]

## 5. Clone and pin with a worktree

Use a separate worktree so pinning the code does not replace the guide you are reading. At the 2026-11-09 baseline, the old in-place detach silently replaced the corrected README (1243 lines) with the repair commit’s older README (1019 lines): defect F4. The corrected procedure was verified by a fresh-clone re-run on that date; the README fix is committed at `b3814e0b` (2026-11-10 push).

1. **Clone and check the original tree.** Clone `Pr3eve6ti2o/bawa` and enter the directory you cloned into. Record the starting HEAD as supporting context (provenance only — the literal SHA in step 4 is the proof):

   ```sh
   MAIN_HEAD="$(git rev-parse HEAD)"
   ```

   Before installing, require a clean tree:

   ```sh
   git status --short
   ```

   > **Expected result — check**
   >
   > No output. Stop and resolve any reported changes; do not discard files merely to force the check through.

2. **Create a separate detached worktree at the current repair pin.**

   **Forbidden — F4:** do not use this form inside the directory you cloned into. It would silently replace the corrected README with the older README:

   ```sh
   git checkout --detach <repair-commit>
   ```

   Use the separate worktree instead:

   ```sh
   git worktree add --detach ../bawa-pinned e3b65fb832db287fdc8d54794980dd0b3456cc12
   ```

3. **Enter the pinned worktree and check it.**

   ```sh
   cd ../bawa-pinned
   ```

   > **Expected result — check**
   >
   > HEAD is detached; this test must succeed:
   >
   > ```sh
   > test "$(git rev-parse --abbrev-ref HEAD)" = HEAD
   > ```

   Record the full commit ID:

   ```sh
   git rev-parse HEAD
   ```

   > **Expected result — check**
   >
   > Compare it with the named repair commit and confirm that the tree remains clean. This combined check must succeed:
   >
   > ```sh
   > test "$(git rev-parse HEAD)" = "$(git rev-parse 'e3b65fb832db287fdc8d54794980dd0b3456cc12^{commit}')" && test -z "$(git status --short)"
   > ```

4. **Return and prove that the corrected guide survived.** In the return commands here and below, replace `<clone-directory>` with the name of the directory you cloned into.

   ```sh
   cd "../<clone-directory>"
   ```

   > **Expected result — check**
   >
   > The original directory is still at the cloned baseline commit, its README is still 1243 lines, and its tree is still clean. All three tests must succeed:
   >
   > ```sh
   > test "$(git rev-parse HEAD)" = "45d75a2aa4ad94af94d382cb2c8a626c614f0188"
   > test "$(wc -l < README.md | tr -d ' ')" = 1243
   > test -z "$(git status --short)"
   > ```

5. **Return to the pinned worktree for §6 onward.** All commands from §6 onward run inside `../bawa-pinned`. The original directory stays at the commit you cloned so you can keep reading the corrected guide.

   ```sh
   cd ../bawa-pinned
   ```

6. **Remove the pinned worktree once testing is complete.** Return to the directory you cloned into first. Do not run the removal from inside the pinned worktree itself.

   ```sh
   cd "../<clone-directory>"
   git worktree remove ../bawa-pinned
   ```

7. **Keep the verification limit in view.** No signed-release verification procedure exists. Recording the commit is the minimum check, not proof of authenticity.

**Decided 2026-11-10 — pin.** Doc 4 pins to the repair commit `e3b65fb832db287fdc8d54794980dd0b3456cc12` (`e3b65fb8`), an immutable, explicitly identified SHA. Whether Doc 4 re-pins to a newer head remains **OPEN**, pending the user’s decision.

**Decided 2026-11-10 — proof form.** Step 4 uses the literal baseline HEAD SHA in the proof; the literal SHA is the check. The `MAIN_HEAD` capture in step 1 is supporting context only — record it for provenance, do not substitute it for the literal SHA. If main advances and Doc 4 is re-issued, update the literal SHA in step 4 to the new baseline.

**Decided 2026-11-10 — cross-references.** The F4 treatment in Doc 1 §15 and the Android guide at L3732 and L4756 were updated to the worktree procedure in the 2026-11-10 push; those locations no longer carry the old in-place detach.

## 6. Node and Python installation

For the procedures, see **Doc 1 §6 (Node)** and **Doc 1 §7 (Python)**. Installation runs in the pinned worktree from §5.

Match these repo pins:
- **Node 22.23.4**, within the repo range `>=22 <23` (M05).
- **Trust Wallet Core 4.8.4** (M05 F11).
- Python packages **`cryptography==50.0.2`** and **`bip-utils==2.12.2`** (M05).

**Standing environment note:** verification ran on **Node v24.22.2**, outside the repo range. Node v24 is not a supported configuration (M05/M06; verify2 T1 environment failure). Anything installed outside the pins is untested against the repo.

## 7. Shared contracts and wallet generation

### Shared contracts

At main head `56396a20` (evidence baseline 2026-11-09), the shared derivation contract is `bawa-derivation-policy-v1`: BIP-39 with 256 bits of entropy, 24 words and an **empty BIP-39 passphrase**. The indexed receiving paths use account `0` and receiving branch `0` only. [M02, M01]

- **BTC:** `m/84'/0'/0'/0/i`
- **ETH:** `m/44'/60'/0'/0/i`
- **TRX:** `m/44'/195'/0'/0/i`
- **TON:** `m/44'/607'/0'` — generation-only, a single deposit address and no xpub.

Here, `i` is the receiving address index. Do not extend these contracts to other accounts or branches. [M02, M01]

The filesystem contract is:

- `secrets/`: mode `0700`;
- `seed.enc.json`: mode `0600`;
- `.env`: mode `0600`. [M02, M01]

The encrypted bundle uses AES-256-GCM. The decryptor’s additional authenticated data (AAD) is exactly `b"nova-shop-seed-v1"`. This is a **frozen compatibility identifier**: it must never be renamed, and it is not a testnet/mainnet selector. The AES data key and the BIP-39 passphrase are different inputs and must never be confused. [M16-F10, M16-F12, M30]

### Generation procedure

> **Warning**
>
> Real-money loss — mainnet transactions move real funds and confirmed transfers are generally irreversible.

> **Warning**
>
> Non-custodial responsibility — only you hold the recovery material, and no support desk can recreate a lost mnemonic or BIP-39 passphrase.

> **Stop**
>
> No inherited assurance — passing the testnet gates does not authorise mainnet use, and the independent security review remains a release blocker before any real funds.

Carry out this procedure without funding an address. Behaviour that requires spending real funds to verify remains **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**; generation and a decrypt round trip do not clear that status or the review blocker.

1. **Complete the prerequisites.**

   Complete the prerequisites in §4, §5 and §6 before running the generator. Check the filesystem modes against the shared contract above.

2. **Generate the wallet bundle.**

   Run `tools/make_wallet.py` with a **120-second generation timeout**. Nothing in the generation code changes for mainnet. [M03]

   > **Stop**
   >
   > By default, the generator refuses an existing `seed.enc.json`. If that refusal occurs, stop generation and preserve the existing bundle. An existing-file refusal is not an instruction to replace the backup. [M03]

   The generator writes `XPUB_BTC`, `XPUB_ETH`, `XPUB_TRX` and `TON_DEPOSIT_ADDRESS` into `.env`, with mode `0600`. [M03]

   Generation performs **no signing, no broadcast and no wallet import**. Writing these values is not a transaction or a wallet-import check. [M16-F09]

3. **Back up the bundle and its matching data key as a pair.**

   Keep backup copies of the seed bundle, the decrypt script and `RECOVERY.md` in `seed-backup/`. The directory must have mode `0700`, and each copied file must have mode `0600`. [M03]

   Back up the matching AES data key as well, and retain its association with this bundle. The encrypted bundle and its data key are a **paired recovery dependency**: `seed.enc.json` without its matching data key is not a recoverable backup. The copies of the script and recovery instructions do not replace that dependency. [M16-F25]

4. **Verify the backup with a decrypt round trip.**

   Use `tools/decrypt_seed.py` to decrypt the backup copy of the bundle with its matching data key. Supply the data key through `BAWA_DATA_KEY` as hex encoding exactly **32 bytes**, or enter it at the prompt `Bawa data key (hex): `. That prompt asks for the AES data key, not the BIP-39 passphrase. [M16-F10, M16-F12]

   Use the default output for this check: the mnemonic is written only to `/dev/tty`. The alternatives `--stdout` and `--output` are mutually exclusive. `--output` writes atomically with mode `0600` and refuses symlinked outputs; neither alternative is needed for the default terminal check. Most decryption refusals appear as Python tracebacks with exit status `1`. Treat a refusal as a failed check. [M16-F10, M16-F12]

   For a newly generated bundle, check that the decrypted result has the policy’s 24 words. Do not overstate what this proves: the decryptor accepts 12, 15, 18, 21 or 24 words and checks the word count only. It does not check the BIP-39 word list or checksum. Successful decryption therefore does **not** establish BIP-39 validity or that this is the correct wallet. [M02, M01, M16-F02, M16-F10, M16-F12]

   The BIP-39 passphrase remains empty under this policy. A wrong BIP-39 passphrase yields a different valid wallet with no error; successful bundle decryption cannot detect that mistake. [M02, M01, M16-F02]

   This round trip checks decryption of the backup bundle with its matching data key. **It is not the recovery rehearsal in README §18.** Watch-only derivation belongs in §8, and wallet comparison belongs in §9.

### Offline regression fixtures

> **Never**
>
> Fund none of the addresses below. **Funding these addresses is immediate loss because the mnemonic is public.** They are regression targets only, never funding targets. [M29, M16-F07]

For the offline regression check, use only the published **15-word “ripple scissors…” test vector with an empty BIP-39 passphrase**. This public fixture is distinct from the **24-word generation policy**: these are not the expected addresses of a newly generated wallet. [M29, M16-F07, M02, M01]

The TON fixture uses **V4 R2**, wallet ID **`698983191`**, and the non-bounceable address format. The drafts’ wallet ID `0` is wrong for this fixture: it produces a different address. [M29, M16-F07]

| Chain | Derivation path | Expected public-fixture address |
|---|---|---|
| BTC | `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| TRX | `m/44'/195'/0'/0/0` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TON — non-bounceable | `m/44'/607'/0'` | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

## 8. Watch-only derivation and mainnet paths

On Bitcoin mainnet, Bawa uses the standard BIP-84 native-SegWit account `m/84'/0'/0'`, receiving path `m/84'/0'/0'/0/i`, and `zpub` extended public keys (`0x04b24746`). SLIP-0044 assigns Bitcoin coin type `0`, and SLIP-0132 registers `zpub` for mainnet P2WPKH. None of the documented testnet coin-type/key-version deviation remains on mainnet: `zpub` matches the network. A mainnet wallet with the same mnemonic and passphrase, selecting BIP-84 account `0`, derives the same account. Configure address generation for Bitcoin mainnet, producing `bc1q…` receiving addresses, not `tb1q…`. Mnemonic restoration must select BIP-84 account `0` and use the original passphrase, if any; restoration belongs outside the watch-only environment. [M28 §6.1, Astra A01; M28-003; M28-006; M27 §3.1]

**Public test-vector warning: funding any address in the table below is immediate loss because the mnemonic is public.** These fixtures use only the published 15-word “ripple scissors…” test vector with an empty passphrase. They are fixture checks, never personal receiving destinations. The first receiving address uses `i = 0` for BTC, ETH and TRX. [M02; M29]

| Chain | Mainnet derivation path | First receiving-address fixture — never fund |
|---|---|---|
| BTC | `m/84'/0'/0'/0/i` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `m/44'/60'/0'/0/i` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| TRX | `m/44'/195'/0'/0/i` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TON | `m/44'/607'/0'` — generation-only | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

The TON fixture is V4 R2, wallet ID `698983191`. TON is generation-only: it is absent from both `derive.js` and `daemon.js`. [M29; M04]

**Derive, serve and compare**

1. **Construct the watch-only environment from your own mainnet extended public keys.** Keep the mnemonic, passphrase and all private extended keys out of that environment. If public-only construction is unsupported or unverified, **STOP**; do not substitute a seed or private key. [M27 §3.1]

2. **Complete the input checks in the blocker box below before supplying a key.** Use `derive.js` to derive from the checked public extended key at the recorded receiving index. The repo’s watch-only tools already derive the mainnet paths for BTC, ETH and TRX. [M02; M04]

3. **Use `daemon.js` when serving watch-only derivation over its protocol.** The same public-only boundary and input checks apply. Respect its protocol limits: `MAX_XPUB_LENGTH = 200`, `MAX_LINE_LENGTH = 4096`, and `MAX_INDEX = 2147483647`. [M04; M27 §3.1]

4. **Use `compare.js` as a comparison aid against independent references, not as an input validator.** The independent-reference comparison procedure is in §9. Its output and exit status do not remove the blockers below. [M04; M27; M35]

> **STOP — OI-096 remains live and unfixed at the 2026-11-09 baseline**
>
> `compare.js` accepts private extended keys and prints silently wrong addresses with exit `0`. `derive.js` returns valid-looking addresses for mismatched-chain keys. These behaviours are documented, re-confirmed live and unfixed in code. The checks here are not a code fix. [M04; M27; M35]
>
> **Pre-flight: stop if any of these checks cannot be completed.**
>
> - Verify that the input is a **public extended key**, not a private key.
> - Verify that it is the export from your intended wallet and account.
> - Verify that the export and derivation request match the recorded **chain, network and exact derivation policy**.
>
> A recognised prefix is not enough to pass these checks. For Bawa BTC mainnet, the expected input is `zpub` (`0x04b24746`). The SLIP-0132 mainnet reference entries also include public `xpub` (`0x0488B21E`) and private `xprv` (`0x0488ADE4`); private extended keys are excluded from the watch-only environment. These reference entries are not an alternative to Bawa’s recorded BIP-84 policy. [M28 §6.1; M28-016; M28-083; M27 §3.1]
>
> **Testnet reference only:** `tpub` (`0x043587CF`), `tprv` (`0x04358394`), `vpub` (`0x045f1cf6`) and `upub` (`0x044a5262`). Recognise them, but never use them as mainnet watch-only keys. In particular, **do not feed BTC testnet `vpub` or `tpub` keys to `derive.js`**: with Core `4.8.4`, both produce no address and exit `1` with an opaque WASM-abort error. [M28-016; M28-083; D31 F8]
>
> After the input checks, the resulting address must **exactly match the independent offline reference** for the recorded policy; see §9. Otherwise, **STOP**. A valid-looking string, agreement between tool outputs, or exit `0` must not override a stop. [M04; M27; M35]

A watch-only match proves **address agreement only** for the checked public export, derivation policy and index. It never establishes a balance or receipt of funds. [M04; M27 §3.1] Anything that cannot be verified without spending real funds remains **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**; it must not be inferred from these derivation checks.

## 9. Public-derivation comparison and differential testing

### 1. Set up the whole-address comparison

For each address being checked, compare:

- the public address produced by `derive.js` or `compare.js`;
- the independent offline result from the verified `bip_utils` re-derivation approach;
- the recorded independent original for the intended wallet/account.

Use the same recorded wallet parameters throughout: chain, network and exact derivation policy. Compare the **whole address**, character for character—not just its beginning and end. Originals generated from the restored wallet are not independent evidence and must not be treated as such. [M02; M27 §3.3; M16-F36; M16-F42]

### 2. Keep the recorded results within their tested scope

The **2026-11-09 baseline** records the following results, with verify2 T1 at main head `56396a20`. These are recorded component-test results, not a fresh result for your installation:

- **T1 repository tools: 15 PASS.** Live generation ran under a real pty. Daemon protocol cases passed, including rejection of the bad-chain case.
- **T1 public derivation: `derive.js` 9/9 and `compare.js` 9/9**, checked against independent `bip_utils` re-derivation.
- **T1 decrypt round trip: 4/4.** This covers the tested decrypt round trips, not recovery after losing the original installation.
- **T1 repository test suite: `npm test` 28/28.** The differential test recorded **byte-identical** output: agreement byte for byte in that comparison.
- **T2 web draft in a real browser: 19 PASS / 0 FAIL / 3 INFO**, with **0 console errors, 0 page errors and 0 failed requests**. The **3 INFO remain INFO**; they are not additional passes.
- **T3 spot checks of the 200-finding fix: 9 MATCH / 0 MISMATCH.** These were spot checks, not a new claim that every finding had been checked.

[M27 §2.4; M27 §2.5/§8; M16-F14]

### 3. Complete the OI-096 pre-flight before trusting either tool

OI-096 records `compare.js` accepting private extended keys and silently printing wrong addresses with exit status `0`. It also records `derive.js` returning valid-looking addresses for mismatched-chain keys. **Exit `0` proves nothing about address correctness.** [OI-096; M04; M27 §3.2]

Before relying on either tool’s output, verify that:

- the input is a **public extended key**;
- it is the intended wallet/account export;
- its provenance and recorded chain, network and exact derivation policy match the calculation you intend;
- the resulting address exactly matches the independent offline reference under the same recorded wallet parameters.

Do not reduce these checks to recognising a key prefix. If you cannot establish the required facts, do not rely on the output. [OI-096; M04; M27 §3.2]

For BTC mainnet, `m/84'/0'` with `zpub` **is** the BIP-84/SLIP-0132 standard. Do not carry the testnet4 exception into mainnet. A `tb1q` result is not the required mainnet `bc1q` result; editing the prefix repairs neither the derivation nor the address checksum. [M28]

### 4. Check the published fixtures

Use only the published 15-word “ripple scissors…” test vector, with an empty passphrase, for these derivation examples. These are fixture checks, not personal receiving destinations. A fixture match is not personal-wallet verification. [M02; M27 §3.3]

**Funding any address in the table below is immediate loss because the mnemonic is public.**

| Chain | Recorded path or wallet parameters | Expected fixture address |
|---|---|---|
| BTC | `m/84'/0'/0'/0/0` | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `m/44'/60'/0'/0/0` | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| TRX | `m/44'/195'/0'/0/0` | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TON | V4 R2; wallet ID `698983191` | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

[M02; M27 §3.3]

### 5. Apply the result without widening the claim

Mark the personal-wallet comparison as passed only when the complete derived address agrees with both the independent offline re-derivation and the recorded independent original under the same wallet parameters. That establishes agreement of the checked public outputs; it does not establish recovery or spending capability. [M02; M27 §3.3; M16-F36; M16-F42; M16-F14]

**Any mismatch is a hard stop**, not a warning to work around. Do not send a small deposit as a diagnostic. Do not substitute a valid checksum, successful decryption or a plausible balance for this comparison. Missing independent originals block the funding gate. [M16-F36; M16-F42]

A pass does not establish that you can recover and use the wallet after losing the original installation. **End-to-end recovery and use, including send/sign/broadcast: UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL.** Send/sign/broadcast was not exercised in either verification round: there were no testnet or mainnet funds, and the repo has no signing code. A decrypt round trip is not the recovery rehearsal; the rehearsal gate remains **FAIL** until executed, as required by README §18. Follow §10 and §16 for the rehearsal ladder rather than treating these component results as a substitute. [M27 §2.5/§8; M16-F14; README §18]

## 10. Vault, backup and recovery

Part A covers vault and backup custody. The repo’s `seed.enc.json` bundle and the Web draft browser vault are different stores; Android’s Keystore-bound vault has its own loss modes. Part B covers recovery. The three warnings in §2 still apply.

> **Never** When using the published 15-word “ripple scissors…” fixture mnemonic, never fund fixture addresses. The mnemonic is public, so anyone can derive the same keys and take funds sent there.

### Generation environment and timeout

Generate on a trusted, offline machine with an interactive `/dev/tty`. The mnemonic and data key are displayed **only on `/dev/tty`**. This does not prevent recording: `script`, tmux recording or scrollback, and CI terminal capture can still retain that output.

> **Never** Do not generate in a random online shell or on a CI runner. If material was generated in an untrusted or recorded session, treat it as potentially exposed and do not fund that wallet; anyone who obtained the secrets could take the funds.

`make_wallet.py` imposes a **120-second generator timeout**. In a live drill, the secrets were displayed first and the generator subprocess was killed at the limit. Displayed secrets are not proof of a completed run.

> **Stop** If generation times out or is otherwise interrupted, never fund that run’s output. Preserve the recorded secrets and any resulting files offline, establish what completed, and require a successful clean-machine recovery drill before funding. Part B covers that drill. Funding an unverified result can leave funds inaccessible.

### Data key, AAD and file modes

The generator shows the random **256-bit data key once, at creation**. Keep it offline, **separately from both `seed.enc.json` and the mnemonic** — three distinct holdings, not one backup bundle. You confirm storage by typing `SAVED`; do so only after actually storing and checking the data key.

> **Never** If changing vault files or code, do not rename or change the additional authenticated data (AAD) value `nova-shop-seed-v1` without a tested migration. It is a frozen compatibility pin: an AAD mismatch prevents decryption even with the correct data key.

Keep the secrets directory at mode `0700` and `seed.enc.json` at `0600`. The encrypted seed is a convenience copy, never a substitute for the mnemonic.

### Offline backup storage

Choose paper for legibility and correction, or metal for resistance to fire and flood. Keep **2–3 copies in separate locations**, never all in one place. Preserve the separation between the mnemonic, data key and encrypted bundle when arranging those copies.

> **Never** When recording or backing up secrets, do not take photos or screenshots, make cloud copies, type secrets into websites or email them to yourself. These copies can expose the material needed to spend your funds.

Re-check backups periodically. The repo prescribes no interval.

> **Stop** If a backup is stolen, move funds to a fresh wallet. Leaving funds in the old wallet risks their being taken by someone with the stolen recovery material. See the sending and recovery material for the migration steps.

### BIP-39 passphrase and vault unlock passphrase

These have different purposes:

- The **BIP-39 passphrase** changes the seed and therefore the wallet. Bawa policy is an **empty BIP-39 passphrase**.
- The **vault unlock passphrase** only opens the local vault. The documented minimum is **8 characters** — an acceptance rule, not a strength assessment.

> **Warning** When restoring, do not substitute the vault unlock passphrase for the BIP-39 passphrase. A wrong BIP-39 passphrase silently derives a different valid wallet, with no error to tell you that it is not your wallet.

### Keep the vault stores distinct

#### Repo bundle

The repo vault is the `seed.enc.json` bundle, not browser storage. Without its separately held data key, that encrypted copy cannot be decrypted. Retain the mnemonic independently; the bundle remains a convenience copy.

#### Web draft browser vault

The Web draft uses **PBKDF2 with 600,000 iterations** and a **10-minute auto-lock**. These are draft-only parameters, not repo controls. The browser vault has never been independently reviewed.

The claim of “10 minutes of inactivity” is inaccurate: the timer re-arms only on unlock, not on activity.

> **Warning** If using the Web draft browser vault, keep independent offline recovery material and do not rely on browser storage as your only copy. It is weaker storage than an offline bundle: browser compromise can expose keys, and clearing browser data can erase the only copy and strand funds.

#### Android Keystore vault

The Android vault is Keystore-bound.

> **Warning** Before uninstalling the Android app, moving to another device or adding a fingerprint, check that independent offline recovery material survives. The Keystore key does not survive uninstall or a device move, and adding a fingerprint may invalidate the Keystore wrapping key. Without its Keystore key, the vault cannot be opened; a copied vault or database is not a portable backup.

Android has **no inactivity auto-lock**. Its biometric gate is UI-layer only, not enforced in `WalletSession.unlock()`. `FLAG_SECURE` covers only the Backup and Import routes, not the whole app.

Passing the Android **3-word backup quiz does not meet the full ordered 24-word re-entry requirement**. Do not treat that quiz as full backup verification.

Neither the Web nor Android draft implements clipboard clearing.

### Forgotten vault unlock passphrase

Web UI deletion requires the vault unlock passphrase: it calls `openVault` before `deleteWallet`. Android import refuses to proceed while a bundle exists.

> **Stop** If you have forgotten the vault unlock passphrase, do not clear storage or app data unless you have checked that independent recovery material survives. The only escapes are undocumented out-of-app storage clears or app-data clears, and they destroy the local vault. That loss is catastrophic if no independent recovery material remains.

### Inheritance — proposed safeguards only

The repo has no single-holder continuity procedure; `docs/08` §20 places this beyond Bawa’s scope. The following are **proposed safeguards only**, not a repo-supported inheritance procedure.

> **Never** When planning inheritance, never put seed words in a will: anyone who obtains the words may be able to spend the funds. Check local law and ask a solicitor. Any further estate wording requires solicitor review.
### Recovery

Recovery reproduces the preserved wallet from its original material and settings. It does not generate a replacement wallet. Follow the nine steps in `docs/RECOVERY.md`, Part 1, in order.

#### Recovery procedure

1. **Establish the backup and independent comparison targets.** Identify the preserved material, its decryption prerequisites and independent, pre-existing records of the wallet’s public addresses and settings. Outputs generated during this recovery are not independent comparison targets.

2. **Use a clean, trusted machine.** Do not substitute the original live setup for a recovery from preserved material.

3. **Recover the mnemonic from the preserved material.** If using `decrypt_seed.py`, check the process’s exit status and follow the decryption and plaintext-handling requirements below. `--force` and `--regenerate` are excluded from recovery.

4. **Validate the mnemonic and exact BIP-39 passphrase policy.** Check the BIP-39 word list and checksum locally with an independently assessed method. Confirm the original wallet’s exact BIP-39 passphrase policy. Bawa’s policy is **BIP-39, 256-bit entropy, 24 words and an empty BIP-39 passphrase**.

5. **Restore the chain, derivation and address settings for each asset.** Restore the recorded address indices as well as the paths and network settings. These paths are already mainnet paths; the testnet4 deviation does not apply on mainnet.

   - **BTC:** `m/84'/0'/0'/0/i`, with native SegWit. A `tb1q` result is not the required mainnet `bc1q` result. Editing the prefix does not repair the derivation.
   - **ETH:** `m/44'/60'/0'/0/i`, with Ethereum mainnet selected explicitly. An Ethereum address alone does not identify the network. Verify the chain ID, RPC endpoint, network name, native currency and explorer separately.
   - **TRX:** `m/44'/195'/0'/0/i`, with explicit TRON mainnet configuration.

6. **Restore TON configuration exactly.** Reproduce all five recorded fields: **contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID**. The path `m/44'/607'/0'` is generation-only, not an evidenced mainnet restoration recipe. TON mainnet restore remains unevidenced: do not fill missing settings with guessed defaults or claim a completed TON rehearsal.

7. **Derive known public addresses and compare whole addresses.** Require whole-address equality against the independent, pre-existing records—not matching prefixes, suffixes or shortened displays. Public fixtures are not evidence of your wallet’s identity. Apply the verification-tool requirements below.

8. **Repeat independently where practical.** Repeat the recovery and address comparison independently, using the pre-existing records rather than newly generated “expected” outputs.

9. **Record the result, remove transient secrets and apply the funding gate.** Keep the result record public-only and state the scope checked and outcome. Account for and remove transient secrets; do not claim that deleting one named file proves complete erasure. No real deposit may precede the funding gate.

#### Validation and the funding gate

Successful decryption is not BIP-39 validation. `decrypt_seed.py` accepts 12, 15, 18, 21 or 24 words by word count only; it does not check the BIP-39 word list or checksum.

A valid mnemonic is not proof that the intended wallet has been recovered either. A wrong BIP-39 passphrase produces a different valid wallet with no error. A plausible address, a valid checksum or an empty balance is not proof of wallet identity.

> **Never** If mnemonic validation would require submitting the phrase to an unverified validator, do not upload it. Use an independently assessed local method instead; uploading the phrase can expose control of the wallet.

The published addresses below are regression targets only:

| Asset | Public fixture address |
| --- | --- |
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| TRX | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TON | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

> **Never** When using these fixtures, restrict them to public regression checks and never fund them. They are not your wallet’s recovery targets; treating them as deposit destinations risks losing funds.

**Before the first real deposit**, including a funded rehearsal receipt, require all of the following:

- Recovery from preserved material, not reuse of the original live setup.
- A locally validated mnemonic and confirmation of the exact BIP-39 passphrase policy.
- Complete restoration settings and whole-address equality against independent, pre-existing records. Neither public fixtures nor newly generated “expected” outputs count.
- Independent repetition where practical.
- A public-only result record and completion of the transient-secret handling requirements.
- Independent security review before any real funds are introduced.

> **Stop** If decryption fails, required settings are missing or any mismatch remains unresolved, stop and keep the funding gate closed. Never use a deposit as a diagnostic or re-fund a guess; doing so can send funds to the wrong wallet.

**Mismatch decision tree**

Use the checks in this order, following README §13:

1. **Stop on a whole-address mismatch.** Do not assume that the result is an empty wallet.
2. **Check the BIP-39 passphrase first.** Confirm the original value and policy exactly. Bawa’s empty BIP-39 passphrase policy is not a fallback for a wallet created with a non-empty BIP-39 passphrase.
3. **Then check the derivation settings.** Recheck the recorded paths, indices and per-chain settings, including all five TON fields where applicable.

After correcting a confirmed error, repeat the whole-address comparison. Any unresolved mismatch keeps the funding gate closed.

The claim “no funds = never sent” is wrong: funds may have been received and later spent. An empty balance does not establish either wallet identity or the absence of past activity.

#### Import, signing and verification tools

The repository has no import tool and no signing code. Recovery into a wallet and signing with restored keys require external software, and **no compatible route has been tested**.

An XPUB-only restoration is watch-only. Address comparison alone does not demonstrate spending capability.

OI-096 remains live: `compare.js` accepts private extended keys and silently prints wrong addresses with exit status `0`; `derive.js` returns valid-looking addresses for mismatched-chain keys.

> **Warning** When verifying recovery, require a `bip_utils` cross-check and never use `compare.js` with private keys. Relying on the helpers alone can leave valid-looking but wrong addresses mistaken for evidence of a recovered wallet, even when the process exits successfully.

#### Decryption and transient plaintext

`decrypt_seed.py` uses AES-256-GCM. Decryption requires:

- The AES data key supplied through `BAWA_DATA_KEY` as hexadecimal encoding of **exactly 32 bytes**.
- The frozen AAD **`nova-shop-seed-v1`**, unchanged.

`seed.enc.json` without its data key is not a recoverable seed backup.

Check the decrypt process’s exit status, not merely whether output appeared. Treat tracebacks and symlink refusals as failed recovery, not as an empty wallet.

> **Stop** If decryption fails or a file check refuses to proceed, stop and investigate without bypassing the checks. An existing-file refusal is not an instruction to replace the backup. Overriding the refusal can destroy preserved material or leave a failed recovery mistaken for a recovered wallet.

Choose plaintext output deliberately:

- By default, the mnemonic is written to `/dev/tty` only.
- `--stdout` and `--output` are mutually exclusive.
- `--output` writes an atomic `0600` plaintext file. Automatic removal of that file is not evidenced.

Account for all transient copies and remove transient secrets when the checks are complete. Keep them out of the public result record. Deleting the named output file does not prove complete erasure.

#### Rehearsal status

The recorded recovery rehearsal status is **FAIL** (README §18): no rehearsal has been executed on a clean install. A decrypt round trip is not the rehearsal.

The required staged protocol is:

1. **Testnet execution first.** Execute the recovery protocol on testnet before proceeding to mainnet.
2. **Unfunded mainnet restore.** Recover from the preserved material and complete the unfunded checks.
3. **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** — a small mainnet receipt followed by a spend from the restored wallet.

Independent security review is mandatory before introducing any real funds, including funds for the last stage. The funding gate must also be satisfied; that receipt must not be used to diagnose an unresolved recovery problem.

“Tiny” is not defined per chain, and no mainnet amount has been established. The staged protocol does not supply an approved funding figure.

A **PASS** must be the conjunction of completed, successful checks for the stated scope. Record which assets, networks and operations were tested. A decrypt round trip, an address match or a result from another scope cannot stand in for missing checks. Unevidenced TON mainnet restoration cannot be counted as a completed TON rehearsal.

#### Lost or exposed material

Complete seed loss means the funds are gone. An XPUB cannot reconstruct the seed, and no support desk, reset or recovery service can recreate the lost material.

An exposed seed requires migration to independent keys. Application changes do not repair the exposure. Fee availability must be established before an ordinary sweep.

> **Warning** If a compromised account lacks the fees needed for a sweep, do not automatically top it up. A top-up places additional funds under exposed keys and creates further exposure.

If funds have already left, the response is to trace, notify and report. Those actions do not reverse the transfer.

#### Backup-gate contradiction

In the Web/Android flows, import skips the backup gate. Android’s three-word quiz also fails to meet the required full, ordered re-entry of all 24 words. This is a **funding-gate defect**, not a UX difference.

> **Stop** If import or quiz completion lets you proceed without satisfying the required full, ordered 24-word re-entry, do not treat the backup gate as passed. Keep the funding gate closed until the re-entry and recovery requirements are met; relying on UI progress instead risks funding a wallet whose recovery has not been demonstrated.

## 11. Endpoints and connectivity

These changes target `Pr3eve6ti2o/bawa` at `56396a20`. They are edits to make and review, not evidence that a checkout already uses mainnet.

All service responses, heights and fee figures below are dated observations: **checked 2026-11-09 on `muse-vm`**. They are not current availability reports or fee quotes.

### Replace the whole testnet endpoint set

Apply the complete mapping, not just the first URL that makes a request work.

| Testnet URL fragment | Mainnet replacement | Occurrences in the replacement inventory |
|---|---|---:|
| `ethereum-sepolia-rpc.publicnode.com` | `ethereum-rpc.publicnode.com` | 8 |
| `nile.trongrid.io` | `api.trongrid.io` | 6 |
| `mempool.space/testnet4/api` | `mempool.space/api` | 5 |
| `eth-sepolia.blockscout.com/api/v2` | `eth.blockscout.com/api/v2` | 5 |
| `testnet.toncenter.com/api/v2` | `toncenter.com/api/v2` | 4 |

**Delete, without replacement:**

- `nileex.io/join/get`
- `mempool.space/testnet4/faucet`

No mainnet faucet exists. Do not turn either deletion into a guessed mainnet faucet URL.

The testnet URLs in this inventory were all live at the same time during the dated checks. A responding testnet URL therefore proves nothing about completing the migration. It can return plausible data for the wrong chain: the BTC checks found exactly that behaviour on testnet3. Check the endpoint actually configured, not merely a hostname copied into a terminal.

#### Shared read-only verification checks

> **Results observed 2026-11-09 ~11:54–12:00 UTC, `muse-vm`.** Heights and seqnos move — the command is the check, not the number. ETH chain ID must still be `0x1`; TON must return `ok:true` with masterchain information. Check the endpoint actually configured. On failure or wrong network, stop before money movement. Never use a real transfer or resend to test connectivity. These read-only checks do not verify submission or confirmation.

The `POST` entries describe requests; they are not shell commands.

| Network | Check | Observation in that dated check |
|---|---|---|
| BTC | `curl https://mempool.space/api/blocks/tip/height` | Tip `975170`. |
| ETH | `POST eth_chainId to https://ethereum.publicnode.com AND https://ethereum-rpc.publicnode.com` | `0x1` from both. The Sepolia control returned `0xaa36a7`. |
| TRON | `POST https://api.trongrid.io/wallet/getnowblock` with `{}` | Block `87,850,516`. |
| TON | `curl https://toncenter.com/api/v2/getMasterchainInfo` | `ok:true`, seqno `104342200`. |

The same dated verification record also logged ETH block number `0x1927bd0` = `26,377,168`, and TonAPI masterchain-head seqno `104342382`. These are observations, not acceptance thresholds.

### Bitcoin: primary endpoint, cross-check and fees

| Role | Service | Result checked 2026-11-09, `muse-vm` |
|---|---|---|
| Primary | `https://mempool.space/api` | Tip `975170`. |
| Cross-check | `blockstream.info` | Tip `975170`. |

The two recorded tips agreed. For the third source, `blockchain.info`, the record contains only HTTP `200`: its height was **not recorded**, so it must not be counted as agreeing with the other two.

`btc.com` produced HTTP `000` from `muse-vm` in that check. It was unreachable from that VM; this is not evidence that the service was dead. Leave it outside the endpoint table until freshly checked.

The draft BTC change is one URL literal at `app-web/src/connectivity.js:54`:

```text
https://mempool.space/testnet4/api
→ https://mempool.space/api
```

The fee path remains `/v1/fees/recommended`. It is identical on mainnet; only the base URL changes.

#### Keep the unresolved fee comparison visible

The **2026-11-09, `muse-vm`** same-time comparison was:

- mempool.space recommended `fastestFee 3 sat/vB`;
- blockstream.info `fee-estimates` returned `"1":0.972`, recorded as `BTC/kB` with an annotation of approximately `97 sat/vB`.

That disagreement is **unresolved**. The Blockstream unit annotation is not a reconciled conversion to build into the wallet. Keep both sources visible; never quote one alone.

**BTC payment gate.** At send time, re-check both sources. Prefer the **mempool.space recommended set** as the reference, without discarding the other result. Do not average the quotes or silently choose the higher quote. Apply these checks together:

- **Wrong network:** confirm the configured mainnet base against the replacement table and cross-check current mainnet data. A plausible height or HTTP success alone is insufficient.
- **Wrong address:** compare the complete destination with the intended recipient’s address.
- **Wrong amount:** review the payment amount, denomination and fee, including the fee units.
- **Stuck transaction:** resolve fee uncertainty before signing; a read-only response says nothing about submission or confirmation. Do not use a transfer or resend as a connectivity probe.
- **Theft:** keep recovery words and private keys out of endpoint URLs and requests. Reject any request for them.

**Stop before signing or submission** if a check fails or cannot be completed, the destination or amount is uncertain, the current fee quotes or their units cannot be reconciled for review, or an endpoint requests private signing material.

### Ethereum: provisional RPC order and mainnet history

The following order is **provisional and maintainer-chosen**, not a measured ranking:

| Order | RPC endpoint |
|---|---|
| Primary | `ethereum-rpc.publicnode.com` |
| Next candidate | `eth.drpc.org` |
| Next candidate | `1rpc.io/eth` |
| Next candidate | `eth-mainnet.public.blastapi.io` |

In the provider comparison **checked 2026-11-09 on `muse-vm`**, all four returned byte-identical values: block `26377173` and `gasPrice 0.13 gwei`. This is **not four independent confirmations**.

For corroboration, cross-check against **two demonstrably independent sources**. A different hostname and matching numbers do not demonstrate independence. Record why the chosen sources are independent before counting their agreement as corroboration. The supplied checks demonstrate **no verified independent pair**; selecting two entries from this table does not fill that gap.

The other results from the **2026-11-09 `muse-vm` checks** limit what belongs in the fallback list:

- The default Python `urllib` user-agent received HTTP `403` from six public RPCs. That client’s response is part of the observation, not a general availability result.
- Ankr returned HTTP `200` with JSON-RPC error `-32000` — key required. HTTP `200` alone is not a successful RPC result.
- Cloudflare answered `chainId` with `0x1`, but returned empty `blockNumber`, `gasPrice` and `feeHistory` results. On this evidence it supplied a chain-ID check only, not a full-wallet fallback.
- LlamaRPC returned Cloudflare `525` on three attempts. Keep it out pending retest.
- Etherscan pages returned HTTP `403` under bot protection. Their existence was not disproved. **Do not use Etherscan as a verification command.**

For mainnet history, use the replacement base:

```text
https://eth.blockscout.com/api/v2
```

The dated Blockscout check of `https://eth.blockscout.com/api/v2/blocks` returned HTTP `200`, with `base_fee_per_gas 126829043 wei` — approximately `0.127 gwei`. The form with `?limit=1` returned `422`; do not copy that query form. This history response does not establish an independent RPC pair.

### Ethereum: require chain ID 1 for every signing input

Before **every signing input**, query `eth_chainId` on the endpoint actually configured and require **`0x1` — decimal `1`**.

Any error or mismatch **blocks signing**, including Sepolia’s `0xaa36a7`. An empty or failed response must never default to `1`. Repeat the query for each input; a startup check is not enough.

Carry chain ID `1` explicitly in the signing input and **re-check that value offline**. Retain rejection of a signed chain-ID mismatch as well: checking the unsigned input does not replace checking the signed result.

Treat this as a per-input payment gate, not just an RPC test:

- **Wrong network:** require the live `eth_chainId` result and the explicit offline-reviewed chain ID to be `1`. Do not substitute a successful check against another hostname.
- **Wrong address:** compare the complete destination in the signing input with the intended recipient. An Ethereum address looks the same on mainnet and Sepolia; its appearance cannot identify the network.
- **Wrong amount:** check the intended value, ETH denomination and fee in the signing input.
- **Stuck transaction:** require usable block and fee data, not a chain-ID-only response, and keep the independent-source requirement visible. Read-only checks do not prove submission or confirmation; a transfer or resend is not a connectivity test.
- **Theft:** keep recovery words and private keys out of RPC and explorer requests, and reject unexpected signing inputs rather than approving them because the endpoint responded.

**Stop before creating or approving a signing input** if the chain query fails or differs from `1`, an input check is unresolved, usable fee data is missing, the required independent cross-check cannot be demonstrated, or private signing material is requested. Reject any signed result whose chain ID does not match.

#### Draft edits to review at this revision

Endpoint responses do not prove that these code changes have been made.

| Location | Required mainnet edit or behaviour |
|---|---|
| `connectivity.js:55-56` | Replace the Sepolia RPC URL with `https://ethereum-rpc.publicnode.com` and the Sepolia history base with `https://eth.blockscout.com/api/v2`. |
| `connectivity.js:60` | Replace the Sepolia chain-ID setting, `SEPOLIA_CHAIN_ID` with value `11155111`, with mainnet chain ID `1`. |
| `connectivity.js:99` | Invoke the chain check for every signing input; fail closed on any error or mismatch. |
| `tx.js:141` | Encode chain ID `1`. |
| `tx.js:160` | Retain rejection of a signed chain-ID mismatch. |

Keep `txMode 1` and `gasLimit "21000"` separate from the chain-ID migration. Neither setting substitutes for the network check.

The derivation path remains `m/44'/60'/0'/0/i`. Display **“Ethereum Mainnet (chain 1)”** and label balances **ETH**, not **“SepoliaETH”**. The network label and per-input chain check must do the work that the address’s appearance cannot.

### TRON — mainnet endpoint and identity checks

The mainnet HTTP endpoint is `https://api.trongrid.io`. In the **2026-11-09 check from `muse-vm`**, `wallet/getnowblock` returned block **87,850,516**. That is a dated observation, not a current head or an availability promise; repeat the read-only check when verifying connectivity.

The officially listed alternatives were JSON-RPC at `https://api.trongrid.io/jsonrpc` and gRPC at `grpc.trongrid.io:50051` and `grpc.trongrid.io:50052`. **Their liveness was not tested.** TronScan API DNS resolution failed twice from the VM during that check. Those failures were inconclusive: its status is **unverified-from-VM; re-check required**, not a confirmed general outage.

TRON has no chain ID: the signing input carries no network-identifier field. Network binding comes from the **chosen endpoint and the recent block referenced by the transaction**. Both need checking; an address alone cannot establish the network. The derivation path, `m/44'/195'/0'/0/i`, is identical on mainnet and Nile, and a TRX address carries no network tag. A Nile address shown to a mainnet sender is indistinguishable by inspection. Network identity therefore comes from wallet configuration. The QR payload is only the bare T-address; there is no `tron:` URI.

The activation figures verified in the **2026-11-09 check** were **1 TRX for system-contract creation plus 0.1 TRX for creation-bandwidth**. These are dated figures, not a suggested funding amount. **Who pays, and whether first funding auto-activates an account, were unverified.**

Before any prospective send, check all five loss modes: **wrong network, wrong address, wrong amount, stuck transaction and theft**. Confirm the wallet’s mainnet endpoint and the recent-block reference. Independently confirm the complete intended recipient T-address, then require a **read-only `wallet/getaccount` check of that recipient on the same mainnet endpoint**. Verify the intended amount and current applicable charges separately; do not turn the dated creation figures into a transfer amount. Require successful fresh reads and an understood recipient account state, and do not repeat a transfer whose outcome is unknown. Keep mnemonics and signing keys out of endpoint requests, explorers and QR tools. **Stop without signing** if the network, recipient, amount, charges, activation requirements or transaction status remain unresolved, or if a service asks for wallet secrets. Do not send funds as a connectivity or activation test.

### TON — mainnet endpoint and identity checks

The mainnet Toncenter read-only endpoint is `https://toncenter.com/api/v2/getMasterchainInfo`. In the **2026-11-09 check from `muse-vm`**, it returned `ok: true` with masterchain seqno **104342200**. The TonAPI masterchain-head check returned seqno **104342382**. These are historical head observations, not fixed values to match in later checks. Obtain a fresh masterchain response from the configured mainnet endpoint, then check the address and wallet identity separately.

During that dated check, Toncenter returned **429** after rapid calls; a retry after **45 s** succeeded. That delay was an observed recovery, not a request limit or a promised waiting time. Back off on 429 responses and increase the spacing between **read-only** retries rather than continuing a rapid loop.

The address forms verified in that check were all CRC-valid encodings of the same account hash in workchain **0**:

- `UQ` — `0x51`, non-bounceable mainnet.
- `EQ` — `0x11`, bounceable mainnet.
- `kQ` — `0x91`, bounceable testnet.
- `0Q` — `0xd1`, non-bounceable testnet.

A matching hash and valid CRC do not make these interchangeable receiving labels. The docs warn that sending real funds to a testnet variant loses them. They also warn that a non-bounceable transfer to a wrong address can leave funds inaccessible.

The wallet configuration verified in the **2026-11-09 check** was **Wallet V4 R2**, with wallet ID **698983191 (`0x29A9A317`)**. Setting `walletId` to `0` derived a different address, beginning `0:7bd45095…`. Funds sent there are invisible in the intended wallet; the wallet ID is part of the identity check, not an optional display setting.

For reference only, the fixture `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` was an **ACTIVE mainnet Wallet V4 R2** in the **2026-11-09 `muse-vm` check**, with balance **0** and last activity **2023-12-01**. Zero balance does not mean undeployed.

Before issuing receiving instructions or considering a send, check all five loss modes: **wrong network, wrong address, wrong amount, stuck transaction and theft**. Receiving instructions must use the intended wallet’s **UQ form** and require **workchain 0**. Confirm the mainnet endpoint, CRC, complete account hash, Wallet V4 R2 and the wallet ID above against the intended wallet configuration; independently confirm the complete recipient address. Do not substitute a testnet form, and **never fund the fixture above**. Verify any proposed amount against the intended payment. Require a fresh successful masterchain seqno read; back off read-only checks when throttled, and do not repeat a transfer whose outcome is unknown. Keep mnemonics and signing keys out of endpoint requests and checking services. **Stop before sharing receiving instructions if wallet or address identity is unresolved; stop before signing if the network, address, amount, head check or prior transaction status is unresolved, or if a service asks for wallet secrets.**

### The draft retargeting checklist (file:line)

This checklist covers the Web draft in `Pr3eve6ti2o/bawa@56396a20`, checked **2026-11-09** on `muse-vm`. It describes the changes needed, not a completed mainnet retarget.

1. **Change the endpoint defaults — `src/connectivity.js:53-58`.**  
   At that check, all defaults in this block selected testnet. Mainnet endpoint edits must be made in `src/connectivity.js`: `.env.example` is **not a working override** for this draft. Editing the example environment file does not retarget the Web lane.

2. **Inventory metadata consumers before changing labels.**  
   Trace `testnet4`, `sepolia`, `nile` and `ton-testnet` to their consumers. Record what each use controls and whether it needs changing for mainnet. Do not blanket-rename these labels. Changing metadata alone does not activate mainnet.

3. **Keep the existing derivation prefixes.**  
   These prefixes are already mainnet:

   | Network | Existing prefix |
   |---|---|
   | BTC | `m/84'/0'` |
   | ETH | `m/44'/60'` |
   | TRX | `m/44'/195'` |
   | TON | `m/44'/607'` |

   The scope here is generation only: a single deposit address, with no xpub workflow. **The testnet4 derivation deviation disappears on mainnet.** Do not “fix” these paths as part of the retarget.

4. **Bypass `toTestnetAddress()` on mainnet BTC flows.**  
   The draft’s conversion re-encodes the address to `tb1q`. A mainnet `bc1q` address must stay `bc1q`; bypass the conversion rather than altering an address prefix by hand.

**Money-movement boundary.** The loss modes are **wrong network, wrong address, wrong amount, stuck transaction and theft**. Before any money movement, cross-check the intended mainnet against the edited endpoints and their metadata consumers; verify the complete destination address against the intended recipient and check the exact amount. A label or address prefix alone is not enough. Keep mnemonics and keys undisclosed, and establish how transaction status will be checked. Stop if the network, address or amount is uncertain, if status cannot be established, or if key exposure is suspected. Do not use a transfer as a connectivity test, or retry a stuck or unresolved transaction to see whether the endpoint works.

### Confirmation policy as configured policy

The following values were recorded in the **Android draft configuration**, checked **2026-11-09** on `muse-vm`. They are configured policy, **not demonstrated enforcement**. They do not establish that the Web draft implements a confirmation gate.

| Network | Configured threshold at that check | Policy interpretation |
|---|---:|---|
| BTC | 6 | A customary threshold, not a network requirement. Show the actual confirmation count. At `C=1`, display the payment provisionally as **“unconfirmed for settlement”**. |
| ETH | 12 | Configured threshold only; enforcement has not been demonstrated. |
| TRX | 19 | Use the node’s solidified / last-irreversible view, never elapsed time or raw height subtraction. |
| TON | 1 | Masterchain-anchored; track `seqno`, not wall-clock time. |

An API’s current block height is not a confirmation policy. Retargeting an endpoint does not demonstrate that these rules are enforced. Confirmations reduce reversal risk; they do not make a payment irreversible.

### The fail-closed operating gate

The whole send path is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. The loss modes are **wrong network, wrong address, wrong amount, stuck transaction and theft**. A separately authorised, reviewed small-amount rehearsal is required before real funds move; this section supplies no rehearsal procedure. Pin the expected mainnet and never silently fall back to testnet or another chain. Refresh the required inputs and verify the destination, asset, integer amount, fee bounds and total debit before signing. Keep secrets local: providers must never receive seed phrases or private keys. Stop before signing or submitting if the rehearsal requirement is unmet, the network is wrong or unconfirmed, required inputs cannot be refreshed, any check fails or remains unresolved, or a provider asks for a secret.

Any later attempt still carries **wrong network, wrong address, wrong amount, stuck transaction and theft** risks; it must pass the same refreshed checks, with secrets kept local. Submission acceptance, inclusion, execution success and finality are distinct: acceptance does not establish the other three. A broadcast timeout means **UNKNOWN**, not confirmed failure. Reconcile by transaction ID (txid) before any retry. Never retry an ambiguous submission blindly, and never auto-create a replacement. TRX has no txid lookup adapter: manual refresh only, with no supplied manual investigation procedure. Stop while the outcome is ambiguous or cannot be reconciled; a refresh alone is not permission to retry.

Creating a wallet needs no paid service. A paid RPC tier is an optional upgrade, never a requirement. Explorer paid-plan prices are **UNVERIFIED** and are not quoted here.

### First funding

There are no mainnet faucets. First mainnet funding is an ordinary incoming transfer of the appropriate native asset from existing holdings, or a withdrawal following legitimate acquisition through a service you choose.

Funding carries **wrong network, wrong address, wrong amount, stuck transaction and theft** risks. Before authorising a transfer or withdrawal, pin the expected mainnet, refresh the required inputs and verify your receiving address, the appropriate native asset, integer amount, fee bounds and total debit. Keep seed phrases and private keys local; providers must never receive them. Stop if the rehearsal requirement is unmet, a check fails or cannot be completed, or a provider requests a secret. A timed-out broadcast is **UNKNOWN**: stop and apply the txid-reconciliation rule above, including the TRX limitation, rather than making another transfer. Never fund a published fixture address. The addresses below belong to the public 15-word ripple test vector and must never receive real funds; stop if any appears as the destination.

| Chain | Published fixture address — never fund |
|---|---|
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` |
| TRX | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` |
| TON | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

### Gaps to register

- M-13, M-14, M-17 — Per-chain network pins, required refresh inputs, fee bounds and finality criteria.
- M-04, M-28 — TRX timeout handling: no txid lookup adapter; manual investigation procedure not supplied.
- M-35 — Separately authorised, reviewed small-amount rehearsal: scope and recorded outcome.
- M-43 — Explorer paid-plan links and price verification; prices UNVERIFIED and omitted.

## 12. Wallet tracking and payment monitoring

These are the mainnet observation steps for `Pr3eve6ti2o/bawa` at `56396a20`, adapting `docs/06` and `docs/07`.

All recorded results below were checked on **2026-11-09 on `muse-vm`**. Heights, balances and service responses belong to that check, not to subsequent runs. The addresses shown are published mainnet fixtures, not destinations for payments.

### Watch-only derivation and its defects

The approved receiving paths are:

| Chain | Mainnet receiving path | Required account-public-node prefix |
|---|---|---|
| BTC | `m/84'/0'/0'/0/i` | `zpub` |
| ETH | `m/44'/60'/0'/0/i` | `xpub` |
| TRX | `m/44'/195'/0'/0/i` | `xpub` |

The testnet4 deviation does not apply on mainnet: importing a Bawa mainnet mnemonic into a standard mainnet wallet derives the same account. That is a compatibility statement, **not a watch-only setup step**. Never enter a mnemonic or private key into these watch-only tools.

The 2026-11-09 run used the repo tools at `56396a20` in a scratch copy, with `npm install` run first. A fresh clone does not contain `node_modules`. Using the published ripple-fixture account-0 public nodes, index 0 reproduced exactly:

| Chain | Observed index-0 address | Exit |
|---|---|---|
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | 0 |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | 0 |
| TRX | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | 0 |

Those successful fixture checks do not remove **OI-096**, which remains unfixed:

- `derive.js` ignores the purpose, coin type and account components of a supplied path. A mismatched path can therefore produce a valid-looking address on the wrong branch and still exit 0.
- `compare.js` accepts a private extended key and silently prints wrong addresses, also with exit 0. **Never feed any private key to `compare.js`.**

Exit 0 and a plausible-looking address prove nothing about whether the intended branch or destination was used.

**Every derived BTC, ETH or TRX address must match an independent `bip_utils` derivation before it is trusted or used.** Use public material only, the intended chain, the approved account-0 path, receiving branch 0 and the same index. Compare the complete addresses, not shortened display forms. Checking only index 0, or checking one address from a batch, is not sufficient. `compare.js` is not a substitute for this independent check.

Both implementations must also start from an independently checked public node. Matching results from a substituted public node would still direct payments to the wrong recipient.

#### Public-only input and output contract

- **Check the prefix before derivation:** BTC requires `zpub`; ETH and TRX require `xpub`. A prefix alone does not establish the coin or account. Reject anything else, including testnet `vpub` and `tpub`, before invoking the tool. Those testnet inputs trigger an opaque WASM abort with exit 1; do not feed them in as a network test.
- Supply the public node through **stdin, never argv**. The single-address stdin limit is **200 characters including the trailing newline**, not 200 characters plus a newline.
- The single-address interface uses exit **2** for usage or read errors, **1** for derivation or validation failure, and **0** for success with a bare address. A zero exit still requires the independent comparison above.
- For the daemon, wait for its first output line, `{"ready": true}`, before sending requests. Requests are JSONL objects with the fields `chain`, `xpub` and `index`; the `xpub` field carries the BTC `zpub` as well. `index` must be an integer from **0 to 2147483647**, inclusive.
- Path selection is fixed by chain, not caller-configurable. Do not try to select another purpose, coin or account by supplying a different path.

Stop on any error, missing address, unexpected prefix, unverified public-node source or independent mismatch. Do not work around a failure by accepting whichever output looks plausible.

Before handing out or using a derived address, check the complete destination against the independently verified public-node source, and check the intended mainnet chain, asset and amount against the payment record. A **wrong address, wrong network or wrong amount** can misdirect funds; a **misleading status can prompt a duplicate payment**; and **substituted destinations can cause theft**. Address derivation establishes neither an amount nor payment status. Stop if any of those details is uncertain, and do not send another payment to compensate for missing watch-only output.

**TON is generation-only in this repo.** It provides one deposit address from `m/44'/607'/0'`, using Wallet V4 R2 and wallet ID `698983191`. There is no TON xpub and no TON watch-only derivation tool. There is no indexed TON receiving-address workflow to demonstrate here.

### Xpub privacy

An xpub or zpub is **sensitive public material**. Anyone holding it can see every past and future receiving address covered by that node and the full receiving history. Disclosure exposes that history; it does not grant spending authority.

Restrict access to recipients permitted to see the complete receiving history. Keep public nodes out of public commits, issue reports, screenshots and shared diagnostic material. Do not assume these tools redact them.

Address queries disclose information too. Every lookup tells the explorer or provider operator that someone is watching that address. Repeated lookups from one IP link the queried addresses together. The examples below are targeted checks, not a default design for systematic whole-wallet polling through a single public provider.

### Per-chain observation routes

The commands below make read-only requests. Each block uses `set -eu` to stop on command failures, including HTTP failures detected by `curl -f`. **An HTTP 200 response can still contain an API error.** Inspect the response body; an error, missing result or unreadable response is a failed lookup, not an empty account.

#### BTC — Esplora, with a mempool.space comparison

Blockstream Esplora is the documented route. mempool.space was used for the dated tip and address comparison.

The address URLs below disclose the watched address to each operator. Repeated requests from one IP link the addresses queried; using two providers discloses the query to both. Keep this as targeted observation rather than whole-wallet polling.

**Payment check:** a wrong address, wrong network or wrong amount can misdirect funds; a misleading status can prompt a duplicate payment; a substituted destination can cause theft. Match the full address to your independently verified mainnet record, retain the mainnet endpoints, and check the expected amount in satoshis separately from the account balance. Do not adopt a destination from an explorer page. Stop on a mismatch, suspected substitution, lookup failure or unresolved transaction status; a zero balance is not a reason to resend.

```sh
set -eu
BTC_ADDRESS='bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd'

curl -fsS -w '\n' \
  'https://blockstream.info/api/blocks/tip/height'

curl -fsS -w '\n' \
  'https://mempool.space/api/blocks/tip/height'

curl -fsS -w '\n' \
  "https://blockstream.info/api/address/${BTC_ADDRESS}"

curl -fsS -w '\n' \
  "https://mempool.space/api/address/${BTC_ADDRESS}"

# First confirmed-history page.
curl -fsS -w '\n' \
  "https://blockstream.info/api/address/${BTC_ADDRESS}/txs/chain"

# Address mempool view; capped and unpaginated.
curl -fsS -w '\n' \
  "https://blockstream.info/api/address/${BTC_ADDRESS}/txs/mempool"
```

On **2026-11-09, `muse-vm`**, both providers returned tip **975170** and identical fixture address JSON:

- `chain_stats.funded_txo_count`: **16**
- `chain_stats.funded_txo_sum`: **311775 sats**
- `chain_stats.spent_txo_count`: **16**
- `chain_stats.spent_txo_sum`: **311775 sats**
- `chain_stats.tx_count`: **32**
- Address mempool: **empty**

The confirmed-balance calculation is:

```text
chain_stats.funded_txo_sum - chain_stats.spent_txo_sum
```

For that dated response, it was `311775 - 311775 = 0` sats. This fixture had real mainnet history despite being empty at the check. **An empty address is not necessarily an unused address.**

Confirmed history is paginated at **25 transactions per page**. To continue, set `LAST_CONFIRMED_TXID` to the final transaction ID from the preceding confirmed-history page, then request:

```sh
set -eu
BTC_ADDRESS='bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd'

curl -fsS -w '\n' \
  "https://blockstream.info/api/address/${BTC_ADDRESS}/txs/chain/${LAST_CONFIRMED_TXID:?Set this from the preceding confirmed-history page}"
```

Do not treat the first page as complete history. The mempool route returns at most **50** transactions and has no pagination; its capped response must not be presented as exhaustive.

Apply confirmation policy only to an identified payment whose destination and amount have been checked—not to a tip height or aggregate address balance. **C=1** permits a provisional display labelled **“unconfirmed for settlement”**, with the actual confirmation count shown. Acceptance and settlement use **C=6**, a customary threshold chosen for this guide, not a network requirement.

Reaching six confirmations does not make reorgs impossible. After a reorg, stop using affected records for settlement, recheck them and rebuild derived totals. Provider agreement at one check establishes neither independent address derivation nor permanent payment finality.

#### ETH — chain and balance checks; history remains open

The PublicNode requests check chain identity and the fixture’s balance. The Blockscout request below is statistics-only. The Etherscan V1 request is a failure demonstration, not a working history route.

The balance and history requests disclose the address to their operators. Repeated requests from one IP link queried addresses together; do not turn these examples into default whole-wallet polling.

**Payment check:** a wrong address, wrong network or wrong amount can misdirect funds; a misleading status can prompt a duplicate payment; a substituted destination can cause theft. Match the complete address against your independently verified record, require the RPC chain check to return `0x1`, and check the intended ETH amount and units against the payment record. An account balance is not a transfer amount. Stop on a chain mismatch, changed destination, amount ambiguity, RPC error or missing result. Do not resend because a balance is zero or a history lookup fails.

```sh
set -eu

curl -fsS -w '\n' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  'https://ethereum-rpc.publicnode.com'

curl -fsS -w '\n' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"eth_getBalance","params":["0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7","latest"]}' \
  'https://ethereum-rpc.publicnode.com'

# Statistics only: not an account or history check.
curl -fsS -w '\n' \
  'https://eth.blockscout.com/api/v2/stats'

# Retired unauthenticated V1 route: failure demonstration only.
curl -fsS -w '\n' --get \
  'https://api.etherscan.io/api' \
  --data-urlencode 'module=account' \
  --data-urlencode 'action=txlist' \
  --data-urlencode 'address=0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7'
```

On **2026-11-09, `muse-vm`**, PublicNode returned `eth_chainId = 0x1` and fixture `eth_getBalance = 0x0`. The empty balance was expected for this test vector. It did not establish absent history or the status of a particular payment.

The Blockscout `/api/v2/stats` route was live at that check. It is **STATISTICS-ONLY**: this result does not verify Blockscout’s account or history service.

Unauthenticated Etherscan V1 is retired. The dated check returned HTTP 200 with `"status":"0"`, `"message":"NOTOK"` and a result beginning:

```text
You are using a deprecated V1 endpoint…
```

Recognise `status "0"` / `NOTOK` as a **failed lookup**, never as zero balance or absent history. `curl -f` cannot detect this application-level failure from the HTTP status alone.

**The ETH history route remains open.** Etherscan V2 requires an API key and was not live-tested here; it is not an established fallback in this guide. If a payment decision requires history or transaction status that these checks do not establish, stop rather than infer receipt, absence or a need to pay again.

#### TRON — head and account observations, not transfer reconciliation

The Trongrid request observes the node’s head. The Tronscan account request observes account data, including token holdings.

The account lookup tells Tronscan’s operator which address is being watched. Repeated lookups from one IP link the queried addresses. Keep this as a targeted account check, not systematic whole-wallet polling.

**Payment check:** a wrong address, wrong network or wrong amount can misdirect funds; a misleading pending status can prompt a duplicate payment; a substituted destination can cause theft. Match the full address to your independently verified TRON mainnet record. Keep native TRX and each TRC-20 asset distinct, and establish the intended asset, amount and units before using a balance in a payment decision. Stop if the network, destination, asset mapping, amount or status is unresolved; do not copy a replacement destination from account data or send again to clear “pending”.

```sh
set -eu

curl -fsS -w '\n' \
  -H 'Content-Type: application/json' \
  --data '{}' \
  'https://api.trongrid.io/wallet/getnowblock'

curl -fsS -w '\n' --get \
  'https://apilist.tronscanapi.com/api/account' \
  --data-urlencode 'address=TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c'
```

On **2026-11-09, `muse-vm`**, `getnowblock` returned block **87850524**. The Tronscan account API returned live TRC-20 balances for the fixture. No token amounts, response-field mappings or history-pagination procedure are established here. A token holding is not a native TRX holding, and neither is a receipt for a particular transfer.

The confirmation policy is **19**, established using the node’s **solidified / last-irreversible view**—never elapsed time or raw height subtraction. The head and account requests above do not establish that condition for a transfer.

The draft has **no TRX txid lookup adapter**. A TRX transfer therefore stays pending on manual refresh. No manual investigation procedure is supplied here. That unresolved state is a stop condition for reconciliation, not evidence that another payment is needed.

#### TON — one generated address; no automatic reconciliation

Observe the single generated TON deposit address, not an imagined xpub-derived address series. Its generation parameters are `m/44'/607'/0'`, Wallet V4 R2 and wallet ID `698983191`.

The Toncenter address request discloses the watched address to its operator. Repeated requests from one IP link queried addresses together. Do not use this example as a default whole-wallet polling loop.

**Payment check:** a wrong address, wrong network or wrong amount can misdirect funds; a misleading status can prompt a duplicate payment; a substituted destination can cause theft. Match the complete deposit address and mainnet wallet parameters against the original generation record, and check the intended amount and units separately. Do not adopt an address from an explorer response. Stop on any mismatch, failed response, uncertain amount or unverified payment status; neither a zero balance nor an unresolved status justifies another payment.

```sh
set -eu

curl -fsS -w '\n' \
  'https://toncenter.com/api/v2/getMasterchainInfo'

curl -fsS -w '\n' --get \
  'https://toncenter.com/api/v2/getAddressInformation' \
  --data-urlencode 'address=UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn'

# Head check only.
curl -fsS -w '\n' \
  'https://tonapi.io/v2/blockchain/masterchain-head'
```

On **2026-11-09, `muse-vm`**, Toncenter `getMasterchainInfo` returned `ok:true` and masterchain seqno **104342254**. `getAddressInformation` for the fixture returned `ok:true`, balance `"0"` and a present `last_transaction_id` field.

The presence of `last_transaction_id` was **not verified history**. It establishes neither a complete transaction list nor receipt of a particular payment. Likewise, `ok:true` reports a successful API response, not payment acceptance. TonAPI’s masterchain-head route is a **head check only**, not account, history or payment verification.

The confirmation policy is **1 masterchain seqno**: a TON payment is treated as confirmed once a masterchain block references the shardchain block containing the transaction, and the transaction's outgoing message is verified as successful (delivered, not bounced, not failed). Count masterchain seqno progression from inclusion, not the wallet's account seqno — which advances on every outgoing message the wallet sends — and not wall-clock time. Observing a masterchain head alone does not establish that a payment is anchored. This is a confirmation policy, not a finality guarantee. TON confirmation tracking is not implemented in the drafts, so this check is manual.

**TON reconciliation can never be automatic in this draft:** `tx.js:320` leaves `txid` as `null`. A live head, a balance response or a present `last_transaction_id` does not remove that blocker. Leave an unverified payment unresolved rather than treating these observations as a receipt or a reason to resend.

### Shared explorer rules

Explorers are conveniences, not the canonical database. Use their responses as observations to check independently against the blockchain. Compare the full reported address and chain/network with the intended request: a plausible result for the **wrong address or wrong network** is still the wrong evidence. An address balance is not a wallet total; a wallet has many addresses. Neither a balance nor a holdings screen proves that a particular request was paid. Stop if the address, network or meaning of an amount cannot be established.

Keep mempool and confirmed records, including their totals, separate. Mempool activity is unconfirmed. A transaction disappearing from a mempool response is **not confirmation**: investigate rather than declaring success or sending again. An unresolved or stuck transaction can become a **duplicate payment** if retried on that basis. Failed, incomplete or conflicting lookups remain unresolved and are never grounds to resend. Stop automatic settlement decisions until the conflict or missing evidence is resolved.

Keep these provider claims separate: “responded in this check”, “free”, “keyless” and “allowance verified”. The first does not establish the other three. Keep any required provider credential outside source control, browser code and logs. A lookup must not become a route to **theft through a substituted destination or a request for wallet secrets**. Stop if it changes the intended recipient or asks for secrets.

The public-data check dated **2026-11-09, `muse-vm`**, reported 32 confirmed transactions for the BTC research fixture, with **311,775 sats funded and 311,775 sats spent**. The funded total was historical activity, not a fresh receipt. ETH, TRX and TON balance observations from that check did not attribute payments to requests. These checks supported observation, not ownership or a tested settlement policy. All fixture addresses are **research fixtures, not payment destinations**. Copying one into a request creates a wrong-address loss: stop if a fixture has replaced the intended recipient.

### Payment requests and the network check

A payment request is not a payment. Retain the request separately from the later on-chain observation, and verify any claimed payment independently against the blockchain. Treating a request as a receipt creates a wrong-amount decision; issuing another request does not establish whether an earlier transfer is pending, stuck or complete. Stop before treating either as paid or asking for another send while that status is unresolved.

Before sharing a request, require these six fields:

1. **Network** — the intended mainnet.
2. **Asset** — an unambiguous asset identity.
3. **Recipient** — the full intended receiving address.
4. **Amount in atomic units** — not an unlabelled display amount.
5. **Memo/tag** — where the chain supports one, with applicability made explicit.
6. **Expiry** — an explicit expiry for this request.

Token payments also require a seventh field: **expected decimal precision**.

A ticker is only a label. Unrelated contracts can share a symbol, even on the same network. For a contract-based asset, identify the intended contract on the intended network. Missing or ambiguous fields can cause a **wrong-address, wrong-network or wrong-amount payment**. Reject the request rather than filling gaps with defaults.

Check the network **before sharing**:

- **ETH:** mainnet chain ID is `1`. Include `@1` in the ERC-681 payload; the QR form below remains an unverified target.
- **BTC:** do not infer the network from the URI alone. Check both the address prefix and the wallet configuration.
- **TRX:** check the wallet’s configured network. Never infer it from the address.
- **TON:** compare the full intended mainnet address presentation, not merely a familiar-looking address body.

Compare the recipient and amount with the intended request as well as completing these network checks. Stop before sharing or sending if any comparison fails. Do not accept a substituted destination or disclose wallet secrets to “complete” the request: those are routes to theft. If a previous transfer may already exist, investigate it rather than making a duplicate payment.

Record the **requested network** in the payment record and retain the **observed chain/network** alongside later payment evidence. A mismatch remains unresolved; it is not a reason to resend on another network.

### QR forms as unverified targets

`docs/07 §11` is testnet-only. Do not reuse its table as mainnet guidance.

Every form below is **UNVERIFIED-NEEDS-CHECK**: a research target, not a finding of live wallet support. The forms and amount fragments are not a validated URI-construction recipe.

| Network | Research target | Optional amount fragment to check |
|---|---|---|
| BTC | `bitcoin:<ADDRESS>` — BIP-321 | `&amount=<BTC>` |
| ETH | `ethereum:pay-<ADDRESS>@1` — ERC-681 | `?value=<WEI>` |
| TON | `ton://transfer/<UQC7...>` | `?amount=<NANOCOINS>` |
| TRX | Bare `T...` address; no `tron:` URI exists | No amount form established here |

For each target, generate the QR, decode it, and compare the **full address**, plus the amount where supplied, against the intended request. Confirm the wallet’s configured network before any send. This is the local check against **wrong-address, wrong-network and wrong-amount payments**, including theft through a substituted QR destination. Stop if decoding, comparison or wallet interpretation is unresolved, if the destination changes, or if a tool asks for wallet secrets. A successful decode alone does not establish live wallet support.

An address-only QR does not supply the asset, amount, memo/tag, precision or expiry. Check those separately against the retained request; do not let the wallet fill missing request fields by assumption. The BTC amount fragment uses BTC display units, whereas the request amount is in atomic units, so the conversion needs an explicit unit check.

**Token-payment QR encoding and token-precision validation remain open.** Do not treat these forms as token-payment support. Stop before sending while the required encoding, precision or request fields remain unverified.

Another scan-and-send attempt is not a way to resolve a pending or stuck transaction. Investigate the earlier attempt first; otherwise the result may be a duplicate payment.

### Reconciliation

#### Attribution

Prefer a distinct receiving address for each request. Where an address is shared, require the supported memo/tag. If that cannot be required and matched, use a unique address instead. This prevents a receipt being assigned to the wrong request; it does not repair an already ambiguous payment. Stop at `manual_review` rather than guessing attribution or asking for another send.

Before adding any amount, match:

- the requested network and observed chain/network;
- the asset identity, including the contract on that network where applicable;
- the full recipient;
- the applicable memo/tag.

A **wrong-address or wrong-network observation**, or an unrelated asset with the same ticker, must not enter the request’s amount total. A balance or holdings screen cannot substitute for this matching process. Stop on a missing, ambiguous or conflicting match. Do not accept a replacement destination or a request for secrets as a way to resolve it: that introduces theft, not attribution evidence.

#### Summing and deduplication

Sum only matching payments towards the deposit, and count each payment evidence item once. A re-delivered event is the same evidence item, not another amount.

For an expected **100 atomic units**, matching amounts of **60 + 40 = 100** illustrate the arithmetic. These numbers are not a mainnet limit, a confirmation threshold or a `paid` decision.

Treat any difference between the confirmed matching total and the requested amount as a **discrepancy**. Retain the difference for review; do not silently change the request, treat the amount as equal or send a guessed remainder. These checks prevent wrong-amount accounting and duplicate payment. Stop automatic `paid` assessment while the discrepancy is unresolved.

Keep pending and confirmed records and totals separate throughout this calculation. Do not add a mempool total to a confirmed total to manufacture a receipt. If pending evidence disappears, investigate the unresolved or stuck transaction; do not count it as confirmed and do not automatically resend.

#### The `paid` policy gap

Observation and request-status labels are not the application’s `paid` decision. Retain these distinctions without presenting them as a tested Bawa mainnet state machine:

| State | Meaning to retain |
|---|---|
| `seen` | Observed, possibly in a mempool; inclusion has not been established. |
| `included` | Inclusion has been observed in an identified block, slot or ledger. |
| `confirmed` | The evidence meets an explicitly stated confirmation criterion; retain the criterion and evaluated evidence. |
| `finalized` | The evidence meets an explicitly stated finality criterion, distinct from merely being seen or included. |
| `reorged` | Previously retained inclusion evidence is no longer canonical. |
| `expired` | The request’s expiry has been reached; this does not prove that no payment exists or can arrive later. |
| `late` | An attributed payment falls after expiry under the timing basis that the policy must define. |
| `manual_review` | Attribution, evidence, timing or an amount discrepancy remains unresolved and must not produce automatic `paid`. |

A mainnet policy must explain how correctly attributed, deduplicated payments reach `paid`. For a matching total, that requires checked units, current canonical evidence meeting the policy’s confirmation or finality requirements, and resolved expiry and late-payment conditions. The decision must retain its policy version and reason. A wrong address or network cannot be cured by more confirmations, and a wrong amount cannot be cured by a favourable balance screen.

`docs/07`’s BTC **1/3/6** bands are **ILLUSTRATIVE application policy, not Bawa’s policy**. Do not transplant them into mainnet operation. The actual mainnet thresholds and transitions remain open. Until they are defined, stop at recording observations and review rather than enabling automatic `paid`.

A discrepancy or an unresolved transaction does not authorise another payment. Retrying a pending or stuck transfer risks duplication; switching destinations or supplying secrets during review risks theft. Stop those actions rather than treating them as settlement checks.

#### Reorgs, expiry and late payments

Retain a decision history, not a single confirmation counter. For each assessment, preserve:

- block, slot or ledger identity;
- canonicality;
- evaluated confirmation evidence;
- policy version;
- decision reason.

When evidence becomes `reorged`, preserve the earlier decision, including an earlier `paid` decision if one was made, and append the new assessment. Do not continue presenting non-canonical evidence as current confirmation. Re-evaluate the affected total and flag the decision for review. The mainnet policy still has to define the resulting application transition.

This prevents a wrong current amount being hidden by an overwritten history. A reorg also does not authorise a replacement send: that may duplicate a payment whose status is still unresolved. Stop automatic success or resend actions while the evidence or policy response is unresolved.

Retain expired requests and their associated evidence. A correctly attributed late payment must remain recorded as late, not disappear from the record or silently become `paid`. The policy must define expiry handling and what happens to late payments; those transitions remain open. Until then, stop at review. Neither expiry nor a late observation proves that an earlier transaction failed, so neither justifies another send.

Review must continue to use the retained recipient and requested network. A substituted address or network creates a new wrong-destination risk, and a request for wallet secrets creates a theft route. Stop rather than accepting either as a resolution.

#### Unit checks and the retained settlement line

Check whether every amount is in **atomic units or display units** before comparing or summing it. Confusing the two can multiply the amount by `10^decimals`. For tokens, retain the expected decimal precision and do not infer it from the ticker or a wallet default. Token-precision validation remains open here; stop amount-dependent decisions while it is unresolved.

Keep the requested amount and matching receipt total identifiable on the retained settlement line, and record **actual fees and net value**, with explicit units, against that line. Do not silently substitute a net figure for the requested amount or invent a fee to explain a discrepancy. Stop if the units, fees or net value cannot be reconciled.

These are wrong-amount checks, not permission to change the recipient or network. Do not “fix” a difference by accepting a substituted destination, disclosing secrets or sending a guessed top-up. Those actions can introduce theft or turn an unresolved, possibly stuck transaction into a duplicate payment.

### The five-group payment record

A TXID is not a complete payment record. A reader-owned record needs to connect the request, observed event, matching decision, reconciliation and credit through to the retained settlement-line record.

The copyable outline below is a **guide record format, not a Bawa API schema**. It does not claim that Bawa stores or exports every field.

Using a record to accept, credit or settle a payment brings these loss modes: **wrong address, wrong network, wrong amount, duplicate payment, stuck transaction, and theft via substituted destinations or requests for secrets**. Compare the observed recipient, network, asset, amount and memo/tag with the retained request; check its expiry and policy version. Check event identity and previous acceptance or credit using the deduplication and idempotency keys: a repeat observation is not another payment. Check current canonicality and confirmations against the recorded policy. An unresolved or stuck transaction is not grounds for another payment. Refuse substituted destinations and requests for secrets. **Stop before acceptance, credit or settlement if details conflict, the event or policy decision cannot be established, or a destination is substituted or secrets are requested.**

```text
GUIDE RECORD FORMAT — reader-owned; not a Bawa API schema

1. Request
   Network:
   Asset:
   Recipient:
   Amount:
   Memo/tag:
   Expiry:
   Policy version:

2. Observation
   TXID:
   Chain/network:
   Output/log identity:
   Cursor:
   Block/slot/ledger identity:
   Canonicality status:
   Payer:
   Recipient:
   Asset:
   Amount:
   Memo/tag:

3. Match decision
   Request–event link:
   Deduplication key:
   Evaluated confirmations:
   Status (accepted / rejected / pending):
   Reason:
   Policy version:

4. Reconciliation/finalisation
   Accepted event set:
   Total:
   Database before values:
   Database after values:
   Discrepancy:
   Repair:
   Resulting status:
   Decision reason:

5. Credit and settlement
   Credit ID:
   Idempotency key:
   Journal amount:
   Journal asset:
   Reversals/adjustments:
   Allocation to retained settlement-line record:
     Retained record reference:
     Allocation:
     Fees:
     Net value:
```

Seeds, mnemonics, private keys and xpubs/zpubs have no place in this record. This is a field outline, not a storage implementation: **storage format, export procedure, retention duration and a completed example remain open**.

### History labels and the timeout rule

These are the required meanings of the history labels, **not verified guarantees about the Web implementation**.

| Label | Required meaning |
|---|---|
| **Broadcast** | Submission acknowledged for relay, not confirmation. |
| **Pending** | Awaiting established inclusion. |
| **Included** | Observed in an identified block currently on the canonical chain. |
| **Confirmed** | The stated confirmation policy is currently met. This represents increasing confidence, not irreversibility. |
| **Failed** | Positive failure evidence, not a transport timeout. Where execution failed, the record still retains inclusion and fee information. |
| **Replaced** | Positively established supersession by an identified transaction, with the two records linked. This label does not authorise replacement. |
| **Dropped** | Evidenced removal or expiry under sourced, chain-specific criteria. Absence from a response is not enough, and the label is not permission to resend. |
| **Unknown** | Available evidence cannot establish the outcome. An unchanged old status is not fresh verification. |

**Included, Confirmed and execution outcome must remain visibly distinct.** Inclusion or confirmation does not, by itself, establish execution success. An execution failure does not erase inclusion or fee information.

**A broadcast timeout means Unknown.** Acting on history carries the loss modes **wrong address, wrong network, wrong amount, duplicate payment, stuck transaction, and theft via substituted destinations or requests for secrets**. Reconcile by TXID before any retry, checking the observation against the retained request’s recipient, network, asset, amount and memo/tag, and against events already accepted or credited. Do not use an unresolved or stuck outcome as a reason to pay again. Refuse substituted destinations and requests for secrets. **Stop if the outcome remains unknown, lookup is unavailable, details disagree, or anyone substitutes a destination or asks for secrets. Never auto-create a replacement.** Reconciliation alone is not authorisation for another send.

**No speed-up, cancellation or replacement procedure exists in this draft.**

Two draft limitations prevent the general TXID reconciliation rule from being treated as a universal capability:

- **TRX:** there is no TXID lookup adapter. A TRX transfer stays **Pending** on manual refresh; that retained label is not fresh verification of its outcome. No manual investigation procedure is supplied.
- **TON:** reconciliation **can never be automatic in this draft**. `txid` is `null` at `tx.js:320`.

### Rehearsal

Every mainnet send procedure carries this label:

**UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**

Send/sign/broadcast was **never exercised anywhere, on any network** in the work covered by this draft. Testnet verification is not evidence of a tested send.

The exact wallet-specific steps, agreement on the tiny test amount, the fee, receipt evidence and funded execution are all open and require separate authorisation. No rehearsal procedure is supplied here.

The loss modes for a funded attempt remain **wrong address, wrong network, wrong amount, duplicate payment, stuck transaction, and theft via substituted destinations or requests for secrets**. A separately authorised wallet-specific plan needs destination, network, asset and amount checks against the retained request; no second payment merely to clear an unresolved or stuck first outcome; and refusal of substituted destinations or requests for secrets. **Stop before signing, broadcasting or committing funds without that separately authorised plan, and stop on any mismatch, unresolved outcome, destination substitution or request for secrets.** This section is not that authorisation, and the word “tiny” does not remove those limits.

### Gaps to register

- M-45 — Payment-record storage format, export procedure, retention duration and completed example.
- M-46 — History-label implementation verification and sourced chain-specific drop criteria (confirmation-policy values: M-13, M-38).
- M-28 — Speed-up, cancellation and replacement procedures.
- M-04, M-28 — TRX TXID lookup adapter and manual investigation procedure.
- M-04 — TON non-automatic reconciliation procedure for null-TXID records.
- M-35 — Separately authorised wallet-specific rehearsal steps, agreed tiny amount, fee, receipt evidence and funded execution.

## 13. Sending and signing: capability boundaries

This section states what sending and signing Bawa and the drafts can and cannot do. It contains no send procedure for any chain. TON is generation-only in the repository: it can be received, not sent, from Bawa or the drafts. A reader who funds TON must withdraw through an external wallet; identifying that software is a separate open item (M-39). Nothing in this section authorises a send, and no send has been exercised on any network.

### 13.1 What Bawa is and is not — the no-signing boundary

Bawa is a tracker, not a wallet that signs. It contains no transaction construction, signing, broadcast or PSBT code. The searches of `tools/` and `test/` found no such implementation; the “sign” matches in `derive.js` are inside “assign”. `docs/09` separates signing from tracking: “Signing remains a trusted-side operation.”

Mistaking tracking for transaction preparation or approval creates **wrong-network, wrong-address and wrong-amount** loss modes. The prevention is to keep tracked observations separate from an explicitly reviewed payload and trusted-side signing. An address or balance shown by the tracker is not a transaction approval.

**Stop if a plan relies on Bawa constructing, signing or broadcasting a transaction, or handling a PSBT.** Those capabilities are absent, not merely awaiting a live test. See §12 and §17.

### 13.2 What the drafts actually contain

The validation drafts do not establish a mainnet sending path.

- **Web draft:** `app-web/src/tx.js` is the programme’s only signing implementation. Its transaction tests are fully mocked. Send, sign and broadcast were never exercised live in a browser or on any network. Those live paths are **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **Android draft:** `SigningCoordinator.kt` was never compiled into an APK and never run on a device; there was no AAR. Source-level coordinator checks are not evidence of a working device signing capability. Device operation is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **Core check:** the Core 4.9.2 EIP-1559 check, D21, was limited to Node v24, with independent Python fixture-sender recovery and no broadcast. It provides evidence for the tested fixture path, not browser, device or network operation. Those live integrations remain **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.

Mocked tests and fixture recovery do not establish live protection against **wrong-network, wrong-address, wrong-amount or lost-fee** outcomes. Prevention requires the code-level identity, review, role-separation and change/fee boundaries below, together with evidence that they operate in the intended environment.

**Stop with the current drafts.** Missing controls must be implemented before any real-funds rehearsal is considered. The rehearsal label identifies missing live evidence; it does not turn an unimplemented control into an implemented one or supply a sending procedure. See §17 and §21.

### 13.3 Chain identity: chainId enforcement

The Web draft hardcodes ETH `chainId 11155111` for Sepolia, `txMode 1` and a `0x02` envelope. Mainnet requires `chainId 1`: that is an implementation change, not a documentation edit. An endpoint choice does not change the hardcoded signing identity (§11). The loss mode is **wrong-network signing**; **stop if the unchanged draft is being treated as a mainnet path**.

The draft’s own comment describes the default as `txMode 0 = Legacy`. Under that default, Core ignores the max-fee fields and signs `gasPrice 0`. Only the `txMode 1` path was verified in D21, within the limited fixture check described above. An unintended fee mode is a **stuck-transaction** risk. Prevention requires checking the actual signing mode and signed fee fields against the reviewed payload; **stop if they cannot be matched** (§14).

The Android header is misleading. `EthSepoliaAdapter.kt` claims:

> Chain ID 11155111 is checked before every signing input (see SigningCoordinator)

That check is not implemented. `approve()` checks only that `decodedSummary`, `sender` and `recipient` are non-blank. `signApproved()` checks only payload equality and `reviewToken == payload.hashCode()`. Neither the coordinator nor the adapter checks chain ID, network, amount or fee.

EIP-155 chain binding means a conforming mainnet node rejects a Sepolia-signed payload. That does not resolve the Android review defect. If a changed caller supplies `chainId 1` while the review still says Sepolia, the payload passes the existing approval checks; a mainnet-signed transaction from that payload can spend real ETH. This is a **wrong-network loss mode**, not a failure of chain binding. **Stop while a mismatch between the reviewed network and the signed chain ID can pass approval.**

The required correction is code-level enforcement binding the intended network to the exact payload signed, alongside the missing amount and fee checks. A header, network label or endpoint selection is not that enforcement. The Web mainnet change and Android checks are implementation work; their live operation is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. See §17 and §21.

### 13.4 Frozen-payload review and role separation

The Web draft contains `buildIntent`, `reviewOf`, `approveIntent` and `hashIntent`, with per-chain signers that verify the signed result against the approved payload. The Android coordinator refuses undecodable actions and missing sender or recipient information, and refuses signing if the payload has changed after approval. These are draft controls, not evidence of live enforcement. Their runtime behaviour is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**; the Android checks do not supply the semantic validation missing above.

To prevent **wrong-network, wrong-address, wrong-amount and lost-fee** outcomes, approval must bind to the exact payload signed. The review must decode and cover the network, sending account, recipient, value, every output including change, and fees. The reviewed intent must be frozen. Signing must refuse a changed payload, and the signed result must be verified against the approval before finalisation or broadcast.

**Stop if a required review item is missing or undecodable, if the payload changes after approval, or if the signed result cannot be matched to the approval.** Payload equality alone does not establish that the review described the payload correctly. See §17.

The role model in `docs/09` is separate from those checks:

- The tracker holds xpubs and addresses only.
- The signer holds the private key or hardware wallet.
- The network broadcasts.

The **Signer** role reviews and signs an already-prepared, approved payload. It must never discover accounts or balances, select coins, choose fees, assemble transactions or broadcast. This is a guide requirement, **not an established implementation boundary**: the Web `tx.js` includes UTXO selection and live fee use.

Keeping those duties outside the Signer prevents preparation or fee decisions from silently changing an approved amount or fee. **Stop if signing depends on the Signer performing those duties, or if that separation cannot be demonstrated.** The draft does not establish it merely by having approval functions. See §17 and §21.

### 13.5 Change handling

The Web draft’s Bitcoin code returns change to the sending address. Change-branch derivation is not implemented: this is design gap G4. The first change-address path is `m/84'/0'/0'/1/0`, but the draft does not derive or use that change-branch address. It does not provide fresh change addresses.

The relevant loss modes are **wrong address, wrong amount and lost fee**. Prevention requires review of every output, not just the recipient output. Every proposed change output must match an address derived from your own seed and be verified as controlled by the intended signer. A “change” label is not an ownership check. **Stop before signing if any output is unreviewed, or if a proposed change output cannot be verified in that way.**

Fee acceptance also requires a fee tier chosen before signing, a quote refreshed at signing time, and recalculation of both the absolute fee and the sat/vB rate (§14). The absolute fee must be calculated from the retained UTXO amounts and all output amounts. Omitted change becomes fee, so both the absolute fee and the change output require pre-signing verification.

Those preparation and review duties do not belong to the Signer. A quote refresh that changes the payload invalidates the existing approval; it cannot silently alter what will be signed. To prevent a **lost fee**, **stop if the retained UTXO amounts, change output, absolute fee or sat/vB calculation cannot be verified, or if a changed payload still carries the old approval**.

The Web change-and-fee path is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. That status is separate from the unimplemented change branch. See §17 and §21.

### 13.6 Nonce, stuck transactions, replacement — what does not exist

No replacement, speed-up or cancellation procedure is provided for any chain in the supplied repo and guides. The draft has no replace/cancel UI. These are missing capabilities, not recovery options hidden elsewhere in the sending flow.

For ETH, no receipt together with a still-pending nonce means **unresolved**, not “send it again”. A nonce gap or stuck transaction blocks every later nonce from that account. The immediate loss mode is a **stuck transaction**; prevention means treating the unresolved nonce as a blocker rather than as permission for another send. **Stop rather than attempt another transaction to work around an unresolved nonce.** See §12.

An ETH speed-up is a same-nonce replacement with policy-compliant higher fees. Cancellation is a paid competing transaction, not an undo button. Those definitions describe **lost-fee** exposure; they are not instructions for resolving it. **Do not attempt replacement, speed-up or cancellation without a chain-specific procedure grounded in named primary sources. Stop while that procedure is missing.** See §14 and §17.

There is currently no replacement procedure here to rehearse. Any later live implementation would remain **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** until exercised; the label itself supplies neither the missing procedure nor permission to improvise one. See §21.
### 13.7 Per-chain send capability

These are code-level capabilities, not evidence of a completed send. The Android draft can receive on all four chains, but its only send composition path is native ETH, and sending remains conditional on the `chainId` port. Signing code alone does not provide a composer, and a broadcast adapter alone does not establish an end-to-end send path.

| Chain | Android draft: capability and exclusions | Web draft: capability and exclusions |
|---|---|---|
| BTC | An `AnySigner` signing path exists, but there is no composer. The Send screen cannot compose, sign or broadcast a BTC transaction. | A testnet broadcast submission implementation exists. This does not establish a complete mainnet composition, signing and submission capability. |
| ETH | `EthSendComposer.kt` supports native ETH transfers only, with sending conditional on the `chainId` port. No ERC-20 transfers, contract calls or data payloads. | Transfer-only code with a fixed gas limit of `21000`. This is not a general contract-call or token-send path. |
| TRX | An `AnySigner` signing path exists, but there is no composer. The Send screen cannot compose, sign or broadcast a TRX transaction. | The TRX path supports native TRX only. In `tx.js`, `signTrx` builds a transfer contract with `feeLimit` hardcoded to **1,000,000 SUN (1 TRX)**. There is no TRC-20 send path and no pre-send resource check. |
| TON | Signing is refused: “TON signing is unimplemented in this build”. The Send screen reports “not implemented”. | A testnet broadcast submission implementation exists. This does not establish a complete mainnet composition, signing and submission capability. |

The Web broadcast paths are testnet submission implementations. HTTP 200 probes on **2026-11-09** confirmed mainnet endpoint reachability only: no transaction was submitted and no funds moved. The TRX `feeLimit` is a hardcoded limit, not an observed fee or a resource estimate.

**Loss mode:** funding a receiving address and discovering afterwards that the draft cannot withdraw from that chain. Funding a chain without a send path means relying on an external wallet for withdrawal.

**Prevention and stop:** check the intended chain’s actual composition and signing capability, not merely whether it displays a receiving address or has signing code. Stop where the required path is absent, the Android `chainId` prerequisite remains unresolved, or the claim rests only on a broadcast adapter or endpoint probe. These limitations remain funding blockers under §17 and §21.

**Scope — TON send is out of scope for this section.** The repository generates a single TON deposit address and contains no TON signing, composition or broadcast code. The Android draft refuses TON signing (“TON signing is unimplemented in this build”); the Web draft has only a testnet broadcast submission implementation. This guide therefore gives no TON send procedure, no broadcast instructions and no rehearsal procedure for TON. Funding TON without a send path means relying on an external wallet for withdrawal (see the loss mode above).

### 13.8 TON wallet identity — the 698983191 check

For the published vector, Core **4.8.4** returns:

| Field | Documented result |
|---|---|
| Contract | Wallet V4 R2, recorded as `v4r2` |
| Wallet ID | `698983191` (`0x29A9A317`) |
| Workchain | `0` |
| Derivation path | `m/44'/607'/0'` |
| Raw address prefix | `0:bb819bc6…` |
| Mainnet non-bounceable address | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` |

The documented matching triple is **`(v4r2, 698983191, 0)`**. This is a reference result for the published vector; your pre-receive check must use your own backed-up phrase.

The Android draft instead records wallet ID `0`. Create defaults `walletIdText` to `"0"`, and Import hardcodes `0L`. Its `validate()` checks format only: it never establishes that the recorded contract version, wallet ID and workchain produce the recorded address. The draft’s own test accepts `v4r2`, wallet ID `0`, workchain `0` and the `testnet` label alongside the mainnet address shown above. Passing validation is therefore not proof of wallet identity.

**Loss mode:** accounts using either wallet ID are controlled by the same signing key, but they are different accounts. The mismatch can cause wrong-account restores, apparently empty imports and split balances. The permanent-loss escalation is destroying the only phrase copy because an import appears empty.

**Prevention:** before receiving, independently reproduce the shown receiving address from your own backed-up phrase, using the same derivation and the exact recorded contract version, wallet ID and workchain. Compare the full account identity, not an address prefix. Keep this check alongside §11 and §12.

`UQ` non-bounceable and `EQ` bounceable addresses are friendly encodings of the same account; that encoding difference alone is not an account mismatch. Reject test-only `kQ` and `0Q` forms for mainnet.

**Stop if the accounts do not match. Do not send mainnet TON — not even a small test deposit — before resolving the mismatch.** Do not destroy the phrase backup on the strength of an apparently empty import.

### 13.9 Reconciliation: timeouts, missing lookups, silent zeroes

The confirmation thresholds below are Android draft configuration in `NetworkConfig.kt`. They are not demonstrated Web enforcement.

| Chain | Android configured confirmations | Web `reconcileTx` behaviour |
|---|---:|---|
| BTC | 6 | Checks `getTx(txid)` and its confirmed flag. |
| ETH | 12 | Checks `eth_getTransactionReceipt` for status `0x1`. |
| TRX | 19 | No txid lookup adapter: “stays pending, manual refresh”. |
| TON | 1 | Checks history for the txid. |

A broadcast timeout means **UNKNOWN**, not failure. Reconcile by txid before considering any retry. Never auto-create a replacement, and never double-broadcast while the first submission remains unresolved. Where the lookup is unavailable or cannot resolve the state, stop; a manual-refresh instruction is not evidence that the first submission failed.

**Not returned / not loaded ≠ never sent.**

Balance responses have a separate failure mode. The draft’s `TonTestnetAdapter` returns `ok:true` with balance `0` for a valid address on the wrong network. A funded mainnet `UQ` address queried on testnet receives a successful zero with `fresh=true`. That fresh flag does not establish that the correct network was queried, and the zero does not establish that the mainnet account is empty.

**Loss modes:** duplicate payment after an uncertain submission, abandoning funds after a false empty result, or treating stale balances as spendable.

**Prevention and stop:** preserve UNKNOWN until txid reconciliation resolves it, and establish the account and network before relying on a balance. Never treat a stale value as current spendable funds. Stop while submission state, network identity or balance freshness remains unresolved; missing history and successful zeroes do not remove that stop condition. See §14 and §17.

### 13.10 Tool defects that block funding — OI-096

OI-096 remains open:

- `compare.js` accepts private extended keys and silently prints wrong addresses while exiting with `0`.
- `derive.js` accepts mismatched-chain keys and returns valid-looking addresses from the wrong branch, also with exit `0`.

**Loss mode:** funding the wrong derived account because an address looks plausible and the tool reports success. Neither address formatting nor a clean exit proves that the result matches the intended key, chain and derivation.

**Prevention:** require an independent `bip_utils` cross-check before accepting a derived receiving address for funding. Another result from these same scripts is not that independent check. **Never give `compare.js` private keys, including private extended keys.**

**Stop** if the cross-check is absent, disagrees, or leaves the intended chain or derivation unresolved. These are funding blockers, not cosmetic warnings. A code fix is outside this phase; the required cross-check does not mean OI-096 has been fixed. Keep the blockers recorded in §17 and §21.

### 13.11 What the signer must refuse — blind signing, permits, undisclosed approvals

The signer must refuse data the wallet cannot meaningfully decode. A send must never insert `approve`, a permit or an unlimited allowance as an undisclosed side effect.

**Loss mode:** authorising spending or other effects that were not meaningfully shown, or assuming that an outstanding permit can no longer be used when it has not been invalidated.

Permit2 has distinct authorisation paths:

- `AllowanceTransfer` and `SignatureTransfer` are independent paths, not sequential layers.
- ERC-20 transfers through Permit2 still require token-level allowance to Permit2 at execution.
- Reducing an allowance or calling `lockdown` does not invalidate outstanding permit signatures. `invalidateNonces` and `invalidateUnorderedNonces` are the separate invalidation operations.

Do not describe an allowance reduction or `lockdown` as cancellation of outstanding permit signatures. These distinctions are not an approval or cancellation procedure, and they do not establish a token-send capability in either draft.

**Prevention and stop:** limit signing to effects the wallet can meaningfully decode and explicitly disclose. Refuse undecodable data and undisclosed authorisations. Stop if the request relies on treating an allowance change as permit-signature invalidation, or if the relevant authorisation state remains unresolved. Disclosure alone does not turn an unsupported send path into an implemented one. These refusal boundaries remain requirements under §17 and §21.

### 13.12 What remains unverified — the status of this whole section

At `56396a20`, **no live send has been observed on any network**. The whole send path remains:

**`UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL`**

That status applies to the capabilities described here, including native transfer code. Existing signing paths, validation tests and successful endpoint probes do not establish a completed send.

**Loss mode:** committing funds on the assumption that code inspection or endpoint reachability proves composition, signing, submission and reconciliation work together.

**Prevention:** retain the unverified status and keep the applicable funding blockers open. There is **no reviewed small-amount procedure yet**; its absence is an open item for §21. The **BTC / TRX / TON / token / interrupted-submission / replacement** cases are deferred acceptance plans only, not steps the reader may execute.

**Stop before moving real funds on the strength of this section.** Do not improvise a rehearsal from the capability table or interpret the status label as permission to make a test deposit. The applicable gates remain in §17 and §21.

#### What must change before any real funds move

- Resolve the intended chain’s send-path prerequisites and withdrawal limitations, including the Android `chainId` dependency where applicable (§17, §21).
- Establish TON account identity from the backed-up phrase and exact recorded parameters; no unresolved mismatch may pass the funding gate (§17, §21).
- Require the independent `bip_utils` address cross-check and keep private keys out of `compare.js`; OI-096 remains open (§17, §21).
- Resolve applicable reconciliation gaps; missing lookups, wrong-network zeroes and stale balances cannot support spending or retry decisions (§17, §21).
- Enforce refusal of undecodable signing data and undisclosed approvals, permits or unlimited allowances (§17, §21).
- Resolve the absence of a reviewed small-amount procedure. Deferred acceptance plans are not that procedure (§17, §21).

## 14. Fees and transaction-cost review

### Eight common requirements

The numerical examples in this part are dated estimates from the **2026-11-09 ~11:54 UTC check on muse-vm**. They are not current quotes or standing fees. No writing-time live re-check is recorded in the evidence; that requirement remains outstanding.

**UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** means that a separately authorised, reviewed small-amount rehearsal is required. This section neither authorises that rehearsal nor provides its procedure. The label does not remove any live-check or stop condition.

1. **Check immediately before sending.** Obtain the fee from a live source and record the UTC check time. Never quote a figure from this guide as the current fee.

2. **Show both the rate and the total before signing.** The review must show Bitcoin in **sat/vB and sats**, Ethereum in **gwei and ETH**, TRON in **points / energy and TRX**, and TON in **nanoTON and TON**. It must also explain the proposed transaction’s change or refund behaviour.

3. **Treat “enough” as a balance rule, not a deposit amount.** A native-coin payment needs spendable funds covering the intended payment plus its freshly reviewed fee budget. A token payment needs the intended token balance and the native coin or resources required for its fee. There is no fixed funding amount in this guide.

4. **Review first-send behaviour for the particular chain.** Bitcoin has no activation or first-spend surcharge: its first spend pays the ordinary transaction fee. First-send behaviour for Ethereum, TRON and TON is not established by the evidence for this part. It must be documented in their chain-specific reviews rather than inferred from Bitcoin.

5. **Have a chain-specific stuck/failed-transaction route before authorising a payment.** That route belongs to an external toolchain, not Bawa. If the transaction’s status or the toolchain’s recovery controls cannot be established, stop rather than improvise another transaction.

6. **Do not confuse a token balance with the ability to send.** USDT without ETH cannot fund an Ethereum send; USDT without TRX or usable energy cannot fund a TRON send; Jettons without TON cannot fund a TON send. A token-only wallet without the required native coin or resources cannot send anything. Receiving and reading balances need no gas; sending always needs the applicable fee or resource budget.

7. **Check the address before signing.** A confirmed payment to a wrong address is not reversible on Bitcoin, Ethereum, TRON or TON. Address-checking before signing is the only protection against that loss.

8. **Keep provenance attached to every fee figure.** Record its source and check time, including a writing-time re-check. Mark every unverified figure **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. A historical estimate does not become a current fee merely because it appears in a reviewed document.

**Loss-and-stop gate for these requirements:** prevent a **wrong address** by independently checking the full destination against the external signer’s final review; prevent a **wrong amount** by checking the amount and denomination against the payment intent. Reduce the risk of a **stuck transaction** with fresh, cross-checked fees and a reviewed recovery route. Check the total fee and change/refund behaviour against the plan to avoid a **lost fee**. Reduce exposure to **theft** by using a reviewed signer and keeping signing secrets out of fee services and unreviewed recovery helpers. Stop before signing if any of these checks is missing or cannot be reconciled.

### Bawa boundary and external toolchains

At `Pr3eve6ti2o/bawa@56396a20`, the repository has **no transaction-building or transaction-signing code**. Bawa cannot build, sign, broadcast, fee-bump or recover a mainnet transaction on any of the four chains. The Web draft’s send previews are proposed UI wording, not implementation evidence.

Those capabilities must not be attributed to Bawa until the corresponding code paths have been demonstrated at a named commit.

A named external signer/toolchain is therefore a prerequisite for each chain. **The supplied evidence names no external signing toolchain for any of them.** This is a blocking omission, not an invitation to invent an endorsement. Fee estimators and the node fee-estimation RPC described below do not establish a signing toolchain.

| Chain | External signer/toolchain name | Controls required before this guide can document its use |
|---|---|---|
| Bitcoin | Not established by the evidence — blocked | Validated previous-output values; estimated eventual signed vsize; sat/vB and total sats; recipient and change-output review; transaction-status and reviewed fee-bump/recovery controls. |
| Ethereum | Not established by the evidence — blocked | Gwei and total ETH; native-ETH budget for token sends; recipient and amount review; documented first-send, change/refund and stuck/failed-transaction behaviour. |
| TRON | Not established by the evidence — blocked | Points / energy and total TRX; the native-coin/resource budget for token sends; recipient and amount review; documented first-send, change/refund and stuck/failed-transaction behaviour. |
| TON | Not established by the evidence — blocked | NanoTON and total TON; native-TON budget for Jettons; recipient and amount review; documented first-send, change/refund and stuck/failed-transaction behaviour. |

For every row, the external review must address **wrong address** and **wrong amount** through final destination and amount checks; **stuck transaction** and **lost fee** through fresh fee, status, change/refund and recovery checks; and **theft** through review of the signer and handling of signing material. Stop if the toolchain is unnamed or any required control is unreviewed. This part does not establish an authorised send or recovery path.

### Bitcoin procedure: obtain a live rate and calculate the total

*Procedure source: m12 §1 and m07 F12–F16.*

This is a fee-review procedure for an external Bitcoin toolchain, not a Bawa send flow.

Immediately before a proposed signing, open:

`https://mempool.space/api/v1/fees/recommended`

Save the response and its UTC retrieval time. The response has **no embedded observation timestamp**, so retaining the values alone does not preserve their freshness. Refresh after any material delay.

The five fields are **rates in sat/vB**, not total fees:

- `fastestFee`: intended for the next block.
- `halfHourFee`: intended for roughly half an hour.
- `hourFee`: intended for roughly an hour.
- `economyFee`: a patient estimate.
- `minimumFee`: a service-reported minimum indicator, **not a consensus minimum and not a speed target**.

Cross-check with another estimator. Use the mempool.space recommended set as the preferred working set, but never as the sole source. An unexplained material disagreement is a reason to pause signing, not to average the quotes or automatically choose the higher one.

Choose urgency from the fresh fields. None guarantees confirmation within its named interval. Bitcoin’s roughly ten-minute block interval is an average, not a promise.

Calculate the planned total from the external wallet’s estimate of the eventual signed virtual size:

```text
planned fee (sats) = ceil(estimated signed vsize × chosen rate in sat/vB)
```

The amount being sent does not determine that fee. The input/output layout and signed virtual size do.

As a node alternative, `estimatesmartfee 2` and `estimatesmartfee 6` return rates in **BTC/kvB**. Multiply the returned rate by **100,000** to convert it to sat/vB. This is a unit conversion, not a fee quote. A missing estimate is not a zero-fee recommendation.

**Loss-and-stop gate for this procedure:** compare the full recipient address and amount in the external signer to prevent a **wrong address** or **wrong amount**. Freshness and an independent cross-check reduce the risk of a **stuck transaction**, but do not guarantee confirmation. Review the calculated total and actual change to avoid a **lost fee**. Do not give signing material to an estimator or an unreviewed helper: that creates a **theft** risk. Stop before signing if the source is stale, disagreement remains unexplained, the signed-size estimate is unavailable, or the destination, amount, fee or change cannot be verified.

### Bitcoin dated baseline

This example uses **one P2WPKH input and two P2WPKH outputs**, with an estimated signed size of **141 vB**. The dollar conversions use the evidence’s BTC price estimate of **$74,399 per BTC**.

**Source and check for those example assumptions:** m12 §1, **2026-11-09 ~11:54 UTC, muse-vm**.  
**Status:** **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. Neither the layout nor the price is an assumption to carry into another transaction.

**Source and check for every rate, total and dollar estimate in the table:** m12 §1 / m07 F12–F16; rates from the mempool.space recommended response, totals and conversions from the dated example; **2026-11-09 ~11:54 UTC, muse-vm**.

| Field | Intended urgency or role | Dated rate estimate | Dated total for the example layout | Status |
|---|---|---:|---:|---|
| `fastestFee` | Next block; not guaranteed | 3 sat/vB | 423 sats ≈ $0.31 | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |
| `halfHourFee` | Roughly half an hour; not guaranteed | 1 sat/vB | 141 sats ≈ $0.10 | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |
| `hourFee` | Roughly an hour; not guaranteed | 1 sat/vB | 141 sats ≈ $0.10 | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |
| `economyFee` | Patient | 1 sat/vB | 141 sats ≈ $0.10 | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |
| `minimumFee` | Service-reported minimum indicator only | 1 sat/vB | Not a speed or total-fee recommendation | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |

Creating a Bitcoin wallet or generating an address incurs no network fee. Receiving incurs no network fee for the recipient. The first spend pays the ordinary transaction fee, with no activation or first-spend surcharge.

The recorded network conditions were quiet. **No congested-rate example was found.** Gap G1 remains open: a congestion example must follow m12 §1.2 using `https://mempool.space/graphs`, identify a dated interval, and retain its source and check time. No spike rate is supplied here.

### Bitcoin fee disagreement — unresolved

The same evidence window contains a sharply different estimator record:

| Source and check time | Dated estimate as recorded | Status |
|---|---|---|
| mempool.space recommended set; m07 F3; **2026-11-09 ~11:54 UTC, muse-vm** | `fastestFee`: **3 sat/vB** | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |
| blockstream.info fee-estimates; m07 F3; **2026-11-09 ~11:54 UTC, muse-vm** | `"1": 0.972 BTC/kB (≈97 sat/vB)`, `"6": 0.685`, `"504": 0.10` | **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** |

The Blockstream units and parenthetical conversion above are reproduced **as recorded**, not independently validated. The evidence reports them as sharply higher than the mempool.space recommendation. No reconciliation is established here, and this record is not a validated alternative sending rate.

Prefer the mempool.space recommended set for review, while retaining the independent cross-check. Do not average the sources, silently select the higher quote, invent an explanation, or reuse this discrepancy as a congestion example. **If a material disagreement remains unexplained, pause signing.**

An unsuitable rate can leave a **stuck transaction**; an excessive or misinterpreted total can become a **lost fee**. Re-check the live sources and the proposed transaction’s total. Fee agreement does not protect against a **wrong address**, **wrong amount** or **theft**: independently check the destination and amount in the reviewed external signer, and reject requests to disclose signing material. Stop if either the fee disagreement or those signing checks remains unresolved.

### Bitcoin accounting and change

*Accounting source: docs/09:838–844, carried over with “mainnet fee rate” and “planned mainnet fee budget” wording; change limitation G4.*

Estimate the **eventual signed virtual size**, including input types, output types, change and witness overhead. Do not substitute the PSBT file size or an incomplete unsigned byte count.

The proposed transaction’s absolute fee comes from its validated inputs and all proposed outputs:

```text
absolute fee (sats)
  = validated selected previous-output total
  − recipient-output total
  − change-output total

estimated mainnet fee rate (sat/vB)
  = absolute fee in satoshis
  ÷ estimated eventual signed vsize in vB
```

Check both the absolute fee and the estimated rate against the planned mainnet fee budget and chosen mainnet fee rate. The earlier rate-times-vsize calculation is a planning estimate; it does not replace this input-minus-output accounting.

**Stop on unverified input values.** An unavailable size or fee estimate is not permission to pay nothing.

Include any uneconomic change added to the fee explicitly. If change is omitted, the selected-input surplus not assigned to recipient outputs is part of the fee; it is not a later refund.

The Web draft says change returns to the sending address. That is UI wording, not evidence of a constructed transaction. **Change-branch derivation is not implemented at this commit (G4).** Do not promise a derived change-branch address. The external signer must show the actual proposed change destination and value.

**Loss-and-stop gate for accounting:** correct arithmetic cannot fix a **wrong address** or **wrong amount**, so compare every recipient and change output with the independently checked intent. Missing signed-size information or stale rates leave a **stuck transaction** risk; refresh and reconcile them before approval. Omitted change or an excessive total can become a **lost fee**; reject any unexplained difference from the planned mainnet fee budget. Unreviewed signing software or requests for signing secrets create a **theft** risk; stop rather than bypass the signer review. Stop on any unverified input, unexplained output, missing estimate or budget mismatch.

#### If the Bitcoin transaction is stuck or appears to have failed

Stop further signing until the external toolchain can establish the transaction’s status and provide a reviewed recovery route. Bawa cannot perform that check-and-recovery flow or fee-bump the transaction. No named, reviewed external Bitcoin recovery method is established by this evidence, so this part provides no recovery authorisation.

Any proposed recovery must undergo the same live fee, validated-input, recipient, amount and change review. A replacement or repeated request must not introduce a **wrong address**, **wrong amount**, another **stuck transaction** or a **lost fee**. An unreviewed recovery helper also creates a **theft** risk. Keep signing material out of such helpers, and stop if the status, intended payment effect, additional fee or required external controls cannot be established.

### Bitcoin mistakes and the stuck-tx decision tree

These notes apply to the Web draft at `Pr3eve6ti2o/bawa @ 56396a20`. All figures below are **dated estimates from 2026-11-09 ~11:54 UTC, `muse-vm`**, not standing fees or live quotes. Source and check annotations refer to that evidence snapshot.

**UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** means that a figure’s applicability to the intended transaction or node has not been established. A separately authorised, reviewed small-amount rehearsal is required before relying on it. This section neither authorises nor describes that rehearsal.

**Before signing a Bitcoin payment**, compare the destination and amount with the intended payment to prevent a **wrong address** or **wrong amount**. A payment to a valid wrong address loses the entire payment and its confirmed fee; RBF cannot undo a confirmed transaction. Check **both sat/vB and total fee**, then check change handling: underpayment can leave a **stuck transaction**, while overpayment or omitted change can become a **lost fee**. To prevent **theft**, do not disclose a mnemonic or private key for fee assistance or authorise unexpected spending. Stop if the destination, amount, change or fee is wrong or unclear, or if assistance requires wallet secrets.  
*Source: m12 §1; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

**Overpayment and change deserve separate checks.** Once a transaction confirms, the miner keeps its actual fee. In the dated worked example, each unnecessary **+1 sat/vB** on a **140 vB** transaction adds approximately **140 sats ≈ $0.10**. The recorded P2WPKH dust threshold was **294 sats**, using Core’s default dust relay fee of **3,000 sat/kvB**. Omitting change turns the remainder into fee; it does not leave that remainder in the wallet. **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** applies to the worked cost for a proposed transaction and to the dust setting used by a particular node.  
*Source: m12 §1; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

The stuck-transaction decision tree is **wait → RBF bump if signalled → CPFP if you control an output → stop; never re-send blindly**.  
*Source: m07 F20; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

1. **Wait and inspect the original transaction.**  
   Underpayment delays settlement; it does not destroy the principal. Check the original payment’s destination, amount and confirmation status rather than treating the delay as permission to make another payment. Stop before further spending if the original status or payment details cannot be reconciled.  
   *Source: m12 §1; m07 F20; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

2. **Consider the signalled-RBF branch—but not as a Web feature.**  
   BIP-125 opt-in is set before signing, using `nSequence < 0xfffffffe`. Full-RBF policies can permit replacement without opt-in: signalling is neither a universal prerequisite nor a guarantee of replacement. **This Web draft implements no RBF and no fee-bump flow.**  
   *Sources: m12 §1; m07 F18; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

   The stated replacement-fee requirement is:

   `replacement fee ≥ evicted fees + replacement vsize × incremental relay fee rate`

   At the dated check, Core’s default incremental relay reference was **100 sat/kvB = 0.1 sat/vB**. The worked replacement example used **140 vB**, moving from **1 to 3 sat/vB**: approximately **140 → 420 sats**, an increase of **280 sats ≈ $0.21**. That dollar figure is the increase, not the replacement’s total fee. Whether this satisfies any particular node’s policy is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.  
   *Source: m12 §1; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

   Before any replacement approval, recheck the intended recipient, amount and change for **wrong address** and **wrong amount**; check the replacement’s rate, total fee and accepting-node policy to avoid another **stuck transaction** or an unnecessary **lost fee**. Disclose no wallet secrets to prevent **theft**. Stop if those checks remain unresolved. The RBF branch ends in this Web draft: do not substitute a new payment for a missing bump flow.

3. **Consider CPFP only where an output is controlled.**  
   A sender can spend unconfirmed change, or a recipient can spend the stuck payment output, in a high-fee child. Both transactions confirm, and **both fees are paid**.

   The dated package illustration uses a parent and child of approximately **140 vB each**, with a target package rate of **3 sat/vB**. Keeping the parent at the original fee above gives a combined fee of approximately **840 sats ≈ $0.62**, of which the child pays approximately **700 sats ≈ $0.52**. This is derived package arithmetic, not a live recommendation: **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** for an actual package.  
   *Source: m12 §1; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

   Before any child approval, establish control of its input and check parent and child payment details for **wrong address** and **wrong amount**. Review both fees together, including change handling, to prevent a further **stuck transaction** or excessive **lost fee**. Do not disclose signing secrets to prevent **theft**. Stop if output control, the combined budget or an available reviewed signing flow is unresolved. This mechanism and its arithmetic do not establish a CPFP feature in the Web draft.

4. **Stop rather than re-send blindly.**  
   Disappearance from mempools is not cancellation. If the original never confirms, no fee is collected and its inputs remain unspent. The recorded Core default `mempoolexpiry` was **336 hours (14 days)**; the setting on a particular node is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**, not a universal cancellation deadline. Re-creating the payment while the original may still confirm risks a duplicate payment. Stop further spending until the original’s status is resolved.  
   *Source: m12 §1; m07 F20; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

### Ethereum procedure and dated baseline table

Start with read-only network and fee checks. The table below is a historical estimate, not a set of values to carry unchanged into approval.

1. **Confirm the network and freshness.** Query `eth_chainId`; mainnet is `0x1`. Record the UTC time, endpoint, latest block number and hash, and block timestamp. Compare the head with an independent explorer. An unresolved network or head mismatch is a reason to stop before approval.  
   *Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

2. **Read the base fee from fee history.** Request recent `eth_feeHistory`, for example **5 blocks** ending at `"latest"` with reward percentiles **[10, 50, 90]**. For a request covering **N** blocks, `baseFeePerGas` contains **N+1** entries: the **last entry is the calculated base fee for the following block**. Convert wei to gwei by dividing by **10⁹**. Reward values are gas-used-weighted percentiles of past effective priority fees, not guaranteed future inclusion prices.  
   *Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

3. **Cross-check the suggestions.** Compare `eth_maxPriorityFeePerGas`, `eth_gasPrice` and Etherscan’s gas tracker. `eth_gasPrice` is a legacy suggestion, **not a base-fee measurement**. Do not add a tip to it as though it were the base fee.  
   *Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

4. **Calculate caps in integer wei.** With **B** as the chosen current or next-block base-fee estimate and **T** as the priority cap, the wallet heuristic is:

   `maxFeePerGas = 2 × B + T`

   The **2×** factor is not an EIP-1559 requirement. At the stated maximum base-fee increase of **12.5% per full block**, doubling B preserves room for the full selected tip through **five** maximum increases. It does not double gas usage, does not mean twice the base fee will be charged, and does not cover an ETH/USD move.  
   *Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

5. **Estimate gas separately for the exact proposed transaction.** Use `eth_estimateGas`. The **21,000 gas** baseline applies only to a plain ETH transfer with no calldata, no access list and no recipient-code execution—not to every transfer or any contract call.  
   *Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

For an eligible transaction, let **Bᵢ** be the inclusion-block base fee, **T** the priority cap and **F** the maximum fee cap:

`effective gas price = Bᵢ + min(T, F − Bᵢ)`

If the base fee exceeds the cap, the transaction is **not eligible for inclusion**; that condition is not itself a paid on-chain failure. The charge is gas actually used multiplied by the effective gas price. Unused budget stays in the account or is released automatically, without a separate refund transaction. **The base fee actually paid is burnt, not refunded.**  
*Sources: m12 §2; m08 F2.1–F2.9; check: 2026-11-09 ~11:54 UTC, `muse-vm`.*

**Dated baseline — estimates, not standing fees**

Recorded readings are distinguished below from derived spending examples. The higher-base-fee comparison still comes from a quiet observation window; it is not a congestion ceiling.

| Item | Dated estimate and interpretation | Source and check time |
|---|---|---|
| ETH/USD conversion | Approximately **$2,114 per ETH**, used for the ETH dollar estimates below. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Legacy suggestion | `eth_gasPrice`: approximately **0.115 gwei**. This was not a base-fee reading. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Following-block base fee | Last `feeHistory.baseFeePerGas` entry: approximately **0.128 gwei**, calculated for the following block. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Historical priority rewards | Mostly **0.01–0.03 gwei**; past effective priority fees, not inclusion promises. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Wallet creation and receipt | At the checked baseline: **no network fee** for generating keys or creating the wallet; **no fee to the recipient** for receiving ETH. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Plain ETH transfer example | **21,000 gas** at base **0.128 + tip 0.02 = 0.148 gwei** gives approximately **3,108 gwei = 0.000003108 ETH ≈ $0.007**. Derived charge, not a measured fee for the reader’s transaction: **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Maximum fee reserve | The source’s example cap gives **21,000 × 0.276704742 gwei ≈ 0.0000058108 ETH ≈ $0.0123**. This is a reserve, not the expected charge. The cap is recorded separately; the displayed base-fee estimate above is rounded. Application to a proposed send: **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Balance before a first send | Required balance: **payment amount + gas limit × maxFeePerGas**. An account with no ETH cannot fund an ordinary self-paid mainnet transaction. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Higher observed base fee, still a quiet window | Across approximately **15 h**, the maximum mined-block base fee was **0.2408 gwei**, at block **26377373**. At that base plus a **0.02 gwei** tip, the same plain transfer would cost approximately **0.0000054768 ETH ≈ $0.0116**, about **1.7×** the baseline. The derived send cost is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**, not a live congestion recommendation. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |
| Gas-price sensitivity | For the same **21,000 gas** case, each additional **1 gwei** adds approximately **0.000021 ETH ≈ $0.044** at the dated exchange rate. Application to a proposed send: **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. | m12 §2; m08 F2.1–F2.9 — **2026-11-09 ~11:54 UTC, `muse-vm`** |

**Before Ethereum approval**, refresh the network/head check, fee inputs and exact-transaction gas estimate immediately. Prevent a **wrong address** or **wrong amount** by checking the chain, recipient and value against the intended payment. Prevent a **stuck transaction** by checking fresh base-fee information and cap headroom. Limit a **lost fee** by reviewing the gas estimate, price caps, expected charge and maximum reserve separately; unused reserve is not the same as a refundable paid fee. To prevent **theft**, do not disclose wallet secrets or approve unexpected spending, including an unexpected “refund” transaction.

Stop for a network/head mismatch, stale data, incorrect payment details, insufficient ETH for the maximum reserve, unexpected signing requests or an unresolved figure marked **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. The required separately authorised, reviewed small-amount rehearsal is not authorised by this section.

The figures below are **dated estimates for the Web-lane review of `Pr3eve6ti2o/bawa @ 56396a20`, checked on 2026-11-09 at ~11:54 UTC on muse-vm**. Recorded network parameters are inputs to that estimate set, not standing fees or defaults. Dollar amounts are USD. Secondary-source publication dates are retained separately from the check time.

**UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** is a stop marker: a separately authorised, reviewed small-amount rehearsal is required. This section does not provide a rehearsal procedure.

### Ethereum mistakes

#### Revert: the fee and nonce do not roll back

An included transaction that reverts still pays for the gas used. Contract changes and any attached ETH transfer roll back; the fee debit and consumed nonce do not.

A realistic gas range for a failed ERC-20 transfer or failed approval is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. The evidence did not establish a defensible empirical range. Do not substitute a successful transfer estimate for a failed-call estimate.  
*Sources: m12 §2; m08 F2.1–F2.9.*

Before any retry, match the recipient or contract to the intended destination to prevent a **wrong address**; check the value for a **wrong amount**; resolve the previous transaction and nonce to avoid a **stuck transaction**; understand the failure and fee budget to limit a **lost fee**; and reject unexpected spender or permission requests to prevent **theft**. Stop if the failure cause, transaction status or intended operation remains unclear.

#### Caps: headroom is not automatically spent

Setting `maxFeePerGas` far above the market does not, by itself, increase the fee when the base fee and priority cap are unchanged. Unused headroom is not paid.

The risks are different: a high maximum permits inclusion after the base fee rises, while an unnecessarily high **priority** cap can genuinely overpay. A generous maximum is not the same thing as a generous tip.  
*Sources: m12 §2; m08 F2.1–F2.9.*

#### Stuck transactions: replacement is competition, not reversal

A transaction whose cap is below a block’s base fee cannot be included in that block. While its nonce remains pending, it blocks later transactions from the same account.

A speed-up is a **same-nonce replacement** with policy-compliant higher fees. A cancellation is a zero-ETH, empty-data self-transfer using that same nonce and sufficient replacement fees. The dated plain-cancellation estimate was **≈21,000 gas, ≈$0.0066**. It is a paid competing transaction, not an undo: only one transaction per sender/nonce can be included, and the original can win the race.  
*Sources: m12 §2; m08 F2.1–F2.9. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

Before authorising either replacement, verify the intended destination—including your own address for cancellation—to prevent a **wrong address**; inspect the replacement value for a **wrong amount**; confirm the original nonce and status for a **stuck transaction**; review the replacement fees for a **lost fee**; and reject unexpected call data or permissions that could enable **theft**. Stop if the original is already included, the nonce is uncertain or the replacement charge is not understood.

#### Approve: allowance is authority, not a transfer

An on-chain ERC-20 `approve` changes an allowance. It does not transfer the approved token amount. Typical approval gas is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.

Unlimited approval is a risk, not a fee. A malicious or compromised spender may use `transferFrom` against the permitted balance, including tokens received later.  
*Sources: m12 §2; m08 F2.1–F2.9.*

Before approving, verify both token and spender addresses against the intended operation to prevent a **wrong address**; check and bound the allowance to prevent a **wrong amount**; resolve pending nonce status to avoid a **stuck transaction**; review the fee basis to limit a **lost fee**; and reject an unrecognised spender or unjustified unlimited allowance to prevent **theft**. Stop unless the spender, allowance and fee basis have been reviewed.

#### Wrong address and rejecting contracts

The outcome depends on what was actually broadcast and executed:

- **Execution reverts:** gas is lost, but the principal rolls back.
- **A contract accepts ETH without a recovery or withdrawal route:** the entire amount may become inaccessible, in addition to the fee.
- **A valid but wrong address receives the transfer:** the entire amount and gas are at risk; there is no protocol chargeback.
- **An invalid address is rejected before broadcast:** there is no on-chain fee.

Address-format acceptance does not establish that a contract can return ETH.  
*Sources: m12 §2; m08 F2.1–F2.9.*

Before an ETH send, independently match the destination to prevent a **wrong address**, compare the displayed value with the intended amount to prevent a **wrong amount**, resolve earlier pending transactions to avoid a **stuck transaction**, review execution behaviour and fees to limit a **lost fee**, and reject unexpected contract calls or permissions that could enable **theft**. Stop if the destination, amount, contract behaviour or transaction status cannot be established.

### USDC

At the baseline check, Ethereum mainnet contract  
`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`  
was verified on-chain with symbol **USDC**, name **USD Coin** and **six decimal places**.

Conversion must be explicit in both directions:

- Human USDC amounts become integer units by multiplying by **1,000,000**: **1 USDC → 1,000,000 units**.
- Integer units become human USDC amounts by dividing by **1,000,000**: **1,000,000 units → 1 USDC**.

*Source: m08 F3. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

Do not smooth over the Web draft’s self-transfer mismatch. Its plain self-transfer estimate was **29,060 gas**, against the review’s **21,000 gas** plain-transfer reference. An estimate is not a receipt showing gas actually used. The supplied evidence does not establish why the estimate was higher, so its use as a plain-transfer cost is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**; the gap must not be presented as a demonstrated extra charge.

The separate **zero-amount self-transfer at 37,973 gas** also cannot stand in for a real transfer. It understates a real transfer and must not be quoted as its gas requirement or cost.  
*Source: m08 F2.8. Check for both comparisons: 2026-11-09 ~11:54 UTC, muse-vm.*

**Real USDC transfer gas and cost: UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL.** No genuine transfer figure has been verified. The ETH builder is not enough: a genuine ERC-20 transfer procedure is needed before this guide can support a USDC send or quote its cost.  
*Source: m08 F3.*

Before any USDC authorisation, verify the Ethereum token contract and recipient to prevent a **wrong address**; check the six-decimal conversion and displayed amount to prevent a **wrong amount**; establish the transaction and nonce status to avoid a **stuck transaction**; require a reviewed transfer path and fee basis to limit a **lost fee**; and reject unexpected approvals or spender permissions that could enable **theft**. Stop while the ERC-20 procedure or fee basis remains unverified.

**No receipt plus a still-pending nonce means UNRESOLVED—not “send it again”.** Resolve that state before considering another money-moving operation.

### TRON

#### Model: bandwidth, energy and the scope of `feeLimit`

Bandwidth pays for the transaction’s byte footprint. Energy pays for TVM execution. Free bandwidth is a network limit, not a guaranteed personal allowance; it may be reduced during high traffic.

Freezing allocates renewable resources by **stake share**. There is no fixed stake-to-resource conversion rate.

`feeLimit` is the **smart-contract energy budget only**. It is not an upfront flat fee and does not cover native bandwidth or account activation. Only unused portions of the native fee and fee-limit budget are returnable; resources already consumed are not restored merely because execution failed.

There is an internal rate conflict in the evidence. The m12 summary assigns **0.001 TRX per energy unit**, but the measured chain parameters distinguish the energy price from the bandwidth price. That common-rate energy claim is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. The dated arithmetic below uses the measured energy parameter, not that shorthand.  
*Sources: m12 §3; m09 F07–F10. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

#### Procedure: establish the resource position before signing

1. **Check activation and available resources.** Use `wallet/getaccount` and `wallet/getaccountresource`, or inspect the corresponding account information in TronScan. Do not assume that a new address is activated or that a nominal free-bandwidth limit is available.
2. **Calculate only the uncovered resource burn.** At the dated measured rates, uncovered bandwidth of `B` points gives `B × 0.001 TRX`; uncovered energy of `E` units gives `E × 100 SUN`. These are separate calculations. Add applicable charges outside the contract-energy budget, including activation.  
   *Sources: m09 F07–F10; m12 §3. Check: 2026-11-09 ~11:54 UTC, muse-vm.*
3. **Estimate contract execution.** `estimateenergy` was unavailable on TronGrid mainnet at the check, returning “this node does not support estimate energy”. A `triggerconstantcontract` dry run is the alternative in the supplied evidence. A reverted dry run is not a successful-transfer estimate.
4. **Recheck close to signing.** Activation, available resources, the live burn parameters and the intended budget must still match the proposed operation.

Locally check the recipient or contract against the intended destination to prevent a **wrong address**; compare the displayed value with the intended value to prevent a **wrong amount**; investigate unresolved broadcasts for a **stuck transaction**; review resource coverage and all applicable charges to limit a **lost fee**; and reject unrecognised contracts, permissions or signing requests that could enable **theft**. Stop if the dry run fails, the current energy price cannot be reconciled, earlier transaction status is unresolved or any signing detail differs from the reviewed operation.

#### Dated baseline table

**Every row below carries the same check time: 2026-11-09 ~11:54 UTC, muse-vm.** These are dated estimates and recorded budgeting inputs, not standing charges. Sources in the final column apply to the whole row.

| Item | Dated estimate or recorded input | Scope | Source at the check above |
|---|---|---|---|
| TRX price reference | **$0.317467 per TRX** | Conversion input for the baseline estimates only | m09 F07–F10 |
| Bandwidth burn | **1,000 SUN per point = 0.001 TRX** | Recorded transaction-fee parameter; applies to uncovered bandwidth | m09 F07–F10; m12 §3 |
| Energy burn | **100 SUN per unit = 0.0001 TRX** | Measured parameter used for the dated energy arithmetic; conflicts with the summary’s common-rate claim | m09 F07–F10; m12 §3 |
| Free bandwidth limit | **600 points/day** | Network limit, not guaranteed availability; may be reduced during high traffic | m09 F07–F10; m12 §3 |
| Account-creation parameters | **0.1 TRX** create-account; **1 TRX** create-new-account | Recorded parameters, not an all-in transfer quote | m09 F07–F10 |
| Network `feeLimit` ceiling | **15,000,000,000 SUN — 15,000 TRX** | Protocol ceiling for the contract-energy budget, not a default | m09 F10; m12 §§3, 7 |
| Web draft `feeLimit` | **1,000,000 SUN — 1 TRX**, budgeting **10,000 energy** at the measured parameter | Smart-contract energy only; not the mainnet maximum | m09 F10; m12 §§3, 7 |
| Address generation | **$0** | Local generation estimate; no on-chain transfer | m09 F07–F10; m12 §3 |
| Receipt at a new address | **1–1.1 TRX activation**, paid by the sender | Activation component; check the account first | m09 F07–F10; m12 §3 |
| First ordinary plain TRX send | **265 bandwidth points**; **0 TRX** within quota, otherwise **0.265 TRX ≈ $0.084** | Bandwidth component. Resource observation: receipt `48fbb2…55b17`, block `87852906`; other applicable charges remain separate | m09 F07–F10; m12 §3 |
| Memo surcharge | **+1 TRX** | Additional charge | m12 §3 |
| Multisignature surcharge | **+1 TRX per transaction** | Not per signature | m12 §3 |

The source’s stated multiplier between the draft budget and the network ceiling is inconsistent with those amounts. Do not reuse that comparison, and never relabel the draft budget as the mainnet maximum.

#### Conflicting USDT figures

There is no single verified USDT transfer cost to quote from this evidence.

- **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL — existing-holder estimates.** Tronsave, dated **28 October 2026**, supplied **64,285 energy**, corresponding to **≈6.43 TRX ≈$2.04** under the baseline arithmetic. Dwellir, dated **3 November 2026**, quoted **$2.07**. These are secondary-source estimates, not a verified Bawa transfer receipt or an all-in fee promise.  
  *Source record: m09 F07–F10. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

- **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL — base-energy claims and range.** Secondary sources conflict between **65,000** and **14,650 energy**, both described as base energy for a USDT transfer. No verified reconciliation is supplied. The proposed **13,000–65,000 energy** range is also unverified and must not be presented as an empirical operating range.  
  *Sources: m09 F07–F10; m12 §3. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

- **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL — new-holder cost.** No defensible total was established. Extra bandwidth and activation must be accounted for; the existing-holder estimate cannot simply be carried across.  
  *Sources: m09 F07–F10; m12 §3.*

The record also contains a **reverted dry run for 1 USDT**, reporting **8,624 energy** and **6,640 penalty**. These are failed-simulation readings, not a transfer receipt. They must never be quoted as a USDT transfer cost.  
*Source: m09 F07–F10. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

#### Mistakes: failed calls, extra charges and locked funds

An included failed or reverted call still consumes resources. A normal `REVERT` does **not** automatically burn the whole `feeLimit`, but an out-of-energy failure can exhaust the budget. At the Web draft limit, that exposure was **up to approximately 1 TRX**, before separate bandwidth or activation charges.  
*Sources: m12 §3; m09 F10. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

Before considering a retry, verify the destination to prevent a **wrong address**; confirm the intended amount to prevent a **wrong amount**; establish the earlier transaction’s status to avoid a **stuck transaction**; understand the failure and revised resource budget to limit a **lost fee**; and reject unexpected contract authority or permissions that could enable **theft**. Stop on an unexplained failure, unresolved status or unsupported budget.

Memo and multisignature charges are additions to the resource calculation; the multisignature charge is per transaction, not per signature. A wrong address can lose the entire amount plus fees. Adequate resources do not correct a destination mistake.

Freezing also has an availability cost. The documented check of **chain parameter #70** recorded a **14-day unfreeze delay**: funds are locked, not automatically lost. At the dated bandwidth burn rate, **600 frozen bandwidth points** replace **0.6 TRX** of otherwise uncovered bandwidth burn. That arithmetic says nothing about the stake amount required or the energy it will allocate; weigh freezing against the energy actually needed.  
*Source: m12 §3, including the documented parameter check. Check: 2026-11-09 ~11:54 UTC, muse-vm.*

A resource-yield estimate for a proposed stake is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**; there is no fixed conversion rate to copy.

Before authorising a freeze, match the account/address to the intended operation to prevent a **wrong address**; check the amount to be locked for a **wrong amount**; resolve earlier broadcasts for a **stuck transaction**; review payable charges for a **lost fee**; and reject any signing request that changes the intended operation or authority and could enable **theft**. Stop if the resource benefit is unsupported or the funds may be needed during the unfreeze delay.

All monetary figures below are **dated estimates, not standing fees**. The review baseline is **2026-11-09 ~11:54 UTC, muse-vm**; the TON capture is **2026-11-09 ~11:57 UTC, muse-vm**. These protocol and RPC checks do not establish what the Web UI implements at `Pr3eve6ti2o/bawa@56396a20`; source inspection and capability evidence remain open under G9–G10.

**UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** marks unresolved evidence. Each marked item requires a separately authorised, reviewed small-amount rehearsal. This section neither describes nor authorises one.

### TON

#### Model

The accounting model separates the phases, in order:

**storage → credit → compute/gas → action → forwarding → bounce**

These are distinct phases. The account’s current balance is consulted before and during execution; a nominal transfer amount alone is not a sufficient balance check.

For the sending account, the `estimateFee` accounting is:

```text
in_fwd_fee + gas_fee + storage_fee + fwd_fee
```

There is an action phase, but that does **not** justify adding an invented “action fee” to these returned fields.

A Jetton transfer needs whole-chain estimation, covering:

- the main TON transfer;
- deployment of the recipient’s Jetton wallet, if it is new;
- the TON forwarded to the recipient;
- the Jetton wallet’s notification forwarding fee.

The sending account’s estimate alone is not a whole-chain Jetton quote. Attached TON is not the fee; `forward_ton_amount` is not the fee; excesses are not expenditure. Keep the funding supplied to messages separate from the amounts actually consumed.

*Source: m12 §4; m10 F9/F10.*

#### Procedure

**Local loss check: wrong address, wrong amount, stuck transaction, lost fee and theft.** Before any signing decision, verify the destination and amount against the intended payment and review the exact unsigned body. Do not provide a mnemonic or private key to obtain an estimate. Stop if the destination, amount or body cannot be confirmed, if signing material is requested, or if an earlier transaction’s outcome is unresolved.

The following checks remain unsigned:

1. **Establish current chain and account state.** Call `getMasterchainInfo`, record its masterchain `seqno` and check time, and check that the sequence number is advancing. Read the sending account’s balance, deployment status and wallet `seqno`. Establish whether the recipient’s Jetton wallet needs deployment. Stop if the chain is not advancing or the required state cannot be read.

2. **Simulate the exact proposed message.** Call `estimateFee` with the exact unsigned body. Include `init_code` and `init_data` if the account is undeployed, and record the `ignore_chksig` value used. Stop if the proposed body or deployment inputs differ from those reviewed.

3. **Retain and account for the complete response.** Record all four fee fields, their sum, the source and the check time. Convert nanoTON explicitly using **1 TON = 10⁹ nanoTON**; this is a unit conversion, not a tariff. Stop if any required field or Jetton leg is missing rather than treating it as having no cost.  
   *Unit basis and procedure: m12 §4; m10 F9/F10, TON check 2026-11-09 ~11:57 UTC, muse-vm.*

4. **Apply the balance rule and refresh the estimate.** “Enough” means the intended total—value plus the complete estimated fee—is covered where the balance is consulted, with all Jetton deployment and forwarding obligations funded. Re-estimate on any change to the message, inputs or relevant account state, and check again immediately before sending. Stop if the complete balance test cannot be made or does not pass.

The historical capture below is not a substitute for this review: its complete fee response was not retained.

#### Dated baseline table

The transfer scenario was a **0.1 TON self-transfer with a comment**. USD equivalents used the dated TON price estimate of **$1.031 per TON**.  
*Source and check: m12 §4; m10 F9/F10, 2026-11-09 ~11:57 UTC, muse-vm.*

Only `in_fwd_fee` and `gas_fee` were retained for the transfer estimates. The sums and increment below therefore describe **recorded components, not verified all-in costs**. Complete totals and the all-in deployment increment remain **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** under G8; omitted fields must not be assumed absent.

| Case | Dated estimate and scope | Source and check time |
|---|---|---|
| Wallet generation | **$0** estimated charge | m12 §4; m10 F9/F10 — 2026-11-09 ~11:57 UTC, muse-vm |
| Receipt | **$0 separate charge to the recipient**; the funder pays | m12 §4; m10 F9/F10 — 2026-11-09 ~11:57 UTC, muse-vm |
| Deployed V4R2 | `in_fwd_fee` **112,801** + `gas_fee` **6,667** = **119,468 nanoTON**, approximately **0.00012 TON ≈ $0.00012**; retained-component subtotal only | m12 §4; m10 F9/F10 — 2026-11-09 ~11:57 UTC, muse-vm |
| V4R2 including deployment through StateInit | `in_fwd_fee` **624,934** + `gas_fee` **105,601** = **730,535 nanoTON**, approximately **0.00073 TON ≈ $0.00075**; retained-component subtotal only | m12 §4; m10 F9/F10 — 2026-11-09 ~11:57 UTC, muse-vm |
| Increment between those retained-component estimates | **0.000611067 TON ≈ $0.00063**; not a verified all-in deployment increment | m12 §4; m10 F9/F10 — 2026-11-09 ~11:57 UTC, muse-vm |

The first-transfer estimate is higher because it includes StateInit. There is no fixed activation tariff: “deployment cost” describes the extra work in the scenario, not a standard fee.

The following amounts were unresolved at the same TON check:

- Whole-chain Jetton transfer fee — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** (G7).
- Additional cost when the recipient’s Jetton wallet is absent — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** (G7).
- Complete V4R2 versus Jetton-wallet totals — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** (G8).

*Source and check for these gaps: m12 §4; m10 F9/F10, 2026-11-09 ~11:57 UTC, muse-vm.*

#### Mistakes

Any proposed correction needs its own local review for **wrong address, wrong amount, stuck transaction, lost fee and theft**. A successful simulation does not remove these loss modes.

- **Wrong address.** A transfer to the wrong valid destination can lose the entire principal plus fees. At a wrong uninitialised destination, a bounceable message may bounce, losing delivery fees while possibly returning value; a non-bounceable message may strand the value without a bounce. Address checking before signing is the only protection against these wrong-destination outcomes. Stop if the destination cannot be confirmed.

- **Wrong amount and lost fee.** Too little value can consume fees before delivery fails. Check both the intended amount and whether value plus the complete fee obligation is covered—not merely whether the nominal transfer amount fits the balance. Stop if the amount is wrong, the balance is insufficient or the complete cost is unknown.

- **Bounce and lost fee.** Delivery fees are usually lost, and paying them can reduce the value returned. Do not budget for a full bounce refund. A bounce returns to the **immediate sender**: for a Jetton transfer, that is the Jetton wallet, not the user’s wallet. Stop if the plan depends on a full refund or an automatic return to the user’s wallet. A numeric bounce quote is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.  
  *Source and check: m12 §4; m10 F9/F10, 2026-11-09 ~11:57 UTC, muse-vm.*

- **Stuck transaction.** The available review here is to re-read balance, deployment status and `seqno`, then re-estimate any changed message. It is not a general resend rule. Stop while the earlier transaction’s outcome or the applicable recovery route remains unresolved; do not repeat the payment merely because an estimate is available.

- **Theft.** Keep the reviewed destination, amount and body tied to the signing decision, and keep signing material out of the fee-estimation process. Stop on an unexpected recipient, a changed body or a request for a mnemonic or private key.

Storage also accrues on idle accounts. Its formula uses configuration parameter `18`; the annual amount is **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. The dated separate-recipient-charge estimate above does not remove storage accrual.  
*Source and check: m12 §4; m10 F9/F10, 2026-11-09 ~11:57 UTC, muse-vm.*

#### Confirmation

A TON payment is treated as confirmed under the policy in §12: **1 masterchain seqno** — one masterchain block referencing the shardchain block containing the transaction, with the outgoing message verified as successful (delivered, not bounced, not failed). Count masterchain seqno progression from inclusion, not the wallet's account seqno and not wall-clock time. This is a confirmation policy, not a finality guarantee, and TON confirmation tracking is not implemented in the drafts, so the check is manual. Do not treat a fee estimate, a simulation, or a masterchain head observation as confirmation.

### Cross-chain simple-send table

These are dated native-asset simple-send estimates, not token-transfer quotes or current budgets. For BTC, ETH and TRX, the table cites the m12 §5 comparison record at the session baseline; the underlying source-specific checks remain in parts 1–3. TON uses its later capture time.

The comparison record supplies totals but not numerical rate inputs. Those missing rate inputs are marked below; none has been inferred from a total.

| Chain | Rate or resource basis available here | Dated simple-send estimate | Source and check time |
|---|---|---|---|
| BTC | Fast/patient rates not supplied here — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** | Fast: **423 sats ≈ $0.31**; patient: **141 sats ≈ $0.10** | m12 §5 comparison; source-specific records in parts 1–3 — baseline 2026-11-09 ~11:54 UTC, muse-vm |
| ETH | Gas-rate input not supplied here — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** | **0.00000311 ETH ≈ $0.007** | m12 §5 comparison; source-specific records in parts 1–3 — baseline 2026-11-09 ~11:54 UTC, muse-vm |
| TRX | Quota-dependent; resource burn-rate input not supplied here — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** | **0 TRX in quota**; **0.265 TRX ≈ $0.084 out of quota** | m12 §5 comparison; source-specific records in parts 1–3 — baseline 2026-11-09 ~11:54 UTC, muse-vm |
| TON | Phase-based estimate; only `in_fwd_fee` and `gas_fee` retained | Deployed: approximately **0.00012 TON**; first transfer including deployment: approximately **0.00073 TON**. Both are retained-component subtotals; all-in totals are **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL** (G8). | m12 §5; detail in m12 §4 and m10 F9/F10 — TON check 2026-11-09 ~11:57 UTC, muse-vm |

**Before a send on any of these chains, review wrong address, wrong amount, stuck transaction, lost fee and theft locally.** Confirm the intended recipient and amount, keep signing material private, and ensure the proposed transaction is the one reviewed. Check the fee immediately before sending and record its **source, check time, rate or resource basis, and total**.

For a native-asset send, “enough” is a balance rule: the spendable balance must cover the intended value plus the complete fee. For a token send, token quantity and fee funding are separate checks; a token-only wallet cannot send. The review must also record whether first-send deployment or other first-send conditions change the cost.

Recovery must remain chain-specific. BTC, ETH and TRX need their respective stuck/failed-transaction recovery checks alongside the reviews in parts 1–3. TON needs the current-state and bounce checks above. This comparison supplies no general retry instruction.

A transfer delivered to a wrong valid address is irreversible on all four chains; TON bounce behaviour is not an undo facility for such a payment. **Stop** if the destination or amount is uncertain, signing material is requested, the rate or total is missing or stale, the balance test fails, or the existing transaction’s state and recovery route are unresolved. Do not authorise a send from this table alone.

### Draft warnings

- **TRX `feeLimit`:** the draft confuses a smart-contract budget with the mainnet maximum. At the dated review, **1,000,000 SUN** was a smart-contract budget only; the reported mainnet ceiling estimate was **15,000,000,000 SUN**. Neither is a quote for actual expenditure or a recommended setting. The smaller value must not be presented as the maximum accepted on mainnet.  
  *Source and check: m12 §7, baseline 2026-11-09 ~11:54 UTC, muse-vm.*

- **TON estimation timing:** the draft’s broadcast-only wording is misleading. `estimateFee` simulation exists **before signing**, using the exact unsigned body and deployment inputs where applicable. The procedure above is not dependent on first broadcasting a transaction.  
  *Sources: m12 §7; m12 §4; m10 F9/F10.*

- **BTC fee sources:** the draft’s examples derive from mempool.space **testnet** fee data. Re-point the examples to **mainnet** data and retain the source and check time with each replacement figure. No draft fee example is established as a mainnet fact merely by appearing in the Web text.  
  *Source: m12 §7.*

### Gaps to register — M-register candidates

- **G1** — BTC congested rate — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G2** — BTC node-specific relay/dust values — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G3** — ETH failed ERC-20/approval gas ranges — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G4** — BTC change-branch derivation — review outstanding.
- **G5** — TRX USDT new-holder energy — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G6** — TRX `getUnfreezeDelayDays` live value — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G7** — TON Jetton transfer fee and new-recipient increment — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G8** — TON complete `estimateFee` accounting and V4R2 versus Jetton totals — **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**.
- **G9** — Web draft source inspection — review outstanding.
- **G10** — Repo capability claims — evidence outstanding.

## 15. Security posture and threat model

This section supplies analysis and links back to [§2](#2-mainnet-warnings-and-stop-conditions), the warning home; it never replaces §2 or competes with it. Here, the threat model maps routes to loss of funds or recovery access, the scope of that loss and the controls to apply.

The likelihoods below are conditional planning judgements for ordinary-use exposure, not measured attack rates.

### What changes on mainnet

The testnet-only threats drop out: testnet-faucet exhaustion, quotas and unavailability; theft of valueless test coins; and disruption confined to rehearsal.

None of the wallet-compromise mechanisms disappears. A testnet mnemonic reused on mainnet, or malware retained on a shared device, can cause real loss. Keep untrusted rehearsal software out of a clean, separate mainnet signing environment.

> **Never** reuse recovery material on mainnet if it has been used on testnet. Generate independent mainnet recovery material; ignoring this separation puts all mainnet funds under the reused material at risk.

No technical mechanism in this model is genuinely mainnet-exclusive. What is new on mainnet is the real-fund objective and loss mode.

### Consolidated threat table

‘All funds’ means all funds the compromised material can authorise. Read the controls together with the qualifications immediately below the table.

| Threat | Planning likelihood | Loss scope | Required control |
|---|---|---|---|
| Clipboard/address-substitution malware | Medium | Single transfer to the substituted destination | Compare the entire pasted address character by character with an independently verified destination. |
| Digital recovery exposure: info-stealers, clipboard, photos, notes, cloud | High | All funds under exposed usable material | Keep readable recovery backups only on offline paper or metal. |
| Recovery phishing, fake support, fake wallet sites | High | All funds under disclosed usable material | Enter recovery words only in an independently authenticated wallet restore flow. |
| Reusing testnet recovery material on mainnet | Medium | All mainnet funds under the reused material | Generate independent mainnet recovery material. |
| Infected rehearsal device carried into mainnet use | Medium | Single transfer or all funds under captured material | Keep untrusted rehearsal software out of a clean, separate mainnet signing environment. |
| Address poisoning through transaction history | High | Full amount of the mistaken transfer | Use an independently verified address-book entry, never an address copied from history. |
| Excessive/malicious EVM token approvals | High | Authorised tokens up to the remaining allowance | Approve only the exact token amount needed. |
| Malicious EVM permits, including Permit2 | Medium | Tokens and amounts within usable authorisation | Verify chain, token, spender, amount, expiry and authority before signing. |
| Blind signing | High | Single transfer or wider authority, depending on the payload | Refuse to sign data the wallet cannot meaningfully decode. |
| Compromised dependency/build/update | Medium | Many holders; up to all funds under compromised material | Require evidence linking source tag → exact lockfile → clean build → tests → artefact hash → release. |
| Fake release/unverified distribution | Medium | All funds under exposed material; potentially many holders | Accept a release only after verifying its signature against an independently authenticated publisher key. |
| Tampered/pre-initialised hardware | Medium | All funds under captured or preset material | Use maker-direct hardware only; initialise it yourself with freshly generated words. |
| Predictable/hand-made/publicly known recovery material | Medium | All funds under that material; many holders if the flaw is shared | Use a reviewed cryptographically secure generator; never hand-pick words or use test fixtures. |
| Signing-device theft | Medium | Funds accessible to the signer; seed-wide if keys are copied | Use device locking and encryption. |
| Recovery-backup theft | Medium | All funds if the stolen material satisfies recovery requirements | Secure recovery words separately from the signing device and any BIP-39 passphrase. |
| Recovery loss/destruction/unusable backups | Medium | All access if no usable route survives | Keep offline backups in separate, secure, fire/water-protected failure domains. |
| Insider/household misuse | Medium | Funds within that authority; treasury-wide if a quorum is captured | For a treasury, split multisig across makers and locations; no person or site may hold a quorum. |
| Coercion/ransom demands | Medium | Compelled transfers, potentially all accessible funds; personal harm | Put personal safety before protecting the wallet. |

### Qualifications to the table

**Recovery entry is narrowly constrained.** The requirement for an independently authenticated wallet restore flow is not permission to type recovery words into a general-purpose online device. Keep readable recovery backups only on offline paper or metal. The restore-flow requirement is a control to satisfy, not a claim that Bawa already supplies genuine-app verification.

> **Stop** If you suspect recovery-material exposure, stop routine use and move funds to fresh recovery material in a clean environment. Deletion, a PIN change or a remote wipe does not revoke copied keys. Leaving funds under the exposed material allows anyone holding a usable copy to retain authority over those funds.

> **Warning** If you use a small test transfer, it limits that test’s loss only. Repeat the character-by-character check of the entire pasted address against an independently verified destination for the actual transfer; skipping it risks sending the full actual amount to a substituted destination.

**Decoding is not approval to sign.** Meaningfully decoded data can still authorise loss. Refusing blind signing does not remove the need to examine the authority requested. Review and revoke token approvals regularly. Outstanding permit signatures need separate consideration; they must not be treated as cancelled merely because an allowance has changed.

**Verification and recovery continuity need their own controls.** Keep `bip_utils` pinned and verification-only. Verify that recovery works without exposing the material or relaxing the recovery-entry and offline-backup rules. Document an explicit inheritance plan. Keep any BIP-39 passphrase separate from the recovery words, and keep the words separate from the signing device. Offline backups need separate, secure, fire/water-protected failure domains.

**Coercion remains a personal-safety threat.** Neither a BIP-39 passphrase nor a vault unlock passphrase guarantees protection under coercion; the same is true of hidden backups, decoy wallets, a device PIN and multisig. Personal safety comes before protecting the wallet.

### Permit2: two independent paths

`AllowanceTransfer` and `SignatureTransfer` are **two independent paths, not sequential layers**. The token’s own ERC-20 approval to the Permit2 contract is a prerequisite for transfers through either path.

- **`AllowanceTransfer`** uses a standing allowance inside Permit2.
- **`SignatureTransfer`** bypasses a standing allowance inside Permit2 only. It does **not** bypass the token’s ERC-20 approval to the Permit2 contract.

The token approval, any standing Permit2 allowance and outstanding permit signatures therefore need separate attention. Before signing a permit, verify the chain, token, spender, amount, expiry and authority. A wallet displaying decoded fields does not make the requested authority acceptable.

Reducing an allowance or using `lockdown` does **not** invalidate outstanding permit signatures. Where supported, use the appropriate `invalidateNonces` or `invalidateUnorderedNonces` operation to invalidate them. Do not mistake an allowance change for signature cancellation.

Never assume that disconnecting or clearing state cancels outstanding signatures. A signature that remains usable is still part of the exposure, subject to its authorisation and the transfer prerequisites above.

### Build, release and review gates

For `Pr3eve6ti2o/bawa` at `56396a20`, the build, release and review gates remain open and undecided:

- **Root dependency lock:** no root lockfile exists; there is only a tools lockfile.
- **CI references:** `ubuntu-latest`, `actions/checkout@v4`, `setup-node@v4` and `setup-python@v5` float.
- **External review:** the gate is **OPEN** in `docs/16`.
- **Vulnerability disclosure:** there is no vulnerability disclosure channel (`OI-065`).

The required evidence chain is:

**source tag → exact lockfile → clean build → tests → artefact hash → release**

Release acceptance also requires verifying the release signature against an independently authenticated publisher key.

These are acceptance requirements, not established Bawa facilities. The evidence does not establish that Bawa already provides release signatures, genuine-app verification or provenance. Do not read the controls in the table as claims that those facilities exist or that the open gates have passed.

### Fake support and recovery-fee scams

Recovery-fee scams take more money from victims rather than repairing the compromise. A sweeper may steal fee top-ups while other assets remain stuck for lack of fees.

Changing the vault unlock passphrase cannot undo recovery-phrase exposure or revoke copied keys. The response to suspected exposure remains moving funds to fresh recovery material in a clean environment, not merely changing the wallet’s local unlocking credential.

> **Stop** If a stranger tells you to add fees to recover funds, do not improvise a fee top-up on their instructions. If no verified chain procedure exists, stop. Continuing can lose more money to the scam or to a sweeper while leaving the other assets stuck for lack of fees.
### Scams and social engineering

Scams and social engineering are the most common route to wallet loss. They do not require broken software: a wallet can behave correctly while carrying out a payment to an attacker’s address or granting authority you were tricked into approving. These checks add the operational and chain-specific detail to the warnings in §2; they do not replace them.

#### Address poisoning

Address poisoning corrupts the place you choose a recipient from. An attacker seeds transaction history with a lookalike address whose first and last characters match those of a frequent counterparty. The aim is to make you later copy the attacker’s address from history, mistaking it for the familiar recipient.

There are three forms: **zero-value transfers**, **tiny or dust transfers**, and **fake-token transfers**. Looking only for zero-value entries misses the other two. An entry’s presence in transaction history is not evidence that its address belongs to your intended recipient.

Tsuchiya and Christin of Carnegie Mellon, reporting at **USENIX Security 2025**, measured about **270 million attempts** against about **17 million victim addresses** on Ethereum and BNB Smart Chain between **July 2022 and June 2024**. They identified **6,633 successful incidents** and at least **$83.8 million in confirmed stablecoin losses**. That loss figure is a stablecoin-only lower bound, not an all-asset total.

Reported cases show both the scale of individual losses and the trap in relying on a test payment:

- **May 2024:** a victim sent **1,155 WBTC**, worth about **$68 million**, to a lookalike address. The attacker later returned about **22,960 ETH**, over **96% of the value**. That return was exceptional, not a recovery expectation.
- **May 2025:** **$2.6 million in USDT** was lost across two zero-value-transfer scams.
- **December 2025:** about **$50 million in USDT** was lost after a correct **$50 test payment**. Minutes after the test, the victim copied a poisoned address from history for the main payment.

These case figures retain their own dates and scopes; do not add them to the study’s stablecoin-only loss figure.

> **Warning** After a successful test payment, check the main payment’s full destination again against the original verified source outside transaction history, both after pasting and on the signing display. Do not reselect the recipient from history. The test concerns only the destination used for that test; ignoring these checks can send the main payment to a different, attacker-controlled address.

#### Clipboard swappers

A clipboard swapper, or clipper, replaces clipboard contents between copying and pasting. You can copy the correct address from the correct source and still paste an attacker’s address.

Lookalike clippers deliberately preserve the first and last characters people commonly check. A matching beginning and ending therefore does not establish that the pasted address is unchanged.

- **2017 — CryptoShuffler:** Kaspersky reported **23 BTC stolen**, worth about **$140,000** at the time.
- **November 2022 — Laplas Clipper:** it substituted first-and-last-character lookalikes. Researchers reproduced a convincing lookalike in about **five seconds**.
- **2025 — MassJacker:** CyberArk identified **778,531 unique attacker addresses**, with about **$95,300 held** and about **$336,700 passed through** at analysis time. These are address-count, balance and flow observations, not a verified total of victim losses.

No credible total loss figure exists for clippers. The MassJacker balances and flows do not provide one.

#### Use both checks in one payment procedure

Poisoning and clipping attack different steps:

- The **source-selection check** establishes the intended recipient outside transaction history. It addresses copying the wrong address in the first place.
- The **substitution check** compares the pasted and signing-display addresses with that original verified source. It addresses replacement after a correct copy.

Neither substitutes for the other. Comparing every character against a poisoned history entry only confirms the wrong recipient. Choosing a verified source does not prevent a clipper from replacing what you copied.

Use this procedure for each payment:

1. **Establish the recipient outside history.** Obtain the intended recipient’s full destination from a verified source outside transaction history. Keep that original source available throughout the payment. Do not use a recent-transaction entry to choose or reselect the recipient.
2. **Check after pasting.** Compare the entire pasted destination with the original verified source, character by character—not just the first and last characters.
3. **Check on the signing display.** Before authorising the payment, compare the full destination shown for signing with the original verified source. Comparing it only with the pasted text is not enough.
4. **Repeat for the main payment after any test.** Check its full destination again after pasting and on the signing display. Continue using the original verified source; do not return to history to select the recipient.

> **Stop** If you cannot establish the recipient outside history, any character differs, or the signing display cannot show the full destination, do not sign. Resolve the discrepancy and complete both checks before proceeding. Continuing can transfer funds to an attacker even when an earlier test payment succeeded.

#### Ice phishing, drainers and Permit/Permit2

Ice phishing seeks an authorisation, not necessarily your seed words. A drainer can obtain a signed approval or permit through a legitimate-looking site. A trusted URL and an audited contract are not sufficient protection: you still need to establish what the particular request authorises and who receives that authority.

With **drainer-as-a-service**, the developer supplies the draining mechanism, not necessarily the visible lure. The lure and the drain are separate roles. Do not assume the person or site presenting the request wrote the draining code.

**Permit and Permit2 make an empty transaction history a poor reassurance.** A valid signed permit can establish a future allowance. It can also recreate a cleared allowance if its nonce and validity remain usable. Seeing no transaction, or seeing that an allowance has been cleared, is not by itself an all-clear.

> **Stop** If you cannot establish who an approval, permit or account-permission request empowers and what it permits, reject it and verify the intended authority independently using the appropriate chain-specific procedure. Signing can grant a drainer authority over funds despite a trusted URL or an audited contract.

##### EVM chains: allowances and permits

Review allowances on each affected chain and revoke unwanted ones through a procedure verified for that chain. Separately establish whether any signed Permit or Permit2 authorisation remains usable. Do not assume that revoking a current allowance invalidates every outstanding permit; its nonce and validity matter.

**Revoke.cash — reference only; its live workflow is not independently verified for this guide.** Verify its entry point, current chain support and relevant procedure before using it. It **does not cover TRON**.

A revocation check on one chain is not a review of authority granted on another. Keep the chain, the current allowance and any outstanding permit separate in your review.

##### TRON: include account permissions

Use a verified TRON-specific procedure for approval review and revocation. Include account permissions in that review: TRON’s `AccountPermissionUpdateContract` (**ID 46**) changes account permissions, a different control layer from an EVM token allowance.

The reported figure of about **$129 million** relates to one case involving this mechanism; the case date is unverified here. It is a single-case figure, not a TRON-wide loss total.

If you find an unexpected permission change, follow the verified TRON-specific response procedure. Do not apply EVM allowance instructions to it, or treat a Revoke.cash result as a review of a TRON account.

#### Fake support, fake wallet apps and giveaway lures

##### Fake support

“Support contacted me first” is already a warning. End that conversation and initiate any recovery yourself through the verified procedure, rather than following the unsolicited contact’s links or instructions.

Do not send wallet secrets to support, “validation” sites or claim sites. That includes seed words, private keys, a BIP-39 passphrase or a vault unlock passphrase. Calling a request “validation” or “recovery” does not change what disclosure gives the recipient.

A password change does not rotate the wallet’s keys. If keys have been disclosed, changing a password is not a substitute for following the verified recovery procedure.

##### Fake wallet apps and extensions

A store listing is not authentication. A counterfeit client can capture wallet material you import **or create within it**, or redirect deposits. Reinstalling the genuine app cannot recover funds already transferred.

Start from the maker’s canonical site or repository, then check the publisher, package identity and requested permissions. Verify signatures where a verification process exists. Do not treat availability in an app or extension store as a replacement for those checks.

Never import a mainnet mnemonic merely to test an unfamiliar app or extension. That is not a verified restore or a recovery drill.

##### Giveaways, double-your-coins and pay-to-claim offers

Payment-first giveaways, “double your coins” promises and pay-to-claim messages are scams. If a supposed claim, unlock or support process requires you to send funds first, do not pay: following that instruction transfers funds to the scammer.

A legitimate wallet or support route never requires a payment to claim or unlock funds.

#### Seed words: four legitimate moments

Seed words belong in four moments, and nowhere else:

1. **Generation** — when the verified wallet generates them.
2. **Offline backup recording** — recording those words in your offline backup.
3. **Verified restore** — entering them through a verified wallet and restore procedure.
4. **A rehearsed recovery drill** — deliberately practising the verified recovery procedure, not trying an unfamiliar app or responding to an unsolicited prompt.

Support, validation and claim flows do not create a fifth exception.

> **Never** If any other flow asks for seed words, do not enter or send them. Leave the flow and initiate any needed recovery yourself through the verified procedure. Disclosure can give an attacker control of the wallet.
### Device security

Treat the device as part of the wallet’s security boundary, not just somewhere to run the app. The two validation drafts have different, limited and unreviewed vault models. Neither vault provides a demonstrated mainnet security boundary.

#### The two vault models

| | Web validation draft | Android validation draft |
| --- | --- | --- |
| Vault model | Encrypted vault stored in the browser, using AES-256-GCM and its own additional authenticated data string `bawa-web-vault-v1`. | Keystore-bound vault. The model describes a 60-second auto-lock where supported, but the Android draft has no auto-lock to rely on. |
| Acceptance rules and unlocking | The draft’s acceptance rules specify PBKDF2 with 600,000 iterations and an 8-character minimum for the vault unlock passphrase. These are acceptance rules, not endorsed strengths. | The biometric gate is a UI-layer check only. Enrolling a new fingerprint or face may invalidate the wrapping key. |
| Review and isolation limits | Its strength is unreviewed: there is no audited threat model and no stated attacker model. A browser vault is not hardware-keystore isolation and is not equivalent to hardware-keystore isolation on Android. | Keystore binding and the UI-layer biometric check do not establish a demonstrated mainnet security boundary. Do not treat the conditional vault timing as a guarantee that the draft will lock itself. |

#### Known draft limits

Among these two validation drafts, we recommend **Android first**, as a relative preference only. This is not a mainnet endorsement.

- The Web draft has no content security policy.
- The Web draft’s “10 minutes of inactivity” auto-lock claim is inaccurate. The Android draft has no auto-lock. Do not rely on either draft to lock itself.
- Neither the Web draft nor the Android draft clears the clipboard.
- Phrase display and screen locking are not capture prevention. On Android, `FLAG_SECURE` screenshot/screen-recording prevention is only in the Backup/Import routes, not throughout the app.
- Android’s three-word quiz does not substitute for full, ordered re-entry of all 24 words. Complete that full re-entry during a recovery rehearsal; do not count the quiz as a replacement.

#### Device-hygiene checklist

Before generating, restoring or using a wallet:

- [ ] Keep the device OS and browser patched.
- [ ] Run no untrusted software on the device.
- [ ] Avoid public Wi-Fi for wallet work.
- [ ] Use a device PIN and lock screen, and lock the device manually when leaving it.
- [ ] Keep the device backup distinct from the wallet recovery plan.
- [ ] Keep wallet software separate from rehearsal software.
- [ ] Check the device for tampering before generating or restoring a wallet.

#### Device backup is not wallet recovery

> **Never** When backing up or replacing a device, do not rely on the device backup for wallet recovery. Device backups do not restore wallets. Preserve the recovery material independently; without it, losing the device can leave you unable to recover.

A new phone does not automatically restore the wallet. The new device needs an independent recovery plan: restore the wallet from preserved recovery material on that device, then repeat the recovery rehearsal. Recovery requires that material, not possession of the old device.

#### Lost or stolen device

> **Stop** If the wallet device is lost or stolen, stop and do not act on it directly. Recover from preserved recovery material on a clean device; acting on the lost device instead risks relying on an environment you no longer control.

> **Warning** After loss or theft, an attacker may already hold material copied from the device, so you may be in a theft race. Move funds to a wallet with fresh recovery material generated in a clean environment. Merely locking or wiping the stolen device does not remove copied material; relying on that alone may let the attacker spend first.

#### Extended public key (xpub) exposure

An exposed extended public key (xpub) reveals the account’s addresses and transaction history. This is a privacy loss; the xpub does not authorise spending. Keep it private if you do not want that account activity disclosed.

#### Platform gaps and compensating behaviour

Do not assume that a control available on one platform or route applies elsewhere. Where a control is absent or cannot be relied on, change how you work rather than assuming the draft will enforce it:

- **Automatic locking:** lock the device yourself. Neither the inaccurate Web inactivity claim nor Android’s conditional vault model is a reason to leave it unlocked.
- **Clipboard clearing:** neither draft provides it. Avoid copying secrets; if you have copied one, clear the clipboard yourself where the OS allows.
- **Capture prevention:** Android’s `FLAG_SECURE` coverage stops at the Backup/Import routes. On either draft, keep recovery material out of screenshots and screen recordings; phrase display and screen locking do not prevent capture.
- **Web content security policy:** the policy is absent. Keep the browser patched and run no untrusted software, but recognise that these hygiene measures do not supply the missing policy.

These are compensating behaviours, not fixes for the missing controls. They do not remove the vaults’ limits.

## 16. Testing and independent verification

The evidence baseline for this section is **2026-11-09**. Later checks need their own dated records. Component results do not, by themselves, pass a release gate or complete a recovery rehearsal. (M06; M27 §2.4.)

### The three-stage ladder

Keep the `docs/10` sequence: **local → public-testnet rehearsal → small-amount mainnet rehearsal**. Each stage needs evidence of its own; an earlier result cannot stand in for a later check. (M28-055; M28-056.)

1. **LOCAL — Bitcoin Core regtest**

   Keep the Bitcoin Core regtest stage, including the documented “generate 101 blocks in under a second” example. This is a local exercise, not a mainnet timing or confirmation claim. Local Ethereum, TRON and TON testing remain excluded from the documented sequence.

   **Deletion warning: deleting the wrong directory can remove mainnet wallet data — always back up mainnet wallets before dangerous operations.**

   **Pass criteria:** complete and record the retained local exercise, with every required recorded public-output target matching in full under §9.

   **Stop conditions:** an incomplete check, a mismatch, missing independent originals, or uncertainty about a directory targeted for deletion. Do not proceed with the deletion while its target is uncertain. (M28-055; M28-056; M16-F36; M16-F42.)

2. **PUBLIC TESTNET — retain the rehearsal stage**

   Retain the public-testnet stage from `docs/10`. For this mainnet guide’s endpoint checks, preserve the structure **`curl` request → `jq` extraction → expected-result comparison**, but use **mainnet expectations**. In particular, query `eth_chainId` against the mainnet RPC and expect **`0x1` (= `1`)**. That request contacts mainnet; it must not be described as a testnet result or evidence of a transfer.

   **Pass criteria:** the retained rehearsal checks have completed with recorded results, the endpoint observations match their expected values, and the selected network and configuration match the record independently of the address comparison.

   **Stop conditions:** a missing runnable check or dated record, a failed probe, or a network/configuration mismatch. Provider-published expectations are not observed results. No endpoint pass is established by the evidence supplied here. (M28-055; M28-056; M28-OI-02; M16-F42.)

3. **SMALL-AMOUNT MAINNET REHEARSAL — UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**

   This stage comes after the public-testnet stage. The offline half still uses a disposable fixture. Follow §10 for the clean-install restore, using expected addresses written down beforehand, stated pass criteria and a sanitised record. Use §9 for the public-output comparison rather than repeating that procedure here.

   The other half is a **small-amount mainnet signing check**. Disposable-fixture testing does not replace it.

   **Pass criteria:** both halves have been executed, their pass criteria have been met, and the results are recorded.

   **Stop conditions:** missing independent originals, an output or network mismatch, or any unmet rehearsal criterion. Missing originals block funding, including funding for the rehearsal. The current rehearsal status is **FAIL (unexecuted)**; the mainnet signing half remains **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. (M27; M16-F14; M16-F36; M16-F42; M28-012.)

### Recorded suite results

These are the results recorded at the **2026-11-09 evidence baseline**. Separate execution dates are not supplied, so the baseline must not be relabelled as a test-run date. (M27 §2.4, `verify2`.)

| Suite | Date basis | Scope and recorded result |
|---|---|---|
| **T1 — repo tools** | 2026-11-09 baseline | **15 PASS**; live generation under a real pty; decrypt round trip **4/4**; `derive.js` **9/9** and `compare.js` **9/9** against independent `bip_utils` re-derivation; daemon protocol, including bad-chain rejection; `npm test` **28/28**; differential test **byte-identical**. |
| **T2 — Web draft** | 2026-11-09 baseline | Real-browser testing: **19 PASS / 0 FAIL / 3 INFO**; **0 console errors**, **0 page errors**, **0 failed requests**. The **3 INFO remain INFO**, not additional passes. |
| **T3 — fix spot checks** | 2026-11-09 baseline | **9 MATCH / 0 MISMATCH** in spot checks of the **200-finding fix**. These are spot-check results, not a claim that every finding was independently retested. |

The test/CI suite proves **offline derivation only**. These component results do not complete the recovery rehearsal, verify mainnet endpoints or confirmation policies, or establish spending capability. A decrypt round trip is not the rehearsal. (M06; M27; M16-F14.)

**Send/sign/broadcast has never been exercised on any network.** Mainnet sending, signing and broadcasting remain **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. (M27; M16-F14; M28-012.)

### Gate catalogue and rehearsal status

Keep the gate catalogue and definitions in **`docs/10`** as the gate list. The component-test table above is not a replacement catalogue.

The available evidence supplies no command for the following required checks. Their M06 status therefore remains **BLOCKED**; do not infer a gate pass from a component result. (M06 R01–R10.)

| Required-check record | Status |
|---|---|
| M06 R01 | **BLOCKED** |
| M06 R02 | **BLOCKED** |
| M06 R03 | **BLOCKED** |
| M06 R04 | **BLOCKED** |
| M06 R05 | **BLOCKED** |
| M06 R06 | **BLOCKED** |
| M06 R07 | **BLOCKED** |
| M06 R08 | **BLOCKED** |
| M06 R09 | **BLOCKED** |
| M06 R10 | **BLOCKED** |

The **README §18 recovery gate is FAIL (unexecuted)**: **“Unexecuted = FAIL”**. The recovery rehearsal has never been executed. Its required clean-install restore and small-amount mainnet signing check cannot be replaced by the recorded decrypt round trip. Use §10 for the recovery procedure; the mainnet half remains **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. (M27; M16-F14; M28-012.)

Keep these verification claims separate:

- **Public-output verification:** every required recorded target matches in full. Follow §9.
- **Network verification:** the selected network and configuration match the record, checked separately from the address.
- **Receipt verification — UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL:** a subsequent transfer reaches the already-matched destination on that network.
- **Spending capability — UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL:** none of public-output, network or receipt verification establishes this.

Missing independent originals block the funding gate. An address match cannot fill that gap, and a receipt cannot prove spending capability. (M16-F36; M16-F42.)

### Mainnet endpoint and threshold verification duties

#### Endpoints: expected values, not observations

The provider-sourced candidates below are **EXPECTED values only**. They are not verified mainnet results. Where the record names a service rather than an exact URL, use its provider source to establish the URL; do not guess one. (M28 §6.2; Astra A02; M28-OI-02.)

| Network | Candidate service or URL, as recorded | Status |
|---|---|---|
| Bitcoin | `mempool.space/api` | **EXPECTED — not observed** |
| Ethereum | PublicNode mainnet RPC; Blockscout mainnet | **EXPECTED — not observed** |
| TRON | `api.trongrid.io` | **EXPECTED — not observed** |
| TON | `toncenter.com/api/v2` | **EXPECTED — not observed** |

Before describing an endpoint as verified, **probe it live from the build environment and retain a dated result**. The record should identify the provider source, exact endpoint and network/configuration, request, expected result, observed result and outcome. Preserve the `curl` + `jq` + expected-result structure described above. For the Ethereum identity check, the expectation remains `eth_chainId` → `0x1` (= `1`).

A provider listing is not a probe, and a successful endpoint response is not a funds rehearsal. No dated live mainnet probe results are supplied here. (M28 §6.2; M28-OI-02.)

#### Confirmation thresholds: pinned policies awaiting confirmation

The following are **the guide’s pinned wallet policies**, not verified chain facts. Every policy remains **UNCONFIRMED on mainnet** and must be checked against current chain documentation rather than copied blindly. (M28 §6.3; Astra A02; M28-OI-03.)

| Network | Pinned wallet policy | Mainnet confirmation status |
|---|---|---|
| Bitcoin | **6 confirmations**. | **UNCONFIRMED** |
| Ethereum | **≥12 confirmations AND canonical finalised inclusion**. **12 alone is insufficient.** | **UNCONFIRMED** |
| TRON | **19 distinct Super Representatives out of 27**, with solidified inclusion verified through **`/walletsolidity/*`**. Do not substitute a block count. | **UNCONFIRMED** |
| TON | **1 masterchain confirmation with proof of inclusion**. An unrelated `seqno` step is not proof of inclusion. | **UNCONFIRMED** |

Confirm each policy against current chain documentation and retain the source and review date before relying on it for mainnet checks. An endpoint probe does not validate a confirmation policy, and neither check establishes receipt or spending behaviour. (M28-OI-02; M28-OI-03; M16-F36; M16-F42.)

## 17. Mainnet review gates

A review gate ties a decision to an observable check, required evidence and a stop condition. This section is the locally authoritative mainnet gate catalogue; §21 records its open items. Describing a check, adding a register entry or finishing a procedure does not perform the check.

Keep three states separate:

- **Writing completion:** the prose is done and checked against the done-gate below. **“Complete” means prose done and checked. It never authorises real-fund use.**
- **Unperformed operational checks:** checks not yet run remain visibly **unperformed**, with their dependent actions stopped. A description of the expected result is not execution evidence.
- **Separately reviewed mainnet work:** only an inspectable review record counts. It must identify the reviewed revision, exact scope, evidence examined and remaining restrictions. A review cannot stand in for an operational check that has not been run.

The prose review required for writing completion is not the independent security review required before real funds. Neither review substitutes for missing execution evidence.

Borrowed testnet assurance is the most likely structural failure mode of this document. Testnet references remain evidence of testnet scope, never transferable mainnet sign-off.

### The rehearsal ladder

A pass applies **only to the wallet, chain, network, policy and route actually rehearsed**. It does not transfer to another scope. In particular, completing a testnet prerequisite does not pass a mainnet gate.

| Rung | Required check and evidence | Recorded gate state and limit |
| --- | --- | --- |
| 1. Testnet execution first | Actual execution, with an inspectable record identifying the wallet, chain, network, policy and route exercised. | **FAIL until executed.** No execution pass is recorded by this catalogue. Any resulting evidence remains testnet-only. |
| 2. Watch-only mainnet | Compare the mainnet public address with its independent comparison target and retain the comparison record. | **Unperformed.** When performed, this proves address agreement only—not recovery, signing, sending or readiness to hold funds. |
| 3. Small mainnet receive | After independent security review and all applicable pre-funding checks, record the actual outcome of a tiny mainnet receive for the exact scope. | **Unperformed — `UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL`.** An address match is not receive evidence. |
| 4. Small mainnet send | After the earlier rungs and applicable send prerequisites, record the actual outcome through the separately reviewed route. | **Unperformed — `UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL`.** No send procedure is cleared by another route’s result. |
| 5. Normal use | A normal-use decision requires its own inspectable, scope-specific mainnet review record and evidence for the applicable gates. | **Not cleared.** Rehearsal results do not automatically clear normal use. |

The independent security review gate sits **before rung 3**, before any small mainnet receive—not merely before sending (`docs/14`, L411/L439).

> **Stop** If the independent security review or required pre-funding restoration comparisons are missing or unperformed, leave the mainnet address unfunded. Starting with a receive would expose real funds before those checks and can result in loss or theft.

> **Warning** If a mainnet rehearsal is separately permitted, use only a tiny real amount you can afford to lose. A rehearsal error can lose that amount; ignoring the limit puts more funds at risk. The tiny amount does not waive restoration checks: public outputs and derived account-0 addresses must match their independent comparison targets before funding.

### The mainnet gates

Repository facts below are attributed to `Pr3eve6ti2o/bawa @ 56396a20`. That reference identifies the evidence scope; it is not an approved mainnet revision.

The open-item facts are **gate inputs, not resolutions**. All clearance checks below remain unperformed. Their evidence requirements describe what must be inspectable before a status can change; they do not claim that the evidence exists. Each unmet condition keeps the stated dependent action stopped.

#### Independent security review — theft

**Status: unperformed.**

- **Observable check:** Confirm that an independent security review covering the proposed real-fund scope has actually taken place before rung 3.
- **Required evidence:** An inspectable independent review record identifying the reviewed revision, wallet/chain/network/policy/route, findings and remaining restrictions. A review of this prose alone is insufficient.
- **If unmet:** Every real-fund receive and send remains stopped, including a tiny receive rehearsal. Testnet results cannot waive this gate.

#### Address agreement — wrong address

**Status: unperformed.**

- **Observable check:** Compare the intended mainnet address with its independent public comparison target in the watch-only scope. Do not treat a helper’s output as its own independent target.
- **Required evidence:** The public addresses compared, their exact scope, the independent target and the comparison result.
- **If unmet:** Funding or sending to that address remains stopped. When met, this gate establishes address agreement only; the restoration, review and rehearsal gates still apply.

#### Chain and network agreement — wrong network

**Status: unperformed.**

- **Observable check:** Identify the intended chain and network throughout the wallet and transfer route, and check that the destination belongs to that intended scope. Do not infer network agreement from an address match alone.
- **Required evidence:** A scope record showing the intended and checked chain/network, destination and route, with the comparison evidence.
- **If unmet:** Receiving, funding and sending in that scope remain stopped. A testnet selection or result supplies no mainnet clearance.

#### Amount review — wrong amount

**Status: unperformed.**

- **Observable check:** Before any separately permitted transfer, compare the intended amount and unit with those presented by the proposed route. For a rehearsal, the amount must remain tiny and affordable to lose. Fees require their own check.
- **Required evidence:** A record of the intended amount, the amount presented for confirmation and the comparison result; the executed rehearsal must later record its actual outcome.
- **If unmet:** The transfer remains stopped. An unchecked amount must not be accepted merely because the address agrees.

#### Transaction-state handling — stuck transaction

**Status: unperformed.**

- **Observable check:** Check that the proposed send procedure explains how to establish transaction state and when to stop if that state is unknown or the transaction is stuck. A permitted rehearsal must then provide an observed outcome for the exact route.
- **Required evidence:** The reviewed state-checking and stop procedure, followed by the rehearsal’s transaction-state record.
- **If unmet:** A mainnet send rehearsal remains stopped without the procedure; routine sending remains stopped without execution evidence. Do not repeat or escalate a send whose state is unresolved.

#### Secret handling — seed/secret disclosure and theft

**Status: unperformed.**

- **Observable check:** Review where the route displays, accepts or retains secrets. Address comparison must use public material, not a seed, private key, BIP-39 passphrase or vault unlock passphrase. Check the required warnings before the affected creation, import, recovery or diagnostic entry point.
- **Required evidence:** A non-secret review record of those handling boundaries and warnings. Evidence must not reproduce the reader’s secrets.
- **If unmet:** The affected route remains stopped before secret entry or display. A public-address check does not clear secret-handling risks.

#### Restoration and recovery material — missing recovery material and wrong address

**Status: unperformed.**

- **Observable check:** Confirm that the required recovery material is present and usable for the selected scope. Before funding, restored public outputs **and** derived account-0 addresses must match their independent comparison targets.
- **Required evidence:** A recovery-material completeness record and the public comparison results, without the secrets themselves.
- **If unmet:** Funding remains stopped, however small the proposed amount. A decrypt round trip, an address match on its own or a “recovery tested” label cannot replace the missing checks or an executed rehearsal.

#### TON wallet ID — wrong-account loss mode

**Status: unperformed.** The open input gives the TON wallet ID as `698983191`; drafts record `0`. That discrepancy remains open.

- **Observable check:** Check that the TON route covered by this evidence uses wallet ID `698983191`, not the draft value `0`, and that restoration and address comparisons correspond to that ID.
- **Required evidence:** A corrected, reviewed scope record and independent public-address comparisons identifying the wallet ID used.
- **If unmet:** TON funding and sending remain stopped. An address result for the wrong wallet ID does not establish access to the intended account.

#### OI-096 helpers — silently wrong derived address and seed/secret disclosure

**Status: unperformed; defects live.** `compare.js` accepts private keys and can print silently wrong addresses while exiting `0`. `derive.js` has wrong-branch address outputs.

- **Observable check:** Require an evidenced resolution of the relevant defects before relying on either helper. Check derived addresses against independent targets for the exact branch and scope, and review the private-key input boundary.
- **Required evidence:** Reviewed corrective work and reproducible comparison results for the affected behaviours. Process exit status is not comparison evidence.
- **If unmet:** Reliance on these helpers remains stopped, as does funding any address whose verification depends on their unchecked output. Listing OI-096 in §21 does not fix it.

> **Never** When comparing addresses, do not give `compare.js` a private key or treat its exit status as verification. Ignoring this can expose the key or lead to funding a silently wrong address; exit `0` proves nothing.

#### Unfunded deposit boundary — unfunded-deposit-as-diagnostic

**Status: unperformed.**

- **Observable check:** Before an unfunded deposit address receives funds, confirm that the independent review and pre-funding public-output and account-0 address comparisons are complete. The receive must be a permitted rehearsal, not an experiment to discover whether derivation or restoration was correct.
- **Required evidence:** The pre-funding review and comparison records, tied to the exact proposed receive scope.
- **If unmet:** Leave the deposit unfunded. “Send a little and see” cannot diagnose away missing checks; it can lose the amount sent.

#### Send, sign and broadcast execution — wrong address, wrong network, wrong amount and stuck transaction

**Status: unperformed.** Send, sign and broadcast have never been exercised on any network. Every send procedure remains `UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL`.

- **Observable check:** Observe actual execution through a defined, reviewed route, following the ladder rather than assuming that a written procedure works.
- **Required evidence:** A scope-specific execution record covering the signing, sending, broadcasting and transaction outcome. Testnet and mainnet records must remain separate.
- **If unmet:** Normal sending and any claim of an exercised send route remain stopped. A tiny mainnet send can only be considered at rung 4 after its prerequisites; an absent path or procedure must not be improvised to obtain a result.

#### QR verification — wrong address

**Status: unperformed.** There is no QR verification: Android has no scanning and Web has no encoder.

- **Observable check:** Before a QR-dependent route can be used, verify the actual encoding and scanning path and compare the resulting public address with its independent target.
- **Required evidence:** An inspectable test record for the proposed QR route, including the encoded or scanned address and comparison result.
- **If unmet:** QR-dependent receive and send instructions remain stopped. Neither interface supplies the missing verification, and a non-QR route still needs its own review and address checks.

#### Mainnet fee procedure — wrong amount and stuck transaction

**Status: unperformed.** No mainnet fee procedure is available.

- **Observable check:** Require a reviewed, scope-specific procedure for determining and checking the mainnet fee, including a stop condition when the fee cannot be established or accepted. Its operation must then be observed during a separately permitted rehearsal.
- **Required evidence:** The reviewed mainnet procedure and the rehearsal’s fee-check record. Testnet fee observations are not a mainnet procedure.
- **If unmet:** Without the procedure, mainnet send rehearsals and routine sends remain stopped. Without execution evidence, routine sending remains stopped. Do not invent a fee value or retry method.

#### Signing path — theft and unexercised money movement

**Status: unperformed.** There is no hardware, multisig or Bawa signing path.

- **Observable check:** Confirm that the requested wallet and policy have a documented, separately reviewed route which identifies what performs each transaction operation. Do not assume hardware support, multisig support or Bawa signing.
- **Required evidence:** An inspectable path definition and review for the exact scope. Actual execution remains subject to the separate send/sign/broadcast gate.
- **If unmet:** Signing and sending through those absent paths remain stopped. Do not fund a wallet in reliance on an unevidenced spending path or invent one in the guide.

#### Core pin agreement — unresolved revision input

**Status: unperformed.** Core is pinned at `4.8.4` but stated as `4.9.2`.

- **Observable check:** Reconcile the pinned version, the version stated in the guide and the version proposed for the reviewed route. Do not silently select one side of the mismatch.
- **Required evidence:** A cited resolution, the corresponding reviewed revision and evidence identifying the version actually checked for that scope.
- **If unmet:** Version-dependent setup and any funding or sending that relies on it remain stopped. Citing `56396a20` does not approve either version for mainnet use.

#### Security gates and inactivity protection — theft

**Status: unperformed.** The open input records no security gates or inactivity protection: CI has zero scanning, releases have no checksums or provenance, and there is no disclosure channel.

- **Observable check:** Inspect the proposed revision for the required protections and checks, and submit the findings to the independent security review. Do not infer protection from a repository or release merely existing.
- **Required evidence:** Inspectable evidence of the relevant controls and checks, release-integrity and provenance evidence, disclosure-channel evidence, and the independent review’s scope and restrictions.
- **If unmet:** Dependent real-fund use remains stopped until the gaps have evidence-backed clearance. Acknowledging an absent protection is not evidence that it exists or has been checked.

#### Backup completeness — missing recovery material

**Status: unperformed.** Backups are non-atomic.

- **Observable check:** Check that the reviewed backup procedure can distinguish complete recovery material from an incomplete write, and that the backup to be relied on is complete and usable.
- **Required evidence:** Backup-completeness checks and the required independent restoration comparisons, recorded without secrets. A decrypt round trip alone is insufficient.
- **If unmet:** Reliance on that backup and funding the dependent wallet remain stopped. Do not treat the existence of a backup file as proof of complete recovery material.

#### Generator timeout — missing recovery material

**Status: unperformed.** The generator has a 120-second timeout after secret display.

- **Observable check:** Check that the creation procedure accounts for the timeout and has an evidenced stop condition for an incomplete attempt. Secret display must not be mistaken for complete recovery-material capture.
- **Required evidence:** Observed timeout behaviour, reviewed handling of the incomplete case and a recovery-material completeness check, without recording the secrets.
- **If unmet:** Creation for a wallet intended to hold real funds through that unchecked route, and funding its outputs, remain stopped. Do not race the timeout or assume missing recovery material can be reconstructed later.

### Never-claim rules the gates enforce

These are wording and decision rules, not optional cautions:

- **Do not claim that the repository constructs, signs or broadcasts transactions.** Those claims are forbidden. Send/sign/broadcast have never been exercised on any network, and no Bawa signing path is available.
- **Do not turn a testnet pass into a mainnet assurance claim.** A testnet pass does not mean “safe”. Independent security review is mandatory before real funds, including the small receive at rung 3.
- **Do not call a decrypt round trip a rehearsal.** A “recovery tested” label is not an executed rehearsal either.
- **Do not use exit `0` from `compare.js` as proof of anything.** OI-096 leaves silently wrong address outputs live.
- **Do not describe anything unverified as “safe”, “secure” or “production-ready”.**
- **Do not substitute one check for another.** A decrypt round trip, an address match or a result from another wallet/chain/network/policy/route cannot stand in for a missing check.
- **Do not promote writing status into operational authority.** “Complete”, an open-item entry or a prose review is not authorisation to receive, hold or send real funds.

### The done-gate — writing completion only

The following nine checks decide whether the **prose** may be marked complete. They do not assess mainnet readiness, and listing them does not record that they have passed.

Unperformed operational checks may remain open when the writing is complete, but only where they are visibly unperformed and their dependent actions remain stopped. Unresolved writing blockers may not be treated the same way.

#### Nine writing-completion checks

1. **Coverage.** Every required section (§§1–22) has substantive finished prose, with an explicit coverage check of §2 as well. No placeholder stands in for a procedure, warning or criterion.
2. **Before-creation coverage.** Every setup, creation and import entry point—including recovery and FAQ routes—is preceded by the required warnings.
3. **Action-level coverage.** Every money-movement instruction locally names its loss modes, teaches prevention and states when to stop.
4. **Consistency and navigation.** Warning copies agree with §2, links reach their sections, and no shortcut bypasses a prerequisite or stop condition.
5. **Evidence and wording.** Every value, count and date is checked against cited evidence. Repository facts are attributed to `56396a20` without presenting that head as an approved mainnet revision. There are no “safe”, “secure” or “production-ready” claims, and no legal or tax advice.
6. **Register coverage.** Every uncertainty, deferral and TODO maps to an M- entry with all required fields. Shared issues retain separate scope-specific rows.
7. **Gate independence.** Each mainnet criterion has an observable check, required evidence and an explicit consequence if unmet. Testnet results are not treated as mainnet passes.
8. **Outstanding-item treatment.** No writing blocker remains unresolved. Unperformed operational checks stay visibly unperformed, with dependent action stopped. Registering a gap does not clear it.
9. **Separate review.** An inspectable review record identifies the reviewed prose revision, scope and remaining restrictions. A testnet review is not a substitute; neither scope’s review replaces the other’s. This prose review also does not satisfy the independent security review gate.

#### Six writing blockers and their clearance conditions

1. **Missing coverage or a broken required reference.** Complete the prose and recheck the references. A placeholder or a link to an absent procedure does not clear this blocker.
2. **Missing, bypassable or contradictory warnings.** Restore the warnings, reconcile them with §2 and recheck every affected entry route, including recovery and FAQ routes.
3. **An unsupported fact needed for an in-scope money-movement instruction or criterion.** Supply the evidence, or remove both the claim and its dependent guidance through an explicit scope review. Merely registering the unsupported claim is insufficient.
4. **Untracked uncertainty, a conflated testnet/mainnet entry, or closure without evidence.** Create or correct the M- entry with the required links and evidence meeting the clearance condition for any claimed closure. Where closure cannot be evidenced, restore the open or unperformed status and the dependent stop.
5. **Borrowed testnet authority, an unevidenced pass, an assurance claim or prohibited legal/tax advice.** Remove the offending claim or advice. A permissible factual claim may be retained only with evidence for its exact scope; testnet evidence cannot be repurposed as a mainnet pass.
6. **An unresolved writing-blocking M- item or absent separate review evidence.** Satisfy the item’s clearance condition and obtain the inspectable prose review record. A register entry saying that review is needed is not the review record.

Clearing these blockers completes the writing decision only. It does not perform an operational check or authorise real-fund use.

### Recording gate items in §21

Each gate’s open work belongs in the **M- series in §21**, using all required register fields. The entry must identify the gate and its mainnet scope, state what remains uncertain or unperformed, name the dependent action that is stopped, and specify the clearance condition and required evidence. Every uncertainty, deferral and TODO needs that traceable entry.

A status change must cite inspectable evidence meeting the entry’s clearance condition for its exact scope. Without that evidence, the item remains open or unperformed and the dependent action remains stopped. Neither a status label nor a note that another document has closed an issue is clearance evidence.

A shared issue requires **two scope-specific rows**: an **OI row in Doc 3** and an **M- row in Doc 4**. Cross-link them, but do not merge their authority. Closing either row does not close the other; each needs its own scope-appropriate clearance evidence.

**README §18 is a testnet-only gate catalogue, not mainnet authorisation.** References to it may support testnet scope only. This section defines the local mainnet gates, and §21 records their outstanding work without turning missing checks into passes.

## 18. Troubleshooting and FAQ

Baseline: 2026-11-09, `main` head `56396a20`.

### Troubleshooting

Never request mnemonics, data keys or secret-bearing transcripts in a troubleshooting exchange. Keep that material out of reports and replies. (M16-F11, M16-F33; M04)

#### A re-derived address does not match the recorded original

**Immediate hard stop: do not fund any candidate address.** Never send a deposit, however small, to choose between candidates or diagnose a mismatch. Do not re-fund a guessed address. Do not edit the expected original to match the new output. Checksum validity, decryption success and a balance are not substitutes for reproducing the recorded address. If the original record is questionable, preserve it unchanged and investigate its provenance separately. (M16-F43)

Check the possible causes below in this exact order, **one item at a time**. Corrections are to the derivation inputs or configuration, not to the expected original. After each correction, **re-derive and fully re-compare** against the unchanged original before making another correction. Do not skip ahead or change several settings together. (M16-F43)

1. **Mnemonic — words, spelling or order differ.** Use the original words, with the original spelling and order.
2. **Passphrase — the BIP-39 policy or passphrase differs.** Apply the exact recorded BIP-39 policy. Use an empty passphrase only where it was originally empty; otherwise use the original, separately backed-up passphrase. Never substitute the backup-decryption password.
3. **Curve — an assumed library default differs from the record.** Use the recorded curve, not an assumed default.
4. **Coin type — the path component differs.** Use the recorded coin-type component.
5. **Purpose — the purpose or address policy differs.** Use the recorded purpose and address policy.
6. **Account — a different account has been selected.** Use the same recorded account. Do not substitute another because it looks populated.
7. **Branch — the branch differs, or one has been invented.** Use the same branch where the recorded convention has one. Do not invent a branch for TON.
8. **Index — the index or hardening differs.** Use the same recorded index and hardening.
9. **Network/address encoding — the network or presentation differs.** Check the intended mainnet, BTC/TON presentation, ETH network identity and recorded display policy.
10. **Implementation/configuration — the implementation or its settings differ.** Use the same implementation and configuration. For TON, compare all five recorded fields: contract/version, derivation convention, workchain, network presentation and wallet/subwallet ID.

**Stop condition:** an unresolved mismatch remains a funding stop. If a required setting cannot be established from the record, do not guess it. Neither a plausible address nor a populated account resolves the mismatch. (M16-F43)

#### The recorded address has no current balance

**Cause:** current balance is not transaction history. An address may have received funds and subsequently spent them. Separately, reproducing a wallet with an assumed empty BIP-39 passphrase can produce the wrong address when the original policy was non-empty. The README §13 empty-passphrase instruction and its “never sent” conclusion must not be applied as written. (M16-F45)

**Action:** reproduce the recorded address with the recorded path and passphrase policy, using the ordered checks above. Keep address reproduction, current balance, transaction history and address discovery separate. Examine independent transaction evidence on the recorded network. (M16-F43, M16-F45)

**Stop condition:** do not turn “no current balance” into “never received funds”, choose a different account because it is populated, or re-fund a guess. Address discovery is an **open item**: these findings supply no discovery procedure. (M16-F43, M16-F45)

#### Decryption ends with a traceback or refuses a path

**Cause:** expected decrypt refusals can appear as Python tracebacks with exit status `1`. A symlink refusal is not an instruction to disable the check. (M16-F11, M16-F33; M04)

**Action:** check the decrypt process’s own exit status. The existence of an output file, or success from a downstream command, must not substitute for decrypt success. For a symlink refusal, check provenance and the intended regular-file locations; do not disable or bypass the checks. (M16-F11, M16-F33; M04)

**Stop condition:** if decryption failed, do not treat an existing file as successfully decrypted material. If path provenance remains unresolved, stop rather than bypassing the refusal. (M16-F11, M16-F33; M04)

#### An address tool aborts, or returns plausible but wrong output

**Cause:** BTC testnet `vpub`/`tpub` inputs to `derive.js` can cause an opaque WASM abort, exit status `1` and no address. This is an input-support failure, not evidence of broken derivation. Separately, `compare.js` accepts private extended keys and silently prints wrong addresses with exit status `0`; `derive.js` returns valid-looking addresses for mismatched-chain keys. (M04; OI-096)

**Action:** do not feed BTC testnet `vpub`/`tpub` keys to `derive.js`. Do not use `compare.js` with private extended keys, or accept mismatched-chain output from `derive.js` as validation. Plausible output plus exit status `0` is not validation. If an address mismatch remains, use the ordered mismatch tree above. (M04; OI-096; M16-F43)

**Stop condition:** unsupported input or misleading output cannot establish the recorded address. Keep funding stopped while reproduction remains unresolved; do not diagnose it with a deposit. (M04; OI-096; M16-F43)

#### `make_wallet.py` refuses because `seed.enc.json` already exists

**Cause:** the generator refuses an existing `seed.enc.json` without `--force` or `--regenerate`. This refusal is not a reason to overwrite the bundle. (M03, M16)

**Action:** leave the existing bundle unchanged. Never use `--force` or `--regenerate` to “fix” the refusal. (M03, M16)

**Stop condition:** do not proceed with replacement as a troubleshooting workaround. An intentional replacement procedure is an **open item**; these findings supply no such procedure. (M03, M16)

#### The UI says “backup confirmed”, but full re-entry has not happened

**Cause:** Web import marks the backup confirmed without re-entry through `setBackupConfirmed` at `main.js:529`. Android’s draft uses a 3-word quiz where its guide requires full ordered 24-word re-entry. Neither satisfies the backup gate. (M16-F28, M16-F47)

**Action:** require **full ordered 24-word re-entry** for the backup gate. Any flow that cannot perform the gate is **unsupported**, regardless of its confirmation flag or quiz result. A decrypt round trip is not the recovery rehearsal. Re-entry is not a request to send the words in a troubleshooting message. (M16-F28, M16-F47; M03, M16)

**Stop condition:** do not accept either described confirmation flow as passing the gate, and do not fund on that basis. The recovery-rehearsal execution procedure is an **open item** in these findings; a decrypt round trip must not be substituted for it. (M16-F28, M16-F47; M03, M16)

#### A forgotten vault passphrase blocks opening, deletion or replacement import

**Cause:** a forgotten vault passphrase blocks authenticated opening and UI deletion. On Web, deletion requires `openVault` first. Android import refuses while a bundle exists—“delete it first to import another”—so deletion is a prerequisite to replacement import, not a passphrase-recovery mechanism. (M16-F22–M16-F29)

**Action — destructive-reset warning:** clearing browser storage is a destructive reset, **not passphrase recovery**. Do not present it as recovery or use it as a troubleshooting shortcut. Establish whether complete independent recovery material exists before considering any destructive reset or deletion. Android’s delete-first requirement is not, by itself, a recovery procedure. (M16-F22–M16-F29)

**Stop condition:** when complete independent recovery material is unavailable, stop before clearing storage or deleting a bundle. A forgotten vault passphrase does not become recoverable through deletion. **Open item:** passphrase-change and end-to-end reset/re-import procedures are not supplied by these findings; no execution steps are given here. (M16-F22–M16-F29)

#### A forgotten BIP-39 passphrase produces a different wallet on re-import

**Cause:** this is wallet-key loss, not a vault-opening problem. A wrong BIP-39 passphrase produces a different valid wallet without an error. Blank-passphrase re-import does not recover a wallet that originally used a non-empty passphrase. (M16-F22–M16-F29)

**Action:** apply the recorded BIP-39 policy and, where required, use the original separately backed-up passphrase. Do not substitute the backup-decryption password or try to repair the problem by resetting the vault. (M16-F43; M16-F22–M16-F29)

**Stop condition:** if the required original passphrase is unavailable, the original wallet has not been recovered. Do not fund the newly derived candidate as though it were the original. Passphrase-change execution remains an **open item**, not an implied workaround. (M16-F43; M16-F22–M16-F29)

### FAQ

**What does a decrypt round trip prove?**

Only that the tested round trip worked. The recorded result was **4/4 at the 2026-11-09 baseline**. It is not the recovery rehearsal and does not replace the backup gate. (M03, M16; M16-F28, M16-F47)

**What does exit status `0` prove?**

Only that the process reported successful completion—not that its address output is correct. `compare.js` can print wrong addresses with exit status `0`. A downstream command’s success also says nothing about whether decryption succeeded; check the decrypt process itself. (OI-096; M16-F11, M16-F33; M04)

**Does an empty wallet mean funds were never sent?**

No. No current balance does not mean “never received funds”; earlier receipts may have been spent. Reproduce the address using the recorded passphrase policy, then examine independent transaction evidence on the recorded network. Keep address discovery separate, and never re-fund a guess. (M16-F45)

**What should I do when the seed is lost?**

Complete seed loss—no mnemonic, no bundle, no device and no surviving signing access—is **TOTAL and IRREVERSIBLE loss of spending access**. No support desk, recovery service, reset or reconstruction from an xpub/zpub can restore it. Any offer to recover a lost mnemonic or passphrase for a fee is a scam. (M16-F22–M16-F29)

**What should I do when the seed is exposed?**

An exposed seed requires migration to independent keys. Changing a PIN or app password, or reinstalling, does not repair the exposure. **Open item — migration execution: UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL.** These findings supply no migration procedure. That marker does not override the prohibition on funding guessed or mismatched addresses. (M16-F22–M16-F29; M16-F43)

**Which Node version should I use?**

For this baseline, use the repo-pinned **Node 22.23.4**. The declared range is `>=22 <23`; Node `v24.22.2` is outside it. (M05, M06)

## 19. Updating and rebuilding

### Update rule

Doc 4’s current pin is the repair commit `e3b65fb832db287fdc8d54794980dd0b3456cc12`. **Re-pinning to a newer head is OPEN**, pending the user’s decision. For any agreed update, re-run the **§5 worktree procedure** against the new head; §5 contains the full procedure. **Never update by checking a new commit out in place inside the working directory:** an in-place detach silently replaces the guide being read. (M28; F4 fix)

The cross-reference to the F4 treatment in **Doc 1 §15 was updated to the worktree procedure** in the 2026-11-10 push. (M28; F4 fix; M-34 decided 2026-11-10)

Do not carry over the testnet guides’ old in-place pinning procedure, treat the testnet4 deviation as a mainnet defect, or reuse testnet endpoints, addresses or network metadata as mainnet configuration. Testnet gate outcomes are not mainnet evidence. (M28 §0; M36 F4)

### Pins and candidates

Version records at the **2026-11-09 baseline**: (M05)

| Component | Recorded pin | Candidate or constraint |
|---|---|---|
| Trust Wallet Core | **4.8.4**, in `package.json` and the lockfile | **4.9.1**, the latest stable at the baseline; SHA-1 `18e563fce2111a6fa5ad372cabeb83e6ed0998f0`. **Do not use 4.9.2**: it was npm `latest`, but a GitHub prerelease. |
| Node | **22.23.4**; repo range `>=22 <23` | Node **v24** is outside that range. |
| bip-utils | **2.12.2** | **2.12.3** is the candidate; it postdates the mnemonic-in-exceptions fix. |

**A candidate is not a pin. No version is qualified for mainnet until it passes the promotion checks.** (M05 F7)

Installation belongs in §6. Install the Node tools with `npm ci --ignore-scripts` in `tools/hdwallet-gen`. (M05 F11) **Gap:** CI pins are missing. (M05 F12)

### Post-update re-verification

After **any update**, re-run the recorded suite before trusting the new tree. The figures below are the **2026-11-09 baseline results**, not evidence that the updated tree has passed. (M06; M27)

- [ ] `npm test` — **28/28**.
- [ ] `derive.js` — **9/9**, and `compare.js` — **9/9**, against independent `bip_utils` re-derivation.
- [ ] Decrypt round trip — **4/4**.
- [ ] Differential test — **byte-identical**.
- [ ] Re-check the published fixtures exactly:
  - **BTC:** `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd`
  - **ETH:** `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7`
  - **TRX:** `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`
  - **TON:** `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`

A fixture mismatch after an update is a **hard stop**, not a prompt to edit the fixtures. Use §18 for troubleshooting. (M06; M27)

### Restore-drill renewal

Repeat the restore drill **quarterly**, **after firmware updates**, and **after any procedure change**, including changes to recovery tools, relevant software, backup format, passphrase, derivation policy, account discovery, signing hardware or quorum. Relevant chain or asset-rule changes also trigger reassessment. (M16-F20)

Preserve historical **PASS** records, but do not carry them forward automatically to a changed or overdue configuration. **Unexecuted renewal gates remain FAIL.** (M16-F20)

For **every funded attempt**, re-measure mainnet fees, minimums and the total-loss ceiling. Anything unverifiable without spending real funds must be marked **UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL**. Deferring the real-spend stage must not be reported as a completed mainnet repeat. (M16-F20)

A small spend **does not cap the consequences of exposing a funded seed**. A separate rehearsal wallet can test procedure/tool compatibility, but cannot renew proof of the actual funded wallet’s backup. (M16-F20)

## 20. Primary references and evidence provenance

### How to read the references

**Link-check baseline: 2026-11-09, from `muse-vm`.** This date applies to every link and verdict below. M31 contains the full, per-URL evidence table; this section summarises its **210 checked links** and carries the corrections needed for this guide. These are dated results, not a promise of continuing availability. [M31]

A link is verified by **destination content**, not by HTTP status alone. A **403, 429 or 504 is inconclusive and never proof that a link is dead**. Where verification used an alternative destination, the verdict identifies what was actually checked; it does not establish that the blocked homepage was accessible. [M31]

| Verdict | Count | How to read it |
|---|---:|---|
| LIVE | 195 | Destination content was checked. |
| LIVE-VIA-RAW | 1 | The raw document was verified rather than its rendered page. |
| LIVE-via-API | 2 | The service was verified through its API; the homepage was VM-blocked. |
| LIVE-via-support | 1 | The support site was verified; the homepage was blocked. |
| LIVE-via-registry | 1 | The registry record was verified; the package page was blocked. |
| LIVE (POST-only) | 1 | Availability was verified with POST; GET is not the availability probe. |
| DEAD-404 | 4 | A 404 outcome was recorded. Read the entry’s qualification, particularly for the authenticated Maven registry. |
| UNVERIFIED | 3 | Destination content was not verified. |
| UNVERIFIED (shop rate-limited) | 1 | A shop rate limit prevented verification; this is not a dead-link finding. |
| EXISTS-VM-BLOCKED | 1 | Existence is supported, but the page’s content was not verified from the VM. |

All counts above, and the category tallies below, belong to the **2026-11-09** snapshot. [M31]

### Primary references

#### Standards

**M31 tally: 55 links — 54 LIVE and 1 LIVE-VIA-RAW.**

The standards reference set includes:

- **Bitcoin:** BIP-32, BIP-39, BIP-43, BIP-44, BIP-49, BIP-84, BIP-86, BIP-141, BIP-173, BIP-174, BIP-321, BIP-340, BIP-341, BIP-342, BIP-350, BIP-371, BIP-380, BIP-381, BIP-382, BIP-383 and BIP-386.
- **SLIP:** SLIP-0010, SLIP-0039, SLIP-0044, SLIP-0132 and SLIP-0173.
- **Ethereum:** EIP-20, EIP-155, EIP-1559, EIP-681, EIP-721 and EIP-1155.

Use the corresponding entries in M31 and M28 for the reference record. [M31; M28]

For BIP-32, cite the [verified raw text](https://raw.githubusercontent.com/bitcoin/bips/master/bip-0032.mediawiki), marked **LIVE-VIA-RAW**. The rendered page returned 429; the raw text returned 200 and its content was verified. [M31 F15]

#### Wallet core and related tooling

**Wallet-core tally: 36 links — 35 LIVE and 1 DEAD-404 by design.**  
**Tooling/install tally: 17 links — 14 LIVE, 1 LIVE-via-registry, 1 DEAD-404 template and 1 EXISTS-VM-BLOCKED.** [M31]

Use the **Trust Wallet Core repository and `registry.json` at 4.8.4**, the Bawa repo pin. The release tagged **4.9.2** is an upgrade candidate, **not the pin**; do not use it as evidence for the pinned version’s behaviour. [M31; M28]

Carry these access and citation qualifications:

- **Authenticated Maven registry:** `https://maven.pkg.github.com/trustwallet/wallet-core`. Its anonymous check returned **404 by design**, because authentication is required. This is not evidence of authenticated availability. Label the registry as authenticated and reject unverified mirrors. [M31 F04]
- **PyPI:** cite the concrete [bip-utils project page](https://pypi.org/project/bip-utils/). Remove the PyPI JSON template URL: it returned 404 and is not a project reference. [M31 F02]
- **npm:** cite the [registry record for `@hdwallet/core`](https://registry.npmjs.org/@hdwallet/core), marked **LIVE-via-registry**. The package page was blocked with 403. [M31 F10]
- **WCAG 2.2:** retain **EXISTS-VM-BLOCKED**, not LIVE. The existence evidence records the W3C Recommendation of **5 October 2023**, revised **12 December 2024**, and **ISO/IEC 40500:2025**. This is existence evidence only: re-check outside the VM before attributing requirements to the document. [M31 F11]

#### Chain documentation

**M31 tally: 25 links — 24 LIVE and 1 LIVE (POST-only).**

Keep **Bitcoin Core’s descriptor and PSBT documentation** alongside the Bitcoin standards, and **TEP-0003 and TEP-0074** among the TON primary references. [M31; M28]

The [TON JSON-RPC endpoint](https://toncenter.com/api/v2/jsonRPC) is **LIVE (POST-only)**. Its availability probe is POST with `getMasterchainInfo`, which returned 200. GET returned 405; do not use GET as the availability test for this endpoint. [M31 F05]

#### Endpoints and explorers

**M31 tally: 18 links — 14 LIVE, 2 DEAD-404 and 2 LIVE-via-API with VM-blocked homepages.**

- **PublicNode:** use [https://ethereum.publicnode.com](https://ethereum.publicnode.com). POST `eth_chainId` returned 200. Compare the returned chain ID with the intended mainnet; a successful response alone does not establish that the endpoint is serving the intended chain. Do not carry forward the wrong hostname that returned 404. [M31 F01]
- **Blockstream:** cite a working sub-path, such as [the tip-height endpoint](https://blockstream.info/api/blocks/tip/height). Address queries use the `/api/address/<address>` path. Do not cite the bare API root: it returned 404 with “endpoint does not exist”. [M31 F03]
- **Tronscan:** retain **LIVE-via-API** and the homepage access caveat. The homepage was blocked from `muse-vm` by Cloudflare with 403; the service was verified through `apilist.tronscan.org`, which returned 200. This does not verify homepage access from that environment. [M31 F06]
- **Etherscan:** retain **LIVE-via-API** and the same access distinction. The homepage returned 403 from the VM, while `api.etherscan.io` and `docs.etherscan.io` were live. Cite those checked destinations rather than treating the homepage as verified. [M31 F07]

#### Hardware

**M31 tally: 26 links — 24 LIVE, 1 LIVE-via-support and 1 UNVERIFIED shop page because of rate limiting.**

- **Keycard Shell:** the product page remains **UNVERIFIED (shop rate-limited)**. It returned 429 with `local_rate_limited`; it was not established to be dead. Use the checked official Keycard root recorded in M31 as the fallback, and re-check the product page after the limit resets. [M31 F08]
- **BitBox:** cite the checked support site, `support.bitbox.swiss`, as **LIVE-via-support**. The homepage was blocked with 403, so the support-site result must not be presented as homepage verification. [M31 F09]

#### Security references

**Security-vendor tally: 8 links — all LIVE.**  
**Security-education tally: 25 links — 22 LIVE and 3 UNVERIFIED.** [M31]

The vendor checks establish link availability, **not current prices**. D17’s price evidence is dated **2026-11-08**; M31 did not re-check those prices on **2026-11-09**. Re-check and re-date prices before using them rather than carrying them forward blindly. [M31; D17]

Keep the unresolved sources visible in the evidence record:

- **CoinsPaid hot-wallet page — UNVERIFIED, 403.** Do not source hot-wallet claims to it. No replacement was checked. [M31 F12]
- **CISA backup PDF — UNVERIFIED, 403.** The [NCSC small-organisations guide to cyber security](https://www.ncsc.gov.uk/collection/small-organisations-guide-to-cyber-security) was **LIVE**, but it is a replacement candidate only. Verify its scope against the intended claim before substituting it for the PDF. [M31 F13]
- **Medium SIM-swap article — UNVERIFIED, 403.** The checked replacements are [Own Your Online’s SIM-swapping guide](https://www.ownyouronline.govt.nz/personal/get-protected/guides/protect-yourself-against-sim-swapping/) and [CryptoWatchdog’s SIM-swap article](https://cryptowatchdog.net/blog/sim-swap-scams-the-phone-based-threat-that-can-empty-your-crypto-wallet-2026-05-20), both **LIVE** at the baseline check. [M31 F14]

### Exclusions

M31 excluded **103 URLs without checking them**. Excluded is not a dead-link verdict. The recorded groups include:

- **26 testnet-only URLs**, including endpoints and faucets;
- **18 reference-only chain URLs** for Solana, Cardano, Cosmos, XRPL and Polkadot;
- **40 Android-toolchain URLs**, owned by the Android slice;
- **7 DevSecOps-tooling URLs**. [M31]

**Testnet-only URLs must never appear in this mainnet guide or its final link list.** Keep the other exclusions distinct from the checked mainnet reference set; their exclusion supplies no availability evidence. [M31]

### Evidence provenance and publication checks

The code baseline for Doc 4 is **`Pr3eve6ti2o/bawa`, `main` at `56396a20`**. Its evidence base comprises:

- **36 mainnet research slices, M01–M36**, containing approximately **1,050 findings**, verified first-hand on **2026-11-09**.
- **Live verification round 2**, with results recorded as **T1 15 PASS**, **T2 19/0/3** and **T3 9/9**. Preserve that notation and consult the underlying records for the individual results.
- The **200-finding documentation fix** pushed at **`56396a20`**.
- The **F4 worktree fix**, committed at `b3814e0b` (2026-11-10 push). Its local evidence is `~/workspace/bawa-wallet/F4-FIX-RERUN-EVIDENCE.md`. [M36; M28]

Every value in Doc 4 must retain a trace to its supporting slice and finding, verification record or fix evidence, together with the applicable date and version or commit. Link verdicts trace to M31; the underlying claim still needs its own evidence. A later successful link check does not refresh an older price, result or implementation finding.

**Before publication, re-run the link table against the guide’s final link list and inspect destination content again.** Carry **2026-11-09** with the baseline link evidence, and record any subsequent check under its actual check date. Update the verdicts and access caveats from that re-check: a link live at the baseline can move. [M31 open item 7]

## 21. Mainnet open-items register

This register records mainnet-scope questions and risks for Bawa at [`56396a20`](https://github.com/Pr3eve6ti2o/bawa/tree/56396a20). It follows the re-checked register (M35 re-check addendum, dated 9 November 2026 — a local working file, not part of this guide), retaining its evidence locators. Read it alongside Doc 3’s register (ANDROID-GUIDE.md, Consolidated open-items register, L5274). [README §18](https://github.com/Pr3eve6ti2o/bawa/blob/56396a20/README.md) is a **testnet-only gate catalogue — not mainnet authorisation**.

Under M36 F7, M-series IDs are allocated only to actual items, not placeholders. A shared issue has two scope-specific rows: an OI row in Doc 3 and an M- row here, with the M- row linking to its OI counterpart. Closing either row does not close the other. Every status change must cite evidence meeting that row’s clearance condition. Registering a gap does not clear it.

Under M36 F8, ‘complete’ means the prose is done and checked; it never means authorisation for real-fund use. **Blocks writing completion** means the affected section’s prose cannot be drafted or finalised without the missing decision or evidence. No rows block writing. M-13 and M-24 were resolved 2026-11-10 — see their rows below.

M-33 (§5 finalisation) was resolved 2026-11-10 — see its row below.

Those entries appear later in this register. All other rows, including M-01–M-06 below, block release/funding authorisation, not writing. A **No** in the writing-completion field does not lift the operational restriction.

### M-01 — OI-096 must not certify its own repair

**Question/risk:** After a code fix to `compare.js` or `derive.js`, a superficial pass from the fixed tools could conceal the same wrong-address or private-material acceptance defects. The tools must not certify their own repair.

**Affected sections:** §21, §9 and §16.

**Evidence or uncertainty:** M24 K19; M06 R01, including the negative test in `tools/hdwallet-gen/test/smoke.test.js` using a disposable private extended key.

**Status:** OPEN.

**Operational restriction:** The defective tools’ output is never sufficient evidence of their own repair.

**Blocks writing completion:** No.

**Clearance condition:** Independent fixture-oracle verification using only the published vector must demonstrate private-material rejection and wrong-network/path rejection, with the exact expected addresses recorded. The evidence must identify the fixed commit, artefact, test evidence and reviewer. OI-096 stays open until that evidence exists; its closure remains separate from the mainnet row’s closure.

**Gate/source links:** Doc 3 counterpart: OI-096 (ANDROID-GUIDE.md, L5274); re-checked register: M24 K19 and M06 R01; [negative-test source](https://github.com/Pr3eve6ti2o/bawa/blob/56396a20/tools/hdwallet-gen/test/smoke.test.js).

### M-02 — Bad-checksum inputs bypass the private-key guard; a typo can trigger a multi-gigabyte allocation

**Question/risk:** `isPrivateExtendedKey` returns `false` on checksum failure. A bad-checksum `zprv` therefore reaches Core and aborts opaquely. A bad-checksum ETH `xpub` makes WASM attempt an allocation of approximately 2.6 GB before aborting. A `false` result from this guard is not proof that the input is public.

**Affected sections:** §8 and §9.

**Evidence or uncertainty:** M04 F8 records the behaviour reproduced twice. M04 F9 identifies `derive.js:39–56`: the checksum check at lines 50–53 returns `false` before the version-byte check. See also M04 F10. The ‘explicit rejection’ framing for the bad-checksum vector at `docs/11:248` is wrong and must not be carried into this guide.

**Status:** OPEN.

**Operational restriction:** Never submit private exports, including damaged ones, to a watch-only tool or a support ticket. Before input reaches Core, require both a valid checksum and a confirmed public extended-key type. Invalid or unknown input means stop, not ‘not private, therefore public’. Keep suspect private-key text out of logs, and do not auto-retry malformed input.

**Blocks writing completion:** No.

**Clearance condition:** A code fix must provide decoded private-material rejection and correct checksum handling, verified through the M-01 fixture-oracle procedure.

**Gate/source links:** Re-checked register: M04 F8–F10; [M-01 fixture-oracle gate](#m-01--oi-096-must-not-certify-its-own-repair).

### M-03 — TON wallet-ID false metadata in the Android draft (headline defect)

**Question/risk:** The Android draft records a wallet ID it never used: `0` instead of `698983191`. Restoring with that false metadata opens an empty account. A user who believes the wallet is empty may then destroy the only recovery-phrase copy, escalating the wrong-account result into permanent loss.

**Affected sections:** §10, §13 and §21.

**Evidence or uncertainty:** M25 F11 shows that `TonConfig.validate()` checks format only; Create defaults `walletIdText` to `"0"`; and Import hardcodes `0L`. The draft’s own test asserts that `(v4r2, 0L, 0, testnet, UQC7…)` is `VALID`. `698983191` appears nowhere in the Android draft code. M22 F32 identifies the Web draft’s two recorded `0` entries at `main.js:502` and `main.js:526`. M10 F7 and M03 F21 record the measured result that wallet ID `0` gives a different address. Cross-wallet recovery evidence under M23 F36 and M22 F44 remains unverified.

**Status:** OPEN.

**Operational restriction:** The guide must pin **Wallet V4 R2 with wallet ID `698983191`** and explicitly flag both Web draft entries recording `0` as wrong. Require an independent address-reproduction check before receiving funds. The code must default to `698983191` and add a triple-versus-address consistency check. Correcting this default is a derivation-correctness fix, not a mainnet substitution.

**Blocks writing completion:** No — the affected sections can be written with the correction. Cross-wallet compatibility stays open.

**Clearance condition:** A code fix, the triple-versus-address consistency check, fixture-only address reproduction and cross-wallet recovery evidence are all required. The recovery evidence identified by M23 F36 and M22 F44 is currently unverified.

**Gate/source links:** Re-checked register: M25 F11, M22 F32, M10 F7 and M03 F21; unverified cross-wallet recovery gates: M23 F36 and M22 F44.

### M-04 — Web draft reconciliation gaps are double-pay traps

**Question/risk:** TON cannot auto-reconcile: its `txid` is `null`, and `tx.js:320` returns early. TRX has no txid lookup at `tx.js:340`. A user who resends a transfer shown as ‘pending’ can pay twice.

**Affected sections:** §12 and §13.

**Evidence or uncertainty:** M22 F26 and F27 identify the TON and TRX reconciliation gaps. M24 I18 sets the rule for an unknown broadcast outcome: persist the signed bytes and txid, reconcile by transaction identity, and do not silently rebuild the transfer.

**Status:** OPEN.

**Operational restriction:** **Unknown outcome is not permission to resend.** Blind replacement transfers are prohibited. Before any retry, require independently verified history checking for TON and a verified independent manual txid lookup procedure for TRX. An unresolved status must remain unresolved.

**Blocks writing completion:** No.

**Clearance condition:** For each chain, provide a verified independent lookup procedure demonstrated without spending, or a code fix supported by the same evidence.

**Gate/source links:** Re-checked register: M22 F26–F27 and M24 I18.

### M-05 — Web vault does not distinguish testnet from mainnet

**Question/risk:** The AAD `bawa-web-vault-v1` and `dbName` `bawa-web-wallet` are shared, leaving testnet and mainnet vaults indistinguishable. Renaming them without migration handling breaks decryption or recovery.

**Affected section:** §10.

**Evidence or uncertainty:** M22 F39 identifies the shared Web identifiers. M19 F-D2 records the need for distinct mainnet identifiers, which remain undecided. M25 F09–F10 identifies related Android limitations: there is no network column; `onUpgrade` throws; and `listWallets` hardcodes `"testnet"`. A copied vault or database is not a portable backup, because the Keystore key does not survive uninstall or a device move.

**Status:** OPEN.

**Operational restriction:** Section 10 must describe the limitation explicitly and specify the requirements for authenticated environment identification, a separate mainnet storage namespace and deliberate handling of existing vaults. Changing AAD requires compatible decryption and re-sealing. Changing the database name requires explicit discovery or migration. Neither is a cosmetic rename. The guide must teach independent recoverability before destructive migration.

**Blocks writing completion:** No.

**Clearance condition:** Distinct identifiers must be decided, and a fixture-only migration must be demonstrated with recoverability verified first.

**Gate/source links:** Re-checked register: M22 F39, M19 F-D2 and M25 F09–F10.

### M-06 — Android draft send/sign gaps

**Question/risk:** The Android draft has unresolved send and signing gaps:

- The adapter header claims a chain-ID check that does not exist in `SigningCoordinator`.
- The send path is ETH-only, and zero-amount sends are allowed.
- A broadcast timeout is `UNKNOWN`. Rebroadcasting identical signed bytes cannot double-pay, but a fresh composition can.
- TON can show a silent zero on the wrong network: Toncenter returns a successful `0`, with `fresh=true`.
- Fee estimation is incomplete on three chains and unit-confused on the fourth.
- The confirmation tracker `TonSeqnoTracker` does not exist.

**Affected section:** §13.

**Evidence or uncertainty:** M25 F13–F18; M24 I11/I12.

**Status:** OPEN.

**Operational restriction:** Section 13 must present all of these as missing controls or unresolved implementation gaps, never as delivered features. Under EIP-155, a Sepolia-signed payload cannot move mainnet funds, but a mislabelled mainnet-signed payload can.

**Blocks writing completion:** No.

**Clearance condition:** Require per-gap evidence for chain-ID enforcement, send-path implementation, timeout policy and the TON confirmation mechanism. Each gap must be demonstrated as addressed on the actual build or explicitly excluded from scope.

**Gate/source links:** Re-checked register: M25 F13–F18 and M24 I11/I12.





### M-07 — Fee-source disagreement is unresolved

**Question/risk:** mempool.space and blockstream.info disagree sharply at the same instant: the reported fastest-rate comparison was 3 sat/vB versus ≈97 sat/vB. Quoting either source alone risks overpaying or underpaying. The comparison does not settle the underlying unit interpretation.

**Affected section:** §14.

**Evidence or uncertainty:** M07 F3 records the live check at 2026-11-09 11:54 UTC: the disagreement was reported, not resolved. OI-M07-1 remains open. OI-M07-3 records that the blockstream.info `fee-estimates` unit label, `BTC/kB`, has not been independently verified against a live decoded transaction.

**Status:** OPEN.

**Operational restriction:** Never quote one fee source alone. Show both sources with the check time, raw values and stated units, and flag the disagreement without resolving it. Prefer the mempool.space recommended set, while still showing the other source and the discrepancy. Re-check both sources at send time.

**Blocks writing completion:** No.

**Clearance condition:** Cite evidence resolving the units or interpretation of the blockstream.info estimates, or a documented single-primary-source rule that continues to disclose the disagreement.

**Gate/source links:** Register addendum, 2026-11-09 — M07 F3; OI-M07-1; OI-M07-3; [mempool.space recommended fees](https://mempool.space/api/v1/fees/recommended); [blockstream.info fee estimates](https://blockstream.info/api/fee-estimates).

### M-08 — TRON energy estimation: prescribed method is unavailable on the primary endpoint

**Question/risk:** `wallet/estimateenergy` is unsupported on TronGrid mainnet, leaving the Android guide’s energy-estimation instruction without a working method on the primary endpoint. The only dry-run figure, 8624 energy, came from a `REVERTED` call and must never be quoted as a transfer cost. `fee_limit` is not a universal cap.

**Affected section:** §14.

**Evidence or uncertainty:** M09 F09 records `CONTRACT_VALIDATE_ERROR` with the message “this node does not support estimate energy”. F10 requires a token-call budget to be derived rather than copying the native example’s 1,000,000 SUN. F11 clarifies that the Android guide never names `estimateenergy`: it prescribes “a documented Nile energy-estimation or simulation method”. The mainnet change is therefore narrowed to naming `triggerconstantcontract`.

**Status:** OPEN.

**Operational restriction:** Teach the `triggerconstantcontract` dry-run procedure. Convert a successful energy estimate to SUN using the live energy rate, assess bandwidth separately, and choose an explicitly approved `fee_limit` above the priced estimate. Successful-transfer energy remains `UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL`.

**Blocks writing completion:** No.

**Clearance condition:** A successful dry-run energy estimate for a token transfer on mainnet, recorded with the exact procedure, or the small-amount rehearsal under H-04. Any status change must cite the qualifying record.

**Gate/source links:** Register addendum, 2026-11-09 — M09 F09–F11 and the H-04 small-amount rehearsal gate.

### M-09 — ETH real-transfer gas is unverified; the “independent” RPCs are one upstream

**Question/risk:** No real-transfer gas figure is verified. The zero-amount self-transfer figure of 37,973 gas understates a real transfer and must not be presented as its cost. publicnode, drpc, 1rpc and blast returned byte-identical values: these represent the same upstream, not independent confirmations.

**Affected sections:** §11 and §14.

**Evidence or uncertainty:** M08 records USDC as verified on-chain, but the funded USDC transfer call for 1.00 reverts with “exceeds balance”. Blockscout’s mainnet blocks endpoint returned HTTP 200 with `base_fee_per_gas` of 126829043 wei, approximately 0.127 gwei; adding `?limit=1` returned HTTP 422. The token-holders endpoint failed twice. Etherscan’s USDC page returned HTTP 403 bot protection.

**Status:** OPEN.

**Operational restriction:** Do not print 37,973 gas as a transfer cost. Establish a genuinely independent second RPC source with matched-block cross-checks. Verify authenticated Ankr and retest LlamaRPC and Cloudflare.

**Blocks writing completion:** No.

**Clearance condition:** Cite a funded USDC estimate and a receipt from a separately authorised small send, together with evidence of a second independent RPC source and matched-block cross-checks. Both the transfer evidence and the source-independence requirement must be met.

**Gate/source links:** Register addendum, 2026-11-09 — M08 evidence and the M-09 clearance requirements.

### M-10 — Permit/Permit2 model correction

**Question/risk:** The reading that “a Permit2 signature works without an on-chain approval” understates the authority granted. `AllowanceTransfer` and `SignatureTransfer` are independent paths, not sequential layers. The token’s ERC-20 approval to Permit2 is a prerequisite; `SignatureTransfer` bypasses only the in-Permit2 allowance. Reducing an allowance or using lockdown does not invalidate outstanding permit signatures: use the applicable nonce-invalidation mechanism, `invalidateNonces` or `invalidateUnorderedNonces`.

**Affected section:** §15.

**Evidence or uncertainty:** M13 F11 and §6.1 record the correction as verified by a web check on 2026-11-09 against five secondary sources. The primary Uniswap document was **not opened**, and its re-check remains outstanding. M15 F8/F9 record Permit/Permit2 signatures as the leading drainer method in large-loss cases in both years covered. An empty transaction history is not an all-clear.

**Status:** OPEN — primary-doc re-check outstanding.

**Operational restriction:** Teach both the token’s allowance to Permit2 and the permissions within Permit2. Inspect the chain, token, spender, amount, expiry and authority before signing. Never assume that disconnecting or using a clearing action cancels outstanding signatures.

**Blocks writing completion:** No.

**Clearance condition:** Cite a re-check against the primary Uniswap Permit2 documentation covering expiry, invalidation, revocation and re-approval behaviour.

**Gate/source links:** Register addendum, 2026-11-09 — M13 F11 and §6.1; M15 F8/F9; [primary Uniswap Permit2 documentation — re-check target, not yet checked](https://docs.uniswap.org/contracts/permit2/overview).

### M-11 — TRON approval mechanics differ from EVM revocation tooling

**Question/risk:** `AccountPermissionUpdateContract` can reassign account permissions and cause total loss of control. This is not ordinary token approval. Revoke.cash does not support TRON.

**Affected section:** §15.

**Evidence or uncertainty:** M15’s TRX row describes TRC-20 approvals as mechanically identical to ERC-20, with the same unlimited-approval risk. It separately records `AccountPermissionUpdateContract`, ID 46, with a reported figure of approximately $129M. The supplied TRON revocation route is TronScan’s account-page **Approval** tab → **Cancel Contract Approval**, pending a live re-check. Revocation costs Bandwidth and Energy: keep a TRX buffer without inventing a required amount. M13 F20 still requires verification of TRON’s TRC-20 approval, allowance, delegated-transfer mechanics and revocation; EVM or Permit2 wording must not be copied across without that verification.

**Status:** OPEN.

**Operational restriction:** Do not present Revoke.cash as a TRON revocation route. Do not copy EVM approval wording to TRON or present the supplied TronScan route as live-verified.

**Blocks writing completion:** No.

**Clearance condition:** Cite a live re-check of TronScan’s account-page **Approval → Cancel Contract Approval** route and verified TRC-20 approval, allowance and delegated-transfer mechanics.

**Gate/source links:** Register addendum, 2026-11-09 — M15 TRX row; M13 F20; [TronScan — Approval-tab route awaiting live re-check](https://tronscan.org/).

### M-12 — Address-poisoning taxonomy; the test-payment habit is defeated

**Question/risk:** Address poisoning has three forms: zero-value, dust and fake-token. Only zero-value poisoning is covered in the repo. A small test transfer validates only that payment: the victim can later take a different, poisoned address from history for the main payment, defeating the test-payment habit.

**Affected sections:** §15 and §12.

**Evidence or uncertainty:** M15 F1 records the December 2025 $50M poisoning case and Laplas, November 2022, using clipboard substitution with a convincing lookalike. Dust and fake-token poisoning are unnamed anywhere in the repo. M13 F07 establishes that a small test transfer limits only that test’s loss: the full-address check must be repeated for the actual transfer.

**Status:** OPEN.

**Operational restriction:** Teach all three forms. Use an independently verified address-book entry, never an address copied from history. Compare the whole address, including for the actual transfer after a test. A test transfer validates nothing beyond that payment.

**Blocks writing completion:** No.

**Clearance condition:** None needed beyond correct prose for the taxonomy, which is evidenced. The open part is the per-chain work in M13 F20: address-poisoning mechanisms, address representation, history rendering and test-transfer limits. Writing the taxonomy correctly does not clear those outstanding items.

**Gate/source links:** Register addendum, 2026-11-09 — M15 F1; M13 F07; M13 F20 open items.
### M-13 — TON confirmation threshold (decided 2026-11-10)

**Question/risk:** No TON confirmation/finality threshold exists in any guide. Inventing one would present an unverified settlement claim for real funds.

**Affected sections:** §12, §14.

**Evidence/uncertainty:** M30 O1 reports that a grep for TON confirmation statements found nothing: ‘NOT this slice’s to invent — it is open item O1’. M24 J21 records retained thresholds of BTC 6 / ETH 12 / TRX 19 / TON 1 masterchain seqno, but explicitly qualifies them: ‘confirmation policy ≠ finality guarantee; cited mainnet history required (none supplied — documentary gap)’. That retained list does not clear the missing TON threshold or establish its finality meaning. TON Docs verification 2026-11-10 (checked first-hand): ‘Payment Processing on TON — Overview Guide’ — ‘TON achieves transaction finality after a single masterchain block confirmation, typically within 1 second. Once a transaction from a shardchain appears in a masterchain block, it becomes irreversible’; ‘TON Messages and Transactions Overview’ — ‘a transaction becomes final when the first masterchain block references it’. The documentary gap on the threshold’s finality meaning is closed; the remaining gap is exercising the check in the authorised small-amount rehearsal (M-35).

**Status:** RESOLVED 2026-11-10 — the user approved the recommended threshold (1 masterchain seqno after inclusion, with the outgoing-message outcome checked) and the proposed §12/§14 wording; the TON Docs check in Evidence confirms the threshold’s finality meaning.

**Operational restriction:** None remaining for §12/§14 threshold prose. The threshold is stated per the approved wording. The check itself remains manual until TON confirmation tracking is implemented (M-25 F18).

**Blocks writing completion:** NO — resolved by the 2026-11-10 decision.

**Clearance condition:** Met 2026-11-10 — the user’s approval of the number and wording, plus the TON Docs verification of the threshold’s finality meaning (see Evidence).

**Gate/source links:** Re-checked register, 9 November 2026: M30 O1; M24 J21; user decision 2026-11-10; TON Docs check 2026-11-10.

### M-14 — Fee figures are dated baselines, not standing fees

**Question/risk:** The 2026-11-09 fee baselines go stale. Presenting them as current prices can overcharge or undercharge real sends.

**Affected section:** §14.

**Evidence/uncertainty:** M12 records the following baselines. Every figure below is dated **2026-11-09, approximately 11:54–11:57 UTC**, not a current quote:

- BTC, at 141 vB: 423 sats ≈ $0.31 fast; 141 sats ≈ $0.10 patient.
- ETH: 0.00000311 ETH ≈ $0.007.
- TRX: $0 in quota; 0.265 TRX ≈ $0.084 out of quota. USDT: 6.43 TRX ≈ $2.04.
- TON: 0.00012 TON for a deployed wallet; 0.00073 TON for a first send.

M12 also records gaps G1–G10 with check procedures.

**Status:** OPEN — by design: baselines always date.

**Operational restriction:** Date every figure. Teach readers to check the on-screen fee at send time. Never present a baseline as a standing fee.

**Blocks writing completion:** No.

**Clearance condition:** None. This row stays OPEN as a standing dating rule; §14 must carry the rule, not claim clearance.

**Gate/source links:** Re-checked register, 9 November 2026: M12, including gaps G1–G10 and their check procedures.

### M-15 — Pre-funding authorisation and independent security review before any real-funds rehearsal

**Question/risk:** A reader may fund a wallet before the gates are closed, or run a rehearsal without approval, loss limits or an independent security review.

**Affected section:** §17.

**Evidence/uncertainty:**

- M21 J-8 adds a pre-funding authorisation gate after gate 6: complete gates 1–6 unfunded first, record owner-approved loss limits, and permit only a bounded mainnet canary with fresh keys.
- M27 states the hard rule that a small amount does not bypass the independent-security-review gate, citing docs/14 L411/L439. That gate sits before rung 3, not merely before sending.
- M24 K14 adds a gate for mainnet small-amount rehearsal evidence. M24 K17 specifies ten conjunctive gates. M24 K08 marks the mandatory security-review gate BLOCKED.

**Status:** OPEN.

**Operational restriction:** No funding until gates 1–6 are complete unfunded, loss limits are recorded and owner-approved, and the independent security review has taken place. Rehearsals require separate authorisation, must be bounded, and must use fresh disposable accounts.

**Blocks writing completion:** No — §17 must include the gate. The gate blocks release, not writing. Writing completion means prose done and checked; it does not authorise real-fund use.

**Clearance condition:** Completion of the independent security review whose docs/16 gate is OPEN, plus recorded approval with caps, plus executed rehearsal evidence.

**Gate/source links:** Re-checked register, 9 November 2026: M21 J-8; M27; M24 K14, K17 and K08. [Repository docs at 56396a20](https://github.com/Pr3eve6ti2o/bawa/tree/56396a20/docs): docs/14 L411/L439; docs/16 independent-security-review gate, OPEN.

### M-16 — README §13 overclaim, backup-gate contradictions and forgotten vault passphrase escapes

**Question/risk:** A reader may repeat the README’s ‘no funds = never sent’ inference or its unqualified empty BIP-39 passphrase fallback, then abandon the correct wallet or re-fund a guess. A silently confirmed import conceals that the backup gate never occurred. An undocumented app-data clear can destroy the only vault.

**Affected sections:** §10, §18.

**Evidence/uncertainty:**

- M16 F45 identifies the README §13 overclaim and the unqualified assumption of an empty BIP-39 passphrase.
- M16 F47 records that Web import skips the backup gate, while Android uses a 3-word quiz rather than the required 24-word re-entry. These are funding-gate defects, not UX differences.
- M16 F22–F23 records that Web deletion requires the vault passphrase and Android import refuses while a bundle exists. The only escapes identified are undocumented out-of-app clears.
- M16 F24 records the silent typo-wallet risk when the BIP-39 passphrase is forgotten.
- M16 F42 supplies the required synthesis for §10: a 12-step ordered procedure with hard stops.

**Status:** OPEN.

**Operational restriction:** Do not repeat README §13’s conclusions without qualification. Require the recorded BIP-39 passphrase policy, not an automatic empty BIP-39 passphrase fallback. Separate address reproduction, current balance, transaction history and address discovery. Do not equate `setBackupConfirmed` or quiz success with complete recovery verification. Repeat complete recovery-material verification immediately before destructive reset instructions.

**Blocks writing completion:** No.

**Clearance condition:** §10 prose follows M16 F42’s 12-step order, and the Android deletion prerequisites are established during guide writing. M16 explicitly warns not to copy the Web deletion rule across to Android.

**Gate/source links:** Re-checked register, 9 November 2026: M16 F45, F47, F22–F23, F24 and F42. [Repository at 56396a20](https://github.com/Pr3eve6ti2o/bawa/tree/56396a20): README §13.

### M-17 — Faucet links have no mainnet equivalent; stale testnet endpoints pass connectivity checks

**Question/risk:** A reader may follow a testnet faucet or a stale testnet endpoint into a mainnet workflow, mistaking HTTP 200 for proof of network selection.

**Affected sections:** §11, §4.

**Evidence/uncertainty:** M11 identifies both faucet URLs — `nileex.io/join/get` and `mempool.space/testnet4/faucet` — as having no mainnet equivalent: delete them, do not replace them. M11 also found all the testnet endpoints still live, so a stale testnet URL can pass a superficial connectivity check while directing the reader to the wrong network. M07 F4 documents the testnet3 trap: an endpoint can serve plausible block data while serving the wrong chain.

**Status:** OPEN.

**Operational restriction:** Delete both faucet links and their dependent steps. Do not invent replacement funding endpoints. Teach endpoint-identity checks using genesis/chain-ID evidence, never network identification by URL shape alone. HTTP 200 is not proof of network selection.

**Blocks writing completion:** No.

**Clearance condition:** The §11 endpoint table carries dated live re-verification; see M-20/OI-098.

**Gate/source links:** Re-checked register, 9 November 2026: M11; M07 F4; M-20/OI-098.

### M-18 — Etherscan V1 is dead unauthenticated; Etherscan pages are bot-protected

**Question/risk:** The guide’s Etherscan citations at docs/06:287 and docs/06:731 point at a dead endpoint. A reader following them receives an application-level error despite HTTP 200.

**Affected sections:** §11, §12.

**Evidence/uncertainty:** M18 F10 records a live check on 2026-11-09: `api.etherscan.io/api?module=proxy&action=eth_blockNumber` returned HTTP 200 with the reported body `{"status":"0","message":"NOTOK","result":"You are using a deprecated V1 endpoint, switch to Etherscan API V2…"}`. V2 requires an API key and was not tested live in that slice.

M11 records HTTP 403 responses on Etherscan pages due to bot protection and says the guide must not use Etherscan as a verification command. M08 also records HTTP 403 on the Etherscan USDC page.

**Status:** OPEN.

**Operational restriction:** Do not cite Etherscan V1. Do not use Etherscan pages as a verification command without a live-tested route.

**Blocks writing completion:** No.

**Clearance condition:** A live-tested Etherscan V2 route with its API-key requirements stated, or a replacement explorer with dated verification.

**Gate/source links:** Re-checked register, 9 November 2026: M18 F10; M11; M08. [Repository docs at 56396a20](https://github.com/Pr3eve6ti2o/bawa/tree/56396a20/docs): docs/06:287 and docs/06:731.
### M-19 — Link library: 4 dead links, 4 links unverified from the VM

**Question/risk:** Doc 4 §20 may cite a dead or unverified URL, sending a reader to the wrong or an unreachable source.

**Affected section:** §20.

**Evidence:** M31 records 210 checked URLs:

- 195 `LIVE`, plus 1 `LIVE-VIA-RAW`, 2 `LIVE-via-API`, 1 `LIVE-via-support`, 1 `LIVE-via-registry` and 1 `LIVE POST-only`.
- 4 `DEAD-404`: the wrong PublicNode hostname, for which the replacement [`ethereum.publicnode.com`](https://ethereum.publicnode.com) was verified; a PyPI template URL; the bare Blockstream API root; and a Maven registry URL that returns an anonymous 404 by design.
- 3 `UNVERIFIED`: WCAG 2.2, which exists according to W3C search but whose page was VM-blocked; the CoinsPaid hot-wallet page; and the CISA backup PDF.
- 1 `UNVERIFIED` because the shop was rate-limited: Keycard Shell.
- 1 `EXISTS-VM-BLOCKED`: the Medium SIM-swap article. Its replacements, the NZ government SIM-swap guide and the cryptowatchdog SIM-swap article, were both `LIVE`.

The audit also records 103 exclusions: 26 testnet, 18 refchain, 40 Android, 7 DevSecOps and 12 other.

**Status:** OPEN (4 links).

**Operational restriction:** Use the verified replacements, including M31’s operator-verified replacement URLs for the NCSC guide, the NZ government SIM-swap guide and the cryptowatchdog SIM-swap article. Do not cite the 4 unverified links until a non-VM network re-check is recorded.

**Blocks writing completion:** No — §20 remains link-only until the re-check lands.

**Clearance condition:** A recorded non-VM re-check of WCAG 2.2, the CoinsPaid hot-wallet page, the CISA backup PDF and the Medium SIM-swap article, plus Keycard Shell.

**Gate/source links:** Re-checked register (2026-11-09), M-19; M31 for the audit, operator-verified replacement URLs and outstanding network checks.

### M-20 — Proposed Android register rows OI-097–OI-102

**Question/risk:** The Android register lacks rows for rehearsal evidence, endpoint identity, fee reconciliation, scam/adversarial UI evidence, wrong-network signing and review-gate criteria. Without those rows, a release decision has no individually recorded gate for each issue.

**Affected sections:** §21, §17.

**Evidence:** M24 K21–K26 propose the following rows:

- **OI-097 — Mainnet rehearsal evidence:** blocker; a five-step procedure including a QR scan, a BTC change-output spend and a TON V4 R2 deployment check.
- **OI-098 — Mainnet endpoint-identity table:** blocker.
- **OI-099 — Mainnet fee reconciliation:** blocker; BTC input minus output, ETH `gasUsed × effectiveGasPrice`, TON message-trace reconciliation, and TRX fee plus bandwidth/resource/activation.
- **OI-100 — Mainnet scam/adversarial UI evidence:** non-spending gate.
- **OI-101 — Wrong-network signing threat:** blocker; requires an immutable mainnet profile bound to derivation, decoding, lookup, review, signing and broadcast.
- **OI-102 — Mainnet review-gate acceptance criteria:** blocker; requires scope, owners, criteria, a result matrix, failure disposition and recorded sign-off.

**Status:** OPEN — these are proposed rows for the Doc 3 register. Doc 4 §21 carries their substance as M-rows.

**Operational restriction:** Doc 4 §21 must carry each row’s substance and its disposition. No row may be closed by relabelling; recording a gate does not clear it.

**Blocks writing completion:** No. This does not clear the Android release or review gates.

**Clearance condition:** Per-row evidence as specified in M24 K21–K26. Any status change must cite evidence meeting the condition for that row.

**Gate/source links:** Re-checked register (2026-11-09), M-20; M24 K21–K26, covering proposed Doc 3 rows OI-097–OI-102.

### M-21 — 4.9.1 is the upgrade candidate; 4.9.2 is a prerelease; neither carries an Android AAR

**Question/risk:** The guide may prescribe `4.9.2` as the default because npm calls it `latest`, treat `4.9.1` and `4.9.2` as interchangeable, or promise an Android AAR that does not exist.

**Affected sections:** §5, §13, §19.

**Evidence:**

- **M05 F2/F3/F7:** `4.9.2` is npm `latest`, but its GitHub release has `prerelease: true` and was published on 2026-11-06. `4.9.1` has `prerelease: false` and is the latest stable release and upgrade candidate. They share source commit `d40d24a`, but their npm tarballs and SHA-1 hashes differ. Neither carries an Android `.aar`.
- **M23:** there is no downloadable AAR, including for `4.9.2`; JitPack is unusable.
- **M24 K18 / OI-090:** the Core `4.9.2` target is unproven on Android and remains a release blocker.

**Status:** OPEN.

**Operational restriction:** Pin exactly `4.8.4` as the repository version, or exactly `4.9.1` as the upgrade candidate only after its own qualification run: EIP-1559 with chain ID `1`, mainnet derivation fixtures and mainnet endpoints. Never use `latest`, `^` or a bare version. Never relabel `4.9.2` results as `4.9.1` results.

**Blocks writing completion:** No.

**Clearance condition:** The `4.9.1` qualification run specified in M05 O3, with recorded results, or a reviewed decision to stay on repository version `4.8.4`.

**Gate/source links:** Re-checked register (2026-11-09), M-21; M05 F2/F3/F7 and O3; M23; M24 K18 / OI-090. Repository context: [Bawa at `56396a20`](https://github.com/Pr3eve6ti2o/bawa/tree/56396a20).

### M-22 — Auto-lock claims corrected

**Question/risk:** A reader may leave a wallet unattended believing that it auto-locks. The Web timer re-arms only on unlock or mnemonic access through `requireMnemonic()`, and Android has no auto-lock at all.

**Affected sections:** §10, §15.

**Evidence:**

- **M34 F2:** “10 minutes of inactivity” is inaccurate. The Web timer re-arms only on unlock or `requireMnemonic()`; `poke()` is never called. There is no visibility-change or unload lock.
- **M34 F15:** there is no inactivity timeout anywhere in the Android draft. Manual locking and the per-use biometric gate are the stated controls.

**Status:** OPEN.

**Operational restriction:** Describe the Web default as a 10-minute timer re-armed by unlocking or by an operation that calls `requireMnemonic()`, not as a general inactivity timer. Tell readers to lock explicitly before leaving the wallet. State plainly that Android has no inactivity auto-lock and requires manual locking.

**Blocks writing completion:** No.

**Clearance condition:** None — correct prose is the clearance. This row stays OPEN as a wording rule.

**Gate/source links:** Re-checked register (2026-11-09), M-22; M34 F2 and F15.

### M-23 — Keystore wrapping-key invalidation; UI-only biometric gate; partial `FLAG_SECURE`

**Question/risk:** Adding a fingerprint may invalidate the wrapping key and lock the reader out of the local vault. A UI-layer biometric gate may be mistaken for engine-level enforcement. Screenshots and recording are possible outside the Backup and Import routes.

**Affected sections:** §10, §15.

**Evidence:**

- **M34 F8:** Android Keystore documentation says that a biometric-only key is invalidated by default when new biometric enrolments are added. The draft calls `setUserAuthenticationRequired(true)` without calling `setUserAuthenticationParameters`. The invalidation default is therefore qualified, not a certain outcome for this key builder. The per-use-authentication reading is verified.
- **M34 F10:** `WalletSession.unlock()` performs no biometric check; the gate lives in the UI layer.
- **M34 F11:** the draft adds `FLAG_SECURE` on the Backup and Import routes only and clears it elsewhere.

**Status:** OPEN.

**Operational restriction:** Warn readers to verify their independent recovery phrase before adding a fingerprint. Explain phrase-based restoration if enrolment invalidates the wrapping key. Do not promise that a device credential repairs an invalidated key. Do not present the UI gate as engine enforcement, or claim `FLAG_SECURE` coverage beyond the Backup and Import routes.

**Blocks writing completion:** No.

**Clearance condition:** Establish the actual key authorisation configuration, including whether the wrapping key is biometric-only, before claiming an unconditional enrolment outcome.

**Gate/source links:** Re-checked register (2026-11-09), M-23; M34 F8, F10 and F11.

### M-24 — TON send is generation-only; no testnet fee section exists to convert (decided 2026-11-10)

**Question/risk:** §14 may be written as a conversion of a testnet fee section that does not exist, while §13 promises a TON send that the repository cannot perform.

**Affected sections:** §13, §14.

**Evidence:**

- **M28-OI-04:** no fee section exists in the testnet guide to convert.
- **M28-OI-06:** TON is generation-only, but a mainnet reader will expect to send TON.
- **M10:** TON is generation-only in the repository. The Web and Android drafts carry a send path, but it has never been exercised.
- **M18 F06:** the generation-only TON path provides a single deposit address, with no `xpub`.

**Status:** RESOLVED 2026-11-10 — the user approved the recommended scope: §13 stays capability-boundaries only (TON receivable, not sendable), with the proposed scope paragraph and §13.7 box; no TON send procedure, broadcast instructions or rehearsal procedure.

**Operational restriction:** None remaining for §13’s TON-send subsection. §14’s TON procedure is new mainnet prose, not a conversion (M28-OI-04); identifying external signing software remains open (M-39).

**Blocks writing completion:** NO — resolved by the 2026-11-10 decision.

**Clearance condition:** Met 2026-11-10 — the user’s approval of the scope and wording.

**Gate/source links:** Re-checked register (2026-11-09), M-24; M28-OI-04, M28-OI-06, M10 and M18 F06; user decision 2026-11-10.
### M-25 — Regulation and tax cover four jurisdictions only; India figures rely on secondary sources

**Question/risk:** The guide could state a tax or law rule for a jurisdiction that was never researched, or present India’s reported 30% tax and 1% TDS figures as established when the official sources were unreachable.

**Affected section:** §3.

**Evidence:**
- M33 covers US/UK/EU/India only. The guide may say “check your local law” and “keep records”, and give jurisdiction-named, dated, sourced facts, subject to M33’s 8-item never-claim list.
- India’s 30%/1% TDS figures rest on convergence of secondary sources only; the official sites were unreachable.
- M33 records no tax coverage in the current guides. The repository’s only law sentence is at `docs/RECOVERY.md:680`.
- M36 F6 places law, tax and records in front-matter §3, not in a footnote.

**Status:** OPEN.

**Operational restriction:** Limit §3’s jurisdiction-specific coverage to US/UK/EU/India. Label the India figures, including TDS, as secondary-source convergence. State no rule for any other jurisdiction, and apply M33’s 8-item never-claim list in full.

**Blocks writing completion:** No.

**Clearance condition:** Read each source directly before publishing any rule. The outstanding source checks are M33 items 1–6 and 8: HMRC manual sections, India’s successor law, the OFAC guidance PDF text, the text of MiCA Regulation (EU) 2023/1114, and OFAC five-year retention.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-25 — M33 and M36 F6; [docs/RECOVERY.md:680 at 56396a20](https://github.com/Pr3eve6ti2o/bawa/blob/56396a20/docs/RECOVERY.md#L680).

### M-26 — Terminology and callout work

**Question/risk:** Unqualified secret terminology can make a reader choose the wrong secret: the BIP-39 passphrase rather than the vault unlock passphrase, or vice versa. The 195 Warning callouts are ungraded. Deleting the 9 instances of “Never use real funds”, rather than replacing them, would leave mainnet prose without its warning.

**Affected sections:** §1, §2 and the whole document; writing-phase work.

**Evidence:** M30 records the following:
- The “Mainnet” glossary row at `docs/GLOSSARY.md:45` is false for the mainnet guide. The text itself breaks the “wallet” terminology rule at `docs/RECOVERY.md:423`, and two vaults share one glossary row.
- The terms **BIP-39 passphrase** and **vault unlock passphrase** must be used in full, never reduced to the unqualified final word. Approximately 173 existing uses lack that qualification.
- The callout taxonomy has three tiers — Never, Stop and Warning — written as `> **NAME**`, without a colon. Every callout must contain its trigger, required action and consequence.
- All 195 existing `> **Warning**` callouts need re-grading. The 9 instances of “Never use real funds” must be replaced for mainnet, not deleted.
- The 81 testnet-scope sentences require individual review, not bulk deletion. The “four secrets” map is missing.

**Status:** OPEN (writing-phase work).

**Operational restriction:** Apply the taxonomy and the full secret-name rule to every section. Re-grade all 195 callouts using the C3 test, replace the 9 obsolete mainnet warnings rather than deleting them, and sweep the 81 testnet-scope sentences individually.

**Blocks writing completion:** No — this is the writing work itself, not a precondition for it.

**Clearance condition:** Evidence of the merge operator’s completed re-grading pass and the done-gate check under M36 F8. That check establishes that the prose is done and checked; it is not authorisation for real-fund use.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-26 — M30, the C3 test and M36 F8; [docs/GLOSSARY.md:45](https://github.com/Pr3eve6ti2o/bawa/blob/56396a20/docs/GLOSSARY.md#L45); [docs/RECOVERY.md:423](https://github.com/Pr3eve6ti2o/bawa/blob/56396a20/docs/RECOVERY.md#L423).

### M-27 — BTC change policy is missing

**Question/risk:** Change may go to an unestablished destination. A reader cannot verify change ownership, derivation, signer control, discovery or recovery.

**Affected section:** §13.

**Evidence:**
- M02 F9 establishes that receiving-only derivation does not establish change handling. The external-signer `/1/*` templates in `docs/09` do not fill that gap.
- M17 G4 leaves change unresolved in the supplied evidence. The guide must say where change goes and require review of every output; hardware signing does not establish a builder’s change policy.
- M07 F11 requires verification that change returns to the reader’s own wallet, identifying `m/84'/0'/0'/1/0`.
- M07 F16 records that omitted change becomes fee. The absolute fee and change output must be verified before signing.
- M24 K21 / OI-097 step (D) requires the rehearsal to include a BTC change-output spend.

**Status:** OPEN.

**Operational restriction:** §13 must state that change handling is unresolved. Require review of every output, verification that change returns to an address controlled by the intended signer, and calculation of the absolute fee from retained UTXO amounts.

**Blocks writing completion:** No.

**Clearance condition:** A documented change policy covering destinations, derivation, signer control, discovery and recovery, before any mainnet send procedure is presented as complete.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-27 — M02 F9; M17 G4; M07 F11 and F16; M24 K21 / OI-097 step (D).

### M-28 — RBF, CPFP and stuck-transaction procedures do not exist

**Question/risk:** A reader may blindly re-send an underpriced or stuck transaction and duplicate the payment. A nonce gap can block every later nonce.

**Affected sections:** §13 and §18.

**Evidence:**
- M07 F17–F21 records live verification of BIP-125: RBF is opt-in before signing, with `sequence < 0xffffffff-1`. The draft implements no RBF, bump flow, broadcast, CPFP or change-branch derivation.
- M07 F17–F21 identifies CPFP as the receive-side rescue when RBF is unavailable. Its decision tree is: **wait → RBF bump if signalled → CPFP if the reader controls an output → stop**. Never re-send blindly.
- M17 O3 records no replace, cancel or RBF procedure for any chain, and no primary sources. M17 O5 requires criteria for retrying after a broadcast timeout and a manual TRX transaction-ID (`txid`) investigation procedure.
- M08 records that a nonce gap or stuck transaction blocks every later nonce. A speed-up is a same-nonce replacement with policy-compliant higher fees. Cancellation is a paid competing transaction, not an undo. No receipt and a still-pending nonce mean unresolved, not “send it again”.

**Status:** OPEN.

**Operational restriction:** Present RBF, CPFP and replacement as missing procedures, not features. Teach the decision tree above: a stuck transaction needs that investigation and decision path, not an instruction to send again.

**Blocks writing completion:** No.

**Clearance condition:** Named primary sources for each chain, followed by a written procedure under M17 O3, plus the manual TRX `txid` investigation procedure required by M17 O5.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-28 — M07 F17–F21; M17 O3 and O5; M08.

### M-29 — Published fixtures are active on mainnet and have real history

**Question/risk:** A reader may fund a published fixture if it is presented as inert test data, or if the never-fund warning appears after the mnemonic/address table.

**Affected sections:** §1, §2 and §7.

**Evidence:**
- M10 F1–F2 records the TON fixture on mainnet with state `active`, balance `0`, a past transaction at `lt 42954571000001`, code and data present, and last activity on 2023-12-01.
- M07 F9 records 32 transactions and 311,775 sats funded for the BTC fixture.
- M29 treats funding the fixture addresses as immediate loss because the mnemonic is public. The warning must precede any mnemonic/address table.
- M03 F06 states that the 15-word vector must never become a funded wallet or a recovery wallet.

**Status:** OPEN (standing rule).

**Operational restriction:** Place the never-fund warning before any mnemonic/address table in §1, §2 and §7. Fixtures are regression vectors only, never receiving addresses.

**Blocks writing completion:** No.

**Clearance condition:** None — this is a standing rule. The merge operator verifies warning placement in the done-gate check; that check does not retire the rule.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-29 — M10 F1–F2; M07 F9; M29; M03 F06; M36 F8 done-gate check.

### M-30 — Mainnet QR payload forms are candidates, not verified

**Question/risk:** §12 or §13 could publish QR payload forms as verified even though neither draft contains QR decode code and the forms have never been round-tripped.

**Affected sections:** §12 and §13.

**Evidence:**
- M18 F20 marks all four mainnet payload candidates `UNVERIFIED-NEEDS-CHECK`: BTC BIP-321, ETH ERC-681 `@1`, TON `ton://transfer`, and a TRX bare address.
- M20 F1 records no QR decode code in either draft; receive-QR and scanning are spec-only.
- M24 H06 records QR error correction L rather than the required M, and a dead `CAMERA` permission under OI-060.
- M25 F19 records bare-address QR output at EC-L, with no scanning. The guide requires M, so a decision is needed.
- M24 K16 adds the receive-QR and scanning round-trip gate: EC=M, an implemented scanner, and evidence covering permission grant, denial and revocation.

**Status:** OPEN.

**Operational restriction:** Present the four payload forms as candidates with their `UNVERIFIED-NEEDS-CHECK` status. Do not present QR scanning as implemented. Round-trip evidence is a release gate under M24 K16.

**Blocks writing completion:** No.

**Clearance condition:** QR round-trip evidence against the mandated formats under M24 K16, including EC=M, an implemented scanner and permission grant/denial/revocation, plus the EC-M decision required by M25 F19.

**Gate/source links:** Re-checked register, 2026-11-09, entry M-30 — M18 F20; M20 F1; M24 H06 / OI-060; M25 F19; M24 K16.
### M-31 — Independent security review gate (before any real-funds use)

**Question/risk:** Doc 4 is treated as authorisation to fund a wallet when the independent security review has never happened.

**Affected sections:** §17 and §2.

**Evidence:**
- M27 sets the hard rule: a small amount does not bypass the independent-security-review gate (`docs/14`, L411/L439). That gate sits before rung 3.
- M24 K08 records the mandatory security review gate as BLOCKED. M24 K17 specifies ten conjunctive gates; M24 K26 / OI-102 provides the review-gate acceptance criteria.
- M13’s verified-correct list records the `docs/16` external review gate as OPEN.
- M06 R10 gives BLOCKED as the expected result for release-gate enforcement on the current evidence.

**Status:** OPEN.

**Operational restriction:** No real-funds use before the independent-security-review gate is cleared. Doc 4 must state that gate-passing is not a substitute for the review. “Complete” under M36 F8 means the prose is done and checked, never authorisation for real-fund use.

**Blocks writing completion:** No — the gate blocks release, not writing.

**Clearance condition:** The independent security review itself, with recorded scope, owners, criteria, result matrix, failure disposition and sign-off under OI-102. Any status change must cite that review evidence. Registering this gap does not clear it.

**Gate/source links:** M24 K08, K17 and K26 / OI-102; re-checked register — M-31, 2026-11-09.

### M-32 — Borrowed testnet assurance (most likely structural failure mode)

**Question/risk:** Testnet evidence — passing mocked tests, derivation conformance and browser creation/restore — is borrowed as mainnet spending evidence. The guide reads as verified where it is only specified.

**Affected sections:** §1, §2 and document-wide writing discipline, enforced by the merge operator.

**Evidence:**
- M36 F9 identifies borrowed testnet assurance as the most likely structural failure mode.
- M28 records the mainnet rewrite findings: all 60+ “Mainnet is absent” lines across 7 files invert; the derivation deviation disappears on mainnet; the `docs/09` hardware-signing rehearsal inverts to “small amount first”; and the `docs/08` plus `RECOVERY` rehearsal becomes 3 stages. These are rewrite findings, not mainnet spending evidence.
- M30 records 81 testnet-scope sentences swept individually, not bulk-deleted.
- M20 records that V2/D21 stop at construction/signing. Send/sign/broadcast/confirmation remains UNVERIFIED.
- M19 records the verification-block contradiction between L13–L19 and L70–L72.

**Status:** OPEN (standing discipline).

**Operational restriction:** Every claim must carry its verification scope: fixture/offline, controllable testnet or authorised rehearsal. No chain inherits another’s pass (M24 I17). A pass applies only to the wallet, chain, network, derivation policy and signing route actually rehearsed (M27 hard rule).

**Blocks writing completion:** No.

**Clearance condition:** The merge operator’s done-gate check (M36 F8), plus the M35 re-check of this document’s §21 against all 36. Any status change must cite evidence of both checks.

**Gate/source links:** M24 I17 and M27 (scope); M36 F8 and M35 (completion checks); [M-31 — independent security review gate](#m-31--independent-security-review-gate-before-any-real-funds-use); re-checked register — M-32, 2026-11-09.

### M-33 — Doc 4 pin decision + §5 proof form (decided 2026-11-10)

**Question/risk:** §5 is drafted against the wrong pin, or its proof goes stale at push.

**Affected section:** §5.

**Evidence:**
- M36 item 3 requires the user’s word before changing the repair-commit pin for the mainnet guide.
- M36 item 5 identifies §5 proof staleness: use the `MAIN_HEAD` capture form or update the SHA at push.
- M24 K01 records the §4 text fix as uncommitted and the §15/L3732/L4756 decisions as OPEN.
- M01 F35 item 11 prohibits silently treating `56396a20` as an authorised mainnet baseline.

**Status:** RESOLVED 2026-11-10 — the user decided: pin Doc 4 to the immutable repair-commit SHA `e3b65fb832db287fdc8d54794980dd0b3456cc12`; the §5 step-4 proof uses the literal baseline HEAD SHA; the `MAIN_HEAD` capture in step 1 is supporting context only.

**Operational restriction:** None remaining for §5 finalisation. The repair-commit value is supplied (M36 F3); the §4 text fix is committed at `b3814e0b` (2026-11-10 push).

**Blocks writing completion:** NO — resolved by the 2026-11-10 decision.

**Clearance condition:** Met 2026-11-10 — the user’s word: pin to the immutable repair-commit SHA; proof uses the literal SHA; `MAIN_HEAD` capture as supporting context.

**Gate/source links:** M36 item 3 (pin decision), M36 F3 (supplied repair value) and M36 item 5 (proof form); re-checked register — M-33, 2026-11-09; user decision 2026-11-10.

### M-34 — F4 §15 + Android L3732/L4756 (decided 2026-11-10)

**Question/risk:** §5/§19 cross-references point to the old in-place detach or the wrong section, reintroducing F4 in the mainnet guide.

**Affected sections:** §5 and §19.

**Evidence:**
- M36 item 2 records the pending decisions.
- M24 K01 records L4756 as superseded by the §4 worktree procedure, while the §15/L3732/L4756 decisions remain OPEN.
- M01 F35 identifies L4756 as the old checkout and L3732 as the wrong “Doc 1, §3” reference. The pin procedure is §4.
- M19 D16 places the F4 follow-ups at parent level, not within M19. See also M28-OI-10.

**Status:** RESOLVED 2026-11-10 — the user approved the §15 worktree treatment and the Android L3732/L4756 updates; applied and pushed in this revision.

**Operational restriction:** None remaining for the §15/Android cross-references. The F4 worktree procedure remains the baseline for §4/§5.

**Blocks writing completion:** No — resolved by the 2026-11-10 decision.

**Clearance condition:** Met 2026-11-10 — the user’s approval of the §15 treatment and the Android L3732/L4756 updates.

**Gate/source links:** M36 item 2, M24 K01 and M28-OI-10; re-checked register — M-34, 2026-11-09; user decision 2026-11-10.
### M-35 — No live send/sign/broadcast has been exercised; no reviewed small-amount rehearsal procedure exists

**Question/risk:** No live send has been observed on any network; every send procedure is UNVERIFIED-NEEDS-SMALL-AMOUNT-REHEARSAL; no reviewed small-amount procedure exists yet, so this guide invents none (M36 F12). The per-chain "tiny" amounts for sizing the rehearsal are also unestablished (M16-F17).

**Affected sections:** §13 (whole section); §§11, 12, 14; §16; §17.

**Evidence or uncertainty:** M17 O1; M24-G10 (deferred acceptance plans BTC/TRX/TON/token/interrupted-submission/replacement, named only, not steps); M28-OI-01; M36 F12; M16-F17 (tiny amounts); M20 OI-097 (rehearsal evidence — its substance is carried here; see M-20).

**Status:** OPEN.

**Operational restriction:** No real funds move on the strength of this guide; no rehearsal procedure may be improvised from the capability table; §13 states the boundary only.

**Blocks writing completion:** No — writing states the boundary. Blocks real-fund use and §17 gate closure.

**Clearance condition:** A reviewed small-amount procedure exists, is separately authorised, and is executed with recorded evidence per M17 O1 / M24-G10, including agreed per-chain tiny amounts.

**Gate/source links:** M17 O1; M24-G10; M36 F12; M16-F17; M-20 / OI-097.

### M-36 — "Larger amounts" threshold for the hardware/PSBT direction is undefined

**Question/risk:** Hardware/PSBT signing is the recommended direction for larger Bitcoin amounts (M17 F3), but no threshold for "larger amounts" is defined anywhere; §13 presents it as a direction only, never as a procedure.

**Affected sections:** §13; §15; §17.

**Evidence or uncertainty:** M17 F3, O6.

**Status:** OPEN.

**Operational restriction:** Do not present hardware/PSBT as a shipped feature or a verified mainnet recipe.

**Blocks writing completion:** No.

**Clearance condition:** Maintainer decision stating a number or a rule (M17 O6).

**Gate/source links:** M17 F3, O6.

### M-37 — Approval-validity duration undefined

**Question/risk:** Approval must be single-use and bound to one frozen payload, but no tested approval deadline is defined; no duration may be invented.

**Affected sections:** §13.4, §13.11.

**Evidence or uncertainty:** M24-G07, G24.

**Status:** OPEN.

**Operational restriction:** Approval expiry prevents further signing under that approval; it does not revoke signed bytes, cancel a submitted transaction, or prove funds remain unspent.

**Blocks writing completion:** No.

**Clearance condition:** Maintainer-defined finite validity policy plus offline expiry/mutation tests.

**Gate/source links:** M24-G07, G24.

### M-38 — BTC/ETH/TRX confirmation thresholds unconfirmed on mainnet

**Question/risk:** The retained thresholds BTC 6 / ETH 12 + `finalized` / TRX 19 SR are stated in §16 as pinned wallet policies, UNCONFIRMED — none has been confirmed against current chain documentation. (The TON threshold is M-13.)

**Affected sections:** §16; §12; §14.

**Evidence or uncertainty:** M28-OI-03; M24 J21 (retained thresholds qualified: confirmation policy ≠ finality guarantee; cited mainnet history required, none supplied).

**Status:** OPEN.

**Operational restriction:** Present the thresholds as pinned wallet policies, not verified chain facts; never present them as verified chain facts.

**Blocks writing completion:** No.

**Clearance condition:** Each threshold confirmed against current chain documentation, with source and review date recorded.

**Gate/source links:** M28-OI-03; M24 J21.

### M-39 — Compatible external import/signing software not identified or tested

**Question/risk:** The repository has no import tool and no signing code; no compatible external import or signing software has been identified or tested for any chain.

**Affected sections:** §7; §10; §13; §14.

**Evidence or uncertainty:** M16 open item 2; M16-F09; §14 boundary table ("not established by the evidence — blocked" for BTC/ETH/TRX/TON).

**Status:** OPEN.

**Operational restriction:** No application-specific restore instructions given; this guide must not imply the repository builds, signs or submits transfers.

**Blocks writing completion:** No.

**Clearance condition:** Identified and tested compatible software per chain, or a stated "no tested route"; plus a decision on how the guide names external signers, with controls per chain.

**Gate/source links:** M16 open item 2, F09.

### M-40 — Change-passphrase flows unverified on both platforms

**Question/risk:** No in-place change operation for the vault unlock passphrase has been established for Web or Android.

**Affected sections:** §18; §10.

**Evidence or uncertainty:** M16 open item 5; M16-F27.

**Status:** OPEN.

**Operational restriction:** §18 gives no steps; do not copy the Web rule across to Android.

**Blocks writing completion:** No.

**Clearance condition:** Established and documented procedure, or a stated "none exists".

**Gate/source links:** M16 open item 5, F27.

### M-41 — Address discovery procedure missing

**Question/risk:** No address-discovery procedure is supplied; address reproduction, balance, history and discovery must stay separate, and a populated account must never substitute for the recorded one.

**Affected sections:** §18; §9.

**Evidence or uncertainty:** M16-F03; M16-F45.

**Status:** OPEN.

**Operational restriction:** The guide marks this as an open item and never substitutes a populated account for the recorded one.

**Blocks writing completion:** No.

**Clearance condition:** Verified discovery procedure.

**Gate/source links:** M16-F03, F45.

### M-42 — Exact file:line citations for RECOVERY.md / README §§12/13/18 not supplied

**Question/risk:** §18 cites sections and steps, not file:line references; exact citations cannot be published without line-numbered text at 56396a20.

**Affected sections:** §18.

**Evidence or uncertainty:** M16 open item 6.

**Status:** OPEN.

**Operational restriction:** §18 cites sections and steps, not file:line.

**Blocks writing completion:** No.

**Clearance condition:** Line-numbered text at 56396a20 obtained before publishing file:line references.

**Gate/source links:** M16 open item 6.

### M-43 — Explorer paid-plan links and prices unverified

**Question/risk:** Explorer paid-plan links and prices are UNVERIFIED and were omitted from §11; quoting them would present unchecked prices as facts.

**Affected sections:** §11; §20.

**Evidence or uncertainty:** m32 F18; M31 (prices not re-checked 2026-11-09; D17 price evidence dated 2026-11-08).

**Status:** OPEN.

**Operational restriction:** Link only, never quote prices.

**Blocks writing completion:** No.

**Clearance condition:** A live price check with source and date.

**Gate/source links:** m32 F18; M31.

### M-44 — TRON energy burn-rate conflict: 0.001 TRX/unit shorthand vs 100 SUN/unit measured

**Question/risk:** m12 §3's shorthand "0.001 TRX per energy unit" conflicts with the measured chain parameter 100 SUN/unit (0.0001 TRX); quoting the shorthand would misstate TRON energy arithmetic by 10×.

**Affected sections:** §14.

**Evidence or uncertainty:** m12 §3; §14 uses the measured value and flags the shorthand UNVERIFIED.

**Status:** OPEN.

**Operational restriction:** Use 100 SUN/unit for TRON energy arithmetic until settled; do not quote 0.001 TRX/unit.

**Blocks writing completion:** No.

**Clearance condition:** Source re-check against m09/m12 to settle which value is correct.

**Gate/source links:** m12 §3; m09/m12.

### M-45 — Payment-record storage format, export, retention and completed example open

**Question/risk:** The §12 payment record has no defined storage format, export procedure, retention duration or completed example.

**Affected sections:** §12.

**Evidence or uncertainty:** m18 F22.

**Status:** OPEN.

**Operational restriction:** The §12 record is a guide format, not a Bawa API schema.

**Blocks writing completion:** No.

**Clearance condition:** Format, export, retention and example defined and reviewed.

**Gate/source links:** m18 F22.

### M-46 — History-label implementation verification and chain-specific drop criteria open

**Question/risk:** History-label implementation is unverified, and sourced chain-specific drop criteria are undefined; labels are required meanings, not verified implementation guarantees. (Confirmation-policy values are M-13 and M-38.)

**Affected sections:** §12.

**Evidence or uncertainty:** m17 F11/F15.

**Status:** OPEN.

**Operational restriction:** Labels are required meanings, not verified implementation guarantees.

**Blocks writing completion:** No.

**Clearance condition:** Implementation check against the draft, plus policy values defined (see M-13, M-38).

**Gate/source links:** m17 F11/F15.

### Carried-forward items from the M35 register

| Item | Source | Status after the re-check |
|---|---|---|
| 1. Live mainnet send/sign/broadcast never exercised on any chain | m17 O1, m28-OI-01, m28-OI-09, m29 | OPEN — H-02–H-05; confirmed by M20/M24 (send/sign/broadcast/confirmation UNVERIFIED on every chain). |
| 2. Hardware/PSBT mainnet procedure: no named device, no reviewed procedure, no non-BTC hardware procedure | m17 O2, m02 | OPEN — needs a named device + reviewed procedure. |
| 3. Stuck-transaction recovery: no replace/cancel/RBF procedure for any chain, no primary sources | m17 O3 | OPEN — carried as M-28. |
| 4. Criteria for retrying after a broadcast timeout; TRX manual txid investigation procedure | m17 O5 | OPEN — carried as M-28. |
| 5. “Larger amounts” threshold undefined — when hardware signing becomes required rather than recommended | m17 O6 | OPEN — maintainer decision. |
| 6. History classification criteria partial (failed / replaced / dropped, fee presentation, reorg rewind) | m17 O4 | OPEN — needs sourced chain-specific criteria + a testnet reorg demonstration. |
| 7. Send-screen checklist implementation status unverified (full-address comparison, smallest-unit and balance validation, change ownership, freshness, decoded-transaction review) | m17 O8 | OPEN — needs a UI-by-UI audit of the Web draft Send screen. |
| 8. BTC change policy missing: change destinations, derivation, signer control, discovery and recovery not established | m02 F9, m29 | OPEN — carried as M-27. |
| 9. Mainnet endpoints need live re-verification at guide-writing time (`mempool.space/api`, PublicNode mainnet RPC, Blockscout mainnet, `api.trongrid.io`, `toncenter.com/api/v2`) | m28-OI-02 | OPEN — carried as M-17/M-18/M-19; probe live, do not copy testnet values. |
| 10. Confirmation thresholds unconfirmed on mainnet (BTC 6 / ETH 12 + `finalized` / TRX 19 SR / TON 1 masterchain seqno, with refinements) | m28-OI-03, m30 O1 | PARTLY RESOLVED 2026-11-10 — TON part decided (M-13: 1 masterchain seqno + outcome check); BTC/ETH/TRX refinements remain under M-38. |
| 11. External security review still blocks mainnet use; gate-passing is not a substitute for the review | m28-OI-05 | OPEN — carried as M-31. |
| 12. TON send is generation-only; a mainnet reader will expect to send TON | m28-OI-06 | RESOLVED 2026-11-10 — carried as M-24 (§13 stays capability-boundaries only; TON receivable, not sendable). |
| 13. TON key-name discrepancy (`TONCENTER_API_KEY` vs `TONCENTER_TESTNET_API_KEY`) | m28-OI-12 | OPEN — resolve to the mainnet name. |
| 14. Standard-wallet import of a Bawa mnemonic never performed | m02, m28-OI-08 | OPEN — R-14 (extended); cross-wallet recovery still unverified (M23 F36, M22 F44). |
| 15. 4.9.1 qualification run (EIP-1559 with chain ID 1, mainnet derivation fixtures, mainnet endpoints) | m05 O3 | OPEN — carried as M-21. |
| 16. CI pin values to obtain and re-verify (Python 3.13 patch version, Ubuntu runner image digest, three action commit SHAs) | m05 O1, O2 | OPEN — do not guess. |
| 17. bip-utils 2.12.3 differential re-run | m05 O4 | OPEN — dedicated run. |
| 18. Node 24 migration verification (Web 31/31 and Android 55/55 on an exact Node 24 patch, before 2027-04-30) | m05 O5 | OPEN — dedicated run. |
| 19. §4 pin sequencing: `56396a20` or a later head if the F4 worktree fix is pushed first | m05 O8, m36 item 3 | RESOLVED 2026-11-10 — carried as M-33 (pin = repair commit; proof = literal SHA; MAIN_HEAD supporting context). |
| 20. First-receive procedure (small test amount, confirmations, explorer verify, remainder) | m26 item 1 | OPEN — H-01. |
| 21. Funding-source links unverified from the VM (Coinbase help 403, Binance P2P FAQ 202, CoinATMRadar 403, Paxful home 403, Tonviewer API not probed) | m26 items 2–6 | OPEN — carried as M-19; re-verify from an unblocked route before linking. |
| 22. No fee figure publishable as current; no funding service recommended (all named services are examples to check only) | m26 items 11–12 | OPEN — carried as M-14 (dated baselines only; teach on-screen fee checks). |
| 23. Hardware-wallet chain compatibility (BTC/ETH/TRX/TON per device) unverified | m32 OI-06 | OPEN — must not recommend a device without it. |
| 24. Prices to re-check before quoting (Keystone 3 Pro, Blockstream Jade/Jade Plus, BitBox02, Etherscan API plans, Blockchair/TronGrid/TonAPI/TonCenter/mempool.space Enterprise, GoPlus/Blockaid capabilities) | m32 OI-01–OI-05 | OPEN — R-18 (corrected: M32 re-checked D17 figures 2026-11-09, unchanged, + dated hardware prices); link only until a browser-based check lands. |
| 25. Regulatory scope limits (HMRC manual sections, India successor law, OFAC guidance PDF text, MiCA Regulation (EU) 2023/1114 text, OFAC five-year retention, US/UK/EU/India only; no other jurisdiction checked) | m33 items 1–6, 8 | OPEN — carried as M-25; read each source directly before any rule is published. |
| 26. `docs/09` migration details (descriptor examples, placeholders, expected-result text, verified mainnet replacements) | m17 O7 | OPEN — file-and-line audit of `docs/09` first. |
| 27. 24-word policy enforcement unverified (policy stated, enforcement behaviour not shown) | m02 | OPEN — verify separately. |
| 28. In-browser fixture reproduction on mainnet endpoints unverified | m29 | OPEN — check derivation, displayed addresses and network selection without funding. |
| 29. Terminology and callout work for the writing phase (“four secrets” map missing; re-grade 195 Warning callouts; unqualified secret-term count is a grep count, not an adjudication; “wallet” sweep unbounded) | m30 O2, O3, O4, O6 | OPEN — carried as M-26 (writing-phase work). |
| 30. UI-appendix placement and §5 proof-staleness | M35 §3 item 30; write-phase plan, 2026-11-09 ~22:41 IST | DECIDED in part — UI-appendix placement decided; §5 proof-staleness remains OPEN, carried as M-33. |
| 31. F4 §15 / Android questions still unanswered (user decision pending) | m36 item 2, m28-OI-10 | RESOLVED 2026-11-10 — carried as M-34 (worktree treatment applied and pushed). |
| 32. Landing and re-check of all 36 source slices | M35 §3 item 32; O-M35-1 | CLOSED — all 36 slices landed and were re-checked. |

**Item 30:** UI-appendix placement is **DECIDED**. The write-phase plan (2026-11-09 ~22:41 IST) specifies **no new UI appendix**: Doc 4 points to the Doc 2/Doc 3 appendices with “vetted for testnet; mainnet vetting open”. The §5 proof-staleness half remains **OPEN**, carried as **M-33**.

**Item 32 and O-M35-1 are CLOSED** by this re-check: all 36 slices landed and were re-checked. **O-M35-2 STANDS in part:** the re-check re-adjudicated every §3 item and re-verified each R/H row’s evidence, but did not re-run any source slice’s first-hand evidence — live probes, greps and code reads remain the source slices’ own. **O-M35-3 STANDS:** no mainnet procedure in this register was executed; every H-row is a rehearsal specification, not a verified procedure; no real funds were spent, by rule. **O-M35-4 STANDS:** “Larger amounts” and fee figures are deliberately absent. No amount, fee or price in this register is publishable as current — the guide must teach on-screen checks and reader-affordable-loss amounts, never a figure from this research.

## Appendix — UI templates (pointer)

Doc 4 carries no UI appendix of its own. For UI guidance, see the appendices of Doc 2 (WEB-GUIDE.md, Appendix — Optional pre-existing UI templates, L1032) and Doc 3 (ANDROID-GUIDE.md, Appendix — Optional pre-existing UI templates, L5384). Those appendices are vetted for testnet; mainnet vetting open. No template coverage is claimed here, and no UI is created in this guide: UI comes from a pre-existing template only, and if none is available, no UI is created.

## 22. Prose credit

The prose of this mainnet wallet guide was drafted with the assistance of GPT-6-Astra, an external language model accessed through AgentRouter. The drafting drew on the findings of the mainnet research programme (36 research agents, M01–M36) and the Bawa repository (`Pr3eve6ti2o/bawa` at `56396a20`).

The drafting model did not verify the guide, did not run the repository tools, did not perform any mainnet transaction and did not authorise any real-fund use. Every claim in this guide traces to a cited research finding or a recorded live check; the model supplied wording, not evidence.

Review, verification, assembly and the done-gate (see §17) are the maintainer’s responsibility. Corrections, the open-items register (§21) and the review record are maintained with the guide, not with the drafting model.

This is the only section of the guide that credits the drafting model. No part of the guide should be read as the model’s endorsement of any procedure in it.
