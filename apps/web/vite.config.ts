import { fileURLToPath } from 'node:url'
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
// GitHub Pages (panel-rebuild/pages-base): the <base> tag must match the
// build base, or relative URLs (e.g. wallet-core.wasm) resolve to the
// domain root instead of /bawa/. Captured from the resolved config.
let resolvedBase = '/'

export default defineConfig({
  // GitHub Pages (panel-rebuild/pages-base): served under /bawa/ —
  // Vite rewrites asset URLs to this prefix (the plugin below rewrites <base>).
  base: '/bawa/',
  resolve: {
    // Lane C (bundle-size gate): 'long' shipped twice — long/index.js
    // (send.ts) and long/umd/index.js (protobufjs via wallet-core).
    // One copy: every importer gets the package's main entry.
    alias: [
      {
        find: /^long$/,
        // The ESM source; the UMD build is generated from it, so the
        // two copies were the same library twice.
        replacement: fileURLToPath(
          new URL('./node_modules/long/index.js', import.meta.url),
        ),
      },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'bawa-csp-meta',
      configResolved(config) {
        resolvedBase = config.base
      },
      transformIndexHtml(html, ctx) {
        if (ctx.server) return html
        const meta =
          `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`
        return html
          .replace('<base href="/" />', `<base href="${resolvedBase}" />`)
          .replace('</head>', `${meta}\n  </head>`)
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
