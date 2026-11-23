// Shared JSON-shape guards (Lane 4 consolidation; `isPlainObject`
// added by marketing-fix Lane 2).
//
// `isRecord` was copied byte-identically into 14 modules and `ownValue`
// into 3; every copy had the same semantics, so they live here now —
// one definition, imported where needed. `isPlainObject` joins them:
// the two copies (prices.ts local, token-prices.ts module-level) were
// semantically identical — the only difference was where the Array
// check sat, and Array.isArray never throws, so the placement is
// immaterial. It stays distinct from `isRecord`: a class instance or
// Date is a record but not a plain object, and only plain objects are
// trusted as parsed provider payloads.

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

/**
 * True only for plain JSON objects: non-null, non-array, prototype is
 * Object.prototype or null. Stricter than `isRecord` — a class instance
 * or Date is a record but not a plain object. Guard inspection can
 * throw (unusual objects/proxies), so the check is wrapped.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}
