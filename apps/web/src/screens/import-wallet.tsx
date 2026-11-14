import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { WatchOnlyWallet } from '@bawa/contracts';
import { validateWatchOnlyImport, type ChainId } from '../engine/boundary';
import { useWallet } from '../state/wallet-context';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
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
};

export function ImportWalletScreen() {
  const { xpubs, addXpub } = useWallet();
  const imported = chains
    .map((id) => xpubs[id])
    .filter((wallet): wallet is WatchOnlyWallet => wallet !== null);
  const [chain, setChain] = useState<ChainId>('btc');
  const [xpub, setXpub] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

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
      <div className="rounded-[20px] border border-white/10 bg-[#243454] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">Import a watch-only wallet</h1>
          <span className="flex h-6 items-center rounded-full bg-[#243454] px-3 text-[10px] font-bold text-[#94e1c3]">
            PUBLIC KEYS ONLY
          </span>
        </div>
        <p id="watch-only-notice" className="mt-2 text-sm leading-relaxed text-[#aab5d1]">
          Only extended PUBLIC keys or TON public addresses are accepted. Private extended keys (xprv/zprv)
          are rejected. Import the account-level key (depth 3, account 0) for the selected chain.
          Never paste a mnemonic, seed or private key here.
          An extended public key lets its holder track this account&apos;s
          derivable addresses, balances and transaction history. Imported
          keys are stored in this browser (localStorage) and stay stored
          when the wallet is locked; they are readable by this site&apos;s
          scripts and by extensions with access to this site.
        </p>
      </div>

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
                className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
                  chain === option
                    ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
                    : 'border border-white/10 bg-[#263451] text-[#aab5d1] hover:text-white'
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
              <li key={`${wallet.chain}:${wallet.xpub}`} className="space-y-2 rounded-[15px] border border-[#d6deed] bg-white p-4 text-[#1b2742]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{wallet.chain.toUpperCase()}</Badge>
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

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
