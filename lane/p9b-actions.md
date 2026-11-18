Rewrite ONLY this action row from apps/web/src/screens/dashboard.tsx. Return the full replacement ACTIONS array and action-row JSX.

Current code:
const ACTIONS = [
  { to: '/send', icon: Send, label: 'Send' },
  { to: '/receive', icon: ArrowDownToLine, label: 'Receive' },
  { to: '/transactions', icon: Activity, label: 'Activity' },
  { to: '/import-wallet', icon: Wallet, label: 'Import' },
] as const;

<div className="grid grid-cols-4 gap-2">
  {ACTIONS.map(({ to, icon: Icon, label }) => (
    <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]">
      <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
    </Link>
  ))}
</div>

Change: remove Import entirely (it belongs in wallet management). Keep exactly Send (/send), Receive (/receive), Activity (/transactions) — all three are real screens. Change the grid to grid-cols-3. Remove the now-unused Wallet import from lucide-react. Do not add Swap or Buy — there is no swap engine or on-ramp. Keep all other classes, icons and labels exactly as they are.
