import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { hasVault, vaultProfiles } from '../wallet/vault';
import { profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { ChecklistCard } from '../ui/components/checklist-card';
import { Button } from '../ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';

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

export function MnemonicBackupScreen() {
  const [profiles, setProfiles] = useState<string[] | null>(null);

  useEffect(() => {
    setProfiles(hasVault() ? vaultProfiles() : null);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="rounded-[20px] border-[#d6deed]">
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

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
