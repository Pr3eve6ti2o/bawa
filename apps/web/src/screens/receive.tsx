import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig, type ChainId } from '../wallet/chains';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/chain-amount-format';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { TokenLogo } from './token-logo';

export function ReceiveScreen() {
  const { addresses, vaultAddresses, selectedChain, setSelectedChain } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');
  const [amount, setAmount] = useState('');

  const chains = availableFor('receive');
  const chain = chains.includes(selectedChain) ? selectedChain : chains[0];

  // One address per network (Phase 2, Lane D — Phantom/OKX pattern): the
  // vault address first, falling back to the watch-only imported address
  // for that chain, exactly as the single-chain view did before.
  function addressFor(candidate: ChainId): {
    address: string | undefined;
    watchOnly: boolean;
  } {
    const vault = vaultAddresses[candidate][0];
    if (vault) return { address: vault, watchOnly: false };
    const watched = addresses[candidate].find((entry) => entry.index === 0)?.address;
    return watched ? { address: watched, watchOnly: true } : { address: undefined, watchOnly: false };
  }

  function selectChain(next: ChainId): void {
    setCopyStatus('');
    setAmount('');
    setSelectedChain(next);
  }

  async function copyAddressFor(candidate: ChainId): Promise<void> {
    const entry = addressFor(candidate);
    if (!entry.address) return;
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(entry.address);
      setCopyStatus(`Copied ${chainConfig(candidate).displayName} address.`);
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

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
          Receive isn't available for this network yet.
        </p>
      </div>
    );
  }

  const config = chainConfig(chain);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Receive</h1>

      <section aria-labelledby="receive-addresses-heading" className="space-y-3">
        <h2 id="receive-addresses-heading" className="text-lg font-semibold">
          Your addresses
        </h2>
        <p className="text-sm text-muted-foreground">
          One address per network. Choose a network to see its QR code.
        </p>
        <ul className="space-y-2">
          {chains.map((available) => {
            const entry = addressFor(available);
            const listConfig = chainConfig(available);
            const selected = available === chain;
            return (
              <li
                key={available}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectChain(available)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TokenLogo symbol={listConfig.symbol} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {listConfig.displayName} · {listConfig.symbol}
                    </span>
                    {entry.address ? (
                      <span className="block break-all font-mono text-sm text-muted-foreground">
                        {entry.address}
                      </span>
                    ) : (
                      <span className="block text-sm text-muted-foreground">No address yet</span>
                    )}
                    {entry.watchOnly && (
                      <span className="block text-sm text-muted-foreground">Watch-only</span>
                    )}
                  </span>
                </button>
                {entry.address && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Copy ${listConfig.displayName} address`}
                    onClick={() => void copyAddressFor(available)}
                  >
                    Copy
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

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
              {/* Paper surround keeps the QR scannable — Ink modules on Paper. */}
              <div className="shrink-0 rounded-bawa-sm border-2 border-ink bg-paper p-4">
                <QRCodeSVG
                  value={qrValue}
                  size={192}
                  marginSize={4}
                  fgColor="#2B2B2B"
                  bgColor="#FFFDF7"
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
        {`Mainnet only — this address is for the ${config.displayName} mainnet. Funds sent on another network cannot be recovered.`}
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
