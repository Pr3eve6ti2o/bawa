# B6 — Lock / unlock (+ auto-lock settings) spec (Lane B, fix-perf-ui-b)

Model: gpt-6.1-sol, API 1, max reasoning. One screen + one settings
area only. Output a Markdown spec section of at most 600 words. Use
en-GB spelling.

## Verified facts (use ONLY these sources; anything else, mark UNCERTAIN)

Current screens, read first-hand at branch panel-rebuild/fix-perf-ui-b (base
f9512b4):
- `apps/web/src/screens/lock.tsx` (139 lines): full-screen branded
  password lock — header "Bawa Web Wallet", centred card (max-width
  medium) with heading "Unlock your wallet" (or "Set up your wallet"
  when no vault exists), a Password field, an optional BIP-39 passphrase
  field shown only when the vault was created with one, an error line,
  a full-width Unlock button ("Unlocking…" while busy), and a "Back to
  dashboard" link at the bottom. Wrong password shows the vault's message
  and clears both fields. The vault is NOT gated app-wide: watch-only
  mode stays usable while the vault is locked, so this screen is a route
  (/lock) linked from the dashboard banner and the send screen, not an
  app-wide gate. Defects: it uses Tailwind slate colours (slate-950 /
  slate-900 / slate-800) — a THIRD palette on top of the dark-navy shell
  and the light Bawa Balanced tokens; no brand mark or logo; the "Back to
  dashboard" link undermines the lock (a locked wallet offering a way
  back to the wallet); no forgot-password / restore link; no auto-lock
  information anywhere on the screen.
- `apps/web/src/screens/dashboard.tsx` (350 lines): still shows lock /
  no-vault banner boxes at the bottom of the home screen ("Locked —
  derived addresses are hidden" with an Unlock button). Those banners
  must go (see B3).
- `apps/web/src/screens/security-settings.tsx` (68 lines): security view.
- Design tokens, `apps/web/src/ui/styles/globals.css` (Bawa Balanced):
  --primary rgb(98 88 217), --background rgb(244 246 251),
  --card rgb(255 255 255), --foreground rgb(27 39 66),
  --muted-foreground rgb(100 113 140), --border rgb(214 222 237),
  --ring rgb(139 124 255), --destructive rgb(243 99 111), Inter font.
  Components available: Button, Input, Label, Card, switch, select.

Pattern sources (all verified first-hand 2026-11-19, HTTP 200, unless
noted):
- MetaMask, `MetaMask/metamask-extension`,
  `ui/pages/unlock-page/unlock-page.component.tsx`: branded
  password-entry view that REPLACES the wallet (not a banner on the home
  screen), onSubmit(password), passkey unlock section, reset-password
  modal, redirect-after-unlock. Forgotten password routes to the
  restore-vault route. Auto-lock: Settings, Security & password,
  auto-lock sub-page. Custom ConsenSys licence, non-commercial only —
  patterns only.
- Rabby, `RabbyHub/Rabby`, `src/ui/views/Unlock/index.tsx`: branded
  unlock screen (logo + background), unlock types Biometrics or
  Password, hasForgotPassword state; a plain unlock is not consent to a
  pending sign/approval. Auto-lock: `src/background/service/autoLock.ts`
  — autoLockTime preference in MINUTES, reset on activity, deadline
  persisted across restarts; default in `src/background/service/
  preference.ts` is 0 (read first-hand 2026-11-19; the settings UI
  choices were not read — do not copy numbers). Licence MIT with brand
  reservation — patterns only.
- Phantom Help Center article 28951350406803 ("Turn on auto-lock",
  verified 2026-11-18): avatar, Settings, Security & Privacy,
  Auto-Lock Timer, duration from Immediately up to 1 day; unlock by
  entering the password. Manual lock: avatar, Settings, scroll to
  bottom, Lock Wallet. Closing the popup is NOT a reliable lock. App
  code is not public — vendor docs only.
- Trust Wallet agent skill, `trustwallet/tw-agent-skills` (MIT),
  `skills/wallet/SKILL.md`: the `twak` CLI/MCP server takes
  `--auto-lock <minutes>` — auto-lock as a minutes preference, and a
  `--read-only` mode in which tools that sign are neither listed nor
  callable. Reference-only. Trust Wallet's consumer apps are
  closed-source; no app lock screen exists to cite.

## Task

Write the spec section for: (1) the Lock / unlock screen, (2) the
auto-lock + manual-lock settings (in security settings). Give: Primary
pattern + exact source; Layout (top-to-bottom order); Spacing / sizing /
typography (px values, font sizes and weights); Colour (token names from
globals.css ONLY — never invent a hex value; where the dark panel needs
a token that does not exist yet, name it NEW-TOKEN and say which existing
shell colour it takes from); Behaviour + states (wrong password, busy,
no-vault, forgotten password / restore path, what stays usable while
locked and what does not, auto-lock timer choices — give the RANGE only
if a source above states one, otherwise say "not specified"; manual lock
placement); REMOVE (what to delete from the current screens, including
the dashboard lock banner and the "Back to dashboard" link).

## Hard rules

- The vault is NOT gated app-wide in this build: watch-only stays usable
  while locked. Spec the lock honestly for that behaviour — do not claim
  the lock hides the whole wallet when it does not, and say plainly in
  the UI what locked means here.
- Do not invent repo paths, file names, pixel values from a real wallet,
  timeout numbers, or Trust Wallet app screens. If a detail is not in
  the facts above, write "not specified — Lane C to confirm" instead.
- Do not copy any third-party code, text, branding or assets. Patterns
  only, re-implemented in our own code. No demo or fake data, no testnet,
  no broadcast. en-GB.
