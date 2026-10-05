# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

See docs/SECURITY.md for the threat model, trust boundaries, secret-handling rules and known limitations.

Never publish:

- mnemonics;
- private keys;
- xprv/zprv or other private extended keys;
- recovery data keys;
- production .env files;
- wallet backup artifacts;
- credentials or API secrets.

For vulnerabilities, use a private disclosure path with the repository maintainers rather than posting exploit details publicly.
