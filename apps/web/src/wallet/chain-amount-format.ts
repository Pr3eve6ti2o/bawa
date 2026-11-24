import type { ChainId } from '../engine/boundary';

export const CHAIN_DECIMALS: Record<ChainId, number> = {
  btc: 8,
  eth: 18,
  trx: 6,
  ton: 9,
  sol: 9,
  bsc: 18,
  matic: 18,
  arb: 18,
  op: 18,
  base: 18,
  avax: 18,
  ltc: 8,
  doge: 8,
  gnosis: 18,
  celo: 18,
  linea: 18,
  mantle: 18,
  scroll: 18,
  opbnb: 18,
  metis: 18,
  aurora: 18,
  fantom: 18,
  zksync: 18,
  cronos: 18,
  kava: 18,
  filecoin: 18,
  zora: 18,
  mode: 18,
  fraxtal: 18,
  berachain: 18,
  sei: 18,
  arbnova: 18,
  worldchain: 18,
  manta: 18,
  unichain: 18,
  ink: 18,
  abstract: 18,
  soneium: 18,
  apechain: 18,
  sonic: 18,
  hyperevm: 18,
  monad: 18,
  ronin: 18,
  immutable: 18,
  fuse: 18,
  velas: 18,
  syscoin: 18,
  theta: 18,
  iotex: 18,
  xlayer: 18,
  boba: 18,
  taiko: 18,
  astar: 18,
  telos: 18,
  conflux: 18,
  core: 18,
  songbird: 18,
  rootstock: 18,
  pulsechain: 18,
  xdc: 18,
  chiliz: 18,
  etc: 18,
  flare: 18,
  zetachain: 18,
  hemi: 18,
  bob: 18,
  flowevm: 18,
  cosmos: 6,
  osmosis: 6,
  xrp: 6,
  stellar: 7,
  polkadot: 10,
  near: 24,
  aptos: 8,
  tezos: 6,
  algorand: 6,
  hedera: 8,
  injective: 18,
  celestia: 6,
  dydx: 18,
  seicosmos: 6,
  axelar: 6,
  noble: 6,
  juno: 6,
};

/**
 * Formats a smallest-unit integer string as a decimal amount, exactly
 * (no floats, no rounding). Groups the integer part in thousands and trims
 * trailing zeros from the fraction. Throws on non-integer or negative input.
 */
export function formatNativeAmount(
  valueBaseUnits: string,
  decimals: number,
): string {
  if (!/^\d+$/.test(valueBaseUnits)) {
    throw new Error('Invalid amount: expected a non-negative integer string.');
  }
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error('Invalid amount: decimals must be a non-negative integer.');
  }
  const digits = valueBaseUnits.replace(/^0+(?=\d)/, '');
  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals) || '0';
  const fractionPart = decimals === 0 ? '' : padded.slice(padded.length - decimals);
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  return trimmedFraction === '' ? grouped : `${grouped}.${trimmedFraction}`;
}

export function formatNativeWithSymbol(
  valueBaseUnits: string,
  decimals: number,
  symbol: string,
): string {
  return `${formatNativeAmount(valueBaseUnits, decimals)} ${symbol}`;
}

/**
 * Convert a human decimal amount (e.g. "1.5") into smallest units
 * ("1500000000000000000" at 18 decimals). Returns null for an invalid
 * amount or one with more fraction digits than the chain supports.
 */
export function decimalToBaseUnits(amount: string, decimals: number): string | null {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) return null;
  const combined = (whole + fraction.padEnd(decimals, '0')).replace(/^0+(?=\d)/, '');
  return combined === '' ? '0' : combined;
}
