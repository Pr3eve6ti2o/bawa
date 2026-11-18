Rewrite ONLY this Assets section from apps/web/src/screens/dashboard.tsx. Return the full replacement section JSX. The dashboard already imports useWallet, availableFor, chainConfig, CHAIN_DECIMALS, formatNativeWithSymbol, AssetRows, Button, Skeleton and Link.

Current code:
<section aria-label="Assets">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold text-white">Assets</h2>
    <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
      <input type="checkbox" checked={hideZero} onChange={(event) => setHideZero(event.target.checked)} />
      Hide zero balances
    </label>
  </div>
  <AssetRows hideZero={hideZero} />
</section>

Change: add a Tokens/Activity tab bar directly above the section. Tokens tab shows the existing Assets section unchanged (heading, Hide-zero checkbox, AssetRows). Activity tab shows recent activity from useWallet(): history[chain].txs flattened across chains with availableFor('history'), newest first, each row a Link to /transactions/<hash> showing direction (Received/Sent/Self transfer), chain symbol, formatted amount via formatNativeWithSymbol with CHAIN_DECIMALS, date (en-GB short) or "Pending", and "· Failed"/"· Pending" for those statuses. While any shown chain is 'loading' and there are no rows yet, show a Skeleton. With no rows show "No transactions yet". With a chain 'unavailable' or 'error', show its display name plus "history unavailable" and a Retry button calling refreshHistory().

There is no NFTs tab — no NFT support exists, and unimplemented features stay absent, not shown. Keep the dark-navy styling. The tab state lives in the DashboardScreen component (useState<'tokens' | 'activity'>('tokens')).
