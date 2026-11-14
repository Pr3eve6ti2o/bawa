#!/usr/bin/env python3
"""Check relative links in this branch's Markdown files.

Walks the repository root for *.md files (excluding .git), extracts inline
Markdown links and images, and checks that every relative target resolves
to a file in the checkout. Anchors (#section) are checked against the
target file's headings, slugified the way GitHub does.

External links (http/https/mailto) are listed as NOT CHECKED, never fetched:
this script makes no network calls. Run from the repository root:

    python3 scripts/check-links.py

Exit code 0 when every relative link resolves, 1 otherwise.
"""

import os
import re
import sys

LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)


def github_slug(heading):
    """Slugify a heading the way GitHub anchor ids do (close approximation)."""
    text = re.sub(r"<[^>]+>", "", heading)  # strip inline HTML tags
    text = re.sub(r"`([^`]*)`", r"\1", text)  # strip code spans, keep text
    text = text.strip().lower()
    text = re.sub(r"[^\w\s\-]", "", text, flags=re.UNICODE)
    return re.sub(r"\s+", "-", text)


def headings_of(path):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    return {github_slug(m.group(1)) for m in HEADING_RE.finditer(content)}


def main():
    root = os.getcwd()
    md_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        for name in filenames:
            if name.endswith(".md"):
                md_files.append(os.path.join(dirpath, name))

    checked = 0
    broken = []
    external = []

    for path in sorted(md_files):
        with open(path, encoding="utf-8") as f:
            content = f.read()
        rel_source = os.path.relpath(path, root)
        for target in LINK_RE.findall(content):
            if target.startswith(("http://", "https://", "mailto:")):
                external.append((rel_source, target))
                continue
            if target.startswith("#"):
                anchor = target[1:]
                if anchor and anchor not in headings_of(path):
                    broken.append((rel_source, target, "anchor not found in same file"))
                checked += 1
                continue
            file_part, _, anchor = target.partition("#")
            if not file_part:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), file_part))
            checked += 1
            if os.path.isdir(resolved):
                # A directory link is valid on GitHub; an anchor on one
                # resolves against the directory's README.md, if it has one.
                dir_readme = os.path.join(resolved, "README.md")
                if anchor and os.path.isfile(dir_readme) and anchor not in headings_of(dir_readme):
                    broken.append((rel_source, target, "anchor not found in " + os.path.relpath(dir_readme, root)))
            elif not os.path.isfile(resolved):
                broken.append((rel_source, target, "file not found: " + os.path.relpath(resolved, root)))
            elif anchor and anchor not in headings_of(resolved):
                broken.append((rel_source, target, "anchor not found in " + os.path.relpath(resolved, root)))

    print(f"checked {checked} relative links in {len(md_files)} Markdown files")
    if external:
        print(f"external links listed, not checked (no network): {len(external)}")
        for source, target in external:
            print(f"  EXTERNAL {source}: {target}")
    if broken:
        print(f"BROKEN: {len(broken)}")
        for source, target, reason in broken:
            print(f"  BROKEN {source}: {target} ({reason})")
        return 1
    print("OK: every relative link resolves")
    return 0


if __name__ == "__main__":
    sys.exit(main())
