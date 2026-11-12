#!/usr/bin/env python3
"""Tests for tools/make_wallet.py bundle checks (A-3, A-8).

Runnable with plain `python3 test/test_make_wallet.py` — no pytest, no TTY,
no network. Uses fresh random test keys only; no real wallet material.
"""
import base64
import contextlib
import io
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from make_wallet import (
    BASE,
    _contains_seed_material,
    _parse_seed_bundle,
    assert_bundle_decrypts,
    assertBundleVerified,
    resolve_secrets_dir,
    run_generator,
    validate_public_stdout,
)


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


class TestResolveSecretsDir(unittest.TestCase):
    def test_new_name_alone(self):
        self.assertEqual(
            resolve_secrets_dir({"BAWA_SECRETS_DIR": "/tmp/bawa-secrets"}),
            "/tmp/bawa-secrets",
        )

    def test_old_name_alone_warns(self):
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            result = resolve_secrets_dir({"NOVA_SECRETS_DIR": "/tmp/legacy-secrets"})
        self.assertEqual(result, "/tmp/legacy-secrets")
        self.assertIn("NOVA_SECRETS_DIR", buf.getvalue())
        self.assertIn("deprecated", buf.getvalue())
        self.assertNotIn("/tmp/legacy-secrets", buf.getvalue())

    def test_both_conflicting_refuses(self):
        with self.assertRaises(SystemExit):
            resolve_secrets_dir({
                "BAWA_SECRETS_DIR": "/tmp/a",
                "NOVA_SECRETS_DIR": "/tmp/b",
            })

    def test_neither_uses_default(self):
        self.assertEqual(resolve_secrets_dir({}), os.path.join(BASE, "secrets"))

    def test_both_matching_uses_new_and_warns(self):
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            result = resolve_secrets_dir({
                "BAWA_SECRETS_DIR": "/tmp/same",
                "NOVA_SECRETS_DIR": "/tmp/same",
            })
        self.assertEqual(result, "/tmp/same")
        self.assertIn("NOVA_SECRETS_DIR", buf.getvalue())
        self.assertNotIn("/tmp/same", buf.getvalue())


_MNEMONIC_24 = " ".join(["abandon"] * 23 + ["art"])
_MNEMONIC_WORDS = _MNEMONIC_24.split()


def _legitimate_stdout():
    return {
        "btc_zpub": "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9",
        "eth_xpub": "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc",
        "trx_xpub": "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF",
        "ton_address": "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn",
        "ton_path": "m/44'/607'/0'",
        "ton_note": "single address per wallet; no xpub exported",
        "samples": {
            "btc1": "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g",
            "eth1": "0xD6c3112a8Db4991a7359018F15e501dfEE316d59",
            "trx1": "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B",
        },
        "checks": [
            {"name": "bundle_verified", "ok": True},
            {"name": "vec_btc", "ok": True},
        ],
        "seed_encrypted_to": "/tmp/secrets/seed.enc.json",
        "wallet_core_version": "4.8.4",
    }


class TestContainsSeedMaterial(unittest.TestCase):
    def test_control_one_string_caught(self):
        self.assertTrue(_contains_seed_material({"note": _MNEMONIC_24}))

    def test_array_of_words_caught(self):
        self.assertTrue(_contains_seed_material({"words": _MNEMONIC_WORDS}))

    def test_uppercase_caught(self):
        self.assertTrue(_contains_seed_material({"note": _MNEMONIC_24.upper()}))

    def test_split_across_values_caught(self):
        self.assertTrue(_contains_seed_material({
            "a": " ".join(_MNEMONIC_WORDS[0:6]),
            "b": " ".join(_MNEMONIC_WORDS[6:12]),
            "c": " ".join(_MNEMONIC_WORDS[12:18]),
            "d": " ".join(_MNEMONIC_WORDS[18:24]),
        }))

    def test_separator_every_six_words_caught(self):
        grouped = [
            " ".join(_MNEMONIC_WORDS[i:i + 6]) for i in range(0, 24, 6)
        ]
        self.assertTrue(_contains_seed_material({"note": ",".join(grouped)}))

    def test_dict_key_caught(self):
        self.assertTrue(_contains_seed_material({_MNEMONIC_24: "value"}))

    def test_legitimate_output_passes(self):
        self.assertFalse(_contains_seed_material(_legitimate_stdout()))


class TestValidatePublicStdout(unittest.TestCase):
    def test_legitimate_output_passes(self):
        validate_public_stdout(_legitimate_stdout())

    def test_unknown_key_rejected(self):
        data = _legitimate_stdout()
        data["surprise"] = "x"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_wrong_type_rejected(self):
        data = _legitimate_stdout()
        data["btc_zpub"] = 42
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_bad_zpub_prefix_rejected(self):
        data = _legitimate_stdout()
        data["btc_zpub"] = "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_newline_in_xpub_rejected(self):
        # T44-F4: a newline inside an xpub would inject an extra
        # assignment into the .env file it is interpolated into.
        data = _legitimate_stdout()
        data["btc_zpub"] = _legitimate_stdout()["btc_zpub"] + "\nEVIL=1\n"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_control_char_in_ton_address_rejected(self):
        data = _legitimate_stdout()
        data["ton_address"] = _legitimate_stdout()["ton_address"] + "\rEVIL=1"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_escape_sequence_in_xpub_rejected(self):
        # T44-F4 (Astra s2): ANSI escapes in a printed xpub could clear
        # the operator's terminal and hide earlier output.
        data = _legitimate_stdout()
        data["eth_xpub"] = "xpub" + "1" * 107 + "\x1b[2J\x1b[H"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_short_xpub_rejected(self):
        data = _legitimate_stdout()
        data["eth_xpub"] = "xpub123"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_bad_ton_address_rejected(self):
        data = _legitimate_stdout()
        data["ton_address"] = "not-a-ton-address"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_bad_ton_path_rejected(self):
        data = _legitimate_stdout()
        data["ton_path"] = "m/44'/60'/0'"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_bad_version_rejected(self):
        data = _legitimate_stdout()
        data["wallet_core_version"] = "4.8.4\nEVIL=1"
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)

    def test_64_hex_string_rejected(self):
        # T44-F18: a hex-encoded seed has no legitimate place in the
        # public schema, even tucked into samples.
        data = _legitimate_stdout()
        data["samples"]["btc1"] = "ab" * 32
        with self.assertRaises(SystemExit):
            validate_public_stdout(data)


class TestAssertBundleDecrypts(unittest.TestCase):
    def _write_bundle(self, plaintext, key, tmp):
        import json

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

    def test_valid_mnemonic_passes(self):
        import tempfile

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["art"])
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(mnemonic.encode("utf-8"), key, tmp)
            assert_bundle_decrypts(path, key)

    def test_corrupt_ciphertext_rejected(self):
        import json
        import tempfile

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["art"])
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(mnemonic.encode("utf-8"), key, tmp)
            with open(path, encoding="utf-8") as f:
                bundle = json.load(f)
            ct = bytearray(base64.b64decode(bundle["ciphertext_b64"]))
            ct[0] ^= 0xFF
            bundle["ciphertext_b64"] = base64.b64encode(bytes(ct)).decode()
            with open(path, "w", encoding="utf-8") as f:
                json.dump(bundle, f)
            with self.assertRaises(SystemExit):
                assert_bundle_decrypts(path, key)

    def test_wrong_key_rejected(self):
        import tempfile

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["art"])
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(mnemonic.encode("utf-8"), key, tmp)
            with self.assertRaises(SystemExit):
                assert_bundle_decrypts(path, os.urandom(32))

    def test_non_mnemonic_plaintext_rejected(self):
        import tempfile

        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(b"test phrase", key, tmp)
            with self.assertRaises(SystemExit):
                assert_bundle_decrypts(path, key)


class TestRunGenerator(unittest.TestCase):
    """F-14: generator output is collected under a byte cap."""

    def _fake_generator(self, tmp, body):
        path = os.path.join(tmp, "fake_gen.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        return [sys.executable, path]

    def test_small_output_passes(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(
                tmp, 'import sys; sys.stdout.write("hello")\n'
            )
            self.assertEqual(run_generator(cmd, dict(os.environ)), "hello")

    def test_stdout_overflow_kills_and_raises(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(
                tmp,
                'import sys\n'
                'for _ in range(8):\n'
                '    sys.stdout.write("x" * 1024)\n'
                '    sys.stdout.flush()\n',
            )
            with self.assertRaises(SystemExit) as caught:
                run_generator(cmd, dict(os.environ), limit=1024)
            self.assertIn("stdout limit", str(caught.exception))

    def test_stderr_overflow_kills_and_raises(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(
                tmp,
                'import sys\n'
                'for _ in range(8):\n'
                '    sys.stderr.write("x" * 1024)\n'
                '    sys.stderr.flush()\n',
            )
            with self.assertRaises(SystemExit) as caught:
                run_generator(cmd, dict(os.environ), limit=1024)
            self.assertIn("stderr limit", str(caught.exception))

    def test_nonzero_exit_raises_without_echo(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(
                tmp,
                'import sys; sys.stderr.write("SECRET-MARKER-1234"); sys.exit(3)\n',
            )
            with self.assertRaises(SystemExit) as caught:
                run_generator(cmd, dict(os.environ))
            self.assertNotIn("SECRET-MARKER-1234", str(caught.exception))

    def test_timeout_kills_and_raises(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(tmp, "import time; time.sleep(30)\n")
            with self.assertRaises(SystemExit) as caught:
                run_generator(cmd, dict(os.environ), timeout_s=2)
            self.assertIn("timed out", str(caught.exception))

    def test_non_utf8_stdout_raises(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            cmd = self._fake_generator(
                tmp, 'import sys; sys.stdout.buffer.write(b"\\xff\\xfe")\n'
            )
            with self.assertRaises(SystemExit):
                run_generator(cmd, dict(os.environ))


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
