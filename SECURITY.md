# Security

Bawa handles wallet recovery material: mnemonics, private keys, private extended keys, recovery data keys, and encrypted recovery artifacts.

Read [docs/SECURITY.md](docs/SECURITY.md) for the threat model, trust boundaries, secret-handling rules, and known limitations.

## Supported versions

Only version 1.2.0 receives security fixes.

| Version | Status | Security fixes |
| --- | --- | --- |
| 1.2.0 | Current (`package.json`) | Yes |
| 1.1.0 | Superseded | No |

## Reporting a vulnerability

Use a private disclosure path with the repository maintainers to report a vulnerability.

Never post exploit details, mnemonics, private keys, or recovery material in a public issue, chat, or CI log.

## Never publish

Never publish any of the following:

- Mnemonics
- Private keys
- `xprv`/`zprv` or other private extended keys
- Recovery data keys
- Production `.env` files
- Wallet backup artifacts
- Credentials or API secrets