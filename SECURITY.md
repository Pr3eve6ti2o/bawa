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

No vulnerability-disclosure procedure or private reporting contact is currently provided in this repository. Establishing and publishing a private disclosure channel remains an open maintainer action. Do not post exploit details publicly.
