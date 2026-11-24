import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { readPendingSendLinkSearch } from '../wallet/payment-links';

/**
 * Shared ready-screen actions for the create-wallet and import-wallet
 * flows (marketing-fix Lane 2): when this wallet came from a shared
 * payment link, offer to go straight to the Send screen with that
 * payment filled in instead of leaving the user on the dashboard with
 * the link lost, plus the backup-checklist link. The stored query is
 * re-validated by the Send screen on arrival.
 */
export function WalletReadyActions() {
  return (
    <>
      {(() => {
        // Deep-link continuation (UI/UX round 2, deep-link fix).
        const pendingSearch = readPendingSendLinkSearch();
        if (pendingSearch === null || pendingSearch === '') return null;
        return (
          <Button asChild size="wrap">
            <Link to={`/send?${pendingSearch}`}>Continue to your send</Link>
          </Button>
        );
      })()}
      <Button asChild size="wrap">
        <Link to="/mnemonic-backup">Review your backup checklist</Link>
      </Button>
    </>
  );
}
