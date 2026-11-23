import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import type { ChainId } from '../../engine/boundary';
import { CHAINS, resolveRpcEndpoints } from '../chains';
import type { ChainAdapter } from './types';
import { httpFetchTransport } from './types';
import {
  DEVNET_CHAIN_CONFIGS,
  createDevnetBtcBroadcast,
  createDevnetEthBroadcast,
  createDevnetTonBroadcast,
  createDevnetTrxBroadcast,
} from '../devnet-endpoints';
import { createEthAdapter } from './eth';
import { createTronAdapter } from './trx';
import { createTonAdapter } from './ton';
import { createBtcAdapter } from './btc';
import { createEvmAdapter } from './evm';
import { createSolanaAdapter } from './sol';
import { createLtcAdapter } from './ltc';
import { createDogeAdapter } from './doge';

const adapters = new Map<ChainId, ChainAdapter>();

export function registerAdapter(adapter: ChainAdapter): void {
  adapters.set(adapter.chain, adapter);
}

export function getAdapter(chain: ChainId): ChainAdapter | undefined {
  return adapters.get(chain);
}

export function registeredChains(): ChainId[] {
  return [...adapters.keys()];
}

/**
 * Registers the Phase 2 mainnet adapters plus the token-discovery
 * adapters (six EVM chains via the generalised EVM factory, Solana,
 * Litecoin, Dogecoin). Call once at startup. First registration wins:
 * never clobber an adapter registered earlier (e.g. a test stub, or an
 * adapter registered before lazy loading ran).
 */
export function registerAllAdapters(): void {
  // The four Phase 2 adapters, each with a lazily-resolved RPC list
  // (item 19): the owner's manager changes apply on the next call.
  if (!adapters.has('btc')) {
    registerAdapter(
      createBtcAdapter({ baseUrls: () => resolveRpcEndpoints('btc') }),
    );
  }
  if (!adapters.has('trx')) {
    registerAdapter(
      createTronAdapter({ baseUrls: () => resolveRpcEndpoints('trx') }),
    );
  }
  if (!adapters.has('ton')) {
    registerAdapter(
      createTonAdapter({ baseUrls: () => resolveRpcEndpoints('ton') }),
    );
  }
  // Ethereum: the RPC list resolves lazily from the registry + the
  // owner's overrides (item 19), so a manager change applies without
  // rebuilding the adapter.
  if (!adapters.has('eth')) {
    registerAdapter(
      createEthAdapter({ rpcUrls: () => resolveRpcEndpoints('eth') }),
    );
  }
  // EVM natives from the registry: the RPC is pinned once, in chains.ts,
  // and the adapter config is derived from it — never duplicated here.
  for (const chain of ['bsc', 'matic', 'arb', 'op', 'base', 'avax', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom'] as const) {
    if (adapters.has(chain)) continue;
    const config = CHAINS[chain];
    const rpcUrl = config.rpcEndpoints[0];
    if (rpcUrl === undefined || config.evmChainId === null) continue;
    registerAdapter(
      createEvmAdapter(
        {
          chain,
          networkId: config.networkId,
          rpcUrl,
          evmChainId: config.evmChainId,
          chainName: config.displayName,
          nativeSymbol: config.symbol,
          source: 'publicnode',
        },
        { rpcUrls: () => resolveRpcEndpoints(chain) },
      ),
    );
  }
  if (!adapters.has('sol')) {
    registerAdapter(
      createSolanaAdapter({ rpcUrls: () => resolveRpcEndpoints('sol') }),
    );
  }
  if (!adapters.has('ltc')) {
    registerAdapter(
      createLtcAdapter({ baseUrls: () => resolveRpcEndpoints('ltc') }),
    );
  }
  if (!adapters.has('doge')) {
    registerAdapter(createDogeAdapter());
  }
}

// --- TEMPORARY devnet adapters (owner order 2026-11-22) -----------------
// A separate registry: devnet adapters never replace the mainnet ones,
// and mainnet mode never constructs one (see the mode-isolation test in
// adapters/devnet.test.ts). The same factories are reused with devnet
// overrides (endpoints, network ids, genesis/chain-id pins, explorer
// bases, testnet address forms, devnet broadcast). See
// wallet/devnet-endpoints.ts for the verified endpoints and
// docs/DECISIONS.md for the removal checklist.

const devnetAdapters = new Map<ChainId, ChainAdapter>();

export function registerDevnetAdapter(adapter: ChainAdapter): void {
  devnetAdapters.set(adapter.chain, adapter);
}

export function getDevnetAdapter(
  chain: ChainId,
): ChainAdapter | undefined {
  return devnetAdapters.get(chain);
}

export function registeredDevnetChains(): ChainId[] {
  return [...devnetAdapters.keys()];
}

/**
 * Returns the adapter for the mode: the devnet adapter when devnet is
 * on, the mainnet adapter otherwise. Callers that take a devnet option
 * use this instead of getAdapter so the two registries never mix.
 */
export function getAdapterForMode(
  chain: ChainId,
  devnet: boolean,
): ChainAdapter | undefined {
  return devnet ? getDevnetAdapter(chain) : getAdapter(chain);
}

/**
 * Registers the four devnet adapters. First registration wins, like
 * the mainnet registry. The Sepolia viem client is built here so the
 * factory and the devnet broadcast share one client.
 */
export function registerDevnetAdapters(): void {
  const btc = DEVNET_CHAIN_CONFIGS.btc;
  const eth = DEVNET_CHAIN_CONFIGS.eth;
  const trx = DEVNET_CHAIN_CONFIGS.trx;
  const ton = DEVNET_CHAIN_CONFIGS.ton;

  if (!eth.rpcUrl) {
    throw new Error('Sepolia RPC URL missing.');
  }
  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(eth.rpcUrl),
  });

  const created: ChainAdapter[] = [
    createBtcAdapter({
      baseUrl: btc.apiBaseUrl,
      networkId: btc.networkId,
      genesisHash: btc.genesisHash,
      explorerBaseUrl: 'https://mempool.space/testnet4',
      acceptTestnetAddresses: true,
      broadcast: createDevnetBtcBroadcast(),
    }),
    createEthAdapter({
      client: sepoliaClient,
      rpcUrl: eth.rpcUrl,
      historyBaseUrl: eth.historyBaseUrl,
      networkId: eth.networkId,
      expectedChainId: eth.evmChainId,
      explorerBaseUrl: 'https://sepolia.etherscan.io',
      broadcast: createDevnetEthBroadcast(sepoliaClient),
    }),
    createTronAdapter({
      baseUrl: trx.apiBaseUrl,
      networkId: trx.networkId,
      explorerBaseUrl: 'https://nile.tronscan.org',
      broadcast: createDevnetTrxBroadcast(httpFetchTransport, trx.apiBaseUrl),
    }),
    createTonAdapter({
      baseUrl: ton.apiBaseUrl,
      networkId: ton.networkId,
      explorerBaseUrl: 'https://testnet.tonviewer.com',
      acceptTestnetAddresses: true,
      minCallGapMs: 1100,
      broadcast: createDevnetTonBroadcast(httpFetchTransport, ton.apiBaseUrl),
    }),
  ];

  for (const adapter of created) {
    if (!devnetAdapters.has(adapter.chain)) {
      registerDevnetAdapter(adapter);
    }
  }
}
