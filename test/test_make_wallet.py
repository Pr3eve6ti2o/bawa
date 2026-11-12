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
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from unittest import mock

from make_wallet import (
    BASE,
    _assert_trusted_executable,
    _contains_seed_material,
    _copy_0600,
    _copy_versioned_0600,
    _data_key_pipe,
    _makedirs_0700_fsynced,
    _parse_seed_bundle,
    _resolve_node,
    assert_bundle_decrypts,
    assert_bundle_matches_public_roots,
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
        "ton_note": "single address per wallet; no xpub exported; TON address not independently cross-checked",
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

    def test_oversize_bundle_refused(self):
        # T43 F6 / r1b Fix 3: bundles over 64 KiB are refused before
        # json.load reads the whole file.
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "seed.enc.json")
            with open(path, "wb") as f:
                f.write(b"x" * 65537)
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(path)

    def test_fifo_bundle_refused_promptly(self):
        # T43 c3a §2: a FIFO at the path must not block the open.
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            fifo = os.path.join(tmp, "seed.enc.json")
            os.mkfifo(fifo)
            with self.assertRaises(SystemExit):
                _parse_seed_bundle(fifo)


class TestCopy0600(unittest.TestCase):
    # T43 r1b Fix 3 / r1d rework: temp + verify + atomic replace + fsync.

    def test_round_trip_bytes_and_mode(self):
        import stat
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.json")
            dst = os.path.join(tmp, "sub", "seed.enc.json")
            with open(src, "wb") as f:
                f.write(b'{"bundle": 1}')
            _copy_0600(src, dst)
            with open(dst, "rb") as f:
                self.assertEqual(f.read(), b'{"bundle": 1}')
            self.assertEqual(stat.S_IMODE(os.stat(dst).st_mode), 0o600)
            self.assertEqual(os.listdir(os.path.join(tmp, "sub")), ["seed.enc.json"])

    def test_symlinked_src_refused(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "target")
            with open(target, "w") as f:
                f.write("sentinel")
            link = os.path.join(tmp, "link")
            os.symlink(target, link)
            with self.assertRaises(SystemExit):
                _copy_0600(link, os.path.join(tmp, "dst"))
            with open(target) as f:
                self.assertEqual(f.read(), "sentinel")

    def test_symlinked_dst_refused_without_touching_victim(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src")
            with open(src, "w") as f:
                f.write("new")
            victim = os.path.join(tmp, "victim")
            with open(victim, "w") as f:
                f.write("victim-bytes")
            link = os.path.join(tmp, "dst")
            os.symlink(victim, link)
            with self.assertRaises(SystemExit):
                _copy_0600(src, link)
            with open(victim) as f:
                self.assertEqual(f.read(), "victim-bytes")

    def test_fifo_src_refused_promptly(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            fifo = os.path.join(tmp, "fifo")
            os.mkfifo(fifo)
            with self.assertRaises(SystemExit):
                _copy_0600(fifo, os.path.join(tmp, "dst"))

    def test_oversize_src_refused_without_creating_dst(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "big")
            with open(src, "wb") as f:
                f.write(b"x" * (1024 * 1024 + 1))
            with self.assertRaises(SystemExit):
                _copy_0600(src, os.path.join(tmp, "dst"))
            self.assertFalse(os.path.exists(os.path.join(tmp, "dst")))


class TestCopyVersioned0600(unittest.TestCase):
    # T43 r1b Fix 3 / F1: a second copy must preserve the first bundle
    # as a versioned archive instead of silently overwriting it.

    def test_second_copy_preserves_first_as_archive(self):
        import stat
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            dst = os.path.join(tmp, "seed.enc.json")
            src1 = os.path.join(tmp, "one")
            src2 = os.path.join(tmp, "two")
            with open(src1, "wb") as f:
                f.write(b"bundle-one")
            with open(src2, "wb") as f:
                f.write(b"bundle-two")
            _copy_versioned_0600(src1, dst)
            _copy_versioned_0600(src2, dst)
            with open(dst, "rb") as f:
                self.assertEqual(f.read(), b"bundle-two")
            archives = [n for n in os.listdir(tmp) if ".bak." in n]
            self.assertEqual(len(archives), 1)
            with open(os.path.join(tmp, archives[0]), "rb") as f:
                self.assertEqual(f.read(), b"bundle-one")
            self.assertEqual(
                stat.S_IMODE(os.stat(os.path.join(tmp, archives[0])).st_mode),
                0o600,
            )

    def test_failing_copy_leaves_old_dst_and_archive(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            dst = os.path.join(tmp, "seed.enc.json")
            src1 = os.path.join(tmp, "one")
            with open(src1, "wb") as f:
                f.write(b"bundle-one")
            _copy_versioned_0600(src1, dst)
            missing = os.path.join(tmp, "does-not-exist")
            with self.assertRaises(OSError):
                _copy_versioned_0600(missing, dst)
            with open(dst, "rb") as f:
                self.assertEqual(f.read(), b"bundle-one")
            archives = [n for n in os.listdir(tmp) if ".bak." in n]
            self.assertEqual(len(archives), 1)


class TestMakedirs0700Fsynced(unittest.TestCase):
    # T43 r1d §3: fresh ancestor chains are created at 0700; existing
    # directories are left untouched.

    def test_fresh_nested_dirs_created_at_0700(self):
        import stat
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "a", "b", "c")
            _makedirs_0700_fsynced(target)
            for directory in (
                os.path.join(tmp, "a"),
                os.path.join(tmp, "a", "b"),
                target,
            ):
                self.assertEqual(stat.S_IMODE(os.stat(directory).st_mode), 0o700)

    def test_existing_dirs_untouched_and_idempotent(self):
        import stat
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "a", "b")
            os.makedirs(target, mode=0o755)
            os.chmod(os.path.join(tmp, "a"), 0o751)
            _makedirs_0700_fsynced(target)
            _makedirs_0700_fsynced(target)
            self.assertEqual(
                stat.S_IMODE(os.stat(os.path.join(tmp, "a")).st_mode), 0o751
            )
            self.assertEqual(stat.S_IMODE(os.stat(target).st_mode), 0o755)


class TestAssertBundleDecryptsReturnsMnemonic(unittest.TestCase):
    """T41: the decrypted mnemonic is returned for the roots check."""

    def test_returns_validated_mnemonic(self):
        import json
        import tempfile

        key = os.urandom(32)
        mnemonic = " ".join(["abandon"] * 23 + ["art"])
        nonce = os.urandom(12)
        ct = AESGCM(key).encrypt(nonce, mnemonic.encode("utf-8"), b"nova-shop-seed-v1")
        bundle = {
            "alg": "AES-256-GCM",
            "nonce_b64": base64.b64encode(nonce).decode(),
            "ciphertext_b64": base64.b64encode(ct).decode(),
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "seed.enc.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(bundle, f)
            self.assertEqual(assert_bundle_decrypts(path, key), mnemonic)


class TestBundleMatchesPublicRoots(unittest.TestCase):
    """T41: the decrypted bundle must reproduce the reported public roots.

    Fixtures are the repo's published BIP-39 test vector (the same
    mnemonic shipped in tools/hdwallet-gen/generate.js). The expected
    roots were verified first-hand against wallet-core 4.8.4 output AND
    an independent bip_utils derivation — both agree.
    """

    VEC_MNEMONIC = (
        "ripple scissors kick mammal hire column oak again sun offer "
        "wealth tomorrow wagon turn fatal"
    )
    VEC_DATA = {
        "btc_zpub": "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9",
        "eth_xpub": "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc",
        "trx_xpub": "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF",
        "samples": {
            "btc1": "bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za",
            "eth1": "0xD6c3112a8Db4991a7359018F15e501dfEE316d59",
            "trx1": "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B",
        },
    }

    def test_matching_roots_pass(self):
        assert_bundle_matches_public_roots(self.VEC_MNEMONIC, self.VEC_DATA)

    def test_wrong_zpub_rejected(self):
        import copy

        data = copy.deepcopy(self.VEC_DATA)
        data["btc_zpub"] = "zpub" + "1" * 107
        with self.assertRaises(SystemExit) as caught:
            assert_bundle_matches_public_roots(self.VEC_MNEMONIC, data)
        self.assertIn("btc_zpub", str(caught.exception))

    def test_wrong_sample_rejected(self):
        import copy

        data = copy.deepcopy(self.VEC_DATA)
        data["samples"]["eth1"] = "0x0000000000000000000000000000000000000000"
        with self.assertRaises(SystemExit) as caught:
            assert_bundle_matches_public_roots(self.VEC_MNEMONIC, data)
        self.assertIn("eth1", str(caught.exception))

    def test_different_mnemonic_rejected(self):
        other = " ".join(["abandon"] * 23 + ["art"])
        with self.assertRaises(SystemExit):
            assert_bundle_matches_public_roots(other, self.VEC_DATA)


class TestSeedMaterialScanImportError(unittest.TestCase):
    """T41: a missing wordlist fails closed with a clear diagnostic."""

    def test_missing_bip_utils_raises_system_exit(self):
        import make_wallet

        previous = make_wallet._BIP39_WORDS
        make_wallet._BIP39_WORDS = None
        original = make_wallet._bip39_english_words
        make_wallet._bip39_english_words = lambda: (_ for _ in ()).throw(
            ImportError("bip_utils missing")
        )
        try:
            with self.assertRaises(SystemExit) as caught:
                _contains_seed_material({"checks": []})
            self.assertIn("bip-utils", str(caught.exception))
        finally:
            make_wallet._bip39_english_words = original
            make_wallet._BIP39_WORDS = previous


class TestRunGeneratorPassFds(unittest.TestCase):
    """T41: the data-key pipe reaches the child through run_generator."""

    def test_fd_handoff_delivers_key_bytes(self):
        import tempfile

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
            key_r, key_w = os.pipe()
            os.set_inheritable(key_r, True)
            try:
                os.write(key_w, key)
            finally:
                os.close(key_w)
            env = dict(os.environ)
            env["BAWA_DATA_KEY_FD"] = str(key_r)
            try:
                out = run_generator(
                    [sys.executable, path], env, pass_fds=(key_r,)
                )
            finally:
                os.close(key_r)
            self.assertEqual(out, "got:32:" + key.hex())


class TestDataKeyPipe(unittest.TestCase):
    """R05 r2a: the pipe read end is closed on every exit path."""

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

    def test_pipe_delivers_key_to_child_via_run_generator(self):
        import tempfile

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
                out = run_generator(
                    [sys.executable, path], env, pass_fds=(key_r,)
                )
            self.assertEqual(out, "got:32:" + key.hex())


class TestResolveNode(unittest.TestCase):
    _INVALID_BAWA_NODE_MESSAGE = (
        "BAWA_NODE must be an absolute path to an existing file"
    )
    _DIR_OWNER_MESSAGE = (
        "refusing node executable in a directory "
        "not owned by you or root; set BAWA_NODE to a trusted absolute node path"
    )
    _DIR_NON_STICKY_MESSAGE = (
        "refusing node executable in a non-sticky group/other-writable "
        "directory; set BAWA_NODE to a trusted absolute node path"
    )
    _FILE_OWNER_MESSAGE = (
        "refusing node executable not owned by you or root; "
        "set BAWA_NODE to a trusted absolute node path"
    )
    _FILE_WRITABLE_MESSAGE = (
        "refusing group/other-writable node executable; "
        "set BAWA_NODE to a trusted absolute node path"
    )
    _FILE_UNINSPECTABLE_MESSAGE = (
        "refusing node executable that cannot be inspected; "
        "set BAWA_NODE to a trusted absolute node path"
    )

    def test_bawa_node_absolute_existing_file(self):
        with mock.patch.dict(
            os.environ, {"BAWA_NODE": sys.executable}, clear=True
        ), mock.patch("make_wallet.shutil.which", return_value=None):
            self.assertEqual(_resolve_node(), sys.executable)

    def test_bawa_node_relative_path_is_refused(self):
        with mock.patch.dict(
            os.environ, {"BAWA_NODE": "node"}, clear=True
        ), mock.patch("make_wallet.shutil.which", return_value=None):
            with self.assertRaises(SystemExit) as raised:
                _resolve_node()
        self.assertEqual(str(raised.exception), self._INVALID_BAWA_NODE_MESSAGE)

    def test_bawa_node_nonexistent_absolute_path_is_refused(self):
        with mock.patch.dict(
            os.environ, {"BAWA_NODE": "/nonexistent/node"}, clear=True
        ), mock.patch("make_wallet.shutil.which", return_value=None):
            with self.assertRaises(SystemExit) as raised:
                _resolve_node()
        self.assertEqual(str(raised.exception), self._INVALID_BAWA_NODE_MESSAGE)

    def test_which_node_in_self_owned_private_directory(self):
        node = "/trusted/node"
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch(
            "make_wallet.shutil.which", return_value=node
        ), mock.patch(
            "os.stat",
            return_value=mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
        ):
            self.assertEqual(_resolve_node(), node)

    def test_which_node_in_other_owned_directory_is_refused(self):
        node = "/untrusted/node"
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch(
            "make_wallet.shutil.which", return_value=node
        ), mock.patch(
            "os.stat",
            return_value=mock.Mock(st_mode=0o41777, st_uid=os.getuid() + 1),
        ):
            with self.assertRaises(SystemExit) as raised:
                _resolve_node()
        self.assertEqual(str(raised.exception), self._DIR_OWNER_MESSAGE)

    def test_which_none_uses_fallback(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch(
            "make_wallet.shutil.which", return_value=None
        ):
            self.assertEqual(_resolve_node(), "/usr/bin/node")

    def test_assert_trusted_executable_self_owned_private_directory(self):
        with mock.patch(
            "os.stat",
            return_value=mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
        ):
            _assert_trusted_executable("/trusted/node")

    def test_assert_trusted_executable_root_owned_writable_directory(self):
        with mock.patch(
            "os.stat",
            side_effect=[
                mock.Mock(st_mode=0o41777, st_uid=0),
                mock.Mock(st_mode=0o40755, st_uid=0),
            ],
        ):
            _assert_trusted_executable("/trusted/node")

    def test_assert_trusted_executable_self_owned_non_sticky_writable_directory_is_refused(self):
        with mock.patch(
            "os.stat",
            side_effect=[
                mock.Mock(st_mode=0o40777, st_uid=os.getuid()),
                mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
            ],
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._DIR_NON_STICKY_MESSAGE)

    def test_assert_trusted_executable_other_owned_private_directory_is_refused(self):
        with mock.patch(
            "os.stat",
            return_value=mock.Mock(st_mode=0o40755, st_uid=os.getuid() + 1),
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._DIR_OWNER_MESSAGE)

    def test_assert_trusted_executable_other_owned_file_is_refused(self):
        with mock.patch(
            "os.stat",
            side_effect=[
                mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
                mock.Mock(st_mode=0o40755, st_uid=os.getuid() + 1),
            ],
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._FILE_OWNER_MESSAGE)

    def test_assert_trusted_executable_group_writable_file_is_refused(self):
        with mock.patch(
            "os.stat",
            side_effect=[
                mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
                mock.Mock(st_mode=0o40777, st_uid=os.getuid()),
            ],
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._FILE_WRITABLE_MESSAGE)

    def test_assert_trusted_executable_uninspectable_file_is_refused(self):
        with mock.patch(
            "os.stat",
            side_effect=[
                mock.Mock(st_mode=0o40755, st_uid=os.getuid()),
                OSError("gone"),
            ],
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._FILE_UNINSPECTABLE_MESSAGE)

    def test_assert_trusted_executable_other_owned_writable_directory(self):
        with mock.patch(
            "os.stat",
            return_value=mock.Mock(st_mode=0o41777, st_uid=os.getuid() + 1),
        ):
            with self.assertRaises(SystemExit) as raised:
                _assert_trusted_executable("/untrusted/node")
        self.assertEqual(str(raised.exception), self._DIR_OWNER_MESSAGE)


if __name__ == "__main__":
    unittest.main()
