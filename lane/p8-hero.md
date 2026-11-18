Rewrite ONLY the balance-hero block in apps/web/src/screens/dashboard.tsx (the "Portfolio balance" div with the Unavailable text and Refresh button). Do not touch the action row, asset list, or lock banners.

Current hero always says "Unavailable" — even when every balance is exactly zero. Balances come from useWallet() as balances[chain] with status 'loading' | 'zero' | 'available' | 'unavailable' | 'error' and optional value (native base units). There is no price feed, so never invent a fiat total.

New hero must: (1) when all four balances are 'zero' or 'available' with value '0', show "$0.00" — the honest fiat value of zero holdings; (2) while any balance is 'loading', keep showing the last known hero text (hold it in a ref) instead of flashing Unavailable; (3) when a balance is 'unavailable' or 'error', show "Unavailable" with a Retry button calling refreshBalances() — never render an error as zero; (4) otherwise (some balance available, no price feed) show "Unavailable" plus the plain line "No price feed connected — portfolio total unavailable."

Return the full replacement hero JSX. Keep the existing dark-navy styling and the Refresh button.
