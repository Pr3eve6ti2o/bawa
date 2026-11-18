### `apps/web/src/screens/lock.tsx`

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useWallet } from '../state/wallet-context';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

export function LockScreen() {
  const { unlockVault, vaultState } = useWallet();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;

    setError(null);
    setIsUnlocking(true);

    try {
      await unlockVault(password);
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
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
```

### `apps/web/src/app/app.tsx`

Import with the other screen imports; route immediately after the security route:

```tsx
import { LockScreen } from '../screens/lock';
<Route path="lock" element={<LockScreen />} />
```