import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { AssetRow } from '../ui/components/asset-row';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';

export const CHAIN_CHIP_COLORS: Record<string, string> = {
  btc: '#f7931a',
  eth: '#627eea',
  trx: '#eb0029',
  ton: '#0098ea',
};

/**
 * Real-balance asset rows, shared by the dashboard and the asset list.
 * A row appears only for a chain whose balance capability is verified
 * (availableFor('balance')). No price feed exists in this lane, so rows
 * show the native token balance only — never a fiat value or a fabricated
 * number. A failed fetch shows "unavailable", never zero.
 */
export function AssetRows({ hideZero }: { hideZero: boolean }) {
  const { balances, refreshBalances, vaultState, vaultAddresses, addresses } =
    useWallet();
  const chains = availableFor('balance');

  if (chains.length === 0) {
    return <p className="text-sm text-[#aab5d1]">No balance adapters verified yet.</p>;
  }

  const visible = chains.filter((chain) => {
    if (!hideZero) return true;
    const balance = balances[chain];
    return balance.status !== 'zero';
  });

  if (visible.length === 0) {
    return (
      <p className="text-sm text-[#aab5d1]">
        All balances are zero — turn off “Hide zero balances” to see them.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/10">
      {visible.map((chain) => {
        const config = chainConfig(chain);
        const balance = balances[chain];
        const avatar = (
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span
              className="flex size-10 items-center justify-center rounded-full text-[11px] font-bold text-[#19223a]"
              style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
            >
              {config.symbol}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-4 items-center rounded-full bg-[#293654] px-1 text-[8px] font-bold text-[#c8d0e8] ring-1 ring-[#19223a]">
              {config.symbol}
            </span>
          </span>
        );

        if (balance.status === 'loading') {
          return (
            <li key={chain} role="status" className="py-3">
              <Skeleton className="h-[68px] w-full" />
              <span className="sr-only">Loading {config.displayName} balance…</span>
            </li>
          );
        }

        if (balance.status === 'unavailable' || balance.status === 'error') {
          // Locked vault, no address for this chain: the balance is not
          // "unavailable", it is hidden until unlock. Say so honestly and
          // hide Retry (it cannot fetch without an address). A locked vault
          // WITH a watch-only address still shows the real failure + Retry.
          const hasAddress =
            (vaultAddresses?.[chain]?.length ?? 0) > 0 ||
            (addresses?.[chain]?.length ?? 0) > 0;
          const lockedNoAddress =
            vaultState === 'locked' &&
            !hasAddress &&
            balance.status === 'unavailable';
          return (
            <li key={chain} className="flex items-center gap-3 py-4">
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#eff2fc]">
                  {config.displayName}
                </span>
                <span className="block text-xs text-[#9da9c7]">
                  {lockedNoAddress
                    ? 'Unlock your wallet to see balances'
                    : balance.status === 'unavailable'
                      ? 'Balance unavailable'
                      : 'Could not load balance'}
                </span>
              </span>
              {!lockedNoAddress && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshBalances()}
                >
                  Retry
                </Button>
              )}
            </li>
          );
        }

        const value =
          balance.value === undefined
            ? '0'
            : formatNativeWithSymbol(
                balance.value,
                CHAIN_DECIMALS[chain],
                config.symbol,
              );
        return (
          <li key={chain}>
            <Link
              to={`/assets/${chain}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
            >
              <AssetRow
                avatar={avatar}
                symbol={config.displayName}
                amount={`${config.symbol} · ${config.displayName} mainnet`}
                value={value}
                detail={balance.status === 'zero' ? 'Zero balance' : undefined}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
