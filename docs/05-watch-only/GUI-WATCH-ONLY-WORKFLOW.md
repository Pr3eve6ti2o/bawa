# GUI watch-only workflow — Bawa TON

**Status: M-39 OPEN.** This document provides a workflow and evidence-capture procedure, not a verified withdrawal. It builds on [TON-WATCH-ONLY-TESTING.md](TON-WATCH-ONLY-TESTING.md), lane T24, base tip `981d0ba`. The GUI watch-only test was **NOT performed**: no desktop machine is available on the test VM. The live-browser Web run is also untested. The in-app TON import itself (Part A) is covered by Web starter unit tests (R01: address validation + import screen); only its live-browser run is still not done.

**NEVER paste a seed phrase or private key into any GUI wallet or into Bawa’s watch-only import.** Watch-only means address-only import: it can monitor balances/activity but never send, sign or withdraw. Bawa generates one TON deposit address per wallet and cannot send TON.

Use this published Trust Wallet Core test-vector address, unfunded and with no real funds:

```text
UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn
```

Bawa’s TON profile is BIP-39 seed, `m/44'/607'/0'`, Ed25519, Wallet V4 R2, wallet ID/subwallet `698983191` (`0x29A9A317`), workchain 0. This profile describes derivation, not permission to import secrets.

## Part A — in-app watch-only import (Web starter TON tab)

1. Open the Web starter in a real browser and select the **TON** tab. This live-browser procedure remains untested.
2. Paste the fixture public address into the TON address-only import field and submit. The import accepts a public address only.
3. Validation checks the friendly-address tag, workchain and CRC16 checksum; this fixture has workchain 0. These are encoding checks, not proof of ownership or spendability. If validation fails, stop and record the error.
4. On acceptance, expect a **Receive QR** and a **copy-address control**. Compare the copied address with the fixture and check that the QR refers to it. Capture the resulting screen.

This receiving/watch-only view cannot send, sign or withdraw.

## Part B — external GUI watch-only import

Use only the public fixture for these tests. Record observations, not inferred support.

### MyTonWallet

**v26.11.1 (released 2026-11-11)** is the best-evidenced watch-only option. **View Any Address** has existed since v3.6. Platforms: desktop apps, browser extensions, iOS and Android.

1. Open an official app or extension and note its installed version.
2. Locate **View Any Address** and record the actual navigation path.
3. Paste the fixture, confirm address-only viewing and inspect the address and any balance/activity shown. Compare the displayed address with the fixture; stop if secrets are requested.

record: installed version; exact menu path; what was visible; screenshot/file name.

### Keeper (ex-Tonkeeper)

**Android 26.11.0**: watch-only has existed since **4.0.0 (March 2024)**. The exact current menu path is **UNCONFIRMED**. Locate the watch-only/address-only feature without assuming a path. If found, enter the fixture and inspect the view; otherwise stop and record “not found”. Do not use seed import.

record: installed version; exact menu path found, or “not found”; what was visible; screenshot/file name.

### Trust Wallet

View-only import is documented, but **TON in that flow is UNCONFIRMED**. Locate view-only import and check whether TON is offered. Proceed with the public fixture only if TON address-only import is available; otherwise record the limitation, not a successful TON test.

record: installed version; exact menu path; what was visible, including TON availability; screenshot/file name.

### Tonhub

Watch-only is **UNCONFIRMED**. Look for address-only viewing without assuming it exists. Use the fixture only if that feature is present; stop if a seed or private key is requested. Record absence as absence, not proof of support.

record: installed version; exact menu path found, or “not found”; what was visible; screenshot/file name.

## Part C — withdrawal

**No GUI wallet is confirmed able to withdraw TON from a Bawa deposit address.** The two routes are:

1. **GUI seed-import — UNVERIFIED for every candidate.** Reproducing Bawa’s address depends on the contract version and wallet ID. This is outside the watch-only workflow, not an instruction to paste secrets. Separate owner approval is required before any attempt, especially with real material.
2. **@ton/ton expert-assisted route.** This documented route is not a GUI. It reproduced the fixture exactly from the published public key: **9/9 local checks, 2026-11-12**. Address reproduction is not withdrawal evidence.

To resolve M-39’s GUI gap, capture an exact Bawa-profile/address match, GUI version/settings/steps and an authorised successful GUI withdrawal, including transaction hash, destination and before/after balances. Obtain owner sign-off for closure. Use a separate authorised test wallet; never fund the public fixture. Watch-only screenshots and public-key reproduction alone cannot establish GUI withdrawal.

## Evidence checklist

Prospective evidence only; every row remains `Not run`.

| Step | Expected evidence | Status |
|---|---|---|
| Web TON import | Validation outcome, Receive QR, copied fixture match | Not run |
| MyTonWallet | Version, exact path, visible address/activity, screenshot/file | Not run |
| Keeper | Version, actual path or absence, visible result, screenshot/file | Not run |
| Trust Wallet | TON availability, version/path, view or limitation, screenshot/file | Not run |
| Tonhub | Feature found/not found, version/path, visible result, screenshot/file | Not run |
| Withdrawal assessment | Profile/address match, GUI send evidence, transaction hash | Not run |
| Owner review | Approval reference and M-35/M-39 closure decision | Not run |

## Blockers

- Desktop machine for the GUI watch-only test; unavailable on the test VM.
- Real browser for the untested live-browser Web run.
- Separate owner approval for any seed-import attempt and for **M-35/M-39 closure**.