import { Link } from 'react-router';
import { toast } from 'sonner';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';

const CHAINS = [
  { id: 'btc', name: 'Bitcoin' },
  { id: 'eth', name: 'Ethereum' },
  { id: 'trx', name: 'TRON' },
] as const;

async function copyAddress(address: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard.');
  } catch {
    toast.error('Could not copy the address. Please copy it manually.');
  }
}

export function DashboardScreen() {
  const { xpubs, addresses, locked, unlock } = useWallet();
  const importedChains = CHAINS.filter(({ id }) => xpubs[id] !== null);

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>

      {locked ? (
        <Card className="space-y-4 p-6">
          <p>Locked — derived addresses are hidden until you unlock.</p>
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </Card>
      ) : importedChains.length === 0 ? (
        <Card className="space-y-4 p-6">
          <p>No wallets yet — import an extended public key to see derived addresses.</p>
          <Link
            to="/import-wallet"
            className="inline-block font-medium underline underline-offset-4"
          >
            Import wallet
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {importedChains.map(({ id, name }) => {
            const chainAddresses = addresses[id];
            const firstAddress = chainAddresses.find(({ index }) => index === 0);

            return (
              <Card key={id} className="min-w-0 space-y-4 p-6">
                <h2 className="text-xl font-semibold">{name}</h2>
                <p className="text-sm text-muted-foreground">
                  {chainAddresses.length} derived{' '}
                  {chainAddresses.length === 1 ? 'address' : 'addresses'}
                </p>

                {firstAddress ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      First derived address (index 0)
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="min-w-0 flex-1 break-all text-sm">
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
                  <p className="text-sm text-muted-foreground">
                    No derived address at index 0 is available yet.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Balances are unavailable — no provider is selected. This starter derives
          addresses only; it does not fetch balances, prices or history.
        </p>
      </Card>
    </main>
  );
}
