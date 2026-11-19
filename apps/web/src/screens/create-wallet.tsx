// The mnemonic lives in this screen's local state ONLY during write-down
// and confirmation, never in context, storage or logs. It is cleared on
// unmount, on any error path, and immediately after the vault is created.
// No secret is ever logged.
import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
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

const MIN_PASSWORD_LENGTH = 8;
const CONFIRM_WORD_COUNT = 3;
const DISPLAY_ORDER = ['eth', 'btc', 'trx', 'ton'] as const;
const CHAIN_LABELS: Record<string, string> = {
  eth: 'Ethereum',
  btc: 'Bitcoin',
  trx: 'TRON',
  ton: 'TON',
};

type Step = 1 | 2 | 3 | 4;

function pickConfirmPositions(wordCount: number, count: number): number[] {
  const positions = new Set<number>();
  const random = new Uint32Array(count * 2);
  globalThis.crypto.getRandomValues(random);
  let cursor = 0;
  while (positions.size < count && cursor < random.length) {
    positions.add(random[cursor] as number % wordCount);
    cursor += 1;
  }
  // Extremely unlikely fallback: fill from the start.
  for (let index = 0; positions.size < count && index < wordCount; index += 1) {
    positions.add(index);
  }
  return [...positions].sort((a, b) => a - b);
}

export function CreateWalletScreen() {
  const { vaultAddresses, unlockVault, refreshVaultAccounts } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [vaultExists, setVaultExists] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Optional BIP-39 passphrase (25th word): never stored, entered again at
  // every unlock. Distinct from the vault password.
  const [passphrase, setPassphrase] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [confirmPositions, setConfirmPositions] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Clear the mnemonic when the screen unmounts.
  useEffect(() => () => {
    setMnemonic(null);
  }, []);

  useEffect(() => {
    setVaultExists(hasVault());
  }, []);

  const words = mnemonic === null ? [] : mnemonic.split(' ');

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

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy || mnemonic === null) return;
    setError(null);
    const allCorrect = confirmPositions.every((position) => {
      const entered = (confirmInputs[position] ?? '').trim().toLowerCase();
      return entered.length > 0 && entered === words[position];
    });
    if (!allCorrect) {
      setError(
        'One or more words do not match the recovery phrase you wrote down. Check your written copy and try again.',
      );
      return;
    }
    setIsBusy(true);
    try {
      const profileIds = SUPPORTED_CHAINS.map((chain) => profileFor(chain));
      await createVault(mnemonic, password, profileIds);
      setMnemonic(null);
      setPassword('');
      setConfirmPassword('');
      setPassphraseUsed(passphrase.length > 0);
      try {
        await unlockVault(password, passphrase);
        setPassphrase('');
        await refreshVaultAccounts();
      } catch (error) {
        if (isLocked()) throw error;
        // Balance/history refresh failures must not block a created, unlocked wallet.
      }
      setStep(4);
    } catch {
      // The mnemonic is already cleared above when creation succeeded;
      // clear again on any failure so no copy lingers.
      setMnemonic(null);
      setError(
        'The wallet could not be saved. If a vault was created, unlock it from Security; otherwise try again.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  if (vaultExists) {
    return (
      <section aria-labelledby="create-wallet-title" className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle id="create-wallet-title">A wallet already exists</CardTitle>
            <CardDescription>
              This browser already has an encrypted vault. Creating a second
              wallet would replace it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              To start over, delete the existing vault from security settings
              first. Make sure you have its recovery phrase written down —
              deleting a vault without its phrase loses the wallet.
            </p>
            <Button asChild className="h-auto whitespace-normal py-3 text-center">
              <Link to="/security">Go to security settings</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="create-wallet-title" className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle id="create-wallet-title">Create a wallet</CardTitle>
          <CardDescription>
            Your recovery phrase is generated in this browser and encrypted
            with your vault password. Nothing leaves this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol aria-label="Creation progress" className="mb-3 flex items-center">
            {([1, 2, 3, 4] as const).map((progressStep) => (
              <li
                key={progressStep}
                aria-current={progressStep === step ? "step" : undefined}
                className="flex flex-1 items-center last:flex-none"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-body-md ${
                    progressStep < step
                      ? "bg-success text-primary-foreground"
                      : progressStep === step
                        ? "bg-primary font-bold text-primary-foreground"
                        : "bg-surface-blue-dim text-primary"
                  }`}
                >
                  {progressStep < step ? (
                    <>
                      <Check aria-hidden="true" className="size-5" />
                      <span className="sr-only">{progressStep}</span>
                    </>
                  ) : (
                    progressStep
                  )}
                </span>
                {progressStep < 4 && (
                  <span
                    aria-hidden="true"
                    className="mx-2 h-0.5 flex-1 bg-progress-track"
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="mb-5 text-body-sm font-medium text-foreground">
            Step {step} of 4:{" "}
            {
              {
                1: "Set a vault password",
                2: "Write down 24 words",
                3: "Confirm 3 words",
                4: "Wallet ready",
              }[step]
            }
          </p>
          <ol aria-label="Wallet creation steps" className="space-y-5">
            <li>
              <StepCard
                icon={<span>1</span>}
                label="Set a vault password"
                detail="At least 8 characters. You will need it to unlock the wallet."
                state={step === 1 ? 'active' : step > 1 ? 'completed' : 'pending'}
              />
            </li>
            <li>
              <StepCard
                icon={<span>2</span>}
                label="Write down your recovery phrase"
                detail="24 words, shown once. Never photograph, share or store them digitally."
                state={step === 2 ? 'active' : step > 2 ? 'completed' : 'pending'}
              />
            </li>
            <li>
              <StepCard
                icon={<span>3</span>}
                label="Confirm your recovery phrase"
                detail="Re-enter three words from your written copy to prove you saved it."
                state={step === 3 ? 'active' : step > 3 ? 'completed' : 'pending'}
              />
            </li>
            <li>
              <StepCard
                icon={<span>4</span>}
                label="Wallet ready"
                detail="Your addresses are shown, Ethereum first."
                state={step === 4 ? 'completed' : 'pending'}
              />
            </li>
          </ol>
        </CardContent>
      </Card>

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Vault password</CardTitle>
            <CardDescription>
              This password encrypts your wallet on this device. It cannot be
              recovered if you forget it — your recovery phrase is the only
              way back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleGenerate(event)}>
              <fieldset disabled={isBusy} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vault-password">Vault password</Label>
                  <Input
                    id="vault-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vault-password-confirm">Repeat vault password</Label>
                  <Input
                    id="vault-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vault-passphrase">
                    Recovery passphrase (optional)
                  </Label>
                  <Input
                    id="vault-passphrase"
                    type="password"
                    autoComplete="off"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional BIP-39 passphrase (25th word). It is never
                    stored — you must enter it every time you unlock. It is
                    not your vault password.
                  </p>
                </div>
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Generating…' : 'Generate recovery phrase'}
                </Button>
              </fieldset>
            </form>
            <p className="mt-4 text-sm leading-relaxed">
              To track an existing wallet without its recovery words,{' '}
              <Link to="/import-wallet" className="underline">
                import its public key instead
              </Link>
              . Never paste a mnemonic, seed or private key into this app.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 2 && mnemonic !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Write down your recovery phrase</CardTitle>
            <CardDescription>
              Write these 24 words down on paper, in order. This is the only
              time they are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Never photograph, share or store these words digitally. Anyone
                with them can take your wallet. Never paste them into any app
                or website.
              </AlertDescription>
            </Alert>
            <ol aria-label="Recovery phrase" className="grid grid-cols-3 gap-2">
              {words.map((word, index) => (
                <li
                  key={index}
                  className="flex h-12 items-center gap-2 rounded-md border bg-card px-3"
                >
                  <span className="text-body-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="text-body-md font-semibold">{word}</span>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              className="h-auto whitespace-normal py-3 text-center"
              onClick={() => setStep(3)}
            >
              I have written them down
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && mnemonic !== null && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Confirm your recovery phrase</CardTitle>
            <CardDescription>
              Enter the requested words from the copy you wrote down.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleConfirm(event)}>
              <fieldset disabled={isBusy} className="space-y-4">
                {confirmPositions.map((position) => (
                  <div key={position} className="space-y-2">
                    <Label htmlFor={`confirm-word-${position}`}>
                      Word {position + 1}
                    </Label>
                    <Input
                      id={`confirm-word-${position}`}
                      autoComplete="off"
                      value={confirmInputs[position] ?? ''}
                      onChange={(event) =>
                        setConfirmInputs((previous) => ({
                          ...previous,
                          [position]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Saving…' : 'Confirm and create wallet'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Your wallet is ready</CardTitle>
            <CardDescription>
              Your recovery phrase is stored encrypted in this browser&apos;s
              vault. These are your account addresses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {DISPLAY_ORDER.map((chain) => (
                <li key={chain} className="space-y-1">
                  <div className="text-sm font-semibold">{CHAIN_LABELS[chain]}</div>
                  <code className="block break-all rounded-md bg-muted p-3 text-sm">
                    {vaultAddresses[chain][0] ?? 'Address unavailable.'}
                  </code>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed">
              Keep your written recovery phrase safe. If you lose this device,
              it is the only way to recover your wallet.
            </p>
            <Button asChild className="h-auto whitespace-normal py-3 text-center">
              <Link to="/mnemonic-backup">Review your backup checklist</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
