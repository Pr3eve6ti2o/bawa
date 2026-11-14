import { Link } from 'react-router';
import { ChecklistCard } from '../ui/components/checklist-card';

const guidanceItems = [
  { id: 'paper', label: 'Words written on paper', checked: false },
  { id: 'offline', label: 'Stored offline in two places', checked: false },
  { id: 'sharing', label: 'Never shared', checked: false },
  { id: 'bundle', label: 'Bundle file kept', checked: false },
];

export function MnemonicBackupScreen() {
  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
        <h1 className="text-2xl font-bold text-white">Mnemonic backup</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#aab5d1]">
          This watch-only starter holds no mnemonic, so there is nothing to back
          up here.
        </p>
      </div>

      <section aria-labelledby="backup-procedure" className="space-y-3 rounded-[20px] border border-[#d6deed] bg-white p-5 text-[#1b2742]">
        <h2 id="backup-procedure" className="text-lg font-semibold">
          Back up outside this app
        </h2>
        <p>
          The 24 words printed by the repository tools are the only backup.
          Write them on paper and store the paper offline in two places.
        </p>
        <p>
          Never photograph the words, share them or paste them into any app or
          website.
        </p>
        <p>
          Recovery uses <code>tools/decrypt_seed.py</code> with the seed bundle.
          Keep the bundle file for recovery.
        </p>
        <p>
          An extended public key alone cannot recover spending access — it
          only restores watch-only monitoring. Spending access is restored
          from the 24 words, or from the seed bundle together with its
          data key.
        </p>
      </section>

      <section aria-label="Backup guidance" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These items are reminders, not a record of completed steps. This app
          cannot verify that you have followed them.
        </p>
        {guidanceItems.map((item) => (
          <ChecklistCard
            key={item.id}
            title={item.label}
            description="Guidance — not verified by this app."
          />
        ))}
      </section>

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
