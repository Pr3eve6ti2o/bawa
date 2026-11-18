```tsx
const avatar = (
  <span className="relative flex size-10 shrink-0 items-center justify-center">
    <span
      className="flex size-10 items-center justify-center rounded-full text-[11px] font-bold text-[#19223a]"
      style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
    >
      {config.symbol}
    </span>
    <span className="absolute -bottom-1 -right-1 flex h-4 items-center rounded-full bg-[#293654] px-1 text-[8px] font-bold text-[#c8d0e8] ring-1 ring-[#19223a]">
      {config.symbol}
    </span>
  </span>
);
```