---
title: Security Decision Guide
description: Choose between the free route and paid help for a testnet wallet by holder type, budget and skill; work the spending-threshold arithmetic, and complete the checklist before funding anything.
last-updated: 2026-11-08
---

# Security decision guide

How-to guide.

## Contents

- [Scope](#scope)
- [Who is holding what](#who-is-holding-what)
- [The free route, honestly](#the-free-route-honestly)
- [What paid help actually buys](#what-paid-help-actually-buys)
- [Choose between the routes](#choose-between-the-routes)
- [Calculate the spending threshold](#calculate-the-spending-threshold)
- [Work through two scenarios](#work-through-two-scenarios)
- [Choose by budget](#choose-by-budget)
- [Choose by skill and plan for handover](#choose-by-skill-and-plan-for-handover)
- [Apply the wallet and recovery rules](#apply-the-wallet-and-recovery-rules)
- [Complete the checklist before funding a testnet wallet](#complete-the-checklist-before-funding-a-testnet-wallet)
- [Use Bawa as a reference](#use-bawa-as-a-reference)

## Scope

Use this guide for testnet wallets only. Mainnet is absent from this guide set, and passing any gate does not authorise mainnet use.

## Who is holding what

Start with the decision that matters for your holder type.

| Holder type | Decision to examine |
| --- | --- |
| Individual with small savings | Check whether you can protect and recover the holding with a set-up you can maintain. |
| Individual with life savings | Check whether one theft or loss could put the whole holding at risk. |
| Small business or shared fund | Identify who can approve spending and what happens if a key holder becomes unavailable. |
| Institution | Count which people or services control enough signing power to spend, including during recovery. |

Treat Bawa as a documented workflow, not a wallet application or custody service. Follow its coverage of key generation on a computer you trust, watch-only derivation with no seed present, and independent checks. Do not expect Bawa to operate a node, look up balances or broadcast transactions. Keep signing with a separate signer or hardware wallet; the tracker cannot sign.

Judge custody by the keys, not the service label. Count who controls enough signing power to meet the spending threshold. If a provider must contribute to every spend, it can block you. If you hold the threshold yourself and the provider has only a below-threshold recovery share, you can spend without it, while it cannot move funds alone.

## The free route, honestly

Use free tools without assuming that they remove your responsibility for maintaining the arrangement.

Use open-source coordinators such as Electrum or Sparrow for watch-only coordination, preparing partially signed Bitcoin transactions (PSBTs), and coordinating multisig. For air-gapped signing, use MicroSD or QR transfer only where the selected coordinator and separate signer support compatible PSBT formats and the chosen transfer method. Verify and record the complete PSBT exchange on testnet before relying on that route. Check what you sign regardless of the transfer method.

Consider each of these options:

- Pair a single hardware device with open-source software. Distinguish free software from the cost of buying the device.
- Make a metal backup of your seed by hand.
- Run multisig yourself, retaining every key rather than involving a provider.
- Practise on testnet at no cost.

Treat “free” as a description of the tooling and the absence of a service membership, not a promise that equipment, materials or your time cost nothing.

Keep responsibility for the remaining work:

- **Set-up and checking.** Configure the arrangement and verify it independently. Do not treat a successful installation as proof that generation, derivation and signing work as intended.
- **Backups and recovery tests.** Make backups, rehearse recovery and work through the loss of one backup. Include instructions your heirs can use without relying on your memory.
- **Theft and shared failures.** Check what an attacker could do with one stolen seed or device. Consider a compromised computer separately from a firmware flaw affecting one vendor’s devices. Do not count several devices as independent protection merely because they are separate devices.
- **Phishing.** Keep checking the transaction you are being asked to approve, even when the request looks familiar or urgent.

Do not expect any free tool to make approving a malicious transaction safe. Use watch-only operation and separate signing as boundaries, not as reasons to trust a payment request.

## What paid help actually buys

Pay for clearly specified assistance with work you would otherwise manage yourself. Confirm which set-up, checking, backup, recovery rehearsal and instructions-for-heirs tasks the service helps with, and which remain yours. Do not assume that a membership covers all of them or removes the need to check each transaction.

Use these figures from the [Casa vault FAQ](https://casa.io/vault), re-checked live on **8 November 2026**, as a dated reference:

| Casa plan | Annual price |
| --- | --- |
| Standard 3-key vault, 2-of-3 | $250 per year |
| Premium 5-key vault, 3-of-5 | $2,100 per year |
| Private Client 6-key vault | $7,500 per year |
| Business plans | Start at $2,750 per year |

Do not infer a Private Client threshold from its key count; the FAQ does not state one.

Prices change, so check the vendor’s current pricing before choosing.

Confirm the actual key allocation and the provider’s role in spending and recovery. Do not infer either from the plan name, annual fee or total number of keys.

## Choose between the routes

Use your own current figures for equipment, backup materials and any membership costs. Account separately for the time you can commit to set-up, independent checks, backups and recovery practice.

Choose the free route when you can maintain those responsibilities yourself. Choose paid help when the assistance you have confirmed addresses a gap you have identified and fits your ongoing budget. Do not use the size of the holding, the subscription price or the number of keys as a substitute for examining control and recovery.

For either route, work through loss, theft, shared failures and a provider becoming unavailable. Keep the same checks on signing requests, whether or not you pay for assistance.

## Calculate the spending threshold

Use your own current key allocation for the arithmetic. Count the keys controlled by you, each other key holder and any provider. For each loss you are assessing, subtract the unavailable keys from the total, then compare the remaining usable keys with the spending threshold.

- **2-of-3:** Require **2 of 3 keys** to move funds. Allow for the loss of **1 key**, because 3 minus 1 leaves 2. Losing 2 keys leaves only 1, below the threshold. Treat an attacker’s control of 2 keys as enough signing power to move funds.
- **3-of-5:** Require **3 of 5 keys** to move funds. Allow for the loss of **2 keys**, because 5 minus 2 leaves 3. Losing 3 keys leaves only 2, below the threshold. Treat an attacker’s control of 3 keys as enough signing power to move funds.

Apply these limits to the number of keys affected, not merely the number of incidents. Check whether one computer compromise or a shared firmware flaw could affect several keys. Do not treat either threshold as protection against a malicious transaction approved with enough keys.

## Work through two scenarios

Use these hypothetical testnet arrangements to examine the arithmetic and dependencies. Substitute your own current key allocation when assessing a route. Do not treat either example as a description of Casa’s key allocation.

### Scenario 1: retain all 3 keys yourself

For an individual rehearsal, assess a self-managed testnet 2-of-3 arrangement. Assume that you retain all 3 keys, use Electrum or Sparrow for coordination, and involve no provider. Work through loss and theft separately.

> **Expected result:**
>
> - With 1 key unavailable, 3 minus 1 leaves 2 usable keys, enough to move funds.
> - With 2 keys unavailable, 3 minus 2 leaves only 1, so the spending threshold cannot be met.
> - With 1 stolen key, an attacker cannot meet the threshold alone. With 2 stolen keys, the attacker can.

Choose this free-tooling route only if you can maintain the checks, backups, recovery rehearsals and instructions for heirs yourself. Include equipment, backup materials and your time in the comparison, even without a service membership. Do not assume that retaining all keys makes their failure risks independent.

### Scenario 2: examine a provider’s below-threshold role

For a small business or shared-fund rehearsal, assess a hypothetical testnet 3-of-5 arrangement. Assume that your authorised key holders control 3 keys and a provider controls 2.

> **Expected result:**
>
> - With your 3 keys usable, the threshold is met without the provider. Even if its 2 keys become unavailable, 5 minus 2 leaves the required 3.
> - With 1 of your keys unavailable, only 2 remain under your control. Although 4 keys remain in total, at least 1 provider key is now needed.
> - With 2 of your keys unavailable, 1 remains under your control. That key plus the provider’s 2 gives 3, so spending requires both provider keys.
> - With 3 keys unavailable overall, 5 minus 3 leaves only 2, below the threshold.
> - With only its own 2 keys, the provider cannot move funds alone.

Recognise the change in dependency: once a loss leaves your side below the threshold, the provider’s contribution becomes necessary, and withholding it can block spending. Compare that dependency with the assistance you have confirmed and your own current costs before choosing paid help. Confirm the actual allocation for any plan rather than importing this example into it.

Do not infer a tier’s signing threshold or who controls enough keys to spend from its key count. Check those arrangements separately from the price. Choose between the following routes by budget and skill.

## Choose by budget

- **No budget:** Use an open-source wallet co-ordinator and practise on testnet. Make your backup by hand or on metal. Consider running multisig yourself only if you can manage the extra complexity.
- **A one-off device budget:** Buy a hardware signer and pair it with open-source wallet software.
- **A yearly budget:** Consider assisted multisig for guidance and help with recovery.
- **A large or institutional budget:** Consider custody or hardware security module (HSM) arrangements, with the terms agreed by contract.

Recheck every price when you are ready to buy.

## Choose by skill and plan for handover

If you cannot yet complete a recovery rehearsal, keep practising on testnet. Stay with one hardware device and a written backup rather than adding more moving parts.

Consider running multisig yourself on testnet only once you can complete and record successful recovery rehearsals on a clean install and safeguard each co-signer’s details.

If another person must be able to take over when you cannot act, write an explicit inheritance plan. Do not rely on wallet software to arrange that handover for you.

## Apply the wallet and recovery rules

- **Multisig:** Keep the extended public key from **every** co-signer, together with the signing threshold, script type and derivation path, to reconstruct the wallet. Do not treat possession of enough signing keys to spend as a substitute for those records. To alter the threshold, create a new wallet and transfer the testnet funds into it. Mix device makers to limit exposure to a flaw in one vendor’s firmware.
- **MPC:** Establish who holds enough shares to meet the threshold before deciding who has custody. Do not infer custody from the product label. If every signature requires the provider’s share, recognise that the provider can block your spending. Check that the exit route works before depositing testnet funds. Do not rely on MPC to prevent you from authorising a malicious transaction.
- **Recovery testing:** Before committing testnet funds, prove that you can recover from the backup through a successful rehearsal on a clean install, and record the result. Use no more than a tiny testnet amount for the rehearsal. Repeat the clean-install rehearsal and record its result whenever the device, threshold or provider changes.

## Complete the checklist before funding a testnet wallet

Work through these checks in order:

- [ ] Confirm that the wallet is on the intended testnet.
- [ ] Write down the wallet’s derivation path.
- [ ] Write out the backup and store copies in separate locations.
- [ ] Complete and record a successful recovery rehearsal from that backup on a clean install.
- [ ] Verify the address and signing details on the signing device’s own screen.
- [ ] Store the co-signer records or MPC share details with the backup, as applicable.
- [ ] For MPC, check that the exit route works before depositing testnet funds.
- [ ] Write an inheritance note explaining who must be able to act and how.

> **Expected result:** Mark recovery as tested only after a successful rehearsal on a clean install has been executed and recorded. Treat the completed checklist as applying to testnet only.

## Use Bawa as a reference

Use Bawa as a reference for generation, deriving watch-only data and checking results independently. Do not treat it as a custody or exchange service. Require any app built on Bawa to have a security review of its own.

Use Bawa to learn how the pieces fit, but do not rely on it to watch your funds.

### External security review gate (open)

**Open item:** No external security review has been commissioned.

Treat the external security review as a mandatory gate, not an optional extra. Require an independent review against the threat model in docs/15 of Bawa’s documented workflow and relevant repository code, covering key generation, key handling and storage guidance, watch-only derivation with no seed present, and independent checks. Explicitly define the boundaries with external coordinators, signers and hardware wallets. Identify separately any review of those external components’ signing or network code; do not describe that code as Bawa’s.

Record the review’s findings and resolve all critical and high findings before considering any mainnet work. Do not treat passing this gate as authorisation for mainnet use.

