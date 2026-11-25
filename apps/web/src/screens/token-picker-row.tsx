import type { ReactNode } from 'react';

/**
 * One token-picker row (Fix-all Lane H, item 12: jscpd family J).
 * The Receive and Send token pickers rendered the same <li> + <button>
 * shell — same classes, same selected sun background, same focus ring —
 * and differed only in the logo and the label inside. The shell lives
 * here; each screen passes its logo and label.
 *
 * Redesign Lane 3 (Send, 2026-11-25): the row is 56 px tall with a
 * 14 px label — the old row was ~40 px with a 13 px label, below both
 * the 44 px touch rule and the 14 px body floor (DESIGN-SYSTEM §2.3,
 * §2.5). The button IS the row (the tap target is the visible row),
 * and the label may run to two lines (name + balance) instead of one
 * truncated line — wrapping beats truncation for the balance the user
 * picks on. Same props, so both callers keep working unchanged.
 */
export function TokenPickerRow({
  selected,
  onSelect,
  logo,
  balanceText,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  logo: ReactNode;
  /** Second line under the label — the balance the user picks on.
      Optional: Receive does not pass it and renders one line, as
      before. Send passes each row's balance (or "Balance
      unavailable" / "Loading balance…"), so the balance is the
      decision input at pick time instead of hidden until after the
      pick. */
  balanceText?: string;
  children: ReactNode;
}) {
  return (
    <li
      className={`flex items-center rounded-bawa-sm border-2 border-ink ${
        selected ? 'bg-sun' : 'bg-paper'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-bawa-sm px-3 py-2 text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        {logo}
        <span className="block min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">
            {children}
          </span>
          {balanceText !== undefined && (
            <span className="block truncate text-xs text-muted-foreground">
              {balanceText}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
