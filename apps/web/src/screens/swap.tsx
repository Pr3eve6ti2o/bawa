// Swap screen (Lane 6, UX-major programme, 2026-11-26).
//
// Swap and bridge assets across networks with minimal manual steps:
// pick a from chain/token and a to chain/token, enter an amount, get a
// real quote, see the route, the fee and the recipient.
//
// QUOTES ONLY. Quotes come live from LI.FI's public routing API
// (https://li.quest/v1/quote — keyless, see wallet/swap-quotes.ts),
// and the screen shows exactly what LI.FI returns: the amount out,
// the route (tool), the network fee and bridge fees in USD, and the
// rough settlement time. There is no execution path here: the LI.FI
// response's `transactionRequest` is never read, nothing signs, and
// mainnet broadcast stays DISABLED until separately authorised. The
// "What happens next" card says so plainly. A pair LI.FI cannot route
// shows "no route", never a guessed number; a failed fetch shows an
// honest unavailable message. Quotes go stale in about a minute, so
// changing the amount, either side, or the recipient clears the quote
// and a fresh one must be fetched.
//
// What LI.FI cannot quote (BTC, TRX, TON, non-EVM chains) is not
// offered in the chain pickers at all: the pickers list only the
// chains LI.FI can route (EVM chains + Solana). OKX's dex-market
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
import { chainConfig } from '../wallet/chains';
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
  SWAP_CHAINS,
  fetchSwapQuote,
  formatQuoteUsd,
  type SwapQuote,
  type SwapQuoteResult,
  type SwapTokenChoice,
} from '../wallet/swap-quotes';
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
  const requestId = useRef(0);
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
  }, [fromChain, toChain, fromToken, toToken, amount, recipient]);

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

  return (
    <div className="space-y-3">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Swap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Swap and bridge across networks. Quotes come live from LI.FI —
          no quote here is ever a guess.
        </p>
      </header>

      <section aria-labelledby="swap-from-heading" className="space-y-2">
        <h2 id="swap-from-heading" className="text-lg font-semibold">
          From
        </h2>
        <ChainSearchSelect
          chains={SWAP_CHAINS}
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
          chains={SWAP_CHAINS}
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
          the quote rate limit; executing a quote needs signing and
          broadcast, which stay switched off until separately approved.
          Nothing on this screen signs or sends anything.
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
