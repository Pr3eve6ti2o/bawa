import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { WatchOnlyWallet } from '@bawa/contracts';
import { validateExtendedKey, type ChainId } from '../engine/boundary';
import { useWallet } from '../state/wallet-context';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { toast } from '../ui/components/toast';

const chains: ChainId[] = ['btc', 'eth', 'trx'];

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
    const validation = await validateExtendedKey(publicKey, chain);
    if (!validation.ok) {
      setError(validation.message || 'Enter a valid extended public key.');
      return;
    }

    setError(null);
    setIsAdding(true);
    try {
      await addXpub(chain, publicKey, label.trim());
      toast.success('Watch-only wallet added.');
      setXpub('');
      setLabel('');
    } catch {
      setError('The wallet could not be added. Please try again.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Import a watch-only wallet</h1>
        <p id="watch-only-notice" className="text-sm text-muted-foreground">
          Only extended PUBLIC keys are accepted. Private extended keys (xprv/zprv)
          are rejected. Never paste a mnemonic, seed or private key here.
        </p>
      </header>

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
              <Button
                key={option}
                type="button"
                variant={chain === option ? 'default' : 'outline'}
                aria-pressed={chain === option}
                onClick={() => setChain(option)}
              >
                {option.toUpperCase()}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="wallet-xpub">Extended public key (xpub)</Label>
          <Input
            id="wallet-xpub" name="xpub" type="text"
            value={xpub}
            onChange={(event) => {
              setXpub(event.target.value);
              setError(null);
            }}
            autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder="xpub…" required disabled={isAdding}
            aria-invalid={error !== null}
            aria-describedby={error ? 'watch-only-notice import-error' : 'watch-only-notice'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wallet-label">Label (optional)</Label>
          <Input
            id="wallet-label" name="label" type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Savings" autoComplete="off" disabled={isAdding}
          />
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
              <li key={`${wallet.chain}:${wallet.xpub}`} className="space-y-2 rounded-lg border p-4">
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
    </main>
  );
}
