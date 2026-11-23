/**
 * Single-use secret handoff for screen-to-screen secrets.
 *
 * Secrets live only in memory under incrementing numeric IDs and are
 * consumed on retrieval. Secrets never enter persistence, navigation
 * state, or logs. IDs are routing handles, not authorisation tokens.
 * Deleting an entry drops the stored reference; JavaScript memory
 * erasure is not guaranteed.
 */

const MAX_PENDING_SECRETS = 8;
const secrets = new Map<number, string>();
let nextId = 1;

export function storeSecret(secret: string): number {
  if (secret.length === 0) {
    throw new Error('Secret must not be empty.');
  }
  if (secrets.size >= MAX_PENDING_SECRETS) {
    throw new Error('Too many pending secrets.');
  }
  const id = nextId;
  nextId += 1;
  secrets.set(id, secret);
  return id;
}

export function takeSecret(id: number): string | null {
  const secret = secrets.get(id);
  if (secret === undefined) {
    return null;
  }
  // Deletion drops the stored reference; JavaScript memory erasure is not guaranteed.
  secrets.delete(id);
  return secret;
}

export function hasSecret(id: number): boolean {
  return secrets.has(id);
}

export function discardSecret(id: number): void {
  // Deletion drops the stored reference; JavaScript memory erasure is not guaranteed.
  secrets.delete(id);
}

export function clearSecrets(): void {
  // Clearing drops stored references; JavaScript memory erasure is not guaranteed.
  secrets.clear();
}

export function pendingSecretCount(): number {
  return secrets.size;
}
