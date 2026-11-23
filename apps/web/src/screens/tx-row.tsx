import { Link } from 'react-router';
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
 * One transaction row (Fix-all Lane H, item 12: jscpd family A). The
 * asset-detail history list and the transaction-history list rendered
 * the same <li> — direction, amount, hash, date/status — and differed
 * only in which chain the amount/symbol came from, whether the chain
 * symbol showed beside the direction, and how the date was formatted
 * (asset-detail formatted inline; transaction-history had formatDate —
 * the same en-GB format, now shared here).
 */
export function TxRow({
  tx,
  chain,
  showChainSymbol = false,
}: {
  tx: AdapterTx;
  chain: ChainId;
  showChainSymbol?: boolean;
}) {
  const symbol = chainConfig(chain).symbol;
  return (
    <li className="rounded-lg border p-3">
      <Link
        to={`/transactions/${tx.hash}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {tx.direction === 'in'
              ? 'Received'
              : tx.direction === 'out'
                ? 'Sent'
                : 'Self transfer'}
            {showChainSymbol ? (
              <>
                {' · '}
                {symbol}
              </>
            ) : null}
          </span>
          {' '}
          <span className="text-sm font-semibold">
            {formatNativeWithSymbol(tx.amountBaseUnits, CHAIN_DECIMALS[chain], symbol)}
          </span>
        </span>
        <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
          {tx.hash}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {tx.timestamp === null ? 'Pending' : formatDate(tx.timestamp)}
          {tx.status === 'failed' ? ' · Failed' : tx.status === 'pending' ? ' · Pending' : ''}
        </span>
      </Link>
    </li>
  );
}
