// Regression tests for the xpub-privacy disclosure in the generated web
// wallet (T49 F-04). Extended public keys are public key material, but
// they let the holder track an account's addresses, balances and
// history; the starter stores them in localStorage and locking does not
// delete them. The UI must say so where keys are added and managed, and
// must offer forgetting as "Forget stored key" / "Forget all stored
// keys" (backed by the existing per-chain removal).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const IMPORT = new URL(
  '../apps/web/src/screens/import-wallet.tsx',
  import.meta.url,
);
const MANAGE = new URL(
  '../apps/web/src/screens/wallet-management.tsx',
  import.meta.url,
);

const WARNING = 'lets its holder track this account';

describe('generated web wallet xpub-privacy disclosure (T49 F-04)', () => {
  test('the import screen warns that an xpub enables tracking', () => {
    const src = readFileSync(IMPORT, 'utf8');
    assert.ok(src.includes(WARNING), 'import screen must warn about xpub tracking');
    assert.ok(
      src.includes('stored in this browser (localStorage)'),
      'import screen must state where keys are stored',
    );
    assert.ok(
      src.includes('stay stored'),
      'import screen must state that locking does not delete stored keys',
    );
  });

  test('the management screen warns and offers forgetting', () => {
    const src = readFileSync(MANAGE, 'utf8');
    assert.ok(src.includes(WARNING), 'management screen must warn about xpub tracking');
    assert.ok(src.includes('Forget stored key'), 'per-chain removal must be labelled forgetting');
    assert.ok(src.includes('Forget all stored keys'), 'a forget-all action must be offered');
    assert.ok(
      src.includes('cannot revoke a copy someone already took'),
      'management screen must state the limit of forgetting',
    );
  });
});
