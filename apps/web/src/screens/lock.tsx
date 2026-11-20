// Lock screen (Phase 5, Sol p12b, landed 2026-11-19 in 90.7s). Verbatim:
// full-screen branded password lock. Unlocks via unlockVault; wrong
// password shows the vault's message and clears the field. The vault is
// NOT gated app-wide: watch-only mode stays usable while the vault is
// locked, so this screen is a route (/lock) linked from the dashboard
// banner and the send screen, not an AppLayout gate.
// Lock-with-return-to (Phase 3 Lane F): after unlocking, the user goes
// back to the route they were on before /lock instead of always landing
// on the dashboard — see safeReturnTo / LOCK_RETURN_TO_KEY below.
import { Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useWallet } from '../state/wallet-context';
import { isPassphraseUsed } from '../wallet/passphrase';
import { Button } from '../ui/components/button';
import { Card } from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

// Lock-with-return-to: the return target comes from, in order, the
// ?from= search param (Rabby's /unlock?from=), location state
// (MetaMask's state.from), then the last non-/lock route app.tsx stored
// in sessionStorage. The storage key is duplicated in app.tsx — keep
// the two in sync. Only same-app paths are accepted, so a crafted link
// cannot redirect off-site, and /lock itself is never a return target.
const LOCK_RETURN_TO_KEY = 'bawa-lock-return-to';

function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (
    value === '/lock' ||
    value.startsWith('/lock?') ||
    value.startsWith('/lock#')
  ) {
    return null;
  }
  return value;
}

function readStoredReturnTo(): string | null {
  try {
    return safeReturnTo(window.sessionStorage.getItem(LOCK_RETURN_TO_KEY));
  } catch {
    return null;
  }
}

export function LockScreen() {
  const { unlockVault, vaultState } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    safeReturnTo(new URLSearchParams(location.search).get('from')) ??
    safeReturnTo(
      (location.state as { from?: unknown } | null)?.from,
    ) ??
    readStoredReturnTo() ??
    '/';
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
      try {
        window.sessionStorage.removeItem(LOCK_RETURN_TO_KEY);
      } catch {
        // Non-fatal: a stale stored target only affects the next unlock.
      }
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
      setPassphrase('');
    } finally {
      setIsUnlocking(false);
    }
  }

  // This screen renders INSIDE the app shell's <main> (it is a route, not
  // a gate), so it must not render its own full-screen <main>: a nested
  // <main> is invalid HTML, so the wrapper is a <div> with the same
  // layout. At lg the card centres in exactly the shell's content area
  // (viewport minus the 72px desktop header and the main's 48px vertical
  // padding), with a transparent background there so the shell gradient
  // is the backdrop; below lg the screen is unchanged (full-screen, as
  // designed). The brand header is hidden at lg where the sidebar and
  // desktop header already carry the brand.
  return (
    <div className="flex min-h-screen flex-col bg-panel-surface px-4 py-8 text-panel-text lg:min-h-[calc(100dvh-72px-3rem)] lg:bg-transparent lg:px-0 lg:py-0">
      <header className="flex items-center justify-center gap-3 text-lg font-semibold lg:hidden">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-panel-accent-from to-panel-accent-to text-primary-foreground">
          <Wallet className="size-5" aria-hidden="true" />
        </div>
        <span>Bawa Web Wallet</span>
      </header>

      <div className="flex flex-1 items-center justify-center py-8 lg:py-0">
        <Card
          aria-labelledby="lock-heading"
          className="w-full max-w-md p-6"
        >
          <div className="space-y-6 text-foreground">
            <div className="space-y-2">
              <h1 id="lock-heading" className="text-2xl font-semibold">
                {vaultState === 'no-vault'
                  ? 'Set up your wallet'
                  : 'Unlock your wallet'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {vaultState === 'no-vault'
                  ? 'No vault exists yet.'
                  : 'Locked means derived addresses are hidden and signing is unavailable. Watch-only remains usable.'}
              </p>
            </div>

            {vaultState === 'no-vault' ? (
              <div className="flex flex-col gap-3">
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
            ) : (
              <div className="space-y-5">
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
                      className="h-12"
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
                        className="h-12"
                      />
                    </div>
                  )}

                  {error && (
                    <p
                      id="lock-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
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

                <p>
                  <Link
                    to="/import-wallet"
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Forgotten password? Restore wallet
                  </Link>
                </p>

                <p className="text-sm text-muted-foreground">
                  Auto-lock affects signing access, not watch-only use. Configure it in Security settings.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
