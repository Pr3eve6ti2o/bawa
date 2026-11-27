import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { exportUnlockedKeyBytes } from '../wallet/vault';
import {
  BACKUP_SHARE_SCHEMES,
  checkBackupShares,
  createBackupShares,
} from '../wallet/backup-shares';
import { Button } from '../ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Label } from '../ui/components/label';

const MAX_CHECK_BOXES = 5;

/**
 * Backup shares (N-of-M) for the vault key.
 *
 * The shares split the vault's raw key, never the 24 words. Creating a
 * set needs the vault unlocked; checking a set only needs the stored
 * envelope, so it works while the vault is locked too — the pasted
 * shares are proven by trial-decrypting the real vault, which is the
 * only verdict combine() cannot give on its own. Shares live in screen
 * state only: leaving the screen drops them, and nothing here writes a
 * share, a key, or a word to storage or logs.
 */
export function BackupSharesScreen() {
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

  return (
    <div className="space-y-4">
      <Card radius="xl">
        <CardHeader>
          <CardTitle>Backup shares</CardTitle>
          <CardDescription>
            {vaultState === 'no-vault'
              ? 'This browser holds no vault wallet, so there is nothing to back up here.'
              : 'Split the vault key into shares. Any ' + scheme.threshold + ' of ' + scheme.total + ' shares restore this vault — no single share can.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {vaultState === 'no-vault' ? (
            <>
              <p className="text-base leading-6">
                Create a wallet or restore one from its recovery phrase
                first.
              </p>
              <Button asChild size="lg">
                <Link to="/create-wallet">Create a wallet</Link>
              </Button>
            </>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-base leading-6">
              <li>
                The shares split the vault key, not your 24 words. The
                words stay private; the key is what unlocks the vault.
              </li>
              <li>
                Store each share in a separate place — for example, one
                with a trusted person and one in a safe. Never keep all
                the shares together.
              </li>
              <li>
                Anyone with enough shares can restore the vault, so treat
                each share like the vault password.
              </li>
              <li>
                Making a new set does not cancel an earlier set — every
                set made from this vault restores it. Changing the vault
                password cancels every set, so make a new set after a
                password change.
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      {vaultState !== 'no-vault' && (
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
                  Save each share now, in a separate place. This screen
                  will not show them again after you leave.
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
      )}

      {vaultState !== 'no-vault' && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>Check shares</CardTitle>
            <CardDescription>
              Paste shares from one set to prove they restore this vault.
              Checking changes nothing.
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
      )}

      <Link to="/security" className="inline-block text-sm underline underline-offset-4">
        Back to Security
      </Link>
    </div>
  );
}
