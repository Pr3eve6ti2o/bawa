import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { DEMO_ASSETS, DEMO_PORTFOLIO } from '../state/demo-fixtures';

const CHAINS = [
  { id: 'btc', symbol: 'BTC' },
  { id: 'eth', symbol: 'ETH' },
  { id: 'trx', symbol: 'TRX' },
  { id: 'ton', symbol: 'TON' },
] as const;

export function AssetListScreen() {
  const { xpubs, addresses } = useWallet();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Assets</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#243454] px-5 py-4 text-white">
        <div>
          <p className="text-xs text-[#aab5d1]">Portfolio balance</p>
          <p className="text-2xl font-bold">{DEMO_PORTFOLIO.total}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold text-[#7bd6ad]">
            &#8599; {DEMO_PORTFOLIO.change}
          </p>
          <span className="flex h-[30px] items-center rounded-[14px] bg-[#293654] px-3 text-[10px] font-semibold text-[#c8d0e8]">
            All chains
          </span>
        </div>
      </div>

      <ul className="divide-y divide-white/10">
        {CHAINS.map(({ id, symbol }) => {
          const count = addresses[id].length;
          const demo = DEMO_ASSETS.find((asset) => asset.id === id);
          const detail =
            id === 'ton'
              ? xpubs[id]
                ? '1 imported address'
                : 'Not imported'
              : xpubs[id]
                ? `${count} derived ${count === 1 ? 'address' : 'addresses'} · ${demo?.network ?? ''}`
                : `${demo?.network ?? ''} · Demo fixture`;

          return (
            <li key={id}>
              <Link
                to={`/assets/${id}`}
                className="flex items-center gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-[#19223a]"
                  style={{ backgroundColor: demo?.chip ?? '#9daeff' }}
                >
                  {symbol.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#eff2fc]">
                    {demo?.name ?? symbol}
                  </span>
                  <span className="block text-xs text-[#9da9c7]">{detail}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-[#eff2fc]">
                    {demo?.amount ?? '—'}
                  </span>
                  <span className="block text-xs text-[#aab5d1]">
                    {demo?.value ?? '—'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-[#aab5d1]">
        Demo figures — the starter derives addresses only; it does not fetch
        live balances. TON is watch-only only in this starter: import a public
        address; it cannot send.
      </p>
    </div>
  );
}
