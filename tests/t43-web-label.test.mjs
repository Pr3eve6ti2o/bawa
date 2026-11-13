// Regression tests for the T43 web watch-only fixes (r2b):
// (a) a rejected pasted value is cleared from the import input/state,
// (b) the wallet label is length-bounded at the storage boundary and
// on restore, (d) the backup screen states that an xpub alone cannot
// recover spending access. Source assertions, following the
// web-xpub-privacy test style: the behaviour lives in React state and
// localStorage, so the boundary is asserted where it is written.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const IMPORT = new URL(
  '../apps/web/src/screens/import-wallet.tsx',
  import.meta.url,
);
const CONTEXT = new URL(
  '../apps/web/src/state/wallet-context.tsx',
  import.meta.url,
);
const BACKUP = new URL(
  '../apps/web/src/screens/mnemonic-backup.tsx',
  import.meta.url,
);

describe('web watch-only fixes (T43 r2b)', () => {
  test('(a) import clears the rejected value before reporting the error', () => {
    const src = readFileSync(IMPORT, 'utf8');
    const failure = src.indexOf('if (!validation.ok)');
    assert.ok(failure >= 0, 'import must validate the pasted value');
    const block = src.slice(failure, src.indexOf('}', src.indexOf('return;', failure)) + 1);
    assert.ok(block.includes("setXpub('')"), 'validation failure must clear the input state');
    assert.ok(
      block.indexOf("setXpub('')") < block.indexOf('setError'),
      'the clear must happen before the error is set',
    );
  });

  test('(b) the label is capped at 40 at the storage boundary and on restore', () => {
    const src = readFileSync(CONTEXT, 'utf8');
    assert.ok(
      src.includes('export const LABEL_MAX_LENGTH = 40'),
      'the cap must be a named, exported constant',
    );
    assert.ok(
      src.includes('if (trimmedLabel.length > LABEL_MAX_LENGTH)'),
      'addXpub must throw on an over-long label',
    );
    assert.ok(
      src.includes("rawLabel.length > LABEL_MAX_LENGTH ? '' : rawLabel"),
      'restore must drop an over-long stored label to an empty string',
    );
    const importSrc = readFileSync(IMPORT, 'utf8');
    assert.ok(
      importSrc.includes('maxLength={40}'),
      'the label input must carry maxLength={40}',
    );
  });

  test('(d) the backup screen states an xpub alone cannot recover spending', () => {
    const src = readFileSync(BACKUP, 'utf8');
    // JSX wraps the paragraph across lines; normalise whitespace so the
    // assertions read the rendered text, not the line breaks.
    const text = src.replace(/\s+/g, ' ');
    assert.ok(
      text.includes('An extended public key alone cannot recover spending access'),
      'backup guidance must state the xpub-only limit',
    );
    assert.ok(
      text.includes('only restores watch-only monitoring'),
      'backup guidance must state what an xpub restores',
    );
    assert.ok(
      text.includes('Spending access is restored from the 24 words'),
      'backup guidance must name the spending-recovery route',
    );
  });
});
