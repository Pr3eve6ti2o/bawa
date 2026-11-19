## B1 — Welcome/generator + Create-wallet

Baseline: `panel-rebuild/fix-perf-ui-b`, base `f9512b4`. New presentation proposals are **UNCERTAIN — not specified — Lane C to confirm**. Patterns only: no third-party code, text, branding or assets.

### Shared specification — both screens

**Spacing/sizing/type:** 430px panel; Inter, available weights 400/500/600/700; Welcome title 30px/700. Padding, gaps, control heights, radii, line heights and remaining typography: **not specified — Lane C to confirm**.

**Colour:** From `apps/web/src/ui/styles/globals.css`: `--background` canvas; `--card` surfaces; `--foreground` and `--muted-foreground` text; `--border` outlines; `--primary`/`--primary-hover` actions; `--primary-soft` emphasis; `--ring` focus; `--destructive` errors. `NEW-TOKEN` takes the existing dark-gradient shell background from `apps/web/src/app/app.tsx`; exact colours/stops: **not specified — Lane C to confirm**.

### 1. Welcome/generator

**Primary pattern + exact source:** Branded-entry hierarchy, `RabbyHub/Rabby` — `src/ui/views/Unlock/index.tsx` (MIT, branding reserved). Adapt the hierarchy, not biometrics or unlock functionality. Local baseline: `apps/web/src/screens/welcome.tsx`.

**Layout, top-to-bottom:** Shell header → welcome brand block reusing the existing Bawa wallet-icon tile, “BAWA”, “Welcome to Bawa Web Wallet” and paragraph → Network row with MAINNET pill → four-step preview: password, 24-word backup, three-word confirmation, success → Create a wallet / Import a wallet Cards, retaining descriptions and full-width Buttons → mainnet-only, offline-signing, broadcast-disabled aside. Use `--card` consistently for content surfaces. Preview copy and geometry: **not specified — Lane C to confirm**.

**Behaviour + states:** Create opens the four-step creation flow; Import opens the existing import flow. Do not show sample words or addresses. Loading/empty/error presentation, focus destinations, error copy and route identifiers: **not specified — Lane C to confirm**. Success is reached within creation, not simulated here.

**REMOVE:** Separate navy-hero treatment and hardcoded colours. Replace text-only branding and preview-free entry; retain the safety aside.

### 2. Create-wallet flow

**Primary pattern + exact source:** Bawa’s four-step `StepCard` flow, `apps/web/src/screens/create-wallet.tsx`. Password-entry reference only: `MetaMask/metamask-extension` — `ui/pages/unlock-page/unlock-page.component.tsx`. CLI flow-order reference only: `trustwallet/tw-agent-skills` — `skills/wallet/SKILL.md`; no Trust Wallet app UI.

**Layout, top-to-bottom:** Shell header → four-step progress → StepCards in order:

1. Vault password, minimum eight characters; confirmation field; optional BIP-39 passphrase.
2. Once-only, ordered **24-word write-down grid**, containing the actual mnemonic. Columns, rows, numbering treatment, cell dimensions, gaps and typography: **not specified — Lane C to confirm**.
3. **Three randomly selected word-position prompts** with inputs for answers from the written copy.
4. Success acknowledgement first; all four actual chain addresses as secondary content; backup-checklist access. Success wording, address arrangement and progress geometry: **not specified — Lane C to confirm**.

**Behaviour + states:** Step actions follow password setup → write-down → verification → success. The three-word check must prove the written copy was saved. Button labels, transition gates, normalisation, loading/empty presentation, focus movement, mismatch/retry handling, error copy and success exit destination: **not specified — Lane C to confirm**.

Backup access opens `apps/web/src/screens/mnemonic-backup.tsx`; return/resume behaviour: **not specified — Lane C to confirm**. Keep the mnemonic in local state only; clear on unmount and error. No fake data, testnet or broadcast.

**REMOVE:** Reliance on the list as the sole progress cue, bare address-dump success presentation and hardcoded colours. Preserve all four steps and mnemonic-lifecycle safeguards.