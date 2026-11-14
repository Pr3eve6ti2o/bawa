# Contributing to Bawa

Thank you for helping with [Bawa](https://github.com/Pr3eve6ti2o/bawa)'s documentation. Typos and broken-link fixes count as real contributions.

This guide applies to the docs-only `docs-usecase-split` branch: the root `README.md` and the 10-section guide under `docs/`, from `01-fundamentals` through `10-operations-and-testing`. This branch has no code, tests, CI, or releases.

## Ways you can help

- Fix typos and broken links.
- Make explanations clearer.
- Correct examples without changing protected contracts.
- Add worked examples grounded in the actual guide content.

Do not change derivation paths, fixtures, engine pins, or any crypto contract. These are protected; changes to them are not accepted, including through documentation edits.

## Report a bug or suggest a feature

Use [GitHub issues](https://github.com/Pr3eve6ti2o/bawa/issues) to report problems, propose additions, or contact the maintainers.

- **Documentation bug:** Identify the affected filename or section, describe what is wrong, and explain the expected correction. For a broken link, include the source page and link target.
- **Feature suggestion:** Describe the proposed documentation addition, where it belongs, and which existing guide content it builds on. Keep suggestions within this branch's docs-only scope.

Never include secrets or real recovery material in an issue, pull request, or documentation example. This includes mnemonics, private keys, extended private keys, and `.env` files. Use clearly marked placeholders for sensitive values.

## Propose a documentation change

1. Open an issue first for any substantial change. Small fixes, such as typos and broken links, can go straight to a pull request.
2. Keep your edits focused on `README.md` or the guide under `docs/`. Check explanations and examples against the actual guide content, and leave protected contracts unchanged.
3. Before submitting, run the link checker from the repository root:

   ```sh
   python3 scripts/check-links.py
   ```

   It reports broken relative links in this branch's documentation. Fix broken relative links in your changes before submitting. There is no `npm test` or Python test suite on this branch.

4. Open a [GitHub pull request](https://github.com/Pr3eve6ti2o/bawa/pulls). Summarize what you changed and why, link any related issue, and include the link-check result.

## Maintainer workflow

Maintainer workflow details are not yet established. There is no established fork/branch workflow, branch-naming convention, target-branch rule, or response-time promise. Ask workflow questions through this repository's GitHub issues.