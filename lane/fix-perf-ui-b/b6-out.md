## B6 — Lock / unlock and Security settings

### Primary patterns
- **Unlock:** MetaMask, `MetaMask/metamask-extension`, `ui/pages/unlock-page/unlock-page.component.tsx`: branded password entry, restoration and post-unlock redirect. Borrow the dedicated-screen presentation; `/lock` remains **a route, not an app-wide gate**.
- **Settings:** Phantom Help Center article **28951350406803**, “Turn on auto-lock”: timer settings and bottom manual-lock action. Rabby, `RabbyHub/Rabby`, `src/background/service/autoLock.ts` and `src/background/service/preference.ts`: minutes preference, activity reset and persisted deadline.

Patterns only; use our own implementation, wording and Bawa assets.

### Layout — top to bottom
**`apps/web/src/screens/lock.tsx`:** full-screen route with one centred, medium-max-width Card. Vault-present order:
1. Bawa brand mark and “Bawa Web Wallet”. Approved mark asset: **not specified — Lane C to confirm**.
2. “Unlock your wallet”, followed by: “Locked means derived addresses are hidden and signing is unavailable. Watch-only remains usable.”
3. Password field; optional BIP-39 passphrase field **only** when the vault was created with one.
4. Error line.
5. Full-width Unlock button.
6. “Forgotten password? Restore wallet” link.
7. Helper: “Auto-lock affects signing access, not watch-only use. Configure it in Security settings.”

**`apps/web/src/screens/security-settings.tsx`:** “Lock after inactivity” Label and select; helper explaining activity reset and watch-only availability; manual **Lock now** Button at the bottom of this Security area. Do not introduce another settings screen.

### Spacing, sizing and typography
Use Inter and retain the centred, medium-max-width card. Card width/padding, page margins, gaps, control/mark dimensions, font sizes in px and font weights: **not specified — Lane C to confirm**. Do not infer measurements from reference wallets.

### Colour
- Light card: `--card`; light settings surfaces: `--background`.
- Main text: `--foreground`; supporting text: `--muted-foreground`.
- Borders: `--border`; primary action: `--primary`; focus: `--ring`; errors: `--destructive`.
- Dark lock backdrop: `NEW-TOKEN`, taking the existing shell’s dark-navy background. Exact mapping: **not specified — Lane C to confirm**. Keep card content on the light surface.

### Behaviour and states
- **Wrong password:** display the vault’s message and clear both password and passphrase fields.
- **Busy:** action reads “Unlocking…”.
- **No vault:** show “Set up your wallet”; do not attempt to unlock a missing vault. Setup fields/actions, setup destination and local restore route: **not specified — Lane C to confirm**. Do not promise password recovery.
- **Success:** unlock alone never authorises signing or approval—Rabby, `src/ui/views/Unlock/index.tsx`. No implicit broadcast. Redirect destination: **not specified — Lane C to confirm**.
- **Locked:** keep watch-only usable; hide vault-derived addresses and block vault-backed signing. Never force watch-only routes through `/lock`.
- **Auto-lock:** use the documented range **Immediately–1 day** (Phantom), without inventing intermediate options. Individual choices, default, “Immediately” semantics and activity definition: **not specified — Lane C to confirm**. Adopt Rabby’s minutes preference, activity reset and restart-persisted deadline.
- **Manual lock:** applies the same vault restrictions while preserving watch-only access. Do not promise lock-on-close; Bawa browser-close handling is **not specified — Lane C to confirm**.

### REMOVE
Delete lock-screen slate-950/slate-900/slate-800 styling, “Back to dashboard”, and the bottom locked/no-vault banners in `apps/web/src/screens/dashboard.tsx` (B3). Do not replace them with another dashboard banner or an app-wide gate.