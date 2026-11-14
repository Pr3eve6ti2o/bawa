# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

## Supported versions

The `main` branch is the supported line (current HEAD `16c074e` plus staged changes). Both `package.json` files list version `1.1.0`, but the repository has no release tags.

## Reporting a vulnerability

No vulnerability-disclosure procedure or private reporting contact is currently provided in this repository. Do not post exploit details publicly.

## Handling reports

No report-handling procedure is currently published. Establishing and publishing a private disclosure channel remains an open maintainer action.

## Never publish

- mnemonics;
- private keys;
- `xprv`/`zprv` or other private extended keys;
- recovery data keys;
- production `.env` files;
- wallet backup artefacts;
- credentials or API secrets.

## Threat model

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, trust boundaries, secret-handling rules and known limitations. No session or inactivity timeout is implemented in the repository code.