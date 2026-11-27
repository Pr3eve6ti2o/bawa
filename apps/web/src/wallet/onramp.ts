// Coinbase Onramp ("Buy") — fiat top-up for the self-custody wallet
// (usable-install programme, Lane D, 2026-11-25).
//
// Source material: @coinbase/cbpay-js 2.4.0 (MIT) in
// wallet-repos/cbpay-js, and Coinbase's onramp-demo-application.
// The network slugs, the widget message protocol and the URL
// contract below all come from those repos — but the SDK itself is
// NOT bundled, deliberately, and this is why:
//
// - The full SDK (initOnRamp/CBPayInstance + pixel/iframe code) is
//   7,282 B in the build, against 4,815 B of bundle headroom.
// - It ships no "sideEffects": false, so the bundler keeps all of
//   it even when only generateOnRampURL is used — proven with three
//   builds: a treeshake.moduleSideEffects rule and a resolveId
//   plugin (moduleSideEffects: false, verified firing) both left
//   the chunk byte-identical, because Vite's resolver sets the
//   per-module value from package.json itself.
// - So the one function Bawa needs, generateOnRampURL, is
//   reimplemented here as buildOnrampUrl — same host, same
//   /buy/select-asset path, same validation, same scalar-vs-JSON
//   encoding, same sorted keys — with parity tests mirroring the
//   SDK's own generateOnRampURL.test.ts vectors. If Coinbase
//   changes the URL contract, this is the one place that changes,
//   and the parity tests are the tripwire.
//
// The widget opens as a pop-up from that URL (the embedded iframe
// experience is deliberately NOT used — two-factor auth does not
// work in an iframe, and the app CSP allows no third-party frame
// origin). There is deliberately NO message listener for the
// widget's success/exit events: the listener plus its outcome
// states cost ~1 KB against ~5 KB of headroom, and the purchase is
// completed and confirmed inside the Coinbase pop-up itself —
// Bawa reports opened / blocked / load-failed, and the delivery
// shows up as a normal incoming transaction. The SDK's protocol
// (cbpay-js src/utils/postMessage.ts + src/types/events.ts) is
// documented here so a listener can be added later if the budget
// ever allows it.
//
// How it works, once configured: the Buy click opens a blank pop-up
// synchronously (so the browser cannot mistake it for unprompted)
// and navigates it to the built URL. Coinbase owns the price, fees,
// payment methods, supported regions and settlement; Bawa only
// hands it the destination addresses and the app ID. No payment
// details ever touch Bawa, and no purchase is ever initiated
// without a user click.
//
// Configuration: a single public project ID from the Coinbase
// Developer Portal, read from VITE_COINBASE_ONRAMP_APP_ID at build
// time. It is a client-side identifier (it is sent to the browser in
// the widget URL by design), not a secret — but no real value is ever
// committed; without it the Buy panel says plainly that onboarding
// and API keys are needed. A server-side session token is NOT used:
// minting one needs CDP API keys on a backend Bawa does not have.
//
// Network slugs: the Coinbase network names from Coinbase's own
// onramp-demo-application (coinbase/onramp-demo-application,
// app/components/OnrampFeature.tsx fallback list + asset map, read
// 2026-11-25): ethereum, base, optimism, arbitrum, polygon,
// avalanche-c-chain, solana, bitcoin, bnb-chain, tron. The live Buy
// Options API is the authority at onboarding time — if Coinbase adds
// or renames a network, this map is where it changes. Chains Bawa
// supports but Coinbase does not list as a destination (TON, LTC,
// DOGE) are simply absent from the Buy panel, never offered dead.

import type { ChainId } from '../engine/boundary';
import type { DerivedAddress } from '@bawa/contracts';

/** Build-time env name for the public Coinbase Onramp project ID. */
const COINBASE_ONRAMP_APP_ID_ENV = 'VITE_COINBASE_ONRAMP_APP_ID';

/** The configured public Onramp project ID, or null when unset/blank. */
export function coinbaseOnrampAppId(): string | null {
  const raw: unknown = (
    import.meta.env as Record<string, unknown>
  )[COINBASE_ONRAMP_APP_ID_ENV];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** True once the Onramp project ID is configured. */
export function isCoinbaseOnrampConfigured(): boolean {
  return coinbaseOnrampAppId() !== null;
}

/**
 * Bawa chain -> Coinbase Onramp network slug, for the chains
 * Coinbase lists as buy destinations. Absent = not offered.
 */
const COINBASE_NETWORK_BY_CHAIN: Readonly<
  Partial<Record<ChainId, string>>
> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  base: 'base',
  op: 'optimism',
  arb: 'arbitrum',
  matic: 'polygon',
  avax: 'avalanche-c-chain',
  bsc: 'bnb-chain',
  trx: 'tron',
};

/** The Coinbase network slug for a chain, or null when not a destination. */
export function coinbaseNetworkFor(chain: ChainId): string | null {
  return COINBASE_NETWORK_BY_CHAIN[chain] ?? null;
}

/** True when Coinbase Onramp can deliver to this chain. */
export function isBuySupportedChain(chain: ChainId): boolean {
  return coinbaseNetworkFor(chain) !== null;
}

export type OnrampDestination = {
  chain: ChainId;
  network: string;
  address: string;
};

type AddressMaps = {
  receiveAddresses?: Partial<Record<ChainId, string | null>> | null;
  vaultAddresses?: Partial<Record<ChainId, string[]>> | null;
  watchAddresses?: Partial<Record<ChainId, DerivedAddress[]>> | null;
};

/**
 * The buy destinations for this wallet, in COINBASE_NETWORK_BY_CHAIN
 * order: one entry per supported chain that has an address. The
 * address follows the Receive screen's own resolution exactly —
 * the HD receive address first, then the vault's primary derived
 * address, then a watch-only address (a watched address is a valid
 * destination — the purchase is delivered to it, nothing is spent
 * from it). Chains with no address at all are skipped, never
 * invented. The vault fallback matters: receiveAddresses start
 * null and are only derived when the user rotates an address, so
 * without it a fresh wallet shows no destination at all.
 */
export function onrampDestinations({
  receiveAddresses,
  vaultAddresses,
  watchAddresses,
}: AddressMaps): OnrampDestination[] {
  const destinations: OnrampDestination[] = [];
  for (const [chain, network] of Object.entries(COINBASE_NETWORK_BY_CHAIN)) {
    const id = chain as ChainId;
    const receiveAddress = receiveAddresses?.[id] ?? null;
    const vaultAddress = vaultAddresses?.[id]?.[0];
    const watchAddress = watchAddresses?.[id]?.[0]?.address;
    const address =
      typeof receiveAddress === 'string' && receiveAddress !== ''
        ? receiveAddress
        : typeof vaultAddress === 'string' && vaultAddress !== ''
          ? vaultAddress
          : watchAddress;
    if (
      typeof address !== 'string' ||
      address === '' ||
      network === undefined
    ) {
      continue;
    }
    destinations.push({ chain: id, network, address });
  }
  return destinations;
}

/**
 * The `addresses` record the Onramp URL wants: each destination
 * address mapped to the networks it receives on. EVM chains share
 * one address, so their networks merge under a single key. No
 * dedupe is needed: each chain maps to exactly one network, so a
 * network can never repeat under an address.
 */
export function buildOnrampAddresses(
  destinations: OnrampDestination[],
): Record<string, string[]> | null {
  if (destinations.length === 0) return null;
  const addresses: Record<string, string[]> = {};
  for (const { network, address } of destinations) {
    const networks = addresses[address] ?? [];
    networks.push(network);
    addresses[address] = networks;
  }
  return addresses;
}

/** The Onramp widget host. */
const COINBASE_ONRAMP_HOST = 'https://pay.coinbase.com';

type BuildOnrampUrlOptions = {
  appId: string;
  addresses: Record<string, string[]>;
  defaultNetwork?: string;
  assets?: string[];
};

/**
 * The Onramp widget URL for these destinations. A faithful port of
 * the SDK's generateOnRampURL (see the module header for why the
 * SDK itself is not bundled): /buy/select-asset on the widget host,
 * one of destinationWallets/addresses required (only the addresses
 * form is used here), scalars as-is, objects as JSON, keys sorted.
 * Throws when no addresses are given, like the SDK does.
 */
export function buildOnrampUrl({
  appId,
  addresses,
  defaultNetwork,
  assets,
}: BuildOnrampUrlOptions): string {
  if (addresses === undefined || addresses === null) {
    throw new Error('Coinbase Onramp needs a destination address.');
  }
  const url = new URL(COINBASE_ONRAMP_HOST);
  url.pathname = '/buy/select-asset';
  const props: Record<string, unknown> = {
    appId,
    addresses,
    assets,
    defaultNetwork,
  };
  for (const key of Object.keys(props).sort()) {
    const value = props[key];
    if (value === undefined) continue;
    url.searchParams.append(
      key,
      typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
        ? value.toString()
        : JSON.stringify(value),
    );
  }
  url.searchParams.sort();
  return url.toString();
}

type OnrampOpenOutcome = 'opened' | 'load-failed' | 'blocked';

type OpenCoinbaseOnrampOptions = {
  appId: string;
  addresses: Record<string, string[]>;
  defaultNetwork?: string;
};

/**
 * Open the Coinbase Onramp widget as a pop-up for these
 * destinations. The pop-up opens blank synchronously, inside the
 * click, and is then navigated to the built URL — a pop-up opened
 * after an await risks being blocked as unprompted. 'opened' means
 * the widget opened; 'load-failed' means the URL could not be
 * built; 'blocked' means the browser blocked the pop-up. The
 * purchase itself is completed inside the pop-up; there is no
 * listener for its outcome (see the module header).
 */
export function openCoinbaseOnramp({
  appId,
  addresses,
  defaultNetwork,
}: OpenCoinbaseOnrampOptions): OnrampOpenOutcome {
  const popup = window.open('about:blank', '_blank', 'width=430,height=600,noopener');
  if (popup === null) return 'blocked';
  let url: string;
  try {
    url = buildOnrampUrl({ appId, addresses, defaultNetwork });
  } catch {
    popup.close();
    return 'load-failed';
  }
  popup.location.href = url;
  return 'opened';
}
