import { Link, useParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';

export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { history } = useWallet();

  const found = (() => {
    if (!id) return null;
    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      const tx = history[chain].txs.find((candidate) => candidate.hash === id);
      if (tx) return { tx, chain };
    }
    return null;
  })();

  if (!found) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Transaction details
        </h1>

        <div className="space-y-4 rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
          <p className="text-sm leading-relaxed text-[#aab5d1]">
            Transaction not found — it is not in the loaded history.
          </p>
          <dl className="space-y-1">
            <dt className="text-sm font-medium text-[#eff2fc]">Requested ID</dt>
            <dd className="break-all">
              <code className="text-sm text-[#aab5d1]">{id ?? 'No ID supplied'}</code>
            </dd>
          </dl>
        </div>

        <Link
          to="/transactions"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Back to transactions
        </Link>
      </div>
    );
  }

  const { tx, chain } = found;
  const config = chainConfig(chain);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Transaction details
      </h1>

      <div className="space-y-4 rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Chain</dt>
            <dd className="text-sm text-[#aab5d1]">
              {config.displayName} mainnet
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Direction</dt>
            <dd className="text-sm text-[#aab5d1]">
              {tx.direction === 'in'
                ? 'Received'
                : tx.direction === 'out'
                  ? 'Sent'
                  : 'Self transfer'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Amount</dt>
            <dd className="text-sm text-[#aab5d1]">
              {formatNativeWithSymbol(tx.amountBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Counterparty</dt>
            <dd className="break-all text-sm text-[#aab5d1]">
              {tx.counterparty ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Date</dt>
            <dd className="text-sm text-[#aab5d1]">
              {tx.timestamp === null
                ? 'Pending'
                : new Date(tx.timestamp).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Status</dt>
            <dd className="text-sm text-[#aab5d1]">{tx.status}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#eff2fc]">Transaction hash</dt>
            <dd className="break-all">
              <code className="text-sm text-[#aab5d1]">{tx.hash}</code>
            </dd>
          </div>
          {tx.explorerUrl ? (
            <div>
              <dt className="text-sm font-medium text-[#eff2fc]">Explorer</dt>
              <dd>
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-[#b4aaff] underline underline-offset-4"
                >
                  {tx.explorerUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <Link
        to="/transactions"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Back to transactions
      </Link>
    </div>
  );
}
