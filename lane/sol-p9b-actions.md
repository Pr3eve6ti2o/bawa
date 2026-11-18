```tsx
const ACTIONS = [
  { to: '/send', icon: Send, label: 'Send' },
  { to: '/receive', icon: ArrowDownToLine, label: 'Receive' },
  { to: '/transactions', icon: Activity, label: 'Activity' },
] as const;

<div className="grid grid-cols-3 gap-2">
  {ACTIONS.map(({ to, icon: Icon, label }) => (
    <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-[15px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff]">
      <span className="flex size-14 items-center justify-center rounded-full bg-[#263451] text-[#b4aaff] transition-colors hover:bg-[#2a3651]">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="text-[11px] font-semibold text-[#edf0fc]">{label}</span>
    </Link>
  ))}
</div>
```

Remove `Wallet` from the existing `lucide-react` import, leaving all other imports unchanged.