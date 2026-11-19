| Current path | Verdict | New name | One-line reason |
|---|---|---|---|
| `test/` | KEEP | | The singular/plural split is mildly confusing, but the name is accurate; CI/npm/doc migration costs outweigh the clarity gain. |
| `tests/` | KEEP | | Keep the pair unchanged: this accurately names the scripts/registry Node tests, and distinguishing the directories does not justify established-path churn. |
| `registry/ui.json` | RENAME | `registry/ui-implementations.json` | With a separate UI-template registry, `ui.json` leaves the implementation-versus-template scope ambiguous. |
| `PR1-EVIDENCE.md`<br>`RESEARCH-REPORT.md`<br>`SDK-PICK.md` | RENAME | `NOV18-TRUTH-REPRODUCIBILITY-EVIDENCE.md`<br>`NOV18-WALLET-PANEL-RESEARCH.md`<br>`NOV18-WALLET-GENERATION-SDK-PICK.md` | Opaque or unscoped titles hide the reports’ subjects and dated work-lane context among root-level documentation. |
| `requirements.lock` | KEEP | | Clearly identifies locked requirements; hashed pip-compile output fits that name. |
| `test/fixture-oracle.py` | KEEP | | “Oracle” accurately describes the independent reference implementation, and the name matches its fixture-vectors file. |