# ADR-0008 — ecdsa 0.19.2 residual risk (PYSEC-2026-1325 / CVE-2024-23342): accept and document

## Status

Accepted. Decided 2026-11-20 by Orion/coordinator under owner delegation
(2026-11-20, all pending Bawa decisions delegated to Orion). Review date
2027-05-20, or sooner if any flip condition below is met.

## Context

- Advisory: Minerva timing attack on P-256 — `ecdsa.sign_digest()` leaks
  the nonce, enabling private-key discovery (CVE-2024-23342,
  PYSEC-2026-1325). OSV re-verified 2026-11-20: the affected range has a
  single event, `introduced: 0`, and **no `fixed` event** — no fix version
  exists, for any version. `pip-audit -r requirements.txt` flags
  `ecdsa` 0.19.2 under PYSEC-2026-1325 all the same.
- Upstream (`python-ecdsa` `SECURITY.md`, HEAD `71e3fc7`): a deliberate,
  permanent won't-fix, not an unpatched backlog item. "This library was
  not designed with security in mind." "This library does not protect
  against side-channel attacks." "Fixes for side-channel vulnerabilities
  will not be developed." Any decision that assumes a future `ecdsa`
  release fixes this is wrong.
- Bawa's position (verified first-hand 2026-11-20): `ecdsa==0.19.2` is
  transitive only (`requirements.lock:608`, `# via bip-utils`); no Bawa
  file pins or imports `ecdsa` directly. `bip_utils` defaults
  `USE_COINCURVE = True`, so the secp256k1 path executes coincurve, not
  ecdsa (`coincurve==21.0.0` pinned in the lockfile). No `Sign` method
  exists on any `bip_utils` key wrapper. Bawa never signs with Python at
  all, on any curve. Our curves are secp256k1 (BTC/ETH/TRX) and Ed25519
  (TON); P-256 classes exist in `bip_utils` but no code path in our tools
  reaches them.
- Load-vs-execute nuance: `ecdsa` IS loaded at `bip_utils` import time
  via the `nist256p1` module, but no signing path executes it. Loading
  is not execution of the vulnerable operation: the Minerva attack needs
  timed P-256 signing, and Bawa produces none.
- Precedents (what the shared repos do when a dependency has a CVE with
  no fix version): dYdX replaced `ecdsa` with coincurve because it called
  `ecdsa.SigningKey` directly to sign; KIVOX removed it by replacing the
  parent (`python-jose` → `PyJWT`) because a drop-in existed; Prismal
  accepted + documented + recorded migration debt because the vulnerable
  signing path was not exercised; SUSE records won't-fix across products.
  Nobody vendors or forks `ecdsa` to patch the timing leak, and nobody
  pins-and-forgets silently. Every repo either removes/replaces it, or
  accepts it in writing with a named reason and a trigger.

## Decision

Accept the residual risk; do not replace or remove `ecdsa`. The
acceptance is recorded in `docs/SECURITY-FINDINGS.md` §1 (full
adjudication), `docs/SECURITY.md` (canonical summary) and
`docs/security-AUDIT-TOOLCHAIN.md` §6 (audit record), and guarded by a
fail-closed test (`test/test_ecdsa_guard.py`) that fails the gate if any
safety fact changes. The OSV/pip-audit scan stays report-only — no ignore
entry is added to `.osv-scanner.toml` (its own rule forbids silencing
without evidence; the adjudication is the evidence, and the scan output
is the tripwire that this ADR exists).

Alternatives considered and rejected:

- Drop `bip-utils`. It is Bawa's only BIP-39/44/84 engine;
  reimplementing or re-qualifying another one is a programme, not a fix.
- Fork/patch `bip-utils` to drop the `ecdsa` requirement. Upstream pins
  `ecdsa~=0.17` as a hard dependency and imports it at package-import
  time. A fork is real maintenance burden for a dependency Bawa does not
  execute on a signing path, and no repo in the sample forks `ecdsa` or
  its parents for this CVE.
- Constrain the install so `ecdsa` is never installed. Impossible
  without forking: `pip` installs `bip-utils`' declared dependencies;
  `ecdsa` is required, not optional. The only lever is the backend
  selection, which Bawa already holds (coincurve pinned in the lockfile).
- The dYdX precedent does not transfer: dYdX called `ecdsa.SigningKey`
  directly to sign; Bawa never signs in Python. The KIVOX precedent
  does not transfer either: their parent had a drop-in replacement;
  Bawa's parent (`bip-utils`) has none.

## Consequences

- `ecdsa==0.19.2` stays pinned in `requirements.lock`; `coincurve`
  stays pinned at 21.0.0. The guard test fails the gate if
  `EccConf.USE_COINCURVE` is not True, if either pin floats, or if any
  file under `tools/` imports `ecdsa` or `nist256p1`.
- Re-review by 2027-05-20, or sooner if any of these flips the decision:
  (1) any Python signing path appears (including a future P-256 coin);
  (2) `coincurve` is dropped from the lockfile; (3) a fix version
  appears in OSV (then upgrade immediately); (4) `bip-utils` ships a
  build without the `ecdsa` requirement (then drop the pin).
