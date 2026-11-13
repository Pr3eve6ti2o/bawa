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
import datetime
import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import threading

BASE = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))


# Cap on any single copied wallet-material file (T43 r1d rework). The
# legitimate files are small (a seed bundle is capped at 64 KiB by the
# parser); 1 MiB bounds the copier's whole-source read without imposing
# the parser's limit on non-bundle files such as RECOVERY.md.
_COPY_MAX_BYTES = 1024 * 1024


def _fsync_dir(path: str) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _makedirs_0700_fsynced(path: str) -> None:
    """Create missing directories at 0700, fsyncing each new entry's parent.

    os.makedirs applies the mode to the leaf only and never fsyncs, so a
    fresh ancestor chain would not be durable after a crash (T43 r1d
    §3). Existing directories are left untouched (no chmod, no fsync).
    """
    target = os.path.abspath(path)
    missing = []
    cursor = target
    while not os.path.isdir(cursor):
        missing.append(cursor)
        parent = os.path.dirname(cursor)
        if parent == cursor:
            raise SystemExit(f"cannot create directory: {target}")
        cursor = parent
    for directory in reversed(missing):
        os.mkdir(directory, 0o700)
        os.chmod(directory, 0o700)
        _fsync_dir(os.path.dirname(directory))


def _copy_0600(src: str, dst: str) -> None:
    """Copy src to dst as a fresh 0600 file, atomically and durably.

    The source is opened O_RDONLY|O_NOFOLLOW|O_NONBLOCK and must be a
    regular file (a FIFO never blocks the open; a symlink is refused).
    At most _COPY_MAX_BYTES are read, in chunks. Bytes go to an
    exclusively created 0600 temp file in the destination directory,
    which is fsynced, re-read and SHA-256-verified against the source
    snapshot, then published with os.replace — a symlinked dst is
    replaced, never followed — and the directory is fsynced. The temp
    file already carries 0600 through the replace, so there is no
    post-replace pathname chmod to race. The islink prechecks remain
    as a fast fail only (T43 r1b Fix 3 / r1d rework).
    """
    if os.path.islink(src) or os.path.islink(dst):
        raise SystemExit("refusing symlinked wallet material path")
    src_fd = os.open(
        src,
        os.O_RDONLY
        | getattr(os, "O_NOFOLLOW", 0)
        | getattr(os, "O_NONBLOCK", 0),
    )
    try:
        st = os.fstat(src_fd)
        if not stat.S_ISREG(st.st_mode):
            raise SystemExit("refusing non-regular wallet material source")
        chunks = []
        total = 0
        while True:
            chunk = os.read(src_fd, 65536)
            if not chunk:
                break
            total += len(chunk)
            if total > _COPY_MAX_BYTES:
                raise SystemExit("wallet material exceeds 1 MiB")
            chunks.append(chunk)
        data = b"".join(chunks)
    finally:
        os.close(src_fd)
    dst_dir = os.path.dirname(dst) or "."
    _makedirs_0700_fsynced(dst_dir)
    fd, tmp = tempfile.mkstemp(prefix=".copy-", dir=dst_dir)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        with open(tmp, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        if digest != hashlib.sha256(data).hexdigest():
            raise SystemExit("wallet material copy verification failed")
        os.replace(tmp, dst)
        tmp = None
        _fsync_dir(dst_dir)
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except FileNotFoundError:
                pass


def _copy_versioned_0600(src: str, dst: str) -> None:
    """Copy src to dst, preserving any previous dst as a versioned archive.

    A previous dst is hard-linked to dst + ".bak." + UTC timestamp +
    "." + 16 random hex chars (retrying on collision) and the directory
    is fsynced before replacement, so the preserved bundle is durable
    first. _copy_0600's os.replace then overwrites dst atomically — a
    failing copy leaves the old bundle in place at dst plus the archive
    (no early unlink, T43 r1d rework). The archive inherits the old
    inode's mode, so it is chmodded 0600 only AFTER the replace, when
    the inode is private to the archive; chmodding before the replace
    would have changed the live dst too.
    """
    if os.path.islink(src) or os.path.islink(dst):
        raise SystemExit("refusing symlinked wallet material path")
    archive = None
    archive_needs_chmod = False
    if os.path.exists(dst):
        if not os.path.isfile(dst):
            raise SystemExit("refusing non-regular wallet material destination")
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H-%M-%S"
        )
        for _ in range(5):
            candidate = f"{dst}.bak.{stamp}.{secrets.token_hex(8)}"
            try:
                os.link(dst, candidate)
            except FileExistsError:
                continue
            archive = candidate
            break
        if archive is None:
            raise SystemExit("could not create a versioned backup name")
        archive_needs_chmod = stat.S_IMODE(os.stat(archive).st_mode) != 0o600
        _fsync_dir(os.path.dirname(dst) or ".")
    _copy_0600(src, dst)
    if archive is not None and archive_needs_chmod:
        try:
            os.chmod(archive, 0o600)
        except OSError:
            pass


def _clean_text(value) -> bool:
    """Printable single-line text: no control characters, no leading or
    trailing whitespace. Generator values are interpolated verbatim
    into .env KEY=value lines, so a newline inside one would smuggle
    an extra assignment (T44-F4)."""
    return (
        isinstance(value, str)
        and value != ""
        and value == value.strip()
        and all(0x20 <= ord(ch) <= 0x7E for ch in value)
    )


def _reject_hex_seed_strings(data) -> None:
    """No 64-hex string anywhere in generator stdout: a hex-encoded
    seed has no legitimate place in the ten-key public schema, and the
    word-run detector cannot see it (T44-F18)."""
    def _walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                _walk(key)
                _walk(value)
        elif isinstance(node, list):
            for value in node:
                _walk(value)
        elif isinstance(node, str):
            if re.fullmatch(r"[0-9a-fA-F]{64}", node):
                raise SystemExit(
                    "generator stdout malformed: 64-hex string present"
                )

    _walk(data)


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
    # T44-F4: shapes, not just prefixes. The three extended keys are
    # interpolated verbatim into .env KEY=value lines: a value holding
    # a newline would inject an extra assignment, and a value that is
    # not even a Base58 extended key must not reach .env at all.
    for key in ("btc_zpub", "eth_xpub", "trx_xpub"):
        value = data[key]
        if not re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{100,120}", value):
            raise SystemExit(
                f"generator stdout malformed: {key} must be a 100-120 "
                "character Base58 extended key"
            )
    if not re.fullmatch(r"[EU]Q[A-Za-z0-9_-]{46}", data["ton_address"]):
        raise SystemExit(
            "generator stdout malformed: ton_address must be a "
            "48-character user-friendly TON address"
        )
    if data["ton_path"] != "m/44'/607'/0'":
        raise SystemExit(
            "generator stdout malformed: ton_path must be m/44'/607'/0'"
        )
    if not re.fullmatch(r"\d+\.\d+\.\d+", data["wallet_core_version"]):
        raise SystemExit(
            "generator stdout malformed: wallet_core_version must be "
            "a semantic version"
        )
    # T44-F4/F18: every string in the document must be clean
    # single-line printable text, and none may be a 64-hex string.
    def _check_clean(node):
        if isinstance(node, dict):
            for key, value in node.items():
                _check_clean(key)
                _check_clean(value)
        elif isinstance(node, list):
            for value in node:
                _check_clean(value)
        elif isinstance(node, str):
            if not _clean_text(node):
                raise SystemExit(
                    "generator stdout malformed: string value is not "
                    "clean single-line printable text"
                )

    _check_clean(data)
    _reject_hex_seed_strings(data)
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
        # T41: a missing wordlist must fail closed with a clear diagnostic,
        # not abort as an unhandled ImportError traceback before the data
        # key is zeroed (the outer finally in main covers the zeroing).
        try:
            _BIP39_WORDS = _bip39_english_words()
        except ImportError:
            raise SystemExit(
                "seed-material scan unavailable: bip-utils is not installed"
            ) from None
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
        # O_NONBLOCK (T43 c3a §2): a FIFO at the path must not block the
        # open; the fstat check below rejects it as non-regular.
        fd = os.open(
            path,
            os.O_RDONLY
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_NONBLOCK", 0),
        )
        try:
            st = os.fstat(fd)
            if not stat.S_ISREG(st.st_mode):
                raise SystemExit("seed bundle malformed: not a regular file")
            # Size cap (T43 F6 / r1b Fix 3): json.load reads the whole
            # file, so the bound must be enforced here, before the
            # read — decrypt_seed.py already caps at 64 KiB.
            if st.st_size > 65536:
                raise SystemExit("seed bundle malformed: too large")
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


def assert_bundle_decrypts(bundle_path, data_key) -> str:
    """Independently decrypt the final bundle with the wrapper-held key.

    The generator's bundle_verified flag is status, not proof: this check
    authenticates the written bundle in the wrapper and validates the
    plaintext as a valid 24-word BIP-39 mnemonic (wordlist + checksum).
    Returns the validated mnemonic text (never logged) so the caller can
    cross-check it against the reported public roots. Never returns or
    logs the plaintext or the key.
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
    return text


def assert_bundle_matches_public_roots(mnemonic, data) -> None:
    """Require the decrypted bundle to match the reported public roots.

    Re-derives the BTC zpub, ETH xpub, TRX xpub and the first receiving
    addresses from the decrypted mnemonic on an independent path
    (bip_utils, not wallet-core) and requires them to equal the
    generator's reported roots and samples. A bundle that decrypts to a
    valid but different mnemonic than the published wallet — a generator
    bug, a swapped bundle, or a generator that encrypts an
    attacker-chosen mnemonic while reporting honest roots — fails here
    instead of silently backing up the wrong wallet. LIMITATION: a
    generator that reports roots derived from the SAME attacker-known
    mnemonic is undetectable from outside the generator; the trust
    boundary is the generator itself. TON is not cross-checked: no
    verified bip_utils TON derivation is available in this repo.
    """
    from bip_utils import (
        Bip39SeedGenerator,
        Bip44,
        Bip44Changes,
        Bip44Coins,
        Bip84,
        Bip84Coins,
    )

    seed = Bip39SeedGenerator(mnemonic).Generate()
    btc = Bip84.FromSeed(seed, Bip84Coins.BITCOIN)
    eth = Bip44.FromSeed(seed, Bip44Coins.ETHEREUM)
    trx = Bip44.FromSeed(seed, Bip44Coins.TRON)

    def _account_xpub(ctx):
        return ctx.Purpose().Coin().Account(0).PublicKey().ToExtended()

    def _receiving(ctx, index):
        return (
            ctx.Purpose()
            .Coin()
            .Account(0)
            .Change(Bip44Changes.CHAIN_EXT)
            .AddressIndex(index)
            .PublicKey()
            .ToAddress()
        )

    expected_roots = {
        "btc_zpub": _account_xpub(btc),
        "eth_xpub": _account_xpub(eth),
        "trx_xpub": _account_xpub(trx),
    }
    for key, value in expected_roots.items():
        if data.get(key) != value:
            raise SystemExit(
                "seed bundle mismatch: decrypted mnemonic does not match "
                f"reported {key}"
            )
    samples = data.get("samples") or {}
    for label, ctx in (("btc1", btc), ("eth1", eth), ("trx1", trx)):
        if samples.get(label) != _receiving(ctx, 1):
            raise SystemExit(
                "seed bundle mismatch: decrypted mnemonic does not match "
                f"reported sample {label}"
            )


# Cap on generator output (F-14). The legitimate stdout is a small JSON
# object (a few KB). Anything larger is a runaway or compromised
# generator; capture_output would buffer it without a size limit, and
# the 120 s timeout does not prevent memory exhaustion.
GENERATOR_OUTPUT_LIMIT = 1024 * 1024  # 1 MiB per stream
GENERATOR_TIMEOUT_S = 120


class _CappedStream:
    """Byte-capped drain for one child stream.

    Reads in 64 KB chunks on its own thread. On overflow it marks the
    stream, kills the child, and stops reading — the child cannot fill
    memory through a stream nobody is draining. Each reader touches
    only its own state; the caller reads the fields after joining.
    """

    def __init__(self, stream, limit, proc, name):
        self.stream = stream
        self.limit = limit
        self.proc = proc
        self.name = name
        self.chunks = []
        self.total = 0
        self.overflow = False

    def run(self):
        try:
            while True:
                chunk = self.stream.read(65536)
                if not chunk:
                    break
                self.total += len(chunk)
                if self.total > self.limit:
                    self.overflow = True
                    self.proc.kill()
                    return
                self.chunks.append(chunk)
        except (OSError, ValueError):
            pass

    def text(self):
        return b"".join(self.chunks).decode("utf-8")


def run_generator(cmd, env, timeout_s=GENERATOR_TIMEOUT_S, limit=GENERATOR_OUTPUT_LIMIT, pass_fds=()):
    """Run the generator with byte-capped stdout/stderr collection.

    Returns the stdout text. Stderr is drained and discarded under the
    same cap (it is never printed: the wrapper reports generator
    failure without echoing generator output). Raises SystemExit when
    either stream exceeds `limit`, when the timeout expires, when the
    child exits non-zero, or when stdout is not UTF-8 — all without
    echoing captured content. `pass_fds` are inherited by the child
    (used for the data-key pipe; see main).
    """
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, pass_fds=pass_fds)
    out = _CappedStream(proc.stdout, limit, proc, "stdout")
    err = _CappedStream(proc.stderr, limit, proc, "stderr")
    t_out = threading.Thread(target=out.run, daemon=True)
    t_err = threading.Thread(target=err.run, daemon=True)
    t_out.start()
    t_err.start()
    try:
        proc.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        raise SystemExit("wallet-core generation timed out") from None
    t_out.join(timeout=5)
    t_err.join(timeout=5)
    for stream in (out, err):
        if stream.overflow:
            proc.kill()
            raise SystemExit(
                f"wallet-core generation exceeded the {limit}-byte "
                f"{stream.name} limit"
            )
    if proc.returncode != 0:
        raise SystemExit("wallet-core generation failed; stderr suppressed")
    try:
        return out.text()
    except UnicodeDecodeError:
        raise SystemExit("generator stdout malformed: not UTF-8") from None


@contextlib.contextmanager
def _data_key_pipe(data_key):
    """Yield the read end of an anonymous pipe pre-filled with the data key.

    R05 r2a hardening of the T41 pipe handoff: the write end is closed
    before yielding, and the read end is closed on EVERY exit path — a
    failed or short write, an exception in the caller, or normal return —
    so no failure between pipe creation and the child spawn can leak the
    read descriptor with unread key bytes. The caller passes the yielded
    fd via pass_fds; that alone makes it inheritable in the child
    (verified first-hand: a non-inheritable fd in pass_fds is readable
    by the child), so no os.set_inheritable call is needed. A short
    write raises instead of silently handing the child a truncated key.
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


def _assert_trusted_executable(path: str) -> None:
    real = os.path.realpath(path)
    directory = os.path.dirname(real)
    directory_stat = os.stat(directory)
    mode = directory_stat.st_mode
    if directory_stat.st_uid not in (0, os.getuid()):
        raise SystemExit(
            "refusing node executable in a directory not owned by you or root; "
            "set BAWA_NODE to a trusted absolute node path"
        )
    if (mode & 0o022) and (mode & 0o1000) == 0:
        raise SystemExit(
            "refusing node executable in a non-sticky group/other-writable directory; "
            "set BAWA_NODE to a trusted absolute node path"
        )
    try:
        executable_stat = os.stat(real)
    except OSError:
        raise SystemExit(
            "refusing node executable that cannot be inspected; "
            "set BAWA_NODE to a trusted absolute node path"
        )
    if executable_stat.st_uid not in (0, os.getuid()):
        raise SystemExit(
            "refusing node executable not owned by you or root; "
            "set BAWA_NODE to a trusted absolute node path"
        )
    if executable_stat.st_mode & 0o022:
        raise SystemExit(
            "refusing group/other-writable node executable; "
            "set BAWA_NODE to a trusted absolute node path"
        )


def _resolve_node() -> str:
    # BAWA_NODE: explicit override for a trusted node executable.
    override = os.environ.get("BAWA_NODE")
    if override:
        if not os.path.isabs(override) or not os.path.isfile(override):
            raise SystemExit("BAWA_NODE must be an absolute path to an existing file")
        return override
    resolved = shutil.which("node")
    if resolved is None:
        return "/usr/bin/node"
    _assert_trusted_executable(resolved)
    return resolved


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

    node = _resolve_node()
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
    # the bundle afterwards. T41: the key reaches the generator over an
    # inherited anonymous pipe (BAWA_DATA_KEY_FD), never the environment:
    # a key in the child's environment is visible in /proc/<pid>/environ
    # to same-user processes, and the hex-string copies cannot be zeroed.
    # The key is written into the pipe before spawn (32 bytes fits the
    # pipe buffer) and the write end is closed in the parent; the child
    # reads exactly 32 bytes and closes its read end. The outer finally
    # zeroes the wrapper's copy on every path after this point — a
    # generator failure, malformed stdout, failed check or scan error
    # must not skip the wipe. R05 r2a: the pipe itself lives in
    # _data_key_pipe, which closes the read end on every exit path
    # (including a failed or short write) and needs no
    # os.set_inheritable call — pass_fds alone makes the fd
    # inheritable in the child.
    data_key = bytearray(secrets.token_bytes(32))
    try:
        with _data_key_pipe(data_key) as key_r:
            child_env = os.environ.copy()
            child_env.pop("BAWA_DATA_KEY_HEX", None)
            child_env["BAWA_DATA_KEY_FD"] = str(key_r)
            # F-14: capped collection (see run_generator). The wrapper never
            # echoes generator output: a malformed stdout fails with a generic
            # message, and the ten-key schema check below bounds the accepted
            # JSON structure.
            stdout_text = run_generator(cmd, child_env, pass_fds=(key_r,))
            try:
                data = json.loads(stdout_text)
            except json.JSONDecodeError:
                raise SystemExit("generator stdout malformed: invalid JSON") from None
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
            # Then require the decrypted mnemonic to reproduce the reported
            # public roots (see assert_bundle_matches_public_roots).
            mnemonic = assert_bundle_decrypts(reported, data_key)
            assert_bundle_matches_public_roots(mnemonic, data)
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
    # Versioned (T43 r1b Fix 3 / F1): a --force regenerate must not
    # silently destroy the previous backup — the only backup of the old
    # wallet — by overwriting seed.enc.json in place.
    _copy_versioned_0600(reported, os.path.join(backup_dir, "seed.enc.json"))

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
    # Random temp name + fsync ordering (T43 r1b Fix 3 / F10): the old
    # predictable env_path + ".tmp" with unlink-then-reopen had a TOCTOU
    # window, and the post-replace pathname chmod could race a swapped
    # symlink. mkstemp creates an exclusively owned 0600 temp that
    # already carries the mode through os.replace; the directory is
    # fsynced after the replace so the rename is durable.
    env_dir = os.path.dirname(os.path.abspath(env_path)) or "."
    _makedirs_0700_fsynced(env_dir)
    fd, tmp_env = tempfile.mkstemp(prefix=".env.", dir=env_dir)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(new_env)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_env, env_path)
        tmp_env = None
        _fsync_dir(env_dir)
    finally:
        if tmp_env is not None:
            try:
                os.unlink(tmp_env)
            except FileNotFoundError:
                pass

    print("Wallet generation and public configuration update completed.")
    print("Public roots:")
    print(f"  BTC zpub: {data['btc_zpub']}")
    print(f"  ETH xpub: {data['eth_xpub']}")
    print(f"  TRX xpub: {data['trx_xpub']}")
    print(f"  TON:      {data['ton_address']} (reported by generator; not independently cross-checked)")
    print(f"Encrypted recovery artifact: {reported} (0600)")
    print(f"Backup bundle: {backup_dir}")


if __name__ == "__main__":
    main()
