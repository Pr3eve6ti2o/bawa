/**
 * TEMPORARY devnet endpoints (owner order 2026-11-22). The four adapter
 * chains pointed at their public test networks, verified live on
 * 2026-11-22:
 * - BTC testnet4: mempool.space/testnet4 tip 162786, genesis
 *   00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043
 *   (testnet3 is deprecated in Bitcoin Core >= 28; its coins are scarce).
 * - ETH Sepolia: ethereum-sepolia-rpc.publicnode.com reports chain
 *   0xaa36a7 (11155111); history via eth-sepolia.blockscout.com.
 * - TRX Nile: nile.trongrid.io live at block 72,938,490; keyless
 *   fallback https://api.nileex.io (also live at the same block).
 * - TON testnet: testnet.toncenter.com masterchain seqno 99,646,762.
 *
 * This file lives OUTSIDE the generated block in chains.ts — the
 * generator (`node scripts/generate-chains.mjs --check`) never sees
 * it, and the mainnet registry (CHAINS / MAINNET_NETWORK_IDS) is
 * untouched. Devnet is TEMPORARY: see docs/DECISIONS.md for the
 * removal checklist.
 */

import type { ChainId } from '../engine/boundary';
import { isRecord } from './guards';
import { base64ToHex } from './adapters/ton';
import { fetchWithTimeout } from './adapters/types';
import type {
  BroadcastResult,
  FetchTransport,
} from './adapters/types';

type DevnetChainId = 'btc' | 'eth' | 'trx' | 'ton';

interface DevnetChainConfig {
  id: DevnetChainId;
  displayName: string;
  /** Short devnet name shown in the UI (e.g. 'Bitcoin testnet4'). */
  devnetName: string;
  symbol: string;
  /** CAIP-2-style network identifier; never a mainnet id. */
  networkId: string;
  /** Read API base URL (balances, history, UTXOs, seqno). */
  apiBaseUrl: string;
  /** RPC URL for EVM chains (Sepolia only). */
  rpcUrl?: string;
  /** Blockscout-style history API base (Sepolia only). */
  historyBaseUrl?: string;
  /** EVM chain id (Sepolia only). */
  evmChainId?: number;
  /** BTC testnet4 genesis hash (identity check). */
  genesisHash?: string;
  /** Keyless fallback read API (Nile only). */
  fallbackApiBaseUrl?: string;
  /** Transaction explorer URL prefix; the hash is appended. */
  explorerTxUrl: string;
}

export const DEVNET_CHAIN_CONFIGS: Record<DevnetChainId, DevnetChainConfig> = {
  btc: {
    id: 'btc',
    displayName: 'Bitcoin',
    devnetName: 'Bitcoin testnet4',
    symbol: 'BTC',
    networkId:
      'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    apiBaseUrl: 'https://mempool.space/testnet4/api',
    genesisHash:
      '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    explorerTxUrl: 'https://mempool.space/testnet4/tx/',
  },
  eth: {
    id: 'eth',
    displayName: 'Ethereum',
    devnetName: 'Ethereum Sepolia',
    symbol: 'ETH',
    networkId: 'eip155:11155111',
    apiBaseUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    historyBaseUrl: 'https://eth-sepolia.blockscout.com/api',
    evmChainId: 11155111,
    explorerTxUrl: 'https://sepolia.etherscan.io/tx/',
  },
  trx: {
    id: 'trx',
    displayName: 'TRON',
    devnetName: 'TRON Nile',
    symbol: 'TRX',
    // Bawa-internal id: TRON exposes no on-chain chain id and CAIP-2
    // registers no Nile network; it only has to never equal mainnet.
    networkId: 'tron:nile',
    apiBaseUrl: 'https://nile.trongrid.io',
    fallbackApiBaseUrl: 'https://api.nileex.io',
    explorerTxUrl: 'https://nile.tronscan.org/#/transaction/',
  },
  ton: {
    id: 'ton',
    displayName: 'TON',
    devnetName: 'TON testnet',
    symbol: 'TON',
    // TON network ids: mainnet -239, testnet -3.
    networkId: 'ton:-3',
    apiBaseUrl: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    explorerTxUrl: 'https://testnet.tonviewer.com/transaction/',
  },
};

export const DEVNET_CHAINS: readonly DevnetChainId[] = [
  'btc',
  'eth',
  'trx',
  'ton',
];

export const DEVNET_NETWORK_IDS: ReadonlySet<string> = new Set(
  DEVNET_CHAINS.map((chain) => DEVNET_CHAIN_CONFIGS[chain].networkId),
);

export function isDevnetNetworkId(networkId: string): boolean {
  return DEVNET_NETWORK_IDS.has(networkId);
}

/**
 * Looks a chain up by devnet network ID. Anything else throws,
 * including every mainnet ID — the devnet and mainnet registries
 * never resolve each other's networks.
 */
export function chainConfigForDevnetNetwork(
  networkId: string,
): DevnetChainConfig {
  if (!DEVNET_NETWORK_IDS.has(networkId)) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  const found = DEVNET_CHAINS.find(
    (chain) => DEVNET_CHAIN_CONFIGS[chain].networkId === networkId,
  );
  if (!found) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  return DEVNET_CHAIN_CONFIGS[found];
}

export function devnetExplorerTxUrl(
  chain: DevnetChainId,
  txHash: string,
): string {
  return `${DEVNET_CHAIN_CONFIGS[chain].explorerTxUrl}${txHash}`;
}


/**
 * BTC testnet4 broadcast: POST the raw transaction hex (no 0x) to
 * mempool.space/testnet4/api/tx; the response body is the txid as
 * plain text. fetchJson cannot be used here: it parses JSON, and
 * mempool returns text.
 */
export function createDevnetBtcBroadcast(): (
  signedTx: unknown,
) => Promise<BroadcastResult> {
  const config = DEVNET_CHAIN_CONFIGS.btc;
  return async (signedTx: unknown): Promise<BroadcastResult> => {
    if (
      typeof signedTx !== 'string' ||
      !/^(0x)?[0-9a-fA-F]+$/.test(signedTx) ||
      signedTx.replace(/^0x/, '').length % 2 !== 0
    ) {
      throw new Error('Invalid signed BTC transaction: expected hex.');
    }
    const hex = signedTx.replace(/^0x/, '');
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/tx`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: hex,
      },
      10_000,
    );
    const txid = (await response.text()).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid)) {
      throw new Error('Invalid response: expected a transaction id');
    }
    return { txHash: txid, explorerUrl: devnetExplorerTxUrl('btc', txid) };
  };
}

type EthRawTxClient = {
  sendRawTransaction(args: {
    serializedTransaction: `0x${string}`;
  }): Promise<`0x${string}`>;
};

/** ETH Sepolia broadcast: viem sendRawTransaction on the Sepolia client. */
export function createDevnetEthBroadcast(
  client: EthRawTxClient,
): (signedTx: unknown) => Promise<BroadcastResult> {
  return async (signedTx: unknown): Promise<BroadcastResult> => {
    if (
      typeof signedTx !== 'string' ||
      !/^0x[0-9a-fA-F]+$/.test(signedTx) ||
      signedTx.length % 2 !== 0
    ) {
      throw new Error('Invalid signed ETH transaction: expected 0x hex.');
    }
    const hash = await client.sendRawTransaction({
      serializedTransaction: signedTx as `0x${string}`,
    });
    return { txHash: hash, explorerUrl: devnetExplorerTxUrl('eth', hash) };
  };
}

/**
 * TRX Nile broadcast: POST the signed transaction JSON to
 * /wallet/broadcasttransaction; the response carries { result, txid }.
 */
export function createDevnetTrxBroadcast(
  transport: FetchTransport,
  baseUrl: string,
): (signedTx: unknown) => Promise<BroadcastResult> {
  return async (signedTx: unknown): Promise<BroadcastResult> => {
    if (typeof signedTx !== 'string') {
      throw new Error('Invalid signed TRX transaction: expected JSON.');
    }
    let body: unknown;
    try {
      body = JSON.parse(signedTx) as unknown;
    } catch {
      throw new Error('Invalid signed TRX transaction: expected JSON.');
    }
    if (!isRecord(body)) {
      throw new Error('Invalid signed TRX transaction: expected JSON.');
    }
    const raw: unknown = await transport.request(
      `${baseUrl}/wallet/broadcasttransaction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!isRecord(raw)) {
      throw new Error('Invalid response: expected an object');
    }
    if (raw['result'] !== true) {
      const code =
        typeof raw['code'] === 'string' ? raw['code'] : 'broadcast failed';
      const message =
        typeof raw['message'] === 'string' ? raw['message'] : '';
      throw new Error(
        message ? `TRON broadcast failed (${code}): ${message}` : `TRON broadcast failed (${code})`,
      );
    }
    const txid = raw['txid'];
    if (typeof txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      throw new Error('Invalid response: expected a transaction id');
    }
    return {
      txHash: txid.toLowerCase(),
      explorerUrl: devnetExplorerTxUrl('trx', txid),
    };
  };
}

/**
 * TON testnet broadcast: JSON-RPC sendBoc to testnet TonCenter.
 *
 * Two response shapes exist in the wild, and both are successes:
 * - `result` is a base64 message hash (the REST-style return) — it is
 *   converted to hex for the explorer link.
 * - `result` is `{"@type":"ok"}` (the jsonRPC return, observed live on
 *   testnet 2026-11-22) — no hash is returned at all. The signer's
 *   message hash must then be supplied by the caller as
 *   `{boc, messageHash}`; without one the broadcast cannot be identified
 *   and this throws rather than guessing. The old code threw "expected
 *   a message hash" on every successful jsonRPC broadcast, so the app
 *   reported "not broadcast" for transactions that had in fact landed.
 */
export function createDevnetTonBroadcast(
  transport: FetchTransport,
  baseUrl: string,
): (signedTx: unknown) => Promise<BroadcastResult> {
  return async (signedTx: unknown): Promise<BroadcastResult> => {
    let boc: string;
    let messageHash: string | undefined;
    if (typeof signedTx === 'string') {
      boc = signedTx;
    } else if (
      isRecord(signedTx) &&
      typeof signedTx['boc'] === 'string' &&
      (signedTx['messageHash'] === undefined ||
        typeof signedTx['messageHash'] === 'string')
    ) {
      boc = signedTx['boc'];
      messageHash = signedTx['messageHash'];
    } else {
      throw new Error('Invalid signed TON message: expected base64 BOC.');
    }
    if (boc.trim().length === 0) {
      throw new Error('Invalid signed TON message: expected base64 BOC.');
    }
    const raw: unknown = await transport.request(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'sendBoc',
        params: { boc },
      }),
    });
    if (!isRecord(raw) || raw['ok'] !== true) {
      const error = isRecord(raw) ? raw['error'] : undefined;
      throw new Error(
        typeof error === 'string'
          ? error
          : isRecord(error) && typeof error['message'] === 'string'
            ? error['message']
            : 'TonCenter request failed (sendBoc)',
      );
    }
    const result = raw['result'];
    if (typeof result === 'string' && result.length > 0) {
      let txHash: string;
      try {
        txHash = base64ToHex(result);
      } catch {
        throw new Error('Invalid response: expected a base64 message hash');
      }
      if (!/^[0-9a-f]{64}$/.test(txHash)) {
        throw new Error('Invalid response: expected a 32-byte message hash');
      }
      return { txHash, explorerUrl: devnetExplorerTxUrl('ton', txHash) };
    }
    if (isRecord(result) && result['@type'] === 'ok') {
      const hash = messageHash?.startsWith('0x')
        ? messageHash.slice(2)
        : messageHash;
      if (hash === undefined || !/^[0-9a-f]{64}$/.test(hash)) {
        throw new Error(
          'TonCenter accepted the message but returned no hash and no message hash was supplied',
        );
      }
      return { txHash: hash, explorerUrl: devnetExplorerTxUrl('ton', hash) };
    }
    throw new Error('Invalid response: expected a message hash');
  };
}

/**
 * Non-throwing variant of devnetChainConfig for screens that can show
 * chains without a devnet (receive lists all thirteen chains; only the
 * four adapter chains have a test network). Returns undefined when the
 * chain stays mainnet-only.
 */
export function devnetChainConfigOrUndefined(
  chain: ChainId,
): DevnetChainConfig | undefined {
  return (DEVNET_CHAIN_CONFIGS as Record<string, DevnetChainConfig | undefined>)[
    chain
  ];
}

export function devnetChainConfig(chain: ChainId): DevnetChainConfig {
  const config = (DEVNET_CHAIN_CONFIGS as Record<string, DevnetChainConfig>)[
    chain
  ];
  if (!config) {
    throw new Error(`No devnet configuration for chain: ${chain}.`);
  }
  return config;
}
