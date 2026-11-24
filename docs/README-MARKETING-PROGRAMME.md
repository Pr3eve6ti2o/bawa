# README Marketing programme — record

**Date:** 2026-11-24. **Repo:** `Pr3eve6ti2o/bawa`.
**Author (merge lane):** hands-on Muse. **Sol calls — made 0, landed 0, failed 0.**
No external model was called. AgentRouter API stopped by owner order.
**Skills read on the VM:** `order-traceability-checklist`,
`cdp-visual-verification` (GitHub render check).
User-visible content in en-GB throughout.

## What landed (verified first-hand, fresh fetch + `ls-remote`)

| Lane | Work | Commit | Landed |
| --- | --- | --- | --- |
| A | README Showcase grid (dashboard shots only, height 360) + `## Showcase` title + Create-your-own block; 2 Receive images deleted | `6d4bfbfc183fb84d6e4e172df4657a4dea669671` (parent `8aefab7`) | `panel-rebuild/token-gaps` `7c98420` |
| D | Marketing research only — 14 gaps G1–G14, 14 proposed additions A1–A14 with exact text | Report `bawa-readme-marketing/MARKETING-GAPS.md` (no commit) | Applied by the merge lane, commit `6db1d1e` (see below) |
| C | Main README: 8 stale structure SVGs replaced by one Mermaid flowchart; 8 SVGs deleted | `3a426442ee33111bf88788245a225424bed64cbc` (parent `5462641`) | `main` `b9fc917` (as `bcc8555`) |
| E | Captcha made fully common (renames, `CAPTCHA_URL` required, TronScan as worked example only, package-lock fix) | `0095d82286ae24f70c8d2174380a06b2d3fc1695` (parent `5462641`), cherry-picked as `b579f3b` + README fix `6a5dae4` | Landed on `main` `7f9d364` (merge-main lane, 2026-11-24) |
| B | Diagrams redraw (architecture + explainer, HD-wallet purpose first) | No commit | **BLOCKED** — see below |
| F | FuckCaptcha import + credit | `e751b87` (39 field guides, CC0-1.0) | Landed on `main` `7f9d364` (merge-main lane, 2026-11-24) |

**Merge-lane commits (this programme):**

- `6db1d1eee8d4bbd5281789abceb038c8dc30dbb4` — branch side: Lane D additions
  A1–A14 (as applied, see Decisions), `217` → `440` Quickstart correction,
  `CREATE-EXAMPLE-WALLET.md` verify-table fixes. Parent `6d4bfbfc`.
  Pushed to `panel-rebuild/token-gaps`, verified by fresh `ls-remote`.
- `bcc855566791dd6dcdef98daed50ad462dfc4364` — cherry-pick of Lane C onto
  `main`. Parent `5462641`. No conflicts.
- `8126b8efdfcce5877fdd1e8ea27da27058cf2af7` — main-side ports: Lane A
  Showcase grid + Create your own (clone adapted to
  `panel-rebuild/token-gaps`), Lane D applicable additions adapted to main,
  8 orphaned `.mmd` deletions, README line 82 wording fix,
  `CREATE-EXAMPLE-WALLET.md` verify-table fixes. Parent `bcc8555`.
  Pushed to `main`, verified by fresh `ls-remote`.

**How it reached the tips:** the fix-all programme merged the merge-lane
work into its own branch (merge `343cd3a`, "merge token-gaps `6db1d1e`
(README marketing) into fix-all") and then into `token-gaps` (tip
`7c9842066fe1b353cd1921fc7280fedd4dfd41b1`) and `main` (tip
`b9fc917165258506878d24218f12ad1a9b0afa5a`, one doc-only commit on top of
`8126b8e`). `6db1d1e` and `8126b8e` are verified ancestors of the new tips.
Fix-all deleted `panel-rebuild/readme-marketing` as 0-unique (its README
work had already landed). **Do not recreate that branch.** Nothing here
overwrites any fix-all commit (DECISIONS §§19–23, Linea history fix,
RPC/price work).

**Verified present and correct on the new tips:**

- Token-gaps `7c98420` README: badges (6), live demo line, proof strip
  (`440 checks`), `## Showcase` grid (2 dashboard shots, `height="360"`),
  Create your own, hook questions + linked bullets, audience line, star
  CTA, `What Bawa has produced`, Contributors wall (contrib.rocks image
  renders on the GitHub page), contributing first step. Rendered GitHub
  README page checked first-hand: all sections render, images resolve.
- Main `b9fc917` README: Mermaid structure flowchart, Showcase grid +
  Create your own (clone uses `panel-rebuild/token-gaps`), badges (6),
  demo line, main-numbers proof strip (`136 checks` smoke · `48` launcher
  · `26` make_wallet), hook questions (adapted for main), star CTA,
  Contributors wall, bug-report link. Zero `.mmd` files remain on main;
  the Architecture note now reads "The two diagrams above are static SVG
  images…". Raw README content verified via `raw.githubusercontent.com`
  (`## Showcase`, `Create your own`, `height="360"` × 2); the GitHub blob
  page for main could not be fetched (upstream HTTP 503 from this egress —
  not a content problem; the token-gaps page rendered fine through the
  same path).
- `CREATE-EXAMPLE-WALLET.md` verify-table fix on both tips: preview root
  uses `curl -L` (root returns 302, redirect to `/bawa/`), wasm at
  `/bawa/wallet-core.wasm` (both verified live against `vite preview`).
- Raw URLs return HTTP 200 on both branches: `docs/diagrams/architecture.svg`,
  `docs/diagrams/explainer.svg`,
  `docs/images/web-wallet-dashboard-desktop.png`,
  `docs/images/web-wallet-dashboard-mobile.png`.

## Decisions

- **Showcase title + grid:** `## Showcase` above a 2-column table,
  dashboard desktop + mobile only, both `height="360"`. Receive shots out
  (uniform size, homepage only). Their files are deleted on both branches;
  the only remaining mentions are inline-code filenames in the historical
  `docs/REVERIFY-PROGRAMME.md`, not links.
- **`.mmd` deletion (main only):** the 8 orphaned Mermaid sources
  (`structure-overview`, `root-files-1`, `root-files-2`, `tools-files`,
  `tools-hdwallet-gen`, `test`, `docs`, `captcha`) were deleted — their
  diagrams are gone and nothing referenced them (grep verified; the one
  remaining `.mmd` mention is a dated historical line in
  `docs/REVERIFY-CHECKLIST.md`). README line 82 wording fixed to match:
  no Mermaid sources remain in `docs/diagrams/`. Token-gaps has no `.mmd`
  files either (they never existed there).
- **`217` → `440` correction:** the README's "217 checks" claim is stale.
  Re-run first-hand on the branch tree 2026-11-24
  (`tools/hdwallet-gen` `npm test`, exit 0): **412** smoke `ok` checks +
  **28** register-links `PASS` checks = **440**, 0 fail. Evidence log:
  `bawa-readme-marketing/217-count-evidence-2026-11-24.log`. The proof
  strip (A4) publishes 440, and the Quickstart line was corrected to
  match. Note: `docs/index.md` and `docs/CAPABILITY-MAP.md` still carry
  the stale 217 figure — flagged here, not changed in this programme.
- **A11 Showcase slot — omitted.** Shape only; no builder run was done,
  so nothing was published. Needs a real `build-wallet.mjs` run + capture.
- **A14 Community & support — omitted.** GitHub Discussions is disabled
  for this repo (`has_discussions: false`, GitHub API, 2026-11-24). No
  forum, chat or Telegram group for Bawa was found, and none was invented.
- **A13 small-fixes sentence — omitted.** "Small fixes … can go straight
  to a pull request" needs owner confirmation (CONTRIBUTING.md does not
  say it). The verified first-step sentence (open an issue first) is in.
- **Main adaptations:** proof strip uses main's own verified numbers
  (136 smoke / 48 launcher / 26 make_wallet, from the README's Verified
  results); A8 omitted (no `docs/archive/mainnet-gap-assessment.md` on
  main); A10 omitted (no starters or `registry/` on main — planned only);
  A7 omitted (no web quickstart on main; Create-your-own covers the
  URL); A13 has no bug-template claim on main (no issue template exists
  there). Main's Contributing already said "Open an issue first."
- **Wasm row extra fix:** while verifying the preview 302 live, the
  adjacent "Wallet engine loads" row was also proved wrong
  (`/wallet-core.wasm` → 404; served at `/bawa/wallet-core.wasm` → 200).
  Fixed on both branches in the same table.
- **Create-your-own clone branch (token-gaps):** Lane A wrote
  `--branch panel-rebuild/readme-marketing`; that branch has since been
  deleted, so the command no longer works. Fixed to
  `--branch panel-rebuild/token-gaps` in the follow-up commit on
  token-gaps (see "Follow-up commits" below).

## Still missing / blocked — resume conditions

- **Lane B — diagrams redraw: LANDED on `token-gaps` `6c93e66` (expansion programme, 2026-11-24).** The diagrams were redrawn purpose-first (commit `460b8f9`, merge `738c666`): banner "One 24-word phrase, one account, 84 chains", HD core centre, web wallet labelled "example — optional", Android + further wallets dashed as PLANNED. Rendered with real Baloo 2 + Inter, viewed at 900/400/390 px. The earlier block in this section is spent: the owner gave the plain-words go-ahead on 2026-11-24.
- **Lane F — FuckCaptcha import: LANDED on `main` `7f9d364` (merge-main lane, 2026-11-24).** The earlier block in this section is spent: the owner gave the plain-words go-ahead on 2026-11-24, the repo (`https://github.com/vsmutok/FuckCaptcha`, author `@vsmutok`, CC0-1.0, a field guide not a code library) was imported as `e751b87` (39 field guides in `captcha/guides/fuckcaptcha/`), credited as "FuckCaptcha (referred to as `@fcukcaptcha`)" per the owner's 2026-11-23 ~21:55 UTC order, and merged into `main` at `7f9d364`.
- **Lane E — captcha generalisation (`0095d82`): LANDED on `main` `7f9d364` (merge-main lane, 2026-11-24).**
  The commit was cherry-picked as `b579f3b` ("captcha: make the runner a fully common captcha tool") plus `6a5dae4` ("captcha: fix the two wrong package.json references in README"), and both were merged into `main` at `7f9d364`. The dated sentence below (Still-missing state verified on `main` `b9fc917`) is the historical record of the pre-landing state and is left untouched.
  Still-missing state verified on `main` `b9fc917`: files still named
  `tronscan-result.json` / `.png`; `CAPTCHA_URL` still defaults to the
  TronScan URL; `captcha/README.md` lines 96 and 106 still cite
  `run-captcha-check/package.json` (no `package.json` exists there; the
  real one is `captcha/package.json`); `captcha/package-lock.json`
  still contains `bawa-captcha-tronscan-check` (2×).

## Known stale line (fixed 2026-11-25)

- Token-gaps README, Project history: the FIX-ALL programme bullet added
  by fix-all Lane I said "work on `panel-rebuild/fix-all-i`, not yet
  merged into `token-gaps`". That was true when written and went stale
  once fix-all merged (tip `7c98420`). Fixed 2026-11-25 on token-gaps:
  the bullet now records the merge (`7c98420`) and links
  [docs/FIX-ALL-PROGRAMME.md](FIX-ALL-PROGRAMME.md).

## Verification (merge lane, first-hand)

- **Counts re-confirmed on the branch tree:** 22 chains
  (`SUPPORTED_CHAINS`, ids match the README list exactly); 21 default
  tokens; 168 chains traces to upstream Trust Wallet Core (no 168-entry
  registry in this repo) — reused, never presented as counted here.
  Contrib.rocks image returns HTTP 200 (4,891 bytes). Live demo URL
  serves (301 → `/bawa/`).
- **Gates on the merged branch tree (`6db1d1e`):** `tsc --noEmit` exit 0;
  `vite build` ✓ built in 1.74 s; `vitest run` 97 files passed,
  1,871 passed, 5 skipped; `tools/hdwallet-gen` `npm test` 440 checks,
  0 fail, exit 0; root `npm run check` exit 0. Live preview:
  `/` → 302, `-L` → 200, `/bawa/` → 200,
  `/bawa/wallet-core.wasm` → 200.
- **Full link checks (0 broken required):** `6db1d1e` — 166 md files,
  278 relative links, 0 broken; `8126b8e` — 50 md files, 254 relative
  links, 0 broken; `7c98420` — 166 md files, 306 relative links,
  0 broken; `b9fc917` — 50 md files, 254 relative links, 0 broken.
  (Re-run on the follow-up record commits; results in the merge report.)
- **Fix-all gates on `7c98420`** (recorded by fix-all): tsc 0, build 0,
  vitest 1,859 passed / 5 skipped (94 files), lint 0, audit 0.

## Follow-up commits (this record)

- Token-gaps: Create-your-own clone-branch fix + this record (SHAs in
  the merge report; this file cannot contain its own commit hash).
- Main: this record (SHA in the merge report).
- Both pushed with the PAT protocol and verified by fresh `ls-remote`
  read-back. Final tips in the merge report.
