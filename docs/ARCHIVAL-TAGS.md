# Archival Tags

This file records the three annotated archival tags that preserve deleted
Bawa branches. It exists so a future agent who has never seen the
repo-organisation programme can answer, for each tag: what branch it
preserves, what content is in it, why the branch was deleted, and how to get
the content back.

## What an archival tag is

A Bawa branch, once deleted, leaves no live ref behind. An annotated tag
pointing at the deleted branch's tip commit keeps the whole branch history
reachable forever: the tip commit, every commit behind it, and every file
blob at that tip. The tag is the only thing standing between that history
and `git gc`.

All three tags below are **annotated** tags (`git cat-file -t` = `tag`),
created by Orion, and pushed to the remote. Verify them with:

```sh
git ls-remote origin "refs/tags/archive/*"
git cat-file tag archive/<name>          # tag message, tagger, date
git ls-tree archive/<name> -- <path>     # blob SHA of a preserved file
git show archive/<name>:<path>           # the preserved file itself
```

## How to recover a deleted branch

```sh
git checkout -b <branch-name> archive/<tag-name>   # restore the branch
git show archive/<tag-name>:<path>                 # read one preserved file
git log --oneline archive/<tag-name>                # the preserved history
```

Do **not** push a restored branch, and do **not** delete these tags, without
the owner's word. The tags are the preservation mechanism; deleting one
re-creates the exact loss risk they were created to close.

## Summary

| Tag | Tag object SHA | Tip commit | Branch preserved | Commits |
| --- | --- | --- | --- | --- |
| `archive/hd-wallet-professional` | `cc028e05d44bed95f2eeb531629869770ba9fbef` | `4272a82340b0579c87f75c10d18b0fdb948939a3` | `hd-wallet-professional` | 6 |
| `archive/docs-usecase-split` | `529da466fbe4307c504099e64d6ed30ea8fc08e0` | `7e543ec0d155d2bcd347d40df65fa16ae798327e` | `docs-usecase-split` | 27 |
| `archive/feat-trust-wallet-reference-implementation` | `89c0f97b102417d9032a4a0016cff0a042bfc076` | `39a98e531b419c20a97ab9bf36bcb496280e9a37` | `feat/trust-wallet-reference-implementation` | 33 |

All three branches were deleted on **2026-11-20** as unique-but-unnecessary
per the branch evaluation, and all three tags were ordered by the owner.
Background and per-branch loss analysis live in the loss audit
(`LOSS-AUDIT.md`, VM-local at `/home/boxd/workspace/bawa-org/LOSS-AUDIT.md`;
not committed to the repo).

---

## 1. `archive/hd-wallet-professional`

- **Tag name:** `archive/hd-wallet-professional`
- **Tag object SHA:** `cc028e05d44bed95f2eeb531629869770ba9fbef`
- **Points at commit:** `4272a82340b0579c87f75c10d18b0fdb948939a3`
- **Branch preserved:** `hd-wallet-professional` (deleted 2026-11-20)
- **Tip commit:** 2026-11-14, `docs: rewrite README as 95-line front door per repo-craft research (R2/R3/R4)`
- **Branch size:** 6 commits not on `main`, docs-only
- **Tag created:** 2026-11-19 21:33 UTC, tagger Orion `<orion@bawa.local>`
- **Owner ordered:** yes (stated in the tag message)

### What it preserves

The exact pre-audit wording of the full README, as a single blob:

| File | Blob SHA | Size |
| --- | --- | --- |
| `docs/README-FULL.md` | `0495a44966e93a9222caa83e774a8dfdde0a5653` | 2,834 lines, 81,780 bytes |

That blob is the 2,834-line README as it stood before the audit rewrite.
It is the reason this tag exists: the branch's only unique artefact was
that exact text.

### Where the material survives now

On `main` in split, audit-corrected form. Note the trap: `main` **does**
still have a `docs/README-FULL.md`, but it is a *different* blob
(`2725fcc188335eed6bec77d1fa83fb9b5c98e114`, 1,285 lines, 81,316 bytes).
The preserved pre-audit blob `0495a44` exists **only** via this tag.
Do not assume `main`'s file is the preserved text.

### Why the branch was deleted

Unique-but-unnecessary per the branch evaluation: the branch was 6
docs-only commits, its material survives on `main` in split,
audit-corrected form, and nothing else in it was unique. Owner ordered
the tag first, so the exact blob survives even though the branch is gone.

### Verification evidence

- `git ls-remote origin "refs/tags/archive/hd-wallet-professional"`
  returns tag `cc028e05…` pointing at commit `4272a82…`.
- `git ls-tree archive/hd-wallet-professional -- docs/README-FULL.md`
  returns `100644 blob 0495a44966e93a9222caa83e774a8dfdde0a5653`.
- `git cat-file blob 0495a44… | wc -l -c` returns `2834 81780`.
- `git rev-list --count 4272a82… --not main` returns `6`.

---

## 2. `archive/docs-usecase-split`

- **Tag name:** `archive/docs-usecase-split`
- **Tag object SHA:** `529da466fbe4307c504099e64d6ed30ea8fc08e0`
- **Points at commit:** `7e543ec0d155d2bcd347d40df65fa16ae798327e`
- **Branch preserved:** `docs-usecase-split` (deleted 2026-11-20)
- **Tip commit:** 2026-11-14, `scripts: add docs link checker (stdlib only, no network)`
- **Branch size:** 27 commits not on `main`
- **Tag created:** 2026-11-20 08:27 UTC, tagger Orion `<orion@bawa.local>`
- **Owner ordered:** yes — owner order 2026-11-20 (finalisation programme,
  Phase 0), also stated in the tag message

### What it preserves

The use-case-split line: the ADR, the standards file, the link checker,
and the 27-commit development sequence itself.

| File | Blob SHA | Notes |
| --- | --- | --- |
| `docs/adr/0001-use-case-split.md` | `cdb9089cc563ddf6071b1c19b0c151b2800576f4` | The ADR as written on this branch |
| `docs/standards.md` | `35aae8a0ec2795682e416a4dc966100cc5270503` | Exists **only** here as a file; its material is covered by `main`'s `docs/REFERENCES.md` |
| `scripts/check-links.py` | `3a177f7514570a67f1eb45e4fbbf31ffc3538055` | Stdlib-only docs link checker, no network |

### Where the material survives now

- The ADR was transferred to `panel-rebuild/adopt-proper` as
  `docs/adr/0006-use-case-split.md` in commit
  `e493720c4ab800036433cc9d85fde74fca7617bc`
  (`docs: preserve use-case-split ADR as ADR-0006 from docs-usecase-split (7e543ec)`).
  Per the loss audit, only the title line changed plus a Provenance
  section, and the SHA-256 in Provenance matches the original file
  exactly. `docs/adr/README.md` lists it as 0006.
- The link checker survives newer on `adopt-proper` at
  `tools/check-links.py` (moved from `scripts/` to `tools/`).
- The guides themselves survive on `main` as audit-rewritten blobs.

### Why the branch was deleted

Unique-but-unnecessary per the branch evaluation: the ADR, the checker,
and the guide material all survive in the locations above, so the branch
itself was no longer needed. Before this tag existed, the tip survived
only as a stale remote-tracking ref (`origin/docs-usecase-split`) on
gray-pinee — one `git fetch --prune` away from being unreferenced and
one `gc` away from gone (loss audit §1). This tag closes that risk.

### Verification evidence

- `git ls-remote origin "refs/tags/archive/docs-usecase-split"`
  returns tag `529da466…` pointing at commit `7e543ec…`.
- `git ls-tree archive/docs-usecase-split -- docs/adr/0001-use-case-split.md docs/standards.md scripts/check-links.py`
  returns blobs `cdb9089…`, `35aae8a0…`, `3a177f75…`.
- `git rev-list --count 7e543ec… --not main` returns `27`.
- `git ls-tree e493720 -- docs/adr/0006-use-case-split.md` confirms the
  ADR transfer on `adopt-proper`.

---

## 3. `archive/feat-trust-wallet-reference-implementation`

- **Tag name:** `archive/feat-trust-wallet-reference-implementation`
- **Tag object SHA:** `89c0f97b102417d9032a4a0016cff0a042bfc076`
- **Points at commit:** `39a98e531b419c20a97ab9bf36bcb496280e9a37`
- **Branch preserved:** `feat/trust-wallet-reference-implementation`
  (deleted 2026-11-20)
- **Tip commit:** 2026-11-14, `Rework docs per R5; fix two dead external links`
- **Branch size:** 33 commits not on `main`
- **Tag created:** 2026-11-20 08:27 UTC, tagger Orion `<orion@bawa.local>`
- **Owner ordered:** yes — owner order 2026-11-20 (finalisation programme,
  Phase 0), also stated in the tag message

### What it preserves

The Trust Wallet Core reference-implementation line: the
`tools/hdwallet-gen` code and the numbered guide directories, plus the
33-commit development sequence itself.

| File | Blob SHA | Notes |
| --- | --- | --- |
| `tools/hdwallet-gen/generate.js` | `4079afbe826c4c425715a34f8037d85a9e40b978` | 220 lines, 8,293 bytes |
| `tools/hdwallet-gen/compare.js` | `37af800c2b2e421a7a6baae4322901e006fed002` | |
| `tools/hdwallet-gen/derive.js` | `778fe5d4d7654b9498e43ba66093a1e249740f93` | |
| `tools/hdwallet-gen/derive_daemon.js` | `5dd647f4319f52be777433c4dd48ba6c0a224303` | |
| `tools/hdwallet-gen/package.json` | `1821be23b21432b7b7892b55d397d13fe9a19850` | |
| `tools/hdwallet-gen/package-lock.json` | `e30e6a15ee23a5e2a7c7ac036a7bc2f98f744ddc` | |
| `docs/01–docs/12` | (numbered guide directories) | Guide chapters; `docs/01–docs/08` are the core guide, `docs/09–docs/12` the later chapters |
| `docs/README-FULL.md` | `e2b1537d287c55c9b03f827aadf029a1213514d0` | |
| `docs/README.md` | `2186104392b14f843688a56a022cef2d346dc189` | |
| `docs/RECOVERY.md`, `docs/REFERENCES.md`, `docs/SECURITY.md`, `docs/TESTING.md` | (see `git ls-tree` on the tag) | Top-level docs as of this tip |

### Where the material survives now

The same functionality survives on `main` via a parallel
re-implementation in newer form: commit
`49e4260fde5d3555aee05f987d92b32c749e0b33` (2026-10-05,
`feat: add Trust Wallet Core reference implementation`). `main`'s
`tools/hdwallet-gen/generate.js` is a different blob (`f747b5f2…`), and
`main`'s `tools/hdwallet-gen` includes `extended-key.js`, which the
archived branch did not have. `adopt-proper` at `e493720` also carries
`tools/hdwallet-gen`, including `extended-key.js` and `derive-ton.js`.
The branch's only lead over the surviving code was a 1.2.0 vs 1.1.0
version bump.

### Why the branch was deleted

Unique-but-unnecessary per the branch evaluation: the functionality
survives on `main` in newer form, so the 33-commit line was no longer
needed as a live branch. As with tag 2, before this tag existed the tip
survived only as a stale remote-tracking ref
(`origin/feat-trust-wallet-reference-implementation`) on gray-pinee —
one `git fetch --prune` away from being unreferenced (loss audit §1).
This tag closes that risk.

### Verification evidence

- `git ls-remote origin "refs/tags/archive/feat-trust-wallet-reference-implementation"`
  returns tag `89c0f97b…` pointing at commit `39a98e5…`.
- `git ls-tree archive/feat-trust-wallet-reference-implementation -- tools/hdwallet-gen/generate.js`
  returns `100644 blob 4079afbe826c4c425715a34f8037d85a9e40b978`.
- `git cat-file blob 4079afbe… | wc -l -c` returns `220 8293`.
- `git rev-list --count 39a98e5… --not main` returns `33`.
- `git log -1 49e4260` confirms the parallel re-implementation on `main`.

---

## What the tags do NOT preserve

- The branch *names* as live refs. The branches are deleted from the
  remote; only the tags remain. Restoring a branch is a deliberate act
  (see "How to recover" above), not something that happens by fetching.
- Exact pre-audit wording beyond what is listed above. Each tag preserves
  its tip commit's full tree, so any file at the tip is recoverable —
  the tables above list the files that mattered, not the only files
  present. Use `git ls-tree -r archive/<name>` to see everything.
- Any claim that the preserved content is current. The tags are snapshots
  of superseded work, kept for provenance and recovery — not for building
  on. The live code is on `main` / `adopt-proper`.

## Re-verification

Every SHA, blob, line count, and commit count in this file was verified
first-hand on gray-pinee with `git ls-remote`, `git for-each-ref`,
`git cat-file tag`, `git ls-tree`, `git cat-file blob | wc -l -c`, and
`git rev-list --count <tip> --not main` before it was written down.
Re-run the commands in each tag's "Verification evidence" section to
confirm the tags still resolve the same way. If a value ever disagrees
with this file, trust the tag object, not this file — and fix this file.
