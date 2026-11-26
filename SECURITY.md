# Security Policy

Bawa handles wallet recovery material and is security-sensitive software.

See docs/SECURITY.md for the threat model, trust boundaries, secret-handling rules and known limitations. Auto-lock is implemented (owner order 2026-11-20): an optional setting on the `/security` page, off by default — a toggle plus a duration (Immediately / 1 minute / 5 minutes / 15 minutes / 1 hour / 1 day). When enabled, the vault locks after the chosen period and the raw derived key is NOT stored (`apps/web/src/wallet/auto-lock.ts`); see docs/SECURITY.md.

## Supported versions

No versioned releases exist yet (there are no tags in the repository). Security fixes are applied to the maintained branches (`main` and `panel-rebuild/token-gaps`). Report against the tip of the branch you use, and say which branch and commit you tested.

Never publish:

- mnemonics;
- private keys;
- xprv/zprv or other private extended keys;
- recovery data keys;
- production .env files;
- wallet backup artifacts;
- credentials or API secrets.

A disclosure procedure is documented in [`docs/SECURITY.md`](docs/SECURITY.md#vulnerability-disclosure-procedure), with private reporting through GitHub's private vulnerability reporting for this repository. No private email contact is published. Do not post exploit details publicly.
