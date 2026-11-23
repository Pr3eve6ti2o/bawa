import { useState } from 'react';
import { useWallet } from './wallet-context';

/**
 * Shared devnet-toggle state (Fix-all Lane H, item 12: jscpd pair
 * app.tsx NetworkModePill vs screens/devnet-setting.tsx DevnetSetting).
 * Both controls flip the same mode flag with the same guard (no vault
 * means nothing to re-derive), the same in-flight flag and the same
 * failure reporting — the header pill toggles, the Networks switch
 * sets a value, so the hook exposes one `toggle(enabled)` and each
 * caller passes its value.
 */
export function useDevnetToggle() {
  const { vaultState, devnetEnabled, setDevnetEnabled } = useWallet();
  const [isToggling, setIsToggling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasVault = vaultState !== 'no-vault';
  const disabled = !hasVault || isToggling;

  async function toggle(enabled: boolean) {
    if (disabled) return;
    setActionError(null);
    setIsToggling(true);
    try {
      await setDevnetEnabled(enabled);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsToggling(false);
    }
  }

  return { devnetEnabled, hasVault, disabled, isToggling, actionError, toggle };
}
