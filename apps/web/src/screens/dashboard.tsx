import { Link } from 'react-router';
import { toast } from 'sonner';
import { useWallet } from '../state/wallet-context';
import { DEMO_ASSETS, DEMO_PORTFOLIO } from '../state/demo-fixtures';
import { Button } from '../ui/components/button';

const CHAINS = [
  { id: 'btc', name: 'Bitcoin' },
  { id: 'eth', name: 'Ethereum' },
  { id: 'trx', name: 'TRON' },
  { id: 'ton', name: 'TON' },
] as const;

const ACTIONS = [
  { to: '/send', letter: 'S', label: 'Send' },
  { to: '/receive', letter: 'R', label: 'Receive' },
  { to: '/transactions', letter: 'A', label: 'Activity' },
  { to: '/import-wallet', letter: 'I', label: 'Import' },
] as const;

async function copyAddress(address: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard.');
  } catch {
    toast.error('Could not copy the address. Please copy it manually.');
  }
}

/**
 * Panel home — Phantom structure, Bawa Balanced tokens.
 * Balance first, four circular action tiles, divider asset list.
 * Demo figures are testnet fixtures, labelled as such.
 */
export function DashboardScreen() {
  const { xpubs, addresses, locked, unlock } = useWallet();
  const importedChains = CHAINS.filter(({ id }) => xpubs[id] !== null);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Portfolio</h1>

      <div className="space-y-1 pt-1">
        <p className="text-[13px] font-medium text-[#aab5d1]">Portfolio balance</p>
        <p className="text-4xl font-bold tracking-tight text-white">
          {DEMO_PORTFOLIO.total}
        </p>
        <p className="text-[13px] font-semibold text-[#7bd6ad]">
          &#8599; {DEMO_PORTFOLIO.change}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ to, letter, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-xl font-bold text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
              {letter}
            </span>
            <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
          </Link>
        ))}
      </div>

      <section aria-label="Assets">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Assets</h2>
          <span className="flex h-[30px] items-center rounded-[14px] bg-[#293654] px-3 text-[10px] font-semibold text-[#c8d0e8]">
            All chains
          </span>
        </div>

        <ul className="mt-1 divide-y divide-white/10">
          {DEMO_ASSETS.map(({ id, name, amount, value, network, chip }) => (
            <li key={id}>
              <Link
                to={`/assets/${id}`}
                className="flex items-center gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-[#19223a]"
                  style={{ backgroundColor: chip }}
                >
                  {name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#eff2fc]">
                    {name}
                  </span>
                  <span className="block text-xs text-[#9da9c7]">{network}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-[#eff2fc]">
                    {amount}
                  </span>
                  <span className="block text-xs text-[#aab5d1]">{value}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex h-11 items-center justify-between rounded-[12px] bg-[#243454] px-4">
        <p className="text-xs font-semibold text-[#c8d5f0]">Testnet status</p>
        <span className="flex h-6 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
          ACTIVE
        </span>
      </div>

      <p className="text-center text-xs text-[#aab5d1]">
        Demo portfolio — testnet fixture figures from the Bawa UI catalogue,
        not live balances.
      </p>

      {locked ? (
        <div className="space-y-4 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            Locked — derived addresses are hidden until you unlock.
          </p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </div>
      ) : importedChains.length === 0 ? (
        <div className="space-y-3 rounded-[20px] bg-[#243454] p-5">
          <p className="text-sm text-[#eff2fc]">
            No wallets yet — import a watch-only wallet to see its addresses.
          </p>
          <Link
            to="/import-wallet"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Import wallet
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {importedChains.map(({ id, name }) => {
            const chainAddresses = addresses[id];
            const firstAddress = chainAddresses.find(({ index }) => index === 0);

            return (
              <div key={id} className="space-y-3 rounded-[20px] bg-[#243454] p-5">
                <h2 className="text-base font-bold text-white">{name}</h2>
                <p className="text-sm text-[#aab5d1]">
                  {id === 'ton'
                    ? '1 imported address'
                    : `${chainAddresses.length} derived${' '}${chainAddresses.length === 1 ? 'address' : 'addresses'}`}
                </p>

                {firstAddress ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#eff2fc]">
                      {id === 'ton' ? 'Imported address (watch-only)' : 'First derived address (index 0)'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="min-w-0 flex-1 break-all text-sm text-[#eff2fc]">
                        {firstAddress.address}
                      </code>
                      <Button
                        type="button"
                        aria-label={`Copy ${name} address at index 0`}
                        onClick={() => void copyAddress(firstAddress.address)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#aab5d1]">
                    No derived address at index 0 is available yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-[#aab5d1]">
          This starter derives addresses only; it does not fetch balances,
          prices or history. The figures above are labelled demo fixtures.
        </p>
      </div>
    </div>
  );
}
