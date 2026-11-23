import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, canRotateReceiveAddress, chainConfig, type ChainId } from '../wallet/chains';
import { devnetChainConfigOrUndefined } from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/chain-amount-format';
import { buildBawaSendLink, buildPaymentUri, qrCardToPngFile } from '../wallet/payment-links';
import {
  DEFAULT_TOKENS,
  isVerifiedToken,
  orderAssetsByBalance,
  resolveTokenByTickerOrName,
  shortContract,
  tokenKeyOf,
  type TokenRecord,
} from '../wallet/tokens';
import { AddTokenDialog } from './add-token';
import { filterChains } from './chain-search-select';
import { QrCard, qrCardTokenLabel } from './qr-card';
import { ChainLogo, TokenLogo, chainLogoFor, tokenLogoFor } from './token-logo';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

// Item 20: the three QR templates — plain address, payment request,
// Bawa web link.
type QrTemplate = 'address' | 'payment' | 'link';

// Lane H: the popular networks — the same four the dashboard's
// PopularChainsStrip uses (the four original adapter chains). They
// are the picker's first section, so the chains people actually
// receive on are one tap away without scrolling through all 22.
export const POPULAR_RECEIVE_CHAINS: readonly ChainId[] = [
  'btc',
  'eth',
  'trx',
  'ton',
];

/**
 * A chain's real mark: the bundled Trust Wallet logo where the repo
 * has one (chainLogoFor, else the symbol's token logo — BTC, ETH,
 * TRX, TON), and a ticker badge where it has none (Gnosis, Celo,
 * Linea, Mantle, Scroll, opBNB, Metis, Aurora, Fantom). Never a
 * broken image, never an empty box — the same fallback the QR card
 * uses. The old picker drew every chain as a hand-drawn blob with
 * symbol text, so BNB Smart Chain and Avalanche read as bare
 * initials; the real marks are what the owner asked the token rows
 * to use.
 */
function ChainMark({ chain }: { chain: ChainId }) {
  const [failed, setFailed] = useState(false);
  const config = chainConfig(chain);
  const src =
    chainLogoFor(chain) ?? tokenLogoFor(config.symbol);
  if (src !== undefined && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        decoding="async"
        className="size-8 shrink-0 rounded-full"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[10px] font-bold uppercase text-ink"
    >
      {config.symbol.trim().slice(0, 4) || '?'}
    </span>
  );
}

/**
 * One network row in the picker: mark, name + symbol, chevron.
 * A full-width row, not a grid cell — the name is never truncated
 * ("BNB Smart Chain …", "Avalanche C-Chai…" in the old 2-column
 * grid) and the selected row reads as the current choice.
 *
 * Row anatomy follows Ivy Wallet's account rows (icon + name + one
 * action, no second control) and the OJO 8-state model: default
 * (paper), hover (sun — the repo's established row hover),
 * selected (sun), focus (coral ring). The chevron is an inline SVG,
 * not a text glyph (ui-ux-pro-max checklist: SVG icons only).
 */
function ChainRow({
  chain,
  selected,
  onSelect,
}: {
  chain: ChainId;
  selected: boolean;
  onSelect: (chain: ChainId) => void;
}) {
  const config = chainConfig(chain);
  return (
    <li
      className={`rounded-bawa-sm border-2 border-ink ${
        selected ? 'bg-sun' : 'bg-paper'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        title={config.displayName}
        onClick={() => onSelect(chain)}
        className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-bawa-sm p-2 text-left text-ink hover:bg-sun focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ChainMark chain={chain} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {config.displayName}{' '}
          <span className="font-normal">{config.symbol}</span>
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4 shrink-0 -rotate-90"
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </li>
  );
}

export function ReceiveScreen() {
  const {
    addresses,
    balances,
    tokenBalances,
    vaultAddresses,
    selectedChain,
    setSelectedChain,
    customTokens,
    devnetEnabled,
    receiveAddresses: receiveAddressesRaw,
    receiveIndices: receiveIndicesRaw,
    nextReceiveAddress,
  } = useWallet();
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders on the account address.
  const receiveAddresses = receiveAddressesRaw ?? {};
  const receiveIndices = receiveIndicesRaw ?? {};
  const [copyStatus, setCopyStatus] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [tokenFilter, setTokenFilter] = useState('');
  const [addTokenOpen, setAddTokenOpen] = useState(false);
  // Item 20: stepped flow — network, then token, then amount + QR.
  const [step, setStep] = useState<'chain' | 'token' | 'details'>('chain');
  const [template, setTemplate] = useState<QrTemplate | null>(null);
  // Lane H: the network picker — a search query, and whether the
  // grouped "All networks" list is open. Both reset when a network
  // is picked (selectChain below), so the next visit starts clean.
  const [chainQuery, setChainQuery] = useState('');
  const [allNetworksOpen, setAllNetworksOpen] = useState(false);
  // The picker's section, for the search keyboard nav below.
  const pickerRef = useRef<HTMLElement | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const chains = availableFor('receive');
  const chain = chains.includes(selectedChain) ? selectedChain : chains[0];

  // Full token list (token gaps, item 2): the defaults plus user-added
  // tokens, on the networks this screen can receive on. Native coins
  // are the network list above; this list is the tokens.
  const allTokens = [...DEFAULT_TOKENS, ...(customTokens ?? [])];
  const visibleTokens = allTokens.filter((token) => chains.includes(token.chain));
  // Item 20: the token step lists only the selected network's tokens.
  const chainTokens = visibleTokens.filter((token) => token.chain === chain);
  const filter = tokenFilter.trim();
  const matchedKeys = new Set(
    filter === ''
      ? []
      : resolveTokenByTickerOrName(filter, chainTokens).map(
          (token) => `${token.chain}:${token.contract.toLowerCase()}`,
        ),
  );
  const filteredTokens =
    filter === ''
      ? chainTokens
      : chainTokens.filter((token) =>
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
    setTemplate(null);
    setChainQuery('');
    setAllNetworksOpen(false);
    setStep('token');
  }

  // Lane H: the picker's sections. Popular first (only the ones this
  // screen can receive on), the rest grouped behind "All networks".
  // A search query replaces both sections with a flat filtered list
  // across all 22 — the same filterChains the watch-only chain
  // search uses (name, symbol or id, case-insensitive).
  const popularChains = POPULAR_RECEIVE_CHAINS.filter((entry) =>
    chains.includes(entry),
  );
  const otherChains = chains.filter(
    (entry) => !POPULAR_RECEIVE_CHAINS.includes(entry),
  );
  const chainSearch = chainQuery.trim();
  const searchedChains =
    chainSearch === '' ? [] : filterChains(chains, chainSearch);

  // Lane H (COSS Combobox): the search is a combobox, not a plain
  // filter — ArrowDown moves focus into the results, Enter picks
  // the first match, Escape clears the query. Tab still reaches
  // every row (they are native buttons); these keys are the
  // shortcut regulars expect from a search-over-list (Ivy Wallet's
  // feature/search is the model).
  function handleChainSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const firstRow = pickerRef.current?.querySelector('ul li button');
      (firstRow as HTMLButtonElement | null)?.focus();
    } else if (event.key === 'Enter') {
      if (chainSearch !== '' && searchedChains.length > 0) {
        event.preventDefault();
        const first = searchedChains[0];
        if (first !== undefined) selectChain(first);
      }
    } else if (event.key === 'Escape') {
      setChainQuery('');
    }
  }

  // A null token is the selected network's native coin.
  function selectToken(token: TokenRecord | null): void {
    setCopyStatus('');
    setAmount('');
    setSelectedToken(token);
    if (token !== null) setSelectedChain(token.chain);
    setTemplate(null);
    setStep('details');
  }

  const vaultAddress = chain ? vaultAddresses[chain][0] : undefined;
  const watchAddress = chain
    ? addresses[chain].find((entry) => entry.index === 0)?.address
    : undefined;
  // Lane C, item 8 — the HD wallet: the QR card shows the receiving
  // address for this account, derived from the next unused index, while
  // the list above keeps the multichain view (one address per network).
  // While the rotation is still loading, fall back to the account address.
  const hdAddress = chain ? receiveAddresses[chain] ?? null : null;
  const address = hdAddress ?? vaultAddress ?? watchAddress;
  const isWatchOnly = address !== undefined && vaultAddress === undefined;
  const receiveIndex = chain ? receiveIndices[chain] ?? 0 : 0;
  // Rotation only applies to the vault's own addresses: a watch-only
  // address has no phrase to derive from. Lane A: every chain rotates,
  // SOL and TON included.
  const canRotate =
    chain !== undefined &&
    vaultAddress !== undefined &&
    !isWatchOnly &&
    canRotateReceiveAddress(chain);

  async function newReceiveAddress(): Promise<void> {
    if (!chain || !nextReceiveAddress || isRotating) return;
    setIsRotating(true);
    setCopyStatus('');
    try {
      await nextReceiveAddress(chain);
      setCopyStatus('New receiving address ready.');
    } catch (cause) {
      setCopyStatus(
        cause instanceof Error ? cause.message : 'Unable to make a new address.',
      );
    } finally {
      setIsRotating(false);
    }
  }

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

  // Item 20: three QR templates — the plain address, the payment
  // request (when the chain has a payment-URI standard and, for tokens,
  // an amount), and the Bawa web link. The main QR is the selected
  // template; the other two sit below it, small, and tapping one swaps
  // it into the main slot. The default keeps the old behaviour: the
  // payment request when one exists, else the plain address.
  const qrTemplates: Array<{ id: QrTemplate; label: string; value: string | null }> = [
    { id: 'address', label: 'Address', value: address ?? null },
    { id: 'payment', label: 'Payment request', value: paymentUri },
    { id: 'link', label: 'Share link', value: shareLink === '' ? null : shareLink },
  ];
  // Lane 7: a selected template that has no value (a token payment
  // with no amount yet, or TRON, which has no payment-URI standard)
  // falls back to the plain address — the main QR never silently
  // shows one template while the screen names another.
  const requestedTemplate: QrTemplate =
    template ?? (paymentUri !== null ? 'payment' : 'address');
  const effectiveTemplate: QrTemplate =
    qrTemplates.find((candidate) => candidate.id === requestedTemplate)
      ?.value != null
      ? requestedTemplate
      : 'address';
  const effectiveLabel =
    qrTemplates.find((candidate) => candidate.id === effectiveTemplate)
      ?.label ?? 'Address';
  // Why the payment template is unavailable, when it is: a token
  // payment needs an amount first; TRON has no payment-request
  // standard at all (its QR stays the plain address and the share
  // link still carries the amount).
  const paymentNeedsAmount =
    effectiveToken !== null && amount.trim() === '' && paymentUri === null;
  const paymentHint =
    paymentNeedsAmount
      ? 'Payment request needs an amount — enter one below.'
      : chain === 'trx' && amount.trim() === ''
        ? 'TRON has no payment-request standard — the share link still carries the amount.'
        : null;
  const mainQr =
    qrTemplates.find((candidate) => candidate.id === effectiveTemplate)?.value ??
    address ??
    '';

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
    // Sharing attaches the QR card as a PNG image (UI/UX Round 2,
    // item 1): the file is the card — QR, amount, address, token +
    // chain with both logos — the same card the screen shows. The
    // payment URI stays in the text and the Bawa link in the URL.
    // When the platform cannot share files, the PNG downloads
    // instead — the link is only copied as a last resort.
    const file = await qrPngFile();
    if (
      file !== null &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Receive ${assetSymbol}`,
          text: paymentUri ?? address,
          url: shareLink,
        });
        setCopyStatus('Card shared.');
        return;
      } catch (error: unknown) {
        // A cancelled share sheet is not an error; fall through to download.
        if ((error as Error | undefined)?.name === 'AbortError') return;
      }
    }
    if (file !== null) {
      try {
        downloadBlob(file, file.name);
        setCopyStatus(
          'Sharing is not available here. The QR code was downloaded instead.',
        );
        return;
      } catch {
        // Fall through to copying the link.
      }
    }
    await copyText(shareLink, 'Payment link copied.');
  }

  function qrFileName(): string {
    return `bawa-receive-${chain}${effectiveToken ? `-${effectiveToken.symbol.toLowerCase()}` : ''}.png`;
  }

  // The amount as the card shows it — null when no amount is set.
  const amountText =
    amount.trim() === '' || amountError
      ? null
      : `${amount.trim()} ${assetSymbol}`;

  async function qrPngFile(): Promise<File | null> {
    const svg = qrRef.current?.querySelector('#qr-card-qr svg');
    if (!svg || !address || !chain) return null;
    try {
      return await qrCardToPngFile(
        new XMLSerializer().serializeToString(svg),
        {
          amountText: amountText ?? 'Any amount',
          address,
          tokenLabel: qrCardTokenLabel(effectiveToken, chain),
          tokenLogoSrc: tokenLogoFor(
            effectiveToken === null ? config.symbol : effectiveToken.symbol,
          ),
          chainLogoSrc: chainLogoFor(chain) ?? tokenLogoFor(chain),
        },
        qrFileName(),
      );
    } catch {
      return null;
    }
  }

  function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadQr() {
    const file = await qrPngFile();
    if (!file) {
      setCopyStatus('Unable to download the card.');
      return;
    }
    try {
      downloadBlob(file, file.name);
      setCopyStatus('Card downloaded.');
    } catch {
      setCopyStatus('Unable to download the card.');
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

  // Item 20: the token step lists the native coin and the chain's
  // tokens balance-first (non-zero balances at the top, in the order
  // top wallets use). Receive loads no price feed, so the order is
  // hasBalance, then registry order.
  const nativeMatchesFilter =
    filter === '' ||
    config.displayName.toLowerCase().includes(filter.toLowerCase()) ||
    config.symbol.toLowerCase().includes(filter.toLowerCase());
  const orderedAssets = orderAssetsByBalance([
    ...(nativeMatchesFilter
      ? [
          {
            token: null as TokenRecord | null,
            hasBalance: balances?.[chain]?.status === 'available',
            fiatMinorUnits: null as number | null,
          },
        ]
      : []),
    ...filteredTokens.map((token) => ({
      token,
      hasBalance:
        tokenBalances?.[tokenKeyOf(token)]?.status === 'available',
      fiatMinorUnits: null as number | null,
    })),
  ]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-ink">Receive</h1>
      {/* Lane 7: no step line on the details step — the user has
          completed steps 1–2 and the QR screen says where they are.
          The line's 32 px is what the template row needs to sit
          above the fold at 390 px. Steps 1–2 keep their lines. */}
      {step !== 'details' && (
        <p className="text-body-sm font-medium text-panel-text-muted">
          {step === 'chain' ? 'Step 1 of 3: Network' : 'Step 2 of 3: Token'}
        </p>
      )}

      {step === 'chain' && (
      <section ref={pickerRef} aria-labelledby="receive-addresses-heading" className="space-y-3">
        {/* Round 2, item 8: the step label above ("Step 1 of 3: Network")
            is the visible title; the heading stays for screen readers. */}
        <h2 id="receive-addresses-heading" className="sr-only">
          Choose a network
        </h2>
        {/* Lane H: a sleek network picker, not the 22-button grid.
            Search at the top; Popular first as full-width rows with
            the real chain marks (names never truncated); the rest
            grouped behind "All networks", collapsed by default, so
            the popular chains are reachable without scrolling
            through all 22. Searching replaces both sections with a
            flat filtered list. Built on the watch-only chain search
            (filterChains), not a second copy of it. */}
        <div className="space-y-1">
          <Label htmlFor="receive-chain-search" className="sr-only">
            Search networks
          </Label>
          <Input
            id="receive-chain-search"
            type="text"
            value={chainQuery}
            onChange={(event) => setChainQuery(event.target.value)}
            onKeyDown={handleChainSearchKeyDown}
            placeholder="Search networks — e.g. Solana"
            className="h-11"
          />
        </div>
        {chainSearch !== '' ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-ink">
              {searchedChains.length === 0
                ? `No networks match “${chainSearch}”.`
                : `${searchedChains.length} ${
                    searchedChains.length === 1 ? 'network' : 'networks'
                  } found`}
            </p>
            <ul className="space-y-2">
              {searchedChains.map((available) => (
                <ChainRow
                  key={available}
                  chain={available}
                  selected={available === chain}
                  onSelect={selectChain}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Popular</h3>
            <ul className="space-y-2">
              {popularChains.map((available) => (
                <ChainRow
                  key={available}
                  chain={available}
                  selected={available === chain}
                  onSelect={selectChain}
                />
              ))}
            </ul>
            {otherChains.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  aria-expanded={allNetworksOpen}
                  onClick={() => setAllNetworksOpen((open) => !open)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-bawa-sm border-2 border-ink bg-paper p-2 text-left text-sm font-semibold text-ink hover:bg-sun focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <span>
                    All networks ({otherChains.length})
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className={`size-4 shrink-0 motion-safe:transition-transform ${allNetworksOpen ? 'motion-safe:rotate-180' : ''}`}
                  >
                    <path
                      d="M3 6l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {allNetworksOpen && (
                  <ul className="space-y-2">
                    {otherChains.map((available) => (
                      <ChainRow
                        key={available}
                        chain={available}
                        selected={available === chain}
                        onSelect={selectChain}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      )}

      {step === 'token' && (
      <section aria-labelledby="receive-tokens-heading" className="space-y-3">
        {/* Round 2, item 8: the heading, network and Back share one row
            and the explainer is gone — the native coin first, then every
            token, with a tick for verified, reads without it. */}
        <div className="flex items-center justify-between gap-3">
          <h2 id="receive-tokens-heading" className="text-lg font-semibold text-ink">
            {`Token · ${config.displayName}`}
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setStep('chain')}>
            Back
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="receive-token-filter" className="sr-only">
            Find a token by ticker or name
          </Label>
          <Input
            id="receive-token-filter"
            type="text"
            value={tokenFilter}
            onChange={(event) => setTokenFilter(event.target.value)}
            placeholder="Find a token by ticker or name — e.g. USDC"
            className="h-11"
          />
        </div>
        {orderedAssets.length === 0 ? (
          <p className="text-sm text-ink">
            {filter === ''
              ? `No tokens yet on ${config.displayName}.`
              : `No token found for “${filter}”. Try Add token — it searches CoinGecko by ticker or name.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {orderedAssets.map(({ token }) => {
              if (token === null) {
                return (
                  <li
                    key={`native:${chain}`}
                    className={`flex items-center gap-2 rounded-bawa-sm border-2 border-ink p-1.5 ${
                      selectedToken === null ? 'bg-sun' : 'bg-paper'
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedToken === null}
                      onClick={() => selectToken(null)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-bawa-sm text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                    >
                      {/* Lane G: the real chain mark (see above). */}
                      <ChainLogo chain={chain} size={24} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {config.displayName} · {config.symbol} · Native coin
                      </span>
                    </button>
                  </li>
                );
              }
              const tokenConfig = chainConfig(token.chain);
              const selected =
                effectiveToken !== null &&
                effectiveToken.chain === token.chain &&
                effectiveToken.contract.toLowerCase() === token.contract.toLowerCase();
              return (
                <li
                  key={`${token.chain}:${token.contract.toLowerCase()}`}
                  className={`flex items-center gap-2 rounded-bawa-sm border-2 border-ink p-1.5 ${
                    selected ? 'bg-sun' : 'bg-paper'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectToken(token)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-bawa-sm text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    {/* Lane G: the real token mark (see above) —
                        WETH and the USDT variants resolve to real
                        logos now instead of the yellow ticker badge. */}
                    <TokenLogo symbol={token.symbol} size={24} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {token.name} · {token.symbol}
                      {isVerifiedToken(token) && (
                        <span className="ml-2" aria-label="Verified token">✓ Verified</span>
                      )}
                      <span className="font-normal text-ink">
                        {` · ${tokenConfig.displayName} · ${shortContract(token.contract)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setAddTokenOpen(true)}>
          Add token
        </Button>
        <AddTokenDialog open={addTokenOpen} onOpenChange={setAddTokenOpen} />
      </section>
      )}

      {step === 'details' && (
        <div className="space-y-2">
      <p className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>{`${config.displayName} · ${assetSymbol}`}</span>
        <Button type="button" variant="outline" onClick={() => setStep('token')}>
          Back
        </Button>
      </p>

      <Alert>
        <AlertDescription>
          {`Send only on ${devnetEnabled ? (devnetChainConfigOrUndefined(chain)?.devnetName ?? config.displayName) : config.displayName} — the sender must use this network.`}
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

      <Card className="rounded-xl border-border bg-card p-3 text-foreground">
        {address ? (
          <div className="flex flex-col items-center gap-1.5">
            {/* The QR card (UI/UX Round 2, item 1): QR, amount,
                address, token + chain with both logos — the same
                card the Share and Download buttons send out. */}
            <div id="receive-qr" ref={qrRef} className="w-full max-w-md">
              <QrCard
                qrValue={mainQr}
                amountText={amountText}
                address={address}
                token={effectiveToken}
                chain={chain}
              />
            </div>
            {paymentUriUnavailable && (
              <p className="text-sm text-ink">
                Requested amount: {amount.trim()} {assetSymbol} (shown as text — TRON has no
                standard payment-request link, so the QR encodes the address only. The share
                link below still carries the amount.)
              </p>
            )}
            {/* Lane H (COSS Segmented Control + Aceternity Animated
                Tabs, re-skinned to ink borders and sun): the three
                QR templates are one control with three segments, not
                two loose buttons — the active segment stays in the
                control, marked sun with aria-pressed, instead of
                leaving the row. Tapping another segment swaps it
                into the main slot. The unavailable payment segment
                stays disabled with its reason, never a dead box. */}
            <p className="w-full text-center text-sm font-semibold text-ink">
              {`QR type: ${effectiveLabel} — tap to switch`}
            </p>
            <div
              role="group"
              aria-label="QR type"
              className="flex w-full gap-1 rounded-bawa-sm border-2 border-ink bg-paper p-1"
            >
              {qrTemplates.map((candidate) => {
                const active = candidate.id === effectiveTemplate;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={candidate.value === null}
                    aria-pressed={active}
                    aria-label={`Show ${candidate.label.toLowerCase()} QR`}
                    onClick={() => setTemplate(candidate.id)}
                    className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-bawa-sm p-1 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-sun' : 'hover:bg-sun'}`}
                  >
                    {candidate.value !== null ? (
                      <QRCodeSVG
                        value={candidate.value}
                        size={64}
                        marginSize={2}
                        level="H"
                        fgColor="#2B2B2B"
                        bgColor="#FFFDF7"
                        title={candidate.value}
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center border-2 border-dashed border-ink text-center">
                        {candidate.id === 'payment' && paymentNeedsAmount
                          ? 'Needs amount'
                          : 'Not available'}
                      </span>
                    )}
                    <span className="text-[10px] leading-tight">{candidate.label}</span>
                  </button>
                );
              })}
            </div>
            {paymentHint !== null && (
              <p className="w-full text-center text-xs text-ink">{paymentHint}</p>
            )}
            {/* Action row (deep audit, Lane A, moved up from the
                bottom of the card where Copy/Share/Download sat
                below the 390px fold). It sits here, after the
                template row: the three QR templates own the
                above-fold slot (Lane 7, owner correction
                2026-11-23), so the actions are one short scroll
                below the templates instead of at the card bottom. Lane E (fix-all):
                the five buttons are size sm — at default size they wrapped
                into 3 rows (136 px); sm fits 2 rows (72 px). Live at 390 px:
                template row bottom 749 vs fold 770, actions fully revealed
                after a 57 px scroll (was 141 px); total scroll 489 px to 405 px. */}
<div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => void copyAddress()}>
                Copy address
              </Button>
              {canRotate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void newReceiveAddress()}
                  disabled={isRotating || !nextReceiveAddress}
                >
                  {isRotating ? 'Making address…' : 'New address'}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => void sharePayment()}>
                Share
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                Copy link
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void downloadQr()}>
                Download card
              </Button>
            </div>
            {/* Lane 7: the amount sits under the templates — the QR
                and its three types are the point of this step, and
                the amount is the optional refinement that enables
                the payment request for tokens. The full address
                stays on the card above; the duplicate line that
                repeated it below the card is gone. */}
            <div className="w-full space-y-1">
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
            {/* The address number is the HD indicator — which receiving
                address of this account this is — so it stays, kept to
                one line. */}
            {vaultAddress !== undefined && !isWatchOnly && (
              <p className="w-full text-center text-xs text-ink">
                {`Receiving address ${receiveIndex + 1} of this account.`}
              </p>
            )}
            {/* The share link is long; the row shows one truncated line
                (the full link stays in the DOM and copies whole). */}
            <p data-testid="receive-share-link" title={shareLink} className="w-full truncate text-center font-mono text-xs text-ink">
              {shareLink}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-foreground">No receiving address available for this chain.</p>
            <Link to="/import-wallet" className="font-medium text-primary underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        )}
        {/* P8 (desktop-layout-v2 follow-up, kept per owner decision
            2026-11-23): the status line renders only when a copy/share
            action has something to report — an always-rendered empty
            <p> leaves ~40 px of dead space under the buttons. */}
        {copyStatus !== '' && (
          <p role="status" className="mt-3 text-center text-sm text-ink">
            {copyStatus}
          </p>
        )}
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
      )}
    </div>
  );
}
