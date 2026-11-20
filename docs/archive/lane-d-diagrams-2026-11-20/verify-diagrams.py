#!/usr/bin/env python3
"""Lane D verification: extract the mermaid blocks from the four edited docs,
diff them against the verified archived .mmd files, and render each with mmdc."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MMDC = "/tmp/mmd/node_modules/.bin/mmdc"
CASES = [
    ("ARCHITECTURE.md", "docs/archive/lane-d-diagrams-2026-11-20/repository-architecture-diagram-1.mmd"),
    ("docs/13-wallet-app-architecture/README.md", "docs/archive/lane-d-diagrams-2026-11-20/web-wallet-components-diagram-2.mmd"),
    ("docs/12-chain-registry-and-assets/README.md", "docs/archive/lane-d-diagrams-2026-11-20/chain-support-overview-diagram-3.mmd"),
    ("ai/request-routing.md", "docs/archive/lane-d-diagrams-2026-11-20/one-prompt-wallet-build-workflow-diagram-4.mmd"),
]

fence = re.compile(r"^```mermaid\s*$", re.M)
close = re.compile(r"^```\s*$", re.M)
ok = True
for doc, mmd in CASES:
    text = (ROOT / doc).read_text()
    m = fence.search(text)
    if not m:
        print(f"FAIL {doc}: no mermaid fence found")
        ok = False
        continue
    c = close.search(text, m.end())
    block = text[m.end():c.start()].strip() + "\n"
    ref = (ROOT / mmd).read_text()
    if block != ref:
        print(f"FAIL {doc}: embedded block differs from {mmd}")
        ok = False
        continue
    out = Path(f"/tmp/mmd/verify-{Path(mmd).stem}.svg")
    r = subprocess.run(
        [MMDC, "-i", str(ROOT / mmd), "-o", str(out)],
        capture_output=True, text=True, timeout=120,
        env={"PATH": "/home/boxd/node22/bin:/usr/bin:/bin"},
    )
    if r.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        print(f"FAIL {doc}: mmdc render failed rc={r.returncode} {r.stderr[-300:]}")
        ok = False
        continue
    print(f"OK {doc}: matches {mmd}, renders {out.stat().st_size} bytes")
print("ALL OK" if ok else "FAILURES PRESENT")
sys.exit(0 if ok else 1)
