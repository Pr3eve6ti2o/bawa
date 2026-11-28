import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import {
  exportUnlockedKeyBytes,
  hasVault,
  vaultProfiles,
  verifyVaultPassword,
  withMnemonic,
} from '../wallet/vault';
import {
  BACKUP_SHARE_SCHEMES,
  checkBackupShares,
  createBackupShares,
} from '../wallet/backup-shares';
import { readBackupDone, writeBackupDone } from '../wallet/backup-state';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { CopyButton } from '../ui/components/copy-button';
import { RecoveryPhraseGrid } from '../ui/components/recovery-phrase-grid';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';

// S3-A (P1 item 8): one Backup screen. Mnemonic backup and Backup
// shares were two routes; they are two tabs here — "Recovery phrase"
// and "Backup shares" — under /mnemonic-backup. /backup-shares
// redirects to /mnemonic-backup?tab=shares (see app.tsx), so the
// Security link and any saved link still land on the right tab.
//
// The reveal is password-only. The safety quiz is gone: its three
// questions always had the correct answer first, so it was friction
// without a check — Phantom and Trust Wallet gate the reveal on the
// password only. The guidance is one 4-line list, not the same facts
// twice. The "Backed up" state is set when the phrase is revealed or
// a set of shares is created, and shows here and on Wallets.

type BackupTab = 'phrase' | 'shares';

const BACKUP_TABS: ReadonlyArray<{ id: BackupTab; label: string }> = [
  { id: 'phrase', label: 'Recovery phrase' },
  { id: 'shares', label: 'Backup shares' },
];

const MAX_CHECK_BOXES = 5;

// One row per DISTINCT derivation profile across all 84 supported
// chains — the same dedup the create and import flows use when they
// store the vault's profileIds. The fifty-nine EVM chains share
// bawa-evm-bip44-v1, so they collapse to one "Ethereum" row; Solana,
// Litecoin and Dogecoin have their own profiles and get their own
// rows. The old four-chain list understated what the phrase
// recovers: a vault stores twenty-seven profiles, not four.
const BACKUP_PROFILES: readonly string[] = [
  ...new Set(SUPPORTED_CHAINS.map((chain) => profileFor(chain))),
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

// Round 2: the four backup reminders are one compact list, not four
// large cards repeating the same "not verified" note. The section intro
// already says these are reminders this app cannot verify.
const guidanceItems = [
  { id: 'paper', label: 'Words written on paper' },
  { id: 'offline', label: 'Stored offline in two places' },
  { id: 'sharing', label: 'Never shared' },
  { id: 'photo', label: 'Never photographed' },
];

type RevealStage = 'idle' | 'password' | 'revealed';

function RecoveryPhrasePanel({
  profiles,
  onBackedUp,
}: {
  profiles: string[];
  onBackedUp: () => void;
}) {
  const [stage, setStage] = useState<RevealStage>('idle');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [words, setWords] = useState<string[] | null>(null);

  // The phrase lives in panel state only while revealed; clear it on unmount.
  useEffect(() => () => {
    setWords(null);
  }, []);

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
      onBackedUp();
    } catch (cause) {
      setRevealError(
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  async function handleVerifyPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isVerifying) return;
    setPasswordError(null);
    setRevealError(null);
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
      // Password-only reveal (S3-A): no quiz stage. A correct
      // password shows the phrase straight away.
      handleReveal();
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : String(cause));
      setPassword('');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleHide() {
    setWords(null);
    setStage('idle');
  }

  // Desktop layout (desktop-layout-v2): at lg this stacks into two
  // columns — intro spanning both, profiles + guidance left, reveal
  // right. The lg:order-* classes place the columns; the plain
  // order-* classes below still govern the mobile stack (intro,
  // reveal, profiles, guidance), so the mobile layout is untouched.
  return (
    <div className="flex flex-col space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
      {/* P3-A (style B): the phrase panel is flat — uniform radius,
          1px hairline borders. The shares panel and the tabs keep the
          existing treatment; that is P3-B. */}
      <Card radius="flat" borderWidth="hairline" className="order-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Recovery phrase</CardTitle>
          <CardDescription>
            Your 24 words are the only backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-base leading-6">
            The reveal below asks for your vault password first.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-base leading-6">
            <li>Confirm your vault password.</li>
            <li>Write down the 24 words, in order, on paper.</li>
            <li>
              Test recovery before you need it: restore the words in a
              fresh browser profile, from{' '}
              <Link
                to="/import-wallet"
                className="font-medium underline underline-offset-4"
              >
                Import wallet
              </Link>
              .
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="order-3 space-y-4 lg:order-2">
        <section aria-labelledby="backup-profiles" className="space-y-2">
          <h2 id="backup-profiles" className="font-semibold">
            Recovery profiles
          </h2>
          {/* Lane 5: the 24-row profile list used to sit between the
              intro and the Reveal section, pushing the reveal two
              screens down. The rows are internal derivation ids the
              user cannot act on without the words, so they collapse
              into a disclosure; the heading and the list stay in the
              DOM, unchanged. */}
          <details className="rounded-flat-lg border border-border bg-paper p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Show the derivation profiles
            </summary>
            <p className="mt-2 text-base leading-6 text-ink">
              Back up the profile names with the words.
            </p>
            <ul className="mt-2 divide-y rounded-flat-sm border border-border bg-paper">
              {BACKUP_PROFILES.map((profileId) => {
                const stored = profiles.includes(profileId);
                return (
                  <li
                    key={profileId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2"
                  >
                    <span className="text-base font-semibold text-ink">
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

        <section aria-label="Backup guidance" className="space-y-2">
          <p className="text-base text-ink">
            Reminders, not proof — the app can&apos;t verify them.
          </p>
          {/* S3-A: one 4-line list (Lane D §3 #170 / §4). The long
              bulleted list said the same four facts as this compact
              list, so it is deleted — not shortened. No check mark:
              these are reminders, not completed steps. */}
          <ul className="divide-y rounded-flat-sm border border-border bg-paper">
            {guidanceItems.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-2 px-3 py-2 text-base text-ink"
              >
                <span aria-hidden="true" className="text-muted-foreground">–</span>
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="reveal-heading" className="order-2 space-y-3 lg:order-3">
        <h2 id="reveal-heading" className="font-semibold">
          Reveal recovery phrase
        </h2>
        {stage === 'idle' && (
          <>
            <p className="text-sm leading-5 text-muted-foreground">
              Anyone with these words can spend. Showing needs your
              password.
            </p>
            <Button onClick={() => setStage('password')} flat>
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
                className="text-base text-destructive"
              >
                {passwordError}
              </p>
            )}

            <Button type="submit" disabled={isVerifying} flat>
              {isVerifying ? 'Verifying…' : 'Verify password'}
            </Button>
            {revealError && (
              <p role="alert" className="text-base text-destructive">
                {revealError}
              </p>
            )}
          </form>
        )}

        {stage === 'revealed' && words !== null && (
          <div className="space-y-4">
            <p className="text-sm leading-5 text-muted-foreground">
              Write these words down in order, then hide them. Never
              photograph, share, or paste them anywhere.
            </p>
            {/* P3-A (style B): flat, numbered, mono tiles — the shared
                phrase grid. */}
            <RecoveryPhraseGrid words={words} />
            <div className="flex flex-wrap gap-3">
              <CopyButton
                value={words.join(' ')}
                label="Copy all 24 words"
                copyLabel="Copy all 24 words"
                flat
              />
              <Button type="button" variant="secondary" onClick={handleHide} flat>
                Hide recovery phrase
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Backup shares (N-of-M) for the vault key.
 *
 * The shares split the vault's raw key, never the 24 words. Creating a
 * set needs the vault unlocked; checking a set only needs the stored
 * envelope, so it works while the vault is locked too — the pasted
 * shares are proven by trial-decrypting the real vault, which is the
 * only verdict combine() cannot give on its own. Shares live in panel
 * state only: leaving the screen drops them, and nothing here writes a
 * share, a key, or a word to storage or logs.
 */
function BackupSharesPanel({ onBackedUp }: { onBackedUp: () => void }) {
  const { vaultState } = useWallet();
  const [scheme, setScheme] = useState({ total: 3, threshold: 2 });
  const [shares, setShares] = useState<string[] | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [checkThreshold, setCheckThreshold] = useState(2);
  const [checkInputs, setCheckInputs] = useState<string[]>(['', '']);
  const [checkResult, setCheckResult] = useState<
    { ok: true } | { ok: false; reason: string } | null
  >(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleCreate() {
    if (isCreating) return;
    setCreateError(null);
    setCopyError(null);
    setCopiedIndex(null);
    setIsCreating(true);
    try {
      const keyBytes = await exportUnlockedKeyBytes();
      if (keyBytes === null) {
        setCreateError(
          'The vault is locked. Unlock it first, then create shares.',
        );
        return;
      }
      // The key bytes are dropped as soon as the shares exist: this
      // local is the only copy, and it goes out of scope here.
      const made = await createBackupShares(
        keyBytes,
        scheme.total,
        scheme.threshold,
      );
      setShares(made);
      // S3-A: the check form defaults to the scheme just created
      // instead of asking again (Lane D §3, shares row).
      handleCheckThreshold(scheme.threshold);
      onBackedUp();
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : 'Could not create shares.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleHideShares() {
    setShares(null);
    setCopiedIndex(null);
    setCopyError(null);
  }

  async function handleCopy(share: string, index: number) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(share);
      setCopiedIndex(index);
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 2000);
    } catch {
      setCopyError(
        'Copy failed — select the share text and copy it by hand.',
      );
    }
  }

  function handleCheckThreshold(value: number) {
    setCheckThreshold(value);
    setCheckResult(null);
    setCheckInputs((previous) => {
      if (previous.length >= value) return previous;
      return [
        ...previous,
        ...Array<string>(value - previous.length).fill(''),
      ];
    });
  }

  function handleCheckInput(index: number, value: string) {
    setCheckInputs((previous) =>
      previous.map((entry, entryIndex) =>
        entryIndex === index ? value : entry,
      ),
    );
  }

  function handleAddCheckBox() {
    if (checkInputs.length >= MAX_CHECK_BOXES) return;
    setCheckInputs((previous) => [...previous, '']);
  }

  function handleRemoveCheckBox(index: number) {
    if (checkInputs.length <= 2) return;
    setCheckInputs((previous) =>
      previous.filter((_, entryIndex) => entryIndex !== index),
    );
  }

  async function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isChecking) return;
    setIsChecking(true);
    setCheckResult(null);
    try {
      setCheckResult(await checkBackupShares(checkInputs, checkThreshold));
    } catch (cause) {
      setCheckResult({
        ok: false,
        reason:
          cause instanceof Error
            ? cause.message
            : 'Those shares could not be checked.',
      });
    } finally {
      setIsChecking(false);
    }
  }

  // Desktop layout: at lg the intro spans both columns and Create /
  // Check sit side by side. Below lg the cards stack, as before.
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
      <Card radius="xl" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Backup shares</CardTitle>
          <CardDescription>
            {'Split the vault key into shares. Any ' + scheme.threshold + ' of ' + scheme.total + ' shares restore this vault — no single share can.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* S3-A: the intro was four bullets; the first three are
              deleted (Lane D §4) and only the fourth stays, shortened
              to one line. The header already says the shares split
              the key, not the words. */}
          <p className="text-base leading-6">
            New sets don&apos;t cancel old ones. A password change cancels
            all sets.
          </p>
        </CardContent>
      </Card>

      <Card radius="xl">
        <CardHeader>
          <CardTitle>Create shares</CardTitle>
          <CardDescription>
            {vaultState === 'locked'
              ? 'The vault is locked. Unlock it to create shares — checking shares below works while locked.'
              : 'Choose how many shares to make and how many are needed to restore the vault.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaultState === 'locked' ? (
            <Button asChild size="wrap">
              <Link to="/lock">Unlock the vault</Link>
            </Button>
          ) : (
            <>
              <fieldset disabled={isCreating} className="space-y-2">
                <legend className="text-sm font-semibold">
                  Shares to create
                </legend>
                {BACKUP_SHARE_SCHEMES.map((option) => (
                  <label
                    key={option.label}
                    className="flex items-center gap-2 text-base"
                  >
                    <input
                      type="radio"
                      name="backup-share-scheme"
                      value={option.label}
                      checked={
                        scheme.total === option.total &&
                        scheme.threshold === option.threshold
                      }
                      onChange={() =>
                        setScheme({
                          total: option.total,
                          threshold: option.threshold,
                        })
                      }
                    />
                    {option.label} — make {option.total}, any{' '}
                    {option.threshold} restore the vault
                  </label>
                ))}
              </fieldset>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? 'Creating…' : 'Create backup shares'}
              </Button>
            </>
          )}
          {createError && (
            <p role="alert" className="text-base text-destructive">
              {createError}
            </p>
          )}
          {shares !== null && (
            <div className="space-y-3">
              <p className="text-sm leading-5 text-muted-foreground">
                Save them now — they won&apos;t show again.
              </p>
              {copyError && (
                <p role="alert" className="text-base text-destructive">
                  {copyError}
                </p>
              )}
              <ol className="space-y-4">
                {shares.map((share, index) => (
                  <li
                    key={`${index}-${share.slice(0, 12)}`}
                    className="space-y-2 rounded-bawa-sm border-2 border-ink bg-paper p-3"
                  >
                    <p className="text-base font-semibold">
                      Share {index + 1} of {shares.length}
                    </p>
                    <QRCodeSVG
                      value={share}
                      size={128}
                      marginSize={2}
                      level="M"
                      fgColor="#2B2B2B"
                      bgColor="#FFFDF7"
                      title={`Backup share ${index + 1} of ${shares.length}`}
                    />
                    <label
                      className="sr-only"
                      htmlFor={`backup-share-${index}`}
                    >
                      Share {index + 1} of {shares.length} text
                    </label>
                    <textarea
                      id={`backup-share-${index}`}
                      readOnly
                      rows={3}
                      value={share}
                      className="w-full rounded-bawa-sm border-2 border-ink bg-paper px-3 py-2 font-mono text-xs break-all"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="wrap"
                      onClick={() => handleCopy(share, index)}
                    >
                      {copiedIndex === index
                        ? 'Copied'
                        : `Copy share ${index + 1}`}
                    </Button>
                  </li>
                ))}
              </ol>
              <Button type="button" variant="secondary" onClick={handleHideShares}>
                Hide shares
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card radius="xl">
        <CardHeader>
          <CardTitle>Check shares</CardTitle>
          <CardDescription>
            Paste shares to check they restore the vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheck} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="check-threshold">Shares needed</Label>
              <select
                id="check-threshold"
                value={checkThreshold}
                onChange={(event) =>
                  handleCheckThreshold(Number(event.target.value))
                }
                disabled={isChecking}
                className="w-full rounded-bawa-sm border-2 border-ink bg-paper px-3 py-2 text-base"
              >
                <option value={2}>2 shares</option>
                <option value={3}>3 shares</option>
              </select>
            </div>
            {checkInputs.map((value, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor={`check-share-${index}`}>
                    Share {index + 1}
                  </Label>
                  {checkInputs.length > 2 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="wrap"
                      onClick={() => handleRemoveCheckBox(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <textarea
                  id={`check-share-${index}`}
                  rows={3}
                  value={value}
                  onChange={(event) =>
                    handleCheckInput(index, event.target.value)
                  }
                  disabled={isChecking}
                  placeholder="Paste a share, starting with bawa-share-v1:"
                  className="w-full rounded-bawa-sm border-2 border-ink bg-paper px-3 py-2 font-mono text-xs break-all"
                />
              </div>
            ))}
            {checkInputs.length < MAX_CHECK_BOXES && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddCheckBox}
                disabled={isChecking}
              >
                Add another share
              </Button>
            )}
            <Button type="submit" disabled={isChecking}>
              {isChecking ? 'Checking…' : 'Check shares'}
            </Button>
            {checkResult !== null && (
              <p
                role={checkResult.ok ? 'status' : 'alert'}
                className={
                  checkResult.ok
                    ? 'text-base text-ink'
                    : 'text-base text-destructive'
                }
              >
                {checkResult.ok
                  ? 'These shares restore this vault.'
                  : checkResult.reason}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function BackupScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: BackupTab =
    searchParams.get('tab') === 'shares' ? 'shares' : 'phrase';
  // The gate reads storage directly, like the old mnemonic screen:
  // the tabs and both panels only exist with a vault.
  const [profiles] = useState<string[] | null>(() =>
    hasVault() ? vaultProfiles() : null,
  );
  const [backedUp, setBackedUp] = useState<boolean>(() => readBackupDone());

  function setTab(tab: BackupTab): void {
    setSearchParams(
      tab === 'phrase' ? {} : { tab: 'shares' },
      { replace: true },
    );
  }

  function markBackedUp(): void {
    writeBackupDone();
    setBackedUp(true);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tab: BackupTab,
  ): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = BACKUP_TABS.findIndex((entry) => entry.id === tab);
    const next =
      event.key === 'Home'
        ? BACKUP_TABS[0]!
        : event.key === 'End'
          ? BACKUP_TABS[BACKUP_TABS.length - 1]!
          : BACKUP_TABS[
              (index + (event.key === 'ArrowRight' ? 1 : BACKUP_TABS.length - 1)) %
                BACKUP_TABS.length
            ]!;
    setTab(next.id);
    document.getElementById(`backup-${next.id}-tab`)?.focus();
  }

  // One shared empty state (Lane D §3 #170): both old screens had
  // the same "nothing to back up" copy. No tabs without a vault.
  if (profiles === null) {
    return (
      <div className="space-y-4">
        <h1 className="font-bold">Backup</h1>
        <p className="text-base leading-6">
          No vault wallet here — nothing to back up.
        </p>
        <Button asChild size="lg">
          <Link to="/create-wallet">Create a wallet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-bold">Backup</h1>
        {backedUp && (
          <Badge variant="success">Backed up</Badge>
        )}
      </div>
      {/* Tabs use the Networks family-tabs pattern (role=tablist,
          roving tabIndex, arrow-key nav, 44px, sun = selected). */}
      <div
        role="tablist"
        aria-label="Backup"
        className="flex flex-wrap gap-1 rounded-flat-lg border border-ink bg-paper p-1"
      >
        {BACKUP_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`backup-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`backup-${tab.id}-panel`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            className={`min-h-11 rounded-flat-sm px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent ${
              activeTab === tab.id
                ? 'bg-sun text-ink'
                : 'text-ink hover:bg-sun'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'phrase' ? (
        <div
          role="tabpanel"
          id="backup-phrase-panel"
          aria-labelledby="backup-phrase-tab"
        >
          <RecoveryPhrasePanel profiles={profiles} onBackedUp={markBackedUp} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="backup-shares-panel"
          aria-labelledby="backup-shares-tab"
        >
          <BackupSharesPanel onBackedUp={markBackedUp} />
        </div>
      )}

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
