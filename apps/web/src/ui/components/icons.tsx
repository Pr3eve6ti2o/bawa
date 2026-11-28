import type { ReactElement } from "react";

export const BAWA_ICON_NAMES = [
  "wallet",
  "home",
  "coins",
  "receive",
  "send",
  "activity",
  "search",
  "shield",
  "network",
  "key",
  "book",
  "collapse",
  "expand",
  "eye",
  "eye-off",
  "close",
  "check",
  "chevron-down",
  "alert",
  "arrow-up-right",
  "arrow-left",
  "arrow-down-left",
  "arrow-left-right",
  "swap",
  "copy",
  "card",
  "link",
] as const;

export type BawaIconName = (typeof BAWA_ICON_NAMES)[number];

// Geometric glyphs, hand-authored on the 24x24 grid: straight lines and
// true circular arcs only, no quadratic or cubic curves. All geometry was
// drawn from scratch for this file — no path data copied from any icon
// library. The "link" glyph below is the one exception: it is the
// pre-existing lucide-style pair of arcs, kept unchanged.
const ICON_PATHS: Record<BawaIconName, readonly string[]> = {
  wallet: [
    "M11 8 V4.5 A1 1 0 0 1 12 3.5 H16 A1 1 0 0 1 17 4.5 V8 M8.2 4.8 L7.1 3.3 M19.2 5.2 L20.6 3.9",
    "M4 8 H20 A1 1 0 0 1 21 9 V19 A1 1 0 0 1 20 20 H4 A1 1 0 0 1 3 19 V9 A1 1 0 0 1 4 8 Z",
    "M3 12 H21 M16 13.5 H20.5 V16.5 H16",
  ],
  home: [
    "M3 11 L12 3 L21 11",
    "M5 9.5 V20 H10 V15 H14 V20 H19 V9.5",
  ],
  coins: [
    "M4 7 A8 3 0 0 1 20 7 A8 3 0 0 1 4 7 Z",
    "M4 7 V11 A8 3 0 0 0 20 11 V7",
    "M4 11 V15 A8 3 0 0 0 20 15 V11",
    "M4 15 V18 A8 3 0 0 0 20 18 V15",
  ],
  receive: [
    "M12 3 V15 M7 10 L12 15 L17 10",
    "M4 15 V19 A1 1 0 0 0 5 20 H19 A1 1 0 0 0 20 19 V15",
  ],
  send: [
    "M5 19 L19 5",
    "M9 5 H19 V15",
  ],
  activity: [
    "M12 3 A9 9 0 1 1 5.6 5.6",
    "M2.3 6.8 L5.6 5.6 L4.4 8.9",
    "M7.5 12 H10 L12 8.5 L14.5 15.5 L16.5 12 H18",
  ],
  search: [
    "M17 10 A7 7 0 1 1 3 10 A7 7 0 1 1 17 10 Z",
    "M15 15 L21 21",
  ],
  shield: [
    "M12 3 L20 5.5 V11 A8.5 8.5 0 0 1 12 20.5 A8.5 8.5 0 0 1 4 11 V5.5 Z",
    "M8 12 L11 15 L16 9.5",
  ],
  network: [
    "M14.5 4.5 A2.5 2.5 0 1 1 9.5 4.5 A2.5 2.5 0 1 1 14.5 4.5 Z",
    "M7.5 18.5 A2.5 2.5 0 1 1 2.5 18.5 A2.5 2.5 0 1 1 7.5 18.5 Z",
    "M21.5 18.5 A2.5 2.5 0 1 1 16.5 18.5 A2.5 2.5 0 1 1 21.5 18.5 Z",
    "M10.7 6.6 L6.3 16.4 M13.3 6.6 L17.7 16.4 M7.5 18.5 H16.5",
  ],
  key: [
    "M12.5 8 A4.5 4.5 0 1 1 3.5 8 A4.5 4.5 0 1 1 12.5 8 Z",
    "M11.2 11.2 L20 20 M15 15 L17 13 M18 18 L20 16",
  ],
  // Lane T (P1, item 4): book replaces the copy icon on Address
  // book (a copy glyph reads as "copy", not an address book).
  book: [
    "M5.5 4.5 H18.5 A1 1 0 0 1 19.5 5.5 V18.5 A1 1 0 0 1 18.5 19.5 H5.5 A1 1 0 0 1 4.5 18.5 V5.5 A1 1 0 0 1 5.5 4.5 Z",
    "M12 4.5 V19.5",
    "M7 8 H10 M7 12 H10",
  ],
  collapse: [
    "M5 4 H19 A1 1 0 0 1 20 5 V19 A1 1 0 0 1 19 20 H5 A1 1 0 0 1 4 19 V5 A1 1 0 0 1 5 4 Z",
    "M8 4 V20",
    "M14 9 L11 12 L14 15",
  ],
  expand: [
    "M5 4 H19 A1 1 0 0 1 20 5 V19 A1 1 0 0 1 19 20 H5 A1 1 0 0 1 4 19 V5 A1 1 0 0 1 5 4 Z",
    "M8 4 V20",
    "M14 9 L17 12 L14 15",
  ],
  eye: [
    "M2.5 12 A9.5 6 0 0 1 21.5 12 A9.5 6 0 0 1 2.5 12 Z",
    "M15 12 A3 3 0 1 1 9 12 A3 3 0 1 1 15 12 Z",
  ],
  "eye-off": [
    "M7 6.9 A9.5 6 0 0 1 17 6.9 M7 17.1 A9.5 6 0 0 0 17 17.1",
    "M9.5 10.3 A3 3 0 0 1 14.5 10.3",
    "M3.5 3.5 L20.5 20.5",
  ],
  close: [
    "M5 5 L19 19 M19 5 L5 19",
  ],
  check: [
    "M4 12.5 L9.5 18 L20 6.5",
  ],
  "chevron-down": [
    "M5 9 L12 16 L19 9",
  ],
  alert: [
    "M21 12 A9 9 0 1 1 3 12 A9 9 0 1 1 21 12 Z",
    "M12 7.5 V13.5",
    "M12 17.2 H12.01",
  ],
  "arrow-up-right": [
    "M5 19 L19 5 M10 5 H19 V14",
  ],
  // Lane T (P1, item 4): arrow-left replaces lucide ArrowLeft
  // (asset-detail back link); arrow-down-left / arrow-left-right
  // replace lucide ArrowDownLeft / ArrowLeftRight (tx-row direction
  // tile). Same geometric strokes, same 24x24 box.
  "arrow-left": [
    "M20 12 H4 M10 6 L4 12 L10 18",
  ],
  "arrow-down-left": [
    "M19 5 L5 19 M14 19 H5 V10",
  ],
  "arrow-left-right": [
    "M4 12 H20 M8 8 L4 12 L8 16 M16 8 L20 12 L16 16",
  ],
  // Lane 6 (UX-major programme): two opposing arrows — the Swap
  // direction flip and the Swap nav entry. Same geometric strokes
  // as the other glyphs, same 24x24 box.
  swap: [
    "M5 8 H19 M15.5 4.5 L19 8 L15.5 11.5",
    "M19 16 H5 M8.5 12.5 L5 16 L8.5 19.5",
  ],
  copy: [
    "M8.5 8 V4.5 A1 1 0 0 1 9.5 3.5 H19.5 A1 1 0 0 1 20.5 4.5 V15.5 A1 1 0 0 1 19.5 16.5 H16.5",
    "M5 8 H15.5 A1 1 0 0 1 16.5 9 V19 A1 1 0 0 1 15.5 20 H5 A1 1 0 0 1 4 19 V9 A1 1 0 0 1 5 8 Z",
  ],
  // Lane T (P1, item 4): card is the Buy tile glyph (plus means
  // "add", not "buy"); link is the token-logo fallback mark, moved
  // in from its one-off inline SVG (same two chain-link paths).
  card: [
    "M5 6 H19 A1.5 1.5 0 0 1 20.5 7.5 V16.5 A1.5 1.5 0 0 1 19 18 H5 A1.5 1.5 0 0 1 3.5 16.5 V7.5 A1.5 1.5 0 0 1 5 6 Z",
    "M3.5 10 H20.5",
    "M6.5 14.5 H10.5",
  ],
  link: [
    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
    "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  ],
};

export function BawaIcon({
  name,
  className,
}: {
  name: BawaIconName;
  className?: string;
}): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// Scan glyph from the owner's reference: a solid dark disc with white
// corner brackets and a centre scan line. It is deliberately not a
// BawaIconName — BawaIcon is a single-colour stroke set, and this glyph
// needs a filled disc (currentColor, so callers render it with text-ink)
// plus white marks. Bracket and line proportions are measured from the
// reference image: the bracket square spans about a third of the disc,
// the centre line about five sixths of the bracket square.
export function ScanIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="23" fill="currentColor" />
      <g
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 16 H16 V20" stroke="#fff" />
        <path d="M28 16 H32 V20" stroke="#fff" />
        <path d="M20 32 H16 V28" stroke="#fff" />
        <path d="M28 32 H32 V28" stroke="#fff" />
        <path d="M17 24 H31" stroke="#fff" strokeWidth={2.5} />
      </g>
    </svg>
  );
}
