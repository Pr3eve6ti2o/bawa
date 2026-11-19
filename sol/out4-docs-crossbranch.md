| Current path | Verdict | New name | One-line reason |
|---|---|---|---|
| 1. `docs/security-AUDIT-TOOLCHAIN.md` | RENAME | `docs/SECURITY-AUDIT-TOOLCHAIN.md` | The sole mixed-case filename breaks the established casing styles; uppercase matches `SECURITY.md`. |
| 2. `docs/05-watch-only/GUI-WATCH-ONLY-WORKFLOW.md`<br>`docs/05-watch-only/TON-WATCH-ONLY-TESTING.md` | RENAME | `docs/05-watch-only/gui-watch-only-workflow.md`<br>`docs/05-watch-only/ton-watch-only-testing.md` | Matches the numbered sections’ kebab-case guide convention; update the listed references, including the CLI map. |
| 3. `docs/UI-UX-REFERENCE-research.md` | RENAME | `docs/UI-UX-REFERENCE-RESEARCH.md` | Fixes inconsistent mixed casing; the research suffix already distinguishes it from the governing specification. |
| 4. `docs/index.md` | KEEP | | Accurately names an index; overlapping entry points are a navigation/content issue, not a filename defect. |
| 5. `docs/EXTERNAL-TOOLS.md` vs `docs/EXTERNAL-TOOLS-RESEARCH-NOTES.md` | KEEP | | `RESEARCH-NOTES` clearly distinguishes the supporting research from the guide. |
| 6. `captcha/` (main only) | RENAME | `tronscan-approval-experiment/` | Names the otherwise-hidden TronScan Approval-check scope and experimental status. |
| 7. `docs/06-tracking/providers.json` (main only) | KEEP | | Clearly names provider data; `.json` identifies the format, while placement under `docs/` is a separate concern. |
| 8. `apps/web/src/screens/create.tsx` vs `apps/web/src/screens/create-wallet.tsx` (multichain-create only) | RENAME | `apps/web/src/screens/create-hub.tsx` (hub only) | `create` can be mistaken for the wallet flow; `create-hub` identifies the chooser. Keep `create-wallet.tsx`. |
| 9. `docs/adr/0006-price-feed-provider.md` replacing `docs/adr/0006-use-case-split.md` | RENAME | `docs/adr/NNNN-price-feed-provider.md` — next unused ADR number | Reusing `0006` breaks stable decision identity; reserve it for use-case split. |