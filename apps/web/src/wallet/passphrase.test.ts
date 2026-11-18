// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  isPassphraseUsed,
  setPassphraseUsed,
} from './passphrase';

beforeEach(() => {
  localStorage.clear();
});

describe('passphrase flag', () => {
  it('defaults to false', () => {
    expect(isPassphraseUsed()).toBe(false);
  });

  it('round-trips true and false without storing the passphrase', () => {
    setPassphraseUsed(true);
    expect(isPassphraseUsed()).toBe(true);
    expect(localStorage.getItem('bawa-vault-passphrase-used')).toBe('1');
    setPassphraseUsed(false);
    expect(isPassphraseUsed()).toBe(false);
    expect(localStorage.getItem('bawa-vault-passphrase-used')).toBe('0');
  });
});
