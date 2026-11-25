// Payment-request URIs (token gaps, item 3).
//
// One format per chain, each verified against its real spec — never
// invented:
// - BTC / LTC / DOGE: BIP-21 (https://bips.dev/21) —
//   bitcoin:<address>?amount=<decimal BTC>
// - EVM natives + ERC-20: EIP-681 (https://eips.ethereum.org/EIPS/eip-681) —
//   ethereum:<target>@<chainId>?value=<wei> for a native payment, or
//   ethereum:<tokenContract>@<chainId>/transfer?address=<to>&uint256=<base>
//   for a token payment. The chain id is always included (it defaults
//   to 1 when omitted, which would misroute a Base payment to Ethereum).
// - SOL: Solana Pay (solana-foundation/pay SPEC.md) —
//   solana:<recipient>?amount=<decimal SOL> (user units, never lamports)
//   for native SOL, or solana:<recipient>?amount=<decimal>&spl-token=<mint>
//   for an SPL token: the recipient stays the native SOL account (the
//   wallet derives the associated token account from recipient + mint),
//   and the amount is in decimal token units. Without spl-token the URL
//   is a native SOL transfer — a token amount without it would be paid
//   in SOL, so the token path must always carry the mint.
// - TON: ton://transfer/<address>?amount=<nanotons>
//   (https://ton-blockchain.github.io/docs/develop/dapps/telegram-apps/app-deeplinks;
//   1 TON = 10^9 nanotons) for native TON, or
//   ton://transfer/<address>?jetton=<jetton master>&amount=<base units>
//   for a Jetton (docs.ton.org deep links: the jetton parameter names
//   the Jetton master contract and the amount is then in the Jetton's
//   own smallest units, e.g. 1 USDT = 1,000,000 units at 6 decimals).
//   Without jetton the URL is a native TON transfer — a Jetton amount
//   without it would be paid in TON, so the token path must always
//   carry the master address.
// - TRON: there is NO bare payment-request URI standard. TronLink's
//   transfer deep link (tronlinkoutside://pull.activity?param={...}) is
//   a vendor dApp-callback link, not a payment request, so buildPaymentUri
//   refuses TRON rather than inventing a tron: URI. A TRON receive is
//   still shareable as a Bawa web link (buildBawaSendLink), which the
//   app's own Send screen prefills.
//
// Patterns mined (read-only web viewing, no code copied): MetaMask
// Mobile deeplinking docs — an EIP-681 link is parsed, the wallet
// switches to the requested chain, then opens its Send screen — and
// the erc681.org adoption audit — handlers route ethereum: URIs into
// the send flow and accept only a native payment or a transfer call;
// any other function name is rejected.
//
// The Bawa web link (/send?chain=&to=&amount=&token=) is the
// cross-wallet fallback: any wallet (or desktop browser) that opens it
// lands on this app's Send screen with chain, recipient, amount and
// token prefilled. The OS-level app chooser for bitcoin:/ethereum:
// links is platform behaviour outside this app; in-app, the Send
// screen's chain picker is the wallet chooser.
import { CHAINS, SUPPORTED_CHAINS, type ChainId } from './chains';
import { decimalToBaseUnits } from './chain-amount-format';
import { DEFAULT_TOKENS } from './tokens';

export interface PaymentRequest {
  chain: ChainId;
  /** Recipient address (the token contract for an ERC-20 payment lives in tokenContract). */
  address: string;
  /** Decimal amount in user units (e.g. '0.5' BTC, '25' USDC). */
  amount?: string;
  /** ERC-20 contract / SPL mint / Jetton master when this pays a token
   * rather than the native coin. */
  tokenContract?: string;
  /** Decimals of tokenContract; required for a token payment. */
  tokenDecimals?: number;
  label?: string;
  message?: string;
}

export type PaymentUriResult =
  | { ok: true; uri: string }
  | { ok: false; reason: string };

export type ParsePaymentUriResult =
  | { ok: true; request: PaymentRequest }
  | { ok: false; reason: string };

const BIP21: Record<string, { chain: ChainId; decimals: number }> = {
  bitcoin: { chain: 'btc', decimals: 8 },
  litecoin: { chain: 'ltc', decimals: 8 },
  dogecoin: { chain: 'doge', decimals: 8 },
};

/** Exact decimal math: base units back to a decimal string, no floats. */
export function baseUnitsToDecimal(value: string, decimals: number): string | null {
  if (!/^\d+$/.test(value)) return null;
  const padded = value.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

function isSupportedChain(value: string): value is ChainId {
  return (SUPPORTED_CHAINS as readonly string[]).includes(value);
}

function evmChainForId(chainId: number): ChainId | null {
  for (const chain of SUPPORTED_CHAINS) {
    if (CHAINS[chain].evmChainId === chainId) return chain;
  }
  return null;
}

function validAmount(amount: string, decimals: number): boolean {
  return decimalToBaseUnits(amount, decimals) !== null;
}

export function buildPaymentUri(request: PaymentRequest): PaymentUriResult {
  const { chain, address, amount, tokenContract, tokenDecimals, label, message } = request;
  if (address.trim() === '') return { ok: false, reason: 'Missing recipient address.' };

  // BIP-21 (BTC, LTC, DOGE): amount stays a decimal string in the URI.
  if (chain === 'btc' || chain === 'ltc' || chain === 'doge') {
    if (amount !== undefined && !validAmount(amount, 8)) {
      return { ok: false, reason: `Invalid amount for ${chain}: ${amount}` };
    }
    const scheme = chain === 'btc' ? 'bitcoin' : chain === 'ltc' ? 'litecoin' : 'dogecoin';
    const params = new URLSearchParams();
    if (amount !== undefined) params.set('amount', amount);
    if (label !== undefined) params.set('label', label);
    if (message !== undefined) params.set('message', message);
    const query = params.toString();
    return { ok: true, uri: `${scheme}:${address}${query === '' ? '' : `?${query}`}` };
  }

  // EIP-681 (all EVM chains): native value in wei, token as transfer().
  if (CHAINS[chain].evmChainId !== null) {
    const chainId = CHAINS[chain].evmChainId as number;
    if (tokenContract !== undefined) {
      if (tokenDecimals === undefined) {
        return { ok: false, reason: 'Token decimals are required for a token payment.' };
      }
      if (amount === undefined) {
        return { ok: false, reason: 'An amount is required for a token payment.' };
      }
      const baseUnits = decimalToBaseUnits(amount, tokenDecimals);
      if (baseUnits === null) {
        return { ok: false, reason: `Invalid amount for ${chain}: ${amount}` };
      }
      return {
        ok: true,
        uri: `ethereum:${tokenContract}@${chainId}/transfer?address=${address}&uint256=${baseUnits}`,
      };
    }
    if (amount !== undefined && !validAmount(amount, 18)) {
      return { ok: false, reason: `Invalid amount for ${chain}: ${amount}` };
    }
    const query = amount === undefined ? '' : `?value=${decimalToBaseUnits(amount, 18)}`;
    return { ok: true, uri: `ethereum:${address}@${chainId}${query}` };
  }

  // Solana Pay: amount in SOL (user units), scientific notation refused.
  // An SPL token adds spl-token=<mint> (Solana Pay SPEC.md transfer
  // request): the recipient stays the native SOL account and the amount
  // is in decimal token units. The mint is mandatory for a token
  // payment — without it the URL would request native SOL.
  if (chain === 'sol') {
    if (tokenContract !== undefined) {
      if (tokenDecimals === undefined) {
        return { ok: false, reason: 'Token decimals are required for a token payment.' };
      }
      if (amount !== undefined && !validAmount(amount, tokenDecimals)) {
        return { ok: false, reason: `Invalid amount for sol: ${amount}` };
      }
      const params = new URLSearchParams();
      if (amount !== undefined) params.set('amount', amount);
      params.set('spl-token', tokenContract);
      return { ok: true, uri: `solana:${address}?${params.toString()}` };
    }
    if (amount !== undefined && !validAmount(amount, 9)) {
      return { ok: false, reason: `Invalid amount for sol: ${amount}` };
    }
    const query = amount === undefined ? '' : `?amount=${amount}`;
    return { ok: true, uri: `solana:${address}${query}` };
  }

  // TON: amount in nanotons (1 TON = 10^9 nanotons). A Jetton adds
  // jetton=<master> (docs.ton.org deep links) and the amount is then
  // in the Jetton's own smallest units (tokenDecimals), not nanotons.
  // The master is mandatory for a token payment — without it the URL
  // would request native TON.
  if (chain === 'ton') {
    if (tokenContract !== undefined) {
      if (tokenDecimals === undefined) {
        return { ok: false, reason: 'Token decimals are required for a token payment.' };
      }
      const params = new URLSearchParams();
      params.set('jetton', tokenContract);
      if (amount !== undefined) {
        const baseUnits = decimalToBaseUnits(amount, tokenDecimals);
        if (baseUnits === null) {
          return { ok: false, reason: `Invalid amount for ton: ${amount}` };
        }
        params.set('amount', baseUnits);
      }
      return { ok: true, uri: `ton://transfer/${address}?${params.toString()}` };
    }
    if (amount !== undefined) {
      const nanotons = decimalToBaseUnits(amount, 9);
      if (nanotons === null) {
        return { ok: false, reason: `Invalid amount for ton: ${amount}` };
      }
      return { ok: true, uri: `ton://transfer/${address}?amount=${nanotons}` };
    }
    return { ok: true, uri: `ton://transfer/${address}` };
  }

  // TRON has no bare payment-request URI standard — refuse, never invent.
  return {
    ok: false,
    reason:
      'TRON has no standard payment-request URI: share the Bawa web link instead.',
  };
}

export function parsePaymentUri(
  uri: string,
  tokens = DEFAULT_TOKENS,
): ParsePaymentUriResult {
  const fail = (reason: string): ParsePaymentUriResult => ({ ok: false, reason });
  const trimmed = uri.trim();

  // TON deep link: ton://transfer/<address>?amount=<nanotons>
  // — or, for a Jetton, ?jetton=<master>&amount=<jetton base units>.
  if (trimmed.toLowerCase().startsWith('ton://transfer/')) {
    const rest = trimmed.slice('ton://transfer/'.length);
    const [address, queryString] = rest.split('?');
    if (!address) return fail('Missing TON address.');
    const params = new URLSearchParams(queryString ?? '');
    const amountRaw = params.get('amount');
    const jetton = params.get('jetton');
    if (jetton !== null) {
      const token = tokens.find(
        (candidate) =>
          candidate.chain === 'ton' &&
          candidate.contract.toLowerCase() === jetton.toLowerCase(),
      );
      if (token === undefined) {
        return fail('Unknown Jetton master in the payment link.');
      }
      if (amountRaw === null) {
        return {
          ok: true,
          request: {
            chain: 'ton',
            address,
            tokenContract: token.contract,
            tokenDecimals: token.decimals,
          },
        };
      }
      const amount = baseUnitsToDecimal(amountRaw, token.decimals);
      if (amount === null) return fail('Invalid Jetton amount.');
      return {
        ok: true,
        request: {
          chain: 'ton',
          address,
          amount,
          tokenContract: token.contract,
          tokenDecimals: token.decimals,
        },
      };
    }
    const nanotons = amountRaw;
    if (nanotons === null) return { ok: true, request: { chain: 'ton', address } };
    const amount = baseUnitsToDecimal(nanotons, 9);
    if (amount === null) return fail('Invalid TON amount.');
    return { ok: true, request: { chain: 'ton', address, amount } };
  }

  const schemeMatch = trimmed.match(/^([a-z0-9+.-]+):([\s\S]*)$/i);
  if (!schemeMatch) return fail('Not a payment URI.');
  const scheme = schemeMatch[1]!.toLowerCase();
  const rest = schemeMatch[2]!;

  // BIP-21: <scheme>:<address>[?amount=&label=&message=]
  if (scheme in BIP21) {
    const { chain, decimals } = BIP21[scheme]!;
    const [address, queryString] = rest.split('?');
    if (!address) return fail('Missing address.');
    const params = new URLSearchParams(queryString ?? '');
    const amount = params.get('amount') ?? undefined;
    if (amount !== undefined && !validAmount(amount, decimals)) {
      return fail('Invalid amount.');
    }
    return { ok: true, request: { chain, address, amount } };
  }

  // Solana Pay: solana:<recipient>[?amount=&label=&message=&memo=]
  // — or, for an SPL token, ?amount=&spl-token=<mint>. The amount is
  // in decimal token units and the recipient is the native SOL account.
  if (scheme === 'solana') {
    const [address, queryString] = rest.split('?');
    if (!address) return fail('Missing Solana address.');
    const params = new URLSearchParams(queryString ?? '');
    const splToken = params.get('spl-token');
    if (splToken !== null) {
      const token = tokens.find(
        (candidate) =>
          candidate.chain === 'sol' &&
          candidate.contract.toLowerCase() === splToken.toLowerCase(),
      );
      if (token === undefined) {
        return fail('Unknown SPL token mint in the payment link.');
      }
      const amount = params.get('amount') ?? undefined;
      if (amount !== undefined && !validAmount(amount, token.decimals)) {
        return fail('Invalid SPL token amount.');
      }
      return {
        ok: true,
        request: {
          chain: 'sol',
          address,
          amount,
          tokenContract: token.contract,
          tokenDecimals: token.decimals,
        },
      };
    }
    const amount = params.get('amount') ?? undefined;
    if (amount !== undefined && !validAmount(amount, 9)) {
      return fail('Invalid Solana Pay amount.');
    }
    return { ok: true, request: { chain: 'sol', address, amount } };
  }

  // EIP-681: ethereum:[pay-]<target>@<chainId>[/<function>]?<params>
  if (scheme === 'ethereum') {
    const [beforeQuery, queryString] = rest.split('?');
    const params = new URLSearchParams(queryString ?? '');
    const atIndex = beforeQuery!.indexOf('@');
    const targetPart = atIndex === -1 ? beforeQuery! : beforeQuery!.slice(0, atIndex);
    const afterAt = atIndex === -1 ? '' : beforeQuery!.slice(atIndex + 1);
    const [chainIdPart, functionName] = afterAt.split('/');
    const chainId = chainIdPart === '' ? 1 : Number(chainIdPart);
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return fail('Invalid EIP-681 chain id.');
    }
    const chain = evmChainForId(chainId);
    if (chain === null) return fail(`Unsupported EIP-681 chain id ${chainId}.`);
    const target = targetPart.replace(/^pay-/, '');
    if (target === '') return fail('Missing EIP-681 target.');
    if (functionName !== undefined && functionName !== '') {
      // Only the transfer function is accepted (erc681.org audit pattern).
      if (functionName !== 'transfer') {
        return fail(`Unsupported EIP-681 function ${functionName}.`);
      }
      const recipient = params.get('address');
      const uint256 = params.get('uint256');
      if (recipient === null || uint256 === null) {
        return fail('An ERC-20 transfer needs address and uint256.');
      }
      const token = tokens.find(
        (candidate) =>
          candidate.chain === chain &&
          candidate.contract.toLowerCase() === target.toLowerCase(),
      );
      if (token === undefined) {
        return fail('Unknown token contract in the payment link.');
      }
      const amount = baseUnitsToDecimal(uint256, token.decimals);
      if (amount === null) return fail('Invalid ERC-20 amount.');
      return {
        ok: true,
        request: {
          chain,
          address: recipient,
          amount,
          tokenContract: token.contract,
          tokenDecimals: token.decimals,
        },
      };
    }
    const value = params.get('value');
    if (value === null) return { ok: true, request: { chain, address: target } };
    const amount = baseUnitsToDecimal(value, 18);
    if (amount === null) return fail('Invalid EIP-681 value.');
    return { ok: true, request: { chain, address: target, amount } };
  }

  return fail(`Unsupported payment URI scheme ${scheme}.`);
}

export interface BawaSendLinkParams {
  chain: ChainId;
  to: string;
  amount?: string;
  /** Token contract when the link pays a token rather than the native coin. */
  token?: string;
}

/**
 * The Bawa web deep link: opens this app's Send screen with the payment
 * prefilled. Works on desktop browsers too (no app install needed), and
 * covers chains with no payment-URI standard (TRON). The Send screen
 * parses it on mount (see send.tsx). The deployment subpath is kept
 * (see appBasePath): a link shared from the Pages preview reads
 * https://pr3eve6ti2o.github.io/bawa/send?... — without the /bawa/
 * prefix it points at the domain root and never reaches the app.
 */
/**
 * The deployment subpath (Vite `base`): '' at the domain root, '/bawa'
 * on the GitHub Pages project site. A shared link must keep it — a
 * link built from window.location.origin alone points at the domain
 * root and never reaches the app on a subpath deployment (the shared
 * link from the Pages preview was exactly that: /send?... with the
 * /bawa/ prefix missing). Read at call time so tests can stub
 * import.meta.env.BASE_URL.
 */
export function appBasePath(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  if (base === '/') return '';
  return base.replace(/\/$/, '');
}

export function buildBawaSendLink(origin: string, params: BawaSendLinkParams): string {
  const query = new URLSearchParams();
  query.set('chain', params.chain);
  query.set('to', params.to);
  if (params.amount !== undefined) query.set('amount', params.amount);
  if (params.token !== undefined) query.set('token', params.token);
  return `${origin.replace(/\/$/, '')}${appBasePath()}/send?${query.toString()}`;
}

export function parseBawaSendLink(
  search: string,
): BawaSendLinkParams | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const chain = params.get('chain');
  const to = params.get('to');
  if (chain === null || !isSupportedChain(chain) || to === null || to === '') {
    return null;
  }
  const amount = params.get('amount') ?? undefined;
  const token = params.get('token') ?? undefined;
  return { chain, to, amount, token };
}

// Pending send link (UI/UX round 2, deep-link fix): the payment a
// shared link asked for, kept across the cold-start gap.
//
// The Send screen parses the link from the URL on mount, but on a
// cold start the wallet may not exist yet (or the vault may be
// locked), so there is nothing to prefill into. The link is stored
// here so creating or importing a wallet — or unlocking — does not
// lose it: the Send screen resumes it on its next mount, and the
// create-wallet ready screen offers to continue straight to it.
//
// sessionStorage, not localStorage, so the intent dies with the tab
// (the lock-return-to precedent in app.tsx). The stored value is the
// raw query string, re-validated through parseBawaSendLink on read,
// so a hand-edited or stale value can never inject an invalid link.
// All access is guarded: private-mode storage must never break Send.
export const PENDING_SEND_LINK_KEY = 'bawa-pending-send-link';

export function savePendingSendLink(search: string): void {
  try {
    sessionStorage.setItem(PENDING_SEND_LINK_KEY, search.replace(/^\?/, ''));
  } catch {
    // Storage unavailable — the link still applies from the URL.
  }
}

export function readPendingSendLinkSearch(): string | null {
  try {
    return sessionStorage.getItem(PENDING_SEND_LINK_KEY);
  } catch {
    return null;
  }
}

export function readPendingSendLink(): BawaSendLinkParams | null {
  const search = readPendingSendLinkSearch();
  if (search === null || search === '') return null;
  return parseBawaSendLink(search);
}

export function clearPendingSendLink(): void {
  try {
    sessionStorage.removeItem(PENDING_SEND_LINK_KEY);
  } catch {
    // Nothing to clear.
  }
}

// QR as a shareable image (UI/UX fixes, item 4).
//
// Sharing used to send only the link + address text. The Receive
// screen's QR is an inline SVG (qrcode.react); this renders it to a
// PNG so the Web Share API can attach it as a file — the pattern
// MetaMask Mobile and BlueWallet use for "share my address" (a QR
// image, not a link). The paper background (#FFFDF7) is painted first
// so the ink modules stay scannable on any chat background, matching
// the on-screen QR surround.
//
// The render deps are injectable (the adapters' FetchTransport
// precedent): jsdom has no canvas and its Image never loads, so tests
// inject fakes; the production call site uses the browser globals.

export interface QrRenderImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  width: number;
  height: number;
  src: string;
}

export interface QrRenderContext {
  fillStyle: string;
  strokeStyle?: string;
  lineWidth?: number;
  globalCompositeOperation?: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(
    image: QrRenderImage | QrRenderCanvas,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  // Text — only the card renderer needs these, so they stay optional
  // and the bare-QR fakes (which never draw text) keep compiling.
  font?: string;
  textAlign?: string;
  textBaseline?: string;
  fillText?: (text: string, x: number, y: number) => void;
  measureText?: (text: string) => { width: number };
  // Paths — only the card renderer needs these, for the same reason.
  beginPath?: () => void;
  moveTo?: (x: number, y: number) => void;
  lineTo?: (x: number, y: number) => void;
  arcTo?: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ) => void;
  arc?: (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  closePath?: () => void;
  fill?: () => void;
  stroke?: () => void;
  save?: () => void;
  restore?: () => void;
  clip?: () => void;
  // Pixels — only the white-silhouette step needs these (template
  // A drops the logo's light background before recolouring it).
  getImageData?: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => { data: Uint8ClampedArray };
  putImageData?: (
    pixels: { data: Uint8ClampedArray },
    x: number,
    y: number,
  ) => void;
}

export interface QrRenderCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): QrRenderContext | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string): void;
}

export interface QrRenderDeps {
  createCanvas(): QrRenderCanvas;
  createImage(): QrRenderImage;
}

const QR_PAPER_COLOR = '#FFFDF7';

const browserQrRenderDeps: QrRenderDeps = {
  createCanvas: () =>
    document.createElement('canvas') as unknown as QrRenderCanvas,
  createImage: () => new Image() as unknown as QrRenderImage,
};

/** Loads one image URL, rejecting when it cannot load in time. */
async function loadQrImage(
  src: string,
  deps: QrRenderDeps,
  timeoutMs: number,
): Promise<QrRenderImage> {
  const image = deps.createImage();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The QR code image could not be loaded.')),
      timeoutMs,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('The QR code image could not be loaded.'));
    };
    image.src = src;
  });
  return image;
}

/**
 * Loads one image URL, or null when it cannot load in time. Logos on
 * the shared card are decorative — a missing logo must never block
 * the share, so the card draws without it.
 */
async function loadCardImageOrNull(
  src: string,
  deps: QrRenderDeps,
  timeoutMs: number,
): Promise<QrRenderImage | null> {
  try {
    return await loadQrImage(src, deps, timeoutMs);
  } catch {
    return null;
  }
}

/** canvas.toBlob as a promise: a null result (render failure) throws. */
async function canvasToPngBlob(canvas: QrRenderCanvas): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
  if (blob === null) {
    throw new Error('The QR code could not be rendered on this device.');
  }
  return blob;
}

/** Renders an SVG QR markup string to a PNG blob at the given pixel size. */
export async function qrSvgToPngBlob(
  svgMarkup: string,
  pixels = 512,
  deps: QrRenderDeps = browserQrRenderDeps,
): Promise<Blob> {
  if (
    typeof svgMarkup !== 'string' ||
    svgMarkup.trim() === '' ||
    !svgMarkup.includes('<svg')
  ) {
    throw new Error('Cannot share the QR code: no QR image was rendered.');
  }
  if (!Number.isSafeInteger(pixels) || pixels <= 0 || pixels > 4096) {
    throw new Error('Cannot share the QR code: invalid image size.');
  }
  const canvas = deps.createCanvas();
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('The QR code could not be rendered on this device.');
  }
  // A data URL, not a blob URL: an SVG loaded from a blob URL hangs
  // (neither onload nor onerror) in headless Chromium 1255 — proved
  // live 2026-11-23, where Share fell through to copying the link —
  // while the same SVG loads from a data URL. The 10 s timeout keeps
  // the share from hanging silently if a browser stalls the load.
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const image = await loadQrImage(svgUrl, deps, 10_000);
  ctx.fillStyle = QR_PAPER_COLOR;
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.drawImage(image, 0, 0, pixels, pixels);
  return canvasToPngBlob(canvas);
}

/** Renders an SVG QR markup string to a PNG File ready for navigator.share. */
export async function qrSvgToPngFile(
  svgMarkup: string,
  fileName: string,
  pixels = 512,
  deps: QrRenderDeps = browserQrRenderDeps,
): Promise<File> {
  const blob = await qrSvgToPngBlob(svgMarkup, pixels, deps);
  return new File([blob], fileName, { type: 'image/png' });
}

// The QR card as a shareable image (UI/UX Round 2, item 1; QR-cards
// programme, Lane E, 2026-11-25).
//
// Sharing used to send a PARTIAL card: the PNG drew the QR tile,
// the amount, the address and the token label, but none of the
// header (logo circle + title + network subtitle), the "Receiving
// address" label, the footer, or any brand. The shared image is now
// the SAME card the screen shows, in the template the user picked —
// PNG parity first, template variants second.
//
// Templates (design/DESIGN.md in bawa-qr-cards): A "Dark Teal" (the
// showcase/share variant — inverted white-on-dark code, conditional
// on a phone decode test), B "Paper / Drawing" (the default — Bawa's
// own system, respaced), C "Minimal Light" (the fallback), D
// "Poster / Brand" (the loud share variant). The templates are
// ORIGINAL designs informed by the Bitget/OKX patterns only: no
// competitor logo, colour-as-brand, cyan arrow, or "Deposit from
// Bitget Exchange" link is copied; the brand bar is Bawa's own
// wordmark. Template A deliberately has NO white ring in place of
// the bottom-right alignment pattern — Lane D proved first-hand that
// the ring alone breaks the repo's own jsQR decoder in every
// combination, so the alignment pattern stays a normal pattern.
//
// Geometry: every template is laid out in 390 px design units (the
// widths DESIGN.md specifies) and scaled by width/390, so the 640 px
// export and the 1080 px export are the same card at two sizes —
// never a reflowed one. Heights are computed from the wrapped
// subtitle and address, so a long non-EVM address grows the card
// instead of clipping. The layout is measured first and drawn
// second, on the same numbers.

export type QrCardTemplate = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

export interface QrCardTemplateMeta {
  id: QrCardTemplate;
  label: string;
  hint: string;
}

export const QR_CARD_TEMPLATES: readonly QrCardTemplateMeta[] = [
  { id: 'b', label: 'Paper', hint: 'Bawa drawing style' },
  { id: 'a', label: 'Dark Teal', hint: 'Closest to the Bitget bar' },
  { id: 'e', label: 'Sun', hint: 'Bright sun field' },
  { id: 'f', label: 'Ink', hint: 'Dark card, safe code' },
  { id: 'g', label: 'Ticket', hint: 'Two-tone ticket stub' },
  { id: 'c', label: 'Minimal', hint: 'Plain and quiet' },
  { id: 'd', label: 'Poster', hint: 'Bold, for sharing' },
];

/** The default template: B, Bawa's own system. */
export const DEFAULT_QR_CARD_TEMPLATE: QrCardTemplate = 'b';

/**
 * The QR itself per template: code size in design px (including its
 * 4-module quiet zone, as qrcode.react renders it), module colours,
 * and the centre-mark size. A is the only inverted code. The logo
 * sizes are the DESIGN.md caps — A 13%, B 20%, C 14%, D 19%, E 19%,
 * F 19%, G 20% of the code — and match the in-app card's
 * imageSettings exactly, so the PNG centre disc covers the
 * excavation hole the SVG already has.
 *
 * UX-major Lane 1 (2026-11-26): the codes grew toward Bitget's
 * 62%-of-card share (measured: Bitget 319 px = 62.3% of its card).
 * B/G 200 -> 216 (60% of the 360 card), C 216 -> 224, D 210 -> 222
 * (62%), E 210 -> 218, F 208 -> 216. A stays 218 (already 62%).
 * Every logo stays inside the 25% cap at error level H.
 */
export const QR_CARD_TEMPLATE_QR: Record<
  QrCardTemplate,
  { size: number; fg: string; bg: string; logo: number }
> = {
  a: { size: 218, fg: '#FFFFFF', bg: '#011F29', logo: 28 },
  b: { size: 216, fg: '#2B2B2B', bg: '#FFFDF7', logo: 44 },
  c: { size: 224, fg: '#111111', bg: '#FFFFFF', logo: 32 },
  d: { size: 222, fg: '#2B2B2B', bg: '#FFFFFF', logo: 42 },
  e: { size: 218, fg: '#2B2B2B', bg: '#FFFFFF', logo: 42 },
  f: { size: 216, fg: '#2B2B2B', bg: '#FFFFFF', logo: 40 },
  g: { size: 216, fg: '#2B2B2B', bg: '#FFFDF7', logo: 44 },
};

/** The footer: Bawa's own words — share the card, keep the keys. */
export const QR_CARD_FOOTER = 'Share the card, keep the keys.';
/** Template C's instruction line, in Bawa's words. */
export const QR_CARD_SCAN_LINE =
  'Scan or share this QR code to receive crypto.';
/** Template A's link line below the card — Bawa's own share-link slot. */
export const QR_CARD_SHARE_LINK_TEXT = 'Open the Bawa link ›';
/** The brand wordmark, drawn once per card, outside the functional area. */
export const QR_CARD_BRAND = 'Bawa Wallet';

export interface QrCardPngDetails {
  /** e.g. '25 USDC', or 'Any amount' when no amount is set. */
  amountText: string;
  address: string;
  /** e.g. 'usdc (base)' — qrCardTokenLabel in screens/qr-card. */
  tokenLabel: string;
  /** e.g. 'Receive ETH' — qrCardTitle in screens/qr-card. */
  title: string;
  /** e.g. 'Only Ethereum network assets can be received here.' */
  subtitle: string;
  /** e.g. 'Ethereum' — bolded inside the subtitle. */
  networkName: string;
  /** e.g. 'USD Coin · Base' — tokens only, omitted for native coins. */
  subline?: string;
  /** Template A's link line; default 'Open the Bawa link ›'. */
  shareLinkText?: string;
  /** Which template to draw; default 'b' (Paper). */
  template?: QrCardTemplate;
  /** Export width in px; default 640. The 1080 px share export is
   * the same card scaled, never a reflow. */
  width?: number;
  /** Bundled Trust Wallet logo URLs; either may be absent. */
  tokenLogoSrc?: string;
  chainLogoSrc?: string;
}

const QR_CARD_WIDTH = 640;
const QR_CARD_DESIGN_WIDTH = 390;
const QR_CARD_INK = '#2B2B2B';
const QR_CARD_CORAL = '#FF6B4A';
const QR_CARD_SUN = '#FFD93B';

/** One word of a subtitle, with whether the network name makes it bold. */
interface RichWord {
  text: string;
  bold: boolean;
}

function subtitleSegments(
  subtitle: string,
  networkName: string,
): { text: string; bold: boolean }[] {
  const at = networkName === '' ? -1 : subtitle.indexOf(networkName);
  if (at === -1) return [{ text: subtitle, bold: false }];
  const parts: { text: string; bold: boolean }[] = [];
  if (at > 0) parts.push({ text: subtitle.slice(0, at), bold: false });
  parts.push({ text: networkName, bold: true });
  if (at + networkName.length < subtitle.length) {
    parts.push({ text: subtitle.slice(at + networkName.length), bold: false });
  }
  return parts;
}

function richWords(
  segments: { text: string; bold: boolean }[],
): RichWord[] {
  const words: RichWord[] = [];
  for (const segment of segments) {
    for (const word of segment.text.split(' ')) {
      if (word !== '') words.push({ text: word, bold: segment.bold });
    }
  }
  return words;
}

/** The card context: a 2d context with the drawing methods the card
 * needs. The bare-QR fakes never draw a card, so these stay optional
 * on QrRenderContext and the card checks for them up front. */
interface CardContext extends QrRenderContext {
  font: string;
  textAlign: string;
  textBaseline: string;
  fillText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arcTo: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ) => void;
  arc: (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  closePath: () => void;
  fill: () => void;
  stroke: () => void;
  save: () => void;
  restore: () => void;
  clip: () => void;
}

function requireCardContext(
  ctx: QrRenderContext | null,
): CardContext | null {
  if (
    ctx === null ||
    ctx.fillText === undefined ||
    ctx.measureText === undefined ||
    ctx.beginPath === undefined ||
    ctx.moveTo === undefined ||
    ctx.lineTo === undefined ||
    ctx.arcTo === undefined ||
    ctx.arc === undefined ||
    ctx.closePath === undefined ||
    ctx.fill === undefined ||
    ctx.stroke === undefined ||
    ctx.save === undefined ||
    ctx.restore === undefined ||
    ctx.clip === undefined
  ) {
    return null;
  }
  return ctx as CardContext;
}

/** Rounded-rectangle path (no fill/stroke — the caller chooses). */
function roundRectPath(
  ctx: CardContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CardContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(
  ctx: CardContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function fillCircle(
  ctx: CardContext,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function strokeCircle(
  ctx: CardContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.stroke();
}

/**
 * The copy mark: two overlapping stroked rounded squares, the back
 * one up-right of the front one. Drawn, not a font glyph, so it
 * renders identically in every browser and in headless Chromium.
 */
function drawCopyGlyph(
  ctx: CardContext,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.09);
  const w = size * 0.52;
  const r = size * 0.14;
  roundRectPath(ctx, x + size * 0.3, y, w, w, r);
  ctx.stroke();
  roundRectPath(ctx, x, y + size * 0.3, w, w, r);
  ctx.stroke();
}

function drawText(
  ctx: CardContext,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function wrapRichWords(
  ctx: CardContext,
  words: RichWord[],
  font: string,
  boldFont: string,
  maxWidth: number,
): RichWord[][] {
  const lines: RichWord[][] = [];
  let line: RichWord[] = [];
  let lineWidth = 0;
  ctx.font = font;
  const spaceWidth = ctx.measureText(' ').width;
  for (const word of words) {
    ctx.font = word.bold ? boldFont : font;
    const wordWidth = ctx.measureText(word.text).width;
    if (line.length === 0) {
      line.push(word);
      lineWidth = wordWidth;
    } else if (lineWidth + spaceWidth + wordWidth <= maxWidth) {
      line.push(word);
      lineWidth += spaceWidth + wordWidth;
    } else {
      lines.push(line);
      line = [word];
      lineWidth = wordWidth;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function richLineWidth(
  ctx: CardContext,
  line: RichWord[],
  font: string,
  boldFont: string,
): number {
  let total = 0;
  ctx.font = font;
  const spaceWidth = ctx.measureText(' ').width;
  line.forEach((word, index) => {
    ctx.font = word.bold ? boldFont : font;
    total += ctx.measureText(word.text).width;
    if (index > 0) total += spaceWidth;
  });
  return total;
}

function drawRichLine(
  ctx: CardContext,
  line: RichWord[],
  x: number,
  y: number,
  font: string,
  boldFont: string,
  color: string,
  boldColor: string,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = font;
  const spaceWidth = ctx.measureText(' ').width;
  const total = richLineWidth(ctx, line, font, boldFont);
  let cursor = align === 'center' ? x - total / 2 : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  line.forEach((word, index) => {
    if (index > 0) cursor += spaceWidth;
    ctx.font = word.bold ? boldFont : font;
    ctx.fillStyle = word.bold ? boldColor : color;
    ctx.fillText(word.text, cursor, y);
    cursor += ctx.measureText(word.text).width;
  });
}

/**
 * One subtitle block: every wrapped line, centred or left-aligned,
 * network name bolded. Shared by all four templates — the only
 * differences are the size, the colours and the alignment.
 */
function drawSubtitleBlock(
  ctx: CardContext,
  lines: RichWord[][],
  x: number,
  y: number,
  lineHeight: number,
  fontPx: number,
  color: string,
  boldColor: string,
  align: CanvasTextAlign = 'center',
): void {
  lines.forEach((line, index) => {
    drawRichLine(
      ctx,
      line,
      x,
      y + index * lineHeight,
      BODY_FONT(fontPx),
      BODY_FONT(fontPx, 700),
      color,
      boldColor,
      align,
    );
  });
}

/** The full address, one fillText per wrapped line. */
function drawAddressLines(
  ctx: CardContext,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'center',
): void {
  lines.forEach((line, index) => {
    drawText(ctx, line, x, y + index * lineHeight, font, color, align);
  });
}

/**
 * Template A's centre mark, white on coral: the token logo redrawn
 * as a white silhouette on an offscreen canvas (draw the logo, then
 * fill with 'source-in' so only the logo's own pixels turn white).
 * The design's white ETH diamond on the coral disc, for any token —
 * a dark glyph on coral would not read. Returns null when the
 * offscreen canvas cannot do the composite, and the caller then
 * draws the logo as-is on the disc.
 *
 * The threshold: the repo's chain logos carry the glyph on a
 * near-white disc (luminance ~244) while the glyph itself is dark
 * (luminance <= ~131, measured on the ETH asset) — without dropping
 * the light background first, the silhouette is the whole disc, a
 * blank white circle on coral instead of the diamond. Pixels
 * brighter than 160 go transparent; the dark glyph stays and is then
 * recoloured white. A logo whose glyph is itself light degrades to
 * no mark rather than a white circle.
 */
function buildWhiteSilhouette(
  deps: QrRenderDeps,
  image: QrRenderImage,
  sizePx: number,
): QrRenderCanvas | null {
  const off = deps.createCanvas();
  off.width = sizePx;
  off.height = sizePx;
  const octx = off.getContext('2d');
  if (octx === null || octx.globalCompositeOperation === undefined) {
    return null;
  }
  octx.drawImage(image, 0, 0, sizePx, sizePx);
  if (
    typeof octx.getImageData === 'function' &&
    typeof octx.putImageData === 'function'
  ) {
    const pixels = octx.getImageData(0, 0, sizePx, sizePx);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance =
        0.2126 * (data[i] ?? 0) +
        0.7152 * (data[i + 1] ?? 0) +
        0.0722 * (data[i + 2] ?? 0);
      if (luminance > 160) data[i + 3] = 0;
    }
    octx.putImageData(pixels, 0, 0);
  }
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = '#FFFFFF';
  octx.fillRect(0, 0, sizePx, sizePx);
  return off;
}

// ---- Per-template geometry (390 px design units, scaled by s) ----

interface QrCardGeometryBase {
  height: number;
  subtitleLines: RichWord[][];
  addressLines: string[];
}

interface QrCardGeometryA extends QrCardGeometryBase {
  template: 'a';
  logoY: number;
  titleY: number;
  subtitleY: number;
  cardY: number;
  cardH: number;
  bandH: number;
  qrX: number;
  qrY: number;
  amountY: number;
  labelY: number;
  addressY: number;
  copyX: number;
  copyY: number;
  linkY: number;
  brandY: number;
  brandH: number;
}

interface QrCardGeometryB extends QrCardGeometryBase {
  template: 'b';
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  logoY: number;
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  amountY: number;
  labelY: number;
  addressBoxY: number;
  addressBoxH: number;
  addressY: number;
  sublineY: number | null;
  footerY: number;
  ruleY: number;
  brandY: number;
}

interface QrCardGeometryC extends QrCardGeometryBase {
  template: 'c';
  logoY: number | null;
  titleY: number;
  noteY: number;
  qrX: number;
  qrY: number;
  instructionY: number;
  amountY: number;
  addressY: number;
  copyY: number;
  copyW: number;
  wordmarkY: number;
}

interface QrCardGeometryE extends QrCardGeometryBase {
  template: 'e';
  logoY: number;
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  amountY: number;
  underlineY: number;
  stripY: number;
  stripH: number;
  addressY: number;
  copyX: number;
  copyY: number;
  brandY: number;
}

interface QrCardGeometryF extends QrCardGeometryBase {
  template: 'f';
  logoY: number;
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  amountY: number;
  underlineY: number;
  stripX: number;
  stripW: number;
  stripY: number;
  stripH: number;
  addressY: number;
  copyX: number;
  copyY: number;
  brandY: number;
}

interface QrCardGeometryG extends QrCardGeometryBase {
  template: 'g';
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  logoY: number;
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  tearY: number;
  amountY: number;
  addressY: number;
  copyY: number;
  copyW: number;
  ruleY: number;
  brandY: number;
}

interface QrCardGeometryD extends QrCardGeometryBase {
  template: 'd';
  titleLines: RichWord[][];
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  amountY: number;
  underlineY: number;
  stripY: number;
  stripH: number;
  addressY: number;
  copyX: number;
  copyY: number;
  brandY: number;
}

type QrCardGeometry =
  | QrCardGeometryA
  | QrCardGeometryB
  | QrCardGeometryC
  | QrCardGeometryD
  | QrCardGeometryE
  | QrCardGeometryF
  | QrCardGeometryG;

const DISPLAY_FONT = (px: number, weight: number): string =>
  `${weight} ${px}px "Baloo 2", "Inter", system-ui, sans-serif`;
const BODY_FONT = (px: number, weight = 400): string =>
  `${weight} ${px}px Inter, system-ui, sans-serif`;
const MONO_FONT = (px: number, weight = 400): string =>
  `${weight} ${px}px ui-monospace, monospace`;

/**
 * Measures the card: wraps the subtitle (network name bolded) and
 * the address, and lays out every row. The draw step replays these
 * coordinates — one source of numbers, measured once.
 */
/**
 * The centred-card layout shared by E (Sun) and F (Ink): the same
 * skeleton, a different address width and strip. Returns the shared
 * rows; the caller adds its own strip/copy rows.
 */
function layoutCentredCard(
  template: 'e' | 'f',
  details: QrCardPngDetails,
  ctx: CardContext,
  s: number,
  subtitleLines: RichWord[][],
  addressMaxW: number,
): {
  logoY: number;
  titleY: number;
  subtitleY: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  qrX: number;
  qrY: number;
  amountY: number;
  underlineY: number;
  stripY: number;
  stripH: number;
  addressY: number;
  brandY: number;
  height: number;
  addressLines: string[];
} {
  const px = (v: number): number => Math.round(v * s);
  const qrSpec = QR_CARD_TEMPLATE_QR[template];
  const addressLines = wrapCardText(details.address, px(addressMaxW), (text) => {
    // UX-major Lane 1: the strip address is 14 px (was 13) — Bitget
    // sets its address at 17 px bold; the strip split improves too
    // (42 chars: 35 + 7 instead of 38 + 4).
    ctx.font = MONO_FONT(px(14));
    return ctx.measureText(text).width;
  });
  const logoY = px(32);
  const titleY = px(32 + 96 + 20);
  const subtitleY = px(32 + 96 + 20 + 38 + 8);
  const tileSize = px(qrSpec.size + 48);
  const tileX = Math.round((px(390) - tileSize) / 2);
  const tileY = subtitleY + px(subtitleLines.length * 22 + 24);
  const qrX = tileX + px(24);
  const qrY = tileY + px(24);
  const amountY = tileY + tileSize + px(24);
  const underlineY = amountY + px(30 + 8);
  const stripY = underlineY + px(4 + 24);
  const stripH = px(16 + addressLines.length * 20 + 16);
  const addressY = stripY + px(16);
  const brandY = stripY + stripH + px(24);
  const height = brandY + px(36 + 24);
  return {
    logoY,
    titleY,
    subtitleY,
    tileX,
    tileY,
    tileSize,
    qrX,
    qrY,
    amountY,
    underlineY,
    stripY,
    stripH,
    addressY,
    brandY,
    height,
    addressLines,
  };
}

function layoutQrCard(
  template: QrCardTemplate,
  details: QrCardPngDetails,
  ctx: CardContext,
  s: number,
  hasLogo: boolean,
): QrCardGeometry {
  const px = (v: number): number => Math.round(v * s);
  const subtitlePx =
    template === 'a' || template === 'd' || template === 'e' || template === 'f'
      ? 15
      : 14;
  const subtitleMaxW =
    template === 'a' || template === 'c' || template === 'e' || template === 'f'
      ? 340
      : template === 'd'
        ? 254
        : 320;
  const subtitleLines = wrapRichWords(
    ctx,
    richWords(subtitleSegments(details.subtitle, details.networkName)),
    BODY_FONT(px(subtitlePx)),
    BODY_FONT(px(subtitlePx), 700),
    px(subtitleMaxW),
  );

  if (template === 'a') {
    const qrSpec = QR_CARD_TEMPLATE_QR.a;
    const addressLines = wrapCardText(details.address, px(252), (text) => {
      ctx.font = MONO_FONT(px(17), 700);
      return ctx.measureText(text).width;
    });
    const bandH = px(36 + qrSpec.size + 20 + 28 + 24);
    const footerH = px(20 + 20 + 6 + addressLines.length * 24 + 20);
    const cardH = bandH + footerH;
    const cardY = px(32 + 96 + 20 + 38 + 8 + subtitleLines.length * 22 + 24);
    const height =
      cardY + cardH + px(20 + 22 + 24 + 84);
    return {
      template: 'a',
      height,
      subtitleLines,
      addressLines,
      logoY: px(32),
      titleY: px(32 + 96 + 20),
      subtitleY: px(32 + 96 + 20 + 38 + 8),
      cardY,
      cardH,
      bandH,
      qrX: (px(390) - px(qrSpec.size)) / 2,
      qrY: cardY + px(36),
      amountY: cardY + px(36 + qrSpec.size + 20),
      labelY: cardY + bandH + px(20),
      addressY: cardY + bandH + px(20 + 20 + 6),
      copyX: px(390 - 19 - 20 - 44),
      copyY:
        cardY + bandH + px(20) + Math.round((px(20 + 6 + addressLines.length * 24) - px(44)) / 2),
      linkY: cardY + cardH + px(20),
      brandY: height - px(84),
      brandH: px(84),
    };
  }

  if (template === 'c') {
    const qrSpec = QR_CARD_TEMPLATE_QR.c;
    const addressLines = wrapCardText(details.address, px(320), (text) => {
      ctx.font = MONO_FONT(px(13));
      return ctx.measureText(text).width;
    });
    // UX-major Lane 1: one even 24 px rhythm down the whole card
    // (was 8/32/32/16/16/8/40 — the subtitle crowded the title and
    // the wordmark floated 40 px below Copy, which is why C read as
    // unfinished). Top and bottom pads are 24 px too.
    let y = px(24);
    const logoY = hasLogo ? y : null;
    if (hasLogo) y += px(40 + 24);
    const titleY = y;
    y += px(32 + 24);
    const noteY = y;
    y += px(subtitleLines.length * 20 + 24);
    const qrY = y;
    const qrX = (px(390) - px(qrSpec.size)) / 2;
    y += px(qrSpec.size + 24);
    const instructionY = y;
    y += px(20 + 24);
    const amountY = y;
    y += px(20 + 24);
    const addressY = y;
    y += px(addressLines.length * 18 + 24);
    const copyY = y;
    ctx.font = BODY_FONT(px(13), 600);
    const copyW = ctx.measureText('Copy').width;
    y += px(18 + 24);
    const wordmarkY = y;
    const height = y + px(18 + 24);
    return {
      template: 'c',
      height,
      subtitleLines,
      addressLines,
      logoY,
      titleY,
      noteY,
      qrX,
      qrY,
      instructionY,
      amountY,
      addressY,
      copyY,
      copyW,
      wordmarkY,
    };
  }

  if (template === 'd') {
    const qrSpec = QR_CARD_TEMPLATE_QR.d;
    const addressLines = wrapCardText(details.address, px(298), (text) => {
      ctx.font = MONO_FONT(px(14));
      return ctx.measureText(text).width;
    });
    const titleLines = wrapRichWords(
      ctx,
      [{ text: details.title, bold: false }],
      DISPLAY_FONT(px(34), 800),
      DISPLAY_FONT(px(34), 800),
      px(254),
    );
    const headerH = Math.max(titleLines.length * 42, 72);
    const titleY = px(24);
    const subtitleY = titleY + px(headerH + 12);
    const tileY = subtitleY + px(subtitleLines.length * 22 + 24);
    // UX-major Lane 1: the tile is the code + its 24 px padding each
    // side, exactly as the in-app tile (was a fixed 300 px, so the PNG
    // tile carried 45 px of padding against the in-app 24).
    const tileSize = px(qrSpec.size + 48);
    const tileX = Math.round((px(390) - tileSize) / 2);
    const qrX = tileX + Math.round((tileSize - px(qrSpec.size)) / 2);
    const qrY = tileY + Math.round((tileSize - px(qrSpec.size)) / 2);
    const amountY = tileY + tileSize + px(24);
    const underlineY = amountY + px(30 + 8);
    const stripY = underlineY + px(4 + 24);
    const stripH = px(16 + addressLines.length * 20 + 16);
    const addressY = stripY + px(16);
    const brandY = stripY + stripH + px(24);
    const height = brandY + px(36 + 24);
    return {
      template: 'd',
      height,
      subtitleLines,
      addressLines,
      titleLines,
      titleY,
      subtitleY,
      tileX,
      tileY,
      tileSize,
      qrX,
      qrY,
      amountY,
      underlineY,
      stripY,
      stripH,
      addressY,
      copyX: px(390 - 24 - 20),
      copyY:
        stripY + Math.round((stripH - px(20)) / 2),
      brandY,
    };
  }

  if (template === 'e') {
    const shared = layoutCentredCard('e', details, ctx, s, subtitleLines, 298);
    return {
      template: 'e',
      subtitleLines,
      ...shared,
      copyX: px(390 - 24 - 20),
      copyY: shared.stripY + Math.round((shared.stripH - px(20)) / 2),
    };
  }

  if (template === 'f') {
    const shared = layoutCentredCard('f', details, ctx, s, subtitleLines, 262);
    return {
      template: 'f',
      subtitleLines,
      ...shared,
      stripX: px(24),
      stripW: px(342),
      copyX: px(390 - 24 - 16 - 20),
      copyY: shared.stripY + Math.round((shared.stripH - px(20)) / 2),
    };
  }

  if (template === 'g') {
    const qrSpec = QR_CARD_TEMPLATE_QR.g;
    const addressLines = wrapCardText(details.address, px(320), (text) => {
      // UX-major Lane 1: the stub address is 13 px (was 12).
      ctx.font = MONO_FONT(px(13));
      return ctx.measureText(text).width;
    });
    const cardX = px(15);
    const cardW = px(360);
    const cardY = px(24);
    // UX-major Lane 1: the tile padding is 16 px a side (was 8), so
    // the code breathes like Bitget's — tile = code + 32 + border 4.
    const tileSize = px(qrSpec.size + 32 + 4);
    const logoY = cardY + px(20);
    const titleY = cardY + px(20 + 64 + 20);
    const subtitleY = titleY + px(34 + 8);
    const tileX = cardX + Math.round((cardW - tileSize) / 2);
    const tileY = subtitleY + px(subtitleLines.length * 20 + 20);
    const qrX = tileX + px(16 + 2);
    const qrY = tileY + px(16 + 2);
    const tearY = tileY + tileSize + px(24);
    const amountY = tearY + px(20);
    const addressY = amountY + px(28 + 12);
    const copyY = addressY + px(addressLines.length * 18 + 16);
    ctx.font = BODY_FONT(px(12), 600);
    const copyW = ctx.measureText('Copy').width;
    const ruleY = copyY + px(18 + 12);
    const brandY = ruleY + px(2 + 12);
    const cardH = brandY + px(24 + 20) - cardY;
    const height = cardY + cardH + px(24);
    return {
      template: 'g',
      height,
      subtitleLines,
      addressLines,
      cardX,
      cardY,
      cardW,
      cardH,
      logoY,
      titleY,
      subtitleY,
      tileX,
      tileY,
      tileSize,
      qrX,
      qrY,
      tearY,
      amountY,
      addressY,
      copyY,
      copyW,
      ruleY,
      brandY,
    };
  }

  // Template B (default): Bawa's own paper card, respaced.
  const qrSpec = QR_CARD_TEMPLATE_QR.b;
  const addressLines = wrapCardText(details.address, px(304), (text) => {
    // UX-major Lane 1: the address is 13 px (was 12) — Bitget sets
    // its address at 17 px bold; a 42-char address now wraps to
    // 2 lines here, as it already does in-app and on Bitget.
    ctx.font = MONO_FONT(px(13));
    return ctx.measureText(text).width;
  });
  const cardX = px(15);
  const cardW = px(360);
  const cardY = px(24);
  // UX-major Lane 1: the tile padding is 16 px a side (was 8), so the
  // code breathes like Bitget's — tile = code + 32 + border 4.
  const tileSize = px(qrSpec.size + 32 + 4);
  const addressBoxH = px(addressLines.length * 18 + 20);
  let cardH =
    px(20 + 64 + 20 + 34 + 8 + subtitleLines.length * 20 + 20) +
    tileSize +
    px(4 + 20 + 28 + 20 + 24 + 8) +
    addressBoxH +
    px(20 + 20 + 20 + 2 + 12 + 24 + 20);
  if (details.subline !== undefined) cardH += px(8 + 20);
  const height = cardY + cardH + px(24);
  const tileX = cardX + (cardW - tileSize) / 2;
  const tileY = cardY + px(20 + 64 + 20 + 34 + 8 + subtitleLines.length * 20 + 20);
  const qrX = tileX + px(16 + 2);
  const qrY = tileY + px(16 + 2);
  const amountY = tileY + tileSize + px(4 + 20);
  const labelY = amountY + px(28 + 20);
  const addressBoxY = labelY + px(24 + 8);
  const addressY = addressBoxY + px(10);
  const sublineY =
    details.subline === undefined
      ? null
      : addressBoxY + addressBoxH + px(20 + 8);
  const footerY =
    addressBoxY +
    addressBoxH +
    px(20) +
    (details.subline === undefined ? 0 : px(8 + 20));
  const ruleY = footerY + px(20 + 20);
  const brandY = ruleY + px(2 + 12);
  return {
    template: 'b',
    height,
    subtitleLines,
    addressLines,
    cardX,
    cardY,
    cardW,
    cardH,
    logoY: cardY + px(20),
    titleY: cardY + px(20 + 64 + 20),
    subtitleY: cardY + px(20 + 64 + 20 + 34 + 8),
    tileX,
    tileY,
    tileSize,
    qrX,
    qrY,
    amountY,
    labelY,
    addressBoxY,
    addressBoxH,
    addressY,
    sublineY,
    footerY,
    ruleY,
    brandY,
  };
}

interface QrCardImages {
  qr: QrRenderImage;
  token: QrRenderImage | null;
  chain: QrRenderImage | null;
}

/** The centre mark: the asset's logo where the repo has one, else
 * the network's mark, else no mark at all — never a ticker badge. */
function centreMark(
  ctx: CardContext,
  deps: QrRenderDeps,
  images: QrCardImages,
  template: QrCardTemplate,
  cx: number,
  cy: number,
  s: number,
): void {
  const centre = images.token ?? images.chain;
  if (centre === null) return;
  const px = (v: number): number => Math.round(v * s);
  const logoPx = px(QR_CARD_TEMPLATE_QR[template].logo);
  if (template === 'a') {
    // Coral disc carrying the white silhouette — the design's mark.
    fillCircle(ctx, cx, cy, logoPx / 2, QR_CARD_CORAL);
    const silhouette = buildWhiteSilhouette(
      deps,
      centre,
      Math.max(1, Math.round(logoPx)),
    );
    const markPx = logoPx * 0.64;
    if (silhouette !== null) {
      ctx.drawImage(silhouette, cx - markPx / 2, cy - markPx / 2, markPx, markPx);
    } else {
      ctx.drawImage(centre, cx - markPx / 2, cy - markPx / 2, markPx, markPx);
    }
    return;
  }
  // B, C, D: a white disc over the excavation hole, logo as-is.
  const discPx = logoPx + px(template === 'b' ? 12 : 8);
  fillCircle(ctx, cx, cy, discPx / 2, '#FFFFFF');
  ctx.drawImage(centre, cx - logoPx / 2, cy - logoPx / 2, logoPx, logoPx);
}

/**
 * The centred-card header shared by E and F: white logo disc + chain
 * badge, title, subtitle. Only the colours differ.
 */
function drawCentredHeader(
  ctx: CardContext,
  images: QrCardImages,
  g: {
    logoY: number;
    titleY: number;
    subtitleY: number;
    subtitleLines: RichWord[][];
  },
  details: QrCardPngDetails,
  width: number,
  s: number,
  titleColor: string,
  subtitleColor: string,
  boldColor: string,
): void {
  const px = (v: number): number => Math.round(v * s);
  const logoCx = width / 2;
  const logoCy = g.logoY + px(48);
  fillCircle(ctx, logoCx, logoCy, px(48), '#FFFFFF');
  if (images.token !== null) {
    ctx.drawImage(images.token, logoCx - px(32), logoCy - px(32), px(64), px(64));
  }
  if (images.chain !== null) {
    const badgeCx = logoCx + px(34);
    const badgeCy = logoCy + px(34);
    fillCircle(ctx, badgeCx, badgeCy, px(14), '#FFFFFF');
    ctx.drawImage(images.chain, badgeCx - px(10), badgeCy - px(10), px(20), px(20));
  }
  drawText(ctx, details.title, width / 2, g.titleY, BODY_FONT(px(30), 800), titleColor);
  drawSubtitleBlock(ctx, g.subtitleLines, width / 2, g.subtitleY, px(22), px(15), subtitleColor, boldColor);
}

function drawQrCard(
  ctx: CardContext,
  deps: QrRenderDeps,
  template: QrCardTemplate,
  details: QrCardPngDetails,
  geometry: QrCardGeometry,
  images: QrCardImages,
  width: number,
  s: number,
): void {
  const px = (v: number): number => Math.round(v * s);
  const qrSpec = QR_CARD_TEMPLATE_QR[template];
  const centre = images.token ?? images.chain;

  if (template === 'a') {
    const g = geometry as QrCardGeometryA;
    const page = '#023139';
    const card = '#011F29';
    const footerBand = '#0E2127';
    const muted = '#7A9491';
    ctx.fillStyle = page;
    ctx.fillRect(0, 0, width, g.height);
    // Header: white logo disc + chain badge.
    const logoCx = width / 2;
    const logoCy = g.logoY + px(48);
    fillCircle(ctx, logoCx, logoCy, px(48), '#FFFFFF');
    if (images.token !== null) {
      ctx.drawImage(images.token, logoCx - px(32), logoCy - px(32), px(64), px(64));
    }
    if (images.chain !== null) {
      const badgeCx = logoCx + px(34);
      const badgeCy = logoCy + px(34);
      fillCircle(ctx, badgeCx, badgeCy, px(14), '#FFFFFF');
      ctx.drawImage(images.chain, badgeCx - px(10), badgeCy - px(10), px(20), px(20));
    }
    drawText(ctx, details.title, width / 2, g.titleY, BODY_FONT(px(30), 800), '#FFFFFF');
    drawSubtitleBlock(ctx, g.subtitleLines, width / 2, g.subtitleY, px(22), px(15), muted, '#FFFFFF');
    // The card: QR band over footer band, one rounded shape. The
    // bands are painted inside a clip of the rounded card path, so
    // both bands keep the card's round corners.
    const cardX = px(19);
    const cardW = px(352);
    ctx.save();
    roundRectPath(ctx, cardX, g.cardY, cardW, g.cardH, px(24));
    ctx.clip();
    ctx.fillStyle = card;
    ctx.fillRect(cardX, g.cardY, cardW, g.bandH);
    ctx.fillStyle = footerBand;
    ctx.fillRect(cardX, g.cardY + g.bandH, cardW, g.cardH - g.bandH);
    ctx.restore();
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'a', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    drawText(ctx, details.amountText, width / 2, g.amountY, DISPLAY_FONT(px(20), 700), '#FFFFFF');
    drawText(ctx, 'Receiving address', cardX + px(20), g.labelY, BODY_FONT(px(14)), muted, 'left');
    drawAddressLines(ctx, g.addressLines, cardX + px(20), g.addressY, px(24), MONO_FONT(px(17), 700), '#FFFFFF', 'left');
    fillCircle(ctx, g.copyX + px(22), g.copyY + px(22), px(22), '#1B2023');
    drawCopyGlyph(ctx, g.copyX + px(12), g.copyY + px(12), px(20), '#FFFFFF');
    drawText(ctx, details.shareLinkText ?? QR_CARD_SHARE_LINK_TEXT, width / 2, g.linkY, BODY_FONT(px(15)), muted);
    // Brand bar: near-black, full-bleed, Bawa's own wordmark.
    // UX-major Lane 1: the mark is 48 px and the wordmark 24 px
    // (was 44/22) — Bitget's bar is a statement, not a footnote.
    ctx.fillStyle = '#121818';
    ctx.fillRect(0, g.brandY, width, g.brandH);
    const brandFont = BODY_FONT(px(24), 800);
    ctx.font = brandFont;
    const brandW = ctx.measureText(QR_CARD_BRAND).width;
    const markPx = px(48);
    const groupW = markPx + px(16) + brandW;
    const groupX = (width - groupW) / 2;
    const markY = g.brandY + (g.brandH - markPx) / 2;
    fillRoundRect(ctx, groupX, markY, markPx, markPx, px(12), QR_CARD_CORAL);
    drawText(ctx, 'B', groupX + markPx / 2, markY + markPx / 2 - px(11), DISPLAY_FONT(px(24), 800), '#FFFFFF');
    drawText(ctx, QR_CARD_BRAND, groupX + markPx + px(16), g.brandY + g.brandH / 2 - px(11), brandFont, '#FFFFFF', 'left');
    return;
  }

  if (template === 'c') {
    const g = geometry as QrCardGeometryC;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, g.height);
    if (centre !== null && g.logoY !== null) {
      ctx.drawImage(centre, width / 2 - px(20), g.logoY, px(40), px(40));
    }
    drawText(ctx, details.title, width / 2, g.titleY, BODY_FONT(px(28), 600), '#111111');
    drawSubtitleBlock(ctx, g.subtitleLines, width / 2, g.noteY, px(20), px(14), '#6B7280', '#111111');
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'c', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    drawText(ctx, QR_CARD_SCAN_LINE, width / 2, g.instructionY, BODY_FONT(px(14)), '#6B7280');
    // UX-major Lane 1: the amount is 16 px bold (was 15 semibold)
    // and the address 13 px (was 12) — C's quiet type now has the
    // same weight steps as the other templates.
    drawText(ctx, details.amountText, width / 2, g.amountY, BODY_FONT(px(16), 700), '#111111');
    drawAddressLines(ctx, g.addressLines, width / 2, g.addressY, px(18), MONO_FONT(px(13)), '#6B7280');
    drawText(ctx, 'Copy', width / 2, g.copyY, BODY_FONT(px(13), 600), '#111111');
    ctx.fillStyle = '#111111';
    ctx.fillRect(width / 2 - g.copyW / 2, g.copyY + px(17), g.copyW, px(1));
    // The wordmark is grey, not faint (was #9CA3AF): still quiet,
    // no longer invisible at a glance.
    drawText(ctx, 'Bawa', width / 2, g.wordmarkY, BODY_FONT(px(13), 600), '#6B7280');
    return;
  }

  if (template === 'd') {
    const g = geometry as QrCardGeometryD;
    ctx.fillStyle = QR_CARD_CORAL;
    ctx.fillRect(0, 0, width, g.height);
    // Header row: oversized title left, chain mark in a white disc right.
    const discCx = width - px(24 + 36);
    const discCy = g.titleY + px(36);
    fillCircle(ctx, discCx, discCy, px(36), '#FFFFFF');
    const headerLogo = images.chain ?? images.token;
    if (headerLogo !== null) {
      ctx.drawImage(headerLogo, discCx - px(28), discCy - px(28), px(56), px(56));
    }
    const titleLines = g.titleLines;
    titleLines.forEach((line, index) => {
      drawText(
        ctx,
        line.map((word) => word.text).join(' '),
        px(24),
        g.titleY + index * px(42),
        DISPLAY_FONT(px(34), 800),
        '#FFFFFF',
        'left',
      );
    });
    drawSubtitleBlock(ctx, g.subtitleLines, px(24), g.subtitleY, px(22), px(15), 'rgba(255,255,255,0.85)', '#FFFFFF', 'left');
    // White QR tile.
    fillRoundRect(ctx, g.tileX, g.tileY, g.tileSize, g.tileSize, px(24), '#FFFFFF');
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'd', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    drawText(ctx, details.amountText, px(24), g.amountY, DISPLAY_FONT(px(24), 700), '#FFFFFF', 'left');
    ctx.fillStyle = QR_CARD_SUN;
    ctx.fillRect(px(24), g.underlineY, px(48), px(4));
    // Address strip: full-bleed ink, copy mark at the right.
    ctx.fillStyle = QR_CARD_INK;
    ctx.fillRect(0, g.stripY, width, g.stripH);
    drawAddressLines(ctx, g.addressLines, px(24), g.addressY, px(20), MONO_FONT(px(14)), '#FFFFFF', 'left');
    drawCopyGlyph(ctx, g.copyX, g.copyY, px(20), '#FFFFFF');
    // Brand row, left-aligned.
    fillRoundRect(ctx, px(24), g.brandY, px(36), px(36), px(8), QR_CARD_INK);
    drawText(ctx, 'B', px(24 + 18), g.brandY + px(18) - px(10), DISPLAY_FONT(px(20), 800), '#FFFFFF');
    drawText(ctx, QR_CARD_BRAND, px(24 + 36 + 12), g.brandY + px(18) - px(11), DISPLAY_FONT(px(22), 800), '#FFFFFF', 'left');
    return;
  }

  if (template === 'e') {
    const g = geometry as QrCardGeometryE;
    ctx.fillStyle = QR_CARD_SUN;
    ctx.fillRect(0, 0, width, g.height);
    drawCentredHeader(ctx, images, g, details, width, s, QR_CARD_INK, QR_CARD_INK, QR_CARD_INK);
    // White QR tile: hard offset shadow, ink frame, QR inside. The
    // shadow is a ROUNDED rect with the tile's own 24 px radius —
    // UX-major Lane 1: the old square shadow rect poked past the
    // tile's rounded top-right corner as a small black tab.
    fillRoundRect(ctx, g.tileX + px(4), g.tileY + px(4), g.tileSize, g.tileSize, px(24), QR_CARD_INK);
    fillRoundRect(ctx, g.tileX, g.tileY, g.tileSize, g.tileSize, px(24), '#FFFFFF');
    strokeRoundRect(ctx, g.tileX, g.tileY, g.tileSize, g.tileSize, px(24), QR_CARD_INK, px(2));
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'e', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    drawText(ctx, details.amountText, width / 2, g.amountY, DISPLAY_FONT(px(22), 700), QR_CARD_INK);
    ctx.fillStyle = QR_CARD_CORAL;
    ctx.fillRect(width / 2 - px(24), g.underlineY, px(48), px(4));
    // Address strip: full-bleed ink, copy mark at the right.
    ctx.fillStyle = QR_CARD_INK;
    ctx.fillRect(0, g.stripY, width, g.stripH);
    drawAddressLines(ctx, g.addressLines, px(24), g.addressY, px(20), MONO_FONT(px(14)), '#FFFFFF', 'left');
    drawCopyGlyph(ctx, g.copyX, g.copyY, px(20), '#FFFFFF');
    // Brand row, left-aligned.
    fillRoundRect(ctx, px(24), g.brandY, px(36), px(36), px(8), QR_CARD_INK);
    drawText(ctx, 'B', px(24 + 18), g.brandY + px(18) - px(10), DISPLAY_FONT(px(20), 800), '#FFFFFF');
    drawText(ctx, QR_CARD_BRAND, px(24 + 36 + 12), g.brandY + px(18) - px(11), DISPLAY_FONT(px(22), 800), QR_CARD_INK, 'left');
    return;
  }

  if (template === 'f') {
    const g = geometry as QrCardGeometryF;
    ctx.fillStyle = QR_CARD_INK;
    ctx.fillRect(0, 0, width, g.height);
    drawCentredHeader(ctx, images, g, details, width, s, '#FFFFFF', '#9CA3AF', '#FFFFFF');
    // White QR tile — no border: white on ink is the edge.
    fillRoundRect(ctx, g.tileX, g.tileY, g.tileSize, g.tileSize, px(24), '#FFFFFF');
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'f', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    drawText(ctx, details.amountText, width / 2, g.amountY, DISPLAY_FONT(px(22), 700), '#FFFFFF');
    ctx.fillStyle = QR_CARD_SUN;
    ctx.fillRect(width / 2 - px(24), g.underlineY, px(48), px(4));
    // Address strip: paper, rounded, copy mark at the right.
    fillRoundRect(ctx, g.stripX, g.stripY, g.stripW, g.stripH, px(12), QR_PAPER_COLOR);
    drawAddressLines(ctx, g.addressLines, g.stripX + px(16), g.addressY, px(20), MONO_FONT(px(14)), QR_CARD_INK, 'left');
    drawCopyGlyph(ctx, g.copyX, g.copyY, px(20), QR_CARD_INK);
    // Brand row: sun mark with an ink B, white wordmark.
    fillRoundRect(ctx, px(24), g.brandY, px(36), px(36), px(8), QR_CARD_SUN);
    drawText(ctx, 'B', px(24 + 18), g.brandY + px(18) - px(10), DISPLAY_FONT(px(20), 800), QR_CARD_INK);
    drawText(ctx, QR_CARD_BRAND, px(24 + 36 + 12), g.brandY + px(18) - px(11), DISPLAY_FONT(px(22), 800), '#FFFFFF', 'left');
    return;
  }

  if (template === 'g') {
    const g = geometry as QrCardGeometryG;
    ctx.fillStyle = QR_PAPER_COLOR;
    ctx.fillRect(0, 0, width, g.height);
    // Faint dot grid — the paper the card sits on, not a flat fill (as B).
    ctx.fillStyle = 'rgba(43,43,43,0.05)';
    const dotStep = px(24);
    for (let x = dotStep; x < width; x += dotStep) {
      for (let y = dotStep; y < g.height; y += dotStep) {
        ctx.fillRect(x, y, px(2), px(2));
      }
    }
    // The card: paper, ink border, hand-drawn radius approximated.
    ctx.fillStyle = QR_PAPER_COLOR;
    roundRectPath(ctx, g.cardX, g.cardY, g.cardW, g.cardH, px(15));
    ctx.fill();
    // The sun zone: clipped to the card path so its square top corners
    // never poke past the card's rounded corners (as A's bands).
    ctx.save();
    roundRectPath(ctx, g.cardX, g.cardY, g.cardW, g.cardH, px(15));
    ctx.clip();
    ctx.fillStyle = QR_CARD_SUN;
    ctx.fillRect(g.cardX, g.tearY, g.cardW, g.cardY + g.cardH - g.tearY);
    ctx.restore();
    strokeRoundRect(ctx, g.cardX, g.cardY, g.cardW, g.cardH, px(15), QR_CARD_INK, px(2));
    // Header: logo circle + chain badge.
    const logoCx = width / 2;
    const logoCy = g.logoY + px(32);
    fillCircle(ctx, logoCx, logoCy, px(32), QR_PAPER_COLOR);
    strokeCircle(ctx, logoCx, logoCy, px(32), QR_CARD_INK, px(2));
    if (images.token !== null) {
      ctx.drawImage(images.token, logoCx - px(26), logoCy - px(26), px(52), px(52));
    }
    if (images.chain !== null) {
      const badgeCx = logoCx + px(23);
      const badgeCy = logoCy + px(23);
      fillCircle(ctx, badgeCx, badgeCy, px(12), QR_PAPER_COLOR);
      ctx.drawImage(images.chain, badgeCx - px(10), badgeCy - px(10), px(20), px(20));
    }
    drawText(ctx, details.title, width / 2, g.titleY, DISPLAY_FONT(px(28), 700), QR_CARD_INK);
    drawSubtitleBlock(ctx, g.subtitleLines, width / 2, g.subtitleY, px(20), px(14), QR_CARD_INK, QR_CARD_INK);
    // The tile: hard offset shadow, ink frame, QR inside (as B).
    ctx.fillStyle = QR_CARD_INK;
    ctx.fillRect(g.tileX + px(4), g.tileY + px(4), g.tileSize, g.tileSize);
    ctx.fillStyle = QR_PAPER_COLOR;
    ctx.fillRect(g.tileX, g.tileY, g.tileSize, g.tileSize);
    ctx.fillStyle = QR_CARD_INK;
    const border = px(2);
    ctx.fillRect(g.tileX, g.tileY, g.tileSize, border);
    ctx.fillRect(g.tileX, g.tileY + g.tileSize - border, g.tileSize, border);
    ctx.fillRect(g.tileX, g.tileY, border, g.tileSize);
    ctx.fillRect(g.tileX + g.tileSize - border, g.tileY, border, g.tileSize);
    ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
    centreMark(ctx, deps, images, 'g', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
    // Tear line: dashed ink rule with punched notches on the card edges.
    // Dashes are drawn rects (the card context has no setLineDash).
    ctx.fillStyle = QR_CARD_INK;
    for (let x = g.cardX + px(12); x < g.cardX + g.cardW - px(12); x += px(14)) {
      ctx.fillRect(x, g.tearY, px(8), px(2));
    }
    fillCircle(ctx, g.cardX, g.tearY + px(1), px(8), QR_PAPER_COLOR);
    strokeCircle(ctx, g.cardX, g.tearY + px(1), px(8), QR_CARD_INK, px(2));
    fillCircle(ctx, g.cardX + g.cardW, g.tearY + px(1), px(8), QR_PAPER_COLOR);
    strokeCircle(ctx, g.cardX + g.cardW, g.tearY + px(1), px(8), QR_CARD_INK, px(2));
    drawText(ctx, details.amountText, width / 2, g.amountY, DISPLAY_FONT(px(22), 700), QR_CARD_INK);
    drawAddressLines(ctx, g.addressLines, width / 2, g.addressY, px(18), MONO_FONT(px(13)), QR_CARD_INK);
    // Copy pill: ink outline, centred.
    const pillW = g.copyW + px(24);
    const pillH = px(24);
    const pillX = width / 2 - pillW / 2;
    strokeRoundRect(ctx, pillX, g.copyY - px(4), pillW, pillH, px(6), QR_CARD_INK, px(2));
    drawText(ctx, 'Copy', width / 2, g.copyY - px(4) + pillH / 2 - px(6), BODY_FONT(px(12), 600), QR_CARD_INK);
    // Brand strip: ink rule, coral B mark, wordmark.
    // UX-major Lane 1: the mark is 28 px and the wordmark 18 px
    // (was 24/16) — the strip reads as a footer, not a footnote.
    ctx.fillStyle = QR_CARD_INK;
    ctx.fillRect(g.cardX + px(20), g.ruleY, g.cardW - px(40), px(2));
    const brandFont = DISPLAY_FONT(px(18), 700);
    ctx.font = brandFont;
    const brandW = ctx.measureText(QR_CARD_BRAND).width;
    const markPx = px(28);
    const groupW = markPx + px(8) + brandW;
    const groupX = (width - groupW) / 2;
    fillRoundRect(ctx, groupX, g.brandY, markPx, markPx, px(6), QR_CARD_CORAL);
    drawText(ctx, 'B', groupX + markPx / 2, g.brandY + markPx / 2 - px(8), DISPLAY_FONT(px(18), 700), '#FFFFFF');
    drawText(ctx, QR_CARD_BRAND, groupX + markPx + px(8), g.brandY + markPx / 2 - px(8), brandFont, QR_CARD_INK, 'left');
    return;
  }

  // Template B (default).
  const g = geometry as QrCardGeometryB;
  ctx.fillStyle = QR_PAPER_COLOR;
  ctx.fillRect(0, 0, width, g.height);
  // Faint dot grid — the paper the card sits on, not a flat fill.
  ctx.fillStyle = 'rgba(43,43,43,0.05)';
  const dotStep = px(24);
  for (let x = dotStep; x < width; x += dotStep) {
    for (let y = dotStep; y < g.height; y += dotStep) {
      ctx.fillRect(x, y, px(2), px(2));
    }
  }
  // The card: paper, ink border, hand-drawn radius approximated.
  ctx.fillStyle = QR_PAPER_COLOR;
  roundRectPath(ctx, g.cardX, g.cardY, g.cardW, g.cardH, px(15));
  ctx.fill();
  strokeRoundRect(ctx, g.cardX, g.cardY, g.cardW, g.cardH, px(15), QR_CARD_INK, px(2));
  // Header: logo circle + chain badge.
  const logoCx = width / 2;
  const logoCy = g.logoY + px(32);
  fillCircle(ctx, logoCx, logoCy, px(32), QR_PAPER_COLOR);
  strokeCircle(ctx, logoCx, logoCy, px(32), QR_CARD_INK, px(2));
  if (images.token !== null) {
    ctx.drawImage(images.token, logoCx - px(26), logoCy - px(26), px(52), px(52));
  }
  if (images.chain !== null) {
    const badgeCx = logoCx + px(23);
    const badgeCy = logoCy + px(23);
    fillCircle(ctx, badgeCx, badgeCy, px(12), QR_PAPER_COLOR);
    ctx.drawImage(images.chain, badgeCx - px(10), badgeCy - px(10), px(20), px(20));
  }
  drawText(ctx, details.title, width / 2, g.titleY, DISPLAY_FONT(px(28), 700), QR_CARD_INK);
  drawSubtitleBlock(ctx, g.subtitleLines, width / 2, g.subtitleY, px(20), px(14), QR_CARD_INK, QR_CARD_INK);
  // The tile: hard offset shadow, ink frame, QR inside.
  ctx.fillStyle = QR_CARD_INK;
  ctx.fillRect(g.tileX + px(4), g.tileY + px(4), g.tileSize, g.tileSize);
  ctx.fillStyle = QR_PAPER_COLOR;
  ctx.fillRect(g.tileX, g.tileY, g.tileSize, g.tileSize);
  ctx.fillStyle = QR_CARD_INK;
  const border = px(2);
  ctx.fillRect(g.tileX, g.tileY, g.tileSize, border);
  ctx.fillRect(g.tileX, g.tileY + g.tileSize - border, g.tileSize, border);
  ctx.fillRect(g.tileX, g.tileY, border, g.tileSize);
  ctx.fillRect(g.tileX + g.tileSize - border, g.tileY, border, g.tileSize);
  ctx.drawImage(images.qr, g.qrX, g.qrY, px(qrSpec.size), px(qrSpec.size));
  centreMark(ctx, deps, images, 'b', g.qrX + px(qrSpec.size) / 2, g.qrY + px(qrSpec.size) / 2, s);
  drawText(ctx, details.amountText, width / 2, g.amountY, DISPLAY_FONT(px(22), 700), QR_CARD_INK);
  // Address label row: label left, Copy pill right.
  drawText(ctx, 'Receiving address', g.cardX + px(20), g.labelY, BODY_FONT(px(14)), QR_CARD_INK, 'left');
  ctx.font = BODY_FONT(px(12), 600);
  const copyW = ctx.measureText('Copy').width;
  const pillW = copyW + px(24);
  const pillH = px(24);
  const pillX = g.cardX + g.cardW - px(20) - pillW;
  strokeRoundRect(ctx, pillX, g.labelY - px(4), pillW, pillH, px(6), QR_CARD_INK, px(2));
  drawText(ctx, 'Copy', pillX + pillW / 2, g.labelY - px(4) + pillH / 2 - px(6), BODY_FONT(px(12), 600), QR_CARD_INK);
  // Address box: bordered, full address, never truncated.
  strokeRoundRect(
    ctx,
    g.cardX + px(20),
    g.addressBoxY,
    g.cardW - px(40),
    g.addressBoxH,
    px(6),
    QR_CARD_INK,
    px(2),
  );
  drawAddressLines(ctx, g.addressLines, width / 2, g.addressY, px(18), MONO_FONT(px(13)), QR_CARD_INK);
  if (details.subline !== undefined && g.sublineY !== null) {
    drawText(ctx, details.subline, width / 2, g.sublineY, BODY_FONT(px(14)), QR_CARD_INK);
  }
  drawText(ctx, QR_CARD_FOOTER, width / 2, g.footerY, BODY_FONT(px(14)), QR_CARD_INK);
  // Brand strip: ink rule, coral B mark, wordmark.
  // UX-major Lane 1: the mark is 28 px and the wordmark 18 px
  // (was 24/16) — the strip reads as a footer, not a footnote.
  ctx.fillStyle = QR_CARD_INK;
  ctx.fillRect(g.cardX + px(20), g.ruleY, g.cardW - px(40), px(2));
  const brandFont = DISPLAY_FONT(px(18), 700);
  ctx.font = brandFont;
  const brandW = ctx.measureText(QR_CARD_BRAND).width;
  const markPx = px(28);
  const groupW = markPx + px(8) + brandW;
  const groupX = (width - groupW) / 2;
  fillRoundRect(ctx, groupX, g.brandY, markPx, markPx, px(6), QR_CARD_CORAL);
  drawText(ctx, 'B', groupX + markPx / 2, g.brandY + markPx / 2 - px(8), DISPLAY_FONT(px(18), 700), '#FFFFFF');
  drawText(ctx, QR_CARD_BRAND, groupX + markPx + px(8), g.brandY + markPx / 2 - px(8), brandFont, QR_CARD_INK, 'left');
}

/**
 * Greedy character wrap: addresses have no spaces to break on, so
 * the break falls wherever the line fills. Pure, so tests can check
 * it without a canvas.
 */
export function wrapCardText(
  text: string,
  maxWidth: number,
  measureWidth: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (line === '' || measureWidth(line + ch) <= maxWidth) {
      line += ch;
    } else {
      lines.push(line);
      line = ch;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export async function qrCardToPngBlob(
  svgMarkup: string,
  details: QrCardPngDetails,
  deps: QrRenderDeps = browserQrRenderDeps,
): Promise<Blob> {
  if (
    typeof svgMarkup !== 'string' ||
    svgMarkup.trim() === '' ||
    !svgMarkup.includes('<svg')
  ) {
    throw new Error('Cannot share the QR code: no QR image was rendered.');
  }
  if (
    details.address.trim() === '' ||
    details.tokenLabel.trim() === '' ||
    details.title.trim() === '' ||
    details.subtitle.trim() === ''
  ) {
    throw new Error('Cannot share the QR card: the payment details are missing.');
  }
  const template = details.template ?? DEFAULT_QR_CARD_TEMPLATE;
  const width = details.width ?? QR_CARD_WIDTH;
  if (!Number.isSafeInteger(width) || width < 320 || width > 4096) {
    throw new Error('Cannot share the QR card: invalid image size.');
  }
  const canvas = deps.createCanvas();
  const measureCtx = requireCardContext(canvas.getContext('2d'));
  if (measureCtx === null) {
    throw new Error('The QR card cannot be drawn on this device.');
  }
  // The QR must load — a card without it is useless. Logos are
  // decorative and may fail (3 s each); the card draws without them.
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const qrImage = await loadQrImage(svgUrl, deps, 10_000);
  const tokenLogo =
    details.tokenLogoSrc === undefined
      ? null
      : await loadCardImageOrNull(details.tokenLogoSrc, deps, 3_000);
  const chainLogo =
    details.chainLogoSrc === undefined
      ? null
      : await loadCardImageOrNull(details.chainLogoSrc, deps, 3_000);

  // Measure first: the canvas height depends on the wrapped subtitle
  // and address. The layout is the single source of row positions —
  // the draw step replays it, never re-derives it.
  const s = width / QR_CARD_DESIGN_WIDTH;
  const geometry = layoutQrCard(
    template,
    details,
    measureCtx,
    s,
    (tokenLogo ?? chainLogo) !== null,
  );

  canvas.width = width;
  canvas.height = Math.round(geometry.height);
  const ctx = requireCardContext(canvas.getContext('2d'));
  if (ctx === null) {
    throw new Error('The QR card cannot be drawn on this device.');
  }
  drawQrCard(ctx, deps, template, details, geometry, { qr: qrImage, token: tokenLogo, chain: chainLogo }, width, s);

  return canvasToPngBlob(canvas);
}

/** Renders the QR card to a PNG File ready for navigator.share. */
export async function qrCardToPngFile(
  svgMarkup: string,
  details: QrCardPngDetails,
  fileName: string,
  deps: QrRenderDeps = browserQrRenderDeps,
): Promise<File> {
  const blob = await qrCardToPngBlob(svgMarkup, details, deps);
  return new File([blob], fileName, { type: 'image/png' });
}
