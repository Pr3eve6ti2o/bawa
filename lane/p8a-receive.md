# P8a — Receive screen rewrite (Bawa wallet rebuild, Fix Lane 2, Phase 3)

No filesystem/shell access: return COMPLETE file contents in your reply, one fenced tsx block per file, path as heading. Output code, not descriptions.

Context: apps/web; wallet-context exposes vaultAddresses (vault-derived, account 0), addresses (watch-only derived), selectedChain/setSelectedChain, vaultState; chains.ts availableFor('receive'); qrcode.react 4.2.0 (QRCodeSVG) installed; screens use `// @vitest-environment jsdom`, createRoot + act, vi.mock('../state/wallet-context') (see create-wallet.test.tsx).

Rewrite apps/web/src/screens/receive.tsx fully:
- Chain selector over availableFor('receive') chains only.
- Receiving address = vaultAddresses[selectedChain][0] first; if none, fall back to watch-only addresses[selectedChain][0] WITH a watch-only alert: 'Watch-only account — this address can receive, but this wallet cannot sign or send from it.' If neither exists → 'No receiving address — create or import a wallet.' + links.
- QR (white card, QRCodeSVG, 192px) + full address + Copy button + Share button (navigator.share, clipboard fallback). Copy/share status text.
- Amount option: optional native-amount input; QR payload = payment URI when an amount is set (BTC `bitcoin:<addr>?amount=<decimal>`, ETH `ethereum:<addr>?value=<wei decimal>`), else the plain address; TRX/TON always plain address with the amount shown as text under the QR.
- Network warning: 'Send only on the selected network — the sender must use <network name>.'
- Keep the note: 'Verify the address against the repo-tool derivation before accepting funds.'

Tests: receive.test.tsx (mocked useWallet): vault address shown with QR; watch-only fallback shows the alert; no address shows the create/import message; amount set on BTC changes the QR payload to a bitcoin: URI; Copy writes the address to the clipboard (mock navigator.clipboard.writeText).

Rules: TypeScript strict, no `any`, no new deps, no console.log, no secrets, mainnet only.
