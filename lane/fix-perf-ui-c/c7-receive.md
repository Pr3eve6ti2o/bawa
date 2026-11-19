Rewrite apps/web/src/screens/receive.tsx completely (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only restructure from the spec below. Keep ALL logic identical: the `qrValue` computation (BTC BIP-21 amount, ETH value in wei, TRX/TON address-only QR), `copyAddress`, `shareAddress` (shares the CURRENT qrValue), `amountError`, chain selection, `isWatchOnly`, the no-chain early return. Change NO copy except the new network-warning Alert given below. Spec is UI-UX-REFERENCE.md §7 (Rabby Receive grouping, kept as a page).

Current file (201 lines, exact — keep every hook, helper and handler as-is):
```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, decimalToBaseUnits } from '../wallet/format';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';

export function ReceiveScreen() {
  const { addresses, vaultAddresses, selectedChain, setSelectedChain } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');
  const [amount, setAmount] = useState('');

  const chains = availableFor('receive');
  const chain = chains.includes(selectedChain) ? selectedChain : chains[0];

  const vaultAddress = chain ? vaultAddresses[chain][0] : undefined;
  const watchAddress = chain
    ? addresses[chain].find((entry) => entry.index === 0)?.address
    : undefined;
  const address = vaultAddress ?? watchAddress;
  const isWatchOnly = address !== undefined && vaultAddress === undefined;

  const amountError =
    amount.trim() === ''
      ? null
      : decimalToBaseUnits(amount, chain ? CHAIN_DECIMALS[chain] : 18) === null
        ? 'Enter a valid amount.'
        : null;

  // Payment-request URI (BlueWallet ReceiveDetails pattern). BTC uses a
  // BIP-21 amount; ETH encodes the value in wei. TRX and TON have no
  // standard payment URI here, so the QR stays the plain address and the
  // amount is shown as text beside it.
  const qrValue = (() => {
    if (!address || !chain || amountError) return address ?? '';
    const trimmed = amount.trim();
    if (trimmed === '') return address;
    if (chain === 'btc') return `bitcoin:${address}?amount=${trimmed}`;
    if (chain === 'eth') {
      const wei = decimalToBaseUnits(trimmed, CHAIN_DECIMALS.eth);
      return wei === null ? address : `ethereum:${address}?value=${wei}`;
    }
    return address;
  })();

  async function copyAddress() {
    if (!address) return;
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

  async function shareAddress() {
    if (!address) return;
    setCopyStatus('');
    if (navigator.share) {
      try {
        await navigator.share({ text: qrValue });
        setCopyStatus('Shared.');
        return;
      } catch (error: unknown) {
        // A cancelled share sheet is not an error; fall through to copy.
        if ((error as Error | undefined)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to share or copy. Please copy the address manually.');
    }
  }

  if (!chain) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Receive</h1>
        <p className="text-sm text-muted-foreground">
          Receive is unavailable — no receive adapter is verified yet.
        </p>
      </div>
    );
  }

  const config = chainConfig(chain);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Receive</h1>

      <div role="group" aria-label="Receiving chain" className="flex flex-wrap gap-2">
        {chains.map((available) => (
          <button
            key={available}
            type="button"
            aria-pressed={chain === available}
            onClick={() => {
              setCopyStatus('');
              setAmount('');
              setSelectedChain(available);
            }}
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
              chain === available
                ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
                : 'border border-white/10 bg-[#263451] text-[#aab5d1] hover:text-white'
            }`}
          >
            {chainConfig(available).symbol}
          </button>
        ))}
      </div>

      {isWatchOnly && (
        <Alert>
          <AlertDescription>
            Watch-only account — this address can receive, but this wallet
            cannot sign or send from it.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-6 text-white">
        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[20px] bg-white p-4">
              <QRCodeSVG
                value={qrValue}
                size={192}
                marginSize={4}
                title={`${config.symbol} receiving address`}
              />
            </div>
            <p className="w-full break-all text-center font-mono text-sm text-[#eff2fc]">{address}</p>
            {(chain === 'trx' || chain === 'ton') && amount.trim() !== '' && !amountError && (
              <p className="text-sm text-[#aab5d1]">
                Requested amount: {amount.trim()} {config.symbol} (shown as text — the QR
                encodes the address only).
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => void copyAddress()}>
                Copy address
              </Button>
              <Button type="button" variant="outline" onClick={() => void shareAddress()}>
                Share
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[#eff2fc]">No receiving address available for this chain.</p>
            <Link to="/import-wallet" className="font-medium text-[#b4aaff] underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        )}
        <p role="status" className="mt-4 text-center text-sm text-[#aab5d1]">
          {copyStatus}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="receive-amount" className="text-sm font-medium">
          Amount (optional) — {config.symbol}
        </label>
        <input
          id="receive-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={`0.0 ${config.symbol}`}
          className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]"
        />
        {amountError ? (
          <p role="alert" className="text-sm text-red-500">{amountError}</p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Mainnet only — this address is for the {config.displayName} mainnet. Funds sent on another network cannot be recovered.
      </p>

      {chain === 'ton' && (
        <p className="text-sm text-muted-foreground">
          This address can only receive TON. To send or withdraw TON, you need an external wallet.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Only share this address to receive funds. Check the address carefully before accepting funds.
      </p>
    </div>
  );
}
```

New layout, top to bottom (spec §7):
1. "Receive" heading, keep `text-2xl font-semibold` (24px semibold).
2. Network pills: selected pill is solid primary (`bg-primary text-primary-foreground`), unselected is `border border-border bg-card text-muted-foreground hover:text-foreground`; focus ring `focus-visible:ring-ring`. No gradient.
3. NEW network-warning Alert (directly after the pills, before the watch-only Alert) with exactly: "Send only on the selected network — the sender must use the network you selected, even where addresses look the same."
4. Watch-only Alert, unchanged (only when `isWatchOnly`).
5. Amount (optional) field ABOVE the QR (moved up from below it): use the `Input` (h-12) and `Label` components from `../ui/components/input` and `../ui/components/label` (add the imports); label "Amount (optional) — {config.symbol}", same id `receive-amount`, same placeholder, same onChange, same `amountError` rendering with `role="alert"` and class `text-sm text-destructive`. Show the amount field ONLY when an address exists (see 6).
6. One light `Card` (`rounded-xl`) containing: the QR (192px, keep the white rounded surround `rounded-[20px] bg-white p-4` — the QR needs a white surround for scannability, and in dark mode the Card itself is dark, so the white surround stays); for TRX/TON the entered amount as separate plain text beside the QR (keep the existing condition and words); the full address, centred and untruncated, mono 14px (`font-mono text-sm text-foreground`); Copy address and Share Buttons. The `copyStatus` line (`role="status"`, centred) stays at the bottom of the Card. When there is NO address, the Card shows only "No receiving address available for this chain." plus the Import wallet link (link class `font-medium text-primary underline underline-offset-4`) — and the amount field, QR, address and actions are NOT shown.
7. Below the Card, keep the three notes word-for-word: the Mainnet-only line, the TON-only line (only for TON), the share-check line — all `text-sm text-muted-foreground`.

Colour: `--background` page (inherited); `--card` single receive surface; `--foreground` main text; `--muted-foreground` supporting text; `--border` outlines; `--primary` selected pill and action emphasis; `--ring` focus; `--destructive` validation errors. Use ONLY token classes — no `#` hex, no `white/` opacity, no `slate-*`, no gradient classes. The QR's white surround `bg-white` is the one exception (functional: QR scannability) — keep it and note it.

Acceptance: amount field is ABOVE the QR in the file and renders only when an address exists; the network-warning Alert copy is exact; no gradient pill; `qrValue`, copy/share handlers, validation and chain logic byte-identical to the current file (diff the logic, not the JSX); `tsc`-clean (all imports used — `Input`/`Label` now used, no unused imports).

Return ONLY the complete new receive.tsx in one ```tsx fenced block. No explanation, no other changes.
