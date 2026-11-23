// QR card (UI/UX Round 2, item 1): the Receive QR shown like the
// front of a card — the QR, then the amount, then the address, then
// the token name with the chain beside it, plus that chain's and
// token's logo.
//
// The same content is what gets shared: qrCardToPngFile
// (wallet/payment-links) draws this exact card to a PNG, so the
// shared image is the card, not a bare QR.
//
// Design (frontend-design skill, read on the VM): one memorable
// element — the QR itself — with the payment facts as plain rows
// under it; no new colours, no new typefaces, the card reuses the
// app's paper/ink/border treatment. The token row reads like the
// owner's example: 'pengu (base)', 'pengu (bnb)' — the token
// symbol in lower case with the short chain tag beside it. A
// payment is only complete when coin, network and address agree,
// so all three are on the card itself, not around it.
//
// Logos are the in-repo Trust Wallet assets (screens/token-logo):
// the token's mark, with the chain's mark overlapping it, and a
// ticker badge when a logo is missing or fails to load — never a
// broken image, never an empty box.
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { chainConfig, type ChainId } from '../wallet/chains';
import type { TokenRecord } from '../wallet/tokens';
import { chainLogoFor, tokenLogoFor } from './token-logo';

/**
 * The short chain tag in the card label: the chain id, except BNB
 * Smart Chain, whose short tag is the coin everybody uses — 'bnb'.
 */
export function chainShortLabel(chain: ChainId): string {
  return chain === 'bsc' ? 'bnb' : chain;
}

/**
 * The token line on the card: 'usdc (base)', 'pengu (bnb)'. A
 * native coin has no token symbol, so it reads as its network
 * name instead — 'Ethereum', 'Base' — with the chain logo beside
 * it, which is unambiguous on its own.
 */
export function qrCardTokenLabel(
  token: TokenRecord | null,
  chain: ChainId,
): string {
  if (token === null) return chainConfig(chain).displayName;
  return `${token.symbol.toLowerCase()} (${chainShortLabel(chain)})`;
}

export function qrCardTokenSubline(
  token: TokenRecord | null,
  chain: ChainId,
): string {
  const config = chainConfig(chain);
  if (token === null) return 'Native coin';
  return `${token.name} · ${config.displayName}`;
}

function LogoImage({
  src,
  alt,
  fallback,
  overlap = false,
}: {
  src: string | undefined;
  alt: string;
  fallback: string;
  /** The chain mark overlaps the token mark, with a paper ring cutting it out. */
  overlap?: boolean;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  if (src !== undefined && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        width={32}
        height={32}
        decoding="async"
        className={`size-8 shrink-0 rounded-full ${overlap ? '-ml-3 border-2 border-paper' : ''}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={alt}
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[10px] font-bold uppercase text-ink ${overlap ? '-ml-3' : ''}`}
    >
      {fallback}
    </span>
  );
}

export interface QrCardProps {
  /** The QR payload: the payment request when one exists, else the address. */
  qrValue: string;
  /** e.g. '25 USDC' — null when no amount is set, shown as 'Any amount'. */
  amountText: string | null;
  address: string;
  /** Null for the selected network's native coin. */
  token: TokenRecord | null;
  chain: ChainId;
}

export function QrCard({ qrValue, amountText, address, token, chain }: QrCardProps) {
  const config = chainConfig(chain);
  const label = qrCardTokenLabel(token, chain);
  const subline = qrCardTokenSubline(token, chain);
  const tokenSymbol = token === null ? config.symbol : token.symbol;
  const tokenLogo =
    token === null ? tokenLogoFor(config.symbol) : tokenLogoFor(token.symbol);
  const chainLogo = chainLogoFor(chain) ?? tokenLogoFor(chain);
  return (
    <div
      data-testid="qr-card"
      className="flex flex-col items-center gap-3 rounded-bawa-sm border-2 border-ink bg-paper p-4"
    >
      {/* Paper card is the QR surround: ink modules on paper, same as
          the bare QR had — no second border inside the card. */}
      <div id="qr-card-qr" className="shrink-0">
        {/* 136 px, not 192: Round 2 item 8 sized the details QR at 136
            so the Copy/Share/Download row clears the bottom nav at
            390x844. The 192 value was A2's QrCard size, kept by the
            Round-2 merge; the deep audit re-measured the merged tree
            at scrollH 1446 with the actions below the fold. */}
        <QRCodeSVG
          value={qrValue}
          size={136}
          marginSize={4}
          level="H"
          fgColor="#2B2B2B"
          bgColor="#FFFDF7"
          title={qrValue}
        />
      </div>
      <p className="text-center font-display text-2xl text-ink">
        {amountText ?? 'Any amount'}
      </p>
      <p className="w-full break-all text-center font-mono text-sm text-ink">
        {address}
      </p>
      <p className="flex items-center gap-2">
        <LogoImage
          src={tokenLogo}
          alt={`${tokenSymbol} logo`}
          fallback={tokenSymbol.trim().slice(0, 4) || '?'}
        />
        <LogoImage
          src={chainLogo}
          alt={`${config.displayName} logo`}
          fallback={chainShortLabel(chain).slice(0, 2)}
          overlap
        />
        <span className="text-sm font-semibold text-ink">{label}</span>
      </p>
      <p className="text-center text-sm text-ink">{subline}</p>
    </div>
  );
}
