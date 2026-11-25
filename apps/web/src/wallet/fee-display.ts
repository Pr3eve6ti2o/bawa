// Fee display — Lane 6 (UX-major programme, 2026-11-26).
//
// Pure helper for the Send details step (and any screen showing a
// network fee). The adapters do NOT all quote the same kind of thing,
// and the old screen rendered the wrong shape for most chains:
//   - EVM native/token: gasPrice x 21000 / x 100000, unit 'wei' — a
//     flat amount in the native coin.
//   - Solana: 5,000 lamports per signature, unit 'lamports' — flat.
//   - TRON token sends: energy fee x 65000, unit 'sun' — a flat
//     upper bound in SUN.
//   - Bitcoin / Litecoin / Dogecoin: a RATE in sat/vB, unit 'sat/vB'
//     — formatting it as an amount ("12 BTC") would be wrong by
//     orders of magnitude; the final fee depends on tx size.
//   - TRON native: the energy fee itself, unit 'SUN per unit of
//     energy' — a rate, not a flat fee.
//   - TON token sends: feeUnknown — the fee is charged at broadcast
//     and is not known in advance; only the note explains it.
//
// This helper sorts those into amount / rate / unknown so the screen
// never formats a rate as an amount. It invents nothing: every figure
// comes from the adapter quote the caller passes in.
export type FeeDisplay =
  | { kind: 'amount'; feeBaseUnits: string }
  | { kind: 'rate'; rateText: string }
  | { kind: 'unknown' };

export function describeFeeEstimate(input: {
  unit: string;
  feeBaseUnits: string;
  feeUnknown?: boolean;
}): FeeDisplay {
  if (input.feeUnknown === true) return { kind: 'unknown' };
  if (
    input.unit === 'sat/vB' ||
    input.unit.toLowerCase().includes('energy')
  ) {
    return { kind: 'rate', rateText: `${input.feeBaseUnits} ${input.unit}` };
  }
  return { kind: 'amount', feeBaseUnits: input.feeBaseUnits };
}
