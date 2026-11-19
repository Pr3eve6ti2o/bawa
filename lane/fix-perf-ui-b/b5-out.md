## Send — review, offline sign and result

Broadcast remains disabled. Preserve Chain → Recipient → Amount → Review → Sign → Result.

**Primary pattern:** Rabby, `RabbyHub/Rabby`, `src/ui/views/SendToken/index.tsx`: chain-first selection, Max, fee reserve and recipient-risk checks. Adapt these concepts to our existing order and offline signing only. Supporting alert patterns: MetaMask, `MetaMask/metamask-extension`, `ui/pages/confirmations/components/send/amount-recipient/amount-recipient.tsx` (poisoning); Phantom Help Center, “Send tokens from Phantom” (new-address, network and native-fee cautions). Reimplement patterns only: no third-party code, text, branding or assets.

### Shared layout and styling

Every step, top-to-bottom: non-clickable six-step indicator with the current step explicitly labelled; heading; ordered content below; inline alerts; Back and the step action. Do not communicate progress through colour alone. Use existing Button, Input, Label, Alert, Card/StepCard and skeleton components.

**Spacing/sizing/typography:** Inter. Exact padding, gaps, panel widths, control heights, font sizes in px and font weights are **UNCERTAIN: not specified — Lane C to confirm**. Do not infer wallet measurements.

**Colour:** Use `--background` for the page, `--card` for content surfaces, `--foreground` for text, `--muted-foreground` for supporting text, `--border` for boundaries, `--ring` for focus, `--primary`/`--primary-hover` for actions, `--warning` for cautions and `--destructive` for errors. Dark-panel surface: `NEW-TOKEN`, taking the existing shell’s dark-panel background colour; its exact source colour/value is **not specified — Lane C to confirm**.

### Steps and states

1. **Chain**  
   Chain selector → selection feedback → actions. Require a selection before Next. Back’s entry destination: **not specified — Lane C to confirm**; do not invent a route.

2. **Recipient**  
   Labelled address input and QR scanner → validation → recipient alerts → actions. Retain address validation; validate scanned addresses too. Invalid addresses block Next. Show a new-address caution only when supported by real first-use information; show poisoning and sorted risk findings only from actual checks. Prompt independent verification of the full address and network; explain that a transaction, if later broadcast, is irreversible. Detection/history and warning acknowledgement/blocking policy: **not specified — Lane C to confirm**. Never invent a “safe” verdict. Back → Chain.

3. **Amount**  
   Asset and amount → Max → estimated fee and native-token fee reserve → inline feedback → actions. Run `previewSendAmount`, retain “Checking…” and show the actual preview failure reason inline. Label the fee **Estimated fee**, with a note that it may change. Block progression while checking, on invalid input, preview failure or confirmed insufficient fee funds. Explain insufficient native token for fees explicitly. Max must preserve the fee reserve; non-native asset balance does not replace native-fee funding. Balance inputs and reserve/Max calculation: **not specified — Lane C to confirm**; disable Max if the required calculation is unavailable. Back → Recipient.

4. **Review / confirm**  
   Selected chain → full destination → asset → amount → estimated fee → total with explicit units → fee note → reserve and active warnings → actions. Back → Amount. Changed inputs invalidate stale previews and signatures. Recheck validity and fee sufficiency before enabling **Sign offline**. This is review before signing, not network confirmation; no broadcast action.

5. **Sign**  
   Transaction recap → local signing status. Enter only through **Sign offline**; prevent duplicate signing. Back → Review while idle; unavailable whilst signing. Signer mechanics and cancellation support: **not specified — Lane C to confirm**.

6. **Result**  
   Status → details → actions.  
   - **Pending:** local offline-signing operation only; busy indicator/skeleton, no payload or copy action.
   - **Signed:** “Signed offline — not broadcast”, actual signed payload and Copy.
   - **Failed:** failure state and actual available signing error; no success claim or copyable signature.

   Back → Review once settled; disabled whilst pending. Back never automatically signs. No submitted-to-network or on-chain-confirmation states.

### REMOVE

Delete hardcoded hex styling; replace it with tokens. Delete no functional stages. Retain validation, QR scanning, preview busy/error feedback, review Back and signed-payload copy. No demo/fake data or testnet.