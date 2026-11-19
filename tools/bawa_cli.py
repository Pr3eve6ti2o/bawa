#!/usr/bin/env python3
"""Bawa cryptocurrency development launcher.

Usage:
    python3 tools/bawa_cli.py
    python3 tools/bawa_cli.py --route "<request>"
    python3 tools/bawa_cli.py --list-routes

Main options:
    1. Create an HD Cryptocurrency Wallet
    2. Create or Configure a Watch-Only Wallet
    3. Build a Cryptocurrency Wallet Application
    4. Build Cryptocurrency Tools
    5. Security, Recovery and Development
    0. Exit

Secret rule: never capture, print, log, or store mnemonics, private keys,
data keys, xprvs, or recovery credentials. Never include them in requests.
Wallet creation and seed decryption use inherited stdio; those tools
handle their own secret prompts and output without launcher capture.
The launcher writes no log file. All subprocesses use argv lists,
never a shell.
"""

import argparse
import getpass
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent

NODE_CANDIDATES = [
    candidate
    for candidate in [
        os.environ.get("BAWA_NODE"),
        "/home/boxd/workspace/android-tooling/node22/bin/node",
        shutil.which("node"),
    ]
    if isinstance(candidate, str) and candidate
]

CHAINS = {"btc", "eth", "trx", "btc-change"}

DERIVATION_PATHS = {
    "btc": "m/84'/0'/0'/0/i",
    "eth": "m/44'/60'/0'/0/i",
    "trx": "m/44'/195'/0'/0/i",
    "ton": "m/44'/607'/0'",
}

DOCS = {
    "hd_guide": "docs/04-wallet-generation/README.md",
    "chains": "docs/02-chains/README.md",
    "verify": "docs/11-trust-wallet-and-independent-verification/README.md",
    "watch_only": "docs/05-watch-only/README.md",
    "watch_gui": "docs/05-watch-only/gui-watch-only-workflow.md",
    "watch_ton": "docs/05-watch-only/ton-watch-only-testing.md",
    "tracking": "docs/06-tracking/README.md",
    "payments": "docs/07-payment-tracking/README.md",
    "security": "docs/08-security-recovery/README.md",
    "recovery": "docs/RECOVERY.md",
    "security_md": "docs/SECURITY.md",
    "threat": "docs/15-threat-model-and-theft-prevention/README.md",
    "decisions": "docs/16-security-decision-guide/README.md",
    "hardware": "docs/09-signing-and-hardware/README.md",
    "arch": "docs/13-wallet-app-architecture/README.md",
    "impl": "docs/14-wallet-app-implementation/README.md",
    "web_guide": "docs/web-wallet/WEB-GUIDE.md",
    "android_guide": "docs/android-wallet/ANDROID-GUIDE.md",
    "mainnet_guide": "docs/mainnet/MAINNET-GUIDE.md",
    "mainnet_guards": "docs/mainnet/MAINNET-GUARDS.md",
    "index": "docs/index.md",
    "samples": "docs/sample-requests.md",
    "builder": "WALLET_BUILDER.md",
    "pay_schema": "docs/mainnet/payment-record.schema.json",
}

# Application and TON routes precede broader wallet/watch-only phrases.
# Mainnet fees precedes the generic mainnet route. Detail strings are
# display-only instructions, not shell commands executed by the launcher.
ROUTES = [
    {
        "keywords": [
            "web wallet",
            "android wallet",
            "wallet app",
            "build wallet app",
            "one-prompt",
            "one prompt",
        ],
        "title": "Build a Cryptocurrency Wallet Application",
        "kind": "tool",
        "detail": (
            'node scripts/build-wallet.mjs "<request>"\n'
            "Warning: this runs npm ci and writes under generated/."
        ),
        "command": ["node", "scripts/build-wallet.mjs", "<request>"],
    },
    {
        "keywords": ["hd wallet", "create wallet", "generate wallet", "generate a wallet", "create a wallet", "make a wallet"],
        "title": "Create an HD Cryptocurrency Wallet",
        "kind": "tool",
        "detail": (
            "python3 tools/make_wallet.py\n"
            "Runs with inherited stdio; exact YES confirmation is required."
        ),
        "command": ["python3", "tools/make_wallet.py"],
    },
    {
        "keywords": ["ton address", "ton watch-only", "ton watch only"],
        "title": "Derive the TON watch-only address",
        "kind": "tool",
        "detail": (
            'echo "<64 hex chars>" | node tools/hdwallet-gen/derive-ton.js\n'
            "Supply a 64-hex-character public key only. The launcher passes "
            "it via stdin using an argv list, without a shell."
        ),
        "command": ["node", "tools/hdwallet-gen/derive-ton.js"],
    },
    {
        "keywords": ["watch-only", "watch only", "derive address", "xpub"],
        "title": "Derive a watch-only address from an xpub",
        "kind": "tool",
        "detail": (
            'echo "<xpub>" | node tools/hdwallet-gen/derive.js '
            "<chain> <index> [branch]\n"
            "Chains: btc|eth|trx|btc-change; index: 0..2147483647.\n"
            "The launcher passes the public xpub via stdin using an argv "
            "list, without a shell; branch is optional."
        ),
        "command": [
            "node",
            "tools/hdwallet-gen/derive.js",
            "<chain>",
            "<index>",
        ],
    },
    {
        "keywords": ["generate starter", "registry profile"],
        "title": "Generate a starter for a registry profile",
        "kind": "tool",
        "detail": (
            "node scripts/generate-project.mjs <profile-id>\n"
            "Choose a profile id from registry/profiles.json."
        ),
        "command": ["node", "scripts/generate-project.mjs", "<profile-id>"],
    },
    {
        "keywords": ["payment track", "track payments", "track payment", "payment tracking", "balance track", "balance tracking", "track balances", "payment monitor", "track transactions", "transaction tracking", "monitor"],
        "title": "Payment and balance tracking guidance",
        "kind": "ai-guided",
        "detail": (
            f"{DOCS['tracking']}\n"
            f"{DOCS['payments']}\n"
            f"{DOCS['samples']}\n"
            "No standalone payment-tracker executable exists in this checkout."
        ),
        "command": None,
    },
    {
        "keywords": ["recover", "decrypt", "seed", "backup"],
        "title": "Decrypt / recover a seed bundle",
        "kind": "tool",
        "detail": (
            "python3 tools/decrypt_seed.py\n"
            "Runs with inherited stdio; the tool prompts for the data key "
            "itself. The launcher never reads or captures that key."
        ),
        "command": ["python3", "tools/decrypt_seed.py"],
    },
    {
        "keywords": ["mainnet fees", "mainnet fee", "fee quote"],
        "title": "Mainnet fee quote",
        "kind": "unavailable",
        "detail": (
            "Library-only: tools/mainnet-fees/fees.mjs\n"
            "Run: node tests/mainnet-fees.test.mjs\n"
            f"Read: {DOCS['mainnet_guide']}\n"
            "No standalone mainnet fee-quote executable is available."
        ),
        "command": None,
    },
    {
        "keywords": [
            "security",
            "sign",
            "mainnet",
            "verify",
            "run the tests",
            "run tests",
        ],
        "title": "Security, verification and safety tests",
        "kind": "tool",
        "detail": (
            "npm --prefix tools/hdwallet-gen test\n"
            "node tests/mainnet-guards.test.mjs\n"
            "node tests/mainnet-fees.test.mjs\n"
            "node tests/mainnet-signing.test.mjs\n"
            "node tests/mainnet-unsigned-tx.test.mjs\n"
            "Run each mainnet test separately for per-file pass/fail.\n"
            "[AI-GUIDED IMPLEMENTATION] No signing/broadcast path exists "
            "in this checkout. M-35 execution is NOT authorised.\n"
            f"{DOCS['security']}\n"
            f"{DOCS['mainnet_guards']}"
        ),
        "command": ["npm", "--prefix", "tools/hdwallet-gen", "test"],
    },
    {
        "keywords": ["custom", "something else"],
        "title": "Custom development request",
        "kind": "ai-guided",
        "detail": (
            f"{DOCS['index']}\n"
            f"{DOCS['samples']}\n"
            f"{DOCS['builder']}"
        ),
        "command": None,
    },
]


def route_request(request: str) -> dict | None:
    """Return independent route data for the first substring match."""
    normalized = request.strip().lower()
    if not normalized:
        return None

    for route in ROUTES:
        if any(keyword in normalized for keyword in route["keywords"]):
            matched = route.copy()
            matched["keywords"] = route["keywords"].copy()
            if route["command"] is not None:
                matched["command"] = route["command"].copy()
            return matched

    return None


def render_main_menu() -> str:
    return "\n".join(
        [
            "Welcome to Bawa! Your AI-powered cryptocurrency development guide.",
            "What would you like to create or work on?",
            "1. [EXISTING TOOL] Create an HD Cryptocurrency Wallet",
            "2. [EXISTING TOOL] Create or Configure a Watch-Only Wallet",
            "3. [AI-GUIDED IMPLEMENTATION] Build a Cryptocurrency Wallet Application",
            "4. [AI-GUIDED IMPLEMENTATION] Build Cryptocurrency Tools",
            "5. [EXISTING TOOL] Security, Recovery and Development",
            "0. Exit",
        ]
    )


def render_submenu(name: str) -> str:
    if not isinstance(name, str) or name not in ("1", "2", "3", "4", "5"):
        raise ValueError("Submenu must be one of '1', '2', '3', '4', or '5'.")

    menus = {
        "1": "\n".join(
            [
                "1. [EXISTING TOOL] Generate a new HD wallet",
                "   python3 tools/make_wallet.py",
                "   Requires exact YES confirmation; inherited stdio.",
                "2. [AI-GUIDED IMPLEMENTATION] HD wallet generation, step by step",
                "   Read:",
                f"   {DOCS['hd_guide']}",
                f"   {DOCS['chains']}",
                f"   {DOCS['verify']}",
                "   BIP-39: empty passphrase, 24 words.",
                "   Derivation paths:",
                f"   btc: {DERIVATION_PATHS['btc']}",
                f"   eth: {DERIVATION_PATHS['eth']}",
                f"   trx: {DERIVATION_PATHS['trx']}",
                f"   ton: {DERIVATION_PATHS['ton']}",
                "3. [EXISTING TOOL] Run wallet-generation tests",
                "   npm --prefix tools/hdwallet-gen test",
                "0. Back to main menu",
            ]
        ),
        "2": "\n".join(
            [
                "1. [EXISTING TOOL] Derive an address from an xpub",
                '   echo "<xpub>" | node tools/hdwallet-gen/derive.js '
                "<chain> <index> [branch]",
                "   Chains: btc|eth|trx|btc-change; index: 0..2147483647.",
                "   Public xpub via stdin; argv-based execution, no shell.",
                "2. [EXISTING TOOL] Derive the TON watch-only address",
                '   echo "<64 hex chars>" | node tools/hdwallet-gen/derive-ton.js',
                "   Public key: 64 hex chars, supplied via stdin without a shell.",
                "3. [EXISTING TOOL] Compare addresses from .env xpubs",
                "   node tools/hdwallet-gen/compare.js",
                "4. [AI-GUIDED IMPLEMENTATION] Watch-only setup guide",
                "   Read:",
                f"   {DOCS['watch_only']}",
                f"   {DOCS['watch_gui']}",
                f"   {DOCS['watch_ton']}",
                "0. Back",
            ]
        ),
        "3": "\n".join(
            [
                "1. [EXISTING TOOL] One-prompt project build",
                '   node scripts/build-wallet.mjs "<request>"',
                "   Warning: runs npm ci and writes under generated/.",
                "2. [EXISTING TOOL] Generate a starter for a registry profile",
                "   node scripts/generate-project.mjs <profile-id>",
                "   Choose ids from registry/profiles.json.",
                "3. [AI-GUIDED IMPLEMENTATION] Web wallet starter",
                "   Starter: apps/web",
                "   Read:",
                f"   {DOCS['web_guide']}",
                f"   {DOCS['impl']}",
                "4. [AI-GUIDED IMPLEMENTATION] Android wallet starter",
                "   Starter: apps/android",
                "   Read:",
                f"   {DOCS['android_guide']}",
                f"   {DOCS['impl']}",
                "5. [AI-GUIDED IMPLEMENTATION] Wallet architecture",
                "   Read:",
                f"   {DOCS['arch']}",
                "0. Back",
            ]
        ),
        "4": "\n".join(
            [
                "1. [EXISTING TOOL] Run the wallet-tool tests",
                "   npm --prefix tools/hdwallet-gen test",
                "2. [EXISTING TOOL] Validate the registry",
                "   node scripts/validate-registry.mjs",
                "3. [AI-GUIDED IMPLEMENTATION] Payment / tracking tools",
                "   No standalone payment-tracker executable exists "
                "in this checkout.",
                "   Read:",
                f"   {DOCS['tracking']}",
                f"   {DOCS['payments']}",
                "4. [UNAVAILABLE OR UNVERIFIED] Mainnet fee quote",
                "   Library only: tools/mainnet-fees/fees.mjs",
                "   Run: node tests/mainnet-fees.test.mjs",
                "   Read:",
                f"   {DOCS['mainnet_guide']}",
                "0. Back",
            ]
        ),
        "5": "\n".join(
            [
                "1. [EXISTING TOOL] Decrypt / recover a seed bundle",
                "   python3 tools/decrypt_seed.py",
                "   Inherited stdio; the tool prompts for the data key itself.",
                "2. [EXISTING TOOL] Run mainnet safety tests",
                "   node tests/mainnet-guards.test.mjs",
                "   node tests/mainnet-fees.test.mjs",
                "   node tests/mainnet-signing.test.mjs",
                "   node tests/mainnet-unsigned-tx.test.mjs",
                "   Run each file independently and report per-file pass/fail.",
                "3. [AI-GUIDED IMPLEMENTATION] Security & recovery docs",
                "   Read:",
                f"   {DOCS['security']}",
                f"   {DOCS['recovery']}",
                f"   {DOCS['security_md']}",
                f"   {DOCS['threat']}",
                f"   {DOCS['decisions']}",
                f"   {DOCS['hardware']}",
                "   No signing/broadcast path exists in this checkout.",
                "   M-35 execution is NOT authorised.",
                "4. [AI-GUIDED IMPLEMENTATION] Independent derivation verification",
                "   Read:",
                f"   {DOCS['verify']}",
                "   test/fixture-oracle.py",
                "   test/fixture-oracle-vectors.json",
                "   Published vectors only; never supply actual wallet secrets.",
                "5. [AI-GUIDED IMPLEMENTATION] Custom development request",
                "   Read:",
                f"   {DOCS['index']}",
                f"   {DOCS['samples']}",
                f"   {DOCS['builder']}",
                "0. Back",
            ]
        ),
    }
    return menus[name]


def resolve_node() -> str | None:
    """Require Node 22 from the first existing executable candidate."""
    for candidate in NODE_CANDIDATES:
        try:
            executable = Path(candidate).is_file() and os.access(
                candidate, os.X_OK
            )
        except OSError:
            executable = False
        if not executable:
            continue

        try:
            result = run_captured([candidate, "--version"], timeout=10)
        except (OSError, subprocess.SubprocessError):
            print(
                "Error: Node >=22 <23 is required; the first executable "
                "candidate could not be version-checked. Set BAWA_NODE "
                "to a working Node 22 executable.",
                file=sys.stderr,
            )
            return None

        if result.returncode == 0 and result.stdout.startswith("v22"):
            return candidate

        print(
            "Error: Node >=22 <23 is required; the first executable "
            "candidate did not report a working v22 version. Set BAWA_NODE "
            "to a Node 22 executable.",
            file=sys.stderr,
        )
        return None

    print(
        "Error: Node >=22 <23 is required; no executable Node candidate "
        "was found. Install Node 22 or set BAWA_NODE to its executable path.",
        file=sys.stderr,
    )
    return None


def tool_path(*parts: str) -> Path:
    return REPO_ROOT.joinpath(*parts)


def require_tool(rel: str, doc: str) -> Path | None:
    path = tool_path(rel)
    if path.is_file():
        return path
    print(f"unavailable in this checkout (see {doc})")
    return None


def run_captured(
    argv, input_text=None, timeout=120
) -> subprocess.CompletedProcess:
    """Capture only non-secret tool output, using an argv list."""
    if not isinstance(argv, list):
        raise TypeError("argv must be a list")
    return subprocess.run(
        argv,
        input=input_text,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def run_inherited(argv) -> int:
    """Run with inherited stdio, without collecting tool output or secrets."""
    if not isinstance(argv, list):
        raise TypeError("argv must be a list")
    return subprocess.run(argv).returncode


def show_ai_guided(title, doc_paths, notes) -> None:
    print(f"[AI-GUIDED IMPLEMENTATION] {title}")
    print("Read:")
    for doc_path in doc_paths:
        print(doc_path)
    for note in notes:
        print(note)


def ask(prompt, default=None) -> str:
    try:
        answer = input(prompt).strip()
    except EOFError:
        answer = ""
    if not answer and default is not None:
        return str(default)
    return answer


def ask_int(prompt, lo, hi) -> int | None:
    while True:
        answer = ask(prompt)
        if not answer:
            return None

        try:
            value = int(answer, 10)
        except ValueError:
            print(
                f"Enter an integer from {lo} to {hi}, "
                "or leave blank to cancel."
            )
            continue

        if lo <= value <= hi:
            return value

        print(
            f"Enter an integer from {lo} to {hi}, "
            "or leave blank to cancel."
        )


def ask_yes(prompt) -> bool:
    """Accept only the exact input YES, without case or whitespace changes."""
    try:
        return input(prompt) == "YES"
    except EOFError:
        return False


def secret_input(prompt) -> str:
    """Read public watch-only material without echo, never wallet secrets."""
    try:
        return getpass.getpass(prompt)
    except EOFError:
        return ""


# === PART B FOLLOWS: submenu handlers + main() ===

def pause() -> None:
    try:
        input("Press Enter to return to the main menu.")
    except (EOFError, KeyboardInterrupt):
        pass


def handle_hd_wallet(choice: str) -> None:
    if choice == "a":
        print(
            "Warning: this creates secrets/seed.enc.json (0600) under "
            "secrets/ (0700). It REFUSES if a wallet already exists unless "
            "--force is given. The seed phrase + data key are shown only "
            "on the controlling terminal."
        )
        if not ask_yes("Type YES to generate a new wallet"):
            print("Cancelled.")
            return
        force = ask_yes(
            "Type YES to force-regenerate and overwrite an existing wallet (--force)"
        )
        path = require_tool("tools/make_wallet.py", DOCS["hd_guide"])
        if path is None:
            return
        code = run_inherited(
            [sys.executable, str(path)] + (["--force"] if force else [])
        )
        print(f"Wallet generator exited with code {code}.")
    elif choice == "b":
        show_ai_guided(
            "HD wallet generation, step by step",
            [DOCS["hd_guide"], DOCS["chains"], DOCS["verify"]],
            [
                "Derivation paths: BTC m/84'/0'/0'/0/i, ETH m/44'/60'/0'/0/i, "
                "TRX m/44'/195'/0'/0/i, TON m/44'/607'/0'.",
                "BIP-39: empty passphrase, 24 words, 256-bit.",
                "AAD identifier: nova-shop-seed-v1.",
            ],
        )
    elif choice == "c":
        result = run_captured(
            ["npm", "--prefix", str(tool_path("tools", "hdwallet-gen")), "test"],
            timeout=300,
        )
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    else:
        print("Unknown choice.")


def handle_watch_only(choice: str) -> None:
    if choice == "a":
        chain = ask("Chain (btc/eth/trx/btc-change)").strip().lower()
        if chain not in CHAINS:
            print("Invalid chain. Choose btc, eth, trx, or btc-change.")
            return
        index = ask_int("Index (0..2147483647)", 0, 2147483647)
        if index is None:
            return
        branch = "0"
        if chain != "btc-change":
            branch = (
                ask("Branch (0 receiving, 1 change, default 0)", default="0").strip()
                or "0"
            )
            if branch not in ("0", "1"):
                print("Invalid branch: expected 0 or 1.")
                return
        xpub = secret_input("Account xpub (input hidden): ")
        if not xpub:
            return
        node = resolve_node()
        if node is None:
            return
        derive = require_tool("tools/hdwallet-gen/derive.js", DOCS["watch_only"])
        if derive is None:
            return
        argv = [node, str(derive), chain, str(index)] + (
            [branch] if chain != "btc-change" else []
        )
        result = run_captured(argv, input_text=xpub + "\n")
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if code == 0:
            address = (stdout or "").strip()
            if xpub in address or any(
                xpub[i : i + 20] in address for i in range(len(xpub) - 19)
            ):
                address = "(details withheld)"
            print("Derived address: " + address)
        else:
            print(f"Derivation failed (exit code {code}).")
            details = (stderr or "").strip()
            if details:
                if xpub in details or any(
                    xpub[i : i + 20] in details for i in range(len(xpub) - 19)
                ):
                    details = "(details withheld)"
                print(details)
    elif choice == "b":
        pubkey = secret_input(
            "Ed25519 public key, 64 hex chars (input hidden): "
        )
        if re.fullmatch(r"[0-9a-fA-F]{64}", pubkey) is None:
            print("Invalid public key: expected exactly 64 hex characters.")
            return
        node = resolve_node()
        if node is None:
            return
        derive = require_tool(
            "tools/hdwallet-gen/derive-ton.js", DOCS["watch_ton"]
        )
        if derive is None:
            return
        result = run_captured([node, str(derive)], input_text=pubkey + "\n")
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if code == 0:
            print((stdout or "").strip())
        else:
            print(f"Derivation failed (exit code {code}).")
    elif choice == "c":
        node = resolve_node()
        if node is None:
            return
        path = require_tool("tools/hdwallet-gen/compare.js", DOCS["watch_only"])
        if path is None:
            return
        result = run_captured([node, str(path)])
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    elif choice == "d":
        show_ai_guided(
            "Watch-only setup guide",
            [DOCS["watch_only"], DOCS["watch_gui"], DOCS["watch_ton"]],
            [
                "Watch-only uses public material only: xpubs and public keys, "
                "never mnemonics or private keys.",
                "TON has no xpub: one address per Ed25519 public key.",
            ],
        )
    else:
        print("Unknown choice.")


def handle_build_app(choice: str) -> None:
    if choice == "a":
        request = ask("Describe the wallet to build").strip()
        if not request:
            return
        print(
            "Warning: this runs npm ci (installs dependencies) and writes "
            "under generated/ plus a JSON report."
        )
        node = resolve_node()
        if node is None:
            return
        path = require_tool("scripts/build-wallet.mjs", DOCS["impl"])
        if path is None:
            return
        result = run_captured([node, str(path), request], timeout=600)
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    elif choice == "b":
        try:
            registry = json.loads(
                tool_path("registry", "profiles.json").read_text(encoding="utf-8")
            )
        except (OSError, UnicodeError, json.JSONDecodeError):
            print("Registry unavailable in this checkout.")
            return
        profiles = (
            registry.get("profiles", registry)
            if isinstance(registry, dict)
            else registry
        )
        if isinstance(profiles, list):
            ids = [
                profile["id"]
                for profile in profiles
                if isinstance(profile, dict)
                and isinstance(profile.get("id"), str)
                and profile["id"].strip()
            ]
        elif isinstance(profiles, dict):
            ids = [
                profile_id
                for profile_id in profiles
                if isinstance(profile_id, str) and profile_id.strip()
            ]
        else:
            ids = []
        if not ids:
            print("Registry unavailable in this checkout.")
            return
        for number, profile_id in enumerate(ids, 1):
            print(f"{number}. {profile_id}")
        number = ask_int("Profile number", 1, len(ids))
        if number is None:
            return
        if not 1 <= number <= len(ids):
            print("Invalid profile selection.")
            return
        profile_id = ids[number - 1]
        out = ask("Output directory (blank for default)").strip()
        if profile_id not in ids:
            print("Invalid profile selection.")
            return
        node = resolve_node()
        if node is None:
            return
        path = require_tool("scripts/generate-project.mjs", DOCS["impl"])
        if path is None:
            return
        result = run_captured(
            [node, str(path), profile_id] + (["--out", out] if out else []),
            timeout=600,
        )
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    elif choice == "c":
        show_ai_guided(
            "Web wallet starter",
            [DOCS["web_guide"], DOCS["impl"]],
            [
                "Starter: apps/web (npm run dev / build / test).",
                "UI approach: clone the UI of top crypto wallets (Phantom, "
                "MetaMask, Rabby, Exodus) and adjust; see docs/14.",
            ],
        )
    elif choice == "d":
        show_ai_guided(
            "Android wallet starter",
            [DOCS["android_guide"], DOCS["impl"]],
            [
                "Starter: apps/android (./gradlew).",
                "UI approach: as for the web starter; see docs/14.",
            ],
        )
    elif choice == "e":
        show_ai_guided(
            "Wallet architecture",
            [DOCS["arch"]],
            ["Read the architecture guide before building."],
        )
    else:
        print("Unknown choice.")


def handle_build_tools(choice: str) -> None:
    if choice == "a":
        result = run_captured(
            ["npm", "--prefix", str(tool_path("tools", "hdwallet-gen")), "test"],
            timeout=300,
        )
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    elif choice == "b":
        node = resolve_node()
        if node is None:
            return
        path = require_tool("scripts/validate-registry.mjs", DOCS["index"])
        if path is None:
            return
        result = run_captured([node, str(path)])
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
    elif choice == "c":
        show_ai_guided(
            "Payment / tracking tools",
            [DOCS["tracking"], DOCS["payments"], DOCS["samples"]],
            [
                "No standalone payment-tracker executable exists in this "
                "checkout; this needs AI implementation.",
                "Payment-record schema: docs/mainnet/payment-record.schema.json.",
            ],
        )
    elif choice == "d":
        print("[UNAVAILABLE OR UNVERIFIED] Mainnet fee quote")
        print(
            "The fee module (tools/mainnet-fees/fees.mjs) is a library with no CLI."
        )
        node = resolve_node()
        if node is None:
            return
        result = run_captured(
            [node, str(tool_path("tests", "mainnet-fees.test.mjs"))]
        )
        code, stdout, stderr = (
            (result.returncode, result.stdout, result.stderr)
            if hasattr(result, "returncode")
            else result
        )
        if stdout:
            print(stdout.rstrip())
        if stderr:
            print(stderr.rstrip())
        print(f"Exit code: {code}.")
        print("Read: docs/mainnet/MAINNET-GUIDE.md")
    else:
        print("Unknown choice.")


def handle_security(choice: str) -> None:
    if choice == "a":
        print(
            "Warning: decrypt_seed.py prints the mnemonic only to the "
            "controlling terminal; never paste the data key into the launcher "
            "— the tool prompts for it securely."
        )
        path = require_tool("tools/decrypt_seed.py", DOCS["recovery"])
        if path is None:
            return
        code = run_inherited([sys.executable, str(path)])
        print(f"Exit code: {code}.")
    elif choice == "b":
        for filename in [
            "tests/mainnet-guards.test.mjs",
            "tests/mainnet-fees.test.mjs",
            "tests/mainnet-signing.test.mjs",
            "tests/mainnet-unsigned-tx.test.mjs",
        ]:
            node = resolve_node()
            if node is None:
                return
            result = run_captured([node, str(tool_path(filename))])
            code, stdout, stderr = (
                (result.returncode, result.stdout, result.stderr)
                if hasattr(result, "returncode")
                else result
            )
            if code == 0:
                print(f"{filename}: PASS")
            else:
                print(f"{filename}: FAIL (exit code {code})")
                if stdout:
                    print(stdout.rstrip())
                if stderr:
                    print(stderr.rstrip())
    elif choice == "c":
        show_ai_guided(
            "Security & recovery docs",
            [
                DOCS["security"],
                DOCS["recovery"],
                DOCS["security_md"],
                DOCS["threat"],
                DOCS["decisions"],
                DOCS["hardware"],
            ],
            [
                "No signing/broadcast path exists in this checkout.",
                "M-35 execution is NOT authorised: stop before broadcasting.",
            ],
        )
    elif choice == "d":
        show_ai_guided(
            "Independent derivation verification",
            [DOCS["verify"]],
            [
                "Compare against test/fixture-oracle.py and "
                "test/fixture-oracle-vectors.json (published vectors only, "
                "never real secrets).",
                "Run: node test/smoke.test.js.",
            ],
        )
    elif choice == "e":
        show_ai_guided(
            "Custom development request",
            [DOCS["index"], DOCS["samples"], DOCS["builder"]],
            [
                "Describe the project in one sentence, then follow the routing "
                "in docs/index.md."
            ],
        )
    else:
        print("Unknown choice.")


SUBMENU_HANDLERS = {
    "1": handle_hd_wallet,
    "2": handle_watch_only,
    "3": handle_build_app,
    "4": handle_build_tools,
    "5": handle_security,
}
SUBMENU_CHOICES = {
    "1": "abc",
    "2": "abcd",
    "3": "abcde",
    "4": "abcd",
    "5": "abcde",
}


def print_route(route: dict) -> None:
    print(f"Route: {route['title']}")
    kind = str(route["kind"]).strip().strip("[]").strip().lower()
    kind = kind.replace("_", " ").replace("-", " ")
    if kind in ("existing", "tool", "existing tool"):
        label = "[EXISTING TOOL]"
    elif kind in ("ai", "ai guided", "ai guided implementation"):
        label = "[AI-GUIDED IMPLEMENTATION]"
    else:
        label = "[UNAVAILABLE OR UNVERIFIED]"
    print(f"Kind: {label}")
    print(f"Details: {route['detail']}")
    command = route.get("command")
    if command is not None:
        print("Command: " + " ".join(command))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="bawa_cli.py")
    parser.add_argument("--route", type=str, default=None)
    parser.add_argument("--list-routes", action="store_true")
    args = parser.parse_args(argv)

    if args.list_routes:
        routes = ROUTES.values() if isinstance(ROUTES, dict) else ROUTES
        for number, route in enumerate(routes):
            if number:
                print("---")
            print_route(route)
        return 0

    if args.route is not None:
        route = route_request(args.route)
        if route is None:
            print(f"No route matched for: {args.route[:80]}")
            print("Available options:")
            print(render_main_menu())
            return 2
        print_route(route)
        return 0

    while True:
        print(render_main_menu())
        try:
            choice = input("Select an option: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("Goodbye.")
            return 0
        if choice.lower() in ("0", "q", "quit", "exit"):
            print("Goodbye.")
            return 0
        if choice in SUBMENU_HANDLERS:
            while True:
                print(render_submenu(choice))
                try:
                    sub = input("Select an option: ").strip()
                except (EOFError, KeyboardInterrupt):
                    break
                if sub == "0":
                    break
                sub = sub.lower()
                if len(sub) == 1 and sub in SUBMENU_CHOICES[choice]:
                    SUBMENU_HANDLERS[choice](sub)
                    pause()
                else:
                    print("Unknown choice.")
        else:
            print("Unknown choice. Please select 0-5.")


if __name__ == "__main__":
    raise SystemExit(main())