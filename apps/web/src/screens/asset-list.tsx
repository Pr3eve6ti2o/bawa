import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { AssetRow } from '../ui/components/asset-row';

const CHAINS = [
  { id: 'btc', symbol: 'BTC' },
  { id: 'eth', symbol: 'ETH' },
  { id: 'trx', symbol: 'TRX' },
  { id: 'ton', symbol: 'TON' },
] as const;

export function AssetListScreen() {
  const { xpubs, addresses } = useWallet();

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Assets</h1>

      <ul className="space-y-3">
        {CHAINS.map(({ id, symbol }) => {
          const count = addresses[id].length;
          const detail = xpubs[id]
            ? (id === 'ton' ? '1 imported address' : `${count} derived ${count === 1 ? 'address' : 'addresses'}`)
            : 'Not imported';

          return (
            <li key={id}>
              <Link
                to={`/assets/${id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AssetRow
                  avatar={
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-blue text-body-sm font-bold text-primary">
                      {symbol.slice(0, 1)}
                    </div>
                  }
                  symbol={symbol}
                  amount="—"
                  value="Balance unavailable"
                  detail={detail}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted-foreground">
        TON is watch-only only in this starter: import a public address; it cannot send.
      </p>
    </main>
  );
}
