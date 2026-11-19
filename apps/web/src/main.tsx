import './ui/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'

// Start the 10.4 MB wallet engine in the background once the browser is
// idle, so Generate in create-wallet pays compile only, not the download
// (measured 52.4 s on Slow 4G). This MUST go through loadCore(): its
// promise is cached, so the idle warm-up, the create-screen mount preload
// and Generate share ONE download. A separate warm-up fetch races
// loadCore's fetch on the same URL and doubles the Slow 4G download
// (measured 84.8 s WASM / 104.7 s Generate after the first warm-up landed).
// The engine module is dynamic-imported so it never joins the first-paint
// chunk; this never blocks first paint. Failures are swallowed: Generate
// still loads the engine on demand.
function scheduleWarmCore(): void {
  const warm = () => {
    void import('./engine/boundary').then((m) => m.loadCore()).catch(() => {});
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
