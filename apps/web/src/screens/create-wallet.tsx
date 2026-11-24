// The mnemonic lives in this screen's local state ONLY during write-down
// and confirmation, never in context, storage or logs. It is cleared on
// unmount, on any error path, and immediately after the vault is created.
// No secret is ever logged.
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BawaIcon } from '../ui/components/icons';
import { useWallet } from '../state/wallet-context';
import { createWallet } from '../wallet/core';
import { createVault, hasVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { WalletReadyActions } from './wallet-ready-actions';
import { CopyButton } from '../ui/components/copy-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Checkbox } from '../ui/components/checkbox';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { StepCard } from '../ui/components/step-card';

// Lane J (perf): the wallet engine is dynamic-imported here, not
// statically imported, so the 2.9 MB engine chunk never joins the
// first-paint modulepreload graph (CreateWalletScreen is an eager
// route). The promise cache inside loadCore still shares one download
// across this mount preload and Generate (there is no idle warm-up:
// see main.tsx).
async function loadEngineCore() {
  const { loadCore } = await import('../engine/boundary');
  return loadCore();
}

function yieldFrame(): Promise<void> {
  // One macrotask yield: lets React commit the progress label before the
  // next (async) stage starts. requestAnimationFrame is deliberately NOT
  // used: it never fires in a background tab or a non-visual environment
  // (jsdom), which would stall the flow; the paint still happens while
  // the following stage awaits its (off-main-thread) work.
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(undefined), 0);
  });
}

const MIN_PASSWORD_LENGTH = 8;
const RISK_CHECKS: readonly string[] = [
  'My recovery phrase is the only way to recover this wallet. If I lose it, no one can recover it for me. Bawa cannot reset it.',
  'I will write the 24 words down on paper, in order, and keep them somewhere safe and private.',
  'I will never photograph, share or store these words digitally, and never type them into any other app or website.',
];
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
  const { vaultAddresses, refreshVaultAccounts, resetReceiveRotation = () => {} } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [vaultExists, setVaultExists] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Optional BIP-39 passphrase (25th word): never stored. Distinct from the vault password.
  const [passphrase, setPassphrase] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [confirmPositions, setConfirmPositions] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  // Risk check (step 2, Rabby-style): the phrase is generated on password
  // submit but is NOT rendered until the user has ticked all three
  // acknowledgements and continued. Reset on every new phrase, so an
  // acknowledgement never carries over to a different phrase.
  const [riskChecks, setRiskChecks] = useState<boolean[]>([false, false, false]);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const allRisksChecked = riskChecks.every(Boolean);

  useEffect(() => {
    // Preload the engine while the user types. Failure is fine because
    // handleGenerate loads it on demand.
    void loadEngineCore().catch(() => {});

    // Clear the mnemonic when the screen unmounts.
    return () => {
      setMnemonic(null);
    };
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
      setProgress('Loading wallet engine…');
      await yieldFrame();
      await loadEngineCore();

      setProgress('Generating recovery phrase…');
      await yieldFrame();
      const generated = await createWallet();
      const generatedWords = generated.split(' ');
      if (generatedWords.length !== 24) {
        throw new Error('Wallet generation returned an unexpected word count.');
      }
      setMnemonic(generated);
      setRiskChecks([false, false, false]);
      setRiskAcknowledged(false);
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
      setProgress('Encrypting vault…');
      await yieldFrame();
      const profileIds = [...new Set(SUPPORTED_CHAINS.map((chain) => profileFor(chain)))];
      await createVault(mnemonic, password, profileIds, passphrase);
      // A new phrase starts HD receive rotation at index 0.
      resetReceiveRotation();
      setMnemonic(null);
      setPassword('');
      setConfirmPassword('');
      setPassphraseUsed(passphrase.length > 0);
      setProgress('Deriving addresses…');
      await yieldFrame();
      await refreshVaultAccounts();
      setPassphrase('');
      setStep(4);
    } catch {
      // The mnemonic is already cleared above when creation succeeded;
      // clear again on any failure so no copy lingers.
      setMnemonic(null);
      setError(
        'The wallet could not be saved. Please try again.',
      );
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  if (vaultExists) {
    return (
      <section aria-labelledby="create-wallet-title" className="space-y-6 lg:mx-auto lg:max-w-2xl">
        <Card radius="xl">
          <CardHeader>
            <CardTitle id="create-wallet-title">A wallet already exists</CardTitle>
            <CardDescription>
              This browser already has an encrypted vault. You can add
              another account from the same phrase — there is no need to
              delete anything.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              Your vault holds accounts made from one recovery phrase. To
              create another one, go to Wallets and choose how many
              accounts to create — each gets its own name, Account 2,
              Account 3, and so on, with its own addresses. To use a
              different recovery phrase instead, delete the vault first in
              security settings. Make sure you have its recovery phrase
              written down — deleting a vault without its phrase loses
              the wallet.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="wrap">
                <Link to="/wallets">Go to Wallets</Link>
              </Button>
              <Button asChild variant="outline" size="wrap">
                <Link to="/security">Go to security settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="create-wallet-title" className="space-y-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start lg:space-y-0">
      <Card radius="xl" className="lg:col-span-2 lg:sticky lg:top-6">
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
                  className={`flex size-10 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink text-body-md text-ink ${
                    progressStep < step
                      ? "bg-sun"
                      : progressStep === step
                        ? "bg-coral font-bold"
                        : "bg-paper"
                  }`}
                >
                  {progressStep < step ? (
                    <>
                      <BawaIcon name="check" className="size-5" />
                      <span className="sr-only">{progressStep}</span>
                    </>
                  ) : (
                    progressStep
                  )}
                </span>
                {progressStep < 4 && (
                  <span
                    aria-hidden="true"
                    className="mx-2 flex-1 border-t-2 border-dashed border-ink"
                  />
                )}
              </li>
            ))}
          </ol>
          {/* One text node on purpose: the counter used to render as
              separate JSX text/expression nodes ("Step " + {step} + " of 4:"),
              which some text extraction reads back joined as "Step2of 4".
              A single template string keeps the spaces for copy-paste and
              screen readers. */}
          <p className="mb-5 text-body-sm font-medium text-foreground">
            {`Step ${step} of 4: ${
              {
                1: 'Set a vault password',
                2: 'Write down 24 words',
                3: 'Confirm 3 words',
                4: 'Wallet ready',
              }[step]
            }`}
          </p>
          <ol aria-label="Wallet creation steps" className="space-y-5">
            <li>
              <StepCard
                icon={<span>1</span>}
                label="Set a vault password"
                detail="At least 8 characters. It encrypts the vault on this device."
                state={step === 1 ? 'active' : step > 1 ? 'completed' : 'pending'}
              />
            </li>
            <li>
              <StepCard
                icon={<span>2</span>}
                label="Write down your recovery phrase"
                detail="Shown once, after a short risk check. Never photograph, share or store them digitally."
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

      <div className="space-y-6 lg:col-span-3">
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <Card radius="xl">
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
                  <p className="text-sm text-ink">
                    Optional BIP-39 passphrase (25th word). It is never
                    stored — you will need it again if you restore this wallet
                    elsewhere. It is
                    not your vault password.
                  </p>
                </div>
                <Button type="submit" size="wrap">
                  {isBusy ? (progress ?? 'Generating…') : 'Generate recovery phrase'}
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


      {step === 2 && mnemonic !== null && !riskAcknowledged && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>Check the risks first</CardTitle>
            <CardDescription>
              Your recovery phrase is shown once, on this screen only. Before
              it appears, confirm you understand these three things.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="sr-only">Recovery phrase risks</legend>
              {RISK_CHECKS.map((text, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Checkbox
                    id={`risk-check-${index}`}
                    checked={riskChecks[index] ?? false}
                    onCheckedChange={(checked) =>
                      setRiskChecks((previous) =>
                        previous.map((value, position) =>
                          position === index ? checked === true : value,
                        ),
                      )
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`risk-check-${index}`}
                    weight="normal"
                  >
                    {text}
                  </Label>
                </div>
              ))}
            </fieldset>
            {!allRisksChecked && (
              <p className="text-sm text-ink">
                Tick all three boxes to continue.
              </p>
            )}
            <Button
              type="button"
              disabled={!allRisksChecked}
              size="wrap"
              onClick={() => setRiskAcknowledged(true)}
            >
              I understand — show my recovery phrase
            </Button>
            <Button
              type="button"
              variant="outline"
              size="wrap"
              onClick={() => {
                setMnemonic(null);
                setRiskChecks([false, false, false]);
                setRiskAcknowledged(false);
                setStep(1);
              }}
            >
              Back to password
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && mnemonic !== null && riskAcknowledged && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle><span className="bawa-marker">Write down</span> your recovery phrase</CardTitle>
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
            <ol aria-label="Recovery phrase" className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {words.map((word, index) => (
                <li
                  key={index}
                  className="flex h-12 min-w-0 items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper px-2"
                >
                  <span className="text-body-sm font-medium text-ink">
                    {index + 1}.
                  </span>
                  {' '}
                  <span className="font-display text-base font-semibold text-ink">{word}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-2">
              <CopyButton value={mnemonic} label="Copy recovery phrase" />
              <p className="text-sm text-muted-foreground">
                Copying puts the words on your clipboard. Paper is still
                the safest place for them.
              </p>
            </div>
            <Button
              type="button"
              size="wrap"
              onClick={() => setStep(3)}
            >
              I have written them down
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && mnemonic !== null && (
        <Card radius="xl">
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
                      {`Word ${position + 1}`}
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
                <Button type="submit" size="wrap">
                  {isBusy ? (progress ?? 'Saving…') : 'Confirm and create wallet'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card radius="xl">
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
                  <code className="block break-all rounded-bawa-sm border-2 border-ink bg-paper p-3 text-sm text-ink">
                    {vaultAddresses[chain][0] ?? 'Address unavailable.'}
                  </code>
                  {vaultAddresses[chain][0] && (
                    <CopyButton
                      value={vaultAddresses[chain][0] as string}
                      label={`Copy ${CHAIN_LABELS[chain]} address`}
                    />
                  )}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed">
              Keep your written recovery phrase safe. If you lose this device,
              it is the only way to recover your wallet.
            </p>
            <WalletReadyActions />
          </CardContent>
        </Card>
      )}
      </div>
    </section>
  );
}
