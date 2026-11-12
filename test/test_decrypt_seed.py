#!/usr/bin/env python3
"""Tests for tools/decrypt_seed.py BIP-39 validation (F-38) and the
environment-key warning (F-37).

Runnable with plain `python3 test/test_decrypt_seed.py` — no pytest, no
TTY, no network. Uses fresh random test keys only; no real wallet
material. The "abandon" x23 + "art" vector is the published BIP-39 test
mnemonic, never for funds.
"""
import base64
import contextlib
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from decrypt_seed import _read_key, decrypt

TOOLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tools"))

_MNEMONIC_24 = " ".join(["abandon"] * 23 + ["art"])
_NON_WORD = " ".join(["abandon"] * 23 + ["zzzz"])
_BAD_CHECKSUM = " ".join(["abandon"] * 23 + ["about"])


def _write_bundle(plaintext, key, tmp):
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, b"nova-shop-seed-v1")
    bundle = {
        "alg": "AES-256-GCM",
        "nonce_b64": base64.b64encode(nonce).decode(),
        "ciphertext_b64": base64.b64encode(ct).decode(),
    }
    path = os.path.join(tmp, "seed.enc.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(bundle, f)
    return path


class TestDecryptMnemonicValidation(unittest.TestCase):
    def test_valid_mnemonic_returned(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_MNEMONIC_24.encode("utf-8"), key, tmp)
            self.assertEqual(decrypt(path, key), _MNEMONIC_24)

    def test_non_wordlist_word_refused(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_NON_WORD.encode("utf-8"), key, tmp)
            with self.assertRaises(ValueError):
                decrypt(path, key)

    def test_bad_checksum_refused(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_BAD_CHECKSUM.encode("utf-8"), key, tmp)
            with self.assertRaises(ValueError):
                decrypt(path, key)

    def test_wrong_word_count_refused(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(b"abandon abandon", key, tmp)
            with self.assertRaises(ValueError):
                decrypt(path, key)

    def test_wrong_key_refused_as_value_error(self):
        # T44-F10: a wrong key must raise the clean ValueError, not
        # leak cryptography's InvalidTag out of decrypt().
        key = os.urandom(32)
        wrong_key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_MNEMONIC_24.encode("utf-8"), key, tmp)
            with self.assertRaises(ValueError):
                decrypt(path, wrong_key)

    def test_fifo_bundle_refused_promptly(self):
        # T43 c3a §2 / r2a Fix 3: without O_NONBLOCK a FIFO at the path
        # blocks the open forever with no writer; the fstat check must
        # refuse it as a non-regular file instead.
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            fifo = os.path.join(tmp, "seed.enc.json")
            os.mkfifo(fifo)
            with self.assertRaises(ValueError):
                decrypt(fifo, key)


class TestReadKey(unittest.TestCase):
    def test_env_key_warns_and_names_only_the_variable(self):
        key = os.urandom(32)
        buf = io.StringIO()
        with mock.patch.dict(os.environ, {"BAWA_DATA_KEY": key.hex()}):
            with contextlib.redirect_stderr(buf):
                self.assertEqual(_read_key(), key)
        warning = buf.getvalue()
        self.assertIn("BAWA_DATA_KEY", warning)
        self.assertIn("prefer the non-echoing prompt", warning)
        self.assertNotIn(key.hex(), warning)

    def test_prompt_path_reads_without_warning(self):
        key = os.urandom(32)
        env = dict(os.environ)
        env.pop("BAWA_DATA_KEY", None)
        buf = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True):
            with mock.patch("getpass.getpass", return_value=key.hex()):
                with contextlib.redirect_stderr(buf):
                    self.assertEqual(_read_key(), key)
        self.assertEqual(buf.getvalue(), "")


class TestMainStdout(unittest.TestCase):
    def _run_cli(self, plaintext, key):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(plaintext, key, tmp)
            env = dict(os.environ, BAWA_DATA_KEY=key.hex())
            result = subprocess.run(
                [sys.executable, os.path.join(TOOLS_DIR, "decrypt_seed.py"),
                 "--stdout", path],
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )
            return result

    def test_stdout_valid_mnemonic_exits_zero(self):
        key = os.urandom(32)
        result = self._run_cli(_MNEMONIC_24.encode("utf-8"), key)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), _MNEMONIC_24)

    def test_stdout_bad_checksum_exits_one(self):
        key = os.urandom(32)
        result = self._run_cli(_BAD_CHECKSUM.encode("utf-8"), key)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertIn("not a valid BIP-39 mnemonic", result.stderr)

    def test_stdout_wrong_key_exits_one_without_traceback(self):
        # T44-F10: the CLI must report a clean error, never a traceback.
        key = os.urandom(32)
        wrong_key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_MNEMONIC_24.encode("utf-8"), key, tmp)
            env = dict(os.environ, BAWA_DATA_KEY=wrong_key.hex())
            result = subprocess.run(
                [sys.executable, os.path.join(TOOLS_DIR, "decrypt_seed.py"),
                 "--stdout", path],
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertNotIn("Traceback", result.stderr)
        self.assertIn("authentication failed", result.stderr)


class TestMainOutput(unittest.TestCase):
    """T41: --output writes a private file and refuses to clobber."""

    def _run_cli_output(self, plaintext, key, out_path, extra_env=None):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(plaintext, key, tmp)
            env = dict(os.environ, BAWA_DATA_KEY=key.hex())
            if extra_env:
                env.update(extra_env)
            result = subprocess.run(
                [sys.executable, os.path.join(TOOLS_DIR, "decrypt_seed.py"),
                 "--output", out_path, path],
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )
            return result

    def test_output_writes_0600_file(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            out_path = os.path.join(tmp, "recovered.txt")
            result = self._run_cli_output(_MNEMONIC_24.encode("utf-8"), key, out_path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(stat.S_IMODE(os.stat(out_path).st_mode), 0o600)
            with open(out_path, encoding="utf-8") as f:
                self.assertEqual(f.read().strip(), _MNEMONIC_24)

    def test_output_refuses_existing_destination(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            out_path = os.path.join(tmp, "recovered.txt")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("previous recovery — must survive\n")
            result = self._run_cli_output(_MNEMONIC_24.encode("utf-8"), key, out_path)
            self.assertEqual(result.returncode, 1)
            with open(out_path, encoding="utf-8") as f:
                self.assertEqual(
                    f.read(), "previous recovery — must survive\n"
                )

    def test_output_refuses_symlink_destination(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "target.txt")
            link = os.path.join(tmp, "link.txt")
            os.symlink(target, link)
            result = self._run_cli_output(_MNEMONIC_24.encode("utf-8"), key, link)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(os.path.exists(target))

    def test_output_creates_private_parent_dirs(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            nested = os.path.join(tmp, "a", "b")
            out_path = os.path.join(nested, "recovered.txt")
            result = self._run_cli_output(_MNEMONIC_24.encode("utf-8"), key, out_path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(stat.S_IMODE(os.stat(nested).st_mode), 0o700)


class TestDecryptTamperAndSize(unittest.TestCase):
    """T41: tampering and oversized bundles are refused."""

    def test_tampered_ciphertext_rejected(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_bundle(_MNEMONIC_24.encode("utf-8"), key, tmp)
            with open(path, encoding="utf-8") as f:
                bundle = json.load(f)
            ct = bytearray(base64.b64decode(bundle["ciphertext_b64"]))
            ct[0] ^= 0xFF
            bundle["ciphertext_b64"] = base64.b64encode(bytes(ct)).decode()
            with open(path, "w", encoding="utf-8") as f:
                json.dump(bundle, f)
            with self.assertRaises(ValueError):
                decrypt(path, key)

    def test_oversized_bundle_rejected(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "seed.enc.json")
            with open(path, "w", encoding="utf-8") as f:
                f.write("x" * 70000)
            with self.assertRaises(ValueError):
                decrypt(path, key)

    def test_symlinked_bundle_rejected(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            real = _write_bundle(_MNEMONIC_24.encode("utf-8"), key, tmp)
            link = os.path.join(tmp, "link.json")
            os.symlink(real, link)
            with self.assertRaises(ValueError):
                decrypt(link, key)


class TestReadKeyInvalidEnv(unittest.TestCase):
    """T41: an unusable env key falls through to the prompt."""

    def test_invalid_hex_env_falls_through_to_prompt(self):
        key = os.urandom(32)
        buf = io.StringIO()
        with mock.patch.dict(os.environ, {"BAWA_DATA_KEY": "not-hex!!"}):
            with mock.patch("getpass.getpass", return_value=key.hex()):
                with contextlib.redirect_stderr(buf):
                    self.assertEqual(_read_key(), key)
        self.assertIn("BAWA_DATA_KEY", buf.getvalue())
        self.assertIn("ignoring it", buf.getvalue())

    def test_wrong_length_env_falls_through_to_prompt(self):
        key = os.urandom(32)
        buf = io.StringIO()
        with mock.patch.dict(os.environ, {"BAWA_DATA_KEY": "abcd"}):
            with mock.patch("getpass.getpass", return_value=key.hex()):
                with contextlib.redirect_stderr(buf):
                    self.assertEqual(_read_key(), key)
        self.assertIn("not 32 bytes", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
