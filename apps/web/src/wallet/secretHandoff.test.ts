import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSecrets,
  discardSecret,
  hasSecret,
  pendingSecretCount,
  storeSecret,
  takeSecret,
} from './secretHandoff';

describe('secretHandoff', () => {
  beforeEach(() => {
    clearSecrets();
  });

  it('stores a secret and returns it on take', () => {
    const id = storeSecret('secret');

    expect(pendingSecretCount()).toBe(1);
    expect(takeSecret(id)).toBe('secret');
    expect(pendingSecretCount()).toBe(0);
  });

  it('returns null on a second take of the same ID', () => {
    const id = storeSecret('secret');

    expect(takeSecret(id)).toBe('secret');
    expect(takeSecret(id)).toBeNull();
  });

  it('returns null for an unknown ID', () => {
    const id = storeSecret('secret');

    expect(takeSecret(0)).toBeNull();
    expect(takeSecret(id)).toBe('secret');
  });

  it('reports that a secret is absent after a take', () => {
    const id = storeSecret('secret');

    expect(hasSecret(id)).toBe(true);
    takeSecret(id);
    expect(hasSecret(id)).toBe(false);
  });

  it('discards a secret without returning it and silently ignores missing IDs', () => {
    const id = storeSecret('secret');

    expect(discardSecret(id)).toBeUndefined();
    expect(hasSecret(id)).toBe(false);
    expect(takeSecret(id)).toBeNull();
    expect(pendingSecretCount()).toBe(0);
    expect(discardSecret(id)).toBeUndefined();
  });

  it('clears all pending entries', () => {
    const firstId = storeSecret('first secret');
    const secondId = storeSecret('second secret');

    expect(pendingSecretCount()).toBe(2);

    clearSecrets();

    expect(pendingSecretCount()).toBe(0);
    expect(hasSecret(firstId)).toBe(false);
    expect(hasSecret(secondId)).toBe(false);
    expect(takeSecret(firstId)).toBeNull();
    expect(takeSecret(secondId)).toBeNull();
  });

  it('rejects a ninth secret when eight secrets are pending', () => {
    for (let index = 0; index < 8; index += 1) {
      storeSecret('secret');
    }

    expect(pendingSecretCount()).toBe(8);
    expect(() => storeSecret('ninth secret')).toThrowError(
      new Error('Too many pending secrets.'),
    );
    expect(pendingSecretCount()).toBe(8);
  });

  it('rejects an empty secret', () => {
    expect(() => storeSecret('')).toThrowError(
      new Error('Secret must not be empty.'),
    );
    expect(pendingSecretCount()).toBe(0);
  });

  it('assigns distinct incrementing IDs and takes secrets independently', () => {
    const firstId = storeSecret('first secret');
    const secondId = storeSecret('second secret');

    expect(secondId).toBe(firstId + 1);
    expect(takeSecret(firstId)).toBe('first secret');
    expect(hasSecret(secondId)).toBe(true);
    expect(pendingSecretCount()).toBe(1);
    expect(takeSecret(secondId)).toBe('second secret');
    expect(pendingSecretCount()).toBe(0);
  });
});
