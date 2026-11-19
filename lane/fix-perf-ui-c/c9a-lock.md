Rewrite apps/web/src/screens/lock.tsx completely (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only rewrite from the spec below. Keep ALL behaviour identical: unlock via `unlockVault`, wrong password shows the vault's message and clears both fields, busy reads "Unlocking…", success navigates to `/`, no-vault shows "Set up your wallet" and never attempts an unlock, the passphrase field shows only when the vault was created with one (`isPassphraseUsed()`). Spec is UI-UX-REFERENCE.md §9 (MetaMask dedicated unlock screen). `/lock` remains a route, not an app-wide gate — watch-only stays usable while locked.

Current file (139 lines, exact — keep every hook and handler as-is):
```tsx
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
```

New layout, top to bottom (spec §9). Keep the header comment, updating its last line to note this lane's token re-skin (or keep it verbatim — keep it verbatim):
- `<main>` is the full-screen route: dark backdrop `--panel-surface`, panel text. Keep `flex min-h-screen flex-col px-4 py-8`.
- Header: the Bawa brand mark — the existing header wallet-icon tile (36px rounded-xl, `--panel-accent-gradient`, Wallet lucide icon; reuse the shell header's tile: `flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-panel-accent-from to-panel-accent-to text-primary-foreground` with `<Wallet className="size-5" aria-hidden="true" />`, import `Wallet` from 'lucide-react) — followed by "Bawa Web Wallet" (text-lg font-semibold, panel text). Centre the header content.
- Centred, medium-max-width Card (`w-full max-w-md`, p-6, token Card — use the `Card` component from `../ui/components/card` with `className="w-full max-w-md p-6"`; the Card root already carries rounded-xl, border and background).
- Vault-present order inside the Card:
  1. "Unlock your wallet" (h1, text-2xl font-semibold), followed by: "Locked means derived addresses are hidden and signing is unavailable. Watch-only remains usable." (exact copy, `text-sm text-muted-foreground`).
  2. Password field (Input h-12); optional BIP-39 passphrase field only when the vault was created with one. Inputs use the Input component's own token styling — drop the slate `className` overrides entirely.
  3. Error line (`text-sm text-destructive`, role=alert, id lock-error).
  4. Full-width Unlock button (Button h-10 — the default size — `className="w-full"`).
  5. "Forgotten password? Restore wallet" link (→ `/import-wallet`; do not promise password recovery; class `text-sm font-medium text-primary underline underline-offset-4`).
  6. Helper: "Auto-lock affects signing access, not watch-only use. Configure it in Security settings." (`text-sm text-muted-foreground`).
- No-vault order inside the Card: "Set up your wallet" (h1) + "No vault exists yet." + Create a wallet / Import a wallet links (token `text-primary`, same underline classes as above).
- REMOVE: the "Back to dashboard" link (spec §9/§10 — gone, no replacement). REMOVE all slate-950/900/800 and sky-400 classes (third palette — deleted, not tokenised).
- Behaviour notes (do NOT change): unlocking restores vault access — decrypted phrase/keys return to memory and signing becomes possible; unlocking alone does not sign or broadcast anything (each send still needs its own explicit review + "Sign offline"). The vault is NOT gated app-wide.

Colour: light card `--card`; dark lock backdrop `--panel-surface`; main text `--foreground` (inside the Card) / `--panel-text` (on the backdrop); supporting text `--muted-foreground`; borders `--border`; primary action `--primary`; focus `--ring`; errors `--destructive`. Use ONLY token classes — no `#` hex, no `white/`, no `slate-*`, no `sky-*`, no `red-*`. The gradient tile uses `from-panel-accent-from to-panel-accent-to` (the panel gradient tokens).

Acceptance: no slate/sky/red classes, no `#` hex; no "Back to dashboard" anywhere; the restore link reads exactly "Forgotten password? Restore wallet" and points to `/import-wallet`; the auto-lock helper copy is exact; the unlock behaviour (handleSubmit, navigation, field-clearing, passphrase gating) is byte-identical to the current file (diff the logic, not the JSX); `tsc`-clean (all imports used — `Wallet`, `Card` now used; `Link` still used).

Return ONLY the complete new lock.tsx in one ```tsx fenced block. No explanation, no other changes.
