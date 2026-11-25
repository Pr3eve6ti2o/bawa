/**
 * CAIP-2 / CAIP-10 identifiers (chain ids and account ids).
 *
 * Implemented here from the public CAIP-2 and CAIP-10 specifications
 * (namespace:reference and namespace:reference:address, joined with
 * ":"). The function names mirror the well-known @walletconnect/utils
 * helpers (parseChainId, formatChainId, parseAccountId,
 * formatAccountId, getAddressFromAccount, getChainFromAccount,
 * formatAccountWithChain) so callers read the same way — but no code
 * was taken from there: the @walletconnect/utils package in the
 * surveyed walletconnect-monorepo checkout is under the Reown
 * Community Licence ("SEE LICENSE IN LICENSE.md"), which the owner
 * has not accepted, and the MIT-licensed walletconnect-utils checkout
 * contains no CAIP module at all. These few string splits are the
 * whole implementation; there is nothing to vendor.
 *
 * Used where the wallet hand-rolls these identifiers: chains.ts
 * builds networkIds through formatChainId. The account-id helpers
 * are kept for the registry's own key form — the ERC-7730 index is
 * keyed by CAIP-10 contract ids (eip155:<chainId>:<address>) — and
 * are covered by tests; the resolver itself matches on address +
 * chain list instead, so the snapshot stays small.
 */

export type CaipChainId = {
  readonly namespace: string;
  readonly reference: string;
};

export type CaipAccountId = CaipChainId & {
  readonly address: string;
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

function assertAddress(address: string): void {
  if (address.length === 0 || address.includes(':')) {
    throw new Error('Invalid CAIP address');
  }
}

/** Split "namespace:reference" (CAIP-2); throws on a malformed id. */
export function parseChainId(chain: string): CaipChainId {
  const [namespace, reference] = chain.split(':');
  if (
    namespace === undefined ||
    reference === undefined ||
    chain.split(':').length !== 2
  ) {
    throw new Error('Invalid CAIP-2 chain id');
  }
  assertNamespace(namespace);
  assertReference(reference);
  return { namespace, reference };
}

/** Join a CAIP-2 chain id from its parts. */
export function formatChainId({ namespace, reference }: CaipChainId): string {
  assertNamespace(namespace);
  assertReference(reference);
  return `${namespace}:${reference}`;
}

/** Split "namespace:reference:address" (CAIP-10); throws on a malformed id. */
export function parseAccountId(account: string): CaipAccountId {
  const [namespace, reference, address] = account.split(':');
  if (
    namespace === undefined ||
    reference === undefined ||
    address === undefined ||
    account.split(':').length !== 3
  ) {
    throw new Error('Invalid CAIP-10 account id');
  }
  assertNamespace(namespace);
  assertReference(reference);
  assertAddress(address);
  return { namespace, reference, address };
}

/** Join a CAIP-10 account id from its parts. */
export function formatAccountId({
  namespace,
  reference,
  address,
}: CaipAccountId): string {
  assertNamespace(namespace);
  assertReference(reference);
  assertAddress(address);
  return `${namespace}:${reference}:${address}`;
}

/** The address part of a CAIP-10 account id. */
export function getAddressFromAccount(account: string): string {
  return parseAccountId(account).address;
}

/** The "namespace:reference" chain part of a CAIP-10 account id. */
export function getChainFromAccount(account: string): string {
  const { namespace, reference } = parseAccountId(account);
  return formatChainId({ namespace, reference });
}

/** Build a CAIP-10 account id for an address on a CAIP-2 chain. */
export function formatAccountWithChain(address: string, chain: string): string {
  const { namespace, reference } = parseChainId(chain);
  return formatAccountId({ namespace, reference, address });
}
