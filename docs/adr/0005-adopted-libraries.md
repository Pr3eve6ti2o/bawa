# ADR-0005 — Adopted libraries

## Context

- `@scure/bip39`: supply BIP-39 validation and support tests/docs without replacing wallet-core.
- `bip39`: provide a separate JavaScript test oracle for BIP-39 behavior.
- `mnemonic`: cross-check Python seeds against `bip_utils` with a second implementation.
- `decimal.js`: support decimal fee/fiat/display math while base units stay `BigInt`.
- `mnemonic-words`: supply the 2,048-word mnemonic list as JSON data.
- `dinero.js`: provide a fiat-display utility. **Removed 2026-11-24 by token-verify Lane C** — see the amendment under Status; `decimal.js` remains the fee/fiat/display math library.

## Decision

Adopt these exact pins, verified in tree `7220e8f` on `panel-rebuild/adopt-libs`:

- `@scure/bip39` 2.4.0 — `apps/web` dependency; BIP-39 validation, tests and docs only, not a wallet-core replacement.
- `bip39` 3.1.2 (`bitcoinjs/bip39`) — `apps/web` devDependency; JavaScript test oracle only.
- `mnemonic==0.21` (`trezor/python-mnemonic`) — `requirements.txt`; second check in `tools/make_wallet.py`, comparing seeds byte-for-byte with `bip_utils`.
- `decimal.js` 10.6.0 — `apps/web` dependency; fee/fiat/display math only; base units remain `BigInt`.
- `mnemonic-words` 2.0.0 — `apps/web` dependency; 2,048-word list as JSON data only, verified deep-equal to the `@scure/bip39` word list.
- `dinero.js` 2.0.2 — **REMOVED** (token-verify Lane C, 2026-11-24; 0 hits in `apps/web/package.json`): fiat display is now the BigInt `decimal.ts` (`apps/web/src/wallet/decimal.ts`) with `decimal.js` 10.6.0 as its differential-test oracle.
- Unchanged: `@trustwallet/wallet-core` 4.9.3 remains the only engine dependency; no derivation-path, vault-encryption or broadcast change.

## Alternatives Considered

- Wallet-core-only dependencies — rejected because they would omit the separate validation/test cross-checks, JSON word-list data and scoped fee/fiat/display helpers selected here.
- Vendoring the code — rejected to avoid maintaining local copies instead of consuming verified, exact upstream package pins.

## Status

accepted

Amendment (2026-11-26, guide-update pass): `dinero.js` 2.0.2 was removed by token-verify Lane C (2026-11-24) — the fiat-display role moved to the BigInt `decimal.ts`, which replaced both `decimal.js` and `dinero.js` at runtime; `decimal.js` 10.6.0 stays as the differential-test oracle. The Context and Decision entries above are annotated, not deleted, so the adoption history stays readable.

## Consequences

- All six libraries use the exact versions listed above, not version ranges.
- Adoption is limited to the stated validation/tests/docs, seed cross-check, JSON-data and fee/fiat/display scopes; wallet-core remains the sole engine and base units remain `BigInt`.
- Fiat utilities have no live call site yet (no price feed).
- `formatFeePreview` rounds sub-0.5-micro fees to 0 at 6dp on the estimate line only.
- The tampered-checksum test pins rejection via `bip_utils` rather than isolating the Trezor path.
