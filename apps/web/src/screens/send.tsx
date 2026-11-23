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
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../ui/components/button';
import { ScanIcon } from '../ui/components/icons';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import {
  ensureAdapters,
  ensureDevnetAdapters,
  humanReasonMessage,
  useWallet,
} from '../state/wallet-context';
import { chainConfig, SUPPORTED_CHAINS } from '../wallet/chains';
import { DEVNET_CHAIN_CONFIGS, devnetChainConfig } from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { formatFeePreview } from '../wallet/money';
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
  isVerifiedToken,
  orderAssetsByBalance,
  shortContract,
  tokenKey,
  tokenKeyOf,
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
  broadcastSignedDevnet,
  type SendPreview,
} from '../wallet/send';
import { getLatestBlockHeader } from '../wallet/adapters/trx';
import { getAdapterForMode } from '../wallet/adapters';
import { recordPendingBroadcastDevnet } from '../state/pending-broadcasts';
import { accountName, getSessionPassphrase, withMnemonicAsync } from '../wallet/vault';
import { BROADCAST_DISABLED_MESSAGE } from '../wallet/adapters/types';
import { QrScanner } from '../wallet/qr-scanner';
import { SendReview } from './send-review';
import { ChainLogo, TokenLogo } from './token-logo';
import { TokenPickerRow } from './token-picker-row';
import type { SendApprovalStage } from './send-approval';
import type { ChainId } from '../engine/boundary';

// Chains with offline signing today (wallet/send.ts). BSC joined
// 2026-11-24: it is EVM, so the general EVM signer covers it with
// chain id 56. Token sends and native sends on the other registry
// chains are not built: the asset picker shows them, but the amount
// step says so honestly instead of pretending to send (token gaps,
// item 4).
const SIGNING_CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton', 'bsc'];

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
  const { vaultState, vaultAddresses, vaultAccount, vaultAccounts: vaultAccountsRaw, selectVaultAccount, balances, selectedChain, customTokens, tokenBalances, devnetEnabled } = useWallet();
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
  const chainsWithWallet: ChainId[] = SUPPORTED_CHAINS.filter(
    (chain) => (vaultAddresses[chain] ?? []).length > 0,
  );
  const [chain, setChain] = useState<ChainId>(
    chainsWithWallet.includes(selectedChain)
      ? selectedChain
      : (chainsWithWallet[0] ?? 'eth'),
  );
  const [step, setStep] = useState<Step>('chain');
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  // Lane J: the dashboard Scan tile links to /send?scan=1, so the
  // scanner opens on arrival. Unknown params are ignored by
  // parseBawaSendLink, so ?scan=1 alone never becomes a send link.
  const [showScanner, setShowScanner] = useState(
    () => searchParams.get('scan') === '1',
  );
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [signState, setSignState] = useState<SignState>({ status: 'idle' });
  const [approvalStage, setApprovalStage] = useState<SendApprovalStage>('review');
  const [devnetBroadcast, setDevnetBroadcast] = useState<DevnetBroadcastState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  // Full asset list (token gaps, item 4): the selected chain's native
  // coin plus its tokens. Token sends are not built (see SIGNING_CHAINS
  // above) — picking one shows the honest unavailable state.
  const [selectedToken, setSelectedToken] = useState<TokenRecord | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const prefillApplied = useRef(false);
  const allTokens = [...DEFAULT_TOKENS, ...(customTokens ?? [])];
  const chainTokens = allTokens.filter((token) => token.chain === chain);
  const assetSymbol = selectedToken?.symbol ?? chainConfig(chain).symbol;

  const from = (vaultAddresses[chain] ?? [])[0] ?? '';
  const config = chainConfig(chain);
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
    setSignState({ status: 'idle' });
    setPrefillNote(null);
    setDevnetBroadcast({ status: 'idle' });
    // A manual chain change abandons the deep link: it must not
    // re-apply on the next mount. The link params leave the URL too,
    // or the sync effect above would resurrect the link from them.
    if (pendingLink !== null) {
      setPendingLink(null);
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
    setSignState({ status: 'idle' });
    setPrefillNote(null);
    // A manual token change abandons the deep link, same as a chain
    // change above: clear it and strip its params from the URL.
    if (pendingLink !== null) {
      setPendingLink(null);
      clearPendingSendLink();
      navigate('/send', { replace: true });
    }
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
    setSelectedToken(tokenRecord);
    setRecipient(prefill.to);
    if (prefill.amount !== undefined) setAmount(prefill.amount);
    setStep('details');
    setPreview(null);
    setSignState({ status: 'idle' });
    if (prefill.tokenContract !== undefined && tokenRecord === null) {
      setPrefillNote(
        'This link pays a token that is not in your wallet yet. Add it from its contract address first.',
      );
    } else {
      setPrefillNote(null);
    }
    const result = await validateRecipient(prefill.chain, prefill.to);
    if (result.ok) {
      setRecipientError(null);
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
      <p className="text-sm leading-relaxed text-muted-foreground">
        This link asks to send{' '}
        <span className="font-semibold text-ink">{amountText}</span> to{' '}
        <code className="break-all font-mono text-ink">{link.to}</code> on{' '}
        {chainConfig(link.chain).displayName}.
      </p>
    );
  }

  // Round 2, item 8: recipient and amount share one step, so there is a
  // single Continue: validate the recipient, then preview the amount.
  // A bad recipient stops here with its error; a token or a chain
  // without offline signing reports honestly instead of previewing.
  async function handleDetailsNext(): Promise<void> {
    const recipientResult = await validateRecipient(chain, recipient, { devnet: devnetEnabled });
    if (!recipientResult.ok) {
      setRecipientError(recipientResult.reason);
      return;
    }
    setRecipientError(null);
    await handleAmountNext();
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
    // The amount input shares this step, so a valid scan just fills
    // the recipient — there is no step to advance to.
  }

  async function handleAmountNext(): Promise<void> {
    // Token sends and native sends on chains without offline signing
    // are not built: say so here instead of previewing a native send
    // the user did not ask for (token gaps, item 4).
    if (selectedToken !== null) {
      setPreview({
        ok: false,
        code: 'adapter-unavailable',
        reason: `Sending ${selectedToken.symbol} isn't available yet. This wallet signs native BTC, ETH, BNB, TRX and TON transfers offline only — token sending is not built yet.`,
      });
      return;
    }
    if (!SIGNING_CHAINS.includes(chain)) {
      setPreview({
        ok: false,
        code: 'adapter-unavailable',
        reason: `Sending on ${config.displayName} isn't available yet. This wallet signs native BTC, ETH, BNB, TRX and TON transfers offline only.`,
      });
      return;
    }
    setPreviewBusy(true);
    try {
      try {
        await (devnetEnabled ? ensureDevnetAdapters() : ensureAdapters());
      } catch {
        setPreview({ ok: false, code: 'adapter-unavailable', reason: 'Balance adapters could not be loaded. Check your connection and retry.' });
        return;
      }
      const result = await previewSendAmount(chain, from, recipient, amount, { devnet: devnetEnabled });
      setPreview(result);
      if (result.ok) setStep('review');
    } finally {
      setPreviewBusy(false);
    }
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
    setApprovalStage('simulating');
    const simulation = await simulateSend(chain, from, recipient, amount, { devnet: devnetEnabled });
    if (!simulation.ok) {
      setSignState({ status: 'error', reason: simulation.reason });
      setApprovalStage('review');
      return;
    }

    setApprovalStage('signing');
    setSignState({ status: 'signing' });
    try {
      const signed = await withMnemonicAsync(async (mnemonic) => {
        const adapter = getAdapterForMode(chain, devnetEnabled);
        if (!adapter) throw new Error("Sending isn't available for this network.");
        if (chain === 'eth' || chain === 'bsc') {
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
            recipient,
            previewOk.amountBaseUnits,
            String(inputs.data.nonce),
            gasPrice,
            { devnet: devnetEnabled },
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
            recipient,
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
            recipient,
            previewOk.amountBaseUnits,
            header.data,
            { devnet: devnetEnabled },
          );
          if (!result.ok) return result;
          return signedTxResult(result.txId, result.signedTxJson, 'Signed transaction (JSON)');
        }
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok') throw new Error(inputs.reason);
        if (inputs.data.kind !== 'seqno') {
          throw new Error("We couldn't prepare your TON transaction. Please retry.");
        }
        const result = await signTonOffline(
          mnemonic,
          getSessionPassphrase(),
          recipient,
          previewOk.amountBaseUnits,
          inputs.data.seqno,
          { devnet: devnetEnabled, account: vaultAccount.account },
        );
        if (!result.ok) return result;
        return signedTxResult(result.messageHash, result.signedBocBase64, 'Signed message (base64 BOC)');
      });
      if (!signed.ok) {
        setSignState({ status: 'error', reason: signed.reason });
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
        } catch (error) {
          setDevnetBroadcast({
            status: 'error',
            reason:
              error instanceof Error ? error.message : 'Broadcast failed.',
          });
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
    | { ok: true; feeBaseUnits: string; note: string }
    | { ok: false; reason: string }
    | null
  >(null);

  useEffect(() => {
    if (step !== 'details') return;
    let cancelled = false;
    setFeeEstimate(null);
    if (selectedToken !== null) {
      // Token sends are not built, so no fee estimate applies.
      setFeeEstimate({ ok: false, reason: 'A fee estimate is not available for token sends.' });
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
          ? { ok: true, feeBaseUnits: result.data.feeBaseUnits, note: result.data.note }
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
  }, [step, chain, selectedToken, devnetEnabled]);

  // Max preserves the fee reserve. Only ETH has a flat native fee estimate
  // (gasPrice x 21000): BTC quotes a sat/vB rate, TRX quotes SUN per unit
  // of energy, and TON has no fee estimate — for those chains Max stays
  // disabled with the honest reason, per spec §8.
  const maxInfo = ((): { enabled: false; reason: string } | { enabled: true; maxBaseUnits: string } => {
    if (selectedToken !== null) return { enabled: false, reason: 'Max is unavailable for tokens: token sending is not built yet.' };
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
    const decimals = CHAIN_DECIMALS[chain];
    const divisor = 10n ** BigInt(decimals);
    const whole = maxBase / divisor;
    const frac = (maxBase % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
    setAmount(frac ? `${whole}.${frac}` : `${whole}`);
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
          <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
          {pendingLink !== null && pendingLinkSummary(pendingLink)}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {pendingLink !== null
              ? 'Your wallet is locked. Unlock it to continue with this send.'
              : 'Your wallet is locked. Unlock it to send.'}
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
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        {pendingLink !== null && pendingLinkSummary(pendingLink)}
        <p className="text-sm leading-relaxed text-muted-foreground">
          No wallet yet. Create or import a wallet first — sending needs a
          vault address to send from.
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
        {pendingLink !== null && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            This payment is kept — once your wallet is ready, open Send
            and it will be filled in.
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
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        {pendingLinkSummary(pendingLink)}
        <p className="text-sm leading-relaxed text-muted-foreground">
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
                  className="flex w-full flex-col gap-1 rounded-bawa-sm border-2 border-ink bg-paper p-3 text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
                >
                  <span className="text-sm font-semibold">
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
          <p role="alert" className="text-sm text-ink bawa-squiggle-underline">
            {chooserError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        {/* Round 2, item 8: the banner sets expectations at flow entry
            (chain) and where the user acts (details onwards). The token
            step is a pure picker — the banner hides there so all eight
            token rows fit without scrolling. */}
        {step !== 'token' && (
        <p
          role="note"
          className="rounded-bawa border-2 border-ink bg-sun p-4 text-sm text-ink"
        >
          {devnetEnabled
            ? `Devnet test mode. This send broadcasts to the ${devnetChainConfig(chain).devnetName} test network only. Test tokens have no value.`
            : 'Sending funds is switched off until it is separately approved. This flow signs offline only. Nothing here sends cryptocurrency anywhere.'}
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
                    className={`flex size-8 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink text-sm text-ink ${
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
                    <span aria-hidden="true" className="mx-1 flex-1 border-t-2 border-dashed border-ink" />
                  )}
                </li>
              ))}
            </ol>
            <p className="text-body-sm font-medium text-panel-text-muted">
              {`Step ${activeIndex + 1} of 6: ${steps[activeIndex]}`}
            </p>
          </div>
        );
      })()}

      {step === 'chain' && (
        <section aria-labelledby="send-chain-heading" className="space-y-3">
          <h2 id="send-chain-heading" className="text-lg font-semibold">
            Choose a network
          </h2>
          <p className="text-sm text-muted-foreground">
            Sending is switched off on mainnet. This flow signs offline only — nothing here sends cryptocurrency anywhere.
          </p>
      {/* Scan first (UI/UX Round 2, item 1): a payment QR fills in
          the network, token, amount and address by itself, so the
          scanner lives here too — not only on the recipient step,
          after the network and token were already picked by hand. */}
      <div className="flex flex-wrap items-center gap-3 rounded-bawa-sm border-2 border-ink bg-paper p-3">
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
          <p className="text-sm font-semibold text-ink">Scan a QR code</p>
          <p className="text-sm text-muted-foreground">
            Scan a payment QR and the network, token, amount and address fill in themselves.
          </p>
        </div>
      </div>
      {prefillNote && (
        <p role="note" className="text-sm text-ink">
          {prefillNote}
        </p>
      )}
      {showScanner && (
        <QrScanner
          onScan={(value) => void handleScan(value)}
          onCancel={() => setShowScanner(false)}
        />
      )}
          <div
            role="group"
            aria-label="Chain"
            className="flex flex-wrap gap-2"
          >
            {SUPPORTED_CHAINS.map((candidate) => {
              const hasWallet = (vaultAddresses[candidate] ?? []).length > 0;
              return (
                <Button
                  key={candidate}
                  type="button"
                  variant={candidate === chain ? 'default' : 'outline'}
                  disabled={!hasWallet}
                  aria-pressed={candidate === chain}
                  className="h-9"
                  title={
                    hasWallet
                      ? undefined
                      : `No ${chainConfig(candidate).displayName} wallet`
                  }
                  onClick={() => selectChain(candidate)}
                >
                  {chainConfig(candidate).displayName}
                </Button>
              );
            })}
          </div>
        </section>
      )}

      {step === 'token' && (
      <section aria-labelledby="send-token-heading" className="space-y-3">
        <h2 id="send-token-heading" className="text-lg font-semibold">
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
                  logo={
                    <>
                      {/* Lane G: the real chain/token mark — the
                          hand-drawn blob with the ticker text inside
                          rendered as a crossed-out logo. */}
                      {token === null ? (
                        <ChainLogo chain={chain} size={24} />
                      ) : (
                        <TokenLogo symbol={token.symbol} size={24} />
                      )}
                    </>
                  }
                >
                  {label}
                  {token !== null && isVerifiedToken(token) && (
                    <span className="ml-2" aria-label="Verified token">✓ Verified</span>
                  )}
                  {token !== null && (
                    <span className="font-normal text-ink">
                      {` · ${config.displayName} · ${shortContract(token.contract)}`}
                    </span>
                  )}
                  {token === null && (
                    <span className="font-normal text-ink"> · Native coin</span>
                  )}
                </TokenPickerRow>
              );
            })}
        </ul>
        {selectedToken !== null && (
          <p className="text-sm text-ink">
            {`Sending ${selectedToken.symbol} isn't available yet. This wallet signs native BTC, ETH, BNB, TRX and TON transfers offline only — token sending is not built yet.`}
          </p>
        )}
        {!SIGNING_CHAINS.includes(chain) && selectedToken === null && (
          <p className="text-sm text-ink">
            {`Sending on ${config.displayName} isn't available yet. This wallet signs native BTC, ETH, BNB, TRX and TON transfers offline only.`}
          </p>
        )}
        </section>
      )}

      {step !== 'chain' && (
        <p className="flex items-center justify-between gap-3 rounded-bawa-sm border-2 border-ink bg-paper p-3 text-sm text-ink">
          <span>
            <span className="font-semibold">
              {selectedToken === null
                ? `${config.displayName} · ${config.symbol}`
                : `${selectedToken.name} · ${selectedToken.symbol}`}
            </span>
          </span>
          <Button type="button" variant="outline" onClick={() => setStep('chain')}>
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
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink">From</dt>
              <dd className="min-w-0 truncate font-mono" title={from}>{from}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink">To</dt>
              <dd className="min-w-0 truncate font-mono" title={recipient}>{recipient === '' ? '—' : recipient}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-ink">Balance</dt>
              <dd>{balanceText}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">
            Check the address — sent funds cannot be reversed.
          </p>
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="send-recipient">Recipient address</Label>
              {/* Scan icon from the owner's reference (UI/UX Round 2,
                  item 9): a black circle with white corner brackets.
                  Same toggle as the chain-step scan card, with the
                  item-9 label and expanded state. */}
              <button
                type="button"
                aria-label="Scan QR code"
                aria-expanded={showScanner}
                title="Scan QR code"
                onClick={() => {
                  setShowScanner((current) => !current);
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
              >
                <ScanIcon className="h-11 w-11 text-ink" />
              </button>
            </div>
            <Input
              id="send-recipient"
              type="text"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={`Enter ${/^[AEIOU]/.test(config.displayName) ? 'an' : 'a'} ${config.displayName} address`}
              autoComplete="off"
            />
            {recipientError && (
              <p role="alert" className="text-sm text-ink bawa-squiggle-underline">
                {recipientError}
              </p>
            )}
            {prefillNote && (
              <p role="note" className="text-sm text-ink">
                {prefillNote}
              </p>
            )}
          </div>
          {showScanner && (
            <QrScanner
              onScan={(value) => void handleScan(value)}
              onCancel={() => setShowScanner(false)}
            />
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="send-amount">{`Amount (${assetSymbol})`}</Label>
              <Button
                type="button"
                variant="outline"
                disabled={!maxInfo.enabled}
                title={maxInfo.enabled ? 'Use the full balance minus the estimated fee' : maxInfo.reason}
                onClick={handleMax}
              >
                Max
              </Button>
            </div>
            <Input
              id="send-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              autoComplete="off"
            />
            {feeEstimate?.ok && chain === 'eth' && (
              <p className="text-sm text-muted-foreground">
                Estimated fee:{' '}
                {/* Estimated fee is a preview: Decimal rounds display to 6 places; the review screen keeps the exact fee. */}
                {formatFeePreview(feeEstimate.feeBaseUnits, CHAIN_DECIMALS[chain], config.symbol)}
                {' — it may change before signing.'}
              </p>
            )}
            {feeEstimate?.ok && chain !== 'eth' && chain !== 'ton' && (
              <p className="text-sm text-muted-foreground">{feeEstimate.note}</p>
            )}
            {feeEstimate && !feeEstimate.ok && (
              <p className="text-sm text-muted-foreground">
                {`Fee estimate unavailable: ${feeEstimate.reason}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep('token')}>
              Back
            </Button>
            <Button
              type="button"
              disabled={previewBusy}
              onClick={() => void handleDetailsNext()}
            >
              {previewBusy ? 'Checking…' : 'Review'}
            </Button>
          </div>
          {/* The Max and preview notes sit below the action row so the
              Review button stays in view without scrolling. */}
          {!maxInfo.enabled && (
            <p className="text-sm text-muted-foreground">{maxInfo.reason}</p>
          )}
          {preview && !preview.ok && (
            <p role="alert" className="text-sm text-ink bawa-squiggle-underline">
              {preview.reason}
            </p>
          )}
        </section>
      )}

      {step === 'review' && preview && preview.ok && (
        <div className="space-y-4">
          <SendReview
            chainName={config.displayName}
            symbol={config.symbol}
            from={from}
            recipient={recipient}
            amount={formatNativeWithSymbol(
              preview.amountBaseUnits,
              CHAIN_DECIMALS[chain],
              config.symbol,
            )}
            fee={
              preview.feeUnknown
                ? 'Unknown. Charged by the network at broadcast.'
                : formatNativeWithSymbol(
                    preview.feeBaseUnits,
                    CHAIN_DECIMALS[chain],
                    config.symbol,
                  )
            }
            total={
              preview.feeUnknown
                ? `${formatNativeWithSymbol(
                    preview.amountBaseUnits,
                    CHAIN_DECIMALS[chain],
                    config.symbol,
                  )} + network fee`
                : formatNativeWithSymbol(
                    preview.totalBaseUnits,
                    CHAIN_DECIMALS[chain],
                    config.symbol,
                  )
            }
            feeNote={preview.feeNote}
            disabledReason={BROADCAST_DISABLED_MESSAGE}
            stage={approvalStage}
            devnetNetworkName={
              devnetEnabled ? devnetChainConfig(chain).devnetName : undefined
            }
            onBack={() => setStep('details')}
            onSign={() => void handleSign()}
          />
          {signState.status === 'signing' && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Signing offline…
            </p>
          )}
          {signState.status === 'error' && (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-ink bawa-squiggle-underline">
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
          <h2 id="send-result-heading" className="text-lg font-semibold">
            {devnetEnabled && devnetBroadcast.status === 'error'
              ? 'Send signed — broadcast failed'
              : devnetEnabled
                ? 'Send broadcast to the test network'
                : 'Send signed, not sent'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {devnetEnabled && devnetBroadcast.status === 'error'
              ? `The transaction was signed offline with your vault key. The broadcast to the ${devnetChainConfig(chain).devnetName} test network failed — it was not broadcast. Test tokens have no value.`
              : devnetEnabled
                ? `The transaction was signed offline with your vault key and broadcast to the ${devnetChainConfig(chain).devnetName} test network. Test tokens have no value.`
                : 'The transaction was signed offline with your vault key. It was not sent anywhere. Sending funds is switched off until it is separately approved.'}
          </p>
          {devnetEnabled && devnetBroadcast.status === 'broadcasting' && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Broadcasting to the test network…
            </p>
          )}
          {devnetEnabled && devnetBroadcast.status === 'submitted' && (
            <div className="space-y-2 text-sm">
              <p className="text-ink">
                Broadcast submitted — track it on the testnet explorer.
              </p>
              <a
                href={devnetBroadcast.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block break-all font-medium text-primary underline underline-offset-4"
              >
                {devnetBroadcast.explorerUrl}
              </a>
            </div>
          )}
          {devnetEnabled && devnetBroadcast.status === 'error' && (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-ink bawa-squiggle-underline">
                {devnetBroadcast.reason}
              </p>
              <p className="text-muted-foreground">
                The transaction is signed but was not broadcast. Check the
                test network first before retrying — never resend blindly.
              </p>
            </div>
          )}
          <dl className="space-y-1 text-sm">
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
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted p-4 text-xs"
            >
              {signState.payload}
            </pre>
            <Button type="button" variant="outline" onClick={() => void copyPayload()}>
              {copied ? 'Copied' : 'Copy signed transaction'}
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If it is ever unclear whether a transaction was sent, it stays unresolved —
            never resend it and never create a replacement without
            checking the network first.
          </p>
          <Link
            to="/"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </section>
      )}

      {/* The bottom nav is hidden on /send, so this is the in-flow way
          across to Receive — kept, and the chain chips shrink instead. */}
      <Link
        to="/receive"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Receive
      </Link>
    </div>
  );
}
