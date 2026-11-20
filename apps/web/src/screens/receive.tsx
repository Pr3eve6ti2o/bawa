import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/chain-amount-format';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

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
          Receive is not available right now.
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
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              chain === available
                ? 'bg-primary-solid text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {chainConfig(available).symbol}
          </button>
        ))}
      </div>

      <Alert>
        <AlertDescription>
          Send only on the selected network — the sender must use the network you selected, even where addresses look the same.
        </AlertDescription>
      </Alert>

      {isWatchOnly && (
        <Alert>
          <AlertDescription>
            Watch-only account — this address can receive, but this wallet
            cannot sign or send from it.
          </AlertDescription>
        </Alert>
      )}

      {address && (
        <div className="space-y-1">
          <Label htmlFor="receive-amount" className="text-sm font-medium">
            Amount (optional) — {config.symbol}
          </Label>
          <Input
            id="receive-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={`0.0 ${config.symbol}`}
            className="h-12"
          />
          {amountError ? (
            <p role="alert" className="text-sm text-destructive">{amountError}</p>
          ) : null}
        </div>
      )}

      <Card className="rounded-xl border-border bg-card p-6 text-foreground">
        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              {/* Keep the white QR surround for scannability, including in dark mode. */}
              <div className="shrink-0 rounded-[20px] bg-white p-4">
                <QRCodeSVG
                  value={qrValue}
                  size={192}
                  marginSize={4}
                  title={`${config.symbol} receiving address`}
                />
              </div>
              {(chain === 'trx' || chain === 'ton') && amount.trim() !== '' && !amountError && (
                <p className="text-sm text-muted-foreground">
                  Requested amount: {amount.trim()} {config.symbol} (shown as text — the QR
                  encodes the address only).
                </p>
              )}
            </div>
            <p className="w-full break-all text-center font-mono text-sm text-foreground">{address}</p>
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
            <p className="text-foreground">No receiving address available for this chain.</p>
            <Link to="/import-wallet" className="font-medium text-primary underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        )}
        <p role="status" className="mt-4 text-center text-sm text-muted-foreground">
          {copyStatus}
        </p>
      </Card>

      <p className="text-sm text-muted-foreground">
        Mainnet only — this address is for the {config.displayName} mainnet. Funds sent on another network cannot be recovered.
      </p>

      {chain === 'ton' && (
        <p className="text-sm text-muted-foreground">
          This address can only receive TON. To send or withdraw TON, you need an external wallet.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Only share this address to receive funds. Check the address carefully before accepting funds.
      </p>
    </div>
  );
}
