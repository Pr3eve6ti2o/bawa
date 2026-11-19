"""Lane A perf: main.tsx must NOT statically import the engine.

The static `import { warmCore } from './engine/boundary'` pulled the
~2.9 MB wallet-core glue back into the first-paint chunk (Vite warning
INEFFECTIVE_DYNAMIC_IMPORT). Warm the engine with a dynamic import
instead: it loads after first paint, on idle, and never blocks it.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-warm2.py
"""
MAIN = 'apps/web/src/main.tsx'

main_new = """import './ui/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'

// Fetch the 10.4 MB wallet engine in the background once the browser is
// idle, so Generate in create-wallet pays compile only, not the download
// (measured 52.4 s on Slow 4G). The engine module is dynamic-imported so
// it never joins the first-paint chunk; this never blocks first paint.
function scheduleWarmCore(): void {
  const warm = () => {
    void import('./engine/boundary').then((m) => m.warmCore());
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 2000 });
  } else {
    setTimeout(warm, 1000);
  }
}

scheduleWarmCore();

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
assert 'warmCore' in old, 'main.tsx has no warmCore to fix'
assert "from './engine/boundary'" in old, 'expected static boundary import'
with open(MAIN, 'w', encoding='utf-8') as f:
    f.write(main_new)
print('main.tsx: warmCore now dynamic-imported on idle')
print('OK')
