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
// - TON: ton://transfer/<address>?amount=<nanotons>
//   (https://ton-blockchain.github.io/docs/develop/dapps/telegram-apps/app-deeplinks;
//   1 TON = 10^9 nanotons)
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
  /** ERC-20 contract when this pays a token rather than the native coin. */
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
  if (chain === 'sol') {
    if (amount !== undefined && !validAmount(amount, 9)) {
      return { ok: false, reason: `Invalid amount for sol: ${amount}` };
    }
    const query = amount === undefined ? '' : `?amount=${amount}`;
    return { ok: true, uri: `solana:${address}${query}` };
  }

  // TON: amount in nanotons (1 TON = 10^9 nanotons).
  if (chain === 'ton') {
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
  if (trimmed.toLowerCase().startsWith('ton://transfer/')) {
    const rest = trimmed.slice('ton://transfer/'.length);
    const [address, queryString] = rest.split('?');
    if (!address) return fail('Missing TON address.');
    const params = new URLSearchParams(queryString ?? '');
    const nanotons = params.get('amount');
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
  if (scheme === 'solana') {
    const [address, queryString] = rest.split('?');
    if (!address) return fail('Missing Solana address.');
    const params = new URLSearchParams(queryString ?? '');
    if (params.get('spl-token') !== null) {
      return fail('SPL token payments are not supported.');
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
 * parses it on mount (see send.tsx).
 */
export function buildBawaSendLink(origin: string, params: BawaSendLinkParams): string {
  const query = new URLSearchParams();
  query.set('chain', params.chain);
  query.set('to', params.to);
  if (params.amount !== undefined) query.set('amount', params.amount);
  if (params.token !== undefined) query.set('token', params.token);
  return `${origin.replace(/\/$/, '')}/send?${query.toString()}`;
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
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(
    image: QrRenderImage,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
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
  const image = deps.createImage();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The QR code image could not be loaded.')),
      10_000,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('The QR code image could not be loaded.'));
    };
    image.src = svgUrl;
  });
  ctx.fillStyle = QR_PAPER_COLOR;
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.drawImage(image, 0, 0, pixels, pixels);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
  if (blob === null) {
    throw new Error('The QR code could not be rendered on this device.');
  }
  return blob;
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
