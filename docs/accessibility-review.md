# Accessibility review

## Scope

Phase 9 uses WCAG 2.2 as the reference standard, with AA as the target.

The intended scope is the two starters as committed in Phases 6–7:

- **Web:** the 14 screens in `apps/web/src/screens/`, their React/react-router composition, the 65 vendored token-ui components in `src/ui/components/`, and `src/ui/styles/globals.css`.
- **Android:** the 14 Jetpack Compose screens in `apps/android/app/src/main/java/com/bawa/wallet/ui/screens/` and `ui/Components.kt`: `ScreenHeader`, `PrimaryButton`, `OutlineActionButton`, `AssetRow` and `QrCodeImage`.

**Evidence limit:** this document assesses the supplied descriptions of the code. The checkout was not inspected. Component-level observations can be recorded, but an independently verified screen-by-screen review and state mapping cannot be claimed.

The following checks were **not** carried out:

- No screen-reader run, on either platform.
- No keyboard-only run.
- No automated axe or Lighthouse run.
- No colour-contrast measurement.

Neither starter has automated accessibility tests. This is a limited review, not a test report or a claim of WCAG 2.2 AA conformance.

## Web findings

### Strengths

- Radix-based primitives provide keyboard interaction, focus management and ARIA behaviour for supported controls. The vendored buttons, dialogs, alert dialogs, form controls, tabs and tooltips are a useful foundation; their presence does not validate the surrounding screen composition.
- `globals.css` provides semantic background, foreground, border and primary colour tokens, alongside explicit typography tokens such as `text-title-sm` and `text-body-md`. Dark mode is a first-class theme. This supports consistent styling, but does not establish sufficient contrast.
- Inputs have labels, and buttons use real `<button>` elements. These are preferable to placeholder-only labels and clickable generic containers.
- Locked, empty and error states include text rather than relying on colour alone.
- The dashboard’s derived-address copy buttons use text rather than icons. **This is good:** visible action text supplies a readable label without requiring icon recognition. Repeated copy controls still need enough context to distinguish their target addresses.

### Gaps

- Focus order has not been tested, including route changes, dialogs and conditional state content.
- There is no skip link to bypass repeated navigation.
- Receive renders its QR code with `qrcode.react`. There is no explicit text alternative beyond the address text beside it. That address is a useful alternative way to obtain the value; the QR’s purpose and its relationship to the address still need to be made explicit or deliberately treated as redundant.
- Toast notifications have not been asserted to be announced. Using sonner/toast components is not evidence that each notification reaches assistive technology appropriately; this is unverified, not a finding that all toasts are silent.

## Android findings

### Strengths

- Material 3 components carry TalkBack semantics for standard controls, including roles, actions and states. Custom content still needs its own assessment.
- `ScreenHeader` gives every screen a visible heading and back action, providing a consistent navigation structure. A visible heading does not by itself establish a TalkBack heading semantic.
- State messages use text rather than colour alone. Their announcement when content changes remains unverified.

### Gaps

- No TalkBack run was performed. Traversal order, accessible names, back navigation and changing-state announcements remain unchecked.
- No `contentDescription` audit was performed. Several `Image`/`Icon` usages may lack useful descriptions. Each needs classification: an omitted description can be correct for decoration, but not for meaningful content without another accessible label.
- The bare placeholder text `QR` gives no further explanation or useful alternative. It must not be mistaken for a working QR code: Receive derives no address on-device and shows no generated QR. The vendored `QrCodeImage` remains unused until on-device derivation exists.
- No large-text or font-scaling check was performed. Clipping, truncation, wrapping and access to actions at larger system text sizes remain unchecked.

## Required states

`docs/14` §5.1 requires loading, empty, stale, locked, gate-failed and error states.

The supplied description establishes textual locked, empty and error states on Web, but does not identify their screens. It does not provide an equivalent Android state-to-screen inventory. Assigning screen names or declaring states absent would therefore be speculation.

| Required state | Web screen location | Android screen location |
| --- | --- | --- |
| loading | UNVERIFIED — no screen location established | UNVERIFIED — no screen location established |
| empty | Textual state described; screen location UNVERIFIED | UNVERIFIED — no screen location established |
| stale | UNVERIFIED — no screen location established | UNVERIFIED — no screen location established |
| locked | Textual state described; screen location UNVERIFIED | UNVERIFIED — no screen location established |
| gate-failed | UNVERIFIED — no screen location established | UNVERIFIED — no screen location established |
| error | Textual state described; screen location UNVERIFIED | UNVERIFIED — no screen location established |

**MISSING** must mean that inspection found no screen implementing the state. **UNVERIFIED** means coverage was not checked; it is neither evidence of presence nor evidence of absence.

This mapping is outstanding. Inspect all 14 screen implementations on each platform and replace every unverified entry with a source location or **MISSING**. The component inventory alone cannot establish compliance with the state contract.

## Recommendations

In priority order; all items are **OPEN**, with **no owner**.

1. **OPEN — no owner: add automated accessibility tests.** Add route-and-state axe checks to Web browser tests and Compose UI semantics assertions to Android tests, then run them in CI. Complete the source-to-state inventory when defining coverage. Include control names, labels, dialogs, validation messages and notification semantics. Automated checks will not prove screen-reader usability.

2. **OPEN — no owner: carry out a keyboard-only Web pass.** Cover all screens and implemented states using Tab, Shift+Tab, Enter, Space, arrow keys and Escape as appropriate. Check visible focus, order, dialog containment and restoration, and route-change focus. Add a skip link to the main content.

3. **OPEN — no owner: carry out a TalkBack pass.** Exercise every Android screen and implemented state, including headings, back actions, disabled controls and changing messages. Run a separate Web screen-reader pass for notifications and QR/address content. Also check Android at supported large-text/font-scaling settings; do not treat TalkBack testing as a substitute for this.

4. **OPEN — no owner: measure contrast against WCAG 2.2 AA.** Check both platforms and light/dark themes. Measure actual rendered text, essential control boundaries, focus indicators and state colours. Record the colour pairs and results; semantic token names are not measurements.

5. **OPEN — no owner: audit Android `contentDescription` usage.** Review every meaningful `Image` and `Icon`, including custom components. Provide purpose-based names where needed, leave decorative content unannounced, and avoid duplicating adjacent accessible text. Verify `ScreenHeader` heading semantics and back-action naming.

6. **OPEN — no owner: resolve QR text alternatives.** On Web, retain the readable, copyable address and explicitly associate it with the QR’s purpose, or hide a deliberately redundant QR from assistive technology. On Android, replace unexplained `QR` placeholder text with a plain-language unavailable state. Once on-device derivation exists, provide an accessible address, labelled copy action and appropriate QR alternative before wiring in `QrCodeImage`.
