#!/usr/bin/env python3
"""Tests for tools/make_wallet.py bundle checks (A-3, A-8).

Runnable with plain `python3 test/test_make_wallet.py` — no pytest, no TTY,
no network. Uses fresh random test keys only; no real wallet material.
"""
import base64
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from make_wallet import _parse_seed_bundle, assertBundleVerified


def _good_bundle():
    key = os.urandom(32)
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, b"test phrase", b"nova-shop-seed-v1")
    return {
        "alg": "AES-256-GCM",
        "nonce_b64": base64.b64encode(nonce).decode(),
        "ciphertext_b64": base64.b64encode(ct).decode(),
    }


class TestAssertBundleVerified(unittest.TestCase):
    def test_present_and_ok_passes(self):
        assertBundleVerified({"checks": [{"name": "bundle_verified", "ok": True}]})

    def test_absent_raises(self):
        with self.assertRaises(SystemExit):
            assertBundleVerified({"checks": [{"name": "other", "ok": True}]})

    def test_present_but_not_ok_raises(self):
        with self.assertRaises(SystemExit):
            assertBundleVerified({"checks": [{"name": "bundle_verified", "ok": False}]})

    def test_checks_missing_raises(self):
        with self.assertRaises(SystemExit):
            assertBundleVerified({})

    def test_not_a_dict_raises(self):
        with self.assertRaises(SystemExit):
            assertBundleVerified(None)


class TestParseSeedBundle(unittest.TestCase):
    def _write(self, bundle, tmp):
        path = os.path.join(tmp, "seed.enc.json")
        import json

        with open(path, "w", encoding="utf-8") as f:
            json.dump(bundle, f)
        return path

    def test_well_formed_accepted(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            nonce, ct, mode = _parse_seed_bundle(self._write(_good_bundle(), tmp))
            self.assertEqual(len(nonce), 12)
            self.assertGreaterEqual(len(ct), 16)
            self.assertIsInstance(mode, int)

    def test_malformed_json_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = self._write(_good_bundle(), tmp)
            with open(path, "w", encoding="utf-8") as f:
                f.write("{")
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(path)

    def test_non_object_root_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = self._write([], tmp)
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(path)

    def test_invalid_utf8_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = self._write(_good_bundle(), tmp)
            with open(path, "wb") as f:
                f.write(b"\xff\xfe{")
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(path)

    def test_missing_file_rejected(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = self._write(_good_bundle(), tmp)
            os.unlink(path)
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(path)

    def test_wrong_alg_rejected(self):
        import tempfile

        b = _good_bundle()
        b["alg"] = "AES-256-CBC"
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(self._write(b, tmp))

    def test_bad_base64_rejected(self):
        import tempfile

        b = _good_bundle()
        b["nonce_b64"] = "!!!not-base64!!!"
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(self._write(b, tmp))

    def test_short_nonce_rejected(self):
        import tempfile

        b = _good_bundle()
        b["nonce_b64"] = base64.b64encode(b"short").decode()
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(self._write(b, tmp))

    def test_short_ciphertext_rejected(self):
        import tempfile

        b = _good_bundle()
        b["ciphertext_b64"] = base64.b64encode(b"short").decode()
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(self._write(b, tmp))


if __name__ == "__main__":
    unittest.main()
