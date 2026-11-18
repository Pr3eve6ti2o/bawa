Rewrite ONLY the avatar block in apps/web/src/screens/asset-rows.tsx: the `avatar` const inside the visible.map (the coloured circle with the chain badge). Do not touch the loading skeleton, the error/retry row, the balance formatting, or anything else.

Current avatar shows config.displayName.slice(0, 1) — the first letter of the chain name — in a coloured circle (CHAIN_CHIP_COLORS) with a small symbol badge bottom-right. That is wrong: TRON and TON both render "T", so their rows are indistinguishable.

Change the circle to show the chain symbol (config.symbol: BTC, ETH, TRX, TON) instead of the display-name initial, at a size that fits the 40px circle (text-[11px] or smaller as needed). Keep the CHAIN_CHIP_COLORS background, the 40px circle, and the small symbol badge bottom-right exactly as they are.

Return the full replacement avatar JSX only. Acceptance: TRON shows TRX and TON shows TON in the circle.
