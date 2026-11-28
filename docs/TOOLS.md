# Tools — persistent installs on the development VM

Where the command-line tools the docs and scripts depend on live, so a
lane never has to guess — or reinstall into a path that disappears.

Rule: **never install a tool under `/tmp`**. `/tmp` is tmpfs on the
development VM and is wiped on reboot. A tool installed there is gone
after the next restart, and the next lane wastes a run rediscovering it.

## mmdc — Mermaid CLI (diagram rendering)

- **Binary:** `/home/boxd/node22/bin/mmdc`
- **Package:** `@mermaid-js/mermaid-cli` **12.2.0** (pinned)
- **Installed as:** a global npm install into the Node 22 prefix —
  `/home/boxd/node22/lib/node_modules/@mermaid-js/mermaid-cli`
- **Needs on PATH:** Node 22 — `PATH=/home/boxd/node22/bin:$PATH`
  (the same PATH the wallet build and tests use; system Node is v24
  and must not be used here either).
- **Headless Chromium:** Puppeteer's bundled Chromium, from the
  persistent cache at `/home/boxd/.cache/puppeteer/chrome/` — also
  outside `/tmp`, so it survives reboots.
- **What it renders:** the Mermaid blocks in `docs/HOW-IT-WORKS.md`
  (three `flowchart TB` diagrams) and any `.mmd` source under
  `docs/archive/lane-d-diagrams-2026-11-20/`. Rendered output is
  verification only and is **not** committed — the Markdown keeps the
  Mermaid as editable text, not images.

### Why this path

A previous install lived in `/tmp/mmd` and was wiped by a reboot
(2026-11-28 finding). The Node 22 global prefix was chosen because
it is already persistent — the `mmdc` 12.2.0 install dated
2026-11-25 was still present and working after the very reboot that
wiped `/tmp` — it is on the PATH every lane already uses for Node 22,
and it keeps the tool outside every repo `node_modules` directory,
so the `node_modules` disappearances seen on this VM do not touch it.
A separate dedicated install would duplicate Puppeteer + Chromium
(~500 MB) for no benefit.

Coupling to note: the install lives inside the Node 22 toolchain
directory, so reinstalling or replacing Node 22 removes it. If
`mmdc --version` ever fails, re-run the install command below —
it takes seconds and needs no other setup.

### Install (or reinstall)

```sh
export PATH=/home/boxd/node22/bin:$PATH
npm install -g @mermaid-js/mermaid-cli@12.2.0
mmdc --version   # must print 12.2.0
```

### Verify — render a real diagram end to end

```sh
export PATH=/home/boxd/node22/bin:$PATH
# Extract the first Mermaid block from docs/HOW-IT-WORKS.md to a .mmd
# file (any extractor works; keep the scratch files outside the repo,
# e.g. under /home/boxd/mmdc-verify/), then:
mmdc -i how-it-works-1.mmd -o how-it-works-1.svg -b transparent
```

A good render exits 0 and produces a valid SVG (starts with `<svg`,
~200 KB for these diagrams) containing every node label from the
source block — e.g. `Guide`, `Builder`, `Registry`,
`Trust Wallet Core`. An error page or an empty file is a failed
render, not a pass.

Last verified 2026-11-28: all three `HOW-IT-WORKS.md` diagrams
rendered to valid SVGs (203,240 / 205,772 / 207,858 bytes) with every
sampled node label present, on the freshly reinstalled 12.2.0.
