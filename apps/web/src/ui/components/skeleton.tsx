import type { ComponentProps } from "react";


/** @deprecated New code should use BawaLoading.
    Renders a compact pulsing bar (UX-major Lane 7 merge, 2026-11-26):
    the full BawaLoading spinner (~99 px) overflowed every fixed-height
    box this component is placed in, so the spinner lives in BawaLoading
    only — never inside a Skeleton. */
export function Skeleton({
  className,
  ...props
}: ComponentProps<"div">) {
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
        borderRadius: "14px 18px 12px 17px / 17px 12px 18px 13px",
        ...props.style,
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <path
          d="M12 4 C46 1 76 6 102 3 S158 6 188 4 Q197 3 196 14 C193 42 199 73 196 106 Q197 116 185 115 C153 118 119 112 91 116 S42 112 13 116 Q3 117 4 105 C7 74 1 43 4 15 Q3 4 12 4 Z"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

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
      <style>{`@keyframes bawa-skeleton-pulse { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.28; } }`}</style>
    </div>
  );
}
