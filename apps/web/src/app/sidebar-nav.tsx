import { NavLink } from "react-router";

import { BawaIcon, type BawaIconName } from "../ui/components/icons";

type NavItem = {
  to: string;
  label: string;
  icon: BawaIconName;
  end?: boolean;
};

type SidebarNavProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onPreloadRoute?: (to: string) => void;
};

type SidebarNavGroup = {
  heading: string;
  items: NavItem[];
};

// P1 (Lane S1): the 15-link flat sidebar is grouped — Money / Wallets /
// Settings, no Welcome. The More menu is gone; its remaining items live
// under the header "Account 1 ›" → Wallets screen, and the grouped
// sidebar mirrors that split: Money holds the daily actions (Swap and
// Activity promoted out of More), Wallets holds account management,
// Settings holds Security, Networks and Mnemonic backup. Track lives
// inside Transactions only (linked from there), and Add wallet
// (Create + Import merged) lives on the Wallets screen itself, which
// already offers both. No route is deleted — only nav entries.
export const SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    heading: "Money",
    items: [
      { to: "/", label: "Home", icon: "home", end: true },
      { to: "/assets", label: "Assets", icon: "coins" },
      { to: "/receive", label: "Receive", icon: "receive" },
      { to: "/send", label: "Send", icon: "send" },
      { to: "/swap", label: "Swap", icon: "swap" },
      { to: "/transactions", label: "Activity", icon: "activity" },
    ],
  },
  {
    heading: "Wallets",
    items: [
      { to: "/wallets", label: "Wallets", icon: "wallet" },
      { to: "/address-book", label: "Address book", icon: "book" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { to: "/security", label: "Security", icon: "shield" },
      { to: "/networks", label: "Networks", icon: "network" },
      { to: "/mnemonic-backup", label: "Mnemonic backup", icon: "key" },
    ],
  },
];

/** Every sidebar destination, flat, in display order. */
export const SIDEBAR_LINKS: NavItem[] = SIDEBAR_GROUPS.flatMap(
  (group) => group.items,
);

export function SidebarNav({
  collapsed = false,
  onToggleCollapse = () => {},
  onPreloadRoute,
}: SidebarNavProps) {
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    // Width is owned by the shell in app.tsx (desktop:w-[224px] / desktop:w-[72px]);
    // this aside fills it exactly. A fixed width here drifted from the
    // shell — w-64 is 256px against the shell's 224px (w-20 is 80px
    // against 72px) — and overflowed the shell's sticky wrapper, whose
    // overflow-y-auto computes overflow-x to auto: a permanent
    // horizontal scrollbar on every desktop page.
    <aside className="flex h-full w-full shrink-0 flex-col border-r-2 border-ink bg-paper text-ink">
      <div
        className={[
          "flex shrink-0 items-center p-4",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink"
        >
          <BawaIcon name="wallet" className="size-6" />
        </div>
        {/* Brand wordmark (Lane 1): the desktop shell showed the name
            "Bawa" nowhere above the fold — the sidebar had a bare icon
            tile and the header only the account link. The wordmark
            renders only when expanded; collapsed stays icon-only, and
            it is a plain label, not a nav item (no route or order
            change — the 11 links below are untouched). */}
        {!collapsed && (
          <span className="ml-3 truncate font-display text-xl font-bold tracking-tight text-ink">
            Bawa
          </span>
        )}
      </div>

      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4"
      >
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.heading} role="group" aria-label={group.heading}>
            {!collapsed && (
              <p
                aria-hidden="true"
                className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-ink/70"
              >
                {group.heading}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                onMouseEnter={() => onPreloadRoute?.(item.to)}
                onFocus={() => onPreloadRoute?.(item.to)}
                className={({ isActive }) =>
                  [
                    // UX-major Lane 2: py-3 (44 px row) — the old py-2
                    // rows were 36 px, below the DESIGN-SYSTEM §2.5
                    // touch rule for nav items.
                    "flex w-full items-center gap-3 rounded-bawa px-3 py-3 text-sm font-semibold transition-colors",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? "bg-sun font-semibold text-ink"
                      : "bg-paper text-ink hover:bg-sun",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className="shrink-0 text-ink">
                      <BawaIcon name={item.icon} className="size-5" />
                    </span>

                    <span
                      className={
                        collapsed
                          ? "sr-only"
                          : "flex min-w-0 items-center gap-2"
                      }
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-bawa-sm border-2 border-ink bg-coral"
                        />
                      )}
                      {/* P3: the active item's coral square steals ~18px
                          from the label, so at 224px "Mnemonic backup"
                          clipped to "Mnemonic back…". The labels are
                          copy and must not be shortened; the label wraps
                          to two lines instead. */}
                      <span className="min-w-0 leading-snug">{item.label}</span>
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <footer className="mt-auto shrink-0 border-t-2 border-ink p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapseLabel}
          aria-expanded={!collapsed}
          title={collapseLabel}
          className={[
            "flex w-full items-center gap-3 rounded-bawa bg-paper px-3 py-3 text-sm font-semibold text-ink transition-colors hover:bg-sun",
            collapsed ? "justify-center" : "",
          ].join(" ")}
        >
          <span aria-hidden="true" className="shrink-0 text-ink">
            <BawaIcon
              name={collapsed ? "expand" : "collapse"}
              className="size-5"
            />
          </span>
          <span className={collapsed ? "sr-only" : "truncate"}>
            {collapseLabel}
          </span>
        </button>
      </footer>
    </aside>
  );
}
