import type { ChainId } from '../../engine/boundary';
import type { ChainAdapter } from './types';
import { createEthAdapter } from './eth';
import { createTronAdapter } from './trx';
import { createTonAdapter } from './ton';
import { createBtcAdapter } from './btc';

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
 * Registers the Phase 2 mainnet adapters. Filled in as the adapters land
 * (P2 eth done; P3 trx, P4 ton, P5 btc to come). Call once at startup.
 * First registration wins: never clobber an adapter registered earlier
 * (e.g. a test stub, or an adapter registered before lazy loading ran).
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
}
