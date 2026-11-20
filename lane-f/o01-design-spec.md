# Bawa Web Wallet — Desktop Layout Design Spec

## 1. Scope and design direction

Layout-only changes for `apps/web`: React 19, Vite 8 and Tailwind v4, on `panel-rebuild/desktop-layout`, based on `multichain-create` at `40d8cc5`. This spec uses the supplied baseline verified on 2026-11-20.

Keep all existing routes, labels, headings, content and wallet behaviour unchanged—including balances, prices, derivation, vault, signing and broadcast.

Reuse **Bawa Balanced, direction-04**, the existing tokens in `src/ui/styles/globals.css`, the current panel gradient, and Inter + Noto Sans. Support both existing themes. Do not introduce new colours, fonts or token values.

Reference wallets inform hierarchy only: balance first, actions close by, assets and recent activity visible together where space permits. No reference assets, text or additional features are introduced.

## 2. Breakpoints and sizing

Use Tailwind’s default **md / lg / xl** breakpoints.

| Mode | Viewport width | Maximum content frame | Horizontal padding | Navigation |
|---|---:|---:|---:|---|
| Phone | Below 768px | 430px | 16px each side | Existing bottom tab bar |
| Tablet — md | 768–1023px | 896px | 24px each side | Existing bottom tab bar |
| Desktop — lg | 1024–1279px | 1024px | 24px each side | Sidebar |
| Wide — xl | 1280px and above | 1152px | 32px each side | Sidebar |

- Content-frame caps **include horizontal padding and exclude the sidebar**. Width always shrinks to available space; these are not minimum widths.
- The tablet, desktop and wide caps use standard Tailwind max-width values. Retain the existing custom 430px phone cap.
- At desktop and wide sizes, centre the overall app frame with a **1440px maximum width**. Within it, use a **224px sidebar** and a flexible workspace.
- Centre the content frame within the workspace.
- Use **16px grid gaps on phone/tablet** and **24px on desktop/wide**.
- Remove the app-wide 430px restriction from tablet upward. Narrow task screens receive their own local cap.

At 390px, the frame is 390px wide, leaving **358px usable width** after padding.

## 3. App shell and navigation

### Phone and tablet

Keep the bottom tabs in their existing order:

**Home → Assets → Receive → Send → More**

More retains all ten existing destinations, in their current order.

On phone, place the existing logo and **Bawa Web Wallet** on the first header row, with the account link and **Mainnet** pill on the second. Do not hide or shorten these labels. Tablet may use a single header row because more space is available.

Keep the bottom bar aligned with the centred app frame. Reserve enough page-bottom space for its full height, safe-area inset and an additional 16px.

### Desktop and wide

- Move the existing logo and **Bawa Web Wallet** title into a 72px-high sidebar brand area.
- Use a **72px workspace header**, keeping the existing account link and Mainnet pill, aligned with the page content.
- Retain their current text, destinations and interactions. Do not add another balance display or a new page title.
- Replace the bottom bar with the sidebar; never expose both navigation variants simultaneously.
- Keep sidebar links at least 44px high. Make the navigation area independently scrollable when viewport height is insufficient.

Use the installed **lucide-react** package for the following icons; no new icon package or asset files.

| Order | Existing label | Lucide icon | Current source |
|---:|---|---|---|
| 1 | Home | House | Bottom tab |
| 2 | Assets | Coins | Bottom tab |
| 3 | Receive | ArrowDownLeft | Bottom tab |
| 4 | Send | Send | Bottom tab |
| 5 | Wallets | Wallet | More |
| 6 | Transactions | History | More |
| 7 | Track a transaction | Search | More |
| 8 | Import wallet | FileInput | More |
| 9 | Create wallet | Plus | More |
| 10 | Create | Wrench | More |
| 11 | Security | ShieldCheck | More |
| 12 | Networks | Network | More |
| 13 | Mnemonic backup | KeyRound | More |
| 14 | Welcome | DoorOpen | More |

Place a simple divider after Send. The former More destinations become direct sidebar links—no desktop More submenu is needed.

**Create** remains the `/create` tool hub. **Create wallet** remains the separate existing creation flow; do not merge them. **Track a transaction** retains `/track`.

Preserve contextual navigation as well: asset details remain reachable from existing asset links, and Lock remains reachable through the existing locking mechanism. Keep route guards, redirects and workflow links unchanged on both navigation variants.

## 4. Primary screen grids

Column ratios describe the available width **after subtracting the gutter**.

| Screen | Phone | Tablet | Desktop | Wide |
|---|---|---|---|---|
| Dashboard | 1 column | 2 equal columns | 2 columns, **7:5** | 2 columns, **2:1** |
| Create — `/create` | 1 column | 2 equal columns | 2 equal columns | 3 equal columns |
| Track — `/track` | 1 column | 1 column | 2 columns, **7:5** | 2 columns, **2:1** |

### Dashboard placement

**Phone:** retain the current stacked order: portfolio hero, Send/Receive/Activity actions, Tokens/Activity tabs, and the existing list sections according to current tab behaviour.

**Tablet:**
1. Portfolio hero spans both columns.
2. Actions span both columns.
3. Tokens/Activity tabs span both columns.
4. Asset list sits left; existing recent-activity summary sits right.

**Desktop and wide:**
1. Top row: portfolio hero left; existing three-action group right.
2. Next row: Tokens/Activity tabs span both columns.
3. Lower row: asset list left; existing recent activity right.

Keep **Send, Receive, Activity** as three equal-width buttons in one row at every breakpoint.

Tokens/Activity remain real tabs with their existing labels and selected-state behaviour. In the Tokens view, use the lower asset/activity arrangement above. In the Activity view on tablet and larger, let the existing activity panel span the lower row instead of rendering a duplicate feed. Preserve phone behaviour, existing data sources, loading states, filters and request timing.

Cards grow naturally with content. Do not force equal list heights or introduce internal scrolling merely to align their bottoms.

### Create placement

Keep all seven cards in their existing order and preserve their status: **Multichain wallet** and **HD wallet** remain working tools; the other five remain build briefs.

- Fill the grid left-to-right, then top-to-bottom.
- On wide screens, the rows contain **3 / 3 / 1** cards; the last card stays in the first grid slot.
- Align card action areas within each row where practical, but allow complete titles and descriptions to wrap. No fixed heights or text clipping.
- Do not change card actions, wording or functionality.

### Track placement

On desktop and wide:

- **Left column:** chain picker, hash lookup form, then its result card.
- **Right column:** the entire existing recent-activity-for-an-address section, including its address controls.
- Align both columns at the top; each grows independently with its content.

On phone and tablet, retain that same reading order in one column. Chain-picker buttons wrap into additional rows rather than creating a horizontally scrolling strip.

## 5. Other screens

**Centred narrow column** means a local maximum of **480px**, shrinking to the available content width. **Full-width** means the available content frame—not the entire browser width. Below 768px, every screen fits the phone frame and preserves its existing reading order.

Screen names below are descriptive; retain the actual current UI headings verbatim.

| Screen | Layout and reason |
|---|---|
| Welcome | **Centred narrow column** — keeps onboarding focused and readable. |
| Asset list / Assets | **Full-width** — gives existing token rows, balances and actions room without adding data. |
| Asset detail | **Centred narrow column** — keeps one asset’s existing information and actions together without inventing extra panels. |
| Send | **Centred narrow column** — preserves a clear, sequential transaction form. |
| Receive | **Centred narrow column** — keeps the existing QR, address and copy controls together. |
| Transactions | **Full-width** — accommodates current history rows and filters; retain the existing list structure. |
| Wallets | **Full-width** — gives wallet names, addresses and existing controls adequate space. |
| Security | **Centred narrow column** — makes sensitive settings easier to review in order. |
| Networks | **Full-width** — gives existing network rows and controls room to wrap cleanly. |
| Lock | **Centred narrow column** — keeps unlocking focused without changing the locking flow. |
| Import wallet | **Centred narrow column** — keeps sensitive inputs readable and manageable. |
| Create wallet | **Centred narrow column** — preserves the existing creation sequence and field order. |
| Mnemonic backup | **Centred narrow column** — keeps the existing phrase display and confirmation controls in one controlled area. |

## 6. Mobile fallback requirements

At **390px**:

- No page-level horizontal overflow, including cards, lists, menus and form rows. Grid children must be allowed to shrink.
- Preserve all monetary values and their current formatting. Reflow rows rather than clipping or abbreviating amounts.
- Long hashes and addresses wrap where appropriate. Inputs may scroll their own text internally, but must not widen the page.
- Buttons retain complete labels. Let form actions stack or become full-width where necessary.
- Every interactive target is at least **44 × 44 CSS pixels**, including bottom tabs, More items and chain-picker buttons.
- The bottom bar remains reachable and does not cover the last content row or focused control.
- More opens within the viewport, above the bottom bar, and scrolls vertically if necessary. Its final item must remain reachable.
- Retain the ten existing chain PNGs at **40px**, preserving aspect ratio; do not upscale them for desktop.

## 7. Performance rules

- **No new dependencies and no new raster images.** Reuse the existing logo, chain assets and Lucide SVG icons. Layout decoration, if needed, is CSS only.
- Preserve the existing **10.4 MB wallet-core WASM lazy-loading path**. The shell, sidebar and layout components must not import, preload or trigger it before first paint.
- Keep existing lazy route chunks. Do not eagerly import route components merely to construct navigation.
- Do not add duplicate data requests, polling, analytics panels or reference-wallet features as part of the wider layout.

## 8. Accessibility

- Use a labelled navigation landmark for the sidebar and retain a main-content landmark. Only the currently displayed navigation variant is exposed to assistive technology.
- Mark the active destination as the current page. Combine existing accent tokens with a visible border/marker and text emphasis; colour alone is insufficient.
- Keep icons decorative when the adjacent text already supplies the accessible name.
- Preserve visible keyboard focus using existing focus tokens. Do not clip focus rings at card or sidebar edges.
- Keep keyboard order consistent with reading order; avoid visual reordering that separates focus from the visible sequence.
- More supports keyboard opening, Escape dismissal and focus return to its trigger.
- Respect reduced-motion preferences. No layout interaction requires animation.
- Use existing accessible foreground and border tokens in both themes; do not introduce a separate desktop palette.

## 9. Acceptance checklist

- [ ] The existing web build and Vitest suite pass. No route, label or heading assertions are changed to accommodate the layout.
- [ ] Capture settled-state headless-Chromium screenshots of **Home, `/create` and `/track` at 1440 × 900 and 390 × 844**, using the same existing wallet/test data. Include a 390px screenshot with More open.
- [ ] At 1440px: the sidebar is 224px wide, the bottom bar is absent, Dashboard and Track use 2:1 columns, and Create uses three columns.
- [ ] At 390px: primary screens are single-column, the three dashboard actions fit, no text or buttons are clipped, and there is no page-level horizontal scrolling.
- [ ] Every sidebar/More destination and existing contextual workflow remains reachable. Sidebar and More can scroll without hiding their final items.
- [ ] Resizing across 768px, 1024px and 1280px produces the specified layouts without overlapping or duplicate navigation.
- [ ] Keyboard focus, current-page indication, More dismissal and reduced-motion behaviour work in both existing themes.
- [ ] A cold Home load confirms that the layout does not fetch or preload wallet-core before first paint; build output retains lazy route chunks.