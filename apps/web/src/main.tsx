import './ui/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'

// No idle warm-up of the wallet engine (Lane J, perf, attempt 2).
// There used to be one: start the 10.4 MB engine once the browser is
// idle, so Generate in create-wallet pays compile only, not the
// download (measured 52.4 s on Slow 4G). It was removed because the
// cost landed on EVERY cold load: the gated version still fetched the
// 10.4 MB WASM on every cold load in measurement (CDP network
// emulation does not change navigator.connection, so the connection
// gate never fired there) and Slow 4G settle went from 55.1 s to
// 69.0 s (medians) — the later start finished later. The engine now
// loads only on demand, through loadCore(): its promise is cached, so
// the create-screen mount preload and Generate share ONE download.
// Generate keeps its honest "Loading wallet engine..." state for the
// on-demand download. Do not re-add an idle warm-up without a cold-load
// measurement proving the settle cost is gone. No keys are involved
// either way: the engine download never carries a vault or a mnemonic.

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
