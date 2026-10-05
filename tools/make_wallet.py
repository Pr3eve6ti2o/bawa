#!/usr/bin/env python3
"""One-time Bawa wallet generator orchestrator.

This wrapper is deliberately standalone: it does not import the parent
application's payment modules. It starts the Trust Wallet Core generator,
validates its public JSON output, verifies the encrypted recovery artifact,
and writes public xpub/address configuration.
"""
from __future__ import annotations

import base64
import binascii
import json
import os
import re
import shutil
import stat
import subprocess
import sys

BASE = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
TARGET_KEYS = {"XPUB_BTC", "XPUB_ETH", "XPUB_TRX", "TON_DEPOSIT_ADDRESS"}


def _env_keys(text: str) -> set[str]:
    keys = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        left = line.split("=", 1)[0].strip()
        if left.startswith("export "):
            left = left[7:].strip()
        if re.fullmatch(r"[A-Z_][A-Z0-9_]*", left):
            keys.add(left)
    return keys


def _copy_0600(src: str, dst: str) -> None:
    if os.path.islink(src) or os.path.islink(dst):
        raise SystemExit("refusing symlinked wallet material path")
    os.makedirs(os.path.dirname(dst), mode=0o700, exist_ok=True)
    shutil.copyfile(src, dst)
    os.chmod(dst, 0o600)


def _looks_like_seed_phrase(value) -> bool:
    if not isinstance(value, str):
        return False
    words = value.split()
    run = 0
    for word in words:
        if word.isalpha() and word.islower():
            run += 1
            if run >= 12:
                return True
        else:
            run = 0
    return False


def _contains_seed_material(obj) -> bool:
    if isinstance(obj, dict):
        for value in obj.values():
            if _contains_seed_material(value):
                return True
        return False
    if isinstance(obj, list):
        return any(_contains_seed_material(value) for value in obj)
    return _looks_like_seed_phrase(obj)


def _parse_seed_bundle(path: str) -> tuple[bytes, bytes]:
    with open(path, encoding="utf-8") as f:
        bundle = json.load(f)
    if bundle.get("alg") != "AES-256-GCM":
        raise SystemExit("seed bundle malformed: unexpected algorithm")
    try:
        nonce = base64.b64decode(bundle["nonce_b64"], validate=True)
        ciphertext = base64.b64decode(bundle["ciphertext_b64"], validate=True)
    except (KeyError, binascii.Error, ValueError, TypeError):
        raise SystemExit("seed bundle malformed: invalid base64")
    if len(nonce) != 12 or len(ciphertext) < 16:
        raise SystemExit("seed bundle malformed: invalid nonce/ciphertext")
    return nonce, ciphertext


def main() -> None:
    force = "--force" in sys.argv or "--regenerate" in sys.argv
    raw_secrets = os.path.expanduser(
        os.environ.get("NOVA_SECRETS_DIR", os.path.join(BASE, "secrets"))
    )
    if os.path.islink(raw_secrets):
        raise SystemExit("refusing symlinked secrets directory")
    secrets_dir = os.path.realpath(raw_secrets)
    seed_path = os.path.join(secrets_dir, "seed.enc.json")

    env_path = os.path.expanduser(
        os.environ.get("BAWA_ENV_FILE", os.path.join(BASE, ".env"))
    )
    if os.path.islink(env_path):
        raise SystemExit("refusing symlinked .env")
    if os.path.exists(seed_path) and not force:
        raise SystemExit(
            "existing wallet found; rerun with --force/--regenerate only after making a verified backup"
        )

    node = shutil.which("node") or "/usr/bin/node"
    generator = os.path.join(BASE, "tools", "hdwallet-gen", "generate.js")
    if not os.path.isfile(generator):
        raise SystemExit(f"generator not found: {generator}")

    os.makedirs(secrets_dir, mode=0o700, exist_ok=True)
    os.chmod(secrets_dir, 0o700)

    cmd = [node, generator]
    if force:
        cmd.append("--force")
    print("Generating wallet with Trust Wallet Core ...", flush=True)
    print(
        "Seed phrase + data key are displayed only on the controlling terminal.",
        flush=True,
    )

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        env=os.environ.copy(),
    )
    if proc.returncode != 0:
        raise SystemExit("wallet-core generation failed; stderr suppressed")

    data = json.loads(proc.stdout)
    if _contains_seed_material(data):
        raise SystemExit("H4 violation: seed material present in generator stdout")

    failed = [check["name"] for check in data.get("checks", []) if not check.get("ok")]
    if failed:
        raise SystemExit(f"wallet-core self-checks failed: {failed}")

    reported = os.path.realpath(data.get("seed_encrypted_to") or seed_path)
    if reported != secrets_dir and not reported.startswith(secrets_dir + os.sep):
        raise SystemExit("seed bundle path outside configured secrets directory")
    if not os.path.isfile(reported):
        raise SystemExit("seed bundle missing")

    nonce, ciphertext = _parse_seed_bundle(reported)
    del nonce, ciphertext
    mode = stat.S_IMODE(os.stat(reported).st_mode)
    if mode != 0o600:
        raise SystemExit(f"seed bundle must be 0600, got {oct(mode)}")

    raw_bundle = os.path.expanduser(
        os.environ.get("BAWA_BACKUP_DIR", os.path.join(BASE, "seed-backup"))
    )
    if os.path.islink(raw_bundle):
        raise SystemExit("refusing symlinked backup directory")
    backup_dir = os.path.realpath(raw_bundle)
    os.makedirs(backup_dir, mode=0o700, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    _copy_0600(reported, os.path.join(backup_dir, "seed.enc.json"))

    recovery = os.path.join(BASE, "tools", "decrypt_seed.py")
    if os.path.isfile(recovery):
        _copy_0600(recovery, os.path.join(backup_dir, "decrypt_seed.py"))
    recovery_doc = os.path.join(BASE, "docs", "RECOVERY.md")
    if os.path.isfile(recovery_doc):
        _copy_0600(recovery_doc, os.path.join(backup_dir, "RECOVERY.md"))

    example = os.path.join(BASE, ".env.example")
    if not os.path.isfile(env_path):
        if not os.path.isfile(example):
            raise SystemExit(".env is missing and .env.example is unavailable")
        with open(example, encoding="utf-8") as f:
            env_text = f.read()
    else:
        with open(env_path, encoding="utf-8") as f:
            env_text = f.read()

    values = {
        "XPUB_BTC": data["btc_zpub"],
        "XPUB_ETH": data["eth_xpub"],
        "XPUB_TRX": data["trx_xpub"],
        "TON_DEPOSIT_ADDRESS": data["ton_address"],
    }

    lines = []
    seen = set()
    for line in env_text.splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=", line)
        if match and match.group(1) in values:
            key = match.group(1)
            lines.append(f"{key}={values[key]}")
            seen.add(key)
        else:
            lines.append(line)
    for key, value in values.items():
        if key not in seen:
            lines.append(f"{key}={value}")

    new_env = "\n".join(lines).rstrip("\n") + "\n"
    os.makedirs(os.path.dirname(os.path.realpath(env_path)), exist_ok=True)
    tmp_env = env_path + ".tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(tmp_env, flags, 0o600)
    except FileExistsError:
        if os.path.islink(tmp_env):
            raise SystemExit("refusing symlinked temporary .env path")
        os.unlink(tmp_env)
        fd = os.open(tmp_env, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(new_env)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_env, env_path)
    os.chmod(env_path, 0o600)

    print("Wallet generation and public configuration update completed.")
    print("Public roots:")
    print(f"  BTC zpub: {data['btc_zpub']}")
    print(f"  ETH xpub: {data['eth_xpub']}")
    print(f"  TRX xpub: {data['trx_xpub']}")
    print(f"  TON:      {data['ton_address']}")
    print(f"Encrypted recovery artifact: {reported} (0600)")
    print(f"Backup bundle: {backup_dir}")


if __name__ == "__main__":
    main()
