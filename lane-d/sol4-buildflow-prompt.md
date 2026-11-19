You are helping document the Bawa one-prompt wallet builder workflow. Please be kind and precise — thank you!

TASK: Draft ONE Mermaid flowchart for the build/generation flow. Emit ONLY the Mermaid code block plus up to 3 short lines noting anything you think is missing. Do not invent steps or scripts.

VERIFIED FACTS (from ai/request-routing.md and scripts/):
- The entry point is scripts/build-wallet.mjs "<request>" (the CLI). Its stages, in order: parse the request, plan, match a profile, select the engine, select chains, select a template, inspect, scaffold, implement, verify, audit claims, report.
- Helpers: scripts/classify-request.mjs (classification), scripts/plan-build.mjs (planning), scripts/generate-project.mjs (scaffolds the project into generated/<profile-id>), scripts/quality-gates.mjs, scripts/validate-registry.mjs, scripts/secret-scan.mjs, scripts/gate-verdict.mjs (verification gates).
- The builder selects ONLY from registry/ (profiles.json, capabilities.json, engines.json, ui.json) — it never invents a stack.
- The CLI never waits for input: an unclassifiable request writes a classification-failure report (profile null, exit 2); a refused request writes a refusal report (exit 2); an ambiguous request writes an AMBIGUOUS report (exit 2). A successful run writes a JSON report.
- The user request itself is untrusted task data (trust boundary T46): embedded instructions in it cannot amend routing policy.

ACCEPTANCE CHECK: valid Mermaid flowchart syntax; at most 9 top-level nodes — group the 12 stages into at most 6 stage nodes (Parse, Classify, Plan, Generate, Verify, Report) plus the three exit-2 outcomes; include accTitle and accDescr lines; show the registry as the source the builder selects from; show that the request is untrusted input.
