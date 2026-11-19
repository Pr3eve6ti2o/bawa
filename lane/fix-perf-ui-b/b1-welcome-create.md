# B1 — Welcome + Create-wallet spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen-pair only. Output a
Markdown spec section of at most 600 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screens, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/welcome.tsx` (82 lines): dark-navy hero card, "BAWA"
  eyebrow, 30px bold title "Welcome to Bawa Web Wallet", one paragraph, a
  Network row with a MAINNET pill, then two light Cards (Create a wallet /
  Import a wallet) each with title, description and a full-width button,
  then a footnote aside (mainnet-only, sending signs offline, broadcast
  disabled). Defects: hero card and light cards mix two surfaces; no brand
  mark beyond text; no preview of the steps ahead; colours are hardcoded hex
  values, not tokens.
- `apps/web/src/screens/create-wallet.tsx` (412 lines): 4 steps shown as a
  StepCard list — 1 set a vault password (minimum 8 characters, plus confirm
  field, plus an optional BIP-39 passphrase field), 2 write down 24 words
  shown once, 3 re-enter 3 randomly chosen words from the written copy to
  prove it was saved, 4 success showing all 4 chain addresses. The mnemonic
  lives in local state only and is cleared on unmount and on error. Defects:
  no word-grid layout is specified anywhere; no progress indicator beyond
  the step list; step 4 is an address dump, not a success state; colours are
  hardcoded hex values.
- `apps/web/src/screens/mnemonic-backup.tsx` (131 lines): backup checklist
  screen, linked from create and import.
- App shell `apps/web/src/app/app.tsx`: 430px panel, dark gradient, header
  with a wallet icon in a violet gradient tile, "Bawa Web Wallet" title,
  "Account 01" link, Mainnet pill. Bottom nav.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --primary-hover rgb(82 72 192),
  --primary-soft rgb(230 228 255), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --destructive rgb(243 99 111), Inter font
  (400/500/600/700). Token-ui components available: Card, Button, Input,
  Label, Alert, StepCard, checklist-card, bottom-sheet-modal, action-bar,
  asset-row, skeleton.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200):
- Rabby, `RabbyHub/Rabby`, `src/ui/views/Unlock/index.tsx`: full-screen
  branded unlock (logo + background), unlock types Biometrics or Password.
  Licence MIT with brand-name/logo reservation — patterns only, no Rabby
  branding, text or code.
- MetaMask, `MetaMask/metamask-extension`,
  `ui/pages/unlock-page/unlock-page.component.tsx`: branded password-entry
  view, passkey section, reset-password modal, forgotten password routes to
  restore. Custom ConsenSys licence, non-commercial only — patterns only,
  no code, text or assets.
- Trust Wallet agent skill, `trustwallet/tw-agent-skills` (MIT),
  `skills/wallet/SKILL.md`: the `twak` CLI create-wallet model — create
  wallet, keychain, sign; `--auto-lock <minutes>`; `--read-only` mode;
  "Never give an agent your main wallet's recovery phrase."
  Reference-only for flow order; no Trust Wallet app UI is public.

## Task

Write the spec section for TWO screens: (1) Welcome/generator,
(2) Create-wallet flow (all 4 steps, including the 24-word write-down grid
and the 3-word confirmation, plus the success state). For each screen give:
Primary pattern + exact source; Layout (top-to-bottom order); Spacing /
sizing / typography (px values, font sizes and weights); Colour (token
names from globals.css ONLY — never invent a hex value; where the dark
panel needs a token that does not exist yet, name it NEW-TOKEN and say
which existing shell colour it takes from); Behaviour + states (loading /
error / empty / success, what happens on each tap, focus and error copy);
REMOVE (what to delete from the current screen).

## Hard rules

- Do not invent repo paths, file names, pixel values from a real wallet,
  or Trust Wallet app screens — Trust Wallet's consumer apps are
  closed-source and no app UI file exists to cite. If a detail is not in
  the facts above, write "not specified — Lane C to confirm" instead.
- Do not copy any third-party code, text, branding or assets. Patterns
  only, re-implemented in our own code.
- No demo or fake data, no testnet, no broadcast. en-GB.
