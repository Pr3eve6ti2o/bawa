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
import contextlib
import json
import os
import re
import secrets
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


def _parse_seed_bundle(path: str) -> tuple[bytes, bytes, int]:
    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            st = os.fstat(fd)
            if not stat.S_ISREG(st.st_mode):
                raise SystemExit("seed bundle malformed: not a regular file")
            mode = stat.S_IMODE(st.st_mode)

            # The finally block owns the descriptor, even if fdopen fails.
            with os.fdopen(fd, "r", encoding="utf-8", closefd=False) as f:
                bundle = json.load(f)
        finally:
            os.close(fd)

        if not isinstance(bundle, dict):
            raise SystemExit("seed bundle malformed: expected JSON object")
        if bundle.get("alg") != "AES-256-GCM":
            raise SystemExit("seed bundle malformed: unexpected algorithm")
        try:
            nonce = base64.b64decode(bundle["nonce_b64"], validate=True)
            ciphertext = base64.b64decode(bundle["ciphertext_b64"], validate=True)
        except (KeyError, binascii.Error, ValueError, TypeError):
            raise SystemExit("seed bundle malformed: invalid base64") from None
        if len(nonce) != 12 or len(ciphertext) < 16:
            raise SystemExit("seed bundle malformed: invalid nonce/ciphertext")
        return nonce, ciphertext, mode
    except (
        OSError,
        json.JSONDecodeError,
        UnicodeDecodeError,
        AttributeError,
        TypeError,
        KeyError,
    ):
        raise SystemExit("seed bundle malformed: invalid input") from None


def assertBundleVerified(data) -> None:
    """Require the generator's in-process decrypt verification.

    generate.js verifies the written seed bundle by decrypting it in-process
    and reports {name: "bundle_verified", ok: true} in the stdout JSON checks
    array. A missing check must fail the run, not pass silently: without it
    there is no evidence the bundle decrypts with the data key shown to the
    user. The existing failed-checks logic covers a present-but-not-ok check;
    this covers the absent case.
    """
    checks = data.get("checks") if isinstance(data, dict) else None
    if not isinstance(checks, list) or not any(
        isinstance(c, dict) and c.get("name") == "bundle_verified" and c.get("ok") is True
        for c in checks
    ):
        raise SystemExit("seed bundle verification missing: generator did not report bundle_verified")


def assert_bundle_decrypts(bundle_path, data_key) -> str:
    """Independently decrypt the final bundle with the wrapper-held key.

    The generator's bundle_verified flag is status, not proof: this check
    authenticates the written bundle in the wrapper and validates the
    plaintext as a valid 24-word BIP-39 mnemonic (wordlist + checksum).
    Returns the validated mnemonic text (never logged) so the caller can
    cross-check it against the reported public roots. Never returns or
    logs the plaintext or the key.

    The trezor/python-mnemonic second check is the independent verification.
    Acceptance: (a) AESGCM with AAD b"nova-shop-seed-v1"; (b) bip_utils
    rejects non-24-word or bad-checksum plaintext; (c) missing mnemonic
    fails closed with "mnemonic package is not installed"; (d) trezor
    check must be True and entropy must be 32 bytes; (e) plain is wiped
    in finally; (f) returns the validated mnemonic text.
    """
    from bip_utils import Bip39Languages, Bip39MnemonicValidator
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce, ciphertext, _mode = _parse_seed_bundle(bundle_path)
    try:
        plain = bytearray(
            AESGCM(bytes(data_key)).decrypt(nonce, ciphertext, b"nova-shop-seed-v1")
        )
    except Exception:
        raise SystemExit(
            "seed bundle independent verification failed: decrypt failed"
        ) from None
    try:
        text = bytes(plain).decode("utf-8")
        if len(text.split()) != 24 or not Bip39MnemonicValidator(
            Bip39Languages.ENGLISH
        ).IsValid(text):
            raise SystemExit(
                "seed bundle independent verification failed: plaintext is "
                "not a valid 24-word BIP-39 mnemonic"
            )
        try:
            from mnemonic import Mnemonic
        except ImportError:
            raise SystemExit(
                "seed bundle independent verification failed: "
                "mnemonic package is not installed"
            ) from None
        try:
            m = Mnemonic("english")
            if m.check(text) is not True or len(m.to_entropy(text)) != 32:
                raise SystemExit(
                    "seed bundle independent verification failed: "
                    "trezor mnemonic validation failed"
                ) from None
        except Exception:
            raise SystemExit(
                "seed bundle independent verification failed: "
                "trezor mnemonic validation failed"
            ) from None
    except UnicodeDecodeError:
        raise SystemExit(
            "seed bundle independent verification failed: plaintext is not UTF-8"
        ) from None
    finally:
        # Best-effort wipe of the plaintext copy (the decoded str cannot
        # be zeroed: immutable, same caveat as the generator's strings).
        for i in range(len(plain)):
            plain[i] = 0
    return text


@contextlib.contextmanager
def _data_key_pipe(data_key):
    """Yield the read end of an anonymous pipe pre-filled with the data key.

    Ported from the panel branch (adopt-proper): the wrapper generates the
    data key so it can independently verify the bundle afterwards, and the
    key reaches the generator over an inherited anonymous pipe
    (BAWA_DATA_KEY_FD), never the environment — a key in the child's
    environment is visible in /proc/<pid>/environ to same-user processes,
    and the hex-string copies cannot be zeroed. The write end is closed
    before yielding, and the read end is closed on EVERY exit path — a
    failed or short write, an exception in the caller, or normal return —
    so no failure between pipe creation and the child spawn can leak the
    read descriptor with unread key bytes. The caller passes the yielded
    fd via pass_fds; that alone makes it inheritable in the child, so no
    os.set_inheritable call is needed. A short write raises instead of
    silently handing the child a truncated key.
    """
    key_r, key_w = os.pipe()
    try:
        try:
            written = os.write(key_w, bytes(data_key))
        finally:
            os.close(key_w)
        if written != len(data_key):
            raise SystemExit("data-key pipe write incomplete")
        yield key_r
    finally:
        try:
            os.close(key_r)
        except OSError:
            pass


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

    # The wrapper generates the data key so it can independently verify
    # the bundle afterwards. The key reaches the generator over an
    # inherited anonymous pipe (BAWA_DATA_KEY_FD), never the environment:
    # a key in the child's environment is visible in /proc/<pid>/environ
    # to same-user processes, and the hex-string copies cannot be zeroed.
    # The key is written into the pipe before spawn (32 bytes fits the
    # pipe buffer) and the write end is closed in the parent; the child
    # reads exactly 32 bytes and closes its read end. The outer finally
    # zeroes the wrapper's copy on every path after this point — a
    # generator failure, malformed stdout, failed check or scan error
    # must not skip the wipe. The key is a secret in memory only: it is
    # never logged, never written to a file, never persisted, and never
    # appears in captured stdout or test output.
    data_key = bytearray(secrets.token_bytes(32))
    try:
        with _data_key_pipe(data_key) as key_r:
            child_env = os.environ.copy()
            child_env.pop("BAWA_DATA_KEY_HEX", None)
            child_env["BAWA_DATA_KEY_FD"] = str(key_r)
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                env=child_env,
                pass_fds=(key_r,),
            )
            if proc.returncode != 0:
                raise SystemExit("wallet-core generation failed; stderr suppressed")

            try:
                data = json.loads(proc.stdout)
            except json.JSONDecodeError:
                raise SystemExit("generator stdout malformed: invalid JSON") from None
            assertBundleVerified(data)
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

            nonce, ciphertext, mode = _parse_seed_bundle(reported)
            del nonce, ciphertext
            if mode != 0o600:
                raise SystemExit(f"seed bundle must be 0600, got {oct(mode)}")

            # Independent proof: decrypt the final bundle with the
            # wrapper-held key and validate the plaintext as a BIP-39
            # mnemonic. The generator's bundle_verified flag above is
            # status, not proof. The returned mnemonic is dropped
            # immediately; it is never logged or persisted.
            mnemonic = assert_bundle_decrypts(reported, data_key)
            del mnemonic  # plaintext no longer needed; drop the reference
    finally:
        for i in range(len(data_key)):
            data_key[i] = 0

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
