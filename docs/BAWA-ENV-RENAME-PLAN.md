# Bawa environment-variable rename plan

Repository: `Pr3eve6ti2o/bawa` — finding A-5 / register row D06 F8.

## Problem

There are exactly two live `NOVA_*` environment-variable names:

- `NOVA_ENV` is read by `tools/hdwallet-gen/compare.js` to select the `.env` file. The default is the repository-root `.env`.
- `NOVA_SECRETS_DIR` is read by `tools/hdwallet-gen/generate.js` and `tools/make_wallet.py` to select the secrets directory. The default is `<repo>/secrets`.

A Nova Shop install's variables with these same names would silently redirect Bawa's env-file and seed-directory lookups.

The namespace is already mixed: `BAWA_ENV_FILE` and `BAWA_BACKUP_DIR` already exist and are used by the launcher tools. This rename completes the Bawa namespace; it does not introduce it.

`docs/security-release-gates.md` already requires a rename to `BAWA_*` with guarded migration. `docs/14` calls `NOVA_ENV` a frozen legacy identifier pending a code change and a migration note.

## Target names

| Legacy name | Target name |
| --- | --- |
| `NOVA_ENV` | `BAWA_ENV_FILE` |
| `NOVA_SECRETS_DIR` | `BAWA_SECRETS_DIR` |

The existing names `BAWA_ENV_FILE` and `BAWA_BACKUP_DIR` are unchanged. The env-file mapping reuses the existing launcher name. Defaults remain the repository-root `.env` and `<repo>/secrets`.

The separate legacy AAD string `nova-shop-seed-v1` is **FROZEN**. It is the AES-256-GCM additional authenticated data used in `generate.js` and `decrypt_seed.py`, and is recorded in each bundle's `aad` field. Renaming it would break recovery of existing bundles. This plan does not rename it; any change needs its own versioned migration decision.

## Guarded migration steps

These steps require a separate maintainer decision before execution.

1. Implement guarded dual-read for the mapped variables in each affected tool.
   Check for conflicts before any env-file or secrets-directory lookup: if both names are set to different values, refuse to run with a clear error on stderr; never silently pick one.
   Otherwise, the new name wins when set, and the old name alone is accepted.
   Emit a deprecation warning on stderr whenever an old name is set, including when both values match.
   If neither name is set, retain the existing defaults.
   Migration diagnostics must never print secret values; identify variables by name, not by value.
2. Update every code reference, test, doc and example to use the new names.
   Retain legacy spellings only for the temporary compatibility handling, its tests and explicit migration documentation. Leave the frozen AAD string unchanged.
3. Add a migration test covering every affected reader: old name alone works with a deprecation warning on stderr; new name alone works; both-conflicting refuses; neither set uses the existing defaults.
   Also verify that matching values for both names work and that migration diagnostics disclose no secret values.
4. Run the full suite (130 checks), `npm run check`, `test_make_wallet.py` (14/14), and the differential test.
5. Publish the migration note with the version the rename lands in.
   Document the mappings, unchanged defaults, warnings, conflict refusal and one-release compatibility window.
6. After one release cycle, remove the old environment-variable names and the dual-read code.
   This removal must not change `nova-shop-seed-v1`.

## Decision

Execution authorised by the owner on 2026-11-10 (~18:23 IST) as part of
the review-fix lane (finding F-03: fix the five Highs and the handoff
corrections). The rename lands in the local builder tree; no release or
date is selected here. The AAD string question remains open and outside
this migration.

## Status

**EXECUTED — 2026-11-10 (review-fix lane, finding F-03).**

What changed: guarded dual-read implemented in both consumers
(`tools/hdwallet-gen/generate.js` `resolveSecretsDir` and
`tools/make_wallet.py` `resolve_secrets_dir`); canonical name
`BAWA_SECRETS_DIR`; conflicting old/new values refuse to run; the old
name alone is accepted with a deprecation warning on stderr; neither
set uses the existing default `<repo>/secrets`. Every code reference,
test, doc and example now uses the new name. Migration tests cover
both readers (`test/test_make_wallet.py`,
`tests/secrets-dir.test.mjs`). The `NOVA_ENV` / `compare.js` selector
is NOT part of this migration and is unchanged. The frozen AAD string
`nova-shop-seed-v1` is unchanged.

Compatibility window: the old name and dual-read code are removed
after one release cycle. No release or date is selected here.

Not covered by this migration:

- No change to `NOVA_ENV` (compare.js).
- No change to the frozen AAD string `nova-shop-seed-v1`.
