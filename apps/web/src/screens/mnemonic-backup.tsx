import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { hasVault, vaultProfiles, verifyVaultPassword, withMnemonic } from '../wallet/vault';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
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

// Round 2: the four backup reminders are one compact list, not four
// large cards repeating the same "not verified" note. The section intro
// already says these are reminders this app cannot verify.
const guidanceItems = [
  { id: 'paper', label: 'Words written on paper' },
  { id: 'offline', label: 'Stored offline in two places' },
  { id: 'sharing', label: 'Never shared' },
  { id: 'photo', label: 'Never photographed' },
];

const PROFILE_LABELS: Record<string, string> = {
  'bawa-btc-bip84-v1': 'Bitcoin (bawa-btc-bip84-v1)',
  'bawa-evm-bip44-v1': 'Ethereum (bawa-evm-bip44-v1)',
  'bawa-trx-bip44-v1': 'TRON (bawa-trx-bip44-v1)',
  'bawa-ton-v4r2-v1': 'TON (bawa-ton-v4r2-v1)',
  'bawa-sol-bip44-v1': 'Solana (bawa-sol-bip44-v1)',
  'bawa-ltc-bip84-v1': 'Litecoin (bawa-ltc-bip84-v1)',
  'bawa-doge-bip44-v1': 'Dogecoin (bawa-doge-bip44-v1)',
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

// One row per DISTINCT derivation profile across all 84 supported
// chains — the same dedup the create and import flows use when they
// store the vault's profileIds. The fifty-nine EVM chains share
// bawa-evm-bip44-v1, so they collapse to one "Ethereum" row; Solana,
// Litecoin and Dogecoin have their own profiles and get their own
// rows. The old four-chain list understated what the phrase
// recovers: a vault stores twenty-four profiles, not four.
const BACKUP_PROFILES: readonly string[] = [
  ...new Set(SUPPORTED_CHAINS.map((chain) => profileFor(chain))),
];

export function MnemonicBackupScreen() {
  const [profiles, setProfiles] = useState<string[] | null>(null);
  const [stage, setStage] = useState<RevealStage>('idle');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
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
      // The password is verified (trial decrypt, no state change) only
      // as a gate before the phrase may be shown. The recovery
      // passphrase is not asked for: it never leaves the session, no
      // vault API re-establishes it, and the phrase itself does not
      // depend on it.
      if (!(await verifyVaultPassword(password))) {
        setPasswordError('Incorrect password.');
        setPassword('');
        return;
      }
      setPassword('');
      setStage('quiz');
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
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
    // The mnemonic is available only while the vault is unlocked (or
    // was created in this session). A vault that is locked — or that
    // could not unlock, e.g. created before the stored key existed —
    // has a verifiable password but no mnemonic in the closure, so
    // withMnemonic throws; report that instead of crashing the click.
    try {
      setWords(withMnemonic((mnemonic) => mnemonic.split(' ')));
      setRevealError(null);
      setStage('revealed');
    } catch (cause) {
      setRevealError(
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  function handleHide() {
    setWords(null);
    setStage('idle');
    setAnswers([null, null, null]);
    setWrong([false, false, false]);
  }

  // Lane 5: the four safety facts used to sit in this card and push
  // the Reveal section two screens down on a phone. They now live in
  // the guidance section below the reveal, where they still read
  // before anyone acts — the card keeps only the short line.
  return (
    <div className="flex flex-col space-y-4">
      <Card radius="xl" className="order-1">
        <CardHeader>
          <CardTitle>Mnemonic backup</CardTitle>
          <CardDescription>
            {profiles === null
              ? 'This browser holds no vault wallet, so there is nothing to back up here.'
              : 'Your recovery phrase backs up the vault wallet on this device. This app cannot verify that you have followed the steps below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles === null ? (
            <>
              <p className="text-sm leading-relaxed">
                Create a wallet or restore one from its recovery phrase
                first.
              </p>
              <Button asChild size="wrap">
                <Link to="/create-wallet">Create a wallet</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed">
              Your 24 words are the only backup. The reveal below asks
              for your vault password and a short safety quiz first.
            </p>
          )}
        </CardContent>
      </Card>

      {profiles !== null && (
        <section aria-labelledby="backup-profiles" className="order-3 space-y-2">
          <h2 id="backup-profiles" className="text-lg font-semibold">
            Recovery profiles
          </h2>
          {/* Lane 5: the 24-row profile list used to sit between the
              intro and the Reveal section, pushing the reveal two
              screens down. The rows are internal derivation ids the
              user cannot act on without the words, so they collapse
              into a disclosure; the heading and the list stay in the
              DOM, unchanged. */}
          <details className="rounded-bawa border-2 border-ink bg-paper p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Show the derivation profiles
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              This vault was created with the recovery profiles below. Restoring
              with a different profile recovers different addresses — back up
              the profile names with the words.
            </p>
          <ul className="mt-2 divide-y rounded-bawa-sm border-2 border-ink bg-paper">
            {BACKUP_PROFILES.map((profileId) => {
              const stored = profiles.includes(profileId);
              return (
                <li
                  key={profileId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2"
                >
                  <span className="text-sm font-semibold text-ink">
                    {PROFILE_LABELS[profileId] ?? profileId}
                  </span>
                  <span className="text-xs leading-relaxed text-ink">
                    {stored
                      ? 'Stored with this vault.'
                      : 'Not stored with this vault. Restoring with this profile would recover different addresses.'}
                  </span>
                </li>
              );
            })}
          </ul>
          </details>
        </section>
      )}

      {profiles !== null && (
        <section aria-label="Backup guidance" className="order-4 space-y-2">
          <p className="text-sm text-ink">
            These are reminders, not proof that the steps are done. This
            app cannot verify that you have followed them.
          </p>
          {/* Lane 5: the four safety facts, moved here from the top
              card so the Reveal section comes first. Same four facts,
              same words. */}
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>
              The 24 words you wrote down when the wallet was created are
              the only backup. Write them on paper and store the paper
              offline in two places.
            </li>
            <li>
              If you lose these words, the wallet cannot be recovered —
              Bawa cannot reset your recovery phrase.
            </li>
            <li>
              Never photograph the words, share them or paste them into any
              app or website.
            </li>
            <li>
              An extended public key alone cannot recover spending access —
              it only restores watch-only monitoring. Spending access is
              restored from the 24 words.
            </li>
          </ul>
          {/* Round 2: one compact list, not four cards. No check mark:
              these are reminders, not completed steps. */}
          <ul className="divide-y rounded-bawa-sm border-2 border-ink bg-paper">
            {guidanceItems.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-2 px-3 py-2 text-sm text-ink"
              >
                <span aria-hidden="true" className="text-muted-foreground">–</span>
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profiles !== null && (
        <section aria-labelledby="reveal-heading" className="order-2 space-y-3">
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
            <form onSubmit={handleVerifyPassword} className="space-y-4">
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
                 
                />
              </div>

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
            <div className="space-y-4">
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
                          size="wrap-start"
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
              {revealError && (
                <p role="alert" className="text-sm text-destructive">
                  {revealError}
                </p>
              )}
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
                Hide recovery phrase
              </Button>
            </div>
          )}
        </section>
      )}

      <Link to="/" className="order-5 inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
