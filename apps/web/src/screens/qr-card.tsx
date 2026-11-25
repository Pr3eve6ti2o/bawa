// QR card (UI/UX Round 2, item 1; Lane H redesign; Lane 5 full-card
// redesign, 2026-11-24; QR-cards programme, Lane E, 2026-11-25): the
// Receive QR shown as a full card, not a bare QR — the form the owner
// asked for ("the type of card QR I wanted you to create but you were
// messing with the QR only").
//
// The card, top to bottom: the asset's logo in a circle with the
// network's mark as a small badge on it, a "Receive {TOKEN}" title, a
// subtitle naming the one network this address can receive on (the
// network name bolded — the one word that, if wrong, loses the
// funds), a large QR in its own rounded tile with the asset's logo in
// the centre of the code, the requested amount, a "Receiving address"
// label with the FULL address and a copy button, and a footer in
// Bawa's own words.
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
// Four card templates (design/DESIGN.md in bawa-qr-cards), picked on
// the Receive screen — default B (Paper), the current card respaced
// (gaps 8 px to 20 px, title 24 px to 28 px, QR 192 px to 200 px,
// brand strip added). A (Dark Teal) is the showcase variant, closest
// to the owner's Bitget bar, with an inverted white-on-dark code —
// conditional on a phone decode test, since only jsQR has verified
// it so far. C (Minimal) is the quiet fallback. D (Poster) is the
// loud share variant. The PNG export (wallet/payment-links) draws
// the same card in the picked template, so the shared image is the
// card, not a bare QR.
//
// The centre logo rides on the QR via qrcode.react's imageSettings
// (excavate: true, error level H): the modules under the mark are
// cleared when the code is drawn, so the code still decodes —
// verified by decoding the rendered QR in CDP on this lane, never
// trusted from the render alone. The mark sizes are per template
// (wallet/payment-links QR_CARD_TEMPLATE_QR) and match the PNG
// export exactly. A token with no logo gets no centre mark rather
// than a broken image.
//
// Template A needs its centre mark redrawn: the raw logo is a dark
// glyph, invisible on the inverted code's dark excavation. The hook
// below rebuilds it as a white silhouette on a coral disc (the
// design's mark) and hands that data URL to imageSettings; while it
// loads, the code renders without a mark, exactly as a token with
// no logo does. The PNG exporter does the same redraw on canvas.
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { chainConfig, type ChainId } from '../wallet/chains';
import type { TokenRecord } from '../wallet/tokens';
import {
  DEFAULT_QR_CARD_TEMPLATE,
  QR_CARD_FOOTER,
  QR_CARD_SCAN_LINE,
  QR_CARD_SHARE_LINK_TEXT,
  QR_CARD_TEMPLATE_QR,
  type QrCardTemplate,
} from '../wallet/payment-links';
import { chainLogoFor, FallbackMark, tokenLogoFor } from './token-logo';

export { QR_CARD_FOOTER };

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

/**
 * The subtitle with its network name bolded — the one word that, if
 * wrong, loses the funds. Plain text when the name is not in the
 * subtitle (a test network the caller did not name).
 */
function NetworkSubtitle({
  subtitle,
  networkName,
  className,
  boldClassName,
}: {
  subtitle: string;
  networkName: string;
  className: string;
  boldClassName: string;
}): React.ReactElement {
  const at = networkName === '' ? -1 : subtitle.indexOf(networkName);
  if (at === -1) return <p className={className}>{subtitle}</p>;
  return (
    <p data-testid="qr-card-subtitle" className={className}>
      {subtitle.slice(0, at)}
      <strong className={boldClassName}>{networkName}</strong>
      {subtitle.slice(at + networkName.length)}
    </p>
  );
}

/**
 * Template A's centre mark as a data URL: the token logo redrawn as
 * a white silhouette on a coral disc, 56 px square (drawn at 28 px
 * in the code). A dark glyph on the dark inverted code would be
 * invisible; the silhouette is the design's white diamond. Returns
 * undefined while loading, or when the logo cannot load — the code
 * then renders without a mark, exactly as a token with no logo does.
 */
function useDiscLogoImage(src: string | undefined): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (src === undefined) {
      setDataUrl(undefined);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      // White silhouette first: the logo's own pixels, recoloured.
      const mark = 36;
      const silhouette = document.createElement('canvas');
      silhouette.width = mark;
      silhouette.height = mark;
      const silhouetteCtx = silhouette.getContext('2d');
      if (silhouetteCtx === null) return;
      silhouetteCtx.drawImage(image, 0, 0, mark, mark);
      // Drop the logo's own light background before recolouring:
      // the repo's chain logos carry the glyph on a near-white disc
      // (luminance ~244) while the glyph is dark (<= ~131, measured
      // on the ETH asset) — without this the silhouette is the whole
      // disc, a blank white circle on coral instead of the diamond.
      if (
        typeof silhouetteCtx.getImageData === 'function' &&
        typeof silhouetteCtx.putImageData === 'function'
      ) {
        const pixels = silhouetteCtx.getImageData(0, 0, mark, mark);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
          const luminance =
            0.2126 * (data[i] ?? 0) +
            0.7152 * (data[i + 1] ?? 0) +
            0.0722 * (data[i + 2] ?? 0);
          if (luminance > 160) data[i + 3] = 0;
        }
        silhouetteCtx.putImageData(pixels, 0, 0);
      }
      silhouetteCtx.globalCompositeOperation = 'source-in';
      silhouetteCtx.fillStyle = '#FFFFFF';
      silhouetteCtx.fillRect(0, 0, mark, mark);
      // Coral disc carrying the silhouette.
      const size = 56;
      const disc = document.createElement('canvas');
      disc.width = size;
      disc.height = size;
      const discCtx = disc.getContext('2d');
      if (discCtx === null) return;
      discCtx.fillStyle = '#FF6B4A';
      discCtx.beginPath();
      discCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      discCtx.fill();
      discCtx.drawImage(
        silhouette,
        (size - mark) / 2,
        (size - mark) / 2,
        mark,
        mark,
      );
      if (!cancelled) setDataUrl(disc.toDataURL('image/png'));
    };
    image.onerror = () => {
      if (!cancelled) setDataUrl(undefined);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return dataUrl;
}

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
  /** xl is the 40 px minimal mark; lg the 56 px header mark; md the 32 px token mark; sm the 20 px chain mark riding on it. */
  size?: 'xl' | 'lg' | 'md' | 'sm';
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'xl'
      ? 'size-10'
      : size === 'lg'
        ? 'size-14'
        : size === 'sm'
          ? 'size-5'
          : 'size-8';
  const px = size === 'xl' ? 40 : size === 'lg' ? 56 : size === 'sm' ? 20 : 32;
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

function CopyGlyph({ className }: { className: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
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
  );
}

function BrandMark({
  markClassName,
  textClassName,
}: {
  markClassName: string;
  textClassName: string;
}): React.ReactElement {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex items-center justify-center font-display font-bold text-white ${markClassName}`}
      >
        B
      </span>
      <span className={textClassName}>Bawa Wallet</span>
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
  token: TokenRecord | null
  chain: ChainId;
  /** Called when the copy button beside the address is tapped. */
  onCopyAddress?: () => void;
  /** Network name in the subtitle; defaults to the chain display name. */
  networkDisplayName?: string;
  /** Which of the four card templates to render; default 'b' (Paper). */
  template?: QrCardTemplate;
}

export function QrCard({
  qrValue,
  amountText,
  address,
  token,
  chain,
  onCopyAddress,
  networkDisplayName,
  template = DEFAULT_QR_CARD_TEMPLATE,
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
  const qrVisual = QR_CARD_TEMPLATE_QR[template];
  const discLogoSrc = useDiscLogoImage(
    template === 'a' ? centreLogoSrc : undefined,
  );
  const title = qrCardTitle(token, chain);
  const subtitle = qrCardSubtitle(chain, networkDisplayName);
  const networkName = networkDisplayName ?? config.displayName;
  const qrCode = (
    <QRCodeSVG
      value={qrValue}
      size={qrVisual.size}
      marginSize={4}
      level="H"
      fgColor={qrVisual.fg}
      bgColor={qrVisual.bg}
      title={qrValue}
      imageSettings={
        template === 'a'
          ? discLogoSrc === undefined
            ? undefined
            : {
                src: discLogoSrc,
                width: qrVisual.logo,
                height: qrVisual.logo,
                excavate: true,
              }
          : centreLogoSrc === undefined
            ? undefined
            : {
                src: centreLogoSrc,
                width: qrVisual.logo,
                height: qrVisual.logo,
                excavate: true,
              }
      }
    />
  );

  if (template === 'a') {
    return (
      <div
        data-testid="qr-card"
        data-template="a"
        className="flex w-full flex-col items-center gap-5 rounded-bawa-sm bg-qr-teal p-6"
      >
        <div
          data-testid="qr-card-header"
          className="relative rounded-full bg-white p-1"
        >
          <LogoImage src={tokenLogo} alt={`${tokenSymbol} logo`} size="lg" />
          <span className="absolute -bottom-1 -right-1 flex rounded-full border-2 border-white bg-white">
            <LogoImage
              src={chainLogo}
              alt={`${config.displayName} logo`}
              size="sm"
            />
          </span>
        </div>
        <h2
          data-testid="qr-card-title"
          className="text-center text-[30px] font-extrabold leading-tight text-white"
        >
          {title}
        </h2>
        <NetworkSubtitle
          subtitle={subtitle}
          networkName={networkName}
          className="text-center text-[15px] leading-[22px] text-qr-muted"
          boldClassName="font-bold text-white"
        />
        <div className="w-full max-w-[352px] overflow-hidden rounded-[24px] bg-qr-teal-deep">
          <div
            data-testid="qr-card-tile"
            className="flex flex-col items-center px-4 pb-6 pt-9"
          >
            <div id="qr-card-qr" className="shrink-0">
              {qrCode}
            </div>
            <p className="mt-5 text-center font-display text-xl font-bold text-white">
              {amountText ?? 'Any amount'}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-qr-teal-band p-5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="text-sm text-qr-muted">Receiving address</span>
              <p
                data-testid="qr-card-address"
                className="break-all font-mono text-[17px] font-bold leading-6 text-white"
              >
                {address}
              </p>
            </div>
            <button
              type="button"
              onClick={onCopyAddress}
              disabled={onCopyAddress === undefined}
              aria-label="Copy receiving address"
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-qr-teal-copy text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CopyGlyph className="size-5 shrink-0" />
            </button>
          </div>
        </div>
        <p className="text-[15px] text-qr-muted">{QR_CARD_SHARE_LINK_TEXT}</p>
        <div className="flex w-full items-center justify-center gap-3 rounded-bawa-sm bg-qr-bar px-4 py-5">
          <BrandMark
            markClassName="size-11 rounded-xl bg-coral text-[22px]"
            textClassName="text-[22px] font-extrabold text-white"
          />
        </div>
      </div>
    );
  }

  if (template === 'c') {
    return (
      <div
        data-testid="qr-card"
        data-template="c"
        className="flex w-full flex-col items-center gap-8 bg-white px-6 py-10"
      >
        <LogoImage src={centreLogoSrc} alt={`${tokenSymbol} logo`} size="xl" />
        <h2
          data-testid="qr-card-title"
          className="-mt-2 text-center text-[26px] font-semibold leading-tight text-qr-nearblack"
        >
          {title}
        </h2>
        <NetworkSubtitle
          subtitle={subtitle}
          networkName={networkName}
          className="-mt-6 text-center text-sm text-qr-grey"
          boldClassName="font-bold text-qr-nearblack"
        />
        <div data-testid="qr-card-tile" className="shrink-0">
          <div id="qr-card-qr" className="shrink-0">
            {qrCode}
          </div>
        </div>
        <p
          data-testid="qr-card-instruction"
          className="text-center text-sm text-qr-grey"
        >
          {QR_CARD_SCAN_LINE}
        </p>
        <p className="-mt-4 text-center text-[15px] font-semibold text-qr-nearblack">
          {amountText ?? 'Any amount'}
        </p>
        <p
          data-testid="qr-card-address"
          className="-mt-4 w-full break-all text-center font-mono text-xs text-qr-grey"
        >
          {address}
        </p>
        <button
          type="button"
          onClick={onCopyAddress}
          disabled={onCopyAddress === undefined}
          aria-label="Copy receiving address"
          className="-mt-6 cursor-pointer text-[13px] font-semibold text-qr-nearblack underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy
        </button>
        <p className="mt-2 text-[13px] font-semibold tracking-wide text-qr-faint">
          Bawa
        </p>
      </div>
    );
  }

  if (template === 'd') {
    return (
      <div
        data-testid="qr-card"
        data-template="d"
        className="flex w-full flex-col items-start gap-6 rounded-bawa-sm bg-coral p-6"
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <h2
              data-testid="qr-card-title"
              className="font-display text-[34px] font-extrabold leading-tight text-white"
            >
              {title}
            </h2>
            <NetworkSubtitle
              subtitle={subtitle}
              networkName={networkName}
              className="text-[15px] leading-[22px] text-qr-white-dim"
              boldClassName="font-bold text-white"
            />
          </div>
          <span className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-white">
            <LogoImage
              src={chainLogo ?? tokenLogo}
              alt={`${config.displayName} logo`}
              size="lg"
            />
          </span>
        </div>
        <div
          data-testid="qr-card-tile"
          className="self-center rounded-[24px] bg-white p-6"
        >
          <div id="qr-card-qr" className="shrink-0">
            {qrCode}
          </div>
        </div>
        <div className="space-y-2">
          <p className="font-display text-2xl font-bold text-white">
            {amountText ?? 'Any amount'}
          </p>
          <span className="block h-1 w-12 bg-sun" aria-hidden="true" />
        </div>
        <div className="-mx-6 flex w-[calc(100%+3rem)] items-center gap-3 bg-ink px-6 py-4">
          <p
            data-testid="qr-card-address"
            className="min-w-0 flex-1 break-all font-mono text-[13px] leading-5 text-white"
          >
            {address}
          </p>
          <button
            type="button"
            onClick={onCopyAddress}
            disabled={onCopyAddress === undefined}
            aria-label="Copy receiving address"
            className="flex shrink-0 cursor-pointer items-center justify-center text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CopyGlyph className="size-5 shrink-0" />
          </button>
        </div>
        <BrandMark
          markClassName="size-9 rounded-lg bg-ink text-xl"
          textClassName="font-display text-[22px] font-extrabold text-white"
        />
      </div>
    );
  }

  // Template B (default): Bawa's own paper card, respaced — gaps
  // 8 px to 20 px, title 24 px to 28 px, QR 192 px to 200 px, brand
  // strip added. The header, title, subtitle, tile, amount, address
  // strip and footer are the Lane 5 card, tidied, not redesigned.
  return (
    <div
      data-testid="qr-card"
      data-template="b"
      className="flex flex-col items-center gap-5 rounded-bawa-sm border-2 border-ink bg-paper p-5"
    >
      {/* The header: the asset's mark in a circle, with the network's
          mark as a small badge on its bottom-right edge — the card's
          face, so the receiver knows at a glance which coin and which
          network this card is for. */}
      <div
        data-testid="qr-card-header"
        className="relative mt-1 rounded-full border-2 border-ink bg-paper p-1"
      >
        <LogoImage src={tokenLogo} alt={`${tokenSymbol} logo`} size="lg" />
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
        className="text-center font-display text-[28px] leading-tight text-ink"
      >
        {title}
      </h2>
      <NetworkSubtitle
        subtitle={subtitle}
        networkName={networkName}
        className="text-center text-sm text-ink"
        boldClassName="font-bold"
      />
      {/* Lane H: the QR in its own bordered tile — the tile's ink
          frame is what makes the code read as a card, not a bare
          printout. The tile carries the hard offset shadow
          (Oishi system, formalised as --bawa-shadow): one fixed
          ink offset, no blur, no gradient. The asset's mark sits
          in the centre of the code (imageSettings, excavated, level
          H) — the same mark as the header circle, so the code and
          the card read as one thing. */}
      <div
        data-testid="qr-card-tile"
        className="rounded-bawa-sm border-2 border-ink bg-paper p-2 shadow-[var(--bawa-shadow)]"
      >
        <div id="qr-card-qr" className="shrink-0">
          {qrCode}
        </div>
      </div>
      <p className="text-center font-display text-[22px] text-ink">
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
            <CopyGlyph className="size-4 shrink-0" />
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
      <div className="flex w-full items-center justify-center border-t-2 border-ink pt-3">
        <BrandMark
          markClassName="size-6 rounded-[6px] bg-coral text-base"
          textClassName="font-display text-base font-bold text-ink"
        />
      </div>
    </div>
  );
}
