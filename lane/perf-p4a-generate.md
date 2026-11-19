# Lane A perf, prompt 4a: staged progress + engine preload in create-wallet (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

`apps/web/src/screens/create-wallet.tsx`. Measured: on Slow 4G the
Generate step takes 53 s, almost all of it the 10.4 MB wallet-engine
(WASM) download, during which the button just says 'Generating…' and the
screen looks frozen. The engine is already warmed in the background after
first paint (main.tsx idle `warmCore()`), but a user who goes straight to
create-wallet still pays the download. Goal: (1) start the engine load
the moment the create screen mounts, while the user reads and types the
password; (2) show honest staged progress so the button never looks
frozen.

## Task

1. Import `loadCore` from `../engine/boundary` (in addition to the
   existing imports). `loadCore()` is cached: repeat calls are free.
2. Add a `progress` state: `const [progress, setProgress] = useState<string
   | null>(null);` next to the existing `isBusy` state.
3. On mount, start the engine load in the background: add to the existing
   mount effect (the one that clears the mnemonic on unmount — keep that
   behaviour) a fire-and-forget `void loadCore().catch(() => {});` with a
   comment that it preloads the engine while the user types, and that a
   failure is fine because `handleGenerate` loads it on demand.
   Do NOT await it on mount and do NOT block render on it.
4. In `handleGenerate`, stage the work so the button label paints between
   stages (React must get a chance to render each label — yield one frame
   after setting each label):
   - set `progress` to `'Loading wallet engine…'`; yield one animation
     frame; `await loadCore();`
   - set `progress` to `'Generating recovery phrase…'`; yield one
     animation frame; then the existing `createWallet()` call.
   - on success or failure, clear `progress` to `null` (in the existing
     `finally`, alongside `setIsBusy(false)`).
   Yield helper: `await new Promise((resolve) =>
   requestAnimationFrame(() => resolve(undefined)));` — if
   `requestAnimationFrame` is unavailable, fall back to a zero-delay
   `setTimeout`. Write it as a small local `yieldFrame` function inside
   the component file (not a new file).
5. Step-1 submit button label: `{isBusy ? (progress ?? 'Generating…') :
   'Generate recovery phrase'}` (current code below).

## Acceptance

`tsc --noEmit` clean with the rest of the project unchanged; no new
files; no security parameter changed (PBKDF2/AES untouched — this prompt
does not touch the vault); the Generate button shows a staged honest
label while the engine loads.

## Current code

Imports:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { createWallet } from '../wallet/core';
import { createVault, hasVault, isLocked } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { Alert, AlertDescription } from '../ui/components/alert';
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
import { StepCard } from '../ui/components/step-card';
```

State + mount effect:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Clear the mnemonic when the screen unmounts.
  useEffect(() => () => {
    setMnemonic(null);
  }, []);
```

`handleGenerate`:

```tsx
  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    setError(null);
    if (hasVault()) {
      setVaultExists(true);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsBusy(true);
    try {
      const generated = await createWallet();
      const generatedWords = generated.split(' ');
      if (generatedWords.length !== 24) {
        throw new Error('Wallet generation returned an unexpected word count.');
      }
      setMnemonic(generated);
      setConfirmPositions(pickConfirmPositions(24, CONFIRM_WORD_COUNT));
      setConfirmInputs({});
      setStep(2);
    } catch {
      setMnemonic(null);
      setError('The wallet could not be generated. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }
```

Step-1 button:

```tsx
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Generating…' : 'Generate recovery phrase'}
                </Button>
```
