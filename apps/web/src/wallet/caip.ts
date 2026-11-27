/**
 * CAIP-2 chain ids ("namespace:reference").
 *
 * Implemented here from the public CAIP-2 specification
 * (namespace:reference, joined with ":"). The function name mirrors
 * the well-known @walletconnect/utils helper (formatChainId) so
 * callers read the same way — but no code was taken from there: the
 * @walletconnect/utils package in the surveyed
 * walletconnect-monorepo checkout is under the Reown Community
 * Licence ("SEE LICENSE IN LICENSE.md"), which the owner has not
 * accepted, and the MIT-licensed walletconnect-utils checkout
 * contains no CAIP module at all. This one string join is the whole
 * implementation; there is nothing to vendor.
 *
 * Used where the wallet hand-rolls these identifiers: chains.ts
 * builds networkIds through formatChainId. The CAIP-10 account-id
 * helpers (parseAccountId, formatAccountId, getAddressFromAccount,
 * getChainFromAccount, formatAccountWithChain) and parseChainId were
 * removed in bug-hunt v2: they had no production caller — only tests
 * — and the resolver matches on address + chain list instead of the
 * CAIP-10 key form, so "covered by tests" was their only claim to
 * life. Do not re-add them without a real consumer.
 */

type CaipChainId = {
  readonly namespace: string;
  readonly reference: string;
};

const NAMESPACE_PATTERN = /^[a-z0-9]{3,8}$/;
const REFERENCE_PATTERN = /^[-_a-zA-Z0-9]{1,32}$/;

function assertNamespace(namespace: string): void {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('Invalid CAIP namespace');
  }
}

function assertReference(reference: string): void {
  if (!REFERENCE_PATTERN.test(reference)) {
    throw new Error('Invalid CAIP reference');
  }
}

/** Join a CAIP-2 chain id from its parts. */
export function formatChainId({ namespace, reference }: CaipChainId): string {
  assertNamespace(namespace);
  assertReference(reference);
  return `${namespace}:${reference}`;
}
