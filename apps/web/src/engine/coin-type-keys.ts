import type { ChainId, WalletCore } from './boundary';

/**
 * WASM CoinType key per chain (all chains except TON, Kaspa and
 * Starknet, which have no Wallet Core coin mapping in the engine). Shared by coinTypeForChain
 * in boundary.ts and coinForChain in wallet/core.ts (which adds the
 * TON case). The table holds key NAMES only — the CoinType values
 * themselves stay inside boundary.ts, per the facade contract there;
 * callers resolve `core.CoinType[key]` on their own core handle.
 *
 * Merge 1 (Lane B): the 9 extra chains adopt-proper added via the
 * inline coin map in deriveAddress. Repo-study's deriveAddressWithCore
 * helper only mapped btc/eth/trx, so the mappings move here instead
 * of re-adding the inline map. Values verified against HEAD's map.
 *
 * Lane J (perf): this table lives in its own leaf module — a pure
 * record with no engine dependency — so wallet/core can import the
 * key names without importing boundary.ts, which would pull the
 * 2.9 MB engine chunk into the first-paint modulepreload graph.
 * boundary.ts re-exports it, so existing import paths keep working.
 */
export const COIN_TYPE_KEY_FOR_CHAIN: Partial<
  Record<Exclude<ChainId, 'ton'>, keyof WalletCore['CoinType']>
> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  trx: 'tron',
  sol: 'solana',
  bsc: 'smartChain',
  matic: 'polygon',
  arb: 'arbitrum',
  op: 'optimism',
  base: 'base',
  avax: 'avalancheCChain',
  gnosis: 'xdai',
  celo: 'celo',
  linea: 'linea',
  mantle: 'mantle',
  scroll: 'scroll',
  opbnb: 'opBNB',
  metis: 'metis',
  aurora: 'aurora',
  fantom: 'fantom',
  ltc: 'litecoin',
  doge: 'dogecoin',
  zksync: 'zksync',
  cronos: 'cronosChain',
  kava: 'kavaEvm',
  filecoin: 'filecoin',
  zora: 'ethereum',
  mode: 'ethereum',
  fraxtal: 'ethereum',
  berachain: 'ethereum',
  sei: 'seiEVM',
  arbnova: 'arbitrumNova',
  worldchain: 'ethereum',
  manta: 'mantaPacific',
  unichain: 'ethereum',
  ink: 'ethereum',
  abstract: 'ethereum',
  soneium: 'ethereum',
  apechain: 'ethereum',
  sonic: 'sonic',
  hyperevm: 'hyperEVM',
  monad: 'monad',
  ronin: 'ronin',
  immutable: 'ethereum',
  fuse: 'ethereum',
  velas: 'ethereum',
  syscoin: 'ethereum',
  theta: 'thetaFuel',
  iotex: 'ioTeXEVM',
  xlayer: 'ethereum',
  boba: 'boba',
  taiko: 'ethereum',
  astar: 'ethereum',
  telos: 'ethereum',
  conflux: 'confluxeSpace',
  core: 'ethereum',
  songbird: 'ethereum',
  rootstock: 'rootstock',
  pulsechain: 'ethereum',
  xdc: 'ethereum',
  chiliz: 'ethereum',
  etc: 'ethereumClassic',
  flare: 'ethereum',
  zetachain: 'zetaEVM',
  hemi: 'ethereum',
  bob: 'ethereum',
  flowevm: 'ethereum',
  cosmos: 'cosmos',
  osmosis: 'osmosis',
  xrp: 'xrp',
  stellar: 'stellar',
  polkadot: 'polkadot',
  near: 'near',
  aptos: 'aptos',
  tezos: 'tezos',
  algorand: 'algorand',
  hedera: 'hedera',
  injective: 'nativeInjective',
  celestia: 'tia',
  dydx: 'dydx',
  seicosmos: 'sei',
  axelar: 'axelar',
  noble: 'noble',
  juno: 'juno',
  // Lane B (2026-11-25): Cardano is the only one of the three new
  // chains with a Wallet Core 4.9.3 coin. Kaspa and Starknet have no
  // coin, so they have no entry here — the table is Partial and both
  // coinTypeForChain (boundary.ts) and coinForChain (wallet/core.ts)
  // throw for them; their derivation lives in wallet/kaspa-address.ts
  // and wallet/starknet-derive.ts, and core.ts special-cases them
  // before coinForChain. Do NOT map them to 'ethereum': that would
  // make validation and derivation return ETH addresses for them.
  cardano: 'cardano',
};
