import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { hasVault, vaultProfiles, verifyVaultPassword, withMnemonic } from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { useWallet } from '../state/wallet-context';
import { ChecklistCard } from '../ui/components/checklist-card';
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

const guidanceItems = [
  { id: 'paper', label: 'Words written on paper', description: 'Guidance — not verified by this app.' },
  { id: 'offline', label: 'Stored offline in two places', description: 'Guidance — not verified by this app.' },
  { id: 'sharing', label: 'Never shared', description: 'Guidance — not verified by this app.' },
  { id: 'photo', label: 'Never photographed', description: 'Guidance — not verified by this app.' },
];

const PROFILE_LABELS: Record<string, string> = {
  'bawa-btc-bip84-v1': 'Bitcoin (bawa-btc-bip84-v1)',
  'bawa-evm-bip44-v1': 'Ethereum (bawa-evm-bip44-v1)',
  'bawa-trx-bip44-v1': 'TRON (bawa-trx-bip44-v1)',
  'bawa-ton-v4r2-v1': 'TON (bawa-ton-v4r2-v1)',
};

/**
 * Safety quiz asked before the recovery phrase is shown. These are
 * knowledge questions about keeping the words safe — they do not ask for
 * any word of the phrase itself. All three must be answered correctly.
 */
const REVEAL_QUIZ = [
  {
    question: 'If someone else learns your 24 words, what can they do?',
    options: [
      'Spend from this wallet',
      'Only see your balances',
      'Nothing without your password',
    ],
    correct: 0,
  },
  {
    question: 'Where should the words be kept?',
    options: [
      'On paper, stored offline',
      'In a cloud note',
      'In a phone photo',
    ],
    correct: 0,
  },
  {
    question: 'What should you never do with the words?',
    options: [
      'Paste them into any app or website',
      'Write them on paper',
      'Store the paper in two places',
    ],
    correct: 0,
  },
] as const;

type RevealStage = 'idle' | 'password' | 'quiz' | 'revealed';

export function MnemonicBackupScreen() {
  const [profiles, setProfiles] = useState<string[] | null>(null);
  const { unlockVault, lockVault } = useWallet();
  const [stage, setStage] = useState<RevealStage>('idle');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [wrong, setWrong] = useState<boolean[]>([false, false, false]);
  const [words, setWords] = useState<string[] | null>(null);

  useEffect(() => {
    setProfiles(hasVault() ? vaultProfiles() : null);
  }, []);

  // The phrase lives in screen state only while revealed; clear it on unmount.
  useEffect(() => () => {
    setWords(null);
  }, []);

  const allCorrect = REVEAL_QUIZ.every(
    (item, index) => answers[index] === item.correct,
  );

  async function handleVerifyPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isVerifying) return;
    setPasswordError(null);
    setIsVerifying(true);
    try {
      // The password is verified first without changing lock state; only a
      // correct password unlocks the vault, which the reveal needs.
      if (!(await verifyVaultPassword(password))) {
        setPasswordError('Incorrect password.');
        setPassword('');
        return;
      }
      await unlockVault(password, passphrase);
      setPassword('');
      setPassphrase('');
      setStage('quiz');
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
      setPassphrase('');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleQuizPick(questionIndex: number, optionIndex: number) {
    const item = REVEAL_QUIZ[questionIndex];
    if (!item) return;
    if (optionIndex === item.correct) {
      setAnswers((previous) =>
        previous.map((answer, index) =>
          index === questionIndex ? optionIndex : answer,
        ),
      );
      setWrong((previous) =>
        previous.map((flag, index) =>
          index === questionIndex ? false : flag,
        ),
      );
    } else {
      // A wrong pick marks only that question; the user retries it.
      setWrong((previous) =>
        previous.map((flag, index) =>
          index === questionIndex ? true : flag,
        ),
      );
    }
  }

  function handleReveal() {
    setWords(withMnemonic((mnemonic) => mnemonic.split(' ')));
    setStage('revealed');
  }

  function handleHide() {
    setWords(null);
    setStage('idle');
    setAnswers([null, null, null]);
    setWrong([false, false, false]);
    lockVault();
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Mnemonic backup</CardTitle>
          <CardDescription>
            {profiles === null
              ? 'This browser holds no vault wallet, so there is nothing to back up here.'
              : 'Your recovery phrase backs up the vault wallet on this device. This app cannot verify that you have followed the steps below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profiles === null ? (
            <>
              <p className="text-sm leading-relaxed">
                Create a wallet or restore one from its recovery phrase
                first. Until then there is no recovery phrase to back up.
              </p>
              <Button asChild className="h-auto whitespace-normal py-3 text-center">
                <Link to="/create-wallet">Create a wallet</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed">
                The 24 words you wrote down when the wallet was created are
                the only backup. Write them on paper and store the paper
                offline in two places.
              </p>
              <p className="text-sm leading-relaxed">
                Never photograph the words, share them or paste them into any
                app or website.
              </p>
              <p className="text-sm leading-relaxed">
                An extended public key alone cannot recover spending access —
                it only restores watch-only monitoring. Spending access is
                restored from the 24 words.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {profiles !== null && (
        <section aria-labelledby="backup-profiles" className="space-y-3">
          <h2 id="backup-profiles" className="text-lg font-semibold">
            Recovery profiles
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This vault was created with the recovery profiles below. Restoring
            with a different profile recovers different addresses — back up
            the profile names with the words.
          </p>
          <ul className="space-y-2">
            {SUPPORTED_CHAINS.map((chain) => {
              const profileId = profileFor(chain);
              const stored = profiles.includes(profileId);
              return (
                <li key={chain} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-sm font-semibold">
                    {PROFILE_LABELS[profileId] ?? profileId}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {stored
                      ? 'Stored with this vault.'
                      : 'Not stored with this vault — restoring with this profile would recover different addresses.'}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {profiles !== null && (
        <section aria-label="Backup guidance" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These items are reminders, not a record of completed steps. This
            app cannot verify that you have followed them.
          </p>
          {guidanceItems.map((item) => (
            <ChecklistCard
              key={item.id}
              title={item.label}
              description={item.description}
            />
          ))}
        </section>
      )}

      {profiles !== null && (
        <section aria-labelledby="reveal-heading" className="space-y-3">
          <h2 id="reveal-heading" className="text-lg font-semibold">
            Reveal recovery phrase
          </h2>
          {stage === 'idle' && (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Anyone who learns these 24 words can spend from this wallet.
                Showing them requires your vault password and a short safety
                quiz first.
              </p>
              <Button onClick={() => setStage('password')}>
                Reveal recovery phrase
              </Button>
            </>
          )}

          {stage === 'password' && (
            <form onSubmit={handleVerifyPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reveal-password">Vault password</Label>
                <Input
                  id="reveal-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isVerifying}
                  aria-invalid={passwordError !== null}
                  aria-describedby={passwordError ? 'reveal-error' : undefined}
                  className="h-12"
                />
              </div>

              {isPassphraseUsed() && (
                <div className="space-y-2">
                  <Label htmlFor="reveal-passphrase">
                    Recovery passphrase
                  </Label>
                  <Input
                    id="reveal-passphrase"
                    type="password"
                    autoComplete="off"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    disabled={isVerifying}
                    className="h-12"
                  />
                </div>
              )}

              {passwordError && (
                <p
                  id="reveal-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {passwordError}
                </p>
              )}

              <Button type="submit" disabled={isVerifying}>
                {isVerifying ? 'Verifying…' : 'Verify password'}
              </Button>
            </form>
          )}

          {stage === 'quiz' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Answer all three questions correctly to show the phrase.
              </p>
              {REVEAL_QUIZ.map((item, questionIndex) => (
                <div key={item.question} className="space-y-2">
                  <p className="text-sm font-semibold">{item.question}</p>
                  <div className="flex flex-col gap-2">
                    {item.options.map((option, optionIndex) => {
                      const picked = answers[questionIndex] === optionIndex;
                      const correct =
                        picked && optionIndex === item.correct;
                      return (
                        <Button
                          key={option}
                          type="button"
                          variant={correct ? 'default' : 'outline'}
                          onClick={() =>
                            handleQuizPick(questionIndex, optionIndex)
                          }
                          className="h-auto justify-start whitespace-normal py-3 text-left"
                        >
                          {option}
                          {correct ? ' — Correct' : ''}
                        </Button>
                      );
                    })}
                  </div>
                  {wrong[questionIndex] && (
                    <p role="alert" className="text-sm text-destructive">
                      Not quite — try again.
                    </p>
                  )}
                </div>
              ))}
              <Button
                type="button"
                disabled={!allCorrect}
                onClick={handleReveal}
              >
                Show recovery phrase
              </Button>
            </div>
          )}

          {stage === 'revealed' && words !== null && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Write these words down in order, then hide them. Never
                photograph, share, or paste them anywhere.
              </p>
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {words.map((word, index) => (
                  <li
                    key={`${index}-${word}`}
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <span className="text-muted-foreground">{index + 1}. </span>
                    {word}
                  </li>
                ))}
              </ol>
              <Button type="button" onClick={handleHide}>
                Hide recovery phrase and lock vault
              </Button>
            </div>
          )}
        </section>
      )}

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
