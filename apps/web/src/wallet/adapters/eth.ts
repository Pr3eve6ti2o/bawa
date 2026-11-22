/**
 * Ethereum adapter — a thin wrapper over the generalised EVM adapter
 * (adapters/evm.ts). The balance/history/fee/nonce behaviour is the
 * factory's; this file only pins the Ethereum mainnet configuration
 * (chain 1, publicnode RPC, Blockscout history) so existing imports and
 * tests keep working unchanged.
 */
import type { PublicClient } from 'viem';
import { createEvmAdapter } from './evm';
import type { ChainAdapter, FetchTransport } from './types';

export interface EthAdapterOverrides {
  client?: PublicClient;
  historyBaseUrl?: string;
  rpcUrl?: string;
  /**
   * Injectable transport for the Blockscout history read (item 2).
   * Defaults to the single-attempt HTTP transport.
   */
  transport?: FetchTransport;
}

export function createEthAdapter(overrides: EthAdapterOverrides = {}): ChainAdapter {
  // EthAdapterOverrides is structurally identical to
  // EvmAdapterOverrides, so the overrides pass through unchanged.
  return createEvmAdapter(
    {
      chain: 'eth',
      networkId: 'eip155:1',
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
      evmChainId: 1,
      chainName: 'Ethereum',
      nativeSymbol: 'ETH',
      source: 'publicnode',
      historyBaseUrl: 'https://eth.blockscout.com/api',
      historyExplorerBase: 'https://eth.blockscout.com',
    },
    overrides,
  );
}
