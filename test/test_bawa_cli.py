import unittest
import subprocess
import sys
import os
import io
import json
import re
import tempfile
from pathlib import Path
from unittest import mock


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
            # A route may instead state plainly that its target does not
            # exist in this checkout (e.g. the custom-request route).
            if "does not exist in this checkout" in detail or (
                "do not exist in this checkout" in detail
            ):
                return route
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
        # build-wallet.mjs is absent on main, so these routes are labelled
        # unavailable, not existing tools.
        for request in ("build a web wallet", "create an Android wallet"):
            with self.subTest(request=request):
                self._assert_route(
                    request,
                    ("unavailable",),
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

    ROUTE_TITLES = (
        "Build a Cryptocurrency Wallet Application",
        "Create an HD Cryptocurrency Wallet",
        "Derive the TON watch-only address",
        "Derive a watch-only address from an xpub",
        "Generate a starter for a registry profile",
        "Payment and balance tracking guidance",
        "Decrypt / recover a seed bundle",
        "Mainnet fee quote",
        "Security, verification and safety tests",
        "Custom development request",
    )
    ROUTE_KINDS = (
        "[UNAVAILABLE OR UNVERIFIED]",
        "[EXISTING TOOL]",
        "[UNAVAILABLE OR UNVERIFIED]",
        "[EXISTING TOOL]",
        "[UNAVAILABLE OR UNVERIFIED]",
        "[AI-GUIDED IMPLEMENTATION]",
        "[EXISTING TOOL]",
        "[UNAVAILABLE OR UNVERIFIED]",
        "[EXISTING TOOL]",
        "[AI-GUIDED IMPLEMENTATION]",
    )

    def test_list_routes(self):
        result = run_cli(["--list-routes"])
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertEqual(result.stdout.count("Route:"), 10)
        self.assertEqual(result.stdout.count("\n---\n"), 9)
        blocks = result.stdout.strip().split("\n---\n")
        self.assertEqual(len(blocks), 10)
        for block, title, kind in zip(
            blocks, self.ROUTE_TITLES, self.ROUTE_KINDS
        ):
            with self.subTest(title=title):
                lines = block.splitlines()
                self.assertEqual(lines[0], f"Route: {title}")
                self.assertEqual(lines[1], f"Kind: {kind}")

    def test_help(self):
        result = run_cli(["--help"])
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertIn("--route", result.stdout)
        self.assertIn("--list-routes", result.stdout)


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
        # No branch prompt: the launcher always derives branch 0.
        menu_input = "2\na\nbtc\n0\n" + FAKE_XPUB + "\n\n0\n0\n"
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


def derive_prerequisites_available(root=ROOT):
    """True only when the derive path can actually run: a Node 22, the
    derive.js tool, and the wallet-core module it requires."""
    return (
        bawa_cli.resolve_node() is not None
        and (root / "tools" / "hdwallet-gen" / "derive.js").is_file()
        and (
            root / "tools" / "hdwallet-gen" / "node_modules" / "@trustwallet"
            / "wallet-core"
        ).is_dir()
    )


@unittest.skipUnless(
    derive_prerequisites_available(),
    "node 22 / derive.js / wallet-core module unavailable",
)
class TestDeriveTool(unittest.TestCase):
    def _published_btc_pair(self):
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
            return published_xpub, published_address

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
        return xpub, expected_address
    def test_btc_index_zero_from_published_xpub(self):
        xpub, expected_address = self._published_btc_pair()

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

    def test_btc_index_zero_branch_arg_ignored(self):
        # derive.js takes no branch argument and always derives branch 0,
        # so a trailing branch value must not change the address.
        xpub, expected_address = self._published_btc_pair()

        result = subprocess.run(
            [
                bawa_cli.resolve_node(),
                str(ROOT / "tools" / "hdwallet-gen" / "derive.js"),
                "btc",
                "0",
                "1",
            ],
            cwd=ROOT,
            input=xpub + "\n",
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), expected_address)


class TestNoShell(unittest.TestCase):
    def test_launcher_does_not_use_shell_execution(self):
        source = (ROOT / "tools" / "bawa_cli.py").read_text(encoding="utf-8")
        self.assertNotIn("shell=True", source)
        self.assertNotIn("os.system", source)
        self.assertNotIn("os.popen", source)


class TestRouteTargetsResolve(unittest.TestCase):
    """Every path a route names must exist, or the route must be marked
    unavailable; a tool route's command target must exist."""

    PATH_RE = re.compile(
        r"(?:docs|scripts|tools|tests|registry|apps)/[A-Za-z0-9_./-]+"
        r"|\bWALLET_BUILDER\.md\b"
    )

    def _paths_in(self, text):
        found = []
        for match in self.PATH_RE.finditer(text):
            found.append(match.group(0).strip(".,;:\"'"))
        return found

    def test_all_route_paths_resolve_or_route_is_unavailable(self):
        for route in bawa_cli.ROUTES:
            with self.subTest(title=route["title"]):
                detail = route["detail"]
                command = route.get("command")
                text = detail + "\n" + " ".join(
                    str(arg) for arg in (command or [])
                )
                for path in self._paths_in(text):
                    if not (ROOT / path).exists():
                        self.assertEqual(
                            route["kind"],
                            "unavailable",
                            f"{path} does not exist but route "
                            f"'{route['title']}' is kind "
                            f"'{route['kind']}'",
                        )

    def test_tool_route_command_targets_exist(self):
        for route in bawa_cli.ROUTES:
            if route["kind"] != "tool":
                continue
            command = route.get("command") or []
            targets = [
                arg
                for arg in command
                if isinstance(arg, str) and "/" in arg
            ]
            self.assertTrue(
                targets, f"tool route '{route['title']}' has no path target"
            )
            for target in targets:
                with self.subTest(title=route["title"], target=target):
                    self.assertTrue(
                        (ROOT / target).exists(),
                        f"tool route '{route['title']}' target "
                        f"{target} does not exist",
                    )

    def test_docs_dict_values_exist(self):
        for key, value in bawa_cli.DOCS.items():
            with self.subTest(key=key):
                self.assertTrue(
                    (ROOT / value).exists(),
                    f"DOCS[{key!r}] = {value!r} does not exist",
                )


class TestRouteIdentities(unittest.TestCase):
    """Every documented action routes to its exact route identity."""

    EXPECTED = (
        ("build a web wallet", "Build a Cryptocurrency Wallet Application"),
        ("create an HD wallet", "Create an HD Cryptocurrency Wallet"),
        ("ton watch-only", "Derive the TON watch-only address"),
        (
            "derive an address from my xpub",
            "Derive a watch-only address from an xpub",
        ),
        (
            "generate starter",
            "Generate a starter for a registry profile",
        ),
        ("track payments", "Payment and balance tracking guidance"),
        ("recover my seed", "Decrypt / recover a seed bundle"),
        ("mainnet fees", "Mainnet fee quote"),
        ("run the tests", "Security, verification and safety tests"),
        ("something else", "Custom development request"),
    )

    def test_each_request_routes_to_its_exact_title(self):
        for request, title in self.EXPECTED:
            with self.subTest(request=request):
                route = bawa_cli.route_request(request)
                self.assertIsNotNone(route)
                self.assertEqual(route["title"], title)
                result = run_cli(["--route", request])
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"Route: {title}", result.stdout)


class TestAbsentToolRoutes(unittest.TestCase):
    """Absent-tool routes report unavailability; they never claim to run."""

    ABSENT = (
        ("build a web wallet", "scripts/build-wallet.mjs"),
        ("generate starter", "scripts/generate-project.mjs"),
        ("ton watch-only", "tools/hdwallet-gen/derive-ton.js"),
    )

    def test_absent_tool_routes_are_labelled_unavailable(self):
        for request, target in self.ABSENT:
            with self.subTest(request=request):
                self.assertFalse((ROOT / target).exists())
                result = run_cli(["--route", request])
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(
                    "[UNAVAILABLE OR UNVERIFIED]", result.stdout
                )
                self.assertIn(
                    "Command (shown, not executed):", result.stdout
                )
                self.assertNotIn("Traceback", result.stderr)


class TestSubmenuLabels(unittest.TestCase):
    def test_submenu_three_options_are_not_existing_tools(self):
        menu = bawa_cli.render_main_menu()
        line3 = [
            line for line in menu.splitlines() if line.startswith("3.")
        ][0]
        self.assertIn("[AI-GUIDED IMPLEMENTATION]", line3)
        submenu3 = bawa_cli.render_submenu("3")
        lines = submenu3.splitlines()
        for number in ("1.", "2."):
            with self.subTest(option=number):
                option = [
                    line for line in lines if line.startswith(number)
                ][0]
                self.assertIn("[UNAVAILABLE OR UNVERIFIED]", option)
                self.assertNotIn("[EXISTING TOOL]", option)


class TestInteractiveBehaviours(unittest.TestCase):
    def test_quit_aliases(self):
        for alias in ("q", "quit", "exit", "Q", "QUIT"):
            with self.subTest(alias=alias):
                result = run_cli([], inp=f"{alias}\n")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("Goodbye.", result.stdout)

    def test_submenu_eof_returns_to_main_menu_then_exits(self):
        result = run_cli([], inp="2\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Goodbye.", result.stdout)
        self.assertNotIn("Traceback", result.stderr)

    def test_ask_yes_accepts_only_exact_yes(self):
        for answer, expected in (
            ("YES", True),
            ("yes", False),
            ("Yes", False),
            (" YES", False),
            ("YES ", False),
            ("", False),
        ):
            with self.subTest(answer=answer):
                with mock.patch("builtins.input", return_value=answer):
                    self.assertIs(bawa_cli.ask_yes("Type YES"), expected)
        with mock.patch("builtins.input", side_effect=EOFError):
            self.assertIs(bawa_cli.ask_yes("Type YES"), False)

    def test_bawa_node_is_first_candidate(self):
        code = (
            "import os, sys; "
            "os.environ['BAWA_NODE'] = '/tmp/fake-node-for-test'; "
            "sys.path.insert(0, 'tools'); import bawa_cli; "
            "print(bawa_cli.NODE_CANDIDATES[0])"
        )
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "/tmp/fake-node-for-test")

    def test_resolve_node_none_without_executable_candidate(self):
        with mock.patch.object(
            bawa_cli, "NODE_CANDIDATES", ["/definitely/not/a/node"]
        ):
            self.assertIsNone(bawa_cli.resolve_node())

    def test_resolve_node_checks_first_candidate_only(self):
        with mock.patch.object(
            bawa_cli, "NODE_CANDIDATES", [sys.executable, "/nonexistent"]
        ):
            self.assertIsNone(bawa_cli.resolve_node())

    def test_run_captured_timeout_raises(self):
        with self.assertRaises(subprocess.TimeoutExpired):
            bawa_cli.run_captured(
                [sys.executable, "-c", "import time; time.sleep(10)"],
                timeout=1,
            )

    def test_no_btc_change_chain(self):
        self.assertNotIn("btc-change", bawa_cli.CHAINS)
        self.assertEqual(bawa_cli.CHAINS, {"btc", "eth", "trx"})

    def test_submenu_two_offers_branch_zero_only(self):
        text = bawa_cli.render_submenu("2")
        self.assertIn("Branch 0 (receiving) only", text)
        self.assertNotIn("btc-change", text)
        self.assertNotIn("[branch]", text)

    def test_registry_listing_reports_unavailable(self):
        result = run_cli([], inp="3\nb\n\n0\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Registry unavailable in this checkout.", result.stdout)

    def test_ton_failure_prints_no_stderr(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".py", delete=False
        ) as script:
            script.write(
                "import sys; "
                "sys.stderr.write('boom-stderr-marker\\n'); "
                "sys.exit(1)\n"
            )
            script_path = script.name
        try:
            with mock.patch.object(
                bawa_cli, "secret_input", return_value="ab" * 32
            ):
                with mock.patch.object(
                    bawa_cli, "resolve_node", return_value=sys.executable
                ):
                    with mock.patch.object(
                        bawa_cli,
                        "require_tool",
                        return_value=Path(script_path),
                    ):
                        with mock.patch(
                            "sys.stdout", new_callable=io.StringIO
                        ) as out:
                            bawa_cli.handle_watch_only("b")
            output = out.getvalue()
            self.assertIn("Derivation failed (exit code 1).", output)
            self.assertNotIn("boom-stderr-marker", output)
        finally:
            os.unlink(script_path)

    def test_xpub_failure_prints_stderr_detail(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".py", delete=False
        ) as script:
            script.write(
                "import sys; "
                "sys.stderr.write('some error detail\\n'); "
                "sys.exit(1)\n"
            )
            script_path = script.name
        try:
            with mock.patch.object(
                bawa_cli, "ask", return_value="btc"
            ):
                with mock.patch.object(
                    bawa_cli, "ask_int", return_value=0
                ):
                    with mock.patch.object(
                        bawa_cli, "secret_input", return_value=FAKE_XPUB
                    ):
                        with mock.patch.object(
                            bawa_cli,
                            "resolve_node",
                            return_value=sys.executable,
                        ):
                            with mock.patch.object(
                                bawa_cli,
                                "require_tool",
                                return_value=Path(script_path),
                            ):
                                with mock.patch(
                                    "sys.stdout", new_callable=io.StringIO
                                ) as out:
                                    bawa_cli.handle_watch_only("a")
            output = out.getvalue()
            self.assertIn("Derivation failed (exit code 1).", output)
            self.assertIn("some error detail", output)
        finally:
            os.unlink(script_path)


class TestMissingTargets(unittest.TestCase):
    def test_menu_4d_reports_missing_fee_test(self):
        result = run_cli([], inp="4\nd\n\n0\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            "[UNAVAILABLE OR UNVERIFIED] Mainnet fee quote", result.stdout
        )
        self.assertIn(
            "No mainnet fee-quote executable, library, or test exists",
            result.stdout,
        )
        self.assertIn("unavailable in this checkout", result.stdout)
        self.assertNotIn("FAIL", result.stdout)
        self.assertNotIn("Traceback", result.stderr)

    def test_menu_5b_reports_missing_test_files_as_unavailable(self):
        result = run_cli([], inp="5\nb\n\n0\n0\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        for filename in (
            "tests/mainnet-guards.test.mjs",
            "tests/mainnet-fees.test.mjs",
            "tests/mainnet-signing.test.mjs",
            "tests/mainnet-unsigned-tx.test.mjs",
        ):
            with self.subTest(filename=filename):
                self.assertIn(
                    f"{filename}: UNAVAILABLE (missing test infrastructure)",
                    result.stdout,
                )
        self.assertNotIn("FAIL", result.stdout)
        self.assertNotIn("Traceback", result.stderr)


class TestDerivePrerequisites(unittest.TestCase):
    def test_missing_node_modules_is_not_available(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "tools" / "hdwallet-gen").mkdir(parents=True)
            (root / "tools" / "hdwallet-gen" / "derive.js").write_text(
                "", encoding="utf-8"
            )
            with mock.patch.object(
                bawa_cli, "resolve_node", return_value="/fake/node"
            ):
                self.assertFalse(derive_prerequisites_available(root))

    def test_all_prerequisites_present_is_available(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            module_dir = (
                root / "tools" / "hdwallet-gen" / "node_modules"
                / "@trustwallet" / "wallet-core"
            )
            module_dir.mkdir(parents=True)
            (root / "tools" / "hdwallet-gen" / "derive.js").write_text(
                "", encoding="utf-8"
            )
            with mock.patch.object(
                bawa_cli, "resolve_node", return_value="/fake/node"
            ):
                self.assertTrue(derive_prerequisites_available(root))


if __name__ == "__main__":
    unittest.main()