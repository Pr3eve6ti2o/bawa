```tsx
// Imports (with local yieldFrame helper)
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { loadCore } from '../engine/boundary';
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

function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve(undefined));
    } else {
      setTimeout(() => resolve(undefined), 0);
    }
  });
}
```

```tsx
  // State + mount effect
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    // Preload the engine while the user types. Failure is fine because
    // handleGenerate loads it on demand.
    void loadCore().catch(() => {});

    // Clear the mnemonic when the screen unmounts.
    return () => {
      setMnemonic(null);
    };
  }, []);
```

```tsx
  // handleGenerate
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
      setProgress('Loading wallet engine…');
      await yieldFrame();
      await loadCore();

      setProgress('Generating recovery phrase…');
      await yieldFrame();
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
      setProgress(null);
      setIsBusy(false);
    }
  }
```

```tsx
                {/* Step-1 button */}
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? (progress ?? 'Generating…') : 'Generate recovery phrase'}
                </Button>
```