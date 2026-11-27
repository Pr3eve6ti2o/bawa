type BawaLoadingProps = {
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

// P0-6 (one error pattern everywhere): a bare "Loading…" on a lazy
// route says nothing about where the user is going. When no explicit
// label is passed — the app shell's Suspense fallback renders
// <BawaLoading /> with none — the route name rides along as a second
// line under the literal "Loading…" label, so the existing
// 'Loading…' assertions (app.test.tsx settle loop,
// app-routing.test.tsx first-navigation test) keep matching while
// the user sees which screen is loading. The basename (/bawa/) is
// stripped: BrowserRouter serves every route under it.
const ROUTE_NAMES: Record<string, string> = {
  '': 'Home',
  welcome: 'Welcome',
  'create-wallet': 'Create a wallet',
  create: 'Create a wallet',
  'import-wallet': 'Import a wallet',
  'mnemonic-backup': 'Backup',
  assets: 'Assets',
  receive: 'Receive',
  send: 'Send',
  transactions: 'Transactions',
  track: 'Track a transaction',
  networks: 'Networks',
  wallets: 'Wallets',
  security: 'Security',
  lock: 'Lock',
};

function routeNameFromPath(pathname: string): string | null {
  if (typeof window === 'undefined') return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'bawa') segments.shift();
  const [first, second] = segments;
  if (first === undefined) return 'Home';
  if (first === 'transactions' && second !== undefined) return 'Transaction details';
  if (first === 'assets' && second !== undefined) return 'Asset details';
  return ROUTE_NAMES[first] ?? first.charAt(0).toUpperCase() + first.slice(1);
}

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
  label,
  className,
  compact = false,
}: BawaLoadingProps) {
  const size = compact ? 24 : 48;
  // An explicit label always wins. With none, the loader says
  // "Loading…" and names the route underneath (see
  // routeNameFromPath): the Suspense fallback carries no label of
  // its own, so this is what names the screen being loaded.
  const displayLabel = label ?? 'Loading…';
  const routeName =
    label === undefined && !compact
      ? routeNameFromPath(
          typeof window === 'undefined' ? '/' : window.location.pathname,
        )
      : null;
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
        {displayLabel}
      </span>
      {routeName !== null && (
        <span className="text-sm text-muted-foreground">{routeName}</span>
      )}
    </div>
  );
}
