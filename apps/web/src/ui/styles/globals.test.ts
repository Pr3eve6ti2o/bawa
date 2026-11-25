// @vitest-environment node

import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function containingAll(...patterns: RegExp[]): RegExp {
  return new RegExp(
    `^${patterns.map(({ source }) => `(?=[\\s\\S]*${source})`).join('')}`,
  );
}

describe('globals.css', () => {
  it('uses exactly the permitted palette colours, case-insensitively', () => {
    // The four Bawa colours, plus the ten QR-card template colours
    // (QR-cards programme, Lane E, 2026-11-25; design/DESIGN.md in
    // bawa-qr-cards). The --qr-* tokens are the one confined
    // exception to the 4-colour cap, used only by the Receive QR
    // card's four templates and its PNG exporter; see the --qr-*
    // note in :root and scripts/palette-audit.mjs. No further
    // literal may be added without a recorded decision in
    // docs/DECISIONS.md.
    const hexLiterals = css.match(/#[0-9a-f]+\b/gi) ?? [];
    const palette = [...new Set(hexLiterals.map((hex) => hex.toUpperCase()))]
      .sort()
      .join(' ');

    expect(palette).toMatch(
      /^#011F29 #023139 #0E2127 #111111 #121818 #1B2023 #2B2B2B #6B7280 #7A9491 #9CA3AF #FF6B4A #FFD93B #FFE9E4 #FFFDF7$/,
    );
  });

  it('defines the four palette variables with their exact values in :root', () => {
    const rootBlocks = (css.match(/:root\s*\{[^}]*\}/g) ?? []).join('\n');

    expect(rootBlocks).toMatch(
      containingAll(
        /--bawa-paper\s*:\s*#FFFDF7\s*[;}]/,
        /--bawa-ink\s*:\s*#2B2B2B\s*[;}]/,
        /--bawa-coral\s*:\s*#FF6B4A\s*[;}]/,
        /--bawa-sun\s*:\s*#FFD93B\s*[;}]/,
      ),
    );
  });

  it('contains no .dark selector or prefers-color-scheme', () => {
    expect(css).not.toMatch(/\.dark(?![\w-])|prefers-color-scheme/i);
  });

  it('contains no gradients, shadows, or rgb/rgba/hsl colour functions', () => {
    expect(css).not.toMatch(
      /gradient|box-shadow|text-shadow|rgba?\s*\(|hsl\s*\(/i,
    );
  });

  it('defines a desktop: breakpoint at 980px for the shell switch', () => {
    // Chrome/Brave desktop mode forces the layout viewport to 980px,
    // below Tailwind lg (1024px) — the shell switches on this custom
    // breakpoint instead, so a phone in desktop mode gets the sidebar.
    // Ported from desktop-layout-v2 bf00f54 (Fix-All Lane I).
    expect(css).toMatch(/--breakpoint-desktop\s*:\s*61\.25rem\s*;/);
  });

  it('defines a desktop: breakpoint at 980px for the shell switch', () => {
    // Chrome/Brave desktop mode forces the layout viewport to 980px,
    // below Tailwind lg (1024px) — the shell switches on this custom
    // breakpoint instead, so a phone in desktop mode gets the sidebar.
    // Ported from desktop-layout-v2 bf00f54 (Fix-All Lane I).
    expect(css).toMatch(/--breakpoint-desktop\s*:\s*61\.25rem\s*;/);
  });

  it('defines --radius-bawa and --radius-bawa-sm', () => {
    expect(css).toMatch(
      containingAll(
        /--radius-bawa\s*:/,
        /--radius-bawa-sm\s*:/,
      ),
    );
  });

  it('uses Baloo 2 for --font-display and imports @fontsource-variable/baloo-2', () => {
    expect(css).toMatch(
      containingAll(
        /--font-display\s*:[^;{}]*\bBaloo 2\b/,
        /@import\s+[^;{}]*@fontsource-variable\/baloo-2(?=[/'"\s);])/,
      ),
    );
  });
});
