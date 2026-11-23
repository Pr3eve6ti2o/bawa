// QR card (UI/UX Round 2, item 1; Lane H redesign): the Receive QR
// shown like the front of a card — the QR, then the amount, then the
// address, then the token name with the chain beside it, plus that
// chain's and token's logo.
//
// The same content is what gets shared: qrCardToPngFile
// (wallet/payment-links) draws this exact card to a PNG, so the
// shared image is the card, not a bare QR.
//
// Design (frontend-design skill, read on the VM): one memorable
// element — the QR itself, framed in its own bordered tile — with
// the payment facts as plain rows under it; no new colours, no new
// typefaces, the card reuses the app's paper/ink/border treatment.
// The token row reads like the owner's example: 'pengu (base)',
// 'pengu (bnb)' — the token symbol in lower case with the short
// chain tag beside it. A payment is only complete when coin,
// network and address agree, so all three are on the card itself,
// not around it.
//
// Mined patterns (read-only web research, no code copied):
// - Trust Wallet Receive: QR on top, address below it, Copy / Set
//   Amount / Share — the QR is the screen, the facts sit under it.
// - MetaMask Receive / Account details: QR + full address, the
//   network named at the top, the account mark on the QR.
// - BlueWallet Receive: QR + address, tap the address to copy,
//   Set amount folds the amount into the QR, Share beside Copy.
// - RainbowKit account modal: the QR in a white rounded card with
//   the address + copy beside it.
// Taken from them: the framed QR tile with the coin mark riding on
// its edge (MetaMask/Trust Wallet), the amount as the big figure
// under the code (BlueWallet), the address in its own framed strip
// (RainbowKit's card-within-card). The three-template behaviour
// (Address / Payment request / Share link) is untouched — the card
// shows whichever template is selected, and Share/Download send
// this same card.
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
  size = 'md',
}: {
  src: string | undefined;
  alt: string;
  fallback: string;
  /** The chain mark overlaps the token mark, with a paper ring cutting it out. */
  overlap?: boolean;
  /** md is the 32 px token mark; sm is the 20 px chain mark riding on it. */
  size?: 'md' | 'sm';
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'sm' ? 'size-5' : 'size-8';
  const textClass = size === 'sm' ? 'text-[8px]' : 'text-[10px]';
  if (src !== undefined && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        width={size === 'sm' ? 20 : 32}
        height={size === 'sm' ? 20 : 32}
        decoding="async"
        className={`${sizeClass} shrink-0 rounded-full ${overlap ? '-ml-2 border-2 border-paper' : ''}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={alt}
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun ${textClass} font-bold uppercase text-ink ${overlap ? '-ml-2' : ''}`}
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
      className="flex flex-col items-center gap-1.5 rounded-bawa-sm border-2 border-ink bg-paper p-3"
    >
      {/* Lane H: the QR in its own bordered tile — the tile's ink
          frame is what makes the code read as a card, not a bare
          printout — with the token + chain badge riding on the
          tile's bottom edge. The badge overlaps the tile by 16 px
          (-mt-4), so it reads as pinned to the code, not floating
          under it. The tile carries the hard offset shadow
          (Oishi system, formalised as --bawa-shadow): one fixed
          ink offset, no blur, no gradient — the Aceternity 3D
          Card / Card Spotlight structure (elevation on the focal
          card) re-skinned to Bawa's tokens. */}
      <div
        data-testid="qr-card-tile"
        className="rounded-bawa-sm border-2 border-ink bg-paper p-2 shadow-[var(--bawa-shadow)]"
      >
        <div id="qr-card-qr" className="shrink-0">
          {/* 136 px, not 192: Round 2 item 8 sized the details QR at 136
              so the Copy/Share/Download row clears the bottom nav at
              390x844. The 192 value was A2's QrCard size, kept by the
              Round-2 merge; the deep audit re-measured the merged tree
              at scrollH 1446 with the actions below the fold. Lane E (fix-all)
              re-measured both sizes live at 390 px: 192 puts the template
              row 55 px below the fold (bottom 825 vs fold 770), so 136 stays. */}
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
      </div>
      <div data-testid="qr-card-badge" className="-mt-4 flex justify-center">
        <span className="flex items-center rounded-full border-2 border-ink bg-paper p-1">
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
            size="sm"
          />
        </span>
      </div>
      <p className="text-center font-display text-2xl text-ink">
        {amountText ?? 'Any amount'}
      </p>
      {/* The address in its own framed strip: the full string, never
          truncated — a receiver who cannot see the whole address
          cannot check it. The strip's border is the frame; the card
          stays paper throughout (no new colours). */}
      <p
        data-testid="qr-card-address"
        className="w-full break-all rounded-bawa-sm border-2 border-ink bg-paper px-2 py-1.5 text-center font-mono text-xs text-ink"
      >
        {address}
      </p>
      <p className="text-center text-sm font-semibold text-ink">{label}</p>
      <p className="text-center text-sm text-ink">{subline}</p>
    </div>
  );
}
