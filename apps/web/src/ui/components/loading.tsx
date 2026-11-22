export type BawaLoadingProps = {
  label?: string;
  className?: string;
  // Compact row loader for fixed-height containers (skeletons): the
  // full loader is ~110px tall (48px spinner + dots + 1.5rem label),
  // so inside a 68px skeleton row its label spilled over the
  // container's bottom border, half-clipped (P2). The compact row
  // keeps the same label and dots beside a 24px spinner, so it fits
  // the row it loads in. The default column loader is unchanged.
  compact?: boolean;
};

const animationStyles = `
  .bawa-loading .bawa-draw-circle {
    animation: bawa-loading-draw 1.6s linear infinite;
  }

  .bawa-loading .bawa-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 45% 55% 52% 48% / 55% 48% 52% 45%;
    background-color: currentColor;
    animation: bawa-loading-dot 1.2s ease-in-out infinite;
  }

  @keyframes bawa-loading-draw {
    to { stroke-dashoffset: -100; }
  }

  @keyframes bawa-loading-dot {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-3px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .bawa-loading .bawa-draw-circle,
    .bawa-loading .bawa-dot {
      animation: none;
    }
  }
`;

export function BawaLoading({
  label = "Loading…",
  className,
  compact = false,
}: BawaLoadingProps) {
  const size = compact ? 24 : 48;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={["bawa-loading", compact && "bawa-loading-compact", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        color: "var(--bawa-ink)",
        backgroundColor: "var(--bawa-paper)",
      }}
    >
      <style>{animationStyles}</style>

      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 48 48"
        width={size}
        height={size}
      >
        <path
          className="bawa-draw-circle"
          d="M24 5 C35 3 44 14 42 25 C44 36 33 44 23 42 C12 44 4 33 6 22 C4 11 14 4 24 5 Z"
          pathLength={100}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="80 20"
          fill="none"
        />
      </svg>

      <div
        aria-hidden="true"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="bawa-dot"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>

      <span
        className="font-display"
        style={
          compact
            ? { fontSize: "0.875rem", lineHeight: 1.2 }
            : { fontSize: "1.5rem", lineHeight: 1.2 }
        }
      >
        {label}
      </span>
    </div>
  );
}
