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
import errno
import getpass
import json
import os
import stat
import sys
import tempfile
import warnings

AAD = b"nova-shop-seed-v1"


def _read_key() -> bytes:
    raw = os.environ.get("BAWA_DATA_KEY")
    if raw:
        key = bytes.fromhex(raw.strip())
    else:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                key = bytes.fromhex(getpass.getpass("Bawa data key (hex): ").strip())
        except getpass.GetPassWarning:
            raise ValueError(
                "terminal echo cannot be disabled; refusing to read data key"
            ) from None
    if len(key) != 32:
        raise ValueError("data key must be exactly 32 bytes")
    return key


def decrypt(path: str, key: bytes) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    except OSError as exc:
        if exc.errno in (errno.ELOOP, errno.EMLINK):
            raise ValueError("refusing symlinked encrypted artifact") from None
        raise

    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError("encrypted artifact is not a regular file")
        with os.fdopen(fd, "rb") as f:
            fd = -1  # The file object now owns the descriptor.
            data = f.read(65537)
    finally:
        if fd != -1:
            os.close(fd)

    if len(data) > 65536:
        raise ValueError("encrypted artifact too large")
    try:
        bundle = json.loads(data.decode("utf-8"))
    except ValueError as exc:
        # Includes JSONDecodeError and UnicodeDecodeError.
        raise ValueError("malformed encrypted artifact") from exc
    if not isinstance(bundle, dict):
        raise ValueError("malformed encrypted artifact")
    if bundle.get("alg") != "AES-256-GCM":
        raise ValueError("unsupported encryption algorithm")

    nonce_b64 = bundle.get("nonce_b64")
    ciphertext_b64 = bundle.get("ciphertext_b64")
    if (
        not isinstance(nonce_b64, str)
        or not isinstance(ciphertext_b64, str)
        or len(nonce_b64) > 24
        or len(ciphertext_b64) > 16384
    ):
        raise ValueError("malformed encrypted artifact")
    try:
        nonce = base64.b64decode(nonce_b64, validate=True)
        ciphertext = base64.b64decode(ciphertext_b64, validate=True)
    except (binascii.Error, ValueError, TypeError) as exc:
        raise ValueError("malformed encrypted artifact") from exc
    if len(nonce) != 12 or len(ciphertext) < 16:
        raise ValueError("malformed AES-GCM artifact")
    plain = AESGCM(key).decrypt(nonce, ciphertext, AAD)
    try:
        text = plain.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("malformed recovered mnemonic") from None
    words = text.split()
    if len(words) not in (12, 15, 18, 21, 24):
        raise ValueError("recovered data does not look like a BIP-39 mnemonic")
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="secrets/seed.enc.json")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--stdout", action="store_true", help="write the mnemonic to stdout")
    group.add_argument("--output", help="write plaintext mnemonic to an atomic 0600 file")
    args = parser.parse_args()

    if args.output == "":
        parser.error("--output must not be empty")
    if args.output and os.path.islink(args.output):
        # NB: no os.path.exists() gate — islink() alone must catch dangling
        # symlinks too, otherwise a dangling symlink slips past this refusal
        # (os.replace() would still not follow it, but the guard must mean
        # what it says).
        raise SystemExit("refusing symlinked output path")

    key = _read_key()
    mnemonic = decrypt(args.path, key)

    if args.output:
        output_dir = os.path.dirname(os.path.realpath(args.output))
        os.makedirs(output_dir, exist_ok=True)
        mode = os.stat(output_dir).st_mode
        if (mode & 0o022) and not (mode & 0o1000):
            raise SystemExit(
                "refusing non-sticky group/other-writable output directory"
            )

        fd, tmp = tempfile.mkstemp(
            prefix="seed-", suffix=".tmp", dir=output_dir
        )
        published = False
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                os.fchmod(fd, 0o600)
                f.write(mnemonic + "\n")
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, args.output)
            published = True
        finally:
            if not published:
                try:
                    os.unlink(tmp)
                except FileNotFoundError:
                    pass

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
    try:
        sys.exit(main())
    except (ValueError, OSError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        sys.exit(1)
