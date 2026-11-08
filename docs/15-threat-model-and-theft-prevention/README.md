---
title: Threat Model and Theft Prevention
description: Name the threats to a self-custody wallet, phishing, fake apps, SIM swap, address poisoning, malware, supply-chain compromise and weak generation, and apply the free and paid fixes, layered setup and incident-response playbook that answer them.
last-updated: 2026-11-08
---

# Threat model and theft prevention

Explanation.

## Contents

- [Establish the threat model and trust boundary](#establish-the-threat-model-and-trust-boundary)
- [Respond to recovery-material exposure](#respond-to-recovery-material-exposure)
- [Malware on your machine](#malware-on-your-machine)
- [Supply-chain compromise](#supply-chain-compromise)
- [Weak generation and weak entropy](#weak-generation-and-weak-entropy)
- [Review and recovery status](#review-and-recovery-status)
- [Physical theft and loss](#physical-theft-and-loss)
- [Cloud backup and digital-copy leaks](#cloud-backup-and-digital-copy-leaks)
- [Exchange and custody failure](#exchange-and-custody-failure)
- [Malicious transaction approval and blind signing](#malicious-transaction-approval-and-blind-signing)
- [What a holder should NOT buy or do](#what-a-holder-should-not-buy-or-do)
- [Fixes mapped to threats](#fixes-mapped-to-threats)
- [Personal security checklist by risk level](#personal-security-checklist-by-risk-level)
- [Incident-response playbook](#incident-response-playbook)
- [What no solution prevents](#what-no-solution-prevents)
- [Sources](#sources)

## Establish the threat model and trust boundary

Treat mnemonic phishing, fake wallet apps and browser extensions, social engineering, SIM swap, address poisoning and clipboard hijacking as threats when you install, update, restore or use a wallet. Handle Bawa’s wallet recovery material with an explicit trust boundary. Read [docs/SECURITY.md](../SECURITY.md) for the wider threat model, trust boundaries, secret-handling rules and known limitations.

### Maintain the trust boundary

> **Warning:** Whoever holds your mnemonic or private key controls the wallet. Never hand either over to a service, support agent or wallet maker; no legitimate service asks you to do so. If either has been disclosed, treat it as permanently compromised and follow the exposure response below.

Keep mnemonics, private keys, all private extended keys, recovery data keys, production `.env` files, wallet backups, credentials and API secrets out of anything public.

Treat xpubs and zpubs as **sensitive public material**. Account for the disclosure risk: an xpub cannot sign, but exposing it discloses addresses, balances, payment history and relationships. Restrict their disclosure accordingly.

Assume that the online application may be observed, logged, restarted or compromised, and include malware on your machine in that assessment. Keep the seed and signer offline, and verify payment details there. Keep seed material out of the online watch-only runtime, which handles account and activity data. Assess email, carrier and exchange accounts as a separate, surrounding layer.

Apply highest-sensitivity handling to the BIP-39 mnemonic and passphrase, private keys and extended private keys, the recovery data key, and encrypted recovery artefacts awaiting controlled backup. Keep all of this material out of the runtime, and handle controlled backup as a separate workflow.

Treat account xpubs and zpubs as **sensitive public material**: an xpub cannot sign, but exposing it discloses addresses, balances, payment history and relationships. Treat derived address inventories and payment/order links as privacy-sensitive too.

Do not describe recovery as tested until you have executed a rehearsal on a clean install and recorded it.

Report Bawa vulnerabilities privately to the repository maintainers rather than publishing exploit details.

### Recognise mnemonic phishing

Recognise mnemonic phishing as a common scam, particularly when you restore a wallet or seek help. Watch for fake wallet sites, cloned apps and bogus support messages. Treat unsolicited support, urgent warnings, lookalike web addresses and requests for a mnemonic to “verify” or “unlock” a wallet as warning signs.

> **Warning:** Disclosing a mnemonic or private key can cost every asset it controls; confirmed transfers are generally irreversible. Use independently verified wallet and support addresses. Never send recovery material through chat, email or screenshots, and enter it only for a restoration you initiated in verified wallet software, not through a support link. If disclosure has occurred, follow the exposure response below.

Read the [phishing background article](https://tangem.com/en/blog/post/how-to-protect-crypto-from-phishing/) for further context.

### Verify wallet apps and browser extensions

Account for malicious apps and browser extensions that imitate genuine wallets, including fake apps that look identical. Apply these checks when installing, updating or restoring a wallet, and recognise the increased risk from unverified downloads and advert links.

Treat lookalike names, an unexpected publisher, unexplained permissions and low download counts for a supposedly established wallet as reasons for further checks. Do not treat low counts as an automatic verdict, or popularity, favourable reviews and an app-store listing as proof of trustworthiness.

As the builder, make the genuine app verifiable. Publish official download links from a verified origin, state the publisher identity, sign Android releases with signing-key continuity and give users verification instructions. Do not substitute a warning about fakes for a verifiable genuine source.

> **Warning:** A fake wallet can expose recovery material entered or created in it, putting all funds in the affected wallet at risk. Start from the wallet maker’s independently verified website and follow its official download or store links; avoid unverified downloads, advert links and wallet extensions you do not need. Check the publisher and requested permissions, and follow the maker’s verification instructions. If you suspect fake software, stop wallet activity on the affected device and follow the exposure response below.

Read the [background on wallet malware and phishing](https://www.purevpn.com/blog/protect-crypto-wallet-from-malware-and-phishing-attacks/) for further context.

### Resist social engineering

Expect social-engineering attempts in public crypto communities. Watch for impersonators posing as support staff or community admins to pressure wallet users and operators into revealing secrets or authorising payments.

Recognise fake giveaways, bogus airdrops and drainer links in Discord and Telegram messages, including messages from compromised, familiar accounts. Treat unsolicited help, urgent deadlines, requests to “validate” a wallet, pay-to-claim demands and unexpected signing prompts as warning signs.

> **Warning:** Social engineering can expose recovery material, take funds or reveal private account activity. Reject requests to disclose secrets, follow drainer links or approve unexpected signing prompts, and do not authorise payments under pressure. Verify claimed wallet and support contacts independently. If a mnemonic or private key has been disclosed, follow the exposure response below.

### Unsolicited claims and support requests

Find support through independently verified channels. Ignore unsolicited claim links. Never share wallet secrets or upload recovery files to support chats. Do not sign requests you cannot explain and independently verify.

> **Warning:** Changing an account password does not repair exposed keys. Stop contact and signing if you suspect compromise. From a clean device, protect affected accounts and revoke sessions and malicious spending approvals where applicable. If wallet secrets escaped, create a replacement wallet and recovery set offline, then move remaining funds using a trusted signing setup.

### Account for SIM swap

Treat carrier account takeover as a credible risk while SMS remains a login or recovery route, particularly when your email or exchange access depends on your number. Recognise that a takeover can redirect your number so that someone else receives SMS codes and phone-based account recovery messages, potentially leading to email takeover, account lock-out and loss of exchange-held funds. [2, 3]

Watch for unexplained loss of mobile service, unexpected SIM/eSIM or number-transfer notices, and unrequested login or password-reset messages.

Prefer passkeys or security keys for email and exchanges; use an authenticator app if those are unavailable. Remove SMS recovery fallbacks where supported. Set a carrier **account** PIN and enable port-out and SIM-change locks where offered. Keep recovery codes offline.

If you suspect a SIM swap, use a clean device and known support routes to ask your carrier to protect your carrier account and restore your number, and ask your exchange to freeze withdrawals. Protect your email account, revoke affected sessions, and replace compromised passwords, authentication factors and recovery settings.

Do not treat a SIM swap alone as evidence that your wallet seed needs replacing: control of a SIM alone cannot reveal an offline seed or sign a self-custody payment.

### Check for address poisoning and clipboard hijacking

Account for address poisoning through misleading transaction-history entries that present addresses resembling genuine recipients, especially if you reuse addresses from history. Treat clipboard hijacking as a related threat from malware on your machine, which can substitute a different destination when you copy and paste an address. Regard both as realistic payment risks, particularly if you check only an address’s beginning and end. [1]

Watch for unexplained history entries, near-matching addresses, or differences between the intended destination, pasted value and signing display.

> **Warning:** A confirmed payment to the wrong address has no wallet-level undo. Do not use transaction history as an address book. Obtain recipient details through a separate trusted channel, and do not accept the online screen or matching first or last characters as proof. Compare the **whole address**, network and amount in the trusted signing environment, and pause payments on any mismatch.

Isolate and rebuild a device showing clipboard substitution before reusing it. If funds were sent, preserve the transaction ID and contact an identifiable receiving service through its official channel; do not assume that the funds can be recovered. Do not treat history spam alone as evidence that keys have leaked.

## Respond to recovery-material exposure

Treat any disclosed mnemonic or private key as permanently compromised. If fake software may have exposed recovery material, stop wallet activity on the affected device.

Use verified software on a clean, trusted device to create a new wallet with a fresh seed. Use a separate, trusted device if fake software affected the original device. Move any remaining assets promptly and retire the compromised wallet.

Remove and report fake apps or extensions to the store. Clean or rebuild the affected device before using it for wallets again.

> **Warning:** Changing a wallet password does not protect an exposed seed, and uninstalling fake software cannot protect an exposed key. Use a fresh-seed wallet rather than continuing with the compromised wallet. Check that the compromised wallet has been retired and that any assets you successfully moved are controlled by the fresh seed.

> **Expected result:** The compromised wallet is retired, and any assets successfully moved are controlled by the fresh seed.

Do not describe recovery as tested until you have executed a rehearsal on a clean install and recorded it.

## Malware on your machine

Treat keyloggers, clipboard hijackers, infostealers and abused remote-access tools as threats when you generate, recover or use a wallet on an infected machine. Account for malicious downloads, including cracked software and counterfeit extensions, as routes of infection. Expect greater risk with untrusted downloads on a daily-use machine, and allow for permanent loss of all wallet funds if secrets are copied or payment addresses replaced. [1](https://coinspaid.com/knowledge-base/hot-wallet-hacks-and-risks/)

Prefer a dedicated, patched device and verified downloads. Avoid cracked software, minimise extensions and check payment details on an independent trusted display.

Check for addresses changing after pasting, unfamiliar extensions, unexpected remote sessions and malware alerts. Do not treat an absence of warnings as evidence that the machine is clean.

> **Warning:** Mnemonic plaintext can be exposed during generation or recovery despite encryption at rest, which protects stored ciphertext only. JavaScript and WebAssembly memory handling offers no cryptographic guarantee of perfect zeroisation. Disconnect an affected machine and use a separate, trusted environment. Generate a fresh wallet and move remaining funds. Do not reuse the exposed mnemonic. Rebuild the infected machine and rotate other exposed credentials.

## Supply-chain compromise

Account for tampered dependencies, malicious updates and fake releases as threats to both maintainers and holders. Treat unverified distribution routes as a credible risk, because a compromised component can expose funds belonging to many holders.

> **Warning:** A hidden implant can capture the mnemonic displayed during setup, as described in public reports of physically tampered hardware wallets bought through a reseller rather than directly from the maker. [2](https://www.bitgo.com/research/fool-me-twice-ledger-tokenized-repo-and-finks-worldview/) Buy hardware directly from the maker and verify the device using the maker’s guidance. Check seals and casing for alterations, but do not assume hidden tampering will leave an obvious sign. Do not treat a successful genuine-check alone as proof that a device was never opened.

Do not treat a version range as evidence of a tested dependency graph. Keep Trust Wallet Core pinned to Bawa’s exact, tested package version. Keep bip_utils pinned and use it only for independent verification. Before a production release, commit the lockfile produced by a clean install. Run dependency and secret scanning in CI and release workflows. Prefer signed or tagged upstream releases, and record release checksums and provenance where practical.

Check for unexplained dependency changes and signature or checksum failures. Stop affected releases, quarantine suspect devices or packages, and notify affected holders. Rebuild from independently verified inputs. Treat mnemonics handled by compromised software or hardware as exposed, and use a separate, trusted environment to generate fresh wallets and move remaining funds.

## Weak generation and weak entropy

Treat untrusted or flawed generation software as a risk of predictable or already-known seeds. Account for the possibility of permanent loss from flawed generators or predictable secrets even when the wallet appears to work normally. Expect little protection from a short or guessable mnemonic passphrase if the mnemonic leaks.

Use only well-reviewed generators, and require cryptographically secure randomness. If the library does not provide the entropy, generate it using the operating system’s source and inspect it. If you use a mnemonic passphrase, choose a long, randomly generated one.

If you add entropy from your own private dice rolls, incorporate it during generation through a documented, reviewed method.

Check for pre-supplied mnemonics, unexplained randomness sources, published generator flaws, and passphrases based on reused passwords or personal details. Do not accept a valid mnemonic or agreement between derivation libraries as proof of sound entropy.

> **Warning:** Re-encrypting backups cannot repair predictable seeds or weak mnemonic passphrases. Changing the mnemonic or its passphrase creates different keys and does not protect funds at existing addresses. Additional dice entropy cannot repair existing keys or make malicious software trustworthy. Generate an entirely new wallet in a separate, trusted environment with fresh entropy generated according to the rule above and a long, randomly generated passphrase if you use one. Move remaining assets, stop using the old addresses and do not reuse the suspect mnemonic.

## Review and recovery status

Require an external security review of Bawa before treating it as production custody infrastructure.

Treat recovery as untested until you have executed a recovery rehearsal on a clean install and recorded it.

Use Bawa’s dedicated directory for wallet secrets. Note that Bawa applies restrictive permissions, writes encrypted artefacts atomically with mode `0600` and rejects symlinked secret paths.

> **Warning:** Readable copies stored elsewhere are not protected by these controls, and public `xpub`/`zpub` values can reveal linked addresses and wallet activity. Keep mnemonics and private keys out of `.env`, and treat any public `xpub`/`zpub` values stored there as privacy-sensitive. If secrets might have been exposed, move remaining funds to a wallet with a newly generated seed.

### Physical theft and loss

- **Risk and impact:** Plan for theft, burglary or misplacement of devices and paper or metal backups, and for destruction by fire or flood. Treat these as realistic risks, especially for portable devices. Exposed secrets can cost all wallet funds; losing every recovery route can permanently remove access.
- **Prevention:** Lock and encrypt devices. Keep physically protected offline backups in separate locations, with suitable fire and water protection. Avoid relying on one backup in one place. Store your BIP-39 passphrase separately from your seed backups.
- **Check:** Look for missing devices or backups, disturbed storage and unexplained transactions. Do not assume that a copied backup will leave a sign.
- **Recovery:** Restore from an intact backup on a trusted replacement. If secrets might be exposed, move remaining funds to a wallet with a newly generated seed.

### Cloud backup and digital-copy leaks

- **Risk and impact:** Treat readable seeds in photos, screenshots, notes apps, email and cloud drives as vulnerable to account compromise and automatic syncing. Account for increased risk from unnoticed synced copies or weak account protection. One account takeover can expose the wallet, and a leaked seed puts all funds it controls at risk. Deleting copies does not reverse seed exposure.
- **Prevention:** Keep recovery backups offline and exclude Bawa’s secret directory from automatic sync.
- **Check:** Look for unrecognised account sessions, changed sharing settings and secret-bearing copies appearing on another device.
- **Recovery:** On a trusted device, move remaining funds to a wallet with a newly generated seed. Change the account password, end other sessions and remove copies, including deleted items.

### Exchange and custody failure

- **Risk and impact:** Account for your dependence on the provider whenever an exchange, custodial service or hosted wallet holds your keys. Treat business failure, freezes and breaches as possible even with an established provider. The entire custodial balance may become inaccessible or be lost, and full recovery may not be possible.
- **Prevention:** Minimise custodial balances. When choosing self-custody, take responsibility for protecting keys, maintaining backups and checking transactions before signing.
- **Check:** Look for blocked withdrawals, unexplained balance changes and independently confirmed incident notices.
- **Recovery:** Protect your account through verified channels, withdraw available funds to a wallet you control and retain records for support or formal claims.

### Malicious transaction approval and blind signing

- **Risk and impact:** Treat token approvals as authorisation for a spender to use tokens later. Account for an unlimited allowance exposing the relevant token balance, including later deposits. Treat hurried or unclear requests as higher risk: signing a transaction you have not read on a trusted screen can authorise unwanted transfers even while your seed remains secret. Revocation cannot undo confirmed transfers.
- **Prevention:** Limit allowances to the amount needed. Read the action, recipient or spender, asset and amount on a trusted signing-device screen, not only the website. Do not sign if those details cannot be shown clearly.
- **Check:** Look for unknown spenders, unexpected unlimited allowances, requests for blind signing and unexplained token transfers.
- **Recovery:** Revoke suspect approvals through an independently verified tool and move at-risk funds if necessary. If keys have also leaked, migrate to a wallet with a newly generated seed.

## What a holder should NOT buy or do

- **No paid seed-recovery service.** Do not hand recovery material to an operator.
- **No cloud seed vault marketed as safe.** Marketing claims do not satisfy Bawa’s offline-backup boundary.
- **No second-hand or reseller hardware device.** Buy directly from the maker and initialise it yourself; reject pre-set recovery words.
- **No recovery software that asks for the seed outside your own device.** Recovery entry belongs on your own trusted offline device or signer, never a website, support chat, remote session or online tracker.

## Fixes mapped to threats

Use **signing and hardware** for signer setup and **security and recovery** for recovery procedures.

### Layered setup

Combine device and account controls, offline recovery records, signing controls and transaction checks. Add equipment or services only after reviewing their requirements and limits; do not substitute a purchase for the other layers.

Include the mnemonic, the exact BIP-39 passphrase policy, chain derivation paths and address policy, account, network and chain configuration, and TON wallet configuration where applicable in the recovery record. Record any passphrase value separately.

### Free fixes

Use these measures without a security-product purchase. Account for possible network fees on transfers and on-chain revocations, and check them before signing.

| Fix and threats addressed | Limit, action and check |
| --- | --- |
| **[Offline paper backup](https://strike.me/gb/en/learn/how-do-i-protect-my-private-keys/)**, device loss, disaster and online backup leakage. | Paper remains vulnerable to damage and copying. Make Bawa’s required 2 to 3 offline copies in places without a shared fire or flood risk, and record physical access controls for each. Check each copy for completeness and legibility. |
| **Test recovery before funding**, incomplete records, wrong passphrase or derivation settings. | A successful rehearsal does not prevent later theft or deterioration. Rehearse recovery on a clean install on your own trusted offline device. Compare the intended accounts and addresses, and record the outcome before describing recovery as tested. |
| **[Device and software hygiene](https://www.cryptocurrencyhongkong.com/en/news/safeguarding-your-assets-33-practical-measures)**, malware, malicious downloads and known vulnerabilities. | An updated device can still be compromised. Verify download provenance, update supported operating systems, applications and firmware, and remove unused software. Follow the containment playbook below if you suspect compromise. |
| **Separate browser profile with minimal extensions**, extension snooping and session cross-contamination. | A browser profile does not isolate you from device malware. Dedicate a profile to tracking and service accounts, and remove non-essential extensions. Check that only necessary extensions remain. |
| **[Authenticator-app or passkey two-factor authentication instead of SMS](https://rootcrak.com/blog/sim-swap-crypto-2026.html)**, SIM-swap-assisted account takeover and stolen passwords. | Authenticator codes remain phishable, and stolen sessions can bypass login checks. Protect email and exchange accounts, remove SMS fallbacks where possible, and save recovery codes offline. Review the enabled authentication and recovery options. |
| **[Carrier PIN and port-out lock](https://www.ownyouronline.govt.nz/personal/get-protected/guides/protect-yourself-against-sim-swapping/)**, unauthorised SIM replacement and number transfer. | Carrier procedures can still be abused. Set a distinct carrier account PIN and request a port-out lock. Check which controls are enabled and review the carrier’s recovery arrangements. |
| **Withdrawal allow-lists and alerts, where offered**, account takeover and unexpected withdrawals. | Alerts do not block transfers, and service controls cannot restrain a stolen wallet key. Allow only verified destinations and configure alerts. Check the allow-list and respond to alerts. |
| **Approval review and revocation**, malicious or forgotten token allowances. | Revocation cannot reverse completed theft. Inspect the spender, token and amount before approval, and revoke unnecessary permissions using verified tools. Review the remaining permissions. |
| **Full address verification before sending**, clipboard substitution and wrong destinations. | A matching address does not establish the recipient’s honesty. Compare every character on the trusted signer against an independently confirmed destination. Check the network and any memo or tag before signing. |
| **Small test transfer first**, destination, network or receiving-configuration mistakes. | A successful test does not validate later addresses, transactions or contract interactions. Send a small amount and confirm receipt with the recipient. Repeat all checks before sending the remainder. |

### Paid fixes

Check current vendor pricing and ongoing fees for equipment or services. Account for any cost of separate protected storage; a passphrase itself is free to create.

| Fix and threats addressed | Limit, action and check |
| --- | --- |
| **Hardware signing device bought directly from the maker**, online key extraction and some supply-chain exposure. | A hardware signer cannot stop you authorising a malicious transaction or approval. Buy directly from the maker and initialise the device yourself. Verify firmware and inspect transaction details on its display before signing. |
| **Metal seed backup**, fire, water and paper deterioration. | Durability varies, and metal does not prevent reading or copying. Retain physical access controls for the backup. Check the recorded words and legibility. |
| **Second signing device**, signer loss or failure. | Duplicating the same key provides availability, not multisignature protection; either copy can expose the wallet. Recover the spare and keep it separately under physical access controls. Execute and record a clean-install recovery rehearsal before treating recovery as tested. |
| ****Passphrase kept separate from the seed****, theft of a mnemonic backup alone. | Weak BIP-39 passphrases can be guessed, and losing the correct value can strand funds. Record the exact BIP-39 policy and keep the passphrase value apart from every mnemonic backup. Execute and record a clean-install recovery rehearsal using that policy. ([Trezor — What is a passphrase?](https://trezor.io/guides/backups-recovery/advanced-wallets/what-is-a-passphrase)) |
| **Multisignature across devices from different makers**, compromise of one key, device or maker. | Shared custody or common compromised software can defeat separation. Check chain support, use independent keys and separated backups, and record the threshold, cosigner public keys and recovery procedure. Verify the recovery record through an executed, recorded clean-install rehearsal. |
| **For businesses: external security review and dependency and secret scanning in release workflows**, design errors, vulnerable dependencies and leaked credentials. | Reviews are snapshots, and scanners miss flaws. Commission a boundary review and automate dependency and secret scans in release workflows. Check and resolve findings before release without treating the review or scans as certification. |

### Paid help

Prices change; check the vendor's current pricing before choosing.

| Vendor | Reference |
| --- | --- |
| Casa | Consult `docs/16` for the re-checked Casa figures. |

### Setup and recovery checklist

- [ ] Complete the recovery record, including TON wallet configuration where applicable.
- [ ] Make 2 to 3 offline copies in locations without a shared fire or flood risk, and record physical access controls for each.
- [ ] Keep the BIP-39 passphrase value apart from every mnemonic backup.
- [ ] Rehearse recovery before funding on a clean install on your own trusted offline device, using the recorded policy and configuration.
- [ ] Compare the intended accounts and addresses and record the rehearsal outcome.
- [ ] Mark recovery as tested only after you have executed and recorded the clean-install rehearsal.

> **Expected result:**
>
> Confirm that the recorded clean-install rehearsal reproduces the intended accounts and addresses using the documented passphrase policy and configuration.

> **Warning:** Mismatched accounts or addresses leave recovery unconfirmed. Hold off funding and correct the recovery record or settings. Repeat the clean-install rehearsal, compare the accounts and addresses, and record the outcome.

### Before-signing checklist

- [ ] Compare every character of the destination on the trusted signer against an independently confirmed destination.
- [ ] Check the network and any memo or tag.
- [ ] Inspect the transaction details on the signer’s display.
- [ ] For an approval, check the spender, token and amount.
- [ ] Check any network fee before signing a transfer or on-chain revocation.
- [ ] For a transfer, send a small test amount first and confirm receipt with the recipient.
- [ ] Repeat all checks for the remainder, even after a successful test transfer.

## Personal security checklist by risk level

The levels are cumulative. The small-holder baseline is mandatory, regardless of balance.

A compromised seed has no reset mechanism. Create a replacement wallet on a fresh, trusted device, test its recovery before funding it, transfer every asset and token, and stop using the original wallet permanently.

### Small holder, mandatory minimum

- [ ] Make a legible offline mnemonic backup and protect it from unauthorised access. Record the passphrase policy and derivation policy needed for recovery.
- [ ] Keep no digital seed copy: no photographs, screenshots, cloud files, messages or password-manager entries.
- [ ] Before funding, recover the mnemonic from your backup on a clean, trusted machine. Follow the passphrase policy and derivation policy exactly, then compare the derived address with the address recorded earlier. Funding must wait until the public outputs agree.
- [ ] Do not count an `xpub` or `zpub` import as a recovery test. Neither can restore the wallet: each can reproduce only the public descendants beneath its exported account node.
- [ ] Use a security key or authenticator for crypto and email accounts. Remove SMS two-factor authentication, including SMS fallback methods.
- [ ] Confirm payment addresses through a separate, trusted channel. Compare the entire destination address before authorising a transfer, not only its opening and closing characters.

- [ ] **Expected result:** An offline backup that passes mnemonic recovery, matching public outputs, non-SMS account protection and a full-address check before every payment.

### Serious holder

- [ ] Complete every small-holder check.
- [ ] Use hardware signing. Check the complete destination address and amount on the signer’s own display before approving a transaction.
- [ ] Use a wallet passphrase and keep its offline backup separate from the seed. Record its exact use in the recovery policy; memory is not a backup.
- [ ] Keep a complete, readable metal seed backup. Check the transcription before putting it into storage.
- [ ] Keep backup copies at separate, access-controlled locations. Do not place a passphrase backup alongside a seed backup.
- [ ] Repeat the full recovery test every quarter on clean, trusted recovery equipment. For hardware-wallet restoration, use a spare trusted signer. Record the date and outcome without recording secrets.

- [ ] **Expected result:** Hardware-verified payments, checked metal backups at separate sites, a separately recoverable passphrase and a successful recovery drill recorded for the current quarter.

### Business or treasury

- [ ] Complete every serious-holder check.
- [ ] Use multisignature across different hardware makers and physical locations. Document the signing threshold and distribute keys so that no one person or site holds a quorum. Avoid concentrating a quorum on one maker’s devices.
- [ ] Name each authorised signer and give each their own separate signing device. Keep the signer register and contact details current.
- [ ] Back up the multisignature recovery configuration as well as the individual seed backups. Test recovery of the required signing quorum and compare the expected public outputs.
- [ ] Obtain an external security review before production custody. Resolve findings that block safe custody before accepting funds.
- [ ] Run dependency and secret scanning on custody repositories and release workflows. Give findings an owner and resolve custody-critical issues before deployment.
- [ ] Maintain a written incident plan assigning named people to incident leadership, custody migration and communications. Include deputies, contact routes, escalation authority and the compromised-seed replacement procedure.

- [ ] **Expected result:** A tested signing quorum, named signers with separate devices, a completed external review, scan findings with accountable owners and an incident plan that identifies who must act.

## Incident-response playbook

### Contain first

Begin containment before attempting wallet recovery or migration.

1. Stop using any device you suspect is compromised for signing, wallet recovery and service accounts. Carry out account containment from a trusted device.
2. Revoke active sessions on affected email, exchange and other service accounts. Review their authentication and recovery options, remove SMS fallbacks where possible, and keep recovery codes offline.
3. Review withdrawal allow-lists and alerts where offered, and respond to unexpected activity.
4. Review token permissions separately from service-account sessions. Revoke unnecessary permissions using verified tools, check network fees before signing, and review the remaining permissions.

### Choose trusted-device recovery or fresh-seed migration

**Trusted-device recovery:** Choose this path for device loss or failure only when you do not suspect mnemonic or wallet-key exposure. Restore using the documented recovery configuration on your own trusted offline device. Compare the intended accounts and addresses, and execute and record a clean-install rehearsal before describing recovery as tested.

**Fresh-seed migration:** Choose this path for known or suspected exposure of the mnemonic or a wallet key. Do not treat restoration of the exposed mnemonic onto another device as fresh-seed migration.

> **Warning:** Changing the vault unlock passphrase cannot secure an exposed mnemonic. Set up a replacement wallet with a fresh mnemonic on a trusted device and migrate remaining funds using the setup and before-signing checklists; do not use the exposed mnemonic for the replacement. Confirm receipt in the intended replacement accounts.

### Escalate to the maintainers

Treat vulnerability disclosure as an open item: no disclosure channel exists in the repository. Report suspected compromise through the maintainers’ channel once containment is under way. If no maintainers’ channel is published, treat that reporting channel as an open item as well; do not assume another route is a disclosure channel.

> **Warning:** Sharing wallet or account secrets can expose funds or accounts. Keep mnemonics, passphrase values and recovery codes out of the report. Check the report for those secrets before sending it.

## What no solution prevents

Keep the residual limits in view rather than treating the combined setup as complete theft prevention.

- **Malicious authorisation and recipient dishonesty:** A hardware signer cannot stop you authorising a malicious transaction or approval, and a matching address does not establish honesty. Review transaction details and independently confirm the destination. Repeat the checks for every later transaction, even after a successful test.
- **Compromise beyond an individual layer:** Updated devices can still be compromised, browser profiles do not isolate device malware, and stolen sessions can bypass login checks. Maintain device and account controls together rather than relying on either alone. Start containment if you suspect compromise.
- **Later theft, copying or deterioration:** A successful recovery rehearsal does not prevent these losses, and losing the correct BIP-39 passphrase can strand funds. Maintain offline copies with physical access controls and keep passphrase values separate. Check the records through an executed, recorded clean-install rehearsal before treating recovery as tested.
- **Completed theft:** Revocation cannot reverse completed theft, alerts do not block transfers, and service controls cannot restrain a stolen wallet key. Review permissions and use withdrawal allow-lists where offered. Respond to alerts and follow the incident-response playbook when compromise is suspected.

## Sources

1. <https://tangem.com/en/blog/post/how-to-protect-crypto-from-phishing/>
2. <https://www.purevpn.com/blog/protect-crypto-wallet-from-malware-and-phishing-attacks/>
3. <https://lune.fi/blog/crypto-wallet-security-checklist-2026>
4. <https://coinscapture.medium.com/sim-swap-attacks-on-crypto-accounts-how-they-work-and-how-to-prevent-one-245b4c2d3f00>, checked 8 November 2026: automated checks returned HTTP 403, but a web search confirmed that the article exists.
5. <https://www.ownyouronline.govt.nz/personal/get-protected/guides/protect-yourself-against-sim-swapping/>, New Zealand government guidance, verified live 8 November 2026.
6. <https://cryptowatchdog.net/blog/sim-swap-scams-the-phone-based-threat-that-can-empty-your-crypto-wallet-2026-05-20>
7. <https://coinspaid.com/knowledge-base/hot-wallet-hacks-and-risks/>, checked 8 November 2026: automated checks returned HTTP 403, but a web search confirmed that the article exists.
8. <https://www.bitgo.com/research/fool-me-twice-ledger-tokenized-repo-and-finks-worldview/>
9. <https://dev.to/etairos/ledger-finds-lte-seed-stealing-implant-in-wallets-sold-by-cryptobilis-86m-drained-2jd2>
10. <https://in.tradingview.com/news/cryptobriefing:1f9fabb84094b:0-bitcoin-hardware-wallet-hacks-force-a-rethink-of-self-custody/>
11. <https://academy.oaksecurity.io/pdf/hardware-wallet-signing-device-setup-guide.pdf>
12. <https://strike.me/gb/en/learn/how-do-i-protect-my-private-keys/>
13. <https://www.cryptocurrencyhongkong.com/en/news/safeguarding-your-assets-33-practical-measures>
14. <https://rootcrak.com/blog/sim-swap-crypto-2026.html>
15. [Trezor — What is a passphrase?](https://trezor.io/guides/backups-recovery/advanced-wallets/what-is-a-passphrase)

Source check (2026-11-08): the Vajra1 article and site home returned HTTP 500, as did the tested URL and browser User-Agent variants, WordPress REST API and feed; both citations have been replaced with Trezor's passphrase guide, verified live that day.

