# Security decision guide

## Who is holding what

| Holder type | The question that matters most |
| --- | --- |
| Individual with small savings | Can I secure and recover this without a setup I cannot maintain? |
| Individual with life savings | Could one theft or loss put the whole holding at risk? |
| Small business or shared fund | Who can approve spending, and what happens if a key holder becomes unavailable? |
| Institution | Which people or services control enough signing power to spend, including during recovery? |

Bawa documents a workflow; it is neither a wallet application nor a custody service. It shows key generation on a computer you trust, watch-only derivation with no seed present, and checks performed independently. It does not operate a node, look up balances or broadcast transactions. The tracker cannot sign: that job stays with a separate signer or a hardware wallet.

Judge custody by the keys, not the service label. Count who controls enough signing power to meet the spending threshold. If a provider must contribute to every spend, it can block you. If you hold the threshold yourself and the provider has only a below-threshold recovery share, you can spend without it, while it cannot move funds alone.

## The free route, honestly

Using free tools does not leave you unguarded. It does leave you responsible for making the arrangement work.

Open-source coordinators such as Electrum and Sparrow can handle watch-only coordination, prepare partially signed Bitcoin transactions (PSBTs), and coordinate multisig. For air-gapped signing, you can transfer a PSBT file on MicroSD or use QR codes instead. Neither transfer method removes the need to check what you sign.

You can also:

- Pair a single hardware device with open-source software. The software can be free even though buying the device costs money.
- Make a metal backup of your seed by hand.
- Run multisig yourself, retaining every key rather than involving a provider.
- Practise on testnet at no cost.

“Free” describes the tooling and the absence of a service membership, not a promise that equipment, materials or your time cost nothing.

The remaining work is yours:

- **Set-up and checking.** Configure the arrangement and verify it independently. Do not treat a successful installation as proof that generation, derivation and signing all work as intended.
- **Backups and recovery tests.** Make the backups, rehearse recovery, and work through what happens when one backup is lost. Include instructions your heirs can use without relying on your memory.
- **Theft and shared failures.** Check what an attacker could do with one stolen seed or device. Consider a compromised computer separately from a firmware flaw affecting one vendor’s devices. Several devices do not automatically provide independent protection if they share the same firmware risk.
- **Phishing.** Keep checking the transaction you are being asked to approve, even when the request looks familiar or urgent.

No free tool makes approving a malicious transaction safe. Watch-only operation and separate signing are useful boundaries, but neither makes a dishonest payment request trustworthy.

## What paid help actually buys

A hardware device can be a one-off purchase used with free coordination software. That is different from paying an ongoing fee for help.

Assisted multisig memberships can provide guided set-up, help with key rotation, recovery assistance and inheritance planning, with a provider retaining one recovery key. Casa and Unchained are examples of providers in this category, not recommendations.

The recurring fee buys guidance, support and a person to contact when something goes wrong. It does not guarantee that funds cannot be stolen, and it does not protect you when you authorise the wrong transaction. Check which help a particular membership includes rather than assuming every tier offers the same support.

Apply the signing-threshold test before paying. Establish whether you can recover and spend without the provider, and plan for it shutting down as well as for your own lost backup. Help for heirs matters only if they can follow the recovery process and obtain the required signing power.

Institutional custody and hardware security module (HSM) services are another paid category, with fees agreed by arrangement. The same custody question still applies: who actually controls enough signing power?

**Dated price examples — recheck required.** The following figures were recorded from Casa’s vault page on **30 October 2026**. They illustrate a range of paid tiers, not a recommendation. Prices change; recheck the current figures before budgeting or subscribing.

| Published tier | Annual price, US dollars — recheck required |
| --- | ---: |
| Standard — 3-key vault | $250 |
| Premium — 5-key vault | $2,100 |
| Private Client — 6-key vault | $7,500 |
| Business | From $2,750 |

A tier’s key count does not establish its signing threshold or tell you who controls enough keys to spend. Check those arrangements separately from the price.

Part 2 chooses between these routes by budget and skill.

## Choosing by budget

- **No budget:** Use an open-source wallet co-ordinator and practise on testnet. Make your backup by hand or on metal. Running multisig yourself is an option if you can manage the extra complexity.
- **A one-off device budget:** Buy a hardware signer and pair it with open-source wallet software.
- **A yearly budget:** Assisted multisig can provide guidance and help with recovery.
- **A large or institutional budget:** This can cover custody or hardware security module (HSM) arrangements, with the terms agreed by contract.

Recheck every price when you are ready to buy.

## Choosing by skill and by who must act if you cannot

If you cannot yet complete a recovery test, keep practising on testnet. Stay with one hardware device and a backup written down rather than adding more moving parts.

Once you can carry out recovery tests and safeguard each co-signer’s details, running multisig yourself becomes a practical option.

If another person must be able to take over when you cannot act, write an explicit inheritance plan. Wallet software will not arrange that handover for you.

## Rules that must not be lost

- **Multisig:** To reconstruct the wallet, you need the extended public key from **every** co-signer, together with the signing threshold, script type and derivation path. Having enough signing keys to spend is not a substitute for those records. Altering the threshold requires a new wallet and a transfer of funds into it. Mix device makers to limit exposure to a flaw in one vendor’s firmware.
- **MPC:** Establish who holds enough shares to meet the threshold before deciding who has custody; the product label does not answer that question. If every signature requires the provider’s share, that provider can block your spending. Check that the exit route works before depositing. MPC will not prevent you from authorising a malicious transaction.
- **Recovery testing:** Prove that you can recover from the backup before committing funds. Use testnet or no more than a tiny test amount. Run the recovery test again whenever the device, threshold or provider changes.

## A short checklist before you fund anything

Work through these in order:

- [ ] Confirm that the wallet is on the network you intend to use.
- [ ] Write down the wallet’s derivation path.
- [ ] Write out the backup and store copies in separate locations.
- [ ] Complete a successful recovery test from that backup.
- [ ] Verify the address and signing details on the signing device’s own screen.
- [ ] Store the co-signer records or MPC share details with the backup, as applicable.
- [ ] Write an inheritance note explaining who should be able to act and how.

Bawa serves as a reference for generation, deriving watch-only data and checking results independently. It provides neither custody nor exchange services, and an app built on it still needs a security review of its own.

Bawa can teach you how the pieces fit; it cannot watch your funds for you.
