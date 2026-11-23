// Two import modes. Mode A (recovery phrase) restores a vault wallet: the
// phrase lives in this screen's local state only until it is validated and
// derived, then the input is cleared immediately, and on unmount. It is never
// stored, logged or passed to the watch-only path. Mode B (watch-only public
// key) keeps the existing behaviour exactly: a mnemonic, seed or private key
// must never be pasted there — secret-like input is rejected and cleared at
// once. Watch-only accounts can never sign.
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { WatchOnlyWallet } from '@bawa/contracts';
import { validateWatchOnlyImport, type ChainId } from '../engine/boundary';
import { useWallet } from '../state/wallet-context';
import {
  deriveAddresses,
  restoreWallet,
  type WalletAddresses,
} from '../wallet/core';
import { accountName, createVault, hasVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import {
  IMPORT_PHRASE_HINT,
  splitMnemonicAndPassphrase,
} from '../wallet/bip39-validation';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Tabs, TabsList, TabsTrigger } from '../ui/components/tabs';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { CopyButton } from '../ui/components/copy-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { toast } from '../ui/components/toast';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Unique-prefix completion for the recovery-phrase input (repo-study
// Phase 3, item 31): Tab completes the word being typed when exactly
// one BIP-39 word has that prefix. Ambiguous prefixes and already
// complete words are left alone, so Tab keeps its normal focus behaviour
// when nothing expands.
export function expandUniquePrefix(value: string): string {
  const start = value.lastIndexOf(' ') + 1;
  const prefix = value.slice(start).toLowerCase();

  if (!prefix || wordlist.includes(prefix)) return value;

  const matches = wordlist.filter((word) => word.startsWith(prefix));
  return matches.length === 1
    ? `${value.slice(0, start)}${matches[0]} `
    : value;
}

const chains: ChainId[] = [
  'btc',
  'eth',
  'trx',
  'ton',
  'sol',
  'bsc',
  'matic',
  'arb',
  'op',
  'base',
  'avax',
  'ltc',
  'doge',
];
// Token gaps, item 6 + item 8: the picker used to list only the first
// four chains even though validation (validateWatchOnlyImport), address
// derivation (deriveAddresses, incl. the single-address SOL/TON path)
// and the input labels below already cover all 13 registry chains. A
// Solana or Dogecoin address could not be watched at all.

type ImportInputConfig = {
  label: string;
  placeholder: string;
};

const inputConfigByChain: Record<ChainId, ImportInputConfig> = {
  btc: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  eth: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  trx: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  ton: { label: 'TON public address', placeholder: 'UQ… or 0:…' },
  sol: { label: 'Solana public address', placeholder: 'GjJy…' },
  bsc: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  matic: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  arb: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  op: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  base: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  avax: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  ltc: { label: 'Account public key (Ltub)', placeholder: 'Ltub…' },
  doge: { label: 'Account public key (dgub)', placeholder: 'dgub…' },
};

const MIN_PASSWORD_LENGTH = 8;
const DISPLAY_ORDER = ['eth', 'btc', 'trx', 'ton'] as const;
const CHAIN_LABELS: Record<string, string> = {
  eth: 'Ethereum',
  btc: 'Bitcoin',
  trx: 'TRON',
  ton: 'TON',
};

type ImportMode = 'phrase' | 'watch-only';
type PhraseStep = 'enter' | 'preview' | 'saved' | 'same' | 'different';

export function ImportWalletScreen() {
  const {
    xpubs,
    addXpub,
    refreshVaultAccounts,
    resetReceiveRotation = () => {},
    vaultAddresses,
    vaultAccounts,
    vaultPassphraseNeeded,
    createVaultAccounts,
    selectVaultAccount,
  } = useWallet();
  const imported = chains
    .map((id) => xpubs[id])
    .filter((wallet): wallet is WatchOnlyWallet => wallet !== null);
  const [mode, setMode] = useState<ImportMode>('phrase');

  // Mode B (watch-only) state — existing behaviour, unchanged.
  const [chain, setChain] = useState<ChainId>('btc');
  const [xpub, setXpub] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Mode A (recovery phrase) state.
  const [phrase, setPhrase] = useState('');
  const [phraseStep, setPhraseStep] = useState<PhraseStep>('enter');
  const [normalizedMnemonic, setNormalizedMnemonic] = useState<string | null>(null);
  const [derived, setDerived] = useState<WalletAddresses | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultPasswordConfirm, setVaultPasswordConfirm] = useState('');
  // The recovery passphrase (extra word) that came with the pasted
  // phrase, if any — from the split, never typed separately. It is never
  // stored; it shapes the previewed addresses below.
  const [splitPassphrase, setSplitPassphrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [addedAccount, setAddedAccount] = useState<number | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  // True when a vault exists but its addresses are not in memory (it is
  // locked), so a pasted phrase cannot be compared with it yet.
  const [compareUnavailable, setCompareUnavailable] = useState(false);

  // Clear the phrase when the screen unmounts.
  useEffect(() => () => {
    setPhrase('');
    setSplitPassphrase('');
    setNormalizedMnemonic(null);
  }, []);

  useEffect(() => {
    setVaultExists(hasVault());
  }, [mode]);

  async function handlePhraseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRestoring) return;
    setPhraseError(null);
    setAddedAccount(null);
    setCompareUnavailable(false);
    // One field takes every form: 12/15/18/21/24 words, or more words
    // where the rest is the recovery passphrase (the 25-word form).
    // The input is cleared immediately: a rejected phrase must not linger.
    const pasted = phrase;
    setPhrase('');
    let split: { mnemonic: string; passphrase: string };
    try {
      split = splitMnemonicAndPassphrase(pasted);
    } catch (cause) {
      setPhraseError(cause instanceof Error ? cause.message : IMPORT_PHRASE_HINT);
      return;
    }
    setIsRestoring(true);
    try {
      const restored = await restoreWallet(split.mnemonic);
      const addresses = await deriveAddresses(restored, split.passphrase);
      setNormalizedMnemonic(restored);
      setSplitPassphrase(split.passphrase);
      setDerived(addresses);
      // Lane C, item 6: a vault already exists. The old code blocked
      // here and told the user to delete it — even for the SAME phrase.
      // Instead, compare the derived addresses with the vault's: the
      // same phrase offers a new account from it; a different phrase
      // still needs a vault replace (one vault per phrase).
      if (hasVault()) {
        const currentEth = vaultAddresses.eth[0];
        const currentBtc = vaultAddresses.btc[0];
        if (currentEth === undefined || currentBtc === undefined) {
          // The vault is locked, so its addresses are not in memory
          // and nothing can be compared yet.
          setCompareUnavailable(true);
          setPhraseStep('different');
        } else if (
          addresses.eth === currentEth &&
          addresses.btc === currentBtc
        ) {
          setPhraseStep('same');
        } else {
          setPhraseStep('different');
        }
        return;
      }
      setPhraseStep('preview');
    } catch {
      setNormalizedMnemonic(null);
      setDerived(null);
      setSplitPassphrase('');
      setPhraseError(
        'That recovery phrase is not valid. Check every word and try again.',
      );
    } finally {
      setIsRestoring(false);
    }
  }

  // Lane C, item 6: the pasted phrase is the same as the vault's.
  // Add a new account from it (Account 2, Account 3, …) — no deletion,
  // no replacement. Blocked while the vault's recovery passphrase is
  // unknown to the session: a new account derived without it would get
  // the wrong addresses.
  async function handleAddSamePhraseAccount() {
    if (isAddingAccount) return;
    setPhraseError(null);
    setIsAddingAccount(true);
    try {
      const added = await createVaultAccounts(1);
      const next = added[0];
      if (next === undefined) throw new Error('No account was created.');
      await selectVaultAccount(next);
      setAddedAccount(next);
    } catch (cause) {
      setPhraseError(
        cause instanceof Error
          ? cause.message
          : 'The account could not be added. Please try again.',
      );
    } finally {
      setIsAddingAccount(false);
    }
  }

  async function handleSaveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || normalizedMnemonic === null) return;
    setPhraseError(null);
    if (vaultPassword.length < MIN_PASSWORD_LENGTH) {
      setPhraseError(`Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (vaultPassword !== vaultPasswordConfirm) {
      setPhraseError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    try {
      const profileIds = [...new Set(SUPPORTED_CHAINS.map((chainId) => profileFor(chainId)))];
      const mnemonic = normalizedMnemonic;
      const passphrase = splitPassphrase;
      // Merge 1 (Lane B): an imported mnemonic is recorded as
      // 'imported', not 'created' — createVault's default provenance is
      // 'created', which is only correct for the create-wallet flow.
      await createVault(mnemonic, vaultPassword, profileIds, passphrase, {
        source: 'imported',
        isTesting: false,
      });
      // A new phrase starts HD receive rotation at index 0.
      resetReceiveRotation();
      setNormalizedMnemonic(null);
      setVaultPassword('');
      setVaultPasswordConfirm('');
      setPassphraseUsed(passphrase.length > 0);
      setSplitPassphrase('');
      await refreshVaultAccounts();
      setPhraseStep('saved');
    } catch {
      setNormalizedMnemonic(null);
      setPhraseError(
        'The wallet could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAdding) return;

    const publicKey = xpub.trim();
    // T41: clear the draft immediately. A pasted mnemonic or private key
    // must not linger in the field (and in React state / the DOM) after
    // a rejected submission; the old code returned on validation failure
    // with the input still populated.
    setXpub('');
    // T43 r2b Fix (a): validate before setting the adding state, so a
    // rejected value reports its specific error and returns early.
    const validation = await validateWatchOnlyImport(chain, publicKey);
    if (!validation.ok) {
      // Clear again inside the failure block (already cleared above by
      // the T41 step): the rejection path must clear before reporting.
      setXpub('');
      setError(`${validation.message || (chain === 'ton' ? 'Invalid TON address.' : 'Invalid extended public key.')} The input was cleared; never paste a mnemonic, seed or private key here.`);
      return;
    }

    setError(null);
    setIsAdding(true);
    try {
      const validation = await validateWatchOnlyImport(chain, publicKey);
      if (!validation.ok) {
        // Secret-free error: never echo the rejected input back.
        setError(`Invalid ${chain === 'ton' ? 'TON address' : 'extended public key'}. The input was cleared; never paste a mnemonic, seed or private key here.`);
        return;
      }
      await addXpub(chain, publicKey, label.trim());
      toast.success('Watch-only wallet added.');
      setLabel('');
    } catch {
      setError('The wallet could not be added. Please try again.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Import a wallet</CardTitle>
            <Badge variant="secondary">WATCH-ONLY LABELLED BELOW</Badge>
          </div>
          <CardDescription>
            Restore a wallet from its recovery phrase, or track a wallet
            watch-only from its public key. A watch-only account can never
            sign or spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
             <TabsList aria-label="Import mode">
               <TabsTrigger value="phrase">Restore full wallet</TabsTrigger>
               <TabsTrigger value="watch-only">Watch-only</TabsTrigger>
             </TabsList>
           </Tabs>
        </CardContent>
      </Card>

      {mode === 'phrase' && vaultExists && (
        <Alert>
          <AlertDescription>
            You already have a wallet on this device. If the phrase below
            is the same as your current wallet&apos;s phrase, you can add a
            new account from it instead of replacing anything. A different
            phrase would replace the vault.
          </AlertDescription>
        </Alert>
      )}

      {mode === 'phrase' && phraseStep === 'enter' && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Restore from a recovery phrase</CardTitle>
            <CardDescription>
              Enter the words of the wallet you want to restore, in order.
              They are used once to derive your addresses, then cleared.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handlePhraseSubmit(event)}>
              <fieldset disabled={isRestoring} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-phrase">Recovery phrase</Label>
                  <Input
                    id="recovery-phrase"
                    type="text"
                    className="font-mono"
                    value={phrase}
                    onChange={(event) => {
                      setPhrase(event.target.value);
                      setPhraseError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Tab' || event.shiftKey) return;
                      const expanded = expandUniquePrefix(phrase);
                      if (expanded !== phrase) {
                        event.preventDefault();
                        setPhrase(expanded);
                      }
                    }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="12, 15, 18, 21 or 24 words — or 25 words if your wallet uses an extra word"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Only enter a recovery phrase on this screen, on this
                    device. Never paste it into any other app or website.
                    Press Tab to complete the word you are typing when it
                    has only one possible completion. If your wallet uses an
                    extra word (a 25th word), paste all 25 words here —
                    the extra word is your recovery passphrase, used to
                    derive the addresses below. It is never stored.
                  </p>
                </div>
                {phraseError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{phraseError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={isRestoring}>
                  {isRestoring ? 'Restoring…' : 'Restore wallet'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && phraseStep === 'same' && derived !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>This is the same recovery phrase</CardTitle>
            <CardDescription>
              The addresses match your current wallet. You can add a new
              account from this phrase — there is no need to delete
              anything.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {DISPLAY_ORDER.map((chainId) => (
                <li key={chainId} className="space-y-1">
                  <div className="text-sm font-semibold">{CHAIN_LABELS[chainId]}</div>
                  <code className="block break-all rounded-md bg-muted p-3 text-sm">
                    {derived[chainId]}
                  </code>
                </li>
              ))}
            </ul>
            {addedAccount !== null ? (
              <>
                <p role="status" className="text-sm leading-relaxed">
                  {accountName(addedAccount)} added. It is a new account
                  from the same recovery phrase, with its own addresses.
                </p>
                <Button asChild className="h-auto whitespace-normal py-3 text-center">
                  <Link to="/wallets">See your accounts</Link>
                </Button>
              </>
            ) : (
              <>
                {vaultPassphraseNeeded && splitPassphrase !== '' && (
                  <Alert>
                    <AlertDescription>
                      This wallet uses a recovery passphrase, and this
                      browser does not know it right now. Unlock your
                      wallet with your recovery passphrase first, then add
                      the account — adding it now would derive the wrong
                      addresses.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  type="button"
                  disabled={isAddingAccount || (vaultPassphraseNeeded && splitPassphrase !== '')}
                  onClick={() => void handleAddSamePhraseAccount()}
                  className="h-auto whitespace-normal py-3 text-center"
                >
                  {isAddingAccount
                    ? 'Adding…'
                    : `Add as ${accountName(vaultAccounts.length === 0 ? 0 : Math.max(...vaultAccounts) + 1)}`}
                </Button>
                {vaultPassphraseNeeded && splitPassphrase !== '' && (
                  <Button asChild variant="outline" className="h-auto whitespace-normal py-3 text-center">
                    <Link to="/lock">Unlock with your recovery passphrase</Link>
                  </Button>
                )}
              </>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPhraseStep('enter');
                setDerived(null);
                setNormalizedMnemonic(null);
                setSplitPassphrase('');
                setAddedAccount(null);
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && phraseStep === 'different' && derived !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>
              {compareUnavailable
                ? 'Your wallet is locked'
                : 'This is a different recovery phrase'}
            </CardTitle>
            <CardDescription>
              {compareUnavailable
                ? 'Your wallet is locked, so this phrase could not be compared with it yet.'
                : 'The addresses do not match your current wallet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {DISPLAY_ORDER.map((chainId) => (
                <li key={chainId} className="space-y-1">
                  <div className="text-sm font-semibold">{CHAIN_LABELS[chainId]}</div>
                  <code className="block break-all rounded-md bg-muted p-3 text-sm">
                    {derived[chainId]}
                  </code>
                </li>
              ))}
            </ul>
            {compareUnavailable ? (
              <p className="text-sm leading-relaxed">
                Unlock your wallet first, then restore this phrase again to
                compare it. To use a different phrase instead, delete the
                existing vault from security settings — make sure you have
                its recovery phrase written down first.
              </p>
            ) : (
              <p className="text-sm leading-relaxed">
                To use this phrase, delete the existing vault from security
                settings first. Make sure you have its recovery phrase
                written down — deleting a vault without its phrase loses
                the wallet. Or keep your current wallet and add another
                account from it on the Wallets screen.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {compareUnavailable ? (
                <Button asChild className="h-auto whitespace-normal py-3 text-center">
                  <Link to="/lock">Unlock your wallet</Link>
                </Button>
              ) : (
                <Button asChild className="h-auto whitespace-normal py-3 text-center">
                  <Link to="/wallets">Add an account from your current phrase</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="h-auto whitespace-normal py-3 text-center">
                <Link to="/security">Go to security settings</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPhraseStep('enter');
                  setDerived(null);
                  setNormalizedMnemonic(null);
                  setSplitPassphrase('');
                  setCompareUnavailable(false);
                }}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && !vaultExists && phraseStep === 'preview' && derived !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Check the restored addresses</CardTitle>
            <CardDescription>
              These are the account addresses derived from your recovery
              phrase, Ethereum first. If they are not the addresses you
              expect, stop — the phrase or the recovery profile is wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {splitPassphrase !== '' && (
              <Alert>
                <AlertDescription>
                  An extra word was used as your recovery passphrase to
                  derive these addresses. It is never stored — you will
                  need it again if you restore this wallet elsewhere.
                </AlertDescription>
              </Alert>
            )}
            <ul className="space-y-3">
              {DISPLAY_ORDER.map((chainId) => (
                <li key={chainId} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{CHAIN_LABELS[chainId]}</div>
                    <CopyButton
                      value={derived[chainId]}
                      label={`Copy ${CHAIN_LABELS[chainId]} address`}
                    />
                  </div>
                  <code className="block break-all rounded-md bg-muted p-3 text-sm">
                    {derived[chainId]}
                  </code>
                </li>
              ))}
             </ul>
             <Button
               type="button"
               variant="outline"
               onClick={() => {
                 setPhraseStep('enter');
                 setDerived(null);
                 setNormalizedMnemonic(null);
                 setSplitPassphrase('');
               }}
             >
               Edit recovery phrase
             </Button>
             <form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>
              <fieldset disabled={isSaving} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-vault-password">Vault password</Label>
                  <Input
                    id="import-vault-password"
                    type="password"
                    autoComplete="new-password"
                    value={vaultPassword}
                    onChange={(event) => setVaultPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-vault-password-confirm">Repeat vault password</Label>
                  <Input
                    id="import-vault-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={vaultPasswordConfirm}
                    onChange={(event) => setVaultPasswordConfirm(event.target.value)}
                  />
                </div>
                {phraseError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{phraseError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isSaving ? 'Saving…' : 'Save to vault'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && !vaultExists && phraseStep === 'saved' && derived !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Wallet restored</CardTitle>
            <CardDescription>
              Your recovery phrase is stored encrypted in this browser&apos;s
              vault. Your phrase was cleared from this screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {DISPLAY_ORDER.map((chainId) => (
                <li key={chainId} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{CHAIN_LABELS[chainId]}</div>
                    <CopyButton
                      value={derived[chainId]}
                      label={`Copy ${CHAIN_LABELS[chainId]} address`}
                    />
                  </div>
                  <code className="block break-all rounded-md bg-muted p-3 text-sm">
                    {derived[chainId]}
                  </code>
                </li>
              ))}
            </ul>
            <Button asChild className="h-auto whitespace-normal py-3 text-center">
              <Link to="/mnemonic-backup">Review your backup checklist</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'watch-only' && (
        <>
             <Alert>
     <AlertDescription>
       Watch-only accounts cannot sign transactions. Import one chain at a time.
     </AlertDescription>
   </Alert>
   <p id="watch-only-notice" className="text-sm leading-relaxed text-muted-foreground">
            Only extended PUBLIC keys or TON public addresses are accepted. Private extended keys (xprv/zprv)
            are rejected. Import the account-level key (depth 3, account 0) for the selected chain.
            Never paste a mnemonic, seed or private key here.
            An extended public key lets its holder track this account&apos;s
            derivable addresses, balances and transaction history. Imported
            keys are stored in this browser (localStorage). They are readable by this site&apos;s
            scripts and by extensions with access to this site.
          </p>

          <form
            className="space-y-4"
            noValidate
            aria-busy={isAdding}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <fieldset disabled={isAdding} className="space-y-2">
              <legend className="text-sm font-medium">Chain</legend>
              <div className="flex gap-2">
                {chains.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={chain === option}
                    onClick={() => setChain(option)}
                       className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                         chain === option
                           ? 'bg-primary-solid text-primary-foreground'
                           : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                       }`}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="wallet-xpub">{inputConfigByChain[chain].label}</Label>
              <Input
                id="wallet-xpub" name="xpub" type="text"
                className="font-mono"
                value={xpub}
                onChange={(event) => {
                  setXpub(event.target.value);
                  setError(null);
                }}
                autoComplete="off" autoCapitalize="none" spellCheck={false}
                placeholder={inputConfigByChain[chain].placeholder} required disabled={isAdding}
                aria-invalid={error !== null}
                aria-describedby={error ? 'watch-only-notice import-error' : 'watch-only-notice'}
              />
              {chain === 'ton' && (
                <p className="text-sm text-muted-foreground">
                  Single public address. No child addresses are derived: the TON path is fully hardened.
                  Watch-only only — this starter cannot send or withdraw TON.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-label">Label (optional)</Label>
              <Input
                id="wallet-label" name="label" type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Savings" autoComplete="off" disabled={isAdding}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">Labels are stored in plain text in this browser — do not enter secrets.</p>
            </div>

            {error && (
              <Alert id="import-error" variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isAdding}>
              {isAdding ? 'Adding…' : 'Add'}
            </Button>
          </form>

          <section aria-labelledby="imported-wallets" className="space-y-3">
            <h2 id="imported-wallets" className="text-lg font-semibold">Imported wallets</h2>
            {imported.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallets imported yet.</p>
            ) : (
              <ul className="space-y-2">
                {imported.map((wallet) => (
                  <li key={`${wallet.chain}:${wallet.xpub}`} className="space-y-2 rounded-xl border bg-card p-4 text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{wallet.chain.toUpperCase()}</Badge>
                      {' '}
                      <span>{wallet.label || 'Unlabelled wallet'}</span>
                    </div>
                    <code className="block break-all text-sm">
                      {`${wallet.xpub.slice(0, 12)}…${wallet.xpub.slice(-8)}`}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
