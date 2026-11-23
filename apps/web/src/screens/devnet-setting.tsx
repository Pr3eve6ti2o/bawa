import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Label } from '../ui/components/label';
import { Switch } from '../ui/components/switch';
import { useWallet } from '../state/wallet-context';
import { DEVNET_CHAIN_CONFIGS } from '../wallet/devnet-endpoints';

// TEMPORARY devnet mode (owner order 2026-11-22): a switch on the
// Networks screen that moves the wallet onto the four test networks.
// Mirrors AutoLockSetting: same Card/Switch shape, no password flow —
// the switch only flips the mode flag and re-derives the addresses.
// Test tokens have no value, and devnet can be removed later without
// touching mainnet (see docs/DECISIONS.md).
const DEVNET_CHAINS = ['btc', 'eth', 'trx', 'ton'] as const;

export function DevnetSetting() {
  const { vaultState, devnetEnabled, setDevnetEnabled } = useWallet();

  const [isToggling, setIsToggling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasVault = vaultState !== 'no-vault';
  const controlsDisabled = !hasVault || isToggling;

  async function handleToggle(enabled: boolean) {
    if (controlsDisabled) return;

    setActionError(null);
    setIsToggling(true);

    try {
      await setDevnetEnabled(enabled);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Devnet — temporary test mode</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="devnet-enabled">Devnet</Label>
          <Switch
            id="devnet-enabled"
            checked={devnetEnabled}
            onCheckedChange={(enabled) => {
              void handleToggle(enabled);
            }}
            disabled={controlsDisabled}
            aria-label="Devnet"
          />
        </div>

        {!hasVault && (
          <p className="text-sm text-ink">
            No vault yet — create or import a wallet first.
          </p>
        )}

        {hasVault && !devnetEnabled && (
          <p className="text-sm text-ink">
            Devnet off — the wallet uses mainnet.
          </p>
        )}

        {devnetEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Devnet on — temporary test mode. The wallet connects to test
              networks only, with valueless test tokens. Devnet can be
              removed later without touching mainnet.
            </p>
            <ul className="space-y-3">
              {DEVNET_CHAINS.map((chain) => (
                <li
                  key={chain}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-border bg-card p-3"
                >
                  <span>{DEVNET_CHAIN_CONFIGS[chain].devnetName}</span>
                  <span className="flex h-6 items-center rounded-[12px] bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
                    ACTIVE
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actionError && (
          <p role="alert" className="text-sm text-ink">
            {actionError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
