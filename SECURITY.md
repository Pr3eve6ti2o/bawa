# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

## Supported versions

The `main` branch is the supported line (current HEAD `da82fe3`, snapshot 2026-11-17). Both `package.json` files list version `1.1.0`, but the repository has no release tags.

## Reporting a vulnerability

No private disclosure channel or reporting contact is established yet. Establishing and publishing a private channel remains an open maintainer action (OI-065).

Use GitHub Issues for non-sensitive reports only. Never post exploit details publicly. For private vulnerability reporting, use the repository's GitHub Security tab where that feature is available. If it is unavailable, do not publish sensitive reports in GitHub Issues.

## Handling reports

The documented report-handling procedure is:

1. Acknowledge receipt of the report.
2. Triage the report.
3. Prepare a fix for confirmed vulnerabilities.
4. Coordinate disclosure with the reporter.

These steps describe handling expectations, not a guaranteed response or timetable.

## Never publish

- mnemonics, except the deliberate 15-word test mnemonic fixture published in `docs/11`;
- private keys;
- `xprv`/`zprv` or other private extended keys;
- recovery data keys;
- `.env` and `.env.*` files, except `.env.example`;
- wallet backup artefacts;
- credentials or API secrets.

## Threat model

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, trust boundaries, secret-handling rules and known limitations. See also [docs/15-threat-model-and-theft-prevention](docs/15-threat-model-and-theft-prevention/README.md). No session or inactivity timeout is implemented in the repository code.