// QR card (UI/UX Round 2, item 1; Lane H redesign; Lane 5 full-card
// redesign, 2026-11-24): the Receive QR shown as a full card, not a
// bare QR — the form the owner asked for ("the type of card QR I
// wanted you to create but you were messing with the QR only").
//
// The card, top to bottom: the asset's logo in a circle with the
// network's mark as a small badge on it, a "Receive {TOKEN}" title, a
// subtitle naming the one network this address can receive on, a large
// QR in its own rounded tile with the asset's logo in the centre of
// the code, the requested amount, a "Receiving address" label with the
// FULL address and a copy button, and a footer in Bawa's own words.
//
// The shape follows the Bitget Wallet Receive card the owner showed
// us (logo circle + badge, title, network subtitle, big QR with a
// centre mark, address + copy, footer line) — but nothing of
// Bitget's branding, logo, colours-as-brand or "Deposit from Bitget
// Exchange" link is copied: the card is Bawa's own paper/ink/sun
// treatment, Bawa's wording, and Bawa's logos (the in-repo Trust
// Wallet assets, screens/token-logo). The three-template behaviour
// (Address / Payment request / Share link) is untouched — the card
// shows whichever template is selected, and Share/Download send this
// same card.
//
// The same content is what gets shared: qrCardToPngFile
// (wallet/payment-links) draws this card to a PNG, so the shared
// image is the card, not a bare QR.
//
// The QR is 192 px, not 136: the 136 value was Lane E's fold fix
// (the template row sat 55 px below the fold at 192), but a full
// card with a large QR is what the owner ordered, and a 136 px code
// is not a large QR. The template row now sits below the fold on a
// 390 px phone and is reached with one short scroll — measured in
// CDP on this lane, not assumed.
//
// The centre logo rides on the QR via qrcode.react's imageSettings
// (excavate: true, error level H): the modules under the mark are
// cleared when the code is drawn, so the code still decodes —
// verified by decoding the rendered QR in CDP on this lane, never
// trusted from the render alone. The mark is 44 px on a 192 px code
// (about 23% across, about 5% of the area), well inside what level
// H tolerates. A token with no logo gets no centre mark rather than
// a broken image.
//
// Logos are the in-repo Trust Wallet assets (screens/token-logo):
// the token's mark, with the chain's mark overlapping it, and an
// deliberate link mark when a logo is missing or fails to load — never
// a broken image, never a ticker badge (Lane B, 2026-11-24: the
// yellow ticker badge read as a broken logo, owner 2026-11-23).
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { chainConfig, type ChainId } from '../wallet/chains';
import type { TokenRecord } from '../wallet/tokens';
import { chainLogoFor, FallbackMark, tokenLogoFor } from './token-logo';

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
 * it, which is unambiguous on its own. (Kept for the PNG share
 * card in wallet/payment-links, which draws this label.)
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

/**
 * The card title: 'Receive ETH', 'Receive USDC' — the asset being
 * received, in the symbol the wallet already shows everywhere else.
 */
export function qrCardTitle(
  token: TokenRecord | null,
  chain: ChainId,
): string {
  const symbol = token === null ? chainConfig(chain).symbol : token.symbol;
  return `Receive ${symbol}`;
}

/**
 * The card subtitle: the one network this address can receive on,
 * in plain English. The network name comes from the caller when the
 * screen is on a test network (devnet passes its test-network name);
 * otherwise it is the chain's display name.
 */
export function qrCardSubtitle(
  chain: ChainId,
  networkDisplayName?: string,
): string {
  const name = networkDisplayName ?? chainConfig(chain).displayName;
  return `Only ${name} network assets can be received here.`;
}

/** The footer: Bawa's own words — share the card, keep the keys. */
export const QR_CARD_FOOTER = 'Share the card, keep the keys.';

function LogoImage({
  src,
  alt,
  overlap = false,
  size = 'md',
}: {
  src: string | undefined;
  alt: string;
  /** The chain mark overlaps the token mark, with a paper ring cutting it out. */
  overlap?: boolean;
  /** lg is the 56 px header mark; md the 32 px token mark; sm the 20 px chain mark riding on it. */
  size?: 'lg' | 'md' | 'sm';
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'lg' ? 'size-14' : size === 'sm' ? 'size-5' : 'size-8';
  const px = size === 'lg' ? 56 : size === 'sm' ? 20 : 32;
  if (src !== undefined && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        decoding="async"
        className={`${sizeClass} shrink-0 rounded-full ${overlap ? '-ml-2 border-2 border-paper' : ''}`}
        onError={() => setFailed(true)}
      />
    );
  }
  // Merge (2026-11-24): the missing-logo fallback is the shared
  // FallbackMark (Lane E's link mark) — the same mark TokenLogo and
  // ChainLogo show, so the card can never drift from the rows again.
  // The old fallback was the yellow ticker badge (bg-sun + symbol
  // text), the badge the owner ordered removed on 2026-11-23; Lane B
  // replaced it with the empty ring, and the merge replaces the ring
  // with the link mark everywhere.
  return <FallbackMark label={alt} size={px} className={overlap ? '-ml-2' : ''} />;
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
  /** Called when the copy button beside the address is tapped. */
  onCopyAddress?: () => void;
  /** Network name in the subtitle; defaults to the chain display name. */
  networkDisplayName?: string;
}

export function QrCard({
  qrValue,
  amountText,
  address,
  token,
  chain,
  onCopyAddress,
  networkDisplayName,
}: QrCardProps) {
  const config = chainConfig(chain);
  const subline = qrCardTokenSubline(token, chain);
  const tokenSymbol = token === null ? config.symbol : token.symbol;
  const tokenLogo =
    token === null ? tokenLogoFor(config.symbol) : tokenLogoFor(token.symbol);
  const chainLogo = chainLogoFor(chain) ?? tokenLogoFor(chain);
  // The mark in the centre of the QR: the asset's logo where the
  // repo has one, else the network's mark, else no mark at all.
  const centreLogoSrc = tokenLogo ?? chainLogo;
  return (
    <div
      data-testid="qr-card"
      className="flex flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper p-3"
    >
      {/* The header: the asset's mark in a circle, with the network's
          mark as a small badge on its bottom-right edge — the card's
          face, so the receiver knows at a glance which coin and which
          network this card is for. */}
      <div
        data-testid="qr-card-header"
        className="relative mt-1 rounded-full border-2 border-ink bg-paper p-1"
      >
        <LogoImage
          src={tokenLogo}
          alt={`${tokenSymbol} logo`}
          size="lg"
        />
        <span className="absolute -bottom-1 -right-1 flex rounded-full border-2 border-paper bg-paper">
          <LogoImage
            src={chainLogo}
            alt={`${config.displayName} logo`}
            size="sm"
          />
        </span>
      </div>
      <h2
        data-testid="qr-card-title"
        className="text-center font-display text-2xl text-ink"
      >
        {qrCardTitle(token, chain)}
      </h2>
      <p
        data-testid="qr-card-subtitle"
        className="text-center text-sm text-ink"
      >
        {qrCardSubtitle(chain, networkDisplayName)}
      </p>
      {/* Lane H: the QR in its own bordered tile — the tile's ink
          frame is what makes the code read as a card, not a bare
          printout. The tile carries the hard offset shadow
          (Oishi system, formalised as --bawa-shadow): one fixed
          ink offset, no blur, no gradient — the Aceternity 3D
          Card / Card Spotlight structure (elevation on the focal
          card) re-skinned to Bawa's tokens. The asset's mark sits
          in the centre of the code (imageSettings, excavated, level
          H) — the same mark as the header circle, so the code and
          the card read as one thing. */}
      <div
        data-testid="qr-card-tile"
        className="rounded-bawa-sm border-2 border-ink bg-paper p-2 shadow-[var(--bawa-shadow)]"
      >
        <div id="qr-card-qr" className="shrink-0">
          <QRCodeSVG
            value={qrValue}
            size={192}
            marginSize={4}
            level="H"
            fgColor="#2B2B2B"
            bgColor="#FFFDF7"
            title={qrValue}
            imageSettings={
              centreLogoSrc === undefined
                ? undefined
                : {
                    src: centreLogoSrc,
                    width: 44,
                    height: 44,
                    excavate: true,
                  }
            }
          />
        </div>
      </div>
      <p className="text-center font-display text-xl text-ink">
        {amountText ?? 'Any amount'}
      </p>
      {/* The address in its own framed strip: the full string, never
          truncated — a receiver who cannot see the whole address
          cannot check it. The label names it, and the copy button
          beside the label copies the whole address. */}
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink">Receiving address</span>
          <button
            type="button"
            onClick={onCopyAddress}
            disabled={onCopyAddress === undefined}
            aria-label="Copy receiving address"
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-bawa-sm border-2 border-ink bg-paper px-2 py-1 text-xs font-semibold text-ink hover:bg-sun focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4 shrink-0"
            >
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Copy
          </button>
        </div>
        <p
          data-testid="qr-card-address"
          className="w-full break-all rounded-bawa-sm border-2 border-ink bg-paper px-2 py-1.5 text-center font-mono text-xs text-ink"
        >
          {address}
        </p>
      </div>
      {/* The token's full name and network — only for tokens, where
          the symbol alone does not say which coin this is. A native
          coin's title and subtitle already name it and its network. */}
      {token !== null && (
        <p className="text-center text-sm text-ink">{subline}</p>
      )}
      <p
        data-testid="qr-card-footer"
        className="text-center text-sm text-ink"
      >
        {QR_CARD_FOOTER}
      </p>
    </div>
  );
}
