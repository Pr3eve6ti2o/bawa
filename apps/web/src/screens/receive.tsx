import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/format';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';

export function ReceiveScreen() {
  const { addresses, vaultAddresses, selectedChain, setSelectedChain } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');
  const [amount, setAmount] = useState('');

  const chains = availableFor('receive');
  const chain = chains.includes(selectedChain) ? selectedChain : chains[0];

  const vaultAddress = chain ? vaultAddresses[chain][0] : undefined;
  const watchAddress = chain
    ? addresses[chain].find((entry) => entry.index === 0)?.address
    : undefined;
  const address = vaultAddress ?? watchAddress;
  const isWatchOnly = address !== undefined && vaultAddress === undefined;

  const amountError =
    amount.trim() === ''
      ? null
      : decimalToBaseUnits(amount, chain ? CHAIN_DECIMALS[chain] : 18) === null
        ? 'Enter a valid amount.'
        : null;

  // Payment-request URI (BlueWallet ReceiveDetails pattern). BTC uses a
  // BIP-21 amount; ETH encodes the value in wei. TRX and TON have no
  // standard payment URI here, so the QR stays the plain address and the
  // amount is shown as text beside it.
  const qrValue = (() => {
    if (!address || !chain || amountError) return address ?? '';
    const trimmed = amount.trim();
    if (trimmed === '') return address;
    if (chain === 'btc') return `bitcoin:${address}?amount=${trimmed}`;
    if (chain === 'eth') {
      const wei = decimalToBaseUnits(trimmed, CHAIN_DECIMALS.eth);
      return wei === null ? address : `ethereum:${address}?value=${wei}`;
    }
    return address;
  })();

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

  async function shareAddress() {
    if (!address) return;
    setCopyStatus('');
    if (navigator.share) {
      try {
        await navigator.share({ text: qrValue });
        setCopyStatus('Shared.');
        return;
      } catch (error: unknown) {
        // A cancelled share sheet is not an error; fall through to copy.
        if ((error as Error | undefined)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to share or copy. Please copy the address manually.');
    }
  }

  if (!chain) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Receive</h1>
        <p className="text-sm text-muted-foreground">
          Receive is unavailable — no receive adapter is verified yet.
        </p>
      </div>
    );
  }

  const config = chainConfig(chain);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Receive</h1>

      <div role="group" aria-label="Receiving chain" className="flex flex-wrap gap-2">
        {chains.map((available) => (
          <button
            key={available}
            type="button"
            aria-pressed={chain === available}
            onClick={() => {
              setCopyStatus('');
              setAmount('');
              setSelectedChain(available);
            }}
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
              chain === available
                ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
                : 'border border-white/10 bg-[#263451] text-[#aab5d1] hover:text-white'
            }`}
          >
            {chainConfig(available).symbol}
          </button>
        ))}
      </div>

      {isWatchOnly && (
        <Alert>
          <AlertDescription>
            Watch-only account — this address can receive, but this wallet
            cannot sign or send from it.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-6 text-white">
        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[20px] bg-white p-4">
              <QRCodeSVG
                value={qrValue}
                size={192}
                marginSize={4}
                title={`${config.symbol} receiving address`}
              />
            </div>
            <p className="w-full break-all text-center font-mono text-sm text-[#eff2fc]">{address}</p>
            {(chain === 'trx' || chain === 'ton') && amount.trim() !== '' && !amountError && (
              <p className="text-sm text-[#aab5d1]">
                Requested amount: {amount.trim()} {config.symbol} (shown as text — the QR
                encodes the address only).
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => void copyAddress()}>
                Copy address
              </Button>
              <Button type="button" variant="outline" onClick={() => void shareAddress()}>
                Share
              </Button>
            </div>
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

      <div className="space-y-1">
        <label htmlFor="receive-amount" className="text-sm font-medium">
          Amount (optional) — {config.symbol}
        </label>
        <input
          id="receive-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={`0.0 ${config.symbol}`}
          className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
        />
        {amountError ? (
          <p role="alert" className="text-sm text-red-500">{amountError}</p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Mainnet only — this is a {config.displayName} mainnet address. Funds
        sent on another network cannot be recovered.
      </p>

      {chain === 'ton' && (
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
