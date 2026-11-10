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


def validate_public_stdout(data) -> None:
    """Require the generator's stdout to match its public-data schema.

    Only the ten documented public keys are allowed, each with its
    expected type and shape. Anything else is refused: stdout is a
    public-data channel, not a free-form one.
    """
    allowed = {
        "btc_zpub", "eth_xpub", "trx_xpub", "ton_address", "ton_path",
        "ton_note", "samples", "checks", "seed_encrypted_to",
        "wallet_core_version",
    }
    if not isinstance(data, dict):
        raise SystemExit("generator stdout malformed: expected JSON object")
    if set(data) - allowed:
        raise SystemExit("generator stdout malformed: unexpected key")
    if allowed - set(data):
        raise SystemExit("generator stdout malformed: missing key")
    for key, prefix in (
        ("btc_zpub", "zpub"), ("eth_xpub", "xpub"), ("trx_xpub", "xpub"),
    ):
        value = data[key]
        if not isinstance(value, str) or not value.startswith(prefix):
            raise SystemExit(
                f"generator stdout malformed: {key} must start with {prefix}"
            )
    for key in (
        "ton_address", "ton_path", "ton_note", "seed_encrypted_to",
        "wallet_core_version",
    ):
        if not isinstance(data[key], str) or not data[key]:
            raise SystemExit(
                f"generator stdout malformed: {key} must be a non-empty string"
            )
    samples = data["samples"]
    if (
        not isinstance(samples, dict)
        or not samples
        or not all(
            isinstance(k, str) and isinstance(v, str)
            for k, v in samples.items()
        )
    ):
        raise SystemExit(
            "generator stdout malformed: samples must be a non-empty dict of strings"
        )
    checks = data["checks"]
    if (
        not isinstance(checks, list)
        or not checks
        or not all(
            isinstance(c, dict)
            and isinstance(c.get("name"), str)
            and re.fullmatch(r"[a-z0-9_]+", c["name"])
            and isinstance(c.get("ok"), bool)
            for c in checks
        )
    ):
        raise SystemExit(
            "generator stdout malformed: checks must be a non-empty list of {name, ok} dicts"
        )


def _bip39_english_words():
    import importlib.resources

    return frozenset(
        importlib.resources.files("bip_utils.bip.bip39.wordlist")
        .joinpath("english.txt")
        .read_text(encoding="utf-8")
        .split()
    )


_BIP39_WORDS = None


def _contains_seed_material(obj) -> bool:
    """Detect seed material anywhere in parsed generator stdout.

    Walks the whole document in order, collecting two token streams —
    dict keys and string values — lowercasing and splitting on
    non-letters, and flags a run of >=12 consecutive tokens from the
    BIP-39 English wordlist in either stream. Keys and values are
    scanned separately so a short key token cannot break a mnemonic
    split across neighbouring values (and vice versa). Legitimate
    public output contains only isolated wordlist words, never a run.
    """
    global _BIP39_WORDS
    if _BIP39_WORDS is None:
        _BIP39_WORDS = _bip39_english_words()
    key_tokens = []
    value_tokens = []

    def _walk(node, into_values):
        if isinstance(node, dict):
            for key, value in node.items():
                _walk(key, into_values=False)
                _walk(value, into_values=True)
        elif isinstance(node, list):
            for value in node:
                _walk(value, into_values)
        elif isinstance(node, str):
            (value_tokens if into_values else key_tokens).extend(
                re.split(r"[^a-z]+", node.lower())
            )

    def _has_word_run(tokens):
        run = 0
        for token in tokens:
            if token and token in _BIP39_WORDS:
                run += 1
                if run >= 12:
                    return True
            else:
                run = 0
        return False

    _walk(obj, into_values=True)
    return _has_word_run(key_tokens) or _has_word_run(value_tokens)


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


def resolve_secrets_dir(env=None):
    """Resolve the secrets directory (guarded BAWA_SECRETS_DIR migration).

    Canonical name BAWA_SECRETS_DIR; NOVA_SECRETS_DIR is accepted during
    the one-release compatibility window with a deprecation warning.
    Both names set to different values refuses to run; neither set uses
    the default. Diagnostics name variables only, never values.
    """
    if env is None:
        env = os.environ

    def _value(name):
        value = env.get(name)
        return value if isinstance(value, str) and value else None

    fresh = _value("BAWA_SECRETS_DIR")
    legacy = _value("NOVA_SECRETS_DIR")
    if fresh is not None and legacy is not None:
        if os.path.expanduser(fresh) != os.path.expanduser(legacy):
            raise SystemExit(
                "conflicting secrets directories: BAWA_SECRETS_DIR and "
                "NOVA_SECRETS_DIR are both set to different values; set only one"
            )
        print(
            "warning: NOVA_SECRETS_DIR is deprecated; use BAWA_SECRETS_DIR",
            file=sys.stderr,
        )
        return os.path.expanduser(fresh)
    if fresh is not None:
        return os.path.expanduser(fresh)
    if legacy is not None:
        print(
            "warning: NOVA_SECRETS_DIR is deprecated; use BAWA_SECRETS_DIR",
            file=sys.stderr,
        )
        return os.path.expanduser(legacy)
    return os.path.join(BASE, "secrets")


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


def assert_bundle_decrypts(bundle_path, data_key) -> None:
    """Independently decrypt the final bundle with the wrapper-held key.

    The generator's bundle_verified flag is status, not proof: this check
    authenticates the written bundle in the wrapper and validates the
    plaintext as a valid 24-word BIP-39 mnemonic (wordlist + checksum).
    Never returns or logs the plaintext or the key.
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
    except UnicodeDecodeError:
        raise SystemExit(
            "seed bundle independent verification failed: plaintext is not UTF-8"
        ) from None
    finally:
        # Best-effort wipe of the plaintext copy (the decoded str cannot
        # be zeroed: immutable, same caveat as the generator's strings).
        for i in range(len(plain)):
            plain[i] = 0


def main() -> None:
    force = "--force" in sys.argv or "--regenerate" in sys.argv
    raw_secrets = resolve_secrets_dir()
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
    # the bundle afterwards. It is passed to the generator only through
    # a subprocess-only environment copy — never the wrapper's own env,
    # never logged — and zeroed after the verification below.
    data_key = bytearray(secrets.token_bytes(32))
    child_env = os.environ.copy()
    child_env["BAWA_DATA_KEY_HEX"] = bytes(data_key).hex()
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        env=child_env,
    )
    if proc.returncode != 0:
        raise SystemExit("wallet-core generation failed; stderr suppressed")

    data = json.loads(proc.stdout)
    validate_public_stdout(data)
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

    # Independent proof: decrypt the final bundle with the wrapper-held
    # key and validate the plaintext as a BIP-39 mnemonic. The
    # generator's bundle_verified flag above is status, not proof.
    try:
        assert_bundle_decrypts(reported, data_key)
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
