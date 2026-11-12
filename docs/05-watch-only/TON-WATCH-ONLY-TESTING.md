# TON watch-only testing: wallet options, compatibility evidence, safe procedure

Status: `DOCUMENTED_NOT_TESTED` for the GUI watch-only import (no desktop
browser on the test VM; no GUI import was performed). The `@ton/ton`
address reconstruction in §6 was re-verified first-hand on 2026-11-12.
Lane T24, base tip `981d0ba`. This document does not claim a working GUI
withdrawal route. M-39 stays OPEN.

## 1. Scope and verdict

Bawa generates one TON deposit address per wallet and cannot send TON.
Withdrawal needs external software. This document evaluates
TON-compatible wallets for **watch-only** testing only: adding the
public deposit address to monitor balance and activity, without entering
a seed phrase or private key. Watch-only cannot send, sign, or withdraw.
It only reads public chain data.

Verdict in one line: **MyTonWallet is the best-evidenced watch-only
option** (official "View Any Address" feature since v3.6); **Keeper
(ex-Tonkeeper) has had watch-only since v4.0.0** but its exact current
menu path is unconfirmed; **Trust Wallet documents view-only import but
TON in that flow is unconfirmed**; **Tonhub watch-only is unconfirmed**.
No seed-import route is confirmed to reproduce Bawa's TON address —
every candidate is conditional on contract version and wallet ID (§3).

Fixture address used throughout (published Trust Wallet Core test
vector, docs/02-chains §6 — an unfunded test address, no real funds):

```text
UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn
```

Bawa's TON profile: BIP-39 seed; path `m/44'/607'/0'`; Ed25519; contract
Wallet V4 R2; wallet ID / subwallet `698983191` (0x29A9A317); workchain 0.

## 2. Version-pinned wallet options

Versions pinned 2026-11-12. "Watch-only" means address-only import.
"Evidence" is what was actually checked, not a claim about the app.

| Wallet | Version pinned (2026-11-12) | Watch-only | Evidence |
|---|---|---|---|
| MyTonWallet | v26.11.1, released 2026-11-11 (GitHub releases, mytonwallet-org/mytonwallet) | **Yes** — "View Any Address" since My Wallet v3.6 | Official blog: "Add any TON or TRON wallet by address and track balances and activity directly in the app. You can also enable notifications for wallets across TON." (mytonwallet.io blog). A 2026-04-25 planning doc in the repo describes view-wallet import as current web behaviour. Platforms: desktop apps, browser extensions, iOS, Android. |
| Keeper (ex-Tonkeeper) | Android 26.11.0, uploaded 2026-11-02 (APKMirror); renamed from Tonkeeper September 2026 | **Yes, since Tonkeeper 4.0.0** (March 2024) | Official Telegram news channel (Tonkeeper 4): "add watch-only wallets to keep keys outside the device or watch popular addresses." Third-party setup guide describes an "add a Watch Account" choice at wallet creation. **Exact current menu path UNCONFIRMED** — record the actual path found during testing, do not assume one. |
| Trust Wallet | App version not pinned (no version-specific evidence checked) | View-only import documented; **TON in that flow UNCONFIRMED** | Official Trust Wallet support: wallet name → Add Wallet → Add Existing Wallet → choose network → enter public address or scan QR → name → Confirm. Send/Swap/Receive disabled. The documented examples are Ethereum, Polygon, BNB Smart Chain; TON is not named. |
| Tonhub | No version pinned | **UNCONFIRMED** | No watch-only evidence found in official or third-party sources checked. Tonhub defaults to Wallet v4 (§3). |
| Telegram Wallet / TON Space | Not evaluated | Out of scope | Custodial Wallet is not a self-custody route; TON Space seed export exists but no watch-only evidence was checked. Do not use custodial flows for this test. |

Notes:

- Tonkeeper was renamed **Keeper** on 2026-09-15 and expanded from TON
  to seven networks (TON, Bitcoin, Ethereum, TRON, BNB Chain, Arbitrum,
  Base). The app is listed as "Keeper" in the stores;
  keeperwallet.com/download is the official download page. Older
  guides saying "Tonkeeper" refer to the same app.
- Toncoin was renamed **Gram (GRAM)** on 2026-06-15; the blockchain is
  still TON. Older material saying "Toncoin" means the same asset.
- MyTonWallet's blog version "v3.6" is the app's own numbering at the
  time of that post; the repository's release tags (v26.11.1) use a
  different scheme. Both are quoted as published; they are not the
  same number.

## 3. Seed import: derivation compatibility (why watch-only is the safe test)

A TON wallet is a smart contract. One seed phrase gives a **different
address per contract version** (V3R2, V4R2, W5/v5R1), and the wallet ID
also changes the address. The fixture proves the wallet-ID point:
`@ton/ton` 16.3.0 with the same public key gives the fixture address
with wallet ID 698983191 and a different address with wallet ID 0 (§6).
A balance on one version is invisible while another version is selected.

| Wallet | Can seed import reproduce Bawa's address in principle? | What the tester must check |
|---|---|---|
| Keeper | Conditional, not established. V4R2 is available, but BIP-39 import and Bawa's exact derivation are not established. | New wallets default to **W5**; V4R2 is reachable via Settings. Select V4R2 first, then compare the receiving address character-for-character with the fixture (§1). Also verify how the wallet handles a BIP-39 phrase: TON-native 24-word phrases differ from BIP-39, and importing a TON mnemonic creates a TON-only wallet with no passphrase support. |
| Tonhub | Conditional, not established. "Defaults to Wallet v4" does not establish V4R2, BIP-39 import, or the derivation parameters. | Verify the actual contract is specifically **V4R2** with wallet ID 698983191, workchain 0, path `m/44'/607'/0'`, then compare the address character-for-character. A "v4" label alone is not a pass. |
| MyTonWallet | Conditional. BIP-39 phrase acceptance is reported, but Bawa's exact derivation, V4R2 contract, and remaining parameters are not established. | Verify the import uses the **BIP-39 interpretation** of the phrase with the full profile in §1, then compare the address character-for-character. A phrase accepted with a different address is a **fail**, not a pass. |

Pre-funding rule (applies to every seed-import attempt): the wallet's
receiving address must match the fixture address in §1
character-for-character **before any funds are sent**. Import success or
a zero balance alone proves nothing. If the address differs, stop —
do not fund it, do not "try" a small transfer. Funds sent to the wrong
version address are not visible in the intended wallet.

## 4. Safe desktop watch-only test procedure

For each check record: test date, desktop OS, GUI source (official
download URL), displayed version, observed menu path, PASS/FAIL, and
the reason or exact error. **FAIL—blocked** means the test could not be
completed safely; it does not prove the feature is unsupported. Stop
that app's test when blocked. Use only the fixture address in §1; do
not add personal wallets.

1. **MyTonWallet — locate address viewing.** Open the official desktop
   app or browser extension and locate the documented "View Any Address"
   feature. Do not invent a menu path; record the actual path found.
   **PASS:** a public-address-only viewing flow is reachable.
   **FAIL—blocked:** no usable desktop GUI/flow, or the workflow
   requires keys, funding, signing, or transactions.
2. **MyTonWallet — import and inspect.** Enter the fixture address;
   select TON if network selection is offered. Record the submitted
   address, full displayed address, mode/feature label, balance text,
   and activity text or explicit empty-history state.
   **PASS:** the fixture is accepted for address viewing, the full
   displayed address exactly matches §1, and balance/activity views load.
   **FAIL:** any criterion is unmet; record rejection, mismatch, missing
   information, or display error. An explicit zero balance or empty
   history is not itself a failure.
3. **Keeper — locate watch-only.** Repeat desktop-source and version
   recording. Keeper's exact current menu path is **UNCONFIRMED**; look
   for an explicitly watch-only, public-address flow and record the
   actual path found.
   **PASS:** that flow is reachable without keys, funding, signing, or
   transactions. **FAIL—blocked:** no usable desktop GUI/flow or any
   prohibited requirement.
4. **Keeper — import and inspect.** Enter the same fixture. Record the
   same fields and apply exactly the PASS/FAIL criteria in step 2. Keep
   Keeper's results separate from MyTonWallet's. Do not attempt a send
   to test watch-only behaviour.

Optional third check (only if the tester wants a code-level cross-check,
not a GUI result): query the fixture address on a public explorer
(tonscan.org) and confirm the same balance/activity the GUI shows. This
tests GUI readability, not independent data accuracy.

## 5. Safety rules

1. Use only the supplied fixture address; do not add personal wallets.
2. Never supply, generate, or import keys or recovery phrases for a
   watch-only test. If a watch-only flow asks for a seed phrase, stop —
   that is not a watch-only flow.
3. Do not fund anything, pay fees, sign, send, withdraw, or submit
   transactions.
4. Use only a GUI whose official provenance can be established
   (official site or store listing linked in §2); otherwise stop and
   record **FAIL—blocked**. Never install a wallet from a forwarded
   link, sponsored search result, or random APK.
5. Keep evidence limited to the fixture, public-data observations,
   interface details, and errors. Watch-only reads public data and
   cannot send.

## 6. Expert-assisted route (verified, no GUI)

`@ton/ton` reproduces the fixture address exactly from the published
public key and is the documented expert-assisted route (M-39). Re-verified
first-hand by T24 on 2026-11-12 with `@ton/ton` **16.3.0** (npm):

- Wallet V4 R2, workchain 0, wallet ID 698983191 → raw
  `0:bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f`,
  non-bounceable `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`,
  bounceable `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi` —
  all three match the fixture. Evidence:
  `bawa-fanout/T24/evidence/toncheck-16.3.0.log`.
- Same key with wallet ID 0 gives a different address
  (`0:7bd45095ff0d2ba510e995932e83d77dcf1795e5b2dbb04d2f4165e415381b0f`),
  confirming the wallet ID is load-bearing.

Related pins checked 2026-11-12 (npm registry): `@ton/crypto` 3.3.0,
`@ton/core` 0.63.1; GitHub release tag for ton-org/ton is v16.1.0
(2025-12-02) — npm is ahead of the release tag; pin by npm version.
A code-level watcher alternative exists (`@ton/watch` on JSR:
liteserver-based address watching, no API key) but was not evaluated
hands-on; it is a library, not a GUI wallet.

## 7. Limitations and blockers

- **No GUI watch-only import was performed.** The test VM has no
  desktop browser and no desktop GUI wallet was run. The procedure in
  §4 is unexecuted; its PASS/FAIL criteria are proposed, not results.
- **M-39 stays OPEN.** No GUI wallet is confirmed able to withdraw TON
  from a Bawa deposit address. Watch-only monitoring is not withdrawal:
  a successful watch-only test would confirm visibility only, never
  spending ability.
- **Menu paths are unconfirmed** for Keeper (current build) and for
  MyTonWallet's current desktop build. The v3.6 blog announces the
  feature without a menu path. Do not quote a path from this document
  as established.
- **Trust Wallet TON view-only is unconfirmed**, and Tonhub watch-only
  is unconfirmed. Absence of evidence is recorded as unconfirmed, not
  as "does not support".
- **Seed-import reproduction is conditional everywhere** (§3). The
  wallet-version trap (W5 default vs V4R2) is the most likely failure
  mode, followed by TON-phrase vs BIP-39 handling.
- Astra research calls in this lane could not browse: two calls hit the
  600-second limit with no output under the 50-lane gateway load; the
  calls that landed either could not verify (no browsing in the runner)
  or reasoned from supplied verified facts only. Wallet claims in this
  document rest on the first-hand checks in §8, not on model assertion.

## 8. Sources

- MyTonWallet official blog, "View Any Address, Instant Transfer Link
  and More" (My Wallet v3.6): https://mytonwallet.io/en/blog/view-any-address-instant-transfer-link/
- MyTonWallet releases (v26.11.1, 2026-11-11):
  https://github.com/mytonwallet-org/mytonwallet/releases/tag/v26.11.1
- Keeper News (official Telegram channel), Tonkeeper 4, March 2024
  (watch-only wallets): https://t.iss.one/s/tonkeeper_news?before=91
- Keeper Android 26.11.0, 2026-11-02 (APKMirror):
  https://www.apkmirror.com/apk/ton-apps-inc/tonkeeper/tonkeeper-4-0-0-release/
  (listing shows the 26.11.0 upload; the 4.0.0 page carries the
  watch-only changelog text)
- Trust Wallet support, "Beware of Fraudsters When Using Watch-Only
  Wallets" (view-only import steps):
  https://trustwallet.freshdesk.com/en/support/solutions/articles/67000722186-beware-of-fraudsters-when-using-watch-only-wallets
- Keeper/W5 default and V4R2 switching: Tonkeeper help-centre material
  via https://thecrypto.app/guides/track-ton-wallet and
  https://swapspace.co/blog/best-ton-wallets (both accessed 2026-11-12;
  third-party summaries of official help pages)
- BIP-39 wallet comparison (Keeper TON phrase vs BIP-39; TON from
  BIP39 path `m/44'/607'/0'`): https://bip39-phrase.com/bip39-wallets/
- npm registry, checked 2026-11-12: `@ton/ton` 16.3.0, `@ton/crypto`
  3.3.0, `@ton/core` 0.63.1
- Bawa docs: `docs/02-chains/README.md` §6 (TON fixture), `docs/mainnet/
  MAINNET-GUIDE.md` §21 M-39, `docs/05-watch-only/README.md` (no TON
  coverage — this file fills that gap for TON monitoring only).
