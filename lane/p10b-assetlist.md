Rewrite ONLY this avatar block from apps/web/src/screens/asset-rows.tsx. Return the full replacement avatar JSX.

Current code:
const avatar = (
  <span className="relative flex size-10 shrink-0 items-center justify-center">
    <span
      className="flex size-10 items-center justify-center rounded-full text-[15px] font-bold text-[#19223a]"
      style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
    >
      {config.displayName.slice(0, 1)}
    </span>
    <span className="absolute -bottom-1 -right-1 flex h-4 items-center rounded-full bg-[#293654] px-1 text-[8px] font-bold text-[#c8d0e8] ring-1 ring-[#19223a]">
      {config.symbol}
    </span>
  </span>
);

Change: the circle must show the chain symbol (config.symbol: BTC, ETH, TRX, TON) instead of the display-name initial — TRON and TON both render "T" today, so their rows are indistinguishable. Use text-[11px] so the 2–3 letter symbol fits the 40px circle. Keep the CHAIN_CHIP_COLORS background, the 40px circle, and the small symbol badge bottom-right exactly as they are. Do not touch anything else in the file.
