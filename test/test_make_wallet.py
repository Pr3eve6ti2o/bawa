#!/usr/bin/env python3
"""Tests for tools/make_wallet.py bundle checks (A-3, A-8).

Runnable with plain `python3 test/test_make_wallet.py` — no pytest, no TTY,
no network. Uses fresh random test keys only; no real wallet material.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import make_wallet
from make_wallet import (
    _data_key_pipe,
    _parse_seed_bundle,
    assertBundleVerified,
    assert_bundle_decrypts,
    main,
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

    def test_tampered_checksum_word_rejected(self):
        import tempfile

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["zoo"])
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(mnemonic.encode("utf-8"), key, tmp)
            with self.assertRaises(SystemExit):
                assert_bundle_decrypts(path, key)

    def test_missing_mnemonic_package_rejected(self):
        import builtins
        import tempfile
        from unittest.mock import patch

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["art"])
        real_import = builtins.__import__

        def block_mnemonic_import(name, *args, **kwargs):
            if name == "mnemonic" or name.startswith("mnemonic."):
                raise ImportError("simulated missing mnemonic package")
            return real_import(name, *args, **kwargs)

        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_bundle(mnemonic.encode("utf-8"), key, tmp)
            with patch("builtins.__import__", new=block_mnemonic_import):
                with self.assertRaisesRegex(
                    SystemExit,
                    "seed bundle independent verification failed: "
                    "mnemonic package is not installed",
                ):
                    assert_bundle_decrypts(path, key)


class TestTrezorMnemonicLibrary(unittest.TestCase):
    def test_generate_256_bit_mnemonic(self):
        from mnemonic import Mnemonic

        m = Mnemonic("english")
        words = m.generate(strength=256)
        self.assertEqual(len(words.split()), 24)
        self.assertIs(m.check(words), True)
        self.assertEqual(len(m.to_entropy(words)), 32)

    def test_seed_matches_bip_utils(self):
        from bip_utils import Bip39SeedGenerator
        from mnemonic import Mnemonic

        words = " ".join(["abandon"] * 23 + ["art"])
        seed = Mnemonic("english").to_seed(words, passphrase="")
        self.assertEqual(len(seed), 64)
        self.assertEqual(seed, Bip39SeedGenerator(words).Generate())


class TestDataKeyPipe(unittest.TestCase):
    """The data-key pipe (ported from the panel branch): the pipe read end
    is closed on every exit path, and the key reaches a child process."""

    def test_normal_exit_closes_read_end(self):
        key = os.urandom(32)
        with _data_key_pipe(key) as key_r:
            self.assertEqual(os.read(key_r, 32), key)
        with self.assertRaises(OSError):
            os.fstat(key_r)

    def test_exception_in_body_closes_read_end(self):
        key = os.urandom(32)
        seen = []
        with self.assertRaises(RuntimeError):
            with _data_key_pipe(key) as key_r:
                seen.append(key_r)
                raise RuntimeError("boom")
        with self.assertRaises(OSError):
            os.fstat(seen[0])

    def test_short_write_raises_and_leaks_no_fd(self):
        before = set(os.listdir("/proc/self/fd"))
        with mock.patch("os.write", return_value=0):
            with self.assertRaises(SystemExit):
                with _data_key_pipe(os.urandom(32)):
                    pass
        self.assertEqual(before, set(os.listdir("/proc/self/fd")))

    def test_failed_write_closes_read_end(self):
        before = set(os.listdir("/proc/self/fd"))
        with mock.patch("os.write", side_effect=OSError("boom")):
            with self.assertRaises(OSError):
                with _data_key_pipe(os.urandom(32)):
                    pass
        self.assertEqual(before, set(os.listdir("/proc/self/fd")))

    def test_pipe_delivers_key_to_child(self):
        # The child is a real process: it reads the inherited fd and
        # prints the key bytes back. main() uses subprocess.run with
        # pass_fds, so this test uses the same call (the panel branch
        # used its run_generator helper for the same check).
        key = os.urandom(32)
        body = (
            "import os, sys\n"
            "fd = int(os.environ['BAWA_DATA_KEY_FD'])\n"
            "data = os.read(fd, 32)\n"
            "sys.stdout.write('got:%d:%s' % (len(data), data.hex()))\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "fd_reader.py")
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            with _data_key_pipe(key) as key_r:
                env = dict(os.environ)
                env["BAWA_DATA_KEY_FD"] = str(key_r)
                proc = subprocess.run(
                    [sys.executable, path],
                    capture_output=True,
                    text=True,
                    env=env,
                    pass_fds=(key_r,),
                )
            self.assertEqual(proc.returncode, 0)
            self.assertEqual(proc.stdout, "got:32:" + key.hex())


class TestMainWiresBundleDecrypt(unittest.TestCase):
    """main() generates the data key, hands it to the generator over the
    pipe, and independently verifies the bundle with it. The generator
    is mocked (no TTY, no WASM); the bundle is real and the decrypt is
    real. Test keys are fresh random bytes, never real wallet material."""

    _MNEMONIC = " ".join(["abandon"] * 23 + ["art"])

    def _write_bundle(self, plaintext, key, path):
        nonce = os.urandom(12)
        ct = AESGCM(key).encrypt(nonce, plaintext, b"nova-shop-seed-v1")
        bundle = {
            "alg": "AES-256-GCM",
            "nonce_b64": base64.b64encode(nonce).decode(),
            "ciphertext_b64": base64.b64encode(ct).decode(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(bundle, f)
        os.chmod(path, 0o600)
        return path

    def _run_main(self, tmp, bundle_key, wrapper_key):
        """Run main() with a mocked generator. The bundle is encrypted
        with bundle_key; the wrapper is made to generate wrapper_key.
        Returns the mocked subprocess.run call for inspection."""
        import contextlib
        import io

        secrets_dir = os.path.join(tmp, "secrets")
        os.makedirs(secrets_dir, mode=0o700)
        bundle_path = self._write_bundle(
            self._MNEMONIC.encode("utf-8"),
            bundle_key,
            os.path.join(secrets_dir, "seed.enc.json"),
        )
        # The bundle must pre-exist for the assert to read it, so main()
        # runs with --force (it refuses an existing bundle otherwise).
        env = {
            "NOVA_SECRETS_DIR": secrets_dir,
            "BAWA_ENV_FILE": os.path.join(tmp, ".env"),
            "BAWA_BACKUP_DIR": os.path.join(tmp, "backup"),
        }
        stdout = json.dumps(
            {
                "checks": [{"name": "bundle_verified", "ok": True}],
                "btc_zpub": "zpub6TESTBTC123",
                "eth_xpub": "xpub6TESTETH123",
                "trx_xpub": "xpub6TESTTRX123",
                "ton_address": "TTESTTON123",
                "seed_encrypted_to": bundle_path,
            }
        )
        proc = subprocess.CompletedProcess(
            args=["node", "generate.js"], returncode=0, stdout=stdout, stderr=""
        )
        old_argv = sys.argv
        old_environ = dict(os.environ)
        try:
            sys.argv = ["make_wallet.py", "--force"]
            os.environ.update(env)
            with mock.patch.object(
                make_wallet.secrets, "token_bytes", return_value=wrapper_key
            ):
                with mock.patch.object(
                    make_wallet.subprocess, "run", return_value=proc
                ) as run_mock:
                    with contextlib.redirect_stdout(io.StringIO()):
                        main()
                    return run_mock
        finally:
            sys.argv = old_argv
            os.environ.clear()
            os.environ.update(old_environ)

    def test_good_bundle_passes_and_writes_env(self):
        key = os.urandom(32)
        with tempfile.TemporaryDirectory() as tmp:
            run_mock = self._run_main(tmp, key, key)
            # The generator was called with the pipe: the fd number in
            # the env, the fd in pass_fds, and no hex key in the env.
            self.assertEqual(run_mock.call_count, 1)
            kwargs = run_mock.call_args.kwargs
            self.assertIn("BAWA_DATA_KEY_FD", kwargs["env"])
            self.assertNotIn("BAWA_DATA_KEY_HEX", kwargs["env"])
            self.assertRegex(kwargs["env"]["BAWA_DATA_KEY_FD"], r"^\d+$")
            self.assertEqual(len(kwargs["pass_fds"]), 1)
            self.assertIsInstance(kwargs["pass_fds"][0], int)
            # The public config was written from the generator stdout.
            with open(os.path.join(tmp, ".env"), encoding="utf-8") as f:
                env_text = f.read()
            self.assertIn("XPUB_BTC=zpub6TESTBTC123", env_text)
            self.assertIn("XPUB_ETH=xpub6TESTETH123", env_text)
            self.assertIn("XPUB_TRX=xpub6TESTTRX123", env_text)
            self.assertIn("TON_DEPOSIT_ADDRESS=TTESTTON123", env_text)
            # The backup bundle was copied.
            self.assertTrue(
                os.path.isfile(os.path.join(tmp, "backup", "seed.enc.json"))
            )

    def test_bad_bundle_fails_loudly(self):
        # The bundle is encrypted with a different key than the one the
        # wrapper generates: the independent decrypt must fail closed,
        # before any public config is written.
        bundle_key = os.urandom(32)
        wrapper_key = os.urandom(32)
        self.assertNotEqual(bundle_key, wrapper_key)
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(
                SystemExit, "seed bundle independent verification failed"
            ):
                self._run_main(tmp, bundle_key, wrapper_key)
            self.assertFalse(os.path.exists(os.path.join(tmp, ".env")))


if __name__ == "__main__":
    unittest.main()
