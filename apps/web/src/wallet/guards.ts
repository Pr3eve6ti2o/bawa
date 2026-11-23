// Shared JSON-shape guards (Lane 4 consolidation).
//
// `isRecord` was copied byte-identically into 14 modules and `ownValue`
// into 3; every copy had the same semantics, so they live here now —
// one definition, imported where needed. `isPlainObject`
// (wallet/token-prices.ts) is intentionally NOT here: its prototype
// check is stricter than `isRecord` and means something different.

/** True for a non-null, non-array object (JSON objects, parsed payloads). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Own property only: inherited fields and unreadable getters/properties
 * count as absent (returns undefined instead of throwing).
 */
export function ownValue(object: Record<string, unknown>, key: string): unknown {
  try {
    return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
  } catch {
    return undefined;
  }
}
