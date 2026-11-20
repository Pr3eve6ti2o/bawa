#!/usr/bin/env python3
"""Fail-closed guard for the ecdsa 0.19.2 residual-risk acceptance (ADR-0008).

Asserts at gate time that the safety facts the acceptance rests on still
hold: coincurve is the active secp256k1 backend, coincurve and ecdsa are
pinned (not floating) in requirements.lock, and no file under tools/
imports ecdsa or nist256p1. If any assertion fails, the gate fails.

Runnable with plain `python3 test/test_ecdsa_guard.py` — no pytest, no
network. No real wallet material.
"""
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestEcdsaGuard(unittest.TestCase):
    def test_coincurve_is_active_backend(self):
        from bip_utils.ecc.conf import EccConf

        self.assertIs(EccConf.USE_COINCURVE, True)

    def test_coincurve_and_ecdsa_pinned(self):
        lock = os.path.join(ROOT, "requirements.lock")
        with open(lock, encoding="utf-8") as fh:
            text = fh.read()
        self.assertRegex(text, r"(?m)^coincurve==21\.0\.0\b")
        self.assertRegex(text, r"(?m)^ecdsa==0\.19\.2\b")

    def test_no_tools_import_of_ecdsa_or_nist256p1(self):
        tools = os.path.join(ROOT, "tools")
        pattern = re.compile(
            r"^\s*(?:import|from)\s+(?:ecdsa|nist256p1)\b", re.M
        )
        offenders = []
        for dirpath, dirnames, filenames in os.walk(tools):
            dirnames[:] = [
                d for d in dirnames if d not in ("node_modules", "__pycache__")
            ]
            for name in filenames:
                if not name.endswith(".py"):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, encoding="utf-8") as fh:
                    if pattern.search(fh.read()):
                        offenders.append(os.path.relpath(path, ROOT))
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
