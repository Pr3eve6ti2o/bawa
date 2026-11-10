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


if __name__ == "__main__":
    unittest.main()
