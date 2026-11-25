import { Link } from 'react-router';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import type { ChainId } from '../engine/boundary';
import { chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import type { AdapterTx } from '../wallet/adapters/types';

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Lane 2: shorten a hash or address for the row. Short values (the
 * test hashes, a short counterparty) render whole; a real 66-char
 * hash renders as its recognisable head + tail ("0x3f9a21c4…8d2e91").
 * The full hash is never lost: the row links to the detail screen,
 * which shows it whole with a Copy button.
 */
function shorten(value: string): string {
  return value.length <= 13 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function statusWord(tx: AdapterTx): string {
  if (tx.status === 'failed') return 'Failed';
  if (tx.status === 'pending') return 'Pending';
  return 'Confirmed';
}

/**
 * One transaction row (Fix-all Lane H, item 12: jscpd family A). The
 * asset-detail history list and the transaction-history list rendered
 * the same <li> — direction, amount, hash, date/status — and differed
 * only in which chain the amount/symbol came from, whether the chain
 * symbol showed beside the direction, and how the date was formatted
 * (asset-detail formatted inline; transaction-history had formatDate —
 * the same en-GB format, now shared here).
 *
 * Lane 2 (redesign): progressive disclosure, Bitget pattern — the row
 * shows what a user scans for (direction, counterparty, amount,
 * status, time) and the technical identifier stays one tap away. The
 * old row led with the FULL hash in break-all mono, 2–3 lines tall,
 * so the row was mostly hash. Now: a direction tile, then direction +
 * counterparty (shortened; the short hash when there is no
 * counterparty) on the left, amount + date/status on the right. No
 * fiat per tx: there is no historical-price source, and valuing a past
 * transaction at today's price would invent its value (recorded in
 * LANE2-AUDIT.md as a deviation from DESIGN-SYSTEM §6).
 */
export function TxRow({
  tx,
  chain,
  showChainSymbol = false,
  className,
}: {
  tx: AdapterTx;
  chain: ChainId;
  showChainSymbol?: boolean;
  /**
   * Lane 2: the row's outer shape. Default is the standalone bordered
   * row (asset detail + transaction history). RecentActivity passes
   * its own padding and no border — its list already provides the
   * card + dividers.
   */
  className?: string;
}) {
  const symbol = chainConfig(chain).symbol;
  const DirectionIcon =
    tx.direction === 'in'
      ? ArrowDownLeft
      : tx.direction === 'out'
        ? ArrowUpRight
        : ArrowLeftRight;
  const directionLabel =
    tx.direction === 'in'
      ? 'Received'
      : tx.direction === 'out'
        ? 'Sent'
        : 'Self transfer';
  const secondLine =
    tx.counterparty !== null && tx.counterparty !== ''
      ? `${tx.direction === 'in' ? 'From ' : tx.direction === 'out' ? 'To ' : ''}${shorten(tx.counterparty)}`
      : shorten(tx.hash);
  const dateLine =
    tx.timestamp === null
      ? 'Pending'
      : `${formatDate(tx.timestamp)} · ${statusWord(tx)}`;

  return (
    <li className={className ?? 'rounded-lg border p-3'}>
      <Link
        to={`/transactions/${tx.hash}`}
        className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper"
        >
          <DirectionIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {directionLabel}
            {showChainSymbol ? (
              <>
                {' · '}
                {symbol}
              </>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
            {secondLine}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold">
            {formatNativeWithSymbol(tx.amountBaseUnits, CHAIN_DECIMALS[chain], symbol)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {dateLine}
          </span>
        </span>
      </Link>
    </li>
  );
}
