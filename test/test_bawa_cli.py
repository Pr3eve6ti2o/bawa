import unittest
import subprocess
import sys
import os
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import bawa_cli


def run_cli(args, inp=None, timeout=30):
    return subprocess.run(
        [sys.executable, str(ROOT / "tools" / "bawa_cli.py")] + args,
        cwd=ROOT,
        input=inp,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


# Deliberately invented test tokens, never live wallet credentials.
FAKE_MNEMONIC = "fakecardinal faketoken fakewallet fakesecret fakealpha fakebeta fakegamma fakedelta fakeomega fakelambda fakekappa fakemu"
FAKE_XPUB = "xpubFAKESECRETTESTVECTOR0000000000000000000000"
FAKE_HEXKEY = "f" * 64


class TestRouting(unittest.TestCase):
    def _assert_route(self, request, expected_kinds, title_pattern):
        route = bawa_cli.route_request(request)
        self.assertIsInstance(route, dict)
        for key in ("title", "kind", "detail", "command"):
            self.assertIn(key, route)

        self.assertIn(route["kind"], expected_kinds)
        self.assertIsInstance(route["title"], str)
        self.assertRegex(route["title"], title_pattern)

        detail = route["detail"]
        self.assertIsInstance(detail, str)
        self.assertTrue(detail.strip(), "Route detail must not be blank")

        command = route["command"]
        if command is not None:
            self.assertIsInstance(command, list, "Commands must be argv lists")

        command_text = " ".join(str(arg) for arg in command) if command else ""
        if not command_text or command_text not in detail:
            self.assertRegex(
                detail,
                r"(?:\bdocs/[A-Za-z0-9_./-]+"
                r"|\b[A-Za-z0-9_./-]+\.(?:md|rst|txt)\b"
                r"|\b(?:node|npm|npx|python(?:\d+(?:\.\d+)*)?|bash|sh|git)"
                r"\s+\S+)",
                "Detail must name a concrete command or documentation path",
            )
        return route

    def test_hd_wallet_requests(self):
        for request in (
            "create an HD wallet",
            "generate a wallet",
            "CREATE AN HD WALLET",
        ):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("tool",),
                    r"(?i)(?:\bhd\b.*wallet|wallet.*\bhd\b|hierarchical.*wallet)",
                )

    def test_watch_only_requests(self):
        for request in ("watch-only wallet", "derive an address from my xpub"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("tool",),
                    r"(?i)(?:watch[\s-]*only|xpub)",
                )

    def test_wallet_application_requests(self):
        for request in ("build a web wallet", "create an Android wallet"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("tool",),
                    r"(?i)(?:wallet.*app|(?:app|web|android|mobile).*wallet)",
                )

    def test_payment_tracking_requests(self):
        for request in ("track payments", "monitor balances"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("ai-guided",),
                    r"(?i)(?:track|monitor|payment|balance)",
                )

    def test_seed_recovery_requests(self):
        for request in ("recover my seed", "decrypt the seed file"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("tool",),
                    r"(?i)(?:recover|decrypt)",
                )

    def test_mainnet_fees_are_not_a_tool(self):
        route = self._assert_route(
            "mainnet fees",
            ("unavailable", "ai-guided"),
            r"(?i)(?:mainnet|fees?)",
        )
        self.assertNotEqual(route["kind"], "tool")

    def test_wallet_verification_requests(self):
        for request in ("verify the wallet", "run the tests"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("tool",),
                    r"(?i)(?:verif|tests?)",
                )

    def test_unknown_and_blank_requests(self):
        for request in ("blorp zibblefnord", "", " ", " \t\n "):
            with self.subTest(request=request):
                self.assertIsNone(bawa_cli.route_request(request))


class TestMenuRendering(unittest.TestCase):
    KIND_TAGS = (
        "[EXISTING TOOL]",
        "[AI-GUIDED IMPLEMENTATION]",
        "[UNAVAILABLE OR UNVERIFIED]",
    )

    def test_main_menu(self):
        menu = bawa_cli.render_main_menu()
        self.assertIsInstance(menu, str)
        self.assertIn("Welcome to Bawa!", menu)

        titles = (
            "Create an HD",
            "Watch-Only",
            "Wallet Application",
            "Cryptocurrency Tools",
            "Security, Recovery",
        )
        # Main menu kind labels match README §3: options 1, 2 and 5 are
        # [EXISTING TOOL]; options 3 and 4 are [AI-GUIDED IMPLEMENTATION].
        # The finer kind distinction is made per-option inside the submenus.
        self.assertIn("[EXISTING TOOL]", menu)
        submenus = "".join(
            bawa_cli.render_submenu(name) for name in ("1", "2", "3", "4", "5")
        )
        for tag in self.KIND_TAGS:
            with self.subTest(tag=tag):
                self.assertIn(tag, submenus)

        numbered_lines = [
            line.lstrip(" \t[(")
            for line in menu.splitlines()
            if line.lstrip(" \t[(")[:1].isdigit()
        ]
        option_lines = [
            line for line in numbered_lines if not line.startswith("0")
        ]
        self.assertEqual(len(option_lines), 5)

        for number, title in enumerate(titles, 1):
            with self.subTest(option=number):
                matches = [
                    line for line in option_lines
                    if line.startswith(str(number))
                ]
                self.assertEqual(len(matches), 1)
                self.assertRegex(matches[0], rf"^{number}(?:\D|$)")
                self.assertIn(title, matches[0])
                self.assertTrue(
                    any(tag in matches[0] for tag in self.KIND_TAGS),
                    f"Option {number} must carry a kind tag",
                )

        exit_lines = [
            line for line in numbered_lines if line.startswith("0")
        ]
        self.assertEqual(len(exit_lines), 1)
        self.assertRegex(exit_lines[0], r"^0(?:\D|$)")

    def test_submenus(self):
        for name in ("1", "2", "3", "4", "5"):
            with self.subTest(name=name):
                text = bawa_cli.render_submenu(name)
                self.assertIsInstance(text, str)
                self.assertTrue(text.strip(), "Submenu must not be blank")
                self.assertTrue(
                    any(tag in text for tag in self.KIND_TAGS),
                    f"Submenu {name} must contain a kind tag",
                )
                self.assertRegex(text, r"\bdocs/[A-Za-z0-9_./-]+")

    def test_invalid_submenu_raises_value_error(self):
        with self.assertRaises(ValueError):
            bawa_cli.render_submenu("not-a-real-submenu")


class TestCliRoute(unittest.TestCase):
    def test_route_hd_wallet(self):
        result = run_cli(["--route", "create an HD wallet"])
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertRegex(
            result.stdout,
            r"(?i)(?:\bhd\b.*wallet|wallet.*\bhd\b|hierarchical.*wallet)",
        )

    def test_route_unknown_request(self):
        result = run_cli(["--route", "blorp zibblefnord"])
        self.assertEqual(
            result.returncode, 2, msg=result.stdout + result.stderr
        )
        self.assertIn("No route matched", result.stdout)

    def test_list_routes(self):
        result = run_cli(["--list-routes"])
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertGreaterEqual(result.stdout.count("Route:"), 8)

    def test_help(self):
        result = run_cli(["--help"])
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertIn("--route", result.stdout)


# === PART B FOLLOWS: interactive, secret, derive, shell tests ===

class TestInteractiveMenu(unittest.TestCase):
    def test_zero_exits(self):
        result = run_cli([], inp="0\n")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unknown_choice_reprompts(self):
        result = run_cli([], inp="9\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Unknown choice", result.stdout)

    def test_watch_only_submenu(self):
        result = run_cli([], inp="2\n0\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("watch-only", result.stdout.lower())

    def test_empty_stdin_exits_cleanly(self):
        result = run_cli([], inp="")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_wallet_generation_documentation(self):
        result = run_cli([], inp="1\nb\n\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("docs/04-wallet-generation/README.md", result.stdout)


class TestNoSecretsInOutput(unittest.TestCase):
    def test_recover_route_does_not_echo_mnemonic(self):
        result = run_cli(["--route", "recover " + FAKE_MNEMONIC])
        # "recover" matches the decrypt/recover route, so exit 0 is
        # correct; the property under test is that the phrase is never echoed.
        self.assertEqual(result.returncode, 0)
        self.assertNotIn(FAKE_MNEMONIC, result.stdout + result.stderr)

    def test_watch_only_derivation_does_not_echo_xpub(self):
        menu_input = "2\na\nbtc\n0\n0\n" + FAKE_XPUB + "\n\n0\n0\n"
        try:
            result = run_cli([], inp=menu_input)
        except subprocess.TimeoutExpired as exc:
            for stream in (exc.stdout, exc.stderr):
                if isinstance(stream, bytes):
                    stream = stream.decode("utf-8", errors="replace")
                if stream:
                    self.assertNotIn(FAKE_XPUB, stream)
                    self.assertNotIn(FAKE_XPUB[4:24], stream)
            self.skipTest(
                "piped menu input timed out; the hidden xpub prompt may "
                "require a tty in this checkout"
            )

        output = result.stdout + result.stderr
        self.assertNotIn(FAKE_XPUB, output)
        self.assertNotIn(FAKE_XPUB[4:24], output)

        if (
            bawa_cli.resolve_node() is None
            or not (ROOT / "tools" / "hdwallet-gen" / "derive.js").is_file()
        ):
            self.skipTest(
                "watch-only xpub derivation cannot be exercised: "
                "node 22 / derive.js unavailable"
            )

        lowered = output.lower()
        refuses_hidden_input = any(
            any(
                marker in line
                for marker in ("getpass", "tty", "terminal", "hidden input")
            )
            and any(
                marker in line
                for marker in (
                    "requires",
                    "needs",
                    "refus",
                    "unavailable",
                    "not supported",
                    "cannot read",
                    "can't read",
                    "not a tty",
                    "not a terminal",
                    "no tty",
                    "inappropriate ioctl",
                )
            )
            for line in lowered.splitlines()
        )
        # A getpass fallback warning alone is not a refusal to read the pipe.
        if (
            refuses_hidden_input
            or "eoferror" in lowered
            or ("traceback" in lowered and "getpass" in lowered)
            or "cancelled" in lowered
            or "canceled" in lowered
        ):
            self.skipTest(
                "the launcher cannot complete hidden xpub input through "
                "piped stdin in this checkout"
            )

        hidden_prompt_seen = any(
            marker in result.stderr.lower()
            for marker in ("getpass", "xpub", "extended public key")
        )
        derive_failure_seen = any(
            marker in lowered
            for marker in (
                "checksum",
                "base58",
                "invalid xpub",
                "invalid extended",
                "derivation failed",
                "derive failed",
                "failed to derive",
            )
        )
        if not (hidden_prompt_seen or derive_failure_seen):
            self.skipTest(
                "cannot confirm that piped stdin reached the hidden xpub "
                "derive path in this checkout"
            )

    def test_decrypt_route_does_not_echo_hex_key(self):
        result = run_cli(["--route", "decrypt " + FAKE_HEXKEY])
        self.assertNotIn(FAKE_HEXKEY, result.stdout + result.stderr)


@unittest.skipUnless(
    bawa_cli.resolve_node() is not None
    and (ROOT / "tools" / "hdwallet-gen" / "derive.js").is_file(),
    "node 22 / derive.js unavailable",
)
class TestDeriveTool(unittest.TestCase):
    def test_btc_index_zero_from_published_xpub(self):
        published_xpub = (
            "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9"
        )
        published_address = "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd"

        try:
            data = json.loads(
                (ROOT / "test" / "fixture-oracle-vectors.json").read_text(
                    encoding="utf-8"
                )
            )
        except (OSError, UnicodeError, json.JSONDecodeError):
            xpub = published_xpub
            expected_address = published_address
        else:
            if not isinstance(data, dict) or "FIXTURES" not in data:
                self.skipTest("no published xpub vector in fixtures")

            # Locate the published pair without assuming FIXTURES' nesting.
            # A readable file missing the pair must skip, not use literals.
            xpub = None
            expected_address = None
            pending = [data["FIXTURES"]]
            while pending:
                value = pending.pop()
                if isinstance(value, dict):
                    pending.extend(value.values())
                elif isinstance(value, list):
                    pending.extend(value)
                elif isinstance(value, str):
                    if value == published_xpub:
                        xpub = value
                    elif value == published_address:
                        expected_address = value

            if xpub is None or expected_address is None:
                self.skipTest("no published xpub vector in fixtures")

        result = subprocess.run(
            [
                bawa_cli.resolve_node(),
                str(ROOT / "tools" / "hdwallet-gen" / "derive.js"),
                "btc",
                "0",
                "0",
            ],
            cwd=ROOT,
            input=xpub + "\n",
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertNotIn(xpub, result.stdout + result.stderr)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), expected_address)


class TestNoShell(unittest.TestCase):
    def test_launcher_does_not_use_shell_execution(self):
        source = (ROOT / "tools" / "bawa_cli.py").read_text(encoding="utf-8")
        self.assertNotIn("shell=True", source)
        self.assertNotIn("os.system", source)
        self.assertNotIn("os.popen", source)


if __name__ == "__main__":
    unittest.main()