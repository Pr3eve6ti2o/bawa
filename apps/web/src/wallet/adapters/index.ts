import type { ChainId } from '../../engine/boundary';
import { registerBalanceProvider } from '../providers';
import type { ChainAdapter } from './types';
import { toBalanceProvider } from './types';
import { createEthAdapter } from './eth';
import { createTronAdapter } from './trx';
import { createTonAdapter } from './ton';
import { createBtcAdapter } from './btc';

const adapters = new Map<ChainId, ChainAdapter>();

export function registerAdapter(adapter: ChainAdapter): void {
  adapters.set(adapter.chain, adapter);
  registerBalanceProvider(adapter.chain, toBalanceProvider(adapter));
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
 */
export function registerAllAdapters(): void {
  registerAdapter(createEthAdapter());
  registerAdapter(createTronAdapter());
  registerAdapter(createTonAdapter());
  registerAdapter(createBtcAdapter());
}
