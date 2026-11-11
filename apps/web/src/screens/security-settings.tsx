import { Link } from "react-router";
import { useWallet } from "../state/wallet-context";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

export function SecuritySettingsScreen() {
  const { locked, lock, unlock } = useWallet();

  return (
    <section className="space-y-6" aria-labelledby="security-heading">
      <h1 id="security-heading" className="text-2xl font-semibold">
        Security &amp; backup
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>What this starter does not do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>No mnemonic generation or storage.</li>
            <li>No private keys.</li>
            <li>No signing.</li>
            <li>No vault.</li>
            <li>No PIN.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {locked ? (
            <div className="space-y-3">
              <p role="status">Locked — derived addresses are hidden.</p>
              <Button type="button" onClick={() => unlock()}>
                Unlock
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={() => lock()}>
              Lock app
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Locking is a UI state only — it clears derived addresses from memory and is NOT a security boundary.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup procedure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This watch-only starter does not create or store a recovery phrase.
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
