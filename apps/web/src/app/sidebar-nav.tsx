import { Fragment } from "react";
import { NavLink } from "react-router";
import {
  ArrowDownToLine,
  Coins,
  DoorOpen,
  FileInput,
  History,
  House,
  KeyRound,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

export const MORE_LINKS: readonly NavItem[] = [
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/transactions", label: "Transactions", icon: History },
  { to: "/track", label: "Track a transaction", icon: Search },
  { to: "/import-wallet", label: "Import wallet", icon: FileInput },
  { to: "/create-wallet", label: "Create wallet", icon: Plus },
  { to: "/create", label: "Create", icon: Wrench },
  { to: "/security", label: "Security", icon: ShieldCheck },
  { to: "/networks", label: "Networks", icon: Network },
  { to: "/mnemonic-backup", label: "Mnemonic backup", icon: KeyRound },
  { to: "/welcome", label: "Welcome", icon: DoorOpen },
];

export const SIDEBAR_LINKS: readonly NavItem[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/assets", label: "Assets", icon: Coins },
  { to: "/receive", label: "Receive", icon: ArrowDownToLine },
  { to: "/send", label: "Send", icon: Send },
  ...MORE_LINKS,
];

export type SidebarNavProps = {
  /** Icon-rail mode (Safe SideDrawer pattern): icons only, labels sr-only. */
  readonly collapsed?: boolean;
  /** Collapse toggle handler, owned by the app shell in app.tsx. */
  readonly onToggleCollapse?: () => void;
};

export function SidebarNav({
  collapsed = false,
  onToggleCollapse,
}: SidebarNavProps) {
  return (
    <>
      <div
        className={
          "flex h-[72px] shrink-0 items-center gap-3 " +
          (collapsed ? "justify-center px-2" : "px-4")
        }
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-panel-accent-from to-panel-accent-to text-lg font-bold text-primary-foreground">
          <Wallet className="size-5" aria-hidden="true" />
        </div>
        <span
          className={
            collapsed ? "sr-only" : "text-[15px] font-bold text-panel-text"
          }
        >
          Bawa Web Wallet
        </span>
      </div>

      <nav
        aria-label="Main navigation"
        className="flex flex-col gap-1 px-3 pb-4"
      >
        {SIDEBAR_LINKS.map(({ to, label, icon: Icon }) => (
          <Fragment key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                [
                  "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent",
                  collapsed ? "justify-center px-2" : "",
                  isActive
                    ? "bg-panel-active font-semibold text-panel-text"
                    : "font-medium text-panel-text-muted hover:bg-panel-hover hover:text-panel-text",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-panel-accent"
                    />
                  )}
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className={collapsed ? "sr-only" : undefined}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>

            {to === "/send" && (
              <hr className="my-2 border-panel-border" />
            )}
          </Fragment>
        ))}
      </nav>

      <div className="mt-auto border-t border-panel-border px-3 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-panel-text-muted hover:bg-panel-hover hover:text-panel-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent" +
            (collapsed ? " justify-center px-2" : "")
          }
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-5 shrink-0" aria-hidden="true" />
          )}
          <span className={collapsed ? "sr-only" : undefined}>Collapse</span>
        </button>
      </div>
    </>
  );
}
