// Swap screen (Lane 6, UX-major programme, 2026-11-26; provider
// comparison + Refuel gas added by Lane C, providers programme
// Phase 2, 2026-11-26).
//
// Swap and bridge assets across networks with minimal manual steps:
// pick a from chain/token and a to chain/token, enter an amount, get
// a real quote, see the route, the fee and the recipient. One swaps
// button, one screen: the quote is compared across the providers
// that cover the pair (LI.FI live today, Relay, STON.fi), with the
// cheapest/best pre-selected, and gas.zip appears as a separate
// "Refuel gas" action — never labelled a swap.
//
// QUOTES ONLY. Quotes come live from LI.FI's public routing API
// (https://li.quest/v1/quote — keyless, see wallet/swap-quotes.ts),
// and the screen shows exactly what LI.FI returns: the amount out,
// the route (tool), the network fee and bridge fees in USD, and the
// rough settlement time. Relay quotes need a proxy or access-token
// endpoint (VITE_RELAY_PROXY_URL) — with none configured the Relay
// row says so plainly and no Relay request is made (see
// wallet/relay-quotes.ts). STON.fi live quotes need its SDK
// (@ston-fi/omniston-sdk@0.8.13, not installed yet), so the STON.fi
// row shows which pairs the corridor would cover and that live
// quotes need the SDK (see wallet/stonfi-quotes.ts). There is no
// execution path here: the LI.FI response's `transactionRequest` is
// never read, nothing signs, and mainnet broadcast stays DISABLED
// until separately authorised. The "What happens next" card says so
// plainly. A pair no provider covers shows "no route", never a
// guessed number; a failed fetch shows an honest unavailable
// message. Quotes go stale in about a minute, so changing the
// amount, either side, or the recipient clears the quote and a fresh
// one must be fetched.
//
// The chain pickers offer every chain at least one provider covers
// (LI.FI's EVM chains + Solana, plus BTC, TRX, TON and XRP through
// Relay — see wallet/swap-providers.ts). Chains no provider covers
// (the Cosmos family, Cardano, Starknet, Litecoin, Dogecoin, Stellar
// and the rest — see UNCOVERED_CHAINS) are not offered at all, and
// the coverage note under the header says so plainly. OKX's dex-market
// price API was evaluated for this screen on 2026-11-26 and NOT used:
// its price/candle endpoints answer 402 Payment Required and its
// index price 401 to anonymous callers from here, and its CORS
// preflight is 403 — so it cannot feed a browser UI keyless today.
// See the lane report for the full verification.
//
// Amounts use EXACT decimals (evm-token-decimals rule): token
// decimals come from the verified DEFAULT_TOKENS list (never an
// assumed 18 — BSC USDT, for one, has 18 decimals while most USDT
// has 6), native decimals from CHAIN_DECIMALS, and the quoted
// amounts are formatted in the destination token's own decimals.
// No hashing happens anywhere on this screen (no selectors,
// signatures or address derivation), so the keccak-vs-sha3 trap
// does not apply here; derivation stays with Wallet Core.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { BawaIcon } from '../ui/components/icons';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { useWallet } from '../state/wallet-context';
import { chainConfig, SUPPORTED_CHAINS } from '../wallet/chains';
import {
  CHAIN_DECIMALS,
  decimalToBaseUnits,
  formatNativeAmount,
  formatNativeWithSymbol,
} from '../wallet/chain-amount-format';
import { DEFAULT_TOKENS, tokenKey } from '../wallet/tokens';
import {
  ChainSearchSelect,
  SWAP_RECENT_CHAINS_KEY,
} from './chain-search-select';
import { ChainLogo, TokenLogo } from './token-logo';
import {
  LIFI_SLIPPAGE,
  fetchSwapQuote,
  formatQuoteUsd,
  type SwapQuote,
  type SwapQuoteResult,
  type SwapTokenChoice,
} from '../wallet/swap-quotes';
import {
  GASZIP_MAX_USD_PER_CHAIN,
  GASZIP_MIN_USD_PER_CHAIN,
  GASZIP_SOLANA_CHAIN_ID,
  fetchGasZipChains,
  fetchGasZipQuote,
  gasZipChainIdFor,
  gasZipDepositChains,
  gasZipLimitCheck,
  gasZipLimitMessage,
  isGasZipQuoteStale,
  type GasZipChain,
  type GasZipQuote,
} from '../wallet/gaszip-refuel';
import {
  fetchRelayQuote,
  type RelayQuoteResult,
} from '../wallet/relay-quotes';
import {
  STONFI_SDK_NEEDED_MESSAGE,
  STONFI_TON_SIGNING_MESSAGE,
  stonfiCoversPair,
  type StonfiCoverage,
} from '../wallet/stonfi-quotes';
import {
  COMPARE_CHAINS,
  PROVIDER_INFO,
  UNCOVERED_CHAINS,
  providersForPair,
  selectBestRoute,
  type ComparableQuote,
  type SwapProviderId,
} from '../wallet/swap-providers';
import type { ChainId } from '../engine/boundary';

/** Native coin of a chain, as a swap choice. */
function nativeChoice(chain: ChainId): SwapTokenChoice {
  const config = chainConfig(chain);
  return { kind: 'native', symbol: config.symbol, decimals: CHAIN_DECIMALS[chain] };
}

/** Stable key for a token choice (native vs one contract). */
function choiceKey(choice: SwapTokenChoice): string {
  return choice.kind === 'native' ? 'native' : choice.contract;
}

/** Token chips for one side: the native coin first, then the verified tokens. */
function TokenChips({
  chain,
  choices,
  selected,
  onSelect,
}: {
  chain: ChainId;
  choices: SwapTokenChoice[];
  selected: SwapTokenChoice;
  onSelect: (choice: SwapTokenChoice) => void;
}) {
  const config = chainConfig(chain);
  return (
    <div
      role="group"
      aria-label={`Token on ${config.displayName}`}
      className="flex flex-wrap gap-2"
    >
      {choices.map((choice) => {
        const isSelected = choiceKey(choice) === choiceKey(selected);
        return (
          <button
            key={choiceKey(choice)}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(choice)}
            className={`flex min-h-11 items-center gap-2 rounded-bawa-sm border-2 border-ink px-3 py-2 text-sm font-medium ${
              isSelected ? 'bg-sun' : 'bg-paper'
            }`}
          >
            {choice.kind === 'native' ? (
              <ChainLogo chain={chain} size={24} />
            ) : (
              <TokenLogo symbol={choice.symbol} size={24} />
            )}
            {choice.symbol}
          </button>
        );
      })}
    </div>
  );
}

/** One label/value row of the quote card. */
function QuoteRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-ink">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
/** Token choices for a chain: the native coin first, then the verified tokens. */
function tokenChoicesFor(chain: ChainId): SwapTokenChoice[] {
  const tokens = DEFAULT_TOKENS.filter((token) => token.chain === chain).map(
    (token) => ({
      kind: 'token' as const,
      contract: token.contract,
      symbol: token.symbol,
      decimals: token.decimals,
    }),
  );
  return [nativeChoice(chain), ...tokens];
}

/** Light recipient-shape check (the quote provider is the authority — a
    bad address comes back as no-route/unavailable, honestly). */
function recipientShapeError(chain: ChainId, address: string): string | null {
  const value = address.trim();
  if (value.length === 0) return 'Recipient address is required.';
  if (chain === 'sol') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
      return 'Invalid Solana address.';
    }
    return null;
  }
  if (chain === 'btc') {
    if (
      !/^(bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
        value,
      )
    ) {
      return 'Invalid Bitcoin address.';
    }
    return null;
  }
  if (chain === 'ton') {
    if (!/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(value)) {
      return 'Invalid TON address.';
    }
    return null;
  }
  if (chain === 'trx') {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) {
      return 'Invalid TRON address.';
    }
    return null;
  }
  if (chain === 'xrp') {
    if (!/^r[0-9a-zA-Z]{24,34}$/.test(value)) {
      return 'Invalid XRP address.';
    }
    return null;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return `Invalid ${chainConfig(chain).displayName} address.`;
  }
  return null;
}

/** Display-only trim of an exact quote amount to at most six fraction
    digits (truncated, never rounded up, so a minimum is never
    overstated). LI.FI quotes can carry 18 decimals; showing all of
    them wraps the card and reads as noise. The quote's own base-unit
    amounts stay exact underneath. */
function formatDisplayAmount(
  baseUnits: string,
  decimals: number,
  symbol: string,
): string {
  const amount = formatNativeAmount(baseUnits, decimals);
  const dot = amount.indexOf('.');
  const trimmed = dot === -1 ? amount : amount.slice(0, dot + 7);
  return `${trimmed} ${symbol}`;
}
/** Display rate from a quote: "1 ETH ≈ 22,095.176693 POL". Display only.
    Exact BigInt math: formatNativeAmount groups thousands (2,209.51…),
    so Number() on its output is NaN for amounts of 1,000 or more — the
    old float version silently dropped the Rate row on exactly those
    quotes (seen live 2026-11-26: 0.1 ETH → 2,209 POL showed no rate). */
function rateText(
  fromBaseUnits: string,
  fromDecimals: number,
  fromSymbol: string,
  toBaseUnits: string,
  toDecimals: number,
  toSymbol: string,
): string | null {
  let from: bigint;
  let to: bigint;
  try {
    from = BigInt(fromBaseUnits);
    to = BigInt(toBaseUnits);
  } catch {
    return null;
  }
  if (from <= 0n || to <= 0n) return null;
  // rate = (to / 10^toDec) / (from / 10^fromDec), scaled by 10^6 so the
  // display keeps six fraction digits, formatted by the shared helper.
  const scaled =
    (to * 10n ** BigInt(fromDecimals) * 1_000_000n) /
    (from * 10n ** BigInt(toDecimals));
  if (scaled <= 0n) return null;
  return `1 ${fromSymbol} ≈ ${formatNativeAmount(scaled.toString(), 6)} ${toSymbol}`;
}

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; quote: SwapQuote; fromAmountBaseUnits: string }
  | { status: 'no-route' }
  | { status: 'unavailable'; reason: string };

/** Relay quote result for the comparison (null until a quote is attempted). */
type RelayState = RelayQuoteResult | null;
/** STON.fi coverage for the comparison (null until a quote is attempted). */
type StonfiState = StonfiCoverage | null;

type RefuelChainsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; chains: GasZipChain[] }
  | { status: 'unavailable'; reason: string };

type RefuelQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; quote: GasZipQuote; fromAmountBaseUnits: string }
  | { status: 'no-route'; reason: string }
  | { status: 'unavailable'; reason: string };

export function SwapScreen() {
  const { vaultState, vaultAddresses, balances, tokenBalances, devnetEnabled } =
    useWallet();
  const [fromChain, setFromChain] = useState<ChainId>('eth');
  const [toChain, setToChain] = useState<ChainId>('matic');
  const [fromToken, setFromToken] = useState<SwapTokenChoice>(() =>
    nativeChoice('eth'),
  );
  const [toToken, setToToken] = useState<SwapTokenChoice>(() =>
    nativeChoice('matic'),
  );
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' });
  const [relayState, setRelayState] = useState<RelayState>(null);
  const [stonfiState, setStonfiState] = useState<StonfiState>(null);
  const [refuelOpen, setRefuelOpen] = useState(false);
  const [refuelChainsState, setRefuelChainsState] =
    useState<RefuelChainsState>({ status: 'idle' });
  const [refuelFromChain, setRefuelFromChain] = useState<ChainId>('eth');
  const [refuelToChain, setRefuelToChain] = useState<ChainId>('base');
  const [refuelAmount, setRefuelAmount] = useState('');
  const [refuelQuoteState, setRefuelQuoteState] =
    useState<RefuelQuoteState>({ status: 'idle' });
  const requestId = useRef(0);
  const refuelRequestId = useRef(0);
  const lastAutoRecipient = useRef<string | null>(null);

  const fromChoices = useMemo(() => tokenChoicesFor(fromChain), [fromChain]);
  const toChoices = useMemo(() => tokenChoicesFor(toChain), [toChain]);
  const fromConfig = chainConfig(fromChain);
  const toConfig = chainConfig(toChain);
  const fromAddress = (vaultAddresses[fromChain] ?? [])[0] ?? null;
  const toAddressDefault = (vaultAddresses[toChain] ?? [])[0] ?? '';

  // The recipient defaults to the wallet's own address on the
  // destination chain. A hand-typed recipient is never overwritten:
  // only an empty field, or one still holding the previous auto value,
  // follows the destination chain.
  useEffect(() => {
    if (recipient === '' || recipient === lastAutoRecipient.current) {
      setRecipient(toAddressDefault);
      lastAutoRecipient.current = toAddressDefault;
    }
  }, [toChain, toAddressDefault, recipient]);

  // A quote belongs to one exact request: changing either side, the
  // amount or the recipient clears it, so nobody acts on a stale one.
  // LI.FI quotes stale in about a minute in any case (see the card).
  useEffect(() => {
    setQuoteState({ status: 'idle' });
    setRelayState(null);
    setStonfiState(null);
  }, [fromChain, toChain, fromToken, toToken, amount, recipient]);

  // A refuel quote belongs to one exact request too: changing either
  // chain or the amount clears it.
  useEffect(() => {
    setRefuelQuoteState({ status: 'idle' });
  }, [refuelFromChain, refuelToChain, refuelAmount]);

  // Balance for the amount being swapped (native or token). Missing or
  // failed balances do not block a quote — the quote is informational
  // and the balance is shown, not enforced, except when it is known.
  const fromBalanceBaseUnits: string | null = (() => {
    if (fromToken.kind === 'native') {
      const balance = balances[fromChain];
      if (balance === undefined) return null;
      if (balance.status !== 'available' && balance.status !== 'zero') return null;
      return balance.value ?? '0';
    }
    const entry = (tokenBalances ?? {})[tokenKey(fromChain, fromToken.contract)];
    if (entry === undefined) return null;
    if (entry.status !== 'available' && entry.status !== 'zero') return null;
    return entry.value ?? '0';
  })();
  const fromBalanceText =
    fromBalanceBaseUnits === null
      ? 'Balance unavailable'
      : formatNativeWithSymbol(
          fromBalanceBaseUnits,
          fromToken.decimals,
          fromToken.symbol,
        );

  const amountBaseUnits =
    amount.trim() === '' ? null : decimalToBaseUnits(amount, fromToken.decimals);
  const amountError =
    amount.trim() === ''
      ? null
      : amountBaseUnits === null
        ? 'Enter a valid amount.'
        : BigInt(amountBaseUnits) === 0n
          ? 'Enter an amount above zero.'
          : fromBalanceBaseUnits !== null &&
              BigInt(amountBaseUnits) > BigInt(fromBalanceBaseUnits)
            ? 'Amount exceeds available balance.'
            : null;
  const recipientError = recipientShapeError(toChain, recipient);

  // The balance error stays visible next to the field, but it never
  // blocks the quote: a quote is free and signs nothing, so the
  // balance gate belongs at execution time, not quote time — an
  // unfunded wallet can still price a swap before funding it. Only
  // an amount that is not a number, or zero, blocks the quote.
  const amountBlockingError =
    amount.trim() === ''
      ? null
      : amountBaseUnits === null
        ? 'Enter a valid amount.'
        : BigInt(amountBaseUnits) === 0n
          ? 'Enter an amount above zero.'
          : null;

  const quoteDisabledReason = devnetEnabled
    ? 'Quotes are for mainnet. Switch off devnet test mode to get a quote.'
    : fromAddress === null
      ? `Your wallet has no address on ${fromConfig.displayName}.`
      : amount.trim() === ''
        ? 'Enter an amount to get a quote.'
        : amountBlockingError !== null
          ? amountBlockingError
          : recipientError !== null
            ? recipientError
            : null;
  const quoteBusy = quoteState.status === 'loading';

  async function handleGetQuote(): Promise<void> {
    if (quoteDisabledReason !== null || quoteBusy) return;
    if (amountBaseUnits === null || fromAddress === null) return;
    const id = ++requestId.current;
    setQuoteState({ status: 'loading' });
    const result: SwapQuoteResult = await fetchSwapQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmountBaseUnits: amountBaseUnits,
      fromAddress,
      toAddress: recipient.trim(),
    });
    if (requestId.current !== id) return;
    // Relay quotes run through the configured proxy when one exists;
    // with none configured this returns not-configured without
    // touching the network. STON.fi coverage is a pure table check —
    // live quotes need its SDK, so the row states that plainly.
    const relayResult: RelayQuoteResult = await fetchRelayQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmountBaseUnits: amountBaseUnits,
      fromAddress,
      toAddress: recipient.trim(),
    });
    if (requestId.current !== id) return;
    setRelayState(relayResult);
    setStonfiState(stonfiCoversPair(fromChain, fromToken, toChain, toToken));
    if (result.status === 'ok') {
      setQuoteState({ status: 'ok', quote: result.quote, fromAmountBaseUnits: amountBaseUnits });
    } else if (result.status === 'no-route') {
      setQuoteState({ status: 'no-route' });
    } else {
      setQuoteState({ status: 'unavailable', reason: result.reason });
    }
  }

  function handleFlip(): void {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
  }

  function handleFromChainChange(chain: ChainId): void {
    setFromChain(chain);
    setFromToken(nativeChoice(chain));
  }

  function handleToChainChange(chain: ChainId): void {
    setToChain(chain);
    setToToken(nativeChoice(chain));
  }

  // ---- Refuel gas (gas.zip) ----
  // The chain list is fetched live only when the section is opened —
  // never on mount, so the swap quote flow makes no extra request.
  const refuelLiveChains: GasZipChain[] =
    refuelChainsState.status === 'ok' ? refuelChainsState.chains : [];
  const refuelDepositChains = useMemo(
    () =>
      gasZipDepositChains(refuelLiveChains).filter(
        (chain) => (vaultAddresses[chain] ?? []).length > 0,
      ),
    [refuelLiveChains, vaultAddresses],
  );
  const refuelDestinationChains = useMemo(() => {
    const liveIds = new Set(
      refuelLiveChains.filter((entry) => entry.mainnet).map((entry) => entry.chainId),
    );
    const depositId = gasZipChainIdFor(refuelFromChain);
    return SUPPORTED_CHAINS.filter((chain) => {
      const id = gasZipChainIdFor(chain);
      return (
        id !== null &&
        id !== depositId &&
        id !== GASZIP_SOLANA_CHAIN_ID &&
        liveIds.has(id) &&
        (vaultAddresses[chain] ?? []).length > 0
      );
    });
  }, [refuelLiveChains, refuelFromChain, vaultAddresses]);

  // When the live list lands, keep the two pickers on chains it
  // actually offers (the defaults are ETH -> Base, which the list
  // carries — this only corrects a stale pick).
  useEffect(() => {
    if (refuelChainsState.status !== 'ok') return;
    if (
      refuelDepositChains.length > 0 &&
      !refuelDepositChains.includes(refuelFromChain)
    ) {
      setRefuelFromChain(refuelDepositChains[0] as ChainId);
    }
    if (
      refuelDestinationChains.length > 0 &&
      !refuelDestinationChains.includes(refuelToChain)
    ) {
      setRefuelToChain(refuelDestinationChains[0] as ChainId);
    }
  }, [
    refuelChainsState,
    refuelDepositChains,
    refuelDestinationChains,
    refuelFromChain,
    refuelToChain,
  ]);

  async function handleLoadRefuelChains(): Promise<void> {
    setRefuelChainsState({ status: 'loading' });
    const result = await fetchGasZipChains();
    setRefuelChainsState(
      result.status === 'ok'
        ? { status: 'ok', chains: result.chains }
        : { status: 'unavailable', reason: result.reason },
    );
  }

  function handleToggleRefuel(): void {
    const next = !refuelOpen;
    setRefuelOpen(next);
    if (
      next &&
      (refuelChainsState.status === 'idle' ||
        refuelChainsState.status === 'unavailable')
    ) {
      void handleLoadRefuelChains();
    }
  }

  const refuelFromConfig = chainConfig(refuelFromChain);
  const refuelToConfig = chainConfig(refuelToChain);
  const refuelFromAddress = (vaultAddresses[refuelFromChain] ?? [])[0] ?? null;
  const refuelToAddress = (vaultAddresses[refuelToChain] ?? [])[0] ?? '';
  const refuelDepositPriceUsd =
    refuelLiveChains.find(
      (entry) => entry.chainId === gasZipChainIdFor(refuelFromChain),
    )?.priceUsd ?? null;
  const refuelAmountBaseUnits =
    refuelAmount.trim() === ''
      ? null
      : decimalToBaseUnits(refuelAmount, CHAIN_DECIMALS[refuelFromChain]);
  // Display-only USD estimate from gas.zip's live price, for the
  // $0.25–$50 per-chain gate. The quote's own per-chain `usd` is the
  // authority and is re-checked when it lands.
  const refuelEstimatedUsd =
    refuelAmount.trim() === '' ||
    refuelDepositPriceUsd === null ||
    Number.isNaN(Number(refuelAmount))
      ? null
      : Number(refuelAmount) * refuelDepositPriceUsd;
  const refuelLimitCheck = gasZipLimitCheck(refuelEstimatedUsd);
  const refuelLimitMessageText = gasZipLimitMessage(refuelLimitCheck);
  const refuelAmountError =
    refuelAmount.trim() === ''
      ? null
      : refuelAmountBaseUnits === null
        ? 'Enter a valid amount.'
        : BigInt(refuelAmountBaseUnits) === 0n
          ? 'Enter an amount above zero.'
          : null;
  const refuelDisabledReason = devnetEnabled
    ? 'Refuel quotes are for mainnet. Switch off devnet test mode to get a quote.'
    : refuelChainsState.status !== 'ok'
      ? 'The gas.zip chain list has not loaded yet.'
      : refuelFromAddress === null
        ? `Your wallet has no address on ${refuelFromConfig.displayName}.`
        : refuelToAddress === ''
          ? `Your wallet has no address on ${refuelToConfig.displayName}.`
          : refuelAmount.trim() === ''
            ? 'Enter an amount to get a refuel quote.'
            : refuelAmountError !== null
              ? refuelAmountError
              : refuelLimitMessageText !== null
                ? refuelLimitMessageText
                : null;
  const refuelBusy = refuelQuoteState.status === 'loading';

  async function handleGetRefuelQuote(): Promise<void> {
    if (refuelDisabledReason !== null || refuelBusy) return;
    if (refuelAmountBaseUnits === null || refuelFromAddress === null) return;
    const id = ++refuelRequestId.current;
    setRefuelQuoteState({ status: 'loading' });
    const result = await fetchGasZipQuote({
      fromChain: refuelFromChain,
      toChain: refuelToChain,
      fromAmountBaseUnits: refuelAmountBaseUnits,
      fromAddress: refuelFromAddress,
      toAddress: refuelToAddress,
    });
    if (refuelRequestId.current !== id) return;
    if (result.status === 'ok') {
      setRefuelQuoteState({
        status: 'ok',
        quote: result.quote,
        fromAmountBaseUnits: refuelAmountBaseUnits,
      });
    } else if (result.status === 'no-route') {
      setRefuelQuoteState({ status: 'no-route', reason: result.reason });
    } else {
      setRefuelQuoteState({ status: 'unavailable', reason: result.reason });
    }
  }

  if (vaultState === 'no-vault') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Swap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No wallet yet. Create or import a wallet first — a swap quote
          needs your address on the network you swap from.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/create-wallet"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Create a wallet
          </Link>
          <Link
            to="/import-wallet"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Import a wallet
          </Link>
        </div>
      </div>
    );
  }

  if (vaultState === 'locked') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Swap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your wallet is locked. Unlock it to get a swap quote.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/lock"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Unlock your wallet
          </Link>
        </div>
      </div>
    );
  }

  // Display rate for the live quote, computed once (display only —
  // the quote's own amounts are the source of truth).
  const quoteRate =
    quoteState.status === 'ok'
      ? rateText(
          quoteState.fromAmountBaseUnits,
          fromToken.decimals,
          fromToken.symbol,
          quoteState.quote.toAmountBaseUnits,
          toToken.decimals,
          toToken.symbol,
        )
      : null;

  // Provider comparison for the attempted pair: only live quotes
  // compete, and the cheapest wins (Relay, then STON.fi, then LI.FI
  // on ties). The comparison renders only after a quote attempt, so
  // it always describes the pair that was actually quoted.
  const pairProviders = providersForPair(fromChain, fromToken, toChain, toToken);
  const comparableQuotes: ComparableQuote[] = [];
  if (quoteState.status === 'ok') {
    comparableQuotes.push({
      provider: 'lifi',
      toAmountBaseUnits: quoteState.quote.toAmountBaseUnits,
      toAmountUsd: quoteState.quote.toAmountUsd,
    });
  }
  if (relayState?.status === 'ok') {
    comparableQuotes.push({
      provider: 'relay',
      toAmountBaseUnits: relayState.quote.toAmountBaseUnits,
      toAmountUsd: relayState.quote.toAmountUsd,
    });
  }
  const bestProvider: SwapProviderId | null = selectBestRoute(comparableQuotes);
  const uncoveredNames = UNCOVERED_CHAINS.slice(0, 5)
    .map((chain) => chainConfig(chain).displayName)
    .join(', ');
  const uncoveredRest = UNCOVERED_CHAINS.length - 5;

  return (
    <div className="space-y-3">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Swap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Swap and bridge across networks. Quotes come live from LI.FI,
          compared with Relay and STON.fi where they cover the pair —
          no quote here is ever a guess.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No provider covers every network — {UNCOVERED_CHAINS.length}{' '}
          networks have no swap provider in this wallet yet, including{' '}
          {uncoveredNames}
          {uncoveredRest > 0 ? ` and ${uncoveredRest} more` : ''}.
        </p>
      </header>

      <section aria-labelledby="swap-from-heading" className="space-y-2">
        <h2 id="swap-from-heading" className="text-lg font-semibold">
          From
        </h2>
        <ChainSearchSelect
          chains={COMPARE_CHAINS}
          value={fromChain}
          onChange={handleFromChainChange}
          id="swap-from-chain"
          recentKey={SWAP_RECENT_CHAINS_KEY}
        />
        <TokenChips
          chain={fromChain}
          choices={fromChoices}
          selected={fromToken}
          onSelect={setFromToken}
        />
        <div className="space-y-2">
          <Label htmlFor="swap-amount">{`Amount (${fromToken.symbol})`}</Label>
          <div className="flex h-14 items-center gap-2 rounded-bawa border-2 border-ink bg-paper pl-4 pr-2">
            <input
              id="swap-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              autoComplete="off"
              aria-invalid={amountError !== null}
              aria-describedby={amountError !== null ? 'swap-amount-error' : undefined}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-ink selection:bg-sun selection:text-ink focus-visible:underline focus-visible:decoration-wavy focus-visible:decoration-coral focus-visible:underline-offset-8 aria-invalid:underline aria-invalid:decoration-wavy aria-invalid:decoration-coral aria-invalid:underline-offset-8"
            />
          </div>
          {amountError && (
            <p id="swap-amount-error" role="alert" className="text-sm text-ink bawa-squiggle-underline">
              {amountError}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Balance: {fromBalanceText}
          </p>
        </div>
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Switch direction"
          onClick={handleFlip}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-paper transition-transform active:scale-95"
        >
          <BawaIcon name="swap" className="size-6 text-ink" aria-hidden="true" />
        </button>
      </div>

      <section aria-labelledby="swap-to-heading" className="space-y-2">
        <h2 id="swap-to-heading" className="text-lg font-semibold">
          To
        </h2>
        <ChainSearchSelect
          chains={COMPARE_CHAINS}
          value={toChain}
          onChange={handleToChainChange}
          id="swap-to-chain"
          recentKey={SWAP_RECENT_CHAINS_KEY}
        />
        <TokenChips
          chain={toChain}
          choices={toChoices}
          selected={toToken}
          onSelect={setToToken}
        />
        <div className="space-y-2">
          <Label htmlFor="swap-recipient">
            {`Recipient address on ${toConfig.displayName}`}
          </Label>
          <Input
            id="swap-recipient"
            type="text"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={`${toConfig.displayName} address`}
            autoComplete="off"
            aria-invalid={recipientError !== null}
            aria-describedby={recipientError !== null ? 'swap-recipient-error' : undefined}
          />
          {recipientError && (
            <p id="swap-recipient-error" role="alert" className="text-sm text-ink bawa-squiggle-underline">
              {recipientError}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Defaults to your address on {toConfig.displayName}. The swap
            would send there — change it only if you mean to.
          </p>
        </div>
      </section>

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          disabled={quoteDisabledReason !== null || quoteBusy}
          onClick={() => void handleGetQuote()}
        >
          {quoteBusy ? 'Getting a quote…' : 'Get quote'}
        </Button>
        {quoteDisabledReason !== null && (
          <p className="text-sm text-muted-foreground">{quoteDisabledReason}</p>
        )}
      </div>

      {quoteState.status === 'idle' && (
        <p className="text-sm text-muted-foreground">
          No quote yet — enter an amount and get a quote. Quotes are live
          from LI.FI and free to check; getting one signs and sends nothing.
        </p>
      )}
      {quoteState.status === 'loading' && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Getting a quote from LI.FI…
        </p>
      )}
      {quoteState.status === 'no-route' && (
        <p role="alert" className="text-sm text-ink">
          LI.FI found no route for this pair right now. Try a different
          token or network.
        </p>
      )}
      {quoteState.status === 'unavailable' && (
        <p role="alert" className="text-sm text-ink">
          {quoteState.reason}
        </p>
      )}
      {quoteState.status === 'ok' && (
        <section
          aria-labelledby="swap-quote-heading"
          className="space-y-1 rounded-bawa-sm border-2 border-ink bg-paper p-3 text-sm"
        >
          <h2 id="swap-quote-heading" className="text-base font-semibold">
            Quote
          </h2>
          <div className="flex justify-between gap-3">
            <span className="shrink-0 text-ink">You receive</span>
            <span className="min-w-0 text-right font-semibold">
              {formatDisplayAmount(
                quoteState.quote.toAmountBaseUnits,
                toToken.decimals,
                toToken.symbol,
              )}
              {formatQuoteUsd(quoteState.quote.toAmountUsd) !== null &&
                ` (${formatQuoteUsd(quoteState.quote.toAmountUsd)})`}
            </span>
          </div>
          {quoteRate !== null && (
            <QuoteRow label="Rate">{quoteRate}</QuoteRow>
          )}
          <QuoteRow label="Minimum received">
            {formatDisplayAmount(
              quoteState.quote.toAmountMinBaseUnits,
              toToken.decimals,
              toToken.symbol,
            )}
          </QuoteRow>
          <QuoteRow label="Route">
            {quoteState.quote.tool} via LI.FI
          </QuoteRow>
          <QuoteRow label="Network fee">
            {quoteState.quote.gasUsd !== null ||
            quoteState.quote.feeUsd !== null
              ? [
                  quoteState.quote.gasUsd !== null
                    ? `${formatQuoteUsd(quoteState.quote.gasUsd)} gas`
                    : null,
                  quoteState.quote.feeUsd !== null
                    ? `${formatQuoteUsd(quoteState.quote.feeUsd)} bridge fees`
                    : null,
                ]
                  .filter((part) => part !== null)
                  .join(' + ')
              : 'Not reported by LI.FI'}
          </QuoteRow>
          <QuoteRow label="Arrives in">
            {quoteState.quote.executionDurationSeconds !== null
              ? `About ${quoteState.quote.executionDurationSeconds} second${quoteState.quote.executionDurationSeconds === 1 ? '' : 's'}`
              : 'Not reported by LI.FI'}
          </QuoteRow>
          <QuoteRow label="Slippage tolerance">
            {(LIFI_SLIPPAGE * 100).toFixed(0)}%
          </QuoteRow>
          <p className="text-sm text-muted-foreground">
            Quote from LI.FI, fetched{' '}
            {new Date(quoteState.quote.fetchedAtMs).toLocaleTimeString('en-GB')}.
            Quotes go stale in about a minute — fetch a fresh one before
            acting on it.
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={quoteBusy}
            onClick={() => void handleGetQuote()}
          >
            Refresh quote
          </Button>
        </section>
      )}

      {quoteState.status !== 'idle' && quoteState.status !== 'loading' && (
        <section
          aria-labelledby="swap-compare-heading"
          className="space-y-3 rounded-bawa-sm border-2 border-ink bg-paper p-3 text-sm"
        >
          <h2 id="swap-compare-heading" className="text-base font-semibold">
            Compare providers
          </h2>
          <div className="space-y-1">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">LI.FI</span>
              <span className="text-right text-muted-foreground">
                {PROVIDER_INFO.lifi.feeNote}
              </span>
            </div>
            {quoteState.status === 'ok' ? (
              <p>
                {formatDisplayAmount(
                  quoteState.quote.toAmountBaseUnits,
                  toToken.decimals,
                  toToken.symbol,
                )}
                {formatQuoteUsd(quoteState.quote.toAmountUsd) !== null &&
                  ` (${formatQuoteUsd(quoteState.quote.toAmountUsd)})`}
                {bestProvider === 'lifi' ? ' — Best quote' : ''}
              </p>
            ) : quoteState.status === 'no-route' ? (
              <p>
                LI.FI found no route for this pair right now. Try a
                different token or network.
              </p>
            ) : (
              <p>{quoteState.reason}</p>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">Relay</span>
              <span className="text-right text-muted-foreground">
                {PROVIDER_INFO.relay.feeNote}
              </span>
            </div>
            {(() => {
              const coverage = pairProviders.find(
                (entry) => entry.provider === 'relay',
              );
              if (coverage?.status === 'not-covered') {
                return <p>{coverage.reason}</p>;
              }
              if (relayState === null) {
                return <p>Checking Relay…</p>;
              }
              if (relayState.status === 'not-configured') {
                return <p>{relayState.reason}.</p>;
              }
              if (relayState.status === 'ok') {
                return (
                  <p>
                    {formatDisplayAmount(
                      relayState.quote.toAmountBaseUnits,
                      toToken.decimals,
                      toToken.symbol,
                    )}
                    {formatQuoteUsd(relayState.quote.toAmountUsd) !== null &&
                      ` (${formatQuoteUsd(relayState.quote.toAmountUsd)})`}
                    {bestProvider === 'relay' ? ' — Best quote' : ''}
                  </p>
                );
              }
              if (relayState.status === 'no-route') {
                return <p>Relay found no route for this pair.</p>;
              }
              return <p>{relayState.reason}</p>;
            })()}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">STON.fi</span>
              <span className="text-right text-muted-foreground">
                {PROVIDER_INFO.stonfi.feeNote}
              </span>
            </div>
            {stonfiState === null ? (
              <p>Checking STON.fi…</p>
            ) : !stonfiState.covered ? (
              <p>{stonfiState.reason}</p>
            ) : (
              <>
                <p>{STONFI_SDK_NEEDED_MESSAGE}</p>
                {(fromChain === 'ton' || toChain === 'ton') && (
                  <p>{STONFI_TON_SIGNING_MESSAGE}</p>
                )}
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Only live quotes compete — the cheapest expected output wins.
            A provider that is not set up yet never wins by default.
          </p>
        </section>
      )}

      <section
        aria-labelledby="refuel-heading"
        className="space-y-2 rounded-bawa-sm border-2 border-dashed border-ink bg-paper p-3 text-sm"
      >
        <h2 id="refuel-heading" className="text-base font-semibold">
          Refuel gas
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          Out of gas on a new network? gas.zip sends a little of that
          network&apos;s native coin to it, so you can transact there.
          This is a refuel, not a swap — it moves no tokens, only
          native gas, between ${GASZIP_MIN_USD_PER_CHAIN.toFixed(2)} and
          ${GASZIP_MAX_USD_PER_CHAIN.toFixed(2)} per network. Quotes are
          live from gas.zip; the fee lives only in the quote, so the
          expected amount is shown before anything is signed. Nothing
          here signs or sends anything.
        </p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-expanded={refuelOpen}
          onClick={handleToggleRefuel}
        >
          {refuelOpen ? 'Close refuel' : 'Refuel gas'}
        </Button>
        {refuelOpen && refuelChainsState.status === 'loading' && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Loading the gas.zip chain list…
          </p>
        )}
        {refuelOpen && refuelChainsState.status === 'unavailable' && (
          <>
            <p role="alert" className="text-sm text-ink">
              {refuelChainsState.reason}
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void handleLoadRefuelChains()}
            >
              Try again
            </Button>
          </>
        )}
        {refuelOpen && refuelChainsState.status === 'ok' && (
          <>
            <p className="text-sm text-muted-foreground">
              Solana is listed by gas.zip but live quotes fail there right
              now, so it is not offered as a destination.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">From network</p>
              <ChainSearchSelect
                chains={refuelDepositChains}
                value={refuelFromChain}
                onChange={setRefuelFromChain}
                id="refuel-from-chain"
                recentKey={SWAP_RECENT_CHAINS_KEY}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">To network</p>
              <ChainSearchSelect
                chains={refuelDestinationChains}
                value={refuelToChain}
                onChange={setRefuelToChain}
                id="refuel-to-chain"
                recentKey={SWAP_RECENT_CHAINS_KEY}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refuel-amount">
                {`Amount (${refuelFromConfig.symbol})`}
              </Label>
              <Input
                id="refuel-amount"
                type="text"
                inputMode="decimal"
                value={refuelAmount}
                onChange={(event) => setRefuelAmount(event.target.value)}
                placeholder="0.0"
                autoComplete="off"
                aria-invalid={refuelAmountError !== null}
                aria-describedby={
                  refuelAmountError !== null ? 'refuel-amount-error' : undefined
                }
              />
              {refuelAmountError && (
                <p
                  id="refuel-amount-error"
                  role="alert"
                  className="text-sm text-ink bawa-squiggle-underline"
                >
                  {refuelAmountError}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {refuelEstimatedUsd !== null
                  ? `About $${refuelEstimatedUsd.toFixed(2)} at gas.zip's live price.`
                  : 'Enter an amount to see its dollar value.'}
              </p>
              {refuelLimitMessageText !== null && refuelAmount.trim() !== '' && (
                <p role="alert" className="text-sm text-ink">
                  {refuelLimitMessageText}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                size="lg"
                disabled={refuelDisabledReason !== null || refuelBusy}
                onClick={() => void handleGetRefuelQuote()}
              >
                {refuelBusy ? 'Getting a refuel quote…' : 'Get refuel quote'}
              </Button>
              {refuelDisabledReason !== null && (
                <p className="text-sm text-muted-foreground">
                  {refuelDisabledReason}
                </p>
              )}
            </div>
            {refuelQuoteState.status === 'idle' && (
              <p className="text-sm text-muted-foreground">
                No refuel quote yet — enter an amount and get one. Getting
                one signs and sends nothing.
              </p>
            )}
            {refuelQuoteState.status === 'loading' && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Getting a refuel quote from gas.zip…
              </p>
            )}
            {refuelQuoteState.status === 'no-route' && (
              <p role="alert" className="text-sm text-ink">
                {refuelQuoteState.reason}
              </p>
            )}
            {refuelQuoteState.status === 'unavailable' && (
              <p role="alert" className="text-sm text-ink">
                {refuelQuoteState.reason}
              </p>
            )}
            {refuelQuoteState.status === 'ok' && (
              <section
                aria-labelledby="refuel-quote-heading"
                className="space-y-1 rounded-bawa-sm border-2 border-ink bg-paper p-3 text-sm"
              >
                <h3
                  id="refuel-quote-heading"
                  className="text-base font-semibold"
                >
                  Refuel quote
                </h3>
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-ink">You receive</span>
                  <span className="min-w-0 text-right font-semibold">
                    {formatDisplayAmount(
                      refuelQuoteState.quote.quotes[0]?.expectedBaseUnits ?? '0',
                      CHAIN_DECIMALS[refuelToChain],
                      refuelToConfig.symbol,
                    )}
                    {refuelQuoteState.quote.quotes[0]?.usd !== null &&
                      refuelQuoteState.quote.quotes[0]?.usd !== undefined &&
                      ` ($${refuelQuoteState.quote.quotes[0].usd.toFixed(2)})`}
                  </span>
                </div>
                <QuoteRow label="Arrives in">
                  {refuelQuoteState.quote.quotes[0]?.speedSeconds !== null &&
                  refuelQuoteState.quote.quotes[0]?.speedSeconds !== undefined
                    ? `About ${refuelQuoteState.quote.quotes[0].speedSeconds} second${refuelQuoteState.quote.quotes[0].speedSeconds === 1 ? '' : 's'}`
                    : 'Not reported by gas.zip'}
                </QuoteRow>
                <QuoteRow label="Deposit address">
                  <span className="break-all">
                    {refuelQuoteState.quote.depositTo}
                  </span>
                </QuoteRow>
                <p className="text-sm text-muted-foreground">
                  Quote from gas.zip, fetched{' '}
                  {new Date(
                    refuelQuoteState.quote.fetchedAtMs,
                  ).toLocaleTimeString('en-GB')}
                  . Refuelling would send one transaction to the deposit
                  address above — that step is not switched on yet, so
                  this screen only shows the quote. Quotes go stale in
                  about a minute — fetch a fresh one before acting on
                  it.
                </p>
                {isGasZipQuoteStale(refuelQuoteState.quote) && (
                  <p role="alert" className="text-sm text-ink">
                    This quote is stale — fetch a fresh one.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={refuelBusy}
                  onClick={() => void handleGetRefuelQuote()}
                >
                  Refresh refuel quote
                </Button>
              </section>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="swap-next-heading"
        className="space-y-2 rounded-bawa-sm border-2 border-dashed border-ink bg-paper p-3 text-sm"
      >
        <h2 id="swap-next-heading" className="text-base font-semibold">
          What happens next
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          Swaps are not executed in this wallet yet. A quote shows what a
          swap would cost — to run one, the wallet needs a swap provider
          set up, your approval to sign, and broadcast switched on. A
          free LI.FI API key (from the LI.FI Partner Portal) would raise
          the quote rate limit. Relay quotes need a proxy or
          access-token endpoint, and live STON.fi quotes need the RFQ
          flow wired up (its SDK is installed, and TON order signing is
          wired) — neither is set up yet. Executing a quote needs the
          owner&apos;s separate broadcast authorisation, which stays
          switched off until approved. Nothing on this screen signs or
          sends anything.
        </p>
        <Link
          to="/send"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Send on the same network instead
        </Link>
      </section>
    </div>
  );
}
