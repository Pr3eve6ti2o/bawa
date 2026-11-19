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
