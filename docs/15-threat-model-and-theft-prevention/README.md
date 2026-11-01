
# 15 Threat model and theft prevention

Bawa works with wallet recovery material and needs careful handling. This page covers two theft risks, their warning signs and what to do after exposure. See [docs/SECURITY.md](../SECURITY.md) for the wider threat model, trust boundaries, secret-handling rules and known limitations.

**Whoever holds the seed phrase or private key controls the wallet.** No legitimate service, support agent or wallet maker ever asks you to hand it over.

## 15.1 Seed-phrase phishing

- **How it works and who it targets:** Fake wallet sites, cloned apps and bogus support messages persuade wallet holders to reveal recovery material. People restoring wallets or looking for help are particularly exposed.
- **Likelihood and impact:** This is a common scam. Disclosure can mean losing every asset controlled by the exposed seed or key; confirmed transfers are generally irreversible.
- **Warning signs:** Unsolicited support messages, urgent warnings, lookalike web addresses, or requests for a seed phrase to “verify” or “unlock” a wallet.
- **Prevention:** Use independently verified wallet and support addresses. Never send recovery material through chat, email or screenshots. Only enter it for a restoration you initiated in verified wallet software, not through a support link.
- **Recovery:** Treat any disclosed seed or key as permanently compromised. On a clean, trusted device, use verified software to create a new wallet with a fresh seed and move any remaining assets promptly. Retire the compromised wallet. Changing its password does not protect an exposed seed.

## 15.2 Fake wallet apps and browser extensions

- **How it works and who it targets:** Malicious apps and extensions imitate genuine wallets and can expose secrets entered or created in them. They target people installing, updating or restoring a wallet.
- **Likelihood and impact:** The risk rises with unverified downloads and advert links. A fake wallet can compromise recovery material, putting all funds in the affected wallet at risk.
- **Warning signs:** Lookalike names, an unexpected publisher, unexplained permissions or low download counts for a supposedly established wallet. Low counts warrant extra checks, not an automatic verdict; popularity and favourable reviews do not prove safety.
- **Prevention:** Start from the wallet maker’s independently verified website and follow its store links. Check the publisher and requested permissions. Avoid wallet extensions you do not need, and do not treat an app-store listing as a security guarantee.
- **Recovery:** Stop wallet activity on the affected device. If secrets may have been exposed, follow the fresh-wallet recovery steps above using a separate, trusted device. Remove and report the fake software to the store. Clean or rebuild the affected device before using it for wallets again; uninstalling alone cannot protect an exposed key.

Keep seed phrases, private keys, all private extended keys, recovery data keys, production `.env` files, wallet backups, credentials and API secrets out of anything public. Report Bawa vulnerabilities privately to the repository maintainers rather than publishing exploit details.

## Sources

- https://tangem.com/en/blog/post/how-to-protect-crypto-from-phishing/
- https://www.purevpn.com/blog/protect-crypto-wallet-from-malware-and-phishing-attacks/

### Social engineering

- **How it works and who it targets:** Impersonators posing as support staff or community admins pressure wallet users and operators into revealing secrets or authorising payments. Fake giveaways, bogus airdrops and drainer links appear in Discord and Telegram messages, sometimes from compromised, familiar accounts. [1]
- **Likelihood and impact:** Expect attempts in public crypto communities. A successful deception can expose recovery material, take funds or reveal private account activity.
- **Detection signs:** Unsolicited help, urgent deadlines, requests to “validate” a wallet, pay-to-claim demands or unexpected signing prompts.
- **Prevention:** Find support through independently verified channels. Ignore unsolicited claim links. Never share wallet secrets or upload recovery files to support chats. Do not sign requests you cannot explain and independently verify.
- **Recovery:** Stop contact and signing. Secure affected accounts from a clean device; revoke sessions and malicious spending approvals where applicable. If wallet secrets escaped, create a replacement wallet and recovery set offline, then move remaining funds using a trusted signing setup. Changing an account password does not repair exposed keys.

### SIM swap

- **How it works and who it targets:** A carrier account takeover can redirect your number, so someone else receives SMS codes and phone-based account recovery messages. It targets people whose email or exchange access depends on that number. [2, 3]
- **Likelihood and impact:** This is a credible risk while SMS remains a login or recovery route. It can lead to email takeover, account lock-out and loss of exchange-held funds. Control of a SIM alone cannot reveal an offline seed or sign a self-custody payment.
- **Detection signs:** Unexplained loss of mobile service, unexpected SIM/eSIM or number-transfer notices, and unrequested login or password-reset messages.
- **Prevention:** Prefer passkeys or security keys for email and exchanges; use an authenticator app if those are unavailable. Remove SMS recovery fallbacks where supported. Set a carrier **account** PIN and enable port-out and SIM-change locks where offered. Keep recovery codes offline.
- **Recovery:** From a clean device using known support routes, ask the carrier to secure and restore the number and the exchange to freeze withdrawals. Secure email, revoke affected sessions, and replace compromised passwords, authentication factors and recovery settings. A SIM swap alone is not evidence that the wallet seed needs replacing.

### Address poisoning and clipboard hijacking

- **How it works and who it targets:** A misleading transaction-history entry presents an address resembling a genuine recipient. It targets people who reuse addresses from history. Clipboard hijacking is related: malware substitutes a different destination when an address is copied and pasted. [1]
- **Likelihood and impact:** A realistic payment risk, especially when only an address’s beginning and end are checked. A confirmed payment to the wrong address has no wallet-level undo.
- **Detection signs:** Unexplained history entries, near-matching addresses, or differences between the intended destination, pasted value and signing display.
- **Prevention:** Do not use transaction history as an address book. Obtain recipient details through a separate trusted channel. Compare the **whole address**, network and amount in the trusted signing environment; the online screen and matching first or last characters are not proof.
- **Recovery:** Pause payments on any mismatch. Isolate and rebuild a device showing clipboard substitution before reusing it. If funds were sent, preserve the transaction ID and contact an identifiable receiving service through its official channel; recovery is not guaranteed. History spam alone does not establish that keys have leaked.

## Trust boundary

We assume the online application may be observed, logged, restarted or compromised. Seed material never enters the watch-only runtime.

Highest-sensitivity handling covers the BIP-39 mnemonic and passphrase, private keys and extended private keys, the recovery data key, and encrypted recovery artefacts awaiting controlled backup. Keep these out of the runtime; controlled backup is a separate workflow. Account xpub/zpub values, derived address inventories and payment/order links remain privacy-sensitive, despite lacking signing authority.

```text
[Offline: seed and signer; verify payment details here]
                         |
======== TRUST BOUNDARY: no wallet secrets to runtime ========
                         |
[Online: watch-only; public account and activity data]
                         |
[Surrounding accounts: email, carrier, exchange]
```

## Sources

1. https://lune.fi/blog/crypto-wallet-security-checklist-2026
2. https://coinscapture.medium.com/sim-swap-attacks-on-crypto-accounts-how-they-work-and-how-to-prevent-one-245b4c2d3f00
3. https://cryptowatchdog.net/blog/sim-swap-scams-the-phone-based-threat-that-can-empty-your-crypto-wallet-2026-05-20

# 15 Threat model and theft prevention

## Malware on the holder’s machine

- **How it works and who it targets:** Keyloggers, clipboard hijackers, infostealers and abused remote-access tools threaten holders generating, recovering or using wallets on an infected machine. Malicious downloads, including cracked software and counterfeit extensions, can introduce them. Secrets may be copied or payment addresses replaced. [1]
- **Likelihood and impact:** More likely with untrusted downloads on a daily-use machine; theft can cause permanent loss of all wallet funds.
- **Detection signs:** Addresses changing after pasting, unfamiliar extensions, unexpected remote sessions or malware alerts. An absence of warnings does not establish that the machine is clean.
- **Prevention:** Prefer a dedicated, patched device and verified downloads. Avoid cracked software, minimise extensions and check payment details on an independent trusted display. Encryption at rest protects stored ciphertext, not plaintext during mnemonic generation or recovery. JavaScript and WebAssembly memory handling offers no cryptographic guarantee of perfect zeroisation.
- **Recovery:** Disconnect the affected machine. Generate a fresh wallet and move remaining funds using a separate, trusted environment. Do not reuse the exposed mnemonic. Rebuild the infected machine and rotate other exposed credentials.

## Supply-chain compromise

- **How it works and who it targets:** Tampered dependencies, malicious updates and fake releases threaten both maintainers and holders. Public reports describe physically tampered hardware wallets bought through a reseller rather than directly from the maker: a hidden implant captured the recovery phrase shown on screen during setup. [2, 3]
- **Likelihood and impact:** A credible risk through unverified distribution routes; a compromised component can expose funds belonging to many holders.
- **Detection signs:** Unexplained dependency changes, signature or checksum failures, or altered device seals and casing. Hidden tampering may leave no obvious sign.
- **Prevention:** Buy hardware direct from the maker and verify the device using the maker’s guidance. **A successful genuine-check alone does not prove that a device was never opened.**

  Bawa pins Trust Wallet Core to an exact, tested package version. `bip_utils` is also pinned and is used only for independent verification. A version range does not establish a tested dependency graph. Before a production release, commit the lockfile produced by a clean install. Run dependency and secret scanning in CI and release workflows. Prefer signed or tagged upstream releases; record release checksums and provenance where practical.
- **Recovery:** Stop affected releases, quarantine suspect devices or packages, and notify affected holders. Rebuild from independently verified inputs. Treat mnemonics handled by compromised software or hardware as exposed; move remaining funds to freshly generated wallets using a separate, trusted environment.

## Weak generation and weak entropy

- **How it works and who it targets:** Holders using untrusted or flawed generation software may receive predictable or already-known seeds. A short or guessable mnemonic passphrase adds little protection if the mnemonic leaks. Re-encrypting backups cannot repair these weaknesses. Changing the mnemonic or its passphrase creates different keys; it does not secure funds at existing addresses.
- **Likelihood and impact:** A real risk with flawed generators or predictable secrets. Funds can be lost permanently even when the wallet appears to work normally.
- **Detection signs:** Pre-supplied recovery phrases, unexplained randomness sources, published generator flaws, or passphrases based on reused passwords or personal details. Neither a valid mnemonic nor agreement between derivation libraries proves sound entropy.
- **Prevention:** Use reviewed generation software with cryptographically secure randomness. If using a mnemonic passphrase, choose a long, randomly generated one. Public guidance recognises additional entropy from the holder’s own private dice rolls, incorporated during generation through a documented, reviewed method. [4] This is not a repair for existing keys, and dice cannot make malicious software trustworthy.
- **Recovery:** Generate an entirely new wallet in a trusted environment with fresh, securely generated entropy and a strong passphrase if used. Move remaining assets and stop using the old addresses. Do not reuse the suspect mnemonic.

Bawa requires an external security review before it can be treated as production custody infrastructure.

## Sources

1. https://coinspaid.com/knowledge-base/hot-wallet-hacks-and-risks/
2. https://www.bitgo.com/resources/blog/fool-me-twice-ledger-tokenized-repo-and-finks-worldview/
3. https://dev.to/etairos/ledger-finds-lte-seed-stealing-implant-in-wallets-sold-by-cryptobilis-86m-drained-2jd2
4. https://in.tradingview.com/news/cryptobriefing:1f9fabb84094b:0-bitcoin-hardware-wallet-hacks-force-a-rethink-of-self-custody/

## 15 Threat model and theft prevention

Bawa keeps wallet secrets in a dedicated directory with restrictive permissions. Encrypted artefacts are written atomically with mode `0600`; symlinked secret paths are rejected. These controls do not protect readable copies stored elsewhere. `.env` is not a store for mnemonics or private keys. It may contain public `xpub`/`zpub` values, but these can reveal linked addresses and wallet activity.

### Physical theft and loss

- **How it works and targets:** Any holder can lose a device or paper or metal backup through theft, burglary or misplacement. Fire and flood can destroy them too. These are theft-adjacent risks because one backup in one place can be stolen or destroyed.
- **Likelihood and impact:** A realistic risk, especially for portable devices. Exposed secrets can cost all wallet funds; losing every recovery route can permanently remove access.
- **Signs:** Missing devices or backups, disturbed storage or unexplained transactions. A copied backup may leave no sign.
- **Prevention:** Lock and encrypt devices. Keep physically secured offline backups in separate locations, with suitable fire and water protection.
- **Recovery:** Restore from an intact backup on a trusted replacement. If secrets might be exposed, move remaining funds to a wallet with a newly generated seed.

### Cloud backup and digital-copy leaks

- **How it works and targets:** Holders who put readable seeds in photos, screenshots, notes apps, email or cloud drives expose them to account compromise and automatic syncing. One account takeover can then expose the wallet.
- **Likelihood and impact:** More likely with unnoticed synced copies or weak account protection. A leaked seed puts all funds it controls at risk.
- **Signs:** Unrecognised account sessions, changed sharing settings or secret-bearing copies appearing on another device.
- **Prevention:** Keep recovery backups offline and exclude Bawa’s secret directory from automatic sync.
- **Recovery:** On a trusted device, move remaining funds to a wallet with a newly generated seed. Change the account password, end other sessions and remove copies, including deleted items. Deletion does not make an exposed seed safe again.

### Exchange and custody failure

- **How it works and targets:** Users of exchanges, custodial services and hosted wallets where the provider holds the keys depend on that provider. Business failure, freezes or breaches can block withdrawals or lose funds.
- **Likelihood and impact:** Possible even with an established provider. The entire custodial balance may become inaccessible or be lost.
- **Signs:** Blocked withdrawals, unexplained balance changes or independently confirmed incident notices.
- **Prevention:** Minimise custodial balances. Self-custody changes who bears the risk: you become the custodian, responsible for protecting keys, maintaining backups and avoiding unsafe signing.
- **Recovery:** Secure the account through verified channels, withdraw available funds to a wallet you control and retain records for support or formal claims. Full recovery may not be possible.

### Malicious transaction approval and blind signing

- **How it works and targets:** Token-app users can authorise a spender to use tokens later. An unlimited allowance can expose that token’s balance, including later deposits. Any holder can authorise unwanted transfers by signing a transaction they have not read on a trusted screen.
- **Likelihood and impact:** More likely with hurried or unclear requests. Funds can be lost even while the seed remains secret.
- **Signs:** Unknown spenders, unexpected unlimited allowances, requests for blind signing or unexplained token transfers.
- **Prevention:** Limit allowances to the amount needed. Read the action, recipient or spender, asset and amount on a trusted signing-device screen—not just the website. If those details cannot be shown clearly, do not sign.
- **Recovery:** Revoke suspect approvals through an independently verified tool and move at-risk funds if necessary. If keys also leaked, migrate to a wallet with a newly generated seed. Revocation cannot undo confirmed transfers.

### Prevention summary

| Threat | Single most important prevention step |
| --- | --- |
| Physical theft and loss | Keep secured offline backups in separate locations. |
| Cloud backup and digital-copy leaks | Keep readable seed backups out of synced digital storage. |
| Exchange and custody failure | Minimise balances left with custodians. |
| Malicious transaction approval and blind signing | Verify what each request authorises on a trusted signing-device screen before signing. |
| Phishing | Use independently verified, bookmarked service addresses rather than message links. |
| Fake apps | Obtain wallet apps through the project’s independently verified official release channel. |
| Social engineering | Never disclose a seed or private key, regardless of who asks. |
| SIM swap | Use account authentication and recovery that do not depend on a phone number. |
| Address poisoning | Check the entire destination address against an independently confirmed recipient address. |
| Malware | Keep signing keys isolated on a trusted hardware signing device. |
| Supply-chain compromise | Verify the provenance and integrity of wallet software and signing devices before use. |
| Weak generation | Let a trusted wallet generate the seed using cryptographically secure randomness. |

### Sources

- https://academy.oaksecurity.io/pdf/hardware-wallet-signing-device-setup-guide.pdf

## Fixes mapped to threats

See **signing and hardware** for signer setup and **security and recovery** for recovery procedures.

The recovery record must contain the mnemonic, the exact BIP-39 passphrase policy, chain derivation paths and address policy, account, network and chain configuration, and TON wallet configuration where applicable. Record any passphrase value separately.

### FREE fixes

These require effort rather than a security-product purchase. Transfers and on-chain revocations may still incur network fees; check before signing.

| Fix and threats covered | Effort and limit |
| --- | --- |
| **[Offline paper backup](https://strike.me/gb/en/learn/how-do-i-protect-my-private-keys/)** — device loss, disaster, online backup leakage. | Make Bawa’s required 2–3 offline copies in places without a shared fire or flood risk. Record physical access controls for each. **Limit:** paper remains vulnerable to damage and copying. |
| **Test recovery before funding** — incomplete records, wrong passphrase or derivation settings. | Rehearse recovery on your own trusted offline device; compare the intended accounts and addresses. **Limit:** a successful rehearsal does not prevent later theft or deterioration. |
| **[Device and software hygiene](https://www.cryptocurrencyhongkong.com/en/news/safeguarding-your-assets-33-practical-measures)** — malware, malicious downloads, known vulnerabilities. | Verify download provenance, update supported operating systems, applications and firmware, and remove unused software. **Limit:** an updated device can still be compromised. |
| **Separate browser profile, minimal extensions** — extension snooping and session cross-contamination. | Dedicate a profile to tracking and service accounts; remove non-essential extensions. **Limit:** profiles are not an isolation boundary against device malware. |
| **[Authenticator-app or passkey two-factor authentication instead of SMS](https://rootcrak.com/blog/sim-swap-crypto-2026.html)** — SIM-swap-assisted account takeover and stolen passwords. | Protect email and exchange accounts; remove SMS fallbacks where possible and save recovery codes offline. **Limit:** app codes remain phishable; stolen sessions can bypass login checks. |
| **[Carrier PIN and port-out lock](https://medium.com/@truongnt87/how-can-i-protect-myself-from-sim-swapping-attacks-crypture-org-27ac77e6f487)** — unauthorised SIM replacement and number transfer. | Set a distinct carrier account PIN, request a port-out lock and review recovery arrangements. **Limit:** carrier procedures can still be abused. |
| **Withdrawal allow-lists and alerts, where offered** — account takeover and unexpected withdrawals. | Allow only verified destinations; configure alerts and respond to them. **Limit:** alerts do not block transfers, and these service controls cannot restrain a stolen wallet key. |
| **Approval review and revocation** — malicious or forgotten token allowances. | Inspect spender, token and amount before approval; review existing permissions and revoke unnecessary ones using verified tools. **Limit:** revocation cannot reverse completed theft. |
| **Full address verification before sending** — clipboard substitution and wrong destinations. | Compare every character on the trusted signer against an independently confirmed destination; check network and any memo/tag. **Limit:** a matching address does not establish the recipient’s honesty. |
| **Small test transfer first** — destination, network or receiving-configuration mistakes. | Send a small amount, confirm receipt with the recipient, then repeat all checks for the remainder. **Limit:** success does not validate later addresses, transactions or contract interactions. |

### PAID fixes

For equipment or services, the cost is whatever the vendor charges; check current pricing and ongoing fees. A passphrase itself is free to create; separate protected storage may not be.

| Fix and threats covered | Setup effort and limit |
| --- | --- |
| **Hardware signing device bought directly from the maker** — online key extraction and some supply-chain exposure. | Initialise it yourself, verify firmware and inspect transaction details on its display. **Limit:** it cannot stop you authorising a malicious transaction or approval. |
| **Metal seed backup** — fire, water and paper deterioration. | Check the recorded words and legibility; retain physical access controls. **Limit:** durability varies, and metal does not prevent someone reading or copying it. |
| **Second signing device** — signer loss or failure. | Recover and test the spare, then secure it separately. **Limit:** duplicating the same key provides availability, not multisignature protection; either copy can expose the wallet. |
| **[Passphrase kept separate from the seed](https://vajra1.com/passphrases-backups-and-firmware-real-world-security-for-hardware-wallets/)** — theft of a mnemonic backup alone. | Record the exact BIP-39 policy; keep the passphrase value apart from every seed backup and test recovery. **Limit:** weak passphrases can be guessed; losing the correct value can strand funds. |
| **Multisignature across devices from different makers** — compromise of one key, device or maker. | Check chain support; use independent keys and separated backups. Record the threshold, cosigner public keys and recovery procedure. **Limit:** shared custody or common compromised software can defeat that separation. |
| **For businesses: external security review and dependency and secret scanning in release workflows** — design errors, vulnerable dependencies and leaked credentials. | Commission a boundary review, automate scans and resolve findings before release. **Limit:** reviews are snapshots; scanners miss flaws and cannot certify safety. |

A compromised seed is not a password you can reset. Generate a new wallet on a fresh trusted device, move every asset and token into it, and retire the old wallet permanently.

## What a holder should NOT buy or do

- **No paid seed-recovery service.** Do not hand recovery material to an operator.
- **No cloud seed vault marketed as safe.** Marketing claims do not satisfy Bawa’s offline-backup boundary.
- **No second-hand or reseller hardware device.** Buy directly from the maker and initialise it yourself; reject pre-set recovery words.
- **No recovery software that asks for the seed outside your own device.** Recovery entry belongs on your own trusted offline device or signer, never a website, support chat, remote session or online tracker.

## A layered setup

The online application may be monitored, logged, restarted or compromised. It must never receive seed material.

An xpub normally provides no spending authority, but exposes addresses, balances, payment history and relationships. Treat xpubs as watch-only secrets, not ordinary public configuration.

```text
TRUSTED OFFLINE GENERATION AND BACKUPS
[MNEMONIC]
[SEED]
[PRIVATE_MATERIAL]
2–3 separated offline recovery copies
Export account-level public roots only

SEPARATE SIGNING TRUST DOMAIN
[PRIVATE_KEY] or hardware wallet
    |
    v
Sign transaction
    |
    v
Broadcast the signed transaction afterwards

ONLINE WATCH-ONLY TRACKER
Receives account-level public roots
Holds [ACCOUNT_XPUB] or [ADDRESSES] only
    |
    v
Derives addresses from public roots
    |
    v
Queries RPC or an indexer

LOCKED-DOWN SERVICE AND EMAIL ACCOUNTS
Authenticator-app or passkey two-factor authentication
Carrier PIN and port-out lock
Withdrawal allow-lists and alerts where offered
```

## Sources

- https://strike.me/gb/en/learn/how-do-i-protect-my-private-keys/
- https://vajra1.com/passphrases-backups-and-firmware-real-world-security-for-hardware-wallets/
- https://www.cryptocurrencyhongkong.com/en/news/safeguarding-your-assets-33-practical-measures
- https://medium.com/@truongnt87/how-can-i-protect-myself-from-sim-swapping-attacks-crypture-org-27ac77e6f487
- https://rootcrak.com/blog/sim-swap-crypto-2026.html

## Personal security checklist by risk level

The levels are cumulative. The small-holder baseline is mandatory, regardless of balance.

A compromised seed has no reset mechanism. Create a replacement wallet on a fresh, trusted device, test its recovery before funding it, transfer every asset and token, and stop using the original wallet permanently.

### Small holder — mandatory minimum

- [ ] Make a legible offline mnemonic backup and protect it from unauthorised access. Record the passphrase policy and derivation policy needed for recovery.
- [ ] Keep no digital seed copy: no photographs, screenshots, cloud files, messages or password-manager entries.
- [ ] Before funding, recover the mnemonic from your backup on a clean, trusted machine. Follow the passphrase policy and derivation policy exactly, then compare the derived address with the address recorded earlier. Funding must wait until the public outputs agree.
- [ ] Do not count an `xpub` or `zpub` import as a recovery test. Neither can restore the wallet: each can reproduce only the public descendants beneath its exported account node.
- [ ] Use a security key or authenticator for crypto and email accounts. Remove SMS two-factor authentication, including SMS fallback methods.
- [ ] Confirm payment addresses through a separate, trusted channel. Compare the entire destination address before authorising a transfer, not just its opening and closing characters.

- [ ] **You should see:** An offline backup that passes mnemonic recovery, matching public outputs, non-SMS account protection and a full-address check before every payment.

### Serious holder

- [ ] Complete every small-holder check.
- [ ] Use hardware signing. Check the complete destination address and amount on the signer’s own display before approving a transaction.
- [ ] Use a wallet passphrase and keep its offline backup separate from the seed. Record its exact use in the recovery policy; memory is not a backup.
- [ ] Keep a complete, readable metal seed backup. Check the transcription before putting it into storage.
- [ ] Keep backup copies at separate, access-controlled locations. Do not place a passphrase backup alongside a seed backup.
- [ ] Repeat the full recovery test every quarter on clean, trusted recovery equipment. For hardware-wallet restoration, use a spare trusted signer. Record the date and outcome without recording secrets.

- [ ] **You should see:** Hardware-verified payments, checked metal backups at separate sites, a separately recoverable passphrase and a successful recovery drill recorded for the current quarter.

### Business or treasury

- [ ] Complete every serious-holder check.
- [ ] Use multisignature across different hardware makers and physical locations. Document the signing threshold and distribute keys so that no one person or site holds a quorum. Avoid concentrating a quorum on one maker’s devices.
- [ ] Name each authorised signer and give each their own separate signing device. Keep the signer register and contact details current.
- [ ] Back up the multisignature recovery configuration as well as the individual seed backups. Test recovery of the required signing quorum and compare the expected public outputs.
- [ ] Obtain an external security review before production custody. Resolve findings that block safe custody before accepting funds.
- [ ] Run dependency and secret scanning on custody repositories and release workflows. Give findings an owner and resolve custody-critical issues before deployment.
- [ ] Maintain a written incident plan assigning named people to incident leadership, custody migration and communications. Include deputies, contact routes, escalation authority and the compromised-seed replacement procedure.

- [ ] **You should see:** A tested signing quorum, named signers with separate devices, a completed external review, scan findings with accountable owners and an incident plan that identifies who must act.

# 15 Threat model and theft prevention

## Incident-response playbook

Act promptly: someone with signing access can move funds before you do. Work from trusted equipment; do not expose the replacement wallet during recovery.

### Compromised seed

1. Assume every asset is at risk. There is no way to change or revoke that seed.
2. Generate a new wallet on a fresh trusted device. Secure its new backup.
3. Move every asset and token. Check every chain, account and token for remaining balances, including staked or locked positions whose exit must be arranged.
4. Retire the old wallet permanently. Never re-fund it or reuse its seed.

### Stolen device

1. For a stolen phone or laptop, first request a remote lock and block its SIM, if present. Revoke email and custodial sessions from trusted equipment. If it held signing keys or seed backups, follow the seed procedure too.
2. For a stolen signing device, prioritise migration rather than account locks. A PIN may delay access to a locked device; it cannot protect a copied seed or an already unlocked signer.
3. A strong wallet passphrase kept off the stolen device may still protect the wallet derived with it. It does not help if disclosed or the thief can already sign.
4. For a stolen signer, recover the old wallet from your backup on trusted equipment, then migrate using the seed procedure above. Restoring the old wallet is not creating a replacement.

### Phishing exposure

1. If a seed went into a website or to fake support, start the seed procedure immediately. Changing passwords or deleting messages cannot contain that exposure.
2. If only a password leaked, change it wherever reused, revoke sessions and secure recovery methods and multi-factor authentication (MFA). Start with email if it is affected.
3. If only a token approval was granted, revoke it on the relevant chain and review transactions. Disconnecting a site is not revocation.

Password-only or approval-only exposure is narrower than seed compromise. It can still cost the affected account’s funds or every asset within an approval’s scope.

### Suspected malware

1. Stop signing. Isolate the affected signing or everyday machine from networks and connected devices. Enter no recovery secrets on it.
2. Use separate, fresh trusted equipment for recovery. If signing secrets may have leaked, follow the seed procedure.
3. Rebuild the computer from verified installation media, or replace suspect signing hardware. Create no new wallet on the affected machine until trust has been re-established.

### Exchange or custodial account takeover

1. Secure the carrier account first: report any unauthorised SIM swap or port-out, recover the number and block further changes.
2. Recover and secure email: change its password, revoke sessions and restore MFA the attacker cannot use.
3. Contact the exchange through a known official channel to freeze withdrawals. Recover access, revoke sessions and API keys, reset credentials and MFA, and review activity.

An exchange takeover alone does not compromise a self-custodied wallet: the exchange does not hold that wallet’s signing keys. Investigate any shared device or email compromise separately.

If an incident points to a Bawa vulnerability, contact the repository maintainers through a private disclosure channel. Keep exploit details out of public posts.

## What no solution prevents

We cannot make handing over the seed safe. A flawed generator you cannot inspect can produce unsafe keys; a physically tampered device can undermine its protections. A forgotten passphrase can block recovery, an untested backup can fail when needed, and a transaction signed without reading can authorise theft.

Hardware wallets do not remove every operational risk. Publishing source code does not mean it has been audited, and an audit cannot rule out implementation mistakes. Preserve the wallet’s derivation policy: having the seed alone is not a recovery guarantee.

These layers aim to make theft harder and less likely, not to guarantee safety. You remain the custodian.
