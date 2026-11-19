## B2 — Import wallet

### Primary pattern + exact sources
Make restore first-class: `MetaMask/metamask-extension`, `ui/pages/unlock-page/unlock-page.component.tsx` routes forgotten-password users to restore-vault. Apply that hierarchy here.

Watch-only visibility: `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` (`watchModeAlert`); labelled account-list placement: `src/ui/views/AddressManagement/`.

Patterns only: no third-party code, text, branding or assets. Security reference: `trustwallet/tw-agent-skills`, `skills/wallet/SKILL.md`; not a consumer-app UI source.

### Layout — top to bottom
1. **Import wallet** title.
2. Labelled tabs: **Restore full wallet** (default) / **Watch-only**.
3. Active `Card` containing the current `StepCard`, fields and inline `Alert`:
   - **Restore:** recovery-phrase field (12/24 words) → derived-address preview → Saved → vault password, confirmation and optional BIP-39 passphrase. This preserves the verified step sequence; unresolved save sequencing is flagged below.
   - **Watch-only:** persistent warning, **“Watch-only accounts cannot sign transactions. Import one chain at a time.”** → chain choice → account label → xpub.
4. Current-step primary action and applicable edit control.
5. **Backup checklist** link; tap opens `/mnemonic-backup`.

All stages remain within this screen.

### Spacing / sizing / typography
Padding, gaps, widths, heights, radii, font sizes and line heights (px): **not specified — Lane C to confirm**.

Use Inter; available weights are 400/500/600/700. Weight-to-role assignments: **not specified — Lane C to confirm**. Use token-ui `Button`, `Input`, `Label`, `Alert`, `Card`, `StepCard` and tabs; do not infer wallet measurements.

### Colour
Canvas `--background`; surfaces `--card`; text `--foreground`; helpers `--muted-foreground`; outlines `--border`; actions `--primary`/`--primary-hover`; selection `--primary-soft`; focus `--ring`; errors `--destructive`.

Dark-panel fill: `NEW-TOKEN`. Existing shell colour it must inherit: **not specified — Lane C to confirm**. Do not approximate or introduce hex values.

### Behaviour + states
- Mode taps select the corresponding form without saving. Mode-switch input retention: **not specified — Lane C to confirm**.
- Existing vault blocks phrase restore. Alert: **“A vault already exists. Phrase restore is unavailable.”**
- **Preview addresses** requires 12/24 words; otherwise: **“Enter a 12- or 24-word recovery phrase.”** Before any save, show actual chain identifiers and full derived addresses, grouped by chain. Never show the phrase or fabricated results. Chain coverage, address count and derivation details: **not specified — Lane C to confirm**.
- **Edit** returns to phrase entry and invalidates the preview. **Confirm import** requests saving; show Saved only on actual success, with the imported-address summary.
- **Set vault password** opens password, confirmation and optional-passphrase fields. **Save password** completes only on success. Mismatch: **“Passwords do not match.”** Password policy and further phrase/xpub validation: **not specified — Lane C to confirm**.
- **UNCERTAIN — blocking:** Saved persistence semantics and passphrase/preview interaction are **not specified — Lane C to confirm**. Resolve before enabling commit; final restore inputs must match the reviewed preview.
- **Import watch-only** imports one selected chain’s xpub with its label. Empty xpub: **“Enter an xpub for the selected chain.”** Preserve the warning in Saved and watch-only labelling in the account list.
- Empty: blank fields, no samples; block incomplete submissions. Empty preview: **“No addresses to review.”** Block saving. Loading: busy action, prevent duplicate taps. Error: remain on step; **“Could not complete this step. Try again.”** **Retry** repeats the failed action. **Done** destination: **not specified — Lane C to confirm**.
- Phrase-entry instructions refer only to the restore field. No agent sharing, digital-storage advice, demo data, testnet or broadcast actions.

### REMOVE
From `apps/web/src/screens/import-wallet.tsx`: watch-only default, unlabelled switch, unexplained watch-only/per-chain presentation and hardcoded hex styling. Retain both paths, restore steps and backup link.