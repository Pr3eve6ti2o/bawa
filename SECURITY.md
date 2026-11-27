# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

## Supported versions

The `main` branch is the supported line (verified 2026-11-28; historical snapshot `da82fe3`, 2026-11-17). Both `package.json` files list version `1.1.0`, but the repository has no release tags.

## Reporting a vulnerability

Report vulnerabilities through [GitHub Issues](https://github.com/Pr3eve6ti2o/bawa/issues). There is no separate private disclosure channel: this is a guide repository, and GitHub Issues is the single reporting route (maintainer decision, 2026-11-18; OI-065 closed). Do not post exploit details publicly; describe the issue at a level that lets the maintainer reproduce it without publishing working exploit material.

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