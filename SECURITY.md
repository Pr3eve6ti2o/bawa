# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

See docs/SECURITY.md for the threat model, trust boundaries, secret-handling rules and known limitations. No session or inactivity timeout is implemented in the repository code; see docs/SECURITY.md.

Never publish:

- mnemonics;
- private keys;
- xprv/zprv or other private extended keys;
- recovery data keys;
- production .env files;
- wallet backup artifacts;
- credentials or API secrets.

A disclosure procedure is documented in [`docs/SECURITY.md`](docs/SECURITY.md#vulnerability-disclosure-procedure), with private reporting through GitHub's private vulnerability reporting for this repository. No private email contact is published. Do not post exploit details publicly.
