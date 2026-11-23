import type { ReactNode } from 'react';

/**
 * One token-picker row (Fix-all Lane H, item 12: jscpd family J).
 * The Receive and Send token pickers rendered the same <li> + <button>
 * shell — same classes, same selected sun background, same focus ring —
 * and differed only in the logo and the label inside. The shell lives
 * here; each screen passes its logo and label.
 */
export function TokenPickerRow({
  selected,
  onSelect,
  logo,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  logo: ReactNode;
  children: ReactNode;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-bawa-sm border-2 border-ink p-1.5 ${
        selected ? 'bg-sun' : 'bg-paper'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-bawa-sm text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        {logo}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{children}</span>
      </button>
    </li>
  );
}
