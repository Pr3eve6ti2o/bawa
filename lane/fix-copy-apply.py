#!/usr/bin/env python3
"""Apply Sol copy-lane outputs (fix-copy P1-P3) to the fix-copy worktree.
Exact-string replacements, each asserted to occur exactly once. No other changes."""
import sys

WT = "/home/boxd/workspace/bawa-panel-rebuild/fix-copy"

def replace_once(path, old, new, label):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    n = text.count(old)
    assert n == 1, f"{label}: expected 1 occurrence, found {n} in {path}"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.replace(old, new))
    print(f"OK {label}")

# --- P1: receive.tsx ---
recv = WT + "/apps/web/src/screens/receive.tsx"
replace_once(recv,
    "Only share this address to receive funds. Verify the address matches the one your\n"
    "        repo tools derive before accepting funds.",
    "Only share this address to receive funds. Check the address carefully before accepting funds.",
    "P1a BTC warning")
replace_once(recv,
    "This address can only receive. Withdrawing TON needs an external GUI wallet or\n"
    "          the @ton/ton expert-assisted route \u2014 see docs/05-watch-only/GUI-WATCH-ONLY-WORKFLOW.md.",
    "This address can only receive TON. To send or withdraw TON, you need an external wallet.",
    "P1b TON note")
replace_once(recv,
    "Mainnet only \u2014 this is a {config.displayName} mainnet address. Funds\n"
    "        sent on another network cannot be recovered.",
    "Mainnet only \u2014 this address is for the {config.displayName} mainnet. Funds sent on another network cannot be recovered.",
    "P1c article fix")

# --- P2: security-settings.tsx ---
sec = WT + "/apps/web/src/screens/security-settings.tsx"
replace_once(sec,
    "Signing happens offline on this device, with disposable test keys during development.",
    "Signing happens offline on this device.",
    "P2 signing line")

# --- P3: welcome.tsx ---
wel = WT + "/apps/web/src/screens/welcome.tsx"
replace_once(wel,
    '<aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-white p-4 text-sm text-muted-foreground">',
    '<aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-card p-4 text-sm text-muted-foreground">',
    "P3 aside bg-white -> bg-card")

print("ALL APPLIED")
