Rewrite apps/web/src/screens/security-settings.tsx completely (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only except for wiring the NEW auto-lock control to the context values below (no vault logic changes). Spec is UI-UX-REFERENCE.md §9 (Phantom timer range + Rabby minutes preference).

The wallet context ALREADY provides the auto-lock API (implemented in this lane, do not re-implement it): `autoLockMinutes: number` and `setAutoLockMinutes(minutes: number): void` from `useWallet()`, plus the exported constant `AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60, 1440] as const` from `'../state/wallet-context'`. `setAutoLockMinutes` ignores values outside the options. Default is 5 minutes.

Current file (68 lines, exact):
```tsx
import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

export function SecuritySettingsScreen() {
  const { vaultState, lockVault } = useWallet();

  return (
    <section className="space-y-6" aria-labelledby="security-heading">
      <h1 id="security-heading" className="text-2xl font-semibold">
        Security &amp; backup
      </h1>

      <div className="rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
        <h2 className="text-lg font-bold text-white">What this wallet does</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#aab5d1]">
          <li>Your recovery phrase is generated in this browser and stored encrypted in the vault (AES-GCM-256, PBKDF2 600,000 rounds).</li>
          <li>Private keys are held in memory only while the vault is unlocked — never in plaintext storage, logs or requests.</li>
          <li>Signing happens offline on this device.</li>
          <li>Broadcast is disabled until separately authorised — signing never sends funds.</li>
        </ul>
      </div>

      <Card className="rounded-[20px] border-[#d6deed]">
        <CardHeader>
          <CardTitle>Vault lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaultState === 'locked' ? (
            <div className="space-y-3">
              <p role="status">Vault locked — the recovery phrase and signing keys are not in memory.</p>
              <Button type="button" asChild>
                <Link to="/lock">Unlock</Link>
              </Button>
            </div>
          ) : vaultState === 'unlocked' ? (
            <Button type="button" onClick={() => lockVault()}>
              Lock vault
            </Button>
          ) : (
            <p role="status">No vault yet — create or import a wallet first.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Locking clears the decrypted recovery phrase and signing keys from memory. The vault stays encrypted on this device until you unlock it again.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border-[#d6deed]">
        <CardHeader>
          <CardTitle>Backup procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your recovery phrase is stored encrypted in this browser&apos;s vault. Write it down on paper and keep it somewhere only you can reach — anyone with the phrase can take the funds.
          </p>
          <Link
            to="/mnemonic-backup"
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            View the real backup procedure
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
```

New file — keep the section, the h1, the "What this wallet does" card (same four bullets word-for-word), the Vault lock Card (same three states word-for-word) and the Backup procedure Card (word-for-word). Changes:
1. Tokenise: the dark "What this wallet does" div becomes `rounded-[20px] border border-panel-border bg-panel-surface-raised p-6`, heading `text-lg font-bold text-panel-text`, list `text-sm text-panel-text-muted`. Every `Card className="rounded-[20px] border-[#d6deed]"` becomes `Card className="rounded-xl"`.
2. NEW auto-lock Card, placed between the Vault lock Card and the Backup procedure Card:
   - `CardTitle`: "Lock after inactivity".
   - A `Label` (import from `../ui/components/label`) with `htmlFor="auto-lock"` reading "Lock after inactivity" — wait, the CardTitle already says that. The Label reads "Lock after" (the field label) — no. Spec §9: "'Lock after inactivity' Label and select". Make the Label text exactly "Lock after inactivity" and drop the separate CardTitle? A Card with a Label but no Title is fine — but keep the Card structure consistent: use `CardHeader` + `CardTitle` "Auto-lock", then the Label "Lock after inactivity" above the select. Hmm — simplest faithful reading: CardTitle "Lock after inactivity", and the select carries `aria-label="Lock after inactivity"` (no separate visible Label needed since the Title labels it). Use the Title + aria-label approach; do NOT add a duplicate visible Label.
   - A native `<select>` with `id="auto-lock"`, `aria-label="Lock after inactivity"`, `value={String(autoLockMinutes)}`, `onChange={(event) => setAutoLockMinutes(Number(event.target.value))}`, `className="h-12 w-full rounded-md border border-border bg-input-background px-4 text-body-md text-foreground"`. Options from `AUTO_LOCK_OPTIONS` (import it from `'../state/wallet-context'`), labelled by this record (define it in the file):
     ```tsx
     const AUTO_LOCK_LABELS: Record<number, string> = {
       0: 'Immediately',
       1: '1 minute',
       5: '5 minutes',
       15: '15 minutes',
       60: '1 hour',
       1440: '1 day',
     };
     ```
     Each `<option key={minutes} value={minutes}>{AUTO_LOCK_LABELS[minutes]}</option>`. Default is 5 minutes (the context default — the select simply reflects `autoLockMinutes`).
   - Helper text (exact): "The vault locks after this long without activity. Any activity resets the timer. Watch-only stays usable while the vault is locked." (`text-sm text-muted-foreground`).
   - Manual "Lock now" Button at the bottom of this Card, rendered ONLY when `vaultState === 'unlocked'`: `<Button type="button" onClick={() => lockVault()}>Lock now</Button>`. It applies the same vault restrictions as the Vault lock card while preserving watch-only access. Do NOT promise lock-on-close anywhere (browser-close lock behaviour is not specified).
3. Destructure `autoLockMinutes` and `setAutoLockMinutes` from `useWallet()` alongside the existing `vaultState, lockVault`.

Acceptance: the auto-lock select offers exactly Immediately / 1 minute / 5 minutes / 15 minutes / 1 hour / 1 day with default 5 minutes; "Lock now" appears only when unlocked; all pre-existing copy word-for-word; no `#` hex, no `white/`, no `slate-*` in the file; `tsc`-clean (all imports used).

Return ONLY the complete new security-settings.tsx in one ```tsx fenced block. No explanation, no other changes.
