import type { ChainId } from '../engine/boundary';

/**
 * Read-provider registry for the Phase 5 layout page (types + registry only).
 *
 * Phase 2 adapters implement BalanceProvider per chain (viem for ETH,
 * TronGrid for TRX, TonCenter for TON, Electrum-WS/proxy for BTC). Until an
 * adapter registers, balances stay `unavailable` with reason `no-adapter`
 * (see wallet-context refreshBalances). No provider implementation lives in
 * this lane, and no balance is ever fabricated.
 */

export interface BalanceResult {
  /** Raw native balance as a decimal string (smallest unit is the adapter's choice; document it). */
  value: string;
}

export interface BalanceProvider {
  getBalance(chain: ChainId, address: string): Promise<BalanceResult>;
  getHistory(chain: ChainId, address: string): Promise<unknown[]>;
}

const providers = new Map<ChainId, BalanceProvider>();

export function registerBalanceProvider(
  chain: ChainId,
  provider: BalanceProvider,
): void {
  providers.set(chain, provider);
}

export function getBalanceProvider(
  chain: ChainId,
): BalanceProvider | undefined {
  return providers.get(chain);
}

export function hasBalanceProvider(chain: ChainId): boolean {
  return providers.has(chain);
}
