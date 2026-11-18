import { useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowDownToLine, Send, Wallet } from 'lucide-react';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { AssetRows } from './asset-rows';

const ACTIONS = [
  { to: '/send', icon: Send, label: 'Send' },
  { to: '/receive', icon: ArrowDownToLine, label: 'Receive' },
  { to: '/transactions', icon: Activity, label: 'Activity' },
  { to: '/import-wallet', icon: Wallet, label: 'Import' },
] as const;

/**
 * Panel home — real balances only. There is no price feed in this lane, so
 * no fiat portfolio total is shown (and none is fabricated): the hero states
 * that plainly. Asset rows come from the verified balance adapters.
 */
export function DashboardScreen() {
  const { locked, unlock, vaultState, refreshBalances } = useWallet();
  const [hideZero, setHideZero] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Portfolio</h1>

      <div className="space-y-1 pt-1">
        <p className="text-[13px] font-medium text-[#aab5d1]">Portfolio balance</p>
        <p className="text-2xl font-bold tracking-tight text-white">Unavailable</p>
        <p className="text-[13px] text-[#aab5d1]">
          No price feed connected — portfolio total unavailable. Balances below
          are exact native amounts from the mainnet adapters.
        </p>
        <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
          Refresh balances
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
          </Link>
        ))}
      </div>

      <section aria-label="Assets">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Assets</h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(event) => setHideZero(event.target.checked)}
            />
            Hide zero balances
          </label>
        </div>
        <AssetRows hideZero={hideZero} />
      </section>

      {locked ? (
        <div className="space-y-4 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Locked — derived addresses are hidden until you unlock.
          </p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </div>
      ) : vaultState === 'locked' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Vault locked — your vault addresses are hidden until you unlock.
          </p>
          <Link
            to="/security"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Unlock in Security
          </Link>
        </div>
      ) : vaultState === 'no-vault' ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            No wallet yet — create a wallet or import one to see its balances.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create-wallet"
              className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
            >
              Create wallet
            </Link>
            <Link
              to="/import-wallet"
              className="inline-block rounded-full border border-white/10 bg-[#263451] px-4 py-2 text-sm font-semibold text-[#eff2fc]"
            >
              Import wallet
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
