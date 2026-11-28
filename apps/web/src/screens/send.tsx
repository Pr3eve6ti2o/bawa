// Send screen (Phase 4, assembled hands-on from Sol p1/p2/p3/p5 + probes).
// Stepped flow (Round 2, item 8): chain → token → address + amount in
// one place → review → offline sign → result. Each step fits the
// viewport without scrolling to reach the next control: the chain step
// is chips only, the token step lists one chain's assets, and the
// recipient and amount share one step. Broadcast is DISABLED until
// separately authorised: the flow signs offline and stops there. Nothing
// here broadcasts, and the UI never presents send as working — the review
// and result both state the broadcast block plainly, and the only action
// after review is "Sign offline".
// TEMPORARY devnet mode (owner order 2026-11-22) is the one exception:
// when devnet is on, the signed transaction broadcasts to the test
// network via broadcastSignedDevnet. Mainnet still never broadcasts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AddressIdenticon } from '../ui/components/address-identicon';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { BawaIcon, ScanIcon } from '../ui/components/icons';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import {
  ensureAdapters,
  ensureDevnetAdapters,
  humanReasonMessage,
  useWallet,
} from '../state/wallet-context';
import { chainConfig, SUPPORTED_CHAINS } from '../wallet/chains';
import { readAddressBook, shortAddress } from '../wallet/address-book';
import { EVM_TX_CHAINS, isEvmTxChain } from '../wallet/watch-only-families';
import {
  DEVNET_CHAIN_CONFIGS,
  DEVNET_CHAINS,
  devnetChainConfigOrUndefined,
} from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, decimalToBaseUnits, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { fiatMinorUnits, formatFeePreview, formatFiatUSD } from '../wallet/money';
import { describeFeeEstimate, buildFeeBreakdown } from '../wallet/fee-display';
import { isEnsName, resolveEnsName } from '../wallet/ens';
import {
  deriveFeeTiers,
  formatGwei,
  type FeeTier,
  type FeeTierBase,
  type FeeTierId,
  type FeeTierSelection,
} from '../wallet/fee-tiers';
import {
  isFreshQuote,
  usdPriceToMinorUnitsPerWhole,
  usePrices,
  type PriceEntry,
} from '../wallet/prices';
import { useTokenPrices } from '../wallet/token-prices';
import { usePriceFeedAutoRefresh } from './use-live-prices';
import {
  clearPendingSendLink,
  parseBawaSendLink,
  parsePaymentUri,
  readPendingSendLink,
  savePendingSendLink,
  type BawaSendLinkParams,
} from '../wallet/payment-links';
import {
  DEFAULT_TOKENS,
  isDefaultToken,
  isVerifiedToken,
  orderAssetsByBalance,
  tokenKey,
  tokenKeyOf,
  tokenSlug,
  tokenStandardFor,
  type TokenRecord,
} from '../wallet/tokens';
import {
  validateRecipient,
  previewSendAmount,
  simulateSend,
  signEvmOffline,
  signBtcOffline,
  signTrxOffline,
  signTonOffline,
  signSolOffline,
  broadcastSignedDevnet,
  buildErc20TransferData,
  ERC20_GAS_LIMIT,
  estimateTokenSendFee,
  previewTokenSendAmount,
  signEvmTokenOffline,
  signJettonOffline,
  signSplOffline,
  signTrc20Offline,
  simulateTokenSend,
  type SendFailure,
  type SendPreview,
  type TokenSendPreview,
} from '../wallet/send';
import { getLatestBlockHeader } from '../wallet/adapters/trx';
import { fetchSolanaAccountExists } from '../wallet/adapters/sol';
import {
  deriveAssociatedTokenAddress,
  fetchJettonWalletAddress,
} from '../wallet/adapters/token-balances';
import { getAdapterForMode } from '../wallet/adapters';
import { recordPendingBroadcastDevnet } from '../state/pending-broadcasts';
import {
  beginTxLifecycleToast,
  type TxLifecycleHandle,
} from '../wallet/tx-lifecycle-toast';
import { accountName, getSessionPassphrase, withMnemonicAsync } from '../wallet/vault';
import { BROADCAST_DISABLED_MESSAGE } from '../wallet/adapters/types';
import { QrScanner } from '../wallet/qr-scanner';
import { SendReview } from './send-review';
import {
  createTransactionIntent,
  type SigningIntent,
} from '../wallet/signing-intent';
import { normalizeEvmAddress } from '../wallet/adapters/evm';
import {
  ChainSearchSelect,
  readLastUsedChain,
  recordLastUsedChain,
  SEND_RECENT_CHAINS_KEY,
} from './chain-search-select';
import type { ClearSigningInput } from '../wallet/clear-signing';
import {
  describeRecipientDetection,
  findVerifiedNamesake,
} from '../wallet/address-detection';
import { ChainLogo, TokenLogo } from './token-logo';
import { TokenPickerRow } from './token-picker-row';
import type { SendApprovalStage } from './send-approval';
import type { ChainId } from '../engine/boundary';

// Chains with offline signing today (wallet/send.ts). Lane 80-APP
// (2026-11-24): all sixty EVM-transaction chains join — the general
// EVM signer covers each with its own chain id and key — alongside
// BTC, TRX and TON. Solana joined in the expansion (Lane SOL):
// native SOL and SPL transfers are signed with @solana/web3.js from
// the derived ed25519 keypair (the Wallet Core Solana signer cannot
// produce a valid wire transaction — see wallet/send.ts).
// SIGNING_CHAINS gates NATIVE sends only. Token sends are gated
// separately, on tokenStandardFor(chain): every chain with a token
// standard (all 60 EVM-transaction chains, TRON, TON, Solana) signs token
// transfers offline. (C-8: 60 is the EVM-transaction chain count; 57 is the
// count sharing the default derivation path, EVM_PATH in
// wallet/chains.ts — the two numbers count different things.)
// Chains with no token standard (BTC, LTC, DOGE)
// cannot send tokens at all. Filecoin, the non-EVM expanded chains,
// LTC and DOGE have no native send: the screen says so honestly
// instead of offering one.
const SIGNING_CHAINS: readonly ChainId[] = [
  ...EVM_TX_CHAINS,
  'btc',
  'trx',
  'ton',
  'sol',
];

type Step = 'chain' | 'token' | 'details' | 'review' | 'result';

type SignState =
  | { status: 'idle' }
  | { status: 'signing' }
  | {
      status: 'signed';
      txHash: string;
      payload: string;
      payloadLabel: string;
    }
  | { status: 'error'; reason: string };

// TEMPORARY devnet mode: the outcome of the test-network broadcast after
// signing. Mainnet never reaches these states.
type DevnetBroadcastState =
  | { status: 'idle' }
  | { status: 'broadcasting' }
  | { status: 'submitted'; txHash: string; explorerUrl: string }
  | { status: 'error'; reason: string };

// Field-by-field link equality: the sync effect below re-runs when
// state changes, and must not re-set state with a fresh-but-equal
// object (that would loop).
function sameLink(
  a: BawaSendLinkParams | null,
  b: BawaSendLinkParams | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.chain === b.chain &&
    a.to === b.to &&
    a.amount === b.amount &&
    a.token === b.token
  );
}

/**
 * Shared signed-transaction result for the per-chain signing branches
 * (ETH, BTC, TRON, TON): the hash, the signed payload and its label
 * differ per chain, the envelope does not.
 */
function signedTxResult(
  txHash: string,
  payload: string,
  payloadLabel: string,
): { ok: true; txHash: string; payload: string; payloadLabel: string } {
  return { ok: true as const, txHash, payload, payloadLabel };
}

export function SendScreen() {
  const { vaultState, vaultAddresses, vaultAccount, vaultAccounts: vaultAccountsRaw, selectVaultAccount, balances, selectedChain, customTokens, tokenBalances, devnetEnabled, refreshBalances, refreshTokenBalances } = useWallet();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Older mocked contexts may not provide the account fields; default
  // them so the screen still renders (wallet-management.tsx does the
  // same). In production the provider always supplies them.
  const vaultAccounts = vaultAccountsRaw ?? [];
  // Pending deep link (UI/UX round 2, deep-link fix): the payment the
  // link that opened this screen asked for. Starts from the URL; the
  // sync effect below resumes a stored one when the URL has none (the
  // user came back from creating, importing or unlocking a wallet).
  const [pendingLink, setPendingLink] = useState<BawaSendLinkParams | null>(() =>
    parseBawaSendLink(`?${searchParams.toString()}`),
  );
  // The vault account chosen for this link. Null until the chooser is
  // resolved (or the link needs none — a single account applies at
  // once). Kept in state, not a ref, so choosing re-renders.
  const [chosenAccount, setChosenAccount] = useState<number | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [chooserError, setChooserError] = useState<string | null>(null);
  // Devnet mode: only the four devnet chains can send — the other 18
  // have no test network, and offering one used to crash the details
  // step (devnetChainConfig throws for them). Mainnet offers all chains.
  // chainsWithWallet follows the same list, so the starting chain is
  // always a devnet chain in devnet mode.
  const offeredChains: readonly ChainId[] = devnetEnabled
    ? DEVNET_CHAINS
    : SUPPORTED_CHAINS;
  const chainsWithWallet: ChainId[] = offeredChains.filter(
    (chain) => (vaultAddresses[chain] ?? []).length > 0,
  );
  // Full asset list (token gaps, item 4): the selected chain's native
  // coin plus its tokens. Moved up: the asset shortcut below resolves
  // its token against this list before the initial chain is picked.
  const allTokens = [...DEFAULT_TOKENS, ...(customTokens ?? [])];
  // Lane P2-C (F7/F8): the asset-detail shortcut — /send?chain=&token=
  // — pre-selects the asset and lands on the amount form (details).
  // The token is the detail route's slug (tokenSlug: symbol for a
  // default token, contract for a user-added one) or a contract
  // address; an unknown slug is ignored, never an error — the chain
  // still pre-selects and the native coin is the fallback. A Bawa
  // payment link (?chain=&to=...) still wins: it carries a recipient,
  // so pendingLink !== null keeps the chain step and the link apply
  // effect owns the prefill (it resolves the same token the same way).
  const assetChainParam = searchParams.get('chain');
  const assetChain: ChainId | null =
    assetChainParam !== null &&
    (offeredChains as readonly string[]).includes(assetChainParam)
      ? (assetChainParam as ChainId)
      : null;
  const assetTokenParam = searchParams.get('token');
  const assetToken: TokenRecord | null =
    assetChain === null || assetTokenParam === null
      ? null
      : (allTokens.find(
          (token) =>
            token.chain === assetChain &&
            (tokenSlug(token) === assetTokenParam.toLowerCase() ||
              token.contract.toLowerCase() === assetTokenParam.toLowerCase()),
        ) ?? null);
  // The asset prefill came from this screen's own URL. A manual
  // chain/token change abandons it: the params leave the URL, or a
  // later mount would resurrect the prefilled asset (the deep-link
  // pattern in selectChain/selectToken below).
  const assetPrefillRef = useRef(assetChain !== null);
  // P1 (Lane S1): the starting chain is the last-used chain — the
  // shared last-used pick the picker records on every selection,
  // then the wallet-context selection (the asset-detail shortcut and
  // Receive both set it), then the first chain with a wallet. The
  // asset shortcut's chain leads them all: the user tapped Send on
  // that asset's detail, so that asset is the starting point — even
  // when it has no wallet here, in which case the chain step shows
  // it with the honest no-wallet note instead of silently opening
  // another chain's amount form.
  const lastUsedChain = readLastUsedChain(offeredChains);
  const initialChain: ChainId =
    assetChain !== null
      ? assetChain
      : lastUsedChain !== null && chainsWithWallet.includes(lastUsedChain)
        ? lastUsedChain
        : chainsWithWallet.includes(selectedChain)
          ? selectedChain
          : (chainsWithWallet[0] ?? 'eth');
  const [chain, setChain] = useState<ChainId>(initialChain);
  // P1 (Lane S1): the common case needs no chain step — when the
  // starting chain has a wallet, Send opens straight on the amount
  // form (details) with the native coin selected, so the flow is
  // Send, type, Review (2 taps). A pending link, or a starting chain
  // with no wallet, keeps the chain step; the link apply effect and
  // the no-wallet gate still own those cases.
  const initialStep: Step =
    pendingLink === null && chainsWithWallet.includes(initialChain)
      ? 'details'
      : 'chain';
  const [step, setStep] = useState<Step>(initialStep);
  // The step the flow entered on: the "sending is off" banner shows
  // once, at entry, whichever step that is.
  const [entryStep] = useState<Step>(initialStep);
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  // P2-A, M1: ENS resolution for the recipient field. `resolvedRecipient`
  // is the address a `.eth` name resolved to; the send always uses
  // `effectiveRecipient` below, never the raw name. `ensName` is the
  // name that resolved, shown next to the shortened address.
  const [resolvedRecipient, setResolvedRecipient] = useState<string | null>(null);
  const [ensStatus, setEnsStatus] = useState<'idle' | 'resolving' | 'resolved' | 'invalid'>('idle');
  const [ensName, setEnsName] = useState('');
  const effectiveRecipient =
    ensStatus === 'resolved' && resolvedRecipient !== null
      ? resolvedRecipient
      : recipient;
  // Address book (UX-major Lane 5): entries saved on the Address book
  // screen, read once here; picking one fills the recipient below.
  const [bookEntries] = useState(() => readAddressBook());
  const bookForChain = bookEntries.filter((entry) => entry.chain === chain);
  // Lane J: the dashboard Scan tile links to /send?scan=1, so the
  // scanner opens on arrival. Unknown params are ignored by
  // parseBawaSendLink, so ?scan=1 alone never becomes a send link.
  const [showScanner, setShowScanner] = useState(
    () => searchParams.get('scan') === '1',
  );
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<SendPreview | TokenSendPreview | null>(null);
  // A-7: the signing intent created when the send entered review,
  // from the exact details the review screen shows. Null outside a
  // review; handleSign refuses to sign without one.
  const [reviewIntent, setReviewIntent] = useState<SigningIntent | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [signState, setSignState] = useState<SignState>({ status: 'idle' });
  const [approvalStage, setApprovalStage] = useState<SendApprovalStage>('review');
  const [devnetBroadcast, setDevnetBroadcast] = useState<DevnetBroadcastState>({ status: 'idle' });
  // Lane P2-B (M4): the devnet transaction's lifecycle toast. The
  // handle lives in a ref because the toast — and its confirmation
  // poll — outlive this screen: the user can navigate away while the
  // transaction confirms and the toast follows them. Mainnet never
  // starts one (broadcast is disabled, so there is no hash to follow).
  const txToastRef = useRef<TxLifecycleHandle | null>(null);
  const [copied, setCopied] = useState(false);
  // Full asset list (token gaps, item 4): the selected chain's native
  // coin plus its tokens. A token send previews and signs offline on
  // every chain with a token standard (see SIGNING_CHAINS above).
  // The asset shortcut's token starts pre-selected (see assetToken
  // above); otherwise the native coin is the starting asset.
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(assetToken);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const prefillApplied = useRef(false);
  const chainTokens = allTokens.filter((token) => token.chain === chain);
  const assetSymbol = selectedToken?.symbol ?? chainConfig(chain).symbol;

  const from = (vaultAddresses[chain] ?? [])[0] ?? '';
  const config = chainConfig(chain);
  // P2-A, M2: fee tiers. `feeTierBase` is the live base fee data from
  // the adapter (null when the chain has no tiers); the three tiers
  // are derived in render — the gas limit depends on the selected
  // token, so the derivation re-runs when the token changes. Memoised:
  // the fee effect depends on this array's identity, and a fresh
  // array every render would re-run it in a loop.
  const [feeTierBase, setFeeTierBase] = useState<FeeTierBase | null>(null);
  const [feeTierId, setFeeTierId] = useState<FeeTierId>('standard');
  const feeTiers = useMemo<FeeTier[] | null>(
    () =>
      feeTierBase === null || !isEvmTxChain(chain)
        ? null
        : deriveFeeTiers(
            feeTierBase,
            selectedToken !== null ? ERC20_GAS_LIMIT : 21000n,
          ),
    [feeTierBase, chain, selectedToken],
  );
  const selectedFeeTier: FeeTier | null =
    feeTiers?.find((tier) => tier.id === feeTierId) ?? feeTiers?.[1] ?? null;
  const feeTierSelection: FeeTierSelection | undefined =
    selectedFeeTier ?? undefined;
  // Lane 3 (UX-major): smart detection for the recipient field — what
  // the pasted value looks like, and whether it belongs to this
  // network. Pure and synchronous, so it updates as the user types;
  // it never blocks Review and never approves a send (validateRecipient
  // still decides). The copycat check is local registry data only: an
  // unverified selected token sharing a name/symbol with a verified
  // token on the same chain.
  const recipientDetection = useMemo(
    () =>
      describeRecipientDetection({
        value: recipient,
        chain,
        chainName: config.displayName,
        chainIsEvm: isEvmTxChain(chain),
        from,
        tokenContract: selectedToken?.contract,
        tokenSymbol: selectedToken?.symbol,
      }),
    [recipient, chain, config.displayName, from, selectedToken],
  );
  const tokenNamesake =
    selectedToken === null
      ? null
      : findVerifiedNamesake(selectedToken, allTokens);
  // P2-A, M1: debounced ENS resolution while typing (600 ms, the
  // mined pattern's delay). Shows "Resolving…" then the resolved name
  // + shortened address below the field; a bad name shows "Invalid
  // address". The submit path (handleDetailsNext) resolves inline
  // through validateRecipient, so Review never waits on this timer —
  // this effect is the live display only. Non-EVM chains never
  // resolve: a name there is just an invalid address. A name that
  // already resolved (paste, scan, submit) is not re-resolved.
  useEffect(() => {
    if (!isEvmTxChain(chain) || !isEnsName(recipient)) {
      setEnsStatus('idle');
      setEnsName('');
      setResolvedRecipient(null);
      return;
    }
    const name = recipient.trim();
    if (
      ensStatus === 'resolved' &&
      ensName === name &&
      resolvedRecipient !== null
    ) {
      return;
    }
    let cancelled = false;
    setEnsStatus('resolving');
    setEnsName(name);
    const timer = setTimeout(() => {
      void resolveEnsName(name).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setResolvedRecipient(result.address);
          setEnsStatus('resolved');
          setRecipientError(null);
        } else {
          setResolvedRecipient(null);
          setEnsStatus('invalid');
          setRecipientError('Invalid address.');
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipient, chain, ensStatus, ensName, resolvedRecipient]);
  // Devnet test-network name, or undefined when this chain has no
  // test network. The picker never offers such a chain, but a shared
  // send link can force one (applyPrefill sets the chain and jumps to
  // the details step), so the render paths below must never throw
  // for it — the old devnetChainConfig call did, and the screen unmounted.
  const devnetName = devnetEnabled
    ? devnetChainConfigOrUndefined(chain)?.devnetName
    : undefined;
  const balance = balances[chain] ?? { status: 'unavailable', reason: 'no-adapter' } as const;
  const tokenBalance =
    selectedToken === null
      ? undefined
      : (tokenBalances ?? {})[tokenKey(selectedToken.chain, selectedToken.contract)];
  const balanceText =
    selectedToken !== null
      ? tokenBalance === undefined || tokenBalance.status === 'unavailable' || tokenBalance.status === 'error'
        ? 'Balance unavailable'
        : tokenBalance.status === 'loading'
          ? 'Loading balance…'
          : formatNativeWithSymbol(
              tokenBalance.value ?? '0',
              selectedToken.decimals,
              selectedToken.symbol,
            )
      : balance.status === 'available' || balance.status === 'zero'
        ? formatNativeWithSymbol(
            balance.value ?? '0',
            CHAIN_DECIMALS[chain],
            config.symbol,
          )
        : balance.status === 'loading'
          ? 'Loading balance…'
          : 'Balance unavailable';

  // P0-6: the balance the amount step decides on. A failed balance
  // used to sit there as "Balance unavailable" with no way back —
  // Max dead, Review blind. The failed state below (next to the
  // Balance row) names the reason in one line and offers a Retry
  // that refetches the balance. Gated: no Retry when the reason is
  // no-adapter — no balance adapter exists for the chain, so a
  // refetch cannot succeed.
  const failedBalance =
    selectedToken !== null
      ? tokenBalance !== undefined &&
        (tokenBalance.status === 'unavailable' || tokenBalance.status === 'error')
        ? tokenBalance
        : null
      : balance.status === 'unavailable' || balance.status === 'error'
        ? balance
        : null;
  const balanceRetryable =
    failedBalance !== null && failedBalance.reason !== 'no-adapter';

  // Redesign Lane 3 (Send): the chain picker, the error summary, the
  // paste fallback note and the recipient re-check sequence. The
  // summary/paste notes clear whenever the step changes (see the effect
  // below) so a note from one step never lingers on the next.
  const [noWalletNote, setNoWalletNote] = useState<string | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);

  // Live prices for the fiat equivalent under the amount (DESIGN-SYSTEM
  // §6 Send: "fiat equivalent under the amount"). Same hooks as
  // asset-detail; the price modules already live in the shared index
  // chunk, so importing them here costs ~0 extra bundle. Token prices
  // cover only the selected token — the native feed covers the native
  // coin. Both auto-fetch on mount and refresh about every 60 s while
  // this screen is mounted, like the dashboard.
  const { state: pricesState, refresh: refreshPrices } = usePrices();
  usePriceFeedAutoRefresh(pricesState.status, refreshPrices);
  const priceTokenList = useMemo(
    () => (selectedToken === null ? [] : [selectedToken]),
    [selectedToken],
  );
  const { state: tokenPricesState, refresh: refreshTokenPrices } =
    useTokenPrices(priceTokenList);
  usePriceFeedAutoRefresh(tokenPricesState.status, refreshTokenPrices);
  // The token feed's auto-refresh only fires while idle: switching
  // tokens leaves it 'ready' with no entry for the new token, so
  // refresh explicitly when the selected token has no entry yet.
  useEffect(() => {
    if (selectedToken === null) return;
    if (tokenPricesState.entries[tokenKeyOf(selectedToken)] !== undefined) return;
    refreshTokenPrices();
  }, [selectedToken, tokenPricesState.entries, refreshTokenPrices]);

  // Step-scoped notes clear on every step change, so a note from one
  // step (a no-wallet pick, a paste failure, a shown error summary)
  // never lingers on the next.
  useEffect(() => {
    setNoWalletNote(null);
    setSummaryVisible(false);
    setPasteNote(null);
  }, [step]);

  // The price entry for the asset being sent (native or token).
  const priceEntry: PriceEntry | undefined =
    selectedToken !== null
      ? tokenPricesState.entries[tokenKeyOf(selectedToken)]
      : pricesState.entries[chain];

  // Fiat equivalent of a base-units amount, from the live feed.
  // Mainnet only: devnet test tokens have no value. Null when there is
  // no fresh quote or the amount does not convert — never an invented
  // dollar figure.
  function fiatTextForBaseUnits(
    amountBaseUnits: string,
    decimals: number,
    entry: PriceEntry | undefined,
  ): string | null {
    if (devnetEnabled) return null;
    if (entry === undefined || entry.status !== 'fresh') return null;
    if (!isFreshQuote(entry.quote, Date.now())) return null;
    try {
      const minorUnits = fiatMinorUnits(
        amountBaseUnits,
        decimals,
        usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
      );
      return `≈ ${formatFiatUSD(minorUnits)}`;
    } catch {
      return null;
    }
  }

  // The typed amount, parsed to base units (null while empty or
  // unparseable — the preview reports those on Review).
  // decimalToBaseUnits trims and returns null for those itself.
  const amountBaseUnits = decimalToBaseUnits(
    amount,
    selectedToken?.decimals ?? CHAIN_DECIMALS[chain],
  );
  // Fiat equivalent of the typed amount.
  const amountFiatText =
    amountBaseUnits === null
      ? null
      : fiatTextForBaseUnits(
          amountBaseUnits,
          selectedToken?.decimals ?? CHAIN_DECIMALS[chain],
          priceEntry,
        );
  const priceUnavailable =
    !devnetEnabled &&
    priceEntry !== undefined &&
    priceEntry.status === 'error';

  // Inline insufficient-balance check (Bitget transfer-form pattern):
  // as soon as the typed amount parses and the balance is loaded, say
  // so under the field — the user should not have to press Review to
  // learn the wallet cannot cover it.
  const amountBalanceBaseUnits =
    selectedToken !== null
      ? tokenBalance !== undefined &&
        (tokenBalance.status === 'available' || tokenBalance.status === 'zero')
        ? (tokenBalance.value ?? null)
        : null
      : balance.status === 'available' || balance.status === 'zero'
        ? (balance.value ?? null)
        : null;
  const amountError =
    amountBaseUnits !== null &&
    amountBalanceBaseUnits !== null &&
    BigInt(amountBaseUnits) > BigInt(amountBalanceBaseUnits)
      ? 'Amount exceeds available balance.'
      : null;

  // Per-row balance for the token picker: the balance is the decision
  // input at pick time, so each row shows its own (the old rows showed
  // no balance at all).
  function rowBalanceText(token: TokenRecord | null): string {
    if (token === null) return balanceText;
    const entry = (tokenBalances ?? {})[tokenKey(token.chain, token.contract)];
    if (
      entry === undefined ||
      entry.status === 'unavailable' ||
      entry.status === 'error'
    ) {
      return 'Balance unavailable';
    }
    if (entry.status === 'loading') return 'Loading balance…';
    return formatNativeWithSymbol(
      entry.value ?? '0',
      token.decimals,
      token.symbol,
    );
  }

  function selectChain(next: ChainId): void {
    setChain(next);
    setSelectedToken(null);
    // Picking a chain advances to the token step (Round 2, item 8):
    // chain and token are separate steps now.
    setStep('token');
    setRecipient('');
    setRecipientError(null);
    setAmount('');
    setPreview(null);
    setReviewIntent(null);
    setSignState({ status: 'idle' });
    setPrefillNote(null);
    setDevnetBroadcast({ status: 'idle' });
    // A manual chain change abandons the deep link — and the asset
    // shortcut, when one brought the user here: both must not
    // re-apply on the next mount. The link/asset params leave the URL
    // too, or the sync effect above would resurrect the link from them.
    if (pendingLink !== null || assetPrefillRef.current) {
      setPendingLink(null);
      assetPrefillRef.current = false;
      clearPendingSendLink();
      navigate('/send', { replace: true });
    }
  }

  function selectToken(token: TokenRecord | null): void {
    setSelectedToken(token);
    setStep('details');
    setRecipient('');
    setRecipientError(null);
    setAmount('');
    setPreview(null);
    setReviewIntent(null);
    setSignState({ status: 'idle' });
    setPrefillNote(null);
    // A manual token change abandons the deep link and the asset
    // shortcut, same as a chain change above: clear both and strip
    // their params from the URL.
    if (pendingLink !== null || assetPrefillRef.current) {
      setPendingLink(null);
      assetPrefillRef.current = false;
      clearPendingSendLink();
      navigate('/send', { replace: true });
    }
  }

  // Redesign Lane 3: the chain picker offers every chain (the list is
  // searchable now, so the long list is usable), but only a chain with
  // a wallet can be picked. A chain without one stays on this step
  // with the honest reason — never a dead control, never a silent
  // no-op, and never an advance into a token step with nothing to
  // send from.
  function handleChainPick(next: ChainId): void {
    if ((vaultAddresses[next] ?? []).length === 0) {
      setNoWalletNote(
        `No ${chainConfig(next).displayName} wallet here yet. Create or import one first.`,
      );
      return;
    }
    selectChain(next);
  }

  // Prefill a payment from a Bawa web link (/send?chain=&to=&amount=
  // &token=) or a scanned payment URI (token gaps, item 3). The link
  // opens this screen with chain, recipient, amount and token filled
  // in; the flow lands on the details step so both are visible
  // prefilled. Returns false when the
  // payment's chain has no wallet here — the caller says so, instead
  // of the scan silently doing nothing (UI/UX Round 2, item 1).
  async function applyPrefill(prefill: {
    chain: ChainId;
    to: string;
    amount?: string;
    tokenContract?: string;
  }): Promise<boolean> {
    if ((vaultAddresses[prefill.chain] ?? []).length === 0) return false;
    const tokenRecord =
      prefill.tokenContract === undefined
        ? null
        : allTokens.find(
            (token) =>
              token.chain === prefill.chain &&
              token.contract.toLowerCase() === prefill.tokenContract!.toLowerCase(),
          ) ?? null;
    setChain(prefill.chain);
    recordLastUsedChain(prefill.chain);
    setSelectedToken(tokenRecord);
    setRecipient(prefill.to);
    if (prefill.amount !== undefined) setAmount(prefill.amount);
    setStep('details');
    setPreview(null);
    setReviewIntent(null);
    setSignState({ status: 'idle' });
    if (prefill.tokenContract !== undefined && tokenRecord === null) {
      setPrefillNote(
        'This link pays a token that is not in your wallet yet. Add it from its contract address first.',
      );
    } else {
      // S3: a successful prefill still came from outside the wallet —
      // say so, so a crafted link or QR cannot silently choose the
      // recipient and amount.
      setPrefillNote('Prefilled from a link/QR — check the address');
    }
    const result = await validateRecipient(prefill.chain, prefill.to);
    if (result.ok) {
      setRecipientError(null);
      // P2-A, M1: a prefilled ENS name validates to its address.
      if (result.resolvedAddress !== undefined) {
        setResolvedRecipient(result.resolvedAddress);
        setEnsStatus('resolved');
        setEnsName(prefill.to.trim());
      }
    } else {
      setRecipientError(result.reason);
    }
    return true;
  }

  // Deep-link sync (UI/UX round 2, deep-link fix): a link in the URL
  // becomes the pending link and is stored, so it survives the trip
  // to create, import or unlock. With no link in the URL, a stored
  // one is resumed (the user came back from one of those screens).
  useEffect(() => {
    const search = searchParams.toString();
    if (search !== '') {
      const link = parseBawaSendLink(`?${search}`);
      if (link !== null) {
        savePendingSendLink(search);
        setPendingLink((current) => (sameLink(current, link) ? current : link));
        return;
      }
    }
    if (pendingLink === null) {
      const stored = readPendingSendLink();
      if (stored !== null) setPendingLink(stored);
    }
  }, [searchParams, pendingLink]);

  // Deep-link apply (UI/UX round 2, deep-link fix): the pending link
  // prefills once the wallet can actually send from its chain. The
  // old code applied once, on mount, against the mount render's
  // vaultAddresses — on a cold start the vault is locked (or absent)
  // at mount, so the addresses are empty, the apply bailed out, and
  // the once-only guard meant it never retried after unlock or
  // hydration. This effect re-runs whenever the wallet state changes
  // and applies the first time the address is there; the flag is set
  // only when the apply really runs, and cleared again if it reports
  // no address yet. While the vault is locked or there is no vault
  // the link waits (the panels below explain that) — it is never
  // dropped. With more than one vault account the chooser must
  // resolve first, and the apply waits until the chosen account's
  // addresses are in state.
  useEffect(() => {
    if (pendingLink === null || prefillApplied.current) return;
    if (vaultState !== 'unlocked') return;
    if ((vaultAddresses[pendingLink.chain] ?? []).length === 0) return;
    if (vaultAccounts.length > 1 && selectVaultAccount !== undefined) {
      if (chosenAccount === null) return;
      if (vaultAccount?.account !== chosenAccount) return;
    }
    prefillApplied.current = true;
    void applyPrefill({
      chain: pendingLink.chain,
      to: pendingLink.to,
      amount: pendingLink.amount,
      tokenContract: pendingLink.token,
    }).then((applied) => {
      if (applied) {
        clearPendingSendLink();
      } else {
        prefillApplied.current = false;
        setPrefillNote(
          `This link is for ${chainConfig(pendingLink.chain).displayName}, which has no wallet here yet.`,
        );
      }
    });
    // applyPrefill reads the wallet snapshot from this render; the
    // effect re-runs when that snapshot changes, so the closure is
    // always fresh enough — the dependency list names exactly the
    // values the decision reads.
  }, [pendingLink, vaultState, vaultAddresses, vaultAccount, vaultAccounts, selectVaultAccount, chosenAccount]);

  // Wallet chooser (UI/UX round 2, deep-link fix): with more than one
  // vault account the link asks which wallet sends it, instead of
  // silently using whichever account is selected. Choosing switches
  // the account (the apply effect above then prefills once the new
  // account's addresses are in state); picking the current account
  // just resolves the chooser. A failed switch leaves the chooser up
  // with the reason.
  async function chooseAccountForLink(account: number): Promise<void> {
    if (switchingAccount) return;
    setChooserError(null);
    if (account === vaultAccount?.account || selectVaultAccount === undefined) {
      setChosenAccount(account);
      return;
    }
    setSwitchingAccount(true);
    try {
      await selectVaultAccount(account);
      setChosenAccount(account);
    } catch (error: unknown) {
      setChooserError(error instanceof Error ? error.message : String(error));
    } finally {
      setSwitchingAccount(false);
    }
  }

  // The payment a pending link asks for, in plain words. Shown on
  // the no-wallet, locked and chooser panels so the link is never a
  // silent redirect: the user always sees what it asked for before
  // anything else happens.
  function pendingLinkSummary(link: BawaSendLinkParams) {
    const tokenForLink =
      link.token === undefined
        ? null
        : (allTokens.find(
            (token) =>
              token.chain === link.chain &&
              token.contract.toLowerCase() === link.token!.toLowerCase(),
          ) ?? null);
    const symbol = tokenForLink?.symbol ?? chainConfig(link.chain).symbol;
    const amountText =
      link.amount === undefined ? `some ${symbol}` : `${link.amount} ${symbol}`;
    return (
      <p className="text-sm leading-5 text-muted-foreground">
        This link asks to send{' '}
        <span className="font-semibold text-ink">{amountText}</span> to{' '}
        <code className="break-all font-mono text-ink">{link.to}</code> on{' '}
        {chainConfig(link.chain).displayName}.
      </p>
    );
  }

  // Round 2, item 8: recipient and amount share one step, so there is a
  // single Continue: validate the recipient, then preview the amount.
  // A bad recipient stops here with its error; a chain without offline
  // signing reports honestly instead of previewing.
  // Redesign Lane 3: a failed Review shows the error summary (and moves
  // focus to it — see the effect below), so the failure is visible
  // where the user is looking instead of below the action row.
  async function handleDetailsNext(): Promise<void> {
    // The recipient is trimmed on blur and on paste, and focusing the
    // Review button blurs the field first — by the time this runs the
    // value is trimmed. validateRecipient trims internally too.
    const recipientResult = await validateRecipient(chain, recipient, { devnet: devnetEnabled });
    if (!recipientResult.ok) {
      setRecipientError(recipientResult.reason);
      setSummaryVisible(true);
      return;
    }
    setRecipientError(null);
    // P2-A, M1: an ENS name validated to its address — the rest of
    // the flow sends to the resolved address, never to the name. The
    // local `to` is passed down (state would not have settled yet);
    // the state mirror is for the review/sign steps below.
    const to = recipientResult.resolvedAddress ?? recipient;
    if (recipientResult.resolvedAddress !== undefined) {
      setResolvedRecipient(recipientResult.resolvedAddress);
      setEnsStatus('resolved');
      setEnsName(recipient.trim());
    } else {
      setResolvedRecipient(null);
      setEnsStatus('idle');
      setEnsName('');
    }
    // Inline insufficient-balance: no preview call — the amount cannot
    // be covered, and the preview would only repeat the same failure
    // below the fold.
    if (amountError !== null) {
      setPreview({ ok: false, code: 'insufficient-funds', reason: amountError });
      setSummaryVisible(true);
      return;
    }
    await handleAmountNext(to);
  }

  // Redesign Lane 3: validate on blur, once the user has entered
  // something (ui-ux-pro-max inline-validation; no premature flag on
  // an untouched or empty field — empty is reported on submit).
  // Whitespace is trimmed on blur (forgiving-formats): a pasted
  // address with a trailing newline is still the same address.
  async function handleRecipientBlur(): Promise<void> {
    const trimmed = recipient.trim();
    if (trimmed !== recipient) setRecipient(trimmed);
    if (trimmed === '') return;
    // P2-A, M1: a name is validated by the resolver (the debounced
    // effect above), not by the raw-address check — validating it
    // here would wrongly flag it as an invalid address while it is
    // still resolving.
    if (isEvmTxChain(chain) && isEnsName(trimmed)) return;
    const result = await validateRecipient(chain, trimmed, { devnet: devnetEnabled });
    setRecipientError(result.ok ? null : result.reason);
  }

  // Once a field shows an error, re-check it on input (error-clears-
  // on-fix): the error must disappear the moment the value is valid
  // again, not only on the next Review press.
  function handleRecipientChange(next: string): void {
    setRecipient(next);
    // P2-A, M1: a name's validation is the resolver's job — clear
    // any stale error while it resolves instead of re-running the
    // raw-address check on it.
    if (isEvmTxChain(chain) && isEnsName(next)) {
      setRecipientError(null);
      return;
    }
    if (recipientError === null) return;
    void validateRecipient(chain, next, { devnet: devnetEnabled }).then((result) => {
      setRecipientError(result.ok ? null : result.reason);
    });
  }

  // Redesign Lane 3: paste beside the field (DESIGN-SYSTEM §6 wants
  // paste + scan beside the recipient input — paste used to rely on
  // the OS long-press menu). A pasted value is complete, so it is
  // validated at once; a denied clipboard says so instead of failing
  // silently.
  async function handlePaste(): Promise<void> {
    setPasteNote(null);
    try {
      if (!navigator.clipboard?.readText) {
        setPasteNote('Clipboard paste is not available in this browser — paste the address yourself.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text.trim() === '') {
        setPasteNote('The clipboard is empty.');
        return;
      }
      const pasted = text.trim();
      setRecipient(pasted);
      const result = await validateRecipient(chain, pasted, { devnet: devnetEnabled });
      setRecipientError(result.ok ? null : result.reason);
      // P2-A, M1: a pasted ENS name validates to its address — the
      // send uses the resolved address, and the display effect shows
      // the name + shortened address instead of re-resolving.
      if (result.ok && result.resolvedAddress !== undefined) {
        setResolvedRecipient(result.resolvedAddress);
        setEnsStatus('resolved');
        setEnsName(pasted);
      }
    } catch {
      setPasteNote('Could not read the clipboard — allow clipboard access, or paste the address yourself.');
    }
  }

  // The error summary, when shown, takes focus so keyboard and screen
  // reader users land on the failure instead of hunting for it.
  const showSummary =
    summaryVisible &&
    (recipientError !== null || (preview !== null && !preview.ok));
  useEffect(() => {
    if (showSummary) errorSummaryRef.current?.focus();
  }, [showSummary]);

  // A summary link moves focus to its field.
  function focusField(id: string): void {
    document.getElementById(id)?.focus();
  }

  async function handleScan(value: string): Promise<void> {
    setShowScanner(false);
    // A scanned payment URI (BIP-21, EIP-681, Solana Pay, TON) or a
    // Bawa web link prefills the whole payment — chain, recipient,
    // amount and token — instead of being treated as a bare address.
    // When the QR's chain has no wallet here, say so on this screen
    // instead of silently staying put (UI/UX Round 2, item 1).
    const payment = parsePaymentUri(value, allTokens);
    if (payment.ok) {
      const applied = await applyPrefill({
        chain: payment.request.chain,
        to: payment.request.address,
        amount: payment.request.amount,
        tokenContract: payment.request.tokenContract,
      });
      if (!applied) {
        setPrefillNote(
          `This QR is for ${chainConfig(payment.request.chain).displayName}, which has no wallet here yet.`,
        );
      }
      return;
    }
    if (value.startsWith('http')) {
      try {
        const link = parseBawaSendLink(new URL(value).search);
        if (link !== null) {
          const applied = await applyPrefill({
            chain: link.chain,
            to: link.to,
            amount: link.amount,
            tokenContract: link.token,
          });
          if (!applied) {
            setPrefillNote(
              `This QR is for ${chainConfig(link.chain).displayName}, which has no wallet here yet.`,
            );
          }
          return;
        }
      } catch {
        // Not a parseable URL — fall through to the plain-address path.
      }
    }
    setRecipient(value);
    const result = await validateRecipient(chain, value, { devnet: devnetEnabled });
    setRecipientError(result.ok ? null : result.reason);
    // P2-A, M1: a scanned ENS name validates to its address — see handlePaste.
    if (result.ok && result.resolvedAddress !== undefined) {
      setResolvedRecipient(result.resolvedAddress);
      setEnsStatus('resolved');
      setEnsName(value.trim());
    }
    // The recipient and amount inputs only render on the details step,
    // so a scan from the chain step must advance there — otherwise the
    // scanner closes with nothing visibly changed (Lane 7: a bare
    // address scan silently did nothing). Advancing is a no-op when
    // the scan already happened on the details step.
    setStep('details');
  }

  // A-7: build the signing intent from the reviewed details — the
  // chain, the recipient, the amount in base units from the preview
  // (the amount the review screen shows) and the token, when the
  // send is a token transfer. The sequence is not reviewed (the
  // nonce/blockhash is fetched live at signing), so the intent
  // carries '' there and does not pin it. EVM values use the same
  // canonical form the signer asserts against: a `ronin:` recipient
  // is stripped, and a token recipient is lowercased to match the
  // ERC-20 calldata. `to` is the effective recipient — the resolved
  // address when the user typed an ENS name (P2-A, M1).
  function buildReviewIntent(
    token: TokenRecord | null,
    amountBaseUnits: string,
    to: string,
  ): SigningIntent {
    if (token !== null) {
      if (tokenStandardFor(chain).standard === 'erc20') {
        return createTransactionIntent(
          chain,
          token.contract,
          amountBaseUnits,
          '',
          normalizeEvmAddress(to).toLowerCase(),
        );
      }
      return createTransactionIntent(
        chain,
        token.contract,
        amountBaseUnits,
        '',
        to,
      );
    }
    if (isEvmTxChain(chain)) {
      return createTransactionIntent(
        chain,
        normalizeEvmAddress(to),
        amountBaseUnits,
        '',
      );
    }
    return createTransactionIntent(chain, to, amountBaseUnits, '');
  }

  // A-7: entering review snapshots the reviewed send into the
  // intent and stores it; handleSign passes that stored intent to
  // the signer, so signing binds to what the user reviewed. If the
  // intent cannot be built from the reviewed details, review is not
  // entered — the send stays on the details step with the failure
  // shown, instead of signing unbound.
  function enterReview(
    token: TokenRecord | null,
    result: { amountBaseUnits: string },
    to: string,
  ): void {
    try {
      setReviewIntent(buildReviewIntent(token, result.amountBaseUnits, to));
      setStep('review');
    } catch {
      setReviewIntent(null);
      setPreview({
        ok: false,
        code: 'invalid-input',
        reason:
          'The reviewed details could not be confirmed. Please go back and try again.',
      });
      setSummaryVisible(true);
    }
  }

  async function handleAmountNext(to: string): Promise<void> {
    // A token send previews against the cached token balance (the
    // sign step re-reads it live — see handleSign). Native sends on
    // chains without offline signing are not built: say so here
    // instead of previewing a native send the user did not ask for
    // (token gaps, item 4). `to` is the effective recipient — the
    // resolved address when the user typed an ENS name (P2-A, M1).
    // P2-A, M2: the picked fee tier rides in the preview options, so
    // the reviewed fee is the tier's fee, not the flat quote.
    const previewOptions =
      feeTierSelection !== undefined
        ? { devnet: devnetEnabled, feeTier: feeTierSelection }
        : { devnet: devnetEnabled };
    if (selectedToken !== null) {
      setPreviewBusy(true);
      try {
        try {
          await (devnetEnabled ? ensureDevnetAdapters() : ensureAdapters());
        } catch {
          setPreview({ ok: false, code: 'adapter-unavailable', reason: 'Balance adapters could not be loaded. Check your connection and retry.' });
          setSummaryVisible(true);
          return;
        }
        const token = selectedToken;
        const result = await previewTokenSendAmount(
          chain,
          token,
          from,
          to,
          amount,
          tokenBalance !== undefined &&
            (tokenBalance.status === 'available' || tokenBalance.status === 'zero')
            ? tokenBalance.value ?? null
            : null,
          previewOptions,
        );
        setPreview(result);
        if (result.ok) enterReview(token, result, to);
        else setSummaryVisible(true);
      } finally {
        setPreviewBusy(false);
      }
      return;
    }
    if (!SIGNING_CHAINS.includes(chain)) {
      setPreview({
        ok: false,
        code: 'adapter-unavailable',
        reason: `Sending on ${config.displayName} isn't available yet. This wallet signs native transfers offline for BTC, TRX, TON, SOL and EVM chains only.`,
      });
      setSummaryVisible(true);
      return;
    }
    setPreviewBusy(true);
    try {
      try {
        await (devnetEnabled ? ensureDevnetAdapters() : ensureAdapters());
      } catch {
        setPreview({ ok: false, code: 'adapter-unavailable', reason: 'Balance adapters could not be loaded. Check your connection and retry.' });
        setSummaryVisible(true);
        return;
      }
      const result = await previewSendAmount(chain, from, to, amount, previewOptions);
      setPreview(result);
      if (result.ok) enterReview(null, result, to);
      else setSummaryVisible(true);
    } finally {
      setPreviewBusy(false);
    }
  }

  // A-7: leaving review abandons the review snapshot with it — a
  // later Review rebuilds the intent from the (possibly edited)
  // details instead of signing against stale ones.
  function handleReviewBack(): void {
    setReviewIntent(null);
    setStep('details');
  }

  async function handleSign(): Promise<void> {
    // Merge 2: BOTH guards. The lock guard is the rebuild's (Lane A2
    // restores the 'locked' VaultState, so the guard and its message
    // are live again); the double-submit guard is repo-study's.
    if (vaultState !== 'unlocked') {
      setSignState({
        status: 'error',
        reason: 'Your vault is locked. Unlock it on the lock screen to sign.',
      });
      return;
    }
    if (approvalStage === 'simulating' || approvalStage === 'signing') return;
    if (!preview || !preview.ok) return;
    try {
      await (devnetEnabled ? ensureDevnetAdapters() : ensureAdapters());
    } catch {
      setSignState({ status: 'error', reason: "We couldn't load this network's balance. Please retry." });
      return;
    }
    const previewOk = preview;
    const token = selectedToken;
    // A-7: signing binds to the intent created when this send
    // entered review. A missing intent means the review snapshot
    // was lost — refuse to sign unbound rather than silently
    // falling back to the signer's self-built intent.
    if (reviewIntent === null) {
      setSignState({
        status: 'error',
        reason:
          'The reviewed transaction is no longer available. Go back and review it again.',
      });
      return;
    }
    setApprovalStage('simulating');
    // P2-A, M1: the simulation and every signer below use the
    // effective recipient — the resolved address when the user typed
    // an ENS name. P2-A, M2: the simulation re-previews with the
    // picked tier, so it checks the same fee the review showed.
    const simulationOptions =
      feeTierSelection !== undefined
        ? { devnet: devnetEnabled, feeTier: feeTierSelection }
        : { devnet: devnetEnabled };
    const simulation = token !== null
      ? await simulateTokenSend(chain, token, from, effectiveRecipient, amount, simulationOptions)
      : await simulateSend(chain, from, effectiveRecipient, amount, simulationOptions);
    if (!simulation.ok) {
      setSignState({ status: 'error', reason: simulation.reason });
      setApprovalStage('review');
      return;
    }

    // One signing branch per token standard. The recipient lives
    // inside the transfer itself (ERC-20/TRC-20 calldata, the SPL
    // instruction, the Jetton message); the fee in the preview is
    // native, the amount is tokens — the two are never added.
    async function signTokenSend(
      mnemonic: string,
      tokenToSend: TokenRecord,
    ): Promise<
      | { ok: true; txHash: string; payload: string; payloadLabel: string }
      | SendFailure
    > {
      const standard = tokenStandardFor(chain);
      if (standard.standard === 'erc20') {
        const adapter = getAdapterForMode(chain, devnetEnabled);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'nonce') {
          throw new Error(`We couldn't prepare your ${config.displayName} transaction. Please retry.`);
        }
        // The token fee quote is gasPrice x 100000 (see
        // estimateTokenSendFee); the gas price is recovered by exact
        // division, as the native branch divides by 21000.
        const fee = BigInt(previewOk.feeBaseUnits);
        if (fee % ERC20_GAS_LIMIT !== 0n) {
          throw new Error('Fee quote does not match a 100000-gas transfer.');
        }
        const gasPrice = (fee / ERC20_GAS_LIMIT).toString();
        const result = await signEvmTokenOffline(
          chain,
          mnemonic,
          getSessionPassphrase(),
          tokenToSend.contract,
          effectiveRecipient,
          previewOk.amountBaseUnits,
          String(inputs.data.nonce),
          gasPrice,
          { devnet: devnetEnabled, intent: reviewIntent ?? undefined },
        );
        if (!result.ok) return result;
        return signedTxResult(result.txHash, result.signedTxHex, 'Signed transaction (hex)');
      }
      if (standard.standard === 'trc20') {
        const header = await getLatestBlockHeader(
          devnetEnabled
            ? { baseUrl: DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl }
            : undefined,
        );
        if (header.status !== 'ok') throw new Error(header.reason);
        const result = await signTrc20Offline(
          mnemonic,
          getSessionPassphrase(),
          tokenToSend.contract,
          effectiveRecipient,
          previewOk.amountBaseUnits,
          header.data,
          { devnet: devnetEnabled },
        );
        if (!result.ok) return result;
        return signedTxResult(result.txId, result.signedTxJson, 'Signed transaction (JSON)');
      }
      if (standard.standard === 'spl') {
        // Solana: the recipient token account is checked live just
        // before signing, so a race that creates it between preview
        // and sign does not build a transaction that would fail on
        // broadcast (signSplOffline creates it when it is missing).
        const adapter = getAdapterForMode(chain, devnetEnabled);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'blockhash') {
          throw new Error(`We couldn't prepare your ${config.displayName} transaction. Please retry.`);
        }
        const recipientAta = deriveAssociatedTokenAddress(
          effectiveRecipient,
          tokenToSend.contract,
        );
        if (recipientAta === null) {
          throw new Error('Invalid Solana recipient address.');
        }
        const recipientAtaExists =
          await fetchSolanaAccountExists(recipientAta);
        const result = await signSplOffline(
          mnemonic,
          getSessionPassphrase(),
          tokenToSend.contract,
          effectiveRecipient,
          previewOk.amountBaseUnits,
          tokenToSend.decimals,
          inputs.data.blockhash,
          recipientAtaExists,
          { devnet: devnetEnabled, account: vaultAccount.account, intent: reviewIntent ?? undefined },
        );
        if (!result.ok) return result;
        return signedTxResult(result.signature, result.signedTxBase64, 'Signed transaction (base64)');
      }
      if (standard.standard === 'jetton') {
        const jettonWallet = await fetchJettonWalletAddress({
          contract: tokenToSend.contract,
          ownerAddress: from,
        });
        if (jettonWallet === null) {
          throw new Error('You have no Jetton wallet for this token yet.');
        }
        const adapter = getAdapterForMode(chain, devnetEnabled);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'seqno') {
          throw new Error("We couldn't prepare your TON transaction. Please retry.");
        }
        const result = await signJettonOffline(
          mnemonic,
          getSessionPassphrase(),
          jettonWallet,
          effectiveRecipient,
          previewOk.amountBaseUnits,
          inputs.data.seqno,
          { devnet: devnetEnabled, account: vaultAccount.account },
        );
        if (!result.ok) return result;
        return signedTxResult(result.messageHash, result.signedBocBase64, 'Signed message (base64 BOC)');
      }
      throw new Error(`Token sending on ${config.displayName} isn't available yet.`);
    }

    setApprovalStage('signing');
    setSignState({ status: 'signing' });
    // Lane P2-B (M4): the lifecycle toast starts when signing starts
    // — "Waiting for wallet…" — and only for a devnet send, the one
    // place a broadcast actually happens.
    if (devnetEnabled) {
      txToastRef.current = beginTxLifecycleToast();
    }
    try {
      const signed = await withMnemonicAsync(async (mnemonic) => {
        if (token !== null) return signTokenSend(mnemonic, token);
        const adapter = getAdapterForMode(chain, devnetEnabled);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        if (isEvmTxChain(chain)) {
          const inputs = await adapter.getTxInputs(from);
          if (inputs.status !== 'ok') throw new Error(inputs.reason);
          if (inputs.data.kind !== 'nonce') {
            throw new Error(`We couldn't prepare your ${config.displayName} transaction. Please retry.`);
          }
          const fee = BigInt(previewOk.feeBaseUnits);
          // The EVM fee quote is gasPrice * 21000 (see adapters/evm.ts);
          // the gas price is recovered by exact division.
          if (fee % 21000n !== 0n) {
            throw new Error('Fee quote does not match a 21000-gas transfer.');
          }
          const gasPrice = (fee / 21000n).toString();
          const result = await signEvmOffline(
            chain,
            mnemonic,
            getSessionPassphrase(),
            effectiveRecipient,
            previewOk.amountBaseUnits,
            String(inputs.data.nonce),
            gasPrice,
            { devnet: devnetEnabled, intent: reviewIntent ?? undefined },
          );
          if (!result.ok) return result;
          return signedTxResult(result.txHash, result.signedTxHex, 'Signed transaction (hex)');
        }
        if (chain === 'btc') {
          const inputs = await adapter.getTxInputs(from);
          if (inputs.status !== 'ok') throw new Error(inputs.reason);
          if (inputs.data.kind !== 'utxo') {
            throw new Error("We couldn't prepare your Bitcoin transaction. Please retry.");
          }
          const fee = await adapter.estimateFee();
          if (fee.status !== 'ok') throw new Error(fee.reason);
          const result = await signBtcOffline(
            mnemonic,
            getSessionPassphrase(),
            effectiveRecipient,
            previewOk.amountBaseUnits,
            inputs.data.utxos,
            fee.data.feeBaseUnits,
            from,
            { devnet: devnetEnabled },
          );
          if (!result.ok) return result;
          return signedTxResult(result.txHash, result.signedTxHex, 'Signed transaction (hex)');
        }
        if (chain === 'trx') {
          const header = await getLatestBlockHeader(
            devnetEnabled
              ? { baseUrl: DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl }
              : undefined,
          );
          if (header.status !== 'ok') throw new Error(header.reason);
          const result = await signTrxOffline(
            mnemonic,
            getSessionPassphrase(),
            effectiveRecipient,
            previewOk.amountBaseUnits,
            header.data,
            { devnet: devnetEnabled },
          );
          if (!result.ok) return result;
          return signedTxResult(result.txId, result.signedTxJson, 'Signed transaction (JSON)');
        }
        if (chain === 'sol') {
          const inputs = await adapter.getTxInputs(from);
          if (inputs.status !== 'ok') throw new Error(inputs.reason);
          if (inputs.data.kind !== 'blockhash') {
            throw new Error(`We couldn't prepare your ${config.displayName} transaction. Please retry.`);
          }
          const result = await signSolOffline(
            mnemonic,
            getSessionPassphrase(),
            effectiveRecipient,
            previewOk.amountBaseUnits,
            inputs.data.blockhash,
            { devnet: devnetEnabled, account: vaultAccount.account, intent: reviewIntent ?? undefined },
          );
          if (!result.ok) return result;
          return signedTxResult(result.signature, result.signedTxBase64, 'Signed transaction (base64)');
        }
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'seqno') {
          throw new Error("We couldn't prepare your TON transaction. Please retry.");
        }
        const result = await signTonOffline(
          mnemonic,
          getSessionPassphrase(),
          effectiveRecipient,
          previewOk.amountBaseUnits,
          inputs.data.seqno,
          { devnet: devnetEnabled, account: vaultAccount.account },
        );
        if (!result.ok) return result;
        return signedTxResult(result.messageHash, result.signedBocBase64, 'Signed message (base64 BOC)');
      });
      if (!signed.ok) {
        setSignState({ status: 'error', reason: signed.reason });
        txToastRef.current?.failed();
        txToastRef.current = null;
        return;
      }
      setSignState({
        status: 'signed',
        txHash: signed.txHash,
        payload: signed.payload,
        payloadLabel: signed.payloadLabel,
      });
      setApprovalStage('signed');
      setStep('result');
      if (devnetEnabled) {
        // TEMPORARY devnet mode: broadcast the signed transaction to the
        // test network. broadcastSignedDevnet asserts devnet mode, a
        // devnet networkId and a non-test provenance before any write.
        setApprovalStage('broadcast-devnet');
        setDevnetBroadcast({ status: 'broadcasting' });
        try {
          const broadcast = await broadcastSignedDevnet(chain, signed.payload, {
            devnet: true,
            messageHash: signed.txHash,
          });
          recordPendingBroadcastDevnet({ txHash: broadcast.txHash, chain });
          setDevnetBroadcast({
            status: 'submitted',
            txHash: broadcast.txHash,
            explorerUrl: broadcast.explorerUrl,
          });
          // Lane P2-B (M4): the broadcast landed — the toast moves to
          // "Transaction submitted / Waiting for confirmation…" with
          // the hash and explorer link, and starts polling for the
          // confirmation in the background.
          txToastRef.current?.submitted({
            chain,
            txHash: broadcast.txHash,
            explorerUrl: broadcast.explorerUrl,
            devnet: true,
          });
        } catch (error) {
          setDevnetBroadcast({
            status: 'error',
            reason:
              error instanceof Error ? error.message : 'Broadcast failed.',
          });
          txToastRef.current?.failed();
          txToastRef.current = null;
        }
      } else {
        setApprovalStage('broadcast-disabled');
      }
    } catch (error: unknown) {
      setSignState({
        status: 'error',
        reason:
          error instanceof Error ? error.message : 'Signing failed.',
      });
      setApprovalStage('review');
      txToastRef.current?.failed();
      txToastRef.current = null;
    }
  }

  async function copyPayload(): Promise<void> {
    if (signState.status !== 'signed') return;
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(signState.payload);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const [feeEstimate, setFeeEstimate] = useState<
    | {
        ok: true;
        feeBaseUnits: string;
        note: string;
        // The adapter's unit: 'wei' (EVM), 'lamports' (SOL), 'sun'
        // (TRON token sends), 'sat/vB' (BTC/LTC/DOGE rate), 'SUN per
        // unit of energy' (TRON native rate). The fee display sorts
        // amounts from rates on it (see wallet/fee-display.ts) — a
        // rate must never be formatted as an amount.
        unit: string;
        feeUnknown?: boolean;
      }
    | { ok: false; reason: string }
    | null
  >(null);

  // P2-A, M2: live fee data for the tier selector. The adapter reads
  // estimateFeesPerGas on the chain's RPC; a chain without tiers (or
  // a failed read) leaves the selector off and the flat fee stands —
  // tiers are never derived from a guessed number.
  useEffect(() => {
    // P2-A, M2/M3: tiers are fetched on the details step, but the last
    // fetched tiers are KEPT when the flow moves to review — the
    // review fee was quoted from that tier, so the breakdown's Max /
    // Priority rows must read the same tier instead of falling back
    // to a gas price recovered by division (which has no priority
    // component). A non-EVM chain clears them; picking a chain or
    // returning to details re-fetches.
    if (!isEvmTxChain(chain)) {
      setFeeTierBase(null);
      return;
    }
    if (step !== 'details') return;
    let cancelled = false;
    setFeeTierBase(null);
    void (async () => {
      const adapter = getAdapterForMode(chain, devnetEnabled);
      if (adapter?.estimateFeeTiers === undefined) {
        if (!cancelled) setFeeTierBase(null);
        return;
      }
      const result = await adapter.estimateFeeTiers();
      if (cancelled) return;
      setFeeTierBase(
        result.status === 'ok'
          ? {
              maxFeePerGasWei: result.data.maxFeePerGasWei,
              maxPriorityFeePerGasWei: result.data.maxPriorityFeePerGasWei,
            }
          : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [step, chain, devnetEnabled]);

  useEffect(() => {
    if (step !== 'details') return;
    let cancelled = false;
    setFeeEstimate(null);
    // P2-A, M2: when tiers are loaded for an EVM chain, the selected
    // tier IS the fee — its max fee x the gas limit, no adapter call
    // needed. The fee line, Max and the preview all read this one
    // estimate, so they agree. Native and token alike: the tier's
    // feeBaseUnits already carries the right gas limit.
    if (feeTiers !== null && selectedFeeTier !== null) {
      setFeeEstimate({
        ok: true,
        feeBaseUnits: selectedFeeTier.feeBaseUnits,
        note: `${selectedFeeTier.label} tier at ${formatGwei(selectedFeeTier.maxFeePerGasWei)} Gwei max fee; it may change before signing.`,
        unit: 'wei',
      });
      return;
    }
    if (selectedToken !== null) {
      // Token sends: the fee is native (gas / energy / SOL signatures
      // / unknown for TON) — estimateTokenSendFee quotes it per
      // standard. The amount itself is tokens; the fee never comes
      // out of it.
      void (async () => {
        // Solana only: pass the recipient so the rent is exact (the
        // recipient token account is checked live); other chains
        // ignore the extra argument.
        const result = await estimateTokenSendFee(chain, selectedToken, {
          devnet: devnetEnabled,
        }, recipient);
        if (cancelled) return;
        setFeeEstimate(
          result.ok
            ? {
                ok: true,
                feeBaseUnits: result.feeBaseUnits,
                note: result.feeNote,
                // Token fees are native amounts in the chain's unit
                // (EVM wei, SOL lamports, TRON SUN); TON reports an
                // unknown fee, so the unit never renders as an amount.
                unit:
                  chain === 'sol'
                    ? 'lamports'
                    : chain === 'trx'
                      ? 'sun'
                      : 'wei',
                feeUnknown: result.feeUnknown ?? false,
              }
            : { ok: false, reason: humanReasonMessage(result.reason, 'general') },
        );
      })();
      return;
    }
    void (async () => {
      const adapter = getAdapterForMode(chain, devnetEnabled);
      if (!adapter) {
        if (!cancelled) setFeeEstimate({ ok: false, reason: "A fee estimate isn't available for this network." });
        return;
      }
      const result = await adapter.estimateFee();
      if (cancelled) return;
      setFeeEstimate(
        result.status === 'ok'
          ? {
              ok: true,
              feeBaseUnits: result.data.feeBaseUnits,
              note: result.data.note,
              unit: result.data.unit,
            }
          // Lane D: the adapter reason is a machine code (a TRON
          // getchainparameters 429 surfaced here as a bare 'HTTP 429').
          // No screen renders a raw reason (wallet-context rule) —
          // map it to the human sentence first.
          : { ok: false, reason: humanReasonMessage(result.reason, 'general') },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [step, chain, selectedToken, devnetEnabled, recipient, feeTiers, feeTierId, selectedFeeTier]);

  // Max preserves the fee reserve. Only ETH has a flat native fee estimate
  // (gasPrice x 21000): BTC quotes a sat/vB rate, TRX quotes SUN per unit
  // of energy, and TON has no fee estimate — for those chains Max stays
  // disabled with the honest reason, per spec §8.
  const maxInfo = ((): { enabled: false; reason: string } | { enabled: true; maxBaseUnits: string } => {
    if (selectedToken !== null) {
      // Max for a token is the full token balance: the fee is paid in
      // the native coin, so no fee reserve comes out of the token
      // amount. The preview still refuses when the native balance
      // does not cover the fee.
      if (tokenBalance === undefined || (tokenBalance.status !== 'available' && tokenBalance.status !== 'zero')) {
        return { enabled: false, reason: 'Max is unavailable: the token balance is not loaded yet.' };
      }
      if (BigInt(tokenBalance.value ?? '0') <= 0n) {
        return { enabled: false, reason: 'Max is unavailable: the token balance is zero.' };
      }
      return { enabled: true, maxBaseUnits: tokenBalance.value ?? '0' };
    }
    if (chain === 'ton') return { enabled: false, reason: 'Max is unavailable: no fee estimate is available for TON.' };
    if (chain === 'btc') return { enabled: false, reason: 'Max is unavailable: the Bitcoin fee is a rate, and the planned fee depends on the transaction.' };
    if (chain === 'trx') return { enabled: false, reason: 'Max is unavailable: TRON fees depend on energy use, not a flat fee.' };
    if (balance.status !== 'available' && balance.status !== 'zero') return { enabled: false, reason: 'Max is unavailable: the balance is not loaded yet.' };
    if (!feeEstimate || !feeEstimate.ok) return { enabled: false, reason: 'Max is unavailable: the fee estimate is not loaded yet.' };
    const remaining = BigInt(balance.value ?? '0') - BigInt(feeEstimate.feeBaseUnits);
    if (remaining <= 0n) return { enabled: false, reason: 'Max is unavailable: the balance does not cover the estimated fee.' };
    return { enabled: true, maxBaseUnits: remaining.toString() };
  })();

  function handleMax(): void {
    if (!maxInfo.enabled) return;
    const maxBase = BigInt(maxInfo.maxBaseUnits);
    const decimals = selectedToken?.decimals ?? CHAIN_DECIMALS[chain];
    const divisor = 10n ** BigInt(decimals);
    const whole = maxBase / divisor;
    const frac = (maxBase % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
    setAmount(frac ? `${whole}.${frac}` : `${whole}`);
  }

  // Review display values. A token preview shows the token amount
  // and "{amount} + {fee}" — the fee is native and the amount is
  // tokens, so the two are never added into one total; a native
  // preview shows its totalBaseUnits. A token preview has no
  // totalBaseUnits, so the native branch narrows on the property
  // itself ('totalBaseUnits' in preview). The native cost of a token
  // send is the fee plus the rent (creating a recipient token account
  // on Solana); every other chain reports rent '0', so this changes
  // nothing for them. The attached TON amount stays out of the total,
  // as before — its feeNote explains it.
  const reviewNativeCostBaseUnits =
    preview !== null &&
    preview.ok &&
    selectedToken !== null &&
    'rentBaseUnits' in preview
      ? (BigInt(preview.feeBaseUnits) + BigInt(preview.rentBaseUnits)).toString()
      : null;
  const reviewAmountText =
    preview !== null && preview.ok
      ? selectedToken !== null
        ? formatNativeWithSymbol(preview.amountBaseUnits, selectedToken.decimals, selectedToken.symbol)
        : formatNativeWithSymbol(preview.amountBaseUnits, CHAIN_DECIMALS[chain], config.symbol)
      : '';
  const reviewTotalText =
    preview !== null && preview.ok
      ? preview.feeUnknown
        ? `${reviewAmountText} + network fee`
        : 'totalBaseUnits' in preview
          ? formatNativeWithSymbol(preview.totalBaseUnits, CHAIN_DECIMALS[chain], config.symbol)
          : `${reviewAmountText} + ${formatNativeWithSymbol(reviewNativeCostBaseUnits ?? preview.feeBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}`
      : '';
  // Fiat equivalent of the reviewed amount, same feed and rules as the
  // details step (mainnet only, fresh quote only, never invented).
  const reviewFiatAmount =
    preview !== null && preview.ok
      ? fiatTextForBaseUnits(
          preview.amountBaseUnits,
          selectedToken?.decimals ?? CHAIN_DECIMALS[chain],
          priceEntry,
        )
      : null;

  // Lane 6 (UX-major programme): the fee's own display shape and fiat
  // value. The fee is always paid in the native coin — even for token
  // sends — so the fiat comes from the NATIVE feed entry, not the
  // token one. Null when there is no fresh quote, when the fee is a
  // rate (BTC sat/vB, TRON native energy), or when it is unknown
  // (TON): never an invented dollar figure. The review fee includes
  // the SOL rent where the preview reports it (reviewNativeCost).
  const nativePriceEntry: PriceEntry | undefined = pricesState.entries[chain];
  const feeDisplay =
    feeEstimate !== null && feeEstimate.ok
      ? describeFeeEstimate(feeEstimate)
      : null;
  const feeFiatText =
    feeDisplay !== null && feeDisplay.kind === 'amount' && feeEstimate?.ok
      ? fiatTextForBaseUnits(
          feeEstimate.feeBaseUnits,
          CHAIN_DECIMALS[chain],
          nativePriceEntry,
        )
      : null;
  const reviewFeeFiatText =
    preview !== null && preview.ok && !preview.feeUnknown
      ? fiatTextForBaseUnits(
          reviewNativeCostBaseUnits ?? preview.feeBaseUnits,
          CHAIN_DECIMALS[chain],
          nativePriceEntry,
        )
      : null;

  // P2-A, M3: the review fee breakdown — total by default, the
  // composition on expand (see send-review.tsx). The BTC/TRX rate
  // comes from the details-step estimate, which is still in state on
  // the review step; the SOL rent from the preview; the EVM tier
  // from the picked tier. Empty when the fee is unknown (TON) or the
  // preview failed — the review then shows no breakdown, never a
  // guessed one.
  const reviewFeeRate =
    feeEstimate !== null &&
    feeEstimate.ok &&
    (feeEstimate.unit === 'sat/vB' ||
      feeEstimate.unit.toLowerCase().includes('energy'))
      ? { rateBaseUnits: feeEstimate.feeBaseUnits, rateUnit: feeEstimate.unit }
      : null;
  const reviewFeeBreakdown =
    preview !== null && preview.ok && !preview.feeUnknown
      ? buildFeeBreakdown({
          chain,
          isToken: selectedToken !== null,
          tier: isEvmTxChain(chain) ? selectedFeeTier : null,
          feeBaseUnits: preview.feeBaseUnits,
          rentBaseUnits:
            'rentBaseUnits' in preview ? preview.rentBaseUnits : undefined,
          rateBaseUnits: reviewFeeRate?.rateBaseUnits,
          rateUnit: reviewFeeRate?.rateUnit,
        })
      : [];

  // Contract call for the review screen's clear-signing section: an
  // ERC-20 token send calls the token contract with
  // transfer(recipient, amount) calldata — the same calldata the
  // signer builds. Built only when the preview, token and chain are
  // all valid; any failure leaves the section off rather than
  // breaking the review.
  let reviewContractCall: ClearSigningInput | undefined;
  if (
    preview !== null &&
    preview.ok &&
    selectedToken !== null &&
    tokenStandardFor(chain).standard === 'erc20'
  ) {
    const evmChainId = chainConfig(chain).evmChainId;
    if (evmChainId !== null) {
      try {
        reviewContractCall = {
          chainId: evmChainId,
          contract: selectedToken.contract,
          data: buildErc20TransferData(effectiveRecipient, preview.amountBaseUnits),
          token: {
            decimals: selectedToken.decimals,
            symbol: selectedToken.symbol,
          },
        };
      } catch {
        reviewContractCall = undefined;
      }
    }
  }

  if (chainsWithWallet.length === 0 || !from) {
    // Locked vault, no addresses in state (UI/UX round 2, deep-link
    // fix): the vault exists — the header says so — so "No wallet
    // yet" is the wrong message here. The link waits until the vault
    // is unlocked; the lock screen returns to this URL, and the apply
    // effect above then prefills.
    if (vaultState === 'locked') {
      return (
        <div className="space-y-6">
          <h1 className="font-bold tracking-tight">Send</h1>
          {pendingLink !== null && pendingLinkSummary(pendingLink)}
          <p className="text-sm leading-5 text-muted-foreground">
            {pendingLink !== null
              ? 'Your wallet is locked. Unlock it to continue with this send.'
              : 'Your wallet is locked. Unlock it to send.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/lock"
              className="text-base font-medium text-primary underline underline-offset-4"
            >
              Unlock your wallet
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <h1 className="font-bold tracking-tight">Send</h1>
        {pendingLink !== null && pendingLinkSummary(pendingLink)}
        <p className="text-sm leading-5 text-muted-foreground">
          No wallet yet. Create or import a wallet first — sending needs a
          vault address to send from.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/create-wallet">Create a wallet</Link>
          </Button>
          <Button asChild variant="secondary" size="md">
            <Link to="/import-wallet">Import a wallet</Link>
          </Button>
        </div>
        {pendingLink !== null && (
          <p className="text-sm leading-5 text-muted-foreground">
            Saved — it will fill in when your wallet is ready.
          </p>
        )}
      </div>
    );
  }

  // Wallet chooser (UI/UX round 2, deep-link fix): more than one
  // vault account, and the link has not picked one yet. The current
  // account shows its address on the link's chain; the other
  // accounts' addresses appear once they are chosen (only the
  // selected account's addresses are in state).
  if (
    pendingLink !== null &&
    vaultState === 'unlocked' &&
    vaultAccounts.length > 1 &&
    selectVaultAccount !== undefined &&
    chosenAccount === null
  ) {
    return (
      <div className="space-y-6">
        <h1 className="font-bold tracking-tight">Send</h1>
        {pendingLinkSummary(pendingLink)}
        <p className="text-sm leading-5 text-muted-foreground">
          Choose which wallet sends this payment.
        </p>
        <ul className="space-y-2">
          {vaultAccounts.map((account) => {
            const isCurrent = account === vaultAccount?.account;
            const address = isCurrent
              ? (vaultAddresses[pendingLink.chain] ?? [])[0]
              : undefined;
            return (
              <li key={account}>
                <button
                  type="button"
                  disabled={switchingAccount}
                  onClick={() => void chooseAccountForLink(account)}
                  className="flex w-full flex-col gap-1 rounded-flat-sm border border-ink bg-paper p-3 text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
                >
                  <span className="text-base font-semibold">
                    {accountName(account)}
                    {isCurrent ? ' · Current wallet' : ''}
                  </span>
                  {address !== undefined && (
                    <span className="break-all font-mono text-sm">{address}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {switchingAccount && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Switching wallet…
          </p>
        )}
        {chooserError && (
          <p role="alert" className="text-base text-error">
            {chooserError}
          </p>
        )}
      </div>
    );
  }

  return (
    // Desktop layout (desktop-layout-v2): the header and progress form a
    // sticky left rail (2 of 5 columns) and the current step renders in
    // the right column (3 of 5) — the same rail pattern as
    // create-wallet. The chain picker is now the chain step itself, so
    // it lives in the right column with the other steps. Below lg the
    // same blocks stack in one column in the same order, so the mobile
    // flow is untouched. Wrappers use space-y-3 to match this screen's
    // mobile spacing (not the tag's space-y-6).
    <div className="space-y-3 lg:grid lg:grid-cols-5 lg:min-h-[calc(100vh-7.5rem)] lg:content-center lg:gap-8 lg:items-start lg:space-y-0">
      <div className="space-y-3 lg:col-span-2 lg:sticky lg:top-6">
      <header className="space-y-2">
        <h1 className="font-bold tracking-tight">Send</h1>
        {/* Redesign Lane 3: the full banner sets expectations once, at
            flow entry (chain). Later steps do not repeat it — the
            review carries its own warning box, and repeating the same
            three lines on every step cost ~100 px of form space. In
            devnet the details step keeps a one-line test-network note
            (the banner was its only devnet indicator there). */}
        {step === entryStep && (
        <p
          role="note"
          className="rounded-flat-lg border border-ink bg-sun p-4 text-base text-ink"
        >
          {devnetEnabled
            ? devnetName
              ? `Devnet test mode. This send broadcasts to the ${devnetName} test network only. Test tokens have no value.`
              : `Devnet test mode. ${config.displayName} has no test network — pick a chain with one.`
            : 'Sending is off until approved. Offline signing only.'}
        </p>
        )}
        {step === 'details' && devnetEnabled && entryStep === 'chain' && (
          <p className="text-sm text-muted-foreground">
            {devnetName
              ? `Devnet test mode — broadcasts to the ${devnetName} test network only.`
              : `Devnet test mode — ${config.displayName} has no test network.`}
          </p>
        )}
      </header>

      {(() => {
        // Round 2, item 8: chain → token → address + amount → review →
        // sign → result. The recipient and amount are one step now.
        const steps = ['Chain', 'Token', 'Address & amount', 'Review', 'Sign', 'Result'] as const;
        const activeIndex =
          step === 'chain'
            ? 0
            : step === 'token'
              ? 1
              : step === 'details'
              ? 2
              : step === 'review' || step === 'result'
                ? {
                    review: 3,
                    simulating: 3,
                    signing: 4,
                    signed: 5,
                    'broadcast-disabled': 5,
                    'broadcast-devnet': 5,
                  }[approvalStage]
                : 5;
        return (
          <div className="space-y-2">
            <ol aria-label="Send progress" className="flex items-center">
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-flat-sm border border-ink text-sm text-ink ${
                      index < activeIndex
                        ? 'bg-sun'
                        : index === activeIndex
                          ? 'bg-coral font-bold'
                          : 'bg-paper'
                    }`}
                  >
                    {index < activeIndex ? '✓' : index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span aria-hidden="true" className="mx-1 flex-1 border-t border-ink" />
                  )}
                </li>
              ))}
            </ol>
            <p className="text-sm font-medium text-panel-text-muted">
              {`Step ${activeIndex + 1} of 6: ${steps[activeIndex]}`}
            </p>
          </div>
        );
      })()}

      </div>
      <div className="space-y-3 lg:col-span-3">

      {step === 'chain' && (
        <section aria-labelledby="send-chain-heading" className="space-y-3">
          <h2 id="send-chain-heading" className="font-semibold">
            Choose a network
          </h2>
      {/* Scan first (UI/UX Round 2, item 1): a payment QR fills in
          the network, token, amount and address by itself, so the
          scanner lives here too — not only on the recipient step,
          after the network and token were already picked by hand. */}
      <div className="flex flex-wrap items-center gap-3 rounded-flat-sm border border-ink bg-paper p-3">
        <button
          type="button"
          aria-label="Scan QR code"
          aria-expanded={showScanner}
          title="Scan QR code"
          onClick={() => setShowScanner((current) => !current)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <ScanIcon className="h-11 w-11 text-ink" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">Scan a QR code</p>
          <p className="text-sm text-muted-foreground">
            Scan a payment QR — everything fills in.
          </p>
        </div>
      </div>
      {prefillNote && (
        <p role="note" className="text-base text-ink">
          {prefillNote}
        </p>
      )}
      {showScanner && (
        <QrScanner
          onScan={(value) => void handleScan(value)}
          onCancel={() => setShowScanner(false)}
        />
      )}
      {/* Redesign Lane 3: the chain picker is a search picker, not an
          84-chip wall. Measured before: the chip group alone was
          1,180 px tall at 390 px — the step never fit, and finding a
          chain meant scanning all 84. The search picker is the same
          component the watch-only screen uses (search + Recent row +
          listbox); Send keeps its own Recent list so the two never
          mix. Deviation from DESIGN-SYSTEM §6 "chain step is chips
          only", recorded: chips-only cannot fit 84 chains without
          scrolling, and the system's own §1 convenience test plus the
          Receive picker pattern (§6 Receive) call for search. */}
      <ChainSearchSelect
        chains={offeredChains}
        value={chain}
        onChange={(next) => handleChainPick(next)}
        recentKey={SEND_RECENT_CHAINS_KEY}
      />
      {noWalletNote && (
        <p role="note" className="text-base text-ink">
          {noWalletNote}
        </p>
      )}
        </section>
      )}

      {step === 'token' && (
      <section aria-labelledby="send-token-heading" className="space-y-3">
        <h2 id="send-token-heading" className="font-semibold">
          {`Token · ${config.displayName}`}
        </h2>
        <ul className="space-y-2">
          {orderAssetsByBalance([
            {
              token: null as TokenRecord | null,
              hasBalance: balance.status === 'available',
              fiatMinorUnits: null,
            },
            ...chainTokens.map((token) => ({
              token,
              hasBalance:
                ((tokenBalances ?? {})[tokenKeyOf(token)]?.status ??
                  'unavailable') === 'available',
              fiatMinorUnits: null as number | null,
            })),
          ])
            .map(({ token }) => {
              const selected =
                token === null
                  ? selectedToken === null
                  : selectedToken !== null &&
                    selectedToken.chain === token.chain &&
                    selectedToken.contract.toLowerCase() === token.contract.toLowerCase();
              const label =
                token === null
                  ? `${config.displayName} · ${config.symbol}`
                  : `${token.name} · ${token.symbol}`;
              return (
                <TokenPickerRow
                  key={token === null ? `native:${chain}` : `${token.chain}:${token.contract.toLowerCase()}`}
                  selected={selected}
                  onSelect={() => selectToken(token)}
                  balanceText={rowBalanceText(token)}
                  logo={
                    <>
                      {/* Lane G: the real chain/token mark — the
                          hand-drawn blob with the ticker text inside
                          rendered as a crossed-out logo. */}
                      {token === null ? (
                        <ChainLogo chain={chain} size={32} />
                      ) : (
                        <TokenLogo
                          symbol={token.symbol}
                          size={32}
                          iconUrl={token.iconUrl ?? null}
                          allowSymbolLogo={isDefaultToken(token)}
                        />
                      )}
                    </>
                  }
                >
                  {label}
                  {/* Lane 1: the verified mark on every picker row —
                      an unverified token reads "Unverified". */}
                  {token !== null &&
                    (isVerifiedToken(token) ? (
                      <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
                    ) : (
                      <span className="ml-2" aria-label="Unverified token">Unverified</span>
                    ))}
                  {token === null && (
                    <span className="font-normal text-ink"> · Native coin</span>
                  )}
                </TokenPickerRow>
              );
            })}
        </ul>
        {selectedToken !== null && tokenStandardFor(chain).standard === null && (
          <p className="text-base text-ink">
            {`Sending ${selectedToken.symbol} isn't available yet. ${config.displayName} has no token standard — only its native coin can be sent.`}
          </p>
        )}
        {!SIGNING_CHAINS.includes(chain) && selectedToken === null && (
          <p className="text-base text-ink">
            {`Sending on ${config.displayName} isn't available yet. This wallet signs native transfers offline for BTC, TRX, TON, SOL and EVM chains only.`}
          </p>
        )}
        </section>
      )}

      {/* Redesign Lane 3: the summary bar is the back path on the token
          and details steps only. On review the Back button covers it,
          and on result the screen speaks for itself — the bar would
          eat ~60 px on both. */}
      {(step === 'token' || step === 'details') && (
        <p className="flex items-center justify-between gap-3 rounded-flat-sm border border-ink bg-paper p-3 text-base text-ink">
          <span>
            <span className="font-semibold">
              {selectedToken === null
                ? `${config.displayName} · ${config.symbol}`
                : `${selectedToken.name} · ${selectedToken.symbol}`}
              {/* Lane 1: the selected token's verified state, beside
                  its name in the summary. */}
              {selectedToken !== null &&
                (isVerifiedToken(selectedToken) ? (
                  <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
                ) : (
                  <span className="ml-2" aria-label="Unverified token">Unverified</span>
                ))}
            </span>
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(step === 'details' ? 'token' : 'chain')}
          >
            Change
          </Button>
        </p>
      )}

      {step === 'details' && (
        <section aria-labelledby="send-details-heading" className="space-y-3">
          {/* Round 2, item 8: the step label above ("Step 3 of 6:
              Address & amount") is the visible title; the heading stays
              for screen readers so the section keeps its name. */}
          <h2 id="send-details-heading" className="sr-only">
            {`Address & amount · ${config.displayName}`}
          </h2>
          {/* Redesign Lane 3: the error summary sits at the top of the
              step, where the user is looking, and takes focus — the
              old preview error rendered below the action row, where a
              failed Review looked like nothing had happened. */}
          {showSummary && (
            <div
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
              className="space-y-1 rounded-flat-lg border border-ink bg-paper p-3 outline-none"
            >
              <p className="font-semibold">Check before you review</p>
              <ul className="list-inside list-disc space-y-1 text-base">
                {recipientError !== null && (
                  <li>
                    <a
                      href="#send-recipient"
                      className="underline underline-offset-4"
                      onClick={(event) => {
                        event.preventDefault();
                        focusField('send-recipient');
                      }}
                    >
                      {recipientError}
                    </a>
                  </li>
                )}
                {preview !== null && !preview.ok && (
                  <li>
                    <a
                      href="#send-amount"
                      className="underline underline-offset-4"
                      onClick={(event) => {
                        event.preventDefault();
                        focusField('send-amount');
                      }}
                    >
                      {preview.reason}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
          {/* Redesign Lane 3: the From/To/Balance list duplicated the
              recipient field ("To" mirrored the input, "—" when empty).
              The summary card keeps only what the form does not already
              say — where it is sent from, and what is available. The
              address wraps in full: truncating it would need a copy
              button to stay useful, and the copy lives on the
              Receive/account screens already. */}
          <div className="space-y-1 rounded-flat-sm border border-ink bg-paper p-3 text-base">
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-ink">From</span>
              {/* Lane P2-C (M6): the sending address pairs with its
                  identicon, like every other address display. */}
              <span className="flex min-w-0 items-start gap-2">
                <AddressIdenticon address={from} size={20} />
                <span className="min-w-0 break-all font-mono">{from}</span>
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-ink">Balance</span>
              <span>{balanceText}</span>
            </div>
            {/* P0-6: one line + the reason + a gated Retry (see
                failedBalance above). The flow is not blocked by a
                failed balance: Review re-reads it live through the
                adapters (handleAmountNext), so this Retry restores
                the check — it does not gate the flow. */}
            {failedBalance !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-border pt-2">
                <p className="text-sm text-muted-foreground">
                  {failedBalance.reason
                    ? `Balance unavailable. ${humanReasonMessage(failedBalance.reason, 'balance')}`
                    : 'Balance unavailable.'}
                </p>
                {balanceRetryable && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void (selectedToken !== null
                        ? refreshTokenBalances()
                        : refreshBalances())
                    }
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Check the address. Sent funds can&apos;t come back.
          </p>
          {/* Lane 3 (UX-major): copycat warning — the selected token is
              unverified, but a verified token with the same name or
              symbol exists on this chain under a different contract.
              The token is never called a scam: the user is told to
              check the contract address. */}
          {tokenNamesake !== null && selectedToken !== null && (
            <p
              role="alert"
              className="rounded-flat-lg border border-warning-border bg-warning-surface p-3 text-base text-warning-text"
            >
              {`Unverified ${selectedToken.symbol} — a verified ${tokenNamesake.symbol} exists on ${config.displayName}. Check the contract address before sending.`}
            </p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="send-recipient">Recipient address</Label>
            </div>
            {/* P2-A, M7: Scan OR paste in one row at the recipient
                entry — the two ways in are offered together, with an
                explicit OR between them, so the user never has to
                discover that pasting or scanning is possible. The
                scan button keeps its aria-label, so the existing
                scan tests still find it. */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Scan QR code"
                aria-expanded={showScanner}
                title="Scan QR code"
                onClick={() => {
                  setShowScanner((current) => !current);
                }}
              >
                <ScanIcon className="h-5 w-5 text-ink" />
                Scan
              </Button>
              <span aria-hidden="true" className="text-sm text-muted-foreground">
                OR
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handlePaste()}
              >
                Paste
              </Button>
            </div>
            <Input
              id="send-recipient"
              type="text"
              value={recipient}
              onChange={(event) => handleRecipientChange(event.target.value)}
              onBlur={() => void handleRecipientBlur()}
              placeholder={
                isEvmTxChain(chain)
                  ? `Enter ${/^[AEIOU]/.test(config.displayName) ? 'an' : 'a'} ${config.displayName} address or .eth name`
                  : `Enter ${/^[AEIOU]/.test(config.displayName) ? 'an' : 'a'} ${config.displayName} address`
              }
              autoComplete="off"
              aria-invalid={recipientError !== null}
              aria-describedby={recipientError !== null ? 'send-recipient-error' : undefined}
            />
            {recipientError && (
              <p id="send-recipient-error" role="alert" className="text-base text-error">
                {recipientError}
              </p>
            )}
            {/* P2-A, M1: the ENS resolution state — "Resolving…" while
                the name resolves, then the name + shortened resolved
                address, so the user sees what the name means before
                Review. A bad name reports "Invalid address" above. */}
            {ensStatus === 'resolving' && (
              <p aria-live="polite" className="text-base text-ink">
                Resolving…
              </p>
            )}
            {ensStatus === 'resolved' && resolvedRecipient !== null && (
              <p aria-live="polite" className="text-base text-ink">
                {ensName} → {shortAddress(resolvedRecipient)}
              </p>
            )}
            {/* Lane 3 (UX-major): what the pasted value looks like — the
                network it belongs to, or a warning when it belongs to
                another network, is a secret, or is the token's own
                contract. Advisory only: Review is still gated by
                validateRecipient, and a warning never blocks it. */}
            {recipientDetection !== null && (
              <p
                role={recipientDetection.tone === 'warn' ? 'alert' : 'note'}
                className="text-base text-ink"
              >
                {recipientDetection.text}
              </p>
            )}
            {pasteNote !== null ? (
              <p role="note" className="text-base text-ink">
                {pasteNote}
              </p>
            ) : (
              prefillNote !== null && (
                <p role="note" className="text-base text-ink">
                  {prefillNote}
                </p>
              )
            )}
          </div>
          {/* Address book (UX-major Lane 5): a saved label for this chain
              fills the recipient. Only entries saved by the user on the
              Address book screen appear — nothing is added from history.
              The Manage link below renders even with an empty book
              (Lane T2 F3): otherwise a first-time mobile user could
              never reach the screen that adds the first entry. */}
          {bookForChain.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="send-address-book">Saved addresses</Label>
              <select
                id="send-address-book"
                value=""
                onChange={(event) => {
                  if (event.target.value !== '') {
                    handleRecipientChange(event.target.value);
                  }
                }}
                className="w-full rounded-flat-lg border border-ink bg-paper px-3 py-2 text-base text-ink"
              >
                <option value="">Choose a saved address…</option>
                {bookForChain.map((entry) => (
                  <option key={entry.id} value={entry.address}>
                    {entry.label} — {shortAddress(entry.address)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            <Link
              to="/address-book"
              className="font-medium underline underline-offset-4"
            >
              Manage saved addresses
            </Link>
          </p>
          {showScanner && (
            <QrScanner
              onScan={(value) => void handleScan(value)}
              onCancel={() => setShowScanner(false)}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="send-amount">{`Amount (${assetSymbol})`}</Label>
            {/* Redesign Lane 3: the amount is the decision input, so it
                reads like one — a large h-14 group with Max inside
                (DESIGN-SYSTEM §6: "amount large with balance + Max
                beside it"). A plain input inside the bordered group:
                the shared Input carries its own border, and cn() is a
                plain join, so nesting it would double the border.
                P3-B: the group's focus signal is a coral ring on
                focus-within (the inner input is outline-none, so the
                old wavy focus underline was its only signal — and it
                is gone under style B); an invalid amount turns the
                group's border red, and the error text below it is red
                too. */}
            <div className={`flex h-14 items-center gap-2 rounded-flat-lg border ${amountError !== null ? 'border-error' : 'border-ink'} bg-paper pl-4 pr-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-coral`}>
              <input
                id="send-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.0"
                autoComplete="off"
                aria-invalid={amountError !== null}
                aria-describedby={amountError !== null ? 'send-amount-error' : undefined}
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground selection:bg-sun selection:text-ink"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!maxInfo.enabled}
                title={maxInfo.enabled ? 'Use the full balance minus the estimated fee' : maxInfo.reason}
                onClick={handleMax}
              >
                Max
              </Button>
            </div>
            {amountError && (
              <p id="send-amount-error" role="alert" className="text-base text-error">
                {amountError}
              </p>
            )}
            {/* Redesign Lane 3: the fiat equivalent under the amount
                (DESIGN-SYSTEM §6). The per-unit price shows while no
                amount is typed; the converted amount replaces it once
                typed. Mainnet only, fresh quote only — devnet test
                tokens have no value, and a stale or missing feed shows
                nothing rather than an invented dollar figure. */}
            {amountFiatText !== null && (
              <p className="text-sm text-muted-foreground">{amountFiatText}</p>
            )}
            {priceUnavailable && (
              <p className="text-sm text-muted-foreground">
                Price unavailable.
              </p>
            )}
            {/* Lane 6 (UX-major programme): the fee line shows on
                every chain that quotes one. Before, only ETH got a
                formatted fee, other chains got only the note, and TON
                token sends got nothing at all. Rates (BTC sat/vB,
                TRON native energy) render as rates, never as amounts
                (wallet/fee-display.ts); the fiat value is the live
                native feed. The fee line sits before the primary
                button (DESIGN-SYSTEM §6). */}
            {feeEstimate === null && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Checking the network fee…
              </p>
            )}
            {feeDisplay?.kind === 'amount' && feeEstimate?.ok && (
              <p className="text-sm text-muted-foreground">
                Estimated fee:{' '}
                {/* Estimated fee is a preview: Decimal rounds display to 6 places; the review screen keeps the exact fee. */}
                {formatFeePreview(feeEstimate.feeBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}
                {feeFiatText !== null && ` (${feeFiatText})`}
                {' — it may change before signing.'}
              </p>
            )}
            {feeDisplay?.kind === 'amount' && feeEstimate?.ok && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeDisplay?.kind === 'rate' && feeEstimate?.ok && (
              <p className="text-sm text-muted-foreground">
                Network fee rate: {feeDisplay.rateText} — the final fee
                depends on the transaction.
              </p>
            )}
            {feeDisplay?.kind === 'rate' && feeEstimate?.ok && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeDisplay?.kind === 'unknown' && feeEstimate?.ok && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeEstimate && !feeEstimate.ok && (
              <p className="text-sm text-muted-foreground">
                {`Fee estimate unavailable: ${feeEstimate.reason}`}
              </p>
            )}
            {/* P2-A, M2: fee tiers — Slow / Standard / Fast, each with
                its time estimate and cost in Gwei, from the live fee
                data. The selected tier is the fee the line above
                shows, the fee the review shows, and the fee that
                signs. Hidden when the chain has no tier data: the
                flat fee above stands instead. */}
            {feeTiers !== null && selectedFeeTier !== null && feeEstimate?.ok && (
              <div className="space-y-2">
                <p id="send-fee-tier-label" className="text-sm text-muted-foreground">
                  Fee speed
                </p>
                <div role="group" aria-labelledby="send-fee-tier-label" className="flex gap-2">
                  {feeTiers.map((tier) => {
                    const active = tier.id === selectedFeeTier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFeeTierId(tier.id)}
                        className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-flat-sm border border-ink p-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${active ? 'bg-sun' : 'bg-paper hover:bg-sun'}`}
                      >
                        <span className="font-semibold">{tier.label}</span>
                        <span>{tier.estimatedLabel}</span>
                        <span>{formatGwei(tier.maxFeePerGasWei)} Gwei</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Lane 6: what the fee does NOT offer, stated once in a
                disclosure instead of cluttering the line. Fee-token
                payment is not supported on any network here — the fee
                is always paid in the native coin. On EVM networks the
                speed choice above is live (Slow / Standard / Fast);
                other networks quote one live fee, and a speed menu
                there would need invented multipliers. */}
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer py-2 font-medium text-ink">
                About this fee
              </summary>
              <p className="leading-relaxed">
                {feeTiers !== null
                  ? `The fee speed above is live for this network: Slow, Standard and Fast are derived from the network's current fee data. The fee is paid in ${config.symbol}; paying it in another token is not supported on any network here. TON has no fee estimate in advance: the network charges the fee when the transaction is broadcast.`
                  : `The wallet quotes one live gas price per network — there is no slow/standard/fast choice yet. The fee is paid in ${config.symbol}; paying it in another token is not supported on any network here. TON has no fee estimate in advance: the network charges the fee when the transaction is broadcast.`}
              </p>
            </details>
            {/* Redesign Lane 3: the Max-disabled reason and the fee
                notes sit above the action row now — measured before,
                they rendered below it and were invisible in the
                viewport, so Max looked broken and a failed Review
                looked like nothing had happened. */}
            {!maxInfo.enabled && (
              <p className="text-sm text-muted-foreground">{maxInfo.reason}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" size="md" onClick={() => setStep('token')}>
              Back
            </Button>
            <Button
              type="button"
              size="md"
              disabled={previewBusy}
              onClick={() => void handleDetailsNext()}
            >
              {previewBusy ? 'Checking…' : 'Review'}
            </Button>
          </div>
        </section>
      )}

      {step === 'review' && preview && preview.ok && (
        <div className="space-y-4">
          <SendReview
            chainName={config.displayName}
            symbol={config.symbol}
            from={from}
            recipient={effectiveRecipient}
            amount={reviewAmountText}
            fiatAmount={reviewFiatAmount ?? undefined}
            fee={
              preview.feeUnknown
                ? 'Unknown. Charged by the network at broadcast.'
                : formatNativeWithSymbol(
                    reviewNativeCostBaseUnits ?? preview.feeBaseUnits,
                    CHAIN_DECIMALS[chain],
                    config.symbol,
                  ) +
                  (reviewFeeFiatText !== null ? ` (${reviewFeeFiatText})` : '')
            }
            total={reviewTotalText}
            feeNote={preview.feeNote}
            feeBreakdown={reviewFeeBreakdown}
            tokenContract={selectedToken?.contract}
            contractCall={reviewContractCall}
            tokenWarning={
              tokenNamesake !== null && selectedToken !== null
                ? `Unverified ${selectedToken.symbol} — a verified ${tokenNamesake.symbol} exists on ${config.displayName}. Check the contract address before signing.`
                : undefined
            }
            disabledReason={BROADCAST_DISABLED_MESSAGE}
            stage={approvalStage}
            devnetNetworkName={devnetName}
            onBack={handleReviewBack}
            onSign={() => void handleSign()}
          />
          {signState.status === 'signing' && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Signing offline…
            </p>
          )}
          {signState.status === 'error' && (
            <div role="alert" className="space-y-2 text-base">
              <p className="text-error">
                {signState.reason}
              </p>
              {vaultState !== 'unlocked' && (
                <Link
                  to="/lock"
                  className="inline-block font-medium text-primary underline underline-offset-4"
                >
                  Go to the lock screen to unlock
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'result' && signState.status === 'signed' && (
        <section aria-labelledby="send-result-heading" className="space-y-4">
          <h2 id="send-result-heading" className="font-semibold">
            {devnetEnabled && devnetBroadcast.status === 'error'
              ? 'Send signed — broadcast failed'
              : devnetEnabled
                ? 'Send broadcast to the test network'
                : 'Send signed, not sent'}
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            {devnetEnabled && devnetBroadcast.status === 'error'
              ? `The transaction was signed offline with your vault key. The broadcast to the ${devnetName ?? config.displayName} test network failed — it was not broadcast. Test tokens have no value.`
              : devnetEnabled
                ? `The transaction was signed offline with your vault key and broadcast to the ${devnetName ?? config.displayName} test network. Test tokens have no value.`
                : 'The transaction was signed offline with your vault key. It was not sent anywhere. Sending funds is switched off until it is separately approved.'}
          </p>
          {devnetEnabled && devnetBroadcast.status === 'broadcasting' && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Broadcasting to the test network…
            </p>
          )}
          {devnetEnabled && devnetBroadcast.status === 'submitted' && (
            <div className="space-y-2 text-base">
              <p className="text-ink">
                Sent — track it on the explorer.
              </p>
              <a
                href={devnetBroadcast.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block break-all font-medium text-primary underline underline-offset-4"
              >
                {devnetBroadcast.explorerUrl}
              </a>
            </div>
          )}
          {devnetEnabled && devnetBroadcast.status === 'error' && (
            <div role="alert" className="space-y-2 text-base">
              <p className="text-error">
                {devnetBroadcast.reason}
              </p>
              <p className="text-muted-foreground">
                Signed, not sent. Check the network before retrying.
              </p>
            </div>
          )}
          <dl className="space-y-1 text-base">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="min-w-0 break-all font-mono">
                {signState.txHash}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <Label htmlFor="send-signed-payload">
              {signState.payloadLabel}
            </Label>
            <pre
              id="send-signed-payload"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-flat-lg border border-border bg-muted p-4 text-xs"
            >
              {signState.payload}
            </pre>
            <Button type="button" variant="secondary" onClick={() => void copyPayload()}>
              {copied ? 'Copied' : 'Copy signed transaction'}
            </Button>
          </div>
          <p className="text-sm leading-5 text-muted-foreground">
            Unclear? Don&apos;t resend. Check the network first.
          </p>
          <Link
            to="/"
            className="inline-block text-base font-medium text-primary underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </section>
      )}

      {/* Redesign Lane 3: the bottom nav is hidden on /send, so this is
          the in-flow way across to Receive — kept only where it is a
          natural next action: flow entry (chain) and after a signed
          send (result). On token/details/review it competes with the
          flow it sits under. */}
      {(step === 'chain' || step === 'result') && (
        <Link
          to="/receive"
          className="inline-block text-base font-medium underline underline-offset-4"
        >
          Receive
        </Link>
      )}
      </div>
    </div>
  );
}
