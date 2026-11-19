## B4 — Receive (address + QR)

### Primary pattern + exact source
Rabby: `RabbyHub/Rabby`, `src/ui/views/Receive/index.tsx` — QR, address copying, network selection and watch-only disclosure. Adopt that grouping, not its `ChainSelectorModal`: **our Receive remains a page**, with existing network pills and the QR visible directly.

Network-safety guidance: Phantom Help Center article **4406393831187**, *Receive tokens in Phantom*. Patterns only; reuse no third-party code, interface text, branding or assets.

### Layout — top to bottom
1. **Receive** heading.
2. BTC / ETH / TRX / TON network pills; selected network clearly distinguished.
3. Network-warning Alert.
4. Watch-only Alert, when applicable to the displayed address’s account.
5. **Amount (optional)** field and inline validation — **above the QR**, not below it.
6. One Card containing:
   - QR;
   - for TRX/TON, entered amount as separate plain text beside the QR;
   - full address, centred and untruncated;
   - **Copy address** and **Share** Buttons.

No separate QR screen or receive modal.

### Spacing / sizing / typography
Retain the verified **24px semibold** heading, **192px × 192px QR**, and **14px monospace** address with centred alignment and `break-all`. Use Inter elsewhere.

**UNCERTAIN:** Padding, gaps, card width, corner radii, QR quiet-zone dimensions, control heights, other font sizes/weights, address weight and monospace family: **not specified — Lane C to confirm**. These are not inferred from wallet screenshots.

### Colour
Use tokens from `apps/web/src/ui/styles/globals.css`:
- `--background`: page.
- `--card`: single receive surface and QR surround.
- `--foreground`: main text.
- `--muted-foreground`: supporting text.
- `--border`: outlines.
- `--primary`: selected pill and action emphasis.
- `--ring`: focus indication.
- `--destructive`: validation errors.

Replace the selected gradient with a solid token-based treatment. **Remove the dark panel**, rather than introducing another competing surface; no **NEW-TOKEN** is required.

### Behaviour + states
- **Network warning:** Tell the sender to use the selected network. Identical address text does not establish network compatibility.
- **QR updates:** Chain or amount changes must refresh the displayed QR from current validated inputs; never expose an earlier amount-bearing payload for sharing.
- **Amounts:** BTC encodes a BIP-21 amount; ETH encodes value in wei. TRX/TON retain an address-only QR, with amount shown separately as text—no standard payment URI is claimed.
- **Copy:** Copy the complete displayed receiving address, not an amount-bearing QR URI.
- **Share — UNCERTAIN:** Payload, QR attachment, platform integration, fallback and feedback: **not specified — Lane C to confirm**. Any QR-sharing implementation must share the current QR.
- **Validation error:** Retain “Enter a valid amount.” Do not offer a stale amount-bearing QR while the current amount is invalid.
- **Watch-only:** Retain the Alert explaining that receiving is possible but this wallet cannot sign; receiving actions remain available.
- **Zero / no address:** Show “No receiving address available” with the existing import link instead of the amount field, QR, address and actions. Do not substitute fabricated data.
- **UNCERTAIN:** Loading presentation, non-validation error handling/recovery, copy feedback and zero-amount acceptance: **not specified — Lane C to confirm**. Never display stale account data during transitions.

### REMOVE
Delete the dark-navy wrapper and redundant nested QR-card surface, the old below-QR amount placement, hardcoded colour values, selected-pill gradient and stale QR-sharing behaviour.