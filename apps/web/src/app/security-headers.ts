// Shared security-header policy for the Bawa Web starter (T47).
//
// One source of truth, used by:
// - vite.config.ts: `preview.headers` (served with `vite preview`) and the
//   build-only CSP <meta> injected into dist/index.html.
// - src/app/security-headers.test.ts: regression tests on the policy text.
//
// The policy is strict on purpose: the app loads no third-party script,
// style, font, image or worker resource. Everything except the pinned
// read-only provider fetches below is same-origin.
// Notes per directive:
// - script-src 'self' 'wasm-unsafe-eval': 'wasm-unsafe-eval' is REQUIRED for
//   WebAssembly.compile/instantiateStreaming (wallet-core WASM) once any CSP
//   is present; it does NOT re-enable eval(). No 'unsafe-inline': the built
//   output has no inline scripts, and inline script injection is the attack
//   this policy exists to stop (an injected script could substitute the
//   displayed receive address and exfiltrate xpubs from localStorage).
// - style-src 'self' 'unsafe-inline': Tailwind v4 + Radix/sonner use inline
//   style attributes; 'unsafe-inline' in style-src does not execute script.
// - img-src 'self' data:: QR codes are inline SVG (no raster fetch); data:
//   is kept for favicon-style assets. font-src 'self' data:: @fontsource
//   woff2 is self-hosted; data: covers inlined font subsets if any.
// - connect-src 'self' plus the six pinned provider origins: the
//   same-origin wallet-core.wasm fetch plus the read-only balance/history
//   adapter endpoints — BTC https://mempool.space, ETH
//   https://ethereum-rpc.publicnode.com (RPC) and https://eth.blockscout.com
//   (history), TRX https://api.trongrid.io, TON https://toncenter.com. Price feed: CoinGecko https://api.coingecko.com (keyless public API, on-demand quotes only; the optional free Demo key is sent as a header, never as a URL).
//   No other origin, no wildcard. Explorer links (tronscan.org,
//   tonviewer.com) are plain links, not fetches, so they need no entry.
// - object-src 'none', base-uri 'self': no plugins, no <base> hijack.
// - frame-ancestors 'none' is in the shared string: it is ignored when the
//   policy is delivered via a <meta> tag, but enforced as an HTTP header
//   (preview.headers and production hosting) — see README.md. X-Frame-Options
//   is header-only and covers older browsers.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://mempool.space https://ethereum-rpc.publicnode.com https://eth.blockscout.com https://api.trongrid.io https://toncenter.com https://api.coingecko.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // frame-ancestors is ignored when this policy is delivered via a <meta>
  // tag, but it is enforced when delivered as an HTTP header (preview.headers
  // and production hosting). Keeping it in the single shared string means
  // the header path is protected and the meta path is unaffected.
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};
