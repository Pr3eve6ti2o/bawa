#!/usr/bin/env python3
"""Decrypt Bawa's AES-256-GCM seed artifact in a controlled terminal.

Default behavior prints the recovered mnemonic to the controlling terminal,
not ordinary stdout, and never writes the plaintext to disk. Use --stdout
only when an explicit machine-readable pipeline is truly required.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import getpass
import json
import os
import stat
import sys

AAD = b"nova-shop-seed-v1"


def _read_key() -> bytes:
    raw = os.environ.get("BAWA_DATA_KEY")
    if raw:
        key = bytes.fromhex(raw.strip())
    else:
        key = bytes.fromhex(getpass.getpass("Bawa data key (hex): ").strip())
    if len(key) != 32:
        raise ValueError("data key must be exactly 32 bytes")
    return key


def decrypt(path: str, key: bytes) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if os.path.islink(path):
        raise ValueError("refusing symlinked encrypted artifact")
    with open(path, encoding="utf-8") as f:
        bundle = json.load(f)
    if bundle.get("alg") != "AES-256-GCM":
        raise ValueError("unsupported encryption algorithm")
    try:
        nonce = base64.b64decode(bundle["nonce_b64"], validate=True)
        ciphertext = base64.b64decode(bundle["ciphertext_b64"], validate=True)
    except (KeyError, binascii.Error, ValueError, TypeError) as exc:
        raise ValueError("malformed encrypted artifact") from exc
    if len(nonce) != 12 or len(ciphertext) < 16:
        raise ValueError("malformed AES-GCM artifact")
    plain = AESGCM(key).decrypt(nonce, ciphertext, AAD)
    text = plain.decode("utf-8")
    words = text.split()
    if len(words) not in (12, 15, 18, 21, 24):
        raise ValueError("recovered data does not look like a BIP-39 mnemonic")
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="secrets/seed.enc.json")
    parser.add_argument("--stdout", action="store_true", help="write the mnemonic to stdout")
    parser.add_argument("--output", help="write plaintext mnemonic to an atomic 0600 file")
    args = parser.parse_args()

    if args.stdout and args.output:
        parser.error("--stdout and --output are mutually exclusive")
    if args.output and os.path.exists(args.output) and os.path.islink(args.output):
        raise SystemExit("refusing symlinked output path")

    key = _read_key()
    mnemonic = decrypt(args.path, key)

    if args.output:
        tmp = args.output + ".tmp"
        os.makedirs(os.path.dirname(os.path.realpath(args.output)), exist_ok=True)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        try:
            fd = os.open(tmp, flags, 0o600)
        except FileExistsError:
            if os.path.islink(tmp):
                raise SystemExit("refusing symlinked temporary output path")
            os.unlink(tmp)
            fd = os.open(tmp, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(mnemonic + "\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, args.output)
        os.chmod(args.output, 0o600)
        print(f"recovered mnemonic written to {args.output} (0600)")
        return 0

    if args.stdout:
        print(mnemonic)
        return 0

    try:
        tty = open("/dev/tty", "w", encoding="utf-8")
    except OSError as exc:
        raise SystemExit("no controlling terminal; use --stdout or --output explicitly") from exc
    with tty:
        tty.write("Recovered BIP-39 mnemonic (do not copy into chat or source control):\n")
        tty.write(mnemonic + "\n")
        tty.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
