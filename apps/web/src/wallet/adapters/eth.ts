/**
 * Ethereum adapter — a thin wrapper over the generalised EVM adapter
 * (adapters/evm.ts). The balance/history/fee/nonce behaviour is the
 * factory's; this file only pins the Ethereum mainnet configuration
 * (chain 1, publicnode RPC, Blockscout history) so existing imports and
 * tests keep working unchanged.
 */
import type { PublicClient } from 'viem';
import { createEvmAdapter } from './evm';
import type {
  BroadcastResult,
  ChainAdapter,
  EndpointList,
  FetchTransport,
} from './types';

interface EthAdapterOverrides {
  client?: PublicClient;
  historyBaseUrl?: string;
  rpcUrl?: string;
  /** Ordered RPC list, or a resolver re-read on every call (item 19). */
  rpcUrls?: EndpointList;
  /**
   * Injectable transport for the Blockscout history read (item 2).
   * Defaults to the single-attempt HTTP transport.
   */
  transport?: FetchTransport;
  /**
   * Devnet overrides (temporary devnet mode): the network id, the
   * chain id the identity check pins, the explorer base, and the
   * devnet broadcast. Unset, the adapter is the mainnet adapter
   * exactly as before.
   */
  networkId?: string;
  expectedChainId?: number;
  explorerBaseUrl?: string;
  broadcast?: (signedTx: unknown) => Promise<BroadcastResult>;
}

export function createEthAdapter(overrides: EthAdapterOverrides = {}): ChainAdapter {
  // The devnet overrides rename the factory's fields (expectedChainId
  // vs evmChainId, explorerBaseUrl vs historyExplorerBase); map them
  // here so the factory's mainnet defaults apply untouched when they
  // are unset.
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
    {
      client: overrides.client,
      rpcUrl: overrides.rpcUrl,
      rpcUrls: overrides.rpcUrls,
      historyBaseUrl: overrides.historyBaseUrl,
      transport: overrides.transport,
      networkId: overrides.networkId,
      evmChainId: overrides.expectedChainId,
      historyExplorerBase: overrides.explorerBaseUrl,
      broadcast: overrides.broadcast,
    },
  );
}
