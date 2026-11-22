import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig, type ChainId } from '../wallet/chains';
import { devnetChainConfigOrUndefined } from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/chain-amount-format';
import { buildBawaSendLink, buildPaymentUri } from '../wallet/payment-links';
import {
  DEFAULT_TOKENS,
  isVerifiedToken,
  resolveTokenByTickerOrName,
  shortContract,
  type TokenRecord,
} from '../wallet/tokens';
import { AddTokenDialog } from './add-token';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

export function ReceiveScreen() {
  const { addresses, vaultAddresses, selectedChain, setSelectedChain, customTokens, devnetEnabled } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [tokenFilter, setTokenFilter] = useState('');
  const [addTokenOpen, setAddTokenOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement | null>(null);

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

  // Full token list (token gaps, item 2): the defaults plus user-added
  // tokens, on the networks this screen can receive on. Native coins
  // are the network list above; this list is the tokens.
  const allTokens = [...DEFAULT_TOKENS, ...(customTokens ?? [])];
  const visibleTokens = allTokens.filter((token) => chains.includes(token.chain));
  const filter = tokenFilter.trim();
  const matchedKeys = new Set(
    filter === ''
      ? []
      : resolveTokenByTickerOrName(filter, visibleTokens).map(
          (token) => `${token.chain}:${token.contract.toLowerCase()}`,
        ),
  );
  const filteredTokens =
    filter === ''
      ? visibleTokens
      : visibleTokens.filter((token) =>
          matchedKeys.has(`${token.chain}:${token.contract.toLowerCase()}`),
        );

  // The selected asset: a token, or the selected network's native coin.
  const effectiveToken =
    selectedToken !== null && chains.includes(selectedToken.chain) ? selectedToken : null;
  const assetSymbol = effectiveToken?.symbol ?? (chain ? chainConfig(chain).symbol : '');
  const assetDecimals = effectiveToken?.decimals ?? (chain ? CHAIN_DECIMALS[chain] : 18);

  function selectChain(next: ChainId): void {
    setCopyStatus('');
    setAmount('');
    setSelectedToken(null);
    setSelectedChain(next);
  }

  function selectToken(token: TokenRecord): void {
    setCopyStatus('');
    setAmount('');
    setSelectedToken(token);
    setSelectedChain(token.chain);
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
      : decimalToBaseUnits(amount, assetDecimals) === null
        ? 'Enter a valid amount.'
        : null;

  // Payment-request URI (token gaps, item 3 — payment-links.ts): BIP-21
  // for BTC/LTC/DOGE, EIP-681 for EVM natives and ERC-20 transfers,
  // Solana Pay for SOL, ton://transfer for TON. TRON has no standard
  // payment URI, so its QR stays the plain address and the amount is
  // shown as text — the share link below still carries amount + address.
  const paymentUri = (() => {
    if (!address || !chain || amountError) return null;
    const trimmed = amount.trim();
    const result = buildPaymentUri({
      chain,
      address,
      amount: trimmed === '' ? undefined : trimmed,
      tokenContract: effectiveToken?.contract,
      tokenDecimals: effectiveToken?.decimals,
    });
    return result.ok ? result.uri : null;
  })();
  const qrValue = paymentUri ?? address ?? '';
  const paymentUriUnavailable =
    address !== undefined &&
    chain !== undefined &&
    amount.trim() !== '' &&
    !amountError &&
    paymentUri === null;

  // Bawa web deep link: opens this app's Send screen with chain,
  // address, amount and token prefilled. Works on desktop wallets too,
  // and covers chains with no payment-URI standard (TRON).
  const shareLink =
    address && chain
      ? buildBawaSendLink(window.location.origin, {
          chain,
          to: address,
          amount: amount.trim() === '' || amountError ? undefined : amount.trim(),
          token: effectiveToken?.contract,
        })
      : '';

  async function copyText(value: string, okMessage: string): Promise<void> {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(okMessage);
    } catch {
      setCopyStatus('Unable to copy. Please copy it manually.');
    }
  }

  async function copyAddress() {
    if (!address) return;
    await copyText(address, 'Address copied.');
  }

  async function copyLink() {
    if (!shareLink) return;
    await copyText(shareLink, 'Payment link copied.');
  }

  async function sharePayment() {
    if (!address || !shareLink) return;
    setCopyStatus('');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receive ${assetSymbol}`,
          text: paymentUri ?? address,
          url: shareLink,
        });
        setCopyStatus('Shared.');
        return;
      } catch (error: unknown) {
        // A cancelled share sheet is not an error; fall through to copy.
        if ((error as Error | undefined)?.name === 'AbortError') return;
      }
    }
    await copyText(shareLink, 'Payment link copied.');
  }

  async function downloadQr() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) {
      setCopyStatus('Unable to download the QR code.');
      return;
    }
    try {
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
        type: 'image/svg+xml',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bawa-receive-${chain}${effectiveToken ? `-${effectiveToken.symbol.toLowerCase()}` : ''}.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setCopyStatus('QR code downloaded.');
    } catch {
      setCopyStatus('Unable to download the QR code.');
    }
  }

  if (!chain) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-ink">Receive</h1>
        <p className="text-sm text-ink">
          Receive isn't available for this network yet.
        </p>
      </div>
    );
  }

  const config = chainConfig(chain);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Receive</h1>
      <p className="font-display text-xl text-ink">This is your address — share the drawing, keep the keys.</p>

      <section aria-labelledby="receive-addresses-heading" className="space-y-3">
        <h2 id="receive-addresses-heading" className="text-lg font-semibold text-ink">
          Your addresses
        </h2>
        <p className="text-sm text-ink">
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
                className={`flex items-center gap-3 rounded-bawa-sm border-2 border-ink p-3 ${
                  selected ? 'bg-sun' : 'bg-paper'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectChain(available)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-bawa-sm text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <span aria-hidden="true" className="inline-flex size-8 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink">
                    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-7 rotate-3">
                      <path d="M24 4C35 3 44 13 43 24C45 35 34 45 24 43C12 45 3 35 5 24C3 13 13 3 24 4Z" fill="none" stroke="currentColor" strokeWidth={2} />
                      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontFamily="Caveat, cursive" fontSize={20}>{listConfig.symbol}</text>
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {listConfig.displayName} · {listConfig.symbol}
                    </span>
                    {entry.address ? (
                      <span className="block break-all font-mono text-sm text-ink">
                        {entry.address}
                      </span>
                    ) : (
                      <span className="block text-sm text-ink">No address yet</span>
                    )}
                    {entry.watchOnly && (
                      <span className="block text-sm text-ink">Watch-only</span>
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

      <section aria-labelledby="receive-tokens-heading" className="space-y-3">
        <h2 id="receive-tokens-heading" className="text-lg font-semibold text-ink">
          Receive a token
        </h2>
        <p className="text-sm text-ink">
          Every token in the wallet — choose one to receive it. Native
          coins are in the network list above. A tick means the token is
          verified: it is one of the wallet&apos;s curated tokens, or its
          contract resolved to a real CoinGecko listing.
        </p>
        <div className="space-y-1">
          <Label htmlFor="receive-token-filter" className="text-sm font-medium">
            Find a token by ticker or name
          </Label>
          <Input
            id="receive-token-filter"
            type="text"
            value={tokenFilter}
            onChange={(event) => setTokenFilter(event.target.value)}
            placeholder="e.g. USDC"
            className="h-12"
          />
        </div>
        {filteredTokens.length === 0 ? (
          <p className="text-sm text-ink">
            {filter === ''
              ? 'No tokens yet on these networks.'
              : `No token found for “${filter}”. Try Add token — it searches CoinGecko by ticker or name.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredTokens.map((token) => {
              const tokenConfig = chainConfig(token.chain);
              const selected =
                effectiveToken !== null &&
                effectiveToken.chain === token.chain &&
                effectiveToken.contract.toLowerCase() === token.contract.toLowerCase();
              return (
                <li
                  key={`${token.chain}:${token.contract.toLowerCase()}`}
                  className={`flex items-center gap-3 rounded-bawa-sm border-2 border-ink p-3 ${
                    selected ? 'bg-sun' : 'bg-paper'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectToken(token)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-bawa-sm text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    <span aria-hidden="true" className="inline-flex size-8 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink">
                      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-7 rotate-3">
                        <path d="M24 4C35 3 44 13 43 24C45 35 34 45 24 43C12 45 3 35 5 24C3 13 13 3 24 4Z" fill="none" stroke="currentColor" strokeWidth={2} />
                        <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontFamily="Caveat, cursive" fontSize={14}>{token.symbol}</text>
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {token.name} · {token.symbol}
                        {isVerifiedToken(token) && (
                          <span className="ml-2" aria-label="Verified token">✓ Verified</span>
                        )}
                      </span>
                      <span className="block text-sm text-ink">
                        {tokenConfig.displayName} · {shortContract(token.contract)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button type="button" variant="outline" onClick={() => setAddTokenOpen(true)}>
          Add token
        </Button>
        <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
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
            Amount (optional) — {assetSymbol}
          </Label>
          <Input
            id="receive-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={`0.0 ${assetSymbol}`}
            className="h-12"
          />
          {amountError ? (
            <p role="alert" className="text-sm text-ink bawa-squiggle-underline">{amountError}</p>
          ) : null}
        </div>
      )}

      <Card className="rounded-xl border-border bg-card p-6 text-foreground">
        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              {/* Paper surround keeps the QR scannable — Ink modules on Paper. */}
              <div ref={qrRef} className="shrink-0 rounded-bawa-sm border-2 border-ink bg-paper p-4">
                <QRCodeSVG
                  value={qrValue}
                  size={192}
                  marginSize={4}
                  level="H"
                  fgColor="#2B2B2B"
                  bgColor="#FFFDF7"
                  title={qrValue}
                />
              </div>
              {paymentUriUnavailable && (
                <p className="text-sm text-ink">
                  Requested amount: {amount.trim()} {assetSymbol} (shown as text — TRON has no
                  standard payment-request link, so the QR encodes the address only. The share
                  link below still carries the amount.)
                </p>
              )}
            </div>
            <p className="w-full break-all text-center font-mono text-sm text-foreground">{address}</p>
            <p data-testid="receive-share-link" className="w-full break-all text-center font-mono text-xs text-ink">
              {shareLink}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => void copyAddress()}>
                Copy address
              </Button>
              <Button type="button" variant="outline" onClick={() => void sharePayment()}>
                Share
              </Button>
              <Button type="button" variant="outline" onClick={() => void copyLink()}>
                Copy link
              </Button>
              <Button type="button" variant="outline" onClick={() => void downloadQr()}>
                Download QR
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
        <p role="status" className="mt-4 text-center text-sm text-ink">
          {copyStatus}
        </p>
      </Card>

      <p className="text-sm text-ink">
        {(() => {
          const devnetConfig = devnetEnabled
            ? devnetChainConfigOrUndefined(chain)
            : undefined;
          return devnetConfig
            ? `Devnet — this address is for the ${devnetConfig.devnetName} test network. Test tokens have no value. Funds sent on another network cannot be recovered.`
            : `Mainnet only — this address is for the ${config.displayName} mainnet. Funds sent on another network cannot be recovered.`;
        })()}
      </p>

      {chain === 'ton' && (
        <p className="text-sm text-ink">
          This address can only receive TON. To send or withdraw TON, you need an external wallet.
        </p>
      )}

      <p className="text-sm text-ink">
        Only share this address to receive funds. Check the address carefully before accepting funds.
      </p>
    </div>
  );
}
