import type { ChainId } from '../engine/boundary';
import { formatChainId } from './caip';

export type { ChainId };

type CapabilityName =
  | 'derive'
  | 'restore'
  | 'receive'
  | 'balance'
  | 'history'
  | 'fee-quote'
  | 'unsigned-plan'
  | 'local-sign'
  | 'post-sign-verify'
  | 'simulate';

type CapabilityStatus =
  | 'verified'
  | 'blocked'
  | 'unsupported'
  | 'candidate';

/**
 * How a capability's status was established. Only a live mainnet cross-check
 * justifies 'mainnet-confirmed'; anything the offline tests and probes
 * established — and every blocked or candidate entry — is 'probe-only'.
 * Never claim mainnet confirmation for anything the offline probes
 * established.
 */
type EvidenceLevel = 'mainnet-confirmed' | 'probe-only';

interface CapabilityEntry {
  status: CapabilityStatus;
  /** Short evidence reference. A capability with no evidence is never verified. */
  evidence: string;
  evidenceLevel: EvidenceLevel;
}

type Capabilities = Record<CapabilityName, CapabilityEntry>;

interface ChainConfig {
  id: ChainId;
  displayName: string;
  symbol: string;
  /** Wallet Core CoinType property name. */
  coinTypeName: 'bitcoin' | 'ethereum' | 'tron' | 'ton' | 'solana' | 'smartChain' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalancheCChain' | 'litecoin' | 'dogecoin' | 'xdai' | 'celo' | 'linea' | 'mantle' | 'scroll' | 'opBNB' | 'metis' | 'aurora' | 'fantom' | 'zksync' | 'cronosChain' | 'kavaEvm' | 'filecoin' | 'seiEVM' | 'arbitrumNova' | 'mantaPacific' | 'sonic' | 'hyperEVM' | 'monad' | 'ronin' | 'thetaFuel' | 'ioTeXEVM' | 'boba' | 'confluxeSpace' | 'rootstock' | 'ethereumClassic' | 'zetaEVM' | 'cosmos' | 'osmosis' | 'xrp' | 'stellar' | 'polkadot' | 'near' | 'aptos' | 'tezos' | 'algorand' | 'hedera' | 'nativeInjective' | 'tia' | 'dydx' | 'sei' | 'axelar' | 'noble' | 'juno' | 'cardano' | 'kaspa' | 'starknet';
  /** CAIP-2 network identifier (mainnet only). */
  networkId: string;
  /** CAIP-19 native asset identifier (slip44 namespace). */
  assetId: string;
  /** Pinned recovery profile. A path change changes recovered addresses. */
  profileId: string;
  /**
   * Derivation path builder. SOL/TON use the Lane A Ed25519 scheme
   * (see ed25519PathFor): account 0 index 0 keeps the legacy path,
   * new accounts and rotations derive distinct hardened paths.
   */
  pathFor: (account: number, index: number) => string;
  /** Mainnet RPC endpoints. Empty means no endpoint configured yet. */
  rpcEndpoints: string[];
  /** EVM chain ID, or null for non-EVM chains. */
  evmChainId: number | null;
  /**
   * Keyless public history indexer (Etherscan-compatible txlist API),
   * or undefined when no working one is wired. Set only for chains
   * whose endpoint was probed live returning real transactions
   * (Lane B, 2026-11-23): the adapter reads history from here, and
   * the history capability is verified only with this set.
   */
  historyBaseUrl?: string;
  /** Explorer base for history transaction links, or undefined when none. */
  historyExplorerBase?: string;
  capabilities: Capabilities;
}

/**
 * Phase 4 (Fix Lane 3, 2026-11-19): offline transaction construction, local
 * signing and post-sign verification are verified by apps/web/src/wallet/
 * send.test.ts plus the AnySigner probe runs (disposable keys, no broadcast).
 * TON post-sign-verify stays blocked: the signed BOC is not re-parsed (no
 * BOC parser vendored); verification is no-error + 32-byte hash + BOC magic.
 */
const verifiedBySendTests = (capability: CapabilityName): CapabilityEntry => ({
  status: 'verified',
  evidenceLevel: 'probe-only',
  evidence:
    `Verified by apps/web/src/wallet/send.test.ts offline signing checks + ` +
    `AnySigner probe runs 2026-11-19 for ${capability} (no broadcast).`,
});

const verifiedByCoreTests = (capability: CapabilityName): CapabilityEntry => ({
  status: 'verified',
  evidenceLevel: 'probe-only',
  evidence: `Verified by apps/web/src/wallet/core.test.ts ${capability} checks (2026-11-18).`,
});

/**
 * Phase 2 adapter capabilities (Fix Lane 2, 2026-11-19). balance/history/
 * fee-quote are verified only with evidence: the adapter's unit tests plus a
 * live mainnet cross-check against a second source on 2026-11-19. TON
 * fee-quote stays blocked: a TON fee depends on the unsigned message, which
 * is Phase 4 work — no fee number is ever invented.
 */
function capabilitiesForAdapterChain(
  chain: ChainId,
  feeQuoteVerified: boolean,
): Capabilities {
  const verifiedByAdapters = (capability: CapabilityName): CapabilityEntry => ({
    status: 'verified',
    evidenceLevel: 'mainnet-confirmed',
    evidence:
      `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
      `mainnet cross-check 2026-11-19 (second source) for ${capability}.`,
  });
  return {
    derive: verifiedByCoreTests('derive'),
    restore: verifiedByCoreTests('restore'),
    receive: verifiedByCoreTests('receive'),
    balance: verifiedByAdapters('balance'),
    history: verifiedByAdapters('history'),
    'fee-quote': feeQuoteVerified
      ? verifiedByAdapters('fee-quote')
      : {
          status: 'blocked',
          evidenceLevel: 'probe-only',
          evidence:
            'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
        },
    'unsigned-plan': verifiedBySendTests('unsigned-plan'),
    'local-sign': verifiedBySendTests('local-sign'),
    'post-sign-verify':
      chain === 'ton'
        ? {
            status: 'blocked',
            evidenceLevel: 'probe-only',
            evidence:
              'TON signed BOC is not re-parsed (no BOC parser vendored); verification is no-error + 32-byte hash + BOC magic only.',
          }
        : verifiedBySendTests('post-sign-verify'),
    // Item 9 (chains half): declared only. The simulate-before-send phase
    // is owned by the send lane in send.ts; no simulation runs yet.
    // Simulation is a pre-check, never confirmation.
    simulate: {
      status: 'candidate',
      evidenceLevel: 'probe-only',
      evidence:
        'Candidate for item 9: the simulate-before-send phase is owned by ' +
        'the send lane in send.ts; no simulation runs yet. Simulation is ' +
        'a pre-check, never confirmation.',
    },
  };
}

function capabilitiesForExtendedChain(chain: ChainId): Capabilities {
  return {
    derive: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for derive.',
    },
    restore: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for restore.',
    },
    receive: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for receive.',
    },
    balance: {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} adapter in this lane; balance is blocked, never faked.`,
    },
    history: {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No keyless history source for ${chain} in this lane; history is blocked, never faked.`,
    },
    'fee-quote': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} adapter in this lane; fee-quote is blocked, never faked.`,
    },
    'unsigned-plan': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; unsigned-plan is blocked, never faked.`,
    },
    'local-sign': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; local-sign is blocked, never faked.`,
    },
    'post-sign-verify': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; post-sign-verify is blocked, never faked.`,
    },
    // Item 9 (chains half): declared only. The simulate-before-send phase
    // is owned by the send lane in send.ts; no simulation runs yet.
    // Simulation is a pre-check, never confirmation.
    simulate: {
      status: 'candidate',
      evidenceLevel: 'probe-only',
      evidence:
        'Candidate for item 9: the simulate-before-send phase is owned by ' +
        'the send lane in send.ts; no simulation runs yet. Simulation is ' +
        'a pre-check, never confirmation.',
    },
  };
}

/**
 * Token-discovery balance capabilities (2026-11-22). Same as the extended
 * chain capabilities, except balance is verified: each new adapter has
 * unit tests plus a live mainnet cross-check against a second source on
 * 2026-11-22. History, fee-quote and send stay blocked — the adapters
 * either do not implement them or they have no live cross-check yet —
 * and are never faked.
 *
 * Lane C, item 16 (2026-11-23): historyVerified is true only for sol,
 * ltc and doge, whose adapters now have unit tests plus a live mainnet
 * cross-check 2026-11-23 (second source) for history. Lane D, gap 1
 * (2026-11-23): historyVerified is also true for celo, op and scroll,
 * whose keyless history hosts were probed live 2026-11-23 (single
 * source — the host itself, with the address filter proven on a second
 * address; see EVM_HISTORY_SOURCES in adapters/index.ts). The other
 * six non-ETH EVM chains stay blocked (bsc, gnosis, linea, opbnb,
 * metis, fantom): no keyless public history indexer answers for
 * them (owner decision: Etherscan API key or another indexer).
 * (Merge: Lane B verified the other six the same day — see below.)
 * Fix-All Lane A (2026-11-24): Linea is now wired — Etherscan's V2
 * API answers keyless for chain 59144 (see
 * HISTORY_EVIDENCE_2026_11_24_LINEA). Five stay blocked (bsc, gnosis,
 * opbnb, metis, fantom): Routescan does not index any of them, the
 * Etherscan V2 free tier refuses BSC/Gnosis and does not list
 * Metis/Fantom chain ids, opBNB V2 502s, the Metis explorers 504, and
 * no Blockscout host answers for them — probed live 2026-11-24, see
 * the Lane A report. Gnosis's Blockscout host exists but Cloudflare
 * 403s curl; it is decided by a browser fetch in CDP, not by curl.
 *
 * cross-check 2026-11-23 (second source) for history.
 *
 * Lane B (Finish the Product, 2026-11-23): six more EVM chains are
 * verified the same way — their keyless public history indexers were
 * probed live on 2026-11-23 returning real transactions for a funded
 * address (0xd8dA...6045): Optimism via explorer.optimism.io,
 * Scroll via scrollscan.com, Celo via celo.blockscout.com, Aurora via
 * explorer.aurora.dev, Avalanche and Mantle via Routescan's
 * Etherscan-compatible API. The six still blocked — bsc, gnosis,
 * linea, opbnb, metis, fantom — have no working keyless indexer
 * (owner decision: Etherscan API key or another indexer). Their
 * history stays blocked, never faked. (Merge: matic, arb and base
 * were listed here as blocked, but were verified the same day via
 * a headless-Chromium fetch — see HISTORY_EVIDENCE_2026_11_23_BROWSER below.)
 * (Fix-All Lane A, 2026-11-24: Linea left this blocked set — Etherscan
 * V2 answers keyless for chain 59144. Five remain blocked.)
 */
const HISTORY_EVIDENCE_2026_11_23 =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter, Blockscout-shaped history) + '
  + 'live mainnet cross-check 2026-11-23: the history host returns real transactions for a known address and a '
  + 'different real transaction for a second address (address filter proven), and the live response matches the '
  + 'Blockscout shape the adapter parses. Single source — the host itself, no second indexer answers keyless.';

const BALANCE_EVIDENCE_2026_11_23 =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter) + '
  + 'live mainnet cross-check 2026-11-23 (two independent RPC endpoints agree '
  + 'on chain id and balance) for balance.';

// Lane B, same day: the three Cloudflare-blocked Blockscout hosts
// (polygon/base/arbitrum) answer HTTP 403 to plain curl but return
// real transactions to a headless-Chromium fetch — the block is
// curl-fingerprint bot detection, not a missing indexer. Evidence is
// the browser fetch, not curl.
const HISTORY_EVIDENCE_2026_11_23_BROWSER =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter) + '
  + 'live mainnet cross-check 2026-11-23 in headless Chromium (keyless public indexer returns real transactions for a funded address; plain curl is 403 Cloudflare, the browser fetch answers) for history.';

// Fix-All Lane A, 2026-11-24: Linea history via Etherscan's V2 API,
// keyless — GET https://api.etherscan.io/v2/api?chainid=59144&
// module=account&action=txlist&address=0xd8dA...6045 returns status 1
// with real transactions and message
// "OK-Missing/Invalid API Key, rate limit of 1/5sec applied" (no key
// sent, no key needed; the 1 req/5s limit is the keyless tier). Single
// source — the host itself, no second keyless indexer answers for
// Linea. The adapter joins the txlist params with '&' because the
// base URL already carries ?chainid=59144 (see evm.ts).
const HISTORY_EVIDENCE_2026_11_24_LINEA =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter, Etherscan V2 history) + '
  + 'live mainnet cross-check 2026-11-24: Etherscan V2 returns real Linea transactions for a known address keyless (status 1, 1 req/5s keyless tier), and the live response matches the txlist shape the adapter parses. Single source — the host itself, no second keyless indexer answers for Linea.';

function capabilitiesForBalanceChain(
  chain: ChainId,
  balanceEvidence?: string,
  historyVerified = false,
  historyEvidence?: string,
): Capabilities {
  const base = capabilitiesForExtendedChain(chain);
  return {
    ...base,
    balance: {
      status: 'verified',
      evidenceLevel: 'mainnet-confirmed',
      evidence:
        balanceEvidence ??
        `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
        `mainnet cross-check 2026-11-22 (second source) for balance.`,
    },
    history: historyVerified
      ? {
          status: 'verified',
          evidenceLevel: 'mainnet-confirmed',
          evidence:
            historyEvidence ??
            `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
            `mainnet cross-check 2026-11-23 (second source) for history.`,
        }
      : base.history,
  };
}


// Lane 80-APP (2026-11-24): balance evidence for the 44 newly-wired
// EVM adapter chains — same bar as 2026-11-23 (two independent RPC
// endpoints agree on chain id and balance for a known address).
// EXCEPTION: ronin does NOT meet the two-RPC bar — its primary
// (api.roninchain.com/rpc) returns chain id + balance, but the backup
// (ronin.drpc.org) answers eth_chainId and returns HTTP 400/500 on
// eth_getBalance (4 attempts 2026-11-24); ronin carries its own
// evidence string via capabilitiesForExpandedBalanceChain's override.
const BALANCE_EVIDENCE_2026_11_24 =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter) + '
  + 'live mainnet cross-check 2026-11-24 (two independent RPC endpoints agree '
  + 'on chain id and balance) for balance.';

/**
 * Lane 80-APP: derivation evidence for the 65 expanded chains
 * (Wallet Core 4.9.3 probe 2026-11-24, BIP-39 test-vector mnemonic:
 * getAddressForCoin and the explicit-key path agree and
 * CoinTypeExt.validate is true; the xpub round-trip agrees too for the
 * 55 secp256k1 chains, and is absent — Ed25519/Stark chains have no
 * extended public key, and Kaspa has no Wallet Core coin — for the
 * other ten).
 */
function capabilitiesForExpandedChain(
  chain: ChainId,
  xpubRoundTrip: boolean,
  deriveEvidence?: string,
): Capabilities {
  const evidence =
    (deriveEvidence ??
      'Verified by Wallet Core 4.9.3 derivation probe 2026-11-24 (BIP-39 test-vector mnemonic; getAddressForCoin and explicit-key path agree; CoinTypeExt.validate true'
        + (xpubRoundTrip
          ? '; xpub round-trip agrees'
          : '; no xpub round-trip — Ed25519 chains have no extended public key')
        + ')')
    + ' + apps/web/src/wallet/core.test.ts expanded-chain checks for ';
  const verified = (capability: CapabilityName): CapabilityEntry => ({
    status: 'verified',
    evidenceLevel: 'probe-only',
    evidence: evidence + capability + '.',
  });
  const base = capabilitiesForExtendedChain(chain);
  return {
    ...base,
    derive: verified('derive'),
    restore: verified('restore'),
    receive: verified('receive'),
  };
}

// Lane B (2026-11-25): the three OKX chains derive differently from
// the Wallet Core 4.9.3 probe the other expanded chains use, so their
// derive evidence names the real path. All three are derive-only:
// balance / history / fee-quote / send stay blocked (see
// capabilitiesForExtendedChain), never faked.
const CARDANO_DERIVE_EVIDENCE =
  'Verified by Wallet Core 4.9.3 derivation probe 2026-11-25 (BIP-39 test-vector mnemonic; getAddressForCoin and the Ed25519-Cardano explicit-key path agree; CoinTypeExt.validate true; no xpub round-trip — Ed25519 chains have no extended public key)';
const KASPA_DERIVE_EVIDENCE =
  "Verified by Wallet Core 4.9.3 + in-app CashAddr probe 2026-11-25 (BIP-39 test-vector mnemonic; secp256k1 key at m/44'/111111'/0'/0/0 agrees with the OKX js-wallet-sdk test vector; no xpub round-trip — Kaspa has no Wallet Core coin, so no extended public key can be exported for it)";
const STARKNET_DERIVE_EVIDENCE =
  "Verified by in-app Stark-curve probe 2026-11-25 (BIP-39 test-vector mnemonic; double-derivation + grindKey + Argent proxy address agree with the OKX js-wallet-sdk test vectors; no xpub round-trip — Starknet keys are ground from a private key, so no address can be derived from an extended public key)";

/**
 * Lane 80-APP: the 44 expanded EVM chains with a live balance adapter.
 * Same shape as capabilitiesForBalanceChain (balance verified, history /
 * fee-quote / send blocked — no keyless indexer or fee quote is wired
 * for them yet), but the derive evidence is the 2026-11-24 probe.
 * local-sign stays blocked in the capability record even though the
 * generalised offline signer covers these chains (same split as the
 * existing EVM chains: the screen gate + send.test.ts are the record
 * for signing, not this table).
 */
function capabilitiesForExpandedBalanceChain(
  chain: ChainId,
  balanceEvidenceOverride?: string,
): Capabilities {
  const base = capabilitiesForExpandedChain(chain, true);
  return {
    ...base,
    balance: {
      status: 'verified',
      evidenceLevel: 'mainnet-confirmed',
      evidence: balanceEvidenceOverride ?? BALANCE_EVIDENCE_2026_11_24,
    },
  };
}

/**
 * Lane 80-APP: pathFor for the expanded chains, built by substituting
 * the account/index into the chain's recorded derivation template
 * (recorded in chains.ts in production; chains-expanded.ts keeps the
 * canonical dataset). At account 0 index 0 the result is the
 * recorded derivationPath exactly (pinned by
 * chains-expanded-wiring.test.ts). Stellar and NEAR templates carry no
 * {index} — one address per account — so the index is ignored for them.
 */
// Lane C (bundle-size gate): the default EVM derivation path,
// shared by the 57 chains that use it — one literal instead of
// 57 copies. expandedPathFor substitutes {account} and {index}
// and asserts both, exactly as the inline functions did.
const EVM_PATH = "m/44'/60'/{account}'/0/{index}";

function expandedPathFor(
  template: string,
): (account: number, index: number) => string {
  return (account, index) => {
    assertAccountIndex(account, index);
    return template
      .replace('{account}', String(account))
      .replace('{index}', String(index));
  };
}

function assertAccountIndex(account: number, index: number): void {
  if (
    !Number.isSafeInteger(account) ||
    account < 0 ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    throw new Error('Account and index must be non-negative integers.');
  }
}

/**
 * Lane A: Ed25519 (SOL/TON) derivation. SLIP-0010 allows hardened-only
 * children, so every component stays hardened. Account 0 index 0 keeps
 * the legacy single path (SOL m/44'/501'/0', TON m/44'/607'/0') so
 * existing users' addresses do not move. New accounts use the account
 * component — SOL m/44'/501'/<account>'/0' (the Phantom template
 * already recorded in SOLANA_PROFILES) and TON m/44'/607'/<account>'
 * (the Tonkeeper template) — and rotation within an account appends a
 * hardened index after the change slot (SOL
 * m/44'/501'/<account>'/0'/<index>', TON m/44'/607'/<account>'/<index>').
 * No (account, index) pair collides with another.
 */
function ed25519PathFor(
  coinType: 501 | 607,
  account: number,
  index: number,
): string {
  assertAccountIndex(account, index);
  if (account === 0 && index === 0) {
    return `m/44'/${coinType}'/0'`;
  }
  if (coinType === 501) {
    return index === 0
      ? `m/44'/501'/${account}'/0'`
      : `m/44'/501'/${account}'/0'/${index}'`;
  }
  return index === 0
    ? `m/44'/607'/${account}'`
    : `m/44'/607'/${account}'/${index}'`;
}

/**
 * Capability registry, not a chain list: listing a chain never implies it can
 * do an operation. A chain is available for an operation only when
 * availableFor(capability) returns it (status verified).
 */

// BEGIN GENERATED CHAIN FACTS — do not hand-edit. Regenerate with: node scripts/generate-chains.mjs
// Drift check: from apps/web run `node scripts/generate-chains.mjs --check`;
// it exits 1 when this block differs from registry/capabilities.json.
// Capabilities, evidence, enablement and derivation behaviour stay
// hand-written in chains.ts — only the eight static facts per chain below
// are generated. The registry mixes upstream Wallet Core registry.json
// values with Bawa-added fields (profileId, rpcEndpoints, xpubVersion
// from SLIP-0132 version bytes — the upstream registry carries xpub
// labels only).
export const GENERATED_CHAIN_FACTS: Record<
  'btc' | 'eth' | 'trx' | 'ton',
  Pick<
    ChainConfig,
    | 'displayName'
    | 'symbol'
    | 'coinTypeName'
    | 'networkId'
    | 'assetId'
    | 'profileId'
    | 'rpcEndpoints'
    | 'evmChainId'
  >
> = {
  btc: {
    displayName: 'Bitcoin',
    symbol: 'BTC',
    coinTypeName: 'bitcoin',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
    profileId: 'bawa-btc-bip84-v1',
    rpcEndpoints: [
      'https://mempool.space/api',
      'https://blockstream.info/api',
    ],
    evmChainId: null,
  },
  eth: {
    displayName: 'Ethereum',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    networkId: 'eip155:1',
    assetId: 'eip155:1/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    rpcEndpoints: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ],
    evmChainId: 1,
  },
  trx: {
    displayName: 'TRON',
    symbol: 'TRX',
    coinTypeName: 'tron',
    networkId: 'tron:0x2b6653dc',
    assetId: 'tron:0x2b6653dc/slip44:195',
    profileId: 'bawa-trx-bip44-v1',
    rpcEndpoints: [
      'https://api.trongrid.io',
      'https://tron-rpc.publicnode.com',
    ],
    evmChainId: null,
  },
  ton: {
    displayName: 'TON',
    symbol: 'TON',
    coinTypeName: 'ton',
    networkId: 'ton:-239',
    assetId: 'ton:-239/slip44:607',
    profileId: 'bawa-ton-v4r2-v1',
    rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    evmChainId: null,
  },
};
// END GENERATED CHAIN FACTS
// Lane C (bundle-size gate): the 60 chains filled in by this helper
// share the same CAIP-2 / CAIP-19 / profile facts, so the records carry
// only the chain id and this helper fills in the rest. (61 chains carry
// a numeric evmChainId in all; eth is the one exception — its facts are
// literal in GENERATED_CHAIN_FACTS, not filled in here.) networkId is always
// `eip155:<evmChainId>`; assetId is `eip155:<id>/slip44:<slip44>`
// with slip44 60 unless the chain's own coin type differs (the ten
// chains that pass one explicitly); profileId is always
// 'bawa-evm-bip44-v1'. The values are identical to the literals
// they replace — the chains tests pin them.
function evmChainFacts(
  evmChainId: number,
  slip44 = 60,
): Pick<ChainConfig, 'networkId' | 'assetId' | 'profileId'> {
  return {
    // CAIP-2 chain id, built through the shared helper rather than a
    // template string (Lane F).
    networkId: formatChainId({
      namespace: 'eip155',
      reference: String(evmChainId),
    }),
    assetId: `eip155:${evmChainId}/slip44:${slip44}`,
    profileId: 'bawa-evm-bip44-v1',
  };
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  btc: {
    ...GENERATED_CHAIN_FACTS.btc,
    id: 'btc',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/84'/0'/${account}'/0/${index}`;
    },
    capabilities: capabilitiesForAdapterChain('btc', true),
  },
  eth: {
    // ETH adapter: viem public client against the pinned mainnet RPC.
    ...GENERATED_CHAIN_FACTS.eth,
    id: 'eth',
    pathFor: expandedPathFor(EVM_PATH),
    // Lane B: the tracker's Blockscout v2 lookup reads these (shared
    // with the four newly-wired Blockscout chains). The adapter itself
    // keeps its hardcoded URL in wallet/adapters/eth.ts.
    historyBaseUrl: 'https://eth.blockscout.com/api',
    historyExplorerBase: 'https://eth.blockscout.com',
    capabilities: capabilitiesForAdapterChain('eth', true),
  },
  trx: {
    ...GENERATED_CHAIN_FACTS.trx,
    id: 'trx',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/195'/${account}'/0/${index}`;
    },
    capabilities: capabilitiesForAdapterChain('trx', true),
  },
  ton: {
    ...GENERATED_CHAIN_FACTS.ton,
    id: 'ton',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      // Lane A: see ed25519PathFor — account 0 index 0 keeps the
      // legacy m/44'/607'/0' (Wallet V4 R2, workchain 0, wallet ID
      // 698983191); new accounts and rotations derive additional
      // addresses on distinct hardened paths.
      return ed25519PathFor(607, account, index);
    },
    capabilities: capabilitiesForAdapterChain('ton', false),
  },
  sol: {
    id: 'sol',
    displayName: 'Solana',
    symbol: 'SOL',
    coinTypeName: 'solana',
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    assetId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
    profileId: 'bawa-sol-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      // Lane A: see ed25519PathFor — account 0 index 0 keeps the
      // legacy m/44'/501'/0'; new accounts and rotations derive
      // additional addresses on distinct hardened paths.
      return ed25519PathFor(501, account, index);
    },
    // Lane B (2026-11-27): backup is solana.publicnode.com - Vibe Station
    // connection-refused, replaced. Both hostnames share PublicNode infra,
    // so this guards a hostname failure, not a provider outage.
    rpcEndpoints: ['https://solana-rpc.publicnode.com', 'https://solana.publicnode.com'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('sol', undefined, true),
  },
  bsc: {
    id: 'bsc',
    displayName: 'BNB Smart Chain',
    symbol: 'BNB',
    coinTypeName: 'smartChain',
    ...evmChainFacts(56, 714),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'],
    evmChainId: 56,
    capabilities: capabilitiesForBalanceChain('bsc'),
  },
  matic: {
    id: 'matic',
    displayName: 'Polygon',
    symbol: 'POL',
    coinTypeName: 'polygon',
    ...evmChainFacts(137, 966),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://polygon-bor-rpc.publicnode.com'],
    evmChainId: 137,
    // Lane B: polygon.blockscout.com answers HTTP 200 with real txs
    // to a browser fetch (curl gets 403 Cloudflare) — probed live
    // 2026-11-23 in headless Chromium.
    historyBaseUrl: 'https://polygon.blockscout.com/api',
    historyExplorerBase: 'https://polygon.blockscout.com',
    capabilities: capabilitiesForBalanceChain(
      'matic',
      undefined,
      true,
      HISTORY_EVIDENCE_2026_11_23_BROWSER,
    ),
  },
  arb: {
    id: 'arb',
    displayName: 'Arbitrum One',
    symbol: 'ETH',
    coinTypeName: 'arbitrum',
    ...evmChainFacts(42161),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://arbitrum-rpc.publicnode.com'],
    evmChainId: 42161,
    // Lane B: arbitrum.blockscout.com answers HTTP 200 with real txs
    // to a browser fetch (curl gets 403 Cloudflare) — probed live
    // 2026-11-23 in headless Chromium.
    historyBaseUrl: 'https://arbitrum.blockscout.com/api',
    historyExplorerBase: 'https://arbitrum.blockscout.com',
    capabilities: capabilitiesForBalanceChain(
      'arb',
      undefined,
      true,
      HISTORY_EVIDENCE_2026_11_23_BROWSER,
    ),
  },
  op: {
    id: 'op',
    displayName: 'OP Mainnet',
    symbol: 'ETH',
    coinTypeName: 'optimism',
    ...evmChainFacts(10),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://optimism-rpc.publicnode.com', 'https://mainnet.optimism.io'],
    evmChainId: 10,
    // Lane B: probed live 2026-11-23 — txlist returns real transactions.
    historyBaseUrl: 'https://explorer.optimism.io/api',
    historyExplorerBase: 'https://explorer.optimism.io',
    capabilities: capabilitiesForBalanceChain('op', undefined, true, HISTORY_EVIDENCE_2026_11_23),
  },
  base: {
    id: 'base',
    displayName: 'Base',
    symbol: 'ETH',
    coinTypeName: 'base',
    ...evmChainFacts(8453),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://base-rpc.publicnode.com'],
    evmChainId: 8453,
    // Lane B: base.blockscout.com answers HTTP 200 with real txs to a
    // browser fetch (curl gets 403 Cloudflare) — probed live
    // 2026-11-23 in headless Chromium.
    historyBaseUrl: 'https://base.blockscout.com/api',
    historyExplorerBase: 'https://base.blockscout.com',
    capabilities: capabilitiesForBalanceChain(
      'base',
      undefined,
      true,
      HISTORY_EVIDENCE_2026_11_23_BROWSER,
    ),
  },
  avax: {
    id: 'avax',
    displayName: 'Avalanche C-Chain',
    symbol: 'AVAX',
    coinTypeName: 'avalancheCChain',
    ...evmChainFacts(43114, 9000),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://avalanche-rpc.publicnode.com', 'https://api.avax.network/ext/bc/C/rpc'],
    evmChainId: 43114,
    // Lane B: probed live 2026-11-23 — Routescan txlist returns real transactions.
    historyBaseUrl: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api',
    capabilities: capabilitiesForBalanceChain('avax', undefined, true, HISTORY_EVIDENCE_2026_11_23),
  },
  ltc: {
    id: 'ltc',
    displayName: 'Litecoin',
    symbol: 'LTC',
    coinTypeName: 'litecoin',
    networkId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    assetId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2',
    profileId: 'bawa-ltc-bip84-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/84'/2'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://litecoinspace.org/api'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('ltc', undefined, true),
  },
  doge: {
    id: 'doge',
    displayName: 'Dogecoin',
    symbol: 'DOGE',
    coinTypeName: 'dogecoin',
    networkId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
    assetId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3',
    profileId: 'bawa-doge-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/3'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://sochain.com/api/v3', 'https://api.blockcypher.com/v1/doge/main'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('doge', undefined, true),
  },
  gnosis: {
    id: 'gnosis',
    displayName: 'Gnosis',
    symbol: 'XDAI',
    coinTypeName: 'xdai',
    ...evmChainFacts(100),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://gnosis-rpc.publicnode.com',
      'https://rpc.gnosischain.com'],
    evmChainId: 100,
    capabilities: capabilitiesForBalanceChain('gnosis', BALANCE_EVIDENCE_2026_11_23),
  },
  celo: {
    id: 'celo',
    displayName: 'Celo',
    symbol: 'CELO',
    coinTypeName: 'celo',
    ...evmChainFacts(42220, 527),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://celo-rpc.publicnode.com',
      'https://forno.celo.org'],
    evmChainId: 42220,
    // Lane B: probed live 2026-11-23 — txlist returns real transactions.
    historyBaseUrl: 'https://celo.blockscout.com/api',
    historyExplorerBase: 'https://celo.blockscout.com',
    capabilities: capabilitiesForBalanceChain('celo', BALANCE_EVIDENCE_2026_11_23, true, HISTORY_EVIDENCE_2026_11_23),
  },
  linea: {
    id: 'linea',
    displayName: 'Linea',
    symbol: 'ETH',
    coinTypeName: 'linea',
    ...evmChainFacts(59144),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://linea-rpc.publicnode.com',
      'https://rpc.linea.build'],
    evmChainId: 59144,
    // Fix-All Lane A: probed live 2026-11-24 — Etherscan V2 answers
    // keyless for chain 59144 with real transactions.
    historyBaseUrl: 'https://api.etherscan.io/v2/api?chainid=59144',
    historyExplorerBase: 'https://lineascan.build',
    capabilities: capabilitiesForBalanceChain(
      'linea',
      BALANCE_EVIDENCE_2026_11_23,
      true,
      HISTORY_EVIDENCE_2026_11_24_LINEA,
    ),
  },
  mantle: {
    id: 'mantle',
    displayName: 'Mantle',
    symbol: 'MNT',
    coinTypeName: 'mantle',
    ...evmChainFacts(5000),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mantle-rpc.publicnode.com',
      'https://rpc.mantle.xyz'],
    evmChainId: 5000,
    // Lane B: probed live 2026-11-23 — Routescan txlist returns real transactions.
    historyBaseUrl: 'https://api.routescan.io/v2/network/mainnet/evm/5000/etherscan/api',
    capabilities: capabilitiesForBalanceChain('mantle', BALANCE_EVIDENCE_2026_11_23, true, HISTORY_EVIDENCE_2026_11_23),
  },
  scroll: {
    id: 'scroll',
    displayName: 'Scroll',
    symbol: 'ETH',
    coinTypeName: 'scroll',
    ...evmChainFacts(534352),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://scroll-rpc.publicnode.com',
      'https://rpc.scroll.io'],
    evmChainId: 534352,
    // Lane B: probed live 2026-11-23 — txlist returns real transactions.
    historyBaseUrl: 'https://scrollscan.com/api',
    historyExplorerBase: 'https://scrollscan.com',
    capabilities: capabilitiesForBalanceChain('scroll', BALANCE_EVIDENCE_2026_11_23, true, HISTORY_EVIDENCE_2026_11_23),
  },
  opbnb: {
    id: 'opbnb',
    displayName: 'opBNB',
    symbol: 'BNB',
    coinTypeName: 'opBNB',
    ...evmChainFacts(204),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://opbnb-rpc.publicnode.com',
      'https://opbnb-mainnet-rpc.bnbchain.org'],
    evmChainId: 204,
    capabilities: capabilitiesForBalanceChain('opbnb', BALANCE_EVIDENCE_2026_11_23),
  },
  metis: {
    id: 'metis',
    displayName: 'Metis',
    symbol: 'METIS',
    coinTypeName: 'metis',
    ...evmChainFacts(1088),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://metis-rpc.publicnode.com',
      'https://andromeda.metis.io'],
    evmChainId: 1088,
    capabilities: capabilitiesForBalanceChain('metis', BALANCE_EVIDENCE_2026_11_23),
  },
  aurora: {
    id: 'aurora',
    displayName: 'Aurora',
    symbol: 'ETH',
    coinTypeName: 'aurora',
    ...evmChainFacts(1313161554),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.aurora.dev',
      'https://aurora.drpc.org'],
    evmChainId: 1313161554,
    // Lane B: probed live 2026-11-23 — txlist returns real transactions.
    historyBaseUrl: 'https://explorer.aurora.dev/api',
    historyExplorerBase: 'https://explorer.aurora.dev',
    capabilities: capabilitiesForBalanceChain('aurora', BALANCE_EVIDENCE_2026_11_23, true, HISTORY_EVIDENCE_2026_11_23),
  },
  fantom: {
    id: 'fantom',
    displayName: 'Fantom',
    symbol: 'FTM',
    coinTypeName: 'fantom',
    ...evmChainFacts(250, 250),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.fantom.network',
      'https://rpc2.fantom.network'],
    evmChainId: 250,
    capabilities: capabilitiesForBalanceChain('fantom', BALANCE_EVIDENCE_2026_11_23),
  },
  zksync: {
    id: 'zksync',
    displayName: 'ZKsync Era',
    symbol: 'ETH',
    coinTypeName: 'zksync',
    ...evmChainFacts(324),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
    evmChainId: 324,
    capabilities: capabilitiesForExpandedBalanceChain('zksync'),
  },
  cronos: {
    id: 'cronos',
    displayName: 'Cronos',
    symbol: 'CRO',
    coinTypeName: 'cronosChain',
    ...evmChainFacts(25),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://evm.cronos.com', 'https://cronos-evm-rpc.publicnode.com'],
    evmChainId: 25,
    capabilities: capabilitiesForExpandedBalanceChain('cronos'),
  },
  kava: {
    id: 'kava',
    displayName: 'Kava',
    symbol: 'KAVA',
    coinTypeName: 'kavaEvm',
    ...evmChainFacts(2222),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://evm.kava.io', 'https://kava-evm-rpc.publicnode.com'],
    evmChainId: 2222,
    capabilities: capabilitiesForExpandedBalanceChain('kava'),
  },
  filecoin: {
    id: 'filecoin',
    displayName: 'Filecoin',
    symbol: 'FIL',
    coinTypeName: 'filecoin',
    ...evmChainFacts(314, 461),
    pathFor: expandedPathFor("m/44'/461'/{account}'/0/{index}"),
    rpcEndpoints: ['https://api.node.glif.io/', 'https://rpc.ankr.com/filecoin'],
    evmChainId: 314,
    capabilities: capabilitiesForExpandedChain('filecoin', true),
  },
  zora: {
    id: 'zora',
    displayName: 'Zora',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(7777777),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.zora.energy/', 'https://zora.drpc.org'],
    evmChainId: 7777777,
    capabilities: capabilitiesForExpandedBalanceChain('zora'),
  },
  mode: {
    id: 'mode',
    displayName: 'Mode',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(34443),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.mode.network', 'https://mode.drpc.org'],
    evmChainId: 34443,
    historyExplorerBase: 'https://explorer.mode.network',
    capabilities: capabilitiesForExpandedBalanceChain('mode'),
  },
  fraxtal: {
    id: 'fraxtal',
    displayName: 'Fraxtal',
    symbol: 'frxETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(252),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.frax.com', 'https://fraxtal-rpc.publicnode.com'],
    evmChainId: 252,
    capabilities: capabilitiesForExpandedBalanceChain('fraxtal'),
  },
  berachain: {
    id: 'berachain',
    displayName: 'Berachain',
    symbol: 'BERA',
    coinTypeName: 'ethereum',
    ...evmChainFacts(80094),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.berachain.com', 'https://berachain-rpc.publicnode.com'],
    evmChainId: 80094,
    capabilities: capabilitiesForExpandedBalanceChain('berachain'),
  },
  sei: {
    id: 'sei',
    displayName: 'Sei',
    symbol: 'SEI',
    coinTypeName: 'seiEVM',
    ...evmChainFacts(1329),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://evm-rpc.sei-apis.com', 'https://sei.drpc.org'],
    evmChainId: 1329,
    capabilities: capabilitiesForExpandedBalanceChain('sei'),
  },
  arbnova: {
    id: 'arbnova',
    displayName: 'Arbitrum Nova',
    symbol: 'ETH',
    coinTypeName: 'arbitrumNova',
    ...evmChainFacts(42170),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://nova.arbitrum.io/rpc', 'https://arbitrum-nova-rpc.publicnode.com'],
    evmChainId: 42170,
    capabilities: capabilitiesForExpandedBalanceChain('arbnova'),
  },
  worldchain: {
    id: 'worldchain',
    displayName: 'World Chain',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(480),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://worldchain-mainnet.g.alchemy.com/public', 'https://480.rpc.thirdweb.com'],
    evmChainId: 480,
    capabilities: capabilitiesForExpandedBalanceChain('worldchain'),
  },
  manta: {
    id: 'manta',
    displayName: 'Manta Pacific',
    symbol: 'ETH',
    coinTypeName: 'mantaPacific',
    ...evmChainFacts(169),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://pacific-rpc.manta.network/http', 'https://manta-pacific.drpc.org'],
    evmChainId: 169,
    historyExplorerBase: 'https://pacific-explorer.manta.network',
    capabilities: capabilitiesForExpandedBalanceChain('manta'),
  },
  unichain: {
    id: 'unichain',
    displayName: 'Unichain',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(130),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.unichain.org', 'https://unichain-rpc.publicnode.com'],
    evmChainId: 130,
    capabilities: capabilitiesForExpandedBalanceChain('unichain'),
  },
  ink: {
    id: 'ink',
    displayName: 'Ink',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(57073),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'],
    evmChainId: 57073,
    capabilities: capabilitiesForExpandedBalanceChain('ink'),
  },
  abstract: {
    id: 'abstract',
    displayName: 'Abstract',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(2741),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://api.mainnet.abs.xyz', 'https://abstract.drpc.org'],
    evmChainId: 2741,
    capabilities: capabilitiesForExpandedBalanceChain('abstract'),
  },
  soneium: {
    id: 'soneium',
    displayName: 'Soneium',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(1868),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.soneium.org', 'https://soneium-rpc.publicnode.com'],
    evmChainId: 1868,
    capabilities: capabilitiesForExpandedBalanceChain('soneium'),
  },
  apechain: {
    id: 'apechain',
    displayName: 'ApeChain',
    symbol: 'APE',
    coinTypeName: 'ethereum',
    ...evmChainFacts(33139),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.apechain.com', 'https://apechain.drpc.org'],
    evmChainId: 33139,
    capabilities: capabilitiesForExpandedBalanceChain('apechain'),
  },
  sonic: {
    id: 'sonic',
    displayName: 'Sonic',
    symbol: 'S',
    coinTypeName: 'sonic',
    ...evmChainFacts(146),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.soniclabs.com', 'https://sonic-rpc.publicnode.com'],
    evmChainId: 146,
    capabilities: capabilitiesForExpandedBalanceChain('sonic'),
  },
  hyperevm: {
    id: 'hyperevm',
    displayName: 'HyperEVM',
    symbol: 'HYPE',
    coinTypeName: 'hyperEVM',
    ...evmChainFacts(999),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.hyperliquid.xyz/evm', 'https://hyperliquid-rpc.publicnode.com'],
    evmChainId: 999,
    capabilities: capabilitiesForExpandedBalanceChain('hyperevm'),
  },
  monad: {
    id: 'monad',
    displayName: 'Monad',
    symbol: 'MON',
    coinTypeName: 'monad',
    ...evmChainFacts(143),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.monad.xyz', 'https://monad.drpc.org'],
    evmChainId: 143,
    capabilities: capabilitiesForExpandedBalanceChain('monad'),
  },
  ronin: {
    id: 'ronin',
    displayName: 'Ronin',
    symbol: 'RON',
    coinTypeName: 'ronin',
    ...evmChainFacts(2020),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://api.roninchain.com/rpc', 'https://ronin.drpc.org'],
    evmChainId: 2020,
    historyExplorerBase: 'https://explorer.roninchain.com',
    capabilities: capabilitiesForExpandedBalanceChain(
      'ronin',
      'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter) + '
        + 'live mainnet cross-check 2026-11-24: primary https://api.roninchain.com/rpc returns '
        + 'chain id 2020 and balance; backup https://ronin.drpc.org answers eth_chainId but '
        + 'returns HTTP 400/500 on eth_getBalance (4 attempts 2026-11-24), so the two-RPC '
        + 'balance-agreement bar is NOT met for ronin — balance loads from the primary only.',
    ),
  },
  immutable: {
    id: 'immutable',
    displayName: 'Immutable zkEVM',
    symbol: 'IMX',
    coinTypeName: 'ethereum',
    ...evmChainFacts(13371),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.immutable.com', 'https://immutable-zkevm.drpc.org'],
    evmChainId: 13371,
    capabilities: capabilitiesForExpandedBalanceChain('immutable'),
  },
  fuse: {
    id: 'fuse',
    displayName: 'Fuse',
    symbol: 'FUSE',
    coinTypeName: 'ethereum',
    ...evmChainFacts(122),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.fuse.io', 'https://fuse.drpc.org'],
    evmChainId: 122,
    historyExplorerBase: 'https://explorer.fuse.io',
    capabilities: capabilitiesForExpandedBalanceChain('fuse'),
  },
  velas: {
    id: 'velas',
    displayName: 'Velas',
    symbol: 'VLX',
    coinTypeName: 'ethereum',
    ...evmChainFacts(106),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://evmexplorer.velas.com/rpc', 'https://106.rpc.thirdweb.com'],
    evmChainId: 106,
    capabilities: capabilitiesForExpandedBalanceChain('velas'),
  },
  syscoin: {
    id: 'syscoin',
    displayName: 'Syscoin',
    symbol: 'SYS',
    coinTypeName: 'ethereum',
    ...evmChainFacts(57),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.syscoin.org', 'https://57.rpc.thirdweb.com'],
    evmChainId: 57,
    historyExplorerBase: 'https://explorer.syscoin.org',
    capabilities: capabilitiesForExpandedBalanceChain('syscoin'),
  },
  theta: {
    id: 'theta',
    displayName: 'Theta',
    symbol: 'TFUEL',
    coinTypeName: 'thetaFuel',
    ...evmChainFacts(361, 500),
    pathFor: expandedPathFor("m/44'/500'/{account}'/0/{index}"),
    rpcEndpoints: ['https://eth-rpc-api.thetatoken.org/rpc', 'https://361.rpc.thirdweb.com'],
    evmChainId: 361,
    capabilities: capabilitiesForExpandedBalanceChain('theta'),
  },
  iotex: {
    id: 'iotex',
    displayName: 'IoTeX',
    symbol: 'IOTX',
    coinTypeName: 'ioTeXEVM',
    ...evmChainFacts(4689, 304),
    pathFor: expandedPathFor("m/44'/304'/{account}'/0/{index}"),
    rpcEndpoints: ['https://babel-api.mainnet.iotex.io', 'https://4689.rpc.thirdweb.com'],
    evmChainId: 4689,
    capabilities: capabilitiesForExpandedBalanceChain('iotex'),
  },
  xlayer: {
    id: 'xlayer',
    displayName: 'X Layer',
    symbol: 'OKB',
    coinTypeName: 'ethereum',
    ...evmChainFacts(196),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
    evmChainId: 196,
    capabilities: capabilitiesForExpandedBalanceChain('xlayer'),
  },
  boba: {
    id: 'boba',
    displayName: 'Boba Network',
    symbol: 'ETH',
    coinTypeName: 'boba',
    ...evmChainFacts(288),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.boba.network', 'https://boba-ethereum.gateway.tenderly.co'],
    evmChainId: 288,
    capabilities: capabilitiesForExpandedBalanceChain('boba'),
  },
  taiko: {
    id: 'taiko',
    displayName: 'Taiko',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(167000),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.mainnet.taiko.xyz', 'https://taiko-rpc.publicnode.com'],
    evmChainId: 167000,
    capabilities: capabilitiesForExpandedBalanceChain('taiko'),
  },
  astar: {
    id: 'astar',
    displayName: 'Astar',
    symbol: 'ASTR',
    coinTypeName: 'ethereum',
    ...evmChainFacts(592),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://astar.drpc.org', 'https://evm.astar.network'],
    evmChainId: 592,
    capabilities: capabilitiesForExpandedBalanceChain('astar'),
  },
  telos: {
    id: 'telos',
    displayName: 'Telos',
    symbol: 'TLOS',
    coinTypeName: 'ethereum',
    ...evmChainFacts(40),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.telos.net', 'https://telos.drpc.org'],
    evmChainId: 40,
    capabilities: capabilitiesForExpandedBalanceChain('telos'),
  },
  conflux: {
    id: 'conflux',
    displayName: 'Conflux eSpace',
    symbol: 'CFX',
    coinTypeName: 'confluxeSpace',
    ...evmChainFacts(1030),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://evm.confluxrpc.com', 'https://evm.confluxrpc.org'],
    evmChainId: 1030,
    capabilities: capabilitiesForExpandedBalanceChain('conflux'),
  },
  core: {
    id: 'core',
    displayName: 'Core',
    symbol: 'CORE',
    coinTypeName: 'ethereum',
    ...evmChainFacts(1116),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.coredao.org/', 'https://core.drpc.org'],
    evmChainId: 1116,
    capabilities: capabilitiesForExpandedBalanceChain('core'),
  },
  songbird: {
    id: 'songbird',
    displayName: 'Songbird',
    symbol: 'SGB',
    coinTypeName: 'ethereum',
    ...evmChainFacts(19),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://songbird-api.flare.network/ext/C/rpc', 'https://songbird-api.flare.network/ext/bc/C/rpc'],
    evmChainId: 19,
    historyExplorerBase: 'https://songbird-explorer.flare.network',
    capabilities: capabilitiesForExpandedBalanceChain('songbird'),
  },
  rootstock: {
    id: 'rootstock',
    displayName: 'Rootstock',
    symbol: 'RBTC',
    coinTypeName: 'rootstock',
    ...evmChainFacts(30, 137),
    pathFor: expandedPathFor("m/44'/137'/{account}'/0/{index}"),
    rpcEndpoints: ['https://public-node.rsk.co', 'https://mycrypto.rsk.co'],
    evmChainId: 30,
    capabilities: capabilitiesForExpandedBalanceChain('rootstock'),
  },
  pulsechain: {
    id: 'pulsechain',
    displayName: 'PulseChain',
    symbol: 'PLS',
    coinTypeName: 'ethereum',
    ...evmChainFacts(369),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.pulsechain.com', 'https://pulsechain-rpc.publicnode.com'],
    evmChainId: 369,
    capabilities: capabilitiesForExpandedBalanceChain('pulsechain'),
  },
  xdc: {
    id: 'xdc',
    displayName: 'XDC Network',
    symbol: 'XDC',
    coinTypeName: 'ethereum',
    ...evmChainFacts(50),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.xdc.network', 'https://50.rpc.thirdweb.com'],
    evmChainId: 50,
    capabilities: capabilitiesForExpandedBalanceChain('xdc'),
  },
  chiliz: {
    id: 'chiliz',
    displayName: 'Chiliz',
    symbol: 'CHZ',
    coinTypeName: 'ethereum',
    ...evmChainFacts(88888),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.chiliz.com', 'https://rpc.ankr.com/chiliz'],
    evmChainId: 88888,
    capabilities: capabilitiesForExpandedBalanceChain('chiliz'),
  },
  etc: {
    id: 'etc',
    displayName: 'Ethereum Classic',
    symbol: 'ETC',
    coinTypeName: 'ethereumClassic',
    ...evmChainFacts(61, 61),
    pathFor: expandedPathFor("m/44'/61'/{account}'/0/{index}"),
    rpcEndpoints: ['https://geth-at.etc-network.info', 'https://etc.etcdesktop.com'],
    evmChainId: 61,
    historyExplorerBase: 'https://etc.blockscout.com',
    capabilities: capabilitiesForExpandedBalanceChain('etc'),
  },
  flare: {
    id: 'flare',
    displayName: 'Flare',
    symbol: 'FLR',
    coinTypeName: 'ethereum',
    ...evmChainFacts(14),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://flare-api.flare.network/ext/C/rpc', 'https://flare.rpc.thirdweb.com'],
    evmChainId: 14,
    historyExplorerBase: 'https://flare-explorer.flare.network',
    capabilities: capabilitiesForExpandedBalanceChain('flare'),
  },
  zetachain: {
    id: 'zetachain',
    displayName: 'ZetaChain',
    symbol: 'ZETA',
    coinTypeName: 'zetaEVM',
    ...evmChainFacts(7000),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://zetachain-evm.blockpi.network/v1/rpc/public', 'https://zetachain-mainnet.g.allthatnode.com/archive/evm'],
    evmChainId: 7000,
    historyExplorerBase: 'https://zetascan.com',
    capabilities: capabilitiesForExpandedBalanceChain('zetachain'),
  },
  hemi: {
    id: 'hemi',
    displayName: 'Hemi',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(43111),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.hemi.network/rpc', 'https://43111.rpc.thirdweb.com'],
    evmChainId: 43111,
    historyExplorerBase: 'https://explorer.hemi.xyz',
    capabilities: capabilitiesForExpandedBalanceChain('hemi'),
  },
  bob: {
    id: 'bob',
    displayName: 'BOB',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    ...evmChainFacts(60808),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://rpc.gobob.xyz', 'https://60808.rpc.thirdweb.com'],
    evmChainId: 60808,
    capabilities: capabilitiesForExpandedBalanceChain('bob'),
  },
  flowevm: {
    id: 'flowevm',
    displayName: 'Flow EVM',
    symbol: 'FLOW',
    coinTypeName: 'ethereum',
    ...evmChainFacts(747),
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://mainnet.evm.nodes.onflow.org', 'https://747.rpc.thirdweb.com'],
    evmChainId: 747,
    capabilities: capabilitiesForExpandedBalanceChain('flowevm'),
  },
  cosmos: {
    id: 'cosmos',
    displayName: 'Cosmos Hub',
    symbol: 'ATOM',
    coinTypeName: 'cosmos',
    networkId: 'cosmos:cosmoshub-4',
    assetId: 'cosmos:cosmoshub-4/slip44:118',
    profileId: 'bawa-cosmos-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://cosmos-rpc.publicnode.com/status', 'https://cosmos-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('cosmos', true),
  },
  osmosis: {
    id: 'osmosis',
    displayName: 'Osmosis',
    symbol: 'OSMO',
    coinTypeName: 'osmosis',
    networkId: 'cosmos:osmosis-1',
    assetId: 'cosmos:osmosis-1/slip44:118',
    profileId: 'bawa-osmosis-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://osmosis-rpc.publicnode.com/status', 'https://rpc.osmosis.zone/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('osmosis', true),
  },
  xrp: {
    id: 'xrp',
    displayName: 'XRP Ledger',
    symbol: 'XRP',
    coinTypeName: 'xrp',
    networkId: 'xrpl:0',
    assetId: 'xrpl:0/slip44:144',
    profileId: 'bawa-xrp-bip44-v1',
    pathFor: expandedPathFor("m/44'/144'/{account}'/0/{index}"),
    rpcEndpoints: ['https://s1.ripple.com:51234', 'https://xrplcluster.com'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('xrp', true),
  },
  stellar: {
    id: 'stellar',
    displayName: 'Stellar',
    symbol: 'XLM',
    coinTypeName: 'stellar',
    networkId: 'stellar:pubnet',
    assetId: 'stellar:pubnet/slip44:148',
    profileId: 'bawa-stellar-bip44-v1',
    pathFor: expandedPathFor("m/44'/148'/{account}'"),
    rpcEndpoints: ['https://horizon.stellar.org/', 'https://horizon.stellar.lobstr.co/'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('stellar', false),
  },
  polkadot: {
    id: 'polkadot',
    displayName: 'Polkadot',
    symbol: 'DOT',
    coinTypeName: 'polkadot',
    networkId: 'polkadot:91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3',
    assetId: 'polkadot:91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3/slip44:354',
    profileId: 'bawa-polkadot-bip44-v1',
    pathFor: expandedPathFor("m/44'/354'/{account}'/0'/{index}'"),
    rpcEndpoints: ['https://polkadot-rpc.publicnode.com', 'https://rpc.polkadot.io'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('polkadot', false),
  },
  near: {
    id: 'near',
    displayName: 'NEAR Protocol',
    symbol: 'NEAR',
    coinTypeName: 'near',
    networkId: 'near:mainnet',
    assetId: 'near:mainnet/slip44:397',
    profileId: 'bawa-near-bip44-v1',
    pathFor: expandedPathFor("m/44'/397'/{account}'"),
    rpcEndpoints: ['https://rpc.mainnet.near.org', 'https://near.drpc.org'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('near', false),
  },
  aptos: {
    id: 'aptos',
    displayName: 'Aptos',
    symbol: 'APT',
    coinTypeName: 'aptos',
    networkId: 'aptos:1',
    assetId: 'aptos:1/slip44:637',
    profileId: 'bawa-aptos-bip44-v1',
    pathFor: expandedPathFor("m/44'/637'/{account}'/0'/{index}'"),
    rpcEndpoints: ['https://fullnode.mainnet.aptoslabs.com/v1/', 'https://api.mainnet.aptoslabs.com/v1/'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('aptos', false),
  },
  tezos: {
    id: 'tezos',
    displayName: 'Tezos',
    symbol: 'XTZ',
    coinTypeName: 'tezos',
    networkId: 'tezos:NetXdQprcVkpaWU',
    assetId: 'tezos:NetXdQprcVkpaWU/slip44:1729',
    profileId: 'bawa-tezos-bip44-v1',
    pathFor: expandedPathFor("m/44'/1729'/{account}'/0'"),
    rpcEndpoints: ['https://rpc.tzbeta.net/chains/main/blocks/head/header', 'https://rpc.tzkt.io/mainnet/chains/main/blocks/head/header'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('tezos', false),
  },
  algorand: {
    id: 'algorand',
    displayName: 'Algorand',
    symbol: 'ALGO',
    coinTypeName: 'algorand',
    networkId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    assetId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=/slip44:283',
    profileId: 'bawa-algorand-bip44-v1',
    pathFor: expandedPathFor("m/44'/283'/{account}'/0'/{index}'"),
    rpcEndpoints: ['https://mainnet-api.algonode.cloud/v2/status', 'https://mainnet-api.4160.nodely.dev/v2/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('algorand', false),
  },
  hedera: {
    id: 'hedera',
    displayName: 'Hedera',
    symbol: 'HBAR',
    coinTypeName: 'hedera',
    networkId: 'hedera:mainnet',
    assetId: 'hedera:mainnet/slip44:3030',
    profileId: 'bawa-hedera-bip44-v1',
    pathFor: expandedPathFor("m/44'/3030'/{account}'/0'/{index}"),
    rpcEndpoints: ['https://mainnet-public.mirrornode.hedera.com/api/v1/network/exchangerate', 'https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('hedera', false),
  },
  injective: {
    id: 'injective',
    displayName: 'Injective',
    symbol: 'INJ',
    coinTypeName: 'nativeInjective',
    networkId: 'cosmos:injective-1',
    assetId: 'cosmos:injective-1/slip44:60',
    profileId: 'bawa-injective-bip44-v1',
    pathFor: expandedPathFor(EVM_PATH),
    rpcEndpoints: ['https://injective-rpc.publicnode.com/status', 'https://injective-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('injective', true),
  },
  celestia: {
    id: 'celestia',
    displayName: 'Celestia',
    symbol: 'TIA',
    coinTypeName: 'tia',
    networkId: 'cosmos:celestia',
    assetId: 'cosmos:celestia/slip44:118',
    profileId: 'bawa-celestia-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://celestia-rpc.publicnode.com/status', 'https://celestia-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('celestia', true),
  },
  dydx: {
    id: 'dydx',
    displayName: 'dYdX',
    symbol: 'DYDX',
    coinTypeName: 'dydx',
    networkId: 'cosmos:dydx-mainnet-1',
    assetId: 'cosmos:dydx-mainnet-1/slip44:118',
    profileId: 'bawa-dydx-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://dydx-rpc.publicnode.com/status', 'https://dydx-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('dydx', true),
  },
  seicosmos: {
    id: 'seicosmos',
    displayName: 'Sei (Cosmos)',
    symbol: 'SEI',
    coinTypeName: 'sei',
    networkId: 'cosmos:pacific-1',
    assetId: 'cosmos:pacific-1/slip44:118',
    profileId: 'bawa-seicosmos-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://sei-rpc.publicnode.com/status', 'https://sei-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('seicosmos', true),
  },
  axelar: {
    id: 'axelar',
    displayName: 'Axelar',
    symbol: 'AXL',
    coinTypeName: 'axelar',
    networkId: 'cosmos:axelar-dojo-1',
    assetId: 'cosmos:axelar-dojo-1/slip44:118',
    profileId: 'bawa-axelar-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://axelar-rpc.publicnode.com/status', 'https://axelar-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('axelar', true),
  },
  noble: {
    id: 'noble',
    displayName: 'Noble',
    symbol: 'USDC',
    coinTypeName: 'noble',
    networkId: 'cosmos:noble-1',
    assetId: 'cosmos:noble-1/slip44:118',
    profileId: 'bawa-noble-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://noble-rpc.polkachu.com/status', 'https://rpc-noble.keplr.app/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('noble', true),
  },
  juno: {
    id: 'juno',
    displayName: 'Juno',
    symbol: 'JUNO',
    coinTypeName: 'juno',
    networkId: 'cosmos:juno-1',
    assetId: 'cosmos:juno-1/slip44:118',
    profileId: 'bawa-juno-bip44-v1',
    pathFor: expandedPathFor("m/44'/118'/{account}'/0/{index}"),
    rpcEndpoints: ['https://juno-rpc.publicnode.com/status', 'https://juno-rpc.polkachu.com/status'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('juno', true),
  },
  cardano: {
    id: 'cardano',
    displayName: 'Cardano',
    symbol: 'ADA',
    coinTypeName: 'cardano',
    networkId: 'cardano:mainnet',
    assetId: 'cardano:mainnet/slip44:1815',
    profileId: 'bawa-cardano-cip1852-v1',
    pathFor: expandedPathFor("m/1852'/1815'/{account}'/0/{index}"),
    rpcEndpoints: ['https://api.koios.rest/api/v1/tip', 'https://api.koios.rest/api/v1/blocks'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('cardano', false, CARDANO_DERIVE_EVIDENCE),
  },
  kaspa: {
    id: 'kaspa',
    displayName: 'Kaspa',
    symbol: 'KAS',
    coinTypeName: 'kaspa',
    networkId: 'kaspa:mainnet',
    assetId: 'kaspa:mainnet/slip44:111111',
    profileId: 'bawa-kaspa-bip44-v1',
    pathFor: expandedPathFor("m/44'/111111'/{account}'/0/{index}"),
    rpcEndpoints: ['https://api.kaspa.org/info/blockdag', 'https://api.kaspa.org/info/network'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('kaspa', false, KASPA_DERIVE_EVIDENCE),
  },
  starknet: {
    id: 'starknet',
    displayName: 'Starknet',
    symbol: 'STRK',
    coinTypeName: 'starknet',
    networkId: 'starknet:SN_MAIN',
    assetId: 'starknet:SN_MAIN/slip44:9004',
    profileId: 'bawa-starknet-bip44-v1',
    pathFor: expandedPathFor("m/44'/9004'/{account}'/0/{index}"),
    rpcEndpoints: ['https://starknet-mainnet.drpc.org', 'https://starknet.drpc.org'],
    evmChainId: null,
    capabilities: capabilitiesForExpandedChain('starknet', false, STARKNET_DERIVE_EVIDENCE),
  },
};

export const SUPPORTED_CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom', 'zksync', 'cronos', 'kava', 'filecoin', 'zora', 'mode', 'fraxtal', 'berachain', 'sei', 'arbnova', 'worldchain', 'manta', 'unichain', 'ink', 'abstract', 'soneium', 'apechain', 'sonic', 'hyperevm', 'monad', 'ronin', 'immutable', 'fuse', 'velas', 'syscoin', 'theta', 'iotex', 'xlayer', 'boba', 'taiko', 'astar', 'telos', 'conflux', 'core', 'songbird', 'rootstock', 'pulsechain', 'xdc', 'chiliz', 'etc', 'flare', 'zetachain', 'hemi', 'bob', 'flowevm', 'cosmos', 'osmosis', 'xrp', 'stellar', 'polkadot', 'near', 'aptos', 'tezos', 'algorand', 'hedera', 'injective', 'celestia', 'dydx', 'seicosmos', 'axelar', 'noble', 'juno', 'cardano', 'kaspa', 'starknet'];

// The Wallet Core default Solana profile is now supported as bawa-sol-bip44-v1; only the Phantom bip44Change profile stays unsupported.
interface UnsupportedProfile {
  profileId: string;
  path: string;
  networkId: string;
  status: 'unsupported';
  note: string;
}

export const SOLANA_PROFILES: Readonly<Record<string, UnsupportedProfile>> = {
  'solana-phantom-bip44change-v1': {
    profileId: 'solana-phantom-bip44change-v1',
    path: "m/44'/501'/{i}'/0'",
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    status: 'unsupported',
    note: 'OKX / Phantom bip44Change profile. Unsupported in this lane.',
  },
};

/**
 * SLIP-0010: Ed25519 allows hardened-only child derivation; a non-hardened
 * suffix on an ed25519 path is invalid. Throws an Error naming the path when
 * any component after m/ is non-hardened (no trailing apostrophe).
 */
export function assertHardenedEd25519Path(path: string): void {
  const components = path.split('/');
  if (components.length < 2 || components[0] !== 'm') {
    throw new Error(
      `Invalid Ed25519 derivation path (expected m/...): ${path}`,
    );
  }
  for (const component of components.slice(1)) {
    if (component.length === 0 || !component.endsWith("'")) {
      throw new Error(
        `Invalid Ed25519 derivation path ${path}: component ${component} ` +
          `is not hardened (SLIP-0010 allows hardened-only child derivation).`,
      );
    }
  }
}

// Module-load enforcement: a non-hardened ed25519 path fails import, never
// derivation. The TON/SOL paths at account 0 index 0, account 1 index 0
// and account 0 index 1, and every Solana profile path ({i} expanded to
// 0), are fully hardened; no existing path value is changed.
assertHardenedEd25519Path(CHAINS.ton.pathFor(0, 0));
assertHardenedEd25519Path(CHAINS.ton.pathFor(1, 0));
assertHardenedEd25519Path(CHAINS.ton.pathFor(0, 1));
assertHardenedEd25519Path(CHAINS.sol.pathFor(0, 0));
assertHardenedEd25519Path(CHAINS.sol.pathFor(1, 0));
assertHardenedEd25519Path(CHAINS.sol.pathFor(0, 1));
// Lane 80-APP: the four new fully-hardened Ed25519 chains. Hedera is
// excluded — its Trust Wallet Core path ends in an unhardened index.
for (const chain of ['polkadot', 'aptos', 'tezos', 'algorand'] as const) {
  assertHardenedEd25519Path(CHAINS[chain].pathFor(0, 0));
  assertHardenedEd25519Path(CHAINS[chain].pathFor(1, 0));
  assertHardenedEd25519Path(CHAINS[chain].pathFor(0, 1));
}
for (const profile of Object.values(SOLANA_PROFILES)) {
  assertHardenedEd25519Path(profile.path.replace('{i}', '0'));
}

export function chainConfig(chain: ChainId): ChainConfig {
  const config = CHAINS[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}.`);
  }
  return config;
}

export function profileFor(chain: ChainId): string {
  return chainConfig(chain).profileId;
}

export function pathFor(chain: ChainId, account: number, index: number): string {
  return chainConfig(chain).pathFor(account, index);
}

/**
 * Lane C (bot use case): the account-level path an extended public key
 * covers — the path the bot appends `/0/<index>` to for receiving
 * addresses. BTC `m/84'/0'/0'`, LTC `m/84'/2'/0'`, DOGE `m/44'/3'/0'`,
 * every EVM chain and TRX `m/44'/60'/0'` / `m/44'/195'/0'`. TON and SOL
 * have no extended public key: their (account, 0) path is itself the
 * address path (Lane A: it varies with the account now).
 */
export function accountPathFor(chain: ChainId, account: number): string {
  const path = pathFor(chain, account, 0);
  if (chain === 'ton' || chain === 'sol') return path;
  return path.replace(/\/0\/0$/u, '');
}

/**
 * Whether a fresh receive address can be derived for this chain (Lane C,
 * item 8 — HD rotation). Lane A: every chain rotates, including SOL and
 * TON — their fully hardened paths now carry the account and the index
 * (see ed25519PathFor), so a new index gives a new address while
 * account 0 index 0 keeps the legacy address.
 */
export function canRotateReceiveAddress(chain: ChainId): boolean {
  return SUPPORTED_CHAINS.includes(chain);
}

export function capabilitiesFor(chain: ChainId): Capabilities {
  return chainConfig(chain).capabilities;
}

/** Chains whose status for the capability is verified. */
export function availableFor(capability: CapabilityName): ChainId[] {
  return SUPPORTED_CHAINS.filter(
    (chain) => CHAINS[chain].capabilities[capability].status === 'verified',
  );
}

/**
 * Chains whose name, symbol or id contains the query (case-insensitive).
 * Lane 5: moved here from chain-search-select — the Add Token dialog
 * and the Receive token step filter by the same rule, and importing the
 * helper from the picker pulled the whole picker component (and its
 * logo + input imports) into their chunks. The picker re-exports this,
 * so its tests and existing importers keep working unchanged.
 */
export function filterChains(
  chains: readonly ChainId[],
  query: string,
): ChainId[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...chains];
  return chains.filter((chain) => {
    const config = chainConfig(chain);
    return (
      config.displayName.toLowerCase().includes(needle) ||
      config.symbol.toLowerCase().includes(needle) ||
      chain.toLowerCase().includes(needle)
    );
  });
}

/** Throws a typed error naming the exact unavailable combination. */
export function assertSupported(chain: ChainId, capability: CapabilityName): void {
  const config = chainConfig(chain);
  const entry = config.capabilities[capability];
  if (entry.status !== 'verified') {
    throw new Error(
      `Unsupported operation: chain ${chain} (${config.networkId}, profile ${config.profileId}) ` +
        `cannot do ${capability} — status ${entry.status}: ${entry.evidence}`,
    );
  }
}

const MAINNET_NETWORK_IDS: Readonly<Set<string>> = new Set(
  SUPPORTED_CHAINS.map((chain) => CHAINS[chain].networkId),
);

/** Looks a chain up by CAIP-2 network ID. Anything else throws, including non-mainnet IDs. */
export function chainConfigForNetwork(networkId: string): ChainConfig {
  if (!MAINNET_NETWORK_IDS.has(networkId)) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  const found = SUPPORTED_CHAINS.find(
    (chain) => CHAINS[chain].networkId === networkId,
  );
  if (!found) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  return CHAINS[found];
}

/**
 * RPC endpoint overrides (UI/UX fixes, item 19).
 *
 * The registry lists each chain's known-good endpoints (primary first,
 * backup second where one was verified live). The owner can add a custom
 * RPC, promote a backup to primary, or reset — stored per chain under
 * one localStorage key. Adapters resolve their endpoint list lazily
 * through resolveRpcEndpoints, so a change applies on the next balance
 * refresh without rebuilding any adapter. Dogecoin is NOT managed here:
 * its adapter has a built-in SoChain/BlockCypher pair with different
 * API shapes, so a custom URL could not be applied honestly.
 *
 * Lane F (FIX-ALL, 2026-11-24) — the CSP limit: the browser only
 * allows fetches to origins in the CSP connect-src allowlist baked
 * into the built index.html (security-headers.ts). A custom RPC whose
 * origin is not in that list would be stored and listed but refused
 * on every fetch, so the Networks screen only accepts origins
 * isCustomRpcOriginUsable reports (registry origins + the suggested
 * public RPCs) and says so in plain language. makePrimaryEndpoint
 * exists because promoteBackupEndpoint only swaps the first two —
 * a custom RPC added third could otherwise never become primary.
 */
export const RPC_OVERRIDES_KEY = 'bawa-rpc-overrides:v1';
const MAX_RPC_ENDPOINTS_PER_CHAIN = 3;

/** The chains whose adapters consume resolveRpcEndpoints (all but Dogecoin). */
export const RPC_MANAGED_CHAINS: readonly ChainId[] = SUPPORTED_CHAINS.filter(
  (chain) => chain !== 'doge',
);

export interface RpcOverrideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): RpcOverrideStorage | undefined {
  try {
    const storage = globalThis.localStorage;
    return storage === undefined ? undefined : storage;
  } catch {
    return undefined;
  }
}

function readStoredOverrides(
  storage?: RpcOverrideStorage,
): Partial<Record<ChainId, string[]>> {
  const store = storage ?? defaultStorage();
  if (store === undefined) return {};
  let raw: string | null;
  try {
    raw = store.getItem(RPC_OVERRIDES_KEY);
  } catch {
    return {};
  }
  if (raw === null || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const out: Partial<Record<ChainId, string[]>> = {};
  for (const chain of SUPPORTED_CHAINS) {
    const list = (parsed as Record<string, unknown>)[chain];
    if (!Array.isArray(list)) continue;
    const urls = list.filter(
      (entry): entry is string =>
        typeof entry === 'string' && validateRpcEndpoint(entry) === null,
    );
    if (urls.length > 0) {
      out[chain] = urls.slice(0, MAX_RPC_ENDPOINTS_PER_CHAIN);
    }
  }
  return out;
}

function writeStoredOverrides(
  overrides: Partial<Record<ChainId, string[]>>,
  storage?: RpcOverrideStorage,
): void {
  const store = storage ?? defaultStorage();
  if (store === undefined) return;
  const entries = Object.entries(overrides).filter(
    ([, list]) => list !== undefined && list.length > 0,
  );
  try {
    if (entries.length === 0) {
      store.removeItem(RPC_OVERRIDES_KEY);
    } else {
      store.setItem(RPC_OVERRIDES_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {
    // Storage full or unavailable: the in-memory list still applies for
    // this session's resolve calls through the passed storage; a
    // browser write failure never breaks a balance refresh.
  }
}

/** The effective endpoint list for a chain: the stored override, else the registry. */
export function resolveRpcEndpoints(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): string[] {
  const stored = readStoredOverrides(storage)[chain];
  return stored !== undefined ? [...stored] : [...CHAINS[chain].rpcEndpoints];
}

/**
 * Validates a custom RPC URL. Returns null when valid, else a message
 * for the owner. Only https, no embedded credentials, no query or
 * fragment — a keyed RPC (one with ?apikey=) is out of scope by owner
 * rule, and credentials in a stored URL would leak into request logs.
 */
export function validateRpcEndpoint(url: string): string | null {
  if (url.length === 0 || url.length > 256) return 'Enter a valid RPC URL.';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Enter a valid RPC URL.';
  }
  if (parsed.protocol !== 'https:') return 'RPC URLs must use https.';
  if (parsed.username !== '' || parsed.password !== '') {
    return 'RPC URLs must not contain credentials.';
  }
  if (parsed.hostname === '') return 'Enter a valid RPC URL.';
  if (parsed.search !== '' || parsed.hash !== '') {
    return 'RPC URLs must not contain a query or fragment.';
  }
  return null;
}

export function addCustomRpcEndpoint(
  chain: ChainId,
  url: string,
  storage?: RpcOverrideStorage,
): { ok: true } | { ok: false; reason: string } {
  const invalid = validateRpcEndpoint(url);
  if (invalid !== null) return { ok: false, reason: invalid };
  const current = resolveRpcEndpoints(chain, storage);
  if (current.includes(url)) {
    return {
      ok: false,
      reason: 'That RPC endpoint is already listed for this chain.',
    };
  }
  if (current.length >= MAX_RPC_ENDPOINTS_PER_CHAIN) {
    return {
      ok: false,
      reason: `At most ${MAX_RPC_ENDPOINTS_PER_CHAIN} endpoints per chain.`,
    };
  }
  const overrides = readStoredOverrides(storage);
  overrides[chain] = [...current, url];
  writeStoredOverrides(overrides, storage);
  return { ok: true };
}

/**
 * Removes a custom endpoint. Registry endpoints are never removed —
 * the registry is the known-good set; a registry endpoint the owner
 * distrusts is demoted with promoteBackupEndpoint, not deleted.
 */
export function removeRpcEndpoint(
  chain: ChainId,
  url: string,
  storage?: RpcOverrideStorage,
): boolean {
  if (CHAINS[chain].rpcEndpoints.includes(url)) return false;
  const current = resolveRpcEndpoints(chain, storage);
  if (!current.includes(url)) return false;
  const next = current.filter((entry) => entry !== url);
  return persistRpcEndpoints(chain, next, storage);
}

/**
 * Persist an endpoint list: drop the override when it equals the
 * registry defaults, store it otherwise. Shared by removeRpcEndpoint
 * and promoteBackupEndpoint. False when the list is empty.
 */
function persistRpcEndpoints(
  chain: ChainId,
  next: string[],
  storage?: RpcOverrideStorage,
): boolean {
  if (next.length === 0) return false;
  const overrides = readStoredOverrides(storage);
  const defaults = CHAINS[chain].rpcEndpoints;
  if (
    next.length === defaults.length &&
    next.every((entry, index) => entry === defaults[index])
  ) {
    delete overrides[chain];
  } else {
    overrides[chain] = next;
  }
  writeStoredOverrides(overrides, storage);
  return true;
}

/** Swaps the first two endpoints of the effective list (backup becomes primary). */
export function promoteBackupEndpoint(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): boolean {
  const current = resolveRpcEndpoints(chain, storage);
  if (current.length < 2) return false;
  const next = [current[1] as string, current[0] as string, ...current.slice(2)];
  return persistRpcEndpoints(chain, next, storage);
}

/**
 * Moves any listed endpoint to the front of the chain's list (Lane F,
 * FIX-ALL, 2026-11-24). promoteBackupEndpoint only swaps the first
 * two, so a custom RPC added third could never become the one the
 * wallet actually uses — "Use this one" in the Networks screen calls
 * this instead. False when the URL is not in the chain's list; a
 * no-op (still true) when it is already first.
 */
export function makePrimaryEndpoint(
  chain: ChainId,
  url: string,
  storage?: RpcOverrideStorage,
): boolean {
  const current = resolveRpcEndpoints(chain, storage);
  if (!current.includes(url)) return false;
  if (current[0] === url) return true;
  const next = [url, ...current.filter((entry) => entry !== url)];
  return persistRpcEndpoints(chain, next, storage);
}

/**
 * Well-known public RPCs the owner can add in one tap (Lane F,
 * FIX-ALL, 2026-11-24). Both are keyless, no-registration ETH
 * gateways, verified live from gray-pinee 2026-11-24 (eth_chainId
 * returns 0x1, eth_blockNumber returns the live tip):
 * - Flashbots Protect RPC (https://rpc.flashbots.net)
 * - dRPC public (https://eth.drpc.org)
 *
 * Rejected live the same day, do not re-add without fresh evidence:
 * - LlamaRPC (https://eth.llamarpc.com): HTTP 525 from this egress,
 *   twice.
 * - Ankr public (https://rpc.ankr.com/eth): now keyed — "You must
 *   authenticate your request with an API key".
 * - Cloudflare (https://cloudflare-eth.com): answers eth_chainId but
 *   refuses eth_blockNumber (-32046 "Cannot fulfill request").
 * - 1rpc.io/aurora is a registry backup, not a suggestion: it answers
 *   -32001 "usage limit" (2026-11-24, twice) — see Lane A.
 *
 * Each suggestion's origin is pinned in the CSP connect-src
 * (security-headers.ts) and guarded by the drift test there: the
 * browser refuses any fetch to an origin outside that list, so a
 * custom RPC outside it could be stored but never used.
 */
export const SUGGESTED_CUSTOM_RPCS: readonly {
  chain: ChainId;
  label: string;
  url: string;
}[] = [
  { chain: 'eth', label: 'Flashbots', url: 'https://rpc.flashbots.net' },
  { chain: 'eth', label: 'dRPC', url: 'https://eth.drpc.org' },
];

/**
 * Whether a custom RPC URL could actually be used by the browser
 * (Lane F, FIX-ALL). The app's CSP connect-src is a static allowlist
 * baked into the built index.html at build time — it cannot learn a
 * new host at runtime — so a URL whose origin is neither a registry
 * endpoint nor a suggested public RPC would be stored, listed, and
 * then refused on every fetch. The Networks screen rejects those
 * with a plain message instead of storing a dead entry. The
 * allowlist itself is guarded in security-headers.test.ts (every
 * registry origin + every suggestion origin must be in connect-src).
 */
export function isCustomRpcOriginUsable(url: string): boolean {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  for (const chain of SUPPORTED_CHAINS) {
    for (const endpoint of CHAINS[chain].rpcEndpoints) {
      if (new URL(endpoint).origin === origin) return true;
    }
  }
  return SUGGESTED_CUSTOM_RPCS.some(
    (suggestion) => new URL(suggestion.url).origin === origin,
  );
}

/** Promotes the backup for every managed chain that has one. Returns the chains changed. */
export function promoteBackupEndpointsAll(
  storage?: RpcOverrideStorage,
): ChainId[] {
  const changed: ChainId[] = [];
  for (const chain of RPC_MANAGED_CHAINS) {
    if (promoteBackupEndpoint(chain, storage)) changed.push(chain);
  }
  return changed;
}

export function resetRpcEndpoints(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): void {
  const overrides = readStoredOverrides(storage);
  delete overrides[chain];
  writeStoredOverrides(overrides, storage);
}

export function resetAllRpcEndpoints(storage?: RpcOverrideStorage): void {
  const store = storage ?? defaultStorage();
  if (store === undefined) return;
  try {
    store.removeItem(RPC_OVERRIDES_KEY);
  } catch {
    // Ignore: the defaults apply when the key cannot be read anyway.
  }
}

/** The hostname of an endpoint URL, for display; the raw string when unparseable. */
export function rpcEndpointHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
