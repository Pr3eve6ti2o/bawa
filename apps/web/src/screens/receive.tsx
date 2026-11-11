import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { Card, CardContent } from '../ui/components/card';

const CHAINS = ['btc', 'eth', 'trx'] as const;

export function ReceiveScreen() {
  const { addresses, selectedChain, setSelectedChain } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');
  const address = addresses[selectedChain].find((entry) => entry.index === 0)?.address;

  async function copyAddress() {
    if (!address) return;
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Receive</h1>

      <div role="group" aria-label="Receiving chain" className="flex flex-wrap gap-2">
        {CHAINS.map((chain) => (
          <Button
            key={chain}
            type="button"
            variant={selectedChain === chain ? 'default' : 'outline'}
            aria-pressed={selectedChain === chain}
            onClick={() => {
              setCopyStatus('');
              setSelectedChain(chain);
            }}
          >
            {chain.toUpperCase()}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {address ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG
                  value={address}
                  size={192}
                  marginSize={4}
                  title={`${selectedChain.toUpperCase()} receiving address`}
                />
              </div>
              <p className="w-full break-all text-center font-mono text-sm">{address}</p>
              <Button type="button" onClick={() => void copyAddress()}>
                Copy address
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p>No receiving address available for this chain.</p>
              <Link to="/import-wallet" className="font-medium underline underline-offset-4">
                Import wallet
              </Link>
            </div>
          )}
          <p role="status" className="text-center text-sm text-muted-foreground">
            {copyStatus}
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Only share this address to receive funds. Verify the address matches the one your
        repo tools derive before accepting funds.
      </p>
    </main>
  );
}
