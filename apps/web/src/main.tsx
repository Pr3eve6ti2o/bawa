import './ui/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { registerAllAdapters } from './wallet/adapters'

// Phase 2 adapters (BTC/ETH/TRX/TON) are registered once, before render,
// so the wallet context can serve real balances and history.
registerAllAdapters();

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
