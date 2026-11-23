# Decisions

## 10. UI/UX Fixes programme — 21 items, merged into token-gaps (2026-11-23)

**Decision: the 21-item UI/UX Fixes programme (owner order 2026-11-23
~04:40 IST) is complete and merged into `panel-rebuild/token-gaps`.**
Branch `panel-rebuild/ui-ux-fixes` (`68fd75b`, branched from token-gaps
`488f644`, devnet mode brought in from `panel-rebuild/devnet-temp`
`8994584`) was merged into token-gaps by Lane E (hands-on Muse, 0 Sol
calls) as merge commit `4eb0242`. Merge destination per the owner's
decision 2026-11-23 ~05:11 IST: further work continues on top of
token-gaps. No code merged into `panel-rebuild/adopt-proper` or `main`.

Gates on the merged tree, first-hand (Node 22.23.4, `apps/web`): `npx
tsc --noEmit` 0; `npm run build` 0; full vitest 86 files, 1644 passed /
5 skipped; `npm run lint` 0; `npm audit` 0 vulnerabilities; root `npm
test` 0 (after `npm ci` in `tools/hdwallet-gen` — the first attempt in
the fresh worktree failed only on absent `node_modules`, not on code).
CDP re-verification at 1919/1440/820/390 was done by the coordinator on
`ui-ux-fixes` before the merge and passed; Lane E did not re-run CDP.

Item 21 (document everything): `docs/UI-UX-FIXES-PROGRAMME.md` is the
programme record (all 21 items, gates, branch state, preview/Pages
pointers, still-open list). Doc-only updates were pushed to `main` and
the active remote branches (`adopt-proper`, `desktop-layout-v2`,
`devnet-temp`, `token-discovery`, `token-gaps`, `ui-ux-fixes`) on
2026-11-23 per the owner's order. Dead local-only lane branches were
left alone (superseded intermediates, not on the remote).

Still open after the programme: E2E-03/06 need a stable-network run;
non-zero DOGE watch-row render unproven; 1919 settled widths not
captured; TON Issue 5 (first-send state init) and Issue 6 (`/track`
message hash) in `DEVNET-ISSUES.md`; devnet exception E1 expires
2027-02-20; the mobile Receive 40 px question awaits the owner's pick;
the item-14 cannot-add chain list is not recorded in the repo.
