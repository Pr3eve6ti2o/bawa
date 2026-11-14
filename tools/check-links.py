#!/usr/bin/env python3
"""Check internal links in the repo's Markdown files.

Verifies, for every Markdown file under the repository root (README.md,
docs/, and the root *.md files):
  - relative link targets resolve to an existing file or directory;
  - #anchors resolve to a heading in the target file (GitHub slug rules).

External URLs (http/https/mailto) are out of scope: they need the network and
go stale for reasons this check cannot judge. Run from the repository root:
`python3 tools/check-links.py`. Exit 0 when every internal link resolves,
exit 1 otherwise, listing each failure as file:line: target.
"""
import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
REF_LINK_RE = re.compile(r"!?\[[^\]]*\]\[([^\]]+)\]")
REF_DEF_RE = re.compile(r"^\s*\[([^\]]+)\]:\s*(\S+)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def slugify(text):
    """GitHub heading anchor: lowercase, drop punctuation except - and _,
    spaces become hyphens."""
    text = re.sub(r"<[^>]+>", "", text).strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"\s", "-", text)


def headings_of(path):
    slugs = set()
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = HEADING_RE.match(line.rstrip("\n"))
            if m:
                slugs.add(slugify(m.group(2)))
    return slugs


def markdown_files():
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames
                       if d not in (".git", "node_modules", ".venv", "__pycache__")]
        for name in filenames:
            if name.endswith(".md"):
                found.append(os.path.join(dirpath, name))
    return sorted(found)


def check_file(path, cache):
    failures = []
    with open(path, encoding="utf-8") as fh:
        lines = fh.readlines()
    defs = {}
    for line in lines:
        m = REF_DEF_RE.match(line)
        if m:
            defs[m.group(1).lower()] = m.group(2)
    in_fence = False
    for number, line in enumerate(lines, start=1):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        targets = LINK_RE.findall(line)
        for ref in REF_LINK_RE.findall(line):
            if ref.lower() in defs:
                targets.append(defs[ref.lower()])
        for target in targets:
            target = target.strip()
            if not target:
                continue
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            if target.startswith("#"):
                anchor = urllib.parse.unquote(target[1:])
                if anchor and anchor not in cache.setdefault(path, headings_of(path)):
                    failures.append((number, target, "anchor not found"))
                continue
            if "#" in target:
                rel, _, anchor = target.partition("#")
                anchor = urllib.parse.unquote(anchor)
            else:
                rel, anchor = target, ""
            rel = urllib.parse.unquote(rel)
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), rel))
            if not os.path.exists(resolved):
                failures.append((number, target, "target not found"))
            elif anchor:
                if anchor not in cache.setdefault(resolved, headings_of(resolved)):
                    failures.append((number, target, "anchor not found"))
    return failures


def main():
    total = 0
    failed = 0
    for path in markdown_files():
        cache = {}
        problems = check_file(path, cache)
        total += 1
        for number, target, reason in problems:
            failed += 1
            print(f"{os.path.relpath(path, ROOT)}:{number}: {target} ({reason})")
    if failed:
        print(f"check-links: {failed} broken internal link(s) in {total} files")
        return 1
    print(f"check-links: OK ({total} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
