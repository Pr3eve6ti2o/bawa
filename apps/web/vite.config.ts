import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from './src/app/security-headers'

// Security headers (T47). The CSP is enforced two ways for the built app:
// 1. `preview.headers` below — HTTP headers on `vite preview` responses.
// 2. A <meta> CSP injected into dist/index.html at BUILD time only (see the
//    transformIndexHtml plugin). It is NOT in source index.html and NOT
//    injected in dev: Vite dev injects an inline react-refresh preamble that
//    a script-src 'self' policy would block, breaking `npm run dev` / HMR.
//    Production hosts serving dist/ statically must send the same headers
//    (see README.md "Security notes" — the meta tag alone cannot set
//    frame-ancestors, which only the HTTP header enforces).
// Dev server headers are deliberately minimal (no CSP): localhost dev is not
// a deployment target, and a dev CSP would break HMR without protecting users.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'bawa-csp-meta',
      transformIndexHtml(html, ctx) {
        if (ctx.server) return html
        const meta =
          `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`
        return html.replace('</head>', `${meta}\n  </head>`)
      },
    },
  ],
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  },
  build: {
    // Lane F (2026-11-20): never inline images as base64 data URIs. The
    // 10 chain/token logos are WebP, 1.2–3.5 KB each — under Vite's 4 KB
    // default, so they were inlined into the first-paint JS chunk
    // (+32.5 KB, including 6 ERC-20 logos no screen displays yet).
    // As separate files they are fetched on demand, only when an asset
    // row renders them; the first-paint chunk stays logo-free.
    assetsInlineLimit: 0,
  },
  preview: {
    headers: SECURITY_HEADERS,
  },
})
