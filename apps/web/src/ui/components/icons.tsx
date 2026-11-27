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

// Hand-authored curves: even the short strokes have a little wobble.
const ICON_PATHS: Record<BawaIconName, readonly string[]> = {
  wallet: [
    "M3.2 10.5 C6.2 9.9 16.9 10.4 20.3 10.2 C20.8 12.8 20.4 16.8 20.6 19.2 Q20.4 20.4 19.1 20.3 C14.1 20.1 8.8 20.6 4.1 20.2 Q2.9 20 3 18.5 C3.2 16 2.7 12.7 3.2 10.5 Z M3.3 10.2 Q3.6 8.4 8.6 8.5 M17.9 8.7 Q20.2 8.5 20.3 10.2",
    "M20.5 13.5 Q18.7 13.2 17.4 13.5 Q16.3 13.6 16.4 15.1 Q16.3 16.7 17.7 16.6 Q19.3 16.8 20.5 16.5",
    "M16.7 5.5 C16.9 7.2 15.4 8.7 13.7 8.5 C11.9 8.7 10.5 7.3 10.6 5.5 C10.4 3.8 11.8 2.4 13.6 2.5 C15.3 2.3 16.8 3.7 16.7 5.5 Z M8.2 4.8 Q7.5 4.1 7.1 3.3 M19.2 5.2 Q20 4.6 20.6 3.9",
  ],
  home: [
    "M2.9 10.3 Q7.1 6.2 11.9 2.9 Q16.6 6.3 21.1 10.6",
    "M5 9 Q4.8 14.1 5.2 20.5 Q8.4 20.7 10 20.4 Q9.8 17.5 10.1 15 Q12 14.7 13.9 15.1 Q14.1 17.7 13.8 20.5 Q16.7 20.8 19 20.4 Q19.3 14.8 18.9 9.2",
  ],
  coins: [
    "M19.8 7.2 C20.1 9 16.4 10.2 12 10 C7.5 10.3 3.9 9 4.1 7.1 C3.9 5.3 7.7 4.3 12.1 4.5 C16.7 4.3 19.9 5.5 19.8 7.2 Z",
    "M4.1 7.2 Q3.8 9.4 4.1 11.4 C4.4 13.5 8 14.2 12 14 C16.1 14.3 19.7 13.1 19.8 11.4 Q20 9.3 19.8 7.2",
    "M4.1 11.8 Q2.7 12.4 3.1 14.1 C3.4 15.9 7 16.8 11.3 16.7 C15.3 16.9 18.6 15.8 18.8 14.1 M3.1 14.1 Q2.9 16.3 3.2 17.8 C3.6 19.7 7 20.2 11.3 20 C15.4 20.3 18.8 19 18.9 17.5 Q19.1 15.3 18.8 13.3",
  ],
  receive: [
    "M12.1 3.1 Q11.7 8.5 12.1 14.6 M7.7 10.8 Q9.8 13.3 12.1 14.9 Q14.4 13 16.3 10.7",
    "M3.2 14.4 Q3 17.1 3.4 20 Q11.9 20.5 20.7 19.9 Q21 17.2 20.7 14.5",
  ],
  send: [
    "M5.1 18.9 Q11.7 12.8 18.7 5.2",
    "M9.6 5.2 Q14.5 4.8 18.9 5.1 Q19.3 9.6 18.8 14.2",
  ],
  activity: [
    "M3.6 9.2 C2 14.1 5.3 20.8 11.9 20.5 C17.4 20.8 21.4 16.5 20.8 11.2 C20.7 6.4 16.6 2.8 11.7 3.2 C8.2 3 5.4 4.4 3.8 7.2",
    "M3.7 3.5 Q3.5 5.5 3.8 7.4 Q5.8 7.6 7.8 7.2",
    "M12.1 7.3 Q11.8 10.1 12 12.3 Q14.1 13.2 15.7 14.5",
  ],
  search: [
    "M16.8 10.1 C17.1 13.8 14.1 16.9 10.4 16.8 C6.6 17.1 3.6 14 3.7 10.2 C3.4 6.5 6.5 3.5 10.3 3.7 C14 3.4 17 6.4 16.8 10.1 Z",
    "M15 15 Q18.3 17.8 20.8 21.1",
  ],
  shield: [
    "M12 3 Q16.6 5.4 20.1 5.8 C20.5 13 18.8 17.7 12.1 21.1 C5.5 18 3.5 12.9 3.9 5.9 Q8.1 5.1 12 3 Z",
    "M8 12.1 Q9.7 13.7 10.9 15 Q13.6 12.3 16.1 9.5",
  ],
  network: [
    "M10.8 6.8 Q8.4 10.9 6.1 16.1 M13.2 6.8 Q15.8 11 17.9 16.1 M7.4 18.4 Q12 18.1 16.5 18.4",
    "M14.4 4.8 C14.5 6.2 13.4 7.3 12 7.1 C10.6 7.3 9.4 6.2 9.6 4.7 C9.4 3.3 10.7 2.3 12.1 2.4 C13.5 2.2 14.5 3.4 14.4 4.8 Z",
    "M7.4 18.3 C7.5 19.7 6.4 20.9 4.9 20.7 C3.5 20.9 2.4 19.6 2.6 18.2 C2.4 16.8 3.6 15.8 5 15.9 C6.5 15.7 7.5 16.9 7.4 18.3 Z",
    "M21.4 18.4 C21.5 19.8 20.3 20.9 18.9 20.7 C17.5 20.9 16.3 19.7 16.5 18.3 C16.3 16.9 17.6 15.8 19 16 C20.4 15.8 21.5 17 21.4 18.4 Z",
  ],
  key: [
    "M12.1 7.8 C12.4 10.2 10.4 12.3 8 12.1 C5.5 12.4 3.5 10.4 3.7 7.9 C3.5 5.5 5.5 3.6 8 3.8 C10.4 3.5 12.3 5.4 12.1 7.8 Z",
    "M11.1 11.2 Q15.3 15.8 20.2 20.1 M15.2 15.5 Q16.7 14.3 17.9 12.8 M18 18.2 Q19.5 17 20.8 15.5",
  ],
  // Lane T (P1, item 4): book replaces the copy icon on Address
  // book (a copy glyph reads as "copy", not an address book).
  book: [
    "M4.8 4.6 Q12 3.1 19.2 4.6 Q19.5 12.1 19.1 19.4 Q12 18 4.9 19.4 Q4.6 12 4.8 4.6 Z",
    "M12 3.3 Q11.7 11.2 12 19.3",
    "M7 8.2 Q8.8 7.8 10.2 8 M7 12.2 Q8.8 11.8 10.2 12",
  ],
  collapse: [
    "M4.2 3.7 Q12 3.3 19.8 3.8 Q20.4 12 20 20.2 Q12.1 20.6 4 20.1 Q3.6 12 4.2 3.7 Z M8.1 3.8 Q7.8 12.2 8.2 20.1",
    "M17.3 12.1 Q14.2 11.8 10.9 12.2 M14.1 8.8 Q12.3 10.3 10.7 12.2 Q12.6 13.8 14.2 15.4",
  ],
  expand: [
    "M4.1 3.8 Q12.2 3.4 19.9 3.7 Q20.3 12.1 19.9 20.1 Q12 20.7 4.2 20.2 Q3.5 12.1 4.1 3.8 Z M8.2 3.8 Q7.9 11.9 8.1 20.2",
    "M10.8 12.1 Q13.8 11.8 17.3 12.2 M14 8.9 Q15.8 10.6 17.5 12.2 Q15.8 14 14.1 15.4",
  ],
  eye: [
    "M2.7 12 C5 7.7 8.3 5.7 12.1 5.9 C16 5.6 19.3 8.2 21.3 12.2 C19 16.2 15.8 18.4 11.9 18.1 C8 18.4 4.8 16 2.7 12 Z",
    "M15.1 12 C15.2 13.8 13.8 15.2 12 15.1 C10.2 15.3 8.8 13.8 8.9 12 C8.8 10.2 10.2 8.9 12.1 9 C13.9 8.8 15.2 10.3 15.1 12 Z",
  ],
  "eye-off": [
    "M3 12 Q5 8.6 7.3 7.2 M10.3 6.1 C14.5 5.2 18.7 7.6 21.2 12.1 Q19.7 15 17.4 16.5 M14.7 17.6 C9.6 19.4 5.2 16.6 3 12",
    "M10.3 9.5 C12.7 8.1 15.6 10.2 14.8 12.8 M13.8 14.7 Q10.2 16 9 12.5",
    "M3.4 3.6 Q11.9 12.5 20.6 20.5",
  ],
  close: [
    "M5.1 4.9 C9.6 9.1 14 14.5 19 19.1",
    "M18.9 5.1 C14.2 9.3 10.1 14.5 5 18.9",
  ],
  check: [
    "M4.3 12.4 Q7.2 14.6 9.7 17.3 Q14.1 11.8 19.8 6.8",
  ],
  "chevron-down": [
    "M5.1 8.3 Q8.4 12.1 12.1 15.7 Q15.4 12.4 18.9 8.4",
  ],
  alert: [
    "M20.9 12.1 C21.3 17 17 21.2 11.9 20.9 C6.9 21.3 2.7 17 3.1 11.9 C2.8 6.9 7 2.8 12.1 3.1 C17.2 2.7 21.2 7.1 20.9 12.1 Z",
    "M12.1 7.2 Q11.8 10.1 12 13.4",
    "M12.6 16.7 C12.7 17.3 11.8 17.5 11.5 17 C11.2 16.4 12.2 16.1 12.6 16.7 Z",
  ],
  "arrow-up-right": [
    "M5 19.1 C9.4 14.4 14.3 10 19 5.1",
    "M10 5.2 Q14.5 4.8 19.1 5.1 Q19.4 9.9 18.9 14",
  ],
  // Lane T (P1, item 4): arrow-left replaces lucide ArrowLeft
  // (asset-detail back link); arrow-down-left / arrow-left-right
  // replace lucide ArrowDownLeft / ArrowLeftRight (tx-row direction
  // tile). Same hand-drawn quadratic strokes, same 24x24 box.
  "arrow-left": [
    "M19.9 12.1 Q11.5 11.7 4.1 12.1",
    "M9.8 6.5 Q6.6 9.3 4 12.1 Q6.8 14.9 9.9 17.5",
  ],
  "arrow-down-left": [
    "M19 4.9 C14.6 9.6 9.7 14 5 18.9",
    "M14 18.8 Q9.5 19.2 4.9 18.9 Q4.6 14.1 5.1 10",
  ],
  "arrow-left-right": [
    "M4 12.1 Q12 11.7 20 12.1",
    "M8 8.1 Q5.5 10.3 4 12.1 Q5.6 14.3 8 16",
    "M16 8.1 Q18.5 10.3 20 12.1 Q18.4 14.3 16 16",
  ],
  // Lane 6 (UX-major programme): two opposing arrows — the Swap
  // direction flip and the Swap nav entry. Same hand-drawn quadratic
  // strokes as the other glyphs, same 24x24 box.
  swap: [
    "M4.5 8 Q10 7.4 19 8",
    "M15.5 4.8 Q18 6.4 19.2 8.1 Q18 10.4 15.6 11.6",
    "M19.5 16 Q14 16.6 5 16",
    "M8.5 12.8 Q6 14.4 4.8 16.1 Q6 18.4 8.4 19.6",
  ],
  copy: [
    "M8.1 7.4 Q7.8 5.4 8.2 3.4 Q14.4 3.1 20.5 3.6 Q20.8 10.2 20.4 16.8 Q18.5 17.1 16.6 16.8",
    "M3.6 7.6 Q10 7.2 16.6 7.7 Q16.9 14.2 16.4 20.5 Q10.1 20.9 3.5 20.4 Q3.2 14 3.6 7.6 Z",
  ],
  // Lane T (P1, item 4): card is the Buy tile glyph (plus means
  // "add", not "buy"); link is the token-logo fallback mark, moved
  // in from its one-off inline SVG (same two chain-link paths).
  card: [
    "M3.5 6.2 Q12 5.8 20.5 6.2 Q20.8 12 20.4 17.8 Q12.1 18.2 3.6 17.8 Q3.2 12 3.5 6.2 Z",
    "M3.5 9.8 Q12 9.4 20.5 9.8",
    "M6.5 14.2 Q8.5 13.9 10.5 14.1",
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
