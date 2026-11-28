import type { ComponentProps } from "react";

import { BawaLoading } from "./loading";

/** In-place loading pattern — renders a compact pulsing bar (UX-major Lane 7 merge, 2026-11-26):
    the full BawaLoading spinner (~99 px) overflowed every fixed-height
    box this component is placed in, so the spinner lives in BawaLoading
    only — never inside a Skeleton.
    P0-6 (one error pattern everywhere): the bar alone is wordless —
    the Transactions screen loaded for 10–35 s behind a bare dashed
    box with no text. Pass `label` and the box renders the compact
    BawaLoading row instead (24 px spinner + dots + the label beside
    it, ~24 px tall, so it fits the h-20/h-24 boxes the old spinner
    spilled out of) — skeleton + one line of text, as the pattern
    requires. Without a label the wordless pulsing bar is unchanged
    (asset rows, dashboard hero).
    P3-B (style B): the box itself is flat — uniform 12px radius,
    1px solid ink border. The old shape was a hand-drawn dashed
    wobbly outline (inline SVG path), which made loading read as
    "not built yet" (Lane F §1.10). */
export function Skeleton({
  className,
  label,
  ...props
}: ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      {...props}
      data-slot="skeleton"
      className={className}
      style={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        backgroundColor: "var(--bawa-paper)",
        color: "var(--bawa-ink)",
        border: "1px solid var(--bawa-ink)",
        borderRadius: "12px",
        ...props.style,
      }}
    >
      {label === undefined ? (
        <div
          role="status"
          aria-label="Loading…"
          style={{
            width: "60%",
            height: "12px",
            borderRadius: "999px",
            backgroundColor: "var(--bawa-ink)",
            opacity: 0.18,
            animation: "bawa-skeleton-pulse 1.4s ease-in-out infinite",
          }}
        >
          <span className="sr-only">Loading…</span>
        </div>
      ) : (
        <BawaLoading compact label={label} />
      )}
      <style>{`@keyframes bawa-skeleton-pulse { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.28; } }`}</style>
    </div>
  );
}
