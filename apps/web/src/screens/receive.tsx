import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';

const CHAINS = ['btc', 'eth', 'trx', 'ton'] as const;

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Receive</h1>

      <div role="group" aria-label="Receiving chain" className="flex flex-wrap gap-2">
        {CHAINS.map((chain) => (
          <button
            key={chain}
            type="button"
            aria-pressed={selectedChain === chain}
            onClick={() => {
              setCopyStatus('');
              setSelectedChain(chain);
            }}
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
              selectedChain === chain
                ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
                : 'border border-white/10 bg-[#263451] text-[#aab5d1] hover:text-white'
            }`}
          >
            {chain.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-6 text-white">
        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[20px] bg-white p-4">
              <QRCodeSVG
                value={address}
                size={192}
                marginSize={4}
                title={`${selectedChain.toUpperCase()} receiving address`}
              />
            </div>
            <p className="w-full break-all text-center font-mono text-sm text-[#eff2fc]">{address}</p>
            <Button type="button" onClick={() => void copyAddress()}>
              Copy address
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[#eff2fc]">No receiving address available for this chain.</p>
            <Link to="/import-wallet" className="font-medium text-[#b4aaff] underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        )}
        <p role="status" className="mt-4 text-center text-sm text-[#aab5d1]">
          {copyStatus}
        </p>
      </div>

      {selectedChain === 'ton' && (
        <p className="text-sm text-muted-foreground">
          This address can only receive. Withdrawing TON needs an external GUI wallet or
          the @ton/ton expert-assisted route — see docs/05-watch-only/GUI-WATCH-ONLY-WORKFLOW.md.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Only share this address to receive funds. Verify the address matches the one your
        repo tools derive before accepting funds.
      </p>
    </div>
  );
}
