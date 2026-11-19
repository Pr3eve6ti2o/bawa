# B2 — Import-wallet spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen only. Output a
Markdown spec section of at most 600 words. Use en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screen, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/import-wallet.tsx` (533 lines): two modes, and the
  DEFAULT mode is watch-only (paste an xpub per chain, with a label). The
  phrase-restore mode is secondary: enter recovery phrase (12/24 words),
  then a preview step showing the derived addresses, then a saved step, then
  set a vault password (plus confirm) and an optional BIP-39 passphrase.
  A vault-exists state blocks phrase restore. Links out to
  `/mnemonic-backup` (backup checklist). Defects: the default is backwards
  — real wallets lead with restore-from-phrase and treat watch-only as the
  secondary path; the mode switch is not labelled as a choice between
  "restore full wallet" and "watch-only"; watch-only import is per-chain
  xpub (one chain at a time) with no explanation that a watch-only account
  cannot sign; colours are hardcoded hex values, not tokens.
- `apps/web/src/screens/mnemonic-backup.tsx` (131 lines): backup checklist
  screen.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --primary-hover rgb(82 72 192),
  --primary-soft rgb(230 228 255), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --destructive rgb(243 99 111), Inter font
  (400/500/600/700). Token-ui components available: Card, Button, Input,
  Label, Alert, StepCard, checklist-card, tabs, bottom-sheet-modal.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200):
- MetaMask, `MetaMask/metamask-extension`,
  `ui/pages/unlock-page/unlock-page.component.tsx`: forgotten password
  routes to the restore-vault route — restore is a first-class entry point,
  not a secondary mode. Custom ConsenSys licence, non-commercial only —
  patterns only, no code, text or assets.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx`: shows a
  watch-mode alert when the account is watch-only ("watchModeAlert") —
  watch-only is always labelled where it appears, never silent. Licence
  MIT with brand-name/logo reservation — patterns only.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/AddressManagement/`: address list
  with sorting and account switching — an imported account gets a label and
  a place in the account list.
- Trust Wallet agent skill, `trustwallet/tw-agent-skills` (MIT),
  `skills/wallet/SKILL.md`: "Never give an agent your main wallet's
  recovery phrase." Reference-only. Trust Wallet's consumer apps are
  closed-source; no app UI file exists to cite.

## Task

Write the spec section for ONE screen: Import-wallet (phrase restore as
the primary path, watch-only as the secondary path, including the preview
and saved steps, the vault-password step, and the watch-only warning).
Give: Primary pattern + exact source; Layout (top-to-bottom order);
Spacing / sizing / typography (px values, font sizes and weights); Colour
(token names from globals.css ONLY — never invent a hex value; where the
dark panel needs a token that does not exist yet, name it NEW-TOKEN and
say which existing shell colour it takes from); Behaviour + states
(loading / error / empty, what happens on each tap, validation and error
copy, what the preview step must show before anything is saved); REMOVE
(what to delete from the current screen).

## Hard rules

- Do not invent repo paths, file names, pixel values from a real wallet,
  or Trust Wallet app screens. If a detail is not in the facts above,
  write "not specified — Lane C to confirm" instead.
- Do not copy any third-party code, text, branding or assets. Patterns
  only, re-implemented in our own code.
- Never tell the user to paste a recovery phrase anywhere except the
  phrase-restore field, and never suggest storing it digitally. No demo or
  fake data, no testnet, no broadcast. en-GB.
