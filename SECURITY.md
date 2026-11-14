# Security policy

## Scope and supported versions

The `docs-usecase-split` branch is documentation-only: a ten-section guide under `docs/`, from `01-fundamentals` through `10-operations-and-testing`, plus the root `README.md`.

This branch contains no code, tests, CI, or releases. No versioned software ships here, so there are no supported software versions to list.

## Security guidance

Bawa handles wallet recovery material and is security-sensitive. Read [`docs/08-security-recovery/README.md`](docs/08-security-recovery/README.md) for the threat model, trust boundaries, secret-handling rules, and known limitations.

Never publish:

- Mnemonics.
- Private keys.
- `xprv`, `zprv`, or other private extended keys.
- Recovery data keys.
- Production `.env` files.
- Wallet backup artifacts.
- Credentials or API secrets.

Keep these materials out of documentation, examples, issues, pull requests, and attachments.

## Reporting vulnerabilities

**No private reporting channel exists yet.** This repository currently has no vulnerability-disclosure procedure and no private reporting contact.

**Do not post exploit details publicly.** Public issues are not an appropriate place to disclose exploit details. Do not include those details or secret material in public issues, pull requests, or documentation.

Establishing a private disclosure channel remains an open maintainer action. There is currently no reporting destination or disclosure-handling process to follow in this repository.