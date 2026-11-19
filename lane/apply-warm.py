"""Lane A perf: hands-on edit — warmCore() in boundary.ts + idle warm in main.tsx.

Applies exact-string replacements with assertions. Run on muse-vm from the
fix-perf-a worktree root: python3 lane/apply-warm.py
"""
import sys

BOUNDARY = 'apps/web/src/engine/boundary.ts'
MAIN = 'apps/web/src/main.tsx'

warm_fn = """
let wasmWarmPromise: Promise<void> | undefined;

// Prime the HTTP cache for wallet-core.wasm after first paint, so the
// create-wallet Generate step pays WASM compile only, not the 10.4 MB
// download (measured 52.4 s of a 53.1 s Generate step on Slow 4G).
// Fire-and-forget: failures are swallowed and loadCore() still fetches on
// demand. The URL resolves against document.baseURI, matching initWasm.
export function warmCore(): void {
  if (wasmWarmPromise !== undefined) return;
  if (typeof fetch !== 'function') return;
  wasmWarmPromise = (async () => {
    try {
      const url = new URL('wallet-core.wasm', globalThis.document.baseURI);
      const response = await fetch(url, { cache: 'default' });
      await response.arrayBuffer();
    } catch {
      // Offline or unreachable: loadCore() fetches on demand instead.
    }
  })();
}
"""

anchor = "const SECP256K1_P = (1n << 256n) - (1n << 32n) - 977n;"

with open(BOUNDARY, encoding='utf-8') as f:
    src = f.read()
assert src.count(anchor) == 1, 'boundary anchor count != 1'
assert 'warmCore' not in src, 'warmCore already present'
src = src.replace(anchor, warm_fn.strip('\n') + '\n\n' + anchor, 1)
with open(BOUNDARY, 'w', encoding='utf-8') as f:
    f.write(src)
print('boundary.ts: warmCore added')

main_new = """import './ui/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { registerAllAdapters } from './wallet/adapters'
import { warmCore } from './engine/boundary'

// Phase 2 adapters (BTC/ETH/TRX/TON) are registered once, before render,
// so the wallet context can serve real balances and history.
registerAllAdapters();

// Fetch the 10.4 MB wallet engine in the background once the browser is
// idle, so Generate in create-wallet pays compile only, not the download
// (measured 52.4 s on Slow 4G). Never blocks first paint.
if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(() => warmCore(), { timeout: 2000 });
} else {
  setTimeout(() => warmCore(), 1000);
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
"""

with open(MAIN, encoding='utf-8') as f:
    old = f.read()
assert 'warmCore' not in old, 'main.tsx already has warmCore'
with open(MAIN, 'w', encoding='utf-8') as f:
    f.write(main_new)
print('main.tsx: idle warm added')
print('OK')
