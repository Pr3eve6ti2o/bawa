// Lock screen (Phase 5, Sol p12b, landed 2026-11-19 in 90.7s). Verbatim:
// full-screen branded password lock. Unlocks via unlockVault; wrong
// password shows the vault's message and clears the field. The vault is
// NOT gated app-wide: watch-only mode stays usable while the vault is
// locked, so this screen is a route (/lock) linked from the dashboard
// banner and the send screen, not an AppLayout gate.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useWallet } from '../state/wallet-context';
import { isPassphraseUsed } from '../wallet/passphrase';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

export function LockScreen() {
  const { unlockVault, vaultState } = useWallet();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  // Shown only when the vault was created with a BIP-39 passphrase.
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;

    setError(null);
    setIsUnlocking(true);

    try {
      await unlockVault(password, passphrase);
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
      setPassphrase('');
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-4 py-8 text-slate-100">
      <header className="text-center text-lg font-semibold">
        Bawa Web Wallet
      </header>

      <div className="flex flex-1 items-center justify-center py-8">
        <section
          aria-labelledby="lock-heading"
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <h1 id="lock-heading" className="mb-6 text-2xl font-semibold">
            {vaultState === 'no-vault'
              ? 'Set up your wallet'
              : 'Unlock your wallet'}
          </h1>

          {vaultState === 'no-vault' ? (
            <div className="space-y-4">
              <p>No vault exists yet.</p>
              <div className="flex flex-col gap-3">
                <Link
                  to="/create-wallet"
                  className="text-sky-400 underline hover:text-sky-300"
                >
                  Create a wallet
                </Link>
                <Link
                  to="/import-wallet"
                  className="text-sky-400 underline hover:text-sky-300"
                >
                  Import a wallet
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="lock-password">Password</Label>
                <Input
                  id="lock-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isUnlocking}
                  aria-invalid={error !== null}
                  aria-describedby={error ? 'lock-error' : undefined}
                  className="border-slate-700 bg-slate-950 text-slate-100"
                />
              </div>

              {isPassphraseUsed() && (
                <div className="space-y-2">
                  <Label htmlFor="lock-passphrase">
                    Recovery passphrase
                  </Label>
                  <Input
                    id="lock-passphrase"
                    type="password"
                    autoComplete="off"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    disabled={isUnlocking}
                    className="border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
              )}

              {error && (
                <p id="lock-error" role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isUnlocking}
                className="w-full"
              >
                {isUnlocking ? 'Unlocking…' : 'Unlock'}
              </Button>
            </form>
          )}

          <Link
            to="/"
            className="mt-6 inline-block text-sm text-slate-300 underline hover:text-white"
          >
            Back to dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
