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
import { createVault, hasVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Tabs, TabsList, TabsTrigger } from '../ui/components/tabs';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
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

const chains: ChainId[] = ['btc', 'eth', 'trx', 'ton'];

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
type PhraseStep = 'enter' | 'preview' | 'saved';

export function ImportWalletScreen() {
  const { xpubs, addXpub, refreshVaultAccounts } = useWallet();
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
  // Optional BIP-39 passphrase (25th word): never stored. It also shapes the previewed addresses below.
  const [passphrase, setPassphrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);

  // Clear the phrase when the screen unmounts.
  useEffect(() => () => {
    setPhrase('');
    setPassphrase('');
    setNormalizedMnemonic(null);
  }, []);

  useEffect(() => {
    setVaultExists(hasVault());
  }, [mode]);

  async function handlePhraseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRestoring) return;
    setPhraseError(null);
    if (hasVault()) {
      setVaultExists(true);
      return;
    }
    const normalized = phrase.trim().split(/\s+/u).join(' ');
    const wordCount = normalized === '' ? 0 : normalized.split(' ').length;
    // Clear the input immediately: a rejected phrase must not linger.
    setPhrase('');
    if (wordCount !== 12 && wordCount !== 24) {
      setPhraseError('Enter a 12- or 24-word recovery phrase.');
      return;
    }
    setIsRestoring(true);
    try {
      const restored = await restoreWallet(normalized);
      const addresses = await deriveAddresses(restored, passphrase);
      setNormalizedMnemonic(restored);
      setDerived(addresses);
      setPhraseStep('preview');
    } catch {
      setNormalizedMnemonic(null);
      setDerived(null);
      setPhraseError(
        'That recovery phrase is not valid. Check every word and try again.',
      );
    } finally {
      setIsRestoring(false);
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
      await createVault(mnemonic, vaultPassword, profileIds, passphrase);
      setNormalizedMnemonic(null);
      setVaultPassword('');
      setVaultPasswordConfirm('');
      setPassphraseUsed(passphrase.length > 0);
      setPassphrase('');
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
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>A wallet already exists</CardTitle>
            <CardDescription>
              This browser already has an encrypted vault. Importing a
              recovery phrase would replace it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              To restore a different wallet, delete the existing vault from
              security settings first. Make sure you have its recovery phrase
              written down — deleting a vault without its phrase loses the
              wallet.
            </p>
            <Button asChild className="h-auto whitespace-normal py-3 text-center">
              <Link to="/security">Go to security settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && !vaultExists && phraseStep === 'enter' && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Restore from a recovery phrase</CardTitle>
            <CardDescription>
              Enter the 12 or 24 words of the wallet you want to restore.
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
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="12 or 24 words, separated by spaces"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Only enter a recovery phrase on this screen, on this
                    device. Never paste it into any other app or website.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-passphrase">
                    Recovery passphrase (optional)
                  </Label>
                  <Input
                    id="import-passphrase"
                    type="password"
                    autoComplete="off"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional BIP-39 passphrase (25th word). It is never
                    stored — you will need it again if you restore this wallet
                    elsewhere. The
                    previewed addresses below are derived with it.
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
             <Button
               type="button"
               variant="outline"
               onClick={() => {
                 setPhraseStep('enter');
                 setDerived(null);
                 setNormalizedMnemonic(null);
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
                  <div className="text-sm font-semibold">{CHAIN_LABELS[chainId]}</div>
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
