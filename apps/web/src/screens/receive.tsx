import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, canRotateReceiveAddress, chainConfig, type ChainId } from '../wallet/chains';
import { devnetChainConfigOrUndefined } from '../wallet/devnet-endpoints';
import {
  buildOnrampAddresses,
  coinbaseOnrampAppId,
  onrampDestinations,
  openCoinbaseOnramp,
  type OnrampDestination,
} from '../wallet/onramp';
import {
  MOONPAY_CURRENCY_BY_CHAIN,
  RAMP_ASSET_BY_CHAIN,
  banxaDestinations,
  banxaPartnerRef,
  buildBanxaUrl,
  buildMercuryoUrl,
  buildMoonpayUrl,
  buildOnramperUrl,
  buildRampUrl,
  buyDestinationsFor,
  buyProviders,
  mercuryoWidgetId,
  moonpayPublishableKey,
  onramperApiKey,
  openBuyProviderUrl,
  rampEnabledAssetsFor,
  rampHostApiKey,
  type BuyProviderId,
  type BuyProviderInfo,
} from '../wallet/buy-providers';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/chain-amount-format';
import { buildBawaSendLink, buildPaymentUri, DEFAULT_QR_CARD_TEMPLATE, QR_CARD_TEMPLATES, qrCardToPngFile, type QrCardTemplate } from '../wallet/payment-links';
import {
  DEFAULT_TOKENS,
  isDefaultToken,
  isVerifiedToken,
  orderAssetsByBalance,
  resolveTokenByTickerOrName,
  shortContract,
  tokenKeyOf,
  type TokenRecord,
} from '../wallet/tokens';
import { AddTokenDialog } from './add-token';
import { filterChains } from './chain-search-select';
import { QrCard, qrCardSubtitle, qrCardTitle, qrCardTokenLabel, qrCardTokenSubline } from './qr-card';
import { ChainLogo, TokenLogo, chainLogoFor, tokenLogoFor } from './token-logo';
import { TokenPickerRow } from './token-picker-row';
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
// receive on are one tap away without scrolling through all 87.
export const POPULAR_RECEIVE_CHAINS: readonly ChainId[] = [
  'btc',
  'eth',
  'trx',
  'ton',
];

/**
 * A chain's real mark: the bundled Trust Wallet logo where the repo
 * has one, and the deliberate link mark where it has none (ChainLogo,
 * screens/token-logo.tsx). Lane B (token-verify, 2026-11-24): this
 * used to fall back to the symbol's token logo — the Ethereum logo
 * on the eleven icon-less ETH-symbol chains — and then to a yellow
 * ticker badge with the symbol text, the badge the owner ordered
 * removed on 2026-11-23. Both fallbacks are gone; the shared
 * ChainLogo is the only mark path now, so the picker can never drift
 * from the asset rows again.
 */
function ChainMark({ chain }: { chain: ChainId }) {
  return <ChainLogo chain={chain} size={32} />;
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

// Lane D (usable-install): the Buy panel's wallet states. Each
// impossible state gets its own explanation and the next step, never
// a dead Buy button. (The "not set up yet" state is no longer
// panel-level: Lane B shows the provider picker instead, and each
// unconfigured provider row says so itself.)
type BuyStatus = 'idle' | 'opening' | 'opened' | 'load-failed' | 'blocked';

type BuyUnavailable = {
  title: string;
  body: string;
  to: string;
  action: string;
};

function buyUnavailableState(
  vaultState: string,
  hasDestination: boolean,
): BuyUnavailable | null {
  if (vaultState === 'no-vault') {
    return {
      title: 'Create a wallet first',
      body: 'You need a wallet first.',
      to: '/create-wallet',
      action: 'Create wallet',
    };
  }
  if (vaultState === 'locked') {
    return {
      title: 'Unlock your wallet to buy',
      body: 'Unlock to see where a purchase would be delivered.',
      to: '/lock',
      action: 'Unlock',
    };
  }
  if (!hasDestination) {
    return {
      title: 'No address to deliver to',
      body: 'This wallet has no address on a network any Buy provider delivers to.',
      to: '/import-wallet',
      action: 'Import wallet',
    };
  }
  return null;
}

// Lane B (providers Phase 2): Ramp's regional restrictions
// (RESEARCH.md §2.1). Bawa cannot detect the buyer's region, so
// they are stated on the Ramp row rather than silently enforced;
// the pure gating helpers live in wallet/buy-providers.ts.
const RAMP_RESTRICTIONS =
  'Not available in Louisiana, Minnesota, Nevada, New Jersey, New York, Pennsylvania, Vermont, Washington or Puerto Rico. No USDT, USDT0, DAI or AUSD in the EU/EEA. No stablecoins in Texas.';

// Lane B: Banxa Referral is a plain redirect — what it cannot do.
const BANXA_LIMITS =
  'A plain redirect — no quote in Bawa, no webhooks and no order lookup.';

// Lane B (providers Phase 2): one row per Buy provider, in rank
// order. Each row states its keys, its indicative fee and its honest
// state — never a fake "Buy". A row has a button only when its
// provider is configured (and, for Ramp and Coinbase, when this
// wallet has an address on a network it delivers to).
function BuyProviderRow({
  provider,
  destination,
  buttonLabel,
  note,
  onBuy,
  buyDisabled,
  isActive,
  buyStatus,
}: {
  provider: BuyProviderInfo;
  destination: string | null;
  buttonLabel: string | null;
  note: string | null;
  onBuy: () => void;
  buyDisabled: boolean;
  isActive: boolean;
  buyStatus: BuyStatus;
}) {
  // Lane C (C-11): the rank tag only shows on a usable row. A row
  // with no button is not configured, and a "Recommended" on it reads
  // as an endorsement of an option that does not work yet.
  const tag =
    buttonLabel === null
      ? null
      : provider.id === 'ramp'
        ? 'Recommended'
        : provider.id === 'banxa'
          ? 'Link only'
          : provider.id === 'transak'
            ? 'Needs a backend'
            : null;
  return (
    <Card radius="xl">
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm font-semibold text-ink">
          {provider.rank}. {provider.name}
          {tag !== null ? ` — ${tag}` : ''}
        </p>
        <p className="text-sm text-ink">{provider.keyCopy}</p>
        <p className="text-sm text-ink">{provider.feeCopy}</p>
        {buttonLabel === null ? (
          <>
            {provider.readiness === 'needs-backend' ? (
              <p className="text-sm text-ink">
                Needs a backend — {provider.setupCopy}
              </p>
            ) : provider.readiness === 'ready' ||
              provider.readiness === 'ready-no-prefill' ? (
              <p className="text-sm text-ink">
                No address on a network {provider.name} delivers to.
              </p>
            ) : provider.id === 'coinbase' ? (
              <>
                <p className="text-sm font-semibold text-ink">
                  Buy isn&apos;t set up yet
                </p>
                <p className="text-sm text-ink">{provider.setupCopy}</p>
              </>
            ) : (
              <p className="text-sm text-ink">
                Not set up yet — {provider.setupCopy}
              </p>
            )}
            {note !== null && <p className="text-sm text-ink">{note}</p>}
          </>
        ) : (
          <>
            {destination !== null && (
              <>
                <p className="text-sm font-semibold text-ink">
                  Deliver to
                </p>
                <p className="w-full break-all font-mono text-xs text-ink">
                  {destination}
                </p>
              </>
            )}
            {note !== null && <p className="text-sm text-ink">{note}</p>}
            <Button
              type="button"
              size="sm"
              disabled={buyDisabled}
              onClick={onBuy}
            >
              {buttonLabel}
            </Button>
          </>
        )}
        {isActive && buyStatus === 'opened' && (
          <p role="status" className="text-sm text-ink">
            {provider.name} opened in a pop-up — complete your purchase
            there.
          </p>
        )}
        {isActive && buyStatus === 'load-failed' && (
          <p role="alert" className="text-sm text-ink">
            {provider.name} couldn&apos;t be loaded. Check your connection.
          </p>
        )}
        {isActive && buyStatus === 'blocked' && (
          <p role="alert" className="text-sm text-ink">
            Pop-up blocked. Allow pop-ups and try again.
          </p>
        )}
      </div>
    </Card>
  );
}

export function ReceiveScreen() {
  const {
    addresses,
    balances,
    tokenBalances,
    vaultAddresses,
    vaultState,
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
  // QR-cards programme, Lane E: which of the four card templates
  // the card renders in — and which one Share/Download draw to PNG.
  // Default B (Paper), Bawa's own system.
  const [cardTemplate, setCardTemplate] = useState<QrCardTemplate>(DEFAULT_QR_CARD_TEMPLATE);
  // Lane H: the network picker — a search query, and whether the
  // grouped "All networks" list is open. Both reset when a network
  // is picked (selectChain below), so the next visit starts clean.
  const [chainQuery, setChainQuery] = useState('');
  const [allNetworksOpen, setAllNetworksOpen] = useState(false);
  // The picker's section, for the search keyboard nav below.
  const pickerRef = useRef<HTMLElement | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const qrRef = useRef<HTMLDivElement | null>(null);

  // Lane D (usable-install) + Lane B (providers Phase 2): the Buy
  // panel (?buy=1) — a provider picker, not one provider. Its state
  // lives here with the rest of the screen's state so the panel can
  // early-return below.
  const [searchParams] = useSearchParams();
  const buyMode = searchParams.get('buy') === '1';
  const [buyStatus, setBuyStatus] = useState<BuyStatus>('idle');
  const [buyProvider, setBuyProvider] = useState<BuyProviderId | null>(null);
  const buyAppId = coinbaseOnrampAppId();
  // The destinations are cheap to recompute (ten entries at most),
  // so no memo: each provider row shows the first destination on a
  // network it delivers to, and the widget itself is the picker for
  // the rest.
  const buyDestinations = onrampDestinations({
    receiveAddresses,
    vaultAddresses,
    watchAddresses: addresses,
  });
  // The panel's address: the first destination. The widget is
  // the picker — the panel shows the one address the purchase
  // lands on by default, and every destination goes in the URL.
  const buyDestination: OnrampDestination | null =
    buyDestinations[0] ?? null;
  // Lane B: the same address resolution, per provider map. Ramp and
  // MoonPay need a destination to pre-fill; Onramper and Mercuryo
  // carry no pre-fill (their addresses need a server signature), so
  // they need none; Banxa pre-fills when it can and opens bare when
  // it cannot.
  const rampDestinations = buyDestinationsFor(RAMP_ASSET_BY_CHAIN, {
    receiveAddresses,
    vaultAddresses,
    watchAddresses: addresses,
  });
  const moonpayDestinations = buyDestinationsFor(
    MOONPAY_CURRENCY_BY_CHAIN,
    {
      receiveAddresses,
      vaultAddresses,
      watchAddresses: addresses,
    },
  );
  const banxaDestinationList = banxaDestinations({
    receiveAddresses,
    vaultAddresses,
    watchAddresses: addresses,
  });
  const hasAnyBuyDestination =
    buyDestinations.length > 0 ||
    rampDestinations.length > 0 ||
    moonpayDestinations.length > 0 ||
    banxaDestinationList.length > 0;
  const buyUnavailable = buyUnavailableState(
    vaultState,
    hasAnyBuyDestination,
  );

  function handleBuy(): void {
    const onrampAddresses =
      buyDestination === null
        ? null
        : buildOnrampAddresses(buyDestinations);
    if (
      buyAppId === null ||
      buyDestination === null ||
      onrampAddresses === null
    ) {
      return;
    }
    setBuyStatus('opening');
    const outcome = openCoinbaseOnramp({
      appId: buyAppId,
      addresses: onrampAddresses,
      defaultNetwork: buyDestination.network,
    });
    if (outcome === 'load-failed') setBuyStatus('load-failed');
    else if (outcome === 'blocked') setBuyStatus('blocked');
    else setBuyStatus('opened');
  }

  // Lane B: open one provider row's widget. Coinbase keeps its own
  // opener (handleBuy above); the rest share openBuyProviderUrl.
  // The URL is built first so a build failure closes nothing — the
  // pop-up only opens once the URL exists.
  function handleBuyProvider(id: BuyProviderId): void {
    if (devnetEnabled === true) return;
    setBuyProvider(id);
    if (id === 'coinbase') {
      handleBuy();
      return;
    }
    let url: string;
    try {
      switch (id) {
        case 'ramp': {
          const dest = rampDestinations[0];
          const key = rampHostApiKey();
          if (key === null || dest === undefined) return;
          url = buildRampUrl({
            hostApiKey: key,
            userAddress: dest.address,
            enabledCryptoAssets: rampEnabledAssetsFor(dest.chain),
          });
          break;
        }
        case 'moonpay': {
          const key = moonpayPublishableKey();
          if (key === null) return;
          url = buildMoonpayUrl({
            apiKey: key,
            defaultCurrencyCode: moonpayDestinations[0]?.asset,
          });
          break;
        }
        case 'onramper': {
          const key = onramperApiKey();
          if (key === null) return;
          url = buildOnramperUrl({ apiKey: key });
          break;
        }
        case 'banxa': {
          const ref = banxaPartnerRef();
          if (ref === null) return;
          const dest = banxaDestinationList[0];
          url = buildBanxaUrl({
            partnerRef: ref,
            walletAddress: dest?.address,
            coinType: dest?.coinType,
            blockchain: dest?.blockchain,
          });
          break;
        }
        case 'mercuryo': {
          const widgetId = mercuryoWidgetId();
          if (widgetId === null) return;
          url = buildMercuryoUrl({ widgetId });
          break;
        }
        case 'transak':
          return;
      }
    } catch {
      setBuyStatus('load-failed');
      return;
    }
    setBuyStatus('opening');
    const outcome = openBuyProviderUrl(url);
    if (outcome === 'blocked') setBuyStatus('blocked');
    else setBuyStatus('opened');
  }

  // Lane B: what one provider row shows. destination is the address
  // the purchase is delivered to (null when the row pre-fills
  // nothing); buttonLabel null means no button — the row states why.
  function buyRowFor(provider: BuyProviderInfo): {
    destination: string | null;
    buttonLabel: string | null;
    note: string | null;
  } {
    switch (provider.id) {
      case 'ramp': {
        if (provider.readiness !== 'ready') {
          return {
            destination: null,
            buttonLabel: null,
            note: RAMP_RESTRICTIONS,
          };
        }
        const dest = rampDestinations[0];
        if (dest === undefined) {
          return {
            destination: null,
            buttonLabel: null,
            note: RAMP_RESTRICTIONS,
          };
        }
        return {
          destination: dest.address,
          buttonLabel: 'Buy with Ramp',
          note: RAMP_RESTRICTIONS,
        };
      }
      case 'moonpay': {
        if (provider.readiness !== 'ready-no-prefill') {
          return { destination: null, buttonLabel: null, note: null };
        }
        return {
          destination: null,
          buttonLabel: 'Buy with MoonPay',
          note: 'Your address can’t be pre-filled yet — address pre-fill needs a signing backend. You’ll paste your own address inside MoonPay.',
        };
      }
      case 'onramper': {
        if (provider.readiness !== 'ready-no-prefill') {
          return { destination: null, buttonLabel: null, note: null };
        }
        return {
          destination: null,
          buttonLabel: 'Buy with Onramper',
          note: 'Your address can’t be pre-filled yet — passing wallet addresses needs a server-signed URL. You’ll paste your own address inside Onramper.',
        };
      }
      case 'banxa': {
        if (provider.readiness !== 'ready') {
          return {
            destination: null,
            buttonLabel: null,
            note: BANXA_LIMITS,
          };
        }
        const dest = banxaDestinationList[0];
        return {
          destination: dest?.address ?? null,
          buttonLabel: 'Buy with Banxa',
          note: BANXA_LIMITS,
        };
      }
      case 'transak':
        return { destination: null, buttonLabel: null, note: null };
      case 'mercuryo': {
        if (provider.readiness !== 'ready-no-prefill') {
          return { destination: null, buttonLabel: null, note: null };
        }
        return {
          destination: null,
          buttonLabel: 'Buy with Mercuryo',
          note: 'Your address can’t be pre-filled yet — you’ll paste your own address inside Mercuryo.',
        };
      }
      case 'coinbase': {
        if (provider.readiness !== 'ready') {
          return { destination: null, buttonLabel: null, note: null };
        }
        if (buyDestination === null) {
          return { destination: null, buttonLabel: null, note: null };
        }
        return {
          destination: buyDestination.address,
          buttonLabel: 'Buy with Coinbase',
          note: 'Change the network and asset in Coinbase.',
        };
      }
    }
  }

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
  // across all 87 — the same filterChains the watch-only chain
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
    // The PNG is the same card the screen shows, in the picked
    // template — PNG parity first, template variants second. The
    // export is 1080 px wide (the DESIGN.md target); the 640 px
    // floor is the exporter's default for its other callers.
    const networkName =
      devnetEnabled
        ? (devnetChainConfigOrUndefined(chain)?.devnetName ?? config.displayName)
        : config.displayName;
    try {
      return await qrCardToPngFile(
        new XMLSerializer().serializeToString(svg),
        {
          amountText: amountText ?? 'Any amount',
          address,
          tokenLabel: qrCardTokenLabel(effectiveToken, chain),
          title: qrCardTitle(effectiveToken, chain),
          subtitle: qrCardSubtitle(
            chain,
            devnetEnabled
              ? (devnetChainConfigOrUndefined(chain)?.devnetName ??
                config.displayName)
              : undefined,
          ),
          networkName,
          subline:
            effectiveToken === null
              ? undefined
              : qrCardTokenSubline(effectiveToken, chain),
          template: cardTemplate,
          width: 1080,
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

  // Lane D (usable-install) + Lane B (providers Phase 2): ?buy=1
  // renders the Buy provider picker instead of the stepped flow —
  // the dashboard Buy tile links here (/receive?buy=1, the
  // /send?scan=1 precedent). A separate /buy route cannot fit the
  // bundle budget (see onramp.ts): the panel reuses this screen's
  // Card/Button. There is no network picker here on purpose: each
  // widget itself is the picker — the addresses handed to it cover
  // every deliverable network.
  if (buyMode) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-ink">Buy crypto</h1>
        {buyUnavailable !== null ? (
          <Card radius="xl">
            <div className="flex flex-col items-start gap-2 p-4">
              <p className="text-sm font-semibold text-ink">
                {buyUnavailable.title}
              </p>
              <p className="text-sm text-ink">{buyUnavailable.body}</p>
              {buyUnavailable.to !== '/receive' && (
                <Button asChild size="sm">
                  <Link to={buyUnavailable.to}>{buyUnavailable.action}</Link>
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {devnetEnabled === true && (
              <p className="text-sm text-ink">
                Devnet test mode is on — buying delivers real mainnet
                crypto, so it stays off.
              </p>
            )}
            {buyProviders().map((provider) => {
              const row = buyRowFor(provider);
              return (
                <BuyProviderRow
                  key={provider.id}
                  provider={provider}
                  destination={row.destination}
                  buttonLabel={row.buttonLabel}
                  note={row.note}
                  onBuy={() => handleBuyProvider(provider.id)}
                  buyDisabled={
                    devnetEnabled === true || buyStatus === 'opening'
                  }
                  isActive={buyProvider === provider.id}
                  buyStatus={buyStatus}
                />
              );
            })}
            <p className="text-sm text-ink">
              Fees are indicative only — the quote at purchase time is
              authoritative.
            </p>
          </>
        )}
        <p className="text-sm text-ink">
          <Link
            to="/receive"
            className="font-medium text-primary underline underline-offset-4"
          >
            Back to Receive
          </Link>
        </p>
      </div>
    );
  }

  // Desktop layout (desktop-layout-v2): the heading spans both
  // columns; the chain/token pickers sit left and, on the details
  // step, the amount + QR card sit right, sticky while the left
  // column scrolls. Below lg the same blocks stack in one column
  // in the same order (space-y-3, no bare grid class), so the
  // mobile layout is untouched.
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
      <h1 className="text-2xl font-semibold text-ink lg:col-span-2">Receive</h1>
      {/* Lane 7: no step line on the details step — the user has
          completed steps 1–2 and the QR screen says where they are.
          The line's 32 px is what the template row needs to sit
          above the fold at 390 px. Steps 1–2 keep their lines. */}
      {step !== 'details' && (
        <p className="text-body-sm font-medium text-panel-text-muted lg:col-span-2">
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
        {/* Lane H: a sleek network picker, not the 87-button grid.
            Search at the top; Popular first as full-width rows with
            the real chain marks (names never truncated); the rest
            grouped behind "All networks", collapsed by default, so
            the popular chains are reachable without scrolling
            through all 87. Searching replaces both sections with a
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
            height="md"
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
            height="md"
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
                <TokenPickerRow
                  key={`${token.chain}:${token.contract.toLowerCase()}`}
                  selected={selected}
                  onSelect={() => selectToken(token)}
                  logo={
                    <>
                      {/* Lane G: the real token mark (see above) —
                          WETH and the USDT variants resolve to real
                          logos now instead of the yellow ticker badge. */}
                      <TokenLogo
                        symbol={token.symbol}
                        size={24}
                        iconUrl={token.iconUrl ?? null}
                        allowSymbolLogo={isDefaultToken(token)}
                      />
                    </>
                  }
                >
                  {token.name} · {token.symbol}
                  {/* Lane 1: the verified mark on every picker row —
                      an unverified token reads "Unverified". */}
                  {isVerifiedToken(token) ? (
                    <span className="ml-2" aria-label="Verified token">✓ Verified</span>
                  ) : (
                    <span className="ml-2" aria-label="Unverified token">Unverified</span>
                  )}
                  <span className="font-normal text-ink">
                    {` · ${tokenConfig.displayName} · ${shortContract(token.contract)}`}
                  </span>
                </TokenPickerRow>
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
        <>
        <div className="space-y-2">
      <p className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>
          {`${config.displayName} · ${assetSymbol}`}
          {/* Lane 1: the selected token's verified state on the
              details step (the QR card itself is Lane 5's). */}
          {effectiveToken !== null &&
            (isVerifiedToken(effectiveToken) ? (
              <span className="ml-2" aria-label="Verified token">✓ Verified</span>
            ) : (
              <span className="ml-2" aria-label="Unverified token">Unverified</span>
            ))}
        </span>
        <Button type="button" variant="outline" onClick={() => setStep('token')}>
          Back
        </Button>
      </p>

      {/* Fix-all Lane H, item 5: the Receive tagline, removed in Round 2
          item 8 to make the steps fit — restored on the details step,
          where the address it names is shown. */}
      <p className="font-display text-xl text-ink">This is your address — share the drawing, keep the keys.</p>

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

      </div>
      <div className="space-y-2 lg:sticky lg:top-6">
      <Card radius="xl" tone="card" borderTone="border" padding="sm">
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
                onCopyAddress={() => void copyAddress()}
                networkDisplayName={
                  devnetEnabled
                    ? (devnetChainConfigOrUndefined(chain)?.devnetName ??
                      config.displayName)
                    : undefined
                }
                template={cardTemplate}
              />
            </div>
            {/* Lane 4 (redesign): the amount sits directly under the card —
                it is displayed on the card and encoded in its QR, so its
                control belongs beside the card, not a screen below the
                actions. The full address stays on the card above. */}
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
               
              />
              {amountError ? (
                <p role="alert" className="text-sm text-ink bawa-squiggle-underline">{amountError}</p>
              ) : null}
            </div>
{/* Lane 4 (redesign): the share actions sit directly under the
                card + amount unit, in the design system's order — Share,
                Download card, Copy link. Share is the one coral primary,
                full-width at thumb height; the other two share the row
                below it. The old row's "Copy address" is gone (the card's
                own Copy button does that job, in context beside the
                address); "New address" moved to the rotation block below,
                beside the line it explains. All buttons are lg (48 px):
                the old sm (32 px) sizes were below the 44 px touch rule. */}
            <div className="flex w-full flex-col gap-2">
              <Button type="button" size="lg" onClick={() => void sharePayment()}>
                Share
              </Button>
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => void downloadQr()}
                >
                  Download card
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => void copyLink()}
                >
                  Copy link
                </Button>
              </div>
            </div>
            {/* P8 (desktop-layout-v2 follow-up, kept per owner decision
                2026-11-23): the status line renders only when a copy/share
                action has something to report — an always-rendered empty
                <p> leaves ~40 px of dead space under the buttons. Lane 4:
                it sits here, next to the actions it reports on. */}
            {copyStatus !== '' && (
              <p role="status" className="w-full text-center text-sm text-ink">
                {copyStatus}
              </p>
            )}
                        {/* Lane 4 (redesign): the card-style picker is a 2-row grid
                of label-only buttons — seven templates cannot fit the old
                4-segment row with a hint each (hints wrapped to 3 lines).
                All seven are visible at once, no scrolling; the active
                template's hint shows as one line under the grid. Same
                contract: role group, aria-pressed, active = sun,
                accessible names "Show {label} card style". */}
            <p className="w-full text-center text-sm font-semibold text-ink">
              Card style — tap to switch
            </p>
            <div
              role="group"
              aria-label="Card style"
              className="grid w-full grid-cols-4 gap-1 rounded-bawa-sm border-2 border-ink bg-paper p-1"
            >
              {QR_CARD_TEMPLATES.map((candidate) => {
                const active = candidate.id === cardTemplate;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Show ${candidate.label} card style`}
                    title={candidate.hint}
                    onClick={() => setCardTemplate(candidate.id)}
                    className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-bawa-sm p-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${active ? 'bg-sun' : 'hover:bg-sun'}`}
                  >
                    <span className="font-semibold">{candidate.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="w-full text-center text-xs text-ink">
              {QR_CARD_TEMPLATES.find((candidate) => candidate.id === cardTemplate)?.hint}
            </p>
            {paymentUriUnavailable && (
              <p className="text-sm text-ink">
                Requested amount: {amount.trim()} {assetSymbol} (shown as text — TRON has no
                standard payment-request link, so the QR encodes the address only. The share
                link below still carries the amount.)
              </p>
            )}
                        {/* Lane 4 (redesign): the three QR templates stay one control
                with three segments (Lane H's idiom) — but the 64 px mini
                QR thumbnails are gone: all three looked identical at that
                size and no 64 px code is scannable, so they cost ~70 px of
                height for zero information. Compact labelled segments
                (12 px, 44 px hit area); the unavailable segment still
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
                const reason =
                  candidate.value === null
                    ? candidate.id === 'payment' && paymentNeedsAmount
                      ? 'Needs amount'
                      : 'Not available'
                    : null;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={candidate.value === null}
                    aria-pressed={active}
                    aria-label={`Show ${candidate.label.toLowerCase()} QR`}
                    onClick={() => setTemplate(candidate.id)}
                    className={`flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-bawa-sm p-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-sun' : 'hover:bg-sun'}`}
                  >
                    <span className="font-semibold">{candidate.label}</span>
                    {reason !== null && (
                      <span className="text-xs leading-tight">{reason}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {paymentHint !== null && (
              <p className="w-full text-center text-xs text-ink">{paymentHint}</p>
            )}
                        
            {/* The share link is long; the row shows one truncated line
                (the full link stays in the DOM and copies whole). */}
            <p data-testid="receive-share-link" title={shareLink} className="w-full truncate text-center font-mono text-xs text-ink">
              {shareLink}
            </p>
            {/* Lane 4 (redesign): address rotation lives here, with the
                line it explains — not in the share row. "New address" is
                address management, not sharing. */}
            {vaultAddress !== undefined && !isWatchOnly && (
              <p className="w-full text-center text-xs text-ink">
                {`Receiving address ${receiveIndex + 1} of this account.`}
              </p>
            )}
            {canRotate && (
              <div className="flex w-full flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void newReceiveAddress()}
                  disabled={isRotating || !nextReceiveAddress}
                >
                  {isRotating ? 'Making address…' : 'New address'}
                </Button>
                <p className="w-full text-center text-xs leading-[18px] text-muted-foreground">
                  New addresses come from the same phrase. Funds sent to an
                  earlier address still belong to this wallet, but the
                  dashboard only shows your main address on each chain.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-foreground">No receiving address available for this chain.</p>
            <Link to="/import-wallet" className="font-medium text-primary underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        )}
      </Card>

      {/* Lane 4 (redesign): the network warning was said three times
          (alert above the card + these two paragraphs). One paragraph
          now carries it, below the card. */}
      <p className="text-sm text-ink">
        {(() => {
          const devnetConfig = devnetEnabled
            ? devnetChainConfigOrUndefined(chain)
            : undefined;
          return devnetConfig
            ? `Devnet — this address is for the ${devnetConfig.devnetName} test network. Test tokens have no value. Funds sent on another network cannot be recovered — only share this address to receive funds, and check it carefully before accepting funds.`
            : `Mainnet only — this address is for the ${config.displayName} mainnet. Funds sent on another network cannot be recovered — only share this address to receive funds, and check it carefully before accepting funds.`;
        })()}
      </p>

      {chain === 'ton' && (
        <p className="text-sm text-ink">
          This address can only receive TON. To send or withdraw TON, you need an external wallet.
        </p>
      )}
      </div>
      </>
      )}
    </div>
  );
}
