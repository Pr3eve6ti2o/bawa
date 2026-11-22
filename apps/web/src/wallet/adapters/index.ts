import type { ChainId } from '../../engine/boundary';
import { CHAINS } from '../chains';
import type { ChainAdapter } from './types';
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
  for (const create of [
    createEthAdapter,
    createTronAdapter,
    createTonAdapter,
    createBtcAdapter,
  ]) {
    const adapter = create();
    if (!adapters.has(adapter.chain)) {
      registerAdapter(adapter);
    }
  }
  // EVM natives from the registry: the RPC is pinned once, in chains.ts,
  // and the adapter config is derived from it — never duplicated here.
  for (const chain of ['bsc', 'matic', 'arb', 'op', 'base', 'avax'] as const) {
    if (adapters.has(chain)) continue;
    const config = CHAINS[chain];
    const rpcUrl = config.rpcEndpoints[0];
    if (rpcUrl === undefined || config.evmChainId === null) continue;
    registerAdapter(
      createEvmAdapter({
        chain,
        networkId: config.networkId,
        rpcUrl,
        evmChainId: config.evmChainId,
        chainName: config.displayName,
        nativeSymbol: config.symbol,
        source: 'publicnode',
      }),
    );
  }
  for (const create of [createSolanaAdapter, createLtcAdapter, createDogeAdapter]) {
    const adapter = create();
    if (!adapters.has(adapter.chain)) {
      registerAdapter(adapter);
    }
  }
}
