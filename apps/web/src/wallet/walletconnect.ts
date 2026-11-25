/**
 * WalletConnect (dApp connectivity) — config and namespace logic.
 *
 * Lane C, "install all usable" programme (2026-11-25). Bawa is the
 * wallet; dApps connect to it through WalletConnect Sign v2.
 *
 * LICENCE (hard rule): the SDK is `@walletconnect/sign-client` pinned
 * to exactly 2.21.0 — the last Apache-2.0 release. 2.22.0+ switched to
 * Reown Inc.'s custom Community Licence (mandatory Reown gateway,
 * commercial licence above 500 MAU/month, Reown owns modifications);
 * accepting that licence is the owner's call, not this lane's. The
 * pin is exact in apps/web/package.json, and the installed tree was
 * verified first-hand: sign-client, core, types and utils are all
 * 2.21.0 Apache-2.0; the 1.x support packages are MIT. Never bump
 * any `@walletconnect/*` package without re-checking its licence.
 *
 * BUNDLE: nothing in this module imports the SDK at runtime — the
 * only SDK import is `import type`, which is erased before bundling.
 * The SDK itself lives behind a dynamic import in
 * walletconnect-client.ts and must never enter the main chunk.
 *
 * SCOPE (standing owner order — sending is switched off): a session
 * may only ask this wallet to sign messages (`personal_sign`,
 * `eth_signTypedData[_v4]`) or answer read-only calls (`eth_chainId`,
 * `eth_accounts`). `eth_sendTransaction` and `eth_signTransaction`
 * are never approved: signing a transaction would let the dApp
 * broadcast it and move funds, which is sending through the back
 * door. Non-EVM namespaces are never approved either — this wallet
 * signs EVM messages only.
 *
 * PROJECT ID: a WalletConnect Cloud projectId is required to reach
 * the relay. It comes from the `bawa-walletconnect-project-id`
 * setting the owner enters on the WalletConnect screen, or from the
 * `VITE_WALLETCONNECT_PROJECT_ID` build-time variable. The saved
 * setting wins over the build-time variable. It is never hardcoded,
 * never logged, and never printed anywhere in the UI.
 */

import type {
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import type { ChainId } from '../engine/boundary';
import { CHAINS, chainConfig } from './chains';
import { isEvmTxChain } from './watch-only-families';

/** localStorage key for the owner-entered WalletConnect projectId. */
export const WALLETCONNECT_PROJECT_ID_KEY =
  'bawa-walletconnect-project-id';

/** WalletConnect relay (Sign v2 default). Pinned in the CSP. */
export const WALLETCONNECT_RELAY_URL = 'wss://relay.walletconnect.org';

/**
 * Metadata the wallet presents to dApps. The URL is the project's
 * public repo — the wallet has no marketing site of its own.
 */
export const WALLETCONNECT_METADATA: SignClientTypes.Metadata = {
  name: 'Bawa Web Wallet',
  description:
    'Bawa is a self-custodial multi-chain HD wallet. dApps can ask it to sign messages; sending stays switched off.',
  url: 'https://github.com/Pr3eve6ti2o/bawa',
  icons: [],
};

/**
 * Methods a session may use. Message signing plus the two read-only
 * calls dApps need to know which chain and address they are talking
 * to. Deliberately NOT here: eth_sendTransaction, eth_signTransaction
 * (sending is switched off — see the header).
 */
export const WALLETCONNECT_SUPPORTED_METHODS: readonly string[] = [
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'eth_chainId',
  'eth_accounts',
];

/** Session events the wallet emits. */
export const WALLETCONNECT_SUPPORTED_EVENTS: readonly string[] = [
  'chainChanged',
  'accountsChanged',
];

/** A storage with the three methods this module needs (localStorage shape). */
export type ProjectIdStore = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

function defaultStore(): ProjectIdStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Build-time projectId (`VITE_WALLETCONNECT_PROJECT_ID`), if the
 * build set one. Empty or unset means none — the owner enters one on
 * the WalletConnect screen instead.
 */
export function envWalletConnectProjectId(): string | undefined {
  const value = (
    import.meta.env as Record<string, string | undefined>
  ).VITE_WALLETCONNECT_PROJECT_ID;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The projectId to use: the saved setting first, then the build-time
 * variable. Undefined means the UI must say plainly that a
 * WalletConnect projectId is needed — never invent one.
 */
export function readWalletConnectProjectId(
  store: ProjectIdStore | null = defaultStore(),
): string | undefined {
  const saved = store?.getItem(WALLETCONNECT_PROJECT_ID_KEY)?.trim();
  if (saved !== undefined && saved.length > 0) return saved;
  return envWalletConnectProjectId();
}

/** Save the owner-entered projectId on this device. */
export function saveWalletConnectProjectId(
  projectId: string,
  store: ProjectIdStore | null = defaultStore(),
): void {
  const trimmed = projectId.trim();
  if (trimmed.length === 0) {
    throw new Error('Enter a WalletConnect projectId first.');
  }
  store?.setItem(WALLETCONNECT_PROJECT_ID_KEY, trimmed);
}

/** Remove the saved projectId from this device. */
export function clearWalletConnectProjectId(
  store: ProjectIdStore | null = defaultStore(),
): void {
  store?.removeItem(WALLETCONNECT_PROJECT_ID_KEY);
}

/** A parsed CAIP-10 account id (`namespace:reference:address`). */
export type CaipAccount = {
  namespace: string;
  reference: string;
  address: string;
};

/**
 * Parse a CAIP-10 account id. Mirrors `@walletconnect/utils`
 * `parseAccountId` (walletconnect-monorepo `packages/utils/src/
 * caip.ts`); kept local so this module stays free of the SDK runtime
 * — the lazy client module uses the upstream helpers directly.
 */
export function parseCaipAccount(account: string): CaipAccount | null {
  const parts = account.split(':');
  if (parts.length !== 3) return null;
  const namespace = parts[0];
  const reference = parts[1];
  const address = parts[2];
  if (
    namespace === undefined ||
    reference === undefined ||
    address === undefined ||
    namespace.length === 0 ||
    reference.length === 0 ||
    address.length === 0
  ) {
    return null;
  }
  return { namespace, reference, address };
}

/**
 * CAIP-10 account ids this wallet can serve, one per EVM chain that
 * has a derived address: `eip155:<evmChainId>:<0x address>`. Only
 * chains the user has enabled, and only chains the signer serves
 * (EVM transactions). Ronin stores its address with the `ronin:`
 * prefix; the wire address is the bare 0x form.
 */
export function walletConnectAccounts(
  vaultAddresses: Partial<Record<ChainId, readonly string[]>>,
  enabledChains: readonly ChainId[],
): string[] {
  const enabled = new Set(enabledChains);
  const accounts: string[] = [];
  for (const chain of Object.keys(CHAINS) as ChainId[]) {
    if (!enabled.has(chain)) continue;
    if (!isEvmTxChain(chain)) continue;
    const evmChainId = chainConfig(chain).evmChainId;
    if (evmChainId === null) continue;
    const first = vaultAddresses[chain]?.[0];
    if (first === undefined) continue;
    const address = first.startsWith('ronin:')
      ? first.slice('ronin:'.length)
      : first;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) continue;
    accounts.push(`eip155:${evmChainId}:${address}`);
  }
  return accounts;
}

export type BuildNamespacesFailureReason =
  | 'unsupported-namespace'
  | 'no-common-chain'
  | 'no-supported-method'
  | 'unsupported-event';

export type BuildNamespacesResult =
  | { ok: true; namespaces: SessionTypes.Namespaces }
  | { ok: false; reason: BuildNamespacesFailureReason };

/**
 * Build the namespaces to approve for a session proposal.
 *
 * Rules (WalletConnect Sign v2: every required chain, method and
 * event must be served, or the proposal cannot be approved):
 * - Only the `eip155` namespace is served; any other required
 *   namespace fails the build.
 * - Required chains must all be chains this wallet holds; optional
 *   chains are served only where they overlap.
 * - Required methods/events must all be supported; optional ones
 *   are served only where they overlap.
 * - An approval with no methods is useless, so it fails too.
 */
export function buildApprovedNamespaces(args: {
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces;
  accounts: string[];
}): BuildNamespacesResult {
  const { requiredNamespaces, optionalNamespaces, accounts } = args;

  const ourChains = new Set<string>();
  for (const account of accounts) {
    const parsed = parseCaipAccount(account);
    if (parsed !== null && parsed.namespace === 'eip155') {
      ourChains.add(`eip155:${parsed.reference}`);
    }
  }

  const requiredKeys = Object.keys(requiredNamespaces);
  if (requiredKeys.some((key) => key !== 'eip155')) {
    return { ok: false, reason: 'unsupported-namespace' };
  }
  const required = requiredNamespaces['eip155'];
  const optional = optionalNamespaces['eip155'];

  const requiredChains = required?.chains ?? [...ourChains];
  if (requiredChains.length === 0 || ourChains.size === 0) {
    return { ok: false, reason: 'no-common-chain' };
  }
  for (const chain of requiredChains) {
    if (!ourChains.has(chain)) {
      return { ok: false, reason: 'no-common-chain' };
    }
  }
  const requiredMethods = required?.methods ?? [];
  for (const method of requiredMethods) {
    if (!WALLETCONNECT_SUPPORTED_METHODS.includes(method)) {
      return { ok: false, reason: 'no-supported-method' };
    }
  }
  const requiredEvents = required?.events ?? [];
  for (const event of requiredEvents) {
    if (!WALLETCONNECT_SUPPORTED_EVENTS.includes(event)) {
      return { ok: false, reason: 'unsupported-event' };
    }
  }

  const optionalChains = (optional?.chains ?? []).filter((chain) =>
    ourChains.has(chain),
  );
  const optionalMethods = (optional?.methods ?? []).filter((method) =>
    WALLETCONNECT_SUPPORTED_METHODS.includes(method),
  );
  const optionalEvents = (optional?.events ?? []).filter((event) =>
    WALLETCONNECT_SUPPORTED_EVENTS.includes(event),
  );

  const chains = [...new Set([...requiredChains, ...optionalChains])];
  const methods = [...new Set([...requiredMethods, ...optionalMethods])];
  const events = [...new Set([...requiredEvents, ...optionalEvents])];
  if (methods.length === 0) {
    return { ok: false, reason: 'no-supported-method' };
  }

  const approvedAccounts = accounts.filter((account) => {
    const parsed = parseCaipAccount(account);
    return (
      parsed !== null &&
      parsed.namespace === 'eip155' &&
      chains.includes(`eip155:${parsed.reference}`)
    );
  });

  return {
    ok: true,
    namespaces: {
      eip155: { chains, accounts: approvedAccounts, methods, events },
    },
  };
}
